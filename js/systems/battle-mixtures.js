// ========================================================
//  СИСТЕМЫ: БОЙ — МИКСТУРЫ
//  Всё про микстуры:
//   - активная микстура и её данные
//   - трата зарядов
//   - автоподстановка из инвентаря
//   - множители (атака, удача, крепость)
//
//  Вынесено из battle.js (разбивка).
// ========================================================

// --------------------------------------------------------
//  АКТИВНАЯ МИКСТУРА
// --------------------------------------------------------

function getActiveMixture() {
  return state.battle.activeEffects.mixture;
}

function getActiveMixtureData() {
  const m = getActiveMixture();
  if (!m) return null;
  return MIXTURE_EFFECTS[m.id] || null;
}

// Тратит 1 заряд активной микстуры.
// Если заряды кончились — пытается подставить такую же из инвентаря.
// Если в инвентаре нет — очищает слот микстуры.
function tickMixtureCharge() {
  const m = getActiveMixture();
  if (!m) return;

  m.chargesLeft -= 1;

  renderEquipSlots();
  renderEffectsPanel();

  if (m.chargesLeft > 0) return;

  // Заряды кончились.
  const data = MIXTURE_EFFECTS[m.id];
  const name = data ? data.name : m.id;
  const oldId = m.id;

  state.battle.activeEffects.mixture = null;

  // Проверяем, есть ли ещё такая же микстура в инвентаре.
  const invItem = state.player.inventory.find(i => i.shopId === oldId);
  if (invItem) {
    // Активируем следующую.
    invItem.qty--;
    if (invItem.qty <= 0) {
      const idx = state.player.inventory.indexOf(invItem);
      if (idx >= 0) state.player.inventory.splice(idx, 1);
    }

    state.battle.activeEffects.mixture = {
      id: oldId,
      chargesLeft: data.charges,
    };

    logCombat(`⚗ ${name} активна (${data.charges}).`, 'log-entry potion');
    renderInventory();
    renderEquipSlots();
    renderEffectsPanel();
    return;
  }

  // В инвентаре больше нет — сбрасываем слот.
  state.player.mixtureSlot = null;
  showToast('⚗', `${name} закончилась`);
  logCombat(`⚗ ${name} закончилась.`, 'log-entry potion');
  renderEquipSlots();
  renderEffectsPanel();
}

// Активирует микстуру из слота при старте боя.
function activateMixtureFromSlot() {
  const p = state.player;
  if (state.battle.activeEffects.mixture) return;
  if (!p.mixtureSlot) return;

  const data = MIXTURE_EFFECTS[p.mixtureSlot];
  if (!data) return;

  const invItem = p.inventory.find(i => i.shopId === p.mixtureSlot);
  if (!invItem) return;

  invItem.qty--;
  if (invItem.qty <= 0) {
    const idx = p.inventory.indexOf(invItem);
    if (idx >= 0) p.inventory.splice(idx, 1);
  }

  state.battle.activeEffects.mixture = {
    id: data.id,
    chargesLeft: data.charges,
  };

  logCombat(`⚗ ${data.name} активна (${data.charges}).`, 'log-entry potion');
  renderInventory();
  renderEquipSlots();
  renderEffectsPanel();
}

// --------------------------------------------------------
//  МНОЖИТЕЛИ ОТ АКТИВНОЙ МИКСТУРЫ
// --------------------------------------------------------

// +30% / +50% к урону игрока.
function getMixtureAtkMult() {
  const data = getActiveMixtureData();
  if (!data || !data.atkPercent) return 1.0;
  return 1 + data.atkPercent / 100;
}

// +30% к шансу дропа (складывается с титулом).
function getMixtureLuckMult() {
  const data = getActiveMixtureData();
  if (!data || !data.luckPercent) return 1.0;
  return 1 + data.luckPercent / 100;
}

// −30% к физическому урону по игроку.
function getMixtureDefMult() {
  const data = getActiveMixtureData();
  if (!data || !data.defPercent) return 1.0;
  return 1 - data.defPercent / 100;
}