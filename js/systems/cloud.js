// ========================================================
//  СИСТЕМЫ: ОБЛАЧНЫЕ СОХРАНЕНИЯ (SUPABASE)
//  Вход / регистрация по email+паролю, синхронизация
//  5 слотов с таблицей public.saves.
//
//  ЭТАП 1 (v0.13a): инициализация клиента Supabase.
//  ЭТАП 2 (v0.13b): вход / регистрация / выход + UI.
//  ЭТАП 2.1 (v0.13c): перевод ошибок Supabase на русский.
//  ЭТАП 3.1 (v0.13d): функции работы со слотами.
//  ЭТАП 3.2 (v0.13e): дублирование save/delete в облако.
//  ЭТАП 3.3 (v0.13f): кэш облачных слотов + prefetch.
//  ЭТАП 3.4 (v0.13g): cloudPrefetchSlots после getSession.
//  ЭТАП 4.1 (v0.13h): сравнение локального и облачного.
//  ЭТАП 4.2 (v0.13i): модалка конфликта.
//  ЭТАП 4.3 (v0.13j): интеграция в onSlotClick.
//  ЭТАП 6 (v0.13k): тосты для игрока.
//  УР.2.1 (v0.13l): проверка доступа + мастер-режим.
//  УР.2.2 (v0.13m): миграция локальных сейвов в облако.
//  УР.2.2 fix (v0.13n): миграция вызывается после префетча.
//  УР.2.3 (v0.13o): админ-режим — кнопка ЧИТ только для админов.
//
//  НОВОЕ (v0.15):
//  + В initCloud() добавлен вызов updateLeaderboardButtonVisibility()
//    рядом с updateCheatButtonVisibility() — чтобы кнопка 🏆
//    в городе показывалась только залогиненным.
//  + В onAuthStateChange() через 1.5 сек после входа вызывается
//    cloudCleanupLeaderboardGhosts() — чистка призраков в рейтинге.
// ========================================================

const SUPABASE_URL = 'https://duczivjvdjwzarfqfxso.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vdpufq3NkcfA-3-6C3h2tg_9sajC9qg';

// ---- МАСТЕР-СПИСОК ----
const CLOUD_MASTER_EMAILS = [
  'dolgiy05@mail.ru',
];

// ---- АДМИНЫ (v0.13o) ----
// Email-ы, которым доступна кнопка «ЧИТ» и высокие рейты.
// Сравниваем в нижнем регистре.
const CLOUD_ADMIN_EMAILS = [
  'dolgiy05@mail.ru',
];

let supabaseClient = null;
let cloudUser = null;

const SUPABASE_TABLE = 'saves';

let cloudSlotsCache = {};

// --------------------------------------------------------
//  АНТИ-СПАМ ДЛЯ ТОСТОВ
// --------------------------------------------------------
let __cloudLastToastAt = {
  saved:  0,
  error:  0,
  offline: 0,
};

const CLOUD_TOAST_THROTTLE_MS = 30 * 1000;

function cloudToastThrottled(key, icon, text, kind) {
  const now = Date.now();
  const last = __cloudLastToastAt[key] || 0;
  const throttle = (kind === 'offline') ? 0 : CLOUD_TOAST_THROTTLE_MS;

  if (throttle > 0 && now - last < throttle) return;
  __cloudLastToastAt[key] = now;

  if (typeof showToast === 'function') showToast(icon, text);
}

function cloudResetOfflineFlag() {
  __cloudLastToastAt.offline = 0;
}

// --------------------------------------------------------
//  ВНУТРЕННИЙ ХЕЛПЕР: подтянуть слоты и перерисовать
// --------------------------------------------------------
function cloudRefreshSlotsAndUI() {
  if (!cloudUser) return;
  if (typeof cloudPrefetchSlots !== 'function') return;

  cloudPrefetchSlots().then(() => {
    const startScreen = document.getElementById('start-screen');
    if (startScreen && startScreen.classList.contains('active')) {
      if (typeof renderSlots === 'function') renderSlots();
      if (typeof updateCloudAccessGate === 'function') updateCloudAccessGate();

      if (typeof cloudTryShowMigrationModal === 'function') {
        cloudTryShowMigrationModal();
      }

      if (typeof updateCheatButtonVisibility === 'function') {
        updateCheatButtonVisibility();
      }

      // ---- НОВОЕ: обновить видимость кнопки рейтинга ----
      if (typeof updateLeaderboardButtonVisibility === 'function') {
        updateLeaderboardButtonVisibility();
      }
    }
  });
}

