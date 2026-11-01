// ========================================================
//  ДАННЫЕ: АЛХИМИЯ
//  Распыление предметов → пыль.
//  Переролл характеристик (bonusStats).
//
//  НОВОЕ (v0.10).
// ========================================================

// 5 типов пыли — по одному на каждую редкость (кроме white).
// rarity — к какому цвету относится пыль.
// Ключ используется в state.player.inventory (name = 'Зелёная пыль' и т.д.).
const ALCHEMY_DUST = {
  green:  { id: 'green',  name: 'Зелёная пыль',      rarity: 'green',  color: '#80e080', icon: 'dustGreen' },
  blue:   { id: 'blue',   name: 'Синяя пыль',        rarity: 'blue',   color: '#6a9ae0', icon: 'dustBlue' },
  purple: { id: 'purple', name: 'Фиолетовая пыль',   rarity: 'purple', color: '#c080ff', icon: 'dustPurple' },
  yellow: { id: 'yellow', name: 'Жёлтая пыль',       rarity: 'yellow', color: '#ffd040', icon: 'dustYellow' },
  red:    { id: 'red',    name: 'Красная пыль',      rarity: 'red',    color: '#ff5050', icon: 'dustRed' },
};

// Порядок для UI.
const ALCHEMY_DUST_ORDER = ['green', 'blue', 'purple', 'yellow', 'red'];

// ========================================================
//  РАСПЫЛЕНИЕ: сколько пыли даёт предмет
//  пыль = база_тира × коэффициент_редкости × random(1..3)
//
//  База_тира: тир 1 = 1, тир 2 = 30, тир 3 = 100.
//  Коэффициент редкости: green=1, blue=2, purple=3, yellow=5, red=10.
//
//  Итог (min-max):
//    Тир 1: green 1-3,   blue 2-6,   purple 3-9,   yellow 5-15, red 10-30
//    Тир 2: green 30-50, blue 60-100, purple 90-150, yellow 150-250, red 300-500
//    Тир 3: green 100-200, blue 200-400, purple 300-600, yellow 500-1000, red 1000-2000
// ========================================================

const ALCHEMY_TIER_BASE = {
  1: 1,
  2: 30,
  3: 100,
};

const ALCHEMY_RARITY_MULT = {
  green:  1,
  blue:   2,
  purple: 3,
  yellow: 5,
  red:    10,
};

// Сколько пыли даёт распыление ОДНОГО предмета.
// Возвращает { color: 'green', min: N, max: M, sample: X }.
// sample — уже случайное число (можно использовать сразу).
function getDisenchantYield(item) {
  if (!item) return null;
  if (!item.rarity || item.rarity === 'white') return null;

  const tier = item.tier || 1;
  const base = ALCHEMY_TIER_BASE[tier] || ALCHEMY_TIER_BASE[1];
  const mult = ALCHEMY_RARITY_MULT[item.rarity] || 1;

  // Диапазон: 1-3 от базы × mult.
  const min = base * mult * 1;
  const max = base * mult * 3;
  const sample = Math.floor(min + Math.random() * (max - min + 1));

  return {
    color: item.rarity,     // green / blue / purple / yellow / red
    min, max, sample,
    tier,
    qtyMultiplier: item.qty || 1,
  };
}

// ========================================================
//  ПЕРЕРОЛЛ: цена и логика
//  Цена зависит ТОЛЬКО от тира (не от редкости!).
//  Но платится пылью ТОГО ЖЕ цвета, что и редкость предмета.
//
//  Тир 1 → 30 пыли.
//  Тир 2 → 150 пыли.
//  Тир 3 → 500 пыли.
// ========================================================

const ALCHEMY_REROLL_PRICE_BY_TIER = {
  1: 30,
  2: 150,
  3: 500,
};

function getRerollPrice(item) {
  if (!item) return 0;
  const tier = item.tier || 1;
  return ALCHEMY_REROLL_PRICE_BY_TIER[tier] || ALCHEMY_REROLL_PRICE_BY_TIER[1];
}

// Сумма очков bonusStats по редкости предмета.
function getRarityPointsForReroll(rarityId) {
  if (!rarityId || !RARITIES[rarityId]) return 0;
  return RARITIES[rarityId].statPoints;
}

// Возвращает НОВЫЙ объект bonusStats для предмета.
// Все старые значения сбрасываются.
// v0.26: очки = statPoints редкости (1/2/3/5/7), только в статы класса героя.
function rollNewBonusStats(item) {
  if (!item || !item.rarity || item.rarity === 'white') return {};
  const points = getRarityPointsForReroll(item.rarity);
  if (points <= 0) return {};
  return rollRarityStats(points, getRarityStatProfile(item));
}