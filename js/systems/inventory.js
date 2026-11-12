// ========================================================
//  СИСТЕМЫ: ИНВЕНТАРЬ
//  Добавление предметов, сетка, пагинация,
//  использование еды и свитков, нижняя панель.
//
//  ВАЖНО: экипировка вынесена в equipment.js.
//         Тултипы вынесены в tooltips.js.
//
//  + Модалка выбора для слотов расходников.
//  + Порог HP для зелья (30/40/50/60/70).
//  + Поддержка hpBonus в статах предметов.
//  + МИГРАЦИЯ сохранений: «Верх доспеха» → «Потрёпанная куртка»,
//    «Низ доспеха» → «Потрёпанные штаны» (при загрузке слота).
//  + ФИКС PNG-иконок: путь к img/... превращается в <img>-тег.
//
//  НОВОЕ (v0.07):
//  + Сохраняем tier предмета при добавлении в инвентарь.
//
//  НОВОЕ (v0.08):
//  + Сохраняем refineLevel и refineBonuses (подгонка).
//  + В сетке инвентаря показываем «+N» в имени точеного предмета.
//
//  НОВОЕ (v0.11):
//  + УНИЧТОЖЕНИЕ ПРЕДМЕТА:
//    - ПКМ (контекстное меню) на предмете → confirm() → удалить всю ячейку.
//    - Долгое нажатие (0.6 сек) на телефоне → то же самое.
//    - Всегда спрашиваем подтверждение.
//
//  НОВОЕ (v0.29):
//  + ПКМ и долгое нажатие БОЛЬШЕ НЕ УДАЛЯЮТ — игроки уничтожали вещи,
//    пытаясь их надеть или посмотреть.
//  + Уничтожить — только перетащив предмет в ячейку 🗑 «Корзина»
//    (под сеткой, справа от страниц). Подтверждение осталось.
//  + Телефон: подержать предмет 0.4 сек — показать его статы;
//    не отпуская — тянуть в корзину.
// ========================================================

// v0.35.1: ячеек в сумке — 60 + уровень Заплечника (каждое его поручение — +1, js/systems/bag.js).
// Страниц столько, сколько нужно; на последней неоткрытые ячейки видны с замочком.
const INVENTORY_MAX_SLOTS = 60;   // базовое число ячеек
const INVENTORY_PAGE_SIZE = 30;
function invMaxSlots() {
  return INVENTORY_MAX_SLOTS + (typeof bagSlotBonus === 'function' ? bagSlotBonus() : 0);
}
function invPages() { return Math.ceil(invMaxSlots() / INVENTORY_PAGE_SIZE); }

// ---------- ХЕЛПЕР: суффикс подгонки для имени ----------
function getInvRefineSuffix(item) {
  if (!item) return '';
  const lvl = item.refineLevel || 0;
  return lvl > 0 ? ` +${lvl}` : '';
}

// ---------- ХЕЛПЕР: превратить icon в HTML ----------
function normalizeIconHtml(icon) {
  if (!icon) return '';

  if (typeof icon === 'string' && icon.startsWith('img/')) {
    return `<img src="${icon}" alt="" style="width:100%;height:100%;object-fit:contain;">`;
  }

  if (typeof icon === 'string' && icon.includes('<svg')) {
    return icon;
  }

  if (typeof icon === 'string' && icon.includes('<img')) {
    return icon;
  }

  return '';
}

