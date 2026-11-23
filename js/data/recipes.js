// ========================================================
//  СЕТЫ, РЕЦЕПТЫ КУЗНИЦЫ, ТОВАРЫ ТОРГОВЦА
//  Сет «Потрёпанный» — дропается с монстров Поляны.
//
//  PNG-ИКОНКИ МАТЕРИАЛОВ (img/materials/).
//
//  Платная кузница:
//  + У каждого рецепта поле price (в Оболах).
//  + resources (Ткань, Клей) — 100 оболов.
//  + Всё остальное (броня, оружие, щиты, ювелирка) — 1000 оболов.
//  + Жареное мясо — 100 оболов (v0.11).
//
//  НОВОЕ (v0.07):
//  + ТИР 2 у всех крафтовых вещей: броня, оружие, щиты, ювелирка.
//  + Ресурсы (Ткань, Клей) и еда (Жареное мясо) — БЕЗ тира.
//
//  НОВОЕ (v0.12):
//  + Ювелирка «Новичка» переведена с SVG на PNG:
//    img/jewelry/novice_ring.webp, novice_earring.png, novice_necklace.png.
//  + Кольца/серьги/амулеты, которые падают с монстров (Фрог, Арахнид),
//    остаются на SVG (iconKey: ring / earring / necklace).
//
//  НОВОЕ (v0.12e):
//  + Во вкладке «РЕСУРСЫ» добавлены 4 рецепта слитков:
//    Слиток железа  = 3 × Руда железа + 1 × Уголь.
//    Слиток меди    = 3 × Медь + 1 × Уголь.
//    Слиток олова   = 3 × Олово + 1 × Уголь.
//    Слиток бронзы  = 3 × Медь + 1 × Олово.
//    Все по 100 Оболов. Пока только для продажи (в другие рецепты
//    НЕ входят — добавим позже).
//  + Иконки слитков — PNG: img/materials/*_ingot.webp.
// ========================================================

// Сеты экипировки
const SETS = {
  gambeson: { name: 'Гамбезон', bonus: { atbSpeed: 0.07 }, bonusText: 'Скорость атаки +7%',
    pieces: ['Гамбезон (верх)', 'Гамбезон (низ)', 'Гамбезон (шлем)', 'Гамбезон (ботинки)', 'Гамбезон (перчатки)'] },
  robe: { name: 'Мантия ученика', bonus: { mAtkPercent: 5 }, bonusText: 'Магическая атака +5%',
    pieces: ['Мантия ученика (верх)', 'Мантия ученика (низ)', 'Мантия ученика (шлем)', 'Мантия ученика (ботинки)', 'Мантия ученика (перчатки)'] },
  // campHpRegen / campMpRegen — только на привале у костра (battle-rest.js — restCampBonus)
  novice: { name: 'Новичок', bonus: { maxHpFlat: 30, maxMpFlat: 30, campHpRegen: 1, campMpRegen: 1 }, bonusText: '+30 HP и +30 MP; у костра +1 HP/сек и +1 MP/сек',
    pieces: ['Кольцо Новичка', 'Серьга Новичка', 'Ожерелье Новичка'],
    isFullSetEquipped: function() {
      const p = state.player;
      return p.equipment.ring1?.name === 'Кольцо Новичка' &&
             p.equipment.ring2?.name === 'Кольцо Новичка' &&
             p.equipment.earring1?.name === 'Серьга Новичка' &&
             p.equipment.earring2?.name === 'Серьга Новичка' &&
             p.equipment.necklace?.name === 'Ожерелье Новичка';
    }
  },
  // ---- v0.21: ТИР 3 — броня из ресурсов Копей. Две ступени бонуса:
  //   bonus — полный комплект; bonus10 — все 5 частей подогнаны до +10 и выше.
  // v0.25: ступени по частям (2 / 3 / 4 вещи) — плоский урон к каждому удару навыков (и массовых),
  // к горению, кровотечению и Гниению; добавляется после всех надбавок. 5 вещей — прежний бонус сета.
  chain: { name: 'Кольчуга Копей', bonus: { flatDamageReduce: 3 }, bonusText: 'Поглощение урона +3',
    bonus10: { flatDamageReduce: 3 }, bonus10Text: 'ещё поглощение +3 (всего +6)',
    skillFlatTiers: { 2: 20, 3: 30, 4: 40 },
    pieces: ['Кольчуга Копей (верх)', 'Кольчуга Копей (низ)', 'Кольчуга Копей (шлем)', 'Кольчуга Копей (ботинки)', 'Кольчуга Копей (перчатки)'] },
  silk: { name: 'Шёлковая мантия', bonus: { mAtkPercent: 8 }, bonusText: 'Магическая атака +8%',
    bonus10: { manaShield: 40 }, bonus10Text: 'Мана-щит: 40% урона по вам списывается с MP',
    skillFlatTiers: { 2: 10, 3: 15, 4: 20 },
    pieces: ['Шёлковая мантия (верх)', 'Шёлковая мантия (низ)', 'Шёлковая мантия (шлем)', 'Шёлковая мантия (ботинки)', 'Шёлковая мантия (перчатки)'] },
  // ---- v0.25: ТИР 3 — бижутерия из ресурсов Копей (2 кольца, 2 серьги, ожерелье) ----
  malachite: { name: 'Малахитовые обереги', bonus: { hpRegenOutBonus: 1, mpRegenOutBonus: 1 }, bonusText: '+1 HP/сек и +1 MP/сек вне боя',
    pieces: ['Малахитовое кольцо', 'Малахитовая серьга', 'Малахитовое ожерелье'],
    isFullSetEquipped: function() {
      const e = state.player.equipment;
      return e.ring1?.name === 'Малахитовое кольцо' && e.ring2?.name === 'Малахитовое кольцо' &&
             e.earring1?.name === 'Малахитовая серьга' && e.earring2?.name === 'Малахитовая серьга' &&
             e.necklace?.name === 'Малахитовое ожерелье';
    }
  },
  patched: {
    name: 'Потрёпанный',
    bonus: { hpRegenOutBonus: 1, mpRegenOutBonus: 1 },   // было по 0.5
    bonusText: '+1 HP/сек и +1 MP/сек вне боя',
    pieces: [
      'Потрёпанная куртка',
      'Потрёпанные штаны',
      'Потрёпанный шлем',
      'Потрёпанные перчатки',
      'Потрёпанные ботинки',
    ],
  },
};

// v0.25: сколько частей сета надето (для ступеней 2 / 3 / 4).
function countSetPiecesWorn(set, equipment) {
  return Object.values(equipment || {}).filter(eq => eq && set.pieces.includes(eq.name)).length;
}
// Ступень, которая действует при n надетых частях (самая высокая, но не выше 4), или null.
function getSetSkillFlatTier(set, n) {
  if (!set || !set.skillFlatTiers) return null;
  const steps = Object.keys(set.skillFlatTiers).map(Number).filter(k => k <= n).sort((a, b) => b - a);
  return steps.length ? { pieces: steps[0], value: set.skillFlatTiers[steps[0]] } : null;
}
// Текст ступеней для подсказки и кузницы: «2 вещи: +20 · 3 вещи: +30 · 4 вещи: +40».
function formatSetSkillFlatTiers(set) {
  if (!set || !set.skillFlatTiers) return '';
  return Object.keys(set.skillFlatTiers).map(k => `${k} вещи: +${set.skillFlatTiers[k]}`).join(' · ');
}

// Константы цены крафта.
const CRAFT_PRICE_RESOURCE = 100;   // ресурсы
const CRAFT_PRICE_GEAR = 1000;      // снаряжение / ювелирка
const CRAFT_PRICE_GEAR_T3 = 5000;   // v0.21: снаряжение тира 3
const CRAFT_PRICE_GEAR_T4 = 12000;  // v0.37: снаряжение тира 4
const CRAFT_PRICE_RESOURCE_T4 = 300;   // v0.37: улучшенные материалы тира 4
const CRAFT_PRICE_FOOD = 100;
const CRAFT_PRICE_DISH = 150;      // v0.20: блюда       // еда (v0.11)
const CRAFT_PRICE_HEARTY = 200;    // v0.35.1: Сытное рагу
const CRAFT_PRICE_FEAST = 1000;    // v0.35.1: Охотничий пир — дорого
const CRAFT_PRICE_UKHA = 800;      // v0.35.1: Грибная уха — дорого

