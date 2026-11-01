// ========================================================
//  СИСТЕМЫ: БОЙ — РУЧНОЙ РЕЖИМ (v0.20)
//  Когда автобой выключен и шкала игрока заполнилась:
//   + бой встаёт на паузу (шкала монстров замирает) на MANUAL_TURN_SECONDS;
//   + игрок выбирает: Атака, Навык, Защита (−40% урона до своего хода);
//   + тап по монстру — выбор цели (атака и одиночные навыки бьют в неё);
//   + зелье пьётся в любой момент и ход не тратит;
//   + таймер истёк — ход делает автобой;
//   + оглушённый игрок пропускает ход сам, без паузы.
//  Общий ход игрока (и для автобоя) — doPlayerTurn().
// ========================================================

const MANUAL_TURN_SECONDS = 10;
const GUARD_DAMAGE_CUT = 40;   // % урона, который режет «Защита»

// ---------- общий ход игрока ----------
// action: null — как автобой; {type:'attack'}; {type:'skill', id}; {type:'guard'}
function doPlayerTurn(action) {
  const b = state.battle;
  const p = state.player;
  b.manualWait = null;
  // v0.23: перебор шкалы (Скорость молнии) переносится на следующий ход
  b.playerATB = b.atbCarry || 0;
  b.atbCarry = 0;

  // v0.23: перезарядка Скорости молнии — считается ходами героя
  const lsCd = getDebuff('player', 'lsCooldown');
  if (lsCd) {
    lsCd.turnsLeft = (lsCd.turnsLeft || 1) - 1;
    if (lsCd.turnsLeft <= 0) removeDebuff('player', 'lsCooldown');
    else renderDebuffBar('player');
  }

  // КД скиллов уменьшается только при ходе игрока
  Object.keys(b.skillCooldowns).forEach(id => {
    if (b.skillCooldowns[id] > 0) b.skillCooldowns[id] = Math.max(0, b.skillCooldowns[id] - 1);
  });
  renderSkillSlots();

  // «Защита» держится до следующего своего хода
  if (getDebuff('player', 'guard')) removeDebuff('player', 'guard');

  // v0.20: Зелье лечения — +HP на каждом ходу героя
  const regen = getDebuff('player', 'potionRegen');
  if (regen) {
    const amount = Math.min(regen.perTurn || 10, p.maxHp - p.hp);
    if (amount > 0) { p.hp += amount; spawnFloatDamage('fighter-player', amount, 'heal'); }
    logCombat(`🧪 Зелье лечения: +${Math.max(0, amount)} HP (осталось ${(regen.turnsLeft || 1) - 1} ход.)`, 'log-entry potion');
    regen.turnsLeft = (regen.turnsLeft || 1) - 1;
    if (regen.turnsLeft <= 0) removeDebuff('player', 'potionRegen');
    else renderDebuffBar('player');
  }

  const playerStun = getDebuff('player', 'stun');
  if (playerStun) {
    const turnsLeft = (playerStun.turnsLeft || 1) - 1;
    if (turnsLeft <= 0) removeDebuff('player', 'stun');
    else { playerStun.turnsLeft = turnsLeft; renderDebuffBar('player'); }
    logCombat(`💫 ${p.name} оглушён и пропускает удар.`, 'log-entry loss');
    spawnFloatDamage('fighter-player', 0, 'block');
  } else if (action && action.type === 'guard') {
    addDebuff('player', 'guard', { turnsLeft: 1 });
    logCombat(`🛡 ${p.name} встаёт в защиту: −${GUARD_DAMAGE_CUT}% урона до следующего хода.`, 'log-entry player-skill');
    spawnFloatDamage('fighter-player', 0, 'block', { text: 'ЗАЩИТА' });
  } else {
    b.manualAction = action || null;
    try { playerAttack(); } finally { b.manualAction = null; }
  }

  if (b.active && getDebuff('player', 'poison') && p.hp > 0) applyPoisonTick();
  updateBattleUI();
}

