// ========================================================
//  СИСТЕМЫ: БОЙ — СЕССИЯ ОХОТЫ, СУМКА И ИНВЕНТАРЬ В БОЮ (v0.23)
//
//  Сессия = всё время, пока открыто окно боя
//  (от первого «В бой» до кнопки «Закрыть» или гибели).
//
//  Что делает:
//  + Считает за сессию: убийства, опыт, Оболы, всю добычу
//    и предметы, потерянные из-за полного инвентаря.
//  + В шапке боя вместо «ATB заряжается...» — скорость фарма:
//    опыт в час и Оболы в час.
//  + Сумка 🎒 в колонке «ДОБЫЧА» кликабельна — открывает
//    мини-панель «Добыча за сессию» прямо поверх сцены.
//    Бой при этом идёт дальше.
//  + Из мини-панели — кнопка «Открыть весь инвентарь»:
//    окно боя прячется (бой НЕ останавливается), открывается
//    обычная вкладка «Инвентарь», сверху — полоска боя
//    с HP и кнопкой «Вернуться в бой».
//
//  ВАЖНО: боевую логику файл не меняет — только оборачивает
//  startBattle / onMonsterDeath / addToInventory / closeBattle /
//  onPlayerDeath / updateBattleUI (как battle-fx.js).
//
//  Подключать ПОСЛЕ battle-fx.js, ДО main.js.
// ========================================================

const BSESS = {
  active: false,
  start: 0,          // performance.now() начала сессии
  kills: 0,
  xp: 0,
  gold: 0,
  lost: 0,           // предметов потеряно (инвентарь полон)
  items: new Map(),  // ключ name|rarity → { name, icon, rarity, count, type }
  collecting: false, // true — сейчас идёт onMonsterDeath, добычу считаем
  panelOpen: false,
  peek: false,       // окно боя спрятано, открыт инвентарь
  peekPrevTab: null,
  timer: null,
};

// --------------------------------------------------------
//  ПОМОЩНИКИ
// --------------------------------------------------------
function bsessTotalXp() {
  const p = state.player;
  const base = (typeof getTotalXpForLevel === 'function') ? getTotalXpForLevel(p.level) : 0;
  return base + (isFinite(p.xp) ? p.xp : 0);
}

function bsessElapsedSec() {
  return BSESS.active ? Math.max(0, (performance.now() - BSESS.start) / 1000) : 0;
}

// 1234 → «1 234», 15400 → «15.4k», 2 300 000 → «2.3M»
function bsessNum(n) {
  n = Math.floor(n || 0);
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.0', '') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace('.0', '') + 'k';
  return n.toLocaleString('ru-RU');
}

