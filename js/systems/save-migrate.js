// ========================================================
//  ДАННЫЕ: ВЕРСИЯ И МИГРАЦИЯ СОХРАНЕНИЙ
//  v0.36.3
//
//  Раньше каждое новое поле героя требовало ручной строки в
//  start-screen.js вида «у старого сейва поля нет — берём null»,
//  и забытая строка означала, что новому герою достаётся поле
//  предыдущего. Здесь это решается один раз: у сейва есть версия,
//  а все поля игрока перечислены в SAVE_PLAYER_DEFAULTS.
//
//  Как добавлять новое поле:
//    1) добавить в state.js (player) и в SAVE_PLAYER_DEFAULTS;
//    2) если поле меняет смысл у старых сейвов — SAVE_VERSION++ и
//       ветка в SAVE_MIGRATIONS.
//  Больше ничего править не нужно.
// ========================================================

const SAVE_VERSION = 1;

// Полная форма игрока. Ключ, которого нет в сейве, получает отсюда значение.
// Порядок и содержимое повторяют state.js — держать их в согласии.
const SAVE_PLAYER_DEFAULTS = {
  name: 'Воич', classId: null, raceId: null, level: 1, xp: 0, xpNext: 100,
  hp: 0, maxHp: 0, mp: 0, maxMp: 0,
  STR: 0, DEX: 0, CON: 0, INT: 0, WIT: 0, MEN: 0,
  gold: 1000,
  cheatRate: 1,
  inventory: [],
  equipment: {
    earring1: null, earring2: null, necklace: null,
    helmet: null, armorTop: null, armorBottom: null,
    gloves: null, boots: null,
    ring1: null, ring2: null,
    weapon: null, shield: null,
  },
  potionSlot: null,
  mixtureSlot: null,
  potionThreshold: 40,

  stopHpPercent: 0,
  stopMpPercent: 0,
  resumeHpPercent: 0,
  resumeMpPercent: 0,

  lootFilterLevel: 0,
  craftFilterLevel: 0,
  stackCap: 3,

  learnedSkills: {},
  skillPoints: 0,
  skillSlots: [null, null, null],

  currentLocation: 'town',
  foodTimer: 0,
  foodTickAccum: 0,
  foodKind: null,
  dish: null,
  guildBuffs: {},
  tavernBuffs: {},
  weaponSkills: {},
  elements: {},
  monsterKills: {},

  expedition: null,
  expeditionLoot: [],
  huntPace: {},
  huntVariant: {},

  quests: {},

  // Поля, которых нет в state.js (появились в разное время),
  // но которые обязаны быть «своими» у каждого героя.
  usedCheat: false,
  chronicle: null,
  bag: null,
  ilgradOpen: false,
  underwoodFallen: false,
  fallStage: null,
  fallBattle: null,
  breakthroughResult: 0,
  soulHuntCap: 0,
  hideProfile: false,
};

// Новые герои получают то же самое, что и старые сейвы без этих полей.
function saveClone(x) {
  if (x === null || typeof x !== 'object') return x;
  try { return JSON.parse(JSON.stringify(x)); } catch (e) { return Array.isArray(x) ? [] : {}; }
}

function saveIsPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

