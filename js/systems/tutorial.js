// ========================================================
//  СИСТЕМЫ: ОБУЧЕНИЕ «ПЕРВЫЙ ДЕНЬ В АНДЕРВУДЕ» (v0.39)
//  Ведёт Заплечник: подсветка нужной кнопки + пузырь с репликой.
//  Тексты — js/data/tutorial.js (TUTORIAL_TEXT, TUTORIAL_REWARD).
//
//  Как устроено:
//    - Состояние героя: state.player.tutorial =
//        { on, done, ack: { battle, loot }, later, rewarded, hello }
//      У старых героев поля нет (null) — обучение не включается.
//    - Раз в TUT_TICK_MS смотрим на игру и решаем, что подсказать (tutRoute).
//      Шаг засчитывается по состоянию игры (куплено, надето, изучено, убито),
//      а не по нажатию «Дальше», поэтому порядок может быть любым,
//      а сделанное раньше времени просто пропускается.
//    - Волны идут к следующему действию, контур остаётся до смены цели.
//      «Потом» — прячет подсказки, остаётся значок «Продолжить обучение».
//    - Во время разговоров, дороги и чужих окон подсказка прячется.
//  Галочка «без обучения» — окно создания героя (index.html, confirmCreateCharacter).
//  Вкл/выкл для героя — Настройки → Игра → «Обучение».
// ========================================================

const TUT_TICK_MS = 300;
const TUT_TOTAL = 8;            // шагов в счётчике «Первый день · N из 8»
const TUT_SKIP_LEVEL = 5;       // есть герой выше этого уровня — галочка «без обучения» стоит сама

let __tutKey = null;            // какая подсказка сейчас на экране
let __tutScrolledKey = null;    // к какой подсказке уже прокрутили страницу
let __tutMeetTried = false;     // знакомство с сумкой уже открывали сами
let __tutHelloTimer = null;
let __tutSettingsOpen = false;

// --------------------------------------------------------
//  СОСТОЯНИЕ
// --------------------------------------------------------
// tips — подсказки при первом открытии окна (TUTORIAL_TIPS), seen — какие уже показаны.
function tutorialNewHero(skip) {
  return { on: !skip, done: false, ack: {}, later: false, rewarded: false, hello: !!skip, tips: !skip, seen: {} };
}

function tutState() {
  const p = state.player;
  return p && p.classId && p.tutorial && typeof p.tutorial === 'object' ? p.tutorial : null;
}

function tutorialActive() {
  const t = tutState();
  return !!(t && t.on && !t.done);
}

function tutSave() {
  if (typeof saveCurrentSlotSoon === 'function') saveCurrentSlotSoon();
}

// --------------------------------------------------------
//  ЧТО УЖЕ СДЕЛАНО (по состоянию игры)
// --------------------------------------------------------
function tutKills() {
  const k = state.player.monsterKills || {};
  let n = 0;
  for (const key in k) n += k[key] || 0;
  return n;
}

function tutFreeFieldPath(from, to) {
  if (from !== 'town' || to !== 'field' || !tutorialActive()) return false;
  return !state.player.chronicle?.firsts?.['loc.field'] && tutKills() === 0;
}

function tutDeliverFirstLoot(reward) {
  const p = state.player;
  if (p.inventory.length >= invMaxSlots()) return false;
  const helmet = MONSTERS.find(monster => monster.id === 'silkworm')?.drops.find(drop => drop.type === 'helmet');
  if (!helmet) return false;
  const bonusStats = rollRarityStats(RARITIES.blue.statPoints, getRarityStatProfile(helmet));
  if (!addToInventory({ ...helmet, rarity: 'blue', bonusStats })) return false;

  reward.itemId = p.inventory[p.inventory.length - 1].id;
  const bonusText = formatRarityBonus(bonusStats);
  logLoot(`✨ ${helmet.name} (${RARITIES.blue.name})${bonusText ? ' · ' + bonusText : ''}`, 'log-loot');
  return true;
}

function tutEarnFirstLoot() {
  const t = tutState();
  if (!t || !t.on || t.done || t.firstLoot || tutKills() !== 0) return false;
  t.firstLoot = { itemId: null };
  if (!tutDeliverFirstLoot(t.firstLoot)) {
    logLoot('🎒 Заплечник придержал редкий шлем. Освободи ячейку в сумке, чтобы его забрать.', 'log-info');
  }
  return true;
}

function tutNoteLootBag() {
  const t = tutState();
  if (!t || !t.on || t.done || tutKills() === 0 || t.ack?.lootBag) return;
  t.ack = t.ack || {};
  t.ack.lootBag = true;
  tutSave();
}

// Квест Старейшины «Первые шаги» прошёл стадию stage (или уже недоступен — отказался и вырос).
function tutFirstStepsPast(stage) {
  const pr = getQuestProgress('firstSteps');
  if (!pr) return !isQuestAvailable('firstSteps');
  const st = QUESTS.firstSteps.stages;
  return st.indexOf(pr.stage) > st.indexOf(stage);
}

