// ========================================================
//  ЗАПУСК ИГРЫ
// ========================================================

MONSTERS.forEach(m => {
  m.drops.forEach(d => {
    if (d.iconKey && SVG[d.iconKey]) d.icon = SVG[d.iconKey];
  });
});

Object.values(SKILLS).forEach(skill => {
  if (skill.iconPng) {
    skill.icon = `<img src="${skill.iconPng}" alt="" class="skill-png-icon">`;
  } else if (skill.iconKey && SVG[skill.iconKey]) {
    skill.icon = SVG[skill.iconKey];
  }
});

Object.values(GUILD_BUFFS).forEach(buff => {
  if (buff.iconKey && SVG[buff.iconKey]) buff.icon = SVG[buff.iconKey];
});

// ========================================================
//  МАСШТАБ ИНТЕРФЕЙСА
// ========================================================

const UI_SCALE_VALUES = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
const UI_SCALE_STORAGE_KEY = 'l2browser_ui_scale';

function applyUiScale(scale) {
  document.documentElement.style.setProperty('--ui-scale', scale);
}

function openSettings() {
  const overlay = document.getElementById('settings-overlay');
  if (!overlay) return;
  renderTextFontButtons();
  renderWakeLockButtons();
  if (typeof renderProfilePrivacyButtons === 'function') renderProfilePrivacyButtons();
  renderSettingsButtons();
  renderBrightnessButtons();
  renderContrastButtons();
  syncFilterSliders();
  syncAutoStopSettingsUI();
  syncStackCapSlider();
  overlay.classList.add('active');
}

function closeSettings() {
  const overlay = document.getElementById('settings-overlay');
  if (overlay) overlay.classList.remove('active');
}

function renderSettingsButtons() {
  const cont = document.getElementById('settings-buttons');
  const currentLabel = document.getElementById('settings-current-value');
  if (!cont) return;
  cont.innerHTML = '';
  const currentScale = getSavedUiScale();
  UI_SCALE_VALUES.forEach(scale => {
    const btn = document.createElement('button');
    btn.className = 'settings-btn' + (Math.abs(scale - currentScale) < 0.01 ? ' active' : '');
    btn.textContent = Math.round(scale * 100) + '%';
    btn.onclick = () => setUiScale(scale);
    cont.appendChild(btn);
  });
  if (currentLabel) currentLabel.textContent = Math.round(currentScale * 100) + '%';
}

function setUiScale(scale) {
  applyUiScale(scale);
  localStorage.setItem(UI_SCALE_STORAGE_KEY, String(scale));
  renderSettingsButtons();
}

function getSavedUiScale() {
  const raw = localStorage.getItem(UI_SCALE_STORAGE_KEY);
  const parsed = parseFloat(raw);
  if (!isNaN(parsed) && parsed > 0) return parsed;
  return 1.0;
}

function restoreUiScale() { applyUiScale(getSavedUiScale()); }

// ========================================================
//  v0.22: ШРИФТ ТЕКСТА (TEXT_FONTS и applyTextFont — в index.html, применяются до отрисовки)
// ========================================================
function renderTextFontButtons() {
  const cont = document.getElementById('textfont-buttons');
  const currentLabel = document.getElementById('textfont-current-value');
  if (!cont || typeof TEXT_FONTS === 'undefined') return;
  cont.innerHTML = '';
  // чтобы каждая кнопка была написана своим шрифтом — подгружаем все варианты, но только когда открыты Настройки
  if (!document.getElementById('font-preview-link')) {
    const l = document.createElement('link');
    l.id = 'font-preview-link'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?' + Object.values(TEXT_FONTS).map(f => 'family=' + f.css).join('&') + '&display=swap';
    document.head.appendChild(l);
  }
  const current = getSavedTextFont();
  Object.keys(TEXT_FONTS).forEach(id => {
    const f = TEXT_FONTS[id];
    const btn = document.createElement('button');
    btn.className = 'settings-btn settings-font-btn' + (id === current ? ' active' : '');
    btn.textContent = f.name;
    btn.style.fontFamily = f.stack;
    btn.style.fontWeight = f.weight;
    btn.onclick = () => setTextFont(id);
    cont.appendChild(btn);
  });
  if (currentLabel) currentLabel.textContent = TEXT_FONTS[current].name;
}
function setTextFont(id) {
  applyTextFont(id);
  try { localStorage.setItem(TEXT_FONT_STORAGE_KEY, id); } catch (e) {}
  renderTextFontButtons();
}

