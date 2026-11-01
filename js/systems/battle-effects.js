// ========================================================
//  СИСТЕМЫ: БОЙ — ЭФФЕКТЫ
//  Тики дебаффов (горение, кровотечение, зарубка, яд).
//
//  НОВОЕ (v0.11, групповые бои):
//  + Тики горения/кровотечения/зарубки — на КОНКРЕТНОГО моба.
//  + onMonsterDeath(m) — передаём конкретного убитого моба.
//
//  НОВОЕ (v0.12):
//  + applyGreedMarkTick(m) — тихо уменьшает turnsLeft
//    Метки Жадности. Без логов.
//  + applyBleedTickOnPlayer() — тик КРОВОТЕЧЕНИЯ на игроке
//    (накладывает Волк). Урон/ход = damage, длина = turnsLeft.
//    При 0 HP — onPlayerDeath().
// ========================================================

// --------------------------------------------------------
//  ПОДЖОГ (ОГНЕННЫЙ ШАР)
// --------------------------------------------------------
function applyBurnTick() {
  const m = getCurrentMonster();
  if (!m || m.hp <= 0) return;
  const b = getDebuff('monster', 'burn', m.index);
  if (!b) return;

  const dmg = withSkillFlat(Math.max(1, b.damage || 0));   // v0.25: + ступени Т3-брони
  m.hp -= dmg;
  b.turnsLeft = (b.turnsLeft || 0) - 1;

  spawnFloatDamage('fighter-monster', dmg, 'fire');
  logCombat(`🔥 Поджог: ${dmg} урона (осталось ${b.turnsLeft} ход.)`, 'log-entry fire');

  if (b.turnsLeft <= 0) {
    removeDebuff('monster', 'burn', m.index);
    logCombat(`🔥 Пламя угасло.`, 'log-entry fire');
  } else {
    renderDebuffBar('monster');
  }

  if (m.hp <= 0) {
    m.hp = 0;
    logCombat(`🔥 ${m.name} сгорел!`, 'log-entry fire');
    onMonsterDeath(m);
  }
  updateBattleUI();
}

// --------------------------------------------------------
//  КРОВОТЕЧЕНИЕ (МЕЧИ) — на монстра
// --------------------------------------------------------
function applyBleedTick() {
  const m = getCurrentMonster();
  if (!m || m.hp <= 0) return;
  const b = getDebuff('monster', 'bleed', m.index);
  if (!b) return;

  const dmg = withSkillFlat(Math.max(1, b.damage || 0));   // v0.25: + ступени Т3-брони
  m.hp -= dmg;
  b.turnsLeft = (b.turnsLeft || 0) - 1;

  spawnFloatDamage('fighter-monster', dmg, 'dmg');
  logCombat(`🩸 Кровотечение: ${dmg} урона (осталось ${b.turnsLeft} ход.)`, 'log-entry loss');

  if (b.turnsLeft <= 0) {
    removeDebuff('monster', 'bleed', m.index);
    logCombat(`🩸 Кровотечение остановилось.`, 'log-entry');
  } else {
    renderDebuffBar('monster');
  }

  if (m.hp <= 0) {
    m.hp = 0;
    logCombat(`🩸 ${m.name} истёк кровью!`, 'log-entry kill');
    onMonsterDeath(m);
  }
  updateBattleUI();
}

// --------------------------------------------------------
//  ЗАРУБКА (ТОПОРЫ)
// --------------------------------------------------------
function applyWoundTick() {
  const m = getCurrentMonster();
  if (!m) return;
  const w = getDebuff('monster', 'wound', m.index);
  if (!w) return;

  w.turnsLeft = (w.turnsLeft || 0) - 1;

  if (w.turnsLeft <= 0) {
    removeDebuff('monster', 'wound', m.index);
    logCombat(`🪓 Зарубка затянулась.`, 'log-entry');
  } else {
    renderDebuffBar('monster');
  }
}

// --------------------------------------------------------
//  ЯД (АРАХНИД) — на игрока
// --------------------------------------------------------

function applyPoisonTick() {
  const poison = getDebuff('player', 'poison');
  const p = state.player;
  if (!poison || p.hp <= 0) return;

  // v0.27: стойка щита режет и яд
  const stance = typeof getShieldStanceMult === 'function' ? getShieldStanceMult() : 1;
  const dmg = stance < 1 ? Math.max(1, Math.floor((poison.damage || 0) * stance)) : (poison.damage || 0);
  p.hp -= dmg;
  poison.turnsLeft = (poison.turnsLeft || 0) - 1;

  spawnFloatDamage('fighter-player', dmg, 'poison');
  logCombat(`☠ Яд: ${dmg} урона (ур.${poison.level}, осталось ${poison.turnsLeft} хода)`, 'log-entry poison');

  if (poison.turnsLeft <= 0) {
    removeDebuff('player', 'poison');
    logCombat(`☠ Яд ослаб.`, 'log-entry poison');
  } else {
    renderDebuffBar('player');
  }

  updateTopStatus();
  updateBattleUI();

  if (p.hp <= 0) { p.hp = 0; onPlayerDeath(); }
}