function tutFlags() {
  const p = state.player;
  const started = isQuestStarted('firstSteps');
  const fsDone = tutFirstStepsPast('need_weapon');
  const learned = Object.values(p.learnedSkills || {}).some(v => v > 0) || (p.skillPoints || 0) < 1;
  const kills = tutKills();
  const potionSlotted = !!p.potionSlot || (fsDone && !hasQuestItem('healPotion'));
  const mixtureSlotted = !!p.mixtureSlot || (fsDone && !hasQuestItem('atkMixture'));
  return {
    elder:   started || fsDone,
    potion:  fsDone || tutFirstStepsPast('need_potion') || (started && hasQuestItem('healPotion')),
    mixture: fsDone || tutFirstStepsPast('need_mixture') || (started && hasQuestItem('atkMixture')),
    weapon:  fsDone,
    potionSlotted,
    slot:    potionSlotted && mixtureSlotted,
    mentor:  learned,
    field:   kills > 0 || p.currentLocation === 'field',
    kill:    kills > 0,
  };
}

function tutDoneCount(f) {
  return ['elder', 'potion', 'mixture', 'weapon', 'slot', 'mentor', 'field', 'kill'].filter(k => f[k]).length;
}

// --------------------------------------------------------
//  ЧТО НА ЭКРАНЕ
// --------------------------------------------------------
function tutVisible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
function tutQ(sel) {
  const el = document.querySelector(sel);
  return tutVisible(el) ? el : null;
}
function tutIsOpen(sel) {
  const el = document.querySelector(sel);
  return !!(el && el.classList.contains('active'));
}
function tutDialogueOpen() {
  return (typeof __activeDialogue !== 'undefined' && !!__activeDialogue) || tutIsOpen('#dialogue-overlay');
}
// Открыто какое-то окно, кроме названного (бой проверяется отдельно).
function tutOtherOverlay(exceptId) {
  if (document.getElementById('equip-compare')?.open) return true;
  const list = document.querySelectorAll('[id$="-overlay"].active, .slot-picker.active, .soon-overlay.active, .cheat-overlay.active');
  for (const el of list) {
    if (el.id === exceptId || el.id === 'dialogue-overlay') continue;
    return true;
  }
  return !!document.getElementById('exp-overlay');   // окно экспедиции живёт без .active, пока открыто
}
function tutTabActive(tab) {
  const el = document.getElementById('panel-' + tab);
  return !!(el && el.classList.contains('active'));
}

// --------------------------------------------------------
//  КУДА ВЕСТИ СЕЙЧАС
//  Возвращает { key, el, text, act, btn, onBtn } или null (ничего не показывать).
// --------------------------------------------------------
const TT = () => TUTORIAL_TEXT;

function tutCity(key, onclick, txt) {
  const p = state.player;
  if (tutOtherOverlay()) return null;
  if (p.currentLocation !== 'town') {
    if (tutTabActive('map')) return { key: 'toTownCard', el: tutQ('.map-card[data-loc="town"]'), ...TT().toTownCard };
    return { key: 'toTownMap', el: tutQ('.tab[data-tab="map"]'), ...TT().toTownMap };
  }
  if (!tutTabActive('hunt')) return { key: 'toCityTab', el: tutQ('#tab-hunt'), ...TT().toCityTab };
  return { key, el: tutQ(`#city-grid-town .city-card[onclick="${onclick}"]`), ...txt };
}

function tutShop(shopId, cityTxt, buyTxt) {
  if (tutIsOpen('#trader-overlay')) {
    const buyTab = tutQ('#trader-overlay .window-tab[data-pane="buy"]');
    if (buyTab && !buyTab.classList.contains('active')) {
      return { key: 'trader-buy-tab', el: buyTab, ...TT().traderBuyTab };
    }
    const el = tutQ(`#trader-overlay button[onclick="buyItem('${shopId}', 1)"]`);
    return el ? { key: 'buy-' + shopId, el, ...buyTxt } : null;
  }
  return tutCity('shop-' + shopId, 'openTrader()', cityTxt);
}

function tutToField() {
  if (tutOtherOverlay()) return null;
  if (tutTabActive('map')) {
    if (tutFreeFieldPath(state.player.currentLocation, 'field')) {
      return { key: 'freeFieldPath', el: tutQ('#map-card-field .map-magic-btn'), ...TT().freeFieldPath };
    }
    return { key: 'fieldCard', el: tutQ('#map-card-field .map-walk-btn'), ...TT().fieldCard };
  }
  return { key: 'fieldTab', el: tutQ('.tab[data-tab="map"]'), ...TT().fieldTab };
}

function tutSupplyRoute(potion) {
  const slot = potion ? 'potion' : 'mixture';
  const shop = potion ? 'healPotion' : 'atkMixture';
  if (tutIsOpen('#slot-picker')) {
    const el = tutQ(`#slot-picker [onclick="selectSlotItem('${slot}', '${shop}')"]`);
    if (el) return { key: potion ? 'slotPick' : 'mixtureSlotPick', el, ...(potion ? TT().slotPick : TT().mixtureSlotPick) };
    return { key: 'slotClose', el: tutQ('#slot-picker .slot-picker-close'), ...TT().slotClose };
  }
  if (tutOtherOverlay()) return null;
  if (tutTabActive('inventory')) {
    const el = tutQ(`.equip-slot[data-slot="${slot}Slot"]`);
    if (el) return { key: potion ? 'slotEl' : 'mixtureSlotEl', el, ...(potion ? TT().slotEl : TT().mixtureSlotEl) };
  }
  return { key: 'slotTab', el: tutQ('.tab[data-tab="inventory"]'), ...TT().slotTab };
}

