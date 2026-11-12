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
//  пыль = база_тира × коэффициент_редкости × random(1..3), с округлением вверх
//
//  v0.36.3: ВСЯ пыль поделена на 10 (деноминация) — счёт шёл на миллионы.
//  База_тира: тир 1 = 0.1, тир 2 = 3, тир 3 = 10 (было 1 / 30 / 100).
//  Коэффициент редкости: green=1, blue=2, purple=3, yellow=5, red=10.
//
//  Итог (min-max):
//    Тир 1: любая цветная вещь — минимум 1 (green 1, blue 1, purple 1, yellow 1-2, red 1-3)
//    Тир 2: green 3-9,   blue 6-18,  purple 9-27,  yellow 15-45,  red 30-90
//    Тир 3: green 10-30, blue 20-60, purple 30-90, yellow 50-150, red 100-300
// ========================================================

const ALCHEMY_TIER_BASE = {
  1: 0.1,
  2: 3,
  3: 10,
};

// ========================================================
//  v0.37: ТИР 4 И ВЫШЕ — НА КАМНЯХ, А НЕ НА ПЫЛИ
//  Пыли тира 4 нет. Вещи тира 4 обслуживаются Огранёнными камнями своего цвета (souls.js):
//    распыление вещи      → 1 камень её цвета;
//    переролл             → 1 камень цвета вещи (зелёной — 2);
//    возвышение           → 5 камней текущего цвета;
//    переплавка камней    → 4 → 1 следующего цвета (до жёлтого), как у пыли.
//  Сами Огранённые камни не распыляются: они и есть плата.
// ========================================================
const ALCHEMY_GEM_TIER = 4;
const ALCHEMY_GEM_REROLL = { green: 2, blue: 1, purple: 1, yellow: 1, red: 1 };
const ALCHEMY_GEM_ASCEND = 5;

function isGemTier(tier) { return (tier || 1) >= ALCHEMY_GEM_TIER; }

// ---- v0.36.3: ДЕНОМИНАЦИЯ ЗАПАСОВ ----
// Каждая стопка пыли в новом масштабе помечена dustV = 2. Стопку без метки делим на 10
// (вверх) и помечаем — так пыль не поделится дважды, сколько бы раз ни грузились
// герой и общий облачный склад.
const DUST_SCALE_VERSION = 2;
const DUST_SCALE_DIVISOR = 10;
const DUST_ITEM_NAMES = new Set(Object.values(ALCHEMY_DUST).map(d => d.name));

function isDustItem(item) {
  return !!item && (item.isDust || DUST_ITEM_NAMES.has(item.name));
}

// Привести пыль в списке предметов к новому масштабу. Возвращает, сколько стопок поделили.
function migrateDustScale(list) {
  if (!Array.isArray(list)) return 0;
  let n = 0;
  list.forEach(item => {
    if (!isDustItem(item) || item.dustV === DUST_SCALE_VERSION) return;
    item.qty = Math.max(1, Math.ceil((Number(item.qty) || 1) / DUST_SCALE_DIVISOR));
    item.dustV = DUST_SCALE_VERSION;
    n++;
  });
  if (n > 0) compactDustStacks(list);
  return n;
}

