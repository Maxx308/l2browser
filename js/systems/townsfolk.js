// ========================================================
//  СИСТЕМЫ: ЖИТЕЛИ — «ПОГОВОРИТЬ» С ВЛАДЕЛЬЦЕМ МЕСТА (v0.31)
//  Кнопка 💬 в шапке окна (Торговец, Кузница…) — рядом с «Закрыть».
//  «Захотел — поболтал»: сам владелец не навязывается.
//  + Темы — в OWNER_CHATS (js/data/dialogues.js). Узлы диалога строятся отсюда.
//  + Заданная тема — с галочкой, её можно перечитать.
//  + Пока есть незаданные темы — красная точка на кнопке.
//  + chronicle.talks { 'npc.тема': время } — что спросили; живёт в сохранении героя.
//  + Темы появляются не сразу: minLevel, after (вопрос-продолжение), when (любое условие).
//    Для when есть «дела» героя: markDeed('trader.sold') → didDeed('trader.sold').
//    chronicle.deeds { ключ: время } — тоже в сохранении.
//  + Разговор открывается поверх окна; закрыл — снова в лавке.
//  + v0.32: ОТНОШЕНИЯ — chronicle.rapport { npc: очки }, ступени RAPPORT_STEPS (dialogues.js).
//    Ступень открывает темы (rapport), до неё житель отказывает (refuse), меняет приветствие (helloStages).
//    chronicle.rapportSvc { npc: { n, day } } — сколько очков уже дали дела жителя.
// ========================================================

// ---- v0.32: ОТНОШЕНИЯ ----
function rapportPoints(npcId) {
  const c = state.player && state.player.chronicle;
  return (c && c.rapport && c.rapport[npcId]) || 0;
}
function rapportStage(npcId) {
  const pts = rapportPoints(npcId);
  let s = 0;
  RAPPORT_STEPS.forEach((v, i) => { if (pts >= v) s = i; });
  return s;
}
// Как отношение пишется в Энциклопедии: «Ворчит, но привык».
function rapportWord(npcId) {
  const chat = OWNER_CHATS[npcId];
  return ((chat && chat.rapportWords) || RAPPORT_WORDS)[rapportStage(npcId)];
}

function addRapport(npcId, n) {
  const c = state.player.chronicle;
  if (!c || !OWNER_CHATS[npcId] || !n) return;
  if (!c.rapport) c.rapport = {};
  const before = rapportStage(npcId);
  c.rapport[npcId] = Math.max(0, rapportPoints(npcId) + n);
  const after = rapportStage(npcId);
  if (after === before) return;
  updateTalkButtons();   // могли открыться темы
  if (after > before) {
    const name = (LORE_ARTICLES[npcId] && LORE_ARTICLES[npcId].title) || npcId;
    if (typeof showToast === 'function') showToast('🤝', `${name}: ${heroText(rapportWord(npcId)).toLowerCase()}`);
    if (after === RAPPORT_STEPS.length - 1 && typeof annalsFirst === 'function') annalsFirst('friend.' + npcId);
  }
}

// Дело жителя (покупка, ковка, подгонка, баф, навык): +1 не чаще раза в день, всего не больше RAPPORT_SERVICE_CAP.
function rapportService(npcId) {
  const c = state.player.chronicle;
  if (!c) return;
  if (!c.rapportSvc) c.rapportSvc = {};
  const s = c.rapportSvc[npcId] || { n: 0, day: '' };
  const today = new Date().toDateString();
  if (s.n >= RAPPORT_SERVICE_CAP || s.day === today) return;
  c.rapportSvc[npcId] = { n: s.n + 1, day: today };
  addRapport(npcId, 1);
}

// Старый герой: очки — за уже заданные темы и за дела, которые он уже делал (по одному).
function rapportGuess(c) {
  const r = {};
  Object.keys(c.talks || {}).forEach(k => { const npc = k.split('.')[0]; r[npc] = (r[npc] || 0) + 1; });
  const svc = { 'trader.bought': 'trader', 'trader.sold': 'trader', 'forge.crafted': 'smith', 'refine.milestone': 'refiner',
    'refine.failed': 'refiner', 'mentor.learned': 'mentor', 'tavern.buff': 'hostess', 'guild.buff': 'guildmage' };
  c.rapportSvc = {};
  Object.keys(svc).forEach(d => {
    const npc = svc[d];
    if (!(c.deeds && c.deeds[d]) || c.rapportSvc[npc]) return;
    c.rapportSvc[npc] = { n: 1, day: '' };
    r[npc] = (r[npc] || 0) + 1;
  });
  return r;
}

// Тема открыта по отношениям? (rapport — нужная ступень)
function topicOpen(npcId, t) {
  return !t.rapport || rapportStage(npcId) >= t.rapport;
}

