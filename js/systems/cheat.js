// ========================================================
//  СИСТЕМЫ: ЧИТ-МЕНЮ
//  Оверлей с настройками:
//   - РЕЙТЫ (×1 / ×10 / ×100 / ×1000) — опыт, золото, дроп
//   - РЕСУРСЫ (+100 / +500 / +1000 каждого материала)
//   - ОБОЛЫ (+10К / +100К / +1М)
//   - ТИТУЛЫ (открыть все титулы — всем монстрам × 1000 убийств)
//
//  Рейт хранится в state.player.cheatRate (1 по умолчанию).
//  Старое поле state.cheat (bool) сохранено для совместимости:
//  если cheatRate > 1 — считаем «чит включён».
//
//  НОВОЕ:
//  + Убран «Мех» из списка выдаваемых материалов.
//  + Добавлен «Уголь» (PNG-иконка).
//
//  НОВОЕ (v0.12b):
//  + В matIcons добавлены 4 новых материала Копи:
//    Медь, Олово, Хитин, Каменные пластины.
//    Пути к PNG пока нет — используем SVG-иконки (iconKey),
//    которые подставляются через SVG[...] при отсутствии PNG.
//
//  НОВОЕ (v0.12d):
//  + Материалы Копи теперь используют PNG:
//    img/materials/copper.webp, tin.png, chitin.png, stone_plates.png.
//  + SVG-иконки (copper, tin, chitin, stonePlates) остаются как
//    резервный вариант — если PNG не найдётся.
// ========================================================

// Возможные значения рейтов.
const CHEAT_RATE_VALUES = [1, 10, 100, 1000];

// v0.26: метка «на герое использовали чит» — ставится навсегда, сбросить нельзя.
// Такой герой не попадает в рейтинг (leaderboard.js → isHiddenFromLeaderboard).
function markCheatUsed() {
  const p = state.player;
  if (p.usedCheat) return;
  p.usedCheat = true;
  if (typeof hideMyLeaderboardRow === 'function') hideMyLeaderboardRow();
}

// ---------- ОТКРЫТИЕ / ЗАКРЫТИЕ МЕНЮ ----------
function openCheatMenu() {
  const overlay = document.getElementById('cheat-overlay');
  if (!overlay) return;
  renderCheatMenu();
  overlay.classList.add('active');
}

function closeCheatMenu() {
  const overlay = document.getElementById('cheat-overlay');
  if (overlay) overlay.classList.remove('active');
}

// Старая функция toggleCheat осталась — на случай, если где-то вызывается.
// Теперь она просто открывает меню.
function toggleCheat() {
  openCheatMenu();
}

