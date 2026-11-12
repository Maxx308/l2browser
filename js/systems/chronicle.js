// ========================================================
//  СИСТЕМЫ: ХРОНИКИ (v0.30)
//  Вкладка «Хроники»: Летопись · Поручения · Энциклопедия.
//  + Летопись — дневник героя от первого лица, новые сверху.
//    v0.32: короткая запись, когда герой что-то делает впервые (annalsFirst, тексты — js/data/annals.js).
//    Разговоры с сумкой в летопись больше не пишутся — только запись героя о знакомстве;
//    сама сумка — статья в Энциклопедии. Записи с вопросом (ask) и реплики сумки (speaker 'bag')
//    летопись по-прежнему умеет показывать — на будущее.
//  + state.player.chronicle — живёт в сохранении героя (и в облаке).
//    counters — скрытые счётчики на будущее (концовки), игроку не показываются.
//  + state.player.bag — «Видавшая виды сумка» (уровень).
//  + Поручения — журнал квестов (renderQuestJournal в js/systems/quests.js).
//    Энциклопедия — js/systems/encyclopedia.js.
//  + Тексты записей: «{м|ж}» — окончания под пол героя (heroText),
//    «{{факт}}» — то, что герой узнаёт позже (CHRONICLE_FACTS).
//  + Первая запись — появление героя в мире (год CHRONICLE_START_YEAR новой эры).
// ========================================================

const CHRONICLE_MAX_ENTRIES = 300;
const BAG_NAME = 'Видавшая виды сумка';
const BAG_DESC = 'Потёртая, латаная, пахнет пылью и чем-то горелым. Кажется, ей лет сто. Или больше.';

// Год появления героя. Новая эра — от исчезновения Воича (в игре это не объясняем).
const CHRONICLE_START_YEAR = 213;

// Факты о мире. В тексте записи «{{ключ}}»: пока герой не узнал — unknown, узнал — known.
// Старые записи переписываются сами, когда герой узнаёт правду.
// loc — локация, чьё имя в подписи записи тоже прячется до этого факта.
const CHRONICLE_FACTS = {
  start_place: { unknown: 'неизвестном месте', known: 'Андервуде', loc: 'town' },
  bag_name: { unknown: '???', known: 'Заплечник' },   // сумка представилась (первое знакомство)
};

// Свежие летопись и сумка (новый герой).
function makeFreshChronicle() {
  return { entries: [], nextId: 1, seen: 0, known: {}, lore: {}, loreSeen: {}, questsSeen: {}, firsts: {}, counters: { trust: 0, deaths: 0, disenchanted: 0 } };
}
// v0.35.1: level — сколько поручений Заплечника выполнено (+1 ячейка за каждое); v: 2 — новый счёт уровней.
function makeFreshBag() {
  return { level: 0, v: 2 };
}

// Первая запись героя — появление в мире.
function addArrivalEntry() {
  addChronicleEntry('Я очутил{ся|ась} в {{start_place}}. Ни страха, ни удивления.', {
    title: `Год ${CHRONICLE_START_YEAR} новой эры`, lvl: 1, loc: 'town',
  });
}

// Новый герой: первая запись — появление в мире. Сумка пока молчит.
function startChronicleForNewHero() {
  addArrivalEntry();
}

