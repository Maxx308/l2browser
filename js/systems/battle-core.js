// ========================================================
//  СИСТЕМЫ: БОЙ — ЯДРО
//  Старт боя, конец боя, выбор монстра,
//  ручной удар, переключатели автобоя/повтора.
//
//  ВЫДЕЛЕНО ИЗ battle-core.js (разбивка больших файлов):
//    - поиск монстра 👣 + анимация смерти → battle-search.js
//    - ползунки HP/MP + ожидание → battle-autostop.js
//    - главный цикл gameLoop() → battle-loop.js
//
//  НОВОЕ (v0.11, групповые бои):
//  + startBattle(template, variantId, count) — принимает количество мобов.
//  + selectMonsterGroup() — бой с группой из N мобов.
//  + repeatCount — запоминаем количество мобов для повтора.
//
//  НОВОЕ (v0.16):
//  + Имя героя под аватаркой теперь берётся из state.player.name,
//    а не из HTML-заглушки.
//
//  НОВОЕ (v0.29):
//  + Размер стаи всегда случайный (rollPackSize, battle-pack.js).
//    selectMonsterGroup и выбор ×N убраны вместе с «Искать стаю».
// ========================================================

// --------------------------------------------------------
//  ПРОВЕРКА: НАХОДИТСЯ ЛИ ИГРОК НА ВКЛАДКЕ «ОХОТА»
// --------------------------------------------------------
function isOnHuntTab() {
  const activeTab = document.querySelector('.tab.active');
  if (!activeTab) return false;
  return activeTab.dataset.tab === 'hunt';
}

// --------------------------------------------------------
//  СТАРТ БОЯ
// --------------------------------------------------------

function selectMonster(template, variantId, fromMine = false) {
  if (state.travel.active) return;
  if (state.player.currentLocation === 'town') return;
  if (!state.player.classId) {
    logCombat('Сначала выберите класс у Наставника.', 'log-entry');
    return;
  }
  state.battle.waitingForResume = false;
  state.battle.waitingTemplate = null;

  document.querySelectorAll('.monster-card').forEach(c => c.classList.remove('selected'));
  const found = document.querySelector(`.monster-card[data-id="${template.id}"][data-variant="${variantId}"]`);
  if (found) found.classList.add('selected');
  startBattle(template, variantId);
}

// --------------------------------------------------------
//  START BATTLE
//  v0.29: сколько мобов — решает rollPackSize (характер монстра + бафы).
// --------------------------------------------------------
function startBattle(template, variantId) {
  // ---- Создаём стаю ----
  const count = rollPackSize(template);
  const monsters = createMonsterGroup(template, variantId, count);
  if (typeof soulsOnBattleStart === 'function') soulsOnBattleStart(monsters);   // v0.33: душа самоцвета
  const firstMonster = monsters[0];

  state.battle.active = true;
  state.battle.monsters = monsters;      // ← массив
  state.battle.monstersATB = 0;          // ← общий ATB
  state.battle.focusIdx = null;          // v0.19: цель лука
  state.battle.manualTarget = null;      // v0.20: цель, выбранная тапом
  state.battle.manualWait = null;        // v0.20: ожидание хода в ручном режиме
  state.battle.manualAction = null;
  state.battle.rotWrath = 0;             // v0.19.1: заряды Гнева для Гниения
  state.battle.lastTarget = { id: template.id, variantId };   // v0.24: продолжить охоту после обновления страницы
  packOnBattleStart(template, variantId);   // v0.29: подкрепления

  // ---- Стартовый ATB игрока (как раньше) ----
  let startATB = isMage() ? 1.0 : 0;
  const w = state.player.equipment.weapon;
  const wCat = w ? getWeaponCategory(w.name) : null;
  if (wCat === 'bows')        startATB = 0.75;
  else if (wCat === 'crossbows') startATB = 1.0;

  state.battle.playerATB = startATB;
  state.battle.atbCarry = 0;             // v0.23: перебор шкалы от Скорости молнии

  state.battle.activeEffects.healPotionUsed = false;
  state.battle.skillCooldowns = {};
  Object.keys(state.battle.skillToggles).forEach(id => {
    state.battle.skillCooldowns[id] = 0;
  });

  clearAllDebuffs();

  // ---- Показываем окно боя ----
  document.getElementById('battle-window').classList.add('active');
  document.getElementById('hunt-hint').style.display = 'none';

  // ---- Заголовок: если группа — показываем ×N ----
  const countSuffix = count > 1 ? ` ×${count}` : '';
  document.getElementById('battle-title-text').textContent = `${state.player.name} vs ${firstMonster.name}${countSuffix}`;
  document.getElementById('battle-status').textContent = 'ATB заряжается...';

  // ---- НОВОЕ (v0.16): обновляем имя героя под аватаркой ----
  const playerNameEl = document.getElementById('player-fighter-name');
  if (playerNameEl) playerNameEl.textContent = state.player.name;

  hideMonsterSearching();

  // ---- Рисуем первого моба (как раньше) ----
  const monsterSlot = document.getElementById('monster-avatar-slot');
  const monsterName = document.getElementById('monster-fighter-name');
  const monsterHpBar = document.getElementById('monster-hp-bar');

  if (monsterSlot) {
    monsterSlot.classList.remove('fade-out-monster', 'fade-in-monster');
    monsterSlot.innerHTML = `<img src="${firstMonster.art}" alt="">`;
  }
  if (monsterName) {
    monsterName.classList.remove('fade-in-monster', 'dead');
    monsterName.textContent = firstMonster.name;
  }

  if (monsterHpBar) {
    monsterHpBar.classList.remove('dead');
  }

  if (monsterSlot) {
    void monsterSlot.offsetWidth;
    monsterSlot.classList.add('fade-in-monster');
  }
  if (monsterName) {
    void monsterName.offsetWidth;
    monsterName.classList.add('fade-in-monster');
  }

  if (monsterHpBar) {
    state.battle.monsterHpAnimating = true;
    monsterHpBar.style.transition = 'none';
    monsterHpBar.style.width = '0%';
    void monsterHpBar.offsetWidth;
    requestAnimationFrame(() => {
      monsterHpBar.style.transition = 'width 0.5s ease-out';
      monsterHpBar.style.width = '100%';
      setTimeout(() => {
        state.battle.monsterHpAnimating = false;
        monsterHpBar.style.transition = '';
      }, 550);
    });
  }

  updateBattleKillsCounter(firstMonster);
  logCombat(`— ${firstMonster.name}${countSuffix} —`, 'log-entry separator');
  if (typeof soulsLogBattleStart === 'function') soulsLogBattleStart();

  activateMixtureFromSlot();

  const activeMix = state.battle.activeEffects.mixture;
  if (activeMix) {
    const mixData = MIXTURE_EFFECTS[activeMix.id];
    if (mixData && mixData.chargeType === 'battles') {
      tickMixtureCharge();
    }
  }

  updateBattleUI();
  renderConsumablesPanel();
  renderSkillSlots();
  renderEffectsPanel();

  syncAutoStopUI();

  const btnAuto = document.getElementById('btn-autobattle');
  if (btnAuto) {
    btnAuto.textContent = `⚔ Автобой: ${state.battle.autoBattle ? 'ВКЛ' : 'ВЫКЛ'}`;
    btnAuto.classList.toggle('active', state.battle.autoBattle);
  }
  const btnRepeat = document.getElementById('btn-repeat');
  if (btnRepeat) {
    btnRepeat.textContent = `🔁 Повторять бой: ${state.battle.repeatBattle ? 'ВКЛ' : 'ВЫКЛ'}`;
    btnRepeat.classList.toggle('active', state.battle.repeatBattle);
  }
}