// ---------- РИСОВАНИЕ МЕНЮ ----------
function renderCheatMenu() {
  const cont = document.getElementById('cheat-overlay-content');
  if (!cont) return;

  const p = state.player;
  const currentRate = p.cheatRate || 1;

  // ---- Блок РЕЙТЫ ----
  let rateHtml = '<div class="cheat-block"><div class="cheat-block-title">РЕЙТЫ</div>';
  rateHtml += '<div class="cheat-block-desc">Множитель опыта, золота и шанса дропа.</div>';
  rateHtml += '<div class="cheat-btn-row">';
  CHEAT_RATE_VALUES.forEach(v => {
    const activeClass = (v === currentRate) ? ' active' : '';
    rateHtml += `<button class="cheat-rate-btn${activeClass}" onclick="setCheatRate(${v})">×${v}</button>`;
  });
  rateHtml += '</div></div>';

  // ---- Блок РЕСУРСЫ ----
  const resourceAmounts = [100, 500, 1000];
  let resHtml = '<div class="cheat-block"><div class="cheat-block-title">РЕСУРСЫ</div>';
  resHtml += '<div class="cheat-block-desc">Начислить все материалы из списка игры.</div>';
  resHtml += '<div class="cheat-btn-row">';
  resourceAmounts.forEach(v => {
    resHtml += `<button class="cheat-rate-btn" onclick="cheatGrantResources(${v})">+${v}</button>`;
  });
  resHtml += '</div></div>';

  // ---- Блок ОБОЛЫ ----
  let goldHtml = '<div class="cheat-block"><div class="cheat-block-title">ОБОЛЫ</div>';
  goldHtml += '<div class="cheat-block-desc">Начислить золото.</div>';
  goldHtml += '<div class="cheat-btn-row">';
  goldHtml += `<button class="cheat-rate-btn" onclick="cheatGrantGold(10000)">+10К</button>`;
  goldHtml += `<button class="cheat-rate-btn" onclick="cheatGrantGold(100000)">+100К</button>`;
  goldHtml += `<button class="cheat-rate-btn" onclick="cheatGrantGold(1000000)">+1М</button>`;
  goldHtml += '</div></div>';

  // ---- v0.36: Блок УРОВЕНЬ ----
  let levelHtml = '<div class="cheat-block"><div class="cheat-block-title">УРОВЕНЬ</div>';
  levelHtml += `<div class="cheat-block-desc">Сейчас ${p.level} из ${MAX_PLAYER_LEVEL}. Очки навыков начисляются как при обычной прокачке.</div>`;
  levelHtml += '<div class="cheat-btn-row">';
  levelHtml += `<button class="cheat-rate-btn" onclick="cheatAddLevels(1)">+1</button>`;
  levelHtml += `<button class="cheat-rate-btn" onclick="cheatAddLevels(5)">+5</button>`;
  levelHtml += `<button class="cheat-rate-btn" onclick="cheatAddLevels(${MAX_PLAYER_LEVEL})">До ${MAX_PLAYER_LEVEL}</button>`;
  levelHtml += '</div></div>';

  // ---- v0.36: Блок КОМПЛЕКТЫ ----
  let setsHtml = '<div class="cheat-block"><div class="cheat-block-title">КОМПЛЕКТЫ</div>';
  setsHtml += '<div class="cheat-block-desc">Эпическое качество, кладётся в сумку. Статы редкости — случайные, под класс героя.</div>';
  setsHtml += `<div class="cheat-block-desc">Одежда:</div><div class="cheat-btn-row">${cheatSetButtons(false)}</div>`;
  setsHtml += `<div class="cheat-block-desc" style="margin-top:8px">Бижутерия:</div><div class="cheat-btn-row">${cheatSetButtons(true)}</div>`;
  setsHtml += '</div>';

  // ---- Блок ТИТУЛЫ ----
  let titleHtml = '<div class="cheat-block"><div class="cheat-block-title">ТИТУЛЫ</div>';
  titleHtml += '<div class="cheat-block-desc">Открыть все титулы всем монстрам (1000 убийств каждому).</div>';
  titleHtml += '<div class="cheat-btn-row">';
  titleHtml += `<button class="cheat-rate-btn" onclick="cheatUnlockAllTitles()">🌟 Открыть все титулы</button>`;
  titleHtml += `<button class="cheat-rate-btn" onclick="cheatResetKills()">🗑 Сбросить счётчики</button>`;
  titleHtml += '</div></div>';

  // ---- v0.36: Блок ИЛЬГРАД (в разработке) ----
  let ilgradHtml = '<div class="cheat-block"><div class="cheat-block-title">ИЛЬГРАД</div>';
  ilgradHtml += '<div class="cheat-block-desc">Второй город (в разработке). Открывает путь на карте.</div>';
  ilgradHtml += '<div class="cheat-btn-row">';
  ilgradHtml += `<button class="cheat-rate-btn${p.ilgradOpen ? ' active' : ''}" onclick="cheatToggleIlgrad()">🏰 ${p.ilgradOpen ? 'Закрыть Ильград' : 'Открыть Ильград'}</button>`;
  ilgradHtml += `<button class="cheat-rate-btn" onclick="cheatStartBreakthrough()">⚔ Прорыв (проба)</button>`;
  ilgradHtml += '</div></div>';

  cont.innerHTML = rateHtml + levelHtml + setsHtml + resHtml + goldHtml + titleHtml + ilgradHtml;
}

// ---------- УСТАНОВКА РЕЙТА ----------
function setCheatRate(rate) {
  if (!CHEAT_RATE_VALUES.includes(rate)) return;
  state.player.cheatRate = rate;
  if (rate > 1) markCheatUsed();

  // Синхронизируем старое поле state.cheat для совместимости.
  state.cheat = rate > 1;

  // Обновляем текст на верхней кнопке.
  updateCheatButtonLabel();

  // Перерисовываем меню (чтобы подсветить активный рейт).
  renderCheatMenu();

  // Сохраняем.
  saveCurrentSlot();
}

// Обновляет надпись на кнопке «ЧИТ» в верхней панели.
function updateCheatButtonLabel() {
  const btn = document.getElementById('btn-cheat');
  if (!btn) return;
  const rate = state.player.cheatRate || 1;
  if (rate > 1) {
    btn.classList.add('on');
    btn.textContent = `ЧИТ ×${rate}`;
  } else {
    btn.classList.remove('on');
    btn.textContent = 'ЧИТ ×1';
  }
}

