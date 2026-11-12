// ========================================================
//  СИСТЕМЫ: НАСТРОЙКИ ЧАТА (v0.32)
//  Что показывать в журнале боя и в журнале добычи.
//  + У каждой строки журнала — метка группы (data-cat), её ставят logCombat / logLoot
//    (core/helpers.js): явно или по угадайке guessCombatCat / guessLootCat.
//  + Скрытие — классами на body (chat-hide-<группа>) и CSS: переключение мгновенное,
//    в том числе для уже написанных строк.
//  + Выбор хранится на этом устройстве (localStorage), как шрифт и масштаб.
//  + Группа 'sys' (уровень, смерть, бафы закончились…) не скрывается никогда.
// ========================================================

const CHAT_FILTER_KEY = 'l2browser_chat_filter';

const CHAT_GROUPS = [
  { title: 'Бой', items: [
    { key: 'my',      label: 'Мои удары и навыки' },
    { key: 'enemy',   label: 'Удары врагов' },
    { key: 'miss',    label: 'Промахи и увороты' },
    { key: 'effects', label: 'Яд, поджог, кровь, оглушение' },
    { key: 'pack',    label: 'Подмога и стая' },
    { key: 'kill',    label: 'Убийства и опыт' },
  ] },
  { title: 'Подробности', items: [
    { key: 'notes',   label: 'Приписки к ударам', hint: 'поджог, заморозка, метки' },
    { key: 'procs',   label: 'Случайные бонусы', hint: 'бонусный опыт, цикл мастера' },
    { key: 'consum',  label: 'Зелья и еда' },
  ] },
  { title: 'Добыча', items: [
    { key: 'gold',      label: 'Оболы' },
    { key: 'items',     label: 'Предметы' },
    { key: 'lootnotes', label: 'Бонус стаи и жадности' },
  ] },
];
const CHAT_KEYS = CHAT_GROUPS.flatMap(g => g.items.map(i => i.key));

// Быстрые наборы: что выключено.
const CHAT_PRESETS = {
  all:    { label: 'Всё',     off: [] },
  normal: { label: 'Обычно',  off: ['procs'] },
  short:  { label: 'Коротко', off: ['enemy', 'miss', 'effects', 'notes', 'procs', 'consum', 'lootnotes'] },
};

let __chatOff = loadChatFilter();

function loadChatFilter() {
  try {
    const v = JSON.parse(localStorage.getItem(CHAT_FILTER_KEY));
    if (Array.isArray(v)) return new Set(v.filter(k => CHAT_KEYS.includes(k)));
  } catch (e) {}
  return new Set(CHAT_PRESETS.normal.off);
}
function saveChatFilter() {
  try { localStorage.setItem(CHAT_FILTER_KEY, JSON.stringify([...__chatOff])); } catch (e) {}
}
function applyChatFilter() {
  if (!document.body) return;
  CHAT_KEYS.forEach(k => document.body.classList.toggle('chat-hide-' + k, __chatOff.has(k)));
}

function toggleChatFilter(key) {
  if (__chatOff.has(key)) __chatOff.delete(key); else __chatOff.add(key);
  saveChatFilter(); applyChatFilter(); renderChatFilterSettings();
}
function setChatPreset(id) {
  const pr = CHAT_PRESETS[id];
  if (!pr) return;
  __chatOff = new Set(pr.off);
  saveChatFilter(); applyChatFilter(); renderChatFilterSettings();
}
function currentChatPreset() {
  return Object.keys(CHAT_PRESETS).find(id => {
    const off = CHAT_PRESETS[id].off;
    return off.length === __chatOff.size && off.every(k => __chatOff.has(k));
  }) || null;
}

// Вкладка «Чат» в настройках.
function renderChatFilterSettings() {
  const box = document.getElementById('chat-filter-box');
  if (!box) return;
  const cur = currentChatPreset();
  const presets = Object.keys(CHAT_PRESETS).map(id =>
    `<button class="settings-btn${cur === id ? ' active' : ''}" onclick="setChatPreset('${id}')">${CHAT_PRESETS[id].label}</button>`).join('');
  const groups = CHAT_GROUPS.map(g => `<div class="chat-filter-group"><div class="chat-filter-title">${g.title}</div>${
    g.items.map(i => `<label class="chat-filter-row"><input type="checkbox" ${__chatOff.has(i.key) ? '' : 'checked'} onchange="toggleChatFilter('${i.key}')"><span>${i.label}</span>${i.hint ? `<em>${i.hint}</em>` : ''}</label>`).join('')
  }</div>`).join('');
  box.innerHTML = `<div class="settings-buttons">${presets}</div>
    <div class="settings-current">${cur ? 'Набор: <b>' + CHAT_PRESETS[cur].label + '</b>' : 'Набор: <b>свой</b>'}</div>
    <div class="chat-filter-groups">${groups}</div>
    <div class="settings-hint">Уровень, смерть и конец бафов видны всегда. Скрытое пропадает и из уже написанных строк.</div>`;
}

// ---- Группа строки журнала боя по тексту и классу (если не передана явно) ----
function guessCombatCat(text, cls) {
  const c = ' ' + (cls || '') + ' ';
  const has = k => c.includes(' ' + k + ' ');
  if (/Бонусный опыт/.test(text)) return 'procs';
  if (/промах|уворачива/i.test(text)) return 'miss';
  if (has('separator')) return /^🌿/.test(text) ? 'pack' : 'sys';
  if (has('kill')) return /Подмога/.test(text) ? 'pack' : 'kill';
  if (has('poison') || has('fire')) return 'effects';
  if (has('loss')) return /погиб|не выдержал/.test(text) ? 'sys' : 'effects';
  if (has('monster') || has('block')) return 'enemy';
  if (has('magic')) return /бьёт магией|Мана-щит/.test(text) ? 'enemy' : 'effects';
  if (has('potion') || has('food')) return 'consum';
  if (has('player') || has('player-skill') || has('player-magic')) {
    if (/Скорость молнии|Заряд молнии|заряжает клинок|питает бурю|отдачи нет|Кровь питает|Цепной разум/.test(text)) return 'procs';
    if (/ОГЛУШ|оглуш|Зарубк|Точный выстрел|ПАРАЛИЧ|парализ|пропускает удар|невосприимчив/.test(text)) return 'effects';
    return 'my';
  }
  if (/Кровотечение остановилось|Зарубка.*затянулась/.test(text)) return 'effects';
  return 'sys';
}
// Приписка в строке боя: «цикл мастера», «КД … −1» — случайный бонус, остальное — подробности удара.
function guessNoteCat(part) {
  return /Цикл мастера|Цепной разум|КД .*−\d/.test(part) ? 'procs' : 'notes';
}
function guessLootCat(cls) {
  const c = ' ' + (cls || '') + ' ';
  if (c.includes(' log-gold ')) return 'gold';
  if (c.includes(' log-loot ')) return 'items';
  return 'sys';
}

applyChatFilter();
