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

// Прочитать мету слота (для ячейки).
// Возвращает { used, name, classId, raceId, level, updatedAt? }.
function readSlotMeta(slotIndex) {
  try {
    const raw = localStorage.getItem(SLOT_KEY_PREFIX + slotIndex);
    if (!raw) return { used: false };
    const data = JSON.parse(raw);
    return {
      used: true,
      name: data.player && data.player.name,
      classId: data.player && data.player.classId,
      raceId: data.player && data.player.raceId,
      level: data.player && data.player.level,
      updatedAt: data.updatedAt || null,
    };
  } catch (e) {
    return { used: false };
  }
}

// Прочитать полное сохранение (для загрузки в игру).
function readSlot(slotIndex) {
  try {
    const raw = localStorage.getItem(SLOT_KEY_PREFIX + slotIndex);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// Прочитать метку времени локального слота (ISO-строка или null).
// Используется для сравнения с облаком.
function readSlotUpdatedAt(slotIndex) {
  try {
    const raw = localStorage.getItem(SLOT_KEY_PREFIX + slotIndex);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data.updatedAt || null;
  } catch (e) {
    return null;
  }
}

// Записать сохранение в слот (локально).
// Сохраняем и сам объект state, и метку времени updatedAt,
// чтобы можно было сравнить с облаком.
function writeSlot(slotIndex, stateObj) {
  try {
    const payload = Object.assign({}, stateObj, {
      updatedAt: new Date().toISOString(),
    });
    localStorage.setItem(SLOT_KEY_PREFIX + slotIndex, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.error('Не удалось сохранить слот', slotIndex, e);
    return false;
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
  localStorage.removeItem(SLOT_KEY_PREFIX + slotIndex);

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
function saveCurrentSlot() {
  if (state.activeSlotIndex === null || state.activeSlotIndex === undefined) return;

  // ---- Формируем тот же payload, что и раньше ----
  const payload = {
    player: state.player,
    battle: state.battle,
    cheat: state.cheat,
  };

  // ---- Локально (как было) ----
  writeSlot(state.activeSlotIndex, payload);

  // ---- Облако (новое, тихо) ----
  // Только если игрок вошёл. Ошибки сети не ломают игру.
  if (typeof cloudIsReady === 'function' && cloudIsReady()) {
    if (typeof cloudSaveSlot === 'function') {
      cloudSaveSlot(state.activeSlotIndex, payload).then(res => {
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