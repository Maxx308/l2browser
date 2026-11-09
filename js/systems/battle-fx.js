// ========================================================
//  СИСТЕМЫ: БОЙ — АРЕНА И ВИЗУАЛЬНЫЕ ЭФФЕКТЫ (v0.17)
//
//  Что делает:
//  + Рисует арену: фон локации, карточку героя, карточки ВСЕХ
//    мобов группы (цель крупнее, мёртвые гаснут), кольца ATB.
//  + Показывает удары: рывки, вспышки, цифры урона, разрезы,
//    снаряды навыков, тряску на критах, смерть мобов, добычу,
//    баннер победы, эффект нового уровня.
//
//  ВАЖНО: файл НЕ меняет боевую логику.
//  Он только «оборачивает» существующие функции (playerAttack,
//  monsterAttack, onMonsterDeath, spawnFloatDamage и т.д.):
//  сначала вызывает оригинал, потом рисует эффект.
//  Если удалить этот файл и battle-arena.css — бой работает как раньше
//  (кроме внешнего вида).
//
//  Подключать ПОСЛЕ всех battle-*.js (в т.ч. battle-pack.js), ДО main.js.
//
//  v0.29: подкрепления стаи — силуэт «?» на подходе (packIncoming)
//  и новые карточки дописываются в ряд без перестройки (bxSyncPack).
//
//  v0.19: события могут нести свою цель и эффект (opts.mon / opts.fx / opts.text) —
//  так массовые навыки рисуют удар по каждому мобу отдельно.
// ========================================================

const BX = {
  ctx: null,              // текущее действие (удар игрока / монстра / тик)
  cards: new Map(),       // объект моба → { unit, card, pic, fill, ghost, text, status, ... }
  groupRef: null,         // массив state.battle.monsters, по которому построены карточки
  battleStart: null,      // { gold, xp } в начале боя — для баннера победы
  collectLoot: null,      // массив, куда во время onMonsterDeath падает добыча
  lootCount: 0,           // сколько предметов прилетело в «Добычу» за этот заход
  bgLoc: null,            // текущий фон сцены
  heroName: null,
};

// Кадрирование портретов, у которых по краям лишние полосы.
const BX_ART_CROP = {
  wolf: { size: '125%', pos: '30% 80%' },
  frog: { size: '118%', pos: '50% 100%' },
};

// Фон сцены по локации.
const BX_LOCATION_BG = {
  field: 'img/locations/field.jpg',   // v0.20: свой фон Поляны
  mine:  'img/monsters/ore.jpg',
  outskirts: 'img/locations/outskirts.jpg',   // v0.36
  town:  'img/start-bg.jpg',
};

// --------------------------------------------------------
//  ПОМОЩНИКИ
// --------------------------------------------------------
function bxOn() {
  const w = document.getElementById('battle-window');
  // v0.23: окно боя спрятано (открыт инвентарь) — эффекты не рисуем
  return !!(w && w.classList.contains('active')) && !document.hidden && !document.body.classList.contains('bx-peek');
}
function bxStage() { return document.getElementById('bx-stage'); }
function bxLayer() { return document.getElementById('bx-fx'); }
function bxHeroCard() { return document.getElementById('bx-hero-card'); }
function bxMonCard(m) { const c = m && BX.cards.get(m); return c ? c.card : null; }

function bxCenter(el) {
  const st = bxStage();
  if (!st || !el) return { x: 0, y: 0 };
  const s = st.getBoundingClientRect(), r = el.getBoundingClientRect();
  return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 };
}
function bxAdd(cls, x, y, html, style, life) {
  const fx = bxLayer();
  if (!fx) return null;
  if (fx.childElementCount > 90 && !/bx-num/.test(cls)) return null; // защита от перегруза
  const d = document.createElement('div');
  d.className = cls;
  d.style.cssText = `left:${x}px;top:${y}px;${style || ''}`;
  if (html) d.innerHTML = html;
  fx.appendChild(d);
  setTimeout(() => d.remove(), life || 1600);
  return d;
}
function bxRetrig(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  clearTimeout(el['__bx_' + cls]);
  el['__bx_' + cls] = setTimeout(() => el.classList.remove(cls), 1500);
}
function bxShake() { bxRetrig(bxStage(), 'bx-shake'); }
function bxSparks(x, y, color, n) {
  for (let i = 0; i < (n || 10); i++) {
    const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 60;
    bxAdd('bx-spark', x, y, '', `--c:${color};--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r}px`, 800);
  }
}
function bxNum(el, html, cls) {
  if (!el) return;
  const c = bxCenter(el);
  bxAdd('bx-num ' + (cls || ''), c.x + (Math.random() * 48 - 24), c.y - 20, html, '', 1400);
}
// --------------------------------------------------------
//  v0.30: КАРТИНКИ ЭФФЕКТОВ (img/fx, опись — img/fx/ОПИСЬ.txt)
//  Вместо нарисованных стилями разрезов/вспышек — картинка поверх карточки цели.
//  Цифры урона, искры, тряска на крите — как были.
// --------------------------------------------------------
const BX_FX_DIR = 'img/fx/';
// Обычный удар героя — по оружию в руках.
const BX_WEAPON_IMG = { swords: 'b_12', axes: 'c_47', maces: 'b_14', daggers: 'b_42', spears: 'c_15', bows: 'b_25', crossbows: 'b_27', staves: 'b_24' };
const BX_UNARMED_IMG = 'c_34';
// Удар монстра — по виду.
const BX_MONSTER_IMG = { silkworm: 'c_11', ent: 'b_54', bandit: 'c_16', frog: 'b_16', wolf: 'b_11', goblin: 'c_12', kobold: 'b_28', arachnid: 'c_46', golem: 'c_56' };
const BX_MONSTER_IMG_PHYS = 'c_34', BX_MONSTER_IMG_MAGIC = 'b_32';
// События массовых навыков (ev.fx) → попадание.
const BX_EVENT_IMG = {
  'slash': 'c_26', 'slash-red': 'a_12', 'slash-green': 'b_54', 'slash-blue': 'b_31',
  'proj:fire': 'b_35', 'proj:ice': 'b_36', 'proj:arcane': 'b_24', 'proj:life': 'c_24',
  'bolt': 'b_18', 'ice': 'b_41', 'blizzard': 'c_45', 'toxic': 'b_43', 'rune': 'a_44',
};
// Снаряды-картинки. На всех картинках голова снаряда смотрит влево-вниз (135°) — доворачиваем к цели.
const BX_PROJ_IMG = { fire: 'c_22', ice: 'c_23', dark: 'c_27', arrow: 'c_21', toxic: 'c_24' };
const BX_PROJ_IMG_HEADING = 135;
const BX_HEAL_IMG = 'c_36';

function bxFxSrc(key) { return BX_FX_DIR + key + '.png'; }