function tutLootRoute(t, battle, prepared = true) {
  if (tutOtherOverlay()) return null;
  const session = typeof BSESS !== 'undefined' ? BSESS : null;
  const bagOpen = !!session?.panelOpen;
  const peeking = !!session?.peek;
  const itemId = t.firstLoot?.itemId;
  const needsSpace = !!t.firstLoot && !itemId;
  const itemIndex = itemId ? state.player.inventory.findIndex(item => item.id === itemId) : -1;
  const needsEquip = itemIndex >= 0;

  if (!(t.ack?.loot || t.ack?.lootBag || peeking)) {
    const ack = () => { t.ack = t.ack || {}; t.ack.loot = 1; tutSave(); };
    const el = battle ? tutQ('#bx-loot-column') : null;
    return { key: 'loot', el, ...TT().loot, btn: 'Дальше', onBtn: ack };
  }

  if (tutTabActive('inventory') && (needsEquip || needsSpace)) {
    if (needsSpace) return { key: 'lootNoSpace', el: null, ...TT().lootNoSpace };
    const el = tutQ(`#inventory-grid [data-item-id="${CSS.escape(itemId)}"]`);
    if (el) return { key: 'lootEquip', el, ...TT().lootEquip };
    const page = Math.floor(itemIndex / INVENTORY_PAGE_SIZE);
    return { key: 'lootInventoryPage', el: tutQ(`#inventory-pagination [data-page="${page}"]`), ...TT().lootInventoryPage };
  }
  if (peeking) {
    return { key: 'lootReturn', el: tutQ('#bx-peek-bar .bxp-back'), ...TT().lootReturn };
  }
  if (battle && bagOpen) {
    return needsEquip || needsSpace
      ? { key: 'lootInventory', el: tutQ('#bx-session .bxs-open-inv'), ...TT().lootInventory }
      : { key: 'lootBagClose', el: tutQ('#bx-session .bxs-close'), ...TT().lootBagClose };
  }
  if (battle && (!t.ack?.lootBag || needsEquip || needsSpace)) {
    return { key: 'lootBag', el: tutQ('#bx-loot-count'), ...TT().lootBag };
  }
  if (needsEquip || needsSpace) {
    return { key: 'lootInventoryTab', el: tutQ('.tab[data-tab="inventory"]'), ...TT().lootInventoryTab };
  }
  if (!prepared) {
    return { key: 'lootReturnToPrep', el: tutQ('#btn-close-battle'), ...TT().lootReturnToPrep };
  }
  return { key: 'final', el: null, text: TT().final.text, btn: TT().final.btn, final: true, onBtn: tutorialFinish };
}

function tutRoute() {
  const p = state.player, t = p.tutorial;
  const battle = tutIsOpen('#battle-window');
  if (tutDialogueOpen() || tutIsOpen('#travel-overlay') || document.querySelector('.travel-overlay.active')) return null;

  // 1. Знакомство с сумкой — сам разговор и есть подсказка
  if (typeof bagMet === 'function' && !bagMet()) {
    if (battle || tutOtherOverlay()) return null;
    if (!__tutMeetTried) {
      __tutMeetTried = true;
      setTimeout(() => { if (tutorialActive() && !t.later && typeof startBagMeeting === 'function') startBagMeeting(); }, 900);
      return null;
    }
    return { key: 'meetRetry', el: null, ...TT().meetRetry, btn: 'Поговорить',
      onBtn: () => { tutHide(); if (typeof startBagMeeting === 'function') startBagMeeting(); } };
  }

  const f = tutFlags();
  // Пока окно боя открыто, можно посмотреть первую добычу даже при охоте раньше урока.
  if (f.kill && battle) {
    const prepared = f.elder && f.potion && f.mixture && f.weapon && f.slot && f.mentor;
    return tutLootRoute(t, battle, prepared);
  }

  // 2–5. Старейшина и его «Первые шаги»
  if (!f.elder)   return battle ? null : tutCity('elder', 'openElder()', TT().elder);
  if (!f.potion)  return battle ? null : tutShop('healPotion', TT().potionCity, TT().potionBuy);
  if (!f.mixture) return battle ? null : tutShop('atkMixture', TT().mixtureCity, TT().mixtureBuy);
  if (!f.weapon && !battle && tutIsOpen('#trader-overlay')) {
    const el = tutQ('#trader-overlay button[onclick="closeTrader()"]');
    return { key: 'trader-close', el, handoff: true, ...TT().traderClose };
  }
  if (!f.weapon)  return battle ? null : tutCity('weapon', 'openElder()', TT().weapon);

  // 6. Зелье и микстура в слоты
  if (!f.slot) return battle ? null : tutSupplyRoute(!f.potionSlotted);

  // 7. Навык у Урдаха
  if (!f.mentor) {
    if (battle) return null;
    if (tutIsOpen('#mentor-overlay')) {
      const btns = Array.from(document.querySelectorAll('#mentor-pane-skills .skill-card-action .btn.success')).filter(tutVisible);
      // советуем первый активный навык (его видно в бою), иначе — первый доступный
      const el = btns.find(b => b.closest('.skill-card')?.querySelector('.active-skill')) || btns[0];
      return el ? { key: 'mentorLearn', el, ...TT().mentorLearn } : null;
    }
    return tutCity('mentor', 'openMentor()', TT().mentorCity);
  }

  // 8. На Поляну
  if (!f.field && !battle) {
    if (tutIsOpen('#mentor-overlay')) {
      const el = tutQ('#mentor-overlay button[onclick="closeMentor()"]');
      return { key: 'mentor-close', el, handoff: true, ...TT().mentorClose };
    }
    return tutToField();
  }

  // 9. Бой
  if (!f.kill) {
    if (battle) {
      if (t.ack && t.ack.battle) return null;
      return { key: 'battle', el: tutQ('#fighter-player .bx-bars'), ...TT().battle, btn: 'Дальше',
        onBtn: () => { t.ack = t.ack || {}; t.ack.battle = 1; tutSave(); } };
    }
    if (p.currentLocation !== 'field') return tutToField();
    if (tutOtherOverlay()) return null;
    if (!tutTabActive('hunt')) return { key: 'huntTab', el: tutQ('#tab-hunt'), ...TT().huntTab };
    // раскладки карточек (Настройки): шторка на телефоне → её кнопка; лента «Ряд» → «В бой»;
    // список / плитки → первая строка; иначе — сама карточка
    if (document.querySelector('#monsters-grid.sheet-open')) {
      const go = tutQ('#monsters-grid .hunt-stage-go');
      return go ? { key: 'huntGo', el: go, ...TT().huntGo } : null;
    }
    const rowGo = tutQ('#hunt-go');
    if (rowGo) return { key: 'huntRowGo', el: rowGo, ...TT().huntRowGo };
    if (typeof isHuntSheetMode === 'function' && isHuntSheetMode()) {
      const picks = document.querySelectorAll('#monsters-grid .hunt-prow:not(.pick-stub), #monsters-grid .hunt-tile:not(.pick-stub)');
      const pick = Array.from(picks).find(tutVisible);
      return pick ? { key: 'huntPick', el: pick, ...TT().huntCard, act: 'Выбери тварь' } : null;
    }
    const stageGo = tutQ('#monsters-grid .hunt-stage-go');
    if (stageGo) return { key: 'huntStageGo', el: stageGo, ...TT().huntCard, act: 'Выбери тварь и нажми «В бой»' };
    const cards = document.querySelectorAll('#monsters-grid .monster-card:not(.monster-stub)');
    const el = Array.from(cards).find(tutVisible);
    return el ? { key: 'huntCard', el, ...TT().huntCard } : null;
  }

  // 10. Добыча, экипировка и итог
  return tutLootRoute(t, battle);
}