// --------------------------------------------------------
//  ПРОВЕРКА ДОСТУПА
// --------------------------------------------------------

function cloudIsMasterUnlocked() {
  return localStorage.getItem('l2browser_master') === '1';
}

function cloudSetMasterUnlocked(value) {
  if (value) {
    localStorage.setItem('l2browser_master', '1');
    console.log('[cloud] Мастер-режим включён. Игра доступна без входа.');
  } else {
    localStorage.removeItem('l2browser_master');
    console.log('[cloud] Мастер-режим выключен.');
  }
  if (typeof renderCloudAuth === 'function') renderCloudAuth();
  if (typeof updateCloudAccessGate === 'function') updateCloudAccessGate();
  if (typeof updateCheatButtonVisibility === 'function') updateCheatButtonVisibility();
  if (typeof updateLeaderboardButtonVisibility === 'function') updateLeaderboardButtonVisibility();
}

function cloudIsAllowedToPlay() {
  if (cloudUser) return true;
  if (cloudIsMasterUnlocked()) return true;
  return false;
}

// --------------------------------------------------------
//  АДМИН-РЕЖИМ (v0.13o)
// --------------------------------------------------------

// Является ли текущий игрок админом?
function cloudIsAdmin() {
  if (cloudUser && cloudUser.email) {
    const e = String(cloudUser.email).toLowerCase().trim();
    if (CLOUD_ADMIN_EMAILS.indexOf(e) >= 0) return true;
  }
  if (cloudIsMasterUnlocked()) return true;

  return false;
}

// Показать / скрыть кнопку «ЧИТ» в шапке.
function updateCheatButtonVisibility() {
  const btn = document.getElementById('btn-cheat');
  if (!btn) return;

  const isAdmin = cloudIsAdmin();

  if (isAdmin) {
    btn.style.display = '';
  } else {
    btn.style.display = 'none';
  }
}

// --------------------------------------------------------
//  ИНИЦИАЛИЗАЦИЯ
// --------------------------------------------------------
function initCloud() {
  if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
    console.warn('[cloud] supabase-js не найден — облако отключено, играем локально.');
    return false;
  }

  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('[cloud] Supabase-клиент инициализирован.');

    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (session && session.user) {
        cloudUser = session.user;
      } else {
        cloudUser = null;
        cloudSlotsCache = {};
      }
      if (typeof renderCloudAuth === 'function') renderCloudAuth();

      if (session && session.user) {
        cloudRefreshSlotsAndUI();

        // ---- НОВОЕ (v0.15): чистка призраков в рейтинге ----
        // Через 1.5 секунды после входа — когда saves точно подтянулся.
        setTimeout(() => {
          if (typeof cloudCleanupLeaderboardGhosts === 'function') {
            cloudCleanupLeaderboardGhosts();
          }
        }, 1500);
      }

      if (typeof updateCloudAccessGate === 'function') {
        updateCloudAccessGate();
      }
      if (typeof updateCheatButtonVisibility === 'function') {
        updateCheatButtonVisibility();
      }
      // ---- НОВОЕ: показать кнопку рейтинга ----
      if (typeof updateLeaderboardButtonVisibility === 'function') {
        updateLeaderboardButtonVisibility();
      }
    });

    supabaseClient.auth.getSession().then(({ data }) => {
      if (data && data.session && data.session.user) {
        cloudUser = data.session.user;
      } else {
        cloudUser = null;
      }
      if (typeof renderCloudAuth === 'function') renderCloudAuth();

      if (cloudUser) {
        cloudRefreshSlotsAndUI();
      }

      if (typeof updateCloudAccessGate === 'function') {
        updateCloudAccessGate();
      }
      if (typeof updateCheatButtonVisibility === 'function') {
        updateCheatButtonVisibility();
      }
      // ---- НОВОЕ: показать кнопку рейтинга ----
      if (typeof updateLeaderboardButtonVisibility === 'function') {
        updateLeaderboardButtonVisibility();
      }
    });

    return true;
  } catch (e) {
    console.error('[cloud] Не удалось создать клиент Supabase:', e);
    return false;
  }
}