// Картинка попадания поверх карточки: вспыхнула, чуть выросла, погасла.
// opts: k — размер от карточки, rot — поворот (иначе случайный ±12°), flip — зеркально.
function bxFxImg(cardEl, key, opts) {
  if (!cardEl || !key) return;
  const o = opts || {};
  const c = bxCenter(cardEl);
  const r = cardEl.getBoundingClientRect();
  const s = Math.round(Math.min(r.width, r.height || r.width) * (o.k || 1.05));
  const rot = o.rot !== undefined ? o.rot : Math.round(Math.random() * 24 - 12);
  bxAdd('bx-img', c.x, c.y, `<img src="${bxFxSrc(key)}" alt="">`, `width:${s}px;height:${s}px;--r:${rot}deg;--sx:${o.flip ? -1 : 1}`, 650);
}

// Подгрузить заранее — чтобы первая вспышка не мигнула пустым местом.
const BX_FX_PRELOADED = [];
function bxPreloadFx() {
  const keys = new Set([...Object.values(BX_WEAPON_IMG), ...Object.values(BX_MONSTER_IMG), ...Object.values(BX_EVENT_IMG),
    ...Object.values(BX_PROJ_IMG), BX_UNARMED_IMG, BX_MONSTER_IMG_PHYS, BX_MONSTER_IMG_MAGIC, BX_HEAL_IMG,
    'b_53', 'b_55', 'b_45', 'c_38']);
  keys.forEach(k => { const im = new Image(); im.src = bxFxSrc(k); BX_FX_PRELOADED.push(im); });
}
bxPreloadFx();

function bxProjectile(kind, fromEl, toEl, ms) {
  return new Promise(resolve => {
    const a = bxCenter(fromEl), b = bxCenter(toEl);
    const pi = BX_PROJ_IMG[kind];
    const d = pi
      ? bxAdd('bx-proj img', a.x, a.y, `<img src="${bxFxSrc(pi)}" alt="" style="transform:rotate(${-BX_PROJ_IMG_HEADING}deg)">`, '', ms + 200)
      : bxAdd('bx-proj ' + kind, a.x, a.y, '', '', ms + 200);
    if (!d || typeof d.animate !== 'function') { setTimeout(resolve, ms); return; }
    const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    const dx = b.x - a.x, dy = b.y - a.y;
    const anim = d.animate([
      { transform: `translate(0,0) rotate(${ang}deg) scale(.6)` },
      { transform: `translate(${dx * .5}px,${dy * .5 - 36}px) rotate(${ang}deg) scale(1)`, offset: .5 },
      { transform: `translate(${dx}px,${dy}px) rotate(${ang}deg) scale(1.1)` },
    ], { duration: ms, easing: 'ease-in' });
    anim.onfinish = () => { d.remove(); resolve(); };
  });
}
function bxTotalXp() {
  const p = state.player;
  const base = (typeof getTotalXpForLevel === 'function') ? getTotalXpForLevel(p.level) : 0;
  return base + (isFinite(p.xp) ? p.xp : 0);
}

// --------------------------------------------------------
//  СЦЕНА: ФОН, ГЕРОЙ, МОБЫ
// --------------------------------------------------------
function bxUpdateStageBg() {
  const st = bxStage();
  if (!st) return;
  const loc = state.battle.breakthrough ? 'outskirts' : ((state.player && state.player.currentLocation) || 'field');   // v0.36: своего фона у прорыва пока нет
  if (BX.bgLoc === loc) return;
  BX.bgLoc = loc;
  st.dataset.loc = loc;
  const bg = document.getElementById('bx-bg');
  if (bg) bg.style.backgroundImage = `url('${BX_LOCATION_BG[loc] || BX_LOCATION_BG.field}')`;
}

function bxBuildEnemies(group) {
  const row = document.getElementById('bx-enemy-row');
  if (!row) return;
  BX.groupRef = group;
  BX.cards.clear();
  row.innerHTML = '';
  row.dataset.n = String(group.length);

  BX.packLabelN = 0;
  BX.lurkers = [];
  bxUpdatePackLabel();

  // v0.23: «колода» павших — мёртвые враги складываются в одну стопку
  const deck = document.createElement('div');
  deck.className = 'bx-deck';
  deck.id = 'bx-deck';
  deck.innerHTML = `<div class="bx-deck-stack"></div><div class="bx-deck-count"></div>`;
  BX.deck = deck;

  group.forEach((m, i) => bxAddEnemyCard(row, m, i * 0.06));   // v0.26: стая проявляется за ~0.7 с
  row.appendChild(deck);

  if (!document.hidden) bxRetrig(document.getElementById('bx-fog'), 'bx-on');
}

// «Стая ×N» над рядом врагов (N — сколько всего было в бою, вместе с подмогой).
function bxUpdatePackLabel() {
  const n = (BX.groupRef || []).length;
  if (n === BX.packLabelN) return;
  BX.packLabelN = n;
  const label = document.getElementById('bx-pack-name');
  if (label) label.textContent = n > 1 ? `Стая ×${n}` : 'Противник';
}

// Сколько места занимает ряд: карточки + силуэты + колода.
function bxUpdateRowSize() {
  const row = document.getElementById('bx-enemy-row');
  if (!row) return;
  const inRow = [...row.children].filter(u => u.classList.contains('bx-enemy')).length;
  const deckN = BX.deck ? BX.deck.querySelector('.bx-deck-stack').children.length : 0;
  row.dataset.n = String(Math.max(1, inRow + (deckN > 0 ? 1 : 0)));
}

// v0.29: подкрепления. Новые мобы → карточка в ряд; «на подходе» → силуэты «?».
function bxSyncPack(group) {
  const row = document.getElementById('bx-enemy-row');
  if (!row || group !== BX.groupRef) return;
  let changed = false;

  const want = Math.max(0, state.battle.packIncoming || 0);
  while (BX.lurkers.length > want) { BX.lurkers.pop().remove(); changed = true; }
  while (BX.lurkers.length < want) {
    const lurk = document.createElement('div');
    lurk.className = 'bx-unit bx-enemy bx-lurker bx-spawn';
    lurk.title = 'Кто-то приближается — появится в следующий ход стаи';
    lurk.innerHTML = `
      <div class="bx-card"><div class="bx-pic"></div><div class="bx-lurker-mark">?</div></div>
      <div class="fighter-name">Шорох…</div>
      <div class="bx-bars"><div class="bar bx-bar hp"></div></div>`;
    row.insertBefore(lurk, BX.deck && BX.deck.parentNode === row ? BX.deck : null);
    setTimeout(() => lurk.classList.remove('bx-spawn'), 500);
    BX.lurkers.push(lurk);
    changed = true;
  }

  let k = 0;
  group.forEach(m => {
    if (BX.cards.has(m)) return;
    bxAddEnemyCard(row, m, k++ * 0.12);
    changed = true;
  });

  if (changed) { bxUpdateRowSize(); bxUpdatePackLabel(); }
}