// ---------- ДОБАВЛЕНИЕ ПРЕДМЕТА ----------
function addToInventory(drop) {
  const p = state.player;

  const STACKABLE_TYPES = ['material', 'consumable', 'food'];
  const stackable = STACKABLE_TYPES.includes(drop.type);

  const existing = stackable ? p.inventory.find(i => i.name === drop.name) : null;

  if (existing) {
    existing.qty++;
    uiLazy('inventory', renderInventory);   // v0.36.2: за окном боя не рисуем, вне боя — один раз за кадр
    return true;
  }

  if (p.inventory.length >= invMaxSlots()) {
    showToast('📦', 'Инвентарь переполнен');
    logLoot(`📦 Инвентарь переполнен — «${drop.name}» потерян.`, 'log-info');
    uiLazy('inventory', renderInventory);
    return false;
  }

  let stats = null;
  if (drop.stats) {
    stats = {};
    for (const k of ['pAtk','pDef','mDef','mAtk','flatDamageReduce','blockChance','mpBonus','hpBonus','atbSpeedMod','critChance','mpRegenIn']) {
      if (drop.stats[k] !== undefined) stats[k] = drop.stats[k];
    }
  }

  // ---- ФИКС: превращаем путь img/... в <img>-тег ----
  const iconHtml = normalizeIconHtml(drop.icon);

  const item = {
    id: 'item_' + Date.now() + '_' + Math.random(),
    name: drop.name, type: drop.type, icon: iconHtml, qty: 1,
    stats, sellPrice: drop.sellPrice || 1,
    setId: drop.setId || null, twoHanded: drop.twoHanded || false,
    tier: drop.tier || null,                        // тир предмета (для подгонки)
    refineLevel: drop.refineLevel || 0,             // уровень подгонки
    refineBonuses: drop.refineBonuses || null,      // бонусы подгонки
  };
  if (drop.food) item.food = drop.food;
  if (drop.effect) item.effect = drop.effect;
  if (drop.shopId) item.shopId = drop.shopId;
  if (drop.rarity) item.rarity = drop.rarity;
  if (drop.bonusStats) item.bonusStats = drop.bonusStats;
  p.inventory.push(item);
  uiLazy('inventory', renderInventory);
  return true;
}

// ========================================================
//  УНИЧТОЖЕНИЕ ПРЕДМЕТА (v0.11)
//  Удаляет всю ячейку (весь стак) после confirm().
//  v0.29: вызывается только при броске предмета в корзину 🗑.
// ========================================================
function destroyInventoryItem(item) {
  if (!item) return;

  const p = state.player;
  const idx = p.inventory.indexOf(item);
  if (idx < 0) return;

  // ---- Проверка: не надет ли предмет? ----
  // Экипировка в инвентаре не бывает надетой (при надевании удаляется),
  // но на всякий случай — проверим.
  const isEquipped = Object.values(p.equipment).some(eq => eq && eq.id === item.id);
  if (isEquipped) {
    showToast('🛡', 'Нельзя уничтожить надетый предмет');
    logLoot(`🛡 «${item.name}» надет — сначала снимите.`, 'log-info');
    return;
  }

  const qty = item.qty || 1;
  const qtyStr = qty > 1 ? ` ×${qty}` : '';

  // ---- Подтверждение ----
  const ok = confirm(
    `Уничтожить «${item.name}${qtyStr}»?\n\n` +
    `Это действие необратимо. Оболы за продажу не вернутся.`
  );
  if (!ok) return;

  // ---- Удаляем из инвентаря ----
  p.inventory.splice(idx, 1);

  // ---- Лог + тост ----
  logLoot(`🗑 Уничтожено: ${item.name}${qtyStr}`, 'log-info');
  showToast('🗑', `Уничтожено: ${item.name}${qtyStr}`);

  // ---- Обновляем UI ----
  renderInventory();
  renderEquipSlots();       // если был слот зелья/микстуры — авто-очистка
  updateInventoryFooter();
  renderConsumablesPanel(); // если в бою — обновит панель расходников

  saveCurrentSlot();
}

// ========================================================
//  ПЕРЕТАСКИВАНИЕ В КОРЗИНУ 🗑 (v0.29)
//  Мышь: зажать предмет и потянуть.
//  Телефон: подержать 0.4 сек (покажутся статы), потом тянуть.
//  Отпустили над корзиной — destroyInventoryItem (с подтверждением),
//  в любом другом месте — ничего не происходит.
// ========================================================
const INV_DRAG_THRESHOLD = 6;    // px: сдвинули дальше — это уже не клик, а перетаскивание
const INV_HOLD_MS = 400;         // телефон: столько держать, чтобы «поднять» предмет
const INV_SCROLL_SLOP = 8;       // телефон: сдвиг до удержания — это прокрутка страницы

