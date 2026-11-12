// ========================================================
//  СИСТЕМЫ: ИЛЬГРАД — второй город (v0.36, в разработке)
//  Город людей в осаде нежити. Локация 'ilgrad' (как 'town' у Андервуда):
//  безопасная зона с лавками, проверки «герой в городе» — isTownLoc (helpers.js).
//  + Открыт ли — state.player.ilgradOpen. Пока открывается только чит-меню
//    (потом — прорывом к воротам, 10 волн по 10).
//  + Пути — TRAVEL_TIMES / travelTime (config.js); в закрытый Ильград пути нет.
//  + Экран города — #city-grid-ilgrad (index.html), рамка .city-card-stone (city-map.css).
//  + Места подключены к готовым лавкам:
//      Комендатура — заглушка (поручения позже) · Арсенал — Торговец · Кузница — ковка и подгонка
//      Казармы — Наставник · Храм — бафы (как Таверна) · Башня магов — Гильдия
//      Снабжение — Склад · Лазарет — Алхимик · Стена — выход на Окраины (локация 'outskirts', монстры — monsters.js)
//  + Владельцы мест ещё не написаны (сюжет решается) — кнопки «Поговорить» в Ильграде спрятаны,
//    названия окон меняются (renderCityView → applyTownWindowTitles).
// ========================================================

function ilgradOpen() {
  return !!(state.player && state.player.ilgradOpen);
}

// ---- Закрытые места на карте ----
// До 20 ур. Ильград — серая карточка «В осаде» со слухами; с 20 ур. — цветная, кнопка прорыва.
// Заготовка: p.underwoodFallen — такая же серая карточка у Андервуда (пока нигде не ставится).
const ILGRAD_MIN_LEVEL = 20;

function ilgradRumor() {
  const lvl = state.player.level || 1;
  if (lvl >= 17) return 'Обозы больше не возвращаются. И птицы с той стороны не летят.';
  if (lvl >= 10) return 'Беженцы говорят, мёртвые встают быстрее, чем их хоронят.';
  return 'Большой город, неделя пути. Торговец возит туда добычу.';
}

// Что с местом на карте: null — обычное; { ready } — можно на прорыв; иначе закрыто (штамп, подпись, слух).
function mapLockInfo(loc) {
  const p = state.player;
  if (!p || loc === p.currentLocation) return null;
  if (loc === 'ilgrad' && !ilgradOpen()) {
    if ((p.level || 1) >= ILGRAD_MIN_LEVEL) {
      return { ready: true, desc: 'Город в кольце нежити. К воротам можно только пробиться.', meta: '⚔ Дорога — через орду' };
    }
    return { stamp: 'В осаде', desc: 'Дороги нет. Нежить держит все подступы.', meta: `🔒 с ${ILGRAD_MIN_LEVEL} уровня`, rumor: ilgradRumor() };
  }
  if (loc === 'town' && p.underwoodFallen) {
    return { stamp: 'Пал', desc: 'Там теперь хозяйничают мёртвые.', meta: '🔒 Пути нет', rumor: 'Из Андервуда больше никто не приходит.' };
  }
  return null;
}

// Вид карточек закрытых мест. Зовётся из updateMapMeta (после обычной отрисовки).
function renderMapLocks() {
  // Окраины на карте — только когда Ильград открыт.
  const outskirts = document.getElementById('map-card-outskirts');
  if (outskirts) outskirts.style.display = (ilgradOpen() || state.player.currentLocation === 'outskirts') ? '' : 'none';

  ['ilgrad', 'town'].forEach(loc => {
    const card = document.querySelector(`.map-card[data-loc="${loc}"]`);
    if (!card) return;
    const lock = mapLockInfo(loc);
    const closed = !!(lock && !lock.ready);
    card.classList.toggle('map-locked', closed);

    let layer = card.querySelector(':scope > .map-lock');
    if (closed && !layer) {
      layer = document.createElement('div');
      layer.className = 'map-lock';
      layer.innerHTML = '<div class="map-lock-bg"></div><div class="map-lock-fog"></div><div class="map-lock-stamp"></div>';
      card.prepend(layer);
    } else if (!closed && layer) {
      layer.remove();
    }
    if (closed) layer.querySelector('.map-lock-stamp').textContent = lock.stamp;

    const desc = card.querySelector('.map-desc');
    if (desc) {
      if (desc.dataset.orig === undefined) desc.dataset.orig = desc.textContent;
      desc.textContent = lock ? lock.desc : desc.dataset.orig;
    }
    const meta = document.getElementById('map-meta-' + loc);
    if (meta && lock) meta.innerHTML = `<span class="map-meta-line">${lock.meta}</span>`;
    const slot = document.getElementById(MAP_TRAVEL_SLOTS[loc]);
    if (slot && lock && lock.ready) {
      slot.innerHTML = `<div class="map-travel-btns"><button class="map-travel-btn" onclick="event.stopPropagation(); startIlgradBreakthrough()">⚔ Прорваться</button></div>`;
    }
  });
}

