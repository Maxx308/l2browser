// ========================================================
//  СИСТЕМЫ: ПОДГОНКА СНАРЯЖЕНИЯ (REFINE)
//  Логика + UI Мастерской.
//
//  Логика:
//  + Шанс зависит от уровня подгонки (100/90/80/70.../20%).
//  + Цена фиксированная за тир (500/2000/5000).
//  + Неудача: списали Оболы, уровень не потерян.
//  + Вехи каждые 5 уровней → гарантированный бонус:
//      веха 1 (+5):  +1 к pDef / pAtk / mAtk / mDef
//      веха 2 (+10): +2 (накапливается)
//      веха 3 (+15): +3
//      веха 4 (+20): +4
//      веха 5 (+25): +5
//  + Остальные уровни → случайный бонус из пула.
//    Бонусы СКЛАДЫВАЮТСЯ (два раза выпало +10 HP → +20 HP).
//
//  UI:
//  + Карточка «Мастерская» в городе → openRefine().
//  + Слева список надетого. Клик — выбор.
//  + Справа превью + кнопки «Подогнать» / «Сбросить».
//  + История последних подгонок внизу.
//
//  НОВОЕ (v0.11):
//  + Кнопка «Подогнать» переехала ВЫШЕ блока бонусов.
//  + Добавлена кнопка «🗑 Сбросить» — бесплатно, но с confirm().
//  + Сброс пишется в историю: «Сброшено: имя +N → +0».
//
//  НОВОЕ (v0.17.1):
//  + Кнопки больше не «прыгают»: строка про веху теперь есть всегда
//    (показывает ближайшую веху), у кнопки «Подогнать» фикс. ширина.
//  + Кнопки «⏩ +5» и «⏩ +10»: подгонять подряд, пока уровень не вырастет
//    на 5 / 10 (или до максимума). Перед стартом — подтверждение
//    с ожидаемым числом попыток и ценой. Останавливается, если кончились Оболы.
// ========================================================

// История подгонок в текущей сессии (без сохранения).
let __refineHistory = [];
let __refineSelectedSlot = null;  // ключ слота: weapon, armorTop, ring1 и т.д.

// --------------------------------------------------------
//  ЛОГИКА (без UI)
// --------------------------------------------------------

// Попытка подгонки. Возвращает объект с результатом.
function tryRefineItem(item) {
  const p = state.player;

  if (!item) {
    return { success: false, reason: 'Нет предмета', price: 0, bonus: null, isMilestone: false, newLevel: 0 };
  }

  const tier = getItemTier(item);
  const maxRefine = getMaxRefine(tier);
  const currentLevel = item.refineLevel || 0;

  if (currentLevel >= maxRefine) {
    return { success: false, reason: 'Максимум подгонки', price: 0, bonus: null, isMilestone: false, newLevel: currentLevel, chance: 0 };
  }

  const price = getRefinePrice(tier);

  if (p.gold < price) {
    return { success: false, reason: 'Мало Оболов', price: 0, bonus: null, isMilestone: false, newLevel: currentLevel, chance: 0 };
  }

  // Списываем Оболы (в любом случае).
  p.gold -= price;

  const chance = getRefineChance(currentLevel);
  const roll = Math.random() * 100;
  const success = roll < chance;

  if (!success) {
    return {
      success: false,
      reason: 'Неудача',
      price,
      bonus: null,
      isMilestone: false,
      newLevel: currentLevel,
      chance,
    };
  }

  // --- Успех! ---
  const newLevel = currentLevel + 1;
  item.refineLevel = newLevel;

  // Гарантированный бонус от вехи или случайный?
  const isMilestone = isMilestoneLevel(newLevel);
  let bonus;
  if (isMilestone) {
    // Номер вехи: +5 → 1, +10 → 2, +15 → 3, +20 → 4, +25 → 5.
    const milestoneIndex = Math.floor(newLevel / 5);
    bonus = getMilestoneBonus(item, milestoneIndex);
  } else {
    const pool = getRefineBonusPool(item);
    bonus = pool[Math.floor(Math.random() * pool.length)];
  }

  // Применяем бонус к накопленным refineBonuses (СКЛАДЫВАЕТСЯ).
  if (!item.refineBonuses) item.refineBonuses = {};
  const key = bonus.key;
  if (!item.refineBonuses[key]) item.refineBonuses[key] = 0;
  item.refineBonuses[key] = Math.round((item.refineBonuses[key] + bonus.value) * 100) / 100;   // 0.5% и 0.15/сек не копят хвосты
  item.refineFlatV = REFINE_FLAT_VERSION;   // v0.25: HP/MP/реген уже по таблице тиров — миграция не тронет

  if (typeof recalcStats === 'function') recalcStats();
  if (typeof updateTopStatus === 'function') updateTopStatus();
  if (typeof updateCharacterPanel === 'function') updateCharacterPanel();
  if (typeof renderInventory === 'function') renderInventory();
  if (typeof renderEquipSlots === 'function') renderEquipSlots();
  if (typeof saveCurrentSlot === 'function') saveCurrentSlot();

  return {
    success: true,
    reason: 'Успех',
    price,
    bonus,
    isMilestone,
    newLevel,
    chance,
  };
}

