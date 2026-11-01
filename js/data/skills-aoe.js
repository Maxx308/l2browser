// ========================================================
//  ДАННЫЕ: МАССОВЫЕ НАВЫКИ (v0.19)
//  По одному на каждую пару «раса + класс».
//  Открываются с 10 уровня героя (minLevel).
//
//  Общие поля:
//    aoe.minTargets — навык не тратится, если живых врагов меньше
//                     (чтобы не сжигать массовый удар на одного моба).
//    fxAnim         — как двигается герой: 'melee' (рывок) / 'cast'.
//    element        — какая стихия качается (Владение).
//
//  Логика боя — js/systems/battle-aoe.js.
//  Подключать ПОСЛЕ js/data/skills.js и ДО main.js
//  (main.js превращает iconPng в иконку).
// ========================================================

// Коротко: форматирование чисел в описаниях.
function aoeX(v) { return `<span class="val">×${v.toFixed(2)}</span>`; }
function aoeV(v) { return `<span class="val">${v}</span>`; }

const SKILLS_AOE = {

  // ========================================================
  //  ЧЕЛОВЕК — УНИВЕРСАЛ
  // ========================================================
  whirlwind: {
    id: 'whirlwind', classId: 'warrior', raceId: 'human',
    name: 'Круговой удар', type: 'active', iconPng: 'img/skills/human/whirlwind.png',
    maxLevel: 5, minLevel: 10, cooldown: 5, fxAnim: 'melee',
    aoe: { kind: 'whirlwind', minTargets: 2 },
    levels: [
      { mpCost: 14, multiplier: 0.90, targets: 3 },
      { mpCost: 15, multiplier: 0.97, targets: 3 },
      { mpCost: 16, multiplier: 1.05, targets: 3 },
      { mpCost: 17, multiplier: 1.12, targets: 3 },
      { mpCost: 18, multiplier: 1.20, targets: 4 },
    ],
    getDesc: (lvl) => { const d = SKILLS.whirlwind.levels[lvl-1]; return `Удар по кругу: бьёт до ${aoeV(d.targets)} врагов на ${aoeX(d.multiplier)} урона каждого. Крит — отдельно на каждого. <b>Цикл мастера:</b> убил хоть одного — КД Сильного удара −1. MP: ${aoeV(d.mpCost)}. КД: ${SKILLS.whirlwind.cooldown}. Открывается с 10 уровня.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.whirlwind.levels[lvl]; return `Следующий уровень: ${n.targets} цели, ×${n.multiplier.toFixed(2)}, MP ${n.mpCost}`; },
  },

  elementalVolley: {
    id: 'elementalVolley', classId: 'mage', raceId: 'human',
    name: 'Стихийный залп', type: 'active', iconPng: 'img/skills/human/elementalVolley.png',
    maxLevel: 5, minLevel: 10, cooldown: 5, fxAnim: 'cast',
    aoe: { kind: 'volley', minTargets: 2 },
    levels: [
      { mpCost: 16, multiplier: 0.80, shots: 3, effectChance: 10 },
      { mpCost: 17, multiplier: 0.87, shots: 3, effectChance: 12 },
      { mpCost: 19, multiplier: 0.95, shots: 3, effectChance: 14 },
      { mpCost: 20, multiplier: 1.02, shots: 3, effectChance: 17 },
      { mpCost: 22, multiplier: 1.10, shots: 4, effectChance: 20 },
    ],
    getDesc: (lvl) => { const d = SKILLS.elementalVolley.levels[lvl-1]; return `${aoeV(d.shots)} снаряда случайной стихии (огонь / лёд / молния) в случайных врагов, по ${aoeX(d.multiplier)}. Шанс ${aoeV(d.effectChance + '%')} эффекта стихии: поджог, заморозка или сбитый ATB. <b>Стихийный резонанс:</b> если в залпе были все три стихии — следующий Огненный шар или Ледяная стрела без маны. Качает все три стихии. MP: ${aoeV(d.mpCost)}. КД: ${SKILLS.elementalVolley.cooldown}. С 10 уровня.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.elementalVolley.levels[lvl]; return `Следующий уровень: ${n.shots} снаряда, ×${n.multiplier.toFixed(2)}, эффект ${n.effectChance}%`; },
  },

  // ========================================================
  //  ОРК — СМЕРТЬ
  // ========================================================
  bloodHarvest: {
    id: 'bloodHarvest', classId: 'warrior', raceId: 'orc',
    name: 'Кровавая жатва', type: 'active', iconPng: 'img/skills/orc/bloodHarvest.png',
    maxLevel: 5, minLevel: 10, cooldown: 4, fxAnim: 'melee', element: 'death',   // v0.19.1: КД 5 → 4
    aoe: { kind: 'harvest', minTargets: 2 },
    levels: [
      { mpCost: 12, multiplier: 0.70, targets: 5, healPercent: 5 },
      { mpCost: 13, multiplier: 0.77, targets: 5, healPercent: 5.5 },
      { mpCost: 14, multiplier: 0.85, targets: 5, healPercent: 6 },
      { mpCost: 15, multiplier: 0.92, targets: 5, healPercent: 7 },
      { mpCost: 16, multiplier: 1.00, targets: 5, healPercent: 8 },
    ],
    getDesc: (lvl) => { const d = SKILLS.bloodHarvest.levels[lvl-1]; return `Широкий удар по всем врагам (до ${aoeV(d.targets)}) на ${aoeX(d.multiplier)}. За каждого убитого этим ударом — лечение ${aoeV(d.healPercent + '%')} макс. HP. Усиливается Смертью и качает её. Убийство Яростью сокращает КД Жатвы. MP: ${aoeV(d.mpCost)}. КД: ${SKILLS.bloodHarvest.cooldown}. С 10 уровня.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.bloodHarvest.levels[lvl]; return `Следующий уровень: ×${n.multiplier.toFixed(2)}, лечение ${n.healPercent}% за убийство`; },
  },

  pestilence: {
    id: 'pestilence', classId: 'mage', raceId: 'orc',
    name: 'Мор', type: 'active', iconPng: 'img/skills/orc/pestilence.png',
    maxLevel: 5, minLevel: 10, cooldown: 5, fxAnim: 'cast', element: 'death',
    aoe: { kind: 'pestilence', minTargets: 2 },
    levels: [
      // v0.19.1: урон −5% (было 25 / 28 / 31 / 35 / 40)
      // v0.25: урон +15% (было 24 / 27 / 29 / 33 / 38)
      { mpCost: 16, targets: 3, dotPercent: 28, turns: 3 },
      { mpCost: 17, targets: 3, dotPercent: 31, turns: 3 },
      { mpCost: 19, targets: 4, dotPercent: 34, turns: 4 },
      { mpCost: 20, targets: 4, dotPercent: 38, turns: 5 },
      { mpCost: 22, targets: 5, dotPercent: 44, turns: 6 },
    ],
    // v0.19.1: до 2 слоёв; некуда перескочить → +1 ход всем (макс 6); Гнев: +10% урона Гниения до конца боя (макс +30%)
    rotMaxLayers: 2, rotMaxTurns: 6, wrathBonusPercent: 10, wrathBonusMax: 3,
    getDesc: (lvl) => { const d = SKILLS.pestilence.levels[lvl-1]; return `Насылает Гниение на ${aoeV(d.targets)} врагов: ${aoeV(d.dotPercent + '%')} маг. атаки урона каждый ход, ${aoeV(d.turns)} хода. Повторный Мор вешает <b>второй слой</b> (урон ×2). Враг умер — Гниение <b>перескакивает</b> на соседа, а если некуда — остальные гниют на 1 ход дольше. <b>Комбо:</b> каждый Гнев +10% к урону Гниения до конца боя (макс. +30%). Качает Смерть. MP: ${aoeV(d.mpCost)}. КД: ${SKILLS.pestilence.cooldown}. С 10 уровня.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.pestilence.levels[lvl]; return `Следующий уровень: ${n.targets} цели, ${n.dotPercent}% за ход, ${n.turns} хода`; },
  },

  // ========================================================
  //  ЭЛЬФ — ЖИЗНЬ (с оттенком тьмы)
  // ========================================================
  thornWhirl: {
    id: 'thornWhirl', classId: 'warrior', raceId: 'elf',
    name: 'Терновый вихрь', type: 'active', iconPng: 'img/skills/elf/thorn_whirl.png',
    maxLevel: 5, minLevel: 10, cooldown: 5, fxAnim: 'melee', element: 'life',
    aoe: { kind: 'thorns', minTargets: 2 },
    levels: [
      { mpCost: 12, multiplier: 1.00, targets: 2, accReduction: 20, turns: 2 },
      { mpCost: 13, multiplier: 1.07, targets: 2, accReduction: 24, turns: 2 },
      { mpCost: 14, multiplier: 1.15, targets: 3, accReduction: 27, turns: 2 },
      { mpCost: 15, multiplier: 1.22, targets: 3, accReduction: 31, turns: 2 },
      { mpCost: 16, multiplier: 1.30, targets: 3, accReduction: 35, turns: 2 },
    ],
    getDesc: (lvl) => { const d = SKILLS.thornWhirl.levels[lvl-1]; return `Бьёт ${aoeV(d.targets)} врагов на ${aoeX(d.multiplier)} и опутывает шипами на ${d.turns} хода: точность опутанных −${aoeV(d.accReduction + '%')}. <b>Комбо:</b> убил врага — бесплатное Дыхание природы (если выучено). Качает Жизнь. MP: ${aoeV(d.mpCost)}. КД: ${SKILLS.thornWhirl.cooldown}. С 10 уровня.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.thornWhirl.levels[lvl]; return `Следующий уровень: ${n.targets} цели, ×${n.multiplier.toFixed(2)}, точность −${n.accReduction}%`; },
  },

  lifeDrain: {
    id: 'lifeDrain', classId: 'mage', raceId: 'elf',
    name: 'Похищение жизни', type: 'active', iconPng: 'img/skills/elf/life_drain.png',
    maxLevel: 5, minLevel: 10, cooldown: 5, fxAnim: 'cast', element: 'life',
    aoe: { kind: 'drain', minTargets: 2, falloff: [1, 0.7, 0.5, 0.35] },
    healCdBonusPercent: 50,   // v0.19.1: пока Исцеление на перезарядке — урон +50%
    levels: [
      { mpCost: 16, multiplier: 2.00, targets: 3, healPercent: 10 },
      { mpCost: 17, multiplier: 2.15, targets: 3, healPercent: 12 },
      { mpCost: 19, multiplier: 2.30, targets: 3, healPercent: 15 },
      { mpCost: 20, multiplier: 2.45, targets: 3, healPercent: 17 },
      { mpCost: 22, multiplier: 2.60, targets: 4, healPercent: 20 },
    ],
    getDesc: (lvl) => { const d = SKILLS.lifeDrain.levels[lvl-1]; return `Пронзает ${aoeV(d.targets)} врагов по цепочке: ${aoeX(d.multiplier)} первому, дальше 70% / 50% / 35%. ${aoeV(d.healPercent + '%')} нанесённого урона лечат эльфа. <b>Комбо:</b> пока Исцеление на перезарядке — урон +50%. Качает Жизнь. MP: ${aoeV(d.mpCost)}. КД: ${SKILLS.lifeDrain.cooldown}. С 10 уровня.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.lifeDrain.levels[lvl]; return `Следующий уровень: ${n.targets} цели, ×${n.multiplier.toFixed(2)}, лечение ${n.healPercent}%`; },
  },

  // ========================================================
  //  ДРОУ — МОЛНИЯ (послабее остальных)
  // ========================================================
  sparkSlash: {
    id: 'sparkSlash', classId: 'warrior', raceId: 'drow',
    name: 'Искровой разрез', type: 'active', iconPng: 'img/skills/drow/spark_slash.png',
    maxLevel: 5, minLevel: 10, cooldown: 5, fxAnim: 'melee', element: 'lightning',
    aoe: { kind: 'spark', minTargets: 2 },
    levels: [
      { mpCost: 10, multiplier: 0.80, targets: 2, atbCut: 10 },
      { mpCost: 11, multiplier: 0.85, targets: 2, atbCut: 10 },
      { mpCost: 12, multiplier: 0.90, targets: 2, atbCut: 10 },
      { mpCost: 13, multiplier: 0.95, targets: 2, atbCut: 10 },
      { mpCost: 14, multiplier: 1.00, targets: 2, atbCut: 10 },
    ],
    getDesc: (lvl) => { const d = SKILLS.sparkSlash.levels[lvl-1]; return `Разрез с искрой: бьёт цель и ещё одного врага (всего ${aoeV(d.targets)}) на ${aoeX(d.multiplier)}, сбивает ATB стаи на ${aoeV(d.atbCut + '%')}. Качает Молнию. MP: ${aoeV(d.mpCost)}. КД: ${SKILLS.sparkSlash.cooldown}. С 10 уровня.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.sparkSlash.levels[lvl]; return `Следующий уровень: ×${n.multiplier.toFixed(2)}`; },
  },

  chainLightning: {
    id: 'chainLightning', classId: 'mage', raceId: 'drow',
    name: 'Цепная молния', type: 'active', iconPng: 'img/skills/drow/chain_lightning.png',
    maxLevel: 5, minLevel: 10, cooldown: 5, fxAnim: 'cast', element: 'lightning',
    aoe: { kind: 'chain', minTargets: 2, falloff: [1, 0.7, 0.49] },
    levels: [
      { mpCost: 14, multiplier: 1.60, targets: 2 },
      { mpCost: 15, multiplier: 1.70, targets: 2 },
      { mpCost: 17, multiplier: 1.80, targets: 3 },
      { mpCost: 18, multiplier: 1.90, targets: 3 },
      { mpCost: 20, multiplier: 2.00, targets: 3 },
    ],
    getDesc: (lvl) => { const d = SKILLS.chainLightning.levels[lvl-1]; return `Молния прыгает по ${aoeV(d.targets)} врагам: ${aoeX(d.multiplier)} первому, каждый прыжок −30%. Если в цепи есть враг, <b>парализованный</b> Разрядом, — молния не слабеет на прыжках. Паралич от Разряда сокращает её КД на 1. Цепной разум может сбросить ей перезарядку. Качает Молнию. MP: ${aoeV(d.mpCost)}. КД: ${SKILLS.chainLightning.cooldown}. С 10 уровня.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.chainLightning.levels[lvl]; return `Следующий уровень: ${n.targets} цели, ×${n.multiplier.toFixed(2)}`; },
  },

  // ========================================================
  //  ГНОМ — ЛЁД
  // ========================================================
  frostQuake: {
    id: 'frostQuake', classId: 'warrior', raceId: 'dwarf',
    name: 'Ледяной раскол', type: 'active', iconPng: 'img/skills/dwarf/frostQuake.png',
    maxLevel: 5, minLevel: 10, cooldown: 5, fxAnim: 'melee', element: 'ice',
    aoe: { kind: 'quake', minTargets: 2 },
    levels: [
      { mpCost: 12, multiplier: 0.60, targets: 5, freezeChance: 25 },
      { mpCost: 13, multiplier: 0.67, targets: 5, freezeChance: 30 },
      { mpCost: 14, multiplier: 0.75, targets: 5, freezeChance: 35 },
      { mpCost: 15, multiplier: 0.82, targets: 5, freezeChance: 40 },
      { mpCost: 16, multiplier: 0.90, targets: 5, freezeChance: 45 },
    ],
    getDesc: (lvl) => { const d = SKILLS.frostQuake.levels[lvl-1]; return `Удар молотом в землю: лёд бьёт всех врагов (до ${aoeV(d.targets)}) на ${aoeX(d.multiplier)} и с шансом ${aoeV(d.freezeChance + '%')} замораживает каждого (пропуск удара). <b>Комбо:</b> разносит Метки Жадности — все задетые получают столько меток, сколько у самого «жадного» врага. Качает Лёд. MP: ${aoeV(d.mpCost)}. КД: ${SKILLS.frostQuake.cooldown}. С 10 уровня.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.frostQuake.levels[lvl]; return `Следующий уровень: ×${n.multiplier.toFixed(2)}, заморозка ${n.freezeChance}%`; },
  },

  blizzardRune: {
    id: 'blizzardRune', classId: 'mage', raceId: 'dwarf',
    name: 'Руна вьюги', type: 'active', iconPng: 'img/skills/dwarf/blizzardRune.png',
    maxLevel: 5, minLevel: 10, cooldown: 5, fxAnim: 'cast', element: 'ice',
    aoe: { kind: 'rune', minTargets: 2 },
    levels: [
      { mpCost: 18, multiplier: 1.30, targets: 3, atbCut: 15 },
      { mpCost: 19, multiplier: 1.40, targets: 3, atbCut: 15 },
      { mpCost: 21, multiplier: 1.50, targets: 4, atbCut: 15 },
      { mpCost: 22, multiplier: 1.60, targets: 4, atbCut: 15 },
      { mpCost: 24, multiplier: 1.70, targets: 5, atbCut: 15 },
    ],
    getDesc: (lvl) => { const d = SKILLS.blizzardRune.levels[lvl-1]; return `Чертит руну, а на <b>следующий ход</b> на ${aoeV(d.targets)} врагов обрушивается буран: ${aoeX(d.multiplier)} каждому, ATB стаи −${aoeV(d.atbCut + '%')}. <b>Комбо:</b> буран разносит Метки Жадности на всех задетых. Качает Лёд. MP: ${aoeV(d.mpCost)}. КД: ${SKILLS.blizzardRune.cooldown}. С 10 уровня.`; },
    getNextDesc: (lvl) => { if (lvl >= 5) return ''; const n = SKILLS.blizzardRune.levels[lvl]; return `Следующий уровень: ${n.targets} цели, ×${n.multiplier.toFixed(2)}`; },
  },
};

Object.assign(SKILLS, SKILLS_AOE);
