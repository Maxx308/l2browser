// ========================================================
//  СИСТЕМЫ: БОЙ — АТАКА ИГРОКА
//  playerAttack(): скиллы, обычная атака, крит, пробитие,
//  стихии, отдача от оркских скиллов, лечение (v0.16).
//
//  НОВОЕ (v0.16):
//  + Добавлена поддержка лечебных скиллов (isHeal).
//  + Навык Дроу «Разряд» (discharge) — сбивает ATB, бьёт Молнией.
//  + Пассивка Дроу «Цепной разум» (chainMind) — шанс снизить КД.
// ========================================================

function getLifeXpMultiplier() {
  const p = state.player;
  let bonus = 0;
  const lvl = p.learnedSkills['forestBlessing'] || 0;
  if (lvl > 0 && SKILLS['forestBlessing']) {
    const data = SKILLS['forestBlessing'].levels[lvl - 1];
    if (data && data.lifeXpBonusPercent) bonus += data.lifeXpBonusPercent;
  }
  return 1 + (bonus / 100);
}

// v0.19.1: сила лечения (Исцеление эльфа-мага, Дыхание природы эльфа-воина).
// От маг. атаки × множитель навыка, усиливается магией Жизни и микстурой атаки.
function rollHealAmount(multiplier) {
  const p = state.player;
  const base = p.mAtk;
  const variance = Math.floor(base * 0.2);
  const raw = base + Math.floor(Math.random() * variance * 2) - variance;
  let heal = Math.floor(raw * multiplier);
  const lifeBonus = getElementDamageBonus('life');
  if (lifeBonus > 0) heal = Math.floor(heal * (1 + lifeBonus / 100));
  const mix = getMixtureAtkMult();
  if (mix > 1.0) heal = Math.floor(heal * mix);
  return Math.max(1, heal);
}