// ---------- ожидание решения ----------
function startManualWait() {
  state.battle.playerATB = 1;
  state.battle.manualWait = { left: MANUAL_TURN_SECONDS };
  renderManualPanel(true);
}

function manualTick(dt) {
  const w = state.battle.manualWait;
  if (!w) return;
  w.left -= dt;
  if (w.left <= 0) {
    logCombat(`⏳ Время вышло — ход делает автобой.`, 'log-entry');
    doPlayerTurn(null);
  }
}

function isManualWaiting() {
  const b = state.battle;
  return !!(b && b.active && !b.autoBattle && b.manualWait);
}

function manualAct(action) {
  if (!isManualWaiting()) return;
  if (action.type === 'skill') {
    const chk = manualSkillCheck(action.id);
    if (!chk.ok) { logCombat(`✖ ${SKILLS[action.id].name}: ${chk.why}.`, 'log-entry'); return; }
  }
  doPlayerTurn(action);
}

// Старая кнопка «Ударить» — теперь обычная атака
function manualStrike() { manualAct({ type: 'attack' }); }

// ---------- навыки ----------
function manualSkillCheck(id) {
  const p = state.player;
  const skill = SKILLS[id];
  if (!skill || skill.type !== 'active' || !p.learnedSkills[id]) return { ok: false, why: 'не изучен' };
  const cd = state.battle.skillCooldowns[id] || 0;
  if (cd > 0) return { ok: false, why: `перезарядка ${Math.ceil(cd)}`, cd };
  const data = getSkillData(id);
  if (!data) return { ok: false, why: 'нет данных' };
  const freeCast = (id === 'fireball' || id === 'iceArrow') && getDebuff('player', 'resonance');
  if (p.mp < data.mpCost && !freeCast) return { ok: false, why: 'мало маны' };
  if (skill.aoe && typeof canUseAoeNow === 'function' && !canUseAoeNow(skill)) {
    return { ok: false, why: skill.aoe.kind === 'rune' ? 'руна уже стоит' : 'мало врагов' };
  }
  if (skill.minHpPercent && p.maxHp > 0 && (p.hp / p.maxHp) * 100 < skill.minHpPercent) {
    return { ok: false, why: `нужно HP ≥ ${skill.minHpPercent}%` };
  }
  return { ok: true };
}

// Используется в tryUseActiveSkill(): ручной выбор главнее автоматического.
// Возвращает undefined, если ручного выбора нет.
function manualPickedSkill() {
  const a = state.battle.manualAction;
  if (!a) return undefined;
  if (a.type === 'skill' && manualSkillCheck(a.id).ok) return SKILLS[a.id];
  return null;
}

// ---------- цель ----------
function manualSelectTarget(index) {
  const b = state.battle;
  if (!b.active || b.autoBattle) return;
  const m = (b.monsters || []).find(x => x.index === index && x.hp > 0);
  if (!m) return;
  b.manualTarget = index;
  logCombat(`🎯 Цель: ${m.name}.`, 'log-entry');
  updateBattleUI();
}

function getManualTarget() {
  const b = state.battle;
  if (!b || b.manualTarget === null || b.manualTarget === undefined) return null;
  const m = (b.monsters || []).find(x => x.index === b.manualTarget && x.hp > 0);
  if (!m) b.manualTarget = null;
  return m || null;
}

// ---------- защита ----------
function getGuardMult() {
  return getDebuff('player', 'guard') ? 1 - GUARD_DAMAGE_CUT / 100 : 1;
}

// ---------- зелье (ход не тратит) ----------
function manualDrinkPotion() {
  const b = state.battle;
  if (!b.active || b.autoBattle) return;
  if (b.activeEffects.healPotionUsed) { logCombat(`🧪 Зелье уже выпито в этом бою.`, 'log-entry'); return; }
  checkHealPotion(true);
  renderManualPanel(true);
}

function manualPotionState() {
  const p = state.player;
  const stock = p.inventory.filter(i => i.shopId === p.potionSlot).reduce((s, i) => s + i.qty, 0);
  const used = state.battle.activeEffects.healPotionUsed;
  return { stock, used, inSlot: !!p.potionSlot, ok: !!p.potionSlot && stock > 0 && !used };
}