// ========================================================
//  ЯРКОСТЬ
// ========================================================
const BRIGHTNESS_VALUES = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3];
const BRIGHTNESS_STORAGE_KEY = 'l2browser_brightness';

function applyBrightness(value) { document.documentElement.style.setProperty('--ui-brightness', value); }
function renderBrightnessButtons() {
  const cont = document.getElementById('brightness-buttons');
  const currentLabel = document.getElementById('brightness-current-value');
  if (!cont) return;
  cont.innerHTML = '';
  const current = getSavedBrightness();
  BRIGHTNESS_VALUES.forEach(v => {
    const btn = document.createElement('button');
    btn.className = 'settings-btn' + (Math.abs(v - current) < 0.01 ? ' active' : '');
    btn.textContent = Math.round(v * 100) + '%';
    btn.onclick = () => setBrightness(v);
    cont.appendChild(btn);
  });
  if (currentLabel) currentLabel.textContent = Math.round(current * 100) + '%';
}
function setBrightness(value) { applyBrightness(value); localStorage.setItem(BRIGHTNESS_STORAGE_KEY, String(value)); renderBrightnessButtons(); }
function getSavedBrightness() { const raw = localStorage.getItem(BRIGHTNESS_STORAGE_KEY); const parsed = parseFloat(raw); return (!isNaN(parsed) && parsed > 0) ? parsed : 1.0; }
function restoreBrightness() { applyBrightness(getSavedBrightness()); }

// ========================================================
//  КОНТРАСТ
// ========================================================
const CONTRAST_VALUES = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3];
const CONTRAST_STORAGE_KEY = 'l2browser_contrast';

function applyContrast(value) { document.documentElement.style.setProperty('--ui-contrast', value); }
function renderContrastButtons() {
  const cont = document.getElementById('contrast-buttons');
  const currentLabel = document.getElementById('contrast-current-value');
  if (!cont) return;
  cont.innerHTML = '';
  const current = getSavedContrast();
  CONTRAST_VALUES.forEach(v => {
    const btn = document.createElement('button');
    btn.className = 'settings-btn' + (Math.abs(v - current) < 0.01 ? ' active' : '');
    btn.textContent = Math.round(v * 100) + '%';
    btn.onclick = () => setContrast(v);
    cont.appendChild(btn);
  });
  if (currentLabel) currentLabel.textContent = Math.round(current * 100) + '%';
}
function setContrast(value) { applyContrast(value); localStorage.setItem(CONTRAST_STORAGE_KEY, String(value)); renderContrastButtons(); }
function getSavedContrast() { const raw = localStorage.getItem(CONTRAST_STORAGE_KEY); const parsed = parseFloat(raw); return (!isNaN(parsed) && parsed > 0) ? parsed : 1.0; }
function restoreContrast() { applyContrast(getSavedContrast()); }

// ========================================================
//  ФИЛЬТРЫ РЕДКОСТИ (добыча и крафт)
// ========================================================

const FILTER_LABELS = ['Всё', '🟢 Зелёное и выше', '🔵 Синее и выше', '🟣 Фиолетовое и выше', '🟡 Легендарное и выше', '🔴 Только мифическое'];

function getFilterLabel(level) {
  if (level < 0) level = 0;
  if (level > 5) level = 5;
  return FILTER_LABELS[level];
}

function passesFilter(rarityId, filterLevel) {
  if (filterLevel <= 0) return true;
  if (!rarityId) return true;
  if (typeof RARITIES === 'undefined' || !RARITIES[rarityId]) return true;
  return RARITIES[rarityId].points >= filterLevel;
}

function onLootFilterChange() {
  const slider = document.getElementById('lootFilterSlider');
  if (!slider) return;
  state.player.lootFilterLevel = parseInt(slider.value, 10) || 0;
  updateFilterLabels();
  saveCurrentSlot();
}

function onCraftFilterChange() {
  const slider = document.getElementById('craftFilterSlider');
  if (!slider) return;
  state.player.craftFilterLevel = parseInt(slider.value, 10) || 0;
  updateFilterLabels();
  saveCurrentSlot();
}

