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
    card.classList.toggle('map-fallen', loc === 'town' && !!state.player.underwoodFallen);

    // Примета 19 уровня: по карточке Андервуда идёт трещина.
    if (loc === 'town') {
      const cracked = !!window.FALL_LINES && (state.player.level || 1) >= 19 && !state.player.underwoodFallen;
      let crack = card.querySelector(':scope > .map-crack');
      if (cracked && !crack) {
        card.insertAdjacentHTML('afterbegin', '<svg class="map-crack" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path vector-effect="non-scaling-stroke" d="M62 0 L58 14 L66 26 L55 38 L60 52 L48 63 L52 78 L44 100 M60 52 L71 60 L77 74 M55 38 L44 34"/></svg>');
      } else if (!cracked && crack) {
        crack.remove();
      }
    }

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

// Сам прорыв начинается после Собрания у Старейшины (js/systems/underwood-fall.js).
function startIlgradBreakthrough() {
  if ((state.player.level || 1) < ILGRAD_MIN_LEVEL) return;
  showSoon('ПРОРЫВ', window.FALL_LINES
    ? 'Одному к воротам не пробиться. Старейшина собирает всех в Андервуде: поговори с ним.'
    : 'Нежить стоит у самых ворот, и пробиться к ним пока нельзя. Скоро.');
}

// Шапка города и какая сетка карточек видна.
const CITY_HEADERS = {
  town:   { title: 'АНДЕРВУД', subtitle: 'Последний оплот живых на краю земель' },
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
  '#mentor-overlay .window-title':  '🕯 ХРАМ · ТАИНСТВО',   // v0.37: навыки — в Храме (решение пользователя 16.11)
  '#guild-overlay .window-title':   '🔮 БАШНЯ МАГОВ',
  '#tavern-overlay .window-title':  () => ILGRAD_TAVERN_PLACES[__ilgradTavernPlace].title,   // Храм или Казармы
  '.storage-title':                 '📦 СКЛАД СНАБЖЕНИЯ',
  '.refine-title':                  '🔧 КУЗНИЦА · ПОДГОНКА',
  '.alchemist-title':               '⚗ ЛАЗАРЕТ · АЛХИМИЯ',
};

const ILGRAD_SURVIVORS = ['smith', 'refiner', 'guildmage', 'keeper'];
// Лавка Андервуда → кто стоит за этим прилавком в Ильграде (тексты — js/data/fall-lines.js).
// v0.37: окно навыков (mentor) — в Храме у Исмеры; окно бафов (hostess) — Храм или Казармы (Таэлин).
const ILGRAD_OWNERS = {
  trader: 'garsha', mentor: 'ismera', alchemist: 'averyan',
  hostess: () => ILGRAD_TAVERN_PLACES[__ilgradTavernPlace].owner,
};
function ilgradOwnerOf(npcId) {
  const v = ILGRAD_OWNERS[npcId];
  return typeof v === 'function' ? v() : v;
}

function applyTownWindowTitles() {
  const il = state.player.currentLocation === 'ilgrad';
  Object.keys(ILGRAD_WINDOW_TITLES).forEach(sel => {
    const el = document.querySelector(sel);
    if (!el) return;
    if (el.dataset.orig === undefined) el.dataset.orig = el.textContent;
    const t = ILGRAD_WINDOW_TITLES[sel];
    el.textContent = il ? (typeof t === 'function' ? t() : t) : el.dataset.orig;
  });
  // В Ильграде за прилавками те, кто дошёл с обозом, и новые владельцы.
  const here = id => !il || (state.player.underwoodFallen && (ILGRAD_SURVIVORS.includes(id) || OWNER_CHATS[ilgradOwnerOf(id)]));
  document.querySelectorAll('.talk-btn[data-npc]').forEach(b => {
    b.style.display = here(b.dataset.npc) ? '' : 'none';
    // v0.37: подсказка на кнопке — с кем говорим (в Ильграде за прилавком может быть другой житель)
    if (b.dataset.origTitle === undefined) b.dataset.origTitle = b.title;
    const who = il && typeof ownerHere === 'function' ? NPCS[ownerHere(b.dataset.npc)] : null;
    b.title = who ? `Поговорить: ${who.name}` : b.dataset.origTitle;
  });
}

// ---- Места, у которых нет своей лавки ----

// Комендатура — поручения Ильграда появятся позже.
function openIlgradCommand() {
  if (state.player.currentLocation !== 'ilgrad') return;
  if (state.player.underwoodFallen && OWNER_CHATS.commander) { talkToOwner('commander'); return; }
  showSoon('КОМЕНДАТУРА', 'Над картой обороны склонились офицеры. Коменданту пока не до тебя — поручения Ильграда появятся позже.');
}

// ---- v0.37: Казармы и Храм (решение пользователя 16.11) ----
// Казармы — муштра у Таэлина (бывший «Расслабон»).
function openIlgradBarracks() {
  if (state.player.currentLocation !== 'ilgrad') return;
  __ilgradTavernPlace = 'barracks';
  openTavern();
  applyTownWindowTitles();
}
// Храм — благословение (бывший «Отдых») и таинство: прокачка навыков, позже — подклассы.
// Почему в храме «лучше учится», в игре не объясняем (там то, что держит барьер; знают ли горожане — не решено).
NPCS.ilgrad_temple = { id: 'ilgrad_temple', name: 'Храм', fullName: 'Храм Ильграда', icon: 'ilgrad_temple', dialogueStart: null };
NPC_SVG.ilgrad_temple = `<img src="img/city/ilgrad/temple.webp" alt="">`;
DIALOGUES.ilgrad_temple = {
  start: 'hello',
  nodes: {
    hello: {
      text: '*Под сводами тихо, свечи горят ровно, без копоти. Безликая статуя в глубине кажется ближе, чем есть. Камень пола тёплый — в городе, где холодно всё.*',
      options: [
        { text: '🕯 Благословение', onSelect: () => { __ilgradTavernPlace = 'temple'; openTavern(); applyTownWindowTitles(); } },
        { text: '✦ Таинство (навыки)', onSelect: () => { openMentor(); applyTownWindowTitles(); } },
        { text: '✦ Посвящение (путь)', onSelect: () => openSubclassTemple() },   // v0.38: подклассы с 25 ур.
        { text: 'Уйти', action: 'close' },
      ],
    },
  },
};
function openIlgradTemple() {
  if (state.player.currentLocation !== 'ilgrad') return;
  openDialogue('ilgrad_temple');
}

// Стена — выход на Окраины. v0.37: карточку в городе убрали (на Окраины — через карту), функция осталась про запас.
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
  if (!p.ilgradOpen) p.underwoodFallen = false;   // в закрытый город возвращаться некуда
  if (!p.ilgradOpen && (p.currentLocation === 'ilgrad' || p.currentLocation === 'outskirts')) {
    p.currentLocation = 'town';
    switchTab('hunt');
  }
  showToast('🏰', p.ilgradOpen ? 'Ильград открыт — путь на карте' : 'Ильград закрыт');
  checkLevelUp();   // потолок уровня зависит от Ильграда: 20 или 30
  updateTopStatus();
  updateCharacterPanel();
  updateMapUI();
  if (typeof renderCheatMenu === 'function') renderCheatMenu();
  saveCurrentSlot();
}
