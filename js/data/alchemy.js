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

// Лимит пыли в одной стопке — и в сумке, и на складе.
// v0.29: было 1000 (лишнее молча пропадало) → 99 999.
const ALCHEMY_DUST_STACK_MAX = 99999;

// ========================================================
//  РАСПЫЛЕНИЕ: сколько пыли даёт предмет
//  пыль = база_тира × коэффициент_редкости × random(1..3)
//
//  База_тира: тир 1 = 1, тир 2 = 30, тир 3 = 100.
//  Коэффициент редкости: green=1, blue=2, purple=3, yellow=5, red=10.
//
//  Итог (min-max):
//    Тир 1: green 1-3,   blue 2-6,   purple 3-9,   yellow 5-15, red 10-30
//    Тир 2: green 30-90, blue 60-180, purple 90-270, yellow 150-450, red 300-900
//    Тир 3: green 100-300, blue 200-600, purple 300-900, yellow 500-1500, red 1000-3000
//    (v0.33: строки тиров 2–3 поправлены под формулу — раньше тут были старые цифры)
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
  // v0.33: камень души — пыль своего цвета, как с вещи своего тира (Сырые — тир 3)
  const gem = (typeof getSoulGemDef === 'function') ? getSoulGemDef(item) : null;
  const rarity = gem ? gem.color : item.rarity;
  if (!rarity || rarity === 'white') return null;

  const tier = gem ? gem.tier : (item.tier || 1);
  const base = ALCHEMY_TIER_BASE[tier] || ALCHEMY_TIER_BASE[1];
  const mult = ALCHEMY_RARITY_MULT[rarity] || 1;

  // Диапазон: 1-3 от базы × mult.
  const min = base * mult * 1;
  const max = base * mult * 3;
  const sample = Math.floor(min + Math.random() * (max - min + 1));

  return {
    color: rarity,          // green / blue / purple / yellow / red
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
// v0.26: очки = statPoints редкости (1/2/3/5/7).
// v0.32: группа статов — по классу героя (getRarityStatProfile), 30% очков уходит в чужую группу.
function rollNewBonusStats(item) {
  if (!item || !item.rarity || item.rarity === 'white') return {};
  const points = getRarityPointsForReroll(item.rarity);
  if (points <= 0) return {};
  return rollRarityStats(points, getRarityStatProfile(item));
}

// ========================================================
//  ВОЗВЫШЕНИЕ (v0.29): редкость +1 ступень за пыль ТЕКУЩЕГО цвета.
//  🟢→🔵 за зелёную, 🔵→🟣 за синюю, 🟣→🟡 за фиолетовую, 🟡→🔴 за жёлтую.
//
//  Цена = пыль от ALCHEMY_ASCEND_ITEMS распылённых предметов того же
//  тира и цвета (в среднем распыление даёт ×2 от базы):
//    цена = 5 × база_тира × коэффициент_редкости × 2
//
//    Тир 1: 10 / 20 / 30 / 50
//    Тир 2: 300 / 600 / 900 / 1500
//    Тир 3: 1000 / 2000 / 3000 / 5000
//
//  Бонусы сохраняются, добавляется разница очков (1 → 2 → 3 → 5 → 7).
//  Подгонка (+N) сохраняется. Можно и надетые вещи.
// ========================================================
const ALCHEMY_ASCEND_ITEMS = 5;

// Следующая редкость или null (белые и красные не возвышаются).
function getAscendTarget(item) {
  if (!item || !item.rarity || item.rarity === 'white') return null;
  const i = RARITY_ORDER.indexOf(item.rarity);
  if (i < 0 || i >= RARITY_ORDER.length - 1) return null;
  return RARITY_ORDER[i + 1];
}

function getAscendPrice(item) {
  if (!getAscendTarget(item)) return 0;
  const base = ALCHEMY_TIER_BASE[item.tier || 1] || ALCHEMY_TIER_BASE[1];
  const mult = ALCHEMY_RARITY_MULT[item.rarity] || 1;
  return ALCHEMY_ASCEND_ITEMS * base * mult * 2;
}

// ========================================================
//  ПЕРЕПЛАВКА ПЫЛИ (v0.34.1): 4 пыли → 1 пыль следующего цвета.
//  🟢→🔵, 🔵→🟣, 🟣→🟡. В красную не переплавляется: жёлтая — самая дефицитная
//  (на возвышение 🟡→🔴), а красная нужна только на переролл красных вещей.
//  По симулятору без переплавки зелёной/синей/фиолетовой копилось по 99 999, а жёлтой не хватало.
// ========================================================
const ALCHEMY_SMELT_RATE = 4;
const ALCHEMY_SMELT_STEPS = [['green', 'blue'], ['blue', 'purple'], ['purple', 'yellow']];

// Сколько пыли следующего цвета можно получить сейчас (с учётом лимита стопки).
function getSmeltMax(from, to) {
  if (typeof getDustCount !== 'function') return 0;
  const byHave = Math.floor(getDustCount(from) / ALCHEMY_SMELT_RATE);
  const room = Math.max(0, ALCHEMY_DUST_STACK_MAX - getDustCount(to));
  return Math.min(byHave, room);
}

// Сколько очков статов добавит возвышение (разница statPoints).
function getAscendExtraPoints(item) {
  const to = getAscendTarget(item);
  if (!to) return 0;
  return Math.max(0, getRarityPointsForReroll(to) - getRarityPointsForReroll(item.rarity));
}