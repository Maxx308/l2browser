// ========================================================
//  СИСТЕМЫ: КАРТОЧКИ МОНСТРОВ
//  Рендер карточек монстров для Поляны, Копей и Окраин — в одной из трёх раскладок (Ряд / Витрина / Плитки).
//  + Открытие статов по счётчику убийств.
//  + v0.33: шахты-заглушки в Копях убраны — на их месте Пещерный крылан (5 монстров в ряд).
//  + Титулы: 👑 Охотник / 👑 Прославленный / 🌟 Великолепный.
//  + PNG-иконки в дроп-листе.
//
//  НОВОЕ:
//  + В строке статов показываем урон, атаку, ФИЗ. ЗАЩИТУ,
//    МАГ. ЗАЩИТУ и УВОРОТ.
//  + Всё в одну строку (flex-wrap: wrap).
//  + pDef открывается вместе с atk (50 убийств).
//  + mDef открывается вместе с drop (150).
//  + evasion открывается вместе с gold (400).
//
//  НОВОЕ (v0.29):
//  + В углу портрета — следы лап: стайность монстра (1–3, battle-pack.js).
// ========================================================

// ---------- ГЛАВНАЯ ФУНКЦИЯ ----------
function renderMonsters() {
  const grid = document.getElementById('monsters-grid');
  if (!grid) return;
  closeHuntSheet();
  grid.innerHTML = '';
  grid.scrollLeft = 0;

  const loc = state.player.currentLocation;
  if (typeof renderSoulHuntBar === 'function') renderSoulHuntBar();   // v0.33: какие души искать

  let list = [];
  if (loc === 'field') list = MONSTERS;
  else if (loc === 'mine') list = MINE_MONSTERS;
  else if (loc === 'outskirts') list = OUTSKIRTS_MONSTERS;   // v0.36: Окраины Ильграда

  const layout = getHuntLayout();
  grid.className = 'monsters-grid ' + HUNT_LAYOUT_CLASS[layout] + (loc !== 'field' ? ' mine-grid' : '');
  renderHuntLayout(grid, list, loc !== 'field', layout);
}

// ========================================================
//  ТРИ РАСКЛАДКИ КАРТОЧЕК (выбор — Настройки → Экран → «Раскладка монстров»)
//  Сама карточка везде одна и та же (buildMonsterCard), меняется только расстановка.
//  У монстра три карточки подтипов и три закладки: Обычный · Древний · Кровавый
//  (порядок всегда один). Нажал закладку — карточка сменилась на месте, бой не начинается.
//  Нажал на карточку — бой. Выбор подтипа запоминается у героя: state.player.huntVariant.
//
//  row      «Ряд»     — компьютер: все карточки ровным рядом; телефон: лента миниатюр сверху,
//                       одна карточка по центру листается вбок, снизу кнопка «В бой».
//  showcase «Витрина» — компьютер: список тварей слева, выбранная крупно справа;
//                       телефон: список, нажал строку — карточка шторкой снизу.
//  tiles    «Плитки»  — компьютер: сетка 3×2 горизонтальных карточек;
//                       телефон: плитки-картинки 2×3, нажал — та же шторка.
//
//  Пока в локациях по 5 тварей, шестое место — заглушка «Скоро» (HUNT_SLOTS_PER_LOC):
//  сетки 6 → 3+3 → 2+2+2 получаются ровными. Заглушка — только картинка: в списки
//  монстров она не попадает, бой с ней не начать. Появится 6-я тварь — заглушка уйдёт сама.
//  Что листается и что шторка, решает monsters.css; здесь это читается из стилей.
// ========================================================
const HUNT_VARIANTS = ['normal', 'ancient', 'bloody'];
const HUNT_TAB_NAMES = { normal: 'Обычный', ancient: 'Древний', bloody: 'Кровавый' };
const HUNT_LAYOUTS = ['row', 'showcase', 'tiles'];
const HUNT_LAYOUT_NAMES = { row: 'Ряд', showcase: 'Витрина', tiles: 'Плитки' };
const HUNT_LAYOUT_CLASS = { row: 'slot-grid', showcase: 'hunt-showcase', tiles: 'hunt-tiles' };
const HUNT_LAYOUT_KEY = 'l2browser_hunt_layout';
const HUNT_SLOTS_PER_LOC = 6;
// slots — карточки текущей локации, current — выбранная (по центру ленты / в витрине),
// focus[локация] — id монстра, на котором остановились (после боя раскладка не прыгает в начало).
const HUNT_ROW = { slots: [], current: 0, focus: {} };