// --------------------------------------------------------
//  ИТОГ: награда и запись в Летописи (один раз на героя)
// --------------------------------------------------------
function tutorialFinish() {
  const t = tutState();
  if (!t) return;
  t.done = true;
  t.later = false;
  if (!t.rewarded) {
    t.rewarded = true;
    const R = TUTORIAL_REWARD;
    state.player.gold += R.gold;
    if (typeof updateTopStatus === 'function') updateTopStatus();
    if (typeof showToast === 'function') showToast('🪙', `+${R.gold} Оболов — «Первый день» пройден`);
    if (typeof logCombat === 'function') logCombat(`🎒 Первый день в Андервуде пройден. +${R.gold} Оболов.`, 'log-entry levelup');
    if (typeof bumpChronicleCounter === 'function') bumpChronicleCounter('trust', R.trust);
    if (typeof addChronicleEntry === 'function') addChronicleEntry(R.annals);
    if (typeof updateChronicleDot === 'function') updateChronicleDot();
  }
  tutHide();
  if (typeof saveCurrentSlot === 'function') saveCurrentSlot();
}

// --------------------------------------------------------
//  РИСОВАНИЕ: подсветка, пузырь, значок прогресса
// --------------------------------------------------------
function tutEls() {
  let spot = document.getElementById('tut-spot');
  if (!spot) {
    spot = document.createElement('div');
    spot.id = 'tut-spot';
    spot.className = 'tut-spot';
    spot.setAttribute('aria-hidden', 'true');
    spot.innerHTML = '<i class="tut-wave"></i>'.repeat(3);
    document.body.appendChild(spot);
    const bub = document.createElement('div');
    bub.id = 'tut-bubble';
    bub.className = 'tut-bubble';
    document.body.appendChild(bub);
    const chip = document.createElement('button');
    chip.id = 'tut-chip';
    chip.type = 'button';
    chip.className = 'tut-chip';
    document.body.appendChild(chip);
    const probe = document.createElement('div');
    probe.id = 'tut-probe';
    probe.className = 'tut-probe';
    document.body.appendChild(probe);
  }
  return { spot, bub: document.getElementById('tut-bubble'), chip: document.getElementById('tut-chip') };
}

// У <html> стоит filter (яркость/контраст в Настройках) — из-за него position:fixed
// считается не от окна, а от страницы и съезжает при прокрутке. Пустой «щуп» в точке (0,0)
// показывает, насколько: на столько и поправляем.
function tutFixedShift() {
  const probe = document.getElementById('tut-probe');
  if (!probe) return { x: 0, y: 0 };
  const r = probe.getBoundingClientRect();
  return { x: r.left, y: r.top };
}

function tutHide() {
  const { spot, bub } = tutEls();
  spot.classList.remove('on', 'waves');
  bub.classList.remove('on', 'quiet', 'action', 'handoff', 'goal');
  if (__tutKey === 'hello') clearTimeout(__tutHelloTimer);   // приветствие спрятали (разговор и т.п.) — потом покажем заново
  __tutKey = null;
}

function tutFaceStyle() {
  const img = typeof bagLookImg === 'function' ? bagLookImg() : (typeof BAG_SLOT_IMG !== 'undefined' ? BAG_SLOT_IMG : '');
  return img ? ` style="background-image:url('${img}')"` : '';
}