// --------------------------------------------------------
//  СБРОС ПОДГОНКИ (v0.11)
//  Обнуляет уровень и стирает все бонусы. Бесплатно.
//  Оболы не возвращаются. Вызывается только с confirm().
// --------------------------------------------------------
function resetRefineItem(item) {
  if (!item) return false;
  const oldLevel = item.refineLevel || 0;
  if (oldLevel <= 0) return false;

  item.refineLevel = 0;
  item.refineBonuses = null;
  item.msType = null;   // v0.25: серьга заново выберет опыт или мастерство

  if (typeof recalcStats === 'function') recalcStats();
  if (typeof updateTopStatus === 'function') updateTopStatus();
  if (typeof updateCharacterPanel === 'function') updateCharacterPanel();
  if (typeof renderInventory === 'function') renderInventory();
  if (typeof renderEquipSlots === 'function') renderEquipSlots();
  if (typeof saveCurrentSlot === 'function') saveCurrentSlot();

  return true;
}

// v0.25: что даст следующая веха (без броска — тип серьги ещё может быть не выбран).
function getMilestonePreviewText(item, idx) {
  const t = item.type;
  if (t !== 'ring' && t !== 'earring' && t !== 'necklace') return `Гарантированный +${idx}`;
  const v = getJewelryMilestoneValues(item);
  if (t === 'necklace') return `+${v.necklace}% опыта`;
  if (t === 'ring') return `+${v.ring}% мастерства`;
  if (item.msType === 'xp') return `+${v.earringXp}% опыта`;
  if (item.msType === 'prof') return `+${v.earringProf}% мастерства`;
  return `+${v.earringXp}% опыта или +${v.earringProf}% мастерства`;
}

// Список бонусов подгонки для тултипа/превью.
function getRefineBonusLines(item) {
  if (!item || !item.refineBonuses) return [];
  const rb = item.refineBonuses;
  const lines = [];

  if (rb.pAtkFlat)         lines.push({ text: `+${rb.pAtkFlat} Атака (вехи)`, milestone: true });
  if (rb.mAtkFlat)         lines.push({ text: `+${rb.mAtkFlat} Маг. атака (вехи)`, milestone: true });
  if (rb.pDefFlat)         lines.push({ text: `+${rb.pDefFlat} Защита (вехи)`, milestone: true });
  if (rb.mDefFlat)         lines.push({ text: `+${rb.mDefFlat} Маг. защита (вехи)`, milestone: true });
  if (rb.xpMsPercent)      lines.push({ text: `+${rb.xpMsPercent}% Опыт (вехи)`, milestone: true });
  if (rb.profMsPercent)    lines.push({ text: `+${rb.profMsPercent}% Мастерство (вехи)`, milestone: true });
  if (rb.hpBonus)          lines.push({ text: `+${rb.hpBonus} HP`, milestone: false });
  if (rb.mpBonus)          lines.push({ text: `+${rb.mpBonus} MP`, milestone: false });
  if (rb.hpRegenOutBonus)  lines.push({ text: `+${Math.round(rb.hpRegenOutBonus * 100) / 100} HP/сек`, milestone: false });
  if (rb.mpRegenOutBonus)  lines.push({ text: `+${Math.round(rb.mpRegenOutBonus * 100) / 100} MP/сек`, milestone: false });
  if (rb.accuracyBonus)    lines.push({ text: `+${rb.accuracyBonus} Точность`, milestone: false });
  if (rb.evasionBonus)     lines.push({ text: `+${rb.evasionBonus} Уворот`, milestone: false });
  if (rb.critBonus)        lines.push({ text: `+${rb.critBonus}% Крит`, milestone: false });
  if (rb.blockBonus)       lines.push({ text: `+${rb.blockBonus}% Блок`, milestone: false });
  if (rb.xpBonusPercent)   lines.push({ text: `+${rb.xpBonusPercent}% Опыт`, milestone: false });
  if (rb.profBonusPercent) lines.push({ text: `+${rb.profBonusPercent}% Владение`, milestone: false });
  if (rb.goldBonusPercent) lines.push({ text: `+${rb.goldBonusPercent}% Оболы`, milestone: false });
  if (rb.dropBonusPercent) lines.push({ text: `+${rb.dropBonusPercent}% Дроп`, milestone: false });

  return lines;
}

