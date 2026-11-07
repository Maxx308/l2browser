// ========================================================
//  СИСТЕМЫ: АЛХИМИК
//  Окно с двумя вкладками: РАСПЫЛИТЬ / ПЕРЕРОЛЛ.
//
//  ЭТАП 3 (v0.10): ЛОГИКА РАСПЫЛЕНИЯ.
//  ЭТАП 4 (v0.10): ЛОГИКА ПЕРЕРОЛЛА.
//    - Сетка инвентаря: только экипировка с редкостью green+.
//    - Каждая ячейка показывает: текущие бонусы + цену переролла.
//    - Клик → проверка пыли → confirm() → переролл.
//    - Если пыли не хватает — карточка серая (не кликабельна).
//
//  НОВОЕ (v0.17): МАССОВОЕ РАСПЫЛЕНИЕ.
//    - Над сеткой — кнопки «Зелёные / Синие / ... / Всё» с количеством.
//    - Одно подтверждение со сводкой: сколько предметов и сколько пыли.
//    - Подогнанные предметы (+N) пачкой НЕ распыляются — только вручную.
//    - Предупреждение, если пыль упрётся в лимит стопки (v0.29: 99 999).
//
//  НОВОЕ (v0.29): ВКЛАДКА «ВОЗВЫШЕНИЕ».
//    - Редкость предмета +1 ступень за пыль его текущего цвета.
//    - Бонусы сохраняются + добавляется разница очков; подгонка остаётся.
//    - Можно возвышать и надетые вещи (они идут первыми в списке).
//
//  Данные алхимии — в js/data/alchemy.js.
// ========================================================

// Текущая активная вкладка.
let __alchemistTab = 'disenchant';   // 'disenchant' | 'reroll' | 'ascend'

// Типы экипировки (что можно распылять/перероллить).
const ALCHEMIST_EQUIP_TYPES = [
  'weapon', 'shield', 'helmet', 'armorTop', 'armorBottom',
  'gloves', 'boots', 'ring', 'earring', 'necklace'
];

// --------------------------------------------------------
//  ОТКРЫТИЕ / ЗАКРЫТИЕ
// --------------------------------------------------------
function openAlchemist() {
  if (state.player.currentLocation !== 'town') return;

  if (typeof cancelWaitingForResume === 'function') {
    cancelWaitingForResume('открыт алхимик');
  }

  const overlay = document.getElementById('alchemist-overlay');
  if (!overlay) return;

  __alchemistTab = 'disenchant';

  overlay.classList.add('active');
  renderAlchemistWindow();
}

function closeAlchemist() {
  const overlay = document.getElementById('alchemist-overlay');
  if (overlay) overlay.classList.remove('active');
}

// --------------------------------------------------------
//  ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
// --------------------------------------------------------
function switchAlchemistTab(tab) {
  if (tab !== 'disenchant' && tab !== 'reroll' && tab !== 'ascend' && tab !== 'smelt') return;
  __alchemistTab = tab;
  renderAlchemistWindow();
}

// --------------------------------------------------------
//  РЕНДЕР ОКНА
// --------------------------------------------------------
function renderAlchemistWindow() {
  const tabs = document.querySelectorAll('.alchemist-tab');
  tabs.forEach(t => {
    t.classList.toggle('active', t.dataset.tab === __alchemistTab);
  });

  ['disenchant', 'reroll', 'ascend', 'smelt'].forEach(tab => {
    const pane = document.getElementById('alchemist-pane-' + tab);
    if (pane) pane.classList.toggle('active', __alchemistTab === tab);
  });

  if (__alchemistTab === 'disenchant') {
    renderAlchemistDisenchant();
  } else if (__alchemistTab === 'reroll') {
    renderAlchemistReroll();
  } else if (__alchemistTab === 'ascend') {
    renderAlchemistAscend();
  } else if (__alchemistTab === 'smelt') {
    renderAlchemistSmelt();
  }
}