// Приведение типов: сейв мог прийти из старой версии, из облака или
// из-под чужого клиента. Ломать загрузку из-за одного поля нельзя.
function saveNormalizePlayer(p) {
  // объекты
  ['equipment', 'learnedSkills', 'weaponSkills', 'elements', 'monsterKills',
   'guildBuffs', 'tavernBuffs', 'quests', 'huntPace', 'huntVariant'].forEach(k => {
    if (!saveIsPlainObject(p[k])) p[k] = saveClone(SAVE_PLAYER_DEFAULTS[k]);
  });

  // экипировка: у старых сейвов нет части слотов (например, shield)
  SAVE_PLAYER_DEFAULTS.equipment && Object.keys(SAVE_PLAYER_DEFAULTS.equipment).forEach(slot => {
    if (!(slot in p.equipment)) p.equipment[slot] = null;
  });

  // массивы
  if (!Array.isArray(p.inventory)) p.inventory = [];
  if (!Array.isArray(p.expeditionLoot)) p.expeditionLoot = [];

  // три слота навыков
  if (!Array.isArray(p.skillSlots)) p.skillSlots = [null, null, null];
  while (p.skillSlots.length < 3) p.skillSlots.push(null);
  if (p.skillSlots.length > 3) p.skillSlots.length = 3;
  p.skillSlots = p.skillSlots.map(s => (typeof s === 'string' && s) ? s : null);

  // числа: не трогаем xpNext (там бывает Infinity, в JSON она приходит как null —
  // с ней разбирается loadSlotAndStart), остальные — защищаем от строк и NaN
  ['level', 'xp', 'hp', 'maxHp', 'mp', 'maxMp', 'STR', 'DEX', 'CON', 'INT',
   'WIT', 'MEN', 'gold', 'stackCap', 'cheatRate', 'skillPoints',
   'stopHpPercent', 'stopMpPercent', 'resumeHpPercent', 'resumeMpPercent',
   'lootFilterLevel', 'craftFilterLevel', 'potionThreshold',
   'breakthroughResult', 'soulHuntCap'].forEach(k => {
    const v = Number(p[k]);
    if (!Number.isFinite(v)) p[k] = saveClone(SAVE_PLAYER_DEFAULTS[k]);
    else p[k] = v;
  });

  // булевы
  ['usedCheat', 'ilgradOpen', 'underwoodFallen', 'hideProfile'].forEach(k => {
    p[k] = !!p[k];
  });

  if (typeof p.name !== 'string' || !p.name) p.name = SAVE_PLAYER_DEFAULTS.name;
  // пустая строка и нестрока — это «класс не выбран», иначе CLASSES[5] упадёт
  if (typeof p.classId !== 'string' || !p.classId) p.classId = null;
  if (typeof p.raceId !== 'string' || !p.raceId) p.raceId = null;
  if (typeof p.currentLocation !== 'string' || !p.currentLocation) p.currentLocation = 'town';
}

// Миграции по версиям. Ключ — версия, С КОТОРОЙ обновляемся.
// Пример на будущее:
//   1: (payload) => { payload.player.newField = 0; },
const SAVE_MIGRATIONS = {
  // 0 → 1: приведение к единой форме (поля, типы) — сама нормализация ниже.
};

// Приводит сейв к текущей версии. Возвращает тот же объект (меняет на месте).
function migrateSavePayload(payload) {
  if (!saveIsPlainObject(payload)) return payload;

  const from = Number(payload.v) || 0;
  if (from > SAVE_VERSION) {
    // Сейв новее клиента (закешированная старая вкладка). Не ломаем его:
    // читаем как есть, но предупреждаем — при сохранении новые поля пропадут.
    console.warn('[save] сейв версии ' + from + ' новее клиента (' + SAVE_VERSION + ')');
  }

  payload.player = saveIsPlainObject(payload.player) ? payload.player : {};

  // 1) недостающие поля — из дефолтов
  Object.keys(SAVE_PLAYER_DEFAULTS).forEach(k => {
    if (payload.player[k] === undefined) payload.player[k] = saveClone(SAVE_PLAYER_DEFAULTS[k]);
  });

  // 2) пошаговые миграции
  for (let v = from; v < SAVE_VERSION; v++) {
    const step = SAVE_MIGRATIONS[v];
    if (typeof step === 'function') {
      try { step(payload); } catch (e) { console.error('[save] миграция ' + v + '→' + (v + 1) + ':', e); }
    }
  }

  // 3) типы
  saveNormalizePlayer(payload.player);

  // 4) v0.36.3: пыль ÷10. Не по версии сейва, а по метке на каждой стопке —
  //    так безопасно при любом числе загрузок (см. migrateDustScale в alchemy.js).
  if (typeof migrateDustScale === 'function') {
    const n = migrateDustScale(payload.player.inventory);
    if (n > 0) Object.defineProperty(payload, '_dustRescaled', { value: n, enumerable: false });   // для сообщения игроку, в сейв не пишется
  }

  payload.v = SAVE_VERSION;
  return payload;
}
