// ========================================================
//  СИСТЕМЫ: БОЙ — ПРИВАЛ (v0.24)
//
//  Сработал автостоп (HP/MP ниже порога) — окно боя НЕ закрывается.
//  После баннера «Победа» на месте монстров появляется карточка привала:
//  полоски HP/MP с отметкой цели, примерное время, следующая цель,
//  кнопки «В бой сейчас» и «Закончить охоту».
//
//  Окно открыто — значит сессия охоты (battle-session.js) не обрывается:
//  время, опыт/ч, Оболы/ч и «Добыча за сессию» учитывают и отдых.
//
//  Картинка костра: img/locations/campfire.png (если файла нет — 🔥).
//
//  Подключать ПОСЛЕ battle-session.js, ДО main.js.
// ========================================================

const REST = {
  shown: false,
  timer: null,
  reason: '',
};

// Сколько показывать «Победу» перед карточкой привала.
const REST_SHOW_DELAY_MS = 1800;

// --------------------------------------------------------
//  ВХОД В ПРИВАЛ
// --------------------------------------------------------

// Вызывается из battle-rewards.js вместо закрытия окна боя.
// instant = true — без паузы на баннер (после обновления страницы).
function enterRestCamp(instant) {
  const p = state.player;
  const hpPct = p.maxHp > 0 ? (p.hp / p.maxHp) * 100 : 100;
  const mpPct = p.maxMp > 0 ? (p.mp / p.maxMp) * 100 : 100;
  if (p.stopHpPercent > 0 && hpPct < p.stopHpPercent) REST.reason = `Здоровье ниже ${p.stopHpPercent}%`;
  else if (p.stopMpPercent > 0 && mpPct < p.stopMpPercent) REST.reason = `Мана ниже ${p.stopMpPercent}%`;
  else REST.reason = 'Восстанавливаем силы';

  clearTimeout(REST.timer);
  REST.timer = setTimeout(showRestCamp, (instant || document.hidden) ? 0 : REST_SHOW_DELAY_MS);
}

function showRestCamp() {
  REST.timer = null;
  if (!state.battle.waitingForResume || state.battle.active) return;

  // Окно боя могло быть закрыто (вернулись после обновления страницы) — открываем.
  const win = document.getElementById('battle-window');
  if (win && !win.classList.contains('active')) {
    win.classList.add('active');
    const hint = document.getElementById('hunt-hint');
    if (hint) hint.style.display = 'none';
  }
  if (typeof BSESS !== 'undefined' && !BSESS.active && typeof bsessReset === 'function') bsessReset();

  const normalBox = document.getElementById('monster-normal');
  const searchBox = document.getElementById('monster-search');
  const restBox = document.getElementById('bx-rest');
  if (normalBox) normalBox.style.display = 'none';
  if (searchBox) searchBox.style.display = 'none';
  if (restBox) restBox.style.display = 'flex';
  document.getElementById('bx-stage')?.classList.add('bx-resting');

  REST.shown = true;
  renderRestCamp();
  if (typeof unlockLore === 'function') unlockLore('camp');   // v0.32: Энциклопедия — «Привал»
  if (typeof annalsFirst === 'function') annalsFirst('camp');   // v0.32: летопись
}

// Из hideMonsterSearching (startBattle / closeBattle).
function hideRestCamp() {
  clearTimeout(REST.timer);
  REST.timer = null;
  if (!REST.shown) return;
  REST.shown = false;
  const restBox = document.getElementById('bx-rest');
  if (restBox) restBox.style.display = 'none';
  document.getElementById('bx-stage')?.classList.remove('bx-resting');
}

// --------------------------------------------------------
//  КАРТОЧКА ПРИВАЛА
// --------------------------------------------------------

// v0.32: время до старта считаем ТОЧНО по тем же правилам, что и восстановление в gameLoop
// (battle-loop.js): раз в секунду HP +(1 + бонус), MP +(реген + бонус), а пока действует
// сытость — ещё +FOOD_HEAL_PER_SEC HP в секунду. Раньше скорость «подсматривали» по факту
// за первые секунды и без учёта еды — таймер прыгал. Теперь он ровно убывает по секунде.
// v0.35.1: сытость — по виду еды (FOOD_KINDS): на привале hp + restHp, мана — mp.
// Добавка к регену у костра (сет «Новичок»): действует, пока герой на привале — ждёт восстановления.
function restCampBonus() {
  const p = state.player;
  if (!state.battle.waitingForResume || state.battle.active) return { hp: 0, mp: 0 };
  return { hp: p.campHpRegen || 0, mp: p.campMpRegen || 0 };
}

function restRegenRates() {
  const p = state.player;
  const k = typeof currentFoodKind === 'function' ? currentFoodKind(p) : null;
  const camp = restCampBonus();
  return {
    hp: 1 + (p.hpRegenOutBonus || 0) + camp.hp,
    mp: (p.mpRegenOut || 1) + (p.mpRegenOutBonus || 0) + camp.mp,
    food: k ? k.hp + (k.restHp || 0) : 0,
    foodMp: k ? (k.mp || 0) : 0,
  };
}

// Сколько секундных «тиков» нужно, чтобы набрать need, если первые foodTicks тиков дают rate + food.
function restTicksFor(need, rate, food, foodTicks) {
  if (need <= 0) return 0;
  if (food > 0 && foodTicks > 0) {
    const fast = rate + food;
    if (need <= fast * foodTicks) return Math.ceil(need / fast - 1e-9);
    need -= fast * foodTicks;
    return foodTicks + Math.ceil(need / rate - 1e-9);
  }
  return Math.ceil(need / rate - 1e-9);
}