// Рецепты кузницы.
const RECIPES = {
  resources: [
    { id: 'fabric', name: 'Ткань', icon: 'img/materials/fabric.webp', price: CRAFT_PRICE_RESOURCE,
      result: { name: 'Ткань', icon: 'img/materials/fabric.webp', type: 'material', sellPrice: 8 },
      materials: [{ name: 'Нить', qty: 15 }] },

    { id: 'glue', name: 'Клей', icon: 'img/materials/glue.webp', price: CRAFT_PRICE_RESOURCE,
      result: { name: 'Клей', icon: 'img/materials/glue.webp', type: 'material', sellPrice: 6 },
      materials: [{ name: 'Кости', qty: 3 }] },

    // ---- НОВОЕ (v0.12e): ПЛАВКА СЛИТКОВ ----
    { id: 'ironIngot', name: 'Слиток железа', icon: 'img/materials/iron_ingot.webp', price: CRAFT_PRICE_RESOURCE,
      result: { name: 'Слиток железа', icon: 'img/materials/iron_ingot.webp', type: 'material', sellPrice: 25 },
      materials: [{ name: 'Руда железа', qty: 3 }, { name: 'Уголь', qty: 1 }] },

    { id: 'copperIngot', name: 'Слиток меди', icon: 'img/materials/copper_ingot.webp', price: CRAFT_PRICE_RESOURCE,
      result: { name: 'Слиток меди', icon: 'img/materials/copper_ingot.webp', type: 'material', sellPrice: 20 },
      materials: [{ name: 'Медь', qty: 3 }, { name: 'Уголь', qty: 1 }] },

    { id: 'tinIngot', name: 'Слиток олова', icon: 'img/materials/tin_ingot.webp', price: CRAFT_PRICE_RESOURCE,
      result: { name: 'Слиток олова', icon: 'img/materials/tin_ingot.webp', type: 'material', sellPrice: 22 },
      materials: [{ name: 'Олово', qty: 3 }, { name: 'Уголь', qty: 1 }] },

    { id: 'bronzeIngot', name: 'Слиток бронзы', icon: 'img/materials/bronze_ingot.webp', price: CRAFT_PRICE_RESOURCE,
      result: { name: 'Слиток бронзы', icon: 'img/materials/bronze_ingot.webp', type: 'material', sellPrice: 30 },
      materials: [{ name: 'Медь', qty: 3 }, { name: 'Олово', qty: 1 }] },
  ],
  armor: [
    // ---- ГАМБЕЗОН (воинский сет) — ТИР 2 ----
    { id: 'gambesonTop', name: 'Гамбезон (верх)', icon: 'img/armor/gambesonTop.webp', setId: 'gambeson', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Гамбезон (верх)', icon: 'img/armor/gambesonTop.webp', type: 'armorTop', sellPrice: 30,
        stats: { pDef: 8 }, setId: 'gambeson' },
      materials: [{ name: 'Ткань', qty: 5 }, { name: 'Клей', qty: 2 }] },

    { id: 'gambesonBottom', name: 'Гамбезон (низ)', icon: 'img/armor/gambesonBottom.webp', setId: 'gambeson', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Гамбезон (низ)', icon: 'img/armor/gambesonBottom.webp', type: 'armorBottom', sellPrice: 30,
        stats: { pDef: 8 }, setId: 'gambeson' },
      materials: [{ name: 'Ткань', qty: 5 }, { name: 'Клей', qty: 2 }] },

    { id: 'gambesonHelm', name: 'Гамбезон (шлем)', icon: 'img/armor/gambesonHelm.webp', setId: 'gambeson', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Гамбезон (шлем)', icon: 'img/armor/gambesonHelm.webp', type: 'helmet', sellPrice: 15,
        stats: { pDef: 3 }, setId: 'gambeson' },
      materials: [{ name: 'Ткань', qty: 2 }, { name: 'Клей', qty: 1 }] },

    { id: 'gambesonBoots', name: 'Гамбезон (ботинки)', icon: 'img/armor/gambesonBoots.webp', setId: 'gambeson', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Гамбезон (ботинки)', icon: 'img/armor/gambesonBoots.webp', type: 'boots', sellPrice: 15,
        stats: { pDef: 3 }, setId: 'gambeson' },
      materials: [{ name: 'Ткань', qty: 2 }, { name: 'Клей', qty: 1 }] },

    { id: 'gambesonGloves', name: 'Гамбезон (перчатки)', icon: 'img/armor/gambesonGloves.webp', setId: 'gambeson', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Гамбезон (перчатки)', icon: 'img/armor/gambesonGloves.webp', type: 'gloves', sellPrice: 15,
        stats: { pDef: 3 }, setId: 'gambeson' },
      materials: [{ name: 'Ткань', qty: 2 }, { name: 'Клей', qty: 1 }] },

    // ---- МАНТИЯ УЧЕНИКА (магический сет) — ТИР 2 ----
    { id: 'robeTop', name: 'Мантия ученика (верх)', icon: 'img/armor/robe_top.webp', setId: 'robe', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Мантия ученика (верх)', icon: 'img/armor/robe_top.webp', type: 'armorTop', sellPrice: 30,
        stats: { pDef: 3, mpBonus: 40 }, setId: 'robe' },
      materials: [{ name: 'Ткань', qty: 5 }, { name: 'Клей', qty: 2 }] },

    { id: 'robeBottom', name: 'Мантия ученика (низ)', icon: 'img/armor/robe_bottom.webp', setId: 'robe', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Мантия ученика (низ)', icon: 'img/armor/robe_bottom.webp', type: 'armorBottom', sellPrice: 30,
        stats: { pDef: 3, mpBonus: 40 }, setId: 'robe' },
      materials: [{ name: 'Ткань', qty: 5 }, { name: 'Клей', qty: 2 }] },

    { id: 'robeHelm', name: 'Мантия ученика (шлем)', icon: 'img/armor/robe_helm.webp', setId: 'robe', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Мантия ученика (шлем)', icon: 'img/armor/robe_helm.webp', type: 'helmet', sellPrice: 15,
        stats: { pDef: 1, mpBonus: 15 }, setId: 'robe' },
      materials: [{ name: 'Ткань', qty: 2 }, { name: 'Клей', qty: 1 }] },

    { id: 'robeBoots', name: 'Мантия ученика (ботинки)', icon: 'img/armor/robe_boots.webp', setId: 'robe', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Мантия ученика (ботинки)', icon: 'img/armor/robe_boots.webp', type: 'boots', sellPrice: 15,
        stats: { pDef: 1, mpBonus: 15 }, setId: 'robe' },
      materials: [{ name: 'Ткань', qty: 2 }, { name: 'Клей', qty: 1 }] },

    { id: 'robeGloves', name: 'Мантия ученика (перчатки)', icon: 'img/armor/robe_gloves.webp', setId: 'robe', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Мантия ученика (перчатки)', icon: 'img/armor/robe_gloves.webp', type: 'gloves', sellPrice: 15,
        stats: { pDef: 1, mpBonus: 15 }, setId: 'robe' },
      materials: [{ name: 'Ткань', qty: 2 }, { name: 'Клей', qty: 1 }] },

    // ---- v0.21: КОЛЬЧУГА КОПЕЙ (воинский сет) — ТИР 3 ----
    { id: 'chainTop', name: 'Кольчуга Копей (верх)', icon: 'img/armor/chain_top.webp', setId: 'chain', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Кольчуга Копей (верх)', icon: 'img/armor/chain_top.webp', type: 'armorTop', sellPrice: 120,
        stats: { pDef: 9, hpBonus: 40 }, setId: 'chain' },
      materials: [{ name: 'Слиток железа', qty: 20 }, { name: 'Каменные пластины', qty: 14 }, { name: 'Ткань', qty: 5 }, { name: 'Ядро голема', qty: 2 }] },
    { id: 'chainBottom', name: 'Кольчуга Копей (низ)', icon: 'img/armor/chain_bottom.webp', setId: 'chain', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Кольчуга Копей (низ)', icon: 'img/armor/chain_bottom.webp', type: 'armorBottom', sellPrice: 120,
        stats: { pDef: 9, hpBonus: 40 }, setId: 'chain' },
      materials: [{ name: 'Слиток железа', qty: 16 }, { name: 'Каменные пластины', qty: 12 }, { name: 'Ткань', qty: 4 }, { name: 'Ядро голема', qty: 1 }] },
    { id: 'chainHelm', name: 'Кольчуга Копей (шлем)', icon: 'img/armor/chain_helm.webp', setId: 'chain', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Кольчуга Копей (шлем)', icon: 'img/armor/chain_helm.webp', type: 'helmet', sellPrice: 60,
        stats: { pDef: 4, hpBonus: 20 }, setId: 'chain' },
      materials: [{ name: 'Слиток железа', qty: 8 }, { name: 'Каменные пластины', qty: 6 }, { name: 'Ткань', qty: 2 }] },
    { id: 'chainBoots', name: 'Кольчуга Копей (ботинки)', icon: 'img/armor/chain_boots.webp', setId: 'chain', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Кольчуга Копей (ботинки)', icon: 'img/armor/chain_boots.webp', type: 'boots', sellPrice: 60,
        stats: { pDef: 4, hpBonus: 20 }, setId: 'chain' },
      materials: [{ name: 'Слиток железа', qty: 8 }, { name: 'Каменные пластины', qty: 6 }, { name: 'Ткань', qty: 2 }] },
    { id: 'chainGloves', name: 'Кольчуга Копей (перчатки)', icon: 'img/armor/chain_gloves.webp', setId: 'chain', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Кольчуга Копей (перчатки)', icon: 'img/armor/chain_gloves.webp', type: 'gloves', sellPrice: 60,
        stats: { pDef: 4, hpBonus: 20 }, setId: 'chain' },
      materials: [{ name: 'Слиток железа', qty: 8 }, { name: 'Каменные пластины', qty: 6 }, { name: 'Ткань', qty: 2 }] },

    // ---- v0.21: ШЁЛКОВАЯ МАНТИЯ (магический сет) — ТИР 3 ----
    { id: 'silkTop', name: 'Шёлковая мантия (верх)', icon: 'img/armor/silk_top.webp', setId: 'silk', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Шёлковая мантия (верх)', icon: 'img/armor/silk_top.webp', type: 'armorTop', sellPrice: 120,
        stats: { pDef: 5, mpBonus: 60, hpBonus: 25 }, setId: 'silk' },
      materials: [{ name: 'Паучий шёлк', qty: 30 }, { name: 'Ткань', qty: 5 }, { name: 'Хитин', qty: 10 }, { name: 'Слиток олова', qty: 5 }, { name: 'Ядовитая железа', qty: 2 }] },
    { id: 'silkBottom', name: 'Шёлковая мантия (низ)', icon: 'img/armor/silk_bottom.webp', setId: 'silk', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Шёлковая мантия (низ)', icon: 'img/armor/silk_bottom.webp', type: 'armorBottom', sellPrice: 120,
        stats: { pDef: 5, mpBonus: 60, hpBonus: 25 }, setId: 'silk' },
      materials: [{ name: 'Паучий шёлк', qty: 25 }, { name: 'Ткань', qty: 4 }, { name: 'Хитин', qty: 8 }, { name: 'Слиток олова', qty: 4 }, { name: 'Ядовитая железа', qty: 1 }] },
    { id: 'silkHelm', name: 'Шёлковая мантия (шлем)', icon: 'img/armor/silk_helm.webp', setId: 'silk', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Шёлковая мантия (шлем)', icon: 'img/armor/silk_helm.webp', type: 'helmet', sellPrice: 60,
        stats: { pDef: 2, mpBonus: 25, hpBonus: 10 }, setId: 'silk' },
      materials: [{ name: 'Паучий шёлк', qty: 12 }, { name: 'Ткань', qty: 2 }, { name: 'Хитин', qty: 4 }, { name: 'Слиток олова', qty: 2 }] },
    { id: 'silkBoots', name: 'Шёлковая мантия (ботинки)', icon: 'img/armor/silk_boots.webp', setId: 'silk', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Шёлковая мантия (ботинки)', icon: 'img/armor/silk_boots.webp', type: 'boots', sellPrice: 60,
        stats: { pDef: 2, mpBonus: 25, hpBonus: 10 }, setId: 'silk' },
      materials: [{ name: 'Паучий шёлк', qty: 12 }, { name: 'Ткань', qty: 2 }, { name: 'Хитин', qty: 4 }, { name: 'Слиток олова', qty: 2 }] },
    { id: 'silkGloves', name: 'Шёлковая мантия (перчатки)', icon: 'img/armor/silk_gloves.webp', setId: 'silk', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Шёлковая мантия (перчатки)', icon: 'img/armor/silk_gloves.webp', type: 'gloves', sellPrice: 60,
        stats: { pDef: 2, mpBonus: 25, hpBonus: 10 }, setId: 'silk' },
      materials: [{ name: 'Паучий шёлк', qty: 12 }, { name: 'Ткань', qty: 2 }, { name: 'Хитин', qty: 4 }, { name: 'Слиток олова', qty: 2 }] },
  ],

  weapons: [
    { id: 'swordShort', name: 'Короткий меч', category: 'swords', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Короткий меч', icon: 'img/weapons/sword_short.webp', type: 'weapon', sellPrice: 27,
        stats: { pAtk: 12 } },   // v0.25: 11 → 12
      materials: [{ name: 'Руда железа', qty: 20 }, { name: 'Клей', qty: 5 }] },

    { id: 'swordLong', name: 'Длинный меч', category: 'swords', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Длинный меч', icon: 'img/weapons/sword_long.webp', type: 'weapon', sellPrice: 60,
        stats: { pAtk: 22, atbSpeedMod: 0.02, critChance: 1 } },   // v0.25: 20 → 22
      materials: [{ name: 'Руда железа', qty: 40 }, { name: 'Клей', qty: 10 }, { name: 'Шкура волка', qty: 5 }] },

    { id: 'axeBattle', name: 'Боевой топор', category: 'axes', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Боевой топор', icon: 'img/weapons/axe_battle.webp', type: 'weapon', sellPrice: 32,   // v0.29.2: было 31.5 — дробь оставалась в Оболах
        stats: { pAtk: 11 } },
      materials: [{ name: 'Руда железа', qty: 25 }, { name: 'Клей', qty: 5 }] },

    { id: 'axeGreat', name: 'Секира', category: 'axes', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Секира', icon: 'img/weapons/axe_great.webp', type: 'weapon', sellPrice: 94,
        stats: { pAtk: 29, atbSpeedMod: -0.03 }, twoHanded: true },   // v0.27: двуручное ×1.35
      materials: [{ name: 'Руда железа', qty: 50 }, { name: 'Клей', qty: 15 }, { name: 'Клык', qty: 5 }] },

    { id: 'dagger', name: 'Кинжал', category: 'daggers', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Кинжал', icon: 'img/weapons/dagger.webp', type: 'weapon', sellPrice: 19,
        stats: { pAtk: 8, atbSpeedMod: 0.05, critChance: 3 } },
      materials: [{ name: 'Руда железа', qty: 15 }, { name: 'Клей', qty: 3 }] },

    { id: 'daggerShadow', name: 'Клинок Тени', category: 'daggers', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Клинок Тени', icon: 'img/weapons/dagger_shadow.webp', type: 'weapon', sellPrice: 49,
        stats: { pAtk: 15, atbSpeedMod: 0.10, critChance: 7 } },
      materials: [{ name: 'Руда железа', qty: 30 }, { name: 'Шкура волка', qty: 8 }, { name: 'Клык', qty: 3 }] },

    { id: 'spear', name: 'Копьё', category: 'spears', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Копьё', icon: 'img/weapons/spear.webp', type: 'weapon', sellPrice: 33,
        stats: { pAtk: 19 }, twoHanded: true },   // v0.27: двуручное ×1.35
      materials: [{ name: 'Ветвь', qty: 30 }, { name: 'Руда железа', qty: 10 }, { name: 'Клей', qty: 5 }] },

    { id: 'glaive', name: 'Глефа', category: 'spears', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Глефа', icon: 'img/weapons/glaive.webp', type: 'weapon', sellPrice: 71,
        stats: { pAtk: 28, atbSpeedMod: -0.02 }, twoHanded: true },   // v0.27: двуручное ×1.35
      materials: [{ name: 'Ветвь', qty: 50 }, { name: 'Руда железа', qty: 20 }, { name: 'Клей', qty: 10 }] },

    { id: 'bowShort', name: 'Короткий лук', category: 'bows', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Короткий лук', icon: 'img/weapons/bow_short.webp', type: 'weapon', sellPrice: 23,
        stats: { pAtk: 16, atbSpeedMod: 0.05 }, twoHanded: true },   // v0.27: двуручное ×1.35
      materials: [{ name: 'Ветвь', qty: 30 }, { name: 'Нить', qty: 5 }, { name: 'Клей', qty: 3 }] },

    { id: 'bowLong', name: 'Длинный лук', category: 'bows', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Длинный лук', icon: 'img/weapons/bow_long.webp', type: 'weapon', sellPrice: 44,
        stats: { pAtk: 27 }, twoHanded: true },   // v0.27: двуручное ×1.35
      materials: [{ name: 'Ветвь', qty: 60 }, { name: 'Нить', qty: 15 }, { name: 'Клей', qty: 8 }] },

    { id: 'crossbow', name: 'Арбалет', category: 'crossbows', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Арбалет', icon: 'img/weapons/crossbow.webp', type: 'weapon', sellPrice: 30,
        stats: { pAtk: 20 }, twoHanded: true },   // v0.27: двуручное ×1.35
      materials: [{ name: 'Ветвь', qty: 25 }, { name: 'Руда железа', qty: 15 }, { name: 'Клей', qty: 10 }] },

    { id: 'crossbowHeavy', name: 'Тяжёлый арбалет', category: 'crossbows', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Тяжёлый арбалет', icon: 'img/weapons/crossbow_heavy.webp', type: 'weapon', sellPrice: 87,
        stats: { pAtk: 31, atbSpeedMod: -0.05 }, twoHanded: true },   // v0.27: двуручное ×1.35
      materials: [{ name: 'Ветвь', qty: 50 }, { name: 'Руда железа', qty: 30 }, { name: 'Клей', qty: 20 }] },

    { id: 'club', name: 'Дубина', category: 'maces', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Дубина', icon: 'img/weapons/club.webp', type: 'weapon', sellPrice: 25,
        stats: { pAtk: 10 } },   // v0.25: 9 → 10
      materials: [{ name: 'Ветвь', qty: 20 }, { name: 'Клей', qty: 5 }] },

    // v0.19: вторая дубина — одноручная, можно со щитом.
    { id: 'maceBattle', name: 'Боевая булава', category: 'maces', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Боевая булава', icon: 'img/weapons/mace_battle.webp', type: 'weapon', sellPrice: 55,
        stats: { pAtk: 20, atbSpeedMod: -0.02 } },   // v0.25: 18 → 20
      materials: [{ name: 'Руда железа', qty: 35 }, { name: 'Ветвь', qty: 15 }, { name: 'Клей', qty: 10 }] },

    { id: 'wand', name: 'Жезл Ученика', category: 'staves', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Жезл Ученика', icon: 'img/weapons/wand.webp', type: 'weapon', sellPrice: 25,
        stats: { mAtk: 5, mpBonus: 30, mpRegenIn: 0.5 } },   // v0.25: + реген маны в бою
      materials: [{ name: 'Ветвь', qty: 20 }, { name: 'Клей', qty: 5 }] },

    { id: 'staff', name: 'Двуручный Посох Ученика', category: 'staves', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Двуручный Посох Ученика', icon: 'img/weapons/staff.webp', type: 'weapon', sellPrice: 40,
        stats: { mAtk: 15, atbSpeedMod: -0.05 }, twoHanded: true },
      materials: [{ name: 'Ветвь', qty: 40 }, { name: 'Клей', qty: 8 }] },

    // ---- v0.24: ОРУЖИЕ ТИРА 3 — из ресурсов Копей. Фишки типа сильнее на +2% (см. weaponTypes.js) ----
    // v0.25: атака всего Т3 поднята (мечи и дубины — сильнее остальных), жезлу — реген маны в бою
    { id: 'swordMines', name: 'Меч Стража Копей', category: 'swords', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Меч Стража Копей', icon: 'img/weapons/T3/sword_mines.webp', type: 'weapon', sellPrice: 120,
        stats: { pAtk: 34, atbSpeedMod: 0.03, critChance: 2 } },   // 28 → 34
      materials: [{ name: 'Слиток железа', qty: 16 }, { name: 'Слиток бронзы', qty: 6 }, { name: 'Каменные пластины', qty: 10 }, { name: 'Ядовитая железа', qty: 2 }] },

    // v0.32: в тире 3 у мечей, топоров, дубин и копий — пара «одноручное / двуручное».
    // Двуручное ≈ одноручное × 1.35 по атаке, медленнее; рецепт ~×1.3 и +1 редкая железа.
    { id: 'swordRune', name: 'Рунный меч Глубин', category: 'swords', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Рунный меч Глубин', icon: 'img/weapons/T3/sword_rune.webp', type: 'weapon', sellPrice: 160,
        stats: { pAtk: 46, atbSpeedMod: -0.03, critChance: 2 }, twoHanded: true },
      materials: [{ name: 'Слиток железа', qty: 20 }, { name: 'Слиток бронзы', qty: 10 }, { name: 'Каменные пластины', qty: 12 }, { name: 'Ядовитая железа', qty: 3 }] },

    { id: 'axeMiner', name: 'Секира Рудокопа', category: 'axes', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Секира Рудокопа', icon: 'img/weapons/T3/axe_miner.webp', type: 'weapon', sellPrice: 180,
        stats: { pAtk: 46, atbSpeedMod: -0.03 }, twoHanded: true },   // v0.27: 39 → 46/45 (двуручное ×1.35)
      materials: [{ name: 'Слиток железа', qty: 20 }, { name: 'Каменные пластины', qty: 12 }, { name: 'Ядовитая железа', qty: 2 }] },

    { id: 'axeTunneler', name: 'Топор Проходчика', category: 'axes', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Топор Проходчика', icon: 'img/weapons/T3/axe_tunneler.webp', type: 'weapon', sellPrice: 110,
        stats: { pAtk: 34 } },   // v0.32: одноручный — можно со щитом или в пару
      materials: [{ name: 'Слиток железа', qty: 14 }, { name: 'Слиток бронзы', qty: 4 }, { name: 'Каменные пластины', qty: 8 }, { name: 'Ядовитая железа', qty: 2 }] },

    { id: 'daggerVenom', name: 'Ядовитый клинок', category: 'daggers', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Ядовитый клинок', icon: 'img/weapons/T3/dagger_venom.webp', type: 'weapon', sellPrice: 100,
        stats: { pAtk: 29, atbSpeedMod: 0.10, critChance: 8 } },   // 26 → 29
      materials: [{ name: 'Слиток железа', qty: 12 }, { name: 'Хитин', qty: 20 }, { name: 'Ядовитая железа', qty: 10 }] },

    { id: 'pikeDepths', name: 'Пика Глубин', category: 'spears', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Пика Глубин', icon: 'img/weapons/T3/pike_depths.webp', type: 'weapon', sellPrice: 140,
        stats: { pAtk: 45, atbSpeedMod: -0.02 }, twoHanded: true },   // v0.27: 39 → 46/45 (двуручное ×1.35)
      materials: [{ name: 'Слиток железа', qty: 14 }, { name: 'Ветвь', qty: 50 }, { name: 'Хитин', qty: 16 }, { name: 'Ядовитая железа', qty: 5 }] },

    { id: 'spearGuard', name: 'Копьё Стража', category: 'spears', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Копьё Стража', icon: 'img/weapons/T3/spear_guard.webp', type: 'weapon', sellPrice: 100,
        stats: { pAtk: 33, atbSpeedMod: 0.02 } },   // v0.32: одноручное копьё — «копьё и щит» (в пару копья не берутся)
      materials: [{ name: 'Слиток железа', qty: 10 }, { name: 'Ветвь', qty: 30 }, { name: 'Хитин', qty: 10 }, { name: 'Ядовитая железа', qty: 3 }] },

    { id: 'bowSilk', name: 'Шёлковый лук', category: 'bows', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Шёлковый лук', icon: 'img/weapons/T3/bow_silk.webp', type: 'weapon', sellPrice: 90,
        stats: { pAtk: 44 }, twoHanded: true },   // v0.27: 38 → 44 (двуручное ×1.35)
      materials: [{ name: 'Ветвь', qty: 60 }, { name: 'Паучий шёлк', qty: 30 }, { name: 'Хитин', qty: 16 }] },

    { id: 'crossbowBronze', name: 'Бронзовый арбалет', category: 'crossbows', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Бронзовый арбалет', icon: 'img/weapons/T3/crossbow_bronze.webp', type: 'weapon', sellPrice: 170,
        stats: { pAtk: 42, atbSpeedMod: -0.05 }, twoHanded: true },   // v0.27: 34 → 42 (двуручное ×1.35)
      materials: [{ name: 'Слиток бронзы', qty: 14 }, { name: 'Ветвь', qty: 40 }, { name: 'Паучий шёлк', qty: 16 }] },

    { id: 'maceGolem', name: 'Булава голема', category: 'maces', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Булава голема', icon: 'img/weapons/T3/mace_golem.webp', type: 'weapon', sellPrice: 110,
        stats: { pAtk: 33, atbSpeedMod: -0.02 } },   // 26 → 33
      materials: [{ name: 'Слиток железа', qty: 14 }, { name: 'Каменные пластины', qty: 16 }, { name: 'Ядовитая железа', qty: 3 }] },

    { id: 'maulGolem', name: 'Палица голема', category: 'maces', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Палица голема', icon: 'img/weapons/T3/maul_golem.webp', type: 'weapon', sellPrice: 170,
        stats: { pAtk: 45, atbSpeedMod: -0.04 }, twoHanded: true },   // v0.32: двуручная пара Булавы голема
      materials: [{ name: 'Слиток железа', qty: 18 }, { name: 'Каменные пластины', qty: 22 }, { name: 'Ядро голема', qty: 2 }, { name: 'Ядовитая железа', qty: 3 }] },

    { id: 'staffDepths', name: 'Посох Глубин', category: 'staves', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Посох Глубин', icon: 'img/weapons/T3/staff_depths.webp', type: 'weapon', sellPrice: 80,
        stats: { mAtk: 29, atbSpeedMod: -0.05 }, twoHanded: true },   // 25 → 29
      materials: [{ name: 'Ветвь', qty: 50 }, { name: 'Паучий шёлк', qty: 20 }, { name: 'Ядро голема', qty: 3 }, { name: 'Слиток меди', qty: 6 }] },

    { id: 'wandDepths', name: 'Жезл Глубин', category: 'staves', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Жезл Глубин', icon: 'img/weapons/T3/wand_depths.webp', type: 'weapon', sellPrice: 50,
        stats: { mAtk: 14, mpBonus: 60, mpRegenIn: 1 } },   // мАтк 11 → 14, + реген маны в бою
      materials: [{ name: 'Ветвь', qty: 25 }, { name: 'Паучий шёлк', qty: 10 }, { name: 'Ядро голема', qty: 2 }, { name: 'Слиток меди', qty: 4 }] },
  ],

  shields: [
    { id: 'wickerShield', name: 'Плетёный щит', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Плетёный щит', icon: 'img/weapons/wicker_shield.webp', type: 'shield', sellPrice: 20,
        stats: { pDef: 2, flatDamageReduce: 1, blockChance: 8 } },   // v0.27: блок 5 → 8, + защита 2
      materials: [{ name: 'Ветвь', qty: 20 }, { name: 'Клей', qty: 3 }] },

    // v0.24: щит тира 3 — защита 4 (в плане было 3).
    { id: 'bronzeShield', name: 'Бронзовый щит', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Бронзовый щит', icon: 'img/weapons/T3/shield_bronze.webp', type: 'shield', sellPrice: 60,
        stats: { pDef: 4, flatDamageReduce: 2, blockChance: 10 } },   // v0.27: блок 5 → 10 (Т2 8%, Т3 10%, +2% за тир)
      materials: [{ name: 'Слиток бронзы', qty: 10 }, { name: 'Каменные пластины', qty: 10 }, { name: 'Клей', qty: 5 }] },
  ],

  // ---- НОВОЕ (v0.12): ювелирка «Новичка» — PNG вместо SVG ----
  jewelry: [
    { id: 'noviceRing', name: 'Кольцо Новичка', icon: 'img/jewelry/novice_ring.webp', setId: 'novice', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Кольцо Новичка', icon: 'img/jewelry/novice_ring.webp', type: 'ring', sellPrice: 25, stats: { mDef: 2, mpBonus: 5 }, setId: 'novice' },
      materials: [{ name: 'Руда железа', qty: 5 }, { name: 'Жабья шкура', qty: 5 }] },

    { id: 'noviceEarring', name: 'Серьга Новичка', icon: 'img/jewelry/novice_earring.webp', setId: 'novice', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Серьга Новичка', icon: 'img/jewelry/novice_earring.webp', type: 'earring', sellPrice: 25, stats: { mDef: 2, mpBonus: 5 }, setId: 'novice' },
      materials: [{ name: 'Руда железа', qty: 5 }, { name: 'Жабья шкура', qty: 5 }] },

    { id: 'noviceNecklace', name: 'Ожерелье Новичка', icon: 'img/jewelry/novice_necklace.webp', setId: 'novice', price: CRAFT_PRICE_GEAR, tier: 2,
      result: { name: 'Ожерелье Новичка', icon: 'img/jewelry/novice_necklace.webp', type: 'necklace', sellPrice: 35, stats: { mDef: 3, mpBonus: 5 }, setId: 'novice' },
      materials: [{ name: 'Жабья шкура', qty: 7 }, { name: 'Клык', qty: 1 }] },

    // ---- v0.25: МАЛАХИТОВЫЕ ОБЕРЕГИ — ТИР 3. Маг. защита 4/4/5 + мини-сет бижутерии (config.js) ----
    { id: 'malachiteRing', name: 'Малахитовое кольцо', icon: 'img/jewelry/T3/ring_malachite.webp', setId: 'malachite', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Малахитовое кольцо', icon: 'img/jewelry/T3/ring_malachite.webp', type: 'ring', sellPrice: 60,
        stats: { mDef: 4, hpBonus: 15, mpBonus: 10 }, setId: 'malachite' },
      materials: [{ name: 'Слиток меди', qty: 6 }, { name: 'Слиток олова', qty: 4 }, { name: 'Хитин', qty: 6 }, { name: 'Ядовитая железа', qty: 2 }] },

    { id: 'malachiteEarring', name: 'Малахитовая серьга', icon: 'img/jewelry/T3/earring_malachite.webp', setId: 'malachite', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Малахитовая серьга', icon: 'img/jewelry/T3/earring_malachite.webp', type: 'earring', sellPrice: 60,
        stats: { mDef: 4, hpBonus: 15, mpBonus: 10 }, setId: 'malachite' },
      materials: [{ name: 'Слиток олова', qty: 6 }, { name: 'Слиток меди', qty: 4 }, { name: 'Паучий шёлк', qty: 6 }, { name: 'Ядовитая железа', qty: 2 }] },

    { id: 'malachiteNecklace', name: 'Малахитовое ожерелье', icon: 'img/jewelry/T3/necklace_malachite.webp', setId: 'malachite', price: CRAFT_PRICE_GEAR_T3, tier: 3,
      result: { name: 'Малахитовое ожерелье', icon: 'img/jewelry/T3/necklace_malachite.webp', type: 'necklace', sellPrice: 90,
        stats: { mDef: 5, hpBonus: 25, mpBonus: 20 }, setId: 'malachite' },
      materials: [{ name: 'Слиток бронзы', qty: 8 }, { name: 'Паучий шёлк', qty: 8 }, { name: 'Ядовитая железа', qty: 3 }, { name: 'Ядро голема', qty: 2 }] },
  ],

  consumables: [
    // НОВОЕ (v0.11): цена снижена до 100.
    { id: 'cookedMeat', name: 'Жареное мясо', icon: 'img/materials/cooked_meat.webp', price: CRAFT_PRICE_FOOD,
      result: { name: 'Жареное мясо', icon: 'img/materials/cooked_meat.webp', type: 'food', sellPrice: 10,
        food: { healPerSec: 1, duration: FOOD_DURATION, kind: 'cookedMeat' } },
      materials: [{ name: 'Мясо', qty: 1 }, { name: 'Ветвь', qty: 1 }] },
    // ---- v0.35.1: сытость сильнее — продукты уходят быстрее (FOOD_KINDS в config.js). Картинки — временно чужие. ----
    { id: 'hearty', name: 'Сытное рагу', icon: 'img/materials/dish_wolf_stew.webp', price: CRAFT_PRICE_HEARTY,
      result: { name: 'Сытное рагу', icon: 'img/materials/dish_wolf_stew.webp', type: 'food', sellPrice: 30,
        food: { healPerSec: 2, duration: FOOD_DURATION, kind: 'hearty' } },
      materials: [{ name: 'Мясо', qty: 4 }, { name: 'Кости', qty: 3 }, { name: 'Ветвь', qty: 2 }, { name: 'Уголь', qty: 1 }] },
    { id: 'feast', name: 'Охотничий пир', icon: 'img/materials/dish_mushroom_roast.webp', price: CRAFT_PRICE_FEAST,
      result: { name: 'Охотничий пир', icon: 'img/materials/dish_mushroom_roast.webp', type: 'food', sellPrice: 120,
        food: { healPerSec: 2, duration: FOOD_DURATION, kind: 'feast' } },
      materials: [{ name: 'Мясо', qty: 12 }, { name: 'Кости', qty: 8 }, { name: 'Пещерный гриб', qty: 6 }, { name: 'Уголь', qty: 4 }, { name: 'Клык', qty: 2 }] },
    { id: 'ukha', name: 'Грибная уха', icon: 'img/materials/dish_mushroom_brew.webp', price: CRAFT_PRICE_UKHA,
      result: { name: 'Грибная уха', icon: 'img/materials/dish_mushroom_brew.webp', type: 'food', sellPrice: 100,
        food: { healPerSec: 2, duration: FOOD_DURATION, kind: 'ukha' } },
      materials: [{ name: 'Мясо', qty: 6 }, { name: 'Пещерный гриб', qty: 12 }, { name: 'Жабья шкура', qty: 4 }, { name: 'Уголь', qty: 4 }] },
    // ---- v0.20: блюда — сытность + бонус на DISH_DURATION (одно блюдо за раз) ----
    { id: 'mushroomRoast', name: 'Жаркое с грибами', icon: 'img/materials/dish_mushroom_roast.webp', price: CRAFT_PRICE_DISH,
      result: { name: 'Жаркое с грибами', icon: 'img/materials/dish_mushroom_roast.webp', type: 'food', sellPrice: 15,
        food: { healPerSec: 1, duration: DISH_DURATION, dish: 'mushroomRoast' } },
      materials: [{ name: 'Мясо', qty: 2 }, { name: 'Пещерный гриб', qty: 2 }, { name: 'Уголь', qty: 1 }] },
    { id: 'wolfStew', name: 'Похлёбка из волчатины', icon: 'img/materials/dish_wolf_stew.webp', price: CRAFT_PRICE_DISH,
      result: { name: 'Похлёбка из волчатины', icon: 'img/materials/dish_wolf_stew.webp', type: 'food', sellPrice: 15,
        food: { healPerSec: 1, duration: DISH_DURATION, dish: 'wolfStew' } },
      materials: [{ name: 'Мясо', qty: 2 }, { name: 'Кости', qty: 2 }, { name: 'Ветвь', qty: 1 }] },
    { id: 'mushroomBrew', name: 'Грибной отвар', icon: 'img/materials/dish_mushroom_brew.webp', price: CRAFT_PRICE_DISH,
      result: { name: 'Грибной отвар', icon: 'img/materials/dish_mushroom_brew.webp', type: 'food', sellPrice: 15,
        food: { healPerSec: 1, duration: DISH_DURATION, dish: 'mushroomBrew' } },
      materials: [{ name: 'Пещерный гриб', qty: 3 }, { name: 'Нить', qty: 1 }] },
  ],
};