// После деления стопки стали маленькими — сливаем пыль одного цвета в как можно меньше ячеек.
function compactDustStacks(list) {
  const firstByName = new Map();
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!isDustItem(item)) continue;
    const head = firstByName.get(item.name);
    if (!head) { firstByName.set(item.name, item); continue; }
    const add = Math.min(item.qty || 0, ALCHEMY_DUST_STACK_MAX - (head.qty || 0));
    head.qty += add;
    item.qty -= add;
    if (item.qty <= 0) { list.splice(i, 1); i--; }
    else firstByName.set(item.name, item);   // голова заполнена — дальше копим в эту
  }
}

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
  if (gem && gem.cut) return null;   // v0.37: Огранённый камень — плата, а не сырьё
  const rarity = gem ? gem.color : item.rarity;
  if (!rarity || rarity === 'white') return null;

  const tier = gem ? gem.tier : (item.tier || 1);
  // v0.37: вещь тира 4+ распыляется в 1 Огранённый камень своего цвета
  if (!gem && isGemTier(tier)) {
    const gemName = typeof getTierGemName === 'function' ? getTierGemName(tier, rarity) : null;
    if (!gemName) return null;
    return { color: rarity, gem: gemName, min: 1, max: 1, sample: 1, tier, qtyMultiplier: item.qty || 1 };
  }
  const base = ALCHEMY_TIER_BASE[tier] || ALCHEMY_TIER_BASE[1];
  const mult = ALCHEMY_RARITY_MULT[rarity] || 1;

  // Диапазон: 1-3 от базы × mult, вверх до целого (у тира 1 база 0.1 — иначе вышел бы 0).
  // Math.round внутри — от дробного хвоста вида 3.0000000000000004.
  const min = Math.ceil(Math.round(base * mult * 100) / 100);
  const max = Math.ceil(Math.round(base * mult * 3 * 100) / 100);
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
//  v0.36.3 (÷10): Тир 1 → 3, тир 2 → 15, тир 3 → 50 пыли (было 30 / 150 / 500).
// ========================================================

const ALCHEMY_REROLL_PRICE_BY_TIER = {
  1: 3,
  2: 15,
  3: 50,
};

// Цена в «единицах платы»: пыль для тиров 1–3, камни для 4+ (см. getAlchemyPay в alchemist.js).
function getRerollPrice(item) {
  if (!item) return 0;
  const tier = item.tier || 1;
  if (isGemTier(tier)) return ALCHEMY_GEM_REROLL[item.rarity] || 1;   // v0.37: красная — 1 рубин
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
//    v0.36.3 (÷10):
//    Тир 1: 1 / 2 / 3 / 5
//    Тир 2: 30 / 60 / 90 / 150
//    Тир 3: 100 / 200 / 300 / 500
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
  if (isGemTier(item.tier)) return ALCHEMY_GEM_ASCEND;   // v0.37: 5 камней текущего цвета
  const base = ALCHEMY_TIER_BASE[item.tier || 1] || ALCHEMY_TIER_BASE[1];
  const mult = ALCHEMY_RARITY_MULT[item.rarity] || 1;
  return Math.max(1, Math.round(ALCHEMY_ASCEND_ITEMS * base * mult * 2));   // round — база тира 1 дробная (0.1)
}

// ========================================================
//  ПЕРЕПЛАВКА ПЫЛИ (v0.34.1): 4 пыли → 1 пыль следующего цвета.
//  🟢→🔵, 🔵→🟣, 🟣→🟡. В красную не переплавляется: жёлтая — самая дефицитная
//  (на возвышение 🟡→🔴), а красная нужна только на переролл красных вещей.
//  По симулятору без переплавки зелёной/синей/фиолетовой копилось по 99 999, а жёлтой не хватало.
// ========================================================
const ALCHEMY_SMELT_RATE = 4;
const ALCHEMY_SMELT_STEPS = [['green', 'blue'], ['blue', 'purple'], ['purple', 'yellow']];

// Сколько пыли следующего цвета можно получить сейчас.
// v0.35.1: полная стопка начинает новую — упираемся только в ячейки сумки.
function getSmeltMax(from, to) {
  if (typeof getDustCount !== 'function') return 0;
  const byHave = Math.floor(getDustCount(from) / ALCHEMY_SMELT_RATE);
  // если исходная пыль уйдёт целиком, её ячейки освободятся (худший случай — не уйдёт)
  const room = typeof getDustRoom === 'function' ? getDustRoom(to) : Math.max(0, ALCHEMY_DUST_STACK_MAX - getDustCount(to));
  return Math.min(byHave, room);
}

// Сколько очков статов добавит возвышение (разница statPoints).
function getAscendExtraPoints(item) {
  const to = getAscendTarget(item);
  if (!to) return 0;
  return Math.max(0, getRarityPointsForReroll(to) - getRarityPointsForReroll(item.rarity));
}