// --------------------------------------------------------
//  UI: ОТКРЫТИЕ / ЗАКРЫТИЕ
// --------------------------------------------------------
function openRefine() {
  if (state.player.currentLocation !== 'town') return;

  if (typeof cancelWaitingForResume === 'function') {
    cancelWaitingForResume('открыта мастерская');
  }

  __refineSelectedSlot = null;

  document.getElementById('refine-overlay').classList.add('active');
  renderRefineWindow();
}

function closeRefine() {
  stopRefineBatch();   // v0.29.2: закрыли окно — пачка останавливается
  document.getElementById('refine-overlay').classList.remove('active');
}

// --------------------------------------------------------
//  UI: РЕНДЕР ОКНА
// --------------------------------------------------------
function renderRefineWindow() {
  updateRefineGold();
  renderRefineList();
  renderRefinePreview();
  renderRefineHistory();
}

function updateRefineGold() {
  const el = document.getElementById('refine-gold');
  if (el) el.textContent = state.player.gold;
}

// Слева — список экипировки.
function renderRefineList() {
  const cont = document.getElementById('refine-list');
  if (!cont) return;
  cont.innerHTML = '';

  const p = state.player;
  const slots = ['weapon', 'shield', 'helmet', 'armorTop', 'armorBottom', 'gloves', 'boots', 'ring1', 'ring2', 'earring1', 'earring2', 'necklace'];

  const items = slots
    .map(slot => ({ slot, item: p.equipment[slot] }))
    .filter(x => x.item);

  if (items.length === 0) {
    cont.innerHTML = `<div class="refine-empty">Наденьте снаряжение,<br>чтобы его подогнать.</div>`;
    return;
  }

  items.forEach(({ slot, item }) => {
    const el = document.createElement('div');
    const selected = (__refineSelectedSlot === slot) ? ' selected' : '';
    el.className = 'refine-list-item' + selected;

    const tier = getItemTier(item);
    const maxRef = getMaxRefine(tier);
    const lvl = item.refineLevel || 0;

    el.innerHTML = `
      <div class="refine-list-icon">${item.icon}</div>
      <div class="refine-list-info">
        <div class="refine-list-name">${item.name}${lvl > 0 ? ' +' + lvl : ''}</div>
        <div class="refine-list-sub">Тир ${tier} · Макс +${maxRef}</div>
      </div>
    `;

    el.onclick = () => {
      if (__refineBatch) { showToast('⏩', 'Идёт подгонка — сначала «Стоп»'); return; }
      __refineSelectedSlot = slot;
      renderRefineList();
      renderRefinePreview();
    };

    cont.appendChild(el);
  });
}