const INV_EDGE_ZONE = 90;        // px у верха/низа экрана: тащим туда — страница сама едет
const INV_EDGE_SPEED = 14;       // px за шаг (~60 шагов в секунду)

let invDrag = null; // { item, slot, ghost, x, y, timer }

// На телефоне предмет сверху и корзина внизу не влезают в один экран —
// поднесли предмет к краю, страница прокручивается сама.
function invEdgeScroll() {
  if (!invDrag) return;
  const { y } = invDrag;
  const dy = y < INV_EDGE_ZONE ? -INV_EDGE_SPEED : (y > window.innerHeight - INV_EDGE_ZONE ? INV_EDGE_SPEED : 0);
  if (dy) {
    window.scrollBy(0, dy);
    document.getElementById('inv-trash')?.classList.toggle('hot', !!invTrashAt(invDrag.x, invDrag.y));
  }
}

function invTrashAt(x, y) {
  const el = document.elementFromPoint(x, y);
  return el ? el.closest('#inv-trash') : null;
}

function invDragStart(slot, item, x, y) {
  hideTooltip();
  const r = slot.getBoundingClientRect();
  const ghost = slot.cloneNode(true);
  ghost.classList.add('inv-drag-ghost');
  ghost.style.width = r.width + 'px';
  ghost.style.height = r.height + 'px';
  document.body.appendChild(ghost);
  slot.classList.add('inv-dragging');
  document.getElementById('inv-trash')?.classList.add('ready');
  invDrag = { item, slot, ghost, x, y, timer: setInterval(invEdgeScroll, 16) };
  invDragMove(x, y);
}

function invDragMove(x, y) {
  if (!invDrag) return;
  invDrag.x = x; invDrag.y = y;
  invDrag.ghost.style.left = x + 'px';
  invDrag.ghost.style.top = y + 'px';
  document.getElementById('inv-trash')?.classList.toggle('hot', !!invTrashAt(x, y));
}

function invDragEnd(x, y) {
  if (!invDrag) return;
  const { item, slot, ghost, timer } = invDrag;
  invDrag = null;
  clearInterval(timer);
  ghost.remove();
  slot.classList.remove('inv-dragging');
  document.getElementById('inv-trash')?.classList.remove('ready', 'hot');
  if (invTrashAt(x, y)) destroyInventoryItem(item);
}

function attachInvSlotGestures(slot, item) {
  let sx = 0, sy = 0;
  const far = (x, y, d) => Math.hypot(x - sx, y - sy) > d;

  // ---- Мышь ----
  slot.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();               // без выделения текста и родного drag картинки
    sx = e.clientX; sy = e.clientY;
    slot._skipClick = false;

    const move = (ev) => {
      if (!invDrag && far(ev.clientX, ev.clientY, INV_DRAG_THRESHOLD)) invDragStart(slot, item, ev.clientX, ev.clientY);
      invDragMove(ev.clientX, ev.clientY);
    };
    const up = (ev) => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      if (invDrag) { slot._skipClick = true; invDragEnd(ev.clientX, ev.clientY); }
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });

  // ---- Телефон ----
  let holdTimer = null, held = false;
  const cancelHold = () => { clearTimeout(holdTimer); holdTimer = null; };

  slot.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    held = false;
    cancelHold();
    holdTimer = setTimeout(() => {
      holdTimer = null;
      held = true;
      slot.classList.add('inv-held');
      showItemTooltip({ clientX: sx, clientY: sy }, item);
      if (navigator.vibrate) navigator.vibrate(15);
    }, INV_HOLD_MS);
  }, { passive: true });

  slot.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (!held) {                      // палец поехал до удержания — это прокрутка
      if (far(t.clientX, t.clientY, INV_SCROLL_SLOP)) cancelHold();
      return;
    }
    e.preventDefault();               // предмет «в руке» — страницу не крутим
    if (!invDrag && far(t.clientX, t.clientY, INV_DRAG_THRESHOLD)) invDragStart(slot, item, t.clientX, t.clientY);
    invDragMove(t.clientX, t.clientY);
  }, { passive: false });

  const touchEnd = (e) => {
    cancelHold();
    slot.classList.remove('inv-held');
    if (!held) return;                // обычный тап — дальше сработает click (надеть)
    held = false;
    e.preventDefault();               // не надевать; тултип со статами остаётся
    const t = e.changedTouches[0];
    if (invDrag) invDragEnd(e.type === 'touchcancel' ? -1 : t.clientX, e.type === 'touchcancel' ? -1 : t.clientY);
  };
  slot.addEventListener('touchend', touchEnd);
  slot.addEventListener('touchcancel', touchEnd);
}

