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
      // Пропускаем, если здоровья больше 50% — кроме случая, когда лечением можно ударить мёртвого (v0.36)
      if (hpPercent > 50 && !healStrikeApplies(getCurrentMonster())) continue;
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

// v0.36.3: зарубка считается по той цели, которую бьём (раньше — всегда по текущей,
// и вторая цель топора получала чужую зарубку, а массовые навыки её не видели).
const WOUND_DAMAGE_PER_STACK = 8;   // v0.36.3: было 5 — по замеру зарубка давала ~1% урона
const WOUND_MAX_STACKS = 5;
const WOUND_TURNS = 5;              // было 4
const BLEED_TURNS = 3;
const PRECISE_TURNS = 2;
const PRECISE_EVASION_CUT = 30;

// Всплывающая надпись над тварью — чтобы фишку было видно, как крит.
function traitFloat(m, text) {
  spawnFloatDamage('fighter-monster', 0, 'block', { mon: m, text });
}

function getWoundDamageMult(m) {
  const target = m || getCurrentMonster();
  if (!target) return 1.0;
  const wound = getDebuff('monster', 'wound', target.index);
  if (!wound) return 1.0;
  return 1 + (wound.stacks || 0) * WOUND_DAMAGE_PER_STACK / 100;
}

// Прибавка зарубки к готовому урону по цели m. Идёт последней, с округлением
// вверх — иначе +5% от небольшого удара съедало округление вниз (25 → 25).
function applyWoundMult(m, dmg) {
  const mult = getWoundDamageMult(m);
  return mult > 1 ? Math.ceil(dmg * mult) : dmg;
}

function getCritMultiplier(weaponCategory) {
  return (weaponCategory === 'daggers' ? 2.2 : 1.8) + (state.player.critMultBonus || 0);   // v0.37: сила крита от сета
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
// v0.36.3: hitDmg — урон удара, который вызвал фишку: от него считаются кровотечение,
// стихия копья и точный выстрел (раньше — фиксированные 3 урона на любом уровне).
function tryApplyWeaponTrait(category, weapon, chanceMult = 1, hitDmg = 0) {
  if (!category || !weapon) return;

  const traits = getWeaponTraits(weapon.name);
  const m = getCurrentMonster();
  if (!m || m.hp <= 0) return;

  const idx = m.index;   // ← индекс текущего моба
  const fromHit = (pct, fallback) => hitDmg > 0 ? Math.max(1, Math.round(hitDmg * pct / 100)) : fallback;

  // ---- МЕЧИ: кровотечение — 3 тика по 25% удара ----
  if (traits.bleedChance && !monsterHasTagFlag(m, 'bleedImmune')) {   // v0.36: конструкты не кровоточат
    const chance = getTraitChance(traits.bleedChance, category) * chanceMult;
    if (Math.random() * 100 < chance) {
      const existing = getDebuff('monster', 'bleed', idx);
      const dmg = fromHit(traits.bleedHitPercent || 25, 3);
      if (existing) {
        existing.turnsLeft = BLEED_TURNS;
        existing.damage = Math.max(existing.damage || 0, dmg);   // слабый удар не обнуляет сильное кровотечение
        renderDebuffBar('monster');
      } else {
        addDebuff('monster', 'bleed', idx, { turnsLeft: BLEED_TURNS, damage: dmg });
      }
      const cur = getDebuff('monster', 'bleed', idx);
      traitFloat(m, 'КРОВЬ');
      logCombat(`🩸 ${m.name} кровоточит! ${cur.damage} урона × ${BLEED_TURNS} хода.`, 'log-entry loss');
    }
  }

  // ---- ТОПОРЫ: зарубка — +8% урона по этой твари за стак ----
  if (traits.woundChance) {
    const chance = getTraitChance(traits.woundChance, category) * chanceMult;
    if (Math.random() * 100 < chance) {
      const existing = getDebuff('monster', 'wound', idx);
      let n = 1;
      if (existing) {
        n = Math.min(WOUND_MAX_STACKS, (existing.stacks || 1) + 1);
        existing.stacks = n;
        existing.turnsLeft = WOUND_TURNS;
        renderDebuffBar('monster');
      } else {
        addDebuff('monster', 'wound', idx, { turnsLeft: WOUND_TURNS, stacks: 1 });
      }
      traitFloat(m, `ЗАРУБКА ×${n}`);
      logCombat(`🪓 Зарубка ×${n}: +${n * WOUND_DAMAGE_PER_STACK}% урона по ${m.name} (${WOUND_TURNS} ход.)`, 'log-entry player-skill');
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
      traitFloat(m, 'ОГЛУШЁН');
      logCombat(`💫 ${m.name} ОГЛУШЁН! Пропустит следующий удар.`, 'log-entry player-skill');
    }
  }

  // ---- ЛУКИ: точный выстрел — +60% урона этого выстрела и −30% уворота на 2 хода ----
  if (traits.preciseChance) {
    const chance = getTraitChance(traits.preciseChance, category) * chanceMult;
    if (Math.random() * 100 < chance) {
      const existing = getDebuff('monster', 'confused', idx);
      if (existing) {
        existing.turnsLeft = PRECISE_TURNS;
        existing.evasionReduction = PRECISE_EVASION_CUT;
        renderDebuffBar('monster');
      } else {
        addDebuff('monster', 'confused', idx, { turnsLeft: PRECISE_TURNS, evasionReduction: PRECISE_EVASION_CUT });
      }
      const bonus = hitDmg > 0 ? monsterTagDmg(m, fromHit(traits.preciseHitPercent || 60, 0), heroPhysKinds(category)) : 0;
      if (bonus > 0) {
        m.hp -= bonus;
        spawnFloatDamage('fighter-monster', bonus, 'dmg', { mon: m });
      }
      traitFloat(m, 'ТОЧНЫЙ');
      logCombat(`🎯 Точный выстрел!${bonus > 0 ? ` +${bonus} урона,` : ''} уворот ${m.name} −${PRECISE_EVASION_CUT}% на ${PRECISE_TURNS} хода.`, 'log-entry player-skill');
      if (m.hp <= 0) {
        m.hp = 0;
        onMonsterDeath(m);
        return;
      }
    }
  }

  // ---- КОПЬЯ: стихийный урон — 50% удара + уровень стихии ----
  if (traits.elementChance) {
    const chance = getTraitChance(traits.elementChance, category) * chanceMult;
    if (Math.random() * 100 < chance) {
      const elements = ['fire', 'ice', 'lightning'];
      const elemId = elements[Math.floor(Math.random() * elements.length)];

      const elemLevel = getElementLevel(elemId);
      const baseDmg = fromHit(traits.elementHitPercent || 50, traits.elementBaseDamage || 3);
      const elementDamage = monsterTagDmg(m, baseDmg + elemLevel, ['magic', elemId]);   // v0.36: теги твари

      m.hp -= elementDamage;
      spawnFloatDamage('fighter-monster', elementDamage, 'magic', { mon: m });
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