function tutBubbleHtml(r) {
  const who = typeof bagSpeakerName === 'function' ? bagSpeakerName() : 'Заплечник';
  let row = '';
  if (r.btn) row += `<button type="button" class="tut-btn main" data-tut="go">${r.btn}</button>`;
  if (!r.final && !r.handoff) row += `<button type="button" class="tut-btn later" data-tut="later">${r.laterLabel || 'Потом'}</button>`;
  return `<div class="tut-face"${tutFaceStyle()}></div>
    <div class="tut-body">
      <div class="tut-who">${who}</div>
      <div class="tut-text">${heroText(r.text)}</div>
      ${r.act ? `<div class="tut-act">${heroText(r.act)}</div>` : ''}
      <div class="tut-row">${row}</div>
    </div>`;
}

function tutShow(r) {
  const { spot, bub } = tutEls();
  const changed = r.key !== __tutKey;
  if (changed) {
    __tutKey = r.key;
    bub.innerHTML = tutBubbleHtml(r);
    bub.classList.remove('quiet');
    bub.classList.toggle('action', !!r.act);
    bub.classList.toggle('handoff', !!r.handoff);
    const go = bub.querySelector('[data-tut="go"]');
    if (go) go.onclick = (e) => { e.stopPropagation(); __tutKey = null; if (r.onBtn) r.onBtn(); tutTick(); };
    const later = bub.querySelector('[data-tut="later"]');
    if (later) later.onclick = (e) => { e.stopPropagation(); const t = tutState(); if (t) { t.later = true; tutSave(); } tutHide(); tutTick(); };
  }
  bub.classList.add('on');

  const vw = window.innerWidth, vh = window.innerHeight;
  const bw = bub.offsetWidth, bh = bub.offsetHeight;
  const tabsEl = document.querySelector('.tabs');
  const inWindow = r.el?.closest('.overlay-base, #battle-window, #slot-picker');
  const tabsTop = !inWindow && tutVisible(tabsEl) ? tabsEl.getBoundingClientRect().top : vh;
  const place = (el, x, y) => { const sh = tutFixedShift(); el.style.left = Math.round(x - sh.x) + 'px'; el.style.top = Math.round(y - sh.y) + 'px'; };

  if (!r.el) {
    spot.classList.remove('on', 'waves');
    place(bub, (vw - bw) / 2, Math.max(10, (tabsTop - bh) / 2));
    return;
  }

  // цель за краем экрана — прокручиваем к ней (до 3 попыток: пока грузятся картинки, раскладка ещё плывёт)
  let rc = r.el.getBoundingClientRect();
  if (rc.top < 0 || rc.bottom > tabsTop) {
    const now = Date.now();
    const s = __tutScrolledKey && __tutScrolledKey.key === r.key ? __tutScrolledKey : { key: r.key, n: 0, at: 0 };
    if (s.n < 3 && now - s.at > 900) {
      s.n++; s.at = now; __tutScrolledKey = s;
      const block = rc.height > tabsTop * 0.6 ? 'start' : 'center';
      try { r.el.scrollIntoView({ block }); } catch (e) { r.el.scrollIntoView(); }   // без smooth: плавная иногда глохнет
    }
  }
  rc = r.el.getBoundingClientRect();

  // рамка не уходит за края экрана (у кнопок во всю ширину её иначе не видно)
  const pad = 4, edge = 3;
  const sl = Math.max(edge, rc.left - pad), sr = Math.min(vw - edge, rc.right + pad);
  const st = Math.max(edge, rc.top - pad), sb = Math.min(vh - edge, rc.bottom + pad);
  const startWaves = !!r.act && (changed || !spot.classList.contains('on'));
  place(spot, sl, st);
  spot.style.width = Math.max(0, sr - sl) + 'px';
  spot.style.height = Math.max(0, sb - st) + 'px';
  spot.classList.add('on');
  spot.style.setProperty('--tut-wave-inset', [st, vw - sr, vh - sb, sl]
    .map(space => -Math.min(30, Math.max(2, space - edge)) + 'px').join(' '));
  if (startWaves) {
    spot.classList.remove('waves');
    void spot.offsetWidth; // Перезапуск только при появлении новой цели.
    spot.classList.add('waves');
  } else if (changed) {
    spot.classList.remove('waves');
  }

  // Короткое подтверждение помещается в свободную часть шапки рядом с кнопкой закрытия.
  const actions = r.handoff && r.el.closest('.window-header-actions');
  if (actions) {
    const header = actions.parentElement;
    const bar = header.getBoundingClientRect();
    const x = actions.getBoundingClientRect().left - bw - 12;
    const y = rc.top + (rc.height - bh) / 2;
    const occupied = Array.from(header.children).filter(el => el !== actions).some(el => {
      const rect = el.getBoundingClientRect();
      return rect.left < x + bw && rect.right > x && rect.top < y + bh && rect.bottom > y;
    });
    if (!occupied && x >= bar.left + 6 && y >= bar.top && y + bh <= bar.bottom) {
      place(bub, x, y);
      return;
    }
  }

  // пузырь: под целью, если влезает; иначе над ней; иначе сбоку
  const gap = 14;
  let x = rc.left + rc.width / 2 - bw / 2;
  let y;
  if (rc.bottom + gap + bh <= tabsTop - 6) y = rc.bottom + gap;
  else if (rc.top - gap - bh >= 6) y = rc.top - gap - bh;
  else {
    y = Math.min(Math.max(6, rc.top + rc.height / 2 - bh / 2), vh - bh - 6);
    x = rc.right + gap + bw <= vw - 6 ? rc.right + gap : rc.left - gap - bw;
  }
  x = Math.max(8, Math.min(x, vw - bw - 8));
  y = Math.max(6, Math.min(y, vh - bh - 6));
  place(bub, x, y);
}

