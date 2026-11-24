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
let selectedStartSlot = null;

// ========================================================
//  ЭКРАН СТАРТА
// ========================================================

function showStartScreen() {
  if (document.getElementById('equip-compare')?.open) closeEquipmentComparison();
  document.getElementById('start-screen').classList.add('active');
  if (typeof slotsClaimForAccount === 'function') slotsClaimForAccount();   // v0.36.4: чужих героев не показываем
  renderSlots();
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
  const start = document.getElementById('start-screen');
  const allowed = typeof cloudIsAllowedToPlay !== 'function' || cloudIsAllowedToPlay();
  start.classList.toggle('launcher', !allowed);
  document.getElementById('start-entrance').hidden = allowed;
  document.getElementById('start-roster').hidden = !allowed;
  document.getElementById('start-account-button').hidden = !allowed;
  if (typeof updateGuestChip === 'function') updateGuestChip();
  if (typeof updateLeaderboardButtonVisibility === 'function') updateLeaderboardButtonVisibility();
}

// Скриншоты открываются из подвала по запросу игрока.
const START_SHOTS = [
  { src: 'img/start/battle.webp', cap: 'Бой со стаей: навыки, криты, кровотечение' },
  { src: 'img/start/beasts.webp', cap: 'У каждой твари свои приёмы и добыча' },
  { src: 'img/start/gear.webp',   w: 704,  h: 651, cap: 'Снаряжение: редкость, подгонка до +15, фишки тиров' },
  { src: 'img/start/forge.webp',  w: 989,  h: 925, cap: 'Кузница: добыча превращается в ресурсы' },
  { src: 'img/start/craft.webp',  w: 944,  h: 653, cap: 'Комплекты доспехов из редких материалов' },
];

function openStartShot() {
  const gallery = document.getElementById('start-shot-view');
  showStartShot(0);
  gallery.showModal();
}

function moveStartShot(step) {
  const gallery = document.getElementById('start-shot-view');
  showStartShot(Number(gallery.dataset.index) + step);
}

function showStartShot(index) {
  const gallery = document.getElementById('start-shot-view');
  const position = (index + START_SHOTS.length) % START_SHOTS.length;
  const shot = START_SHOTS[position];
  const img = gallery.querySelector('img');
  img.src = shot.src;
  img.alt = shot.cap;
  gallery.dataset.index = position;
  gallery.querySelector('figcaption').textContent = `${shot.cap} · ${position + 1} из ${START_SHOTS.length}`;
}

document.getElementById('start-shot-view').addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') moveStartShot(-1);
  if (event.key === 'ArrowRight') moveStartShot(1);
});

function hideStartScreen() {
  const start = document.getElementById('start-screen');
  start.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  start.classList.remove('active');
}