// ---------- СЕТКА ПРЕДМЕТОВ ----------
// v0.20: зелья, микстуры и пыль берут актуальную иконку (старые сохранения хранят старые SVG)
function refreshItemIcons(list) {
  (list || []).forEach(i => {
    if (!i) return;
    let key = null;
    if (i.shopId) { const s = SHOP_ITEMS.find(x => x.id === i.shopId); key = s && s.icon; }
    else if (i.isDust) { const d = Object.values(ALCHEMY_DUST).find(x => x.rarity === i.rarity || x.name === i.name); key = d && d.icon; }
    if (key && SVG[key] && i.icon !== SVG[key]) i.icon = SVG[key];
  });
}

function renderInventory() {
  const grid = document.getElementById('inventory-grid');
  if (!grid) return;
  UI_LAZY.jobs.delete('inventory');   // v0.36.2: рисуем сейчас — отложенная перерисовка уже не нужна
  grid.innerHTML = '';
  const p = state.player;
  refreshItemIcons(p.inventory);

  const page = Math.min(state.currentInventoryPage || 0, invPages() - 1);
  state.currentInventoryPage = page;
  const startIdx = page * INVENTORY_PAGE_SIZE;
  const maxSlots = invMaxSlots();

  for (let i = 0; i < INVENTORY_PAGE_SIZE; i++) {
    const globalIdx = startIdx + i;
    const item = p.inventory[globalIdx];
    const slot = document.createElement('div');

    if (!item && globalIdx >= maxSlots) {
      // v0.35.1: ячейка ещё не открыта — откроет Заплечник, когда подрастёт
      slot.className = 'inv-slot locked';
      slot.title = 'Заплечник ещё не дорос. Его поручения — +1 ячейка';
      slot.innerHTML = '🔒';
    } else if (item) {
      const isConsumable = item.type === 'consumable';
      const isFood = item.type === 'food';
      const rarityClass = (item.rarity && item.rarity !== 'white') ? ' rarity-' + item.rarity : '';

      // ---- НОВОЕ: суффикс +N в имени ----
      const refineSuffix = getInvRefineSuffix(item);

      // v0.33: вещь не по уровню — замок с нужным уровнем в углу
      const reqLevel = getItemReqLevel(item);
      const reqLocked = reqLevel && !canWearByLevel(item);
      slot.className = 'inv-slot' + (isConsumable ? ' consumable' : '') + (isFood ? ' food' : '') + rarityClass + (reqLocked ? ' req-locked' : '');
      slot.innerHTML = `${item.icon}<div class="item-name">${item.name}${refineSuffix}</div>${item.qty > 1 ? `<div class="qty">${item.qty}</div>` : ''}` +
        (reqLocked ? `<div class="inv-req" title="Надеть можно с ${reqLevel} уровня">🔒${reqLevel}</div>` : '');

      // ---- Левый клик: использовать / надеть ----
      slot.onclick = () => {
        if (slot._skipClick) { slot._skipClick = false; return; }   // это было перетаскивание
        if (item.type === 'food') useFood(item);
        else if (isConsumable) logLoot(`${item.name} — расходник.`, 'log-info');
        else equipItem(item);
      };

      // ---- v0.29: ПКМ больше не удаляет; меню браузера при удержании тоже не нужно ----
      slot.oncontextmenu = (e) => e.preventDefault();

      // ---- Перетаскивание в корзину + удержание = статы (v0.29) ----
      attachInvSlotGestures(slot, item);

      slot.onmouseenter = (e) => showItemTooltip(e, item);
      slot.onmouseleave = () => hideTooltip();
    } else {
      slot.className = 'inv-slot empty';
    }
    grid.appendChild(slot);
  }

  renderInventoryPagination();
  renderInventoryFullMessage();
}