// ========================================================
//  v0.37: ТИР 4 — ресурсы Окраин Ильграда, 6 сетов по весу брони (любой класс носит любую).
//  Цифры — черновик. Пока Ильград закрыт, рецепты в Кузнице не видны (requiresIlgrad).
//  Два вида одного веса — из одних материалов, различает редкий ресурс.
// ========================================================
const T4_MATERIALS = {
  'Мёртвая сталь':          { icon: 'img/materials/dead_steel.webp', sellPrice: 60, from: [{ name: 'Ржавый доспех', qty: 3 }, { name: 'Каменные пластины', qty: 1 }, { name: 'Уголь', qty: 1 }] },
  'Выделанная мертвокожа':  { icon: 'img/materials/cured_deathhide.webp', sellPrice: 60, from: [{ name: 'Мёртвая шкура', qty: 3 }, { name: 'Хитин', qty: 1 }, { name: 'Клей', qty: 1 }] },
  'Призрачное полотно':     { icon: 'img/materials/ghost_cloth.webp', sellPrice: 60, from: [{ name: 'Саван', qty: 3 }, { name: 'Паучий шёлк', qty: 1 }, { name: 'Ткань', qty: 1 }] },
  'Чернёное серебро':       { icon: 'img/materials/black_silver.webp', sellPrice: 60, from: [{ name: 'Потемневший медальон', qty: 3 }, { name: 'Слиток олова', qty: 1 }, { name: 'Уголь', qty: 1 }] },
  // Редкие ресурсы Копей: у Кровавых шанс ×10, а титул умножает ещё — повод вернуться в Копи.
  'Едрёная железа':         { icon: 'img/materials/edrenaya_gland.webp', sellPrice: 400, from: [{ name: 'Ядро голема', qty: 5 }, { name: 'Ядовитая железа', qty: 5 }] },
  'Гранатовая нить':        { icon: 'img/materials/garnet_thread.webp', sellPrice: 200, from: [{ name: 'Сырой гранат', qty: 5 }, { name: 'Паучий шёлк', qty: 5 }] },
};
Object.entries(T4_MATERIALS).forEach(([name, m], i) => {
  RECIPES.resources.push({
    id: 't4Mat' + i, name, icon: m.icon, price: CRAFT_PRICE_RESOURCE_T4, requiresIlgrad: true,
    result: { name, icon: m.icon, type: 'material', sellPrice: m.sellPrice },
    materials: m.from,
  });
});

