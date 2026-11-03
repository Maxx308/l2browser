// ========================================================
//  СИСТЕМЫ: ЭКИПИРОВКА
//  + Слоты расходников: зелье и микстура.
//  + На слоте зелья — текущий порог HP.
//  + На слоте микстуры — заряды активной микстуры.
//  + Авто-очистка: если предмет кончился — тост + лог.
// ========================================================

function getEquipSlotForType(type) {
  const map = {
    weapon: ['weapon'],
    shield: ['shield'],
    helmet: ['helmet'],
    armorTop: ['armorTop'],
    armorBottom: ['armorBottom'],
    gloves: ['gloves'],
    boots: ['boots'],
    necklace: ['necklace'],
    earring: ['earring1', 'earring2'],
    ring: ['ring1', 'ring2'],
  };
  return map[type] || null;
}

// v0.27: toOffhand — надеть оружие во вторую руку (слот щита), см. openOffhandPicker.
function equipItem(item, toOffhand) {
  const p = state.player;
  const slots = getEquipSlotForType(item.type);
  if (!slots) {
    showToast('📦', `${item.name} — не надевается`);
    logLoot(`${item.name} — не надевается.`, 'log-info');
    return;
  }
  if (item.type === 'shield' && hasTwoHandedWeapon()) {
    showToast('🛡', 'Нельзя: двуручное оружие');
    logLoot(`Нельзя: двуручное оружие.`, 'log-info');
    return;
  }
  if (toOffhand) {
    let why = '';
    if (isMage()) why = 'парное оружие — только для воинов';
    else if (!canDualWield(item)) why = 'во вторую руку — только одноручные мечи, топоры, кинжалы и дубины';
    else if (!p.equipment.weapon) why = 'сначала возьмите оружие в основную руку';
    else if (hasTwoHandedWeapon()) why = 'в основной руке двуручное оружие';
    if (why) { showToast('🗡', `Нельзя: ${why}`); logLoot(`Нельзя: ${why}.`, 'log-info'); return; }
  }
  const currentSlot = Object.keys(p.equipment).find(k => p.equipment[k] && p.equipment[k].id === item.id);
  if (currentSlot) { unequipSlot(currentSlot); return; }
  const oldMaxMp = p.maxMp;
  let targetSlot = toOffhand ? 'shield' : (slots.find(s => p.equipment[s] === null) || slots[0]);
  if (p.equipment[targetSlot]) unequipSlot(targetSlot);
  if (p.equipment[targetSlot]) return;   // снять не удалось (сумка полна)
  if (item.type === 'weapon' && item.twoHanded && p.equipment.shield) {
    logLoot(getOffhandWeapon() ? `Двуручное оружие: вторая рука освобождена.` : `Двуручное оружие: щит снят.`, 'log-info');
    unequipSlot('shield');
  }
  let itemToEquip = item;
  if (item.qty > 1) {
    item.qty--;
    itemToEquip = JSON.parse(JSON.stringify(item));
    itemToEquip.qty = 1;
    itemToEquip.id = 'item_' + Date.now() + '_' + Math.random() + '_eq';
  } else {
    const idx = p.inventory.indexOf(item);
    if (idx >= 0) p.inventory.splice(idx, 1);
  }
  p.equipment[targetSlot] = itemToEquip;
  recalcStats();
  const diff = p.maxMp - oldMaxMp;
  if (diff > 0) p.mp = Math.min(p.maxMp, p.mp + diff);
  else if (diff < 0 && p.mp > p.maxMp) p.mp = p.maxMp;
  renderInventory(); renderEquipSlots();
  updateCharacterPanel(); updateInventoryFooter();
  logLoot(toOffhand ? `Во вторую руку: ${item.name} (парное оружие)` : `Надето: ${item.name}`, 'log-info');
  if (toOffhand) showToast('🗡', `Вторая рука: ${item.name}`);

  saveCurrentSlot();
}

