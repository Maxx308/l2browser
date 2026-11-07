// ========================================================
//  СИСТЕМЫ: КАРТОЧКИ МОНСТРОВ
//  Рендер сетки монстров для Поляны и Копи.
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
  grid.innerHTML = '';
  grid.classList.remove('mine-grid');
  grid.classList.add('stack-grid');   // v0.34.1: стопки карточек вместо 15 отдельных

  const loc = state.player.currentLocation;
  if (typeof renderSoulHuntBar === 'function') renderSoulHuntBar();   // v0.33: какие души искать

  if (loc === 'field') {
    renderFieldMonsters(grid);
  } else if (loc === 'mine') {
    renderMineMonsters(grid);
  }
}

// ---------- ПОЛЯНА ----------
function renderFieldMonsters(grid) {
  MONSTERS.forEach(m => grid.appendChild(buildMonsterStack(m, false)));
}

// ---------- КОПИ ----------
function renderMineMonsters(grid) {
  grid.classList.add('mine-grid');
  MINE_MONSTERS.forEach(template => grid.appendChild(buildMonsterStack(template, true)));
}

// ========================================================
//  v0.34.1: СТОПКА КАРТОЧЕК — у каждого монстра три подтипа одной колодой
//  Спереди выбранный подтип, за ним выглядывают остальные (цветной край с надписью).
//  Нажал на край (или смахнул карточку вбок) — подтип выдвигается вперёд.
//  Нажал на переднюю карточку — бой, как раньше.
//  Выбор запоминается у героя: state.player.huntVariant[id монстра].
// ========================================================
const STACK_VARIANTS = ['normal', 'ancient', 'bloody'];
const STACK_TAB_NAMES = { normal: 'Обычный', ancient: 'Древний', bloody: 'Кровавый' };

function getStackFront(monsterId) {
  const v = state.player.huntVariant && state.player.huntVariant[monsterId];
  return STACK_VARIANTS.includes(v) ? v : 'normal';
}

function setStackFront(monsterId, variantId) {
  if (!state.player.huntVariant || typeof state.player.huntVariant !== 'object') state.player.huntVariant = {};
  state.player.huntVariant[monsterId] = variantId;
}

function buildMonsterStack(template, fromMine) {
  const stack = document.createElement('div');
  stack.className = 'monster-stack';
  stack.dataset.id = template.id;

  const cards = {};
  STACK_VARIANTS.forEach(v => {
    const card = buildMonsterCard(template, v, fromMine);
    const startFight = card.onclick;
    const title = getMonsterTitle(template.id, v);
    const tab = document.createElement('div');
    tab.className = 'stack-tab';
    tab.innerHTML = `<span>${STACK_TAB_NAMES[v]}</span>${title !== 'none' ? '<i>👑</i>' : ''}`;
    card.appendChild(tab);
    card.onclick = (e) => {
      if (stack._swiped) { stack._swiped = false; return; }
      if (!card.classList.contains('stack-front')) {   // край задней карточки — только выдвинуть
        e.stopPropagation();
        showStackVariant(stack, cards, template, v);
        return;
      }
      startFight(e);
    };
    cards[v] = card;
    stack.appendChild(card);
  });

  layoutStack(cards, getStackFront(template.id));
  attachStackSwipe(stack, cards, template);
  return stack;
}

// Порядок: выбранный подтип спереди, остальные — по порядку за ним.
function layoutStack(cards, front) {
  const order = [front, ...STACK_VARIANTS.filter(v => v !== front)];
  order.forEach((v, pos) => {
    const c = cards[v];
    c.style.setProperty('--pos', pos);
    c.style.zIndex = String(3 - pos);
    c.classList.toggle('stack-front', pos === 0);
    c.classList.toggle('stack-back', pos > 0);
  });
}

function showStackVariant(stack, cards, template, variantId) {
  const prev = getStackFront(template.id);
  setStackFront(template.id, variantId);
  layoutStack(cards, variantId);
  if (typeof hideTooltip === 'function') hideTooltip();
  if (prev !== variantId) showStackDeltas(cards[prev], cards[variantId]);
}

