// ========================================================
//  СИСТЕМЫ: КАРТОЧКИ МОНСТРОВ
//  Рендер сетки монстров для Поляны и Копи.
//  + Открытие статов по счётчику убийств.
//  + Шахты-заглушки в Копи.
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

  const loc = state.player.currentLocation;

  if (loc === 'field') {
    renderFieldMonsters(grid);
  } else if (loc === 'mine') {
    renderMineMonsters(grid);
  }
}

// ---------- ПОЛЯНА ----------
function renderFieldMonsters(grid) {
  ['normal', 'ancient', 'bloody'].forEach(variantId => {
    MONSTERS.forEach(m => {
      grid.appendChild(buildMonsterCard(m, variantId));
    });
  });
}

// ---------- КОПИ ----------
function renderMineMonsters(grid) {
  grid.classList.add('mine-grid');
  const variants = ['normal', 'ancient', 'bloody'];
  variants.forEach((variantId, rowIndex) => {
    MINE_MONSTERS.forEach(template => {
      grid.appendChild(buildMonsterCard(template, variantId, true));
    });
    grid.appendChild(buildShaftCard(MINE_SHAFTS[rowIndex]));
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

  // HP — порог 10.
  if (unlockedHp) {
    statsParts.push(`<span class="monster-stat">❤ ${monster.maxHp}</span>`);
  } else {
    statsParts.push(`<span class="monster-stat stat-hidden">❤ ???</span>`);
  }

  // Атака — порог 50.
  if (unlockedAtk) {
    statsParts.push(`<span class="monster-stat">⚔ ${monster.atk}</span>`);
  } else {
    statsParts.push(`<span class="monster-stat stat-hidden">⚔ ???</span>`);
  }

  // Физ. защита — порог 50 (как атака).
  if (unlockedPDef) {
    statsParts.push(`<span class="monster-stat">🛡 ${monster.pDef || 0}</span>`);
  } else {
    statsParts.push(`<span class="monster-stat stat-hidden">🛡 ???</span>`);
  }

  // Маг. защита — порог 150 (как дроп).
  if (unlockedMDef) {
    statsParts.push(`<span class="monster-stat">✨ ${monster.mDef || 0}</span>`);
  } else {
    statsParts.push(`<span class="monster-stat stat-hidden">✨ ???</span>`);
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
    <div class="monster-portrait-img" style="background-image:url('${monster.art}')">${packBadgeHtml(template)}</div>
    <div class="monster-name">${monster.name}</div>
    <div class="monster-level">Ур. ${monster.level}${monster.attackType === 'magic' ? ' · Магия' : ''}</div>
    <div class="monster-kills">💀 Убито: ${kills}</div>
    ${statsHtml}
    <div class="drop-list">${dropRows}</div>
    ${titleHtml}
  `;
  return card;
}

// ---------- КАРТОЧКА ШАХТЫ ----------
function buildShaftCard(shaft) {
  const card = document.createElement('div');
  card.className = 'monster-card shaft-card';
  card.dataset.shaft = shaft.id;
  card.innerHTML = `
    <div class="monster-portrait-img" style="background-image:url('${shaft.art}')"></div>
    <div class="monster-name">${shaft.name}</div>
    <div class="shaft-desc">${shaft.desc}</div>
    <div class="shaft-badge">СКОРО</div>
  `;
  card.onclick = () => { showSoon(shaft.name, shaft.desc); };
  return card;
}

// ---------- СЧЁТЧИК УБИЙСТВ В ШАПКЕ БОЯ ----------
function updateBattleKillsCounter(m) {
  const el = document.getElementById('battle-kills');
  if (!el || !m) return;
  const kills = getMonsterKills(m.id, m.variantId);
  el.textContent = `💀 Убито: ${kills}`;
}