// --------------------------------------------------------
//  ПЕРЕВОД ОШИБОК SUPABASE НА РУССКИЙ
// --------------------------------------------------------
function translateCloudError(message) {
  if (!message) return 'Неизвестная ошибка';
  const m = String(message).toLowerCase();

  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'Такая почта уже зарегистрирована. Попробуйте войти.';
  }
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return 'Неверный email или пароль.';
  }
  if (m.includes('email not confirmed')) {
    return 'Сначала подтвердите почту по ссылке из письма.';
  }
  if (m.includes('password should be at least')) {
    const numMatch = m.match(/at least (\d+)/);
    const minLen = numMatch ? numMatch[1] : '6';
    return `Пароль слишком короткий (минимум ${minLen} символов).`;
  }
  if (m.includes('password') && m.includes('should be')) {
    return 'Пароль не подходит по требованиям.';
  }
  if (m.includes('unable to validate email') || m.includes('invalid email')) {
    return 'Некорректный email.';
  }
  if (m.includes('signup') && m.includes('disabled')) {
    return 'Регистрация временно отключена.';
  }
  if (m.includes('email rate limit') || m.includes('rate limit')) {
    return 'Слишком много попыток. Подождите минуту.';
  }
  if (m.includes('user not found')) {
    return 'Пользователь с таким email не найден.';
  }
  if (m.includes('token has expired') || m.includes('expired')) {
    return 'Сессия устарела. Войдите заново.';
  }
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('network')) {
    return 'Нет соединения. Играем локально.';
  }
  return message;
}

// --------------------------------------------------------
//  РЕНДЕР БЛОКА АВТОРИЗАЦИИ
// --------------------------------------------------------
function renderCloudAuth() {
  const box = document.getElementById('cloud-auth');
  if (!box) return;

  // v0.29.1: без библиотеки входа раньше блок молча прятался — игрок видел замок и не видел формы.
  if (!supabaseClient) {
    box.style.display = 'block';
    box.innerHTML = `
      <div class="cloud-auth-title">ВХОД В АККАУНТ</div>
      <div class="cloud-auth-status error">
        Не удалось загрузить вход. Проверьте интернет (или VPN) и обновите страницу.
      </div>
      <div class="cloud-auth-buttons">
        <button class="btn" onclick="location.reload()">Обновить</button>
      </div>
    `;
    return;
  }

  box.style.display = 'block';

  if (cloudUser) {
    box.innerHTML = `
      <div class="cloud-auth-user">
        <div class="cloud-auth-user-email">${cloudUser.email || 'аккаунт'}</div>
        <button class="btn danger" onclick="cloudSignOut()">Выйти</button>
      </div>
      <div class="cloud-auth-status ok" id="cloud-auth-status">
        Облачное сохранение активно
      </div>
    `;
    return;
  }

  const masterOn = cloudIsMasterUnlocked();
  const masterHint = masterOn
    ? `<div class="cloud-auth-status ok" style="margin-top:8px;">🛠 Мастер-режим: игра доступна без входа</div>`
    : '';

  box.innerHTML = `
    <div class="cloud-auth-title">ВХОД В АККАУНТ</div>
    <div class="cloud-auth-hint">
      Игра доступна только с аккаунтом.<br>
      Прогресс хранится в облаке и защищён от потери.
    </div>
    <div class="cloud-auth-form">
      <input type="email" id="cloud-email" class="cloud-auth-input" placeholder="email" autocomplete="email">
      <input type="password" id="cloud-password" class="cloud-auth-input" placeholder="пароль" autocomplete="current-password">
    </div>
    <div class="cloud-auth-buttons">
      <button class="btn success" onclick="cloudSignIn()">Войти</button>
      <button class="btn" onclick="cloudSignUp()">Регистрация</button>
    </div>
    <div class="cloud-auth-status" id="cloud-auth-status"></div>
    ${masterHint}
  `;
}

function setCloudStatus(text, kind) {
  const el = document.getElementById('cloud-auth-status');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'cloud-auth-status' + (kind ? ' ' + kind : '');
}

