// ========================================================
//  СИСТЕМЫ: ТОРГОВЕЦ
//  + При открытии — отменяем ожидание автостарта боя.
//  + Магазин: покупка и продажа.
//
//  ШАГ 4: у купленных предметов сохраняется shopId —
//  нужно для проверки прогресса квеста (hasQuestItem).
//  + «Починка»: если в инвентаре есть предмет с тем же именем,
//    но без shopId (старое сохранение) — при покупке
//    ему присваивается shopId и складывается количество.
//
//  НОВОЕ (продажа с редкостью и тултипом):
//  + Продажа группируется по имени + редкости + бонусным статам.
//  + В строке показывается название с цветом редкости.
//  + При наведении — всплывает тултип со статами.
//
//  НОВОЕ (v0.18): ВЫКУП.
//  + Всё проданное попадает во вкладку «Выкуп».
//  + Выкупить можно по той же цене, за которую продали.
//  + Список очищается, когда игрок уходит из города
//    (переход, телепорт, смерть) или меняет персонажа.
//  + Список живёт только в памяти: после перезагрузки страницы он пуст.
// ========================================================

function openTrader() {
  if (state.player.currentLocation !== 'town') return;

  if (typeof cancelWaitingForResume === 'function') {
    cancelWaitingForResume('открыт торговец');
  }

  document.getElementById('trader-overlay').classList.add('active');
  renderTraderBuy(); renderTraderSell(); renderTraderBuyback(); updateTraderGold();
}
function closeTrader() { document.getElementById('trader-overlay').classList.remove('active'); }

function switchTraderTab(pane) {
  document.querySelectorAll('.window-tab[data-pane]').forEach(t => t.classList.toggle('active', t.dataset.pane === pane));
  document.getElementById('trader-pane-buy').classList.toggle('active', pane === 'buy');
  document.getElementById('trader-pane-sell').classList.toggle('active', pane === 'sell');
  const bb = document.getElementById('trader-pane-buyback');
  if (bb) bb.classList.toggle('active', pane === 'buyback');
  if (pane === 'buyback') renderTraderBuyback();
}

function updateTraderGold() {
  const el = document.getElementById('trader-gold');
  if (el) el.textContent = state.player.gold;
}

function renderTraderBuy() {
  const pane = document.getElementById('trader-pane-buy');
  pane.innerHTML = '';
  const p = state.player;
  SHOP_ITEMS.forEach(item => {
    const el = document.createElement('div');
    el.className = 'trade-item';
    const stock = p.inventory.filter(i => i.shopId === item.id).reduce((s, i) => s + i.qty, 0);
    el.innerHTML = `<div class="trade-item-icon">${SVG[item.icon]}</div><div class="trade-item-info"><div class="trade-item-name">${item.name}</div><div class="trade-item-effect">${item.effect}</div><div class="trade-item-desc">${item.description}</div><div class="trade-item-usage">${item.usage}</div><div class="trade-item-stock">В инвентаре: ${stock}</div></div><div class="trade-item-actions"><div class="trade-item-price">${SVG.gold} ${item.price}</div><button class="btn small" onclick="buyItem('${item.id}', 1)">Купить 1</button><button class="btn small" onclick="buyItem('${item.id}', 10)">×10</button><button class="btn small" onclick="buyItem('${item.id}', 100)">×100</button></div>`;
    pane.appendChild(el);
  });
}

// --------------------------------------------------------
//  ПРОДАЖА
//  Группируем по имени + редкости + бонусным статам.
//  Продаём по уникальному ключу группы.
// --------------------------------------------------------

// Уникальный ключ группы: имя + редкость + отсортированные бонусные статы.
function getSellGroupKey(item) {
  const rarity = item.rarity || 'white';
  const bs = item.bonusStats || {};
  // Стабильный "слепок" бонусных статов: STR:2,DEX:1 (отсортировано).
  const bonusStr = Object.keys(bs)
    .filter(k => bs[k] > 0)
    .sort()
    .map(k => k + ':' + bs[k])
    .join(',');
  // v0.18: подгонка тоже в ключе — подогнанные вещи идут отдельной строкой,
  // чтобы «+4» случайно не ушёл вместе с обычными.
  const refine = item.refineLevel || 0;
  const rb = item.refineBonuses || {};
  const refineStr = refine > 0
    ? '|+' + refine + ':' + Object.keys(rb).sort().map(k => k + '=' + rb[k]).join(',')
    : '';
  return item.name + '|' + rarity + '|' + bonusStr + refineStr;
}

// Цвет имени по редкости.
function getRarityColor(rarityId) {
  if (typeof RARITIES === 'undefined' || !RARITIES[rarityId]) return '';
  return RARITIES[rarityId].color || '';
}

