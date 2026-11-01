// ========================================================
//  ДАННЫЕ: ТИПЫ ОРУЖИЯ
//  Определяем категорию оружия по его имени.
//
//  ШАГ 1: swords, axes.
//  ШАГ 2: maces (оглушение), daggers (крит).
//  ШАГ 3: bows (точный выстрел), crossbows (пробитие).
//  ШАГ 4: spears (стихия), staves (похищение души).
//  ШАГ 5: уворот и точность (L2 C4).
// ========================================================

function getWeaponCategory(itemName) {
  if (!itemName) return null;
  const n = itemName.toLowerCase();

  if (n.includes('кинжал') || n.includes('даггер')) return 'daggers';
  if (n.includes('клинок')) return 'daggers';

  if (n.includes('меч')) return 'swords';

  if (n.includes('топор') || n.includes('секира')) return 'axes';

  if (n.includes('копьё') || n.includes('копье') || n.includes('пика') || n.includes('глефа')) return 'spears';

  if (n.includes('лук') && !n.includes('луковица')) return 'bows';

  if (n.includes('арбалет')) return 'crossbows';

  if (n.includes('посох') || n.includes('жезл')) return 'staves';

  if (n.includes('дубин') || n.includes('булав') || n.includes('палка') || n.includes('палица')) return 'maces';

  return null;
}

// ========================================================
//  ФИШКИ ОРУЖИЯ ПО КАТЕГОРИЯМ
// ========================================================

// v0.19: у каждого типа есть «стиль боя» (см. battle-weapon-styles.js):
//   мечи — парирование, топоры — удар по двум целям, копья — пробой насквозь,
//   дубины — усиление массовых навыков, кинжалы — добивание,
//   луки — стреляют в самого раненого, арбалеты — всегда игнорируют часть брони.
const WEAPON_CATEGORY_TRAITS = {
  swords:    { bleedChance: 5, parryChance: 10 },         // Кровотечение + парирование 10%
  axes:      { woundChance: 5, cleaveMult: 0.70 },        // Зарубка + 2 цели по 70%
  maces:     { stunChance: 5, aoeSkillBonus: 30 },        // Оглушение + массовые навыки +30%
  daggers:   { critBonus: 8, executeBonus: 50, executeHpPercent: 30 }, // крит + добивание
  bows:      { preciseChance: 5, focusWounded: true },    // Точный выстрел + бьют самого раненого
  crossbows: { armorIgnore: 25 },                         // Всегда игнорируют 25% pDef (+1% за 5 ур. владения, макс 50%)

  // ШАГ 4:
  spears:    { elementChance: 5, elementBaseDamage: 3, pierceSecondMult: 0.40 }, // Стихия + пробой 40% по второму
  staves:    { soulSiphonChance: 5 },                     // Похищение души
};

// ========================================================
//  БОНУСЫ ОРУЖИЯ К ТОЧНОСТИ (L2 C4, округлено)
//  Дубины: +4
//  Мечи / Топоры / Посохи: 0
//  Кинжалы / Луки / Копья / Арбалеты: −4
// ========================================================

const WEAPON_ACCURACY_BONUS = {
  swords:    0,
  axes:      0,
  maces:     4,
  daggers:  -4,
  spears:   -4,
  bows:     -4,
  crossbows: -4,
  staves:    0,
};

// Возвращает бонус к точности для конкретной категории оружия.
function getWeaponAccuracyBonus(category) {
  if (!category) return 0;
  return WEAPON_ACCURACY_BONUS[category] || 0;
}

// ========================================================
//  v0.24: ОРУЖИЕ ТИРА 3 — шансы фишек типа +2%
//  Множители (удар по двум целям, добивание, массовые навыки) не меняются.
// ========================================================
const T3_TRAIT_BONUS = 2;
const T3_BOOSTED_TRAITS = {
  bleedChance:      'Кровотечение',
  parryChance:      'Парирование',
  woundChance:      'Зарубка',
  stunChance:       'Оглушение',
  critBonus:        'Крит',
  preciseChance:    'Точный выстрел',
  armorIgnore:      'Игнор брони',
  elementChance:    'Стихия',
  soulSiphonChance: 'Похищение души',
};

function getTierTraitBonus(item) {
  if (!item || typeof getItemTier !== 'function') return 0;
  return getItemTier(item) >= 3 ? T3_TRAIT_BONUS : 0;
}

// Текст для подсказки: «Зарубка +2%» и т.п. Пусто, если вещь не T3.
function getTierTraitBonusText(item) {
  const bonus = getTierTraitBonus(item);
  const category = item ? getWeaponCategory(item.name) : null;
  if (!bonus || !category) return '';
  const base = WEAPON_CATEGORY_TRAITS[category] || {};
  return Object.keys(T3_BOOSTED_TRAITS)
    .filter(key => base[key])
    .map(key => `${T3_BOOSTED_TRAITS[key]} +${bonus}%`)
    .join(', ');
}

// ========================================================
//  v0.27: ДВУРУЧНЫЙ ХВАТ — физ. навыки сильнее с двуручным оружием.
//  Плата за отказ от щита. Посохи (маги) — без хвата, это отдельная история.
// ========================================================
const TWO_HAND_GRIP_SKILL_BONUS = 10;

