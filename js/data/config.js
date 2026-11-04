// ========================================================
//  КОНСТАНТЫ ИГРЫ
//  Все настройки баланса в одном месте.
//
//  НОВОЕ (v0.10, балансировка опыта):
//  + getXpForLevel(level) — единая формула опыта.
//  + MAX_PLAYER_LEVEL = 20 — кап уровня.
//  + XP_MONSTER_MULTIPLIER = 3 — множитель опыта с монстра.
//
//  НОВОЕ (v0.12b):
//  + В ALL_RESOURCES добавлены 4 новых материала Копи:
//    Медь, Олово, Хитин, Каменные пластины.
//    Нужны для чит-меню (кнопка «+ресурсы»).
// ========================================================

// ==== ОБЩИЕ ====
const CHEAT_MULTIPLIER = 10;

// ==== МАНА ====
const MP_COST_PER_ATTACK = 5;
const MP_REGEN_BASE_OUT = 1;
const MP_REGEN_BASE_IN = 0.5;

// ==== ЕДА ====
// v0.26: еда ×2 (Жареное мясо 15 → 30 мин, блюда 30 мин → 1 ч).
const FOOD_DURATION = 30 * 60;
const FOOD_HEAL_PER_SEC = 1;

// ==== ОБЩИЙ ПОТОЛОК ДЛИТЕЛЬНОСТИ БАФФОВ ====
const MAX_BUFF_DURATION = 12 * 60 * 60;

// ==== v0.20: ЗЕЛЬЯ ЛЕЧЕНИЯ ====
// heal — сразу; hotPerTurn × hotTurns — на ходах героя (см. doPlayerTurn).
const POTION_HEAL = {
  healPotion:  { heal: 50 },
  healPotion2: { heal: 70, hotPerTurn: 10, hotTurns: 5 },
};

// ==== v0.20: БЛЮДА ====
// Блюдо даёт сытность (как любая еда) и бонус на DISH_DURATION.
// Одновременно действует одно блюдо: съел другое — бонус сменился,
// то же самое — время складывается (до MAX_BUFF_DURATION).
const DISH_DURATION = 60 * 60;

// Длительность еды берём по типу, а не из предмета: у старой еды в сумке записано старое время.
function getFoodDuration(item) {
  return item && item.food && item.food.dish ? DISH_DURATION : FOOD_DURATION;
}
const DISHES = {
  mushroomRoast: { name: 'Жаркое с грибами',      icon: '🍲', pAtkPercent: 5,     text: '+5% физ. атаки' },
  wolfStew:      { name: 'Похлёбка из волчатины', icon: '🥣', maxHpPercent: 5,    text: '+5% к макс. HP' },
  mushroomBrew:  { name: 'Грибной отвар',          icon: '🍵', mpRegenPercent: 15, text: '+15% регенерации маны' },
};

// ==== ТАВЕРНА ====
// v0.26: все баффы (Таверна и Гильдия) — 1 час за 2000 Оболов (было 15 мин за 1000).
const BUFF_DURATION = 60 * 60;
const BUFF_PRICE = 2000;
const TAVERN_BUFF_DURATION = BUFF_DURATION;
const TAVERN_BUFF_PRICE_BASE = BUFF_PRICE;
const TAVERN_XP_BONUS_PERCENT = 10;
const TAVERN_PROF_BONUS_PERCENT = 10;

// ==== МАГИЧЕСКИЕ ТРОПЫ (v0.26) ====
// Тропа есть везде, где можно пройти пешком, в обе стороны.
// Цена — от времени пути: 10 Оболов за секунду (30 сек = 300, 60 сек = 600).
// Новая локация: добавить время в TRAVEL_TIMES — цена посчитается сама.
const MAGIC_PATH_PRICE_PER_SECOND = 10;

// Цена тропы from → to, или null, если пути нет.
function getMagicPathPrice(from, to) {
  const t = TRAVEL_TIMES[`${from}->${to}`];
  return t === undefined ? null : t * MAGIC_PATH_PRICE_PER_SECOND;
}

// v0.26: свиток телепортации убран. Цена нужна только для возврата Оболов за старые свитки.
const TELEPORT_SCROLL_REFUND = 200;

