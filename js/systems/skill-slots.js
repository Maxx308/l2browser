// ========================================================
//  СИСТЕМЫ: СЛОТЫ АКТИВНЫХ НАВЫКОВ
//  Два места:
//  1) В БОЮ — колонка слева от аватара (3 фиксированных слота).
//     Клик по слоту = ВКЛ/ВЫКЛ. Правый клик = ВКЛ/ВЫКЛ.
//     Drag & drop — поменять порядок прямо в бою.
//  2) В ПАНЕЛИ «ИНВЕНТАРЬ» — блок под расходниками (3 ячейки).
//     Клик по ячейке = открыть модалку выбора навыка.
//     Стрелки ↑ ↓ × — поменять порядок / очистить.
//
//  Данные: state.player.skillSlots = [id, id, id | null].
//  Порядок срабатывания в бою: сверху вниз (0 → 1 → 2).
//
//  НОВОЕ (v0.09):
//  + 3 фиксированных слота (а не «сколько выучил»).
//  + Модалка выбора навыка (skill-picker).
//  + Стрелки ↑↓× под ячейками.
//  + Drag & drop в бою.
//  + Автопостановка при изучении (см. mentor.js).
// ========================================================

const SKILL_SLOT_COUNT = 3;

// Текущий выбранный слот в панели «Инвентарь» (для стрелок).
let __selectedSkillSlot = null;

// Индекс слота, по которому открыта модалка.
let __skillPickerSlot = null;

// Индекс слота, откуда тащат (для drag&drop в бою).
let __dragFromSlot = null;

// ========================================================
//  БОЕВАЯ КОЛОНКА (слева от аватара)
// ========================================================

function renderSkillSlots() {
  const col = document.getElementById('skills-column');
  if (!col) return;

  col.innerHTML = '<div class="skills-column-title">НАВЫКИ</div>';

  const p = state.player;
  const slots = p.skillSlots || [null, null, null];

  for (let i = 0; i < SKILL_SLOT_COUNT; i++) {
    const skillId = slots[i];
    const skill = skillId ? SKILLS[skillId] : null;

    const isValid = skill && skill.type === 'active' && p.learnedSkills[skillId] > 0;

    const slot = document.createElement('div');

    if (!isValid) {
      slot.className = 'skill-slot not-learned';
      slot.innerHTML = '';

      // Пустой слот тоже можно принять drag.
      setupDragTarget(slot, i);
      col.appendChild(slot);
      continue;
    }

    const lvl = getSkillLevel(skillId);
    const enabled = state.battle.skillToggles[skillId] !== false;
    const cd = state.battle.skillCooldowns[skillId] || 0;

    slot.className = 'skill-slot learned';
    if (enabled) slot.classList.add('active');
    if (cd > 0) slot.classList.add('cooldown');

    slot.innerHTML = `
      ${skill.icon || ''}
      <div class="skill-level-badge">${lvl}</div>
      ${cd > 0 ? `<div class="skill-cd-overlay" style="--cd:${Math.min(1, cd / (skill.cooldown || cd))}">${Math.ceil(cd)}</div>` : ''}
      <div class="skill-toggle-label">${enabled ? 'ВКЛ' : 'ВЫКЛ'}</div>
    `;

    // Правый клик — ВКЛ/ВЫКЛ.
    slot.oncontextmenu = (e) => {
      e.preventDefault();
      toggleSkill(skillId);
    };

    // Левый клик — ВКЛ/ВЫКЛ (как раньше).
    slot.onclick = () => toggleSkill(skillId);

    // Тултип скилла — как раньше.
    slot.onmouseenter = (e) => showSkillTooltip(e, skill);
    slot.onmouseleave = () => hideTooltip();

    // Drag & drop: слот — источник.
    setupDragSource(slot, i);

    // Drag & drop: слот — цель.
    setupDragTarget(slot, i);

    col.appendChild(slot);
  }
}

// --------------------------------------------------------
//  DRAG & DROP (в бою)
// --------------------------------------------------------
function setupDragSource(el, slotIndex) {
  el.draggable = true;
  el.addEventListener('dragstart', (e) => {
    __dragFromSlot = slotIndex;
    el.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(slotIndex));
  });
  el.addEventListener('dragend', () => {
    __dragFromSlot = null;
    el.style.opacity = '';
    // Убираем подсветку со всех слотов.
    document.querySelectorAll('.skill-slot').forEach(s => s.classList.remove('drag-over'));
  });
}

