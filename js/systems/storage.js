// ========================================================
//  СИСТЕМЫ: СКЛАД (ОБЩИЙ БАНК)
//  Общий склад на 30 ячеек для ВСЕХ персонажей.
//  Хранится в localStorage отдельно от слотов.
//
//  Логика:
//  + Клик по предмету в инвентаре → весь стак кладётся на склад.
//  + Клик по предмету на складе  → весь стак забирается в инвентарь.
//  + Стакающиеся: до 1000 в ячейке (пыль — до 99 999, v0.29). Что не влезло — остаётся в инвентаре.
//  + Не стакающиеся: всегда 1 шт. на ячейку.
//  + Ключ группировки: имя + редкость + бонусные статы.
//  + Оболы не передаются.
//  + Склад не удаляется вместе с персонажем.
//
//  v0.25: СКЛАД В ОБЛАКЕ
//  + Склад общий для аккаунта: строка в таблице saves со слотом 100
//    (STORAGE_CLOUD_SLOT), data = { items, updatedAt }.
//  + В браузере остаётся копия — без интернета склад работает,
//    при связи изменения уходят в облако.
//  + Свежая версия подтягивается при входе в игру, при открытии склада и кузницы.
//  + Первая синхронизация на устройстве ОБЪЕДИНЯЕТ старый локальный склад с облачным.
// ========================================================

const STORAGE_KEY = 'l2browser_storage';
const STORAGE_MAX_SLOTS = 30;
const STORAGE_STACK_MAX = 1000;

// v0.29: пыль на складе стакается так же, как в сумке (до 99 999), остальное — до 1000.
function storageStackMax(item) {
  return item && item.isDust ? ALCHEMY_DUST_STACK_MAX : STORAGE_STACK_MAX;
}

const STORAGE_CLOUD_SLOT = 100;
const STORAGE_UPDATED_KEY = 'l2browser_storage_updated';   // когда склад менялся на этом устройстве
const STORAGE_SYNCED_KEY = 'l2browser_storage_user';       // с каким аккаунтом склад уже синхронизирован

// Какие типы стакаются.
const STORAGE_STACKABLE_TYPES = ['material', 'consumable', 'food'];

// --------------------------------------------------------
//  ЧТЕНИЕ / ЗАПИСЬ
// --------------------------------------------------------
function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = imgPathsToWebp(JSON.parse(raw));   // v0.36.2: старые пути картинок → .webp
    if (!Array.isArray(arr)) return [];
    // v0.33: старые рубины и сапфиры (обычный дроп) изъяты — со склада тоже
    return typeof isRetiredGem === 'function' ? arr.filter(i => !isRetiredGem(i)) : arr;
  } catch (e) {
    console.error('Склад: не удалось прочитать', e);
    return [];
  }
}

// Записать склад в браузер. updatedAt — метка изменения (по умолчанию «сейчас»).
function writeStorageLocal(arr, updatedAt) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    localStorage.setItem(STORAGE_UPDATED_KEY, updatedAt || new Date().toISOString());
  } catch (e) {
    console.error('Склад: не удалось сохранить', e);
  }
}

// Изменение склада игроком (положил / забрал / кузница) — в браузер и в облако.
function saveStorage(arr) {
  writeStorageLocal(arr);
  scheduleStorageCloudPush();
}

// --------------------------------------------------------
//  ОБЛАКО (v0.25)
// --------------------------------------------------------
let __storagePushTimer = null;
let __storageCloudBroken = false;   // облако не принимает строку склада — дальше только локально
let __storagePulling = null;

function storageCloudOn() {
  return !__storageCloudBroken && typeof cloudIsReady === 'function' && cloudIsReady();
}

function getStorageLocalUpdatedAt() {
  try { return localStorage.getItem(STORAGE_UPDATED_KEY) || null; } catch (e) { return null; }
}

function scheduleStorageCloudPush() {
  if (!storageCloudOn()) return;
  clearTimeout(__storagePushTimer);
  __storagePushTimer = setTimeout(pushStorageToCloud, 800);
}

