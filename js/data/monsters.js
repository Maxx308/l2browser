// ========================================================
//  ДАННЫЕ МОНСТРОВ
//  Портреты — img/monsters/*.jpg
//  У каждого монстра 3 подтипа: normal / ancient / bloody.
//  Новые монстры Копи: kobold, goblin, arachnid, golem.
//  Шахты (mine_1, mine_2, mine_3) — не монстры, а заглушки.
//
//  + ЗАЩИТА: у монстров теперь есть pDef и mDef.
//  + ДРОП: сет «Потрёпанный» — дропается с монстров Поляны.
//  + PNG-ИКОНКИ МАТЕРИАЛОВ (img/materials/).
//
//  НОВОЕ (v0.05):
//  + У Бандита убрана «Палка», добавлен «Уголь» (5%).
//  + Всем монстрам Поляны +5 к физической защите (pDef).
//  + Уровни Поляны: Шелк 1, Энт 2, Бандит 3, Жаба 4, Волк 5.
//  + Подтипы сдвигают уровень: normal +0, ancient +1, bloody +2.
//
//  НОВОЕ (v0.06):
//  + Монстры Копи: уровни 6/7/8/10, HP +10%, pDef +30%.
//  + ОПЫТ = УРОВЕНЬ МОНСТРА (с учётом подтипа).
//
//  НОВОЕ (v0.07):
//  + ТИР 1 у всех дроп-предметов (сет, кольца, серьги, палка).
//
//  НОВОЕ (v0.12):
//  + У монстров Поляны появились фишки (traits):
//    Шелкопряд — паутина (web, замедление ATB игрока),
//    Энт       — оглушение (stun, пропуск удара),
//    Бандит    — крит ×2 урона,
//    Жаба      — стихийный урон (+30% от атаки, огонь/лёд/молния),
//    Волк      — кровотечение (bleed, floor(hit_damage/6) за ход, 3 хода).
//  + Монстрам Копи фишки НЕ давали — их трогать не будем.
//  + Подтипы усиливают шанс фишки:
//      обычный:  ×1.0   (8%)
//      древний:  ×1.375 (11%)
//      кровавый: ×1.875 (15%)
//
//  НОВОЕ (v0.12b):
//  + Дроп монстров Копи полностью переработан.
//    Убраны старые материалы (Кожа, Кости, Нить, Ткань, Клей, Палка).
//    Оставлены только Оболы + уникальный ресурс каждого монстра:
//      Гоблин  — Медь (5%)
//      Кобольд — Олово (5%)
//      Арахнид — Хитин (5%)
//      Голем   — Каменные пластины (5%)
//    Шанс подтипами умножается автоматически: ×1 / ×3 / ×10.
//  + Новые иконки — SVG (copper, tin, chitin, stonePlates в icons.js).
//
//  НОВОЕ (v0.12c):
//  + Ювелирка, падающая с Жабы, переведена с SVG на PNG:
//    img/jewelry/ring.png, necklace.png, earring.png.
//    (Сет «Новичок» уже был на PNG — см. recipes.js.)
//
//  НОВОЕ (v0.12d):
//  + Материалы Копи переведены с SVG на PNG:
//    img/materials/copper.png, tin.png, chitin.png, stone_plates.png.
//
//  НОВОЕ (v0.29):
//  + pack — характер монстра: 'solo' (одиночка) / 'pack' (стайный).
//    Не указан — обычный. Правила стай — в battle-pack.js.
// ========================================================

// Подтипы: общие множители.
const MONSTER_VARIANTS = {
  normal: {
    id: 'normal', name: '',         prefix: '',
    levelBonus: 0,
    hpMult: 1, atkMult: 1, xpMult: 1, dropMult: 1, goldMult: 1,
    pDefMult: 1, mDefMult: 1,
    traitChanceMult: 1.0,
    cssClass: 'variant-normal',
  },
  ancient: {
    id: 'ancient', name: 'Древний', prefix: 'Древний ',
    levelBonus: 1,
    hpMult: 2, atkMult: 1.5, xpMult: 2, dropMult: 3, goldMult: 2,   // v0.25: Оболы ×HP (было 1.5)
    pDefMult: 1.5, mDefMult: 1.5,
    traitChanceMult: 1.375,
    cssClass: 'variant-ancient',
  },
  bloody: {
    id: 'bloody', name: 'Кровавый', prefix: 'Кровавый ',
    levelBonus: 2,
    hpMult: 4, atkMult: 2.5, xpMult: 5, dropMult: 10, goldMult: 4,   // v0.25: Оболы ×HP (было 3)
    pDefMult: 2, mDefMult: 2,
    traitChanceMult: 1.875,
    cssClass: 'variant-bloody',
  },
};

