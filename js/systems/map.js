// ========================================================
//  СИСТЕМЫ: КАРТА И ПЕРЕМЕЩЕНИЯ
//  + При попытке перехода / телепорта — отменяем
//    ожидание автостарта боя.
//  + ШАГ 6: при прибытии в город — пробуем автозапуск
//    диалога Старшины.
//
//  НОВОЕ (v0.12):
//  + updateMapMeta() — рисует на каждой карточке карты:
//    «🚶 Пешком: 30 сек» (время от текущей локации) и
//    «⚔ Мобы: ур. 1–7» (диапазон уровней с подтипами).
//
//  НОВОЕ (v0.26):
//  + Свиток телепортации убран. Магические тропы — из любой
//    локации в любую соседнюю, цена от времени пути (config.js).
//  + refundTeleportScrolls() — возврат Оболов за старые свитки.
// ========================================================

// v0.26: тропы из любой локации в любую соседнюю, цена — getMagicPathPrice (config.js).
function useMagicPath(destination) {
  const p = state.player;
  if (destination === p.currentLocation) return;
  if (state.travel.active) return;
  if (state.battle.active) {
    showToast('🌀', 'Нельзя уйти во время боя');
    return;
  }

  const price = getMagicPathPrice(p.currentLocation, destination);
  if (price === null) return;

  if (p.gold < price) {
    showToast('🪙', `Недостаточно Оболов: нужно ${price}`);
    logLoot(`Недостаточно Оболов. Нужно ${price}.`, 'log-info');
    return;
  }

  // Отменяем автостарт (если он был).
  if (typeof cancelWaitingForResume === 'function') {
    cancelWaitingForResume('магические тропы');
  }

  p.gold -= price;
  p.currentLocation = destination;

  updateTopStatus();
  updateMapUI();
  switchTab('hunt');

  const place = LOCATION_NAMES[destination] || destination;
  logCombat(`🌀 Магические тропы: вы прибыли — ${place} (−${price} 🪙).`, 'log-entry levelup');
  showToast('🌀', `Магические тропы: ${place}`);

  saveCurrentSlot();

  // В город по тропе — как пешком: пробуем автозапуск диалога Старшины.
  if (destination === 'town' && typeof tryAutoStartElderDialogue === 'function') {
    tryAutoStartElderDialogue();
  }
}

function tryTravel(loc) {
  const p = state.player;

  if (state.travel.active) return;
  if (loc === p.currentLocation) return;
  if (state.battle.active) {
    logCombat('Нельзя уйти во время боя.', 'log-entry');
    return;
  }

  const key = `${p.currentLocation}->${loc}`;
  const time = TRAVEL_TIMES[key];

  if (time === undefined) {
    logCombat('Туда нельзя пройти напрямую.', 'log-entry');
    return;
  }

  // Отменяем автостарт (если он был).
  if (typeof cancelWaitingForResume === 'function') {
    cancelWaitingForResume('начат переход');
  }

  state.travel.active = true;
  state.travel.timer = time;
  state.travel.duration = time;
  state.travel.destination = loc;

  const place = LOCATION_NAMES[loc] || loc;
  document.getElementById('travel-title').textContent = `ПУТЬ: ${place}`;
  document.getElementById('travel-overlay').classList.add('active');
  document.getElementById('travel-fill').style.width = '0%';
  document.getElementById('travel-time').textContent = time;
}

function finishTravel() {
  state.travel.active = false;
  state.player.currentLocation = state.travel.destination;

  document.getElementById('travel-overlay').classList.remove('active');
  updateMapUI();
  switchTab('hunt');

  saveCurrentSlot();

  // ---- ШАГ 6: если прибыли в город — пробуем автозапуск диалога Старшины ----
  if (state.player.currentLocation === 'town' && typeof tryAutoStartElderDialogue === 'function') {
    tryAutoStartElderDialogue();
  }
}

// ========================================================
//  НОВОЕ (v0.12): ДОП. ИНФА НА КАРТОЧКАХ КАРТЫ
// ========================================================

