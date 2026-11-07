// ========================================================
//  СИСТЕМЫ: БОЙ — СКИЛЛЫ И ФИШКИ ОРУЖИЯ
//  Всё, что связано с выбором активного скилла и с
//  особыми свойствами оружия (кровотечение, зарубка,
//  оглушение, стихийный урон и т.д.).
//
//  ВЫДЕЛЕНО ИЗ battle-strikes.js (разбивка больших файлов).
//
//  ВАЖНО: tryBonusProficiencyXP() теперь живёт ТОЛЬКО здесь.
//
//  НОВОЕ (v0.11, групповые бои):
//  + onMonsterDeath(m) — передаём конкретного убитого моба.
//  + Все дебаффы (bleed, wound, stun, confused) накладываются
//    на КОНКРЕТНОГО моба по его индексу.
//
//  НОВОЕ (v0.16):
//  + Лечебные скиллы (isHeal) не используются, если HP > 50%.
// ========================================================

// ---- v0.17: процент отдачи навыка (Ярость / Гнев) на его текущем уровне ----
function getSkillRecoilPercent(skill) {
  if (!skill) return 0;
  const data = getSkillData(skill.id);
  if (data && data.recoilPercent) return data.recoilPercent;
  return skill.recoilPercent || 0;
}

// ---- v0.17: применить отдачу. Возвращает true, если герой погиб. ----
// killed — убил ли этот удар врага (тогда при refundOnKill отдачи нет).
function applySkillRecoil(skill, killed) {
  const p = state.player;
  const pct = getSkillRecoilPercent(skill);
  if (pct <= 0) return false;
  const label = skill.id === 'spiritWrath' ? 'Гнева' : 'Ярости';
  if (killed && skill.refundOnKill) {
    logCombat(skill.id === 'spiritWrath' ? `🩸 Гнев утолён — отдачи нет.` : `🩸 Ярость насытилась кровью — отдачи нет.`, 'log-entry player-skill');
    return false;
  }
  const recoil = Math.floor(p.maxHp * pct / 100);
  if (recoil <= 0) return false;
  p.hp -= recoil;
  spawnFloatDamage('fighter-player', recoil, 'dmg');
  logCombat(`💢 Отдача от ${label}: ${recoil} HP.`, 'log-entry loss');
  if (p.hp <= 0) {
    p.hp = 0;
    logCombat(`☠ ${p.name} не выдержал ${skill.id === 'spiritWrath' ? 'собственного гнева' : 'собственной ярости'}...`, 'log-entry loss');
    return true;
  }
  return false;
}

function tryUseActiveSkill() {
  // v0.20: в ручном режиме навык выбирает игрок (null — «просто атака»)
  if (typeof manualPickedSkill === 'function') {
    const picked = manualPickedSkill();
    if (picked !== undefined) return picked;
  }
  const p = state.player;
  const slots = p.skillSlots || [];

  for (const skillId of slots) {
    if (!skillId) continue;

    const skill = SKILLS[skillId];
    if (!skill || skill.type !== 'active') continue;
    if (!p.learnedSkills[skillId]) continue;

    const enabled = state.battle.skillToggles[skillId] !== false;
    const cd = state.battle.skillCooldowns[skillId] || 0;
    if (!enabled || cd > 0) continue;

    const data = getSkillData(skillId);
    if (!data) continue;
    // v0.19.1: Стихийный резонанс — Шар / Ледяная стрела без маны
    const freeCast = (skillId === 'fireball' || skillId === 'iceArrow') && getDebuff('player', 'resonance');
    if (p.mp < data.mpCost && !freeCast) continue;

    // ---- v0.19: массовые — только если врагов хватает (и руна ещё не висит) ----
    if (skill.aoe && typeof canUseAoeNow === 'function' && !canUseAoeNow(skill)) continue;

    // ---- НОВОЕ (v0.17): скиллы с отдачей (Ярость, Гнев) — только при HP >= minHpPercent ----
    if (skill.minHpPercent && p.maxHp > 0 && (p.hp / p.maxHp) * 100 < skill.minHpPercent) continue;

    // ---- НОВОЕ (v0.16): Лечебные скиллы юзаются только при HP <= 50% ----
    if (skill.isHeal) {
      const hpPercent = (p.hp / p.maxHp) * 100;
      if (hpPercent > 50) continue; // Пропускаем, если здоровья больше 50%
    }

    return skill;
  }
  return null;
}

// v0.25: плоская прибавка от ступеней Т3-брони — к каждому удару навыка (и массового),
// к тикам горения, кровотечения и Гниения. Добавляется после всех множителей и крита.
function withSkillFlat(dmg) {
  return dmg + (state.player.skillFlatDamage || 0);
}

function tryBonusProficiencyXP() {
  const p = state.player;

  let chance = 0;
  if (hasRelaxBuff()) chance += TAVERN_PROF_BONUS_PERCENT;
  chance += (p.profBonusFromRefine || 0);
  chance += (p.profBonusFromSkill || 0);   // v0.35: «Опыт» человека

  if (chance <= 0) return false;
  return Math.random() * 100 < chance;
}

// --------------------------------------------------------
//  ФИШКИ ОРУЖИЯ
// --------------------------------------------------------

function getWoundDamageMult() {
  const cur = getCurrentMonster();
  if (!cur) return 1.0;
  const wound = getDebuff('monster', 'wound', cur.index);
  if (!wound) return 1.0;
  const stacks = wound.stacks || 0;
  return 1 + stacks * 0.05;
}