// Прорыв к воротам (10 волн по 10) ещё не сделан.
function startIlgradBreakthrough() {
  if ((state.player.level || 1) < ILGRAD_MIN_LEVEL) return;
  showSoon('ПРОРЫВ', 'Нежить стоит у самых ворот, и пробиться к ним пока нельзя. Скоро.');
}

// Шапка города и какая сетка карточек видна.
const CITY_HEADERS = {
  town:   { title: 'АНДЕРВУД', subtitle: 'Последний оплот людей на краю земель' },
  ilgrad: { title: 'ИЛЬГРАД',  subtitle: 'Город людей в кольце нежити. Стены ещё держатся' },
};

function renderCityView() {
  const loc = state.player.currentLocation;
  if (!isTownLoc(loc)) return;
  const h = CITY_HEADERS[loc] || CITY_HEADERS.town;
  const t = document.getElementById('city-title');
  const s = document.getElementById('city-subtitle');
  if (t) t.textContent = h.title;
  if (s) s.textContent = h.subtitle;
  TOWN_LOCS.forEach(id => {
    const g = document.getElementById('city-grid-' + id);
    if (g) g.style.display = id === loc ? '' : 'none';
  });
  applyTownWindowTitles();
}

// Названия окон лавок в Ильграде. Андервудские берутся из разметки (data-orig).
const ILGRAD_WINDOW_TITLES = {
  '#trader-overlay .window-title':  '⚔ АРСЕНАЛ ИЛЬГРАДА',
  '#forge-overlay .window-title':   '⚒ КУЗНИЦА ИЛЬГРАДА',
  '#mentor-overlay .window-title':  '⚔ КАЗАРМЫ · НАВЫКИ',
  '#guild-overlay .window-title':   '🔮 БАШНЯ МАГОВ',
  '#tavern-overlay .window-title':  '🕯 ХРАМ · БЛАГОСЛОВЕНИЯ',
  '.storage-title':                 '📦 СКЛАД СНАБЖЕНИЯ',
  '.refine-title':                  '🔧 КУЗНИЦА · ПОДГОНКА',
  '.alchemist-title':               '⚗ ЛАЗАРЕТ · АЛХИМИЯ',
};

function applyTownWindowTitles() {
  const il = state.player.currentLocation === 'ilgrad';
  Object.keys(ILGRAD_WINDOW_TITLES).forEach(sel => {
    const el = document.querySelector(sel);
    if (!el) return;
    if (el.dataset.orig === undefined) el.dataset.orig = el.textContent;
    el.textContent = il ? ILGRAD_WINDOW_TITLES[sel] : el.dataset.orig;
  });
  // Жители Андервуда в Ильграде не стоят за прилавками — «Поговорить» прячем.
  document.querySelectorAll('.talk-btn[data-npc]').forEach(b => { b.style.display = il ? 'none' : ''; });
}

// ---- Места, у которых нет своей лавки ----

// Комендатура — поручения Ильграда появятся позже.
function openIlgradCommand() {
  if (state.player.currentLocation !== 'ilgrad') return;
  showSoon('КОМЕНДАТУРА', 'Над картой обороны склонились офицеры. Коменданту пока не до тебя — поручения Ильграда появятся позже.');
}

// Стена — выход на Окраины.
function openIlgradWatch() {
  if (state.player.currentLocation !== 'ilgrad') return;
  tryTravel('outskirts');
}

// Кузница — ковка и подгонка под одной крышей: выбор через окно места.
NPCS.ilgrad_forge = { id: 'ilgrad_forge', name: 'Кузница', fullName: 'Кузница Ильграда', icon: 'ilgrad_forge', dialogueStart: null };
NPC_SVG.ilgrad_forge = `<img src="img/city/ilgrad/forge.webp" alt="">`;
DIALOGUES.ilgrad_forge = {
  start: 'hello',
  nodes: {
    hello: {
      text: '*Горн гудит без передышки: город ест железо быстрее, чем его успевают ковать. У наковальни — очередь из стражников со щербатыми мечами.*',
      options: [
        { text: '⚒ Ковать', onSelect: () => openForge() },
        { text: '🔧 Подогнать снаряжение', onSelect: () => openRefine() },
        { text: 'Уйти', action: 'close' },
      ],
    },
  },
};
function openIlgradForge() {
  if (state.player.currentLocation !== 'ilgrad') return;
  openDialogue('ilgrad_forge');
}

// ---- Чит-меню: открыть / закрыть Ильград (для проверки, пока нет прорыва) ----
function cheatToggleIlgrad() {
  const p = state.player;
  p.ilgradOpen = !p.ilgradOpen;
  if (!p.ilgradOpen && (p.currentLocation === 'ilgrad' || p.currentLocation === 'outskirts')) {
    p.currentLocation = 'town';
    switchTab('hunt');
  }
  showToast('🏰', p.ilgradOpen ? 'Ильград открыт — путь на карте' : 'Ильград закрыт');
  updateMapUI();
  if (typeof renderCheatMenu === 'function') renderCheatMenu();
  saveCurrentSlot();
}
