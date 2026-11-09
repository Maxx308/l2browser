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
    hpMult: 1, mpMult: 1, atkMult: 1, xpMult: 1, dropMult: 1, goldMult: 1,
    pDefMult: 1, mDefMult: 1,
    traitChanceMult: 1.0,
    cssClass: 'variant-normal',
  },
  ancient: {
    id: 'ancient', name: 'Древний', prefix: 'Древний ',
    levelBonus: 1,
    hpMult: 2, mpMult: 2, atkMult: 1.5, xpMult: 2, dropMult: 3, goldMult: 2,   // v0.25: Оболы ×HP (было 1.5)
    pDefMult: 1.5, mDefMult: 1.5,
    traitChanceMult: 1.375,
    cssClass: 'variant-ancient',
  },
  bloody: {
    id: 'bloody', name: 'Кровавый', prefix: 'Кровавый ',
    levelBonus: 2,
    hpMult: 4, mpMult: 4, atkMult: 2.5, xpMult: 5, dropMult: 10, goldMult: 4,   // v0.25: Оболы ×HP (было 3)
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
    tags: ['insect', 'weaver'],
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
    tags: ['wood', 'lumbering', 'roots', 'steadfast'],
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
    tags: ['human', 'flesh', 'coward', 'thief', 'grudge'],
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
    tags: ['amphibian', 'stench', 'venomous'],
    hp: 100, mp: 40, mpCost: 2,  // v0.36: мана и щит (battle-monster-kit.js); часть здоровья ушла в ману
    atk: 17, xpReward: 1, attackType: 'magic',
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
    tags: ['beast', 'flesh', 'packmind', 'savage', 'swift'],
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
//  v0.33: Уровни: Гоблин 7, Кобольд 9, Арахнид 11, Пещерный крылан 13, Каменный голем 15
//  (было 6 / 7 / 8 / — / 10). С подтипами («Кровавый» +2) — до 17: к 20 ур. герой уходит
//  в новую локацию, а не перерастает Копи на 10 уровней.
//  Уровень монстра — это опыт за убийство (×3) и его точность / уворот. Атака и защита прежние,
//  Оболы — по формуле 0.15 + 0.01 × уровень за 1 HP, Голему +25% HP (иначе 15–20 ур. шли на треть быстрее).
//  Проверено симулятором (Claude outputs/Симулятор, results_v0.33_*).
//  Пещерный крылан (v0.33) — вместо шахт-заглушек: второй источник хитина и ядовитой железы
//  (их до этого давал только Арахнид, а железа нужна каждому оружию тира 3) и клыков
//  (раньше — только Волк на Поляне, 1%).
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
    id: 'goblin', name: 'Гоблин', level: 7,   // v0.33: было 6
    tags: ['flesh', 'scavenger', 'coward', 'thief'],
    hp: 176, atk: 26, xpReward: 2, attackType: 'physical',
    pDef: 28, mDef: 12,   // v0.20: было 46 — воины тоже могут фармить Копи
    goldMin: 40, goldMax: 60, goldChance: 80,   // v0.25: 0.21 Обола на 1 HP (было 30–60)
    art: 'img/monsters/goblin.jpg',
    drops: [
      { name: 'Медь', icon: 'img/materials/copper.png', chance: 5, type: 'material', sellPrice: 5 },
      // v0.20: Копи стали богаче (rare — редкие; подтипы и так дают дроп ×3 / ×10)
      { name: 'Уголь', icon: 'img/materials/coal.png', chance: 4, type: 'material', sellPrice: 3 },
      { name: 'Пещерный гриб', icon: 'img/materials/cave_mushroom.png', chance: 5, type: 'material', sellPrice: 4 },
      // v0.33: рубин теперь только из душ (souls.js); вместо него — гранат для поручения Хильды
      { name: 'Сырой гранат', icon: 'img/materials/raw_garnet.png', chance: 1, type: 'material', sellPrice: 25, rare: true },
    ],
  },
  {
    id: 'kobold', name: 'Кобольд', level: 9,   // v0.33: было 7
    tags: ['scaled', 'packmind', 'savage', 'formation'],
    pack: 'pack',   // v0.29: стайный
    hp: 270, atk: 22, xpReward: 2, attackType: 'physical',   // v0.33: HP 242 → 270 (стая на 9 ур. давала слишком много опыта)
    pDef: 31, mDef: 14,   // v0.20: было 52
    goldMin: 65, goldMax: 95, goldChance: 80,   // v0.33: 0.24 Обола на 1 HP — по новому уровню (было 50–80)
    art: 'img/monsters/kobold.jpg',
    drops: [
      { name: 'Олово', icon: 'img/materials/tin.png', chance: 5, type: 'material', sellPrice: 7 },
      { name: 'Руда железа', icon: 'img/materials/iron_ore.png', chance: 4, type: 'material', sellPrice: 3 },
      { name: 'Пещерный гриб', icon: 'img/materials/cave_mushroom.png', chance: 5, type: 'material', sellPrice: 4 },
      // v0.33: Сырой сапфир убран — теперь только из душ самоцветов (souls.js)
    ],
  },
  {
    id: 'arachnid', name: 'Арахнид', level: 11,   // v0.33: было 8
    tags: ['chitin', 'venomous', 'keen', 'sharp'],
    hp: 210, mp: 90, mpCost: 3,  // v0.36: мана и щит; часть здоровья ушла в ману (было 286 HP)
    atk: 28, xpReward: 2, attackType: 'magic',
    pDef: 32, mDef: 25,   // v0.20: было 43
    goldMin: 80, goldMax: 110, goldChance: 80,   // v0.33: 0.26 Обола на 1 HP — по новому уровню (было 70–100)
    art: 'img/monsters/arachnid.jpg',
    poison: true,
    drops: [
      { name: 'Хитин', icon: 'img/materials/chitin.png', chance: 5, type: 'material', sellPrice: 6 },
      { name: 'Нить', icon: 'img/materials/thread.png', chance: 15, type: 'material', sellPrice: 2 },
      { name: 'Паучий шёлк', icon: 'img/materials/spider_silk.png', chance: 3, type: 'material', sellPrice: 12, rare: true },
      { name: 'Ядовитая железа', icon: 'img/materials/venom_gland.png', chance: 1, type: 'material', sellPrice: 20, rare: true },
    ],
  },
  // v0.33: крылатая тварь с хитиновым панцирем — живёт под сводами штолен, нападает стаей сверху.
  {
    id: 'caveBat', name: 'Пещерный крылан', level: 13,
    tags: ['chitin', 'flying', 'packmind', 'keen', 'swift'],
    pack: 'pack',   // стая
    hp: 400, atk: 28, xpReward: 2, attackType: 'physical',
    pDef: 35, mDef: 20,
    goldMin: 120, goldMax: 160, goldChance: 80,   // 0.28 Обола на 1 HP (формула: 0.15 + 0.01 × уровень)
    art: 'img/monsters/cave_bat.jpg',
    traits: {
      bleedChance: 8,          // клыки-жвала: кровотечение, как у Волка
      bleedTurns: 3,
      bleedDamageDivisor: 6,
    },
    drops: [
      { name: 'Хитин', icon: 'img/materials/chitin.png', chance: 4, type: 'material', sellPrice: 6 },
      { name: 'Клык', icon: 'img/materials/fang.png', chance: 2, type: 'material', sellPrice: 8 },
      { name: 'Мясо', icon: 'img/materials/meat.png', chance: 5, type: 'material', sellPrice: 3 },   // v0.35.1: чтобы и в Копях было из чего готовить
      { name: 'Ядовитая железа', icon: 'img/materials/venom_gland.png', chance: 1, type: 'material', sellPrice: 20, rare: true },
    ],
  },
  {
    id: 'golem', name: 'Каменный голем', level: 15,   // v0.33: было 10
    tags: ['construct', 'stone', 'lumbering', 'steadfast', 'thickhide'],
    pack: 'solo',   // v0.29: одиночка
    hp: 580, atk: 32, xpReward: 2, attackType: 'physical',   // v0.33: HP 462 → 580 — 15 уровень даёт в 1.5 раза больше опыта
    pDef: 39, mDef: 18,   // v0.20: было 65
    goldMin: 170, goldMax: 240, goldChance: 85,   // v0.33: 0.30 Обола на 1 HP — по новому уровню (было 110–160)
    art: 'img/monsters/golem.jpg',
    drops: [
      { name: 'Каменные пластины', icon: 'img/materials/stone_plates.png', chance: 5, type: 'material', sellPrice: 8 },
      { name: 'Руда железа', icon: 'img/materials/iron_ore.png', chance: 6, type: 'material', sellPrice: 3 },
      { name: 'Ядро голема', icon: 'img/materials/golem_core.png', chance: 0.5, type: 'material', sellPrice: 60, rare: true },
    ],
  },
];