function bsessTime(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const pad = v => String(v).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function bsessPerHour(value) {
  const sec = bsessElapsedSec();
  if (sec < 20) return null;          // первые секунды — цифры скачут, не показываем
  return value / sec * 3600;
}

// Записать добычу в сессию (только то, что выпало при убийстве).
// v0.33: камни душ кладутся в сумку мимо addToInventory (addSoulGems) — зовут это напрямую.
function bsessNoteLoot(drop, n, ok) {
  if (!BSESS.collecting || !drop) return;
  n = Math.max(1, n || 1);
  if (!ok) { BSESS.lost += n; return; }
  const key = drop.name + '|' + (drop.rarity || '');
  const it = BSESS.items.get(key);
  if (it) it.count += n;
  else BSESS.items.set(key, { name: drop.name, icon: drop.icon, rarity: drop.rarity || null, type: drop.type, count: n });
}

function bsessItemCount() {
  let n = 0;
  BSESS.items.forEach(it => { n += it.count; });
  return n;
}

// --------------------------------------------------------
//  СЕССИЯ: НАЧАЛО / КОНЕЦ
// --------------------------------------------------------
function bsessReset() {
  BSESS.active = true;
  BSESS.start = performance.now();
  BSESS.kills = 0;
  BSESS.xp = 0;
  BSESS.gold = 0;
  BSESS.lost = 0;
  BSESS.items = new Map();
  bsessUpdateBag();
  bsessUpdateRate();
  if (BSESS.panelOpen) renderSessionPanel();
  if (!BSESS.timer) BSESS.timer = setInterval(bsessTick, 1000);
}

function bsessStop() {
  BSESS.active = false;
  if (BSESS.timer) { clearInterval(BSESS.timer); BSESS.timer = null; }
  closeSessionPanel();
  leaveBattlePeek(false);
}

// Раз в секунду: скорость фарма, время в панели, полоска «в бою».
function bsessTick() {
  if (!BSESS.active) return;
  bsessUpdateRate();
  if (BSESS.panelOpen) bsessUpdatePanelStats();
  if (BSESS.peek) updatePeekBar();
}

// --------------------------------------------------------
//  ШАПКА БОЯ: СКОРОСТЬ ФАРМА
// --------------------------------------------------------
function bsessUpdateRate() {
  const el = document.getElementById('bx-farm-rate');
  if (!el) return;
  const xpH = bsessPerHour(BSESS.xp), goldH = bsessPerHour(BSESS.gold);
  if (xpH === null || BSESS.kills === 0) {
    el.innerHTML = `<span class="bxr-item" title="Время охоты">⏱ ${bsessTime(bsessElapsedSec())}</span>`;
    el.title = 'Скорость фарма появится после первых убийств';
    return;
  }
  el.innerHTML =
    `<span class="bxr-item" title="Опыт в час">✨ ${bsessNum(xpH)}<small>/ч</small></span>` +
    `<span class="bxr-item" title="Оболы в час">🪙 ${bsessNum(goldH)}<small>/ч</small></span>`;
  el.title = 'Скорость фарма за эту сессию. Нажмите на 🎒 в «Добыче» — подробности';
}

// --------------------------------------------------------
//  СУМКА: СЧЁТЧИК В КОЛОНКЕ «ДОБЫЧА»
// --------------------------------------------------------
function bsessUpdateBag() {
  const cnt = document.getElementById('bx-loot-count');
  if (cnt) cnt.textContent = '🎒 ' + bsessItemCount();
}

// --------------------------------------------------------
//  МИНИ-ПАНЕЛЬ «ДОБЫЧА ЗА СЕССИЮ»
// --------------------------------------------------------
function toggleSessionPanel() {
  if (BSESS.panelOpen) closeSessionPanel();
  else openSessionPanel();
}

function openSessionPanel() {
  const el = document.getElementById('bx-session');
  if (!el) return;
  if (typeof hideTooltip === 'function') hideTooltip();
  BSESS.panelOpen = true;
  el.style.display = 'flex';
  document.getElementById('bx-loot-column')?.classList.add('bx-bag-open');
  renderSessionPanel();
  bsessApplyPanelPos();
}

// --------------------------------------------------------
//  ПЕРЕТАСКИВАНИЕ МИНИ-ПАНЕЛИ (v0.25)
//  Тянем за шапку, место запоминается в браузере игрока.
//  Двойной клик по шапке — вернуть панель в угол.
//  На телефоне (≤600px) панель прибита к низу — не таскаем.
// --------------------------------------------------------
const BSESS_POS_KEY = 'bsessPanelPos';

function bsessDragAllowed() {
  return !window.matchMedia('(max-width: 600px)').matches;
}

function bsessLoadPos() {
  try { return JSON.parse(localStorage.getItem(BSESS_POS_KEY)); } catch (e) { return null; }
}

function bsessSavePos(pos) {
  try {
    if (pos) localStorage.setItem(BSESS_POS_KEY, JSON.stringify(pos));
    else localStorage.removeItem(BSESS_POS_KEY);
  } catch (e) { /* хранилище недоступно — просто не запоминаем */ }
}

// Ставит панель в left/top (px от родителя), не выпуская за его края.
function bsessPlacePanel(el, left, top) {
  const parent = el.offsetParent;
  if (!parent) return;
  const maxL = Math.max(0, parent.clientWidth - el.offsetWidth);
  const maxT = Math.max(0, parent.clientHeight - el.offsetHeight);
  el.style.left = Math.min(Math.max(0, left), maxL) + 'px';
  el.style.top = Math.min(Math.max(0, top), maxT) + 'px';
  el.style.right = 'auto';
}

function bsessResetPanelPos(el) {
  el.style.left = el.style.top = el.style.right = '';
}

function bsessApplyPanelPos() {
  const el = document.getElementById('bx-session');
  if (!el) return;
  const pos = bsessLoadPos();
  if (!bsessDragAllowed() || !pos) { bsessResetPanelPos(el); return; }
  bsessPlacePanel(el, pos.left, pos.top);
}

function bsessInitPanelDrag() {
  const el = document.getElementById('bx-session');
  const head = el?.querySelector('.bxs-head');
  if (!head) return;

  let drag = null; // { id, dx, dy } — смещение курсора от угла панели

  head.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !bsessDragAllowed() || e.target.closest('button')) return;
    drag = { id: e.pointerId, dx: e.clientX - el.offsetLeft, dy: e.clientY - el.offsetTop };
    head.setPointerCapture(e.pointerId);
    el.classList.add('bxs-dragging');
    e.preventDefault();
  });

  head.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    bsessPlacePanel(el, e.clientX - drag.dx, e.clientY - drag.dy);
  });

  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    el.classList.remove('bxs-dragging');
    bsessSavePos({ left: el.offsetLeft, top: el.offsetTop });
  };
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);

  head.addEventListener('dblclick', e => {
    if (e.target.closest('button')) return;
    bsessResetPanelPos(el);
    bsessSavePos(null);
  });

  // Окно стало меньше — подвинуть панель, чтобы не уехала за край.
  window.addEventListener('resize', () => { if (BSESS.panelOpen) bsessApplyPanelPos(); });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bsessInitPanelDrag);