// Форматирует секунды в «30 сек» / «1 мин» / «1 мин 30 сек».
function formatTravelTime(seconds) {
  if (seconds < 60) return seconds + ' сек';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (s === 0) return m + ' мин';
  return m + ' мин ' + s + ' сек';
}

// Сколько секунд идти пешком из текущей локации в целевую.
// Возвращает число или null, если пути нет.
function getTravelTimeFromCurrent(targetLoc) {
  const p = state.player;
  if (targetLoc === p.currentLocation) return null;    // уже тут
  const key = `${p.currentLocation}->${targetLoc}`;
  const time = TRAVEL_TIMES[key];
  return (time !== undefined) ? time : null;
}

// Диапазон уровней монстров на локации с учётом подтипов.
// Поляна → «1–7», Копи → «6–12», Город → null.
// Считаем автоматически: min(level) и max(level + 2)
// (bloody даёт +2 к базовому уровню).
function getMonsterLevelRange(loc) {
  let arr;
  if (loc === 'field') arr = MONSTERS;
  else if (loc === 'mine') arr = MINE_MONSTERS;
  else return null;

  if (!arr || arr.length === 0) return null;

  let min = Infinity, max = -Infinity;
  arr.forEach(m => {
    const baseLvl = m.level || 1;
    if (baseLvl < min) min = baseLvl;
    if (baseLvl + 2 > max) max = baseLvl + 2;      // bloody = +2
  });

  return { min, max };
}

// Обновляет блоки .map-meta на всех карточках.
function updateMapMeta() {
  ['field', 'town', 'mine'].forEach(loc => {
    const el = document.getElementById('map-meta-' + loc);
    if (!el) return;

    const parts = [];

    // Время пешком.
    const travelTime = getTravelTimeFromCurrent(loc);
    if (travelTime !== null) {
      parts.push(`<span class="map-meta-line">🚶 Пешком: ${formatTravelTime(travelTime)}</span>`);
    } else if (loc === state.player.currentLocation) {
      // Уже тут — ничего не пишем, «ВЫ ЗДЕСЬ» и так есть сверху.
    }

    // Уровни мобов (только для диких локаций).
    const range = getMonsterLevelRange(loc);
    if (range) {
      parts.push(`<span class="map-meta-line">⚔ Мобы: ур. ${range.min}–${range.max}</span>`);
    } else if (loc === 'town') {
      parts.push(`<span class="map-meta-line map-meta-safe">🛡 Безопасная зона</span>`);
    }

    el.innerHTML = parts.join('');
  });
}

// ========================================================
//  v0.26: СВИТОК ТЕЛЕПОРТАЦИИ УБРАН — ВОЗВРАТ ОБОЛОВ
//  Вместо свитка — магические тропы во все стороны.
//  Старые свитки из сумки забираем при входе героем и возвращаем
//  по TELEPORT_SCROLL_REFUND Оболов за штуку (сумка сохраняется вместе с героем).
//  Свитки на складе — при «забрать» (storageWithdrawItem): склад синхронизируется
//  с облаком, и тихая правка при входе могла бы вернуться оттуда и начислить дважды.
// ========================================================
function refundTeleportScrolls() {
  const p = state.player;
  let count = 0;
  const list = p.inventory || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const it = list[i];
    if (it && it.shopId === 'teleportScroll') {
      count += Math.max(0, it.qty || 1);
      list.splice(i, 1);
    }
  }

  if (count <= 0) return 0;
  const gold = count * TELEPORT_SCROLL_REFUND;
  p.gold += gold;
  setTimeout(() => {
    showToast('🌀', `Свитки телепорта больше не нужны: возвращено ${gold} Оболов`);
    logLoot(`🌀 Свиток телепортации убран из игры — теперь магические тропы ведут во все стороны. За ${count} шт. возвращено ${gold} 🪙.`, 'log-info');
  }, 1800);
  return gold;
}