function restEtaSec() {
  const p = state.player;
  const r = restRegenRates();
  let eta = 0;
  if (p.resumeHpPercent > 0 && p.maxHp > 0) {
    const need = p.maxHp * p.resumeHpPercent / 100 - p.hp;
    const ticks = restTicksFor(need, r.hp, r.food, Math.floor(p.foodTimer || 0));
    // до ближайшего тика осталось (1 − накопленная доля секунды)
    if (ticks > 0) eta = Math.max(eta, ticks - (state.regenAccumulator || 0));
  }
  if (p.resumeMpPercent > 0 && p.maxMp > 0) {
    const need = p.maxMp * p.resumeMpPercent / 100 - p.mp;
    const ticks = restTicksFor(need, r.mp, r.foodMp, Math.floor(p.foodTimer || 0));
    if (ticks > 0) eta = Math.max(eta, ticks - (state.mpRegenAccumulator || 0));
  }
  return Math.max(0, eta);
}

function restTargetName() {
  const t = state.battle.waitingTemplate || state.battle.lastTarget;
  if (!t) return '';
  const template = ALL_HUNT_MONSTERS.find(mm => mm.id === t.id);
  if (!template) return '';
  const variant = MONSTER_VARIANTS[t.variantId] || MONSTER_VARIANTS.normal;
  return (variant.prefix + template.name).trim();
}

function restSetBar(kind, value, max, goalPct) {
  const pct = max > 0 ? Math.max(0, Math.min(100, value / max * 100)) : 0;
  const fill = document.getElementById(`bx-rest-${kind}-fill`);
  const goal = document.getElementById(`bx-rest-${kind}-goal`);
  const text = document.getElementById(`bx-rest-${kind}-text`);
  if (fill) fill.style.width = pct + '%';
  if (goal) {
    goal.style.display = goalPct > 0 ? 'block' : 'none';
    goal.style.left = goalPct + '%';
  }
  if (text) text.textContent = goalPct > 0 && pct < goalPct ? `${Math.floor(pct)}% → ${goalPct}%` : `${Math.floor(pct)}%`;
}

function renderRestCamp() {
  if (!REST.shown) return;
  const p = state.player;

  restSetBar('hp', p.hp, p.maxHp, p.resumeHpPercent || 0);
  restSetBar('mp', p.mp, p.maxMp, p.resumeMpPercent || 0);

  // Полоски героя на арене: updateBattleUI без монстров их не трогает.
  const hpBar = document.getElementById('player-hp-bar');
  const hpText = document.getElementById('player-hp-text');
  const mpBar = document.getElementById('player-mp-bar');
  const mpText = document.getElementById('player-mp-text');
  const ghost = document.getElementById('bx-hero-hp-ghost');
  if (p.maxHp > 0) {
    const w = Math.max(0, p.hp / p.maxHp * 100) + '%';
    if (hpBar) hpBar.style.width = w;
    if (ghost) ghost.style.width = w;
    if (hpText) hpText.textContent = `${Math.floor(p.hp)} / ${p.maxHp}`;
  }
  if (p.maxMp > 0) {
    if (mpBar) mpBar.style.width = Math.max(0, p.mp / p.maxMp * 100) + '%';
    if (mpText) mpText.textContent = `${Math.floor(p.mp)} / ${p.maxMp}`;
  }

  const reason = document.getElementById('bx-rest-reason');
  if (reason) reason.textContent = REST.reason;

  const eta = document.getElementById('bx-rest-eta');
  if (eta) {
    if (!state.battle.waitingForResume) {
      eta.textContent = 'Автостарт выключен — в бой по кнопке';
    } else {
      const sec = restEtaSec();
      eta.textContent = sec > 0.5
        ? `Продолжим примерно через ${bsessTime(Math.ceil(sec))}`
        : 'Силы восстановлены — в бой!';
    }
  }

  const next = document.getElementById('bx-rest-next');
  if (next) {
    const name = restTargetName();
    next.textContent = name ? `Следующая цель: ${name}` : '';
  }
}

// --------------------------------------------------------
//  КНОПКИ
// --------------------------------------------------------
function restFightNow() {
  const t = state.battle.waitingTemplate || state.battle.lastTarget;
  const template = t ? ALL_HUNT_MONSTERS.find(mm => mm.id === t.id) : null;
  if (!template) { restEndHunt(); return; }
  state.battle.waitingForResume = false;
  state.battle.waitingTemplate = null;
  updateAutoWaitIndicator();
  logCombat('▶ Привал окончен досрочно — в бой.', 'log-entry levelup');
  startBattle(template, t.variantId);
}

function restEndHunt() {
  closeBattle();
}

// --------------------------------------------------------
//  ОБЁРТКА: индикатор ожидания обновляется каждый тик — заодно рисуем привал.
//  Пока карточка привала на экране, маленькая плашка «⏸ Ожидание» не нужна.
// --------------------------------------------------------
(function restInstall() {
  const origIndicator = updateAutoWaitIndicator;
  updateAutoWaitIndicator = function () {
    const r = origIndicator.apply(this, arguments);
    if (REST.shown) {
      const ind = document.getElementById('auto-wait-indicator');
      if (ind) ind.style.display = 'none';
      renderRestCamp();
    }
    return r;
  };
})();