// Значок внизу: «Первый день · N из 8» или «Продолжить обучение» (после «Потом»).
function tutChip(show, later, n) {
  if (!show) { tutEls().chip.classList.remove('on'); return; }
  const label = later ? 'Продолжить обучение' : `Первый день · <b>${n} из ${TUT_TOTAL}</b>`;
  tutPlaceChip(label, later, () => {
    const t = tutState();
    if (!t) return;
    if (t.later) { t.later = false; tutSave(); }
    __tutKey = null; __tutScrolledKey = null;
    tutTick();
  });
}

function tutPlaceChip(label, later, onClick) {
  const { chip } = tutEls();
  chip.classList.add('on');
  chip.classList.toggle('later', !!later);
  chip.style.visibility = '';
  const html = `<i${tutFaceStyle()}></i><span>${label}</span>`;
  if (chip.__html !== html) { chip.innerHTML = html; chip.__html = html; }
  // над нижними вкладками, с поправкой на filter у <html> (см. tutFixedShift)
  const tabsEl = document.querySelector('.tabs');
  const tabsTop = tabsEl && tutVisible(tabsEl) ? tabsEl.getBoundingClientRect().top : window.innerHeight;
  const sh = tutFixedShift();
  chip.style.bottom = 'auto';
  chip.style.left = (10 - sh.x) + 'px';
  chip.style.top = (tabsTop - chip.offsetHeight - 16 - sh.y) + 'px';
  chip.onclick = onClick;
}

// Значок не прячется под пузырём: если они наехали друг на друга — значок на время убираем.
function tutChipDodge() {
  const { chip, bub, spot } = tutEls();
  if (!chip.classList.contains('on')) return;
  const a = chip.getBoundingClientRect();
  const hits = (el) => {
    if (!el.classList.contains('on')) return false;
    const b = el.getBoundingClientRect();
    return a.left < b.right + 6 && b.left - 6 < a.right && a.top < b.bottom + 6 && b.top - 6 < a.bottom;
  };
  chip.style.visibility = hits(bub) || hits(spot) ? 'hidden' : '';
}

// Обучение пропущено: сумка один раз здоровается (маленький пузырь, без затемнения).
function tutHello() {
  const t = tutState();
  const { bub } = tutEls();
  if (__tutKey !== 'hello') {
    __tutKey = 'hello';
    const who = typeof bagSpeakerName === 'function' ? bagSpeakerName() : 'Заплечник';
    bub.innerHTML = `<div class="tut-face"${tutFaceStyle()}></div><div class="tut-body"><div class="tut-who">${who}</div>
      <div class="tut-text">${heroText(TUTORIAL_TEXT.skipHello)}</div>
      <div class="tut-row"><button type="button" class="tut-btn" data-tut="ok">Понятно</button></div></div>`;
    const done = () => { clearTimeout(__tutHelloTimer); t.hello = false; tutSave(); tutHide(); };
    bub.querySelector('[data-tut="ok"]').onclick = (e) => { e.stopPropagation(); done(); };
    clearTimeout(__tutHelloTimer);
    __tutHelloTimer = setTimeout(done, 9000);
  }
  tutPlaceQuietBubble(bub);
}

function tutPlaceQuietBubble(bub) {
  bub.classList.add('on', 'quiet');
  const vw = window.innerWidth;
  const tabsEl = document.querySelector('.tabs');
  const tabsTop = tabsEl && tutVisible(tabsEl) ? tabsEl.getBoundingClientRect().top : window.innerHeight;
  const sh = tutFixedShift();
  bub.style.left = (Math.max(8, vw - bub.offsetWidth - 12) - sh.x) + 'px';
  bub.style.top = (Math.max(8, tabsTop - bub.offsetHeight - 12) - sh.y) + 'px';
}

// --------------------------------------------------------
//  ПОДСКАЗКИ ПРИ ПЕРВОМ ОТКРЫТИИ ОКНА (TUTORIAL_TIPS)
//  Один раз на героя; «показано» ставится сразу, чтобы не надоедать.
//  Пузырь висит, пока открыто окно или до «Понятно».
// --------------------------------------------------------
function tutTipOpenId() {
  if (typeof TUTORIAL_TIPS === 'undefined') return null;
  for (const id in TUTORIAL_TIPS) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (id === 'exp-overlay' || el.classList.contains('active')) return id;
  }
  return null;
}

function tutTip(t) {
  if (!t || !t.tips || tutDialogueOpen()) return null;
  const id = tutTipOpenId();
  if (!id) return null;
  if (!t.seen) t.seen = {};
  if (t.seen[id] && __tutKey !== 'tip-' + id) return null;   // уже было и закрыто
  return id;
}