// ========================================================
//  v0.36: ОКРАИНЫ ИЛЬГРАДА — нежить 20–25 ур. (открываются вместе с Ильградом)
//  Оболы: 0.15 + 0.01 × уровень на 1 HP. Цифры — черновик, подгонять симулятором.
//  attackType: 'hybrid' — полумагический: каждый удар либо физический, либо магический (50/50).
//  Добычи пока нет: сделаем сразу как надо, вместе с тиром 4.
//  weapon / skill — скрытое оружие и навык героев: js/systems/battle-monster-kit.js.
// ========================================================
// v0.36: ТЕГИ ТВАРЕЙ. mods — проценты к урону героя по видам:
//   physical / magic, slash (мечи, топоры) / pierce (кинжалы, копья, луки, арбалеты) / blunt (дубины, посохи, без оружия), ranged (луки, арбалеты),
//   fire / ice / lightning / life / death, bleed. Сумма по всем тегам — от −40% до +50%.
//   Флаги: trueDodge — чистый шанс уворота, thorns — шипы, bleedImmune — не кровоточит, healHurts — лечение героя ранит. Логика — battle-monster-kit.js.
const MONSTER_TAGS = {
  nocturnal: { name: 'Ночной',     icon: 'img/tags/nocturnal.jpg', desc: 'выходит на охоту в темноте. Ночью стаи на 1 больше, а за бой приходит до 15' },
  diurnal:   { name: 'Дневной',    icon: 'img/tags/diurnal.jpg', desc: 'активен днём. Днём стаи на 1 больше, а за бой приходит до 15' },
  magic:     { name: 'Магия',      icon: 'img/tags/magic.jpg', desc: 'бьёт магией. Мана питает заклинания и щит: половина урона уходит в ману. Кончилась мана — щит лопнул, удары слабее и физические' },
  hybrid:    { name: 'Полумагия',  icon: 'img/tags/hybrid.jpg', desc: 'каждый удар случайно либо физический, либо магический' },
  dead:      { name: 'Мёртвый',    icon: 'img/tags/dead.jpg', desc: 'магия Смерти −10%, магия Жизни +20%, Исцеление мага ранит', healHurts: true, mods: { death: -10, life: 20 } },
  bone:      { name: 'Кость',      icon: 'img/tags/bone.jpg', desc: 'дробящее +20%, режущее и колющее −15%', mods: { blunt: 20, slash: -15, pierce: -15 } },
  flesh:     { name: 'Плоть',      icon: 'img/tags/flesh.jpg', desc: 'огонь +20%, режущее +10%', mods: { fire: 20, slash: 10 } },
  ethereal:  { name: 'Бесплотный', icon: 'img/tags/ethereal.jpg', desc: '15% ударов проходят насквозь (точность не помогает), физический урон −20%, магия +20%', trueDodge: 15, mods: { physical: -20, magic: 20 } },
  construct: { name: 'Конструкт',  icon: 'img/tags/construct.jpg', desc: 'не кровоточит, лёд +15%', bleedImmune: true, mods: { ice: 15 } },
  thorny:    { name: 'Шипы',       icon: 'img/tags/thorny.jpg', desc: 'ближний удар возвращается уроном: уровень твари минус поглощение героя', thorns: true },
  warrior:   { name: 'Воин',       icon: 'img/tags/warrior.jpg', desc: 'обученный боец' },
  beast:     { name: 'Зверь',      icon: 'img/tags/beast.jpg', desc: 'дикая тварь' },
  scavenger: { name: 'Падальщик',  icon: 'img/tags/scavenger.jpg', desc: 'рядом пала тварь — лечится на 10%, но сам хилее (здоровье −10%)', scavenge: true, hpPct: -10 },
  insect:    { name: 'Насекомое',  icon: 'img/tags/insect.jpg', desc: 'дробящее +15%, огонь +15%', mods: { blunt: 15, fire: 15 } },
  weaver:    { name: 'Ткач',       icon: 'img/tags/weaver.jpg', desc: 'оплетает паутиной: герой ходит реже' },
  wood:      { name: 'Древо',      icon: 'img/tags/wood.jpg', desc: 'огонь +25%, режущее +15%, колющее −15%, не кровоточит', bleedImmune: true, mods: { fire: 25, slash: 15, pierce: -15 } },
  human:     { name: 'Человек',    icon: 'img/tags/human.jpg', desc: 'колющее +10%', mods: { pierce: 10 } },
  amphibian: { name: 'Земноводное', icon: 'img/tags/amphibian.jpg', desc: 'колющее и дробящее +10%, молния +20%, огонь −15%', mods: { pierce: 10, blunt: 10, lightning: 20, fire: -15 } },
  cave:      { name: 'Подземный',  icon: 'img/tags/cave.jpg', desc: 'живёт в штольнях: день и ночь ему безразличны' },
  scaled:    { name: 'Чешуя',      icon: 'img/tags/scaled.jpg', desc: 'колющее +15% (бьёт между чешуй), лёд +20%', mods: { pierce: 15, ice: 20 } },
  chitin:    { name: 'Хитин',      icon: 'img/tags/chitin.jpg', desc: 'дробящее +20%, режущее и колющее −10%, огонь +10%', mods: { blunt: 20, slash: -10, pierce: -10, fire: 10 } },
  flying:    { name: 'Летун',      icon: 'img/tags/flying.jpg', desc: 'стрелы и болты +20%, режущее +15%: тонкие крылья', mods: { ranged: 20, slash: 15 } },
  stone:     { name: 'Камень',     icon: 'img/tags/stone.jpg', desc: 'дробящее +20%, режущее и колющее −10%', mods: { blunt: 20, slash: -10, pierce: -10 } },
  // Двусторонние: что-то дают твари и что-то забирают. Числа hpPct / atkPct / atbPct / evaPct уже вшиты в её статы.
  packmind:  { name: 'Стайный',    icon: 'img/tags/packmind.jpg', desc: '+6% урона за каждого живого сородича (до +24%), но один бьёт на 20% слабее', packBonus: true },
  savage:    { name: 'Свирепый',   icon: 'img/tags/savage.jpg', desc: 'ниже 30% здоровья атака +35%, но и урон по нему +15%', savage: true },
  swift:     { name: 'Стремительный', icon: 'img/tags/swift.jpg', desc: 'ходит на 15% чаще, но бьёт на 10% слабее', atbPct: 15, atkPct: -10 },
  lumbering: { name: 'Неповоротливый', icon: 'img/tags/lumbering.jpg', desc: 'ходит на 20% реже, но бьёт на 30% сильнее', atbPct: -20, atkPct: 30 },
  sharp:     { name: 'Острый',     icon: 'img/tags/sharp.jpg', desc: 'игнорирует 25% защиты героя, но физический урон по нему +10%', armorIgnore: 25, mods: { physical: 10 } },
  keen:      { name: 'Чуткий',     icon: 'img/tags/keen.jpg', desc: 'уворот героя −10%, но молния по нему +20%', heroEvaPct: -10, mods: { lightning: 20 } },
  stench:    { name: 'Смрад',      icon: 'img/tags/stench.jpg', desc: 'герой чаще промахивается, но огонь +20%: всё это хорошо горит', evaPct: 10, mods: { fire: 20 } },
  thickhide: { name: 'Толстокожий', icon: 'img/tags/thickhide.jpg', desc: 'урон по нему −15%, пока здоровье выше половины, но ходит на 10% реже', thick: true, atbPct: -10 },
  roots:     { name: 'Корни',      icon: 'img/tags/roots.jpg', desc: 'лечит 2% здоровья за ход, но огонь +25% и гасит лечение на 3 хода', roots: true, mods: { fire: 25 } },
  steadfast: { name: 'Непоколебимый', icon: 'img/tags/steadfast.jpg', desc: 'нельзя оглушить, зато по нему легче попасть', stunImmune: true, evaPct: -25 },
  venomous:  { name: 'Ядовитый',   icon: 'img/tags/venomous.jpg', desc: 'может отравить, но бьёт на 10% слабее', poison: true, atkPct: -10 },
  formation: { name: 'Строй',      icon: 'img/tags/formation.jpg', desc: 'пока рядом свои, физический урон по нему −15%; один — +15%', formation: true },
  undying:   { name: 'Неупокоенный', icon: 'img/tags/undying.jpg', desc: 'один раз переживает смертельный удар, но здоровья на 10% меньше', undying: true, hpPct: -10 },
  grudge:    { name: 'Злопамятный', icon: 'img/tags/grudge.jpg', desc: 'пал свой — атака +10% (до +30%), но поначалу бьёт на 10% слабее', grudge: true, atkPct: -10 },
  coward:    { name: 'Трус',       icon: 'img/tags/coward.jpg', desc: 'ниже 20% здоровья может сбежать без награды, зато бьёт на 10% слабее', coward: true, atkPct: -10 },
  thief:     { name: 'Вор',        icon: 'img/tags/thief.jpg', desc: 'может утащить Оболы; убьёшь — вернёт вдвое, сбежит — пропали', thief: true },
  wail:      { name: 'Плач',       icon: 'img/tags/wail.jpg', desc: 'каждый ход −3% маны героя, но бьёт на 15% слабее', wail: true, atkPct: -15 },
  siege:     { name: 'Осадный',    icon: 'img/tags/siege.jpg', desc: 'каждый третий удар двойной, остальные на 15% слабее', siege: true },
};

