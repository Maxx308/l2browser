// ========================================================
//  ДАННЫЕ НАВЫКОВ
//  + Раса: у навыка может быть raceId (например, 'orc').
//
//  НОВОЕ (v0.16): Навыки светлого эльфа.
//  + Исцеление (маг) / Дыхание природы (воин) — лечат от mAtk.
//  + Благословение Леса — пассивка (+10% опыта Жизни за ур).
//  + Быстрая молитва — пассивка мага (+2% ATB за ур).
//  + Грация — пассивка воина (+1% уворота за ур).
//
//  НОВОЕ (v0.16): Навыки Дроу.
//  + Разряд — активный (воин от pAtk, маг от mAtk) + откат ATB.
//  + Наследие Грозы — общая пассивка (ответный урон Молнией).
//  + Скорость молнии — пассивка воина (+50% ATB при увороте).
//  + Цепной разум — пассивка мага (шанс снизить КД на 1).
// ========================================================

const SKILLS = {
  // ========================================================
  //  ВОИН (любая раса)
  // ========================================================
  powerStrike: {
    id: 'powerStrike', classId: 'warrior', name: 'Сильный удар', type: 'active',
    iconKey: 'skillPowerStrike',
    iconPng: 'img/skills/warrior/powerStrike.png',
    maxLevel: 5,
    levels: [
      { mpCost: 10, multiplier: 2.0 }, { mpCost: 11, multiplier: 2.25 },
      { mpCost: 13, multiplier: 2.5 }, { mpCost: 14, multiplier: 2.75 },
      { mpCost: 15, multiplier: 3.0 },
    ],
    cooldown: 3,
    getDesc: (lvl) => { const d = SKILLS.powerStrike.levels[lvl-1]; const cyc = state.player.raceId === 'human' ? ' <b>Цикл мастера:</b> убийство Сильным ударом — КД Двойного удара −1.' : ''; return `Мощный удар на <span class="val">×${d.multiplier.toFixed(2)}</span> урона.${cyc} MP: <span class="val">${d.mpCost}</span>. КД: ${SKILLS.powerStrike.cooldown} ATB.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.powerStrike.levels[lvl]; return `Следующий уровень: ×${n.multiplier.toFixed(2)} урона, MP: ${n.mpCost}`; }
  },
  resilience: {
    id: 'resilience', classId: 'warrior', name: 'Стойкость', type: 'passive',
    iconKey: 'skillResilience',
    iconPng: 'img/skills/warrior/resilience.png',
    maxLevel: 5,
    levels: [
      { pDefPercent: 5, maxHpPercent: 5 }, { pDefPercent: 6, maxHpPercent: 6 },
      { pDefPercent: 7, maxHpPercent: 7 }, { pDefPercent: 8, maxHpPercent: 8 },
      { pDefPercent: 9, maxHpPercent: 9 },
    ],
    getDesc: (lvl) => { const d = SKILLS.resilience.levels[lvl-1]; return `Пассивно: <span class="val">+${d.pDefPercent}%</span> физ. защиты и <span class="val">+${d.maxHpPercent}%</span> макс. HP.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.resilience.levels[lvl]; return `Следующий уровень: +${n.pDefPercent}% защиты, +${n.maxHpPercent}% HP`; }
  },
  weaponMasterW: {
    id: 'weaponMasterW', classId: 'warrior', name: 'Мастер оружия', type: 'passive',
    iconKey: 'skillWeaponMasterW',
    iconPng: 'img/skills/warrior/weaponMasterW.png',
    maxLevel: 5,
    levels: [
      { pAtkPercent: 5, pAtkFlat: 1 }, { pAtkPercent: 6, pAtkFlat: 2 },
      { pAtkPercent: 7, pAtkFlat: 3 }, { pAtkPercent: 8, pAtkFlat: 4 },
      { pAtkPercent: 9, pAtkFlat: 5 },
    ],
    getDesc: (lvl) => { const d = SKILLS.weaponMasterW.levels[lvl-1]; return `Пассивно: <span class="val">+${d.pAtkPercent}%</span> всего физического урона и <span class="val">+${d.pAtkFlat}</span> плоского урона.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.weaponMasterW.levels[lvl]; return `Следующий уровень: +${n.pAtkPercent}% и +${n.pAtkFlat}`; }
  },

  // ========================================================
  //  МАГ (любая раса)
  // ========================================================
  fireball: {
    id: 'fireball', classId: 'mage', name: 'Огненный шар', type: 'active',
    iconKey: 'skillFireball',
    iconPng: 'img/skills/mage/fireball.png',
    maxLevel: 5,
    levels: [
      // v0.19.1: урон −20% (было 2.50 / 2.80 / 3.10 / 3.40 / 3.70)
      { mpCost: 10, multiplier: 2.00, burnPercent: 10 },
      { mpCost: 11, multiplier: 2.24, burnPercent: 12 },
      { mpCost: 13, multiplier: 2.48, burnPercent: 15 },
      { mpCost: 14, multiplier: 2.72, burnPercent: 17 },
      { mpCost: 15, multiplier: 2.96, burnPercent: 20 },
    ],
    cooldown: 3, burnTurns: 3,
    getDesc: (lvl) => { const d = SKILLS.fireball.levels[lvl-1]; return `Огненный удар на <span class="val">×${d.multiplier.toFixed(2)}</span>. Поджог на ${SKILLS.fireball.burnTurns} хода по <span class="val">${d.burnPercent}%</span> маг. атаки. MP: <span class="val">${d.mpCost}</span>.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.fireball.levels[lvl]; return `Следующий уровень: ×${n.multiplier.toFixed(2)}, поджог ${n.burnPercent}%, MP ${n.mpCost}`; }
  },
  manaRegen: {
    id: 'manaRegen', classId: 'mage', name: 'Регенерация маны', type: 'passive',
    iconKey: 'skillManaRegen',
    iconPng: 'img/skills/mage/manaRegen.png',
    maxLevel: 5,
    levels: [
      { mpRegenInBattle: 0.5 }, { mpRegenInBattle: 0.6 }, { mpRegenInBattle: 0.7 },
      { mpRegenInBattle: 0.8 }, { mpRegenInBattle: 1.0 },
    ],
    getDesc: (lvl) => { const d = SKILLS.manaRegen.levels[lvl-1]; return `Пассивно: <span class="val">+${d.mpRegenInBattle}</span> MP/сек в бою.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.manaRegen.levels[lvl]; return `Следующий уровень: +${n.mpRegenInBattle} MP/сек в бою`; }
  },
  weaponMasterM: {
    id: 'weaponMasterM', classId: 'mage', name: 'Мастер оружия', type: 'passive',
    iconKey: 'skillWeaponMasterM',
    iconPng: 'img/skills/mage/weaponMasterM.png',
    maxLevel: 5,
    levels: [ { mAtkFlat: 3 }, { mAtkFlat: 4 }, { mAtkFlat: 5 }, { mAtkFlat: 6 }, { mAtkFlat: 8 } ],
    getDesc: (lvl) => { const d = SKILLS.weaponMasterM.levels[lvl-1]; return `Пассивно: <span class="val">+${d.mAtkFlat}</span> магической атаки.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.weaponMasterM.levels[lvl]; return `Следующий уровень: +${n.mAtkFlat} маг. атаки`; }
  },

  // ========================================================
  //  ЭЛЬФ (СВЕТЛЫЙ)
  // ========================================================
  forestBlessing: {
    id: 'forestBlessing', raceId: 'elf', name: 'Благословение Леса', type: 'passive',
    iconKey: 'skillForestBlessing',
    iconPng: 'img/skills/elf/forest_blessing.png',
    maxLevel: 5,
    levels: [
      { lifeXpBonusPercent: 10 }, { lifeXpBonusPercent: 20 }, { lifeXpBonusPercent: 30 },
      { lifeXpBonusPercent: 40 }, { lifeXpBonusPercent: 50 },
    ],
    getDesc: (lvl) => { const d = SKILLS.forestBlessing.levels[lvl-1]; return `Пассивно: <span class="val">+${d.lifeXpBonusPercent}%</span> к опыту магии Жизни.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.forestBlessing.levels[lvl]; return `Следующий уровень: +${n.lifeXpBonusPercent}% опыта Жизни`; }
  },
  heal: {
    id: 'heal', classId: 'mage', raceId: 'elf', name: 'Исцеление', type: 'active',
    iconKey: 'skillHeal',
    iconPng: 'img/skills/elf/heal.png',
    maxLevel: 5,
    levels: [
      { mpCost: 10, multiplier: 2.00 }, { mpCost: 11, multiplier: 2.25 },
      { mpCost: 13, multiplier: 2.50 }, { mpCost: 14, multiplier: 2.75 },
      { mpCost: 15, multiplier: 3.00 },
    ],
    cooldown: 4, isHeal: true,
    getDesc: (lvl) => { const d = SKILLS.heal.levels[lvl-1]; return `Исцеление на <span class="val">×${d.multiplier.toFixed(2)}</span> от маг. атаки, усиливается Жизнью. <b>Комбо:</b> пока Исцеление на перезарядке, Похищение жизни бьёт на +50%. MP: <span class="val">${d.mpCost}</span>. КД: ${SKILLS.heal.cooldown} ATB.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.heal.levels[lvl]; return `Следующий уровень: ×${n.multiplier.toFixed(2)}, MP: ${n.mpCost}`; }
  },
  fastPrayer: {
    id: 'fastPrayer', classId: 'mage', raceId: 'elf', name: 'Быстрая молитва', type: 'passive',
    iconKey: 'skillFastPrayer',
    iconPng: 'img/skills/elf/fast_prayer.png',
    maxLevel: 5,
    levels: [
      { atbPercent: 2 }, { atbPercent: 4 }, { atbPercent: 6 },
      { atbPercent: 8 }, { atbPercent: 10 },
    ],
    getDesc: (lvl) => { const d = SKILLS.fastPrayer.levels[lvl-1]; return `Пассивно: <span class="val">+${d.atbPercent}%</span> к скорости ATB.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.fastPrayer.levels[lvl]; return `Следующий уровень: +${n.atbPercent}% скорости ATB`; }
  },
  natureHeal: {
    id: 'natureHeal', classId: 'warrior', raceId: 'elf', name: 'Дыхание природы', type: 'active',
    iconKey: 'skillNatureHeal',
    iconPng: 'img/skills/elf/nature_heal.png',
    maxLevel: 5,
    levels: [
      { mpCost: 10, multiplier: 2.00 }, { mpCost: 11, multiplier: 2.25 },
      { mpCost: 13, multiplier: 2.50 }, { mpCost: 14, multiplier: 2.75 },
      { mpCost: 15, multiplier: 3.00 },
    ],
    cooldown: 4, isHeal: true,
    getDesc: (lvl) => { const d = SKILLS.natureHeal.levels[lvl-1]; return `Исцеление на <span class="val">×${d.multiplier.toFixed(2)}</span> от маг. атаки, усиливается Жизнью. <b>Комбо:</b> если Терновый вихрь убил врага — Дыхание срабатывает само, бесплатно и без отката (×1.5, если убито двое и больше). MP: <span class="val">${d.mpCost}</span>. КД: ${SKILLS.natureHeal.cooldown} ATB.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.natureHeal.levels[lvl]; return `Следующий уровень: ×${n.multiplier.toFixed(2)}, MP: ${n.mpCost}`; }
  },
  grace: {
    id: 'grace', classId: 'warrior', raceId: 'elf', name: 'Грация', type: 'passive',
    iconKey: 'skillGrace',
    iconPng: 'img/skills/elf/grace.png',
    maxLevel: 5,
    levels: [
      { evasionBonus: 1 }, { evasionBonus: 2 }, { evasionBonus: 3 },
      { evasionBonus: 4 }, { evasionBonus: 5 },
    ],
    getDesc: (lvl) => { const d = SKILLS.grace.levels[lvl-1]; return `Пассивно: <span class="val">+${d.evasionBonus}%</span> к увороту.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.grace.levels[lvl]; return `Следующий уровень: +${n.evasionBonus}% уворота`; }
  },

  // ========================================================
  //  ДРОУ (ТЁМНЫЙ ЭЛЬФ) — НОВОЕ (v0.16)
  // ========================================================
  discharge: {
    id: 'discharge', raceId: 'drow', name: 'Разряд', type: 'active',
    iconKey: 'skillDischarge', maxLevel: 5,
    iconPng: 'img/skills/drow/discharge.png',
    levels: [
      { mpCost: 12, multiplier: 1.80, atbReduction: 20 },
      { mpCost: 13, multiplier: 2.00, atbReduction: 25 },
      { mpCost: 15, multiplier: 2.20, atbReduction: 30 },
      { mpCost: 16, multiplier: 2.40, atbReduction: 35 },
      { mpCost: 18, multiplier: 2.60, atbReduction: 40 },
    ],
    cooldown: 3,   // v0.19.1: 4 → 3
    getDesc: (lvl) => { const d = SKILLS.discharge.levels[lvl-1]; return `Магический разряд на <span class="val">×${d.multiplier.toFixed(2)}</span> урона. Сбивает ATB монстра на <span class="val">${d.atbReduction}%</span>. <b>Комбо:</b> если шкала стаи сбита в ноль <b>или</b> Разряд заряжен уворотом (Скорость молнии) — цель <b>парализована</b> на 1 удар (потом 2 хода невосприимчива), а КД Искрового разреза (воин) или Цепной молнии (маг) −1. У мага заряд даёт ответка Наследия Грозы. MP: <span class="val">${d.mpCost}</span>. КД: ${SKILLS.discharge.cooldown} ATB.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.discharge.levels[lvl]; return `Следующий уровень: ×${n.multiplier.toFixed(2)}, откат ${n.atbReduction}%, MP: ${n.mpCost}`; }
  },
  stormLegacy: {
    id: 'stormLegacy', raceId: 'drow', name: 'Наследие Грозы', type: 'passive',
    iconKey: 'skillStormLegacy', maxLevel: 5,
    iconPng: 'img/skills/drow/storm_legacy.png',
    levels: [
      { frequency: 5 }, { frequency: 4 }, { frequency: 3 },
      { frequency: 2 }, { frequency: 1 },
    ],
    getDesc: (lvl) => { const d = SKILLS.stormLegacy.levels[lvl-1]; return `Пассивно: каждый <span class="val">${d.frequency}-й</span> удар монстра по вам вызывает ответный удар Молнией (урон = 5 + ур. Молнии). У мага ответка ещё и лечит <span class="val">3%</span> макс. HP и заряжает следующий Разряд — он гарантированно парализует.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.stormLegacy.levels[lvl]; return `Следующий уровень: каждый ${n.frequency}-й удар`; }
  },
  lightningSpeed: {
    id: 'lightningSpeed', classId: 'warrior', raceId: 'drow', name: 'Скорость молнии', type: 'passive',
    iconKey: 'skillLightningSpeed', maxLevel: 5,
    iconPng: 'img/skills/drow/lightning_speed.png',
    // v0.23: при увороте шкала ATB +10…50% (может перевалить за 100% — остаток идёт на следующий ход),
    //        после срабатывания — перезарядка на 2 хода героя.
    levels: [ { value: 10 }, { value: 20 }, { value: 30 }, { value: 40 }, { value: 50 } ],
    cooldown: 2,
    getDesc: (lvl) => { const d = SKILLS.lightningSpeed.levels[lvl-1]; return `Пассивно: при увороте шкала ATB мгновенно заполняется на <span class="val">+${d.value}%</span>. Если шкала переполнится — вы ходите сразу, а лишнее остаётся на следующий ход. Следующий Разряд гарантированно <b>парализует</b> цель. Перезарядка: <span class="val">2</span> хода.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.lightningSpeed.levels[lvl]; return `Следующий уровень: +${n.value}% ATB`; }
  },
  chainMind: {
    id: 'chainMind', classId: 'mage', raceId: 'drow', name: 'Цепной разум', type: 'passive',
    iconKey: 'skillChainMind', maxLevel: 5,
    iconPng: 'img/skills/drow/chain_mind.png',
    levels: [
      { chance: 20 }, { chance: 30 }, { chance: 40 },
      { chance: 50 }, { chance: 60 },
    ],
    getDesc: (lvl) => { const d = SKILLS.chainMind.levels[lvl-1]; return `Пассивно: <span class="val">${d.chance}%</span> шанс уменьшить КД активного скилла на 1 ход при атаке.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.chainMind.levels[lvl]; return `Следующий уровень: ${n.chance}% шанс`; }
  },

  // ========================================================
  //  ОРК-ВОИН
  // ========================================================
  orcRage: {
    id: 'orcRage', classId: 'warrior', raceId: 'orc',
    name: 'Ярость', type: 'active',
    iconKey: 'skillOrcRage',
    iconPng: 'img/skills/orc/orcRage.png',
    maxLevel: 5,
    levels: [
      { mpCost: 0, multiplier: 2.2, recoilPercent: 4, harvestCdCut: 1 }, { mpCost: 0, multiplier: 2.4, recoilPercent: 4, harvestCdCut: 1 },
      { mpCost: 0, multiplier: 2.6, recoilPercent: 4, harvestCdCut: 1 }, { mpCost: 0, multiplier: 2.8, recoilPercent: 4, harvestCdCut: 2 },
      { mpCost: 0, multiplier: 3.5, recoilPercent: 4, harvestCdCut: 2 },
    ],
    // v0.19.1: убийство Яростью сокращает КД Кровавой жатвы (harvestCdCut ходов).
    // v0.26: отдача 4% на всех уровнях (было 12% → 4%); не применяется ниже 50% HP;
    // если удар добил врага — отдачи нет.
    cooldown: 4, minHpPercent: 50, refundOnKill: true,
    getDesc: (lvl) => { const d = SKILLS.orcRage.levels[lvl-1]; return `Яростный удар на <span class="val">×${d.multiplier.toFixed(2)}</span> урона, усиливается Смертью. Отдача: <span class="val">${d.recoilPercent}%</span> макс. HP (нет, если враг убит). Только при HP от 50%. Убийство Яростью: КД Кровавой жатвы −<span class="val">${d.harvestCdCut}</span>. Качает Смерть. КД: ${SKILLS.orcRage.cooldown} ATB.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.orcRage.levels[lvl]; return `Следующий уровень: ×${n.multiplier.toFixed(2)}, КД Жатвы −${n.harvestCdCut}`; }
  },

  // ========================================================
  //  ОРК-МАГ
  // ========================================================
  spiritWrath: {
    id: 'spiritWrath', classId: 'mage', raceId: 'orc',
    name: 'Гнев', type: 'active',
    iconKey: 'skillSpiritWrath',
    iconPng: 'img/skills/orc/spiritWrath.png',
    maxLevel: 5,
    levels: [
      { mpCost: 0, multiplier: 2.70, recoilPercent: 4 },
      { mpCost: 0, multiplier: 3.03, recoilPercent: 4 },
      { mpCost: 0, multiplier: 3.35, recoilPercent: 4 },
      { mpCost: 0, multiplier: 3.68, recoilPercent: 4 },
      { mpCost: 0, multiplier: 4.00, recoilPercent: 4 },
    ],
    // v0.26: отдача 4% на всех уровнях (было 12% → 4%); не применяется ниже 50% HP;
    // если удар добил врага — отдачи нет.
    cooldown: 4, minHpPercent: 50, refundOnKill: true,
    getDesc: (lvl) => { const d = SKILLS.spiritWrath.levels[lvl-1]; return `Гнев духов: магический удар на <span class="val">×${d.multiplier.toFixed(2)}</span> урона. Отдача: <span class="val">${d.recoilPercent}%</span> макс. HP (нет, если враг убит). Только при HP от 50%. КД: ${SKILLS.spiritWrath.cooldown} ATB.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.spiritWrath.levels[lvl]; return `Следующий уровень: ×${n.multiplier.toFixed(2)}`; }
  },

  // ========================================================
  //  ОРК — общие пассивки
  // ========================================================
  orcBlood: {
    id: 'orcBlood', raceId: 'orc', name: 'Кровь орка', type: 'passive',
    iconKey: 'skillOrcBlood',
    iconPng: 'img/skills/orc/orcBlood.png',
    maxLevel: 5,
    levels: [
      { hpRegenInBattle: 0.3 }, { hpRegenInBattle: 0.45 }, { hpRegenInBattle: 0.6 },
      { hpRegenInBattle: 0.8 }, { hpRegenInBattle: 1.0 },
    ],
    getDesc: (lvl) => { const d = SKILLS.orcBlood.levels[lvl-1]; return `Пассивно: <span class="val">+${d.hpRegenInBattle}</span> HP/сек в бою.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.orcBlood.levels[lvl]; return `Следующий уровень: +${n.hpRegenInBattle} HP/сек в бою`; }
  },
  ironSkin: {
    id: 'ironSkin', classId: 'warrior', raceId: 'orc', name: 'Железная шкура', type: 'passive',
    iconKey: 'skillIronSkin',
    iconPng: 'img/skills/orc/ironSkin.png',
    maxLevel: 5,
    levels: [
      { flatDamageReduce: 1 }, { flatDamageReduce: 1.5 }, { flatDamageReduce: 2 },
      { flatDamageReduce: 2.5 }, { flatDamageReduce: 3 },
    ],
    getDesc: (lvl) => { const d = SKILLS.ironSkin.levels[lvl-1]; return `Пассивно: поглощение урона <span class="val">+${d.flatDamageReduce}</span> (округляется вверх в бою).`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.ironSkin.levels[lvl]; return `Следующий уровень: +${n.flatDamageReduce} поглощения`; }
  },
  shamanWisdom: {
    id: 'shamanWisdom', classId: 'mage', raceId: 'orc', name: 'Шаманская мудрость', type: 'passive',
    iconKey: 'skillShamanWisdom',
    iconPng: 'img/skills/orc/shamanWisdom.png',
    maxLevel: 5,
    levels: [
      { maxMpPercent: 3 }, { maxMpPercent: 6 }, { maxMpPercent: 9 },
      { maxMpPercent: 12 }, { maxMpPercent: 15 },
    ],
    getDesc: (lvl) => { const d = SKILLS.shamanWisdom.levels[lvl-1]; return `Пассивно: <span class="val">+${d.maxMpPercent}%</span> к максимуму маны.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.shamanWisdom.levels[lvl]; return `Следующий уровень: +${n.maxMpPercent}% макс. MP`; }
  },

  // ========================================================
  //  ГНОМ — активные
  // ========================================================
  dwarfGreed: {
    id: 'dwarfGreed', classId: 'warrior', raceId: 'dwarf',
    name: 'Жадность', type: 'active',
    iconKey: 'skillDwarfGreed', maxLevel: 5,
    iconPng: 'img/skills/dwarf/dwarfGreed.png',
    levels: [
      // v0.19.1: markTurns — сколько ходов живёт метка (растёт с уровнем, чтобы метки успевали складываться)
      { mpCost: 10, multiplier: 0.90, markTurns: 3 }, { mpCost: 11, multiplier: 0.95, markTurns: 4 },
      { mpCost: 12, multiplier: 1.00, markTurns: 4 }, { mpCost: 13, multiplier: 1.05, markTurns: 5 },
      { mpCost: 15, multiplier: 1.15, markTurns: 6 },
    ],
    cooldown: 4,
    greedMarkType: 'warrior',
    greedMarkTurns: 3,
    getDesc: (lvl) => {
      const d = SKILLS.dwarfGreed.levels[lvl-1];
      return `Жадный удар на <span class="val">×${d.multiplier.toFixed(2)}</span> урона. Накладывает <span class="val">Метку Жадности</span> на <span class="val">${d.markTurns}</span> хода. Повторная Жадность добавляет ещё метку (до <span class="val">5</span>) и продлевает старые на 1 ход. Монстр умер с метками — за каждую <span class="val">+25%</span> к дропу и <span class="val">+10%</span> опыта. Ледяной раскол разносит метки по стае. MP: <span class="val">${d.mpCost}</span>. КД: ${SKILLS.dwarfGreed.cooldown} ATB.`;
    },
    getNextDesc: (lvl) => {
      if (lvl >= 5) return '';
      const n = SKILLS.dwarfGreed.levels[lvl];
      return `Следующий уровень: ×${n.multiplier.toFixed(2)}, метка ${n.markTurns} хода, MP: ${n.mpCost}`;
    }
  },
  dwarfGreedMagic: {
    id: 'dwarfGreedMagic', classId: 'mage', raceId: 'dwarf',
    name: 'Жадность', type: 'active',
    iconKey: 'skillDwarfGreedMagic', maxLevel: 5,
    iconPng: 'img/skills/dwarf/dwarfGreed.png',
    levels: [
      { mpCost: 12, multiplier: 2.00, markTurns: 3 },
      { mpCost: 13, multiplier: 2.20, markTurns: 4 },
      { mpCost: 14, multiplier: 2.40, markTurns: 4 },
      { mpCost: 15, multiplier: 2.60, markTurns: 5 },
      { mpCost: 17, multiplier: 2.90, markTurns: 6 },
    ],
    cooldown: 4,
    greedMarkType: 'mage',
    greedMarkTurns: 3,
    getDesc: (lvl) => {
      const d = SKILLS.dwarfGreedMagic.levels[lvl-1];
      return `Жадный магический удар на <span class="val">×${d.multiplier.toFixed(2)}</span> урона. Накладывает <span class="val">Метку Жадности</span> на <span class="val">${d.markTurns}</span> хода. Повторная Жадность добавляет ещё метку (до <span class="val">5</span>) и продлевает старые на 1 ход. Монстр умер с метками — за каждую <span class="val">+25%</span> к Оболам и <span class="val">+10%</span> опыта. Буран Руны вьюги разносит метки по стае. MP: <span class="val">${d.mpCost}</span>. КД: ${SKILLS.dwarfGreedMagic.cooldown} ATB.`;
    },
    getNextDesc: (lvl) => {
      if (lvl >= 5) return '';
      const n = SKILLS.dwarfGreedMagic.levels[lvl];
      return `Следующий уровень: ×${n.multiplier.toFixed(2)}, метка ${n.markTurns} хода, MP: ${n.mpCost}`;
    }
  },

  // ========================================================
  //  ГНОМ — общая пассивка
  // ========================================================
  stoneSkin: {
    id: 'stoneSkin', raceId: 'dwarf', name: 'Каменная кожа', type: 'passive',
    iconKey: 'skillStoneSkin', maxLevel: 5,
    iconPng: 'img/skills/dwarf/stoneSkin.png',
    levels: [
      { flatDamageReduce: 1 }, { flatDamageReduce: 1.5 }, { flatDamageReduce: 2 },
      { flatDamageReduce: 2.5 }, { flatDamageReduce: 3 },
    ],
    getDesc: (lvl) => { const d = SKILLS.stoneSkin.levels[lvl-1]; return `Пассивно: поглощение урона <span class="val">+${d.flatDamageReduce}</span> (округляется вверх в бою).`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.stoneSkin.levels[lvl]; return `Следующий уровень: +${n.flatDamageReduce} поглощения`; }
  },

  // ========================================================
  //  ГНОМ-ВОИН — пассивка
  // ========================================================
  dwarfFortitude: {
    id: 'dwarfFortitude', classId: 'warrior', raceId: 'dwarf', name: 'Крепкая стойка', type: 'passive',
    iconKey: 'skillDwarfFortitude', maxLevel: 5,
    iconPng: 'img/skills/dwarf/dwarfFortitude.png',
    levels: [
      { pDefPercent: 5, maxHpPercent: 5 }, { pDefPercent: 6, maxHpPercent: 6 },
      { pDefPercent: 7, maxHpPercent: 7 }, { pDefPercent: 8, maxHpPercent: 8 },
      { pDefPercent: 9, maxHpPercent: 9 },
    ],
    // v0.25: процент защиты действует и на физ., и на маг. защиту
    getDesc: (lvl) => { const d = SKILLS.dwarfFortitude.levels[lvl-1]; return `Пассивно: <span class="val">+${d.pDefPercent}%</span> физ. и маг. защиты и <span class="val">+${d.maxHpPercent}%</span> макс. HP.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.dwarfFortitude.levels[lvl]; return `Следующий уровень: +${n.pDefPercent}% физ. и маг. защиты, +${n.maxHpPercent}% HP`; }
  },

  // ========================================================
  //  ГНОМ-МАГ — пассивка
  // ========================================================
  runeKnowledge: {
    id: 'runeKnowledge', classId: 'mage', raceId: 'dwarf', name: 'Рунное знание', type: 'passive',
    iconKey: 'skillRuneKnowledge', maxLevel: 5,
    iconPng: 'img/skills/dwarf/runeKnowledge.png',
    levels: [
      { maxMpPercent: 3, mAtkFlat: 2 }, { maxMpPercent: 6, mAtkFlat: 4 },
      { maxMpPercent: 9, mAtkFlat: 6 }, { maxMpPercent: 12, mAtkFlat: 8 },
      { maxMpPercent: 15, mAtkFlat: 10 },
    ],
    getDesc: (lvl) => { const d = SKILLS.runeKnowledge.levels[lvl-1]; return `Пассивно: <span class="val">+${d.maxMpPercent}%</span> к максимуму маны и <span class="val">+${d.mAtkFlat}</span> маг. атаки.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.runeKnowledge.levels[lvl]; return `Следующий уровень: +${n.maxMpPercent}% макс. MP, +${n.mAtkFlat} маг. атаки`; }
  },

  // ========================================================
  //  ЧЕЛОВЕК — общая пассивка
  // ========================================================
  experience: {
    id: 'experience', raceId: 'human', name: 'Опыт', type: 'passive',
    iconKey: 'skillExperience',
    iconPng: 'img/skills/human/experience.png',
    maxLevel: 5,
    levels: [
      { xpBonusPercent: 1 }, { xpBonusPercent: 2 }, { xpBonusPercent: 3 },
      { xpBonusPercent: 4 }, { xpBonusPercent: 5 },
    ],
    getDesc: (lvl) => { const d = SKILLS.experience.levels[lvl-1]; return `Пассивно: <span class="val">+${d.xpBonusPercent}%</span> к получаемому опыту.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.experience.levels[lvl]; return `Следующий уровень: +${n.xpBonusPercent}% опыта`; }
  },

  // ========================================================
  //  ЧЕЛОВЕК-ВОИН
  // ========================================================
  rest: {
    id: 'rest', classId: 'warrior', raceId: 'human', name: 'Привал', type: 'passive',
    iconKey: 'skillRest',
    iconPng: 'img/skills/human/rest.png',
    maxLevel: 5,
    levels: [
      { hpRegenOutBonus: 0.5 }, { hpRegenOutBonus: 1.0 }, { hpRegenOutBonus: 1.5 },
      { hpRegenOutBonus: 2.0 }, { hpRegenOutBonus: 2.5 },
    ],
    getDesc: (lvl) => { const d = SKILLS.rest.levels[lvl-1]; return `Пассивно: <span class="val">+${d.hpRegenOutBonus}</span> HP/сек вне боя.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.rest.levels[lvl]; return `Следующий уровень: +${n.hpRegenOutBonus} HP/сек`; }
  },
  doubleStrike: {
    id: 'doubleStrike', classId: 'warrior', raceId: 'human',
    name: 'Двойной удар', type: 'active',
    iconKey: 'skillDoubleStrike',
    iconPng: 'img/skills/human/doubleStrike.png',
    maxLevel: 5,
    levels: [
      { mpCost: 10, multiplier: 0.90 }, { mpCost: 11, multiplier: 0.95 },
      { mpCost: 12, multiplier: 1.00 }, { mpCost: 13, multiplier: 1.05 },
      { mpCost: 15, multiplier: 1.10 },
    ],
    cooldown: 4, hits: 2,
    getDesc: (lvl) => { const d = SKILLS.doubleStrike.levels[lvl-1]; return `Два удара подряд, по <span class="val">×${d.multiplier.toFixed(2)}</span> урона каждый. Крит — отдельно на каждый. <b>Цикл мастера:</b> убийство Двойным ударом — КД Кругового удара −1. MP: <span class="val">${d.mpCost}</span>. КД: ${SKILLS.doubleStrike.cooldown} ATB.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.doubleStrike.levels[lvl]; return `Следующий уровень: ×${n.multiplier.toFixed(2)} каждый удар, MP: ${n.mpCost}`; }
  },

  // ========================================================
  //  ЧЕЛОВЕК-МАГ
  // ========================================================
  meditation: {
    id: 'meditation', classId: 'mage', raceId: 'human', name: 'Медитация', type: 'passive',
    iconKey: 'skillMeditation',
    iconPng: 'img/skills/mage/meditation.png',
    maxLevel: 5,
    levels: [
      { mpRegenOutBonus: 0.5 }, { mpRegenOutBonus: 1.0 }, { mpRegenOutBonus: 1.5 },
      { mpRegenOutBonus: 2.0 }, { mpRegenOutBonus: 2.5 },
    ],
    getDesc: (lvl) => { const d = SKILLS.meditation.levels[lvl-1]; return `Пассивно: <span class="val">+${d.mpRegenOutBonus}</span> MP/сек вне боя.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.meditation.levels[lvl]; return `Следующий уровень: +${n.mpRegenOutBonus} MP/сек`; }
  },
  iceArrow: {
    id: 'iceArrow', classId: 'mage', raceId: 'human',
    name: 'Ледяная стрела', type: 'active',
    iconKey: 'skillIceArrow',
    iconPng: 'img/skills/mage/iceArrow.png',
    maxLevel: 5,
    levels: [
      // v0.19.1: −10% по итогам прогона (было 2.30 / 2.60 / 2.90 / 3.20 / 3.50) — человек-маг на 31% быстрее среднего
      { mpCost: 12, multiplier: 2.07 },
      { mpCost: 13, multiplier: 2.34 },
      { mpCost: 14, multiplier: 2.61 },
      { mpCost: 15, multiplier: 2.88 },
      { mpCost: 17, multiplier: 3.15 },
    ],
    cooldown: 4, freezeChance: 20,   // v0.19.1: 30 → 20%
    getDesc: (lvl) => { const d = SKILLS.iceArrow.levels[lvl-1]; return `Ледяной удар на <span class="val">×${d.multiplier.toFixed(2)}</span>. Шанс <span class="val">${SKILLS.iceArrow.freezeChance}%</span> заморозить монстра (пропуск удара). MP: <span class="val">${d.mpCost}</span>. КД: ${SKILLS.iceArrow.cooldown} ATB.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.iceArrow.levels[lvl]; return `Следующий уровень: ×${n.multiplier.toFixed(2)}, MP: ${n.mpCost}`; }
  },
};