// Старый сейв без летописи — создаём с записью о появлении.
// Если со Старейшиной уже говорил — место он знает.
function ensureChronicle() {
  const p = state.player;
  if (!p.bag) p.bag = makeFreshBag();
  // v0.35.1: раньше у всех был «уровень 1», который ничего не давал. Теперь уровень = выполненные поручения.
  if (!p.bag.v) p.bag = makeFreshBag();
  if (!p.chronicle || !Array.isArray(p.chronicle.entries)) {
    p.chronicle = makeFreshChronicle();
    delete p.chronicle.firsts;   // v0.32: старому герою «впервые» угадываем ниже (annalsGuessFirsts)
    if (p.classId) {
      addArrivalEntry();
      const metElder = p.level > 1 || (typeof isQuestStarted === 'function' && isQuestStarted('firstSteps'));
      if (metElder) p.chronicle.known.start_place = Date.now();
    }
  }
  const c = p.chronicle;
  // v0.35.1: старые записи «Впервые …» переписываем один раз (ANNALS_REWRITES_351 в js/data/annals.js)
  if (!c.rewrite351 && typeof ANNALS_REWRITES_351 !== 'undefined') {
    c.entries.forEach(e => {
      if (!e || typeof e.text !== 'string') return;
      ANNALS_REWRITES_351.forEach(([from, to]) => { if (e.text.includes(from)) e.text = e.text.split(from).join(to); });
    });
    c.rewrite351 = true;
  }
  if (!c.known) c.known = {};
  if (!c.lore) c.lore = {};
  if (!c.loreSeen) c.loreSeen = {};
  // Журнал поручений: давно выполненное у старого героя — не «новое».
  if (!c.questsSeen) {
    c.questsSeen = {};
    Object.keys(p.quests || {}).forEach(id => { if (p.quests[id].stage === 'done') c.questsSeen[id] = 'done'; });
  }
  // Уже говорил со Старейшиной — Андервуд и Старейшина в Энциклопедии есть.
  if (c.known.start_place && typeof unlockLore === 'function') { unlockLore('underwood', true); unlockLore('elder', true); }
  // Старый герой: Торговца уже знает, купленное лежит в сумке.
  if (typeof unlockLore === 'function') {
    if (p.level > 1) { unlockLore('trader', true); unlockLore('underwood.trade', true); unlockLoreArticle('obol', true); }
    (p.inventory || []).forEach(i => { if (i && i.shopId) unlockLore('item.' + i.shopId, true); });
  }
  if (typeof unlockLoreActiveBuffs === 'function') unlockLoreActiveBuffs();   // v0.32: действующие бафы и еда
  if (!c.counters) c.counters = {};
  ['trust', 'deaths', 'disenchanted'].forEach(k => { if (typeof c.counters[k] !== 'number') c.counters[k] = 0; });
  // v0.31: дела героя (js/systems/townsfolk.js). Старый герой у Торговца уже и покупал, и продавал.
  if (!c.deeds) {
    c.deeds = {};
    if (p.level > 1) { c.deeds['trader.bought'] = Date.now(); c.deeds['trader.sold'] = Date.now(); }
  }
  // v0.32: старый герой многое уже делал — «впервые» про это задним числом не пишем.
  if (!c.firsts) c.firsts = annalsGuessFirsts(p, c);
  migrateBagEntries(c);
  // v0.32: отношения с жителями — старому герою за уже заданные темы и сделанные дела
  if (!c.rapport && typeof rapportGuess === 'function') c.rapport = rapportGuess(c);
}

// v0.32: что старый герой наверняка уже делал (по уровню, делам, убийствам, снаряжению, бафам).
function annalsGuessFirsts(p, c) {
  const f = {};
  const now = Date.now();
  if (p.level > 1) ['elder', 'kill', 'loc.field'].forEach(k => { f[k] = now; });
  Object.keys(c.deeds || {}).forEach(k => { f[k] = c.deeds[k]; });
  if (c.counters && c.counters.deaths > 0) f.death = now;
  const kills = Object.keys(p.monsterKills || {});
  if (typeof MINE_MONSTERS !== 'undefined' && kills.some(k => MINE_MONSTERS.some(m => k.startsWith(m.id + '_')))) f['loc.mine'] = now;
  if (Object.values(p.equipment || {}).some(it => it && it.refineLevel > 0)) f.refine = now;
  Object.keys(p.guildBuffs || {}).forEach(id => { if (p.guildBuffs[id] && p.guildBuffs[id].timer > 0) f['buff.' + id] = now; });
  Object.keys(p.tavernBuffs || {}).forEach(id => { if (p.tavernBuffs[id] && p.tavernBuffs[id].timer > 0) f['buff.' + id] = now; });
  if (p.dish && p.dish.timer > 0) f['food.' + p.dish.id] = now;
  return f;
}

