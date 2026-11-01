// ========================================================
//  СИСТЕМЫ: ЭКРАН СТАРТА + ЭКРАН СОЗДАНИЯ ПЕРСОНАЖА
//  НОВОЕ (v0.13m): миграция локальных сейвов в облако.
//  НОВОЕ (v0.13o): кнопка ЧИТ видна только админам.
//  НОВОЕ (v0.15): кнопка 🏆 (рейтинг) видна только залогиненным.
//  НОВОЕ (v0.15): имя персонажа обязательно (от 2 до 16 символов).
//    Поле имени пустое, кнопка «Создать» заблокирована,
//    пока игрок не введёт имя и не выберет класс.
// ========================================================

let pendingSlotIndex = null;
let pendingClassId = null;
let pendingRaceId = 'human';

// ========================================================
//  ЭКРАН СТАРТА
// ========================================================

function showStartScreen() {
  document.getElementById('start-screen').classList.add('active');
  renderSlots();
  if (typeof renderPatchTabs === 'function') renderPatchTabs();
  if (typeof renderCloudAuth === 'function') renderCloudAuth();
  updateCloudAccessGate();

  // НОВОЕ (v0.13o): показать/скрыть кнопку «ЧИТ».
  if (typeof updateCheatButtonVisibility === 'function') {
    updateCheatButtonVisibility();
  }

  // НОВОЕ (v0.15): показать/скрыть кнопку 🏆 (рейтинг).
  if (typeof updateLeaderboardButtonVisibility === 'function') {
    updateLeaderboardButtonVisibility();
  }

  if (typeof cloudPrefetchSlots === 'function' && typeof cloudIsReady === 'function' && cloudIsReady()) {
    cloudPrefetchSlots().then(() => {
      const startScreen = document.getElementById('start-screen');
      if (startScreen && startScreen.classList.contains('active')) {
        renderSlots();
        updateCloudAccessGate();

        if (typeof cloudTryShowMigrationModal === 'function') {
          cloudTryShowMigrationModal();
        }

        if (typeof updateCheatButtonVisibility === 'function') {
          updateCheatButtonVisibility();
        }

        // НОВОЕ (v0.15): обновить кнопку 🏆 после префетча.
        if (typeof updateLeaderboardButtonVisibility === 'function') {
          updateLeaderboardButtonVisibility();
        }
      }
    });
  }
}

function updateCloudAccessGate() {
  const gate = document.getElementById('cloud-access-gate');
  const slotsGrid = document.getElementById('slots-grid');
  if (!gate || !slotsGrid) return;

  const allowed = (typeof cloudIsAllowedToPlay === 'function')
    ? cloudIsAllowedToPlay()
    : true;

  if (allowed) {
    gate.style.display = 'none';
    gate.innerHTML = '';
    slotsGrid.style.display = 'grid';
    // ---- НОВОЕ (v0.15): обновить видимость кнопки рейтинга ----
    if (typeof updateLeaderboardButtonVisibility === 'function') {
      updateLeaderboardButtonVisibility();
    }
    return;
  }

  gate.style.display = 'block';
  gate.innerHTML = `
    <div class="cloud-gate-icon">🔒</div>
    <div class="cloud-gate-title">ВОЙДИТЕ В АККАУНТ</div>
    <div class="cloud-gate-text">
      Игра доступна только с аккаунтом.<br>
      Так прогресс сохраняется в облаке и защищён от потери.
    </div>
  `;
  slotsGrid.style.display = 'none';

  // ---- НОВОЕ (v0.15): обновить видимость кнопки рейтинга ----
  if (typeof updateLeaderboardButtonVisibility === 'function') {
    updateLeaderboardButtonVisibility();
  }
}

function hideStartScreen() {
  document.getElementById('start-screen').classList.remove('active');
}

