// ========================================================
//  СИСТЕМЫ: СЛОТЫ СОХРАНЕНИЯ
//  5 слотов в localStorage.
//
//  НОВОЕ (v0.13e):
//  + saveCurrentSlot() теперь дублирует запись в облако
//    (если игрок вошёл). Ошибки сети не ломают игру.
//  + deleteSlot() теперь дублирует удаление в облако.
//  + Новая функция readSlotUpdatedAt(slotIndex) — читает
//    метку времени локального сейва (для сравнения
//    с облаком на Этапе 4).
//
//  НОВОЕ (v0.15):
//  + deleteSlot() — оптимистичное удаление.
//    Слот исчезает МГНОВЕННО (локально + из кеша облака),
//    слоты сразу перерисовываются.
//    Запрос в облако идёт в фоне.
//    Если облако вернуло ошибку — слот ВОЗВРАЩАЕТСЯ
//    обратно в кеш + показывается тост.
//  + saveCurrentSlot() дополнительно пушит строку в рейтинг.
//  + deleteSlot() после успеха удаляет строку из рейтинга.
// ========================================================

const SLOT_COUNT = 5;
const SLOT_KEY_PREFIX = 'l2browser_slot_';

// --------------------------------------------------------
//  v0.36.3: СТРАХОВОЧНАЯ КОПИЯ СЛОТА
//  Перед перезаписью слота облачным сейвом кладём прежнюю строку
//  в ключ ..._bak. Если основная строка побьётся, читаем копию —
//  вместо того чтобы показать игроку «пустой слот» и потерять героя.
// --------------------------------------------------------
function slotBackupKey(slotIndex) {
  return SLOT_KEY_PREFIX + slotIndex + '_bak';
}

function backupLocalSlot(slotIndex) {
  try {
    const raw = localStorage.getItem(SLOT_KEY_PREFIX + slotIndex);
    if (!raw) return false;
    localStorage.setItem(slotBackupKey(slotIndex), raw);
    return true;
  } catch (e) {
    return false;
  }
}

// Разобранный сейв: основная строка, а при битом JSON — запасная копия.
// Парсим один раз: карточки ячеек читают мету сразу после полного чтения.
function readSlotData(slotIndex) {
  const raw = localStorage.getItem(SLOT_KEY_PREFIX + slotIndex);
  if (!raw) return null;   // слот пуст или удалён — копию не подсовываем
  try { return JSON.parse(raw); } catch (e) {}
  const bak = localStorage.getItem(slotBackupKey(slotIndex));
  if (bak) {
    try {
      const data = JSON.parse(bak);
      console.warn('[slot] слот ' + slotIndex + ': основная строка повреждена — читаем копию');
      return data;
    } catch (e) {}
  }
  return null;
}

// Прочитать мету слота (для ячейки).
// Возвращает { used, name, classId, raceId, level, updatedAt? }.
function readSlotMeta(slotIndex) {
  const data = readSlotData(slotIndex);
  if (!data) return { used: false };
  return {
    used: true,
    name: data.player && data.player.name,
    classId: data.player && data.player.classId,
    raceId: data.player && data.player.raceId,
    level: data.player && data.player.level,
    updatedAt: data.updatedAt || null,
  };
}

// Прочитать полное сохранение (для загрузки в игру).
function readSlot(slotIndex) {
  const data = readSlotData(slotIndex);
  if (!data) return null;
  try {
    return imgPathsToWebp(data);   // v0.36.2: старые пути картинок → .webp
  } catch (e) {
    return data;                   // лучше без перевода путей, чем без героя
  }
}

// Прочитать метку времени локального слота (ISO-строка или null).
// Используется для сравнения с облаком.
function readSlotUpdatedAt(slotIndex) {
  const data = readSlotData(slotIndex);
  return data ? (data.updatedAt || null) : null;
}