// ---------- Выбор раскладки (хранится на устройстве: на телефоне и компьютере можно разные) ----------
function getHuntLayout() {
  let v = null;
  try { v = localStorage.getItem(HUNT_LAYOUT_KEY); } catch (e) {}
  return HUNT_LAYOUTS.includes(v) ? v : 'row';
}

function setHuntLayout(v) {
  if (!HUNT_LAYOUTS.includes(v)) return;
  try { localStorage.setItem(HUNT_LAYOUT_KEY, v); } catch (e) {}
  renderHuntLayoutButtons();
  if (!isTownLoc(state.player.currentLocation)) renderMonsters();
}

function renderHuntLayoutButtons() {
  const box = document.getElementById('hunt-layout-buttons');
  if (!box) return;
  const cur = getHuntLayout();
  box.innerHTML = '';
  HUNT_LAYOUTS.forEach(v => {
    const btn = document.createElement('button');
    btn.className = 'settings-btn' + (v === cur ? ' active' : '');
    btn.textContent = HUNT_LAYOUT_NAMES[v];
    btn.onclick = () => setHuntLayout(v);
    box.appendChild(btn);
  });
}

function getHuntVariant(monsterId) {
  const v = state.player.huntVariant && state.player.huntVariant[monsterId];
  return HUNT_VARIANTS.includes(v) ? v : 'normal';
}

function setHuntVariant(monsterId, variantId) {
  if (!state.player.huntVariant || typeof state.player.huntVariant !== 'object') state.player.huntVariant = {};
  state.player.huntVariant[monsterId] = variantId;
}

// Ряд сейчас листается вбок (раскладка «Ряд» на телефоне) или все карточки видны сразу?
function isHuntRowScrolling() {
  const grid = document.getElementById('monsters-grid');
  return !!grid && grid.classList.contains('slot-grid') && getComputedStyle(grid).overflowX !== 'visible';
}

// Карточка открывается шторкой снизу («Витрина» и «Плитки» на телефоне)?
function isHuntSheetMode() {
  const stage = document.querySelector('#monsters-grid .hunt-stage');
  return !!stage && getComputedStyle(stage).position === 'fixed';
}

// Лента миниатюр (над рядом) и кнопка «В бой» (под рядом) создаются один раз.
function ensureHuntPart(id, tag, grid, before) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement(tag);
    el.id = id;
    el.className = id;
    if (tag === 'button') el.type = 'button';
    grid.parentNode.insertBefore(el, before ? grid : grid.nextSibling);
  }
  return el;
}

function renderHuntLayout(grid, list, fromMine, layout) {
  const strip = ensureHuntPart('hunt-strip', 'div', grid, true);
  const go = ensureHuntPart('hunt-go', 'button', grid, false);
  strip.innerHTML = '';
  const isRow = layout === 'row';
  strip.style.display = go.style.display = (isRow && list.length) ? '' : 'none';

  HUNT_ROW.slots = list.map(t => buildMonsterSlot(t, fromMine, layout));
  if (list.length) {
    for (let k = list.length; k < HUNT_SLOTS_PER_LOC; k++) HUNT_ROW.slots.push(buildStubSlot(layout));
  }

  if (isRow) {
    HUNT_ROW.slots.forEach(s => { grid.appendChild(s.el); strip.appendChild(s.pick); });
    grid.onscroll = onHuntRowScroll;
  } else {
    // «Витрина» и «Плитки»: выбор (список / плитки) + сцена с карточками (на телефоне — шторка)
    grid.onscroll = null;
    const pick = document.createElement('div');
    pick.className = 'hunt-pick';
    const stage = document.createElement('div');
    stage.className = 'hunt-stage';
    stage.setAttribute('role', 'dialog');
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'hunt-sheet-handle';
    handle.setAttribute('aria-label', 'Закрыть');
    handle.onclick = closeHuntSheet;
    stage.appendChild(handle);
    HUNT_ROW.slots.forEach(s => { pick.appendChild(s.pick); stage.appendChild(s.el); });
    const stageGo = document.createElement('button');
    stageGo.type = 'button';
    stageGo.className = 'hunt-stage-go';
    stageGo.onclick = () => fightHuntCurrent();
    stage.appendChild(stageGo);
    const bg = document.createElement('div');
    bg.className = 'hunt-sheet-bg';
    bg.onclick = closeHuntSheet;
    grid.appendChild(pick);
    grid.appendChild(stage);
    grid.appendChild(bg);
  }

  // С какой карточки начать: где остановились → последняя цель охоты → первая.
  const loc = state.player.currentLocation;
  const last = state.battle.lastTarget && state.battle.lastTarget.id;
  let start = HUNT_ROW.slots.findIndex(s => !s.stub && s.template.id === HUNT_ROW.focus[loc]);
  if (start < 0) start = HUNT_ROW.slots.findIndex(s => !s.stub && s.template.id === last);
  setHuntCurrent(Math.max(0, start));
  centerHuntSlot(HUNT_ROW.current, false);

  go.onclick = () => fightHuntCurrent();
}

