// ========================================================
//  СИСТЕМЫ: ПРОКАЧКА ВЛАДЕНИЯ
//  Оружие и стихии качаются за использование.
//  Каждый удар/каст → +1 XP.
//  Уровень даёт бонус к урону (используется в бою).
// ========================================================

// ---------- ОРУЖИЕ ----------

function getWeaponSkill(category) {
  return state.player.weaponSkills[category] || null;
}

function getWeaponSkillLevel(category) {
  const ws = state.player.weaponSkills[category];
  if (!ws) return 0;
  let lvl = 0;
  for (let i = 0; i < WEAPON_XP_THRESHOLDS.length; i++) {
    if (ws.xp >= WEAPON_XP_THRESHOLDS[i]) lvl = i + 1;
    else break;
  }
  return lvl;
}

function getWeaponDamageBonus(category) {
  const lvl = getWeaponSkillLevel(category);
  if (lvl === 0) return 0;
  return WEAPON_DMG_BONUS[lvl - 1];
}

function getWeaponNextThreshold(category) {
  const lvl = getWeaponSkillLevel(category);
  if (lvl >= WEAPON_MAX_LEVEL) return null;
  return WEAPON_XP_THRESHOLDS[lvl];
}

function addWeaponXP(category) {
  if (!category || !WEAPON_SKILLS[category]) return;
  const p = state.player;
  if (!p.weaponSkills[category]) p.weaponSkills[category] = { xp: 0 };

  const oldLvl = getWeaponSkillLevel(category);
  p.weaponSkills[category].xp += 1;
  const newLvl = getWeaponSkillLevel(category);

  if (newLvl > oldLvl) {
    const skill = WEAPON_SKILLS[category];
    const bonus = WEAPON_DMG_BONUS[newLvl - 1];
    showToast('⚔', `${skill.name} → ${newLvl} ур! +${bonus}% урона`);
    saveCurrentSlot();
  }
}

// ---------- СТИХИИ ----------

function getElementData(elementId) {
  return state.player.elements[elementId] || null;
}

function getElementLevel(elementId) {
  const e = state.player.elements[elementId];
  if (!e) return 0;
  let lvl = 0;
  for (let i = 0; i < ELEMENT_XP_THRESHOLDS.length; i++) {
    if (e.xp >= ELEMENT_XP_THRESHOLDS[i]) lvl = i + 1;
    else break;
  }
  return lvl;
}

function getElementDamageBonus(elementId) {
  const lvl = getElementLevel(elementId);
  if (lvl === 0) return 0;
  return ELEMENT_DMG_BONUS[lvl - 1];
}

function getElementNextThreshold(elementId) {
  const lvl = getElementLevel(elementId);
  if (lvl >= ELEMENT_MAX_LEVEL) return null;
  return ELEMENT_XP_THRESHOLDS[lvl];
}

function addElementXP(elementId) {
  if (!elementId || !ELEMENTS[elementId]) return;
  const p = state.player;
  if (!p.elements[elementId]) p.elements[elementId] = { xp: 0 };

  const oldLvl = getElementLevel(elementId);
  p.elements[elementId].xp += 1;
  const newLvl = getElementLevel(elementId);

  if (newLvl > oldLvl) {
    const el = ELEMENTS[elementId];
    const bonus = ELEMENT_DMG_BONUS[newLvl - 1];
    showToast('🔥', `${el.name} → ${newLvl} ур! +${bonus}% урона`);
    saveCurrentSlot();
  }
}