function setupDragTarget(el, slotIndex) {
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    el.classList.add('drag-over');
  });
  el.addEventListener('dragleave', () => {
    el.classList.remove('drag-over');
  });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drag-over');

    if (__dragFromSlot === null) return;
    const from = __dragFromSlot;
    const to = slotIndex;
    __dragFromSlot = null;

    if (from === to) return;

    swapSkillSlots(from, to);
    renderSkillSlots();
    renderSkillLoadout();
  });
}

// --------------------------------------------------------
//  ВКЛ/ВЫКЛ НАВЫКА
// --------------------------------------------------------
function toggleSkill(skillId) {
  const cur = state.battle.skillToggles[skillId] !== false;
  state.battle.skillToggles[skillId] = !cur;
  renderSkillSlots();
}

// ========================================================
//  ПАНЕЛЬ «ИНВЕНТАРЬ» — БЛОК «НАВЫКИ»
// ========================================================

function renderSkillLoadout() {
  const box = document.getElementById('skill-loadout');
  if (!box) return;

  box.innerHTML = '';

  const p = state.player;
  const slots = p.skillSlots || [null, null, null];

  for (let i = 0; i < SKILL_SLOT_COUNT; i++) {
    const skillId = slots[i];
    const skill = skillId ? SKILLS[skillId] : null;
    const isValid = skill && skill.type === 'active' && p.learnedSkills[skillId] > 0;

    const el = document.createElement('div');

    if (!isValid) {
      // Пустая ячейка.
      el.className = 'skill-loadout-slot empty';
      if (__selectedSkillSlot === i) el.classList.add('selected');
      el.innerHTML = `<div class="slot-number">${i + 1}</div>`;
    } else {
      const lvl = getSkillLevel(skillId);
      el.className = 'skill-loadout-slot filled';
      if (__selectedSkillSlot === i) el.classList.add('selected');
      el.innerHTML = `
        <div class="slot-number">${i + 1}</div>
        ${skill.icon || ''}
        <div class="skill-level-badge">${lvl}</div>
      `;
      el.onmouseenter = (e) => showSkillTooltip(e, skill);
      el.onmouseleave = () => hideTooltip();
    }

    // Клик по ячейке — выбрать слот + открыть модалку.
    el.onclick = () => {
      __selectedSkillSlot = i;
      updateSkillLoadoutControls();
      renderSkillLoadout();
      openSkillPicker(i);
    };

    box.appendChild(el);
  }

  updateSkillLoadoutControls();
}

// Показать/обновить стрелки ↑↓× под ячейками.
function updateSkillLoadoutControls() {
  const ctr = document.getElementById('skill-loadout-controls');
  if (!ctr) return;

  if (__selectedSkillSlot === null) {
    ctr.style.display = 'none';
    return;
  }

  const slots = state.player.skillSlots || [null, null, null];
  const skillId = slots[__selectedSkillSlot];
  const hasSkill = skillId && state.player.learnedSkills[skillId];

  // Если ячейка пустая — показываем только подсказку.
  ctr.style.display = 'flex';

  // Кнопки ↑ ↓ блокируем на краях и на пустой ячейке.
  const btnUp = ctr.querySelector('button:nth-child(1)');
  const btnDown = ctr.querySelector('button:nth-child(2)');
  const btnClear = ctr.querySelector('button:nth-child(3)');

  if (btnUp) btnUp.disabled = (!hasSkill) || (__selectedSkillSlot === 0);
  if (btnDown) btnDown.disabled = (!hasSkill) || (__selectedSkillSlot === SKILL_SLOT_COUNT - 1);
  if (btnClear) btnClear.disabled = !hasSkill;
}

// --------------------------------------------------------
//  ПЕРЕНОС / ОБМЕН СЛОТОВ
// --------------------------------------------------------
function swapSkillSlots(from, to) {
  const p = state.player;
  if (!Array.isArray(p.skillSlots)) p.skillSlots = [null, null, null];
  if (from < 0 || from >= SKILL_SLOT_COUNT) return;
  if (to < 0 || to >= SKILL_SLOT_COUNT) return;

  const a = p.skillSlots[from];
  p.skillSlots[from] = p.skillSlots[to];
  p.skillSlots[to] = a;

  if (typeof saveCurrentSlot === 'function') saveCurrentSlot();
}

