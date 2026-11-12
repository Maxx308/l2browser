// ========================================================
//  ДАННЫЕ: ДУШИ САМОЦВЕТОВ (v0.33)
//
//  Иногда в бою попадается монстр с душой: в нём мерцает камень.
//  Монстр крепче (здоровье ×N, точность ×M), а убив его, герой забирает камень.
//  Камень распыляется у Алхимика в пыль своего цвета.
//
//  + Цвета — как у пыли: 🟢 изумруд, 🔵 сапфир, 🟣 аметист, 🟡 топаз, 🔴 рубин.
//  + Шанс — свой бросок у каждого монстра, в том числе у подмоги стаи
//    (в одной стае душ может быть несколько).
//  + Игрок сам выбирает, какие души искать: ряд камней над карточками монстров.
//    Зелёные включены всегда. Отключённые цвета просто не встречаются
//    (не превращаются в зелёные).
//  + Ступень камня зависит от локации: в Копях — «Сырые» (пыль как с вещи тира 3).
//    В следующей локации (нежить, крафт тира 4) будут камни получше — новая строка
//    в SOUL_LOCATIONS и новые имена в SOUL_GEM_ITEMS.
//  + Древний монстр с душой отдаёт 2 камня, Кровавый — 4 (по здоровью подтипа).
//  + Опыт и Оболы с монстра с душой — как с обычного: награда — камень.
//
//  Логика боя и ряд камней — js/systems/battle-souls.js.
// ========================================================

// Порядок цветов: от частых к редким.
const SOUL_ORDER = ['green', 'blue', 'purple', 'yellow', 'red'];

// chance — % на КАЖДОГО монстра (1 из 20 / 67 / 200 / 667 / 3333).
//   По симулятору v0.33 в Копях ~600 монстров в час (бот с «Провокатором»):
//   🟢 раз в ~2 мин, 🔵 ~7 мин, 🟣 ~20 мин, 🟡 ~1 ч, 🔴 ~6 ч. Живой игрок обычно медленнее.
// hpMult — во сколько раз больше здоровья, accMult — во сколько раз выше точность
// (не больше ×1.6: при ×2 монстр попадает всегда — потолок 95%).
const SOUL_TYPES = {
  green:  { id: 'green',  gem: 'изумруд', gemGen: 'изумруда', chance: 5,    hpMult: 2,  accMult: 1.2, color: '#80e080' },
  blue:   { id: 'blue',   gem: 'сапфир',  gemGen: 'сапфира',  chance: 1.5,  hpMult: 3,  accMult: 1.3, color: '#6a9ae0' },
  purple: { id: 'purple', gem: 'аметист', gemGen: 'аметиста', chance: 0.5,  hpMult: 5,  accMult: 1.4, color: '#c080ff' },
  yellow: { id: 'yellow', gem: 'топаз',   gemGen: 'топаза',   chance: 0.15, hpMult: 7,  accMult: 1.5, color: '#ffd040' },
  red:    { id: 'red',    gem: 'рубин',   gemGen: 'рубина',   chance: 0.03, hpMult: 10, accMult: 1.6, color: '#ff5050' },
};

// Где бывают души и какие камни там падают. Нет строки — души нет (Поляна).
const SOUL_LOCATIONS = {
  mine: { tier: 3, gems: {
    green:  'Сырой изумруд',
    blue:   'Сырой сапфир',
    purple: 'Сырой аметист',
    yellow: 'Сырой топаз',
    red:    'Сырой рубин',
  } },
  // v0.36: Окраины — пока те же Сырые камни; «улучшенные» (тир 4) появятся вместе с тиром 4.
  outskirts: { tier: 3, gems: {
    green:  'Сырой изумруд',
    blue:   'Сырой сапфир',
    purple: 'Сырой аметист',
    yellow: 'Сырой топаз',
    red:    'Сырой рубин',
  } },
};

// Камни как предметы. tier — как вещь какого тира распыляется.
const SOUL_GEM_ITEMS = {
  'Сырой изумруд': { color: 'green',  tier: 3, icon: 'img/materials/raw_emerald.webp',  sellPrice: 50 },
  'Сырой сапфир':  { color: 'blue',   tier: 3, icon: 'img/materials/raw_sapphire.webp', sellPrice: 100 },
  'Сырой аметист': { color: 'purple', tier: 3, icon: 'img/materials/raw_amethyst.webp', sellPrice: 150 },
  'Сырой топаз':   { color: 'yellow', tier: 3, icon: 'img/materials/raw_topaz.webp',    sellPrice: 250 },
  'Сырой рубин':   { color: 'red',    tier: 3, icon: 'img/materials/raw_ruby.webp',     sellPrice: 500 },
};

// Сколько камней с монстра с душой — по подтипу.
const SOUL_STONES_BY_VARIANT = { normal: 1, ancient: 2, bloody: 4 };

// До v0.33 рубин и сапфир падали с Гоблинов и Кобольдов как обычный материал.
// Такие камни (без метки soulGem) просто забираем — их у игроков тысячи.
const SOUL_RETIRED_NAMES = ['Сырой рубин', 'Сырой сапфир'];

// Старый камень из обычного дропа (до v0.33) — под изъятие.
function isRetiredGem(item) {
  return !!item && SOUL_RETIRED_NAMES.includes(item.name) && !item.soulGem;
}

// Описание камня души по предмету (null — не камень или старый камень под изъятие).
function getSoulGemDef(item) {
  if (!item || !item.name || isRetiredGem(item)) return null;
  return SOUL_GEM_ITEMS[item.name] || null;
}

// Убрать старые камни из списка предметов. Возвращает, сколько штук забрали.
function purgeRetiredGems(list) {
  if (!Array.isArray(list)) return 0;
  let n = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    if (isRetiredGem(list[i])) { n += list[i].qty || 1; list.splice(i, 1); }
  }
  return n;
}