async function pushStorageToCloud() {
  __storagePushTimer = null;
  if (!storageCloudOn()) return;
  const payload = { items: loadStorage(), updatedAt: getStorageLocalUpdatedAt() || new Date().toISOString() };
  const res = await cloudSaveSlot(STORAGE_CLOUD_SLOT, payload);
  if (res && res.ok) {
    try { localStorage.setItem(STORAGE_SYNCED_KEY, cloudUser.id); } catch (e) {}
    updateStorageCounters();
    return;
  }
  // Не сеть, а отказ базы — больше не пытаемся в эту сессию.
  const err = String((res && res.error) || '');
  if (err && !/fetch|network|timeout/i.test(err)) {
    __storageCloudBroken = true;
    console.warn('[storage] облако не принимает склад:', err);
    showToast('🏦', 'Склад: облако недоступно, храним в браузере');
    updateStorageCounters();
  }
}

// Сложить два склада: одинаковые стакающиеся предметы — в одну стопку (до 1000).
function mergeStorageArrays(base, extra) {
  const result = base.map(s => ({ ...s }));
  (extra || []).forEach(item => {
    const qty = item.qty || 1;
    if (STORAGE_STACKABLE_TYPES.includes(item.type)) {
      let left = qty;
      const key = getStorageGroupKey(item);
      result.forEach(s => {
        if (left <= 0 || getStorageGroupKey(s) !== key) return;
        const add = Math.min(storageStackMax(s) - (s.qty || 1), left);
        if (add > 0) { s.qty = (s.qty || 1) + add; left -= add; }
      });
      while (left > 0) {
        const add = Math.min(storageStackMax(item), left);
        result.push({ ...item, qty: add });
        left -= add;
      }
    } else {
      result.push({ ...item });
    }
  });
  return result;
}

// Подтянуть склад из облака. Возвращает true, если локальный склад изменился.
function pullStorageFromCloud() {
  if (!storageCloudOn()) return Promise.resolve(false);
  if (__storagePulling) return __storagePulling;
  __storagePulling = (async () => {
    const res = await cloudFetchSlot(STORAGE_CLOUD_SLOT);
    if (!res || !res.ok) return false;

    const cloud = res.data && Array.isArray(res.data.items) ? res.data : null;
    const local = loadStorage();
    const localAt = getStorageLocalUpdatedAt();
    let synced = null;
    try { synced = localStorage.getItem(STORAGE_SYNCED_KEY); } catch (e) {}

    if (synced === cloudUser.id) {
      // Обычный случай: тот же аккаунт. Берём что новее.
      if (cloud && (!localAt || cloud.updatedAt > localAt)) {
        writeStorageLocal(cloud.items, cloud.updatedAt);
        return true;
      }
      if (!cloud || (localAt && localAt > cloud.updatedAt)) pushStorageToCloud();   // изменения без связи
      return false;
    }

    if (!synced) {
      // Первая синхронизация на этом устройстве: ничего не теряем — объединяем.
      if (cloud && cloud.items.length) {
        const merged = local.length ? mergeStorageArrays(cloud.items, local) : cloud.items;
        writeStorageLocal(merged);
        if (local.length) {
          logLoot('🏦 Склад этого устройства объединён со складом в облаке.', 'log-info');
          showToast('🏦', 'Склад объединён с облачным');
        }
      } else if (!local.length) {
        return false;
      }
      await pushStorageToCloud();
      return true;
    }

    // На этом устройстве раньше играли другим аккаунтом — его склад сюда не смешиваем.
    writeStorageLocal(cloud ? cloud.items : [], cloud ? cloud.updatedAt : undefined);
    try { localStorage.setItem(STORAGE_SYNCED_KEY, cloudUser.id); } catch (e) {}
    return true;
  })().catch(e => {
    console.warn('[storage] pull:', e);
    return false;
  }).finally(() => { __storagePulling = null; });
  return __storagePulling;
}

// Подтянуть и перерисовать то, что сейчас открыто (склад / кузница).
function refreshStorageFromCloud() {
  return pullStorageFromCloud().then(changed => {
    if (!changed) return;
    if (document.getElementById('storage-overlay')?.classList.contains('active')) renderStorageWindow();
    if (typeof renderForgeAll === 'function' && document.getElementById('forge-overlay')?.classList.contains('active')) renderForgeAll();
  });
}

// --------------------------------------------------------
//  КЛЮЧ ГРУППИРОВКИ
//  Имя + редкость + бонусные статы. Материалы — только по имени.
// --------------------------------------------------------
function getStorageGroupKey(item) {
  const rarity = item.rarity || 'white';
  const bs = item.bonusStats || {};
  const bonusStr = Object.keys(bs)
    .filter(k => bs[k] > 0)
    .sort()
    .map(k => k + ':' + bs[k])
    .join(',');
  return item.name + '|' + rarity + '|' + bonusStr;
}

