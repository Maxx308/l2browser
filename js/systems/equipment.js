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

// Один расчёт для сравнения и надевания, включая место для всех снимаемых вещей.
function planEquipmentChange(item, toOffhand, chosenSlot) {
  const p = state.player;
  const slots = getEquipSlotForType(item.type);
  if (!slots) return { error: `${item.name} — не надевается` };
  if (item.type === 'shield' && hasTwoHandedWeapon()) return { error: 'Снимите двуручное оружие, чтобы надеть щит' };
  if (toOffhand) {
    if (isMage()) return { error: 'Парное оружие доступно воинам' };
    if (!canDualWield(item)) return { error: 'Во вторую руку подходят одноручные мечи, топоры, кинжалы и дубины' };
    if (!p.equipment.weapon) return { error: 'Сначала возьмите оружие в основную руку' };
    if (hasTwoHandedWeapon()) return { error: 'В основной руке двуручное оружие' };
  }
  if (!canWearByLevel(item)) return { error: `${item.name} можно надеть с ${getItemReqLevel(item)}-го уровня` };

  const invIndex = p.inventory.indexOf(item);
  if (invIndex < 0) return { error: 'Предмета больше нет в сумке' };
  const targetSlot = toOffhand ? 'shield'
    : (slots.includes(chosenSlot) ? chosenSlot : slots.find(slot => !p.equipment[slot]) || slots[0]);
  const removeSlots = [targetSlot];
  if (item.type === 'weapon' && item.twoHanded) removeSlots.push('shield');
  const removed = removeSlots.filter(slot => p.equipment[slot]).map(slot => ({ slot, item: p.equipment[slot] }));
  const inventorySize = p.inventory.length - (item.qty > 1 ? 0 : 1) + removed.length;
  const extra = inventorySize - Math.max(invMaxSlots(), p.inventory.length);
  const spaceError = extra > 0
    ? `Освободите ещё ${extra === 1 ? 'одну ячейку' : 'две ячейки'} в сумке.` : '';
  return { targetSlot, removed, invIndex, spaceError };
}

function showEquipmentError(message) {
  const text = escChronicle(message);
  showToast('🛡', text);
  logLoot(text, 'log-info');
}

// Применяем замену одной операцией и сохраняем итог, без промежуточного снятия вещей.
function equipItem(item, toOffhand = false, chosenSlot) {
  const p = state.player;
  const currentSlot = Object.keys(p.equipment).find(k => p.equipment[k] && p.equipment[k].id === item.id);
  if (currentSlot) { unequipSlot(currentSlot); return; }

  const plan = planEquipmentChange(item, toOffhand, chosenSlot);
  const error = plan.error || plan.spaceError;
  if (error) { showEquipmentError(error); return; }

  const oldMaxMp = p.maxMp;
  const inventory = p.inventory.slice();
  const equipment = { ...p.equipment };
  let equipped = item;
  if (item.qty > 1) {
    inventory[plan.invIndex] = { ...item, qty: item.qty - 1 };
    equipped = { ...item, qty: 1, id: 'item_' + Date.now() + '_' + Math.random() + '_eq' };
  } else {
    inventory.splice(plan.invIndex, 1);
  }
  for (const removed of plan.removed) {
    equipment[removed.slot] = null;
    inventory.push({ ...removed.item, qty: 1 });
  }
  equipment[plan.targetSlot] = equipped;

  // Пересчёт тоже идёт на копии, до замены состояния героя.
  const next = { ...p, inventory, equipment };
  calculatePlayerStats(next);
  const gainedMp = next.maxMp - oldMaxMp;
  if (gainedMp > 0) next.mp = Math.min(next.maxMp, next.mp + gainedMp);
  Object.assign(p, next);

  renderInventory();
  renderEquipSlots();
  updateCharacterPanel();
  updateTopStatus();
  updateInventoryFooter();
  plan.removed.forEach(({ item }) => logLoot(`Снято: ${escChronicle(item.name)}`, 'log-info'));
  logLoot(toOffhand ? `Во вторую руку: ${escChronicle(item.name)}` : `Надето: ${escChronicle(item.name)}`, 'log-info');
  if (toOffhand) showToast('🗡', `Вторая рука: ${escChronicle(item.name)}`);
  saveCurrentSlot();
  return true;
}