// v0.34.1: над статами — насколько монстр стал сильнее (+N зелёным) или слабее (−N красным):
// здоровье, атака, защита, маг. защита. Только для статов, открытых на ОБЕИХ карточках, —
// иначе подсказка выдала бы закрытое значение.
function showStackDeltas(fromCard, toCard) {
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

// Телефон: смахнуть карточку влево — следующий подтип, вправо — предыдущий.
function attachStackSwipe(stack, cards, template) {
  const monsterId = template.id;
  let sx = 0, sy = 0, on = false;
  stack.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; on = true;
  }, { passive: true });
  stack.addEventListener('touchend', (e) => {
    if (!on) return;
    on = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const cur = STACK_VARIANTS.indexOf(getStackFront(monsterId));
    const next = STACK_VARIANTS[(cur + (dx < 0 ? 1 : -1) + STACK_VARIANTS.length) % STACK_VARIANTS.length];
    stack._swiped = true;
    setTimeout(() => { stack._swiped = false; }, 400);
    showStackVariant(stack, cards, template, next);
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

  // ---- СТАТЫ (одной строкой) ----
  // ❤ HP  ⚔ Атака  🛡 Защита  ✨ Маг.защита  💨 Уворот
  const statsParts = [];

  // HP — v0.34.1: видно сразу (было — после 10 убийств), чтобы было понятно, кто крепче.
  // data-stat / data-val — для подсказки «+N / −N» при смене подтипа в стопке (только у открытых статов).
  statsParts.push(`<span class="monster-stat hp" data-stat="hp" data-val="${monster.maxHp}">❤ ${monster.maxHp}</span>`);

  // Атака — порог 50.
  if (unlockedAtk) {
    statsParts.push(`<span class="monster-stat" data-stat="atk" data-val="${monster.atk}">⚔ ${monster.atk}</span>`);
  } else {
    statsParts.push(`<span class="monster-stat stat-hidden" data-stat="atk">⚔ ???</span>`);
  }

  // Физ. защита — порог 50 (как атака).
  if (unlockedPDef) {
    statsParts.push(`<span class="monster-stat" data-stat="pDef" data-val="${monster.pDef || 0}">🛡 ${monster.pDef || 0}</span>`);
  } else {
    statsParts.push(`<span class="monster-stat stat-hidden" data-stat="pDef">🛡 ???</span>`);
  }

  // Маг. защита — порог 150 (как дроп).
  if (unlockedMDef) {
    statsParts.push(`<span class="monster-stat" data-stat="mDef" data-val="${monster.mDef || 0}">✨ ${monster.mDef || 0}</span>`);
  } else {
    statsParts.push(`<span class="monster-stat stat-hidden" data-stat="mDef">✨ ???</span>`);
  }

  // Уворот — порог 400 (как золото).
  const evasionValue = (typeof getMonsterEvasion === 'function')
    ? getMonsterEvasion(monster)
    : 0;
  if (unlockedEvasion) {
    statsParts.push(`<span class="monster-stat">💨 ${evasionValue}</span>`);
  } else {
    statsParts.push(`<span class="monster-stat stat-hidden">💨 ???</span>`);
  }

  const statsHtml = `<div class="monster-stats">${statsParts.join('')}</div>`;

  // ---- ТИТУЛ ----
  const titleId = getMonsterTitle(template.id, variantId);
  let titleHtml = '';
  if (titleId === 'hunter') {
    titleHtml = `<div class="monster-title hunter">👑 Охотник</div>`;
  } else if (titleId === 'glorious') {
    titleHtml = `<div class="monster-title glorious">👑 Прославленный охотник</div>`;
  } else if (titleId === 'magnificent') {
    titleHtml = `<div class="monster-title magnificent">🌟 Великолепный охотник</div>`;
  }

  card.innerHTML = `
    <div class="monster-portrait-img" style="background-image:url('${monster.art}')">${packBadgeHtml(template)}${typeof nightBadgeHtml === 'function' ? nightBadgeHtml(template) : ''}</div>
    <div class="monster-name">${monster.name}</div>
    <div class="monster-level">Ур. ${monster.level}${monster.attackType === 'magic' ? ' · Магия' : ''}</div>
    ${typeof primeTimeLineHtml === 'function' ? primeTimeLineHtml(template) : ''}
    <div class="monster-kills">💀 Убито: ${kills}</div>
    ${statsHtml}
    <div class="drop-list">${dropRows}</div>
    ${titleHtml}
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