// --------------------------------------------------------
//  ОКНО
// --------------------------------------------------------
function openStorage() {
  if (!isTownLoc(state.player.currentLocation)) return;   // v0.36: Андервуд или Ильград

  if (typeof cancelWaitingForResume === 'function') {
    cancelWaitingForResume('открыт склад');
  }

  document.getElementById('storage-overlay').classList.add('active');
  renderStorageWindow();
  refreshStorageFromCloud();   // v0.25: свежая версия из облака (если изменилась — перерисуем)

  // v0.35.1: кладовщица Вирна — статья в Энциклопедии и «Поговорить».
  // Старый герой, у которого на складе уже что-то лежит, сразу получает тему «Тебе не интересно…» (без записи в летописи).
  const c = state.player.chronicle;
  if (c && loadStorage().length > 0) {
    if (!c.deeds) c.deeds = {};
    if (!c.deeds['storage.deposit']) c.deeds['storage.deposit'] = Date.now();
    if (!c.firsts) c.firsts = {};
    if (!c.firsts['storage.deposit']) c.firsts['storage.deposit'] = Date.now();
  }
  if (typeof unlockLore === 'function') unlockLore('keeper');
  if (typeof updateTalkButtons === 'function') updateTalkButtons();
}

// v0.35.1: дело на Складе — тема в разговоре + отношения с кладовщицей (+1 не чаще раза в день).
function keeperDeed(key) {
  if (typeof markDeed === 'function') markDeed(key);
  if (typeof rapportService === 'function') rapportService('keeper');
}

// v0.35.1: что лежит на складе — для реплики Вирны («помню каждую»).
function keeperStoreSummary() {
  const arr = loadStorage();
  const dustNames = Object.values(ALCHEMY_DUST || {}).map(d => d.name);
  const dust = arr.filter(i => dustNames.includes(i.name)).reduce((s, i) => s + (i.qty || 0), 0);
  const n = arr.length, n10 = n % 10, n100 = n % 100;
  const cellsWord = (n10 === 1 && n100 !== 11) ? 'ячейка' : (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) ? 'ячейки' : 'ячеек';
  return { cells: n, cellsWord, dust };
}

// v0.35.1: другие герои аккаунта (склад у них общий) — имена, кроме текущего.
function keeperOtherHeroes() {
  const names = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (i === state.activeSlotIndex) continue;
    let name = null;
    const cloud = typeof cloudGetCachedSlot === 'function' ? cloudGetCachedSlot(i) : null;
    if (cloud && cloud.data && cloud.data.player) name = cloud.data.player.name;
    if (!name) { const m = readSlotMeta(i); if (m.used) name = m.name; }
    if (name && name !== state.player.name && !names.includes(name)) names.push(name);
  }
  return names;
}

function closeStorage() {
  document.getElementById('storage-overlay').classList.remove('active');
}

// --------------------------------------------------------
//  РЕНДЕР ОКНА
//  Слева — инвентарь игрока.
//  Справа — склад.
// --------------------------------------------------------
function renderStorageWindow() {
  renderStorageInventoryPanel();
  renderStorageStoragePanel();
  updateStorageCounters();
}

function updateStorageCounters() {
  const invEl = document.getElementById('storage-inv-count');
  if (invEl) invEl.textContent = state.player.inventory.length + ' / ' + invMaxSlots();

  const storeEl = document.getElementById('storage-store-count');
  if (storeEl) {
    const arr = loadStorage();
    const cloudOn = storageCloudOn();
    storeEl.textContent = arr.length + ' / ' + STORAGE_MAX_SLOTS + (cloudOn ? ' ☁' : ' 💾');
    storeEl.title = cloudOn ? 'Склад в облаке — общий для всех героев аккаунта на любом устройстве'
                            : 'Склад только в этом браузере (нет входа в аккаунт или облако недоступно)';
  }
}