function fightHuntCurrent() {
  const s = HUNT_ROW.slots[HUNT_ROW.current];
  if (!s) return;
  closeHuntSheet();
  s.fight();
}

// ---------- Шторка («Витрина» и «Плитки» на телефоне) ----------
function openHuntSheet() {
  const grid = document.getElementById('monsters-grid');
  if (!grid) return;
  // Нижние вкладки лежат выше всей страницы — шторка встаёт над ними, а не под ними.
  const tabs = document.querySelector('.tabs');
  grid.style.setProperty('--hunt-tabs-h', (tabs ? tabs.offsetHeight : 0) + 'px');
  grid.classList.add('sheet-open');
  document.body.classList.add('hunt-sheet-lock');
  const stage = grid.querySelector('.hunt-stage');
  if (stage) stage.scrollTop = 0;
}

function closeHuntSheet() {
  const grid = document.getElementById('monsters-grid');
  if (grid) grid.classList.remove('sheet-open');
  document.body.classList.remove('hunt-sheet-lock');
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeHuntSheet(); });

// Нажали на строку списка / плитку / миниатюру в ленте.
function onHuntPick(slot) {
  const i = HUNT_ROW.slots.indexOf(slot);
  if (i < 0) return;
  if (isHuntRowScrolling()) { centerHuntSlot(i, true); return; }
  setHuntCurrent(i);
  if (isHuntSheetMode()) openHuntSheet();
}

// Значок выбора монстра: миниатюра (Ряд), строка списка (Витрина) или плитка (Плитки).
function buildHuntPick(layout, stub) {
  const pick = document.createElement('button');
  pick.type = 'button';
  pick.className = (layout === 'row' ? 'hunt-thumb' : layout === 'showcase' ? 'hunt-prow' : 'hunt-tile') + (stub ? ' pick-stub' : '');
  return pick;
}

// Точки подтипов: выбранный закрашен, ещё не убитый ни разу — тусклый.
function huntPipsHtml(templateId, variantId) {
  return `<span class="hunt-pips">${HUNT_VARIANTS.map(v =>
    `<i class="pip-${v}${v === variantId ? ' on' : ''}${getMonsterKills(templateId, v) > 0 ? ' seen' : ''}" title="${HUNT_TAB_NAMES[v]}"></i>`).join('')}</span>`;
}

function updateHuntPick(slot) {
  const pick = slot.pick;
  const variantId = getHuntVariant(slot.template.id);
  const monster = buildMonsterInstance(slot.template, variantId);
  HUNT_VARIANTS.forEach(v => pick.classList.toggle(MONSTER_VARIANTS[v].cssClass, v === variantId));
  const art = `url('${monster.art}')`;
  if (slot.layout === 'row') {
    pick.style.backgroundImage = art;
    pick.innerHTML = `<span>${monster.level}</span>`;
  } else if (slot.layout === 'showcase') {
    const kills = getMonsterKills(slot.template.id, variantId);
    pick.innerHTML = `<span class="prow-art" style="background-image:${art}"></span>` +
      `<span class="prow-lvl">${monster.level}</span>` +
      `<span class="prow-text"><b>${slot.template.name}</b><small>${HUNT_TAB_NAMES[variantId]} · убито ${kills.toLocaleString('ru-RU')}</small></span>` +
      huntPipsHtml(slot.template.id, variantId);
  } else {
    pick.style.backgroundImage = art;
    pick.innerHTML = huntPipsHtml(slot.template.id, variantId) +
      `<span class="tile-label"><span class="tile-lvl">${monster.level}</span><span class="tile-name">${slot.template.name}</span></span>`;
  }
}