// ---------- РЕСУРСЫ ----------
function cheatGrantResources(amount) {
  const p = state.player;

  // PNG-иконки материалов (img/materials/).
  // Если у материала есть PNG — используем его.
  // Иначе (например, для новых материалов Копи) — используем SVG.
  //
  // v0.12b: добавлены 4 материала Копи (изначально без PNG).
  // v0.12d: для них появились PNG (copper, tin, chitin, stone_plates).
  //         SVG-иконки оставлены как резерв.
  const matPng = {
    'Нить':        'img/materials/thread.webp',
    'Ткань':       'img/materials/fabric.webp',
    'Клей':        'img/materials/glue.webp',
    'Ветвь':       'img/materials/branch.webp',
    'Руда железа': 'img/materials/iron_ore.webp',
    'Кости':       'img/materials/bone.webp',
    'Жабья шкура': 'img/materials/frog.webp',
    'Шкура волка': 'img/materials/pelt.webp',
    'Мясо':        'img/materials/meat.webp',
    'Клык':        'img/materials/fang.webp',
    'Кожа':        'img/materials/leather.webp',
    'Шкура':       'img/materials/fur.webp',
    'Уголь':       'img/materials/coal.webp',
    // ---- НОВОЕ (v0.12d): материалы Копи ----
    'Медь':              'img/materials/copper.webp',
    'Олово':             'img/materials/tin.webp',
    'Хитин':             'img/materials/chitin.webp',
    'Каменные пластины': 'img/materials/stone_plates.webp',
  };

  // SVG-иконки для новых материалов Копи (v0.12b) — резерв,
  // если PNG почему-то нет.
  const matSvg = {
    'Медь':            'copper',
    'Олово':           'tin',
    'Хитин':           'chitin',
    'Каменные пластины': 'stonePlates',
  };

  ALL_RESOURCES.forEach(name => {
    const existing = p.inventory.find(i => i.name === name);
    if (existing) {
      existing.qty += amount;
      // Починка старой иконки: если у предмета иконка не HTML — меняем.
      if (typeof existing.icon === 'string' && !existing.icon.includes('<img') && !existing.icon.includes('<svg')) {
        if (matPng[name]) existing.icon = normalizeIconHtml(matPng[name]);
        else if (matSvg[name] && SVG[matSvg[name]]) existing.icon = SVG[matSvg[name]];
      }
    } else {
      // Проверяем лимит инвентаря: если мест нет, пропускаем.
      if (p.inventory.length >= invMaxSlots()) return;

      // Иконка: сначала PNG, потом SVG.
      let iconHtml = SVG.gold;
      if (matPng[name]) {
        iconHtml = normalizeIconHtml(matPng[name]);
      } else if (matSvg[name] && SVG[matSvg[name]]) {
        iconHtml = SVG[matSvg[name]];
      }

      p.inventory.push({
        id: 'item_' + Date.now() + '_' + Math.random(),
        name: name, type: 'material', icon: iconHtml,
        qty: amount, sellPrice: 2,
      });
    }
  });

  // v0.33: камни душ — отдельно, с меткой soulGem (иначе их заберут как старые рубины)
  if (typeof addSoulGems === 'function') Object.keys(SOUL_GEM_ITEMS).forEach(name => addSoulGems(name, amount));

  markCheatUsed();
  logLoot(`🎁 ЧИТ: +${amount} каждого ресурса`, 'log-craft');
  updateTopStatus();
  renderInventory();
  updateInventoryFooter();

  showToast('🎁', `+${amount} каждого ресурса`);

  saveCurrentSlot();
}

// ---------- ОБОЛЫ ----------
function cheatGrantGold(amount) {
  const p = state.player;
  p.gold += amount;
  markCheatUsed();

  logLoot(`🪙 ЧИТ: +${amount} Оболов`, 'log-craft');
  showToast('🪙', `+${amount} Оболов`);

  updateTopStatus();
  updateInventoryFooter();
  if (typeof updateTraderGold === 'function') updateTraderGold();
  if (typeof updateForgeGold === 'function') updateForgeGold();
  if (typeof updateGuildGold === 'function') updateGuildGold();
  if (typeof updateTavernGold === 'function') updateTavernGold();

  saveCurrentSlot();
}

// ---------- УРОВЕНЬ (v0.36) ----------
// Через обычное повышение (checkLevelUp): очки навыков, полное HP/MP, поручения — как при прокачке.
function cheatAddLevels(n) {
  const p = state.player;
  if (!p.classId) { showToast('⚠', 'Сначала выберите героя'); return; }
  if (p.level >= MAX_PLAYER_LEVEL) { showToast('🏆', `Уже максимальный уровень: ${MAX_PLAYER_LEVEL}`); return; }
  const from = p.level;
  const target = Math.min(MAX_PLAYER_LEVEL, p.level + n);
  while (p.level < target) {
    p.xp = p.xpNext;
    checkLevelUp();
  }
  p.xp = 0;
  markCheatUsed();

  logLoot(`⬆ ЧИТ: уровень ${from} → ${p.level}`, 'log-craft');
  showToast('⬆', `Уровень ${p.level}`);

  updateTopStatus();
  updateCharacterPanel();
  if (typeof updateMapUI === 'function') updateMapUI();   // карточка Ильграда зависит от уровня
  renderCheatMenu();
  saveCurrentSlot();
}