// ==== ВРЕМЯ ПЕРЕХОДОВ ====
const TRAVEL_TIMES = {
  'town->field':  30,
  'field->town':  30,
  'field->mine':  30,
  'mine->field':  30,
  'town->mine':   60,
  'mine->town':   60,
};

// ==== НАЗВАНИЯ ЛОКАЦИЙ ====
const LOCATION_NAMES = {
  town:  'Город Андервуд',
  field: 'Зелёная поляна',
  mine:  'Копи',
};

// ==== v0.32: СУТКИ МИРА (js/systems/daynight.js) ====
// Сутки — WORLD_DAY_MIN минут по общим часам (UTC): у всех игроков одно и то же время.
// Фазы — по порядку, минуты от начала суток. Утро — первая, ночь — последняя (рассвет и закат плавные).
const WORLD_DAY_MIN = 120;
const WORLD_PHASES = [
  { id: 'morning', name: 'Утро',  icon: '🌅', from: 0,  to: 15 },
  { id: 'day',     name: 'День',  icon: '☀',  from: 15, to: 75 },
  { id: 'evening', name: 'Вечер', icon: '🌇', from: 75, to: 90 },
  { id: 'night',   name: 'Ночь',  icon: '🌙', from: 90, to: 120 },
];

// ==== МНОЖИТЕЛЬ СКОРОСТИ ATB ИГРОКА ПО ЛОКАЦИЯМ ====
const LOCATION_PLAYER_ATB_MULT = {
  town:  1.0,
  field: 1.0,
  mine:  0.85,
};

// ==== ЯД (Арахнид) ====
const POISON_CHANCE      = 90;
const POISON_DURATION    = 3;
const POISON_BASE_DAMAGE = 4;
const POISON_MAX_LEVEL   = 10;

// ==== НАВЫКИ ====
const MAX_SKILL_LEVEL = 5;

// ==== ВСЕ РЕСУРСЫ ====
// Используется в чит-меню (кнопка «+ресурсы»).
// v0.12b: добавлены 4 материала Копи.
const ALL_RESOURCES = [
  'Нить', 'Ткань', 'Клей', 'Ветвь', 'Руда железа', 'Кости',
  'Жабья шкура', 'Шкура волка', 'Мясо', 'Клык',
  'Кожа', 'Шкура', 'Уголь',
  // ---- НОВОЕ (v0.12b): материалы Копи ----
  'Медь', 'Олово', 'Хитин', 'Каменные пластины',
  // ---- v0.20: новые материалы Копи ----
  'Пещерный гриб', 'Сырой рубин', 'Сырой сапфир', 'Паучий шёлк', 'Ядовитая железа', 'Ядро голема',
];

// ========================================================
//  ОПЫТ И УРОВНИ (v0.10)
//
//  Формула: xpNext = 50 × уровень^2.5
//
//  Уровень 1 → 2:    50
//  Уровень 5 → 6:    2 795
//  Уровень 10 → 11:  15 811
//  Уровень 15 → 16:  43 301
//  Уровень 19 → 20:  77 942
//
//  Всего 1 → 20: ~465 000 опыта.
//
//  Опыт с монстра: уровень × XP_MONSTER_MULTIPLIER (×3).
//    Волк ур.5     → 15 опыта.
//    Голем ур.10   → 30 опыта.
//    Кровавый голем ур.12 → 36 опыта.
//
//  Максимальный уровень: 20.
//  Дальше — опыт не идёт, ждём новых локаций.
// ========================================================

const MAX_PLAYER_LEVEL = 20;
const XP_MONSTER_MULTIPLIER = 3;

// Сколько опыта нужно, чтобы перейти с (level-1) на level.
// level — целевой уровень (2, 3, ..., 20).
function getXpForLevel(level) {
  if (level <= 1) return 0;
  if (level > MAX_PLAYER_LEVEL) return Infinity;
  return Math.floor(50 * Math.pow(level, 2.5));
}

// Общий опыт, накопленный от 1 до level.
function getTotalXpForLevel(level) {
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += getXpForLevel(i);
  }
  return total;
}

// ========================================================
//  ТИР ПРЕДМЕТА (для подгонки)
// ========================================================

