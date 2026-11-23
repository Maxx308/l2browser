// ========================================================
//  СИСТЕМЫ: БОЙ — UI
//  Обновление интерфейса боя: полоски HP/MP/ATB,
//  панель расходников, зелье, дебафф-бары.
//
//  + updateBattleUI не трогает HP-полосу монстра,
//    если идёт анимация её наполнения (флаг monsterHpAnimating).
//  + renderDebuffBar вызывается вместе с updateBattleUI.
//
//  ПОДШАГ 0.3 (уборка):
//  + Удалены функции-пустышки updateMonsterBurnOverlay /
//    updateMonsterFreezeOverlay / updatePlayerPoisonOverlay.
//    Их работу делает renderDebuffBar.
//
//  НОВОЕ (v0.11, групповые бои):
//  + updateBattleUI показывает ×N поверх HP-полоски и тёмный
//    фон .grouped, если живых мобов больше 1.
//  + ATB-полоса читается из state.battle.monstersATB.
// ========================================================

function updateBattleUI() {
  const p = state.player;
  const m = state.battle.monster;
  if (!m) return;

  // v0.36.2: вызывается каждый тик боя — пишем на страницу только изменившееся (setText / setBarWidth).
  setBarWidth(document.getElementById('player-hp-bar'), p.hp / p.maxHp * 100);
  setText(document.getElementById('player-hp-text'), `${Math.floor(p.hp)} / ${p.maxHp}`);

  setBarWidth(document.getElementById('player-mp-bar'), p.mp / p.maxMp * 100);
  setText(document.getElementById('player-mp-text'), `${Math.floor(p.mp)} / ${p.maxMp}`);

  // ---- HP-полоса монстра ----
  const hpBar = document.getElementById('monster-hp-bar');
  const hpText = document.getElementById('monster-hp-text');
  const groupCounter = document.getElementById('monster-group-counter');
  const alive = (typeof getAliveMonstersCount === 'function') ? getAliveMonstersCount() : 1;

  if (!state.battle.monsterHpAnimating) {
    setBarWidth(hpBar, m.hp / m.maxHp * 100);
  }
  setText(hpText, `${Math.floor(m.hp)} / ${m.maxHp}`);

  // ---- Групповой маркер (v0.11) ----
  if (alive > 1) {
    hpBar.classList.add('grouped');
    if (groupCounter) {
      setText(groupCounter, '×' + alive);
      if (groupCounter.style.display !== 'block') groupCounter.style.display = 'block';
    }
  } else {
    hpBar.classList.remove('grouped');
    if (groupCounter) {
      setText(groupCounter, '');
      if (groupCounter.style.display !== 'none') groupCounter.style.display = 'none';
    }
  }

  setBarWidth(document.getElementById('player-atb-bar'), state.battle.playerATB * 100);
  setBarWidth(document.getElementById('monster-atb-bar'), state.battle.monstersATB * 100);

  // ---- v0.20: панель ручного режима (заменила кнопку «Ударить») ----
  if (typeof renderManualPanel === 'function') renderManualPanel(false);

  // ---- Обновляем дебафф-бары (монстр + игрок) ----
  if (typeof renderDebuffBar === 'function') {
    renderDebuffBar('monster');
    renderDebuffBar('player');
  }
}

// --------------------------------------------------------
//  ПАНЕЛЬ РАСХОДНИКОВ
// --------------------------------------------------------
function renderConsumablesPanel() {
  const panel = document.getElementById('consumables-panel');
  if (!panel) return;
  panel.innerHTML = '';
  const p = state.player;

  const stock = p.inventory
    .filter(i => i.shopId === (p.potionSlot || 'healPotion'))
    .reduce((s, i) => s + i.qty, 0);
  const enabled = state.battle.consumables.healPotion.enabled;
  const hasItems = stock > 0;
  const inSlot = !!p.potionSlot;

  const el = document.createElement('div');
  let cls = 'consumable-toggle';
  if (enabled && hasItems && inSlot) cls += ' on';
  if (!hasItems) cls += ' no-items';
  if (!inSlot) cls += ' not-in-slot';
  el.className = cls;

  let stateText = '';
  if (!inSlot) stateText = '— (нет в слоте)';
  else if (!hasItems) stateText = '—';
  else stateText = enabled ? 'ВКЛ' : 'ВЫКЛ';

  const label = inSlot ? `Зелье ${getPotionThresholdResource(p.potionSlot)}` : 'Зелье';
  el.innerHTML = `<span class="ct-icon">🧪</span>${label}: ${stateText}<span class="ct-count">×${stock}</span>`;

  if (hasItems && inSlot) {
    el.onclick = () => toggleConsumable('healPotion');
  }

  panel.appendChild(el);
}

function toggleConsumable(key) {
  const c = state.battle.consumables[key];
  c.enabled = !c.enabled;
  renderConsumablesPanel();
  renderEffectsPanel();
}

// --------------------------------------------------------
//  ЗЕЛЬЕ
// --------------------------------------------------------
// force = true — игрок пьёт сам (ручной режим) независимо от порога и переключателя.
function checkHealPotion(force) {
  const p = state.player;
  const eff = state.battle.activeEffects;

  if (eff.healPotionUsed) return;
  if (!force && !state.battle.consumables.healPotion.enabled) return;
  if (!p.potionSlot) return;

  const potion = p.inventory.find(i => i.shopId === p.potionSlot);
  if (!potion) return;

  const def = POTION_EFFECTS[potion.shopId] || POTION_EFFECTS.healPotion;
  const resource = getPotionThresholdResource(potion.shopId);
  const restoresMana = resource === 'MP';
  const current = restoresMana ? p.mp : p.hp;
  const max = restoresMana ? p.maxMp : p.maxHp;
  const threshold = (p.potionThreshold || 40) / 100;
  if (!force && current / max >= threshold) return;

  potion.qty--;
  if (potion.qty <= 0) {
    const idx = p.inventory.indexOf(potion);
    if (idx >= 0) p.inventory.splice(idx, 1);
  }

  const amount = restoresMana ? Math.floor(max * def.mpPercent / 100) : def.heal;
  const restored = Math.min(amount, Math.max(0, max - current));
  if (restoresMana) {
    p.mp = current + restored;
  } else {
    p.hp = Math.min(max, current + amount);
    if (typeof subclassOnHeroHeal === 'function') subclassOnHeroHeal(restored, amount - restored);
  }
  eff.healPotionUsed = true;

  const shownAmount = restoresMana ? Math.round(restored * 10) / 10 : amount;
  spawnFloatDamage('fighter-player', shownAmount, restoresMana ? 'mana' : 'heal');
  logCombat(`🧪 ${potion.name}: +${shownAmount} ${resource}${def.hotTurns ? ` и ещё +${def.hotPerTurn} HP на ${def.hotTurns} ходов` : ''}`, 'log-entry potion');
  if (def.hotTurns) {
    addDebuff('player', 'potionRegen', { turnsLeft: def.hotTurns, perTurn: def.hotPerTurn, potionName: potion.name });
  }

  updateTopStatus();
  updateBattleUI();
  renderInventory();
  renderEquipSlots();

  showToast('🧪', `Восстановлено ${shownAmount} ${resource}`);
}