// Карточка одного врага. Ставится перед колодой (если она уже в ряду).
function bxAddEnemyCard(row, m, delaySec) {
  const unit = document.createElement('div');
  unit.className = `bx-unit bx-enemy variant-${m.variantId || 'normal'} bx-spawn` + (m.reinforcement ? ' bx-reinforce' : '') +
    (m.soul ? ` bx-has-soul soul-${m.soul}` : '');   // v0.33: душа самоцвета
  unit.style.animationDelay = delaySec + 's';
  const crop = BX_ART_CROP[m.templateId || m.id];
  const picStyle = `background-image:url('${m.art || ''}');` + (crop ? `background-size:${crop.size};background-position:${crop.pos};` : '');
  unit.innerHTML = `
    <div class="bx-card">
      <div class="bx-pic" style="${picStyle}"></div>
      <div class="bx-flash"></div>
      ${typeof soulBadgeHtml === 'function' ? soulBadgeHtml(m) : ''}
      <div class="bx-atb bx-atb-mob" data-icon="☠"></div>
      <div class="debuff-bar bx-status"></div>
    </div>
    <div class="fighter-name">${m.name}<span class="bx-lvl">ур. ${m.level || 1}</span></div>
    <div class="bx-bars">
      <div class="bar bx-bar hp">
        <div class="bx-ghost"></div>
        <div class="bar-fill hp" style="width:100%"></div>
        <div class="bar-text"></div>
      </div>
      ${m.maxMp > 0 ? `<div class="bar bx-bar mp"><div class="bar-fill mp bx-mob-mp" style="width:100%"></div><div class="bar-text bx-mob-mp-text"></div></div>` : ''}
    </div>`;
  // v0.20: в ручном режиме тап по врагу — выбор цели
  unit.addEventListener('click', () => { if (typeof manualSelectTarget === 'function') manualSelectTarget(m.index); });
  const deck = BX.deck;
  row.insertBefore(unit, deck && deck.parentNode === row ? deck : null);
  setTimeout(() => unit.classList.remove('bx-spawn', 'bx-reinforce'), 500 + delaySec * 1000 + (m.reinforcement ? 700 : 0));
  BX.cards.set(m, {
    unit,
    card: unit.querySelector('.bx-card'),
    pic: unit.querySelector('.bx-pic'),
    fill: unit.querySelector('.bar-fill'),
    ghost: unit.querySelector('.bx-ghost'),
    text: unit.querySelector('.bar-text'),
    mpFill: unit.querySelector('.bx-mob-mp'),   // v0.36: мана магических тварей
    mpText: unit.querySelector('.bx-mob-mp-text'),
    status: unit.querySelector('.bx-status'),
    atb: unit.querySelector('.bx-atb-mob'),   // v0.23: своя шкала ATB
    atbP: -1,
    statusHtml: '',
    dead: false,
    pendingDeath: false,
    pendingSince: 0,
    mon: m,
  });
}

function bxMonsterStatusHtml(m) {
  const list = (state.battle.debuffs && state.battle.debuffs.monsters && state.battle.debuffs.monsters[m.index]) || {};
  return Object.keys(list).map(id => {
    const def = (typeof DEBUFF_DEFS !== 'undefined') ? DEBUFF_DEFS[id] : null;
    if (!def) return '';
    const d = list[id];
    const count = typeof def.displayCount === 'function' ? def.displayCount(d) : (d.turnsLeft || 0);
    return `<div class="debuff-chip ${def.cssClass}" title="${def.name}"><span class="dc-icon">${def.icon}</span><span class="dc-count">${count}</span></div>`;
  }).join('');
}

function bxKillCard(c) {
  if (!c || c.dead) return;
  c.dead = true;
  c.pendingDeath = false;
  c.unit.classList.remove('bx-target');
  c.unit.classList.add('bx-dying');
  setTimeout(() => {
    c.unit.classList.remove('bx-dying');
    c.unit.classList.add('bx-dead');
    if ((BX.groupRef || []).length < 2) return;
    // v0.26: сначала плавно освобождаем место в ряду, потом — в колоду (без рывка соседей)
    c.unit.classList.add('bx-collapse');
    setTimeout(() => { c.unit.classList.remove('bx-collapse'); bxToDeck(c); }, 350);
  }, 900);
}

// v0.23: мёртвого врага кладём в «колоду» (только в стае из 2+ мобов).
function bxToDeck(c) {
  const deck = BX.deck, row = document.getElementById('bx-enemy-row');
  if (!deck || !row || deck.parentNode !== row || c.unit.parentNode !== row) return;
  if ((BX.groupRef || []).length < 2) return;
  const stack = deck.querySelector('.bx-deck-stack');
  const i = stack.children.length;
  c.unit.style.setProperty('--i', String(Math.min(i, 3)));
  c.unit.style.setProperty('--r', ((i % 2 ? 1 : -1) * (2 + (i * 3) % 5)) + 'deg');
  c.unit.style.animationDelay = '';
  c.unit.classList.add('bx-in-deck');
  stack.appendChild(c.unit);
  // в стопке видны последние 4 карты — у них «высота» в колоде
  [...stack.children].forEach((u, k, all) => u.style.setProperty('--i', String(Math.max(0, Math.min(3, k - (all.length - 4))))));
  bxUpdateDeck();
}

function bxUpdateDeck() {
  const deck = BX.deck, row = document.getElementById('bx-enemy-row');
  if (!deck || !row) return;
  const n = deck.querySelector('.bx-deck-stack').children.length;
  deck.classList.toggle('has', n > 0);
  deck.querySelector('.bx-deck-count').textContent = n > 0 ? '☠ ' + n : '';
  const names = {};
  BX.cards.forEach(c => { if (c.unit.classList.contains('bx-in-deck')) { const nm = c.mon && c.mon.name || '?'; names[nm] = (names[nm] || 0) + 1; } });
  deck.title = n ? 'Повержены: ' + Object.keys(names).map(k => k + (names[k] > 1 ? ' ×' + names[k] : '')).join(', ') : '';
  // живых стало меньше — остальные карты становятся крупнее.
  // v0.26: считаем карточки, которые реально стоят в ряду (павший ещё ~1 с лежит в ряду, пока гаснет),
  // а не живых — иначе при быстрых убийствах карточек больше, чем места, и ряд переносится.
  bxUpdateRowSize();
  bxRetrig(deck, 'bx-bump');
}