// ========================================================
//  ВКЛАДКА «ПЕРЕПЛАВКА» (v0.34.1): 4 пыли → 1 следующего цвета (data/alchemy.js)
// ========================================================
function renderAlchemistSmelt() {
  const pane = document.getElementById('alchemist-pane-smelt');
  if (!pane) return;
  const rate = ALCHEMY_SMELT_RATE;
  const dustIcon = c => `<span class="alchemist-smelt-ico">${(ALCHEMY_DUST[c] && SVG[ALCHEMY_DUST[c].icon]) || ''}</span>`;
  const dustName = c => ALCHEMY_DUST[c] ? ALCHEMY_DUST[c].name.toLowerCase() : c;
  const fmt = n => Number(n).toLocaleString('ru-RU');

  const rows = ALCHEMY_SMELT_STEPS.map(([from, to]) => {
    const max = getSmeltMax(from, to);
    const btn = (n, label) => {
      const ok = n > 0 && n <= max;
      return `<button class="alchemist-bulk-btn rarity-${to}"${ok ? ` onclick="smeltDust('${from}','${to}',${n})"` : ' disabled'}>${label}</button>`;
    };
    return `<div class="alchemist-smelt-row">
      <div class="alchemist-smelt-rate">
        <span class="alchemist-smelt-dust" style="color:${ALCHEMY_DUST[from].color}">${dustIcon(from)} ${rate}</span>
        <span class="alchemist-smelt-arrow">→</span>
        <span class="alchemist-smelt-dust" style="color:${ALCHEMY_DUST[to].color}">${dustIcon(to)} 1</span>
      </div>
      <div class="alchemist-smelt-have">У вас: <b style="color:${ALCHEMY_DUST[from].color}">${fmt(getDustCount(from))}</b> ${dustName(from)} · <b style="color:${ALCHEMY_DUST[to].color}">${fmt(getDustCount(to))}</b> ${dustName(to)}</div>
      <div class="alchemist-bulk-buttons">
        ${btn(1, '+1')}${btn(10, '+10')}${btn(100, '+100')}${btn(1000, '+1 000')}${btn(max, max > 0 ? `Всё: +${fmt(max)}` : 'Всё')}
      </div>
    </div>`;
  }).join('');

  pane.innerHTML = `
    <div class="alchemist-smelt-note">Алхимик переплавляет пыль: из ${rate} пыли выходит 1 пыль следующего цвета. Выше жёлтой не переплавляет — «красная пыль сама приходит, когда ей вздумается».</div>
    ${rows}`;
}

// Переплавить: получить n пыли цвета to за n × 4 пыли цвета from.
function smeltDust(from, to, n) {
  n = Math.floor(n || 0);
  const max = getSmeltMax(from, to);
  if (n <= 0 || n > max) { showToast('⚠', 'Не хватает пыли'); return; }
  // новой стопке нужна ячейка (если исходная пыль не уйдёт целиком)
  const needSlot = getDustCount(to) === 0 && getDustCount(from) > n * ALCHEMY_SMELT_RATE;
  if (needSlot && state.player.inventory.length >= INVENTORY_MAX_SLOTS) { showToast('📦', 'Освободите ячейку в сумке'); return; }
  if (!spendDust(from, n * ALCHEMY_SMELT_RATE)) { showToast('⚠', 'Не хватает пыли'); return; }
  addDustToInventory(to, n);
  const nameTo = ALCHEMY_DUST[to].name.toLowerCase();
  if (typeof logLoot === 'function') logLoot(`⚗ Переплавлено: ${n * ALCHEMY_SMELT_RATE} ${ALCHEMY_DUST[from].name.toLowerCase()} → +${n} ${nameTo}`, 'log-craft rarity-' + to);
  showToast('⚗', `+${n.toLocaleString('ru-RU')} ${nameTo}`);
  renderInventory();
  updateInventoryFooter();
  renderAlchemistSmelt();
  saveCurrentSlot();
}

// --------------------------------------------------------
//  СПИСОК ПРЕДМЕТОВ (общий для распыления и переролла)
// --------------------------------------------------------
function getAlchemistItems() {
  const p = state.player;
  return p.inventory.filter(item => {
    if (!ALCHEMIST_EQUIP_TYPES.includes(item.type)) return false;
    if (!item.rarity || item.rarity === 'white') return false;
    return true;
  });
}

// v0.33: распылять можно ещё и камни душ (перероллить и возвышать — нет). Камни — первыми.
function getDisenchantItems() {
  const gems = state.player.inventory.filter(item => typeof getSoulGemDef === 'function' && getSoulGemDef(item));
  return [...gems, ...getAlchemistItems()];
}

// ========================================================
//  ВКЛАДКА «РАСПЫЛИТЬ» (Этап 3)
// ========================================================

