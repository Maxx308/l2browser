// ========================================================
//  СИСТЕМЫ: БОЙ — СТАИ И ПОДКРЕПЛЕНИЯ (v0.29)
//
//  Охота всегда идёт стаей случайного размера (кнопки «Искать стаю» больше нет).
//
//  + Характер монстра (поле pack в monsters.js):
//    одиночка / обычный / стайный — от него зависят
//    размер стаи на старте, шанс подмоги и сколько живых сразу.
//  + Подкрепления: раз в ход стаи бросок шанса.
//    Удача → в ряду врагов появляется силуэт «?» (предупреждение),
//    на СЛЕДУЮЩИЙ ход стаи он становится монстром (1 или 2).
//    Живых одновременно — не больше maxAlive (5, у одиночек 3),
//    всего за бой — не больше PACK_MAX_TOTAL (10).
//  + Стайный бонус: чем больше стая в бою, тем больше дропа и Оболов
//    с каждого убитого (см. getPackRewardBonus).
//  + Бафы Гильдии магов «Тихий шаг» и «Провокатор» (GUILD_BUFFS.packMode).
//
//  Рисование силуэта и новых карточек — в battle-fx.js.
//  Подключать ПОСЛЕ battle-core.js, ДО battle-fx.js.
// ========================================================

const PACK_NATURES = {
  solo: {
    id: 'solo', name: 'Одиночка', paws: 1,
    weights: [65, 30, 5, 0],            // шанс стаи из 1 / 2 / 3 / 4 мобов
    reinforceMult: 0.5, maxAlive: 3,
    hint: 'Одиночка: обычно один или вдвоём, подмогу зовёт редко',
  },
  normal: {
    id: 'normal', name: 'Обычный', paws: 2,
    weights: [40, 30, 20, 10],
    reinforceMult: 1, maxAlive: 5,
    hint: 'Обычный: от одного до четырёх, иногда зовёт подмогу',
  },
  pack: {
    id: 'pack', name: 'Стайный', paws: 3,
    weights: [20, 30, 30, 20],
    reinforceMult: 1.5, maxAlive: 5,
    hint: 'Стайный: ходят по 2–4 и часто зовут подмогу',
  },
};

// Шанс подмоги за ход стаи (%) по числу живых врагов: [—, 1, 2, 3, 4].
// При 5 живых (или maxAlive) — подмоги нет.
// v0.29 (по симулятору): было 8/6/4/2 — на высоких уровнях бой 6–10 сек, подмога почти не успевала.
const PACK_REINFORCE_CHANCE = [0, 15, 12, 8, 4];
const PACK_REINFORCE_TWO = 25;       // % что придут сразу двое
const PACK_MAX_TOTAL = 10;           // всего мобов за бой, вместе с подмогой

// Стайный бонус: за каждого сородича в бою сверх первого (вместе с подмогой).
// Достаётся КАЖДОМУ убитому в этом бою, в т.ч. последнему.
// v0.29 (по симулятору): раньше считали только живых соседей в момент убийства —
// последний моб всегда шёл без бонуса, в среднем выходило +2–5%.
const PACK_DROP_PER_MOB = 8, PACK_DROP_MAX = 32;   // % к шансу предметов
const PACK_GOLD_PER_MOB = 5, PACK_GOLD_MAX = 20;   // % к Оболам

// Бафы Гильдии магов.
const PACK_BUFF_MODS = {
  quiet:   { reinforceMult: 0.2, startRoll: 'min' },   // Тихий шаг: бросаем 2 раза, берём меньшее
  provoke: { reinforceMult: 3,   startRoll: 'max' },   // Провокатор: берём большее
};

// --------------------------------------------------------
//  ПОМОЩНИКИ
// --------------------------------------------------------
function getPackNature(template) {
  return PACK_NATURES[(template && template.pack) || 'normal'] || PACK_NATURES.normal;
}

// Активный «стайный» баф игрока: 'quiet' / 'provoke' / null.
function getPackBuffMode() {
  const gb = state.player.guildBuffs || {};
  for (const id of Object.keys(gb)) {
    const def = GUILD_BUFFS[id];
    if (def && def.packMode && gb[id] && gb[id].timer > 0) return def.packMode;
  }
  return null;
}

function rollPackWeights(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i + 1;
  }
  return 1;
}

// Размер стаи на старте боя.
function rollPackSize(template) {
  const nature = getPackNature(template);
  const mod = PACK_BUFF_MODS[getPackBuffMode()];
  let n = rollPackWeights(nature.weights);
  if (mod) {
    const n2 = rollPackWeights(nature.weights);
    n = mod.startRoll === 'min' ? Math.min(n, n2) : Math.max(n, n2);
  }
  return Math.min(n, nature.maxAlive);
}

function getPackTemplate() {
  const t = state.battle.packTemplate;
  return t ? [...MONSTERS, ...MINE_MONSTERS].find(mm => mm.id === t.id) : null;
}

