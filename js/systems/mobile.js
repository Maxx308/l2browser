// ========================================================
//  СИСТЕМЫ: ТЕЛЕФОН (v0.24)
//  + Не гасить экран, пока идёт охота (Wake Lock).
//    Включено по умолчанию, переключатель — в Настройках.
//  + Обновили страницу — снова в игре и в бою:
//    номер слота хранится в sessionStorage (живёт, пока открыта вкладка).
//  + «К выбору персонажа» — выход на экран слотов.
// ========================================================

const WAKE_LOCK_STORAGE_KEY = 'l2browser_wakelock';
const RESUME_SESSION_KEY = 'l2browser_resume_slot';

// --------------------------------------------------------
//  НЕ ГАСИТЬ ЭКРАН
// --------------------------------------------------------
let __wakeLock = null;
let __wakeLockPending = false;

function isWakeLockSupported() {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

function isWakeLockEnabled() {
  try { return localStorage.getItem(WAKE_LOCK_STORAGE_KEY) !== '0'; } catch (e) { return true; }
}

function setWakeLockEnabled(on) {
  try { localStorage.setItem(WAKE_LOCK_STORAGE_KEY, on ? '1' : '0'); } catch (e) {}
  renderWakeLockButtons();
  updateWakeLock();
}

// Охота идёт: бой, пауза между повторами или ожидание восстановления.
function wantWakeLock() {
  if (!isWakeLockEnabled()) return false;
  if (state.activeSlotIndex === null || state.activeSlotIndex === undefined) return false;
  const b = state.battle;
  return !!(b.active || b.repeatBattle || b.waitingForResume);
}

async function updateWakeLock() {
  if (!isWakeLockSupported() || __wakeLockPending) return;
  const want = wantWakeLock() && document.visibilityState === 'visible';

  if (want && !__wakeLock) {
    __wakeLockPending = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      __wakeLock = lock;
      // Телефон снимает блокировку сам, когда браузер свёрнут.
      lock.addEventListener('release', () => { if (__wakeLock === lock) __wakeLock = null; });
    } catch (e) {
      __wakeLock = null;
    }
    __wakeLockPending = false;
  } else if (!want && __wakeLock) {
    const lock = __wakeLock;
    __wakeLock = null;
    try { await lock.release(); } catch (e) {}
  }
}

function renderWakeLockButtons() {
  const cont = document.getElementById('wakelock-buttons');
  const hint = document.getElementById('wakelock-hint');
  if (!cont) return;
  cont.innerHTML = '';
  const on = isWakeLockEnabled();
  [[true, 'Вкл'], [false, 'Выкл']].forEach(([value, label]) => {
    const btn = document.createElement('button');
    btn.className = 'settings-btn' + (value === on ? ' active' : '');
    btn.textContent = label;
    btn.onclick = () => setWakeLockEnabled(value);
    cont.appendChild(btn);
  });
  if (hint) {
    hint.textContent = isWakeLockSupported()
      ? 'Пока идёт охота, экран телефона не гаснет. Батарея садится быстрее — для долгого фарма лучше на зарядке.'
      : 'Этот браузер не умеет держать экран включённым. Нужен Chrome на Android или Safari на iOS 16.4 и новее.';
  }
}

// Раз в 2 секунды сверяемся с боем — так не нужно трогать код боя.
setInterval(updateWakeLock, 2000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') updateWakeLock();
});

// --------------------------------------------------------
//  ВОЗВРАТ В ИГРУ ПОСЛЕ ОБНОВЛЕНИЯ СТРАНИЦЫ
// --------------------------------------------------------

// Вызывается из initGame: эту вкладку после обновления вернём в этот слот.
function rememberSlotForReload() {
  if (state.activeSlotIndex === null || state.activeSlotIndex === undefined) return;
  try { sessionStorage.setItem(RESUME_SESSION_KEY, String(state.activeSlotIndex)); } catch (e) {}
}