// ---------- ПАГИНАЦИЯ ----------
function renderInventoryPagination() {
  const cont = document.getElementById('inventory-pagination');
  if (!cont) return;
  cont.innerHTML = '';

  // v0.18: переключатель страниц виден ВСЕГДА. Раньше он прятался, когда вещей
  // становилось ≤ 30, и игрок застревал на пустой второй странице.
  for (let i = 0; i < invPages(); i++) {
    const btn = document.createElement('button');
    btn.className = 'inventory-page-btn' + (state.currentInventoryPage === i ? ' active' : '');
    btn.textContent = (i + 1);
    btn.onclick = () => setInventoryPage(i);
    cont.appendChild(btn);
  }

  // v0.29: корзина — сюда перетаскивают предмет, чтобы уничтожить
  const trash = document.createElement('div');
  trash.id = 'inv-trash';
  trash.className = 'inv-trash';
  trash.title = 'Корзина: перетащите сюда предмет, чтобы уничтожить его';
  trash.innerHTML = '🗑';
  trash.onclick = () => showToast('🗑', 'Перетащите сюда предмет, чтобы уничтожить его');
  cont.appendChild(trash);
}

function setInventoryPage(page) {
  if (page < 0 || page >= invPages()) return;
  state.currentInventoryPage = page;
  renderInventory();
}

// ---------- СООБЩЕНИЕ О ПЕРЕПОЛНЕНИИ ----------
function renderInventoryFullMessage() {
  const msg = document.getElementById('inventory-full-msg');
  if (!msg) return;
  if (state.player.inventory.length >= invMaxSlots()) {
    msg.style.display = 'block';
  } else {
    msg.style.display = 'none';
  }
}

// ---------- ИСПОЛЬЗОВАНИЕ ЕДЫ И СВИТКОВ ----------
function useFood(item) {
  const p = state.player;
  if (!p.classId) {
    showToast('🍖', 'Сначала выберите класс');
    logLoot(`Сначала выберите класс.`, 'log-info');
    return;
  }

  // ---- v0.20: блюдо — бонус + сытность ----
  if (item.food && item.food.dish && DISHES[item.food.dish]) { eatDish(item); return; }

  const duration = getFoodDuration(item);
  // v0.35.1: сытость одна — та же еда продлевает, другая заменяет (остаток прежней пропадает)
  const kindId = getFoodKindId(item);
  const kind = FOOD_KINDS[kindId];
  const had = p.foodTimer > 0 ? (p.foodKind && FOOD_KINDS[p.foodKind] ? p.foodKind : 'cookedMeat') : null;
  const same = had === kindId;

  if (same) {
    const freeSpace = MAX_BUFF_DURATION - p.foodTimer;
    if (freeSpace <= 0) {
      showToast(kind.icon, 'Сытость уже на максимуме (12 часов)');
      logLoot(`Сытость уже на максимуме (12 часов).`, 'log-info');
      return;
    }
    if (freeSpace < duration) {
      const freeMin = Math.ceil(freeSpace / 60);
      const addMin = Math.floor(duration / 60);
      showToast(kind.icon, `Не поместится: до потолка ${freeMin} мин, еда даёт ${addMin} мин`);
      logLoot(`Не поместится: до потолка ${freeMin} мин, а еда даёт ${addMin} мин.`, 'log-info');
      return;
    }
  }

  const lostMin = (!same && had) ? Math.ceil(p.foodTimer / 60) : 0;
  // случайно ткнул в другую еду — не терять часы сытости молча
  if (lostMin >= 5 && !confirm(`Сейчас действует «${FOOD_KINDS[had].name}» — ещё ${buffShopDur(Math.floor(p.foodTimer))}.\n\n«${kind.name}» заменит её, остаток пропадёт. Съесть?`)) return;
  p.foodTimer = same ? addBuffTime(p.foodTimer, duration) : duration;
  p.foodKind = kindId;

  const idx = p.inventory.indexOf(item);
  item.qty--;
  if (item.qty <= 0) p.inventory.splice(idx, 1);
  logCombat(`${kind.icon} Съедено: ${item.name} — ${foodKindText(kind)}. ` +
    (same ? 'Сытость продлена.' : had ? `Вместо «${FOOD_KINDS[had].name}» (пропало ${lostMin} мин).` : 'Сытость на ' + buffShopDur(duration) + '.'),
    'log-entry food');
  if (typeof unlockLoreMany === 'function') unlockLoreMany([loreFoodKey(item), 'satiety']);   // v0.32
  if (typeof annalsFirst === 'function') annalsFirst(loreFoodKey(item));
  renderInventory(); renderEffectsPanel();

  showToast(kind.icon, same ? `Сытость +${buffShopDur(duration)}` : `${kind.name}: ${foodKindText(kind)}`);

  saveCurrentSlot();
}