// ========================================================
//  v0.36.4: ГЕРОИ ПРИВЯЗАНЫ К АККАУНТУ
//  Облако — главное хранилище, локальный слот — его копия на устройстве.
//  У каждого локального сейва есть uid — чей он. Зашли другим аккаунтом —
//  чужие герои откладываются в сторону (ключ l2browser_park_<uid>_<слот>),
//  не показываются и никуда не заливаются; вернутся, когда зайдёт хозяин.
//  Старые сейвы без uid отдаём аккаунту, который последним синхронизировал
//  склад на этом устройстве (l2browser_storage_user), а если такого нет
//  (герой ещё из времён до аккаунтов) — тому, кто вошёл сейчас.
//  cloudSeen — сейв хоть раз был принят облаком: если в облаке его больше нет,
//  значит героя удалили на другом устройстве — не воскрешаем.
// ========================================================
const SLOT_PARK_PREFIX = 'l2browser_park_';
const SLOT_CLOUD_SEEN = {};   // слот → облако уже принимало его сейв (в этой сессии или раньше)

function slotOwnerId() {
  return (typeof cloudUser !== 'undefined' && cloudUser && cloudUser.id) || null;
}

function slotParkKey(owner, slotIndex) {
  return SLOT_PARK_PREFIX + owner + '_' + slotIndex;
}

// Переложить слот в сторону (вместе с запасной копией). Более свежий отложенный не затираем старым.
function slotPark(owner, slotIndex, tag) {
  const key = SLOT_KEY_PREFIX + slotIndex;
  const raw = localStorage.getItem(key);
  if (!raw) return false;
  const pk = slotParkKey(tag ? tag + '_' + owner : owner, slotIndex);
  try {
    const prev = localStorage.getItem(pk);
    const newer = (a, b) => { try { return (JSON.parse(a).updatedAt || '') >= (JSON.parse(b).updatedAt || ''); } catch (e) { return true; } };
    if (!prev || newer(raw, prev)) {
      localStorage.setItem(pk, raw);
      const bak = localStorage.getItem(slotBackupKey(slotIndex));
      if (bak) localStorage.setItem(pk + '_bak', bak);
    }
    localStorage.removeItem(key);
    localStorage.removeItem(slotBackupKey(slotIndex));
    return true;
  } catch (e) {
    console.warn('[slot] не удалось отложить слот', slotIndex, e);
    return false;
  }
}

// При входе в аккаунт: пометить свои, отложить чужие, вернуть свои отложенные.
function slotsClaimForAccount() {
  const uid = slotOwnerId();
  const res = { parked: 0, restored: 0, tagged: 0 };
  if (!uid) return res;
  let last = null;
  try { last = localStorage.getItem('l2browser_storage_user'); } catch (e) {}

  for (let i = 0; i < SLOT_COUNT; i++) {
    const key = SLOT_KEY_PREFIX + i;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    let data;
    try { data = JSON.parse(raw); } catch (e) { continue; }   // битую строку не трогаем — её прочтёт запасная копия
    let owner = data.uid || null;
    if (!owner) {
      owner = (last && last !== uid) ? last : uid;
      data.uid = owner;
      try { localStorage.setItem(key, JSON.stringify(data)); res.tagged++; } catch (e) {}
    }
    if (owner !== uid && slotPark(owner, i)) res.parked++;
  }

  for (let i = 0; i < SLOT_COUNT; i++) {
    const pk = slotParkKey(uid, i);
    const praw = localStorage.getItem(pk);
    if (!praw || localStorage.getItem(SLOT_KEY_PREFIX + i)) continue;
    try {
      localStorage.setItem(SLOT_KEY_PREFIX + i, praw);
      const pbak = localStorage.getItem(pk + '_bak');
      if (pbak) localStorage.setItem(slotBackupKey(i), pbak);
      localStorage.removeItem(pk);
      localStorage.removeItem(pk + '_bak');
      res.restored++;
    } catch (e) {}
  }
  if (res.parked || res.restored) console.log('[slot] аккаунт сменился: отложено', res.parked, ', возвращено', res.restored);
  return res;
}