// Стрелка ↑ (сдвиг вверх / влево по индексу).
function moveSelectedSkill(direction) {
  if (__selectedSkillSlot === null) return;
  const target = __selectedSkillSlot + direction;
  if (target < 0 || target >= SKILL_SLOT_COUNT) return;

  swapSkillSlots(__selectedSkillSlot, target);
  __selectedSkillSlot = target;

  renderSkillLoadout();
  renderSkillSlots();
}

// Кнопка × — очистить слот.
function clearSelectedSkill() {
  if (__selectedSkillSlot === null) return;
  const p = state.player;
  if (!Array.isArray(p.skillSlots)) p.skillSlots = [null, null, null];

  p.skillSlots[__selectedSkillSlot] = null;

  if (typeof saveCurrentSlot === 'function') saveCurrentSlot();

  renderSkillLoadout();
  renderSkillSlots();
}

// ========================================================
//  МОДАЛКА ВЫБОРА НАВЫКА (skill-picker)
// ========================================================

function openSkillPicker(slotIndex) {
  const picker = document.getElementById('skill-picker');
  const body = document.getElementById('skill-picker-body');
  const title = document.getElementById('skill-picker-title');
  if (!picker || !body) return;

  __skillPickerSlot = slotIndex;

  const p = state.player;
  const currentId = (p.skillSlots && p.skillSlots[slotIndex]) || null;

  title.textContent = `ВЫБЕРИТЕ НАВЫК · СЛОТ ${slotIndex + 1}`;

  // Все доступные (изученные) активные скиллы для игрока.
  const allSkills = Object.values(SKILLS).filter(s => isSkillAvailableForPlayer(s, p));

  // Сортируем: сначала активные изученные, потом пассивные.
  const activeLearned = allSkills.filter(s => s.type === 'active' && p.learnedSkills[s.id] > 0);
  const passives      = allSkills.filter(s => s.type === 'passive' && p.learnedSkills[s.id] > 0);

  let html = '';

  if (activeLearned.length === 0 && passives.length === 0) {
    html = `<div class="skill-picker-empty">У вас ещё нет изученных навыков.<br>Обратитесь к Наставнику.</div>`;
    body.innerHTML = html;
    positionSkillPicker();
    picker.classList.add('active');
    return;
  }

  // ---- Активные ----
  if (activeLearned.length > 0) {
    activeLearned.forEach(skill => {
      html += buildSkillPickerRow(skill, currentId, slotIndex);
    });
  } else {
    html += `<div class="skill-picker-empty">Нет изученных активных навыков.</div>`;
  }

  // ---- Пассивные (только показать, нельзя выбрать) ----
  if (passives.length > 0) {
    html += `<div class="skill-picker-divider"></div>`;
    html += `<div class="slot-picker-section-label">Пассивные (нельзя в слот)</div>`;
    passives.forEach(skill => {
      html += buildPassivePickerRow(skill);
    });
  }

  body.innerHTML = html;

  positionSkillPicker();
  picker.classList.add('active');
}

function buildSkillPickerRow(skill, currentId, slotIndex) {
  const p = state.player;
  const lvl = p.learnedSkills[skill.id] || 0;

  // В каком слоте стоит сейчас?
  const inSlotIndex = (p.skillSlots || []).indexOf(skill.id);
  const isCurrent = (skill.id === currentId);
  const isInOther = (inSlotIndex >= 0 && inSlotIndex !== slotIndex);

  let cls = 'skill-picker-item';
  if (isCurrent) cls += ' current';
  if (isInOther) cls += ' in-other-slot';

  let subline = `Ур. ${lvl}`;
  if (isCurrent) subline = `Ур. ${lvl} · стоит в этом слоте`;
  else if (isInOther) subline = `Ур. ${lvl} · сейчас в слоте ${inSlotIndex + 1} (поменяем)`;

  return `
    <div class="${cls}" onclick="selectSkillForSlot('${skill.id}')">
      <div class="skill-picker-icon">${skill.icon || ''}</div>
      <div class="skill-picker-info">
        <div class="skill-picker-name">${skill.name}</div>
        <div class="skill-picker-type active-skill">${subline}</div>
      </div>
    </div>
  `;
}

function buildPassivePickerRow(skill) {
  const p = state.player;
  const lvl = p.learnedSkills[skill.id] || 0;
  return `
    <div class="skill-picker-item passive">
      <div class="skill-picker-icon">${skill.icon || ''}</div>
      <div class="skill-picker-info">
        <div class="skill-picker-name">${skill.name}</div>
        <div class="skill-picker-type passive-skill">Пассивный · Ур. ${lvl}</div>
      </div>
    </div>
  `;
}