function tutShowTip(t, id) {
  const { spot, bub } = tutEls();
  spot.classList.remove('on', 'waves');
  bub.classList.remove('action', 'handoff', 'goal');
  if (__tutKey !== 'tip-' + id) {
    __tutKey = 'tip-' + id;
    if (!t.seen[id]) { t.seen[id] = 1; tutSave(); }
    const who = typeof bagSpeakerName === 'function' ? bagSpeakerName() : 'Заплечник';
    bub.innerHTML = `<div class="tut-face"${tutFaceStyle()}></div><div class="tut-body">
      <div class="tut-who">${who}<span class="tut-once">подсказка, один раз</span></div>
      <div class="tut-text">${heroText(TUTORIAL_TIPS[id])}</div>
      <div class="tut-row"><button type="button" class="tut-btn main" data-tut="ok">Понятно</button></div></div>`;
    bub.querySelector('[data-tut="ok"]').onclick = (e) => { e.stopPropagation(); tutHide(); };
  }
  bub.classList.add('on', 'quiet');
  const vw = window.innerWidth, vh = window.innerHeight, sh = tutFixedShift();
  bub.style.left = (Math.round((vw - bub.offsetWidth) / 2) - sh.x) + 'px';
  bub.style.top = (Math.max(8, vh - bub.offsetHeight - 18) - sh.y) + 'px';
}

// --------------------------------------------------------
//  ОДНА СЛЕДУЮЩАЯ ЦЕЛЬ ПОСЛЕ «ПЕРВОГО ДНЯ»
// --------------------------------------------------------
function tutNextGoal(t) {
  if (!t.done || !t.on || state.travel.active || state.battle.active || tutIsOpen('#battle-window') ||
      tutDialogueOpen() || tutOtherOverlay() || document.querySelector('dialog[open]')) return null;

  const p = state.player;
  if (t.goals?.skill !== 'seen' && p.level >= 10 && p.skillPoints > 0) {
    const skill = Object.values(SKILLS).find(s => s.minLevel === 10 && isSkillAvailableForPlayer(s, p) && !getSkillLevel(s.id));
    if (skill) {
      const inTown = isTownLoc();
      const destination = p.underwoodFallen ? 'Загляни в Храм Ильграда.' : 'Загляни к Наставнику в Андервуде.';
      return {
        id: 'skill',
        text: TUTORIAL_GOALS.skill.replace('{skill}', skill.name) + (inTown ? '' : ' ' + destination),
        btn: inTown ? 'Открыть навыки' : 'На карту',
        onBtn: () => {
          if (!inTown) { switchTab('map'); return; }
          openMentor();
          const button = document.querySelector(`#mentor-pane-skills [data-skill-id="${CSS.escape(skill.id)}"] .btn.success`);
          button?.scrollIntoView({ block: 'center' });
          button?.focus({ preventScroll: true });
        },
      };
    }
  }

  const firstQuest = BAG_QUESTS[0];
  if (isQuestStarted(firstQuest.id) || !bagMet()) return null;
  if (p.level < firstQuest.minLevel && t.goals?.hunt !== 'seen') {
    const onField = p.currentLocation === 'field';
    return {
      id: 'hunt',
      text: TUTORIAL_GOALS.hunt,
      btn: onField ? 'К охоте' : 'На карту',
      onBtn: () => switchTab(onField ? 'hunt' : 'map'),
    };
  }
  if (p.level >= firstQuest.minLevel && t.goals?.bag !== 'seen') {
    return { id: 'bag', text: TUTORIAL_GOALS.bag, btn: 'Поговорить', onBtn: openBagTalk };
  }
  return null;
}

function tutShowNextGoal(t, goal) {
  const setStatus = status => {
    (t.goals ||= {})[goal.id] = status;
    tutSave();
    tutHide();
  };
  if (t.goals?.[goal.id] === 'collapsed') {
    if (__tutKey) tutHide();
    tutPlaceChip('Следующая цель', true, () => {
      setStatus('open');
      tutTick();
      document.querySelector('#tut-bubble.on [data-tut="go"]')?.focus({ preventScroll: true });
    });
    return;
  }

  tutChip(false);
  const { bub } = tutEls();
  const key = `goal-${goal.id}-${goal.btn}`;
  if (__tutKey !== key) {
    tutHide();
    __tutKey = key;
    bub.innerHTML = tutBubbleHtml({ ...goal, laterLabel: 'Свернуть' });
    bub.classList.add('goal');
    bub.querySelector('[data-tut="go"]').onclick = () => {
      setStatus('seen');
      goal.onBtn();
      tutTick();
    };
    bub.querySelector('[data-tut="later"]').onclick = () => {
      setStatus('collapsed');
      tutTick();
      tutEls().chip.focus({ preventScroll: true });
    };
  }
  tutPlaceQuietBubble(bub);
}

