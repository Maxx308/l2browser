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
//    img/materials/copper.png, tin.png, chitin.png, stone_plates.png.
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

  // ---- Блок ТИТУЛЫ ----
  let titleHtml = '<div class="cheat-block"><div class="cheat-block-title">ТИТУЛЫ</div>';
  titleHtml += '<div class="cheat-block-desc">Открыть все титулы всем монстрам (1000 убийств каждому).</div>';
  titleHtml += '<div class="cheat-btn-row">';
  titleHtml += `<button class="cheat-rate-btn" onclick="cheatUnlockAllTitles()">🌟 Открыть все титулы</button>`;
  titleHtml += `<button class="cheat-rate-btn" onclick="cheatResetKills()">🗑 Сбросить счётчики</button>`;
  titleHtml += '</div></div>';

  cont.innerHTML = rateHtml + resHtml + goldHtml + titleHtml;
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
    'Нить':        'img/materials/thread.png',
    'Ткань':       'img/materials/fabric.png',
    'Клей':        'img/materials/glue.png',
    'Ветвь':       'img/materials/branch.png',
    'Руда железа': 'img/materials/iron_ore.png',
    'Кости':       'img/materials/bone.png',
    'Жабья шкура': 'img/materials/frog.png',
    'Шкура волка': 'img/materials/pelt.png',
    'Мясо':        'img/materials/meat.png',
    'Клык':        'img/materials/fang.png',
    'Кожа':        'img/materials/leather.png',
    'Шкура':       'img/materials/fur.png',
    'Уголь':       'img/materials/coal.png',
    // ---- НОВОЕ (v0.12d): материалы Копи ----
    'Медь':              'img/materials/copper.png',
    'Олово':             'img/materials/tin.png',
    'Хитин':             'img/materials/chitin.png',
    'Каменные пластины': 'img/materials/stone_plates.png',
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
      if (p.inventory.length >= INVENTORY_MAX_SLOTS) return;

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