function renderSlots() {
  const grid = document.getElementById('slots-grid');
  const active = document.activeElement;
  const focusedSlot = grid.contains(active) ? active.closest('[data-slot]')?.dataset.slot : null;
  const focusedAction = active?.dataset?.slotAction;
  const cloudSlots = typeof cloudGetCachedSlots === 'function' ? cloudGetCachedSlots() : {};
  const cards = document.createDocumentFragment();
  let freeSlot = null;

  for (let i = 0; i < SLOT_COUNT; i++) {
    const localMeta = readSlotMeta(i);
    const cloudPlayer = cloudSlots[i]?.data?.player;
    if (!localMeta.used && !cloudSlots[i]) {
      if (freeSlot === null) freeSlot = i;
      continue;
    }

    const meta = localMeta.used ? localMeta : (cloudPlayer || {});
    const name = meta.name || 'Безымянный';
    const safeName = escapeHtml(name);
    const race = RACES[meta.raceId] || RACES.human;
    const cls = CLASSES[meta.classId];
    const portrait = getHeroPortrait(race.id, meta.classId, meta.subclass);
    const subclass = SUBCLASSES[meta.subclass];
    const role = subclass?.race === race.id && subclass.cls === meta.classId ? subclass.name : cls?.name;

    let badge = '';
    if (cloudSlots[i]) {
      const title = localMeta.used ? 'Есть и локально, и в облаке' : 'Только в облаке';
      badge = `<span class="slot-cloud-badge" title="${title}" aria-label="${title}">☁</span>`;
    } else if (typeof cloudIsReady === 'function' && cloudIsReady()) {
      badge = '<span class="slot-cloud-badge local-only" title="Пока только на этом устройстве" aria-label="Пока только на этом устройстве">💾</span>';
    }

    let expedition = '';
    if (typeof expSlotBadgeHtml === 'function') {
      try {
        expedition = expSlotBadgeHtml(localMeta.used ? readSlot(i)?.player : cloudPlayer);
      } catch (e) { expedition = ''; }
    }

    const card = document.createElement('article');
    card.className = 'slot-card filled';
    card.dataset.slot = i;
    card.innerHTML = `
      <button type="button" class="slot-select" data-slot-action="select" aria-pressed="false">
        <img class="slot-portrait" src="${portrait}" alt="">
        <span class="slot-info">
          <span class="slot-name">${safeName}</span>
          <span class="slot-class">${race.name} · ${role || '—'} · Ур. ${Number(meta.level) || 1}</span>
        </span>
      </button>
      ${badge}
      <button type="button" class="slot-delete" data-slot-action="delete" title="Удалить персонажа" aria-label="Удалить персонажа ${safeName}">×</button>
      ${expedition}
      <button type="button" class="start-button primary slot-play" data-slot-action="play" hidden>Продолжить</button>
    `;
    card.querySelector('.slot-select').onclick = () => selectStartSlot(i);
    card.querySelector('.slot-play').onclick = () => localMeta.used ? onSlotClick(i, true) : loadSlotFromCloudAndStart(i);
    card.querySelector('.slot-delete').onclick = () => onSlotDelete(i, name);
    cards.appendChild(card);
  }

  if (freeSlot !== null) {
    const create = document.createElement('button');
    create.type = 'button';
    create.className = 'slot-card empty';
    create.dataset.slot = freeSlot;
    create.dataset.slotAction = 'create';
    create.innerHTML = '<span class="slot-plus" aria-hidden="true">+</span><span>Создать героя</span>';
    create.onclick = () => onSlotClick(freeSlot, false);
    cards.appendChild(create);
  }

  grid.replaceChildren(cards);
  const selected = grid.querySelector(`.filled[data-slot="${selectedStartSlot}"]`) || grid.querySelector('.filled');
  selectStartSlot(selected ? Number(selected.dataset.slot) : null);

  if (focusedSlot !== null && focusedAction) {
    const card = grid.querySelector(`[data-slot="${focusedSlot}"]`);
    const button = card?.dataset.slotAction === focusedAction ? card : card?.querySelector(`[data-slot-action="${focusedAction}"]`);
    button?.focus({ preventScroll: true });
  }
}

function selectStartSlot(index) {
  selectedStartSlot = index;
  document.querySelectorAll('#slots-grid .filled').forEach(card => {
    const selected = Number(card.dataset.slot) === index;
    card.classList.toggle('selected', selected);
    card.querySelector('.slot-select').setAttribute('aria-pressed', selected);
    card.querySelector('.slot-play').hidden = !selected;
  });
}