else bsessInitPanelDrag();

function closeSessionPanel() {
  BSESS.panelOpen = false;
  const el = document.getElementById('bx-session');
  if (el) el.style.display = 'none';
  document.getElementById('bx-loot-column')?.classList.remove('bx-bag-open');
}

function bsessUpdatePanelStats() {
  const box = document.getElementById('bxs-stats');
  if (!box) return;
  const p = state.player;
  const xpH = bsessPerHour(BSESS.xp), goldH = bsessPerHour(BSESS.gold);
  const rate = v => (v === null ? '' : `<em>${bsessNum(v)}/ч</em>`);

  // Сколько ещё до следующего уровня при текущей скорости.
  let toLevel = '';
  if (isFinite(p.xpNext) && p.xpNext > 0 && xpH && xpH > 0) {
    const left = Math.max(0, p.xpNext - p.xp);
    const h = left / xpH;
    const txt = h >= 1 ? `${Math.floor(h)} ч ${Math.round((h % 1) * 60)} мин` : `${Math.max(1, Math.round(h * 60))} мин`;
    toLevel = `<div class="bxs-note">До ${p.level + 1} уровня ≈ ${txt}</div>`;
  }

  box.innerHTML = `
    <div class="bxs-stat"><span>⏱</span><b>${bsessTime(bsessElapsedSec())}</b><i>время</i></div>
    <div class="bxs-stat"><span>💀</span><b>${BSESS.kills}</b><i>убито</i></div>
    <div class="bxs-stat"><span>✨</span><b>${bsessNum(BSESS.xp)}</b><i>опыт</i>${rate(xpH)}</div>
    <div class="bxs-stat"><span>🪙</span><b>${bsessNum(BSESS.gold)}</b><i>Оболы</i>${rate(goldH)}</div>
    ${toLevel}`;
}