// v0.20: съесть блюдо. То же блюдо продлевает бонус, другое — заменяет.
// v0.35.1: блюдо больше не насыщает — только бонус (сытость — от еды, FOOD_KINDS).
function eatDish(item) {
  const p = state.player;
  const id = item.food.dish;
  const dish = DISHES[id];
  const dur = getFoodDuration(item);
  const same = p.dish && p.dish.id === id && p.dish.timer > 0;
  if (same && p.dish.timer + dur > MAX_BUFF_DURATION) {
    const freeMin = Math.max(0, Math.ceil((MAX_BUFF_DURATION - p.dish.timer) / 60));
    showToast(dish.icon, `Не поместится: до потолка ${freeMin} мин`);
    logLoot(`${dish.name}: до потолка 12 часов осталось ${freeMin} мин.`, 'log-info');
    return;
  }
  const replaced = p.dish && p.dish.timer > 0 && !same ? DISHES[p.dish.id] : null;
  p.dish = { id, timer: same ? p.dish.timer + dur : dur };

  const idx = p.inventory.indexOf(item);
  item.qty--;
  if (item.qty <= 0) p.inventory.splice(idx, 1);

  recalcStats();
  if (typeof updateCharacterPanel === 'function') updateCharacterPanel();
  logCombat(`${dish.icon} Съедено: ${dish.name} — ${dish.text}${replaced ? ` (вместо «${replaced.name}»)` : ''}.`, 'log-entry food');
  showToast(dish.icon, `${dish.text} · ${Math.floor(p.dish.timer / 60)} мин`);
  if (typeof unlockLoreMany === 'function') unlockLoreMany(['food.' + id]);   // v0.32 (v0.35.1: блюдо не насыщает)
  if (typeof annalsFirst === 'function') annalsFirst('food.' + id);
  renderInventory(); renderEffectsPanel();
  saveCurrentSlot();
}

// ---------- ПОДПИСИ И НИЖНЯЯ ПАНЕЛЬ ----------
function typeLabel(type) {
  const map = { weapon:'Оружие', shield:'Щит', helmet:'Шлем', armorTop:'Верхняя броня', armorBottom:'Нижняя броня',
    gloves:'Перчатки', boots:'Ботинки', necklace:'Амулет', earring:'Серьга', ring:'Кольцо',
    material:'Материал', consumable:'Расходник', food:'Еда' };
  return map[type] || type;
}

function updateInventoryFooter() {
  const p = state.player;
  document.getElementById('inv-gold').textContent = p.gold;
  document.getElementById('inv-weight').textContent = p.inventory.length;
  const maxEl = document.getElementById('inv-max');   // v0.35.1: ячеек — по уровню Заплечника
  if (maxEl) maxEl.textContent = invMaxSlots();
}

// ========================================================
//  МОДАЛКА ВЫБОРА ДЛЯ СЛОТОВ РАСХОДНИКОВ
// ========================================================

function getCurrentSlotShopId(slotType) {
  return slotType === 'potion'
    ? state.player.potionSlot
    : state.player.mixtureSlot;
}

function setSlotShopId(slotType, shopId) {
  if (slotType === 'potion') state.player.potionSlot = shopId;
  else state.player.mixtureSlot = shopId;
}

// Возможные пороги HP для зелья.
const POTION_THRESHOLDS = [30, 40, 50, 60, 70];

