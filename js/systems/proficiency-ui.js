// ========================================================
//  СИСТЕМЫ: UI ВКЛАДКИ «ВЛАДЕНИЕ»
//  Показывает все оружейные навыки и стихии с прогрессом.
//  + Красивое форматирование бонусов: 1.5 → «+1.5%», 6 → «+6%».
//  + Тултип владения — авто-скрытие через 7 секунд
//    (общий таймер с тултипами предметов).
//  + v0.29: на телефоне подсказка открывается тапом по строке
//    (повторный тап — закрыть), раньше была только по наведению мыши.
// ========================================================

// Красиво форматирует число бонуса.
function formatBonusPercent(value) {
  if (value === undefined || value === null) return '0';
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

// Текущее состояние: сколько XP и какой уровень.
function getWeaponXP(category) {
  const ws = state.player.weaponSkills[category];
  return ws ? ws.xp : 0;
}

function getElementXP(elementId) {
  const e = state.player.elements[elementId];
  return e ? e.xp : 0;
}

// Полоска прогресса: сколько XP до следующего уровня и процент.
function getWeaponProgress(category) {
  const lvl = getWeaponSkillLevel(category);
  const xp = getWeaponXP(category);

  if (lvl >= WEAPON_MAX_LEVEL) {
    return { current: xp, needed: xp, percent: 100, isMax: true };
  }

  const prevThreshold = lvl === 0 ? 0 : WEAPON_XP_THRESHOLDS[lvl - 1];
  const nextThreshold = WEAPON_XP_THRESHOLDS[lvl];
  const current = xp - prevThreshold;
  const needed = nextThreshold - prevThreshold;
  const percent = Math.max(0, Math.min(100, (current / needed) * 100));
  return { current, needed, percent, isMax: false };
}

function getElementProgress(elementId) {
  const lvl = getElementLevel(elementId);
  const xp = getElementXP(elementId);

  if (lvl >= ELEMENT_MAX_LEVEL) {
    return { current: xp, needed: xp, percent: 100, isMax: true };
  }

  const prevThreshold = lvl === 0 ? 0 : ELEMENT_XP_THRESHOLDS[lvl - 1];
  const nextThreshold = ELEMENT_XP_THRESHOLDS[lvl];
  const current = xp - prevThreshold;
  const needed = nextThreshold - prevThreshold;
  const percent = Math.max(0, Math.min(100, (current / needed) * 100));
  return { current, needed, percent, isMax: false };
}

// Одна строка навыка (оружие).
function buildWeaponRow(category) {
  const skill = WEAPON_SKILLS[category];
  const lvl = getWeaponSkillLevel(category);
  const bonus = getWeaponDamageBonus(category);
  const progress = getWeaponProgress(category);

  const isLearned = lvl > 0;
  const row = document.createElement('div');
  row.className = 'prof-row' + (isLearned ? ' learned' : '') + (progress.isMax ? ' maxed' : '');
  row.innerHTML = `
    <div class="prof-icon"><img src="${skill.icon}" alt=""></div>
    <div class="prof-body">
      <div class="prof-header">
        <span class="prof-name">${skill.name}</span>
        <span class="prof-level">Ур. ${lvl} / ${WEAPON_MAX_LEVEL}</span>
      </div>
      <div class="prof-bar"><div class="prof-bar-fill" style="width:${progress.percent}%"></div></div>
      <div class="prof-footer">
        <span class="prof-xp">${progress.isMax ? 'МАКСИМУМ' : `${progress.current} / ${progress.needed}`}</span>
        <span class="prof-bonus">+${formatBonusPercent(bonus)}% урона</span>
      </div>
    </div>
  `;
  attachProfTooltip(row, (e) => showProfTooltip(e, skill, lvl, progress, bonus, 'weapon'));
  return row;
}

// Одна строка стихии.
function buildElementRow(elementId) {
  const el = ELEMENTS[elementId];
  const lvl = getElementLevel(elementId);
  const bonus = getElementDamageBonus(elementId);
  const progress = getElementProgress(elementId);

  const isLearned = lvl > 0;
  const row = document.createElement('div');
  row.className = 'prof-row' + (isLearned ? ' learned' : '') + (progress.isMax ? ' maxed' : '');
  row.innerHTML = `
    <div class="prof-icon"><img src="${el.icon}" alt=""></div>
    <div class="prof-body">
      <div class="prof-header">
        <span class="prof-name">${el.name}</span>
        <span class="prof-level">Ур. ${lvl} / ${ELEMENT_MAX_LEVEL}</span>
      </div>
      <div class="prof-bar"><div class="prof-bar-fill" style="width:${progress.percent}%"></div></div>
      <div class="prof-footer">
        <span class="prof-xp">${progress.isMax ? 'МАКСИМУМ' : `${progress.current} / ${progress.needed}`}</span>
        <span class="prof-bonus">+${formatBonusPercent(bonus)}% урона</span>
      </div>
    </div>
  `;
  attachProfTooltip(row, (e) => showProfTooltip(e, el, lvl, progress, bonus, 'element'));
  return row;
}

// v0.29: подсказка и на телефоне. Раньше была только по наведению мыши:
// тап давал «наведение», и следующий за ним клик сразу прятал тултип.
// Теперь клик/тап по строке показывает подсказку (повторный — прячет).
let __profTipRow = null;
function attachProfTooltip(row, show) {
  row.onmouseenter = (e) => { if (!profTouchLike()) { __profTipRow = row; show(e); } };
  row.onmouseleave = () => { if (!profTouchLike()) { __profTipRow = null; hideTooltip(); } };
  row.onclick = (e) => {
    e.stopPropagation();   // общий click по документу прячет тултип — тут он не нужен
    const tt = document.getElementById('item-tooltip');
    if (__profTipRow === row && tt && tt.style.display === 'block' && profTouchLike()) {
      __profTipRow = null;
      hideTooltip();
      return;
    }
    __profTipRow = row;
    show(e);
  };
}

function profTouchLike() {
  return window.matchMedia('(hover: none)').matches;
}

// Тултип при наведении на строку владения.
function showProfTooltip(e, data, lvl, progress, bonus, kind) {
  const tt = document.getElementById('item-tooltip');
  let lines = `<div class="tt-name">${data.name}</div>`;
  lines += `<div class="tt-line type">${data.desc}</div>`;
  lines += `<div class="tt-line stat">Уровень: ${lvl} / ${kind === 'weapon' ? WEAPON_MAX_LEVEL : ELEMENT_MAX_LEVEL}</div>`;
  if (!progress.isMax) {
    lines += `<div class="tt-line next">Прогресс: ${progress.current} / ${progress.needed} (до след. ур.)</div>`;
  } else {
    lines += `<div class="tt-line maxed">МАКСИМАЛЬНЫЙ УРОВЕНЬ</div>`;
  }
  lines += `<div class="tt-line effect">Бонус к урону: +${formatBonusPercent(bonus)}%</div>`;
  tt.innerHTML = lines;
  tt.style.display = 'block';
  // v0.29: держим тултип в пределах экрана (на телефоне 340 px — почти вся ширина)
  const w = tt.offsetWidth || 320, h = tt.offsetHeight || 200;
  tt.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, e.clientX + 15)) + 'px';
  tt.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, e.clientY + 15)) + 'px';

  // Авто-скрытие через 7 секунд (общий таймер из tooltips.js).
  if (typeof resetTooltipTimer === 'function') resetTooltipTimer();
}

// Главная функция: рисует всю вкладку.
function renderProficiencyPanel() {
  const weaponsBox = document.getElementById('prof-weapons-list');
  const elementsBox = document.getElementById('prof-elements-list');
  if (!weaponsBox || !elementsBox) return;

  weaponsBox.innerHTML = '';
  WEAPON_SKILL_ORDER.forEach(id => {
    weaponsBox.appendChild(buildWeaponRow(id));
  });

  elementsBox.innerHTML = '';
  ELEMENT_ORDER.forEach(id => {
    elementsBox.appendChild(buildElementRow(id));
  });
}