function renderSlots() {
  const grid = document.getElementById('slots-grid');
  grid.innerHTML = '';

  const cloudSlots = (typeof cloudGetCachedSlots === 'function') ? cloudGetCachedSlots() : {};

  for (let i = 0; i < SLOT_COUNT; i++) {
    const localMeta = readSlotMeta(i);
    const cloudSlot = cloudSlots[i] || null;

    const hasLocal = localMeta.used;
    const hasCloud = !!cloudSlot;

    let displayMeta = null;
    let source = 'none';

    if (hasLocal) {
      displayMeta = localMeta;
      source = hasCloud ? 'both' : 'local';
    } else if (hasCloud) {
      const cloudData = cloudSlot.data || {};
      const p = cloudData.player || {};
      displayMeta = {
        used: true,
        name: p.name || 'Безымянный',
        classId: p.classId || null,
        raceId: p.raceId || 'human',
        level: p.level || 1,
      };
      source = 'cloud';
    }

    const card = document.createElement('div');

    if (!displayMeta) {
      card.className = 'slot-card empty';
      card.innerHTML = `
        <div class="slot-plus">+</div>
        <div class="slot-empty-text">Создать</div>
        <div class="slot-number">${i + 1}</div>
      `;
      card.onclick = () => onSlotClick(i, false);
    } else {
      card.className = 'slot-card filled';
      const cls = CLASSES[displayMeta.classId];
      const race = RACES[displayMeta.raceId] || RACES.human;
      const portrait = getRaceIcon(displayMeta.raceId, displayMeta.classId);

      let sourceBadge = '';
      if (source === 'both') {
        sourceBadge = '<div class="slot-cloud-badge" title="Есть и локально, и в облаке">☁️</div>';
      } else if (source === 'cloud') {
        sourceBadge = '<div class="slot-cloud-badge cloud-only" title="Только в облаке — загрузится по клику">☁️</div>';
      } else if (source === 'local') {
        sourceBadge = '<div class="slot-cloud-badge local-only" title="Только локально — залейте в облако">💾</div>';
      }

      const deleteBtn = hasLocal
        ? `<button class="slot-delete" title="Удалить персонажа" data-slot="${i}">×</button>`
        : '';

      card.innerHTML = `
        ${deleteBtn}
        ${sourceBadge}
        <div class="slot-portrait" style="background-image:url('${portrait}')"></div>
        <div class="slot-info">
          <div class="slot-name">${displayMeta.name}</div>
          <div class="slot-race">${race.name}</div>
          <div class="slot-class">${cls ? cls.name : '—'} · Ур. ${displayMeta.level}</div>
        </div>
        <div class="slot-number">${i + 1}</div>
      `;

      if (hasLocal) {
        card.onclick = () => onSlotClick(i, true);
        const delBtn = card.querySelector('.slot-delete');
        if (delBtn) {
          delBtn.onclick = (e) => {
            e.stopPropagation();
            onSlotDelete(i);
          };
        }
      } else {
        card.onclick = () => loadSlotFromCloudAndStart(i);
      }
    }

    grid.appendChild(card);
  }
}

function onSlotClick(slotIndex, isUsed) {
  if (!isUsed) {
    openCreateScreen(slotIndex);
    return;
  }

  if (typeof cloudIsReady === 'function' && cloudIsReady() && typeof cloudCompareSlots === 'function') {
    const cmp = cloudCompareSlots(slotIndex);

    if (cmp && cmp.status === 'both-diff') {
      handleSlotConflict(slotIndex, cmp);
      return;
    }
  }

  loadSlotAndStart(slotIndex);
}

function handleSlotConflict(slotIndex, cmp) {
  if (typeof cloudShowConflictModal !== 'function') {
    loadSlotAndStart(slotIndex);
    return;
  }

  cloudShowConflictModal(
    slotIndex,
    (source) => {
      if (source === 'cloud') {
        loadSlotFromCloudAndStartOverwrite(slotIndex);
      } else {
        loadSlotAndStart(slotIndex);
      }
    },
    () => {}
  );
}

function onSlotDelete(slotIndex) {
  if (!confirm(`Удалить персонажа из ячейки ${slotIndex + 1}? Это действие необратимо.`)) return;
  deleteSlot(slotIndex);
  renderSlots();
}

