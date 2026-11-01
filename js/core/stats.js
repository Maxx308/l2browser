// ========================================================
//  ЯДРО: ПЕРЕСЧЁТ ХАРАКТЕРИСТИК
//  Считает HP/MP/атаку/защиту с учётом:
//    - базовых статов
//    - экипировки
//    - бонусов редкости
//    - пассивных навыков
//    - сетов
//    - гильдейских баффов
//
//  НОВОЕ (v0.16 fix):
//  + Проценты от пассивок (Стойкость, Крепкая стойка) 
//    теперь применяются в САМОМ КОНЦЕ к общей сумме защиты
//    (база + доспехи + сеты + подгонка).
// ========================================================

// v0.21: все надетые части комплекта подогнаны минимум до +lvl
function isSetRefinedTo(set, lvl) {
  const eq = Object.values(state.player.equipment).filter(e => e && set.pieces.includes(e.name));
  return eq.length >= set.pieces.length && eq.every(e => (e.refineLevel || 0) >= lvl);
}

function recalcStats() {
  const p = state.player;

  if (!p.classId) {
    p.maxHp = 0; p.maxMp = 0; p.pAtk = 0; p.mAtk = 0;
    p.pDef = 0; p.mDef = 0; p.atbSpeed = 0;
    p.flatDamageReduce = 0; p.blockChance = 0; p.manaShield = 0;
    p.critChance = 10;
    p.setBonuses = []; p.skillBonuses = []; p.buffBonuses = []; p.skillFlatDamage = 0;
    p.hasManaRegenPassive = false; p.mpRegenInBonus = 0;
    p.hpRegenIn = 0;
    p.xpBonus = 0;
    p.hpRegenOutBonus = 0;
    p.mpRegenOutBonus = 0;
    p.accuracyBonus = 0;
    p.evasionBonus = 0;
    p.goldBonusPercent = 0;
    p.dropBonusPercent = 0;
    p.profBonusPercent = 0;
    p.critBonusFromRefine = 0;
    p.blockBonusFromRefine = 0;
    p.basePDefForUI = 0;
    p.offhandPAtk = 0;
    return;
  }

  // ---- Бонусы редкости от экипировки ----
  let bonusSTR = 0, bonusDEX = 0, bonusCON = 0;
  let bonusINT = 0, bonusWIT = 0, bonusMEN = 0;

  Object.values(p.equipment).forEach(item => {
    if (!item || !item.bonusStats) return;
    bonusSTR += item.bonusStats.STR || 0;
    bonusDEX += item.bonusStats.DEX || 0;
    bonusCON += item.bonusStats.CON || 0;
    bonusINT += item.bonusStats.INT || 0;
    bonusWIT += item.bonusStats.WIT || 0;
    bonusMEN += item.bonusStats.MEN || 0;
  });

  const effSTR = p.STR + bonusSTR;
  const effDEX = p.DEX + bonusDEX;
  const effCON = p.CON + bonusCON;
  const effINT = p.INT + bonusINT;
  const effWIT = p.WIT + bonusWIT;
  const effMEN = p.MEN + bonusMEN;

  p.effSTR = effSTR;
  p.effDEX = effDEX;
  p.effCON = effCON;
  p.effINT = effINT;
  p.effWIT = effWIT;
  p.effMEN = effMEN;

  // ---- HP: линейная формула от CON с классовым множителем ----
  const classHPMult = (p.classId === 'mage') ? 1.2 : 1.0;
  p.maxHp = Math.floor(effCON * (2.77 + 0.45 * (p.level - 1)) * classHPMult);

  // ---- MP: квадратичная формула от MEN ----
  if (p.classId === 'mage') {
    p.maxMp = Math.floor(effMEN * (0.905 + 0.256 * p.level + 0.0185 * p.level * p.level));
  } else {
    p.maxMp = Math.floor(effMEN * (0.722 + 0.194 * p.level + 0.0042 * p.level * p.level));
  }

  let basePAtk = Math.floor(10 + effSTR * 0.8);
  let baseMAtk = Math.floor(5 + effINT * 0.8);
  
  // Базовая защита (до пассивок и процентов)
  p.pDef = Math.floor(5 + effCON * 0.3);
  p.mDef = Math.floor(5 + effMEN * 0.3);

  // ---- ATB: плавная формула ----
  let atbStat;
  if (p.classId === 'mage') {
    atbStat = effWIT;
  } else {
    atbStat = effDEX;
  }
  const statDiff = Math.max(0, atbStat - 10);
  p.atbSpeed = 0.7 + 3.0 * statDiff / (statDiff + 90);

  p.flatDamageReduce = 0; p.blockChance = 0; p.manaShield = 0;
  p.critChance = 10;
  let bonusMaxMp = 0, bonusMaxHp = 0, bonusMAtk = 0, bonusAtbMod = 0;
  let itemMpRegenIn = 0;   // v0.25: жезлы — реген маны в бою

  // ---- Бонусы ПОДГОНКИ (refine) ----
  let refineAccuracyBonus = 0;
  let refineEvasionBonus = 0;
  let refineCritBonus = 0;
  let refineBlockBonus = 0;
  let refineXpBonus = 0;
  let refineProfBonus = 0;
  let refineGoldBonus = 0;
  let refineDropBonus = 0;
  let refineHpRegenOut = 0;
  let refineMpRegenOut = 0;

  // ---- Экипировка (обычные статы + бонусы подгонки) ----
  // v0.27: оружие во второй руке своих статов не даёт — его атака идёт в обычный удар
  // (p.offhandPAtk, 40%). Редкость (очки) и подгонка считаются как у любой вещи.
  const offhand = getOffhandWeapon();
  p.offhandPAtk = getOffhandPAtk();
  Object.values(p.equipment).forEach(item => {
    if (!item) return;

    if (item.stats && item !== offhand) {
      // v0.26: атака/защита/HP/MP — с надбавкой редкости (getItemStat, config.js)
      if (item.stats.pAtk) basePAtk += getItemStat(item, 'pAtk');
      if (item.stats.pDef) p.pDef += getItemStat(item, 'pDef');
      if (item.stats.mDef) p.mDef += getItemStat(item, 'mDef');
      if (item.stats.mAtk) bonusMAtk += getItemStat(item, 'mAtk');
      if (item.stats.flatDamageReduce) p.flatDamageReduce += item.stats.flatDamageReduce;
      if (item.stats.blockChance) p.blockChance += item.stats.blockChance;
      if (item.stats.mpBonus) bonusMaxMp += getItemStat(item, 'mpBonus');
      if (item.stats.hpBonus) bonusMaxHp += getItemStat(item, 'hpBonus');
      if (item.stats.atbSpeedMod) bonusAtbMod += item.stats.atbSpeedMod;
      if (item.stats.critChance) p.critChance += item.stats.critChance;
      if (item.stats.mpRegenIn) itemMpRegenIn += item.stats.mpRegenIn;
    }

    const rb = item.refineBonuses;
    if (rb) {
      if (rb.hpBonus)         bonusMaxHp += rb.hpBonus;
      if (rb.mpBonus)         bonusMaxMp += rb.mpBonus;
      if (rb.hpRegenOutBonus) refineHpRegenOut += rb.hpRegenOutBonus;
      if (rb.mpRegenOutBonus) refineMpRegenOut += rb.mpRegenOutBonus;
      if (rb.accuracyBonus)   refineAccuracyBonus += rb.accuracyBonus;
      if (rb.evasionBonus)    refineEvasionBonus += rb.evasionBonus;
      if (rb.xpBonusPercent)  refineXpBonus += rb.xpBonusPercent;
      if (rb.profBonusPercent) refineProfBonus += rb.profBonusPercent;
      if (rb.goldBonusPercent) refineGoldBonus += rb.goldBonusPercent;
      if (rb.dropBonusPercent) refineDropBonus += rb.dropBonusPercent;
      if (rb.critBonus)       refineCritBonus += rb.critBonus;
      if (rb.blockBonus)      refineBlockBonus += rb.blockBonus;
      if (rb.pAtkFlat)        basePAtk += rb.pAtkFlat;
      if (rb.mAtkFlat)        bonusMAtk += rb.mAtkFlat;
      if (rb.pDefFlat)        p.pDef += rb.pDefFlat;
      if (rb.mDefFlat)        p.mDef += rb.mDefFlat;
      if (rb.xpMsPercent)     refineXpBonus += rb.xpMsPercent;     // v0.25: вехи бижутерии
      if (rb.profMsPercent)   refineProfBonus += rb.profMsPercent;
    }
  });

  // v0.25: мини-сет бижутерии — маг. защита за 2–5 вещей одного тира и выше
  const jewelryMiniSet = getJewelryMiniSet(p.equipment);
  if (jewelryMiniSet) p.mDef += jewelryMiniSet.bonus;

  // Запоминаем защиту ДО пассивок (для окна персонажа)
  p.basePDefForUI = p.pDef;

  p.maxMp += bonusMaxMp;
  p.maxHp += bonusMaxHp;
  p.atbSpeed *= (1 + bonusAtbMod);
  if (offhand && !isMage()) p.atbSpeed *= (1 + DUAL_WIELD_ATB_BONUS / 100);   // v0.27: парное — быстрее
  p.critChance += refineCritBonus;
  p.blockChance += refineBlockBonus;

  // ---- Пассивные навыки ----
  p.skillBonuses = [];
  p.hasManaRegenPassive = false;
  p.mpRegenInBonus = 0;
  p.hpRegenIn = 0;
  p.xpBonus = 0;
  p.hpRegenOutBonus = 0;
  p.mpRegenOutBonus = 0;
  p.evasionBonus = 0;   // «Грация» + подгонка (раньше подгонка затирала «Грацию»)

  let passivePAtkPercent = 0, passivePAtkFlat = 0, passiveMAtkFlat = 0;
  let passivePDefPercent = 0, passiveMaxHpPercent = 0;
  let passiveMDefPercent = 0;   // v0.25: «Крепкая стойка» гнома
  let passiveMaxMpPercent = 0;

  for (const skillId in p.learnedSkills) {
    const lvl = p.learnedSkills[skillId];
    const skill = SKILLS[skillId];
    if (!skill || skill.type !== 'passive') continue;
    const data = skill.levels[lvl - 1];

    if (skill.id === 'resilience') {
      passivePDefPercent += data.pDefPercent;
      passiveMaxHpPercent += data.maxHpPercent;
      p.skillBonuses.push(`${skill.name} (ур.${lvl}): +${data.pDefPercent}% защиты, +${data.maxHpPercent}% HP`);
    } else if (skill.id === 'weaponMasterW') {
      passivePAtkPercent += data.pAtkPercent;
      passivePAtkFlat += data.pAtkFlat;
      p.skillBonuses.push(`${skill.name} (ур.${lvl}): +${data.pAtkPercent}% и +${data.pAtkFlat} физ. урона`);
    } else if (skill.id === 'manaRegen') {
      p.hasManaRegenPassive = true;
      p.mpRegenInBonus += data.mpRegenInBattle;
      p.skillBonuses.push(`${skill.name} (ур.${lvl}): +${data.mpRegenInBattle} MP/сек в бою`);
    } else if (skill.id === 'weaponMasterM') {
      passiveMAtkFlat += data.mAtkFlat;
      p.skillBonuses.push(`${skill.name} (ур.${lvl}): +${data.mAtkFlat} маг. атаки`);
    }
    else if (skill.id === 'orcBlood') {
      p.hpRegenIn += data.hpRegenInBattle;
      p.skillBonuses.push(`${skill.name} (ур.${lvl}): +${data.hpRegenInBattle} HP/сек в бою`);
    } else if (skill.id === 'ironSkin') {
      p.flatDamageReduce += data.flatDamageReduce;
      p.skillBonuses.push(`${skill.name} (ур.${lvl}): поглощение урона +${data.flatDamageReduce}`);
    } else if (skill.id === 'shamanWisdom') {
      passiveMaxMpPercent += data.maxMpPercent;
      p.skillBonuses.push(`${skill.name} (ур.${lvl}): +${data.maxMpPercent}% макс. MP`);
    }
    else if (skill.id === 'experience') {
      p.xpBonus += data.xpBonusPercent;
      p.skillBonuses.push(`${skill.name} (ур.${lvl}): +${data.xpBonusPercent}% опыта`);
    } else if (skill.id === 'rest') {
      p.hpRegenOutBonus += data.hpRegenOutBonus;
      p.skillBonuses.push(`${skill.name} (ур.${lvl}): +${data.hpRegenOutBonus} HP/сек вне боя`);
    } else if (skill.id === 'meditation') {
      p.mpRegenOutBonus += data.mpRegenOutBonus;
      p.skillBonuses.push(`${skill.name} (ур.${lvl}): +${data.mpRegenOutBonus} MP/сек вне боя`);
    }
    else if (skill.id === 'stoneSkin') {
      p.flatDamageReduce += data.flatDamageReduce;
      p.skillBonuses.push(`${skill.name} (ур.${lvl}): поглощение урона +${data.flatDamageReduce}`);
    } else if (skill.id === 'dwarfFortitude') {
      passivePDefPercent += data.pDefPercent;
      passiveMDefPercent += data.pDefPercent;   // v0.25: и к маг. защите тоже
      passiveMaxHpPercent += data.maxHpPercent;
      p.skillBonuses.push(`${skill.name} (ур.${lvl}): +${data.pDefPercent}% физ. и маг. защиты, +${data.maxHpPercent}% HP`);
    } else if (skill.id === 'runeKnowledge') {
      passiveMaxMpPercent += data.maxMpPercent;
      passiveMAtkFlat += data.mAtkFlat;
      p.skillBonuses.push(`${skill.name} (ур.${lvl}): +${data.maxMpPercent}% макс. MP, +${data.mAtkFlat} маг. атаки`);
    } else if (skill.id === 'grace') {
      p.evasionBonus += data.evasionBonus;
      p.skillBonuses.push(`${skill.name} (ур.${lvl}): +${data.evasionBonus}% уворота`);
    } else if (skill.id === 'fastPrayer') {
      p.atbSpeed *= (1 + data.atbPercent / 100);
      p.skillBonuses.push(`${skill.name} (ур.${lvl}): +${data.atbPercent}% скорости ATB`);
    }
  }

  // v0.27: двуручный хват — показываем в окне персонажа рядом с пассивками
  const gripBonus = (typeof getTwoHandGripBonus === 'function') ? getTwoHandGripBonus() : 0;
  if (gripBonus > 0) p.skillBonuses.push(`Двуручный хват: +${gripBonus}% к урону навыков, уворот −${TWO_HAND_EVASION_PENALTY}`);
  if (getEquippedShield()) p.skillBonuses.push(`Стойка щита: −${SHIELD_STANCE_DAMAGE_CUT}% входящего урона, уворот −${SHIELD_EVASION_PENALTY}`);
  if (offhand && !isMage()) p.skillBonuses.push(`Парное оружие: +${p.offhandPAtk} к обычной атаке (${offhand.name}), скорость +${DUAL_WIELD_ATB_BONUS}%, точность −${DUAL_WIELD_ACCURACY_PENALTY}, уворот −${DUAL_WIELD_EVASION_PENALTY}`);
  if (hasFreeHandStyle()) p.skillBonuses.push(`Свободная рука: +${FREE_HAND_EVASION_BONUS} к увороту`);

  if (passiveMaxMpPercent > 0) {
    p.maxMp = Math.floor(p.maxMp * (1 + passiveMaxMpPercent / 100));
  }

  let finalPAtk = basePAtk;
  if (passivePAtkPercent > 0) finalPAtk = Math.floor(finalPAtk * (1 + passivePAtkPercent / 100));
  finalPAtk += passivePAtkFlat;
  p.pAtk = finalPAtk;
  p.mAtk = baseMAtk + bonusMAtk + passiveMAtkFlat;

  // ---- Сеты ----
  p.setBonuses = [];
  if (jewelryMiniSet) {
    p.setBonuses.push({ name: `Бижутерия тира ${jewelryMiniSet.tier}+`, text: `${jewelryMiniSet.count} ${jewelryMiniSet.count >= 5 ? 'вещей' : 'вещи'}: +${jewelryMiniSet.bonus} маг. защиты` });
  }
  p.skillFlatDamage = 0;   // v0.25: ступени Т3-брони — плоский урон навыков и ДОТов
  Object.values(SETS).forEach(set => {
    const tier = getSetSkillFlatTier(set, countSetPiecesWorn(set, p.equipment));
    if (tier) {
      p.skillFlatDamage += tier.value;
      p.setBonuses.push({ name: `${set.name} (${tier.pieces} вещи)`, text: `+${tier.value} к урону навыков и ДОТов` });
    }
    let isFull = set.isFullSetEquipped ? set.isFullSetEquipped() :
      set.pieces.filter(name => Object.values(p.equipment).some(eq => eq && eq.name === name)).length >= set.pieces.length;
    if (isFull) {
      if (set.bonus.atbSpeed) p.atbSpeed *= (1 + set.bonus.atbSpeed);
      if (set.bonus.mAtkPercent) p.mAtk += Math.floor(p.mAtk * (set.bonus.mAtkPercent / 100));
      if (set.bonus.maxHpFlat) p.maxHp += set.bonus.maxHpFlat;
      if (set.bonus.maxMpFlat) p.maxMp += set.bonus.maxMpFlat;
      if (set.bonus.critChance) p.critChance += set.bonus.critChance;

      if (set.bonus.hpRegenOutBonus) p.hpRegenOutBonus += set.bonus.hpRegenOutBonus;
      if (set.bonus.mpRegenOutBonus) p.mpRegenOutBonus += set.bonus.mpRegenOutBonus;
      // v0.21: тир 3
      if (set.bonus.flatDamageReduce) p.flatDamageReduce += set.bonus.flatDamageReduce;
      if (set.bonus.manaShield) p.manaShield += set.bonus.manaShield;

      p.setBonuses.push({ name: set.name, text: set.bonusText });

      // v0.21: вторая ступень — все части комплекта подогнаны до +10 и выше
      if (set.bonus10 && isSetRefinedTo(set, 10)) {
        const b = set.bonus10;
        if (b.mAtkPercent) p.mAtk += Math.floor(p.mAtk * (b.mAtkPercent / 100));
        if (b.flatDamageReduce) p.flatDamageReduce += b.flatDamageReduce;
        if (b.manaShield) p.manaShield += b.manaShield;
        p.setBonuses.push({ name: set.name + ' +10', text: set.bonus10Text });
      }
    }
  });

  if (passiveMaxHpPercent > 0) p.maxHp = Math.floor(p.maxHp * (1 + passiveMaxHpPercent / 100));

  // ========================================================
  //  ФИКС: Применяем процент защиты от пассивок в САМОМ КОНЦЕ
  //  (к базе + доспехам + сетам)
  // ========================================================
  if (passivePDefPercent > 0) {
    p.pDef = Math.floor(p.pDef * (1 + passivePDefPercent / 100));
  }
  if (passiveMDefPercent > 0) {
    p.mDef = Math.floor(p.mDef * (1 + passiveMDefPercent / 100));
  }

  // ========================================================
  //  БОНУСЫ ПОДГОНКИ (сохраняем в state для боя)
  // ========================================================
  p.accuracyBonus = refineAccuracyBonus;
  p.evasionBonus += refineEvasionBonus;
  p.xpBonusFromRefine = refineXpBonus;
  p.profBonusFromRefine = refineProfBonus;
  p.goldBonusFromRefine = refineGoldBonus;
  p.dropBonusFromRefine = refineDropBonus;
  p.hpRegenOutBonus += refineHpRegenOut;
  p.mpRegenOutBonus += refineMpRegenOut;

  // ========================================================
  //  ГИЛЬДЕЙСКИЕ БАФФЫ
  // ========================================================
  p.buffBonuses = [];
  Object.keys(p.guildBuffs).forEach(buffId => {
    const active = p.guildBuffs[buffId];
    if (!active || active.timer <= 0) return;
    const buff = GUILD_BUFFS[buffId];
    if (!buff) return;

    if (buff.mageOnly && p.classId !== 'mage') {
      p.buffBonuses.push(`${buff.name}: не действует (не Маг)`);
      return;
    }
    const eff = buff.effects;
    const details = [];
    if (eff.pAtkPercent) { p.pAtk = Math.floor(p.pAtk * (1 + eff.pAtkPercent / 100)); details.push(`${eff.pAtkPercent > 0 ? '+' : ''}${eff.pAtkPercent}% физ.атк`); }
    if (eff.mAtkPercent) { p.mAtk = Math.floor(p.mAtk * (1 + eff.mAtkPercent / 100)); details.push(`${eff.mAtkPercent > 0 ? '+' : ''}${eff.mAtkPercent}% маг.атк`); }
    if (eff.pDefPercent) { p.pDef = Math.floor(p.pDef * (1 + eff.pDefPercent / 100)); details.push(`${eff.pDefPercent > 0 ? '+' : ''}${eff.pDefPercent}% физ.защ`); }
    if (eff.mDefPercent) { p.mDef = Math.floor(p.mDef * (1 + eff.mDefPercent / 100)); details.push(`${eff.mDefPercent > 0 ? '+' : ''}${eff.mDefPercent}% маг.защ`); }
    if (eff.atbPercent) { p.atbSpeed *= (1 + eff.atbPercent / 100); details.push(`${eff.atbPercent > 0 ? '+' : ''}${eff.atbPercent}% скорость`); }

    if (eff.accuracyFlat) {
      p.accuracyBonus = (p.accuracyBonus || 0) + eff.accuracyFlat;
      details.push(`+${eff.accuracyFlat} точность`);
    }
    if (eff.blockFlat && getEquippedShield()) {   // v0.27: «Расширить щит» — только со щитом
      p.blockChance += eff.blockFlat;
      details.push(`+${eff.blockFlat}% блок`);
    }

    p.buffBonuses.push(`${buff.name}: ${details.join(', ')}`);
  });

  // ---- v0.20: блюдо ----
  const dish = p.dish && p.dish.timer > 0 ? DISHES[p.dish.id] : null;
  if (dish) {
    if (dish.pAtkPercent) p.pAtk = Math.floor(p.pAtk * (1 + dish.pAtkPercent / 100));
    if (dish.maxHpPercent) p.maxHp = Math.floor(p.maxHp * (1 + dish.maxHpPercent / 100));
    p.buffBonuses.push(`${dish.name}: ${dish.text}`);
  }

  // ---- Регенерация маны ----
  // v0.25: реген маны в бою от оружия (жезлы) работает и без навыка «Регенерация маны»
  if (itemMpRegenIn > 0) {
    p.hasManaRegenPassive = true;
    p.mpRegenInBonus = (p.mpRegenInBonus || 0) + itemMpRegenIn;
  }
  p.mpRegenOut = computeMpRegen(p.maxMp, false);
  p.mpRegenIn = computeMpRegen(p.maxMp, true) + (p.mpRegenInBonus || 0);
  if (dish && dish.mpRegenPercent) {
    p.mpRegenOut *= 1 + dish.mpRegenPercent / 100;
    p.mpRegenIn *= 1 + dish.mpRegenPercent / 100;
  }

  if (p.hp > p.maxHp) p.hp = p.maxHp;
  if (p.mp > p.maxMp) p.mp = p.maxMp;
}

function hasTwoHandedWeapon() {
  const w = state.player.equipment.weapon;
  return w && w.twoHanded;
}

function isMage() { return state.player.classId === 'mage'; }