// ========================================================
//  МОНСТРЫ ПОЛЯНЫ
//  Уровни: Шелк 1, Энт 2, Бандит 3, Жаба 4, Волк 5.
//  +5 к pDef у каждого.
//  Дроп-предметы: tier 1.
// ========================================================
const MONSTERS = [
  {
    id: 'silkworm', name: 'Шелкопряд', level: 1,
    hp: 45, atk: 5, xpReward: 1, attackType: 'physical',
    pDef: 17, mDef: 6,
    goldMin: 15, goldMax: 25, goldChance: 80,
    art: 'img/monsters/silkworm.jpg',
    traits: {
      webChance: 8,
      webTurns: 2,
      webAtbMult: 0.5,
    },
    drops: [
      { name: 'Нить', icon: 'img/materials/thread.png', chance: 30, type: 'material', sellPrice: 2 },

      // ---- СЕТ «ПОТРЁПАННЫЙ»: ШЛЕМ (тир 1) ----
      { name: 'Потрёпанный шлем', icon: 'img/armor/patched_helm.png',
        chance: 5, type: 'helmet', sellPrice: 8, tier: 1,
        stats: { pDef: 1, hpBonus: 7 },
        setId: 'patched' },
    ],
  },
  {
    id: 'ent', name: 'Энт', level: 2,
    pack: 'solo',   // v0.29: одиночка (battle-pack.js)
    hp: 70, atk: 9, xpReward: 1, attackType: 'physical',
    pDef: 25, mDef: 8,
    goldMin: 20, goldMax: 35, goldChance: 80,
    art: 'img/monsters/ent.jpg',
    traits: {
      stunChance: 8,
      stunTurns: 1,
    },
    drops: [
      { name: 'Ветвь', icon: 'img/materials/branch.png', chance: 5, type: 'material', sellPrice: 1 },
      { name: 'Руда железа', icon: 'img/materials/iron_ore.png', chance: 5, type: 'material', sellPrice: 3 },

      // ---- СЕТ «ПОТРЁПАННЫЙ»: ПЕРЧАТКИ (тир 1) ----
      { name: 'Потрёпанные перчатки', icon: 'img/armor/patched_gloves.png',
        chance: 5, type: 'gloves', sellPrice: 8, tier: 1,
        stats: { pDef: 1, hpBonus: 7 },
        setId: 'patched' },
    ],
  },
  {
    id: 'bandit', name: 'Бандит', level: 3,
    pack: 'pack',   // v0.29: банда
    night: true,    // v0.32: ночной (js/systems/daynight.js) — пока только значок
    hp: 95, atk: 13, xpReward: 1, attackType: 'physical',
    pDef: 33, mDef: 10,
    goldMin: 25, goldMax: 45, goldChance: 80,
    art: 'img/monsters/bandit.jpg',
    traits: {
      critChance: 8,
      critMult: 2.0,
    },
    drops: [
      // ---- УГОЛЬ ----
      { name: 'Уголь', icon: 'img/materials/coal.png', chance: 5, type: 'material', sellPrice: 3 },

      // ---- СЕТ «ПОТРЁПАННЫЙ»: ВЕРХ (тир 1) ----
      { name: 'Потрёпанная куртка', icon: 'img/armor/patched_top.png',
        chance: 10, type: 'armorTop', sellPrice: 12, tier: 1,
        stats: { pDef: 2 },
        setId: 'patched' },

      // ---- СЕТ «ПОТРЁПАННЫЙ»: НИЗ (тир 1) ----
      { name: 'Потрёпанные штаны', icon: 'img/armor/patched_bottom.png',
        chance: 10, type: 'armorBottom', sellPrice: 12, tier: 1,
        stats: { pDef: 2, mpBonus: 10 },
        setId: 'patched' },
    ],
  },
  {
    id: 'frog', name: 'Жаба', level: 4,
    night: true,    // v0.32: ночной — пока только значок
    hp: 130, atk: 17, xpReward: 1, attackType: 'magic',
    pDef: 27, mDef: 18,
    goldMin: 30, goldMax: 50, goldChance: 80,
    art: 'img/monsters/frog.jpg',
    traits: {
      elementChance: 8,
      elementBonusPercent: 30,
    },
    drops: [
      { name: 'Жабья шкура', icon: 'img/materials/frog.png', chance: 5, type: 'material', sellPrice: 4 },

      // ---- ЮВЕЛИРКА (v0.12c): PNG ----
      { name: 'Кольцо', icon: 'img/jewelry/ring.png', chance: 2, type: 'ring', sellPrice: 20, tier: 1, stats: { mDef: 1 } },
      { name: 'Амулет', icon: 'img/jewelry/necklace.png', chance: 2, type: 'necklace', sellPrice: 20, tier: 1, stats: { mDef: 1 } },
      { name: 'Серьга', icon: 'img/jewelry/earring.png', chance: 2, type: 'earring', sellPrice: 20, tier: 1, stats: { mDef: 1 } },
    ],
  },
  {
    id: 'wolf', name: 'Волк', level: 5,
    pack: 'pack',   // v0.29: стайный
    night: true,    // v0.32: ночной — пока только значок
    hp: 170, atk: 18, xpReward: 1, attackType: 'physical',
    pDef: 35, mDef: 12,
    goldMin: 32, goldMax: 53, goldChance: 80,
    art: 'img/monsters/wolf.jpg',
    traits: {
      bleedChance: 8,
      bleedTurns: 3,
      bleedDamageDivisor: 6,
    },
    drops: [
      { name: 'Шкура волка', icon: 'img/materials/pelt.png', chance: 5, type: 'material', sellPrice: 4 },
      { name: 'Кости', icon: 'img/materials/bone.png', chance: 10, type: 'material', sellPrice: 3 },
      { name: 'Мясо', icon: 'img/materials/meat.png', chance: 5, type: 'material', sellPrice: 3 },
      { name: 'Клык', icon: 'img/materials/fang.png', chance: 1, type: 'material', sellPrice: 8 },

      // ---- СЕТ «ПОТРЁПАННЫЙ»: БОТИНКИ (тир 1) ----
      { name: 'Потрёпанные ботинки', icon: 'img/armor/patched_boots.png',
        chance: 5, type: 'boots', sellPrice: 8, tier: 1,
        stats: { pDef: 1, hpBonus: 7 },
        setId: 'patched' },
    ],
  },
];

