// ========================================================
//  СИСТЕМЫ: БОЙ — АТАКА МОНСТРА
//  monsterAttack(attacker): блок, уворот, маг/физ, яд, крепость.
//
//  НОВОЕ (v0.16): Навыки Дроу.
//  + Наследие Грозы (stormLegacy) — ответный урон Молнией.
//  + Скорость молнии (lightningSpeed) — +100% ATB при увороте.
// ========================================================

// v0.36: ход твари — один удар или навык из нескольких (battle-monster-kit.js).
function monsterAttack(attacker) {
  if (!attacker) return;
  if (monsterTagsOnTurn(attacker)) return;   // v0.36: Трус сбежал, Плач
  monsterManaTurn(attacker);   // v0.36: заклинание стоит маны
  const skill = monsterKitPickSkill(attacker);
  const hits = (skill && skill.hits) || 1;
  let landed = 0;
  for (let i = 0; i < hits; i++) {
    if (attacker.hp <= 0 || state.player.hp <= 0 || !state.battle.active) break;
    attacker.kitLastHit = 0;
    monsterStrike(attacker, skill);
    landed += attacker.kitLastHit || 0;
  }
  if (skill) monsterKitAfterSkill(attacker, skill, landed);
}

function monsterStrike(attacker, skill) {
  const p = state.player;
  const m = attacker;
  if (!m || m.hp <= 0 || p.hp <= 0) return;

  // ---- Блок ----
  if (p.blockChance > 0 && Math.random() * 100 < p.blockChance) {
    spawnFloatDamage('fighter-player', 0, 'block');
    logCombat(`🛡 Блок! Удар поглощён.`, 'log-entry block');
    return;
  }

  // ---- Точность / уворот ----
  // v0.19: опутанный шипами (Терновый вихрь эльфа) бьёт менее точно.
  const entangleMult = (typeof getEntangleAccMult === 'function') ? getEntangleAccMult(m) : 1;
  const monsterAcc = getMonsterAccuracy(m) * entangleMult;
  const playerEva = getPlayerEvasion(m);   // v0.19.1: перевес в уровнях — максимум 3
  const monsterHit = rollHit(monsterAcc, playerEva, MONSTER_MIN_HIT_CHANCE);   // v0.27: уворот не выше 65%
  if (entangleMult < 1 && typeof tickEntangle === 'function') tickEntangle(m);

  if (!monsterHit) {
    spawnFloatDamage('fighter-player', 0, 'dodge');
    logCombat(`💨 ${p.name} уворачивается от ${m.name}.`, 'log-entry');

    // ---- НОВОЕ (v0.16): Скорость молнии (lightningSpeed) ----
    // v0.23: +10/20/30/40/50% ATB по уровню; перебор сверх 100% — на следующий ход;
    //        после срабатывания — перезарядка 2 хода героя (дебафф lsCooldown).
    const speedLvl = p.learnedSkills['lightningSpeed'] || 0;
    if (speedLvl > 0 && SKILLS['lightningSpeed'] && !getDebuff('player', 'lsCooldown')) {
      const lsData = SKILLS.lightningSpeed.levels[Math.min(speedLvl, 5) - 1];
      const bonus = (lsData.value || 0) / 100;
      const b = state.battle;
      const total = (b.playerATB || 0) + bonus;
      if (total > 1) {
        b.playerATB = 1;
        b.atbCarry = Math.min(0.99, (b.atbCarry || 0) + (total - 1));
      } else {
        b.playerATB = total;
      }
      addDebuff('player', 'lsCooldown', { turnsLeft: SKILLS.lightningSpeed.cooldown || 2 });
      const carryTxt = b.atbCarry > 0 ? ` Ход сразу, и ещё ${Math.round(b.atbCarry * 100)}% на следующий.` : '';
      logCombat(`⚡ Скорость молнии! ATB +${lsData.value}%.${carryTxt}`, 'log-entry player-skill');
      spawnFloatDamage('fighter-player', 0, 'magic', { text: `+${lsData.value}% ⚡` });
      // v0.19.1: уворот заряжает следующий Разряд — он гарантированно парализует
      if (p.learnedSkills.discharge && !getDebuff('player', 'stormCharge')) {
        addDebuff('player', 'stormCharge', { turnsLeft: 1 });
        logCombat(`⚡ Заряд молнии: следующий Разряд парализует цель.`, 'log-entry player-skill');
      }
    }

    updateTopStatus();
    updateBattleUI();
    return;
  }

  // v0.36: полумагический монстр — каждый удар либо магия, либо физика.
  // Без маны магическая тварь бьёт телом (monsterManaTurn).
  const hitIsMagic = !m.mpDry && (m.attackType === 'magic' || (m.attackType === 'hybrid' && Math.random() < 0.5));

  // ---- v0.19: меч — парирование физического удара ----
  if (!hitIsMagic && typeof tryWeaponParry === 'function' && tryWeaponParry(m)) {
    updateTopStatus();
    updateBattleUI();
    return;
  }

  // ---- Урон ----
  const base = m.mpDry ? Math.floor(m.atk * MONSTER_DRY_ATK_MULT) : m.atk;
  const variance = Math.floor(base * 0.3);
  let raw = base + Math.floor(Math.random() * variance * 2) - variance;
  raw = monsterKitRaw(m, skill, raw);   // v0.36: навык, зарубки на герое, добивание
  raw = monsterTagRaw(m, raw);          // v0.36: Стайный, Свирепый, Злопамятный, Осадный
  const armorLeft = 1 - (m.armorIgnore || 0);   // v0.36: Острый
  let dmg;

  const mixtureDefMult = getMixtureDefMult();
  // v0.20: «Защита» в ручном режиме режет и физику, и магию
  const guardMult = typeof getGuardMult === 'function' ? getGuardMult() : 1;
  const guardInfo = guardMult < 1 ? ` (защита −${GUARD_DAMAGE_CUT}%)` : '';
  // v0.27: стойка щита — −8% ко всему входящему урону
  const stanceMult = getShieldStanceMult();
  // ---- Мана-щит (Шёлковая мантия +10): v0.34.1 — режет и основной удар, и крит, и стихию
  //      (manaShieldAbsorb в battle-effects.js сразу списывает MP). rawHit — удар до щита: от него считается крит.
  let msAbsorbed = 0;
  let rawHit = 0;

  if (hitIsMagic) {
    dmg = Math.max(1, raw - Math.floor(p.mDef * 0.5 * armorLeft));
    if (stanceMult < 1) dmg = Math.max(1, Math.floor(dmg * stanceMult));
    if (guardMult < 1) dmg = Math.max(1, Math.floor(dmg * guardMult));
    rawHit = dmg;
    { const sh = manaShieldAbsorb(dmg); dmg = sh.hp; msAbsorbed += sh.mp; }
    p.hp -= dmg;
    spawnFloatDamage('fighter-player', dmg, 'magic');
    logCombat(`✦ ${m.name} бьёт магией на ${dmg} урона.${guardInfo}`, 'log-entry magic');
  } else {
    const flatReduce = Math.ceil(p.flatDamageReduce || 0);
    dmg = Math.max(1, raw - Math.floor(p.pDef * 0.3 * armorLeft) - flatReduce);
    if (mixtureDefMult < 1.0) dmg = Math.max(1, Math.floor(dmg * mixtureDefMult));
    if (stanceMult < 1) dmg = Math.max(1, Math.floor(dmg * stanceMult));
    if (guardMult < 1) dmg = Math.max(1, Math.floor(dmg * guardMult));
    rawHit = dmg;
    { const sh = manaShieldAbsorb(dmg); dmg = sh.hp; msAbsorbed += sh.mp; }
    p.hp -= dmg;
    spawnFloatDamage('fighter-player', dmg, 'dmg');
    const reduceInfo = (flatReduce > 0 ? ` (щит/шкура -${flatReduce})` : '') + (stanceMult < 1 ? ` (стойка −${SHIELD_STANCE_DAMAGE_CUT}%)` : '');
    const mixtureInfo = mixtureDefMult < 1.0 ? ` (крепость −30%)` : '';
    logCombat(`🩸 ${m.name} наносит ${dmg} урона.${reduceInfo}${mixtureInfo}${guardInfo}`, 'log-entry monster');

    const mixtureData = getActiveMixtureData();
    if (mixtureData && mixtureData.chargeType === 'enemyAttacks') tickMixtureCharge();
  }

  // ========================================================
  //  ФИШКИ МОНСТРА
  // ========================================================
  const traits = m.traits;
  const chanceMult = m.traitChanceMult || 1.0;
  let hitDamageForBleed = dmg;
  monsterKitOnHit(m, skill, dmg, chanceMult);   // v0.36: зарубка, вторые цели
  monsterTagOnHit(m);                           // v0.36: Вор

  // ---- 1. КРИТ (Бандит) ----
  if (traits && traits.critChance) {
    const critChance = traits.critChance * chanceMult;
    if (Math.random() * 100 < critChance) {
      const critMult = traits.critMult || 2.0;
      const sh = manaShieldAbsorb(Math.floor(rawHit * (critMult - 1)));   // v0.34.1: крит — от удара до щита, щит режет и его
      const bonus = sh.hp; msAbsorbed += sh.mp;
      p.hp -= bonus; hitDamageForBleed += bonus;
      spawnFloatDamage('fighter-player', bonus, 'crit');
      logCombat(`⚔ КРИТ! ${m.name} наносит дополнительно ${bonus} урона!`, 'log-entry monster');
    }
  }

  // ---- 2. СТИХИЯ (Жаба) ----
  if (traits && traits.elementChance && !m.mpDry) {
    const elementChance = traits.elementChance * chanceMult;
    if (Math.random() * 100 < elementChance) {
      const elements = ['fire', 'ice', 'lightning'];
      const elemId = elements[Math.floor(Math.random() * elements.length)];
      const bonusPercent = traits.elementBonusPercent || 30;
      const sh = manaShieldAbsorb(Math.max(1, Math.floor(m.atk * (bonusPercent / 100) * guardMult * stanceMult)));   // v0.34.1: щит режет и стихию
      const elemDmg = sh.hp; msAbsorbed += sh.mp;
      p.hp -= elemDmg; hitDamageForBleed += elemDmg;
      const icon = elemId === 'fire' ? '🔥' : elemId === 'ice' ? '❄' : '⚡';
      const elemName = (typeof ELEMENTS !== 'undefined' && ELEMENTS[elemId]) ? ELEMENTS[elemId].name : elemId;
      const dmgType = elemId === 'fire' ? 'fire' : (elemId === 'ice' ? 'magic' : 'magic');
      spawnFloatDamage('fighter-player', elemDmg, dmgType);
      logCombat(`${icon} ${m.name}: стихия «${elemName}» — +${elemDmg} урона!`, 'log-entry monster');
    }
  }

  // ---- 3. КРОВОТЕЧЕНИЕ (Волк) ----
  if (traits && traits.bleedChance) {
    const bleedChance = traits.bleedChance * chanceMult;
    if (Math.random() * 100 < bleedChance) {
      const divisor = traits.bleedDamageDivisor || 6;
      const bleedDmg = Math.max(1, Math.floor(hitDamageForBleed / divisor));
      const turns = traits.bleedTurns || 3;
      const existing = getDebuff('player', 'bleed');
      if (existing) {
        existing.damage = Math.max(existing.damage || 0, bleedDmg);
        existing.turnsLeft = turns;
      } else {
        addDebuff('player', 'bleed', { damage: bleedDmg, turnsLeft: turns });
      }
      logCombat(`🩸 ${m.name} ранил вас — кровотечение! ${bleedDmg}/ход, ${turns} хода.`, 'log-entry loss');
    }
  }

  // ---- 4. ОГЛУШЕНИЕ (Энт) ----
  if (traits && traits.stunChance) {
    const stunChance = traits.stunChance * chanceMult;
    if (Math.random() * 100 < stunChance) {
      const turns = traits.stunTurns || 1;
      const existing = getDebuff('player', 'stun');
      if (existing) { existing.turnsLeft = Math.max(existing.turnsLeft || 0, turns); }
      else { addDebuff('player', 'stun', { turnsLeft: turns }); }
      logCombat(`💫 ${m.name} оглушил вас — пропустите удар!`, 'log-entry player-skill');
    }
  }

  // ---- 5. ПАУТИНА (Шелкопряд) ----
  if (traits && traits.webChance) {
    const webChance = traits.webChance * chanceMult;
    if (Math.random() * 100 < webChance) {
      const turns = traits.webTurns || 2;
      const atbMult = traits.webAtbMult || 0.5;
      const existing = getDebuff('player', 'web');
      if (existing) { existing.turnsLeft = turns; existing.atbMult = atbMult; }
      else { addDebuff('player', 'web', { turnsLeft: turns, atbMult: atbMult }); }
      const pct = Math.round((1 - atbMult) * 100);
      logCombat(`🕸 ${m.name} оплёл вас паутиной! −${pct}% ATB на ${turns} хода.`, 'log-entry monster');
    }
  }

  // ---- Яд (Арахнид) ----
  // Мана-щит: MP уже списана в manaShieldAbsorb — здесь только строка в журнал (v0.34.1)
  if (msAbsorbed > 0) logCombat(`🔷 Мана-щит: ${msAbsorbed} урона ушло в MP.`, 'log-entry magic');

  if (m.poison && p.hp > 0) {
    tryApplyPoison(m);
  }

  // ========================================================
  //  НОВОЕ (v0.16): НАСЛЕДИЕ ГРОЗЫ (Ответный урон Дроу)
  // ========================================================
  if (p.hp > 0 && p.raceId === 'drow') {
    const stormLvl = p.learnedSkills['stormLegacy'] || 0;
    if (stormLvl > 0 && SKILLS['stormLegacy']) {
      const stormData = SKILLS['stormLegacy'].levels[stormLvl - 1];
      if (stormData && stormData.frequency) {
        // Считаем, какой это удар по счёту
        if (!state.battle.drowHitCounter) state.battle.drowHitCounter = 0;
        state.battle.drowHitCounter++;
        
        if (state.battle.drowHitCounter >= stormData.frequency) {
          state.battle.drowHitCounter = 0; // Сбрасываем счётчик
          
          // Урон = 5 + уровень Молнии
          const lightningLvl = getElementLevel('lightning');
          const stormDmg = monsterTagDmg(m, 5 + lightningLvl, ['magic', 'lightning']);   // v0.36: теги твари
          
          m.hp -= stormDmg;
          spawnFloatDamage('fighter-monster', stormDmg, 'magic');
          logCombat(`⚡ Наследие Грозы! Ответный удар Молнией на ${stormDmg} урона!`, 'log-entry player-magic');
          
          // Качаем Молнию за ответку
          addElementXP('lightning');

          // v0.19.1: у дроу-мага ответка Грозы лечит 3% макс. HP (маг был самым хрупким и долго отдыхал)
          if (isMage()) {
            const heal = Math.max(1, Math.floor(p.maxHp * 0.03));
            p.hp = Math.min(p.maxHp, p.hp + heal);
            spawnFloatDamage('fighter-player', heal, 'heal');
          }
          // v0.19.1: у дроу-мага ответка Грозы заряжает следующий Разряд (гарантированный паралич)
          if (isMage() && p.learnedSkills.discharge && !getDebuff('player', 'stormCharge')) {
            addDebuff('player', 'stormCharge', { turnsLeft: 1 });
            logCombat(`⚡ Заряд молнии: следующий Разряд парализует цель.`, 'log-entry player-skill');
          }
          
          if (m.hp <= 0) {
            m.hp = 0;
            logCombat(`⚡ ${m.name} испепелён молнией!`, 'log-entry kill');
            onMonsterDeath(m);
            return;
          }
        }
      }
    }
  }

  // ---- Смерть игрока ----
  const heroDied = p.hp <= 0;
  if (heroDied) { p.hp = 0; onPlayerDeath(); }
  updateTopStatus();
  if (!heroDied) checkHealPotion();   // v0.36.3: в ход гибели зелье не тратим впустую
}