// v0.32: в старой летописи знакомство с сумкой записано репликами сумки (три записи) —
// меняем их на одну запись героя на том же месте; выборы переезжают в chronicle.bagMeet.
function migrateBagEntries(c) {
  const i = c.entries.findIndex(e => e.speaker === 'bag');
  if (i >= 0) {
    const old = c.entries[i];
    const naming = c.entries.find((e, j) => j > i && e.speaker === 'bag' && e.ask);
    const first = old.ask && typeof old.ask.answer === 'number' ? old.ask.answer : 1;
    if (!c.bagMeet) c.bagMeet = { first, name: naming && typeof naming.ask.answer === 'number' ? naming.ask.answer : 1 };
    c.entries[i] = { id: old.id, at: old.at, lvl: old.lvl, loc: old.loc, speaker: 'hero', text: ANNALS_BAG_MEET[first] || ANNALS_BAG_MEET[1] };
    c.entries = c.entries.filter(e => e.speaker !== 'bag');
    c.firsts.bag = old.at;
  }
  if (bagMet()) unlockBagLore(c.bagMeet ? c.bagMeet.first : null, true);
}

// ---- v0.32: Летопись — дневник героя ----
// Запись «впервые …» по ключу из ANNALS_FIRSTS. Один раз на ключ; vars — подстановки «%имя%».
function annalsFirst(key, vars, opts) {
  const p = state.player;
  const c = p.chronicle;
  if (!c || !p.classId || !ANNALS_FIRSTS[key]) return;
  if (!c.firsts) c.firsts = {};
  if (c.firsts[key]) return;
  c.firsts[key] = Date.now();
  const text = ANNALS_FIRSTS[key].replace(/%(\w+)%/g, (m, k) => (vars && vars[k] != null ? vars[k] : ''));
  addChronicleEntry(text, opts);
}

// ---- Факты: что герой уже узнал ----
function knowsChronicleFact(key) {
  const c = state.player.chronicle;
  return !!(c && c.known && c.known[key]);
}
function learnChronicleFact(key) {
  const c = state.player.chronicle;
  if (!c || !CHRONICLE_FACTS[key] || knowsChronicleFact(key)) return;
  if (!c.known) c.known = {};
  c.known[key] = Date.now();
  if (isChronicleOpen()) renderChronicle();
  saveCurrentSlot();
}

// Скрытый счётчик (концовки). Игрок его не видит.
function bumpChronicleCounter(key, by) {
  const c = state.player.chronicle;
  if (!c || !c.counters) return;
  c.counters[key] = (c.counters[key] || 0) + (by === undefined ? 1 : by);
}

// Новая запись. opts: { speaker: 'bag' | 'hero', title?, lvl?, loc?, ask: { options: [{ text, reply?, trust? }], answer? } }
// lvl/loc — если запись «задним числом» (по умолчанию — текущие уровень и место).
// ask.answer — если вопрос уже отвечен в диалоге (тогда запись просто хранит выбор; доверие считает диалог).
function addChronicleEntry(text, opts) {
  const p = state.player;
  if (!p.chronicle) p.chronicle = makeFreshChronicle();
  const c = p.chronicle;
  const o = opts || {};
  const entry = {
    id: c.nextId++,
    at: Date.now(),
    lvl: o.lvl || p.level,
    loc: o.loc || p.currentLocation,
    speaker: o.speaker || 'hero',
    text,
  };
  if (o.title) entry.title = o.title;
  if (o.ask && o.ask.options && o.ask.options.length) {
    entry.ask = { options: o.ask.options.map(x => ({ text: x.text, reply: x.reply || '', trust: x.trust || 0 })), answer: null };
    if (typeof o.ask.answer === 'number') { entry.ask.answer = o.ask.answer; entry.ask.answeredAt = entry.at; }
  }
  c.entries.push(entry);
  if (c.entries.length > CHRONICLE_MAX_ENTRIES) c.entries.splice(0, c.entries.length - CHRONICLE_MAX_ENTRIES);
  updateChronicleDot();
  if (isChronicleOpen()) renderChronicle();
  return entry;
}