// Справа — превью + кнопки + список бонусов.
// НОВОЕ (v0.11): кнопки идут ВЫШЕ блока бонусов.
function renderRefinePreview() {
  const cont = document.getElementById('refine-preview');
  if (!cont) return;

  if (!__refineSelectedSlot) {
    cont.innerHTML = `<div class="refine-preview-empty">Выберите предмет слева,<br>чтобы увидеть превью подгонки.</div>`;
    return;
  }

  const item = state.player.equipment[__refineSelectedSlot];
  if (!item) {
    cont.innerHTML = `<div class="refine-preview-empty">Предмет не найден.</div>`;
    return;
  }

  const tier = getItemTier(item);
  const maxRef = getMaxRefine(tier);
  const lvl = item.refineLevel || 0;
  const isMax = lvl >= maxRef;
  const price = getRefinePrice(tier);
  const chance = isMax ? 0 : getRefineChance(lvl);
  const canAfford = state.player.gold >= price;
  const nextLevel = lvl + 1;
  const nextIsMilestone = !isMax && isMilestoneLevel(nextLevel);

  // Бонусы, уже накопленные.
  const bonusLines = getRefineBonusLines(item);
  let bonusHtml = '';
  if (bonusLines.length > 0) {
    bonusHtml = `<div class="refine-bonus-title">БОНУСЫ ПОДГОНКИ:</div><ul class="refine-bonus-list">` +
      bonusLines.map(b => `<li class="${b.milestone ? 'milestone' : ''}">${b.text}</li>`).join('') +
      `</ul>`;
  } else {
    bonusHtml = `<div class="refine-bonus-title" style="opacity:0.6;">БОНУСОВ ПОКА НЕТ</div>`;
  }

  // ---- Кнопки (в одном ряду) ----
  let refineBtnHtml = '';
  if (isMax) {
    refineBtnHtml = `<button class="refine-btn refine-btn-main" disabled>Максимум +${maxRef}</button>`;
  } else if (!canAfford) {
    refineBtnHtml = `<button class="refine-btn refine-btn-main" disabled>Мало Оболов</button>`;
  } else {
    refineBtnHtml = `<button class="refine-btn refine-btn-main" onclick="applyRefine()">🔧 Подогнать (+${nextLevel})</button>`;
  }

  // v0.17.1: подгонка пачкой (+5 / +10). Кнопки есть всегда — неактивны, если нельзя.
  const batchBtn = (n) => {
    const target = Math.min(maxRef, lvl + n);
    const usable = !isMax && canAfford && (target - lvl) >= 2;
    const sub = isMax ? '—' : `до +${target}`;
    return `<button class="refine-btn refine-btn-batch" ${usable ? `onclick="applyRefineBatch(${n})"` : 'disabled'} title="Подгонять подряд, пока не станет +${target}">⏩ +${n}<small>${sub}</small></button>`;
  };
  refineBtnHtml += batchBtn(5) + batchBtn(10);

  // v0.29.2: пока идёт пачка — вместо кнопок «Стоп» с ходом подгонки.
  const batch = __refineBatch;
  if (batch) {
    refineBtnHtml = `<button class="refine-btn refine-btn-main refine-btn-stop" onclick="stopRefineBatch()">⏹ Стоп<small>попытка ${batch.tries} · до +${batch.target} · −${batch.gold} 🪙</small></button>`;
  }

  // Кнопка «Сбросить» — доступна только если есть что сбрасывать.
  const canReset = lvl > 0 && !batch;
  let resetBtnHtml;
  if (canReset) {
    resetBtnHtml = `<button class="refine-btn-reset" onclick="confirmResetRefine()">🗑 Сбросить</button>`;
  } else {
    resetBtnHtml = `<button class="refine-btn-reset" disabled>🗑 Сбросить</button>`;
  }

  // Информация о вехе. v0.17.1: строка есть ВСЕГДА, чтобы кнопки ниже не прыгали.
  let milestoneInfo = '';
  if (nextIsMilestone) {
    const idx = Math.floor(nextLevel / 5);
    milestoneInfo = `<div class="refine-stats-row refine-milestone-row next"><span class="label">🎉 Веха ${idx} (+${nextLevel})</span><span class="value">${getMilestonePreviewText(item, idx)}</span></div>`;
  } else if (!isMax) {
    const nextMs = Math.min(maxRef, Math.ceil(nextLevel / 5) * 5);
    const left = nextMs - lvl;
    milestoneInfo = isMilestoneLevel(nextMs)
      ? `<div class="refine-stats-row refine-milestone-row"><span class="label">Ближайшая веха</span><span class="value">+${nextMs} (ещё ${left})</span></div>`
      : `<div class="refine-stats-row refine-milestone-row"><span class="label">Ближайшая веха</span><span class="value">—</span></div>`;
  } else {
    milestoneInfo = `<div class="refine-stats-row refine-milestone-row"><span class="label">Вехи</span><span class="value">Все получены</span></div>`;
  }

  // ---- Сборка превью ----
  // НОВЫЙ ПОРЯДОК:
  // 1. Имя
  // 2. Тир · Макс
  // 3. Уровни +N → +N+1
  // 4. Шанс успеха
  // 5. Стоимость
  // 6. (если веха) Гарантированный бонус
  // 7. [🔧 Подогнать] [🗑 Сбросить]      ← КНОПКИ
  // 8. БОНУСЫ ПОДГОНКИ:                  ← растёт вниз
  cont.innerHTML = `
    <div class="refine-preview-name">${item.name}</div>
    <div class="refine-preview-tier">Тир ${tier} · Максимум +${maxRef}</div>

    <div class="refine-preview-levels">
      <span>+${lvl}</span>
      ${isMax ? '' : `<span class="arrow">→</span><span class="next">+${nextLevel}</span>`}
    </div>

    <div class="refine-stats-row">
      <span class="label">Шанс успеха</span>
      <span class="value">${isMax ? '—' : chance + '%'}</span>
    </div>
    <div class="refine-stats-row">
      <span class="label">Стоимость</span>
      <span class="value">🪙 ${price}</span>
    </div>
    ${milestoneInfo}

    <div class="refine-action">
      ${refineBtnHtml}
      ${resetBtnHtml}
    </div>

    ${bonusHtml}
  `;
}