function renderTraderSell() {
  const pane = document.getElementById('trader-pane-sell');
  pane.innerHTML = '';
  const p = state.player;

  // Отбираем то, что можно продать.
  const sellable = p.inventory.filter(i =>
    !i.equipped &&
    i.type !== 'consumable' &&
    i.type !== 'food'
  );

  if (sellable.length === 0) {
    pane.innerHTML = `<div class="trader-empty">Нет предметов для продажи</div>`;
    return;
  }

  // Группировка: ключ = имя + редкость + бонусные статы.
  const grouped = {};
  sellable.forEach(i => {
    const key = getSellGroupKey(i);
    if (!grouped[key]) {
      grouped[key] = {
        key,
        name: i.name,
        rarity: i.rarity || 'white',
        bonusStats: i.bonusStats || null,
        icon: i.icon,
        type: i.type,
        sellPrice: i.sellPrice,
        refineLevel: i.refineLevel || 0,
        // Для тултипа — храним «эталонный» предмет группы.
        sampleItem: i,
        totalQty: 0,
      };
    }
    grouped[key].totalQty += i.qty;
  });

  // Сортируем: сначала по имени, потом по редкости.
  const rarityOrder = { white: 0, green: 1, blue: 2, purple: 3, yellow: 4, red: 5 };
  const groups = Object.values(grouped).sort((a, b) => {
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    const r = (rarityOrder[a.rarity] || 0) - (rarityOrder[b.rarity] || 0);
    if (r !== 0) return r;
    return (a.refineLevel || 0) - (b.refineLevel || 0);
  });

  groups.forEach(group => {
    const el = document.createElement('div');
    el.className = 'trade-item';

    const color = getRarityColor(group.rarity);
    const rarity = (typeof RARITIES !== 'undefined') ? RARITIES[group.rarity] : null;
    const rarityLabel = (rarity && rarity.id !== 'white') ? ` (${rarity.name})` : '';

    const safeKey = group.key.replace(/'/g, "\\'");

    el.innerHTML = `
      <div class="trade-item-icon">${group.icon}</div>
      <div class="trade-item-info">
        <div class="trade-item-name" style="color:${color || 'inherit'};">${group.name}${group.refineLevel > 0 ? ` <span class="trade-item-refine">+${group.refineLevel}</span>` : ''}${rarityLabel}</div>
        <div class="trade-item-desc">${typeLabel(group.type)}${group.refineLevel > 0 ? ' · подогнан' : ''}</div>
        <div class="trade-item-stock">В инвентаре: ${group.totalQty}</div>
      </div>
      <div class="trade-item-actions">
        <div class="trade-item-price">${SVG.gold} ${group.sellPrice}</div>
        <div class="sell-buttons">
          <button class="btn small" onclick="sellItemByKey('${safeKey}', 1)">1</button>
          <button class="btn small" onclick="sellItemByKey('${safeKey}', 10)">10</button>
          <button class="btn small" onclick="sellItemByKey('${safeKey}', 9999)">Всё</button>
        </div>
      </div>
    `;

    // ---- ТУЛТИП ПРИ НАВЕДЕНИИ ----
    // Используем существующую функцию showItemTooltip из tooltips.js.
    el.onmouseenter = (e) => showItemTooltip(e, group.sampleItem);
    el.onmouseleave = () => hideTooltip();

    pane.appendChild(el);
  });
}

// Продажа по ключу (name|rarity|bonusStats).
function sellItemByKey(groupKey, count) {
  const p = state.player;

  // Находим все предметы, попадающие в эту группу.
  const matching = p.inventory.filter(i => {
    if (i.equipped) return false;
    if (i.type === 'consumable' || i.type === 'food') return false;
    return getSellGroupKey(i) === groupKey;
  });

  if (matching.length === 0) return;

  const totalAvailable = matching.reduce((s, i) => s + i.qty, 0);
  const remainingStart = Math.min(count, totalAvailable);
  const price = matching[0].sellPrice || 1;
  let remaining = remainingStart;
  let totalSold = 0;

  for (const item of matching) {
    if (remaining <= 0) break;
    const take = Math.min(item.qty, remaining);
    addToTraderBuyback(item, take, price);   // v0.18: запоминаем для выкупа (до удаления)
    item.qty -= take;
    remaining -= take;
    totalSold += take;

    if (item.qty <= 0) {
      const idx = p.inventory.indexOf(item);
      if (idx >= 0) p.inventory.splice(idx, 1);
    }
  }

  const total = totalSold * price;
  p.gold += total;

  // Формируем читаемый лог с названием и редкостью.
  const sample = matching[0];
  const rarityId = sample.rarity || 'white';
  const rarity = (typeof RARITIES !== 'undefined') ? RARITIES[rarityId] : null;
  const rarityLabel = (rarity && rarity.id !== 'white') ? ` (${rarity.name})` : '';
  const bonusText = sample.bonusStats ? formatRarityBonus(sample.bonusStats) : '';
  const bonusStr = bonusText ? ` · ${bonusText}` : '';

  logLoot(`Продано: ${sample.name}${rarityLabel} ×${totalSold}${bonusStr}, +${total} оболов`, 'log-info');

  updateTopStatus();
  updateTraderGold();
  if (typeof updateForgeGold === 'function') updateForgeGold();
  if (typeof updateGuildGold === 'function') updateGuildGold();
  renderInventory();
  renderTraderBuy();
  renderTraderSell();
  renderTraderBuyback();
  updateInventoryFooter();

  saveCurrentSlot();
}

// --------------------------------------------------------
//  ПОКУПКА
// --------------------------------------------------------
function buyItem(shopId, count) {
  const p = state.player;
  const item = SHOP_ITEMS.find(i => i.id === shopId);
  if (!item) return;
  const maxAffordable = Math.floor(p.gold / item.price);
  if (maxAffordable <= 0) { logLoot(`Недостаточно Оболов.`, 'log-info'); return; }
  const actualCount = Math.min(count, maxAffordable);
  const totalCost = actualCount * item.price;
  p.gold -= totalCost;

  // 1. Ищем предмет с таким же shopId.
  const existing = p.inventory.find(i => i.shopId === shopId);

  if (existing) {
    existing.qty += actualCount;
  } else {
    // 2. «Починка»: ищем предмет с тем же именем БЕЗ shopId
    //    (например, из старого сохранения).
    const legacyItem = p.inventory.find(i => i.name === item.name && !i.shopId);

    if (legacyItem) {
      legacyItem.shopId = shopId;
      legacyItem.qty += actualCount;
    } else {
      // 3. Создаём новый.
      p.inventory.push({
        id: 'item_' + Date.now() + '_' + Math.random(),
        shopId: shopId,
        name: item.name,
        type: 'consumable',
        icon: SVG[item.icon],
        qty: actualCount,
        effect: item.effect,
        sellPrice: Math.floor(item.price * 0.3),
      });
    }
  }

  if (actualCount < count) logLoot(`Куплено: ${item.name} ×${actualCount} (не хватило на ${count}), −${totalCost} оболов`, 'log-info');
  else logLoot(`Куплено: ${item.name} ×${actualCount}, −${totalCost} оболов`, 'log-info');
  updateTopStatus(); updateTraderGold(); updateForgeGold(); updateGuildGold?.();
  renderInventory(); renderTraderBuy(); renderTraderSell(); updateInventoryFooter(); renderConsumablesPanel();

  saveCurrentSlot();
}

// ========================================================
//  ВЫКУП (v0.18)
// ========================================================

const TRADER_BUYBACK_MAX = 40;                         // сколько позиций помним
const TRADER_STACKABLE_TYPES = ['material', 'consumable', 'food'];

// Список выкупа с проверкой: тот же персонаж и он всё ещё в городе.
function getTraderBuyback() {
  const owner = `${state.activeSlotIndex}|${state.player.name}|${state.player.classId}`;
  if (!state.traderBuyback || state.traderBuyback.owner !== owner) {
    state.traderBuyback = { owner, items: [] };
  }
  return state.traderBuyback.items;
}

function clearTraderBuyback() {
  if (state.traderBuyback) state.traderBuyback.items = [];
  renderTraderBuyback();
}

// Запомнить проданное. item — предмет из инвентаря (ещё не удалён), take — сколько штук, price — цена за штуку.
function addToTraderBuyback(item, take, price) {
  if (!item || take <= 0) return;
  const list = getTraderBuyback();
  const copy = JSON.parse(JSON.stringify(item));
  copy.qty = take;
  delete copy.equipped;
  const unit = price || item.sellPrice || 1;

  if (TRADER_STACKABLE_TYPES.includes(copy.type)) {
    const same = list.find(e => e.item.name === copy.name && e.item.type === copy.type && e.price === unit &&
      getSellGroupKey(e.item) === getSellGroupKey(copy));
    if (same) { same.item.qty += take; same.at = Date.now(); return; }
  }

  list.unshift({ item: copy, price: unit, at: Date.now() });
  if (list.length > TRADER_BUYBACK_MAX) list.length = TRADER_BUYBACK_MAX;
}

function renderTraderBuyback() {
  const tab = document.getElementById('trader-tab-buyback');
  const pane = document.getElementById('trader-pane-buyback');
  if (!pane) return;
  const list = (state.player && state.player.classId) ? getTraderBuyback() : [];

  if (tab) tab.textContent = list.length > 0 ? `ВЫКУП (${list.length})` : 'ВЫКУП';

  pane.innerHTML = `<div class="buyback-hint">Проданное можно выкупить по той же цене. Список очистится, когда вы уйдёте из города.</div>`;

  if (list.length === 0) {
    pane.innerHTML += `<div class="trader-empty">Вы пока ничего не продали</div>`;
    return;
  }

  list.forEach((entry, index) => {
    const it = entry.item;
    const el = document.createElement('div');
    el.className = 'trade-item';

    const color = getRarityColor(it.rarity || 'white');
    const rarity = (typeof RARITIES !== 'undefined') ? RARITIES[it.rarity || 'white'] : null;
    const rarityLabel = (rarity && rarity.id !== 'white') ? ` (${rarity.name})` : '';
    const refine = (it.refineLevel > 0) ? ` +${it.refineLevel}` : '';
    const qty = it.qty || 1;
    const canAll = state.player.gold >= entry.price * qty;
    const canOne = state.player.gold >= entry.price;

    let buttons;
    if (qty > 1) {
      buttons = `
        <button class="btn small" ${canOne ? '' : 'disabled'} onclick="buybackItem(${index}, 1)">1</button>
        ${qty > 10 ? `<button class="btn small" ${state.player.gold >= entry.price * 10 ? '' : 'disabled'} onclick="buybackItem(${index}, 10)">10</button>` : ''}
        <button class="btn small" ${canAll ? '' : 'disabled'} onclick="buybackItem(${index}, 9999)">Всё</button>`;
    } else {
      buttons = `<button class="btn small" ${canOne ? '' : 'disabled'} onclick="buybackItem(${index}, 1)">Выкупить</button>`;
    }

    el.innerHTML = `
      <div class="trade-item-icon">${it.icon || ''}</div>
      <div class="trade-item-info">
        <div class="trade-item-name" style="color:${color || 'inherit'};">${it.name}${refine}${rarityLabel}</div>
        <div class="trade-item-desc">${typeLabel(it.type)}</div>
        <div class="trade-item-stock">Продано: ${qty}${qty > 1 ? ` · за всё ${entry.price * qty}` : ''}</div>
      </div>
      <div class="trade-item-actions">
        <div class="trade-item-price">${SVG.gold} ${entry.price}</div>
        <div class="sell-buttons">${buttons}</div>
      </div>
    `;
    el.onmouseenter = (e) => showItemTooltip(e, it);
    el.onmouseleave = () => hideTooltip();
    pane.appendChild(el);
  });
}

function buybackItem(index, count) {
  const p = state.player;
  const list = getTraderBuyback();
  const entry = list[index];
  if (!entry) return;

  const it = entry.item;
  const n = Math.min(count, it.qty || 1);
  const cost = n * entry.price;
  if (p.gold < cost) { showToast('🪙', 'Недостаточно Оболов'); return; }

  const stackable = TRADER_STACKABLE_TYPES.includes(it.type);
  const stack = stackable
    ? p.inventory.find(i => i.name === it.name && i.type === it.type && (i.shopId || null) === (it.shopId || null))
    : null;

  if (!stack && p.inventory.length >= INVENTORY_MAX_SLOTS) {
    showToast('📦', 'Инвентарь переполнен');
    return;
  }

  if (stack) {
    stack.qty += n;
  } else {
    const back = JSON.parse(JSON.stringify(it));
    back.qty = n;
    back.id = 'item_' + Date.now() + '_' + Math.random();
    p.inventory.push(back);
  }

  p.gold -= cost;
  it.qty = (it.qty || 1) - n;
  if (it.qty <= 0) list.splice(index, 1);

  const refine = (it.refineLevel > 0) ? ` +${it.refineLevel}` : '';
  logLoot(`↩ Выкуплено: ${it.name}${refine} ×${n}, −${cost} оболов`, 'log-info');
  showToast('↩', `Выкуплено: ${it.name}${refine}${n > 1 ? ' ×' + n : ''}`);

  updateTopStatus();
  updateTraderGold();
  if (typeof updateForgeGold === 'function') updateForgeGold();
  if (typeof updateGuildGold === 'function') updateGuildGold();
  renderInventory();
  renderTraderBuy();
  renderTraderSell();
  renderTraderBuyback();
  updateInventoryFooter();
  saveCurrentSlot();
}

// Следим за локацией: стоило игроку оказаться НЕ в городе — список выкупа пропадает.
// (Переход, телепорт, магическая тропа, смерть с возвратом — всё ловится здесь.)
setInterval(() => {
  if (!state.traderBuyback || state.traderBuyback.items.length === 0) return;
  if (state.player && state.player.currentLocation !== 'town') clearTraderBuyback();
}, 300);