// v0.36.4: облако — главное, локальный слот — его копия. Свежий сейв берём сами,
// спрашиваем только при риске (cloudConflictIsRisky): другой герой или свежий ниже уровнем.
let __slotClickBusy = false;
async function onSlotClick(slotIndex, isUsed) {
  if (!isUsed) {
    openCreateScreen(slotIndex);
    return;
  }
  if (__slotClickBusy) return;

  if (typeof cloudIsReady === 'function' && cloudIsReady() && typeof cloudCompareSlots === 'function') {
    __slotClickBusy = true;
    try { if (typeof cloudEnsureFresh === 'function') await cloudEnsureFresh(4000); } finally { __slotClickBusy = false; }
    const cmp = cloudCompareSlots(slotIndex);

    if (cmp && cmp.status === 'both-diff') {
      if (typeof cloudConflictIsRisky === 'function' && cloudConflictIsRisky(cmp)) {
        handleSlotConflict(slotIndex, cmp);
        return;
      }
      if (cmp.newer === 'cloud') {
        await loadSlotFromCloudAndStartOverwrite(slotIndex);   // прежний локальный — в запасную копию, тост «Облачный сейв загружен»
        return;
      }
      // Свежее на этом устройстве (облако не успело принять — например, телефон свернули):
      // облачную версию — в запасную копию, играем локальной и сразу отправляем её в облако.
      try { localStorage.setItem(slotBackupKey(slotIndex), JSON.stringify(cmp.cloud.payload)); } catch (e) {}
      loadSlotAndStart(slotIndex);
      if (state.activeSlotIndex === slotIndex) saveCurrentSlot();
      showToast('💾', 'Взято более свежее сохранение с этого устройства');
      return;
    }
    if (cmp && cmp.status === 'only-cloud') {   // локальной копии нет — подтянуть из облака
      loadSlotFromCloudAndStart(slotIndex);
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

function onSlotDelete(slotIndex, name) {
  if (!confirm(`Удалить персонажа «${name}»? Это действие необратимо.`)) return;
  deleteSlot(slotIndex);
  renderSlots();
}

// opts.resume — страница обновлена посреди игры (mobile.js): вернуть героя в охоту.
function loadSlotAndStart(slotIndex, opts) {
  const saved = readSlot(slotIndex);
  if (!saved) { alert('Сохранение не найдено'); return; }

  // v0.33: страница обновилась сама (телефон свернул вкладку), а герой в экспедиции —
  // не входим автоматически, иначе экспедиция оборвётся. Остаётся экран выбора героя.
  if (opts && opts.resume && typeof expBlocksAutoResume === 'function' && expBlocksAutoResume(saved.player)) {
    try { sessionStorage.removeItem(RESUME_SESSION_KEY); } catch (e) {}
    renderSlots();
    return;
  }

  // v0.36.3: сначала приводим сейв к текущей версии (save-migrate.js).
  // migrateSavePayload дополняет недостающие поля дефолтами, поэтому Object.assign
  // ниже перекрывает ВСЕ поля игрока: наследовать что-то от предыдущего героя нельзя.
  // Раньше каждое новое поле требовало отдельной строки в этом месте — и забытая
  // строка тихо передавала значение прошлого героя.
  migrateSavePayload(saved);
  if (saved.cloudSeen && typeof SLOT_CLOUD_SEEN !== 'undefined') SLOT_CLOUD_SEEN[slotIndex] = true;   // v0.36.4
  Object.assign(state.player, saved.player);
  // v0.29.2: дробные цены продажи оставляли хвост в Оболах (34500.199999997)
  state.player.gold = Math.max(0, Math.round(Number(state.player.gold) || 0));
  if (typeof ensureChronicle === 'function') ensureChronicle();
  if (saved.battle) Object.assign(state.battle, saved.battle);
  state.battle.breakthrough = null;   // прорыв после загрузки запускает fallResume

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
  // v0.33: рубины и сапфиры из обычного дропа изъяты — теперь это камни душ
  if (typeof retireOldGemsOnLoad === 'function') retireOldGemsOnLoad();
  if (weaponsChanged) setTimeout(() => logLoot('⚔ Статы оружия обновлены под новый баланс.', 'log-info'), 1600);
  // v0.36.3: деноминация пыли — сказать один раз, чтобы не выглядело пропажей
  if (saved._dustRescaled || (typeof storageDustRescaled !== 'undefined' && storageDustRescaled)) {
    storageDustRescaled = false;
    setTimeout(() => {
      showToast('✨', 'Пыль пересчитана: всё ÷10, цены Алхимика тоже');
      logLoot('✨ Пыль пересчитана: запасы, выход с распыления и цены Алхимика поделены на 10. Ценность пыли не изменилась — просто числа стали меньше.', 'log-info');
    }, 1900);
  }
  if (refineFlatChanged) setTimeout(() => logLoot('🔧 Бонусы подгонки HP, MP и реген пересчитаны: на вещах тира 2 и выше они теперь больше.', 'log-info'), 1700);
  if (jewelryChanged) setTimeout(() => {
    showToast('💍', 'Бижутерия пересчитана: вехи подгонки теперь дают опыт и мастерство');
    logLoot('💍 Вехи подгонки бижутерии теперь дают опыт (ожерелья), мастерство (кольца) и одно из двух (серьги) вместо маг. защиты.', 'log-info');
  }, 1500);

  // НОВОЕ (v0.13o): если игрок НЕ админ — принудительно cheatRate = 1.
  if (typeof cloudIsAdmin === 'function' && !cloudIsAdmin()) {
    state.player.cheatRate = 1;
    state.cheat = false;
  }

  if (typeof migrateSkillSlots === 'function') {
    migrateSkillSlots();
  }
  if (typeof subclassOnLoad === 'function') subclassOnLoad();   // v0.38: подкласс и очки с 26 уровня

  if (typeof getXpForLevel === 'function') {
    // Infinity в сейве хранится как null: такой герой стоял на потолке, его опыт копился впустую.
    // Оставляем Infinity — checkLevelUp сбросит накопленное, если потолок уже поднят.
    if (state.player.level >= getMaxPlayerLevel() || !(state.player.xpNext > 0)) {
      state.player.xpNext = Infinity;
    } else {
      state.player.xpNext = getXpForLevel(state.player.level + 1);
    }
    if (typeof checkLevelUp === 'function') checkLevelUp();
  }

  const equipmentRepaired = state.player.classId && repairEquippedItemsOnLoad();

  if (!state.player.classId) {
    openCreateScreen(slotIndex);
    return;
  }

  hideStartScreen();
  initGame();
  if (equipmentRepaired) saveCurrentSlotSoon();

  // v0.33: зашли героем из экспедиции — он вернулся (раньше или как раз к концу), окно с добычей
  if (typeof expOnEnterGame === 'function') expOnEnterGame();
  // v0.34.1: Бестиарий и Поляна — открыть то, что герой уже заслужил убийствами (без всплывашек)
  if (typeof loreSyncBeasts === 'function') loreSyncBeasts(true);

  fallOmensCheck();
  if (state.player.fallStage) {   // обновили страницу посреди падения Андервуда — продолжаем с этого места
    setTimeout(fallResume, 800);
    return;
  }

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

  backupLocalSlot(slotIndex);   // v0.36.3: прежнюю локальную копию сохраняем до перезаписи
  if (typeof SLOT_CLOUD_SEEN !== 'undefined') SLOT_CLOUD_SEEN[slotIndex] = true;   // v0.36.4: этот сейв облако знает
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

  backupLocalSlot(slotIndex);   // v0.36.3: прежнюю локальную копию сохраняем до перезаписи
  if (typeof SLOT_CLOUD_SEEN !== 'undefined') SLOT_CLOUD_SEEN[slotIndex] = true;   // v0.36.4: этот сейв облако знает
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

  hideStartScreen();
  document.getElementById('create-screen').classList.add('active');

  const form = document.getElementById('create-form');
  form.reset();
  form.onsubmit = (event) => {
    event.preventDefault();
    confirmCreateCharacter();
  };
  document.getElementById('char-name-input').oninput = updateCreateButton;
  document.getElementById('create-stats').open = false;
  if (typeof tutPresetSkipBox === 'function') tutPresetSkipBox();

  renderCreateScreen();
  setCreateStep('race');
}

function closeCreateScreen() {
  pendingSlotIndex = null;
  document.getElementById('create-screen').classList.remove('active');
  showStartScreen();
  document.querySelector('#slots-grid .empty')?.focus();
}

function setCreateStep(step) {
  const screen = document.getElementById('create-screen');
  screen.dataset.step = step;
  screen.querySelectorAll('[data-create-step]').forEach(button => {
    if (button.dataset.createStep === step) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  screen.scrollTop = 0;
  document.getElementById('create-title').focus({ preventScroll: true });
}

function renderCreateScreen() {
  const races = Object.values(RACES).map(race => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'create-option race-option';
    button.dataset.race = race.id;
    button.disabled = !race.available;
    button.innerHTML = `
      <img src="${race.icon}" alt="">
      <span><strong>${race.name}</strong><small>${race.creation.label}</small></span>
    `;
    button.onclick = () => {
      pendingRaceId = race.id;
      updateCreatePreview();
    };
    return button;
  });
  document.getElementById('races-list').replaceChildren(...races);

  const classes = Object.entries(CLASSES).map(([id, cls]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'create-option class-option';
    button.dataset.class = id;
    button.innerHTML = `<strong>${cls.name}</strong><small></small>`;
    button.onclick = () => {
      pendingClassId = id;
      updateCreatePreview();
    };
    return button;
  });
  document.getElementById('classes-list').replaceChildren(...classes);
  document.getElementById('create-subclass-level').textContent = SUBCLASS_MIN_LEVEL;
  updateCreatePreview();
}

function renderCreateTraits(id, guide) {
  document.getElementById(id).innerHTML = `
    <div>
      <strong><span class="create-plus" aria-hidden="true">+</span> Сильная сторона</strong>
      <p>${guide.strength}</p>
    </div>
    <div>
      <strong><span class="create-minus" aria-hidden="true">−</span> Слабая сторона</strong>
      <p>${guide.weakness}</p>
    </div>
  `;
}

function updateCreatePreview() {
  const race = RACES[pendingRaceId];
  const cls = CLASSES[pendingClassId];
  document.getElementById('create-hero-portrait').src = getRaceIcon(race.id, pendingClassId);
  document.getElementById('create-hero-race').textContent = race.name;
  document.getElementById('create-chosen-race').textContent = race.name;
  document.getElementById('create-hero-pair').textContent = cls ? `${race.name}-${cls.name.toLowerCase()}` : race.name;
  document.getElementById('create-race-desc').textContent = race.desc;

  document.querySelectorAll('#races-list [data-race]').forEach(button => {
    button.setAttribute('aria-pressed', button.dataset.race === pendingRaceId);
  });
  document.querySelectorAll('#classes-list [data-class]').forEach(button => {
    const id = button.dataset.class;
    button.setAttribute('aria-pressed', id === pendingClassId);
    button.querySelector('small').textContent = race.creation[id].style;
  });

  renderCreateTraits('create-race-traits', race.creation);
  document.getElementById('create-class-hint').hidden = !!cls;
  document.getElementById('create-class-preview').hidden = !cls;
  if (cls) {
    renderCreateTraits('create-class-traits', race.creation[pendingClassId]);
    const stats = getRaceClassStats(race.id, pendingClassId);
    const labels = { STR: 'Сила', DEX: 'Ловкость', CON: 'Телосложение', INT: 'Интеллект', WIT: 'Мудрость', MEN: 'Дух' };
    document.getElementById('create-stat-values').innerHTML = Object.entries(labels).map(([key, label]) =>
      `<div><dt>${label}</dt><dd>${stats[key]}</dd></div>`
    ).join('');

    const subclasses = Object.values(SUBCLASSES).filter(subclass =>
      subclass.race === race.id && subclass.cls === pendingClassId && subclass.ready
    );
    document.getElementById('create-subclasses').innerHTML = subclasses.map(subclass => `
      <article class="create-subclass">
        <div class="create-subclass-art"><img src="${subclass.portrait}" alt=""></div>
        <div class="create-subclass-info">
          <h4>${subclass.name}</h4>
          <p>${subclass.preview}</p>
        </div>
      </article>
    `).join('');
  }

  updateCreateButton();
}

function updateCreateButton() {
  const name = document.getElementById('char-name-input').value.trim();
  document.getElementById('btn-create-char').disabled = !pendingClassId || name.length < 2;
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

  // v0.30: первые записи летописи — герой появляется в мире, сумка просыпается
  if (typeof startChronicleForNewHero === 'function') startChronicleForNewHero();

  // v0.39: обучение «Первый день» — галочка «без обучения» в окне создания (js/systems/tutorial.js)
  if (typeof tutorialNewHero === 'function') {
    const skipChk = document.getElementById('tut-skip-chk');
    state.player.tutorial = tutorialNewHero(!!(skipChk && skipChk.checked));
  }

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
  state.player.subclass = null;   // v0.38: подкласс прошлого героя не переходит новому
  state.player.skillPts26 = 0;

  state.player.skillSlots = [null, null, null];

  state.player.currentLocation = 'town';
  state.player.foodTimer = 0;
  state.player.foodTickAccum = 0;
  state.player.foodKind = null;   // v0.35.1
  state.player.ilgradOpen = false;   // v0.36
  state.player.underwoodFallen = false;
  state.player.fallStage = null;
  state.player.fallBattle = null;
  state.player.dish = null;
  state.player.guildBuffs = {};
  state.player.tavernBuffs = {};
  state.player.weaponSkills = {};
  state.player.elements = {};
  state.player.monsterKills = {};

  // v0.36.3: поручения, экспедиция, темп охоты и личные настройки прошлого героя
  // не переходят новому. Раньше слот удаляли, создавали персонажа — и квесты
  // с экспедицией оставались от предыдущего.
  state.player.quests = {};
  state.player.expedition = null;
  state.player.expeditionLoot = [];
  state.player.expeditionKills = {};
  state.player.huntPace = {};
  state.player.huntVariant = {};
  state.player.breakthroughResult = 0;
  state.player.soulHuntCap = 0;
  state.player.hideProfile = false;
  state.player.repeatPref = true;   // v0.36.4: «Повторять бой» — сразу ВКЛ

  state.player.chronicle = typeof makeFreshChronicle === 'function' ? makeFreshChronicle() : null;   // v0.30
  state.player.bag = typeof makeFreshBag === 'function' ? makeFreshBag() : null;

  state.battle.active = false;
  state.battle.monsters = [];
  state.battle.monstersATB = 0;
  state.battle.packIncoming = 0;
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