function buildMonsterSlot(template, fromMine, layout) {
  const el = document.createElement('div');
  el.className = 'monster-slot';
  el.dataset.id = template.id;

  const cardsBox = document.createElement('div');
  cardsBox.className = 'slot-cards';
  const tabsBox = document.createElement('div');
  tabsBox.className = 'slot-tabs';

  const pick = buildHuntPick(layout, false);
  pick.title = template.name;

  const slot = { el, pick, template, layout, cards: {}, tabs: {} };
  slot.fight = () => selectMonster(template, getHuntVariant(template.id), fromMine);

  HUNT_VARIANTS.forEach(v => {
    const card = buildMonsterCard(template, v, fromMine);
    const startFight = card.onclick;
    card.onclick = (e) => {
      const i = HUNT_ROW.slots.indexOf(slot);
      if (i !== HUNT_ROW.current) {
        // лента: соседняя карточка сначала подъезжает к центру, бой — со второго нажатия
        if (isHuntRowScrolling()) { centerHuntSlot(i, true); return; }
        setHuntCurrent(i);
      }
      closeHuntSheet();
      startFight(e);
    };
    slot.cards[v] = card;
    cardsBox.appendChild(card);

    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'slot-tab tab-' + v;
    const titleDef = MONSTER_TITLE_ICONS[getMonsterTitle(template.id, v)];   // титул виден и на закладке
    tab.innerHTML = (titleDef ? `<img src="img/tags/${titleDef.img}.webp" alt="" title="${titleDef.name}">` : '') +
      `<span>${HUNT_TAB_NAMES[v]}</span>`;
    tab.onclick = () => showSlotVariant(slot, v, true);
    slot.tabs[v] = tab;
    tabsBox.appendChild(tab);
  });

  pick.onclick = () => onHuntPick(slot);

  el.appendChild(cardsBox);
  el.appendChild(tabsBox);
  showSlotVariant(slot, getHuntVariant(template.id), false);
  return slot;
}

// Заглушка на месте будущей твари: та же рамка, картинки нет, нажать нельзя.
function buildStubSlot(layout) {
  const el = document.createElement('div');
  el.className = 'monster-slot slot-stub';
  const card = document.createElement('div');
  card.className = 'monster-card variant-normal monster-stub slot-front';
  card.innerHTML = `
    <div class="monster-portrait-img stub-art"><span>?</span></div>
    <div class="monster-head"><span class="monster-lvl">?</span><div class="monster-name">Скоро</div></div>
    <div class="stub-text">Здесь появится новая тварь</div>`;
  const cardsBox = document.createElement('div');
  cardsBox.className = 'slot-cards';
  cardsBox.appendChild(card);
  const tabsBox = document.createElement('div');
  tabsBox.className = 'slot-tabs';
  HUNT_VARIANTS.forEach(v => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'slot-tab tab-' + v;
    tab.disabled = true;
    tab.innerHTML = `<span>${HUNT_TAB_NAMES[v]}</span>`;
    tabsBox.appendChild(tab);
  });
  el.appendChild(cardsBox);
  el.appendChild(tabsBox);

  const pick = buildHuntPick(layout, true);
  pick.title = 'Скоро здесь появится новая тварь';
  if (layout === 'row') pick.innerHTML = '<span>?</span>';
  else if (layout === 'showcase') pick.innerHTML = '<span class="prow-art"></span><span class="prow-lvl">?</span><span class="prow-text"><b>Скоро</b><small>Новая тварь ещё не пришла</small></span>';
  else pick.innerHTML = '<span class="tile-label"><span class="tile-lvl">?</span><span class="tile-name">Скоро</span></span>';

  const slot = { el, pick, layout, stub: true, template: { id: '__stub', name: 'Новая тварь' } };
  slot.fight = () => { if (typeof showToast === 'function') showToast('❔', 'Скоро здесь появится новая тварь'); };
  pick.onclick = () => onHuntPick(slot);
  card.onclick = () => slot.fight();
  return slot;
}