function updateFilterLabels() {
  const lootSlider = document.getElementById('lootFilterSlider');
  const lootLabel = document.getElementById('lootFilterValue');
  if (lootSlider && lootLabel) lootLabel.textContent = getFilterLabel(parseInt(lootSlider.value, 10) || 0);

  const craftSlider = document.getElementById('craftFilterSlider');
  const craftLabel = document.getElementById('craftFilterValue');
  if (craftSlider && craftLabel) craftLabel.textContent = getFilterLabel(parseInt(craftSlider.value, 10) || 0);
}

function syncFilterSliders() {
  const p = state.player;
  const lootSlider = document.getElementById('lootFilterSlider');
  const craftSlider = document.getElementById('craftFilterSlider');
  if (lootSlider) lootSlider.value = String(p.lootFilterLevel || 0);
  if (craftSlider) craftSlider.value = String(p.craftFilterLevel || 0);
  updateFilterLabels();
}

// ========================================================
//  КАП ОДИНАКОВЫХ ПРЕДМЕТОВ
// ========================================================

function onStackCapChange() {
  const slider = document.getElementById('stackCapSlider');
  if (!slider) return;
  state.player.stackCap = parseInt(slider.value, 10) || 0;
  updateStackCapLabel();
  saveCurrentSlot();
}

function updateStackCapLabel() {
  const label = document.getElementById('stackCapValue');
  if (!label) return;
  const val = state.player.stackCap;
  label.textContent = (val === 0) ? 'без капа' : (val + ' шт');
}

function syncStackCapSlider() {
  const slider = document.getElementById('stackCapSlider');
  if (!slider) return;
  slider.value = String(state.player.stackCap || 0);
  updateStackCapLabel();
}

// ========================================================
//  АВТОБОЙ В НАСТРОЙКАХ ⚙
// ========================================================

function syncAutoStopSettingsUI() {
  const p = state.player;
  const sh = document.getElementById('stopHpSliderSettings');
  const rh = document.getElementById('resumeHpSliderSettings');
  const sm = document.getElementById('stopMpSliderSettings');
  const rm = document.getElementById('resumeMpSliderSettings');
  if (sh) sh.value = String(p.stopHpPercent || 0);
  if (rh) rh.value = String(p.resumeHpPercent || 0);
  if (sm) sm.value = String(p.stopMpPercent || 0);
  if (rm) rm.value = String(p.resumeMpPercent || 0);
  updateAutoStopSettingsLabels();
}

function updateAutoStopSettingsLabels() {
  const p = state.player;
  function setLabel(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (value > 0) { el.textContent = value + '%'; el.classList.remove('off'); } 
    else { el.textContent = 'выкл'; el.classList.add('off'); }
  }
  setLabel('stopHpValueSettings',   p.stopHpPercent   || 0);
  setLabel('resumeHpValueSettings', p.resumeHpPercent || 0);
  setLabel('stopMpValueSettings',   p.stopMpPercent   || 0);
  setLabel('resumeMpValueSettings', p.resumeMpPercent || 0);
}

function onStopSliderChangeSettings(kind) {
  const p = state.player;
  const stopSlider   = document.getElementById(kind === 'hp' ? 'stopHpSliderSettings'   : 'stopMpSliderSettings');
  const resumeSlider = document.getElementById(kind === 'hp' ? 'resumeHpSliderSettings' : 'resumeMpSliderSettings');
  if (!stopSlider || !resumeSlider) return;
  const stopVal = parseInt(stopSlider.value, 10) || 0;
  if ((parseInt(resumeSlider.value, 10) || 0) < stopVal) resumeSlider.value = String(stopVal);
  if (kind === 'hp') { p.stopHpPercent = stopVal; p.resumeHpPercent = parseInt(resumeSlider.value, 10) || 0; }
  else { p.stopMpPercent = stopVal; p.resumeMpPercent = parseInt(resumeSlider.value, 10) || 0; }
  updateAutoStopSettingsLabels();
  syncAutoStopUIIfPresent();
  updateAutoWaitIndicator();
  saveCurrentSlot();
}