function renderSessionPanel() {
  if (!BSESS.panelOpen) return;
  bsessUpdatePanelStats();

  const grid = document.getElementById('bxs-items');
  const foot = document.getElementById('bxs-foot');
  if (!grid) return;

  const order = (typeof RARITY_ORDER !== 'undefined') ? RARITY_ORDER : [];
  const list = [...BSESS.items.values()].sort((a, b) => {
    const ra = a.rarity ? order.indexOf(a.rarity) : -1;
    const rb = b.rarity ? order.indexOf(b.rarity) : -1;
    if (ra !== rb) return rb - ra;          // редкие — первыми
    return b.count - a.count;
  });

  if (!list.length) {
    grid.innerHTML = `<div class="bxs-empty">Пока пусто — добыча с монстров появится здесь.</div>`;
  } else {
    grid.innerHTML = list.map(it => {
      const r = it.rarity && typeof RARITIES !== 'undefined' ? RARITIES[it.rarity] : null;
      const col = r && r.id !== 'white' ? r.color : '';
      const title = it.name + (r && r.id !== 'white' ? ` (${r.name})` : '') + (it.count > 1 ? ` ×${it.count}` : '');
      const icon = (typeof normalizeIconHtml === 'function') ? normalizeIconHtml(it.icon) : '';
      return `<div class="bxs-item${col ? ' rare' : ''}" style="${col ? `--c:${col}` : ''}" title="${title.replace(/"/g, '&quot;')}">
          <div class="bxs-ico">${icon || '📦'}</div>
          ${it.count > 1 ? `<span class="bxs-qty">${it.count}</span>` : ''}
          <div class="bxs-name">${it.name}</div>
        </div>`;
    }).join('');
  }

  if (foot) {
    const used = state.player.inventory.length;
    const max = (typeof INVENTORY_MAX_SLOTS !== 'undefined') ? INVENTORY_MAX_SLOTS : 0;
    const full = max && used >= max;
    const warn = full ? ' bxs-warn' : (max && used >= max - 5 ? ' bxs-soon' : '');
    foot.innerHTML =
      `<span class="bxs-slots${warn}">🎒 Инвентарь: ${used}${max ? ' / ' + max : ''}${full ? ' — полон!' : ''}</span>` +
      (BSESS.lost > 0 ? `<span class="bxs-lost">📦 Потеряно: ${BSESS.lost}</span>` : '');
  }
}

// --------------------------------------------------------
//  ПОЛНЫЙ ИНВЕНТАРЬ ПОВЕРХ БОЯ («подглядывание»)
//  Окно боя прячется через класс на body — бой идёт дальше.
// --------------------------------------------------------
function openInventoryFromBattle() {
  if (!BSESS.active && !(state.battle && state.battle.active)) return;
  closeSessionPanel();
  const activeTab = document.querySelector('.tab.active');
  BSESS.peekPrevTab = activeTab ? activeTab.dataset.tab : 'hunt';
  BSESS.peek = true;
  document.body.classList.add('bx-peek');
  switchTab('inventory');
  window.scrollTo(0, 0);
  updatePeekBar();
}

function returnToBattle() { leaveBattlePeek(true); }

function leaveBattlePeek(restoreTab) {
  if (!BSESS.peek) return;
  BSESS.peek = false;
  document.body.classList.remove('bx-peek');
  if (typeof hideTooltip === 'function') hideTooltip();
  if (restoreTab && BSESS.peekPrevTab && BSESS.peekPrevTab !== 'inventory') {
    switchTab(BSESS.peekPrevTab);
  }
}