// --------------------------------------------------------
//  РЕГИСТРАЦИЯ
// --------------------------------------------------------
async function cloudSignUp() {
  if (!supabaseClient) return;

  const emailEl = document.getElementById('cloud-email');
  const passEl = document.getElementById('cloud-password');
  if (!emailEl || !passEl) return;

  const email = (emailEl.value || '').trim();
  const password = passEl.value || '';

  if (!email || !password) {
    setCloudStatus('Введите email и пароль.', 'error');
    return;
  }
  if (password.length < 6) {
    setCloudStatus('Пароль не короче 6 символов.', 'error');
    return;
  }

  setCloudStatus('Регистрируем...', null);

  try {
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
      setCloudStatus('Ошибка: ' + translateCloudError(error.message), 'error');
      return;
    }

    if (data && data.user && !data.session) {
      setCloudStatus('Проверьте почту для подтверждения.', 'ok');
      return;
    }

    setCloudStatus('Готово! Вы вошли.', 'ok');
    if (typeof showToast === 'function') showToast('☁️', 'Регистрация успешна');
  } catch (e) {
    console.error('[cloud] signUp error:', e);
    setCloudStatus('Сеть недоступна. Играем локально.', 'error');
  }
}

// --------------------------------------------------------
//  ВХОД
// --------------------------------------------------------
async function cloudSignIn() {
  if (!supabaseClient) return;

  const emailEl = document.getElementById('cloud-email');
  const passEl = document.getElementById('cloud-password');
  if (!emailEl || !passEl) return;

  const email = (emailEl.value || '').trim();
  const password = passEl.value || '';

  if (!email || !password) {
    setCloudStatus('Введите email и пароль.', 'error');
    return;
  }

  setCloudStatus('Входим...', null);

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      setCloudStatus('Ошибка: ' + translateCloudError(error.message), 'error');
      return;
    }

    setCloudStatus('Вы вошли.', 'ok');
    if (typeof showToast === 'function') showToast('☁️', 'Вход выполнен');
  } catch (e) {
    console.error('[cloud] signIn error:', e);
    setCloudStatus('Сеть недоступна. Играем локально.', 'error');
  }
}

// --------------------------------------------------------
//  ВЫХОД
// --------------------------------------------------------
async function cloudSignOut() {
  if (!supabaseClient) return;

  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      console.error('[cloud] signOut error:', error);
      if (typeof showToast === 'function') showToast('☁️', 'Ошибка выхода');
      return;
    }
    if (typeof showToast === 'function') showToast('☁️', 'Вы вышли из аккаунта');
  } catch (e) {
    console.error('[cloud] signOut error:', e);
  }
}

// ========================================================
//  ЭТАП 3.1: РАБОТА СО СЛОТАМИ
// ========================================================

function cloudIsReady() {
  return !!(supabaseClient && cloudUser);
}

async function cloudFetchAllSlots() {
  if (!cloudIsReady()) {
    return { ok: false, error: 'not authorized', slots: {} };
  }

  try {
    const { data, error } = await supabaseClient
      .from(SUPABASE_TABLE)
      .select('slot, data, updated_at')
      .eq('user_id', cloudUser.id);

    if (error) {
      console.warn('[cloud] fetchAllSlots error:', error.message);
      return { ok: false, error: error.message, slots: {} };
    }

    const slots = {};
    (data || []).forEach(row => {
      slots[row.slot] = {
        data: imgPathsToWebp(row.data),   // v0.36.2: старые пути картинок → .webp
        updatedAt: row.updated_at,
      };
    });

    return { ok: true, slots };
  } catch (e) {
    console.warn('[cloud] fetchAllSlots exception:', e);
    return { ok: false, error: String(e), slots: {} };
  }
}

async function cloudFetchSlot(slotIndex) {
  if (!cloudIsReady()) {
    return { ok: false, error: 'not authorized' };
  }

  try {
    const { data, error } = await supabaseClient
      .from(SUPABASE_TABLE)
      .select('data, updated_at')
      .eq('user_id', cloudUser.id)
      .eq('slot', slotIndex)
      .maybeSingle();

    if (error) {
      console.warn('[cloud] fetchSlot error:', error.message);
      return { ok: false, error: error.message };
    }

    if (!data) {
      return { ok: true, data: null };
    }

    return { ok: true, data: imgPathsToWebp(data.data), updatedAt: data.updated_at };   // v0.36.2: старые пути картинок → .webp
  } catch (e) {
    console.warn('[cloud] fetchSlot exception:', e);
    return { ok: false, error: String(e) };
  }
}

