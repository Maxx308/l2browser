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
  sample: null,     // { t, hp, mp } — от начала привала, для расчёта скорости восстановления
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
  REST.sample = { t: performance.now(), hp: p.hp, mp: p.mp };

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

// Скорость восстановления (в секунду): по факту за привал, а первые секунды — по формуле.
function restRegenRates() {
  const p = state.player;
  let hp = 1 + (p.hpRegenOutBonus || 0);
  let mp = (p.mpRegenOut || 1) + (p.mpRegenOutBonus || 0);
  const s = REST.sample;
  if (s) {
    const sec = (performance.now() - s.t) / 1000;
    if (sec >= 5) {
      if (p.hp > s.hp) hp = Math.max(hp, (p.hp - s.hp) / sec);
      if (p.mp > s.mp) mp = Math.max(mp, (p.mp - s.mp) / sec);
    }
  }
  return { hp, mp };
}

function restEtaSec() {
  const p = state.player;
  const rates = restRegenRates();
  let eta = 0;
  if (p.resumeHpPercent > 0 && p.maxHp > 0) {
    const need = p.maxHp * p.resumeHpPercent / 100 - p.hp;
    if (need > 0) eta = Math.max(eta, need / rates.hp);
  }
  if (p.resumeMpPercent > 0 && p.maxMp > 0) {
    const need = p.maxMp * p.resumeMpPercent / 100 - p.mp;
    if (need > 0) eta = Math.max(eta, need / rates.mp);
  }
  return eta;
}

function restTargetName() {
  const t = state.battle.waitingTemplate || state.battle.lastTarget;
  if (!t) return '';
  const template = [...MONSTERS, ...MINE_MONSTERS].find(mm => mm.id === t.id);
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
  const template = t ? [...MONSTERS, ...MINE_MONSTERS].find(mm => mm.id === t.id) : null;
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