function onResumeSliderChangeSettings(kind) {
  const p = state.player;
  const stopSlider   = document.getElementById(kind === 'hp' ? 'stopHpSliderSettings'   : 'stopMpSliderSettings');
  const resumeSlider = document.getElementById(kind === 'hp' ? 'resumeHpSliderSettings' : 'resumeMpSliderSettings');
  if (!stopSlider || !resumeSlider) return;
  let resumeVal = parseInt(resumeSlider.value, 10) || 0;
  const stopVal = parseInt(stopSlider.value, 10) || 0;
  if (resumeVal < stopVal) { resumeSlider.value = String(stopVal); resumeVal = stopVal; }
  if (kind === 'hp') p.resumeHpPercent = resumeVal;
  else p.resumeMpPercent = resumeVal;
  updateAutoStopSettingsLabels();
  syncAutoStopUIIfPresent();
  updateAutoWaitIndicator();
  saveCurrentSlot();
}

function syncAutoStopUIIfPresent() {
  if (typeof syncAutoStopUI !== 'function') return;
  if (!document.getElementById('stopHpSlider')) return;
  syncAutoStopUI();
}

// ========================================================
//  ПАНЕЛЬ «ПЕРСОНАЖ»
// ========================================================

// v0.25: лист персонажа (3 колонки / 2 / 1 на телефоне — вёрстка в inventory-equip.css)

// 27 → «27», 27.4 → «27.4»
function formatStatNum(x) {
  return Number.isInteger(x) ? String(x) : x.toFixed(1);
}