// ========================================================
//  МОНСТРЫ КОПИ
//  Уровни: Гоблин 6, Кобольд 7, Арахнид 8, Каменный голем 10.
//  HP +10% и pDef +30% — уже вписаны в поля.
//  Дроп-предметы: tier 1.
//  v0.12: фишки НЕ добавляли — Копи не трогали.
//
//  v0.12b: ДРОП ПОЛНОСТЬЮ ПЕРЕРАБОТАН.
//  Убран весь старый дроп (материалы, ювелирка, Палка).
//  Теперь каждый монстр дропает ОДИН уникальный ресурс с шансом 5%:
//    Гоблин  — Медь
//    Кобольд — Олово
//    Арахнид — Хитин
//    Голем   — Каменные пластины
//  Оболы — без изменений.
//  Подтипы умножают шанс автоматически: ×1 / ×3 / ×10.
//
//  v0.12d: ИКОНКИ — PNG (img/materials/).
// ========================================================
const MINE_MONSTERS = [
  {
    id: 'goblin', name: 'Гоблин', level: 6,
    hp: 176, atk: 26, xpReward: 2, attackType: 'physical',
    pDef: 28, mDef: 12,   // v0.20: было 46 — воины тоже могут фармить Копи
    goldMin: 40, goldMax: 60, goldChance: 80,   // v0.25: 0.21 Обола на 1 HP (было 30–60)
    art: 'img/monsters/goblin.jpg',
    drops: [
      { name: 'Медь', icon: 'img/materials/copper.png', chance: 5, type: 'material', sellPrice: 5 },
      // v0.20: Копи стали богаче (rare — редкие; подтипы и так дают дроп ×3 / ×10)
      { name: 'Уголь', icon: 'img/materials/coal.png', chance: 4, type: 'material', sellPrice: 3 },
      { name: 'Пещерный гриб', icon: 'img/materials/cave_mushroom.png', chance: 5, type: 'material', sellPrice: 4 },
      { name: 'Сырой рубин', icon: 'img/materials/raw_ruby.png', chance: 1, type: 'material', sellPrice: 25, rare: true },
    ],
  },
  {
    id: 'kobold', name: 'Кобольд', level: 7,
    pack: 'pack',   // v0.29: стайный
    hp: 242, atk: 22, xpReward: 2, attackType: 'physical',
    pDef: 31, mDef: 14,   // v0.20: было 52
    goldMin: 50, goldMax: 80, goldChance: 80,   // v0.25: 0.22 Обола на 1 HP (было 30–50)
    art: 'img/monsters/kobold.jpg',
    drops: [
      { name: 'Олово', icon: 'img/materials/tin.png', chance: 5, type: 'material', sellPrice: 7 },
      { name: 'Руда железа', icon: 'img/materials/iron_ore.png', chance: 4, type: 'material', sellPrice: 3 },
      { name: 'Пещерный гриб', icon: 'img/materials/cave_mushroom.png', chance: 5, type: 'material', sellPrice: 4 },
      { name: 'Сырой сапфир', icon: 'img/materials/raw_sapphire.png', chance: 1, type: 'material', sellPrice: 25, rare: true },
    ],
  },
  {
    id: 'arachnid', name: 'Арахнид', level: 8,
    hp: 286, atk: 28, xpReward: 2, attackType: 'magic',
    pDef: 32, mDef: 25,   // v0.20: было 43
    goldMin: 70, goldMax: 100, goldChance: 80,   // v0.25: 0.23 Обола на 1 HP (было 40–60)
    art: 'img/monsters/arachnid.jpg',
    poison: true,
    drops: [
      { name: 'Хитин', icon: 'img/materials/chitin.png', chance: 5, type: 'material', sellPrice: 6 },
      { name: 'Нить', icon: 'img/materials/thread.png', chance: 15, type: 'material', sellPrice: 2 },
      { name: 'Паучий шёлк', icon: 'img/materials/spider_silk.png', chance: 3, type: 'material', sellPrice: 12, rare: true },
      { name: 'Ядовитая железа', icon: 'img/materials/venom_gland.png', chance: 1, type: 'material', sellPrice: 20, rare: true },
    ],
  },
  {
    id: 'golem', name: 'Каменный голем', level: 10,
    pack: 'solo',   // v0.29: одиночка
    hp: 462, atk: 32, xpReward: 2, attackType: 'physical',
    pDef: 39, mDef: 18,   // v0.20: было 65
    goldMin: 110, goldMax: 160, goldChance: 85,   // v0.25: 0.25 Обола на 1 HP (было 50–90)
    art: 'img/monsters/golem.jpg',
    drops: [
      { name: 'Каменные пластины', icon: 'img/materials/stone_plates.png', chance: 5, type: 'material', sellPrice: 8 },
      { name: 'Руда железа', icon: 'img/materials/iron_ore.png', chance: 6, type: 'material', sellPrice: 3 },
      { name: 'Ядро голема', icon: 'img/materials/golem_core.png', chance: 0.5, type: 'material', sellPrice: 60, rare: true },
    ],
  },
];