// Главная синхронизация: вызывается из updateBattleUI (каждый тик боя).
function bxSync() {
  const st = bxStage();
  if (!st) return;
  const p = state.player;
  bxUpdateStageBg();

  // ---- Герой ----
  const nameEl = document.getElementById('player-fighter-name');
  if (nameEl) {
    const key = `${p.name}|${p.level}`;
    if (BX.heroName !== key || !nameEl.querySelector('.bx-lvl')) {
      BX.heroName = key;
      nameEl.innerHTML = `${p.name}<span class="bx-lvl">ур. ${p.level}</span>`;
    }
  }
  const ghost = document.getElementById('bx-hero-hp-ghost');
  if (ghost && p.maxHp > 0) ghost.style.width = Math.max(0, p.hp / p.maxHp * 100) + '%';

  const heroAtb = document.getElementById('bx-hero-atb');
  if (heroAtb) {
    const v = Math.min(1, state.battle.playerATB || 0);
    heroAtb.style.setProperty('--p', v.toFixed(3));
    heroAtb.classList.toggle('bx-ready', v >= 0.98);
  }
  const packAtb = document.getElementById('bx-pack-atb');
  if (packAtb) packAtb.style.setProperty('--p', Math.min(1, state.battle.monstersATB || 0).toFixed(3));

  // ---- Мобы ----
  const group = state.battle.monsters || [];
  if (group.length && group !== BX.groupRef) bxBuildEnemies(group);
  if (group.length) bxSyncPack(group);   // v0.29: подмога и силуэты «?»
  else if (BX.lurkers && BX.lurkers.length) { BX.lurkers.forEach(l => l.remove()); BX.lurkers = []; }   // бой кончился — шорох тоже

  const cur = (typeof getCurrentMonster === 'function') ? getCurrentMonster() : null;
  BX.cards.forEach((c, m) => {
    const pct = m.maxHp > 0 ? Math.max(0, m.hp / m.maxHp * 100) : 0;
    c.fill.style.width = pct + '%';
    c.ghost.style.width = pct + '%';
    c.text.textContent = `${Math.max(0, Math.floor(m.hp))} / ${m.maxHp}`;
    if (c.mpFill) {
      c.mpFill.style.width = Math.max(0, m.mp / m.maxMp * 100) + '%';
      c.mpText.textContent = `${Math.max(0, Math.floor(m.mp))} / ${m.maxMp}`;
    }

    if (m.hp <= 0) {
      c.unit.classList.remove('bx-target');
      // v0.23: подстраховка — если анимация гибели так и не пришла (окно было
      // скрыто, вкладка в фоне, ошибка эффекта), гасим карту сами через 2 сек.
      if (!c.dead && (!c.pendingDeath || (!bxOn() || performance.now() - c.pendingSince > 2000))) bxKillCard(c);
      if (c.statusHtml) { c.statusHtml = ''; c.status.innerHTML = ''; }
      c.card.classList.remove('bx-frozen');
      return;
    }
    c.unit.classList.toggle('bx-target', m === cur);
    // v0.23: кольцо ATB на карточке моба (как у героя)
    if (c.atb) {
      const ap = Math.round(Math.min(1, m.atb || 0) * 200) / 200;
      if (ap !== c.atbP) {
        c.atbP = ap;
        c.atb.style.setProperty('--p', ap.toFixed(3));
        c.atb.classList.toggle('bx-ready', ap >= 0.98);
      }
    }
    const html = bxMonsterStatusHtml(m);
    if (html !== c.statusHtml) { c.statusHtml = html; c.status.innerHTML = html; }
    c.card.classList.toggle('bx-frozen', html.indexOf('debuff-freeze') >= 0);
  });
}

// --------------------------------------------------------
//  ВИДЫ АТАК
// --------------------------------------------------------
// Как выглядит действие игрока: 'melee' (рывок) / 'proj' (снаряд) / 'bolt' / 'heal'.
function bxPlayerActionLook(skill) {
  const p = state.player;
  // v0.19: массовые — герой только двигается/кастует, эффекты рисуют сами события.
  if (skill && skill.aoe) {
    if (skill.fxAnim === 'melee') return { mode: 'melee', fx: skill.id === 'bloodHarvest' ? 'rage' : null, aoe: true };
    return { mode: 'aoe-cast', aoe: true };
  }
  // v0.30: img — картинка попадания (img/fx); imgEach — на каждый удар (второй — зеркально).
  if (skill) {
    switch (skill.id) {
      case 'powerStrike':     return { mode: 'melee', fx: 'slash', color: '#ffd27a', img: 'b_53' };
      case 'doubleStrike':    return { mode: 'melee', fx: 'double', color: '#ffe8b0', img: 'b_12', imgEach: true };
      case 'orcRage':         return { mode: 'melee', fx: 'rage', color: '#ff3a2a', img: 'b_55' };
      case 'dwarfGreed':      return { mode: 'melee', fx: 'slash', color: '#ffc94a', sparks: '#ffd34d', img: 'b_45' };
      case 'fireball':        return { mode: 'proj', proj: 'fire', burst: 'fire', sparks: '#ffb04a', ms: 420, img: 'b_35' };
      case 'iceArrow':        return { mode: 'proj', proj: 'ice', burst: 'ice', sparks: '#bff1ff', ms: 300, img: 'b_36' };
      case 'spiritWrath':     return { mode: 'proj', proj: 'dark', burst: 'dark', sparks: '#c58cff', ms: 420, rage: true, img: 'b_32' };
      case 'dwarfGreedMagic': return { mode: 'proj', proj: 'gold', burst: 'gold', sparks: '#ffd34d', ms: 380, img: 'c_38' };
      case 'discharge':       return { mode: 'bolt', burst: 'light', sparks: '#cfe0ff', img: 'b_18' };
    }
    if (skill.isHeal) return { mode: 'heal' };
  }
  if (isMage()) return { mode: 'proj', proj: 'arcane', burst: 'arcane', sparks: '#b8d4ff', ms: 320, img: BX_WEAPON_IMG.staves };
  const w = p.equipment && p.equipment.weapon;
  const cat = (w && typeof getWeaponCategory === 'function') ? getWeaponCategory(w.name) : null;
  if (cat === 'bows' || cat === 'crossbows') return { mode: 'proj', proj: 'arrow', burst: null, ms: 220, slash: true, img: BX_WEAPON_IMG[cat] };
  return { mode: 'melee', fx: 'slash', color: '#ffd27a', img: BX_WEAPON_IMG[cat] || BX_UNARMED_IMG };
}

function bxMonsterActionLook(m) {
  const id = m && (m.templateId || m.id);
  const img = BX_MONSTER_IMG[id];
  if (m && m.attackType === 'magic') {
    if (id === 'frog' || id === 'arachnid') return { mode: 'proj', proj: 'toxic', burst: 'toxic', ms: 380, img: img || BX_MONSTER_IMG_MAGIC };
    return { mode: 'proj', proj: 'dark', burst: 'dark', ms: 380, img: img || BX_MONSTER_IMG_MAGIC };
  }
  if (id === 'wolf') return { mode: 'melee', fx: 'claw', img };
  return { mode: 'melee', fx: 'slash', color: '#ff6a4a', img: img || BX_MONSTER_IMG_PHYS };
}

