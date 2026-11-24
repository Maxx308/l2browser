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
// v0.37: find.count — находок нужно несколько (счётчик pr.found); log и toast могут быть функциями от номера,
//   lastLog / lastToast — для последней находки.
function questFindRoll(m) {
  Object.values(QUESTS).forEach(q => {
    const f = q.find;
    if (!f || questStage(q.id) !== f.stage) return;
    const fits = f.monsters ? f.monsters.includes(m.id) : (typeof getMonsterLocation === 'function' && getMonsterLocation(m.id) === f.loc);
    if (!fits || Math.random() * 100 >= f.chance) return;
    if (f.count) {
      const pr = getQuestProgress(q.id);
      pr.found = (pr.found || 0) + 1;
      const last = pr.found >= f.count;
      const val = v => (typeof v === 'function' ? v(pr.found) : v);
      logLoot(heroText(val(f.log)), 'log-loot');
      if (last && f.lastLog) logLoot(heroText(f.lastLog), 'log-loot');
      if (typeof showToast === 'function') showToast(f.icon, (last && f.lastToast) ? f.lastToast : val(f.toast));
      if (last) setQuestStage(q.id, f.next);
      else { saveCurrentSlot(); questJournalChanged(); }
      return;
    }
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

// v0.37: незакрытые поручения места — взятые и те, что житель уже предлагал (для предупреждения перед Собранием).
function questsOpenAt(place) {
  const active = [], offered = [];
  Object.values(QUESTS).forEach(q => {
    if (q.place !== place || isQuestDone(q.id)) return;
    if (isQuestStarted(q.id)) active.push(q);
    else if (q.offered && q.offered()) offered.push(q);
  });
  return { active, offered };
}
// v0.37: после падения Андервуда его поручения уже не сделать — в журнале они «не успели».
function questLost(q) {
  return !!(state.player && state.player.underwoodFallen) && !!q && q.place === 'Андервуд' && !isQuestDone(q.id);
}

// Можно взять: не взято, ещё доступно, с дающим уже знакомы.
// v0.32: у поручений жителей — своё условие offered (житель уже попросил).
function isQuestOffered(questId) {
  const q = QUESTS[questId];
  if (questLost(q)) return false;   // v0.37
  if (q.offered) return !isQuestStarted(questId) && q.offered();
  return !isQuestStarted(questId) && isQuestAvailable(questId)
    && typeof knowsChronicleFact === 'function' && knowsChronicleFact('start_place');
}

function questNews() {
  const c = state.player.chronicle;
  const seen = (c && c.questsSeen) || {};
  return Object.keys(QUESTS).some(id => {
    if (questLost(QUESTS[id])) return false;   // v0.37: не успели — новостью не считаем
    const pr = getQuestProgress(id);
    if (pr) return seen[id] !== pr.stage;
    return isQuestOffered(id) && seen[id] !== 'offered';
  });
}
function markQuestsSeen() {
  const c = state.player.chronicle;
  if (!c) return;
  if (!c.questsSeen) c.questsSeen = {};
  let changed = false;
  Object.keys(QUESTS).forEach(id => {
    const pr = getQuestProgress(id);
    const v = pr ? pr.stage : (isQuestOffered(id) ? 'offered' : null);
    if (v !== null && c.questsSeen[id] !== v) { c.questsSeen[id] = v; changed = true; }
  });
  // v0.36.4: прочитанное — сразу в сейв (иначе после перезахода точка загоралась снова)
  if (changed && typeof saveCurrentSlotSoon === 'function') saveCurrentSlotSoon();
}

function renderQuestJournal(box) {
  const esc = escChronicle;
  const active = [], offered = [], done = [], lost = [];
  Object.values(QUESTS).forEach(q => {
    const pr = getQuestProgress(q.id);
    if (pr && pr.stage === 'done') done.push(q);
    else if (pr && questLost(q)) lost.push(q);   // v0.37: взято в Андервуде и не сдано до падения
    else if (pr) active.push(q);
    else if (isQuestOffered(q.id)) offered.push(q);
  });

  if (!active.length && !offered.length && !done.length && !lost.length) {
    box.innerHTML = `<div class="chron-soon">Поручений пока нет. Поговори с жителями — кому-нибудь да понадобится помощь.</div>`;
    markQuestsSeen();
    return;
  }

  const head = q => `<header class="quest-head"><div class="quest-giver">${esc(q.giver)} · ${esc(q.place)}</div><h3 class="quest-name">${esc(q.name)}</h3></header>`;
  const oldGroups = new Map(Array.from(box.querySelectorAll('.quest-group-fold'), group => [group.dataset.group, group.open]));
  const openStories = new Set(Array.from(box.querySelectorAll('.quest-story[open]'), story => story.dataset.quest));
  const group = (id, title, cards, open = false) => `<details class="quest-group-fold" data-group="${id}"${(oldGroups.get(id) ?? open) ? ' open' : ''}>
    <summary>${title}</summary>${cards.join('')}
  </details>`;
  let html = '';

  if (active.length) {
    html += '<h2 class="chron-section-title">В работе</h2>';
    active.forEach(q => {
      const stage = getQuestProgress(q.id).stage;
      const cur = q.stages.indexOf(stage);
      const steps = q.steps.map(step => ({
        step,
        done: q.stages.indexOf(step.stage) < cur || Boolean(step.done?.()),
      }));
      const gathering = q.needs && steps.some(({ step, done }) => step.stage === stage && step.done && !done);
      const current = [];
      const other = [];
      steps.forEach(({ step, done }) => {
        const text = esc(heroText(typeof step.text === 'function' ? step.text() : step.text));
        if (step.stage === stage && !done && (!gathering || step.done)) current.push(text);
        else other.push(`<li class="quest-step ${done ? 'done' : 'later'}"><span class="quest-mark" aria-label="${done ? 'Выполнено' : 'Предстоит'}">${done ? '✓' : '○'}</span>${text}</li>`);
      });
      const portrait = q.bag ? bagLookImg()
        : Object.values(LORE_ARTICLES).find(a => a.cat === 'people' && a.title === q.giver && a.kind === q.place)?.portrait;
      html += `<article class="quest-card quest-active">
        <div class="quest-identity">${portrait ? `<img class="quest-portrait" src="${portrait}" alt="" width="58" height="66">` : ''}${head(q)}</div>
        ${current.length ? `<div class="quest-current">
          <div class="chron-meta chron-attention">${current.length > 1 ? 'Что сделать сейчас' : 'Следующий шаг'}</div>
          <ul>${current.map(text => `<li>${text}</li>`).join('')}</ul>
        </div>` : ''}
        ${other.length ? `<ol class="quest-steps">${other.join('')}</ol>` : ''}
        <div class="quest-reward"><span>Награда</span>${esc(q.reward)}</div>
        <details class="quest-story" data-quest="${q.id}"${openStories.has(q.id) ? ' open' : ''}><summary>О поручении</summary><p class="quest-text">${esc(heroText(q.journal))}</p></details>
      </article>`;
    });
  }

  if (offered.length) {
    html += group('offered', 'Можно взять', offered.map(q => `<article class="quest-card offered">${head(q)}<p class="quest-text">${esc(heroText(q.offer))}</p></article>`), true);
  }

  if (lost.length) {
    html += group('lost', 'Не успели', lost.map(q => `<article class="quest-card lost">${head(q)}<p class="quest-text">${esc(heroText(q.journal))}</p><p class="quest-lost-note">Андервуда больше нет.</p></article>`));
  }

  if (done.length) {
    html += group('done', 'Завершённые', done.map(q => {
      const text = q.needs || q.bag || q.steps.some(s => typeof s.text === 'function') ? q.journal : q.steps.map(s => s.text).join(' · ');
      return `<article class="quest-card done">${head(q)}<p class="quest-text">${esc(heroText(text))}</p></article>`;
    }));
  }

  box.innerHTML = html;
  markQuestsSeen();
}