// ========================================================
//  ГИЛЬДЕЙСКИЕ УСИЛЕНИЯ
// ========================================================

const GUILD_BUFFS = {
  berserk: {
    id: 'berserk', name: 'Берсерк', iconKey: 'buffBerserk',
    price: BUFF_PRICE, duration: BUFF_DURATION,
    effects: { pAtkPercent: 4, mAtkPercent: 8, atbPercent: 5, pDefPercent: -4, mDefPercent: -8 },
    desc: 'Ярость берсерка: мощнее, но уязвимее.'
  },
  eloquence: {
    id: 'eloquence', name: 'Говорливость', iconKey: 'buffEloquence',
    price: BUFF_PRICE, duration: BUFF_DURATION,
    effects: { atbPercent: 15 }, mageOnly: true,
    desc: 'Только для магических классов: ускоряет скорость каста.'
  },
  combat: {
    id: 'combat', name: 'Боевое усиление', iconKey: 'buffCombat',
    price: BUFF_PRICE, duration: BUFF_DURATION,
    effects: { pAtkPercent: 6, pDefPercent: 6 },
    desc: 'Универсальное боевое усиление.'
  },
  accuracy: {
    id: 'accuracy', name: 'Меткость', iconKey: 'buffCombat',
    price: BUFF_PRICE, duration: BUFF_DURATION,
    effects: { accuracyFlat: 5 },
    desc: 'Гильдейские маги накладывают чары точности. +5 к точности.'
  },
  shieldwall: {
    id: 'shieldwall', name: 'Расширить щит', iconKey: 'buffCombat',
    price: BUFF_PRICE, duration: BUFF_DURATION,
    effects: { blockFlat: 3 },
    desc: 'Укрепляет защиту щитом. +3% к шансу блока.'
  },
};