// Записать сохранение в слот (локально).
// Сохраняем и сам объект state, и метку времени updatedAt,
// чтобы можно было сравнить с облаком.
function writeSlot(slotIndex, stateObj) {
  try {
    const uid = slotOwnerId();
    const payload = Object.assign({}, stateObj, {
      updatedAt: new Date().toISOString(),
      // v0.36.3: версия формата — чтобы будущие правки полей знали, откуда мигрировать
      v: (typeof SAVE_VERSION === 'number') ? SAVE_VERSION : undefined,
      // v0.36.4: чей это герой (аккаунт) и бывал ли сейв в облаке — см. slotsClaimForAccount
      uid: uid || stateObj.uid || undefined,
      cloudSeen: SLOT_CLOUD_SEEN[slotIndex] === true || stateObj.cloudSeen === true || undefined,
    });
    localStorage.setItem(SLOT_KEY_PREFIX + slotIndex, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.error('Не удалось сохранить слот', slotIndex, e);
    warnSlotSaveFailed(e);   // v0.36.3: сказать игроку, а не только в консоль
    return false;
  }
}

// --------------------------------------------------------
//  v0.36.3: ПРЕДУПРЕЖДЕНИЕ О НЕУДАЧНОЙ ЗАПИСИ
//  Раньше ошибка записи уходила только в консоль: игрок мог час
//  играть, а потом обнаружить, что прогресса нет. Теперь говорим
//  об этом прямо — но не чаще раза в 30 секунд, чтобы не заспамить.
// --------------------------------------------------------
let slotSaveErrorShownAt = 0;

function warnSlotSaveFailed(e) {
  const now = Date.now();
  if (now - slotSaveErrorShownAt < 30000) return;
  slotSaveErrorShownAt = now;
  if (typeof showToast !== 'function') return;

  const quota = !!e && (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014
  );

  if (quota) {
    showToast('⚠', 'В браузере кончилось место — герой не сохраняется локально. Освободите место, иначе прогресс только в облаке.');
  } else {
    showToast('⚠', 'Не удалось сохранить героя в браузере. Если включён режим инкогнито — сохранение не работает.');
  }
}

// ========================================================
//  УДАЛЕНИЕ СЛОТА (ОПТИМИСТИЧНОЕ, v0.15)
// ========================================================
//  Порядок:
//   1. Запоминаем, что было в кеше облака (на случай отката).
//   2. Удаляем локально (localStorage).
//   3. Убираем слот из кеша облака (сразу, оптимистично).
//   4. Перерисовываем слоты (слот исчезает мгновенно).
//   5. Шлём запрос в облако В ФОНЕ.
//   6. Если облако ответило ошибкой — возвращаем слот в кеш,
//      перерисовываем обратно + показываем тост.
//   7. После успеха — удаляем строку из рейтинга.
// ========================================================
function deleteSlot(slotIndex) {
  // ---- 1. Запоминаем, что было в кеше облака (на случай отката) ----
  let cachedBefore = null;
  if (typeof cloudGetCachedSlot === 'function') {
    const c = cloudGetCachedSlot(slotIndex);
    if (c) cachedBefore = JSON.parse(JSON.stringify(c));
  }

  // ---- 2. Локально ----
  delete SLOT_CLOUD_SEEN[slotIndex];   // v0.36.4: новый герой в этой ячейке облаку ещё не знаком
  localStorage.removeItem(SLOT_KEY_PREFIX + slotIndex);
  localStorage.removeItem(slotBackupKey(slotIndex));   // v0.36.3: иначе герой вернётся из копии

  // ---- 3. Из кеша облака (сразу, оптимистично) ----
  if (typeof cloudGetCachedSlots === 'function') {
    const cache = cloudGetCachedSlots();
    if (cache && cache[slotIndex]) {
      delete cache[slotIndex];
    }
  }

  // ---- 4. Перерисовываем слоты сразу ----
  if (typeof renderSlots === 'function') {
    const startScreen = document.getElementById('start-screen');
    if (startScreen && startScreen.classList.contains('active')) {
      renderSlots();
    }
  }

  // ---- 5. В фоне чистим облако ----
  if (typeof cloudIsReady === 'function' && cloudIsReady()) {
    if (typeof cloudDeleteSlot === 'function') {
      cloudDeleteSlot(slotIndex).then(res => {
        if (!res || !res.ok) {
          console.warn('[cloud] не удалось удалить слот из облака:', res && res.error);

          // ---- ОТКАТ: возвращаем слот в кеш ----
          if (cachedBefore && typeof cloudGetCachedSlots === 'function') {
            const cache = cloudGetCachedSlots();
            if (cache) cache[slotIndex] = cachedBefore;
          }

          // ---- Перерисовываем слоты обратно ----
          if (typeof renderSlots === 'function') {
            const startScreen = document.getElementById('start-screen');
            if (startScreen && startScreen.classList.contains('active')) {
              renderSlots();
            }
          }

          // ---- Сообщаем игроку ----
          if (typeof showToast === 'function') {
            showToast('⚠', 'Не удалось удалить из облака — слот вернулся');
          }
          return;
        }

        // ---- Успех: удаляем строку из рейтинга ----
        if (typeof cloudDeleteLeaderboardRow === 'function') {
          cloudDeleteLeaderboardRow(slotIndex);
        }
      }).catch(err => {
        console.warn('[cloud] deleteSlot exception:', err);

        // ---- ОТКАТ при исключении ----
        if (cachedBefore && typeof cloudGetCachedSlots === 'function') {
          const cache = cloudGetCachedSlots();
          if (cache) cache[slotIndex] = cachedBefore;
        }

        if (typeof renderSlots === 'function') {
          const startScreen = document.getElementById('start-screen');
          if (startScreen && startScreen.classList.contains('active')) {
            renderSlots();
          }
        }

        if (typeof showToast === 'function') {
          showToast('⚠', 'Сеть недоступна — слот вернулся');
        }
      });
    }
  }
}

// Записать текущий state в АКТИВНЫЙ слот (локально + облако).
// Активный слот — тот, с которым сейчас играем (state.activeSlotIndex).
// v0.36.2: в бою сохраняем не на каждого убитого, а не чаще раза в SLOT_SAVE_MIN_GAP_MS
// (стая из шести от массового навыка раньше давала шесть сохранений и шесть запросов
// в облако в один миг). Отложенное сохранение дожимает игровой тик (battle-loop.js),
// а при сворачивании или закрытии игры оно делается сразу.
const SLOT_SAVE_MIN_GAP_MS = 4000;
let slotSaveLast = 0;
let slotSavePending = false;

function saveCurrentSlotSoon() {
  if (performance.now() - slotSaveLast >= SLOT_SAVE_MIN_GAP_MS) saveCurrentSlot();
  else slotSavePending = true;
}
function flushPendingSlotSave(force) {
  if (!slotSavePending) return;
  if (force || performance.now() - slotSaveLast >= SLOT_SAVE_MIN_GAP_MS) saveCurrentSlot();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) flushPendingSlotSave(true); });