const MAX_TIER_REFINE = {
  1: 5,
  2: 10,
  3: 15,
  4: 20,
  5: 25,
};

const DEFAULT_ITEM_TIER = 1;

function getMaxRefine(tier) {
  const t = tier || DEFAULT_ITEM_TIER;
  return MAX_TIER_REFINE[t] || (t * 5);
}

function getItemTier(item) {
  if (!item) return DEFAULT_ITEM_TIER;
  return item.tier || DEFAULT_ITEM_TIER;
}

// ========================================================
//  ПОДГОНКА (REFINE)
// ========================================================

const REFINE_PRICE_BY_TIER = {
  1: 500,
  2: 2000,
  3: 5000,
  4: 20000,
  5: 50000,
};

const REFINE_CHANCE_STEP = 5;
const REFINE_CHANCE_DROP = 10;
const REFINE_CHANCE_MIN = 20;
const REFINE_CHANCE_START = 100;

function getRefineChance(level) {
  const nextLevel = (level || 0) + 1;
  const steps = Math.floor((nextLevel - 1) / REFINE_CHANCE_STEP);
  let chance = REFINE_CHANCE_START - steps * REFINE_CHANCE_DROP;
  if (chance < REFINE_CHANCE_MIN) chance = REFINE_CHANCE_MIN;
  return chance;
}

function getRefinePrice(tier) {
  const t = tier || DEFAULT_ITEM_TIER;
  return REFINE_PRICE_BY_TIER[t] || 500;
}

function isMilestoneLevel(level) {
  return level > 0 && level % 5 === 0;
}

function getMilestoneBonus(item, milestoneIndex) {
  const idx = milestoneIndex || 1;
  const type = item.type;

  if (type === 'weapon') {
    const wCat = (typeof getWeaponCategory === 'function') ? getWeaponCategory(item.name) : null;
    if (wCat === 'staves') {
      return { key: 'mAtkFlat', value: idx, label: `+${idx} Маг. атака (веха ${idx})` };
    }
    return { key: 'pAtkFlat', value: idx, label: `+${idx} Атака (веха ${idx})` };
  }
  if (type === 'shield' || type === 'helmet' || type === 'armorTop' ||
      type === 'armorBottom' || type === 'gloves' || type === 'boots') {
    return { key: 'pDefFlat', value: idx, label: `+${idx} Защита (веха ${idx})` };
  }
  if (type === 'ring' || type === 'earring' || type === 'necklace') {
    return getJewelryMilestoneBonus(item);
  }
  return { key: 'hpBonus', value: idx * 10, label: `+${idx * 10} HP (веха ${idx})` };
}

// ========================================================
//  v0.25: ВЕХИ БИЖУТЕРИИ — опыт и мастерство вместо маг. защиты
//  Каждая веха (+5 / +10 / +15) даёт одно и то же число:
//    ожерелье — опыт, кольцо — мастерство (владение оружием и стихиями),
//    серьга — опыт ИЛИ мастерство: тип выпадает на первой вехе
//    и дальше не меняется (item.msType = 'xp' | 'prof').
//  Ключи в refineBonuses: xpMsPercent / profMsPercent (подписываются «вехи»).
// ========================================================
const JEWELRY_MILESTONE_BY_TIER = {
  1: { necklace: 2, ring: 1,   earringXp: 1, earringProf: 0.5 },
  2: { necklace: 3, ring: 1.5, earringXp: 2, earringProf: 1 },
  3: { necklace: 5, ring: 2,   earringXp: 3, earringProf: 1 },
};

function getJewelryMilestoneValues(item) {
  const t = Math.min(3, Math.max(1, getItemTier(item)));
  return JEWELRY_MILESTONE_BY_TIER[t];
}

function getJewelryMilestoneBonus(item) {
  const v = getJewelryMilestoneValues(item);
  if (item.type === 'necklace') return { key: 'xpMsPercent', value: v.necklace, label: `+${v.necklace}% Опыт (веха)` };
  if (item.type === 'ring') return { key: 'profMsPercent', value: v.ring, label: `+${v.ring}% Мастерство (веха)` };
  if (!item.msType) item.msType = Math.random() < 0.5 ? 'xp' : 'prof';
  return item.msType === 'xp'
    ? { key: 'xpMsPercent', value: v.earringXp, label: `+${v.earringXp}% Опыт (веха)` }
    : { key: 'profMsPercent', value: v.earringProf, label: `+${v.earringProf}% Мастерство (веха)` };
}

