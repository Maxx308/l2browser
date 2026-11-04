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
function isQuestDone(questId) {
  const pr = state.player.quests && state.player.quests[questId];
  return !!(pr && pr.stage === 'done');
}
// v0.32: стадия поручения (или null, если не взято).
function questStage(questId) {
  const pr = state.player.quests && state.player.quests[questId];
  return pr ? pr.stage : null;
}
function setQuestStage(questId, stage) {
  const pr = getQuestProgress(questId);
  if (!pr) return;
  pr.stage = stage;
  saveCurrentSlot();
  questJournalChanged();
  if (typeof updateTalkButtons === 'function') updateTalkButtons();
}

// ========================================================
//  v0.32: ПОРУЧЕНИЯ ЖИТЕЛЕЙ — «принеси» (needs). Считаем по сумке и складу (countMaterial, forge.js).
// ========================================================
function questNeedMet(questId, i) {
  const n = QUESTS[questId].needs[i];
  return countMaterial(n.name) >= n.qty;
}
function questNeedText(questId, i) {
  const n = QUESTS[questId].needs[i];
  return `${n.name}: ${Math.min(n.qty, countMaterial(n.name))} из ${n.qty} — ${n.where}`;
}
// Можно сдавать: поручение на стадии сбора (needsStage, по умолчанию первая) и всё собрано.
function questNeedsReady(questId) {
  const q = QUESTS[questId];
  return questStage(questId) === (q.needsStage || q.stages[0]) && q.needs.every((n, i) => questNeedMet(questId, i));
}
function takeQuestNeeds(questId) {
  QUESTS[questId].needs.forEach(n => takeMaterial(n.name, n.qty));
  if (typeof renderInventory === 'function') renderInventory();
}

// v0.32: «НАЙДИ» — находка в бою (find в QUESTS): пока поручение на стадии find.stage,
// убитый монстр из find.monsters (или из локации find.loc) с шансом find.chance% даёт находку.
// Предмета в сумке нет — находка живёт в стадии поручения (её не продать и не потерять).
function questFindRoll(m) {
  Object.values(QUESTS).forEach(q => {
    const f = q.find;
    if (!f || questStage(q.id) !== f.stage) return;
    const fits = f.monsters ? f.monsters.includes(m.id) : (typeof getMonsterLocation === 'function' && getMonsterLocation(m.id) === f.loc);
    if (!fits || Math.random() * 100 >= f.chance) return;
    logLoot(heroText(f.log), 'log-loot');
    if (typeof showToast === 'function') showToast(f.icon, f.toast);
    setQuestStage(q.id, f.next);
  });
}

// Поручение жителя выполнено: отношения (q.rapport { npc: очки } или свои — по выбору), запись в летописи, лог.
function finishOwnerQuest(questId, annalsKey, rapport) {
  const q = QUESTS[questId];
  const r = rapport || q.rapport || {};
  completeQuest(questId);
  Object.keys(r).forEach(npc => addRapport(npc, r[npc]));
  if (typeof annalsFirst === 'function') annalsFirst(annalsKey || 'quest.' + questId);
  logCombat(`✔ Поручение выполнено: «${q.name}».`, 'log-entry levelup');
  if (typeof updateTalkButtons === 'function') updateTalkButtons();
  saveCurrentSlot();
}

// «Принеси» — сдача в разговоре: забрать собранное и закрыть поручение.
function finishNeedsQuest(questId) {
  if (!questNeedsReady(questId)) return;
  takeQuestNeeds(questId);
  finishOwnerQuest(questId);
}

// «Ящик без надписи»: заглянул — меньше доверия и Оболов, зато знаешь, что внутри.
function finishTraderBox(peeked) {
  if (questStage('traderBox') !== 'return') return;
  const p = state.player;
  p.gold += peeked ? 100 : 150;
  getQuestProgress('traderBox').peeked = !!peeked;
  finishOwnerQuest('traderBox', peeked ? 'quest.traderBox.peek' : 'quest.traderBox.give', { trader: peeked ? 6 : 10 });
  if (typeof updateTopStatus === 'function') updateTopStatus();
  if (typeof updateTraderGold === 'function') updateTraderGold();
}
function questPeeked(questId) {
  const pr = getQuestProgress(questId);
  return !!(pr && pr.peeked);
}

// «Угасающий камень»: Урдах → Лиэль (посмотрит) → сапфиры Лиэль → камень обратно Урдаху.
function mentorStoneShown() {
  if (questStage('mentorStone') === 'to_liel') setQuestStage('mentorStone', 'need_items');
}
function mentorStoneCharged() {
  if (!questNeedsReady('mentorStone')) return;
  takeQuestNeeds('mentorStone');
  addRapport('guildmage', 3);
  setQuestStage('mentorStone', 'to_urdah');
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
// v0.32: у поручений жителей — своё условие offered (житель уже попросил).
function isQuestOffered(questId) {
  const q = QUESTS[questId];
  if (q.offered) return !isQuestStarted(questId) && q.offered();
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
        const fin = i < cur || (s.done ? s.done() : false);   // v0.32: шаг «принеси» готов, когда собрано
        const cls = fin ? 'done' : i === cur ? 'now' : 'later';
        const mark = fin ? '✓' : i === cur ? '▸' : '·';
        const text = typeof s.text === 'function' ? s.text() : s.text;
        html += `<div class="quest-step ${cls}"><span class="quest-mark">${mark}</span>${esc(text)}</div>`;
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
    // v0.32: у поручений жителей шаги со счётчиками — для выполненного пишем то, что было в журнале
    done.forEach(q => { html += `<div class="quest-card done">${head(q)}<div class="quest-text">✓ ${esc(q.needs ? q.journal : q.steps.map(s => s.text).join(' · '))}</div></div>`; });
  }

  box.innerHTML = html;
  markQuestsSeen();
}