// opts.resume — страница обновлена посреди игры (mobile.js): вернуть героя в охоту.
function loadSlotAndStart(slotIndex, opts) {
  const saved = readSlot(slotIndex);
  if (!saved) { alert('Сохранение не найдено'); return; }

  Object.assign(state.player, saved.player);
  // v0.26: метка чита — только своя (у старого сейва поля нет, прошлый герой не должен «передать» её)
  state.player.usedCheat = !!(saved.player && saved.player.usedCheat);
  if (saved.battle) Object.assign(state.battle, saved.battle);

  // v0.24: бой из сейва не продолжается — иначе герой «в бою» без окна боя и ничего нельзя сделать.
  const resumeTarget = takeSavedBattle(!!(opts && opts.resume));
  state.cheat = saved.cheat || false;
  state.activeSlotIndex = slotIndex;

  migrateOldPatchedSet();

  // v0.25: вехи бижутерии — опыт и мастерство вместо маг. защиты (старые вещи пересчитываем)
  const jewelryChanged = migrateJewelryList(Object.values(state.player.equipment)) | migrateJewelryList(state.player.inventory);
  // v0.25: новые статы оружия (Т3 сильнее, жезлам — реген маны) — и для уже скрафченного
  const weaponsChanged = migrateWeaponList(Object.values(state.player.equipment)) | migrateWeaponList(state.player.inventory);
  // v0.26: свиток телепортации убран — за свитки в сумке возвращаем Оболы
  if (typeof refundTeleportScrolls === 'function') refundTeleportScrolls();
  // v0.25: HP/MP/реген подгонки растут с тиром — старые броски пересчитываем по тиру вещи
  const refineFlatChanged = migrateRefineFlatList(Object.values(state.player.equipment)) | migrateRefineFlatList(state.player.inventory);
  if (typeof loadStorage === 'function') {
    const store = loadStorage();
    if (migrateJewelryList(store) | migrateWeaponList(store) | migrateRefineFlatList(store)) writeStorageLocal(store, getStorageLocalUpdatedAt() || undefined);
  }
  if (weaponsChanged) setTimeout(() => logLoot('⚔ Статы оружия обновлены под новый баланс.', 'log-info'), 1600);
  if (refineFlatChanged) setTimeout(() => logLoot('🔧 Бонусы подгонки HP, MP и реген пересчитаны: на вещах тира 2 и выше они теперь больше.', 'log-info'), 1700);
  if (jewelryChanged) setTimeout(() => {
    showToast('💍', 'Бижутерия пересчитана: вехи подгонки теперь дают опыт и мастерство');
    logLoot('💍 Вехи подгонки бижутерии теперь дают опыт (ожерелья), мастерство (кольца) и одно из двух (серьги) вместо маг. защиты.', 'log-info');
  }, 1500);

  if (state.player.lootFilterLevel === undefined)  state.player.lootFilterLevel = 0;
  if (state.player.craftFilterLevel === undefined) state.player.craftFilterLevel = 0;
  if (state.player.cheatRate === undefined) state.player.cheatRate = 1;
  if (state.player.stackCap === undefined) state.player.stackCap = 3;

  // НОВОЕ (v0.13o): если игрок НЕ админ — принудительно cheatRate = 1.
  if (typeof cloudIsAdmin === 'function' && !cloudIsAdmin()) {
    state.player.cheatRate = 1;
    state.cheat = false;
  }

  if (typeof migrateSkillSlots === 'function') {
    migrateSkillSlots();
  }

  if (typeof getXpForLevel === 'function') {
    if (state.player.level >= MAX_PLAYER_LEVEL) {
      state.player.xpNext = Infinity;
    } else {
      state.player.xpNext = getXpForLevel(state.player.level + 1);
    }
    if (typeof checkLevelUp === 'function') checkLevelUp();
  }

  if (!state.player.classId) {
    openCreateScreen(slotIndex);
    return;
  }

  hideStartScreen();
  initGame();

  if (opts && opts.resume) {
    showToast('🔄', 'Вы снова в игре');
    if (resumeTarget) setTimeout(() => resumeBattleAfterReload(resumeTarget), 800);
    // v0.24: обновили страницу на привале — снова показываем привал
    else if (state.battle.waitingForResume && typeof enterRestCamp === 'function') setTimeout(() => enterRestCamp(true), 800);
  }

  if (state.player.currentLocation === 'town' && typeof tryAutoStartElderDialogue === 'function') {
    tryAutoStartElderDialogue();
  }
}

async function loadSlotFromCloudAndStart(slotIndex) {
  if (typeof cloudFetchSlot !== 'function') {
    alert('Облако недоступно');
    return;
  }

  if (typeof showToast === 'function') showToast('☁️', 'Загружаем слот из облака...');

  const res = await cloudFetchSlot(slotIndex);
  if (!res || !res.ok) {
    alert('Не удалось загрузить слот из облака. Проверьте интернет.');
    return;
  }
  if (!res.data) {
    alert('В облаке нет этого слота.');
    return;
  }

  writeSlot(slotIndex, res.data);

  if (typeof showToast === 'function') showToast('☁️', 'Слот загружен из облака');

  loadSlotAndStart(slotIndex);
}