// --------------------------------------------------------
//  КОНЕЦ БОЯ
// --------------------------------------------------------

function closeBattle() {
  const p = state.player;

  // ---- НОВОЕ: при закрытии боя — выключаем автобой-повтор ----
  if (state.battle.repeatBattle) {
    state.battle.repeatBattle = false;
    const btnRepeat = document.getElementById('btn-repeat');
    if (btnRepeat) {
      btnRepeat.textContent = '🔁 Повторять бой: ВЫКЛ';
      btnRepeat.classList.remove('active');
    }
  }

  state.battle.active = false;
  state.battle.monsters = [];
  state.battle.monstersATB = 0;
  state.battle.packIncoming = 0;

  clearAllDebuffs();

  hideMonsterSearching();

  document.getElementById('battle-window').classList.remove('active');
  document.getElementById('hunt-hint').style.display = 'block';
  document.querySelectorAll('.monster-card').forEach(c => c.classList.remove('selected'));
  renderMonsters();

  // Закрыли бой вручную — охота закончена, ожидание восстановления не нужно.
  // (v0.19.1: убрана ветка «ждать восстановления» — она не могла сработать,
  //  потому что повтор боя выключается в начале функции.)
  state.battle.waitingForResume = false;
  state.battle.waitingTemplate = null;
  updateAutoWaitIndicator();

  saveCurrentSlot();
}

// --------------------------------------------------------
//  РУЧНОЙ УДАР / АВТОБОЙ / ПОВТОР
// --------------------------------------------------------

// manualStrike() и весь ручной режим — в battle-manual.js (v0.20)

function toggleAuto() {
  state.battle.autoBattle = !state.battle.autoBattle;
  // v0.20: включили автобой посреди ожидания — ход сделает автобой, ручная цель сбрасывается
  if (state.battle.autoBattle) { state.battle.manualWait = null; state.battle.manualTarget = null; }
  if (typeof renderManualPanel === 'function') renderManualPanel(true);
  const btn = document.getElementById('btn-autobattle');
  btn.textContent = `⚔ Автобой: ${state.battle.autoBattle ? 'ВКЛ' : 'ВЫКЛ'}`;
  btn.classList.toggle('active', state.battle.autoBattle);
  updateBattleUI();
}

function toggleRepeat() {
  state.battle.repeatBattle = !state.battle.repeatBattle;
  const btn = document.getElementById('btn-repeat');
  btn.textContent = `🔁 Повторять бой: ${state.battle.repeatBattle ? 'ВКЛ' : 'ВЫКЛ'}`;
  btn.classList.toggle('active', state.battle.repeatBattle);
}