// v0.19.1: размер разреза/когтей — от размера карточки, а не фиксированный.
// На телефоне карточки маленькие, и разрез 220px тянулся через весь экран «лазером».
function bxSlashSize(cardEl, k) {
  const r = cardEl && cardEl.getBoundingClientRect ? cardEl.getBoundingClientRect() : null;
  if (!r || !r.width) return '';
  const s = Math.round(Math.min(r.width, r.height || r.width) * (k || 1.25));
  return `width:${s}px;height:${s}px;`;
}

// Нарисовать «попадание» (вспышка + эффект) по карточке.
function bxImpact(cardEl, look, isFirst) {
  if (!cardEl || !look) return;
  const c = bxCenter(cardEl);
  const sz = bxSlashSize(cardEl);
  const szClaw = bxSlashSize(cardEl, 0.95);
  // v0.30: есть картинка — рисуем её вместо разреза/вспышки (искры оставляем).
  if (look.img) {
    if (isFirst || look.imgEach) bxFxImg(cardEl, look.img, { flip: !!look.imgEach && !isFirst });
    if (look.sparks && isFirst) bxSparks(c.x, c.y, look.sparks, 12);
    return;
  }
  if (look.fx === 'slash' && isFirst) bxAdd('bx-slash', c.x, c.y, '', `${sz}--r:${Math.round(Math.random() * 30 - 15)}deg;--c:${look.color || '#ffd27a'}`, 600);
  if (look.fx === 'double') bxAdd('bx-slash', c.x, c.y, '', `${sz}--r:${isFirst ? -18 : 22}deg;--c:${look.color}`, 600);
  if (look.fx === 'rage' && isFirst) {
    [-20, 10, 40].forEach((r, i) => setTimeout(() => bxAdd('bx-slash', c.x + i * 8, c.y - i * 6, '', `${sz}--r:${r}deg;--c:#ff3a2a`, 600), i * 70));
  }
  if (look.fx === 'claw' && isFirst) bxAdd('bx-claw', c.x + (Math.random() * 30 - 15), c.y, '<i></i><i></i><i></i>', szClaw, 600);
  if (look.slash && isFirst) bxAdd('bx-slash', c.x, c.y, '', `${sz}--r:0deg;--c:#e8dcc0`, 600);
  if (look.burst && isFirst) bxAdd('bx-burst ' + look.burst, c.x, c.y, '', '', 700);
  if (look.sparks && isFirst) bxSparks(c.x, c.y, look.sparks, 12);
}

// Цифра по событию spawnFloatDamage.
function bxEventNumber(cardEl, ev, isHeroSide) {
  const t = ev.type, n = ev.dmg;
  if (ev.text) return bxNum(cardEl, ev.text, (t === 'poison' ? 'poison' : t === 'block' ? 'block' : 'magic') + ' label');
  if (t === 'heal' || t === 'food' || t === 'mana') return bxNum(cardEl, `+${n}`, t);   // v0.34.1: mana — синие «+N»
  if (t === 'block') return bxNum(cardEl, 'БЛОК', 'block');
  if (t === 'miss')  return bxNum(cardEl, 'ПРОМАХ', 'miss');
  if (t === 'dodge') return bxNum(cardEl, 'УВОРОТ', 'dodge');
  if (t === 'crit')  return bxNum(cardEl, `${n}<small>КРИТ</small>`, 'crit');
  const cls = (t === 'magic' || t === 'fire' || t === 'poison') ? t : (isHeroSide ? 'mob' : 'dmg');
  return bxNum(cardEl, isHeroSide ? `-${n}` : `${n}`, cls);
}

// Проиграть список событий (цифры + вспышки).
// look — как выглядит атака (для эффекта попадания по противнику).
function bxPlayEvents(events, delay, look, attackerCard) {
  if (!events || !events.length) return;
  let monHit = 0, heroHit = 0;
  const seenMon = new Set();
  events.forEach(ev => {
    const isHero = ev.side === 'hero';
    const step = isHero ? heroHit++ : monHit++;
    const firstOnThis = isHero ? step === 0 : !seenMon.has(ev.mon);
    if (!isHero) seenMon.add(ev.mon);
    // v0.19: у события может быть свой эффект (массовые навыки) — снаряд летит к КАЖДОЙ цели.
    const proj = ev.fx && ev.fx.startsWith('proj:') ? ev.fx.slice(5) : null;
    const t0 = delay + step * 140;
    if (proj) {
      setTimeout(() => {
        if (!bxOn()) return;
        const cardEl = bxMonCard(ev.mon);
        if (cardEl && bxHeroCard()) bxProjectile(proj === 'life' ? 'toxic' : proj, bxHeroCard(), cardEl, 300);
      }, t0);
    }
    setTimeout(() => {
      if (!bxOn()) return;
      const cardEl = isHero ? bxHeroCard() : bxMonCard(ev.mon);
      if (!cardEl) return;
      const t = ev.type;
      if (ev.fx) bxEventFx(cardEl, ev.fx, t !== 'miss');
      if (ev.text) { if (t === 'block') bxRetrig(cardEl, 'bx-block'); bxEventNumber(cardEl, ev, isHero); return; }
      if (t === 'heal' || t === 'food' || t === 'mana') {   // mana — без вспышки и тряски
        if (t === 'heal') {
          bxRetrig(cardEl, 'bx-heal');
          const c = bxCenter(cardEl);
          bxFxImg(cardEl, BX_HEAL_IMG, { k: 0.9, rot: 0 });   // v0.30: зелёный крест вместо вспышки
          bxSparks(c.x, c.y, '#7dff9a', 10);
        }
      } else if (t === 'dodge') {
        bxRetrig(cardEl, 'bx-dodge');
      } else if (t === 'block') {
        bxRetrig(cardEl, 'bx-block');
      } else if (t !== 'miss') {
        bxRetrig(cardEl, 'bx-hit');
        // эффект удара — только если событие от «атакующего», а не тик/отдача
        if (ev.fromAction && look && !ev.fx) bxImpact(cardEl, look, firstOnThis);
        if (ev.storm && attackerCard) {
          const c = bxCenter(cardEl);
          const h = Math.max(60, c.y);
          bxAdd('bx-bolt', c.x, 0, '', `height:${h}px`, 500);
          bxAdd('bx-burst light', c.x, c.y, '', '', 700);
        }
        if (t === 'crit') bxShake();
      }
      bxEventNumber(cardEl, ev, isHero);
    }, t0 + (proj ? 300 : 0));
  });
}