// Постоянные поправки от собственных тегов твари (подтипы и души умножают уже результат).
function monsterTagStats(template) {
  const fx = { hp: 1, atk: 1, atb: 1, eva: 1, heroEva: 1, armorIgnore: 0, poison: false, undying: false };
  (template.tags || []).forEach(id => {
    const t = MONSTER_TAGS[id];
    if (!t) return;
    if (t.hpPct) fx.hp *= 1 + t.hpPct / 100;
    if (t.atkPct) fx.atk *= 1 + t.atkPct / 100;
    if (t.atbPct) fx.atb *= 1 + t.atbPct / 100;
    if (t.evaPct) fx.eva *= 1 + t.evaPct / 100;
    if (t.heroEvaPct) fx.heroEva *= 1 + t.heroEvaPct / 100;
    if (t.armorIgnore) fx.armorIgnore += t.armorIgnore / 100;
    if (t.poison) fx.poison = true;
    if (t.undying) fx.undying = true;
  });
  return fx;
}

const OUTSKIRTS_MONSTERS = [
  {
    id: 'undeadMilitia', name: 'Ополченец', level: 20,   // скелет городского ополчения (подробнее — в будущей статье Бестиария)
    weapon: 'swords', skill: 'doubleStrike', tags: ['dead', 'bone', 'warrior', 'formation', 'undying'],
    pack: 'pack',   // строем: стража города, так и не сменившаяся с поста
    hp: 660, atk: 38, xpReward: 2, attackType: 'physical',
    pDef: 46, mDef: 22,   // кости: мечом плохо, магией легко
    goldMin: 210, goldMax: 250, goldChance: 85,
    art: 'img/monsters/undead_militia.jpg',
    drops: [],
  },
  {
    id: 'boneHound', name: 'Костяная гончая', level: 21,
    weapon: 'axes', skill: 'orcRage', tags: ['dead', 'bone', 'beast', 'thorny', 'packmind', 'savage', 'keen'],
    pack: 'pack',   // стая
    hp: 680, atk: 42, xpReward: 2, attackType: 'physical',
    pDef: 36, mDef: 26,
    goldMin: 220, goldMax: 270, goldChance: 85,
    art: 'img/monsters/bone_hound.jpg',
    drops: [],
  },
  {
    id: 'ghoul', name: 'Гуль', level: 22,
    weapon: 'daggers', skill: 'lifeDrain', tags: ['dead', 'flesh', 'scavenger', 'stench', 'roots', 'sharp'],
    hp: 820, atk: 44, xpReward: 2, attackType: 'physical',
    pDef: 40, mDef: 28,
    goldMin: 270, goldMax: 340, goldChance: 85,
    art: 'img/monsters/ghoul.jpg',
    drops: [],
  },
  {
    id: 'weeper', name: 'Плакальщица', level: 23,
    weapon: 'spears', skill: 'discharge', tags: ['dead', 'ethereal', 'wail', 'undying'],
    hp: 555, mp: 240, mpCost: 6,  // v0.36: мана и щит; часть здоровья ушла в ману (было 760 HP)
    atk: 46, xpReward: 2, attackType: 'magic',   // магический монстр локации
    pDef: 30, mDef: 44,
    goldMin: 260, goldMax: 320, goldChance: 85,
    art: 'img/monsters/weeper.jpg',
    drops: [],
  },
  {
    id: 'boneColossus', name: 'Костяной колосс', level: 25,
    weapon: 'maces', skill: 'whirlwind', tags: ['construct', 'bone', 'lumbering', 'steadfast', 'siege'],
    pack: 'solo',   // одиночка
    hp: 1150, atk: 52, xpReward: 2, attackType: 'hybrid',   // полумагический: то кулак, то разряд сердцевины
    pDef: 48, mDef: 34,
    goldMin: 410, goldMax: 510, goldChance: 85,
    art: 'img/monsters/bone_colossus.jpg',
    drops: [],
  },
];

