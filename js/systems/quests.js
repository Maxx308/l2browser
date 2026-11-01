// ========================================================
//  СИСТЕМЫ: КВЕСТЫ
//  Старт, прогресс, сдача, сброс.
//
//  Прогресс хранится в state.player.quests:
//    { firstSteps: { stage: 'need_potion' } }
//
//  Проверки по инвентарю:
//    hasQuestItem('healPotion')  → куплено ли зелье.
//    hasQuestItem('atkMixture')  → куплена ли микстура.
// ========================================================

// Проверка: есть ли в инвентаре предмет с shopId.
function hasQuestItem(shopId) {
  const p = state.player;
  if (!p || !p.inventory) return false;
  return p.inventory.some(i => i.shopId === shopId && i.qty > 0);
}

// --------------------------------------------------------
//  ПОЛУЧИТЬ ПРОГРЕСС КВЕСТА
// --------------------------------------------------------
function getQuestProgress(questId) {
  return state.player.quests[questId] || null;
}

// --------------------------------------------------------
//  НАЧАТЬ КВЕСТ
// --------------------------------------------------------
function startQuest(questId) {
  const q = QUESTS[questId];
  if (!q) return;

  state.player.quests[questId] = { stage: q.stages[0] };
  saveCurrentSlot();
}

// --------------------------------------------------------
//  ОБНОВИТЬ ПРОГРЕСС ПО ИНВЕНТАРЮ
//  Вызывается при разговоре со Старшиной и после покупок.
// --------------------------------------------------------
function updateQuestProgress(questId) {
  const q = QUESTS[questId];
  if (!q) return;

  const progress = state.player.quests[questId];
  if (!progress) return;

  if (questId === 'firstSteps') {
    if (progress.stage === 'need_potion' && hasQuestItem('healPotion')) {
      progress.stage = 'need_mixture';
    }
    if (progress.stage === 'need_mixture' && hasQuestItem('atkMixture')) {
      progress.stage = 'need_weapon';
    }
  }

  saveCurrentSlot();
}

// --------------------------------------------------------
//  ЗАВЕРШИТЬ КВЕСТ
// --------------------------------------------------------
function completeQuest(questId) {
  if (!state.player.quests[questId]) return;
  state.player.quests[questId].stage = 'done';
  saveCurrentSlot();
}

// --------------------------------------------------------
//  КВЕСТ ДОСТУПЕН?
// --------------------------------------------------------
function isQuestAvailable(questId) {
  const q = QUESTS[questId];
  if (!q) return false;

  const progress = state.player.quests[questId];
  if (progress) return true;

  const maxLevel = q.maxLevel || 999;
  return state.player.level <= maxLevel;
}

// --------------------------------------------------------
//  КВЕСТ ВЗЯТ?
// --------------------------------------------------------
function isQuestStarted(questId) {
  return !!state.player.quests[questId];
}