// Клик по скиллу в модалке.
function selectSkillForSlot(skillId) {
  if (__skillPickerSlot === null) return;

  const p = state.player;
  if (!Array.isArray(p.skillSlots)) p.skillSlots = [null, null, null];

  const currentId = p.skillSlots[__skillPickerSlot];
  if (currentId === skillId) {
    // Уже стоит — просто закрываем.
    closeSkillPicker();
    return;
  }

  // Скилл уже стоит в другом слоте — обмен.
  const otherIdx = p.skillSlots.indexOf(skillId);
  if (otherIdx >= 0) {
    p.skillSlots[otherIdx] = currentId;
  }

  p.skillSlots[__skillPickerSlot] = skillId;

  if (typeof saveCurrentSlot === 'function') saveCurrentSlot();

  closeSkillPicker();
  renderSkillLoadout();
  renderSkillSlots();

  const skill = SKILLS[skillId];
  if (skill && typeof showToast === 'function') {
    showToast('🎯', `${skill.name} → слот ${__skillPickerSlot + 1}`);
  }
}

function closeSkillPicker() {
  const picker = document.getElementById('skill-picker');
  if (picker) picker.classList.remove('active');
  __skillPickerSlot = null;
}

function positionSkillPicker() {
  const picker = document.getElementById('skill-picker');
  if (!picker) return;

  picker.style.visibility = 'hidden';
  picker.style.left = '0px';
  picker.style.top = '0px';
  picker.classList.add('active');

  const pickerRect = picker.getBoundingClientRect();
  const margin = 12;

  // Показываем по центру по вертикали, чуть левее центра.
  const left = Math.max(margin, (window.innerWidth - pickerRect.width) / 2);
  const top  = Math.max(margin, (window.innerHeight - pickerRect.height) / 2);

  picker.style.left = left + 'px';
  picker.style.top  = top + 'px';
  picker.style.visibility = 'visible';
}

// Клик вне модалки — закрыть.
document.addEventListener('click', (e) => {
  const picker = document.getElementById('skill-picker');
  if (!picker || !picker.classList.contains('active')) return;
  if (picker.contains(e.target)) return;
  const cell = e.target.closest('.skill-loadout-slot');
  if (cell) return;
  closeSkillPicker();
});

// ========================================================
//  МИГРАЦИЯ (заполнить skillSlots при загрузке сейва)
// ========================================================
function migrateSkillSlots() {
  const p = state.player;

  if (!Array.isArray(p.skillSlots)) {
    p.skillSlots = [null, null, null];
  }
  while (p.skillSlots.length < SKILL_SLOT_COUNT) {
    p.skillSlots.push(null);
  }
  if (p.skillSlots.length > SKILL_SLOT_COUNT) {
    p.skillSlots.length = SKILL_SLOT_COUNT;
  }

  // Если слоты пустые — заполняем из изученных активных скиллов.
  const allEmpty = p.skillSlots.every(s => !s);
  if (!allEmpty) return;

  const activeSkills = Object.keys(p.learnedSkills)
    .filter(id => {
      const s = SKILLS[id];
      return s && s.type === 'active' && p.learnedSkills[id] > 0;
    });

  for (let i = 0; i < SKILL_SLOT_COUNT; i++) {
    p.skillSlots[i] = activeSkills[i] || null;
  }

  if (p.skillSlots.some(s => s)) {
    if (typeof showToast === 'function') {
      showToast('🎯', 'Навыки перенесены в слоты. Проверьте в Инвентаре.');
    }
  }
}

// ========================================================
//  АВТОПОСТАНОВКА ПРИ ИЗУЧЕНИИ НОВОГО СКИЛЛА
//  Вызывается из mentor.js → upgradeSkill.
// ========================================================
function tryAutoPlaceSkillInSlot(skillId) {
  const p = state.player;
  const skill = SKILLS[skillId];
  if (!skill || skill.type !== 'active') return;

  if (!Array.isArray(p.skillSlots)) p.skillSlots = [null, null, null];

  // Уже стоит где-то — ничего.
  if (p.skillSlots.indexOf(skillId) >= 0) return;

  // Ищем первый свободный слот.
  const idx = p.skillSlots.findIndex(s => !s);
  if (idx < 0) return; // все заняты — не трогаем

  p.skillSlots[idx] = skillId;

  if (typeof showToast === 'function') {
    showToast('🎯', `${skill.name} → слот ${idx + 1}`);
  }
}