// Старая бижутерия: вехи были маг. защитой (mDefFlat). Пересчитываем по новым правилам.
// Случайные бонусы подгонки не трогаем. Возвращает true, если предмет изменился.
function migrateJewelryMilestones(item) {
  if (!item || !item.refineBonuses || !item.refineBonuses.mDefFlat) return false;
  if (item.type !== 'ring' && item.type !== 'earring' && item.type !== 'necklace') return false;
  const rb = item.refineBonuses;
  delete rb.mDefFlat;
  const n = Math.floor((item.refineLevel || 0) / 5);
  for (let i = 1; i <= n; i++) {
    const b = getJewelryMilestoneBonus(item);
    rb[b.key] = Math.round(((rb[b.key] || 0) + b.value) * 10) / 10;
  }
  return true;
}

// ========================================================
//  v0.25: МИНИ-СЕТЫ БИЖУТЕРИИ — маг. защита за количество вещей
//  Считаются надетые кольца, серьги и ожерелье тира T и ВЫШЕ (малахит идёт и в тир 2).
//  Индекс — число вещей (2..5). Берётся лучший тир. Ступени не складываются.
// ========================================================
const JEWELRY_SLOTS = ['ring1', 'ring2', 'earring1', 'earring2', 'necklace'];
const JEWELRY_MINISET_MDEF = {
  1: [0, 0, 1, 2, 3, 4],
  2: [0, 0, 2, 3, 4, 6],
  3: [0, 0, 3, 4, 5, 7],
};

function countJewelryOfTier(equipment, tier) {
  return JEWELRY_SLOTS.filter(k => equipment[k] && getItemTier(equipment[k]) >= tier).length;
}

// Лучший мини-сет: { tier, count, bonus } или null.
function getJewelryMiniSet(equipment) {
  let best = null;
  Object.keys(JEWELRY_MINISET_MDEF).forEach(t => {
    const tier = Number(t);
    const count = countJewelryOfTier(equipment, tier);
    const bonus = JEWELRY_MINISET_MDEF[tier][count] || 0;
    if (bonus > 0 && (!best || bonus > best.bonus)) best = { tier, count, bonus };
  });
  return best;
}

function migrateJewelryList(list) {
  let changed = false;
  (list || []).forEach(it => { if (migrateJewelryMilestones(it)) changed = true; });
  return changed;
}

// v0.25: оружие из кузницы берёт базовые статы из текущего рецепта (после правок баланса
// старые вещи обновляются). Редкость и подгонка лежат отдельно и не трогаются.
const ITEM_BASE_STAT_KEYS = ['pAtk', 'pDef', 'mDef', 'mAtk', 'flatDamageReduce', 'blockChance', 'mpBonus', 'hpBonus', 'atbSpeedMod', 'critChance', 'mpRegenIn'];
// v0.27: и щиты тоже (блок по тиру).
function migrateWeaponBaseStats(item) {
  if (!item || (item.type !== 'weapon' && item.type !== 'shield') || typeof RECIPES === 'undefined') return false;
  const list = item.type === 'shield' ? RECIPES.shields : RECIPES.weapons;
  const recipe = (list || []).find(r => r.result && r.result.name === item.name);
  if (!recipe || !recipe.result.stats) return false;
  const fresh = {};
  ITEM_BASE_STAT_KEYS.forEach(k => { if (recipe.result.stats[k] !== undefined) fresh[k] = recipe.result.stats[k]; });
  if (JSON.stringify(fresh) === JSON.stringify(item.stats || {})) return false;
  item.stats = fresh;
  return true;
}
function migrateWeaponList(list) {
  let changed = false;
  (list || []).forEach(it => { if (migrateWeaponBaseStats(it)) changed = true; });
  return changed;
}