// История.
function renderRefineHistory() {
  const cont = document.getElementById('refine-history-list');
  if (!cont) return;
  cont.innerHTML = '';

  if (__refineHistory.length === 0) {
    cont.innerHTML = `<div class="refine-history-entry">История пуста.</div>`;
    return;
  }

  __refineHistory.slice(0, 10).forEach(h => {
    const el = document.createElement('div');
    let cls = 'refine-history-entry';
    if (h.type === 'reset') {
      cls += ' reset';
    } else if (h.type === 'batch') {
      cls += h.milestones > 0 ? ' milestone' : ' success';
    } else if (h.success) {
      cls += h.isMilestone ? ' milestone' : ' success';
    } else {
      cls += ' fail';
    }

    let text;
    if (h.type === 'reset') {
      text = `Сброшено: ${h.itemName} +${h.oldLevel} → +0`;
    } else if (h.type === 'batch') {
      const failStr = h.fails > 0 ? `, неудач ${h.fails}` : '';
      const msStr = h.milestones > 0 ? `, вех ${h.milestones}` : '';
      const stopStr = h.stopped ? ' — остановлено: мало Оболов' : (h.userStopped ? ' — остановлено' : '');
      text = `⏩ Итого ${h.itemName}: +${h.fromLevel} → +${h.toLevel} (попыток ${h.tries}${failStr}${msStr}, −${h.gold} 🪙)${stopStr}`;
    } else {
      // v0.29.2: у попыток пачки — номер и шанс, чтобы было видно, что каждая бросается отдельно
      const pre = h.batchTry ? `#${h.batchTry} ` : '';
      const ch = h.chance ? ` · шанс ${h.chance}%` : '';
      text = h.success
        ? `${pre}${h.itemName}: +${h.newLevel} → ${h.bonus.label}${h.isMilestone && !/веха/.test(h.bonus.label) ? ' (веха!)' : ''}${ch}`
        : `${pre}${h.itemName}: Неудача (−${h.price} 🪙)${ch}`;
    }
    el.className = cls;
    el.textContent = text;
    cont.appendChild(el);
  });
}