// Из loadSlotAndStart, сразу после загрузки сейва.
// Бой из сейва никогда не продолжается «как был» (окна боя уже нет — из-за этого
// герой зависал «в бою»). Вместо этого:
//   resume = false (вход с экрана слотов) — бой закрыт, повтор выключен;
//   resume = true  (обновили страницу)    — возвращаем цель, чтобы начать бой заново.
function takeSavedBattle(resume) {
  const b = state.battle;
  const wasRepeat = !!b.repeatBattle;
  const keepWaiting = resume && b.waitingForResume && !!b.waitingTemplate;
  let target = null;

  if (resume && !keepWaiting && !isTownLoc(state.player.currentLocation)) {
    const m = (b.monsters || [])[0];
    const last = b.lastTarget || (m ? { id: m.templateId || m.id, variantId: m.variantId } : null);
    if (last && (b.active || wasRepeat)) {
      target = { id: last.id, variantId: last.variantId, repeat: wasRepeat };
    }
  }

  b.active = false;
  b.monsters = [];
  b.monstersATB = 0;
  b.packIncoming = 0;
  b.playerATB = 0;
  b.manualWait = null;
  b.manualTarget = null;
  b.manualAction = null;
  b.debuffs = { monsters: {}, player: {} };
  // Ожидание восстановления (автостоп) после обновления оставляем — игра сама начнёт бой.
  b.repeatBattle = keepWaiting ? wasRepeat : false;
  if (!keepWaiting) {
    b.waitingForResume = false;
    b.waitingTemplate = null;
  }

  return target;
}

function resumeBattleAfterReload(target) {
  const p = state.player;
  if (!target || state.battle.active || state.battle.waitingForResume) return;
  if (isTownLoc(p.currentLocation) || !p.classId || p.hp <= 0) return;

  const template = ALL_HUNT_MONSTERS.find(mm => mm.id === target.id);
  if (!template) return;

  state.battle.repeatBattle = target.repeat;

  // Мало HP/MP по настройкам автостопа — сначала восстановимся, игра сама начнёт бой.
  if (typeof shouldWaitForRecovery === 'function' && shouldWaitForRecovery()) {
    state.battle.waitingTemplate = { id: target.id, variantId: target.variantId };
    state.battle.waitingForResume = true;
    if (typeof enterRestCamp === 'function') enterRestCamp(true);
    if (typeof updateAutoWaitIndicator === 'function') updateAutoWaitIndicator();
    showToast('🏕', 'Страница обновлена — привал, потом продолжим охоту');
    return;
  }

  if (typeof isOnHuntTab === 'function' && !isOnHuntTab()) switchTab('hunt');
  logCombat('▶ Страница обновлена — продолжаем охоту.', 'log-entry levelup');
  showToast('▶', 'Продолжаем охоту');
  startBattle(template, target.variantId);
}

// Старт страницы: если эта вкладка уже играла — сразу входим в того же персонажа.
// Ждём вход в аккаунт (до 6 секунд), иначе остаётся обычный экран слотов.
function tryAutoEnterAfterReload() {
  let idx = null;
  try {
    const raw = sessionStorage.getItem(RESUME_SESSION_KEY);
    if (raw !== null) idx = parseInt(raw, 10);
  } catch (e) {}
  if (idx === null || isNaN(idx) || !readSlot(idx)) return;

  const startedAt = Date.now();
  const attempt = () => {
    const startScreen = document.getElementById('start-screen');
    if (!startScreen || !startScreen.classList.contains('active')) return;   // игрок уже сам выбрал
    const allowed = (typeof cloudIsAllowedToPlay !== 'function') || cloudIsAllowedToPlay();
    if (allowed) {
      loadSlotAndStart(idx, { resume: true });
      return;
    }
    if (Date.now() - startedAt < 6000) setTimeout(attempt, 250);
  };
  attempt();
}

// Кнопка 🚪 в шапке (ask = true — всегда спросить) и кнопка в Настройках.
function exitToCharacterSelect(ask) {
  const b = state.battle;
  const hunting = b.active || b.repeatBattle || b.waitingForResume;
  if (hunting) {
    if (!confirm('Идёт охота. Выйти к выбору персонажа? Охота закончится.')) return;
  } else if (ask && !confirm('Выйти к выбору персонажа?')) {
    return;
  }
  if (typeof saveCurrentSlot === 'function' && state.activeSlotIndex !== null && state.activeSlotIndex !== undefined) {
    if (hunting) closeBattle();   // закрывает бой и привал, сохраняет
    else saveCurrentSlot();
  }
  try { sessionStorage.removeItem(RESUME_SESSION_KEY); } catch (e) {}
  location.reload();
}