function renderAlchemistDisenchant() {
  const pane = document.getElementById('alchemist-pane-disenchant');
  if (!pane) return;

  const items = getDisenchantItems();

  if (items.length === 0) {
    pane.innerHTML = `<div class="alchemist-empty">Нет предметов для распыления.<br><span class="alchemist-empty-sub">Нужны зелёные и выше (не надетые) или камни душ.</span></div>`;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'alchemist-grid';

  items.forEach(item => {
    grid.appendChild(buildAlchemistDisenchantCard(item));
  });

  pane.innerHTML = '';
  pane.appendChild(buildAlchemistBulkBar());
  pane.appendChild(grid);
}

function buildAlchemistDisenchantCard(item) {
  const card = document.createElement('div');
  const yieldData = getDisenchantYield(item);
  const isGem = typeof getSoulGemDef === 'function' && !!getSoulGemDef(item);
  const rarity = isGem && yieldData ? yieldData.color : (item.rarity || 'white');
  card.className = 'alchemist-card rarity-' + rarity;

  if (!yieldData) return card;

  const qty = item.qty || 1;
  const qtyMult = qty;

  const minTotal = yieldData.min * qtyMult;
  const maxTotal = yieldData.max * qtyMult;

  const dust = ALCHEMY_DUST[yieldData.color];
  const dustName = dust ? dust.name : (yieldData.color + ' пыль');
  const dustColor = dust ? dust.color : '#c8c0b0';
  const dustIcon = dust ? (SVG[dust.icon] || '') : '';

  const refineSuffix = (item.refineLevel > 0) ? ` +${item.refineLevel}` : '';
  const qtySuffix = qty > 1 ? ` ×${qty}` : '';

  const rarityData = RARITIES[rarity];

  card.innerHTML = `
    <div class="alchemist-card-icon">${item.icon || ''}</div>
    <div class="alchemist-card-body">
      <div class="alchemist-card-name rarity-text-${rarity}">${item.name}${refineSuffix}${qtySuffix}</div>
      <div class="alchemist-card-rarity">${isGem ? '💎 Камень души' : (rarityData ? rarityData.name : rarity)}</div>
      <div class="alchemist-card-yield">
        <span class="alchemist-card-yield-icon">${dustIcon}</span>
        <span class="alchemist-card-yield-text" style="color: ${dustColor};">
          Даст: ${minTotal}–${maxTotal} ${dustName.toLowerCase()}
        </span>
      </div>
    </div>
  `;

  card.onmouseenter = (e) => {
    if (typeof showItemTooltip === 'function') showItemTooltip(e, item);
  };
  card.onmouseleave = () => {
    if (typeof hideTooltip === 'function') hideTooltip();
  };

  card.onclick = () => {
    if (typeof hideTooltip === 'function') hideTooltip();
    disenchantItem(item);
  };

  return card;
}

function disenchantItem(item) {
  if (!item) return;

  const p = state.player;
  const idx = p.inventory.indexOf(item);
  if (idx < 0) return;

  const yieldData = getDisenchantYield(item);   // v0.33: у камней души своя пыль
  if (!yieldData) {
    showToast('⚠', 'Белые предметы не распыляются');
    return;
  }

  const qty = item.qty || 1;
  const dust = ALCHEMY_DUST[yieldData.color];
  const dustName = dust ? dust.name : (yieldData.color + ' пыль');

  const minTotal = yieldData.min * qty;
  const maxTotal = yieldData.max * qty;

  const refineSuffix = (item.refineLevel > 0) ? ` +${item.refineLevel}` : '';
  const qtySuffix = qty > 1 ? ` ×${qty}` : '';

  const ok = confirm(
    `Распылить «${item.name}${refineSuffix}${qtySuffix}»?\n\n` +
    `Получите: ${minTotal}–${maxTotal} ${dustName.toLowerCase()}.\n` +
    `Предмет будет уничтожен.`
  );
  if (!ok) return;

  let totalDust = 0;
  for (let i = 0; i < qty; i++) {
    const one = getDisenchantYield(item);
    if (one) totalDust += one.sample;
  }
  if (totalDust <= 0) totalDust = 1;

  p.inventory.splice(idx, 1);
  addDustToInventory(yieldData.color, totalDust);
  if (typeof bumpChronicleCounter === 'function') bumpChronicleCounter('disenchanted', qty);   // v0.30: скрытый счётчик

  const colorTag = yieldData.color;
  const fullLine = `🗑 Распылено: ${item.name}${refineSuffix}${qtySuffix} → +${totalDust} ${dustName.toLowerCase()}`;
  if (typeof logLoot === 'function') {
    logLoot(fullLine, 'log-craft rarity-' + colorTag);
  }
  showToast('🗑', `+${totalDust} ${dustName.toLowerCase()}`);

  renderInventory();
  updateInventoryFooter();
  renderAlchemistDisenchant();
  saveCurrentSlot();
}

// ========================================================
//  ВКЛАДКА «ПЕРЕРОЛЛ» (Этап 4)
// ========================================================

function renderAlchemistReroll() {
  const pane = document.getElementById('alchemist-pane-reroll');
  if (!pane) return;

  const items = getAlchemistItems();

  if (items.length === 0) {
    pane.innerHTML = `<div class="alchemist-empty">Нет предметов для переролла.<br><span class="alchemist-empty-sub">Нужны зелёные и выше (не надетые).</span></div>`;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'alchemist-grid';

  items.forEach(item => {
    grid.appendChild(buildAlchemistRerollCard(item));
  });

  pane.innerHTML = '';
  pane.appendChild(grid);
}

function buildAlchemistRerollCard(item) {
  const card = document.createElement('div');
  const rarity = item.rarity || 'white';
  card.className = 'alchemist-card alchemist-card-reroll rarity-' + rarity;

  // Цена переролла.
  const price = getRerollPrice(item);
  const dustId = rarity;                         // цвет пыли = редкость предмета
  const dust = ALCHEMY_DUST[dustId];
  const dustName = dust ? dust.name : (dustId + ' пыль');
  const dustColor = dust ? dust.color : '#c8c0b0';
  const dustIcon = dust ? (SVG[dust.icon] || '') : '';

  // Сколько пыли у игрока.
  const have = getDustCount(dustId);
  const enough = have >= price;

  // Текущие бонусы.
  const bonusText = formatBonusStatsShort(item.bonusStats);

  const refineSuffix = (item.refineLevel > 0) ? ` +${item.refineLevel}` : '';
  const rarityData = RARITIES[rarity];

  // Если пыли не хватает — серая карточка.
  if (!enough) {
    card.classList.add('alchemist-card-disabled');
  }

  card.innerHTML = `
    <div class="alchemist-card-icon">${item.icon || ''}</div>
    <div class="alchemist-card-body">
      <div class="alchemist-card-name rarity-text-${rarity}">${item.name}${refineSuffix}</div>
      <div class="alchemist-card-rarity">${rarityData ? rarityData.name : rarity}</div>
      <div class="alchemist-card-bonuses">Сейчас: ${bonusText}</div>
      <div class="alchemist-card-yield">
        <span class="alchemist-card-yield-icon">${dustIcon}</span>
        <span class="alchemist-card-yield-text" style="color: ${dustColor};">
          🎲 Переролл: ${price} ${dustName.toLowerCase()}
        </span>
      </div>
      <div class="alchemist-card-stock ${enough ? '' : 'low'}">
        У вас: ${have} / ${price}
      </div>
    </div>
  `;

  card.onmouseenter = (e) => {
    if (typeof showItemTooltip === 'function') showItemTooltip(e, item);
  };
  card.onmouseleave = () => {
    if (typeof hideTooltip === 'function') hideTooltip();
  };

  if (enough) {
    card.onclick = () => {
      if (typeof hideTooltip === 'function') hideTooltip();
      rerollItem(item);
    };
  } else {
    card.onclick = () => {
      showToast('⚠', `Мало ${dustName.toLowerCase()}: ${have} / ${price}`);
    };
  }

  return card;
}

// Короткое описание bonusStats: «+2 STR, +1 DEX» или «—».
function formatBonusStatsShort(bonusStats) {
  if (!bonusStats) return '—';
  const parts = [];
  Object.keys(bonusStats).forEach(stat => {
    const val = bonusStats[stat];
    if (val > 0) parts.push(`+${val} ${stat}`);
  });
  if (parts.length === 0) return '—';
  return parts.join(', ');
}

// Сколько пыли данного цвета у игрока.
function getDustCount(colorId) {
  const dust = ALCHEMY_DUST[colorId];
  if (!dust) return 0;
  return state.player.inventory
    .filter(i => i.name === dust.name)
    .reduce((sum, i) => sum + (i.qty || 0), 0);
}

// Списать пыль данного цвета.
function spendDust(colorId, amount) {
  const dust = ALCHEMY_DUST[colorId];
  if (!dust) return false;

  const p = state.player;
  let need = amount;

  // Идём по всем ячейкам этой пыли и списываем.
  for (const item of p.inventory) {
    if (need <= 0) break;
    if (item.name !== dust.name) continue;

    const take = Math.min(item.qty, need);
    item.qty -= take;
    need -= take;

    if (item.qty <= 0) {
      const idx = p.inventory.indexOf(item);
      if (idx >= 0) p.inventory.splice(idx, 1);
    }
  }

  return need === 0;
}

// --------------------------------------------------------
//  ПЕРЕРОЛЛ
// --------------------------------------------------------
function rerollItem(item) {
  if (!item) return;

  const rarity = item.rarity;
  if (!rarity || rarity === 'white') {
    showToast('⚠', 'Белые предметы не переролливаются');
    return;
  }

  const price = getRerollPrice(item);
  const dust = ALCHEMY_DUST[rarity];
  const dustName = dust ? dust.name : (rarity + ' пыль');

  const have = getDustCount(rarity);
  if (have < price) {
    showToast('⚠', `Мало ${dustName.toLowerCase()}: ${have} / ${price}`);
    return;
  }

  const refineSuffix = (item.refineLevel > 0) ? ` +${item.refineLevel}` : '';

  const ok = confirm(
    `Перероллить статы «${item.name}${refineSuffix}»?\n\n` +
    `Стоимость: ${price} ${dustName.toLowerCase()}.\n` +
    `Текущие бонусы сбросятся и будут раскиданы заново.`
  );
  if (!ok) return;

  // Списываем пыль.
  const spent = spendDust(rarity, price);
  if (!spent) {
    showToast('⚠', 'Не удалось списать пыль');
    return;
  }

  // Генерируем новые бонусы.
  const newBonus = rollNewBonusStats(item);
  item.bonusStats = newBonus;

  // Обновляем статы игрока (если предмет надет — но он не надет, потому что мы берём только из инвентаря).
  // На всякий случай пересчитаем — вдруг когда-то предмет окажется надет.
  if (typeof recalcStats === 'function') recalcStats();

  // Логи.
  const bonusText = formatBonusStatsShort(newBonus);
  if (typeof logLoot === 'function') {
    logLoot(`🎲 Переролл: ${item.name}${refineSuffix} → ${bonusText} (−${price} ${dustName.toLowerCase()})`, 'log-craft');
  }
  showToast('🎲', `${item.name}${refineSuffix} → новые статы: ${bonusText}`);

  // Обновляем UI.
  renderInventory();
  updateInventoryFooter();
  renderAlchemistReroll();
  updateCharacterPanel();
  saveCurrentSlot();
}

// ========================================================
//  ВКЛАДКА «ВОЗВЫШЕНИЕ» (v0.29)
// ========================================================

// Надетые вещи (сначала) + вещи из сумки, которые ещё можно возвысить.
function getAscendItems() {
  const p = state.player;
  const equipped = Object.values(p.equipment || {})
    .filter(it => it && ALCHEMIST_EQUIP_TYPES.includes(it.type) && getAscendTarget(it));
  const bag = getAlchemistItems().filter(it => getAscendTarget(it));
  return [...equipped.map(it => ({ item: it, equipped: true })), ...bag.map(it => ({ item: it, equipped: false }))];
}

function renderAlchemistAscend() {
  const pane = document.getElementById('alchemist-pane-ascend');
  if (!pane) return;

  const list = getAscendItems();
  const intro = `<div class="alchemist-ascend-intro">Возвышение поднимает редкость на ступень: 🟢→🔵→🟣→🟡→🔴. ` +
    `Платится пылью текущего цвета — как от ${ALCHEMY_ASCEND_ITEMS} распылённых таких же вещей. ` +
    `Бонусы и подгонка сохраняются, добавляются новые очки.</div>`;

  if (list.length === 0) {
    pane.innerHTML = intro + `<div class="alchemist-empty">Нечего возвышать.<br><span class="alchemist-empty-sub">Нужны вещи от зелёной до жёлтой — в сумке или надетые.</span></div>`;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'alchemist-grid';
  list.forEach(({ item, equipped }) => grid.appendChild(buildAlchemistAscendCard(item, equipped)));

  pane.innerHTML = intro;
  pane.appendChild(grid);
}

function buildAlchemistAscendCard(item, equipped) {
  const card = document.createElement('div');
  const rarity = item.rarity;
  const target = getAscendTarget(item);
  card.className = 'alchemist-card alchemist-card-ascend rarity-' + rarity;

  const price = getAscendPrice(item);
  const dust = ALCHEMY_DUST[rarity];
  const dustName = dust ? dust.name : (rarity + ' пыль');
  const dustColor = dust ? dust.color : '#c8c0b0';
  const dustIcon = dust ? (SVG[dust.icon] || '') : '';
  const have = getDustCount(rarity);
  const enough = have >= price;
  if (!enough) card.classList.add('alchemist-card-disabled');

  const refineSuffix = (item.refineLevel > 0) ? ` +${item.refineLevel}` : '';
  const from = RARITIES[rarity], to = RARITIES[target];
  const extra = getAscendExtraPoints(item);

  card.innerHTML = `
    <div class="alchemist-card-icon">${item.icon || ''}</div>
    <div class="alchemist-card-body">
      <div class="alchemist-card-name rarity-text-${rarity}">${item.name}${refineSuffix}${equipped ? ' <span class="alchemist-card-worn">надето</span>' : ''}</div>
      <div class="alchemist-card-rarity">
        <span class="rarity-text-${rarity}">${from.name}</span> → <span class="rarity-text-${target}">${to.name}</span>
      </div>
      <div class="alchemist-card-bonuses">Сейчас: ${formatBonusStatsShort(item.bonusStats)} · станет +${extra} ${extra === 1 ? 'очко' : 'очка'}, статы +${from.statPercent}% → +${to.statPercent}%</div>
      <div class="alchemist-card-yield">
        <span class="alchemist-card-yield-icon">${dustIcon}</span>
        <span class="alchemist-card-yield-text" style="color: ${dustColor};">
          ⬆ Возвышение: ${price.toLocaleString('ru-RU')} ${dustName.toLowerCase()}
        </span>
      </div>
      <div class="alchemist-card-stock ${enough ? '' : 'low'}">
        У вас: ${have.toLocaleString('ru-RU')} / ${price.toLocaleString('ru-RU')}
      </div>
    </div>
  `;

  card.onmouseenter = (e) => { if (typeof showItemTooltip === 'function') showItemTooltip(e, item); };
  card.onmouseleave = () => { if (typeof hideTooltip === 'function') hideTooltip(); };
  card.onclick = () => {
    if (typeof hideTooltip === 'function') hideTooltip();
    if (enough) ascendItem(item);
    else showToast('⚠', `Мало ${dustName.toLowerCase()}: ${have} / ${price}`);
  };
  return card;
}

function ascendItem(item) {
  const target = getAscendTarget(item);
  if (!target) return;

  const rarity = item.rarity;
  const price = getAscendPrice(item);
  const dust = ALCHEMY_DUST[rarity];
  const dustName = dust ? dust.name.toLowerCase() : rarity + ' пыль';
  const have = getDustCount(rarity);
  if (have < price) {
    showToast('⚠', `Мало ${dustName}: ${have} / ${price}`);
    return;
  }

  const refineSuffix = (item.refineLevel > 0) ? ` +${item.refineLevel}` : '';
  const extra = getAscendExtraPoints(item);
  const ok = confirm(
    `Возвысить «${item.name}${refineSuffix}»?\n\n` +
    `${RARITIES[rarity].name} → ${RARITIES[target].name}\n` +
    `Стоимость: ${price.toLocaleString('ru-RU')} ${dustName}.\n` +
    `Бонусы сохранятся, добавится +${extra} к случайным статам.`
  );
  if (!ok) return;

  if (!spendDust(rarity, price)) {
    showToast('⚠', 'Не удалось списать пыль');
    return;
  }

  // Новая редкость + добавочные очки поверх старых бонусов.
  const add = rollRarityStats(extra, getRarityStatProfile(item));
  const bonus = { ...(item.bonusStats || {}) };
  Object.keys(add).forEach(stat => { bonus[stat] = (bonus[stat] || 0) + add[stat]; });
  item.rarity = target;
  item.bonusStats = bonus;

  recalcStats();

  const name = `${item.name}${refineSuffix}`;
  logLoot(`⬆ Возвышение: ${name} → ${RARITIES[target].name} (${formatBonusStatsShort(add)}; −${price} ${dustName})`, 'log-craft rarity-' + target);
  showToast('⬆', `${name}: ${RARITIES[target].name}!`);

  renderInventory();
  updateInventoryFooter();
  if (typeof renderEquipSlots === 'function') renderEquipSlots();
  updateCharacterPanel();
  updateTopStatus();
  renderAlchemistAscend();
  saveCurrentSlot();
}

// --------------------------------------------------------
//  ДОБАВИТЬ ПЫЛЬ В ИНВЕНТАРЬ
// --------------------------------------------------------
function addDustToInventory(colorId, amount) {
  if (!amount || amount <= 0) return;

  const p = state.player;
  const dust = ALCHEMY_DUST[colorId];
  if (!dust) return;

  const existing = p.inventory.find(i => i.name === dust.name);

  if (existing) {
    existing.qty = (existing.qty || 0) + amount;
    if (existing.qty > ALCHEMY_DUST_STACK_MAX) existing.qty = ALCHEMY_DUST_STACK_MAX;
    return;
  }

  if (p.inventory.length >= INVENTORY_MAX_SLOTS) {
    showToast('📦', 'Инвентарь переполнен — пыль потеряна');
    return;
  }

  const iconSvg = SVG[dust.icon] || '';
  p.inventory.push({
    id: 'item_' + Date.now() + '_' + Math.random(),
    name: dust.name,
    type: 'material',
    icon: iconSvg,
    qty: Math.min(ALCHEMY_DUST_STACK_MAX, amount),   // v0.17: тот же лимит, что и у существующей стопки
    sellPrice: 0,
    rarity: dust.rarity,
    isDust: true,
  });
}

// --------------------------------------------------------
//  ЗАКРЫТИЕ ПО КЛИКУ НА ФОН / ESC
// --------------------------------------------------------
document.addEventListener('click', (e) => {
  const overlay = document.getElementById('alchemist-overlay');
  if (!overlay || !overlay.classList.contains('active')) return;
  if (e.target === overlay) closeAlchemist();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const overlay = document.getElementById('alchemist-overlay');
  if (overlay && overlay.classList.contains('active')) closeAlchemist();
});

// ========================================================
//  МАССОВОЕ РАСПЫЛЕНИЕ (v0.17)
// ========================================================

// Лимит пыли в одной стопке — ALCHEMY_DUST_STACK_MAX в data/alchemy.js (v0.29: 99 999).

const ALCHEMY_BULK_LABELS = {
  green:  'Зелёные',
  blue:   'Синие',
  purple: 'Фиолетовые',
  yellow: 'Жёлтые',
  red:    'Красные',
};

// Предметы для распыления пачкой: нужная редкость, без подгонки.
// rarity — 'green' | 'blue' | ... | 'all'
function getBulkDisenchantItems(rarity) {
  return getDisenchantItems().filter(item => {
    if ((item.refineLevel || 0) > 0) return false;
    const y = getDisenchantYield(item);   // v0.33: камни душ — по цвету своей пыли
    if (!y) return false;
    return rarity === 'all' || y.color === rarity;
  });
}

function countItemsQty(items) {
  return items.reduce((s, i) => s + (i.qty || 1), 0);
}

// Панель кнопок над сеткой.
function buildAlchemistBulkBar() {
  const bar = document.createElement('div');
  bar.className = 'alchemist-bulk';

  const title = document.createElement('div');
  title.className = 'alchemist-bulk-title';
  title.textContent = 'Распылить пачкой:';
  bar.appendChild(title);

  const btns = document.createElement('div');
  btns.className = 'alchemist-bulk-buttons';

  ALCHEMY_DUST_ORDER.forEach(rarity => {
    const n = countItemsQty(getBulkDisenchantItems(rarity));
    if (n <= 0) return;
    const b = document.createElement('button');
    b.className = 'alchemist-bulk-btn rarity-' + rarity;
    b.innerHTML = `${ALCHEMY_BULK_LABELS[rarity] || rarity} <span class="alchemist-bulk-count">${n}</span>`;
    b.onclick = () => disenchantBulk(rarity);
    btns.appendChild(b);
  });

  const total = countItemsQty(getBulkDisenchantItems('all'));
  const all = document.createElement('button');
  all.className = 'alchemist-bulk-btn all';
  all.innerHTML = `Всё <span class="alchemist-bulk-count">${total}</span>`;
  if (total <= 0) all.disabled = true;
  else all.onclick = () => disenchantBulk('all');
  btns.appendChild(all);

  bar.appendChild(btns);

  const refined = getAlchemistItems().filter(i => (i.refineLevel || 0) > 0).length;
  if (refined > 0) {
    const hint = document.createElement('div');
    hint.className = 'alchemist-bulk-hint';
    hint.textContent = `Подогнанные предметы (+N) пачкой не распыляются — только по одному (${refined} шт.).`;
    bar.appendChild(hint);
  }

  return bar;
}

// Распылить все подходящие предметы одной редкости (или все).
function disenchantBulk(rarity) {
  const p = state.player;
  const items = getBulkDisenchantItems(rarity);
  if (items.length === 0) {
    showToast('⚠', 'Нечего распылять');
    return;
  }

  // ---- Сводка по цветам пыли ----
  const byColor = {};
  items.forEach(item => {
    const y = getDisenchantYield(item);
    if (!y) return;
    const qty = item.qty || 1;
    const g = byColor[y.color] || (byColor[y.color] = { count: 0, min: 0, max: 0 });
    g.count += qty;
    g.min += y.min * qty;
    g.max += y.max * qty;
  });

  const lines = [];
  const capWarnings = [];
  ALCHEMY_DUST_ORDER.forEach(color => {
    const g = byColor[color];
    if (!g) return;
    const dust = ALCHEMY_DUST[color];
    const dustName = dust ? dust.name.toLowerCase() : color;
    lines.push(`• ${ALCHEMY_BULK_LABELS[color] || color}: ${g.count} шт. → ${g.min}–${g.max} ${dustName}`);
    const have = getDustCount(color);
    if (have + g.max > ALCHEMY_DUST_STACK_MAX) {
      capWarnings.push(`${dustName}: у вас ${have}, лимит ${ALCHEMY_DUST_STACK_MAX}`);
    }
  });

  const totalQty = countItemsQty(items);
  let text = `Распылить ${totalQty} шт.?\n\n${lines.join('\n')}\n\nПредметы будут уничтожены.`;
  if (rarity === 'all' || rarity === 'yellow' || rarity === 'red') {
    text += `\nСреди них могут быть ценные вещи — проверьте сетку перед подтверждением.`;
  }
  if (capWarnings.length) {
    text += `\n\n⚠ Пыль сверх лимита пропадёт:\n${capWarnings.join('\n')}`;
  }
  if (!confirm(text)) return;

  // ---- Распыление ----
  const gained = {};
  items.forEach(item => {
    const idx = p.inventory.indexOf(item);
    if (idx < 0) return;
    const qty = item.qty || 1;
    let sum = 0, color = null;
    for (let i = 0; i < qty; i++) {
      const one = getDisenchantYield(item);
      if (one) { sum += one.sample; color = one.color; }
    }
    if (!color) return;
    if (sum <= 0) sum = 1;
    p.inventory.splice(idx, 1);
    gained[color] = (gained[color] || 0) + sum;
  });

  const parts = [];
  ALCHEMY_DUST_ORDER.forEach(color => {
    const amount = gained[color];
    if (!amount) return;
    const before = getDustCount(color);
    addDustToInventory(color, amount);
    const real = getDustCount(color) - before;
    const dust = ALCHEMY_DUST[color];
    const dustName = dust ? dust.name.toLowerCase() : color;
    const lost = amount - real;
    const lostStr = lost > 0 ? ` (сверх лимита пропало ${lost})` : '';
    parts.push(`+${real} ${dustName}`);
    if (typeof logLoot === 'function') {
      logLoot(`🗑 Распылено пачкой: ${byColor[color] ? byColor[color].count : ''} шт. → +${real} ${dustName}${lostStr}`, 'log-craft rarity-' + color);
    }
  });

  showToast('🗑', parts.length ? parts.join(', ') : 'Распылено');

  renderInventory();
  updateInventoryFooter();
  renderAlchemistDisenchant();
  saveCurrentSlot();
}