// Шанс подмоги прямо сейчас (%), 0 — не придёт.
function getPackReinforceChance() {
  const b = state.battle;
  const template = getPackTemplate();
  if (!template) return 0;
  const nature = getPackNature(template);
  const alive = getAliveMonstersCount();
  if (alive <= 0 || alive >= nature.maxAlive) return 0;
  if ((b.monsters || []).length >= PACK_MAX_TOTAL) return 0;
  const mod = PACK_BUFF_MODS[getPackBuffMode()];
  const base = PACK_REINFORCE_CHANCE[alive] || 0;
  return base * nature.reinforceMult * (mod ? mod.reinforceMult : 1);
}

// --------------------------------------------------------
//  НАЧАЛО БОЯ (из startBattle)
// --------------------------------------------------------
function packOnBattleStart(template, variantId) {
  state.battle.packTemplate = { id: template.id, variantId };
  state.battle.packIncoming = 0;     // сколько мобов «шуршит в кустах» (силуэт на арене)
}

// --------------------------------------------------------
//  ХОД СТАИ (из battle-loop.js, по «часам стаи»)
//  1) если подмога уже на подходе — она выходит;
//  2) иначе бросаем шанс новой подмоги.
// --------------------------------------------------------
function packClockTick() {
  const b = state.battle;
  if (!b.active || !b.packTemplate) return;

  if (b.packIncoming > 0) {
    const n = b.packIncoming;
    b.packIncoming = 0;
    packSpawnReinforcements(n);
    return;
  }

  const chance = getPackReinforceChance();
  if (chance <= 0 || Math.random() * 100 >= chance) return;

  b.packIncoming = Math.random() * 100 < PACK_REINFORCE_TWO ? 2 : 1;
  const where = state.player.currentLocation === 'mine' ? 'Из темноты штолен' : 'Из кустов';
  const what = b.packIncoming > 1 ? 'доносится топот — их несколько' : 'доносится рык';
  logCombat(`🌿 ${where} ${what}…`, 'log-entry separator');
}

function packSpawnReinforcements(n) {
  const b = state.battle;
  const template = getPackTemplate();
  if (!template) return;
  const nature = getPackNature(template);
  const room = Math.min(nature.maxAlive - getAliveMonstersCount(), PACK_MAX_TOTAL - b.monsters.length);
  n = Math.min(n, room);
  if (n <= 0) {
    logCombat('🌿 Шорох стих — подмога не пришла.', 'log-entry separator');
    return;
  }

  const added = [];
  for (let i = 0; i < n; i++) {
    const m = buildMonsterInstance(template, b.packTemplate.variantId || 'normal');
    m.index = b.monsters.length;   // индексы не повторяются — дебаффы мобов хранятся по index
    m.templateId = template.id;
    m.atb = 0;                     // только пришёл — сразу не бьёт
    m.reinforcement = true;
    b.monsters.push(m);
    added.push(m);
  }

  const name = added[0].name;
  logCombat(`🐾 Подмога: ${name}${n > 1 ? ' ×' + n : ''} вступает в бой! (стая ×${b.monsters.length})`, 'log-entry kill');
  packUpdateTitle();
}

// Заголовок окна боя: «Герой vs Волк ×4».
function packUpdateTitle() {
  const b = state.battle;
  const el = document.getElementById('battle-title-text');
  const first = (b.monsters || [])[0];
  if (!el || !first) return;
  const n = b.monsters.length;
  el.textContent = `${state.player.name} vs ${first.name}${n > 1 ? ' ×' + n : ''}`;
}

// --------------------------------------------------------
//  СТАЙНЫЙ БОНУС К НАГРАДЕ (из onMonsterDeath)
//  Считается по размеру стаи в этом бою (сколько всего было, с подмогой).
// --------------------------------------------------------
function getPackRewardBonus() {
  const size = (state.battle.monsters || []).length;
  const extra = Math.max(0, size - 1);
  return {
    size,
    drop: Math.min(PACK_DROP_MAX, extra * PACK_DROP_PER_MOB),
    gold: Math.min(PACK_GOLD_MAX, extra * PACK_GOLD_PER_MOB),
  };
}

// --------------------------------------------------------
//  ЗНАЧОК СТАЙНОСТИ НА КАРТОЧКЕ МОНСТРА (1–3 следа лап)
// --------------------------------------------------------
function packPawSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="16" rx="4.6" ry="4" /><circle cx="6" cy="10.5" r="2" /><circle cx="10" cy="7" r="2" /><circle cx="14" cy="7" r="2" /><circle cx="18" cy="10.5" r="2" /></svg>`;
}

function packBadgeHtml(template) {
  const nature = getPackNature(template);
  const paws = Array.from({ length: nature.paws }, packPawSvg).join('');
  return `<div class="monster-pack monster-pack-${nature.id}" title="${nature.hint}">${paws}</div>`;
}