// ========================================================
//  «ШАХТЫ» — три карточки-заглушки в Копи.
// ========================================================
const MINE_SHAFTS = [
  {
    id: 'mine_1',
    name: 'Шахта (снаружи)',
    desc: 'Верхние штольни. Тут пока пусто — скоро можно будет добывать руду.',
    art: 'img/monsters/ore.jpg',
  },
  {
    id: 'mine_2',
    name: 'Шахта (внутри)',
    desc: 'Средние штольни. Тут пока пусто — скоро можно будет добывать руду.',
    art: 'img/monsters/ore.jpg',
  },
  {
    id: 'mine_3',
    name: 'Шахта (в глубине)',
    desc: 'Глубокие штольни. Тут пока пусто — скоро можно будет добывать руду.',
    art: 'img/monsters/ore.jpg',
  },
];

// ========================================================
//  Сборка «готового» монстра для боя с учётом подтипа.
//  Уровень = базовый уровень монстра + levelBonus подтипа.
//  ОПЫТ = УРОВЕНЬ.
// ========================================================
function buildMonsterInstance(template, variantId) {
  const variant = MONSTER_VARIANTS[variantId] || MONSTER_VARIANTS.normal;
  const hp    = Math.floor(template.hp * variant.hpMult);
  const atk   = Math.floor(template.atk * variant.atkMult);
  let gmin  = Math.floor(template.goldMin * variant.goldMult);
  let gmax  = Math.floor(template.goldMax * variant.goldMult);
  // v0.25: в Копях Оболы круглые — до десятков (и в карточке, и в добыче)
  if (MINE_MONSTERS.includes(template)) {
    gmin = Math.max(10, Math.round(gmin / 10) * 10);
    gmax = Math.max(gmin, Math.round(gmax / 10) * 10);
  }

  const pDef  = Math.floor((template.pDef || 0) * variant.pDefMult);
  const mDef  = Math.floor((template.mDef || 0) * variant.mDefMult);

  // Уровень = базовый + сдвиг подтипа.
  const level = (template.level || 1) + (variant.levelBonus || 0);

  // ОПЫТ = УРОВЕНЬ.
  const xp = level;

  const drops = template.drops.map(d => ({
    ...d,
    // v0.21: без округления вниз — иначе редкий дроп 0.5% (Ядро голема) у обычного голема был 0
    chance: Math.round(d.chance * variant.dropMult * 100) / 100,
  }));

  return {
    id: template.id,
    variantId: variant.id,
    name: (variant.prefix + template.name).trim(),
    level: level,
    hp, maxHp: hp, atk,
    pDef, mDef,
    attackType: template.attackType,
    xpReward: xp,
    goldMin: gmin, goldMax: gmax,
    goldChance: template.goldChance,
    drops,
    art: template.art,
    variantCssClass: variant.cssClass,
    poison: !!template.poison,

    // ---- v0.12: traits монстра ----
    traits: template.traits ? { ...template.traits } : null,
    traitChanceMult: variant.traitChanceMult || 1.0,
  };
}