// Сумма за комплект: лёгкий 20/14/110, скорость +6%; средний 32/7/170; тяжёлый 46/0/240, скорость −5%, уворот −8.
// Порядок в массивах: верх, низ, шлем, ботинки, перчатки.
const T4_WEIGHTS = {
  light:  { pDef: [6, 6, 3, 3, 2],    mDef: [4, 4, 2, 2, 2], hpBonus: [33, 33, 15, 15, 14], atbSpeedMod: [0.02, 0.02, 0.01, 0.01, 0] },
  medium: { pDef: [10, 10, 4, 4, 4],  mDef: [2, 2, 1, 1, 1], hpBonus: [50, 50, 24, 23, 23] },
  heavy:  { pDef: [14, 14, 6, 6, 6],  hpBonus: [72, 72, 32, 32, 32], atbSpeedMod: [-0.02, -0.01, -0.01, -0.01, 0], evasionMod: [-3, -3, -1, -1, 0] },
};
const T4_PIECES = [
  { key: 'top',    label: 'верх',     type: 'armorTop',    sellPrice: 240, qty: [16, 8, 3] },
  { key: 'bottom', label: 'низ',      type: 'armorBottom', sellPrice: 240, qty: [13, 6, 2] },
  { key: 'helm',   label: 'шлем',     type: 'helmet',      sellPrice: 120, qty: [7, 3, 1] },
  { key: 'boots',  label: 'ботинки',  type: 'boots',       sellPrice: 120, qty: [7, 3, 0] },
  { key: 'gloves', label: 'перчатки', type: 'gloves',      sellPrice: 120, qty: [7, 3, 0] },
];
const T4_SETS = [
  { id: 'shroud', name: 'Саван', weight: 'light', material: 'Призрачное полотно', rare: 'Слеза плакальщицы', skillFlatTiers: { 2: 15, 3: 22, 4: 30 },
    bonus: { mAtkPercent: 12, maxMpFlat: 280 }, bonusText: 'Магическая атака +12%, мана +280',
    bonus10: { manaShield: 50 }, bonus10Text: 'Мана-щит: 50% урона по вам списывается с MP' },
  { id: 'shadow', name: 'Тень', weight: 'light', material: 'Призрачное полотно', rare: 'Сердце колосса', skillFlatTiers: { 2: 30, 3: 45, 4: 60 },
    bonus: { critPower: 8, critChance: 6 }, bonusText: 'Сила крита +8%, шанс крита +6%',
    bonus10: { critPower: 6 }, bonus10Text: 'ещё сила крита +6%' },
  { id: 'stalker', name: 'Ловчий', weight: 'medium', material: 'Выделанная мертвокожа', rare: 'Сердце колосса', skillFlatTiers: { 2: 30, 3: 45, 4: 60 },
    bonus: { atbSpeed: 0.08, accuracy: 8 }, bonusText: 'Скорость атаки +8%, точность +8',
    bonus10: { critChance: 5 }, bonus10Text: 'Шанс крита +5%' },
  { id: 'herbalist', name: 'Знахарь', weight: 'medium', material: 'Выделанная мертвокожа', rare: 'Слеза плакальщицы', skillFlatTiers: { 2: 15, 3: 22, 4: 30 },
    bonus: { hpRegenIn: 2, mpRegenIn: 2 }, bonusText: '+2 HP и +2 MP в секунду в бою',
    bonus10: { buffTurns: 1 }, bonus10Text: 'Длительность усилений +1 ход' },
  { id: 'bulwark', name: 'Оплот', weight: 'heavy', material: 'Мёртвая сталь', rare: 'Сердце колосса', skillFlatTiers: { 2: 30, 3: 45, 4: 60 },
    bonus: { flatDamageReduce: 5, blockChance: 8 }, bonusText: 'Поглощение урона +5, шанс блока +8%',
    bonus10: { flatDamageReduce: 5 }, bonus10Text: 'ещё поглощение +5 (всего +10)' },
  { id: 'executioner', name: 'Палач', weight: 'heavy', material: 'Мёртвая сталь', rare: 'Слеза плакальщицы', skillFlatTiers: { 2: 30, 3: 45, 4: 60 },
    bonus: { pAtkPercent: 10, evasion: -4 }, bonusText: 'Физическая атака +10%, уворот −4',
    bonus10: { executePercent: 20 }, bonus10Text: 'Урон по цели ниже 30% здоровья +20%' },
];
T4_SETS.forEach(s => {
  const pieceName = p => `${s.name} (${p.label})`;
  SETS[s.id] = {
    name: s.name, bonus: s.bonus, bonusText: s.bonusText, bonus10: s.bonus10, bonus10Text: s.bonus10Text,
    skillFlatTiers: s.skillFlatTiers, pieces: T4_PIECES.map(pieceName),
  };
  T4_PIECES.forEach((p, i) => {
    const icon = `img/armor/t4_${s.id}_${p.key}.webp`;
    const stats = {};
    Object.entries(T4_WEIGHTS[s.weight]).forEach(([k, arr]) => { if (arr[i]) stats[k] = arr[i]; });
    const materials = [{ name: s.material, qty: p.qty[0] }, { name: 'Звонкая кость', qty: p.qty[1] }];
    if (p.qty[2]) materials.push({ name: s.rare, qty: p.qty[2] });
    RECIPES.armor.push({
      id: `t4_${s.id}_${p.key}`, name: pieceName(p), icon, setId: s.id, price: CRAFT_PRICE_GEAR_T4, tier: 4, requiresIlgrad: true,
      result: { name: pieceName(p), icon, type: p.type, sellPrice: p.sellPrice, stats, setId: s.id },
      materials,
    });
  });
});