function playerAttack() {
  // ---- v0.19: Руна вьюги взрывается в начале хода (ход не тратит) ----
  if (typeof tickBlizzardRune === 'function') tickBlizzardRune();
  // ---- v0.19: лук целится в самого раненого ----
  if (typeof updateBowFocus === 'function') updateBowFocus();

  const p = state.player;
  const m = getCurrentMonster();
  if (!m || m.hp <= 0) return;

  const idx = m.index;

  const weapon = p.equipment.weapon;
  const weaponCategory = weapon ? getWeaponCategory(weapon.name) : null;
  const weaponBonusPercent = weaponCategory ? getWeaponDamageBonus(weaponCategory) : 0;

  const monsterPDef = m.pDef || 0;
  const monsterMDef = m.mDef || 0;

  const mixtureAtkMult = getMixtureAtkMult();
  const woundMult = getWoundDamageMult();

  const critChance = getCritChance(weaponCategory);
  const critMult = getCritMultiplier(weaponCategory);

  const playerAcc = getPlayerAccuracy();
  let monsterEva = getMonsterEvasion(m);
  const confused = getDebuff('monster', 'confused', idx);
  if (confused && confused.evasionReduction) {
    monsterEva = monsterEva * (1 - confused.evasionReduction / 100);
  }
  const playerHit = rollHit(playerAcc, monsterEva);

  const skill = tryUseActiveSkill();
  if (skill) {
    const data = getSkillData(skill.id);
    // v0.19.1: Стихийный резонанс (Стихийный залп человека) — один Шар / Ледяная стрела без маны
    if ((skill.id === 'fireball' || skill.id === 'iceArrow') && getDebuff('player', 'resonance')) {
      removeDebuff('player', 'resonance');
      logCombat(`✦ Стихийный резонанс: ${skill.name} без маны!`, 'log-entry player-skill');
    } else {
      p.mp -= data.mpCost;
    }
    state.battle.skillCooldowns[skill.id] = skill.cooldown;

    // ---- v0.19: МАССОВЫЕ НАВЫКИ — своя логика в battle-aoe.js ----
    if (skill.aoe && typeof performAoeSkill === 'function') {
      performAoeSkill(skill, data);
      return;
    }

    // ---- ОПЫТ ВЛАДЕНИЯ ЗА СКИЛЛЫ ----
    if (skill.id === 'powerStrike' || skill.id === 'doubleStrike' || skill.id === 'dwarfGreed') {
      if (weaponCategory) {
        addWeaponXP(weaponCategory);
        if (tryBonusProficiencyXP()) { addWeaponXP(weaponCategory); logCombat(`🍺 Бонусный опыт владения!`, 'log-entry levelup'); }
      }
    } else if (skill.id === 'orcRage') {
      if (weaponCategory) {
        addWeaponXP(weaponCategory);
        if (tryBonusProficiencyXP()) { addWeaponXP(weaponCategory); logCombat(`🍺 Бонусный опыт владения!`, 'log-entry levelup'); }
      }
      addElementXP('death');
      if (tryBonusProficiencyXP()) { addElementXP('death'); logCombat(`🍺 Бонусный опыт стихии!`, 'log-entry levelup'); }
    } else if (skill.id === 'fireball' || skill.id === 'iceArrow' || skill.id === 'dwarfGreedMagic') {
      const elemId = (skill.id === 'iceArrow') ? 'ice' : 'fire';
      addElementXP(elemId);
      if (tryBonusProficiencyXP()) { addElementXP(elemId); logCombat(`🍺 Бонусный опыт стихии!`, 'log-entry levelup'); }
    } else if (skill.id === 'spiritWrath') {
      addElementXP('death');
      if (tryBonusProficiencyXP()) { addElementXP('death'); logCombat(`🍺 Бонусный опыт стихии!`, 'log-entry levelup'); }
    } else if (skill.id === 'discharge') {
      // Дроу: Разряд качает Молнию
      addElementXP('lightning');
      if (tryBonusProficiencyXP()) { addElementXP('lightning'); logCombat(`🍺 Бонусный опыт стихии!`, 'log-entry levelup'); }
    }

    // ---- ВОИНСКИЕ СКИЛЛЫ ----
    if (skill.id === 'powerStrike' || skill.id === 'orcRage' || skill.id === 'doubleStrike' || skill.id === 'dwarfGreed') {
      const hits = skill.hits || 1;
      if (!playerHit) {
        spawnFloatDamage('fighter-monster', 0, 'miss');
        logCombat(`⚔ ${skill.name} — промах.`, 'log-entry');
        const mixtureData = getActiveMixtureData();
        if (mixtureData && mixtureData.chargeType === 'playerAttacks') tickMixtureCharge(hits);   // v0.31: заряд на каждый замах
        if (skill.id === 'orcRage') {
          if (applySkillRecoil(skill, false)) { updateTopStatus(); updateBattleUI(); onPlayerDeath(); return; }
        }
        updateBattleUI(); checkHealPotion(); return;
      }
      const basePAtk = p.pAtk;
      const pierce = checkCrossbowPierce(weaponCategory, monsterPDef);
      // v0.31: одна строка на навык — «Двойной удар: 140 + 133 = 273», остальное припиской
      const notes = [];
      if (pierce.pierced) notes.push('🎯 пробитие');
      let deathBonus = 0;
      if (skill.id === 'orcRage') deathBonus = getElementDamageBonus('death');
      const gripBonus = getTwoHandGripBonus();   // v0.27: двуручный хват
      let totalDamage = 0;
      const parts = [];
      for (let h = 0; h < hits; h++) {
        const variance = Math.floor(basePAtk * 0.2);
        let raw = basePAtk + Math.floor(Math.random() * variance * 2) - variance;
        let baseDmg = Math.max(1, raw - pierce.effectivePDef);
        let dmg = Math.floor(baseDmg * data.multiplier);
        if (weaponBonusPercent > 0) dmg = Math.floor(dmg * (1 + weaponBonusPercent / 100));
        if (woundMult > 1.0) dmg = Math.floor(dmg * woundMult);
        if (deathBonus > 0) dmg = Math.floor(dmg * (1 + deathBonus / 100));
        if (gripBonus > 0) dmg = Math.floor(dmg * (1 + gripBonus / 100));
        if (mixtureAtkMult > 1.0) dmg = Math.floor(dmg * mixtureAtkMult);
        const isCrit = Math.random() * 100 < critChance;
        if (isCrit) dmg = Math.floor(dmg * critMult);
        dmg = withSkillFlat(Math.max(1, dmg));
        m.hp -= dmg; totalDamage += dmg;
        spawnFloatDamage('fighter-monster', dmg, isCrit ? 'crit' : 'dmg');
        parts.push(dmg + (isCrit ? ' (крит!)' : ''));
        if (m.hp <= 0) break;
      }
      const dmgText = parts.length > 1 ? `${parts.join(' + ')} = ${totalDamage}` : parts[0];
      const mixtureData = getActiveMixtureData();
      if (mixtureData && mixtureData.chargeType === 'playerAttacks') tickMixtureCharge(parts.length);   // v0.31: заряд на каждый удар
      if (skill.id === 'orcRage') {
        // v0.19.1: убийство Яростью сокращает КД Кровавой жатвы
        const cut = data.harvestCdCut || 0;
        if (m.hp <= 0 && cut > 0 && p.learnedSkills.bloodHarvest && (state.battle.skillCooldowns.bloodHarvest || 0) > 0) {
          state.battle.skillCooldowns.bloodHarvest = Math.max(0, state.battle.skillCooldowns.bloodHarvest - cut);
          notes.push(`🩸 КД Кровавой жатвы −${cut}`);
        }
        logCombat(`🌑 Ярость: ${dmgText}`, 'log-entry player-skill', notes.join(' · '));
        if (applySkillRecoil(skill, m.hp <= 0)) { updateTopStatus(); updateBattleUI(); if (m.hp <= 0) onMonsterDeath(m); onPlayerDeath(); return; }
      } else if (skill.id === 'doubleStrike') {
        if (m.hp <= 0 && typeof humanCycleOnKill === 'function') notes.push(humanCycleOnKill('doubleStrike'));
        logCombat(`⚔ Двойной удар: ${dmgText}`, 'log-entry player-skill', notes.filter(Boolean).join(' · '));
      } else if (skill.id === 'dwarfGreed') {
        if (skill.greedMarkType) {
          // v0.19.1: метки складываются (до 5)
          const n = addGreedMark(m, m.hp > 0 ? (data.markTurns || skill.greedMarkTurns || 3) : 1, skill.greedMarkType);
          notes.push(`💰 метка${n > 1 ? ` ×${n}` : ''}`);
        }
        logCombat(`💰 Жадность: ${dmgText}`, 'log-entry player-skill', notes.join(' · '));
      } else {
        if (m.hp <= 0 && typeof humanCycleOnKill === 'function') notes.push(humanCycleOnKill('powerStrike'));
        logCombat(`⚔ Сильный удар: ${dmgText}`, 'log-entry player-skill', notes.filter(Boolean).join(' · '));
      }
      if (m.hp > 0) tryApplyWeaponTrait(weaponCategory, weapon);
    }
    // ---- НОВОЕ (v0.16): ЛЕЧЕБНЫЕ СКИЛЛЫ ----
    else if (skill.isHeal) {
      // v0.19.1: магия Жизни усиливает лечение (rollHealAmount)
      let heal = Math.min(rollHealAmount(data.multiplier), p.maxHp - p.hp);
      if (heal <= 0) {
        logCombat(`🌿 ${skill.name}: HP уже полное.`, 'log-entry');
      } else {
        p.hp += heal; spawnFloatDamage('fighter-player', heal, 'heal');
        logCombat(`🌿 ${skill.name}: +${heal} HP`, 'log-entry potion');
      }
      const lifeBonus = getLifeXpMultiplier();
      const lifeXp = Math.floor(1 * lifeBonus);
      for (let i = 0; i < lifeXp; i++) addElementXP('life');
      const mixtureData = getActiveMixtureData();
      if (mixtureData && mixtureData.chargeType === 'playerAttacks') tickMixtureCharge();
      updateTopStatus(); updateBattleUI(); checkHealPotion(); return;
    }
    // ---- НОВОЕ (v0.16): ДРОУ — РАЗРЯД (discharge) ----
    else if (skill.id === 'discharge') {
      if (!playerHit) {
        spawnFloatDamage('fighter-monster', 0, 'miss');
        logCombat(`⚡ ${skill.name} — промах.`, 'log-entry');
        const mixtureData = getActiveMixtureData();
        if (mixtureData && mixtureData.chargeType === 'playerAttacks') tickMixtureCharge();
        updateBattleUI(); checkHealPotion(); return;
      }
      
      let baseAtk = isMage() ? p.mAtk : p.pAtk;
      let defTarget = isMage() ? monsterMDef : monsterPDef;
      
      const variance = Math.floor(baseAtk * 0.2);
      let raw = baseAtk + Math.floor(Math.random() * variance * 2) - variance;
      let baseDmg = Math.max(1, raw - defTarget);
      let dmg = Math.floor(baseDmg * data.multiplier);
      
      const elemBonus = getElementDamageBonus('lightning');
      if (elemBonus > 0) dmg = Math.floor(dmg * (1 + elemBonus / 100));
      const gripB = getTwoHandGripBonus();   // v0.27: двуручный хват (у мага 0)
      if (gripB > 0) dmg = Math.floor(dmg * (1 + gripB / 100));
      if (mixtureAtkMult > 1.0) dmg = Math.floor(dmg * mixtureAtkMult);
      dmg = withSkillFlat(Math.max(1, dmg));
      m.hp -= dmg;

      const mixtureData = getActiveMixtureData();
      if (mixtureData && mixtureData.chargeType === 'playerAttacks') tickMixtureCharge();
      
      // Сбиваем ATB монстра
      let atbReduction = data.atbReduction / 100;
      // v0.19.1: сбили шкалу стаи до нуля ИЛИ Разряд заряжен уворотом (Скорость молнии)
      const charged = !!getDebuff('player', 'stormCharge');
      if (charged) removeDebuff('player', 'stormCharge');
      const zeroed = charged || state.battle.monstersATB <= atbReduction;
      cutMonstersATB(atbReduction);   // v0.23: сбивает шкалу каждому мобу стаи
      if (zeroed && typeof onDischargeZeroed === 'function') onDischargeZeroed(m);
      
      spawnFloatDamage('fighter-monster', dmg, 'magic');
      const notes = [`ATB −${data.atbReduction}%`];

      // ---- Цепной разум (шанс снизить КД) ----
      const chainLvl = p.learnedSkills['chainMind'] || 0;
      if (chainLvl > 0 && SKILLS['chainMind']) {
        const chainData = SKILLS['chainMind'].levels[chainLvl - 1];
        if (chainData && chainData.chance) {
          if (Math.random() * 100 < chainData.chance) {
            state.battle.skillCooldowns[skill.id] = Math.max(0, (state.battle.skillCooldowns[skill.id] || 0) - 1);
            notes.push('🧠 Цепной разум: КД −1');
          }
        }
      }
      logCombat(`⚡ Разряд: ${dmg}`, 'log-entry player-magic', notes.join(' · '));
    }
    // ---- МАГИЧЕСКИЕ СКИЛЛЫ ----
    else if (skill.id === 'fireball' || skill.id === 'spiritWrath' || skill.id === 'iceArrow' || skill.id === 'dwarfGreedMagic') {
      if (!playerHit) {
        spawnFloatDamage('fighter-monster', 0, 'miss');
        logCombat(`✦ ${skill.name} — промах.`, 'log-entry');
        const mixtureData = getActiveMixtureData();
        if (mixtureData && mixtureData.chargeType === 'playerAttacks') tickMixtureCharge();
        if (skill.id === 'spiritWrath') {
          if (applySkillRecoil(skill, false)) { updateTopStatus(); updateBattleUI(); onPlayerDeath(); return; }
        }
        updateBattleUI(); checkHealPotion(); return;
      }
      const base = p.mAtk;
      const variance = Math.floor(base * 0.2);
      let raw = base + Math.floor(Math.random() * variance * 2) - variance;
      let baseDmg = Math.max(1, raw - monsterMDef);
      let dmg = Math.floor(baseDmg * data.multiplier);
      let elemId = 'fire';
      if (skill.id === 'iceArrow') elemId = 'ice';
      else if (skill.id === 'spiritWrath') elemId = 'death';
      const elemBonus = getElementDamageBonus(elemId);
      if (elemBonus > 0) dmg = Math.floor(dmg * (1 + elemBonus / 100));
      if (mixtureAtkMult > 1.0) dmg = Math.floor(dmg * mixtureAtkMult);
      dmg = withSkillFlat(Math.max(1, dmg));
      m.hp -= dmg;
      const mixtureData = getActiveMixtureData();
      if (mixtureData && mixtureData.chargeType === 'playerAttacks') tickMixtureCharge();
      // v0.31: одна строка на навык, эффекты (заморозка, поджог, метка) — припиской
      if (skill.id === 'spiritWrath') {
        // v0.19.1: комбо с Мором — каждый Гнев усиливает Гниение до конца боя
        if (typeof addRotWrathStack === 'function') addRotWrathStack();
        spawnFloatDamage('fighter-monster', dmg, 'magic');
        logCombat(`🌑 Гнев: ${dmg}`, 'log-entry player-skill');
        if (applySkillRecoil(skill, m.hp <= 0)) { updateTopStatus(); updateBattleUI(); if (m.hp <= 0) onMonsterDeath(m); onPlayerDeath(); return; }
      } else if (skill.id === 'iceArrow') {
        spawnFloatDamage('fighter-monster', dmg, 'magic');
        let note = '';
        if (Math.random() * 100 < skill.freezeChance) {
          addDebuff('monster', 'freeze', idx, { turnsLeft: 1 });
          note = '❄ заморожен — пропустит удар';
        }
        logCombat(`❄ Ледяная стрела: ${dmg}`, 'log-entry player-magic', note);
      } else if (skill.id === 'dwarfGreedMagic') {
        spawnFloatDamage('fighter-monster', dmg, 'magic');
        let note = '';
        if (skill.greedMarkType) {
          const n = addGreedMark(m, m.hp > 0 ? (data.markTurns || skill.greedMarkTurns || 3) : 1, skill.greedMarkType);   // v0.19.1: до 5 меток
          note = `💰 метка${n > 1 ? ` ×${n}` : ''}`;
        }
        logCombat(`💰 Жадность: ${dmg}`, 'log-entry player-skill', note);
      } else {
        spawnFloatDamage('fighter-monster', dmg, 'fire');
        const pureMAtk = Math.floor(5 + p.INT * 0.8);
        const burnDmg = Math.max(1, Math.floor(pureMAtk * (data.burnPercent / 100)));
        addDebuff('monster', 'burn', idx, { turnsLeft: skill.burnTurns, damage: burnDmg });
        logCombat(`🔥 Огненный шар: ${dmg}`, 'log-entry player-skill', `🔥 поджог ${burnDmg} × ${skill.burnTurns} хода`);
      }
    }

    updateBattleUI();
    if (m.hp <= 0) { m.hp = 0; onMonsterDeath(m); return; }
    checkHealPotion();
    return;
  }

  // ---- ОБЫЧНЫЙ УДАР БЕЗ СКИЛЛА ----
  if (weaponCategory) {
    addWeaponXP(weaponCategory);
    if (tryBonusProficiencyXP()) { addWeaponXP(weaponCategory); logCombat(`🍺 Бонусный опыт владения!`, 'log-entry levelup'); }
  }

  // v0.27: парное оружие — второй рукой бьёт вместе с первой (v0.31: микстура тратит 2 заряда, в логе «a + b»)
  const offhand = !isMage() ? getOffhandWeapon() : null;
  const swings = offhand ? 2 : 1;

  if (!playerHit) {
    spawnFloatDamage('fighter-monster', 0, 'miss');
    const icon = isMage() ? '✦' : '⚔';
    logCombat(`${icon} Промах.`, 'log-entry');
    const mixtureData = getActiveMixtureData();
    if (mixtureData && mixtureData.chargeType === 'playerAttacks') tickMixtureCharge(swings);
    updateBattleUI(); checkHealPotion(); return;
  }

  // v0.31: одна строка на удар, особенности — припиской
  const notes = [];
  let dmg, logCls, logIcon, dmgType;
  if (isMage()) {
    const hasMana = p.mp >= MP_COST_PER_ATTACK;
    const base = p.mAtk;
    const variance = Math.floor(base * 0.2);
    let raw = base + Math.floor(Math.random() * variance * 2) - variance;
    let baseDmg = Math.max(1, raw - monsterMDef);
    dmg = baseDmg;
    if (!hasMana) { dmg = Math.floor(dmg * 0.5); notes.push('мало маны — слабый удар'); }
    else { p.mp -= MP_COST_PER_ATTACK; }
    logCls = 'log-entry player-magic'; logIcon = '✦'; dmgType = 'magic';
  } else {
    const pierce = checkCrossbowPierce(weaponCategory, monsterPDef);
    if (pierce.pierced) notes.push('🎯 пробитие');
    const base = p.pAtk + (p.offhandPAtk || 0);   // v0.27: парное — +40% атаки второй руки (только обычный удар)
    const variance = Math.floor(base * 0.2);
    let raw = base + Math.floor(Math.random() * variance * 2) - variance;
    let baseDmg = Math.max(1, raw - pierce.effectivePDef);
    dmg = baseDmg;
    logCls = 'log-entry player'; logIcon = '⚔'; dmgType = 'dmg';
  }

  if (weaponBonusPercent > 0) dmg = Math.floor(dmg * (1 + weaponBonusPercent / 100));
  if (woundMult > 1.0) dmg = Math.floor(dmg * woundMult);
  if (mixtureAtkMult > 1.0) dmg = Math.floor(dmg * mixtureAtkMult);
  // ---- v0.19: кинжал — добивание раненого ----
  const execMult = (!isMage() && typeof getExecuteMult === 'function') ? getExecuteMult(m, weaponCategory) : 1;
  if (execMult > 1) dmg = Math.floor(dmg * execMult);
  const isCrit = Math.random() * 100 < critChance;
  if (isCrit) dmg = Math.floor(dmg * critMult);
  dmg = Math.max(1, dmg);
  // ---- v0.19: топор / копьё — удар задевает второго ----
  const cleave = (!isMage() && typeof planWeaponCleave === 'function') ? planWeaponCleave(weaponCategory, m) : null;
  const fullDmg = dmg;
  if (cleave && cleave.mainMult < 1) dmg = Math.max(1, Math.floor(dmg * cleave.mainMult));
  m.hp -= dmg;
  spawnFloatDamage('fighter-monster', dmg, isCrit ? 'crit' : dmgType);
  // Парное: показываем вклад каждой руки (по доле атаки второй руки в общей)
  let dmgText = String(dmg);
  if (offhand && p.offhandPAtk > 0) {
    const off = Math.round(dmg * p.offhandPAtk / (p.pAtk + p.offhandPAtk));
    if (off >= 1) dmgText = `${dmg - off} + ${off} = ${dmg}`;   // слабая вторая рука (+0) — одним числом
  }
  if (isCrit) dmgText += ' (крит!)';
  if (execMult > 1) notes.push('добивание');
  logCombat(`${logIcon} Удар: ${dmgText}`, logCls, notes.join(' · '));
  if (cleave) applyWeaponCleave(m, cleave, fullDmg * cleave.secondMult);

  const mixtureData = getActiveMixtureData();
  if (mixtureData && mixtureData.chargeType === 'playerAttacks') tickMixtureCharge(swings);
  if (m.hp > 0) tryApplyWeaponTrait(weaponCategory, weapon);
  // v0.27: фишки второго оружия — с половинным шансом
  if (offhand && m.hp > 0) tryApplyWeaponTrait(getWeaponCategory(offhand.name), offhand, DUAL_WIELD_TRAIT_MULT);
  if (m.hp <= 0) { m.hp = 0; onMonsterDeath(m); }
  checkHealPotion();
  updateBattleUI();
}