// ---------- v0.27: ВЫБОР ДЛЯ ЛЕВОЙ РУКИ (щит или второе оружие) ----------
// Клик по пустому слоту щита. Клик по вещи в сумке по-прежнему надевает в основную руку.
function openOffhandPicker() {
  const p = state.player;
  const picker = document.getElementById('slot-picker');
  const titleEl = document.getElementById('slot-picker-title');
  const bodyEl = document.getElementById('slot-picker-body');
  if (!picker || !bodyEl) return;
  if (typeof hideTooltip === 'function') hideTooltip();   // подсказка слота не должна закрывать список

  const dualOk = !isMage() && p.equipment.weapon && !hasTwoHandedWeapon();
  const shields = p.inventory.filter(i => i.type === 'shield');
  const weapons = dualOk ? p.inventory.filter(canDualWield) : [];

  titleEl.textContent = 'ЛЕВАЯ РУКА';
  const row = (it, hint) => {
    const rc = it.rarity && it.rarity !== 'white' ? ` style="color:${RARITIES[it.rarity].color}"` : '';
    return `<div class="slot-picker-item" onclick="pickOffhandItem(${p.inventory.indexOf(it)})">` +
      `<div class="slot-picker-icon">${normalizeIconHtml(it.icon)}</div>` +
      `<div class="slot-picker-info"><div class="slot-picker-name"${rc}>${it.name}${getRefineSuffix(it)}</div>` +
      `<div class="slot-picker-stock">${hint}</div></div></div>`;
  };

  let html = '';
  html += `<div class="slot-picker-section-label">Щит</div>`;
  html += shields.length ? shields.map(s => row(s, `блок ${s.stats.blockChance || 0}%, стойка −${SHIELD_STANCE_DAMAGE_CUT}% урона`)).join('')
    : `<div class="slot-picker-empty">Щитов в сумке нет.</div>`;
  html += `<div class="slot-picker-divider"></div>`;
  html += `<div class="slot-picker-section-label">Второе оружие</div>`;
  if (!dualOk) {
    html += `<div class="slot-picker-empty">${isMage() ? 'Только для воинов.' : 'Нужно одноручное оружие в основной руке.'}</div>`;
  } else if (!weapons.length) {
    html += `<div class="slot-picker-empty">Нет подходящего: одноручные мечи, топоры, кинжалы, дубины.</div>`;
  } else {
    html += weapons.map(w => row(w, `+${Math.floor(getItemStat(w, 'pAtk') * DUAL_WIELD_OFFHAND_PERCENT / 100)} к обычной атаке`)).join('');
    html += `<div class="slot-picker-threshold-hint">Обычная атака +${DUAL_WIELD_OFFHAND_PERCENT}% атаки второго оружия, скорость атаки +${DUAL_WIELD_ATB_BONUS}%, фишки второго оружия — с половинным шансом. Навыки — основной рукой. Точность −${DUAL_WIELD_ACCURACY_PENALTY}, уворот −${DUAL_WIELD_EVASION_PENALTY}.</div>`;
    html += `<div class="slot-picker-threshold-hint">Пустая левая рука — «Свободная рука»: +${FREE_HAND_EVASION_BONUS} к увороту.</div>`;
  }
  bodyEl.innerHTML = html;
  positionSlotPicker(document.querySelector('.equip-slot[data-slot="shield"]'));
  picker.classList.add('active');
}

function pickOffhandItem(invIdx) {
  const item = state.player.inventory[invIdx];
  closeSlotPicker();
  if (!item) return;
  equipItem(item, item.type === 'weapon');
}

function unequipSlot(slotKey) {
  const p = state.player;
  const item = p.equipment[slotKey];
  if (!item) return;

  if (p.inventory.length >= INVENTORY_MAX_SLOTS) {
    showToast('📦', 'Инвентарь переполнен — нельзя снять');
    logLoot(`📦 Инвентарь переполнен — нельзя снять «${item.name}».`, 'log-info');
    return;
  }

  const oldMaxMp = p.maxMp;
  p.equipment[slotKey] = null;
  p.inventory.push({ ...item, qty: 1 });
  recalcStats();
  const diff = oldMaxMp - p.maxMp;
  if (diff > 0 && p.mp > p.maxMp) p.mp = p.maxMp;
  renderInventory(); renderEquipSlots();
  updateCharacterPanel(); updateInventoryFooter();
  logLoot(`Снято: ${item.name}`, 'log-info');

  saveCurrentSlot();
}

function findShopItemInInventory(shopId) {
  if (!shopId) return null;
  return state.player.inventory.find(i => i.shopId === shopId) || null;
}