// Оружие Т4: атака ≈ Т3 ×2 (здоровье тварей от Копей к Окраинам растёт в 2,26 раза; оружие чуть отстаёт).
const T4_WEAPON_MATS = {
  blade:  [{ name: 'Мёртвая сталь', qty: 16 }, { name: 'Костяной клык', qty: 10 }],
  blunt:  [{ name: 'Мёртвая сталь', qty: 12 }, { name: 'Обломок дубины', qty: 10 }],
  ranged: [{ name: 'Выделанная мертвокожа', qty: 10 }, { name: 'Крепкая жила', qty: 12 }],
  magic:  [{ name: 'Призрачное полотно', qty: 12 }, { name: 'Застывший вздох', qty: 10 }],
};
const T4_WEAPONS = [
  { id: 'sword',      name: 'Меч Мертвеца',            category: 'swords',    mats: 'blade',  stats: { pAtk: 68, atbSpeedMod: 0.03, critChance: 2 } },
  { id: 'greatsword', name: 'Двуручный меч Осады',     category: 'swords',    mats: 'blade',  stats: { pAtk: 92, atbSpeedMod: -0.03, critChance: 2 }, two: true },
  { id: 'axe',        name: 'Топор Погоста',           category: 'axes',      mats: 'blade',  stats: { pAtk: 68 } },
  { id: 'waraxe',     name: 'Секира Могильщика',       category: 'axes',      mats: 'blade',  stats: { pAtk: 92, atbSpeedMod: -0.03 }, two: true },
  { id: 'dagger',     name: 'Кинжал Плача',            category: 'daggers',   mats: 'blade',  stats: { pAtk: 58, atbSpeedMod: 0.10, critChance: 8 } },
  { id: 'spear',      name: 'Копьё Дозорного',         category: 'spears',    mats: 'blade',  stats: { pAtk: 66, atbSpeedMod: 0.02 } },
  { id: 'pike',       name: 'Пика Ополчения',          category: 'spears',    mats: 'blade',  stats: { pAtk: 90, atbSpeedMod: -0.02 }, two: true },
  { id: 'bow',        name: 'Лук Гончей',              category: 'bows',      mats: 'ranged', stats: { pAtk: 88 }, two: true },
  { id: 'crossbow',   name: 'Арбалет Стен',            category: 'crossbows', mats: 'ranged', stats: { pAtk: 84, atbSpeedMod: -0.05 }, two: true },
  { id: 'mace',       name: 'Булава Костолома',        category: 'maces',     mats: 'blunt',  stats: { pAtk: 66, atbSpeedMod: -0.02 } },
  { id: 'maul',       name: 'Палица Колосса',          category: 'maces',     mats: 'blunt',  stats: { pAtk: 90, atbSpeedMod: -0.04 }, two: true },
  { id: 'staff',      name: 'Посох Последнего Вздоха', category: 'staves',    mats: 'magic',  stats: { mAtk: 58, atbSpeedMod: -0.05 }, two: true },
  { id: 'wand',       name: 'Жезл Вздоха',             category: 'staves',    mats: 'magic',  stats: { mAtk: 28, mpBonus: 120, mpRegenIn: 2 } },
];
T4_WEAPONS.forEach(w => {
  const result = { name: w.name, icon: `img/weapons/T4/${w.id}.webp`, type: 'weapon', sellPrice: w.two ? 320 : 240, stats: w.stats };
  if (w.two) result.twoHanded = true;
  RECIPES.weapons.push({
    id: 't4_' + w.id, name: w.name, category: w.category, price: CRAFT_PRICE_GEAR_T4, tier: 4, requiresIlgrad: true, result,
    materials: [...T4_WEAPON_MATS[w.mats], { name: 'Едрёная железа', qty: w.two ? 3 : 2 }],
  });
});
RECIPES.shields.push({
  id: 't4_shield', name: 'Щит Погоста', price: CRAFT_PRICE_GEAR_T4, tier: 4, requiresIlgrad: true,
  result: { name: 'Щит Погоста', icon: 'img/weapons/T4/shield.webp', type: 'shield', sellPrice: 120, stats: { pDef: 8, flatDamageReduce: 4, blockChance: 12 } },
  materials: [...T4_WEAPON_MATS.blunt, { name: 'Едрёная железа', qty: 2 }],
});