// v0.19: эффект конкретного события (массовые навыки, тики).
function bxEventFx(cardEl, fx, hit) {
  const c = bxCenter(cardEl);
  // v0.30: картинка попадания. Разрезы и снаряды — только при попадании, остальное — всегда.
  const im = BX_EVENT_IMG[fx];
  if (im) {
    if (fx === 'bolt') bxAdd('bx-bolt', c.x, 0, '', `height:${Math.max(60, c.y)}px`, 500);
    if (hit || !(fx.startsWith('slash') || fx.startsWith('proj:') || fx === 'bolt')) bxFxImg(cardEl, im, { k: fx.startsWith('slash') ? 1.05 : 0.95 });
    if (fx === 'blizzard') bxShake();
    return;
  }
  const slashColors = { 'slash': '#ffd27a', 'slash-red': '#ff3a2a', 'slash-green': '#7dff9a', 'slash-blue': '#9fd0ff' };
  if (slashColors[fx]) {
    if (hit) bxAdd('bx-slash', c.x, c.y, '', `${bxSlashSize(cardEl)}--r:${Math.round(Math.random() * 40 - 20)}deg;--c:${slashColors[fx]}`, 600);
    return;
  }
  const burst = (kind, spark, n) => { bxAdd('bx-burst ' + kind, c.x, c.y, '', '', 700); if (spark) bxSparks(c.x, c.y, spark, n || 10); };
  switch (fx) {
    case 'proj:fire':   if (hit) burst('fire', '#ffb04a'); break;
    case 'proj:ice':    if (hit) burst('ice', '#bff1ff'); break;
    case 'proj:arcane': if (hit) burst('arcane', '#b8d4ff'); break;
    case 'proj:life':   if (hit) burst('toxic', '#9dff7a'); break;
    case 'bolt':
      bxAdd('bx-bolt', c.x, 0, '', `height:${Math.max(60, c.y)}px`, 500);
      if (hit) burst('light', '#cfe0ff', 8);
      break;
    case 'ice':         burst('ice', '#bff1ff', 12); break;
    case 'blizzard':    burst('ice', '#ffffff', 16); bxShake(); break;
    case 'toxic':       burst('toxic', '#b8ff7a', 10); break;
    case 'toxic-small': bxSparks(c.x, c.y, '#9dff7a', 6); break;
    case 'rune':        burst('arcane', '#d8f2ff', 8); break;
  }
}

// --------------------------------------------------------
//  ВОСПРОИЗВЕДЕНИЕ ДЕЙСТВИЙ
// --------------------------------------------------------
// v0.23: эффекты не рисуем (окно скрыто), но карты убитых гасим всё равно.
function bxSilentKills(ctx) {
  if (!ctx || !ctx.kills) return;
  ctx.kills.forEach(k => { const c = BX.cards.get(k.mon); if (c) bxKillCard(c); });
}

function bxPlayPlayerAction(ctx) {
  if (!ctx) return;
  if (!bxOn()) { bxSilentKills(ctx); return; }
  const look = bxPlayerActionLook(ctx.skill);
  const hero = bxHeroCard();
  const targetCard = bxMonCard(ctx.target);

  // подсветить использованный навык
  if (ctx.skill) {
    const idx = (state.player.skillSlots || []).indexOf(ctx.skill.id);
    const slots = document.querySelectorAll('#skills-column .skill-slot');
    if (idx >= 0 && slots[idx]) bxRetrig(slots[idx], 'bx-used');
  }

  // события «по противнику» — от действия; «по герою» (отдача) — без эффекта удара
  ctx.events.forEach(ev => { if (ev.side === 'mon') ev.fromAction = true; });

  let delay = 0;
  if (look.mode === 'melee') {
    if (look.fx === 'rage') bxRetrig(hero, 'bx-rage');
    bxRetrig(hero, 'bx-lunge');
    delay = 130;
  } else if (look.mode === 'heal' || look.mode === 'aoe-cast') {
    bxRetrig(hero, 'bx-cast');
    delay = 150;
  } else if (look.mode === 'bolt') {
    bxRetrig(hero, 'bx-cast');
    delay = 180;
    if (targetCard) setTimeout(() => {
      if (!bxOn()) return;
      const c = bxCenter(targetCard);
      bxAdd('bx-bolt', c.x, 0, '', `height:${Math.max(60, c.y)}px`, 500);
    }, 120);
  } else {
    bxRetrig(hero, 'bx-cast');
    if (look.rage) bxRetrig(hero, 'bx-rage');
    delay = 120 + look.ms;
    if (targetCard) setTimeout(() => { if (bxOn()) bxProjectile(look.proj, hero, targetCard, look.ms); }, 120);
  }

  bxPlayEvents(ctx.events, delay, look, hero);
  // Для массовых цифры идут по очереди — смерть показываем после последнего попадания.
  const monEvents = ctx.events.filter(ev => ev.side === 'mon').length;
  const killDelay = look.aoe || monEvents > 1 ? delay + monEvents * 140 + 400 : delay + 160;
  ctx.kills.forEach(k => bxPlayKill(k, killDelay));
  if (ctx.levelUp) setTimeout(bxPlayLevelUp, delay + 300);
}

function bxPlayMonsterAction(ctx) {
  if (!ctx) return;
  if (!bxOn()) { bxSilentKills(ctx); return; }
  // Несколько мобов бьют в один тик — разносим их удары по времени.
  const now = performance.now();
  BX.monSeq = (now - (BX.lastMonActAt || 0) < 60) ? (BX.monSeq || 0) + 1 : 0;
  BX.lastMonActAt = now;
  if (BX.monSeq > 0) { const c = ctx; setTimeout(() => bxPlayMonsterActionNow(c), BX.monSeq * 240); return; }
  bxPlayMonsterActionNow(ctx);
}
function bxPlayMonsterActionNow(ctx) {
  if (!bxOn()) { bxSilentKills(ctx); return; }
  const m = ctx.actor;
  const look = bxMonsterActionLook(m);
  const attacker = bxMonCard(m);
  const hero = bxHeroCard();
  const hasHeroHit = ctx.events.some(ev => ev.side === 'hero');

  ctx.events.forEach(ev => {
    if (ev.side === 'hero') ev.fromAction = true;
    else ev.storm = true; // ответный удар (Наследие Грозы) по атакующему
  });

  let delay = 0;
  if (hasHeroHit && attacker) {
    if (look.mode === 'proj') {
      delay = 80 + look.ms;
      setTimeout(() => { if (bxOn()) bxProjectile(look.proj, attacker, hero, look.ms); }, 80);
    } else {
      bxRetrig(attacker, 'bx-lunge');
      delay = 130;
    }
  }
  // ответка Грозы — чуть позже удара
  const heroEv = ctx.events.filter(ev => ev.side === 'hero');
  const monEv = ctx.events.filter(ev => ev.side !== 'hero');
  bxPlayEvents(heroEv, delay, look, attacker);
  bxPlayEvents(monEv, delay + 220, null, attacker);
  ctx.kills.forEach(k => bxPlayKill(k, delay + 380));
}