// --------------------------------------------------------
//  НАСТРОЙКИ → ИГРА → «ОБУЧЕНИЕ»
// --------------------------------------------------------
function renderTutorialSettings() {
  const cont = document.getElementById('tutorial-settings-buttons');
  const hint = document.getElementById('tutorial-settings-hint');
  if (!cont) return;
  const p = state.player;
  cont.innerHTML = '';
  if (!p || !p.classId) { if (hint) hint.textContent = ''; return; }
  const t = p.tutorial;
  const on = !!(t && t.on && !t.done);
  [[true, 'Вкл'], [false, 'Выкл']].forEach(([value, label]) => {
    const btn = document.createElement('button');
    btn.className = 'settings-btn' + (value === on ? ' active' : '');
    btn.textContent = label;
    btn.onclick = () => setTutorialEnabled(value);
    cont.appendChild(btn);
  });
  if (hint) {
    if (t && t.done && !on) hint.textContent = 'Первый день пройден. «Вкл» — Заплечник проведёт ещё раз.';
    else if (on) hint.textContent = `Идёт: ${tutDoneCount(tutFlags())} из ${TUT_TOTAL}. Заплечник подсказывает, куда нажать.`;
    else hint.textContent = 'Выключено. «Вкл» — Заплечник подскажет, что делать новичку: Старейшина, Торговец, Наставник, первая охота.';
  }

  // подсказки при первом открытии окон
  const tc = document.getElementById('tutorial-tips-buttons');
  const th = document.getElementById('tutorial-tips-hint');
  if (!tc) return;
  tc.innerHTML = '';
  const tipsOn = !!(t && t.tips);
  [[true, 'Вкл'], [false, 'Выкл']].forEach(([value, label]) => {
    const btn = document.createElement('button');
    btn.className = 'settings-btn' + (value === tipsOn ? ' active' : '');
    btn.textContent = label;
    btn.onclick = () => setTutorialTips(value);
    tc.appendChild(btn);
  });
  if (th) {
    const total = typeof TUTORIAL_TIPS !== 'undefined' ? Object.keys(TUTORIAL_TIPS).length : 0;
    const seen = t && t.seen ? Object.keys(t.seen).filter(k => typeof TUTORIAL_TIPS !== 'undefined' && TUTORIAL_TIPS[k]).length : 0;
    th.textContent = tipsOn
      ? `Когда впервые открываешь Кузницу, Мастерскую, Склад и другие окна, сумка коротко объясняет, что там. Показано: ${seen} из ${total}.`
      : 'Выключено. «Вкл» — сумка коротко объяснит каждое окно, которое ты ещё не открывал{|а}.';
    th.textContent = heroText(th.textContent);
  }
}

function setTutorialTips(on) {
  const p = state.player;
  if (!p || !p.classId) return;
  if (!p.tutorial || typeof p.tutorial !== 'object') { p.tutorial = tutorialNewHero(true); p.tutorial.hello = false; }
  p.tutorial.tips = !!on;
  if (!p.tutorial.seen) p.tutorial.seen = {};
  tutSave();
  renderTutorialSettings();
}

function setTutorialEnabled(on) {
  const p = state.player;
  if (!p || !p.classId) return;
  if (!p.tutorial || typeof p.tutorial !== 'object') p.tutorial = tutorialNewHero(!on);
  const t = p.tutorial;
  t.on = !!on;
  t.hello = false;
  if (on) {
    t.later = false;
    if (t.done) { t.done = false; t.ack = {}; }
  }
  __tutKey = null; __tutScrolledKey = null;
  if (typeof updateMapTravelButton === 'function') updateMapTravelButton();
  tutSave();
  renderTutorialSettings();
}

// --------------------------------------------------------
//  ОКНО СОЗДАНИЯ: галочка «без обучения» стоит сама, если на аккаунте есть опытный герой
// --------------------------------------------------------
function tutPresetSkipBox() {
  const chk = document.getElementById('tut-skip-chk');
  if (!chk || typeof readSlotMeta !== 'function') return;
  let veteran = false;
  const n = typeof SLOT_COUNT === 'number' ? SLOT_COUNT : 5;
  for (let i = 0; i < n; i++) {
    try { const m = readSlotMeta(i); if (m && m.used && (m.level || 0) > TUT_SKIP_LEVEL) veteran = true; } catch (e) {}
  }
  chk.checked = veteran;
}

// --------------------------------------------------------
//  ГЛАВНЫЙ ЦИКЛ
// --------------------------------------------------------
function tutTick() {
  try {
    // настройки открылись — нарисовать раздел «Обучение»
    const settingsOpen = tutIsOpen('#settings-overlay');
    if (settingsOpen && !__tutSettingsOpen) renderTutorialSettings();
    __tutSettingsOpen = settingsOpen;

    const t = tutState();
    const onScreen = !!document.querySelector('.screen-overlay.active');   // экран входа / создания
    if (!t || onScreen) { tutHide(); tutChip(false); if (!t) __tutMeetTried = false; return; }
    if (t.firstLoot && !t.firstLoot.itemId && tutDeliverFirstLoot(t.firstLoot)) saveCurrentSlot();

    if (t.hello && !t.on) {
      tutChip(false);
      if (tutDialogueOpen() || tutOtherOverlay() || tutIsOpen('#battle-window')) { tutHide(); return; }
      tutHello();
      return;
    }
    if (__tutKey === 'hello') tutHide();

    const firstDay = !!(t.on && !t.done);
    if (firstDay) {
      const busy = tutDialogueOpen() || tutIsOpen('#battle-window') || tutOtherOverlay();
      tutChip(!busy || t.later, t.later, tutDoneCount(tutFlags()));
    }

    // «Первый день» ведёт — он главнее; в чужих окнах он молчит, и тогда говорит подсказка окна
    const r = firstDay && !t.later ? tutRoute() : null;
    if (!r) {
      const tipId = tutTip(t);
      if (tipId) {
        if (!firstDay) tutChip(false);
        tutShowTip(t, tipId); tutChipDodge(); return;
      }
      if (__tutKey && __tutKey.indexOf('tip-') === 0) tutHide();   // окно закрыли
    }
    if (!firstDay) {
      const goal = tutNextGoal(t);
      if (goal) { tutShowNextGoal(t, goal); return; }
      tutChip(false);
    }
    if (!r) { tutHide(); tutChipDodge(); return; }
    tutShow(r);
    tutChipDodge();
  } catch (e) {
    console.warn('[tutorial]', e);
  }
}

setInterval(tutTick, TUT_TICK_MS);
window.addEventListener('resize', () => { __tutScrolledKey = null; tutTick(); });
