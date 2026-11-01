// ========================================================
//  ДАННЫЕ: КВЕСТЫ
//  Пока один — «Первые шаги».
//
//  Все стартовые оружия — ТИР 1 (точатся до +5).
//  PNG-иконки из img/weapons/starter/.
// ========================================================

const QUESTS = {
  firstSteps: {
    id: 'firstSteps',
    name: 'Первые шаги',
    desc: 'Старейшина Андервуда даёт новичку первые задания.',
    maxLevel: 2,
    stages: ['need_potion', 'need_mixture', 'need_weapon', 'done'],
  },
};

// ========================================================
//  СТАРТОВЫЕ ОРУЖИЯ (ТИР 1)
//  Выдаются по выбору в конце квеста «Первые шаги».
//  Все обычные (white), без бонусов.
// ========================================================

const STARTER_WEAPONS = {
  sword: {
    id: 'starterSword',
    name: 'Ржавый меч',
    type: 'weapon',
    icon: 'img/weapons/starter/sword.png',
    sellPrice: 3,
    tier: 1,
    stats: { pAtk: 4 },
  },
  axe: {
    id: 'starterAxe',
    name: 'Старый топор',
    type: 'weapon',
    icon: 'img/weapons/starter/axe.png',
    sellPrice: 3,
    tier: 1,
    stats: { pAtk: 4 },
  },
  club: {
    id: 'starterClub',
    name: 'Кривая дубина',
    type: 'weapon',
    icon: 'img/weapons/starter/club.png',
    sellPrice: 3,
    tier: 1,
    stats: { pAtk: 4 },
  },
  dagger: {
    id: 'starterDagger',
    name: 'Тусклый кинжал',
    type: 'weapon',
    icon: 'img/weapons/starter/dagger.png',
    sellPrice: 3,
    tier: 1,
    stats: { pAtk: 4 },
  },
  spear: {
    id: 'starterSpear',
    name: 'Треснувшее копьё',
    type: 'weapon',
    icon: 'img/weapons/starter/spear.png',
    sellPrice: 3,
    twoHanded: true,
    tier: 1,
    stats: { pAtk: 5 },   // v0.27: двуручное сильнее
  },
  bow: {
    id: 'starterBow',
    name: 'Кривой лук',
    type: 'weapon',
    icon: 'img/weapons/starter/bow.png',
    sellPrice: 3,
    twoHanded: true,
    tier: 1,
    stats: { pAtk: 5 },   // v0.27: двуручное сильнее
  },
  crossbow: {
    id: 'starterCrossbow',
    name: 'Хлипкий арбалет',
    type: 'weapon',
    icon: 'img/weapons/starter/crossbow.png',
    sellPrice: 3,
    twoHanded: true,
    tier: 1,
    stats: { pAtk: 5 },   // v0.27: двуручное сильнее
  },
  staff: {
    id: 'starterStaff',
    name: 'Сломанный посох',
    type: 'weapon',
    icon: 'img/weapons/starter/staff.png',
    sellPrice: 3,
    twoHanded: true,
    tier: 1,
    stats: { mAtk: 4, mpBonus: 5 },
  },
};