// ---------- панель ----------
let MANUAL_SIG = '';
function renderManualPanel(force) {
  const box = document.getElementById('bx-manual');
  if (!box) return;
  const b = state.battle;
  const show = b.active && !b.autoBattle && state.player.hp > 0;
  box.style.display = show ? '' : 'none';
  const win = document.querySelector('.bx-window');
  if (win) win.classList.toggle('bxm-on', !!show);
  if (!show) { MANUAL_SIG = ''; return; }

  const waiting = isManualWaiting();
  const fill = document.getElementById('bxm-timer-fill');
  const txt = document.getElementById('bxm-timer-text');
  if (waiting) {
    const left = Math.max(0, b.manualWait.left);
    fill.style.width = (left / MANUAL_TURN_SECONDS * 100) + '%';
    txt.textContent = `Ваш ход · ${Math.ceil(left)} с`;
  } else {
    fill.style.width = Math.min(100, (b.playerATB || 0) * 100) + '%';
    txt.textContent = getDebuff('player', 'stun') ? 'Оглушение…' : 'Шкала заряжается…';
  }
  box.classList.toggle('bxm-waiting', waiting);

  const p = state.player;
  const slots = (p.skillSlots || []).filter(id => id && SKILLS[id] && SKILLS[id].type === 'active' && p.learnedSkills[id]);
  const checks = slots.map(id => [id, manualSkillCheck(id)]);
  const pot = manualPotionState();
  const alive = (b.monsters || []).filter(m => m.hp > 0).length;
  const sig = [waiting, alive > 1, pot.ok, pot.stock, ...checks.map(([id, c]) => id + (c.ok ? '+' : '-' + c.why))].join('|');
  if (!force && sig === MANUAL_SIG) return;
  MANUAL_SIG = sig;

  const row = document.getElementById('bxm-actions');
  row.replaceChildren();
  const mk = (cls, html, title, enabled, fn) => {
    const btn = document.createElement('button');
    btn.className = 'bxm-btn ' + cls;
    btn.innerHTML = html;
    btn.title = title;
    btn.disabled = !enabled;
    btn.addEventListener('click', fn);
    row.appendChild(btn);
    return btn;
  };
  mk('bxm-attack', '<span class="bxm-ic">⚔</span><span class="bxm-nm">Атака</span>', 'Обычный удар без навыков', waiting, () => manualAct({ type: 'attack' }));
  checks.forEach(([id, c]) => {
    const s = SKILLS[id];
    const data = getSkillData(id);
    const cd = c.cd ? `<span class="bxm-cd">${Math.ceil(c.cd)}</span>` : '';
    const mp = data && data.mpCost ? `<span class="bxm-mp">${data.mpCost}</span>` : '';
    mk('bxm-skill' + (c.ok ? '' : ' bxm-off'), `<span class="bxm-ic">${s.icon || '✦'}</span><span class="bxm-nm">${s.name}</span>${cd}${mp}`,
      c.ok ? s.name : `${s.name}: ${c.why}`, waiting && c.ok, () => manualAct({ type: 'skill', id }));
  });
  mk('bxm-guard', '<span class="bxm-ic">🛡</span><span class="bxm-nm">Защита</span>', `Пропустить ход: −${GUARD_DAMAGE_CUT}% урона до следующего хода`, waiting, () => manualAct({ type: 'guard' }));
  mk('bxm-potion', `<span class="bxm-ic">🧪</span><span class="bxm-nm">Зелье</span><span class="bxm-mp">×${pot.stock}</span>`,
    pot.used ? 'Зелье уже выпито в этом бою' : (!pot.inSlot ? 'Зелье не в слоте' : 'Выпить зелье — ход не тратит'), pot.ok, manualDrinkPotion);

  const hint = document.getElementById('bxm-hint');
  if (hint) hint.textContent = alive > 1 ? 'Тапни по врагу, чтобы выбрать цель' : '';
}