// --------------------------------------------------------
//  UI: ПРИМЕНИТЬ ПОДГОНКУ
// --------------------------------------------------------
function applyRefine() {
  if (!__refineSelectedSlot) return;
  const item = state.player.equipment[__refineSelectedSlot];
  if (!item) return;

  const itemName = item.name;

  const result = tryRefineItem(item);

  // Отсекаем «нечего делать» — без записи в историю.
  if (result.reason === 'Мало Оболов' || result.reason === 'Максимум подгонки') {
    showToast('⚠', result.reason);
    return;
  }

  if (result.success) {
    __refineHistory.unshift({
      success: true,
      itemName,
      newLevel: result.newLevel,
      bonus: result.bonus,
      isMilestone: result.isMilestone,
      price: result.price,
      chance: result.chance,
    });
    showToast('🔧', `Успех! +${result.newLevel}: ${result.bonus.label}`);
    logLoot(`🔧 Подгонка: ${itemName} → +${result.newLevel} (${result.bonus.label})`, 'log-craft');
  } else {
    __refineHistory.unshift({
      success: false,
      itemName,
      price: result.price,
      chance: result.chance,
    });
    showToast('💢', `Подгонка не удалась (−${result.price} 🪙)`);
    logLoot(`💢 Подгонка не удалась: ${itemName} (−${result.price} 🪙)`, 'log-info');
  }

  // Обрезаем историю до 20.
  if (__refineHistory.length > 20) __refineHistory.length = 20;

  // Перерисовка.
  renderRefineWindow();
}

// --------------------------------------------------------
//  UI: СБРОС ПОДГОНКИ (v0.11)
//  Подтверждение → обнуление → запись в историю.
// --------------------------------------------------------
function confirmResetRefine() {
  if (!__refineSelectedSlot) return;
  const item = state.player.equipment[__refineSelectedSlot];
  if (!item) return;

  const lvl = item.refineLevel || 0;
  if (lvl <= 0) return;

  const ok = confirm(
    `Точно сбросить подгонку?\n\n` +
    `${item.name} +${lvl} будет потерян.\n` +
    `Оболы, потраченные на подгонку, НЕ возвращаются.`
  );
  if (!ok) return;

  const itemName = item.name;
  const oldLevel = lvl;

  const success = resetRefineItem(item);
  if (!success) return;

  // Пишем в историю.
  __refineHistory.unshift({
    type: 'reset',
    itemName,
    oldLevel,
  });
  if (__refineHistory.length > 20) __refineHistory.length = 20;

  showToast('🗑', `Подгонка сброшена: ${itemName} +${oldLevel} → +0`);
  logLoot(`🗑 Подгонка сброшена: ${itemName} +${oldLevel} → +0`, 'log-info');

  renderRefineWindow();
}

// --------------------------------------------------------
//  v0.17.1: ПОДГОНКА ПАЧКОЙ (+5 / +10)
// --------------------------------------------------------

// Ожидаемое число попыток и цена, чтобы дойти с from до to.
function estimateRefineBatch(item, from, to) {
  const price = getRefinePrice(getItemTier(item));
  let tries = 0;
  for (let l = from; l < to; l++) {
    const ch = Math.max(1, getRefineChance(l));
    tries += 100 / ch;
  }
  return { tries: Math.ceil(tries), gold: Math.ceil(tries) * price, price };
}

// v0.29.2: пачка идёт по одной попытке в REFINE_BATCH_STEP_MS — каждая видна в истории,
// раньше все попытки проходили мгновенно и игрок видел только итоговую сумму.
const REFINE_BATCH_STEP_MS = 450;
let __refineBatch = null;   // идущая пачка: { item, slot, target, fromLevel, tries, fails, gold, milestones, stopped, timer }