async function loadSlotFromCloudAndStartOverwrite(slotIndex) {
  if (typeof cloudFetchSlot !== 'function') {
    alert('Облако недоступно');
    return;
  }

  if (typeof showToast === 'function') showToast('☁️', 'Загружаем облачный сейв...');

  const res = await cloudFetchSlot(slotIndex);
  if (!res || !res.ok) {
    alert('Не удалось загрузить слот из облака. Проверьте интернет.');
    return;
  }
  if (!res.data) {
    alert('В облаке нет этого слота.');
    return;
  }

  writeSlot(slotIndex, res.data);

  if (typeof showToast === 'function') showToast('☁️', 'Облачный сейв загружен');

  loadSlotAndStart(slotIndex);
}

// ========================================================
//  ЭКРАН СОЗДАНИЯ ПЕРСОНАЖА
// ========================================================

function openCreateScreen(slotIndex) {
  pendingSlotIndex = slotIndex;
  pendingClassId = null;
  pendingRaceId = 'human';

  document.getElementById('start-screen').classList.remove('active');
  document.getElementById('create-screen').classList.add('active');

  const nameInput = document.getElementById('char-name-input');
  if (nameInput) {
    // ---- НОВОЕ (v0.15): поле пустое, реагируем на ввод ----
    nameInput.value = '';
    nameInput.oninput = updateCreateButton;
  }

  renderCreateScreen();
}

function closeCreateScreen() {
  document.getElementById('create-screen').classList.remove('active');
  showStartScreen();
}

function renderCreateScreen() {
  const racesBox = document.getElementById('races-list');
  racesBox.innerHTML = '';

  const raceIcon = getRaceIcon(pendingRaceId, pendingClassId);

  Object.values(RACES).forEach(race => {
    const el = document.createElement('div');
    const isSelected = (pendingRaceId === race.id);
    el.className = 'create-option race-option'
      + (race.available ? '' : ' disabled')
      + (isSelected ? ' selected' : '');

    let portraitStyle;
    if (race.available) {
      const icon = isSelected ? raceIcon : race.icon;
      portraitStyle = `background-image:url('${icon}')`;
    } else {
      portraitStyle = `background: repeating-linear-gradient(45deg, #1a1a22, #1a1a22 8px, #0d0d10 8px, #0d0d10 16px)`;
    }

    el.innerHTML = `
      <div class="create-portrait" style="${portraitStyle}"></div>
      <div class="create-name">${race.name}</div>
      <div class="create-desc">${race.desc}</div>
    `;
    if (race.available) {
      el.onclick = () => { pendingRaceId = race.id; renderCreateScreen(); };
    }
    racesBox.appendChild(el);
  });

  const classesBox = document.getElementById('classes-list');
  classesBox.innerHTML = '';

  ['warrior', 'mage'].forEach(classId => {
    const cls = CLASSES[classId];
    const isSelected = (pendingClassId === classId);
    const stats = getRaceClassStats(pendingRaceId, classId) || cls.stats;

    const el = document.createElement('div');
    el.className = 'create-option class-option' + (isSelected ? ' selected' : '');

    el.innerHTML = `
      <div class="create-portrait" style="background-image:url('img/classes/${classId}.png')"></div>
      <div class="create-name">${cls.name}</div>
      <div class="create-desc">${cls.desc}</div>
      <div class="create-stats">
        СТР ${stats.STR} · ЛОВ ${stats.DEX} · ТЕЛ ${stats.CON}<br>
        ИНТ ${stats.INT} · МДР ${stats.WIT} · ДУХ ${stats.MEN}
      </div>
    `;
    el.onclick = () => { pendingClassId = classId; renderCreateScreen(); };
    classesBox.appendChild(el);
  });

  updateCreateButton();
}

// ---- НОВОЕ (v0.15): кнопка «Создать» учитывает и класс, и имя ----
function updateCreateButton() {
  const btn = document.getElementById('btn-create-char');
  if (!btn) return;

  const nameInput = document.getElementById('char-name-input');
  const name = (nameInput?.value || '').trim();

  const hasClass = !!pendingClassId;
  const hasName = name.length >= 2;

  if (!hasClass && !hasName) {
    btn.disabled = true;
    btn.textContent = 'Введите имя и выберите класс';
  } else if (!hasClass) {
    btn.disabled = true;
    btn.textContent = 'Выберите класс';
  } else if (!hasName) {
    btn.disabled = true;
    btn.textContent = 'Введите имя (от 2 символов)';
  } else {
    btn.disabled = false;
    btn.textContent = 'Создать персонажа';
  }
}

