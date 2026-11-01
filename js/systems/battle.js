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

  document.getElementById('player-hp-bar').style.width = Math.max(0, p.hp / p.maxHp * 100) + '%';
  document.getElementById('player-hp-text').textContent = `${Math.floor(p.hp)} / ${p.maxHp}`;

  document.getElementById('player-mp-bar').style.width = Math.max(0, p.mp / p.maxMp * 100) + '%';
  document.getElementById('player-mp-text').textContent = `${Math.floor(p.mp)} / ${p.maxMp}`;

  // ---- HP-полоса монстра ----
  const hpBar = document.getElementById('monster-hp-bar');
  const hpText = document.getElementById('monster-hp-text');
  const groupCounter = document.getElementById('monster-group-counter');
  const alive = (typeof getAliveMonstersCount === 'function') ? getAliveMonstersCount() : 1;

  if (!state.battle.monsterHpAnimating) {
    hpBar.style.width = Math.max(0, m.hp / m.maxHp * 100) + '%';
  }
  hpText.textContent = `${Math.floor(m.hp)} / ${m.maxHp}`;

  // ---- Групповой маркер (v0.11) ----
  if (alive > 1) {
    hpBar.classList.add('grouped');
    if (groupCounter) {
      groupCounter.textContent = '×' + alive;
      groupCounter.style.display = 'block';
    }
  } else {
    hpBar.classList.remove('grouped');
    if (groupCounter) {
      groupCounter.textContent = '';
      groupCounter.style.display = 'none';
    }
  }

  document.getElementById('player-atb-bar').style.width = Math.min(100, state.battle.playerATB * 100) + '%';
  document.getElementById('monster-atb-bar').style.width = Math.min(100, state.battle.monstersATB * 100) + '%';

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

  el.innerHTML = `<span class="ct-icon">🧪</span>Зелье: ${stateText}<span class="ct-count">×${stock}</span>`;

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
// force = true — игрок пьёт сам (ручной режим): без порога HP и переключателя
function checkHealPotion(force) {
  const p = state.player;
  const eff = state.battle.activeEffects;

  if (eff.healPotionUsed) return;
  if (!force && !state.battle.consumables.healPotion.enabled) return;
  if (!p.potionSlot) return;

  const potion = p.inventory.find(i => i.shopId === p.potionSlot);
  if (!potion) return;

  const threshold = (p.potionThreshold || 40) / 100;
  if (!force && p.hp / p.maxHp >= threshold) return;

  potion.qty--;
  if (potion.qty <= 0) {
    const idx = p.inventory.indexOf(potion);
    if (idx >= 0) p.inventory.splice(idx, 1);
  }

  // v0.20: у зелий своё лечение (POTION_HEAL), у большого — ещё и лечение по ходам
  const def = POTION_HEAL[potion.shopId] || POTION_HEAL.healPotion;
  const heal = def.heal;
  p.hp = Math.min(p.maxHp, p.hp + heal);
  eff.healPotionUsed = true;

  spawnFloatDamage('fighter-player', heal, 'heal');
  logCombat(`🧪 ${potion.name}: +${heal} HP${def.hotTurns ? ` и ещё +${def.hotPerTurn} HP на ${def.hotTurns} ходов` : ''}`, 'log-entry potion');
  if (def.hotTurns) addDebuff('player', 'potionRegen', { turnsLeft: def.hotTurns, perTurn: def.hotPerTurn });

  updateTopStatus();
  updateBattleUI();
  renderInventory();
  renderEquipSlots();

  showToast('🧪', `Восстановлено ${heal} HP`);
}