// ========================================================
//  v0.25: ПЛОСКИЕ БОНУСЫ ПОДГОНКИ РАСТУТ С ТИРОМ
//  HP/MP с уровнем растут, и «+10» на высоких тирах обесценивался.
//  Держим долю примерно постоянной: HP ~5% запаса, MP ~9% (мана растёт быстрее).
//  Новый тир — новая строка. Выше таблицы: HP +5, MP +20, реген +0.05 за тир.
// ========================================================
const REFINE_FLAT_BY_TIER = {
  1: { hp: 10, mp: 10, regen: 0.1 },
  2: { hp: 15, mp: 15, regen: 0.15 },
  3: { hp: 20, mp: 25, regen: 0.2 },
  4: { hp: 25, mp: 40, regen: 0.25 },
  5: { hp: 30, mp: 60, regen: 0.3 },
};
const REFINE_FLAT_VERSION = 2;   // item.refineFlatV — бонусы уже по таблице тиров

function getRefineFlatValues(tier) {
  const t = Math.max(1, tier || DEFAULT_ITEM_TIER);
  if (REFINE_FLAT_BY_TIER[t]) return REFINE_FLAT_BY_TIER[t];
  const tiers = Object.keys(REFINE_FLAT_BY_TIER).map(Number);
  const top = Math.max(...tiers);
  const last = REFINE_FLAT_BY_TIER[top];
  const n = t - top;
  return { hp: last.hp + 5 * n, mp: last.mp + 20 * n, regen: Math.round((last.regen + 0.05 * n) * 100) / 100 };
}

// Старые вещи: HP/MP/реген выпадали по 10 / 10 / 0.1 на любом тире.
// Число бросков = значение ÷ старый шаг → умножаем на значение своего тира. Возвращает true, если предмет изменился.
function migrateRefineFlatBonuses(item) {
  if (!item || !item.refineBonuses || (item.refineFlatV || 0) >= REFINE_FLAT_VERSION) return false;
  const rb = item.refineBonuses;
  const v = getRefineFlatValues(getItemTier(item));
  const rescale = (key, oldStep, newStep) => {
    if (!rb[key]) return false;
    const next = Math.round(Math.round(rb[key] / oldStep) * newStep * 100) / 100;
    if (next === rb[key]) return false;
    rb[key] = next;
    return true;
  };
  const changed = [
    rescale('hpBonus', 10, v.hp),
    rescale('mpBonus', 10, v.mp),
    rescale('hpRegenOutBonus', 0.1, v.regen),
    rescale('mpRegenOutBonus', 0.1, v.regen),
  ].some(Boolean);
  item.refineFlatV = REFINE_FLAT_VERSION;
  return changed;
}

function migrateRefineFlatList(list) {
  let changed = false;
  (list || []).forEach(it => { if (migrateRefineFlatBonuses(it)) changed = true; });
  return changed;
}

function getRefineBonusPool(item) {
  const v = getRefineFlatValues(getItemTier(item));
  const base = [
    { key: 'hpBonus',         value: v.hp,    label: `+${v.hp} HP` },
    { key: 'mpBonus',         value: v.mp,    label: `+${v.mp} MP` },
    { key: 'hpRegenOutBonus', value: v.regen, label: `+${v.regen} HP/сек` },
    { key: 'mpRegenOutBonus', value: v.regen, label: `+${v.regen} MP/сек` },
    { key: 'accuracyBonus',   value: 1,    label: '+1 Точность' },
    { key: 'evasionBonus',    value: 1,    label: '+1 Уворот' },
    { key: 'xpBonusPercent',  value: 1,    label: '+1% Опыт' },
    { key: 'profBonusPercent', value: 1,   label: '+1% Владение' },
    { key: 'goldBonusPercent', value: 1,   label: '+1% Оболы' },
    { key: 'dropBonusPercent', value: 1,   label: '+1% Дроп' },
  ];

  const type = item.type;
  if (type === 'weapon' || type === 'ring' || type === 'earring' || type === 'necklace') {
    base.push({ key: 'critBonus', value: 0.5, label: '+0.5% Крит' });
  }
  if (type === 'shield') {
    base.push({ key: 'blockBonus', value: 1, label: '+1% Блок' });
  }

  return base;
}