function bxPlayKill(kill, delay) {
  const c = BX.cards.get(kill.mon);
  if (c && !c.dead) { c.pendingDeath = true; c.pendingSince = c.pendingSince || performance.now(); }
  setTimeout(() => {
    if (c) bxKillCard(c);
    if (!bxOn()) return;
    const card = c ? c.card : null;
    if (card) {
      const pos = bxCenter(card);
      bxSparks(pos.x, pos.y, '#e0be7a', 14);
      if (kill.gold > 0) bxAdd('bx-num gold', pos.x, pos.y + 30, `+${kill.gold} 🪙`, '', 1400);
    }
    bxPlayLoot(kill.loot, card);
    if (kill.last) setTimeout(bxPlayVictory, 450);
  }, delay);
}

function bxPlayLoot(loot, fromCard) {
  if (!loot || !loot.length || !fromCard) return;
  const st = bxStage(), target = document.getElementById('bx-loot-column');
  if (!st || !target) return;
  const s = st.getBoundingClientRect(), r = target.getBoundingClientRect();
  const tx = r.left - s.left + r.width / 2, ty = r.top - s.top + 12;
  loot.slice(0, 6).forEach((item, i) => {
    setTimeout(() => {
      if (!bxOn()) return;
      const from = bxCenter(fromCard);
      const rarity = item.rarity && typeof RARITIES !== 'undefined' ? RARITIES[item.rarity] : null;
      const rare = rarity && rarity.id !== 'white';
      const col = rare ? rarity.color : '#8a7a5a';
      const go = () => {
        const icon = (typeof normalizeIconHtml === 'function') ? normalizeIconHtml(item.icon) : '';
        const d = bxAdd('bx-lootfly', from.x, from.y, icon || '📦', `--c:${col}`, 1400);
        if (!d || typeof d.animate !== 'function') return;
        const dx = tx - from.x, dy = ty - from.y;
        const a = d.animate([
          { transform: 'translate(0,0) scale(.4)', opacity: 0 },
          { transform: `translate(${dx * .35}px,${dy * .35 - 110}px) scale(1.3)`, opacity: 1, offset: .35 },
          { transform: `translate(${dx}px,${dy}px) scale(.5)`, opacity: .9 },
        ], { duration: 950, easing: 'cubic-bezier(.3,.1,.5,1)' });
        a.onfinish = () => {
          d.remove();
          BX.lootCount++;
          // v0.23: счётчик сумки ведёт battle-session.js (вся добыча за сессию)
          if (typeof bsessUpdateBag === 'function') bsessUpdateBag();
          else { const cnt = document.getElementById('bx-loot-count'); if (cnt) cnt.textContent = '🎒 ' + BX.lootCount; }
          bxRetrig(document.getElementById('bx-loot-column'), 'bx-bump');
        };
      };
      if (rare) {
        bxAdd('bx-beam', from.x, from.y - 380, '', `--c:${col};height:400px`, 1300);
        setTimeout(go, 350);
      } else go();
    }, i * 220);
  });
}

function bxPlayVictory() {
  if (!bxOn() || state.player.hp <= 0) return;
  const st = bxStage();
  if (!st) return;
  const xp = BX.battleStart ? Math.max(0, bxTotalXp() - BX.battleStart.xp) : 0;
  const gold = BX.battleStart ? Math.max(0, state.player.gold - BX.battleStart.gold) : 0;
  const parts = [];
  if (xp > 0) parts.push(`+${xp} опыта`);
  if (gold > 0) parts.push(`+${gold} 🪙`);
  const b = document.createElement('div');
  b.className = 'bx-banner';
  b.innerHTML = `<h2>ПОБЕДА</h2>${parts.length ? `<p>${parts.join(' · ')}</p>` : ''}`;
  st.appendChild(b);
  setTimeout(() => b.remove(), 2200);
}

function bxPlayLevelUp() {
  if (!bxOn()) return;
  const hero = bxHeroCard();
  if (!hero) return;
  bxRetrig(hero, 'bx-levelup');
  const c = bxCenter(hero);
  bxAdd('bx-burst level', c.x, c.y, '', '', 1100);
  bxSparks(c.x, c.y, '#ffd34d', 18);
  const st = bxStage(), sw = st ? st.clientWidth : 800;
  const x = Math.max(130, Math.min(sw - 130, c.x));   // чтобы надпись не уехала за край на телефоне
  bxAdd('bx-num big', x, c.y - 40, `УРОВЕНЬ ${state.player.level}!`, '', 1900);
}

function bxPlayDefeat() {
  const st = bxStage();
  if (!st || document.hidden) return;
  const unit = document.getElementById('fighter-player');
  if (unit) { unit.classList.add('bx-dying'); setTimeout(() => unit.classList.remove('bx-dying'), 2100); }
  const b = document.createElement('div');
  b.className = 'bx-banner lose';
  b.innerHTML = `<h2>ПОРАЖЕНИЕ</h2><p>${state.player.name} пал в бою</p>`;
  st.appendChild(b);
  setTimeout(() => b.remove(), 2100);
}