// Открыть модалку для слота.
function openSlotPicker(slotType) {
  const picker = document.getElementById('slot-picker');
  const titleEl = document.getElementById('slot-picker-title');
  const bodyEl = document.getElementById('slot-picker-body');
  if (!picker || !bodyEl) return;

  const currentShopId = getCurrentSlotShopId(slotType);

  const candidates = state.player.inventory.filter(item => {
    if (!item.shopId) return false;
    const shopItem = SHOP_ITEMS.find(s => s.id === item.shopId);
    return shopItem && shopItem.slotType === slotType;
  });

  titleEl.textContent = slotType === 'potion' ? 'ВЫБЕРИТЕ ЗЕЛЬЕ' : 'ВЫБЕРИТЕ МИКСТУРУ';

  let html = '';

  // ---- СЕКЦИЯ «ПОРОГ HP» — только для зелья ----
  if (slotType === 'potion') {
    const current = state.player.potionThreshold || 40;
    html += `<div class="slot-picker-section-label">Порог HP</div>`;
    html += `<div class="slot-picker-thresholds">`;
    POTION_THRESHOLDS.forEach(v => {
      const activeClass = (v === current) ? ' active' : '';
      html += `<button class="slot-picker-threshold-btn${activeClass}" onclick="event.stopPropagation(); setPotionThreshold(${v})">${v}%</button>`;
    });
    html += `</div>`;
    html += `<div class="slot-picker-threshold-hint">Зелье пьётся, когда HP ниже этого значения.</div>`;
    html += `<div class="slot-picker-divider"></div>`;
  }

  // ---- Текущий (если есть) ----
  if (currentShopId) {
    const shopItem = SHOP_ITEMS.find(s => s.id === currentShopId);
    const invItem = candidates.find(i => i.shopId === currentShopId);
    if (shopItem) {
      html += `
        <div class="slot-picker-section-label">Текущее:</div>
        <div class="slot-picker-item current">
          <div class="slot-picker-icon">${SVG[shopItem.icon] || ''}</div>
          <div class="slot-picker-info">
            <div class="slot-picker-name">${shopItem.name}</div>
            <div class="slot-picker-stock">В инвентаре: ${invItem ? invItem.qty : 0}</div>
          </div>
          <button class="slot-picker-clear" onclick="event.stopPropagation(); clearSlot('${slotType}')">Снять</button>
        </div>
        <div class="slot-picker-divider"></div>
      `;
    }
  }

  // ---- Список доступных ----
  const available = candidates.filter(i => i.shopId !== currentShopId);
  if (available.length === 0) {
    if (!currentShopId) {
      html += `<div class="slot-picker-empty">Нет предметов этого типа.<br>Купите у торговца.</div>`;
    } else {
      html += `<div class="slot-picker-empty">Больше нет в инвентаре.</div>`;
    }
  } else {
    available.forEach(item => {
      const shopItem = SHOP_ITEMS.find(s => s.id === item.shopId);
      if (!shopItem) return;
      html += `
        <div class="slot-picker-item" onclick="selectSlotItem('${slotType}', '${item.shopId}')">
          <div class="slot-picker-icon">${SVG[shopItem.icon] || ''}</div>
          <div class="slot-picker-info">
            <div class="slot-picker-name">${shopItem.name}</div>
            <div class="slot-picker-stock">В инвентаре: ${item.qty}</div>
          </div>
        </div>
      `;
    });
  }

  bodyEl.innerHTML = html;

  const slotEl = document.querySelector(`.equip-slot[data-slot="${slotType}Slot"]`);
  positionSlotPicker(slotEl);

  picker.classList.add('active');
}

function closeSlotPicker() {
  const picker = document.getElementById('slot-picker');
  if (picker) picker.classList.remove('active');
}