// ========================================================
//  РЕДКОСТЬ ПРЕДМЕТОВ
// ========================================================

const RARITIES = {
  white:  { id: 'white',  name: 'Обычное',     color: '#c8c0b0', colorGlow: 'rgba(200,192,176,0.5)', points: 0, statPoints: 0, statPercent: 0,  chance: 65,  cssClass: 'rarity-white' },
  green:  { id: 'green',  name: 'Необычное',   color: '#80e080', colorGlow: 'rgba(128,224,128,0.6)', points: 1, statPoints: 1, statPercent: 5,  chance: 22,  cssClass: 'rarity-green' },
  blue:   { id: 'blue',   name: 'Редкое',      color: '#6a9ae0', colorGlow: 'rgba(106,154,224,0.7)', points: 2, statPoints: 2, statPercent: 10, chance: 9,   cssClass: 'rarity-blue' },
  purple: { id: 'purple', name: 'Эпическое',   color: '#c080ff', colorGlow: 'rgba(192,128,255,0.75)', points: 3, statPoints: 3, statPercent: 18, chance: 3,   cssClass: 'rarity-purple' },
  yellow: { id: 'yellow', name: 'Легендарное', color: '#ffd040', colorGlow: 'rgba(255,208,64,0.85)', points: 4, statPoints: 5, statPercent: 28, chance: 0.9, cssClass: 'rarity-yellow' },
  red:    { id: 'red',    name: 'Мифическое',  color: '#ff5050', colorGlow: 'rgba(255,80,80,0.9)',   points: 5, statPoints: 7, statPercent: 40, chance: 0.1, cssClass: 'rarity-red' },
};
// v0.26: points — ранг редкости (фильтры), statPoints — сколько очков статов даёт (1/2/3/5/7),
// statPercent — надбавка к базовым статам предмета (RARITY_SCALED_STATS), минимум +1 к каждому.
const RARITY_SCALED_STATS = ['pAtk', 'mAtk', 'pDef', 'mDef', 'hpBonus', 'mpBonus'];

// Надбавка редкости к одному базовому стату предмета (0 у белых и у статов вне списка).
function getRarityStatBonus(item, stat) {
  const r = item && RARITIES[item.rarity];
  const base = item && item.stats ? item.stats[stat] : 0;
  if (!r || !r.statPercent || !base || base <= 0 || !RARITY_SCALED_STATS.includes(stat)) return 0;
  return Math.max(1, Math.round(base * r.statPercent / 100));
}

// Базовый стат предмета вместе с надбавкой редкости.
function getItemStat(item, stat) {
  const base = item && item.stats ? item.stats[stat] || 0 : 0;
  return base + getRarityStatBonus(item, stat);
}

// v0.32: «своя» группа статов — по КЛАССУ ГЕРОЯ, который выбил / выковал / перебросил вещь,
// а не по самой вещи (решение: воин получает в основном СИЛ/ЛОВ/ВЫН на любой вещи, маг — ИНТ/ДУХ/МДР).
// Без класса — все шесть статов поровну. item оставлен в подписи для совместимости вызовов.
function getRarityStatProfile(item) {
  const cls = state.player && state.player.classId;
  if (cls === 'mage') return 'magic';
  if (cls) return 'warrior';
  return 'neutral';
}

const RARITY_ORDER = ['white', 'green', 'blue', 'purple', 'yellow', 'red'];
const RARITY_STAT_POOL = ['STR', 'DEX', 'CON', 'INT', 'WIT', 'MEN'];
const RARITY_STATS_WARRIOR = ['STR', 'DEX', 'CON'];
const RARITY_STATS_MAGIC   = ['INT', 'WIT', 'MEN'];
// Шанс, что очко уйдёт в статы другой группы. Бросается отдельно на каждое очко:
// воину 70% — СИЛ/ЛОВ/ВЫН, 30% — ИНТ/ДУХ/МДР; магу наоборот. (v0.29.2 было 25%, v0.32 — 30%.)
const RARITY_OFFCLASS_CHANCE = 30;

// ========================================================
//  МИКСТУРЫ — КОНСТАНТЫ ЭФФЕКТОВ
// ========================================================