function renderEquipSlots() {
  const p = state.player;
  const twoHanded = hasTwoHandedWeapon();

  // ---- АВТО-ОЧИСТКА СЛОТОВ РАСХОДНИКОВ ----
  if (p.potionSlot && !findShopItemInInventory(p.potionSlot)) {
    const shopItem = SHOP_ITEMS.find(s => s.id === p.potionSlot);
    const name = shopItem ? shopItem.name : p.potionSlot;
    p.potionSlot = null;
    showToast('🧪', `${name} закончилось — слот зелья пуст`);
    logLoot(`🧪 ${name} закончилось. Слот зелья очищен.`, 'log-info');
  }

  // Для микстуры авто-очистка только если микстура НЕ активна.
  const activeMix = state.battle.activeEffects.mixture;
  if (p.mixtureSlot && !activeMix && !findShopItemInInventory(p.mixtureSlot)) {
    const shopItem = SHOP_ITEMS.find(s => s.id === p.mixtureSlot);
    const name = shopItem ? shopItem.name : p.mixtureSlot;
    p.mixtureSlot = null;
    showToast('⚗', `${name} закончилось — слот микстуры пуст`);
    logLoot(`⚗ ${name} закончилось. Слот микстуры очищен.`, 'log-info');
  }

  document.querySelectorAll('.equip-slot').forEach(el => {
    const slotKey = el.dataset.slot;
    if (slotKey === 'potionSlot' || slotKey === 'mixtureSlot') return;
    // v0.30: сумка — не снаряжение (её нельзя снять), рисуется отдельно
    if (slotKey === 'bag') { if (typeof renderBagSlot === 'function') renderBagSlot(el); return; }

    const item = p.equipment[slotKey];
    const isShieldLocked = slotKey === 'shield' && twoHanded;

    el.classList.remove('rarity-white','rarity-green','rarity-blue','rarity-purple','rarity-yellow','rarity-red');

    if (isShieldLocked) {
      el.classList.add('locked'); el.classList.remove('filled'); el.innerHTML = '';
      el.onclick = () => {
        showToast('🛡', 'Слот щита недоступен: двуручное оружие');
        logLoot(`Слот щита недоступен: двуручное оружие.`, 'log-info');
      };
    } else {
      el.classList.remove('locked');
      if (item) {
        el.classList.add('filled');
        el.innerHTML = item.icon;
        if (item.rarity && item.rarity !== 'white') {
          el.classList.add('rarity-' + item.rarity);
        }
      } else {
        el.classList.remove('filled');
        el.innerHTML = '';
      }
      // v0.27: пустая левая рука — выбор щита или второго оружия
      el.onclick = (!item && slotKey === 'shield') ? () => openOffhandPicker() : () => unequipSlot(slotKey);
    }
  });

  renderConsumableSlots();
}

function renderConsumableSlots() {
  const p = state.player;

  // --- Слот зелья ---
  const potionEl = document.querySelector('.equip-slot[data-slot="potionSlot"]');
  if (potionEl) {
    if (p.potionSlot) {
      const shopItem = SHOP_ITEMS.find(s => s.id === p.potionSlot);
      const invItem = findShopItemInInventory(p.potionSlot);
      if (shopItem && invItem) {
        potionEl.classList.add('filled');
        potionEl.innerHTML = `
          ${SVG[shopItem.icon] || ''}
          <div class="consumable-qty">×${invItem.qty}</div>
          <div class="consumable-threshold">${p.potionThreshold || 40}</div>
        `;
      } else {
        potionEl.classList.remove('filled');
        potionEl.innerHTML = '🧪';
      }
    } else {
      potionEl.classList.remove('filled');
      potionEl.innerHTML = '🧪';
    }
    potionEl.onclick = () => openSlotPicker('potion');
  }

  // --- Слот микстуры ---
  const mixtureEl = document.querySelector('.equip-slot[data-slot="mixtureSlot"]');
  if (mixtureEl) {
    const activeMix = state.battle.activeEffects.mixture;

    if (activeMix) {
      // Микстура активна — показываем заряды.
      const data = MIXTURE_EFFECTS[activeMix.id];
      const iconKey = data ? data.icon : 'potionAtk';
      mixtureEl.classList.add('filled');
      mixtureEl.innerHTML = `
        ${SVG[iconKey] || ''}
        <div class="consumable-qty">${activeMix.chargesLeft}</div>
      `;
      mixtureEl.onclick = () => openSlotPicker('mixture');
      return;
    }

    // Микстура не активна.
    if (p.mixtureSlot) {
      const shopItem = SHOP_ITEMS.find(s => s.id === p.mixtureSlot);
      const invItem = findShopItemInInventory(p.mixtureSlot);
      if (shopItem && invItem) {
        mixtureEl.classList.add('filled');
        mixtureEl.innerHTML = `
          ${SVG[shopItem.icon] || ''}
          <div class="consumable-qty">×${invItem.qty}</div>
        `;
      } else {
        mixtureEl.classList.remove('filled');
        mixtureEl.innerHTML = '⚗';
      }
    } else {
      mixtureEl.classList.remove('filled');
      mixtureEl.innerHTML = '⚗';
    }
    mixtureEl.onclick = () => openSlotPicker('mixture');
  }
}