// Ответ игрока на вопрос записи.
function answerChronicle(entryId, optIdx) {
  const c = state.player.chronicle;
  const e = c && c.entries.find(x => x.id === entryId);
  if (!e || !e.ask || e.ask.answer !== null) return;
  const opt = e.ask.options[optIdx];
  if (!opt) return;
  e.ask.answer = optIdx;
  e.ask.answeredAt = Date.now();
  if (opt.trust) bumpChronicleCounter('trust', opt.trust);
  renderChronicle();
  updateChronicleDot();
  saveCurrentSlot();
}

// ---- Красная точка на кнопке: новые записи или неотвеченный вопрос ----
function chronicleHasNews() {
  return annalsHaveNews() || (typeof loreHasNews === 'function' && loreHasNews())
    || (typeof questNews === 'function' && questNews());
}
function annalsHaveNews() {
  const c = state.player.chronicle;
  if (!c) return false;
  const lastId = c.entries.length ? c.entries[c.entries.length - 1].id : 0;
  return lastId > (c.seen || 0) || c.entries.some(e => e.ask && e.ask.answer === null);
}
function updateChronicleDot() {
  const tab = document.querySelector('.tab[data-tab="chronicle"]');
  if (tab) tab.classList.toggle('has-news', chronicleHasNews());
  const loreSub = document.querySelector('.chron-sub[data-sec="lore"]');
  if (loreSub) loreSub.classList.toggle('has-news', typeof loreHasNews === 'function' && loreHasNews());
  const questSub = document.querySelector('.chron-sub[data-sec="quests"]');
  if (questSub) questSub.classList.toggle('has-news', typeof questNews === 'function' && questNews());
  if (typeof updateBagDot === 'function') updateBagDot();   // v0.35.1: Заплечник чего-то хочет
}
function isChronicleOpen() {
  const panel = document.getElementById('panel-chronicle');
  return !!(panel && panel.classList.contains('active'));
}

// ---- Разделы ----
let __chronicleSection = 'annals';
function switchChronicleSection(id) {
  __chronicleSection = id;
  renderChronicle();
}