// Бижутерия Т4: два вида, для бойца и для мага.
const T4_JEWELRY = [
  { id: 't4jewelWar', name: 'Гранатовый убор', key: 'war', bonus: { pAtkPercent: 6 }, bonusText: 'Физическая атака +6%',
    pieces: { ring: 'Гранатовое кольцо', earring: 'Гранатовая серьга', necklace: 'Гранатовое ожерелье' },
    stats: { ring: { mDef: 6, hpBonus: 35 }, earring: { mDef: 6, hpBonus: 35 }, necklace: { mDef: 7, hpBonus: 55 } } },
  { id: 't4jewelMage', name: 'Убор Вздоха', key: 'mage', bonus: { mAtkPercent: 6 }, bonusText: 'Магическая атака +6%',
    pieces: { ring: 'Кольцо Вздоха', earring: 'Серьга Вздоха', necklace: 'Ожерелье Вздоха' },
    stats: { ring: { mDef: 6, hpBonus: 15, mpBonus: 35 }, earring: { mDef: 6, hpBonus: 15, mpBonus: 35 }, necklace: { mDef: 7, hpBonus: 25, mpBonus: 55 } } },
];
T4_JEWELRY.forEach(j => {
  SETS[j.id] = {
    name: j.name, bonus: j.bonus, bonusText: j.bonusText, pieces: [j.pieces.ring, j.pieces.earring, j.pieces.necklace],
    isFullSetEquipped: function () {
      const e = state.player.equipment;
      return e.ring1?.name === j.pieces.ring && e.ring2?.name === j.pieces.ring &&
             e.earring1?.name === j.pieces.earring && e.earring2?.name === j.pieces.earring &&
             e.necklace?.name === j.pieces.necklace;
    },
  };
  ['ring', 'earring', 'necklace'].forEach(type => {
    const icon = `img/jewelry/T4/${type}_${j.key}.webp`;
    const big = type === 'necklace';
    RECIPES.jewelry.push({
      id: `${j.id}_${type}`, name: j.pieces[type], icon, setId: j.id, price: CRAFT_PRICE_GEAR_T4, tier: 4, requiresIlgrad: true,
      result: { name: j.pieces[type], icon, type, sellPrice: big ? 180 : 120, stats: j.stats[type], setId: j.id },
      materials: [{ name: 'Чернёное серебро', qty: big ? 12 : 8 }, { name: 'Застывший вздох', qty: big ? 6 : 4 }, { name: 'Гранатовая нить', qty: big ? 2 : 1 }],
    });
  });
});