// ---------- КОМПЛЕКТЫ ЭПИЧЕСКОГО КАЧЕСТВА (v0.36) ----------
const CHEAT_JEWELRY_TYPES = ['ring', 'earring', 'necklace'];
const CHEAT_SET_RARITY = 'purple';

// Рецепты, из которых собирается комплект (все части берём из кузницы).
function cheatSetRecipes(setId) {
  return Object.values(RECIPES).flat().filter(r => r.result && r.result.setId === setId);
}
function cheatSetIsJewelry(setId) {
  const list = cheatSetRecipes(setId);
  return list.length > 0 && CHEAT_JEWELRY_TYPES.includes(list[0].result.type);
}

// Кнопки: только комплекты, у которых есть рецепты (Потрёпанный — добыча, не куётся).
function cheatSetButtons(jewelry) {
  return Object.keys(SETS)
    .filter(id => cheatSetRecipes(id).length && cheatSetIsJewelry(id) === jewelry)
    .map(id => `<button class="cheat-rate-btn" onclick="cheatGrantSet('${id}')">${SETS[id].name}</button>`)
    .join('');
}

// Кладём в сумку весь комплект эпического качества. Украшения — по слотам: 2 кольца, 2 серьги, ожерелье.
function cheatGrantSet(setId) {
  const p = state.player;
  if (!p.classId) { showToast('⚠', 'Сначала выберите героя'); return; }
  const list = cheatSetRecipes(setId);
  if (!list.length) return;
  const items = [];
  list.forEach(r => {
    const copies = ['ring', 'earring'].includes(r.result.type) ? 2 : 1;
    for (let i = 0; i < copies; i++) items.push(r);
  });
  if (p.inventory.length + items.length > invMaxSlots()) {
    showToast('📦', `Нужно свободных ячеек: ${items.length}`);
    return;
  }
  const rarity = RARITIES[CHEAT_SET_RARITY];
  items.forEach(r => {
    const res = r.result;
    addToInventory({
      name: res.name, type: res.type, qty: 1,
      stats: res.stats, sellPrice: res.sellPrice,
      setId: res.setId, tier: r.tier || null,
      rarity: CHEAT_SET_RARITY,
      bonusStats: rollRarityStats(rarity.statPoints, getRarityStatProfile(res)),
      icon: `<img src="${res.icon}" alt="" style="width:100%;height:100%;object-fit:contain;">`,
    });
  });
  markCheatUsed();
  logLoot(`✨ ЧИТ: комплект «${SETS[setId].name}» (${rarity.name}) — ${items.length} шт.`, 'log-craft rarity-' + CHEAT_SET_RARITY);
  showToast('✨', `${SETS[setId].name}: ${items.length} шт. в сумке`);
  renderInventory();
  updateInventoryFooter();
  saveCurrentSlot();
}

// ---------- ТИТУЛЫ ----------
// Ставим всем монстрам × всем подтипам счётчик = 1000.
function cheatUnlockAllTitles() {
  const p = state.player;
  if (!p.monsterKills) p.monsterKills = {};

  const threshold = KILL_THRESHOLDS.title; // 1000

  MONSTERS.forEach(m => {
    ['normal', 'ancient', 'bloody'].forEach(v => {
      const key = m.id + '_' + v;
      p.monsterKills[key] = threshold;
    });
  });

  MINE_MONSTERS.forEach(m => {
    ['normal', 'ancient', 'bloody'].forEach(v => {
      const key = m.id + '_' + v;
      p.monsterKills[key] = threshold;
    });
  });

  markCheatUsed();
  logLoot(`🌟 ЧИТ: все титулы открыты (1000 убийств каждому)`, 'log-craft');
  showToast('🌟', 'Все титулы открыты!');

  renderMonsters();
  saveCurrentSlot();
}

// ---------- СБРОС СЧЁТЧИКОВ ----------
function cheatResetKills() {
  const p = state.player;
  p.monsterKills = {};
  logLoot(`🗑 ЧИТ: счётчики убийств сброшены`, 'log-craft');
  showToast('🗑', 'Счётчики убийств сброшены');
  renderMonsters();
  saveCurrentSlot();
}