window.addEventListener('pagehide', () => flushPendingSlotSave(true));

function saveCurrentSlot() {
  slotSavePending = false;
  if (state.activeSlotIndex === null || state.activeSlotIndex === undefined) return;
  slotSaveLast = performance.now();

  // ---- Формируем тот же payload, что и раньше ----
  const payload = {
    player: state.player,
    battle: state.battle,
    cheat: state.cheat,
    // v0.36.3: версия едет и в облако — иначе облачный сейв всегда выглядел бы как «нулевая версия»
    v: (typeof SAVE_VERSION === 'number') ? SAVE_VERSION : undefined,
  };

  // ---- Локально (как было) ----
  writeSlot(state.activeSlotIndex, payload);

  // ---- Облако (новое, тихо) ----
  // Только если игрок вошёл. Ошибки сети не ломают игру.
  if (typeof cloudIsReady === 'function' && cloudIsReady()) {
    if (typeof cloudSaveSlot === 'function') {
      const savedSlot = state.activeSlotIndex;
      cloudSaveSlot(savedSlot, payload).then(res => {
        if (res && res.ok) SLOT_CLOUD_SEEN[savedSlot] = true;   // v0.36.4: облако знает этого героя
        if (!res || !res.ok) {
          console.warn('[cloud] не удалось сохранить слот в облако:', res && res.error);
        }
      }).catch(err => {
        console.warn('[cloud] saveSlot exception:', err);
      });
    }
  }

  // ---- РЕЙТИНГ: пушим свою строку (throttle внутри) ----
  if (typeof cloudPushLeaderboard === 'function') {
    cloudPushLeaderboard(false);
  }
}