const MIXTURE_EFFECTS = {
  atkMixture: {
    id: 'atkMixture',
    name: 'Микстура атаки',
    atkPercent: 30,
    chargeType: 'playerAttacks',
    charges: 100,
    icon: 'potionAtk',
    desc: '+30% урона на 100 атак.',
  },
  atkMixture2: {
    id: 'atkMixture2',
    name: 'Микстура Атаки II',
    atkPercent: 50,
    chargeType: 'playerAttacks',
    charges: 100,
    icon: 'potionAtk2',
    desc: '+50% урона на 100 атак.',
  },
  luckMixture: {
    id: 'luckMixture',
    name: 'Микстура Удачи',
    luckPercent: 30,
    chargeType: 'battles',
    charges: 50,
    icon: 'potionLuck',
    desc: '+30% шанса дропа предметов (не Оболов) на 50 боёв. Складывается с титулами.',
  },
  defMixture: {
    id: 'defMixture',
    name: 'Микстура Крепости',
    defPercent: 30,
    chargeType: 'enemyAttacks',
    charges: 50,
    icon: 'potionDef',
    desc: '−30% физического урона от монстров на 50 их ударов. Магия и яд не режутся.',
  },
};

// ========================================================
//  ФОРМУЛЫ И ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ========================================================

function computeMpRegen(maxMp, inBattle) {
  const base = inBattle ? MP_REGEN_BASE_IN : MP_REGEN_BASE_OUT;
  const mult = 1 + Math.sqrt(maxMp / 100) * 0.3;
  return base * mult;
}

function computeMaxMp(MEN) {
  return Math.floor(30 + MEN * 2 + MEN * MEN * 0.15);
}

function addBuffTime(current, add) {
  return Math.min(MAX_BUFF_DURATION, current + add);
}

// Цена баффа таверны: фиксированная — 1000.
function getTavernBuffPrice() {
  return TAVERN_BUFF_PRICE_BASE;
}

// --------------------------------------------------------
//  РЕДКОСТЬ: вспомогательные функции
// --------------------------------------------------------

function rollRarity() {
  let total = 0;
  RARITY_ORDER.forEach(id => { total += RARITIES[id].chance; });
  let roll = Math.random() * total;
  for (const id of RARITY_ORDER) {
    const chance = RARITIES[id].chance;
    if (roll < chance) return id;
    roll -= chance;
  }
  return 'white';
}

function getItemStatProfile(item) {
  if (!item) return 'neutral';
  const stats = item.stats || {};

  const isMagic = (stats.mAtk > 0)
               || (stats.mpBonus > 0)
               || (item.setId === 'robe');

  const isWarrior = (stats.pAtk > 0)
                 || (stats.pDef > 0)
                 || (stats.flatDamageReduce > 0)
                 || (stats.blockChance > 0)
                 || (item.setId === 'gambeson');

  if (isMagic && !isWarrior) return 'magic';
  if (isWarrior && !isMagic) return 'warrior';
  return 'neutral';
}

function rollRarityStats(points, profile = 'neutral') {
  const bonus = {};
  if (!points || points <= 0) return bonus;

  // Каждое очко — свой бросок: с шансом RARITY_OFFCLASS_CHANCE уходит в чужую группу,
  // потом внутри группы — случайный из трёх статов.
  for (let i = 0; i < points; i++) {
    let group;
    const off = Math.random() * 100 < RARITY_OFFCLASS_CHANCE;
    if (profile === 'magic') group = off ? RARITY_STATS_WARRIOR : RARITY_STATS_MAGIC;
    else if (profile === 'warrior') group = off ? RARITY_STATS_MAGIC : RARITY_STATS_WARRIOR;
    else group = RARITY_STAT_POOL;

    const stat = group[Math.floor(Math.random() * group.length)];
    if (!bonus[stat]) bonus[stat] = 0;
    bonus[stat] += 1;
  }
  return bonus;
}

function formatRarityBonus(bonusStats) {
  if (!bonusStats) return '';
  const parts = [];
  Object.keys(bonusStats).forEach(stat => {
    if (bonusStats[stat] > 0) {
      parts.push(`+${bonusStats[stat]} ${stat}`);
    }
  });
  return parts.join(', ');
}