function escChronicle(s) {
  return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

// Текст записи → HTML: окончания под пол, «{{факт}}» — узнанное или пока неизвестное.
function chronicleTextHtml(text) {
  return heroText(text).split(/\{\{(\w+)\}\}/).map((s, i) => {
    if (i % 2 === 0) return escChronicle(s);
    const f = CHRONICLE_FACTS[s];
    if (!f) return '';
    return knowsChronicleFact(s) ? `<span class="chron-fact">${escChronicle(f.known)}</span>` : escChronicle(f.unknown);
  }).join('').replace(/\*([^*]+)\*/g, '<span class="chron-act">$1</span>');
}

// Реплика в кавычках; если в ней есть описание «*…*» — без кавычек (иначе кавычка повиснет на описании).
function chronicleSpeechHtml(text) {
  return text.includes('*') ? chronicleTextHtml(text) : '«' + chronicleTextHtml(text) + '»';
}

// Ответ в записи: «[Действие]» — «Твой выбор: действие», речь — «Твой ответ: «…»».
function chronicleAnswerHtml(text) {
  const act = /^\[(.+)\]$/.exec(text);
  if (act) return `Твой выбор: ${chronicleTextHtml(act[1].charAt(0).toLowerCase() + act[1].slice(1))}`;
  return `Твой ответ: «${chronicleTextHtml(text)}»`;
}

// Подпись места. Место, которое герой ещё не узнал, не называем.
function chronicleWhere(e) {
  const hidden = Object.keys(CHRONICLE_FACTS).some(k => CHRONICLE_FACTS[k].loc === e.loc && !knowsChronicleFact(k));
  if (hidden) return 'Неизвестное место';
  return (typeof LOCATION_NAMES !== 'undefined' && LOCATION_NAMES[e.loc]) || '';
}

function renderChronicle() {
  document.querySelectorAll('.chron-sub').forEach(b => b.classList.toggle('active', b.dataset.sec === __chronicleSection));
  const box = document.getElementById('chronicle-body');
  if (!box) return;

  if (__chronicleSection === 'lore') {
    renderEncyclopedia(box);
    return;
  }
  if (__chronicleSection === 'quests') {
    renderQuestJournal(box);
    updateChronicleDot();
    return;
  }

  const c = state.player.chronicle;
  if (!c || !c.entries.length) {
    box.innerHTML = `<div class="chron-soon">Летопись пока пуста.</div>`;
    return;
  }

  box.innerHTML = c.entries.slice().reverse().map(e => {
    const where = chronicleWhere(e);
    const pending = e.ask && e.ask.answer === null;
    let html = `<div class="chron-entry${e.speaker === 'bag' ? ' bag' : ''}${pending ? ' pending' : ''}">`;
    const who = e.speaker === 'bag' ? `<span class="chron-who">${escChronicle(bagSpeakerName())}</span> · ` : '';
    html += `<div class="chron-meta">${who}${escChronicle(where)}${where ? ' · ' : ''}${e.lvl} ур.${pending ? ' · <b>не отвечено</b>' : ''}</div>`;
    if (e.title) html += `<div class="chron-title">${chronicleTextHtml(e.title)}</div>`;
    html += `<div class="chron-text">${e.speaker === 'bag' ? chronicleSpeechHtml(e.text) : chronicleTextHtml(e.text)}</div>`;
    if (e.ask) {
      if (pending) {
        html += `<div class="chron-answers">${e.ask.options.map((o, i) => `<button class="chron-answer" onclick="answerChronicle(${e.id}, ${i})">${chronicleTextHtml(o.text)}</button>`).join('')}</div>`;
      } else {
        const o = e.ask.options[e.ask.answer];
        html += `<div class="chron-reply">${chronicleAnswerHtml(o.text)}</div>`;
        if (o.reply) html += `<div class="chron-text">${chronicleSpeechHtml(o.reply)}</div>`;
      }
    }
    return html + `</div>`;
  }).join('');
}

// Открыли вкладку — новые записи прочитаны.
function openChroniclePanel() {
  const c = state.player.chronicle;
  if (c && c.entries.length) c.seen = c.entries[c.entries.length - 1].id;
  renderChronicle();
  updateChronicleDot();
}

// ---- Слот сумки в снаряжении ----
// Картинки сумок — img/bags/bag01_worn.webp … bag10_arcane.png. Наша «Видавшая виды» — потёртая (bag01),
// v0.35.1: с ростом Заплечника вид меняется (BAG_LOOKS в js/data/bag-quests.js).
const BAG_SLOT_IMG = 'img/bags/bag01_worn.webp';

function renderBagSlot(el) {
  el.classList.add('filled', 'bag-slot');
  el.classList.toggle('bag-calls', !bagMet());   // пока не знакомы — слот еле мерцает
  el.innerHTML = `<img src="${typeof bagLookImg === 'function' ? bagLookImg() : BAG_SLOT_IMG}" alt="">`;
  // v0.35.1: нажатие — разговор с Заплечником (поручения), наведение — подсказка
  el.onclick = (e) => { e.stopPropagation(); if (!bagMet()) startBagMeeting(); else if (typeof openBagTalk === 'function') openBagTalk(); else showBagTooltip(e); };
  if (typeof bagHasNews === 'function') el.classList.toggle('has-news', bagHasNews());
}

// ---- Заплечник: первое знакомство (тексты и узлы — js/data/dialogues.js, BAG_MEET) ----
// Наведение на слот (с задержкой, чтобы мышь «мимо» не открывала окно) или нажатие на телефоне.
const BAG_HOVER_DELAY = 600;
let __bagHoverTimer = null;
let __bagMeet = null;   // выборы идущего знакомства { first, name }

function bagMet() { return knowsChronicleFact('bag_name'); }
function bagSpeakerName() {
  const f = CHRONICLE_FACTS.bag_name;
  return bagMet() ? f.known : f.unknown;
}

function onBagSlotEnter(e) {
  if (bagMet()) { showBagTooltip(e); return; }
  clearTimeout(__bagHoverTimer);
  __bagHoverTimer = setTimeout(() => { __bagHoverTimer = null; startBagMeeting(); }, BAG_HOVER_DELAY);
}
function onBagSlotLeave() {
  clearTimeout(__bagHoverTimer);
  __bagHoverTimer = null;
  if (typeof hideTooltip === 'function') hideTooltip();
}

function startBagMeeting() {
  if (bagMet() || !state.player.classId) return;
  if (typeof __activeDialogue !== 'undefined' && __activeDialogue) return;
  if (typeof isAnyOverlayOpen === 'function' && isAnyOverlayOpen()) return;
  if (typeof hideTooltip === 'function') hideTooltip();
  __bagMeet = {};
  openDialogue('bag', 'greet');
}

// Выбор в разговоре. Закрыли окно на полпути — ничего не записано, при следующем наведении всё заново.
function bagMeetChoose(step, idx) {
  if (!__bagMeet) return;
  __bagMeet[step] = idx;
  if (step === 'name') finishBagMeeting();
}

// Знакомство состоялось: доверие, выборы — в chronicle.bagMeet (на будущее: реплики, концовки),
// в летопись — одна запись героя (зависит от первого выбора), сумка — в Энциклопедию.
function finishBagMeeting() {
  const m = __bagMeet;
  __bagMeet = null;
  const c = state.player.chronicle;
  bumpChronicleCounter('trust', BAG_MEET.first[m.first].trust + BAG_MEET.name[m.name].trust);
  c.bagMeet = { first: m.first, name: m.name };
  if (!c.firsts) c.firsts = {};
  if (!c.firsts.bag) {
    c.firsts.bag = Date.now();
    addChronicleEntry(ANNALS_BAG_MEET[m.first] || ANNALS_BAG_MEET[1]);
  }
  learnChronicleFact('bag_name');   // сохраняет
  unlockBagLore(m.first);
  const slot = document.querySelector('.equip-slot[data-slot="bag"]');
  if (slot) slot.classList.remove('bag-calls');
}

// Статья о сумке в Энциклопедии. «Не бросишь» — только тем, кто пробовал её сбросить (первый выбор 0).
function unlockBagLore(first, silent) {
  if (typeof unlockLoreArticle !== 'function') return;
  unlockLoreArticle('bag', silent);
  if (first === 0) unlockLore('bag.return', true);
}

function showBagTooltip(e) {
  const tt = document.getElementById('item-tooltip');
  if (!tt) return;
  const bag = state.player.bag || makeFreshBag();
  const look = typeof bagLook === 'function' ? bagLook() : {};
  let lines = `<div class="tt-name">${BAG_NAME}</div>`;
  lines += `<div class="tt-line type">${look.desc || BAG_DESC}</div>`;
  lines += `<div class="tt-line stat">Уровень Заплечника: ${bag.level || 0}</div>`;
  lines += `<div class="tt-line stat">Мест в инвентаре: ${invMaxSlots()}</div>`;
  if (typeof bagHasNews === 'function' && bagHasNews()) lines += `<div class="tt-line next">🎒 Заплечник чего-то хочет — нажми на сумку</div>`;
  else lines += `<div class="tt-line next">Нажми — поговорить. Его поручения: +1 ячейка</div>`;
  lines += `<div class="tt-line next">Нельзя снять, продать или распылить</div>`;
  tt.innerHTML = lines;
  tt.style.display = 'block';
  const w = tt.offsetWidth || 320, h = tt.offsetHeight || 160;
  tt.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, e.clientX + 15)) + 'px';
  tt.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, e.clientY + 15)) + 'px';
  if (typeof resetTooltipTimer === 'function') resetTooltipTimer();
}