// ========================================================
//  ТОВАРЫ ТОРГОВЦА
// ========================================================
const SHOP_ITEMS = [
  { id: 'healPotion', name: 'Зелье малого лечения', price: 20, icon: 'potionHeal',
    slotType: 'potion',
    effect: '+50 HP', description: 'Восстанавливает здоровье.',
    usage: 'Применяется автоматически при HP ниже порога. Один раз за бой.' },

  // v0.20: зелье лечения — сразу +70 HP, затем +10 HP на 5 ходов героя
  { id: 'healPotion2', name: 'Зелье лечения', price: 150, icon: 'potionHeal2',
    slotType: 'potion',
    effect: '+70 HP, затем +10 HP × 5 ходов', description: 'Сильное лечение: сразу 70 HP и ещё по 10 HP на каждом вашем ходу (5 ходов).',
    usage: 'Применяется автоматически при HP ниже порога. Один раз за бой.' },

  { id: 'atkMixture', name: 'Микстура атаки', price: 150, icon: 'potionAtk',
    slotType: 'mixture',
    effect: '+30% урона', description: 'Увеличивает весь ваш урон на 30%.',
    usage: 'Применяется в начале боя. Действует на 100 ваших атак.' },

  { id: 'atkMixture2', name: 'Микстура Атаки II', price: 400, icon: 'potionAtk2',
    slotType: 'mixture',
    effect: '+50% урона', description: 'Усиленная версия микстуры атаки. +50% урона.',
    usage: 'Применяется в начале боя. Действует на 100 ваших атак.' },

  { id: 'luckMixture', name: 'Микстура Удачи', price: 3000, icon: 'potionLuck',
    slotType: 'mixture',
    effect: '+30% шанс дропа', description: 'Увеличивает шанс выпадения предметов с монстров на 30%. На Оболы не влияет.',
    usage: 'Применяется в начале боя. Действует 50 боёв. Складывается с титулами.' },

  { id: 'defMixture', name: 'Микстура Крепости', price: 300, icon: 'potionDef',
    slotType: 'mixture',
    effect: '−30% физ. урона', description: 'Снижает получаемый физический урон от монстров на 30%. Магия и яд не режутся.',
    usage: 'Применяется в начале боя. Действует 50 ударов монстров.' },

  { id: 'healPotionField', name: 'Зелье полевого лечения', price: 480, icon: 'potionHealField',
    town: 'ilgrad', slotType: 'potion',
    effect: '+120 HP, затем +20 HP × 3 хода', description: 'Восстанавливает 120 HP сразу и ещё по 20 HP в начале трёх следующих ваших ходов.',
    usage: 'Применяется автоматически при HP ниже порога. Один раз за бой.' },

  { id: 'clarityPotion', name: 'Зелье ясности', price: 400, icon: 'potionClarity',
    town: 'ilgrad', slotType: 'potion',
    effect: '+25% от максимума MP', description: 'Восстанавливает четверть максимального запаса маны.',
    usage: 'Применяется автоматически при MP ниже порога. Один раз за бой.' },

  { id: 'wardMixture', name: MIXTURE_EFFECTS.wardMixture.name, price: 600, icon: MIXTURE_EFFECTS.wardMixture.icon,
    town: 'ilgrad', slotType: 'mixture',
    effect: '−30% маг. урона', description: 'Снижает прямой магический урон от монстров на 30%.',
    usage: 'Применяется в начале боя. Действует на 50 магических попаданий.' },

  { id: 'reposeMixture', name: MIXTURE_EFFECTS.reposeMixture.name, price: 800, icon: MIXTURE_EFFECTS.reposeMixture.icon,
    town: 'ilgrad', slotType: 'mixture',
    effect: 'Отменяет «Неупокоенного»', description: 'Монстр падает от смертельного удара, даже если сработало свойство «Неупокоенный».',
    usage: 'Применяется в начале боя. Из 20 зарядов тратится по одному за каждое отменённое срабатывание.' },

  { id: 'atkMixture3', name: MIXTURE_EFFECTS.atkMixture3.name, price: 2000, icon: MIXTURE_EFFECTS.atkMixture3.icon,
    town: 'ilgrad', slotType: 'mixture',
    effect: '+65% урона', description: 'Увеличивает ваш урон на 65%.',
    usage: 'Применяется в начале боя. Действует на 100 ваших атак.' },
  // v0.26: «Свиток телепортации» убран — магические тропы ведут во все стороны (map.js)
];

function isShopItemSoldInTown(item, location) {
  return isTownLoc(location) && (!item.town || item.town === location);
}