function confirmCreateCharacter() {
  if (!pendingClassId) return;
  if (pendingSlotIndex === null) return;

  const nameInput = document.getElementById('char-name-input');
  let name = (nameInput?.value || '').trim();

  // ---- НОВОЕ (v0.15): имя обязательно, от 2 до 16 символов ----
  if (name.length < 2) {
    if (typeof showToast === 'function') {
      showToast('⚠', 'Имя должно быть от 2 до 16 символов');
    }
    return;
  }
  if (name.length > 16) {
    name = name.slice(0, 16);
  }

  resetStateToFresh();

  const stats = getRaceClassStats(pendingRaceId, pendingClassId) || CLASSES[pendingClassId].stats;

  state.player.classId = pendingClassId;
  state.player.raceId = pendingRaceId;
  state.player.name = name;
  state.player.STR = stats.STR;
  state.player.DEX = stats.DEX;
  state.player.CON = stats.CON;
  state.player.INT = stats.INT;
  state.player.WIT = stats.WIT;
  state.player.MEN = stats.MEN;
  state.player.skillPoints = 1;

  if (typeof getXpForLevel === 'function') {
    state.player.xpNext = getXpForLevel(2);
  } else {
    state.player.xpNext = 100;
  }

  recalcStats();
  state.player.hp = state.player.maxHp;
  state.player.mp = state.player.maxMp;

  state.activeSlotIndex = pendingSlotIndex;
  saveCurrentSlot();

  document.getElementById('create-screen').classList.remove('active');
  initGame();

  if (typeof tryAutoStartElderDialogue === 'function') {
    tryAutoStartElderDialogue();
  }
}

function resetStateToFresh() {
  state.player.classId = null;
  state.player.raceId = null;
  state.player.name = 'Воич';
  state.player.level = 1;
  state.player.xp = 0;
  state.player.xpNext = 100;
  state.player.hp = 0; state.player.maxHp = 0;
  state.player.mp = 0; state.player.maxMp = 0;
  state.player.STR = 0; state.player.DEX = 0; state.player.CON = 0;
  state.player.INT = 0; state.player.WIT = 0; state.player.MEN = 0;
  state.player.gold = 1000;
  state.player.cheatRate = 1;
  state.player.usedCheat = false;   // v0.26
  state.player.inventory = [];
  state.player.equipment = {
    earring1: null, earring2: null, necklace: null,
    helmet: null, armorTop: null, armorBottom: null,
    gloves: null, boots: null,
    ring1: null, ring2: null,
    weapon: null, shield: null,
  };
  state.player.potionSlot = null;
  state.player.mixtureSlot = null;
  state.player.potionThreshold = 40;

  state.player.stopHpPercent   = 0;
  state.player.stopMpPercent   = 0;
  state.player.resumeHpPercent = 0;
  state.player.resumeMpPercent = 0;

  state.player.lootFilterLevel  = 0;
  state.player.craftFilterLevel = 0;
  state.player.stackCap = 3;

  state.player.learnedSkills = {};
  state.player.skillPoints = 0;

  state.player.skillSlots = [null, null, null];

  state.player.currentLocation = 'town';
  state.player.foodTimer = 0;
  state.player.foodTickAccum = 0;
  state.player.dish = null;
  state.player.guildBuffs = {};
  state.player.tavernBuffs = {};
  state.player.weaponSkills = {};
  state.player.elements = {};
  state.player.monsterKills = {};

  state.battle.active = false;
  state.battle.monsters = [];
  state.battle.monstersATB = 0;
  state.battle.repeatCount = 1;
  state.battle.autoBattle = true;
  state.battle.repeatBattle = false;
  state.battle.playerATB = 0;
  state.battle.skillToggles = {};
  state.battle.skillCooldowns = {};
  state.battle.consumables = { healPotion: { enabled: true }, atkMixture: { enabled: true } };
  state.battle.activeEffects = { healPotionUsed: false, mixture: null };
  state.battle.debuffs = { monsters: {}, player: {} };

  state.battle.waitingForResume = false;
  state.battle.waitingTemplate = null;

  state.travel = { active: false, timer: 0, duration: 0, destination: null };
  state.currentInventoryPage = 0;
  state.activeSlotIndex = null;
  state.cheat = false;
}