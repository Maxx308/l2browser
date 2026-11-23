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

// Тратит 1 заряд активной микстуры (n — сколько зарядов: v0.31 — Двойной удар и удар
// двумя оружиями тратят 2, по заряду на каждый замах).
// Повторяет выбранную микстуру, пока она есть в инвентаре.
// Если игрок выбрал новую, она начнёт действовать в следующем бою.
function tickMixtureCharge(n = 1) {
  if (n > 1) { for (let i = 0; i < n; i++) tickMixtureCharge(1); return; }
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
  const p = state.player;
  const invItem = p.mixtureSlot === oldId ? p.inventory.find(i => i.shopId === oldId) : null;
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

  if (p.mixtureSlot === oldId) p.mixtureSlot = null;
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

// Номер замаха внутри действия, начиная с нуля. Заряды списываются в конце действия.
function getMixtureAtkMult(swing = 0) {
  const data = getActiveMixtureData();
  if (!data || !data.atkPercent) return 1.0;
  if (swing >= getActiveMixture().chargesLeft) {
    const p = state.player;
    const refill = p.mixtureSlot === data.id && p.inventory.some(i => i.shopId === data.id && i.qty > 0);
    if (!refill) return 1.0;
  }
  return 1 + data.atkPercent / 100;
}

// +30% к шансу дропа (складывается с титулом).
function getMixtureLuckMult() {
  const data = getActiveMixtureData();
  if (!data || !data.luckPercent) return 1.0;
  return 1 + data.luckPercent / 100;
}

// Снижение входящего урона соответствующего типа.
function getMixtureDefMult(isMagic) {
  const data = getActiveMixtureData();
  const percent = isMagic ? data?.magicDefPercent : data?.defPercent;
  return 1 - (percent || 0) / 100;
}