function updatePeekBar() {
  const bar = document.getElementById('bx-peek-bar');
  if (!bar || !BSESS.peek) return;
  const p = state.player, b = state.battle;

  const hpPct = p.maxHp > 0 ? Math.max(0, Math.min(100, p.hp / p.maxHp * 100)) : 0;
  const mpPct = p.maxMp > 0 ? Math.max(0, Math.min(100, p.mp / p.maxMp * 100)) : 0;
  const fill = document.getElementById('bxp-hp-fill');
  const txt  = document.getElementById('bxp-hp-text');
  const mp   = document.getElementById('bxp-mp-fill');
  if (fill) fill.style.width = hpPct + '%';
  if (mp) mp.style.width = mpPct + '%';
  if (txt) txt.textContent = `${Math.floor(p.hp)} / ${Math.floor(p.maxHp)}`;
  bar.classList.toggle('low', hpPct < 30);

  const alive = (b.monsters || []).filter(m => m.hp > 0);
  const status = document.getElementById('bxp-status');
  if (status) {
    let s;
    if (typeof isManualWaiting === 'function' && isManualWaiting()) s = '<b class="bxp-turn">Ваш ход!</b>';
    else if (alive.length) s = `☠ ${alive[0].name}${alive.length > 1 ? ' ×' + alive.length : ''}`;
    else if (b.waitingForResume) s = '⏳ Отдых';
    else s = '👣 Ищем врагов';
    status.innerHTML = `${s} · 💀 ${BSESS.kills}`;
  }
}

// --------------------------------------------------------
//  ОБЁРТКИ НАД ИГРОВЫМИ ФУНКЦИЯМИ
// --------------------------------------------------------
(function bsessInstall() {
  // ---- Начало боя: новая сессия, если окно боя было закрыто ----
  const origStart = startBattle;
  startBattle = function () {
    const win = document.getElementById('battle-window');
    const wasOpen = !!(win && win.classList.contains('active'));
    const r = origStart.apply(this, arguments);
    const nowOpen = !!(win && win.classList.contains('active'));
    if ((!wasOpen && nowOpen) || (nowOpen && !BSESS.active)) bsessReset();
    else bsessUpdateBag();
    return r;
  };

  // ---- Добыча: считаем всё, что легло в инвентарь при убийстве ----
  const origAdd = addToInventory;
  addToInventory = function (drop) {
    const ok = origAdd.apply(this, arguments);
    bsessNoteLoot(drop, 1, ok);
    return ok;
  };

  // ---- Смерть монстра: опыт, Оболы, убийство ----
  const origDeath = onMonsterDeath;
  onMonsterDeath = function (deadMonster) {
    const m = deadMonster || (typeof getCurrentMonster === 'function' ? getCurrentMonster() : null);
    if (!m || m._deathProcessed || !BSESS.active) return origDeath.apply(this, arguments);
    const xpBefore = bsessTotalXp();
    const goldBefore = state.player.gold;
    const wasCollecting = BSESS.collecting;
    BSESS.collecting = true;
    try { return origDeath.apply(this, arguments); }
    finally {
      BSESS.collecting = wasCollecting;
      BSESS.kills++;
      BSESS.xp   += Math.max(0, bsessTotalXp() - xpBefore);
      BSESS.gold += Math.max(0, state.player.gold - goldBefore);
      bsessUpdateBag();
      bsessUpdateRate();
      if (BSESS.panelOpen) renderSessionPanel();
      if (BSESS.peek) updatePeekBar();
    }
  };

  // ---- Закрыли бой — сессия окончена ----
  const origClose = closeBattle;
  closeBattle = function () {
    const r = origClose.apply(this, arguments);
    bsessStop();
    return r;
  };

  // ---- Гибель героя: если смотрели инвентарь — вернуть на сцену,
  //      сессию закончить (окно боя само закроется через 2 сек) ----
  const origPDeath = onPlayerDeath;
  onPlayerDeath = function () {
    leaveBattlePeek(true);
    const r = origPDeath.apply(this, arguments);
    bsessUpdateRate();
    bsessStop();
    return r;
  };

  // ---- Тик боя: полоска «в бою» поверх инвентаря ----
  const origUpdate = updateBattleUI;
  updateBattleUI = function () {
    const r = origUpdate.apply(this, arguments);
    if (BSESS.peek) { try { updatePeekBar(); } catch (e) { console.warn('[battle-session]', e); } }
    return r;
  };

  // Esc закрывает мини-панель / возвращает в бой.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (BSESS.panelOpen) closeSessionPanel();
    else if (BSESS.peek) returnToBattle();
  });
})();