// Показать подтип в карточке. byPlayer — игрок нажал закладку (запомнить выбор, показать разницу статов).
function showSlotVariant(slot, variantId, byPlayer) {
  const id = slot.template.id;
  const prev = getHuntVariant(id);
  if (byPlayer) setHuntVariant(id, variantId);

  HUNT_VARIANTS.forEach(v => {
    slot.cards[v].classList.toggle('slot-front', v === variantId);
    slot.cards[v].classList.remove('slot-flip');
    slot.tabs[v].classList.toggle('active', v === variantId);
    slot.tabs[v].setAttribute('aria-pressed', String(v === variantId));
  });
  updateHuntPick(slot);

  if (!byPlayer) return;
  if (typeof hideTooltip === 'function') hideTooltip();
  if (prev !== variantId) {
    slot.cards[variantId].classList.add('slot-flip');   // новая карточка проявляется поверх старой
    showVariantDeltas(slot.cards[prev], slot.cards[variantId]);
  }
  updateHuntGoButton();
}

// Выбранная карточка: подсветить её значок, подписать кнопку «В бой».
function setHuntCurrent(i) {
  HUNT_ROW.current = i;
  HUNT_ROW.slots.forEach((s, k) => {
    s.el.classList.toggle('slot-current', k === i);
    s.pick.classList.toggle('active', k === i);
  });
  const s = HUNT_ROW.slots[i];
  if (s && !s.stub) HUNT_ROW.focus[state.player.currentLocation] = s.template.id;
  updateHuntGoButton();
}

function updateHuntGoButton() {
  const s = HUNT_ROW.slots[HUNT_ROW.current];
  if (!s) return;
  const html = s.stub
    ? '<span>Скоро здесь появится новая тварь</span>'
    : `<span class="hunt-go-ico">⚔</span><span>В бой · ${buildMonsterInstance(s.template, getHuntVariant(s.template.id)).name}</span>`;
  document.querySelectorAll('#hunt-go, #monsters-grid .hunt-stage-go').forEach(b => {
    b.innerHTML = html;
    b.disabled = !!s.stub;
  });
}

// Подвезти карточку к центру ленты (если ряд не листается — ничего не делаем).
function centerHuntSlot(i, smooth) {
  const grid = document.getElementById('monsters-grid');
  const s = HUNT_ROW.slots[i];
  if (!grid || !s || !isHuntRowScrolling()) return;
  const g = grid.getBoundingClientRect();
  const r = s.el.getBoundingClientRect();
  const left = grid.scrollLeft + (r.left + r.width / 2) - (g.left + g.width / 2);
  if (Math.abs(left - grid.scrollLeft) < 1) return;   // уже по центру
  grid.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
}

// Ленту пролистали — выбранной становится карточка, которая ближе всех к центру.
let huntRowRaf = 0;
let huntRowScrolledAt = 0;
function onHuntRowScroll() {
  huntRowScrolledAt = performance.now();
  cancelAnimationFrame(huntRowRaf);
  huntRowRaf = requestAnimationFrame(() => {
    const grid = document.getElementById('monsters-grid');
    if (!grid || !isHuntRowScrolling()) return;
    const g = grid.getBoundingClientRect();
    const mid = g.left + g.width / 2;
    let best = 0, bestDist = Infinity;
    HUNT_ROW.slots.forEach((s, k) => {
      const r = s.el.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - mid);
      if (d < bestDist) { bestDist = d; best = k; }
    });
    if (best !== HUNT_ROW.current) setHuntCurrent(best);
  });
}

// Повернули телефон или изменили окно — выбранная карточка возвращается в центр,
// а если окно стало широким — шторка закрывается (на компьютере её нет).
// На телефоне resize приходит и когда прячется адресная строка: если карточка уже по центру,
// centerHuntSlot ничего не делает, а пока ленту листают пальцем — не вмешиваемся.
window.addEventListener('resize', () => {
  if (!isHuntSheetMode()) closeHuntSheet();
  if (performance.now() - huntRowScrolledAt < 200) return;
  centerHuntSlot(HUNT_ROW.current, false);
});