function applyRefineBatch(levels) {
  if (!__refineSelectedSlot || __refineBatch) return;
  const item = state.player.equipment[__refineSelectedSlot];
  if (!item) return;

  const p = state.player;
  const tier = getItemTier(item);
  const maxRef = getMaxRefine(tier);
  const fromLevel = item.refineLevel || 0;
  const target = Math.min(maxRef, fromLevel + levels);
  if (target <= fromLevel) { showToast('⚠', 'Максимум подгонки'); return; }

  const est = estimateRefineBatch(item, fromLevel, target);
  if (p.gold < est.price) { showToast('⚠', 'Мало Оболов'); return; }

  const ok = confirm(
    `Подгонять «${item.name}» с +${fromLevel} до +${target}?\n\n` +
    `Ожидаемо: ~${est.tries} попыток, ~${est.gold} Оболов (у вас ${p.gold}).\n` +
    `Одна попытка — ${est.price} Оболов, шанс бросается на каждую отдельно.\n` +
    `Неудача уровень не снимает. Остановить можно в любой момент.\n` +
    `Если Оболы кончатся — подгонка остановится.`
  );
  if (!ok) return;

  __refineBatch = {
    item, slot: __refineSelectedSlot, target, fromLevel,
    tries: 0, fails: 0, gold: 0, milestones: 0, stopped: false, gained: {}, timer: null,
  };
  renderRefineWindow();
  __refineBatch.timer = setTimeout(refineBatchStep, REFINE_BATCH_STEP_MS);
}

// Одна попытка пачки: бросок, строка в истории, следующая — через паузу.
function refineBatchStep() {
  const b = __refineBatch;
  if (!b) return;
  b.timer = null;
  const item = b.item;
  if (state.player.equipment[b.slot] !== item || (item.refineLevel || 0) >= b.target) { finishRefineBatch(); return; }

  const r = tryRefineItem(item);
  if (r.reason === 'Мало Оболов') { b.stopped = true; finishRefineBatch(); return; }
  if (r.reason === 'Максимум подгонки') { finishRefineBatch(); return; }

  b.tries++;
  b.gold += r.price || 0;
  if (r.success) {
    if (r.isMilestone) b.milestones++;
    b.gained[r.bonus.label] = (b.gained[r.bonus.label] || 0) + 1;
  } else {
    b.fails++;
  }
  __refineHistory.unshift(r.success
    ? { success: true, itemName: item.name, newLevel: r.newLevel, bonus: r.bonus, isMilestone: r.isMilestone, price: r.price, chance: r.chance, batchTry: b.tries }
    : { success: false, itemName: item.name, price: r.price, chance: r.chance, batchTry: b.tries });
  if (__refineHistory.length > 20) __refineHistory.length = 20;

  if ((item.refineLevel || 0) >= b.target) { finishRefineBatch(); return; }
  renderRefineWindow();
  b.timer = setTimeout(refineBatchStep, REFINE_BATCH_STEP_MS);
}

// Кнопка «Стоп» и закрытие Мастерской.
function stopRefineBatch() {
  if (!__refineBatch) return;
  __refineBatch.userStopped = true;
  finishRefineBatch();
}

function finishRefineBatch() {
  const b = __refineBatch;
  if (!b) return;
  if (b.timer) clearTimeout(b.timer);
  __refineBatch = null;

  const itemName = b.item.name;
  const toLevel = b.item.refineLevel || 0;
  __refineHistory.unshift({
    type: 'batch', itemName, fromLevel: b.fromLevel, toLevel, tries: b.tries, fails: b.fails, gold: b.gold,
    milestones: b.milestones, stopped: b.stopped, userStopped: !!b.userStopped,
  });
  if (__refineHistory.length > 20) __refineHistory.length = 20;

  const bonusStr = Object.keys(b.gained).map(k => b.gained[k] > 1 ? `${k} ×${b.gained[k]}` : k).join(', ');
  logLoot(`⏩ Подгонка пачкой: ${itemName} +${b.fromLevel} → +${toLevel}, попыток ${b.tries}, −${b.gold} 🪙${bonusStr ? ' · ' + bonusStr : ''}`, 'log-craft');
  if (b.stopped) showToast('🪙', `Оболы кончились на +${toLevel}`);
  else if (b.userStopped) showToast('⏹', `Остановлено на +${toLevel} (−${b.gold} 🪙)`);
  else showToast('⏩', `${itemName}: +${b.fromLevel} → +${toLevel} (−${b.gold} 🪙)`);

  if (typeof saveCurrentSlot === 'function') saveCurrentSlot();   // неудачные попытки тоже списали Оболы
  renderRefineWindow();
}