function isTwoHandGripWeapon(item) {
  return !!(item && item.type === 'weapon' && item.twoHanded && getWeaponCategory(item.name) !== 'staves');
}

// % к урону физических навыков (0, если хвата нет).
function getTwoHandGripBonus() {
  if (typeof isMage === 'function' && isMage()) return 0;
  return isTwoHandGripWeapon(state.player.equipment.weapon) ? TWO_HAND_GRIP_SKILL_BONUS : 0;
}

// ========================================================
//  v0.27: СТОЙКА ЩИТА — со щитом весь входящий урон меньше
//  (физика, магия, стихия монстра, яд). Работает всегда, не только при блоке.
// ========================================================
const SHIELD_STANCE_DAMAGE_CUT = 8;

function getShieldStanceMult() {
  return getEquippedShield() ? 1 - SHIELD_STANCE_DAMAGE_CUT / 100 : 1;
}

// ========================================================
//  v0.27: ПАРНОЕ ОРУЖИЕ (только воины)
//  Вторая рука — тот же слот, что и щит (equipment.shield):
//  там лежит либо щит, либо одноручное оружие.
//  Обычная атака: + DUAL_WIELD_OFFHAND_PERCENT% атаки второй руки.
//  Навыки — только основной рукой. Фишки второй руки — с половинным шансом.
//  Скорость атаки (ATB) +15%. Штраф: точность −2, уворот −4.
//  Владение качается только основной рукой.
//  Цифры подобраны симуляцией боёв (было 40% / −4 / −6 без скорости — стиль проигрывал всем).
// ========================================================
const DUAL_WIELD_CATEGORIES = ['swords', 'axes', 'daggers', 'maces'];
const DUAL_WIELD_OFFHAND_PERCENT = 40;
const DUAL_WIELD_TRAIT_MULT = 0.5;
const DUAL_WIELD_ATB_BONUS = 15;
const DUAL_WIELD_ACCURACY_PENALTY = 2;
const DUAL_WIELD_EVASION_PENALTY = 4;

// v0.27: «Свободная рука» — воин с одноручным оружием и пустой левой рукой уворачивается лучше.
// Ниша уворотчика: сильнее щита против магии и яда (по симуляции).
const FREE_HAND_EVASION_BONUS = 8;

function hasFreeHandStyle() {
  const p = state.player;
  if (typeof isMage === 'function' && isMage()) return false;
  const w = p.equipment.weapon;
  return !!(w && !w.twoHanded && !p.equipment.shield);
}

// Можно ли взять это оружие во вторую руку.
function canDualWield(item) {
  return !!(item && item.type === 'weapon' && !item.twoHanded &&
    DUAL_WIELD_CATEGORIES.includes(getWeaponCategory(item.name)));
}

function getEquippedShield() {
  const s = state.player.equipment.shield;
  return s && s.type === 'shield' ? s : null;
}

function getOffhandWeapon() {
  const s = state.player.equipment.shield;
  return s && s.type === 'weapon' ? s : null;
}

// Атака второй руки, которая добавляется к обычному удару.
function getOffhandPAtk() {
  const off = getOffhandWeapon();
  if (!off || (typeof isMage === 'function' && isMage())) return 0;
  return Math.floor(getItemStat(off, 'pAtk') * DUAL_WIELD_OFFHAND_PERCENT / 100);
}

// ========================================================
//  ПОЛУЧИТЬ ФИШКИ ДЛЯ КОНКРЕТНОГО ОРУЖИЯ
// ========================================================
function getWeaponTraits(itemName) {
  const category = getWeaponCategory(itemName);
  if (!category) return {};

  const base = WEAPON_CATEGORY_TRAITS[category] || {};

  // v0.27: и для оружия во второй руке (бонус тира 3 тоже)
  const main = state.player.equipment.weapon;
  const off = getOffhandWeapon();
  const item = (main && main.name === itemName) ? main : ((off && off.name === itemName) ? off : null);
  const isEquipped = !!item;
  const overrides = (isEquipped && item.traits) ? item.traits : {};
  const traits = { ...base, ...overrides };

  const bonus = isEquipped ? getTierTraitBonus(item) : 0;
  if (bonus) {
    Object.keys(T3_BOOSTED_TRAITS).forEach(key => {
      if (traits[key]) traits[key] += bonus;
    });
  }
  return traits;
}

// Фишки надетого оружия (с учётом тира).
function getEquippedWeaponTraits() {
  const w = state.player.equipment.weapon;
  return w ? getWeaponTraits(w.name) : {};
}

// ========================================================
//  РАСЧЁТ ИТОГОВОГО ШАНСА ФИШКИ
// ========================================================
function getTraitChance(baseChance, category) {
  if (!baseChance) return 0;
  const level = (typeof getWeaponSkillLevel === 'function')
    ? getWeaponSkillLevel(category)
    : 0;
  const bonus = Math.floor(level / 5);
  const total = baseChance + bonus;
  return Math.min(50, total);
}