const EQUIP_COMPARE_NUMBER = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const EQUIP_COMPARE_STATS = [
  ['Физ. атака', p => p.pAtk],
  ['Маг. атака', p => p.mAtk],
  ['Физ. защита', p => p.pDef],
  ['Маг. защита', p => p.mDef],
  ['Запас здоровья', p => p.maxHp],
  ['Запас маны', p => p.maxMp],
  ['Урон второй руки', p => p.offhandPAtk],
  ['Скорость хода', p => p.atbSpeed],
  ['Точность', p => getPlayerAccuracy(p)],
  ['Уворот', p => getPlayerEvasion(null, p)],
  ['Поглощение урона', p => p.flatDamageReduce],
  ['Шанс блока', p => p.blockChance, '%'],
  ['Шанс крита', p => p.critChance, '%'],
  ['Двуручный хват', p => getTwoHandGripBonus(p), '%'],
  ['Снижение урона щитом', p => getEquippedShield(p) ? SHIELD_STANCE_DAMAGE_CUT : 0, '%'],
  ['Урон навыков от сета', p => p.skillFlatDamage],
  ['Здоровье в бою / сек.', p => p.hpRegenIn],
  ['Мана в бою / сек.', p => p.hasManaRegenPassive ? (p.mpRegenIn || 0.5) : 0],
  ['Мана-щит', p => p.manaShield, '%'],
];

let equipmentComparison = null;

function openEquipmentComparison(item, toOffhand = false) {
  const plan = planEquipmentChange(item, toOffhand);
  if (plan.error) { showEquipmentError(plan.error); return; }
  hideTooltip();
  equipmentComparison = { player: state.player, item, toOffhand, slot: plan.targetSlot };
  renderEquipmentComparison();
  const dialog = document.getElementById('equip-compare');
  if (!dialog.open) dialog.showModal();
}

function closeEquipmentComparison() {
  equipmentComparison = null;
  document.getElementById('equip-compare').close();
}

function confirmEquipmentComparison() {
  if (!equipmentComparison) return;
  const { player, item, toOffhand, slot } = equipmentComparison;
  if (player !== state.player || !player.inventory.includes(item)) {
    closeEquipmentComparison();
    showEquipmentError('Предмета больше нет в сумке');
    return;
  }
  const plan = planEquipmentChange(item, toOffhand, slot);
  if (plan.error || plan.spaceError) { renderEquipmentComparison(); return; }
  if (equipItem(item, toOffhand, slot)) closeEquipmentComparison();
}

