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
  questJournalChanged();
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
  questJournalChanged();
}

// --------------------------------------------------------
//  ЗАВЕРШИТЬ КВЕСТ
// --------------------------------------------------------
function completeQuest(questId) {
  if (!state.player.quests[questId]) return;
  state.player.quests[questId].stage = 'done';
  saveCurrentSlot();
  questJournalChanged();
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

// ========================================================
//  ЖУРНАЛ ПОРУЧЕНИЙ (v0.30)
//  Раздел «Поручения» во вкладке «Хроники»: текущие (с шагами и наградой),
//  «можно взять» (уже встречал того, кто даёт), выполненные.
//  chronicle.questsSeen { questId: stage } — что игрок уже видел;
//  сдвинулся шаг — красная точка на «Хрониках» и на разделе.
// ========================================================

// Поручение изменилось — обновить точку и журнал, если открыт.
function questJournalChanged() {
  if (typeof updateChronicleDot === 'function') updateChronicleDot();
  if (typeof isChronicleOpen === 'function' && isChronicleOpen()) renderChronicle();
}

// Можно взять: не взято, ещё доступно, с дающим уже знакомы.
function isQuestOffered(questId) {
  return !isQuestStarted(questId) && isQuestAvailable(questId)
    && typeof knowsChronicleFact === 'function' && knowsChronicleFact('start_place');
}

function questNews() {
  const c = state.player.chronicle;
  const seen = (c && c.questsSeen) || {};
  return Object.keys(QUESTS).some(id => {
    const pr = getQuestProgress(id);
    if (pr) return seen[id] !== pr.stage;
    return isQuestOffered(id) && seen[id] !== 'offered';
  });
}
function markQuestsSeen() {
  const c = state.player.chronicle;
  if (!c) return;
  if (!c.questsSeen) c.questsSeen = {};
  Object.keys(QUESTS).forEach(id => {
    const pr = getQuestProgress(id);
    if (pr) c.questsSeen[id] = pr.stage;
    else if (isQuestOffered(id)) c.questsSeen[id] = 'offered';
  });
}

function renderQuestJournal(box) {
  const esc = escChronicle;
  const active = [], offered = [], done = [];
  Object.values(QUESTS).forEach(q => {
    const pr = getQuestProgress(q.id);
    if (pr && pr.stage === 'done') done.push(q);
    else if (pr) active.push(q);
    else if (isQuestOffered(q.id)) offered.push(q);
  });

  if (!active.length && !offered.length && !done.length) {
    box.innerHTML = `<div class="chron-soon">Поручений пока нет. Поговори с жителями — кому-нибудь да понадобится помощь.</div>`;
    markQuestsSeen();
    return;
  }

  const head = q => `<div class="quest-head"><span class="quest-name">${esc(q.name)}</span><span class="quest-giver">${esc(q.giver)} · ${esc(q.place)}</span></div>`;
  let html = '';

  if (active.length) {
    html += `<div class="quest-group">Текущие</div>`;
    active.forEach(q => {
      const cur = q.stages.indexOf(getQuestProgress(q.id).stage);
      html += `<div class="quest-card">${head(q)}<div class="quest-text">${esc(q.journal)}</div><div class="quest-steps">`;
      q.steps.forEach(s => {
        const i = q.stages.indexOf(s.stage);
        const cls = i < cur ? 'done' : i === cur ? 'now' : 'later';
        const mark = i < cur ? '✓' : i === cur ? '▸' : '·';
        html += `<div class="quest-step ${cls}"><span class="quest-mark">${mark}</span>${esc(s.text)}</div>`;
      });
      html += `</div><div class="quest-reward"><span>Награда</span>${esc(q.reward)}</div></div>`;
    });
  }

  if (offered.length) {
    html += `<div class="quest-group">Можно взять</div>`;
    offered.forEach(q => { html += `<div class="quest-card offered">${head(q)}<div class="quest-text">${esc(q.offer)}</div></div>`; });
  }

  if (done.length) {
    html += `<div class="quest-group">Выполненные</div>`;
    done.forEach(q => { html += `<div class="quest-card done">${head(q)}<div class="quest-text">✓ ${esc(q.steps.map(s => s.text).join(' · '))}</div></div>`; });
  }

  box.innerHTML = html;
  markQuestsSeen();
}