// --- Панель инвентаря (слева) ---
function renderStorageInventoryPanel() {
  const grid = document.getElementById('storage-inv-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const inv = state.player.inventory;

  // Показываем столько ячеек, сколько в инвентаре + пустые до заполнения сетки.
  // Всего 60, но раз это окно — ограничим 30 (как склад), чтобы было симметрично.
  // Но если у игрока >30 — всё равно покажем всё (со скроллом внутри).
  // Упрощаем: показываем всегда 30 ячеек — первые 30 инвентаря.
  // Если у тебя инвентарь 60 — увидишь только первые 30, но это ок.
  // НЕТ — покажем весь инвентарь (60), у панели будет скролл.
  const PAGE_SIZE = 30; // столько же, сколько ячеек в складе — для симметрии
  const startIdx = 0;   // показываем с начала (пагинации тут нет)

  for (let i = 0; i < PAGE_SIZE; i++) {
    const item = inv[startIdx + i];
    const slot = document.createElement('div');

    if (item) {
      const isConsumable = item.type === 'consumable';
      const isFood = item.type === 'food';
      const rarityClass = (item.rarity && item.rarity !== 'white') ? ' rarity-' + item.rarity : '';

      slot.className = 'inv-slot' + (isConsumable ? ' consumable' : '') + (isFood ? ' food' : '') + rarityClass;
      slot.innerHTML = `${item.icon}<div class="item-name">${item.name}</div>${item.qty > 1 ? `<div class="qty">${item.qty}</div>` : ''}`;
      slot.onclick = () => storageDepositItem(item);
      slot.onmouseenter = (e) => showItemTooltip(e, item);
      slot.onmouseleave = () => hideTooltip();
    } else {
      slot.className = 'inv-slot empty';
    }
    grid.appendChild(slot);
  }
}

// --- Панель склада (справа) ---
function renderStorageStoragePanel() {
  const grid = document.getElementById('storage-store-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const arr = loadStorage();
  if (typeof refreshItemIcons === 'function') refreshItemIcons(arr);

  // v0.25: после объединения складов ячеек может быть больше 30 — показываем все.
  const cells = Math.max(STORAGE_MAX_SLOTS, arr.length);
  for (let i = 0; i < cells; i++) {
    const item = arr[i];
    const slot = document.createElement('div');

    if (item) {
      const isConsumable = item.type === 'consumable';
      const isFood = item.type === 'food';
      const rarityClass = (item.rarity && item.rarity !== 'white') ? ' rarity-' + item.rarity : '';

      slot.className = 'inv-slot' + (isConsumable ? ' consumable' : '') + (isFood ? ' food' : '') + rarityClass;
      slot.innerHTML = `${item.icon}<div class="item-name">${item.name}</div>${item.qty > 1 ? `<div class="qty">${item.qty}</div>` : ''}`;
      slot.onclick = () => storageWithdrawItem(i);
      slot.onmouseenter = (e) => showItemTooltip(e, item);
      slot.onmouseleave = () => hideTooltip();
    } else {
      slot.className = 'inv-slot empty';
    }
    grid.appendChild(slot);
  }
}

// --------------------------------------------------------
//  ЛОГИКА: ПОЛОЖИТЬ НА СКЛАД
//  Инвентарь → Склад.
//  + Стакается с уже лежащим на складе, до 1000.
//  + Что не влезло — остаётся в инвентаре.
//  + Если новой ячейки нет и склад полон — тост.
// --------------------------------------------------------
function storageDepositItem(item) {
  if (__storagePulling) { showToast('🏦', 'Склад обновляется из облака…'); return; }
  const p = state.player;
  const arr = loadStorage();

  const isStackable = STORAGE_STACKABLE_TYPES.includes(item.type);

  // Если стакается — ищем такую же группу на складе.
  let targetIdx = -1;
  if (isStackable) {
    const key = getStorageGroupKey(item);
    targetIdx = arr.findIndex(s => getStorageGroupKey(s) === key && (s.qty || 1) < storageStackMax(s));
  }

  let movedQty = 0;

  if (isStackable && targetIdx >= 0) {
    // Стакаем в существующую ячейку.
    const free = storageStackMax(arr[targetIdx]) - (arr[targetIdx].qty || 1);
    const move = Math.min(free, item.qty);
    arr[targetIdx].qty = (arr[targetIdx].qty || 1) + move;
    movedQty = move;

    // Уменьшаем инвентарь.
    item.qty -= move;
    if (item.qty <= 0) {
      const idx = p.inventory.indexOf(item);
      if (idx >= 0) p.inventory.splice(idx, 1);
    }
  } else {
    // Кладём в новую ячейку.
    if (arr.length >= STORAGE_MAX_SLOTS) {
      showToast('🏦', 'Склад полон');
      logLoot(`🏦 Склад полон — «${item.name}» не поместился.`, 'log-info');
      return;
    }

    // Если стакается и не влезло в существующую — берём до лимита стопки, остаток остаётся.
    const move = isStackable ? Math.min(storageStackMax(item), item.qty) : 1;
    const clone = { ...item, qty: move };
    arr.push(clone);
    movedQty = move;

    item.qty -= move;
    if (item.qty <= 0) {
      const idx = p.inventory.indexOf(item);
      if (idx >= 0) p.inventory.splice(idx, 1);
    }
  }

  saveStorage(arr);
  saveCurrentSlot();   // иначе после обновления страницы вещь будет и в сумке, и на складе
  renderStorageWindow();
  renderInventory();
  updateInventoryFooter();

  if (movedQty > 0) {
    const qtyStr = movedQty > 1 ? ` ×${movedQty}` : '';
    logLoot(`🏦 На склад: ${item.name}${qtyStr}`, 'log-info');
    keeperDeed('storage.deposit');
  }
}

// --------------------------------------------------------
//  ЛОГИКА: ЗАБРАТЬ СО СКЛАДА
//  Склад → Инвентарь.
//  + Стакается с инвентарём, если такой предмет есть.
//  + Иначе занимает новую ячейку инвентаря.
// --------------------------------------------------------
function storageWithdrawItem(storageIdx) {
  if (__storagePulling) { showToast('🏦', 'Склад обновляется из облака…'); return; }
  const p = state.player;
  const arr = loadStorage();
  const item = arr[storageIdx];
  if (!item) return;

  // v0.26: свиток телепортации убран — со склада он не берётся, а превращается в Оболы
  if (item.shopId === 'teleportScroll') {
    const n = Math.max(0, item.qty || 1);
    const gold = n * TELEPORT_SCROLL_REFUND;
    arr.splice(storageIdx, 1);
    p.gold += gold;
    saveStorage(arr);
    saveCurrentSlot();
    renderStorageWindow();
    updateTopStatus();
    updateInventoryFooter();
    showToast('🌀', `Свиток больше не нужен: +${gold} Оболов`);
    logLoot(`🌀 Свиток телепортации ×${n} со склада обменян на ${gold} 🪙 (теперь — магические тропы).`, 'log-info');
    return;
  }

  const isStackable = STORAGE_STACKABLE_TYPES.includes(item.type);
  const qtyToMove = isStackable ? (item.qty || 1) : 1;
  if (typeof migrateJewelryMilestones === 'function') migrateJewelryMilestones(item);   // v0.25: старая бижутерия с другого устройства
  if (typeof migrateWeaponBaseStats === 'function') migrateWeaponBaseStats(item);       // v0.25: старые статы оружия
  if (typeof migrateRefineFlatBonuses === 'function') migrateRefineFlatBonuses(item);   // v0.25: HP/MP/реген подгонки по тиру

  // Пробуем стакать в инвентарь.
  if (isStackable) {
    const existing = p.inventory.find(i => {
      if (i.type !== item.type) return false;
      if (i.name !== item.name) return false;
      const a = getStorageGroupKey(i);
      const b = getStorageGroupKey(item);
      return a === b;
    });
    if (existing) {
      existing.qty = (existing.qty || 1) + qtyToMove;
      // Убираем из склада.
      if ((item.qty || 1) - qtyToMove <= 0) {
        arr.splice(storageIdx, 1);
      } else {
        item.qty -= qtyToMove;
      }
      saveStorage(arr);
      saveCurrentSlot();
      renderStorageWindow();
      renderInventory();
      updateInventoryFooter();
      logLoot(`🏦 Со склада: ${item.name} ×${qtyToMove}`, 'log-info');
      return;
    }
  }

  // Нет стака — нужна новая ячейка в инвентаре.
  if (p.inventory.length >= invMaxSlots()) {
    showToast('📦', 'Инвентарь переполнен');
    logLoot(`📦 Инвентарь переполнен — «${item.name}» остался на складе.`, 'log-info');
    return;
  }

  // Создаём копию в инвентаре.
  const clone = { ...item, qty: qtyToMove };
  p.inventory.push(clone);

  // Убираем из склада.
  if ((item.qty || 1) - qtyToMove <= 0) {
    arr.splice(storageIdx, 1);
  } else {
    item.qty -= qtyToMove;
  }

  saveStorage(arr);
  saveCurrentSlot();   // иначе после обновления страницы вещь пропадёт
  renderStorageWindow();
  renderInventory();
  updateInventoryFooter();

  const qtyStr = qtyToMove > 1 ? ` ×${qtyToMove}` : '';
  logLoot(`🏦 Со склада: ${item.name}${qtyStr}`, 'log-info');
}