function escCs(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// «Имя (ур.5): описание» → плашка с жирным названием
function csChip(cls, text) {
  const i = text.indexOf(': ');
  if (i < 0) return `<span class="cs-chip ${cls}">${escCs(text)}</span>`;
  return `<span class="cs-chip ${cls}"><b>${escCs(text.slice(0, i))}</b>: ${escCs(text.slice(i + 2))}</span>`;
}

function setCsText(id, text, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = text;
  if (cls !== undefined) el.classList.toggle('none', !!cls);
}

function fillCsChips(listId, countId, chips, emptyText) {
  const list = document.getElementById(listId);
  const cnt = document.getElementById(countId);
  if (cnt) cnt.textContent = chips.length;
  if (list) list.innerHTML = chips.length ? chips.join('') : `<span class="cs-empty">${emptyText}</span>`;
}

// На компьютере группы всегда раскрыты, на телефоне часть свёрнута (data-phone="closed").
// Состояние, которое игрок выбрал на телефоне, не сбрасываем при каждом обновлении панели.
let __csPhoneMode = null;
function syncCharGroups() {
  const phone = window.matchMedia('(max-width: 600px)').matches;
  if (phone === __csPhoneMode) return;
  __csPhoneMode = phone;
  document.querySelectorAll('#panel-character details.cs-grp').forEach(d => {
    d.open = phone ? d.dataset.phone !== 'closed' : true;
  });
}
window.addEventListener('resize', syncCharGroups);

function updateCharacterPanel() {
  const p = state.player;
  const has = !!p.classId;
  syncCharGroups();

  // ---- Герой ----
  const race = (typeof RACES !== 'undefined' && p.raceId) ? RACES[p.raceId] : null;
  setCsText('cs-name', escCs(p.name || '—'));
  setCsText('cs-class', has ? `${CLASSES[p.classId].name}${race ? ' · ' + race.name : ''}` : '—');
  document.getElementById('cs-level').textContent = p.level;

  const portrait = document.getElementById('cs-portrait');
  if (portrait) {
    const src = has && typeof getRaceIcon === 'function' ? getRaceIcon(p.raceId || 'human', p.classId) : '';
    if (portrait.dataset.src !== src) {
      portrait.dataset.src = src;
      const fallback = p.classId === 'mage' ? '🧙' : (p.classId === 'warrior' ? '⚔' : '');
      portrait.innerHTML = src ? `<img src="${src}" alt="" onerror="this.parentNode.textContent='${fallback}'">` : fallback;
    }
  }

  // ---- Шкалы ----
  const pct = (a, b) => (b > 0 ? Math.max(0, Math.min(100, a / b * 100)) : 0) + '%';
  setCsText('cs-hp', has ? `${Math.floor(p.hp)} / ${p.maxHp}` : '—');
  setCsText('cs-mp', has ? `${Math.floor(p.mp)} / ${p.maxMp}` : '—');
  document.getElementById('cs-hp-fill').style.width = has ? pct(p.hp, p.maxHp) : '0%';
  document.getElementById('cs-mp-fill').style.width = has ? pct(p.mp, p.maxMp) : '0%';
  const maxLevel = p.level >= MAX_PLAYER_LEVEL || !isFinite(p.xpNext);
  setCsText('cs-xp', maxLevel ? 'максимальный уровень' : `${p.xp} / ${p.xpNext}`);
  document.getElementById('cs-xp-fill').style.width = maxLevel ? '100%' : pct(p.xp, p.xpNext);

  // ---- Характеристики (итог + бонус от вещей) ----
  ['STR', 'DEX', 'CON', 'INT', 'WIT', 'MEN'].forEach(k => {
    const base = p[k] || 0;
    const eff = p['eff' + k] || base;
    const bonus = Math.round((eff - base) * 10) / 10;
    setCsText('cs-' + k.toLowerCase(), base > 0 ? `${formatStatNum(eff)}${bonus > 0 ? ` <small>+${formatStatNum(bonus)}</small>` : ''}` : '—');
  });

  // ---- Атака ----
  const weapon = p.equipment.weapon;
  const wCat = weapon && typeof getWeaponCategory === 'function' ? getWeaponCategory(weapon.name) : null;
  setCsText('cs-patk', has ? Math.floor(p.pAtk) : '—');
  setCsText('cs-matk', has ? Math.floor(p.mAtk) : '—');
  setCsText('cs-skillflat', p.skillFlatDamage ? `+${p.skillFlatDamage}` : '0', !p.skillFlatDamage);
  const crit = has ? (typeof getCritChance === 'function' ? getCritChance(wCat) : (p.critChance || 10)) : 0;
  setCsText('cs-crit', has ? `${Math.round(crit * 10) / 10}%` : '—');
  setCsText('cs-critmult', has && typeof getCritMultiplier === 'function' ? `×${getCritMultiplier(wCat)}` : '—');
  setCsText('cs-accuracy', has ? getPlayerAccuracy() : '—');
  setCsText('cs-atb', has ? p.atbSpeed.toFixed(2) : '—');

  // ---- Защита ----
  if (has) {
    const basePDef = p.basePDefForUI || Math.floor(5 + (p.effCON || p.CON) * 0.3);
    const bonusPDef = Math.floor(p.pDef) - basePDef;
    setCsText('cs-pdef', `${Math.floor(p.pDef)}${bonusPDef > 0 ? ` <small>+${bonusPDef}</small>` : ''}`);
  } else setCsText('cs-pdef', '—');
  setCsText('cs-mdef', has ? Math.floor(p.mDef) : '—');
  setCsText('cs-evasion', has ? getPlayerEvasion() : '—');
  setCsText('cs-flatdr', p.flatDamageReduce || 0, !p.flatDamageReduce);
  setCsText('cs-block', `${p.blockChance || 0}%`, !p.blockChance);
  setCsText('cs-manashield', `${p.manaShield || 0}%`, !p.manaShield);

  // ---- Восстановление (те же формулы, что в battle-loop / battle-rest) ----
  const r2 = (x) => { const v = Math.round(x * 100) / 100; return Number.isInteger(v) ? v.toFixed(1) : String(v); };   // 1 → 1.0, 1.94 → 1.94
  const hpOut = 1 + (p.hpRegenOutBonus || 0);
  const mpOut = (p.mpRegenOut || 1) + (p.mpRegenOutBonus || 0);
  const hpIn = p.hpRegenIn || 0;
  const mpIn = p.hasManaRegenPassive ? (p.mpRegenIn || 0.5) : 0;
  setCsText('cs-hpregen-out', has ? `${r2(hpOut)} / сек` : '—');
  setCsText('cs-mpregen', has ? `${r2(mpOut)} / сек` : '—');
  setCsText('cs-hpregen-in', has ? (hpIn > 0 ? `${r2(hpIn)} / сек` : 'нет') : '—', has && hpIn <= 0);
  setCsText('cs-mpregen-in', has ? (mpIn > 0 ? `${r2(mpIn)} / сек` : 'нет') : '—', has && mpIn <= 0);

  // ---- Добыча и рост (постоянное + активные таверна и микстура) ----
  const pctTxt = (x) => { const v = Math.round(x * 10) / 10; return v > 0 ? `+${v}%` : '0%'; };
  const tavernXp = typeof getXpMultiplierFromTavern === 'function' ? (getXpMultiplierFromTavern() - 1) * 100 : 0;
  const xpTotal = (p.xpBonus || 0) + (p.xpBonusFromRefine || 0) + tavernXp;
  const profTotal = (p.profBonusFromRefine || 0) + (typeof hasRelaxBuff === 'function' && hasRelaxBuff() ? TAVERN_PROF_BONUS_PERCENT : 0);
  const goldTotal = p.goldBonusFromRefine || 0;
  const luck = typeof getMixtureLuckMult === 'function' ? (getMixtureLuckMult() - 1) * 100 : 0;
  const dropTotal = (p.dropBonusFromRefine || 0) + luck;
  setCsText('cs-xpbonus', pctTxt(xpTotal), xpTotal <= 0);
  setCsText('cs-profbonus', pctTxt(profTotal), profTotal <= 0);
  setCsText('cs-goldbonus', pctTxt(goldTotal), goldTotal <= 0);
  setCsText('cs-dropbonus', pctTxt(dropTotal), dropTotal <= 0);

  // ---- Бонусы плашками ----
  fillCsChips('cs-set', 'cs-set-count',
    (p.setBonuses || []).map(b => csChip('set', `${b.name}: ${b.text}`)), 'Нет активных комплектов');
  fillCsChips('cs-skill-bonus', 'cs-skill-count',
    (p.skillBonuses || []).map(t => csChip('skill', t)), 'Нет пассивных навыков');
  const buffs = (p.buffBonuses || []).map(t => csChip(/не действует/.test(t) ? 'buff off' : 'buff', t));
  if (typeof TAVERN_BUFFS !== 'undefined' && p.tavernBuffs) {
    Object.keys(p.tavernBuffs).forEach(id => {
      const b = p.tavernBuffs[id], def = TAVERN_BUFFS[id];
      if (!b || !def || b.timer <= 0) return;
      const what = def.effect === 'xpPercent' ? `+${def.value}% опыта` : `+${def.value}% шанс опыта владения`;
      buffs.push(csChip('buff', `${def.name}: ${what}`));
    });
  }
  fillCsChips('cs-buff', 'cs-buff-count', buffs, 'Нет активных усилений');

  // v0.22: раскрытая подсказка по характеристике — обновить цифры
  if (typeof renderStatInfo === 'function' && openStatInfo) renderStatInfo();
}

// ========================================================
//  ВСПЛЫВАЮЩЕЕ ОКНО «СКОРО»
// ========================================================

function showSoon(title, text) {
  document.getElementById('soon-title').textContent = title;
  document.getElementById('soon-text').textContent = text;
  document.getElementById('soon-overlay').classList.add('active');
}
function closeSoon() { document.getElementById('soon-overlay').classList.remove('active'); }

// ========================================================
//  ЗАПУСК ИГРЫ
// ========================================================

function initGame() {
  recalcStats();
  renderMonsters();
  renderInventory();
  renderEquipSlots();
  updateTopStatus();
  updateCharacterPanel();
  updateMapUI();
  updateInventoryFooter();
  renderConsumablesPanel();
  renderSkillSlots();

  if (typeof renderSkillLoadout === 'function') renderSkillLoadout();
  updatePlayerAvatar();
  renderEffectsPanel();

  syncFilterSliders();
  syncAutoStopSettingsUI();
  syncStackCapSlider();

  document.getElementById('btn-autobattle').classList.add('active');
  switchTab('hunt');
  rememberSlotForReload();   // v0.24: после обновления страницы — сразу в этого героя
  if (typeof refreshStorageFromCloud === 'function') refreshStorageFromCloud();   // v0.25: склад из облака

  if (!window.__gameLoopStarted) {
    window.__gameLoopStarted = true;
    const ticker = new Worker('js/worker/ticker.js');
    ticker.onmessage = () => { gameLoop(); };
  }
}

// ========================================================
//  СТАРТ
// ========================================================

restoreUiScale();
restoreBrightness();
restoreContrast();

if (typeof initCloud === 'function') {
  initCloud();
}

showStartScreen();
tryAutoEnterAfterReload();   // v0.24: обновили страницу посреди игры — вернуться в неё