function getCritMultiplier(weaponCategory) {
  return weaponCategory === 'daggers' ? 2.2 : 1.8;
}

function getCritChance(weaponCategory) {
  const base = state.player.critChance || 10;
  if (weaponCategory === 'daggers') {
    const bonus = getEquippedWeaponTraits().critBonus || 0;
    return base + bonus;
  }
  return base;
}

// v0.19: арбалет ВСЕГДА игнорирует часть защиты: 25% + 1% за каждые 5 ур. владения (макс 50%).
// pierced = false, чтобы не писать «Пробитие!» в лог на каждый выстрел.
function checkCrossbowPierce(weaponCategory, monsterPDef) {
  if (weaponCategory !== 'crossbows' || isMage()) {
    return { pierced: false, effectivePDef: monsterPDef };
  }
  const pct = getTraitChance(getEquippedWeaponTraits().armorIgnore || 0, 'crossbows');
  return { pierced: false, effectivePDef: Math.floor(monsterPDef * (1 - pct / 100)), ignorePercent: pct };
}

// v0.27: chanceMult — множитель шанса (вторая рука парного оружия — 0.5).
function tryApplyWeaponTrait(category, weapon, chanceMult = 1) {
  if (!category || !weapon) return;

  const traits = getWeaponTraits(weapon.name);
  const m = getCurrentMonster();
  if (!m || m.hp <= 0) return;

  const idx = m.index;   // ← индекс текущего моба

  // ---- МЕЧИ: кровотечение ----
  if (traits.bleedChance) {
    const chance = getTraitChance(traits.bleedChance, category) * chanceMult;
    if (Math.random() * 100 < chance) {
      const existing = getDebuff('monster', 'bleed', idx);
      const newTurns = 3;
      const dmg = 3;
      if (existing) {
        existing.turnsLeft = newTurns;
        existing.damage = dmg;
        renderDebuffBar('monster');
      } else {
        addDebuff('monster', 'bleed', idx, { turnsLeft: newTurns, damage: dmg });
      }
      logCombat(`🩸 ${m.name} кровоточит! ${dmg} урона × ${newTurns} хода.`, 'log-entry loss');
    }
  }

  // ---- ТОПОРЫ: зарубка ----
  if (traits.woundChance) {
    const chance = getTraitChance(traits.woundChance, category) * chanceMult;
    if (Math.random() * 100 < chance) {
      const existing = getDebuff('monster', 'wound', idx);
      if (existing) {
        const newStacks = Math.min(5, (existing.stacks || 1) + 1);
        existing.stacks = newStacks;
        existing.turnsLeft = 4;
        renderDebuffBar('monster');
        logCombat(`🪓 Зарубка усилена! ×${newStacks} (+${newStacks * 5}% урона)`, 'log-entry player-skill');
      } else {
        addDebuff('monster', 'wound', idx, { turnsLeft: 4, stacks: 1 });
        logCombat(`🪓 Зарубка! ×1 (+5% урона, 4 хода)`, 'log-entry player-skill');
      }
    }
  }

  // ---- ДУБИНЫ: оглушение ----
  if (traits.stunChance) {
    const chance = getTraitChance(traits.stunChance, category) * chanceMult;
    if (Math.random() * 100 < chance) {
      const existing = getDebuff('monster', 'stun', idx);
      if (existing) {
        existing.turnsLeft = 1;
        renderDebuffBar('monster');
      } else {
        addDebuff('monster', 'stun', idx, { turnsLeft: 1 });
      }
      logCombat(`💫 ${m.name} ОГЛУШЁН! Пропустит следующий удар.`, 'log-entry player-skill');
    }
  }

  // ---- ЛУКИ: точный выстрел ----
  if (traits.preciseChance) {
    const chance = getTraitChance(traits.preciseChance, category) * chanceMult;
    if (Math.random() * 100 < chance) {
      const existing = getDebuff('monster', 'confused', idx);
      if (existing) {
        existing.turnsLeft = 2;
        existing.evasionReduction = 30;
        renderDebuffBar('monster');
      } else {
        addDebuff('monster', 'confused', idx, { turnsLeft: 2, evasionReduction: 30 });
      }
      logCombat(`🎯 Точный выстрел! Уворот ${m.name} −30% на 2 хода.`, 'log-entry player-skill');
    }
  }

  // ---- КОПЬЯ: стихийный урон ----
  if (traits.elementChance) {
    const chance = getTraitChance(traits.elementChance, category) * chanceMult;
    if (Math.random() * 100 < chance) {
      const elements = ['fire', 'ice', 'lightning'];
      const elemId = elements[Math.floor(Math.random() * elements.length)];

      const elemLevel = getElementLevel(elemId);
      const baseDmg = traits.elementBaseDamage || 3;
      const elementDamage = baseDmg + elemLevel;

      m.hp -= elementDamage;
      addElementXP(elemId);

      const elemName = ELEMENTS[elemId]?.name || elemId;
      const icon = elemId === 'fire' ? '🔥' : elemId === 'ice' ? '❄' : '⚡';
      logCombat(`${icon} Копьё: +${elementDamage} ${elemName.toLowerCase()}м (стихия ур.${elemLevel}).`, 'log-entry player-magic');

      if (m.hp <= 0) {
        m.hp = 0;
        logCombat(`${icon} ${m.name} погиб от стихии!`, 'log-entry kill');
        onMonsterDeath(m);
        return;
      }
    }
  }
}