function ownerTopicAsked(npcId, topicId) {
  const c = state.player && state.player.chronicle;
  return !!(c && c.talks && c.talks[npcId + '.' + topicId]);
}

function markOwnerTopic(npcId, topicId) {
  const c = state.player.chronicle;
  if (!c) return;
  if (!c.talks) c.talks = {};
  const key = npcId + '.' + topicId;
  if (c.talks[key]) return;
  c.talks[key] = Date.now();
  addRapport(npcId, 1);   // v0.32: новая тема — житель чуть ближе
  updateTalkButtons();
  saveCurrentSlot();
}

// Дела героя, от которых зависят темы: «продал Торговцу», «купил у Торговца»…
function didDeed(key) {
  const c = state.player && state.player.chronicle;
  return !!(c && c.deeds && c.deeds[key]);
}
function markDeed(key) {
  const c = state.player.chronicle;
  if (!c) return;
  if (!c.deeds) c.deeds = {};
  if (c.deeds[key]) return;
  c.deeds[key] = Date.now();
  updateTalkButtons();   // могла появиться новая тема — точка на «Поговорить»
  if (typeof annalsFirst === 'function') annalsFirst(key);   // v0.32: запись в летописи, если для дела есть текст
}

// Темы, доступные герою сейчас: minLevel — с какого уровня,
// after — вопрос-продолжение, появляется после своей темы, when — любое условие,
// v0.32: rapport — ступень отношений (с refuse тема видна и раньше, но житель отказывает).
function ownerTopics(npcId) {
  const chat = OWNER_CHATS[npcId];
  if (!chat) return [];
  const lvl = state.player.level || 1;
  return chat.topics.filter(t =>
    (!t.minLevel || lvl >= t.minLevel) &&
    (!t.after || ownerTopicAsked(npcId, t.after)) &&
    (!t.when || t.when()) &&
    (t.refuse || topicOpen(npcId, t)));
}

// Точка — только за темы, на которые житель уже готов ответить.
function ownerHasNews(npcId) {
  return ownerTopics(npcId).some(t => topicOpen(npcId, t) && !ownerTopicAsked(npcId, t.id));
}

function talkToOwner(npcId) {
  if (!DIALOGUES[npcId]) return;
  openDialogue(npcId);
}

// Точка «есть о чём поговорить» на кнопках 💬. Зовётся при открытии окна и после разговора.
function updateTalkButtons() {
  document.querySelectorAll('.talk-btn[data-npc]').forEach(b => {
    b.classList.toggle('has-news', ownerHasNews(b.dataset.npc));
  });
}

// Узлы: hello (первое приветствие / снова) → t_<тема> (ответ) → more («что ещё?»).
function buildOwnerChatNodes(npcId) {
  const chat = OWNER_CHATS[npcId];
  const ask = t => ({ text: (ownerTopicAsked(npcId, t.id) ? '✓ ' : '') + t.q, next: 't_' + t.id });
  const menu = () => ownerTopics(npcId).map(ask).concat([{ text: chat.bye, action: 'close' }]);

  // hello может быть функцией (реплика по обстоятельствам); «%name%» — имя героя (v0.32)
  const val = v => String(typeof v === 'function' ? v() : v).replace(/%name%/g, state.player.name || '');
  // Приветствие «снова»: по ступени отношений (helloStages), иначе helloAgain.
  const helloAgain = () => (chat.helloStages ? chat.helloStages[rapportStage(npcId)] : chat.helloAgain);
  const nodes = {
    hello: {
      text: () => val((helloAgain() && chat.topics.some(t => ownerTopicAsked(npcId, t.id))) ? helloAgain() : chat.hello),
      options: menu,
    },
    more: { text: chat.more, options: menu },
  };
  chat.topics.forEach(t => {
    nodes['t_' + t.id] = {
      // v0.32: до нужной ступени отношений — отказ (тема не засчитывается)
      text: () => val(topicOpen(npcId, t) ? t.a : t.refuse),
      onEnter: () => {
        if (!topicOpen(npcId, t)) return;
        markOwnerTopic(npcId, t.id);
        (t.lore || []).forEach(k => unlockLore(k));
        if (t.act) t.act();
      },
      // Сначала вопросы-продолжения этой темы, потом «Ещё вопрос».
      options: () => ownerTopics(npcId).filter(x => x.after === t.id).map(ask).concat([
        { text: 'Ещё вопрос', next: 'more' },
        { text: chat.bye, action: 'close' },
      ]),
    };
  });
  return nodes;
}

Object.keys(OWNER_CHATS).forEach(id => {
  DIALOGUES[id] = { start: 'hello', nodes: buildOwnerChatNodes(id) };
});