// ========================================================
//  ТАВЕРНЯ «КОЗЬЕ ВЫМЯ» — УСИЛЕНИЯ
// ========================================================

const TAVERN_BUFFS = {
  rest: {
    id: 'rest',
    name: 'Отдых',
    desc: 'Хорошо посидеть, отдохнуть от дороги. Опыт капает быстрее.',
    iconKey: 'tavernRest',
    effect: 'xpPercent',
    value: TAVERN_XP_BONUS_PERCENT,
    duration: TAVERN_BUFF_DURATION,
    tooltip: '+10% к получаемому опыту. Таймеры складываются (максимум 12 часов).',
  },
  relax: {
    id: 'relax',
    name: 'Расслабон',
    desc: 'Поговорить, выпить, посмеяться. Дело спорится — умения растут быстрее.',
    iconKey: 'tavernRelax',
    effect: 'profPercent',
    value: TAVERN_PROF_BONUS_PERCENT,
    duration: TAVERN_BUFF_DURATION,
    tooltip: '+10% шанс получить бонусный опыт владения за удар. Таймеры складываются (максимум 12 часов).',
  },
};

// ========================================================
//  SVG-ИКОНКИ ДЛЯ БАФФОВ ТАВЕРНЫ
// ========================================================

const TAVERN_SVG = {
  tavernRest: `<svg viewBox="0 0 24 24" style="width:48px;height:48px;">
    <path d="M3 18 L3 14 Q3 12 5 12 L19 12 Q21 12 21 14 L21 18" fill="#5a3a1a" stroke="#e0be7a" stroke-width="1.5"/>
    <path d="M3 16 L21 16" stroke="#e0be7a" stroke-width="1"/>
    <rect x="4" y="9" width="7" height="4" rx="1" fill="#d0c8b0" stroke="#8a8070" stroke-width="1.2"/>
    <rect x="13" y="9" width="7" height="4" rx="1" fill="#d0c8b0" stroke="#8a8070" stroke-width="1.2"/>
    <path d="M3 18 L3 20 M21 18 L21 20" stroke="#8a6a3a" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  tavernRelax: `<svg viewBox="0 0 24 24" style="width:48px;height:48px;">
    <path d="M5 6 L14 6 L14 20 Q14 22 12 22 L7 22 Q5 22 5 20 Z" fill="#c89040" stroke="#e0be7a" stroke-width="1.5"/>
    <path d="M14 8 Q19 8 19 12 Q19 16 14 16" fill="none" stroke="#e0be7a" stroke-width="1.5"/>
    <ellipse cx="9.5" cy="6" rx="4.5" ry="1.5" fill="#f0e0a0" stroke="#e0be7a" stroke-width="1"/>
    <path d="M7 3 Q8 1 9.5 3 Q11 1 12 3" stroke="#fff" stroke-width="1" fill="none" opacity="0.7"/>
    <circle cx="7" cy="11" r="0.8" fill="#fff" opacity="0.6"/>
    <circle cx="12" cy="14" r="0.8" fill="#fff" opacity="0.6"/>
    <circle cx="8" cy="17" r="0.8" fill="#fff" opacity="0.6"/>
  </svg>`,
};