function tryApplyPoison() {
  const m = getCurrentMonster();
  if (!m || !m.poison) return;
  if (Math.random() * 100 >= POISON_CHANCE) return;

  const poison = getDebuff('player', 'poison');

  if (!poison) {
    const level = 1;
    const damage = POISON_BASE_DAMAGE + level;
    addDebuff('player', 'poison', { level, damage, turnsLeft: POISON_DURATION });
    logCombat(`☠ ${state.player.name} отравлен! Ур.1, ${damage}/ход, ${POISON_DURATION} хода.`, 'log-entry poison');
  } else {
    const newLevel = Math.min(POISON_MAX_LEVEL, (poison.level || 1) + 1);
    const newDamage = POISON_BASE_DAMAGE + newLevel;
    poison.level = newLevel;
    poison.damage = newDamage;
    poison.turnsLeft = POISON_DURATION;
    renderDebuffBar('player');
    logCombat(`☠ Яд усилен! Ур.${newLevel}, ${newDamage}/ход, ${POISON_DURATION} хода.`, 'log-entry poison');
  }

  renderEffectsPanel();
}

// --------------------------------------------------------
//  МЕТКА ЖАДНОСТИ (v0.12)
//  Тик по КОНКРЕТНОМУ мобу. Тихий — без логов.
//  Если turnsLeft спадает до 0 — метка удаляется сама.
// --------------------------------------------------------
// ---- v0.19.1: метки складываются (до 5), каждая со своим таймером ----
// mark = { type, marks: [ходов, ходов, ...], turnsLeft (макс), count }
// Каждая метка: +25% дропа (воин) или Оболов (маг) и +10% опыта с моба.
const GREED_MAX_MARKS = 5;
const GREED_REWARD_PER_MARK = 25;
const GREED_XP_PER_MARK = 10;

function greedMarkList(mark) {
  if (!mark) return [];
  if (!Array.isArray(mark.marks)) mark.marks = [mark.turnsLeft || 1];
  return mark.marks;
}
function greedMarkSync(mark) {
  const M = greedMarkList(mark);
  mark.turnsLeft = M.length ? Math.max(...M) : 0;
  mark.count = M.length;
}
function getGreedMarkCount(m) {
  const mark = m ? getDebuff('monster', 'greedMark', m.index) : null;
  return mark ? greedMarkList(mark).length : 0;
}

// Новая Жадность: уже висящие метки +1 ход, плюс ещё одна метка рядом.
// Если меток уже 5 — обновляем самую старую. Возвращает число меток.
function addGreedMark(m, turns, type) {
  const mark = getDebuff('monster', 'greedMark', m.index);
  if (!mark || mark.type !== type) {
    addDebuff('monster', 'greedMark', m.index, { type, marks: [turns], turnsLeft: turns, count: 1 });
    return 1;
  }
  const M = greedMarkList(mark);
  for (let i = 0; i < M.length; i++) M[i] += 1;
  if (M.length < GREED_MAX_MARKS) M.push(turns);
  else {
    let oldest = 0;
    M.forEach((t, i) => { if (t < M[oldest]) oldest = i; });
    M[oldest] = turns;
  }
  greedMarkSync(mark);
  return M.length;
}

// Раскол / Буран: все задетые получают столько меток, сколько у самого «жадного» моба стаи.
function copyGreedMarks(targets, type) {
  const alive = (state.battle.monsters || []).filter(x => x.hp > 0);
  let src = null, best = 0;
  alive.forEach(x => {
    const mk = getDebuff('monster', 'greedMark', x.index);
    if (mk && mk.type === type && greedMarkList(mk).length > best) { best = mk.marks.length; src = mk; }
  });
  if (!src) return 0;
  let n = 0;
  targets.forEach(t => {
    if (!t || t.hp <= 0) return;
    if (getGreedMarkCount(t) >= best) return;
    addDebuff('monster', 'greedMark', t.index, { type, marks: src.marks.slice(), turnsLeft: src.turnsLeft, count: best });
    n++;
  });
  if (n) logCombat(`💰 Жадность расползается: ${n} ${n === 1 ? 'враг получил' : 'врагов получили'} метки ×${best}.`, 'log-entry player-skill');
  return n;
}

function applyGreedMarkTick(m) {
  if (!m || m.hp <= 0) return;
  const mark = getDebuff('monster', 'greedMark', m.index);
  if (!mark) return;

  mark.marks = greedMarkList(mark).map(t => t - 1).filter(t => t > 0);
  greedMarkSync(mark);

  if (mark.turnsLeft <= 0) {
    removeDebuff('monster', 'greedMark', m.index);
  } else {
    const cur = getCurrentMonster();
    if (cur && cur.index === m.index) {
      renderDebuffBar('monster');
    }
  }
}

// --------------------------------------------------------
//  КРОВОТЕЧЕНИЕ ИГРОКА (v0.12)
//  Накладывает Волк. Тикает в конце хода монстров.
//  Урон/ход = damage (уже рассчитан от hit_damage/6).
// --------------------------------------------------------
function applyBleedTickOnPlayer() {
  const b = getDebuff('player', 'bleed');
  const p = state.player;
  if (!b || p.hp <= 0) return;

  const dmg = Math.max(1, b.damage || 0);
  p.hp -= dmg;
  b.turnsLeft = (b.turnsLeft || 0) - 1;

  spawnFloatDamage('fighter-player', dmg, 'dmg');
  logCombat(`🩸 Кровотечение: ${dmg} урона (осталось ${b.turnsLeft} ход.)`, 'log-entry loss');

  if (b.turnsLeft <= 0) {
    removeDebuff('player', 'bleed');
    logCombat(`🩸 Кровотечение остановилось.`, 'log-entry');
  } else {
    renderDebuffBar('player');
  }

  updateTopStatus();
  updateBattleUI();

  if (p.hp <= 0) { p.hp = 0; onPlayerDeath(); }
}