// --------------------------------------------------------
//  ОБЁРТКИ НАД ФУНКЦИЯМИ ИГРЫ
//  Каждая обёртка сначала вызывает оригинал (логика не меняется),
//  потом рисует эффект.
// --------------------------------------------------------
(function bxInstallHooks() {
  function newCtx(actor, target) { return { actor, target, skill: null, events: [], kills: [], levelUp: false }; }

  // ---- Цифры урона: перехватываем и рисуем на арене ----
  const origFloat = spawnFloatDamage;
  spawnFloatDamage = function (elementId, dmg, type, opts) {
    const ours = elementId === 'fighter-player' || elementId === 'fighter-monster';
    if (!ours || !bxOn()) {
      if (!ours) return origFloat.apply(this, arguments);
      return; // окно боя скрыто/вкладка в фоне — цифры не нужны
    }
    const ev = { side: elementId === 'fighter-player' ? 'hero' : 'mon', dmg, type, mon: null };
    if (ev.side === 'mon') ev.mon = (opts && opts.mon) || (BX.ctx && BX.ctx.target) || (typeof getCurrentMonster === 'function' ? getCurrentMonster() : null);
    // v0.19: массовые навыки передают цель и эффект для каждого попадания.
    if (opts) { ev.fx = opts.fx || null; ev.text = opts.text || null; }
    if (BX.ctx) BX.ctx.events.push(ev);
    else bxPlayEvents([ev], 0, null, null);
  };

  // ---- Какой навык выбран ----
  const origTryUse = tryUseActiveSkill;
  tryUseActiveSkill = function () {
    const s = origTryUse.apply(this, arguments);
    if (BX.ctx && BX.ctx.actor === 'player') BX.ctx.skill = s || null;
    return s;
  };

  // ---- Ход игрока ----
  const origPlayerAttack = playerAttack;
  playerAttack = function () {
    if (BX.ctx) return origPlayerAttack.apply(this, arguments);
    const ctx = BX.ctx = newCtx('player', typeof getCurrentMonster === 'function' ? getCurrentMonster() : null);
    try { return origPlayerAttack.apply(this, arguments); }
    finally { BX.ctx = null; try { bxPlayPlayerAction(ctx); } catch (e) { console.warn('[battle-fx]', e); } }
  };

  // ---- Ход монстра ----
  const origMonsterAttack = monsterAttack;
  monsterAttack = function (attacker) {
    if (BX.ctx) return origMonsterAttack.apply(this, arguments);
    const ctx = BX.ctx = newCtx(attacker, attacker);
    try { return origMonsterAttack.apply(this, arguments); }
    finally { BX.ctx = null; try { bxPlayMonsterAction(ctx); } catch (e) { console.warn('[battle-fx]', e); } }
  };

  // ---- Тики горения/кровотечения: фиксируем цель до тика ----
  ['applyBurnTick', 'applyBleedTick'].forEach(name => {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      if (BX.ctx) return orig.apply(this, arguments);
      const ctx = BX.ctx = newCtx('tick', typeof getCurrentMonster === 'function' ? getCurrentMonster() : null);
      try { return orig.apply(this, arguments); }
      finally {
        BX.ctx = null;
        try { bxPlayEvents(ctx.events, 0, null, null); ctx.kills.forEach(k => bxPlayKill(k, 120)); } catch (e) { console.warn('[battle-fx]', e); }
      }
    };
  });

  // ---- Добыча во время убийства ----
  const origAddInv = addToInventory;
  addToInventory = function (drop) {
    const ok = origAddInv.apply(this, arguments);
    if (ok && BX.collectLoot && drop) BX.collectLoot.push({ name: drop.name, icon: drop.icon, rarity: drop.rarity || null });
    return ok;
  };

  // ---- Смерть монстра ----
  const origMonDeath = onMonsterDeath;
  onMonsterDeath = function (deadMonster) {
    const m = deadMonster || (typeof getCurrentMonster === 'function' ? getCurrentMonster() : null);
    if (!m || m._deathProcessed) return origMonDeath.apply(this, arguments);
    const c = BX.cards.get(m);
    if (c && !c.dead) { c.pendingDeath = true; c.pendingSince = performance.now(); }
    const goldBefore = state.player.gold;
    const prevCollect = BX.collectLoot;
    BX.collectLoot = [];
    let loot = [];
    try { return origMonDeath.apply(this, arguments); }
    finally {
      loot = BX.collectLoot || [];
      BX.collectLoot = prevCollect;
      const kill = {
        mon: m, loot,
        gold: Math.max(0, state.player.gold - goldBefore),
        last: (typeof getAliveMonstersCount === 'function') ? getAliveMonstersCount() === 0 : false,
      };
      if (BX.ctx) BX.ctx.kills.push(kill);
      else { try { bxPlayKill(kill, 120); } catch (e) { console.warn('[battle-fx]', e); } }
    }
  };

  // ---- Новый уровень ----
  const origLevelUp = checkLevelUp;
  checkLevelUp = function () {
    const before = state.player.level;
    const r = origLevelUp.apply(this, arguments);
    if (state.player.level > before) {
      if (BX.ctx) BX.ctx.levelUp = true;
      else setTimeout(bxPlayLevelUp, 300);
    }
    return r;
  };

  // ---- Смерть героя ----
  const origPlayerDeath = onPlayerDeath;
  onPlayerDeath = function () {
    try { if (bxOn() && !state.battle.breakthrough) bxPlayDefeat(); } catch (e) { console.warn('[battle-fx]', e); }
    return origPlayerDeath.apply(this, arguments);
  };

  // ---- Зелье ----
  const origPotion = checkHealPotion;
  checkHealPotion = function () {
    const used = state.battle.activeEffects && state.battle.activeEffects.healPotionUsed;
    const r = origPotion.apply(this, arguments);
    if (!used && state.battle.activeEffects && state.battle.activeEffects.healPotionUsed && bxOn()) {
      bxRetrig(document.querySelector('#consumables-panel .consumable-toggle'), 'bx-used');
    }
    return r;
  };

  // ---- Начало боя ----
  const origStart = startBattle;
  startBattle = function () {
    const win = document.getElementById('battle-window');
    const wasOpen = !!(win && win.classList.contains('active'));
    const r = origStart.apply(this, arguments);
    if (!wasOpen) {
      BX.lootCount = 0;
      const cnt = document.getElementById('bx-loot-count');
      if (cnt) cnt.textContent = '';
    }
    BX.battleStart = { gold: state.player.gold, xp: bxTotalXp() };
    BX.groupRef = null;
    const unit = document.getElementById('fighter-player');
    if (unit) unit.classList.remove('bx-dying');
    try { bxSync(); } catch (e) { console.warn('[battle-fx]', e); }
    return r;
  };

  // ---- Каждый тик боя ----
  const origUpdate = updateBattleUI;
  updateBattleUI = function () {
    const r = origUpdate.apply(this, arguments);
    try { bxSync(); } catch (e) { console.warn('[battle-fx]', e); }
    return r;
  };
})();

// --------------------------------------------------------
//  КНОПКИ НИЖНЕЙ ПАНЕЛИ
// --------------------------------------------------------
function toggleBattleLogSize() {
  const w = document.getElementById('bx-logs');
  if (!w) return;
  w.classList.toggle('bx-open');
  const btn = document.getElementById('bx-log-toggle');
  if (btn) btn.title = w.classList.contains('bx-open') ? 'Свернуть журнал' : 'Развернуть журнал';
}

function toggleAutoStopPanel(forceOpen) {
  const panel = document.getElementById('auto-stop-panel');
  const btn = document.getElementById('btn-autostop-toggle');
  if (!panel) return;
  const open = (typeof forceOpen === 'boolean') ? forceOpen : !panel.classList.contains('bx-open');
  panel.classList.toggle('bx-open', open);
  if (btn) btn.classList.toggle('active', open);
  try { localStorage.setItem('l2browser_autostop_open', open ? '1' : '0'); } catch (e) {}
}

// Восстанавливаем, была ли открыта панель авто-стопа.
(function () {
  let open = false;
  try { open = localStorage.getItem('l2browser_autostop_open') === '1'; } catch (e) {}
  if (open) toggleAutoStopPanel(true);
})();
