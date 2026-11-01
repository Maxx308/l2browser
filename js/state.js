// ========================================================
//  СОСТОЯНИЕ ИГРЫ
//  + cheatRate (рейт чита).
//  + battle.debuffs — универсальные дебаффы.
//  + battle.killedByGreed / killedByGreedMagic — флаги «Жадности».
//  + player.quests — прогресс квестов (id → { stage }).
//  + player.stackCap — кап одинаковых предметов (0–15).
//  + player.skillSlots — 3 слота активных навыков в бою.
//
//  НОВОЕ (v0.11, групповые бои):
//  + battle.monsters — массив боевых мобов (вместо battle.monster).
//  + battle.monstersATB — общий ATB на группу.
//  + battle.debuffs.monsters — дебаффы по индексу моба.
//    { 0: { burn: {...} }, 1: { freeze: {...} }, ... }
//  + battle.monster — ОСТАЁТСЯ как алиас (см. helpers.js):
//    возвращает monsters[0] для обратной совместимости.
// ========================================================
const state = {
  player: {
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

    stopHpPercent:   0,
    stopMpPercent:   0,
    resumeHpPercent: 0,
    resumeMpPercent: 0,

    lootFilterLevel:  0,
    craftFilterLevel: 0,

    // Кап одинаковых предметов: 0 = без капа, 3 = по умолчанию.
    stackCap: 3,

    learnedSkills: {},
    skillPoints: 0,

    // ---- 3 слота активных навыков ----
    // Элементы: ID скилла (строка) или null (пусто).
    // Порядок срабатывания в бою: [0] → [1] → [2].
    skillSlots: [null, null, null],

    currentLocation: 'town',
    foodTimer: 0,
    foodTickAccum: 0,
    dish: null,          // v0.20: { id, timer } — активное блюдо
    guildBuffs: {},
    tavernBuffs: {},
    weaponSkills: {},
    elements: {},
    monsterKills: {},

    // ---- КВЕСТЫ ----
    // id → { stage: 'string' }
    quests: {},
  },
  battle: {
    active: false,
    monsters: [],              // ← массив боевых мобов (вместо monster)
    autoBattle: true,
    repeatBattle: false,
    playerATB: 0,
    monstersATB: 0,            // ← общий ATB на группу (вместо monsterATB)
    skillToggles: {},
    skillCooldowns: {},
    consumables: { healPotion: { enabled: true }, atkMixture: { enabled: true } },
    activeEffects: {
      healPotionUsed: false,
      mixture: null,
    },
    waitingForResume: false,
    waitingTemplate: null,

    // ---- Дебаффы ----
    // Для игрока: { burn: {...}, ... }
    // Для мобов: { 0: { burn: {...} }, 1: { freeze: {...} }, ... }
    debuffs: {
      monsters: {},            // ← вместо monster
      player:  {},
    },

    killedByGreed: false,
    killedByGreedMagic: false,

    monsterHpAnimating: false, // ← для анимации HP-полоски монстра
  },
  travel: { active: false, timer: 0, duration: 0, destination: null },
  regenAccumulator: 0,
  mpRegenAccumulator: 0,
  lastTick: performance.now(),
  cheat: false,
  currentArmorSetTab: 'all',
  currentJewelrySetTab: 'all',
  currentWeaponCategory: 'swords',
  currentInventoryPage: 0,
  activeSlotIndex: null,
};

// ========================================================
//  АЛИАС: state.battle.monster → первый живой моб
//  Нужен для совместимости со старым кодом,
//  который ещё не переделан на групповые бои.
//  Когда всё переделаем — этот алиас можно удалить.
// ========================================================
Object.defineProperty(state.battle, 'monster', {
  get() {
    return this.monsters.find(m => m.hp > 0) || null;
  },
  set(value) {
    // Если присваивают одного монстра — заменяем массив.
    // Если null — очищаем массив.
    if (value === null) {
      this.monsters = [];
    } else if (Array.isArray(value)) {
      this.monsters = value;
    } else {
      this.monsters = [value];
    }
  },
  configurable: true,
});

// ========================================================
//  АЛИАС: state.battle.monsterATB → monstersATB
// ========================================================
Object.defineProperty(state.battle, 'monsterATB', {
  get() {
    return this.monstersATB;
  },
  set(value) {
    this.monstersATB = value;
  },
  configurable: true,
});

// ========================================================
//  АЛИАС: state.battle.debuffs.monster → debuffs.monsters[0]
//  Старый код обращается к debuffs.monster (без индекса).
//  Пока мы не переделали debuffs.js — работает через первый моб.
// ========================================================
Object.defineProperty(state.battle.debuffs, 'monster', {
  get() {
    return this.monsters[0] || {};
  },
  set(value) {
    this.monsters[0] = value || {};
  },
  configurable: true,
});