function renderEquipmentComparison() {
  const { player, item, toOffhand, slot } = equipmentComparison;
  const body = document.getElementById('equip-compare-body');
  const confirm = document.getElementById('equip-compare-confirm');
  const plan = planEquipmentChange(item, toOffhand, slot);
  confirm.disabled = Boolean(plan.error || plan.spaceError);
  if (plan.error) {
    body.innerHTML = `<p class="equip-compare-error">${escChronicle(plan.error)}</p>`;
    return;
  }

  const equipment = { ...player.equipment };
  plan.removed.forEach(({ slot }) => { equipment[slot] = null; });
  equipment[plan.targetSlot] = item;
  const preview = { ...player, equipment };
  calculatePlayerStats(preview);

  const choices = getEquipSlotForType(item.type);
  const picker = choices.length > 1 ? `<label class="equip-compare-picker">
    Ячейка
    <select id="equip-compare-slot">
      ${choices.map((key, index) => {
        const label = item.type === 'ring' ? 'Кольцо' : 'Серьга';
        const worn = player.equipment[key];
        return `<option value="${key}"${key === slot ? ' selected' : ''}>${label} ${index + 1} · ${worn ? equipComparisonItemName(worn) : 'свободно'}</option>`;
      }).join('')}
    </select>
  </label>` : '';
  const removal = plan.removed.find(({ slot }) => slot !== plan.targetSlot);
  const note = removal
    ? `<p class="equip-compare-note">В сумку уйдёт ${removal.item.type === 'shield' ? 'щит' : 'оружие из второй руки'} <strong>«${equipComparisonItemName(removal.item)}»</strong>.</p>` : '';

  const stats = EQUIP_COMPARE_STATS.map(([label, read, unit = '']) => {
    const before = Number((read(player) || 0).toFixed(2));
    const after = Number((read(preview) || 0).toFixed(2));
    const difference = Number((after - before).toFixed(2));
    if (!difference) return '';
    const amount = EQUIP_COMPARE_NUMBER.format(Math.abs(difference));
    const change = difference > 0 ? '+' + amount : '−' + amount;
    return `<tr><th scope="row">${label}</th>
      <td>${EQUIP_COMPARE_NUMBER.format(before)}${unit}</td>
      <td>${EQUIP_COMPARE_NUMBER.format(after)}${unit}</td>
      <td class="${difference > 0 ? 'gain' : 'loss'}">${change}${unit}</td></tr>`;
  }).join('');

  body.innerHTML = `
    ${picker}
    <div class="equip-compare-items">
      ${renderEquipmentComparisonItem('Надето', player.equipment[plan.targetSlot])}
      ${renderEquipmentComparisonItem('После замены', item)}
    </div>
    ${note}
    ${stats ? `<table class="equip-compare-stats">
      <thead><tr><th scope="col">Характеристика</th><th scope="col">Было</th><th scope="col">Будет</th><th scope="col">Разница</th></tr></thead>
      <tbody>${stats}</tbody>
    </table>` : '<p class="equip-compare-note">Характеристики совпадают.</p>'}
    ${plan.spaceError ? `<p class="equip-compare-error">${plan.spaceError}</p>` : ''}
  `;
  const select = body.querySelector('#equip-compare-slot');
  if (select) select.onchange = () => {
    equipmentComparison.slot = select.value;
    renderEquipmentComparison();
    document.getElementById('equip-compare-slot').focus();
  };
}

function equipComparisonItemName(item) {
  return escChronicle(item.name) + (item.refineLevel > 0 ? ` +${item.refineLevel}` : '');
}

function renderEquipmentComparisonItem(label, item) {
  const rarity = RARITIES[item?.rarity];
  const name = item ? equipComparisonItemName(item) : 'Свободная ячейка';
  return `<div class="equip-compare-item">
    <div class="equip-compare-label">${label}</div>
    <div class="equip-compare-item-head">
      ${item ? `<span class="equip-compare-icon">${normalizeIconHtml(item.icon)}</span>` : ''}
      <div>
        <strong${rarity ? ` style="color:${rarity.color}"` : ''}>${name}</strong>
        ${item?.twoHanded ? '<small>Двуручное</small>' : ''}
      </div>
    </div>
  </div>`;
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
  openEquipmentComparison(item, item.type === 'weapon');
}

function unequipSlot(slotKey) {
  const p = state.player;
  const item = p.equipment[slotKey];
  if (!item) return;

  if (p.inventory.length >= invMaxSlots()) {
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

// При входе возвращаем недопустимую экипировку в сумку, в том числе из старых сохранений.
function repairEquippedItemsOnLoad() {
  const p = state.player;
  const off = [];
  Object.keys(p.equipment || {}).forEach(slot => {
    const it = p.equipment[slot];
    if (!it || canWearByLevel(it)) return;
    p.equipment[slot] = null;
    p.inventory.push({ ...it, qty: 1 });
    off.push(`${it.name} (с ${getItemReqLevel(it)} ур.)`);
  });
  if (off.length) setTimeout(() => {
    showToast('🔒', `Снято не по уровню: ${off.length}`);
    logLoot(`🔒 Снято — не по уровню: ${off.join(', ')}. Вещи в сумке, наденете, когда дорастёте.`, 'log-info');
  }, 1800);
  const leftHand = hasTwoHandedWeapon() && p.equipment.shield;
  if (leftHand) {
    p.equipment.shield = null;
    p.inventory.push({ ...leftHand, qty: 1 });
    const name = escChronicle(leftHand.name);
    showToast('🛡', `${name} возвращается в сумку. С двуручным оружием нужна свободная вторая рука.`);
  }
  return off.length > 0 || Boolean(leftHand);
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
          <div class="consumable-threshold" title="Порог ${getPotionThresholdResource(p.potionSlot)}">${p.potionThreshold || 40}</div>
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