function positionSlotPicker(slotEl) {
  const picker = document.getElementById('slot-picker');
  if (!slotEl || !picker) return;

  picker.style.visibility = 'hidden';
  picker.style.left = '0px';
  picker.style.top = '0px';
  picker.classList.add('active');

  const rect = slotEl.getBoundingClientRect();
  const pickerRect = picker.getBoundingClientRect();

  const pickerWidth = pickerRect.width;
  const pickerHeight = pickerRect.height;
  const margin = 8;

  let left = rect.right + margin;
  let top = rect.top;

  if (left + pickerWidth > window.innerWidth) {
    left = rect.left - pickerWidth - margin;
  }
  if (left < 0) {
    left = (window.innerWidth - pickerWidth) / 2;
  }

  if (top + pickerHeight > window.innerHeight) {
    top = window.innerHeight - pickerHeight - margin;
  }
  if (top < 0) top = margin;

  picker.style.left = left + 'px';
  picker.style.top = top + 'px';
  picker.style.visibility = 'visible';
}

function selectSlotItem(slotType, shopId) {
  setSlotShopId(slotType, shopId);
  closeSlotPicker();
  renderEquipSlots();
  saveCurrentSlot();

  const shopItem = SHOP_ITEMS.find(s => s.id === shopId);
  showToast('✅', `В слот: ${shopItem ? shopItem.name : shopId}`);
}

function clearSlot(slotType) {
  setSlotShopId(slotType, null);
  closeSlotPicker();
  renderEquipSlots();
  saveCurrentSlot();
  showToast('🗑', 'Слот очищен');
}

// ---------- ПОРОГ ЗЕЛЬЯ ----------
function setPotionThreshold(value) {
  if (!POTION_THRESHOLDS.includes(value)) return;
  state.player.potionThreshold = value;
  renderEquipSlots();
  saveCurrentSlot();

  const picker = document.getElementById('slot-picker');
  if (picker && picker.classList.contains('active')) {
    openSlotPicker('potion');
  }

  showToast('⚙', `Порог зелья: ${value}%`);
}

// ---------- ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ МОДАЛКИ ----------
document.addEventListener('click', (e) => {
  const picker = document.getElementById('slot-picker');
  if (!picker || !picker.classList.contains('active')) return;
  if (picker.contains(e.target)) return;
  // v0.27: слот левой руки тоже открывает выбор (щит / второе оружие)
  const slot = e.target.closest('.equip-slot[data-slot="potionSlot"], .equip-slot[data-slot="mixtureSlot"], .equip-slot[data-slot="shield"]');
  if (slot) return;
  closeSlotPicker();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSlotPicker();
});

// ========================================================
//  МИГРАЦИЯ СТАРЫХ СОХРАНЕНИЙ
//  Переименовывает «Верх доспеха» → «Потрёпанная куртка» и
//  «Низ доспеха» → «Потрёпанные штаны» в инвентаре и экипировке.
//  А ТАКЖЕ — превращает любые icon-строки «img/...» в <img>-теги.
// ========================================================
function migrateOldPatchedSet() {
  const p = state.player;

  function migrateItem(item) {
    if (!item) return item;

    // ---- 1. Переименование старых предметов ----
    if (item.name === 'Верх доспеха') {
      item.name = 'Потрёпанная куртка';
      item.icon = 'img/armor/patched_top.webp';
      item.stats = { pDef: 2 };
      item.setId = 'patched';
    } else if (item.name === 'Низ доспеха') {
      item.name = 'Потрёпанные штаны';
      item.icon = 'img/armor/patched_bottom.webp';
      item.stats = { pDef: 2, mpBonus: 10 };
      item.setId = 'patched';
    }

    // ---- 2. Превращаем путь img/... в <img>-тег ----
    if (typeof item.icon === 'string' && item.icon.startsWith('img/')) {
      item.icon = `<img src="${item.icon}" alt="" style="width:100%;height:100%;object-fit:contain;">`;
    }

    // ---- 3. Совместимость: если нет refineLevel / refineBonuses — ставим дефолт ----
    if (item.refineLevel === undefined) item.refineLevel = 0;
    if (item.refineBonuses === undefined) item.refineBonuses = null;

    return item;
  }

  // --- Инвентарь ---
  p.inventory.forEach(migrateItem);

  // --- Экипировка ---
  Object.keys(p.equipment).forEach(slot => {
    if (p.equipment[slot]) {
      p.equipment[slot] = migrateItem(p.equipment[slot]);
    }
  });
}