// v0.34.1: над статами — насколько монстр стал сильнее (+N зелёным) или слабее (−N красным):
// здоровье, атака, защита, маг. защита. Только для статов, открытых на ОБЕИХ карточках, —
// иначе подсказка выдала бы закрытое значение.
function showVariantDeltas(fromCard, toCard) {
  if (!fromCard || !toCard) return;
  toCard.querySelectorAll('.monster-stat[data-val]').forEach(el => {
    const from = fromCard.querySelector(`.monster-stat[data-stat="${el.dataset.stat}"][data-val]`);
    if (!from) return;
    const diff = Number(el.dataset.val) - Number(from.dataset.val);
    if (!diff) return;
    el.querySelectorAll('.stat-delta').forEach(d => d.remove());
    const d = document.createElement('span');
    d.className = 'stat-delta ' + (diff > 0 ? 'up' : 'down');
    d.textContent = (diff > 0 ? '+' : '−') + Math.abs(diff).toLocaleString('ru-RU');
    el.appendChild(d);
    el.classList.remove('stat-flash');
    void el.offsetWidth;
    el.classList.add('stat-flash');
    setTimeout(() => { d.remove(); el.classList.remove('stat-flash'); }, 1900);
  });
}

// ---------- ХЕЛПЕР: HTML ДЛЯ ИКОНКИ ДРОПА ----------
function getDropIconHtml(d) {
  if (typeof d.icon === 'string' && d.icon.startsWith('img/')) {
    return `<img src="${d.icon}" alt="" class="drop-icon-img">`;
  }
  if (typeof d.icon === 'string' && d.icon.includes('<svg')) {
    return d.icon;
  }
  if (d.iconKey && typeof SVG !== 'undefined' && SVG[d.iconKey]) {
    return SVG[d.iconKey];
  }
  return '';
}

// v0.36: значки карточки (img/tags). Новый шаблон: уровень в круге, череп со счётом, статы значками, титул в углу.
const MONSTER_STAT_ICONS = {
  hp:   { img: 'stat_hp',   name: 'Здоровье' },
  hpShield: { img: 'stat_hp_shield', name: 'Здоровье под щитом маны: половина урона уходит в ману, пока она есть' },
  atk:  { img: 'stat_atk',  name: 'Атака' },
  pDef: { img: 'stat_pdef', name: 'Физическая защита' },
  mDef: { img: 'stat_mdef', name: 'Магическая защита' },
  eva:  { img: 'stat_eva',  name: 'Уворот' },
};
const MONSTER_TITLE_ICONS = {
  hunter:      { img: 'hunter',      css: 'hunter',      name: 'Охотник' },
  glorious:    { img: 'glorious',    css: 'glorious',    name: 'Прославленный охотник' },
  magnificent: { img: 'magnificent', css: 'magnificent', name: 'Великолепный охотник' },
};
// Пороги, на которых о твари открывается новое (KILL_THRESHOLDS): атака, добыча, Оболы, титул.
const KILL_REVEAL_STEPS = [KILL_THRESHOLDS.atk, KILL_THRESHOLDS.drop, KILL_THRESHOLDS.gold, KILL_THRESHOLDS.title];