// v0.36: все твари охоты — для поиска шаблона по id.
const ALL_HUNT_MONSTERS = [...MONSTERS, ...MINE_MONSTERS, ...OUTSKIRTS_MONSTERS];

// ========================================================
//  Сборка «готового» монстра для боя с учётом подтипа.
//  Уровень = базовый уровень монстра + levelBonus подтипа.
//  ОПЫТ = УРОВЕНЬ.
// ========================================================
function buildMonsterInstance(template, variantId) {
  const variant = MONSTER_VARIANTS[variantId] || MONSTER_VARIANTS.normal;
  const tagFx = monsterTagStats(template);
  const hp    = Math.floor(template.hp * variant.hpMult * tagFx.hp);
  const atk   = Math.floor(template.atk * variant.atkMult * tagFx.atk);
  let gmin  = Math.floor(template.goldMin * variant.goldMult);
  let gmax  = Math.floor(template.goldMax * variant.goldMult);
  // v0.25: в Копях Оболы круглые — до десятков (и в карточке, и в добыче)
  if (MINE_MONSTERS.includes(template) || OUTSKIRTS_MONSTERS.includes(template)) {
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
    mp: Math.floor((template.mp || 0) * (variant.mpMult || 1)),   // v0.36: мана магических тварей (0 — нет маны)
    maxMp: Math.floor((template.mp || 0) * (variant.mpMult || 1)),
    mpCost: template.mpCost || 0,
    pDef, mDef,
    attackType: template.attackType,
    xpReward: xp,
    goldMin: gmin, goldMax: gmax,
    goldChance: template.goldChance,
    drops,
    art: template.art,
    variantCssClass: variant.cssClass,
    poison: !!template.poison || tagFx.poison,
    atbMult: tagFx.atb, evaMult: tagFx.eva, heroEvaMult: tagFx.heroEva,
    armorIgnore: tagFx.armorIgnore, undying: tagFx.undying,
    weapon: template.weapon || null,   // v0.36: скрытое оружие и навык (battle-monster-kit.js)
    skill: template.skill || null,
    // v0.36: тег времени суток — первым (monsterTimeTag, daynight.js), потом свои
    // и тип атаки (Магия, Полумагия)
    tags: (() => {
      const attack = template.attackType === 'magic' ? 'magic' : template.attackType === 'hybrid' ? 'hybrid' : null;
      const list = [monsterTimeTag(template), attack, ...(template.tags || [])].filter(Boolean);
      return list.length ? list : null;
    })(),

    // ---- v0.12: traits монстра ----
    traits: (template.traits || template.weapon) ? { ...(template.traits || {}), ...(monsterWeaponTraits(template.weapon) || {}) } : null,
    traitChanceMult: variant.traitChanceMult || 1.0,
  };
}