async function cloudSaveSlot(slotIndex, payload) {
  if (!cloudIsReady()) {
    return { ok: false, error: 'not authorized' };
  }

  try {
    const { data, error } = await supabaseClient
      .from(SUPABASE_TABLE)
      .upsert(
        {
          user_id: cloudUser.id,
          slot: slotIndex,
          data: payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,slot' }
      )
      .select('updated_at')
      .maybeSingle();

    if (error) {
      console.warn('[cloud] saveSlot error:', error.message);

      const isNetwork = /fetch|network|timeout/i.test(error.message);
      if (isNetwork) {
        cloudToastThrottled('offline', '⚠', 'Нет связи — играем локально', 'offline');
      } else {
        cloudToastThrottled('error', '❌', 'Не удалось сохранить в облако', 'error');
      }

      return { ok: false, error: error.message };
    }

    cloudResetOfflineFlag();
    cloudToastThrottled('saved', '☁️', 'Сохранено в облако', 'saved');

    return { ok: true, updatedAt: data ? data.updated_at : null };
  } catch (e) {
    console.warn('[cloud] saveSlot exception:', e);

    const isNetwork = /fetch|network|timeout/i.test(String(e));
    if (isNetwork) {
      cloudToastThrottled('offline', '⚠', 'Нет связи — играем локально', 'offline');
    } else {
      cloudToastThrottled('error', '❌', 'Не удалось сохранить в облако', 'error');
    }

    return { ok: false, error: String(e) };
  }
}

async function cloudDeleteSlot(slotIndex) {
  if (!cloudIsReady()) {
    return { ok: false, error: 'not authorized' };
  }

  try {
    const { error } = await supabaseClient
      .from(SUPABASE_TABLE)
      .delete()
      .eq('user_id', cloudUser.id)
      .eq('slot', slotIndex);

    if (error) {
      console.warn('[cloud] deleteSlot error:', error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (e) {
    console.warn('[cloud] deleteSlot exception:', e);
    return { ok: false, error: String(e) };
  }
}

// ========================================================
//  ЭТАП 3.3: КЭШ ОБЛАЧНЫХ СЛОТОВ + PREFETCH
// ========================================================

function cloudGetCachedSlots() {
  return cloudSlotsCache;
}

function cloudGetCachedSlot(slotIndex) {
  return cloudSlotsCache[slotIndex] || null;
}

async function cloudPrefetchSlots() {
  if (!cloudIsReady()) {
    cloudSlotsCache = {};
    return { ok: false, error: 'not authorized', slots: {} };
  }

  const res = await cloudFetchAllSlots();
  if (res.ok) {
    cloudSlotsCache = res.slots || {};
    cloudResetOfflineFlag();
  }
  return res;
}

function cloudClearCache() {
  cloudSlotsCache = {};
}

// ========================================================
//  ЭТАП 4.1: СРАВНЕНИЕ ЛОКАЛЬНОГО И ОБЛАЧНОГО СЛОТОВ
// ========================================================

const CLOUD_CONFLICT_THRESHOLD_MS = 5 * 1000;

function cloudDiffMs(isoA, isoB) {
  if (!isoA || !isoB) return Infinity;
  const tA = new Date(isoA).getTime();
  const tB = new Date(isoB).getTime();
  if (isNaN(tA) || isNaN(tB)) return Infinity;
  return Math.abs(tA - tB);
}

function cloudIsProbablySameTime(isoA, isoB) {
  return cloudDiffMs(isoA, isoB) <= CLOUD_CONFLICT_THRESHOLD_MS;
}

function cloudDescribeSave(payload) {
  if (!payload || !payload.player) return null;

  const p = payload.player;
  const cls = (typeof CLASSES !== 'undefined' && CLASSES[p.classId]) ? CLASSES[p.classId].name : '—';
  const race = (typeof RACES !== 'undefined' && RACES[p.raceId]) ? RACES[p.raceId].name : '—';

  return {
    name: p.name || 'Безымянный',
    classId: p.classId || null,
    className: cls,
    raceId: p.raceId || 'human',
    raceName: race,
    level: p.level || 1,
  };
}

function cloudCompareSlots(slotIndex) {
  let localPayload = null;
  let localUpdatedAt = null;

  if (typeof readSlot === 'function') {
    localPayload = readSlot(slotIndex);
    if (localPayload) {
      localUpdatedAt = localPayload.updatedAt || null;
    }
  }

  const cached = cloudGetCachedSlot(slotIndex);
  let cloudPayload = null;
  let cloudUpdatedAt = null;

  if (cached) {
    cloudPayload = cached.data || null;
    cloudUpdatedAt = cached.updatedAt || null;
  }

  const hasLocal = !!localPayload;
  const hasCloud = !!cloudPayload;

  let status = 'none';
  if (hasLocal && !hasCloud) status = 'only-local';
  else if (!hasLocal && hasCloud) status = 'only-cloud';
  else if (hasLocal && hasCloud) {
    status = cloudIsProbablySameTime(localUpdatedAt, cloudUpdatedAt)
      ? 'both-same'
      : 'both-diff';
  }

  const diffMs = (hasLocal && hasCloud)
    ? cloudDiffMs(localUpdatedAt, cloudUpdatedAt)
    : Infinity;

  let newer = null;
  if (status === 'both-diff') {
    const tLocal = new Date(localUpdatedAt).getTime();
    const tCloud = new Date(cloudUpdatedAt).getTime();
    if (!isNaN(tLocal) && !isNaN(tCloud)) {
      newer = tLocal > tCloud ? 'local' : 'cloud';
    } else {
      newer = 'local';
    }
  }

  return {
    status,
    local: hasLocal
      ? { payload: localPayload, updatedAt: localUpdatedAt, info: cloudDescribeSave(localPayload) }
      : null,
    cloud: hasCloud
      ? { payload: cloudPayload, updatedAt: cloudUpdatedAt, info: cloudDescribeSave(cloudPayload) }
      : null,
    diffMs,
    newer,
  };
}

function cloudFormatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '—';

  const pad = (n) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const mon = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hour = pad(d.getHours());
  const min = pad(d.getMinutes());
  const sec = pad(d.getSeconds());

  return `${day}.${mon}.${year}, ${hour}:${min}:${sec}`;
}

// ========================================================
//  ЭТАП 4.2: МОДАЛКА РАЗРЕШЕНИЯ КОНФЛИКТОВ
// ========================================================

let __cloudConflictContext = null;

function cloudShowConflictModal(slotIndex, onChoose, onCancel) {
  const overlay = document.getElementById('cloud-conflict-overlay');
  if (!overlay) {
    console.warn('[cloud] модалка конфликта не найдена в DOM');
    return;
  }

  const cmp = cloudCompareSlots(slotIndex);
  __cloudConflictContext = { slotIndex, onChoose, onCancel, cmp };

  const localInfo = document.getElementById('conflict-local-info');
  const localTime = document.getElementById('conflict-local-time');
  const localBadge = document.getElementById('conflict-local-badge');
  const localCard = document.getElementById('conflict-local-card');

  if (cmp.local && cmp.local.info) {
    localInfo.innerHTML = `
      <span class="name">${cmp.local.info.name}</span>
      <div class="line">${cmp.local.info.raceName} · ${cmp.local.info.className}</div>
      <div class="line">Уровень: ${cmp.local.info.level}</div>
    `;
    localTime.textContent = `Обновлён: ${cloudFormatDate(cmp.local.updatedAt)}`;
    localCard.style.display = 'block';
  } else {
    localInfo.innerHTML = `<div class="line">Нет локального сейва</div>`;
    localTime.textContent = '';
    localCard.style.display = 'none';
  }

  const cloudInfo = document.getElementById('conflict-cloud-info');
  const cloudTime = document.getElementById('conflict-cloud-time');
  const cloudBadge = document.getElementById('conflict-cloud-badge');
  const cloudCard = document.getElementById('conflict-cloud-card');

  if (cmp.cloud && cmp.cloud.info) {
    cloudInfo.innerHTML = `
      <span class="name">${cmp.cloud.info.name}</span>
      <div class="line">${cmp.cloud.info.raceName} · ${cmp.cloud.info.className}</div>
      <div class="line">Уровень: ${cmp.cloud.info.level}</div>
    `;
    cloudTime.textContent = `Обновлён: ${cloudFormatDate(cmp.cloud.updatedAt)}`;
    cloudCard.style.display = 'block';
  } else {
    cloudInfo.innerHTML = `<div class="line">Нет облачного сейва</div>`;
    cloudTime.textContent = '';
    cloudCard.style.display = 'none';
  }

  localCard.classList.remove('newer');
  cloudCard.classList.remove('newer');
  localBadge.classList.remove('visible');
  cloudBadge.classList.remove('visible');

  if (cmp.newer === 'local') {
    localCard.classList.add('newer');
    localBadge.textContent = 'свежее';
    localBadge.classList.add('visible');
  } else if (cmp.newer === 'cloud') {
    cloudCard.classList.add('newer');
    cloudBadge.textContent = 'свежее';
    cloudBadge.classList.add('visible');
  }

  const hint = document.getElementById('cloud-conflict-hint');
  if (cmp.newer === 'local') {
    hint.innerHTML = '💡 <b>Локальный сейв свежее.</b> Скорее всего, он более актуален.';
  } else if (cmp.newer === 'cloud') {
    hint.innerHTML = '💡 <b>Облачный сейв свежее.</b> Возможно, вы играли с другого устройства.';
  } else {
    hint.textContent = 'Время обновления одинаковое. Выбирайте по уровню и персонажу.';
  }

  overlay.classList.add('active');
}

function cloudConflictCancel() {
  const overlay = document.getElementById('cloud-conflict-overlay');
  if (overlay) overlay.classList.remove('active');

  const ctx = __cloudConflictContext;
  __cloudConflictContext = null;

  if (ctx && typeof ctx.onCancel === 'function') {
    ctx.onCancel();
  }
}

function cloudConflictChoose(source) {
  const overlay = document.getElementById('cloud-conflict-overlay');
  if (overlay) overlay.classList.remove('active');

  const ctx = __cloudConflictContext;
  __cloudConflictContext = null;

  if (!ctx) return;

  if (source === 'cloud') {
    if (typeof ctx.onChoose === 'function') {
      ctx.onChoose('cloud');
    }
    return;
  }

  if (typeof ctx.onChoose === 'function') {
    ctx.onChoose('local');
  }
}

document.addEventListener('click', (e) => {
  const overlay = document.getElementById('cloud-conflict-overlay');
  if (!overlay || !overlay.classList.contains('active')) return;
  if (e.target === overlay) cloudConflictCancel();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const overlay = document.getElementById('cloud-conflict-overlay');
  if (overlay && overlay.classList.contains('active')) cloudConflictCancel();
});

// ========================================================
//  УР.2.2: МИГРАЦИЯ ЛОКАЛЬНЫХ СЕЙВОВ В ОБЛАКО
// ========================================================

const CLOUD_MIGRATION_FLAG = 'l2browser_migration_done';

function cloudShouldAskMigration() {
  return localStorage.getItem(CLOUD_MIGRATION_FLAG) !== '1';
}

function cloudMarkMigrationDone() {
  localStorage.setItem(CLOUD_MIGRATION_FLAG, '1');
}

function cloudResetMigrationFlag() {
  localStorage.removeItem(CLOUD_MIGRATION_FLAG);
}

// Собрать слоты, которые надо залить.
function cloudGetSlotsToMigrate() {
  const result = [];

  if (typeof SLOT_COUNT === 'undefined') return result;
  if (typeof readSlot !== 'function') return result;

  for (let i = 0; i < SLOT_COUNT; i++) {
    const local = readSlot(i);
    if (!local) continue;

    const cloud = cloudGetCachedSlot(i);
    const hasCloud = !!(cloud && cloud.data);

    if (!hasCloud) {
      result.push(i);
    }
  }

  return result;
}

// Залить один слот.
async function cloudMigrateOneSlot(slotIndex) {
  const localPayload = (typeof readSlot === 'function') ? readSlot(slotIndex) : null;
  if (!localPayload) {
    return { ok: false, error: 'no local payload' };
  }

  const payload = {
    player: localPayload.player,
    battle: localPayload.battle,
    cheat: localPayload.cheat,
  };

  const res = await cloudSaveSlot(slotIndex, payload);
  return res;
}

// Залить все слоты.
async function cloudMigrateAll() {
  if (!cloudIsReady()) {
    return { ok: false, total: 0, migrated: 0, failed: 0, error: 'not authorized' };
  }

  const slots = cloudGetSlotsToMigrate();
  if (slots.length === 0) {
    return { ok: true, total: 0, migrated: 0, failed: 0 };
  }

  let migrated = 0;
  let failed = 0;

  for (const slotIndex of slots) {
    const res = await cloudMigrateOneSlot(slotIndex);
    if (res && res.ok) {
      migrated++;
      if (typeof SLOT_KEY_PREFIX !== 'undefined') {
        try {
          localStorage.removeItem(SLOT_KEY_PREFIX + slotIndex);
        } catch (e) {
          console.warn('[cloud] не удалось удалить локальный слот', slotIndex, e);
        }
      }
    } else {
      failed++;
      console.warn('[cloud] не удалось залить слот', slotIndex, res && res.error);
    }
  }

  await cloudPrefetchSlots();

  return { ok: true, total: slots.length, migrated, failed };
}

// --------------------------------------------------------
//  МОДАЛКА МИГРАЦИИ
// --------------------------------------------------------

let __cloudMigrationPending = false;

function cloudTryShowMigrationModal() {
  if (!cloudShouldAskMigration()) return;
  if (__cloudMigrationPending) return;
  if (!cloudIsReady()) return;

  const slots = cloudGetSlotsToMigrate();
  if (slots.length === 0) return;

  const overlay = document.getElementById('cloud-migration-overlay');
  if (!overlay) return;

  __cloudMigrationPending = true;

  const countEl = document.getElementById('cloud-migration-count');
  if (countEl) countEl.textContent = slots.length;

  overlay.classList.add('active');
}

function cloudMigrationCancel() {
  const overlay = document.getElementById('cloud-migration-overlay');
  if (overlay) overlay.classList.remove('active');
  __cloudMigrationPending = false;
}

function cloudMigrationSkipForever() {
  cloudMarkMigrationDone();
  cloudMigrationCancel();
  if (typeof showToast === 'function') showToast('✅', 'Больше не будем спрашивать');
}

async function cloudMigrationDoIt() {
  const overlay = document.getElementById('cloud-migration-overlay');
  if (overlay) overlay.classList.remove('active');
  __cloudMigrationPending = false;

  if (typeof showToast === 'function') showToast('☁️', 'Заливаем сохранения...');

  const res = await cloudMigrateAll();

  if (!res || !res.ok) {
    if (typeof showToast === 'function') showToast('❌', 'Не удалось залить сохранения');
    return;
  }

  if (res.migrated > 0 && typeof showToast === 'function') {
    showToast('✅', `Залито в облако: ${res.migrated} ${pluralizeSlots(res.migrated)}`);
  }
  if (res.failed > 0 && typeof showToast === 'function') {
    showToast('⚠', `Не залито: ${res.failed}. Попробуем позже`);
  }

  if (typeof renderSlots === 'function') renderSlots();
  if (typeof updateCloudAccessGate === 'function') updateCloudAccessGate();
}

function pluralizeSlots(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'слотов';
  if (mod10 === 1) return 'слот';
  if (mod10 >= 2 && mod10 <= 4) return 'слота';
  return 'слотов';
}

// ========================================================
//  УР.2.3 (v0.13o): АДМИН-РЕЖИМ
// ========================================================

// Является ли текущий игрок админом?
function cloudIsAdmin() {
  if (cloudUser && cloudUser.email) {
    const e = String(cloudUser.email).toLowerCase().trim();
    if (CLOUD_ADMIN_EMAILS.indexOf(e) >= 0) return true;
  }
  if (cloudIsMasterUnlocked()) return true;

  return false;
}

// Показать / скрыть кнопку «ЧИТ» в шапке.
function updateCheatButtonVisibility() {
  const btn = document.getElementById('btn-cheat');
  if (!btn) return;

  const isAdmin = cloudIsAdmin();

  if (isAdmin) {
    btn.style.display = '';
  } else {
    btn.style.display = 'none';
  }
}