// ---------- КАРТОЧКА МОНСТРА ----------
function buildMonsterCard(template, variantId, fromMine = false) {
  const monster = buildMonsterInstance(template, variantId);
  const variant = MONSTER_VARIANTS[variantId];

  const card = document.createElement('div');
  card.className = 'monster-card ' + variant.cssClass +
    (monster.attackType === 'magic' ? ' magic-type' : '');
  card.dataset.id = template.id;
  card.dataset.variant = variantId;
  card.onclick = () => selectMonster(template, variantId, fromMine);

  const kills = getMonsterKills(template.id, variantId);
  const unlockedHp    = isStatUnlocked(template.id, variantId, 'hp');
  const unlockedAtk   = isStatUnlocked(template.id, variantId, 'atk');
  const unlockedDrop  = isStatUnlocked(template.id, variantId, 'drop');
  const unlockedGold  = isStatUnlocked(template.id, variantId, 'gold');

  // Пороги: pDef → atk, mDef → drop, evasion → gold.
  const unlockedPDef   = unlockedAtk;
  const unlockedMDef   = unlockedDrop;
  const unlockedEvasion = unlockedGold;

  const goldStr = unlockedGold ? `${monster.goldMin}–${monster.goldMax}` : '???';
  const goldChanceStr = unlockedGold ? `${monster.goldChance}%` : '???%';

  let dropRows = `<div class="row">${SVG.gold}<span>Оболы: ${goldStr}</span><span class="chance ${unlockedGold ? '' : 'chance-hidden'}">${goldChanceStr}</span></div>`;

  monster.drops.forEach(d => {
    const chanceStr = unlockedDrop ? `${d.chance}%` : '???%';
    const iconHtml = getDropIconHtml(d);
    dropRows += `<div class="row">${iconHtml}<span>${d.name}</span><span class="chance ${unlockedDrop ? '' : 'chance-hidden'}">${chanceStr}</span></div>`;
  });

  // ---- СТАТЫ: значок сверху, число снизу ----
  // data-stat / data-val — для подсказки «+N / −N» при смене подтипа в стопке (только у открытых статов).
  // HP видно сразу (v0.34.1). Пороги: атака и физ. защита 50, маг. защита 150, уворот 400.
  const statHtml = (key, open, val, dataStat) => {
    const def = MONSTER_STAT_ICONS[key];
    const icon = `<img class="stat-ico" src="img/tags/${def.img}.webp" alt="${def.name}" title="${def.name}">`;
    const data = dataStat ? ` data-stat="${dataStat}"` : '';
    return open
      ? `<span class="monster-stat"${data}${dataStat ? ` data-val="${val}"` : ''}>${icon}<b>${val}</b></span>`
      : `<span class="monster-stat stat-hidden"${data}>${icon}<b>???</b></span>`;
  };
  const evasionValue = (typeof getMonsterEvasion === 'function') ? getMonsterEvasion(monster) : 0;
  const statsHtml = `<div class="monster-stats">${[
    statHtml(monster.maxMp > 0 ? 'hpShield' : 'hp', true, monster.maxHp, 'hp'),
    statHtml('atk', unlockedAtk, monster.atk, 'atk'),
    statHtml('pDef', unlockedPDef, monster.pDef || 0, 'pDef'),
    statHtml('mDef', unlockedMDef, monster.mDef || 0, 'mDef'),
    statHtml('eva', unlockedEvasion, evasionValue, null),
  ].join('')}</div>`;

  // ---- ТИТУЛ: значок в левом нижнем углу, виден и на задних карточках стопки ----
  const titleDef = MONSTER_TITLE_ICONS[getMonsterTitle(template.id, variantId)];
  const titleHtml = titleDef ? `<div class="monster-hunter ${titleDef.css}" title="${titleDef.name}"><img src="img/tags/${titleDef.img}.webp" alt="${titleDef.name}"></div>` : '';

  // ---- Счётчик: череп и «убито / до следующего открытия» ----
  const nextGoal = KILL_REVEAL_STEPS.find(n => kills < n);
  const killsText = nextGoal ? `${kills}/${nextGoal}` : `${kills}`;
  // Строка под именем — только если есть что показать: подтип и «их время».
  const metaHtml = (variant.name ? `<span class="monster-variant-word">${variant.name}</span>` : '') +
    (typeof primeTimeLineHtml === 'function' ? primeTimeLineHtml(template) : '');
  const killsHtml = `<div class="monster-kills" title="Убито. Следующая цифра — сколько нужно, чтобы узнать о твари больше"><img class="kills-ico" src="img/tags/kills.webp" alt=""><span>${killsText}</span></div>`;

  card.innerHTML = `
    <div class="monster-portrait-img" style="background-image:url('${monster.art}')">${packBadgeHtml(template)}${monsterTagsHtml(monster)}</div>
    <div class="monster-head">
      <span class="monster-lvl" title="Уровень ${monster.level}">${monster.level}</span>
      <div class="monster-name">${template.name}</div>
    </div>
    ${metaHtml ? `<div class="monster-meta">${metaHtml}</div>` : ''}
    ${monsterKitLineHtml(monster)}
    ${statsHtml}
    <div class="drop-list">${dropRows}</div>
    ${titleHtml}
    ${killsHtml}
  `;
  return card;
}

// ---------- СЧЁТЧИК УБИЙСТВ В ШАПКЕ БОЯ ----------
function updateBattleKillsCounter(m) {
  const el = document.getElementById('battle-kills');
  if (!el || !m) return;
  const kills = getMonsterKills(m.id, m.variantId);
  el.textContent = `💀 Убито: ${kills}`;
}
