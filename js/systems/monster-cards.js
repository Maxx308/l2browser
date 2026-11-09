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
  } else if (loc === 'outskirts') {   // v0.36: Окраины Ильграда — раскладка как в Копях (5 тварей)
    grid.classList.add('mine-grid');
    OUTSKIRTS_MONSTERS.forEach(t => grid.appendChild(buildMonsterStack(t, true)));
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
    const tab = document.createElement('div');
    tab.className = 'stack-tab';
    tab.innerHTML = `<span>${STACK_TAB_NAMES[v]}</span>`;   // v0.36: титул — значком в левом нижнем углу карточки
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
    const icon = `<img class="stat-ico" src="img/tags/${def.img}.jpg" alt="${def.name}" title="${def.name}">`;
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
  const titleHtml = titleDef ? `<div class="monster-hunter ${titleDef.css}" title="${titleDef.name}"><img src="img/tags/${titleDef.img}.jpg" alt="${titleDef.name}"></div>` : '';

  // ---- Счётчик: череп и «убито / до следующего открытия» ----
  const nextGoal = KILL_REVEAL_STEPS.find(n => kills < n);
  const killsText = nextGoal ? `${kills}/${nextGoal}` : `${kills}`;
  // Строка под именем — только если есть что показать: подтип и «их время».
  const metaHtml = (variant.name ? `<span class="monster-variant-word">${variant.name}</span>` : '') +
    (typeof primeTimeLineHtml === 'function' ? primeTimeLineHtml(template) : '');
  const killsHtml = `<div class="monster-kills" title="Убито. Следующая цифра — сколько нужно, чтобы узнать о твари больше"><img class="kills-ico" src="img/tags/kills.jpg" alt=""><span>${killsText}</span></div>`;

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