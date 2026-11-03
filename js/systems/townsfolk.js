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
// ========================================================

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
}

// Темы, доступные герою сейчас: minLevel — с какого уровня,
// after — вопрос-продолжение, появляется после своей темы, when — любое условие.
function ownerTopics(npcId) {
  const chat = OWNER_CHATS[npcId];
  if (!chat) return [];
  const lvl = state.player.level || 1;
  return chat.topics.filter(t =>
    (!t.minLevel || lvl >= t.minLevel) &&
    (!t.after || ownerTopicAsked(npcId, t.after)) &&
    (!t.when || t.when()));
}

function ownerHasNews(npcId) {
  return ownerTopics(npcId).some(t => !ownerTopicAsked(npcId, t.id));
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

  const val = v => (typeof v === 'function' ? v() : v);   // hello может быть функцией (реплика по обстоятельствам)
  const nodes = {
    hello: {
      text: () => val((chat.helloAgain && chat.topics.some(t => ownerTopicAsked(npcId, t.id))) ? chat.helloAgain : chat.hello),
      options: menu,
    },
    more: { text: chat.more, options: menu },
  };
  chat.topics.forEach(t => {
    nodes['t_' + t.id] = {
      text: t.a,
      onEnter: () => {
        markOwnerTopic(npcId, t.id);
        (t.lore || []).forEach(k => unlockLore(k));
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
