// ========================================================
//  СИСТЕМЫ: КУЗНИЦА
//  Крафт ресурсов, доспехов, оружия (с подкатегориями),
//  щитов, ювелирки, расходников.
//
//  + РЕДКОСТЬ предметов при крафте.
//  + «УМНЫЙ РАНДОМ»: магические / воинские / нейтральные.
//  + Проверка лимита инвентаря ПЕРЕД крафтом.
//  + ФИЛЬТР КРАФТА — если редкость ниже порога, материалы и Оболы сгорают.
//
//  НОВОЕ (платная кузница):
//  + Каждый рецепт стоит Оболы (price).
//  + Оболы списываются при ЛЮБОМ исходе крафта.
//
//  НОВОЕ (v0.07):
//  + При крафте сохраняется tier рецепта (recipe.tier).
//
//  НОВОЕ (v0.12e):
//  + В вкладке «РЕСУРСЫ» появились 4 слитка (железо/медь/олово/бронза).
//  + Для их иконок добавлены PNG-пути в pngMap внутри getMatIcon.
//
//  НОВОЕ (v0.18):
//  + Материалы и еда крафтятся пачкой: кнопки 1 / 10 / 100 (craftItemBatch).
// ========================================================

// ---------- ОКНО ----------
function openForge() {
  if (state.player.currentLocation !== 'town') return;

  if (typeof cancelWaitingForResume === 'function') {
    cancelWaitingForResume('открыта кузница');
  }

  document.getElementById('forge-overlay').classList.add('active');
  state.currentArmorSetTab = 'all';
  state.currentJewelrySetTab = 'all';
  state.currentWeaponCategory = 'swords';
  switchForgeTab('resources');
  renderForgeAll();
  updateForgeGold();
  if (typeof refreshStorageFromCloud === 'function') refreshStorageFromCloud();   // v0.25: склад из облака

  // v0.31: Энциклопедия — кузнец; точка на «Поговорить»
  if (typeof unlockLore === 'function') unlockLore('smith');
  if (typeof updateTalkButtons === 'function') updateTalkButtons();
}
function closeForge() { document.getElementById('forge-overlay').classList.remove('active'); }

function updateForgeGold() {
  const el = document.getElementById('forge-gold');
  if (el) el.textContent = state.player.gold;
}

// ---------- ГЛАВНЫЕ ВКЛАДКИ ----------
function switchForgeTab(tab) {
  document.querySelectorAll('.window-tab[data-forge]').forEach(t => t.classList.toggle('active', t.dataset.forge === tab));
  ['resources','armor','weapons','shields','jewelry','consumables'].forEach(k => {
    const pane = document.getElementById('forge-pane-' + k);
    if (pane) pane.classList.toggle('active', k === tab);
  });

  const subtabs = document.getElementById('forge-subtabs');
  if (tab === 'armor') {
    subtabs.style.display = 'flex';
    renderArmorSubtabs();
  } else if (tab === 'jewelry') {
    subtabs.style.display = 'flex';
    renderJewelrySubtabs();
  } else if (tab === 'weapons') {
    subtabs.style.display = 'flex';
    renderWeaponSubtabs();
  } else {
    subtabs.style.display = 'none';
  }
}

// ---------- ПОДВКЛАДКИ ДОСПЕХОВ ----------
function renderArmorSubtabs() {
  const cont = document.getElementById('forge-subtabs');
  cont.innerHTML = '';
  const tabs = [
    { id: 'all', label: 'ВСЕ' },
    { id: 'gambeson', label: 'ГАМБЕЗОН' },
    { id: 'robe', label: 'МАНТИЯ УЧЕНИКА' },
    { id: 'chain', label: 'КОЛЬЧУГА КОПЕЙ' },
    { id: 'silk', label: 'ШЁЛКОВАЯ МАНТИЯ' },
  ];
  tabs.forEach(t => {
    const el = document.createElement('div');
    el.className = 'window-subtab' + (state.currentArmorSetTab === t.id ? ' active' : '');
    el.textContent = t.label;
    el.onclick = () => { state.currentArmorSetTab = t.id; renderArmorSubtabs(); renderForgePane('armor'); };
    cont.appendChild(el);
  });
}

// ---------- ПОДВКЛАДКИ ЮВЕЛИРКИ ----------
function renderJewelrySubtabs() {
  const cont = document.getElementById('forge-subtabs');
  cont.innerHTML = '';
  const tabs = [
    { id: 'all', label: 'ВСЕ' },
    { id: 'novice', label: 'СЕТ НОВИЧКА' },
    { id: 'malachite', label: 'МАЛАХИТ' },
  ];
  tabs.forEach(t => {
    const el = document.createElement('div');
    el.className = 'window-subtab' + (state.currentJewelrySetTab === t.id ? ' active' : '');
    el.textContent = t.label;
    el.onclick = () => { state.currentJewelrySetTab = t.id; renderJewelrySubtabs(); renderForgePane('jewelry'); };
    cont.appendChild(el);
  });
}

// ---------- ПОДВКЛАДКИ ОРУЖИЯ ----------
function renderWeaponSubtabs() {
  const cont = document.getElementById('forge-subtabs');
  cont.innerHTML = '';
  const tabs = [
    { id: 'swords',    label: 'МЕЧИ' },
    { id: 'axes',      label: 'ТОПОРЫ' },
    { id: 'daggers',   label: 'КИНЖАЛЫ' },
    { id: 'spears',    label: 'КОПЬЯ' },
    { id: 'bows',      label: 'ЛУКИ' },
    { id: 'crossbows', label: 'АРБАЛЕТЫ' },
    { id: 'maces',     label: 'ДУБИНЫ' },
    { id: 'staves',    label: 'ПОСОХИ' },
  ];
  tabs.forEach(t => {
    const el = document.createElement('div');
    el.className = 'window-subtab' + (state.currentWeaponCategory === t.id ? ' active' : '');
    el.textContent = t.label;
    el.onclick = () => { state.currentWeaponCategory = t.id; renderWeaponSubtabs(); renderForgePane('weapons'); };
    cont.appendChild(el);
  });
}

// ---------- ПОДСЧЁТ МАТЕРИАЛОВ ----------
// v0.25: кузница берёт материалы из инвентаря И со склада (сначала инвентарь).
function countMaterialInInventory(name) { return state.player.inventory.filter(i => i.name === name).reduce((s, i) => s + i.qty, 0); }
function countMaterialInStorage(name) {
  if (typeof loadStorage !== 'function') return 0;
  return loadStorage()
    .filter(s => s.name === name && STORAGE_STACKABLE_TYPES.includes(s.type))
    .reduce((sum, s) => sum + (s.qty || 1), 0);
}
function countMaterial(name) { return countMaterialInInventory(name) + countMaterialInStorage(name); }
function canCraft(recipe) { return recipe.materials.every(m => countMaterial(m.name) >= m.qty); }

// ---------- ИКОНКА МАТЕРИАЛА (PNG или SVG) ----------
function getMatIcon(name) {
  const pngMap = {
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
    'Жареное мясо': 'img/materials/cooked_meat.png',
    'Уголь':       'img/materials/coal.png',
    // ---- НОВОЕ (v0.12e): материалы Копи + слитки ----
    'Медь':              'img/materials/copper.png',
    'Олово':             'img/materials/tin.png',
    'Хитин':             'img/materials/chitin.png',
    'Каменные пластины': 'img/materials/stone_plates.png',
    'Слиток железа':     'img/materials/iron_ingot.png',
    'Слиток меди':       'img/materials/copper_ingot.png',
    'Слиток олова':      'img/materials/tin_ingot.png',
    'Слиток бронзы':     'img/materials/bronze_ingot.png',
    // ---- v0.20: новые материалы Копи и блюда (пока заглушки) ----
    'Пещерный гриб':     'img/materials/cave_mushroom.png',
    'Сырой рубин':       'img/materials/raw_ruby.png',
    'Сырой сапфир':      'img/materials/raw_sapphire.png',
    'Паучий шёлк':       'img/materials/spider_silk.png',
    'Ядовитая железа':   'img/materials/venom_gland.png',
    'Ядро голема':       'img/materials/golem_core.png',
    'Жаркое с грибами':      'img/materials/dish_mushroom_roast.png',
    'Похлёбка из волчатины': 'img/materials/dish_wolf_stew.png',
    'Грибной отвар':         'img/materials/dish_mushroom_brew.png',
  };

  if (pngMap[name]) {
    return `<img src="${pngMap[name]}" alt="" style="width:16px;height:16px;object-fit:contain;display:inline-block;vertical-align:middle;">`;
  }

  const svgMap = {
    'Нить': SVG.thread, 'Кости': SVG.bone, 'Ткань': SVG.fabric, 'Клей': SVG.glue,
    'Ветвь': SVG.branch, 'Руда железа': SVG.ironOre, 'Жабья шкура': SVG.frogSkin,
    'Клык': SVG.fang, 'Кожа': SVG.leather, 'Шкура волка': SVG.pelt,
    'Мясо': SVG.meat,
  };
  return svgMap[name] || SVG.gold;
}

// ---------- ПРОГРЕСС ПО СЕТАМ ----------
function countSetPiecesCrafted(setId) {
  const set = SETS[setId];
  if (!set) return { have: 0, total: 0 };
  if (set.isFullSetEquipped) {
    const p = state.player;
    let have = 0;
    const ringsInInv = p.inventory.filter(i => i.name === 'Кольцо Новичка').reduce((s,i) => s+i.qty, 0);
    const ringsEq = (p.equipment.ring1?.name === 'Кольцо Новичка' ? 1 : 0) + (p.equipment.ring2?.name === 'Кольцо Новичка' ? 1 : 0);
    have += Math.min(2, ringsInInv + ringsEq);
    const earsInInv = p.inventory.filter(i => i.name === 'Серьга Новичка').reduce((s,i) => s+i.qty, 0);
    const earsEq = (p.equipment.earring1?.name === 'Серьга Новичка' ? 1 : 0) + (p.equipment.earring2?.name === 'Серьга Новичка' ? 1 : 0);
    have += Math.min(2, earsInInv + earsEq);
    const neckInInv = p.inventory.filter(i => i.name === 'Ожерелье Новичка').reduce((s,i) => s+i.qty, 0);
    const neckEq = (p.equipment.necklace?.name === 'Ожерелье Новичка' ? 1 : 0);
    have += Math.min(1, neckInInv + neckEq);
    return { have, total: 5 };
  }
  let have = 0;
  set.pieces.forEach(pieceName => {
    const inInv = state.player.inventory.some(i => i.name === pieceName);
    const inEq = Object.values(state.player.equipment).some(e => e && e.name === pieceName);
    if (inInv || inEq) have++;
  });
  return { have, total: set.pieces.length };
}

function renderSetHeader(setId) {
  const set = SETS[setId];
  if (!set) return '';
  const { have, total } = countSetPiecesCrafted(setId);
  const tiersHtml = set.skillFlatTiers ? `<div class="set-header-bonus">По частям, к урону навыков и ДОТов: ${formatSetSkillFlatTiers(set)}</div>` : '';
  return `<div class="set-header"><div class="set-header-title">${set.name.toUpperCase()}</div>${tiersHtml}<div class="set-header-bonus">Бонус полного сета: ${set.bonusText}</div>${set.bonus10Text ? `<div class="set-header-bonus">Все части +10 и выше: ${set.bonus10Text}</div>` : ''}<div class="set-header-progress">Собрано частей: ${have} / ${total}</div></div>`;
}

// ---------- РИСОВАНИЕ РЕЦЕПТОВ ----------
function renderForgeAll() {
  ['resources','armor','weapons','shields','jewelry','consumables'].forEach(renderForgePane);
}

function renderForgePane(category) {
  const pane = document.getElementById('forge-pane-' + category);
  if (!pane) return;
  pane.innerHTML = '';
  let recipes = RECIPES[category] || [];
  if (recipes.length === 0) { pane.innerHTML = `<div class="trader-empty">Рецепты в разработке</div>`; return; }

  if (category === 'armor' && state.currentArmorSetTab !== 'all') recipes = recipes.filter(r => r.setId === state.currentArmorSetTab);
  if (category === 'jewelry' && state.currentJewelrySetTab !== 'all') recipes = recipes.filter(r => r.setId === state.currentJewelrySetTab);
  if (category === 'weapons') {
    recipes = recipes.filter(r => r.category === state.currentWeaponCategory);
  }

  let html = '';
  const currentTab = category === 'armor' ? state.currentArmorSetTab : (category === 'jewelry' ? state.currentJewelrySetTab : 'all');

  if ((category === 'armor' || category === 'jewelry') && currentTab === 'all') {
    const groups = {};
    recipes.forEach(r => {
      const sid = r.setId || 'other';
      if (!groups[sid]) groups[sid] = [];
      groups[sid].push(r);
    });
    Object.keys(groups).forEach(sid => {
      if (SETS[sid]) html += renderSetHeader(sid);
      const list = document.createElement('div');
      list.className = 'recipe-list';
      groups[sid].forEach(r => list.appendChild(buildRecipeCard(r, category)));
      const tmp = document.createElement('div');
      tmp.appendChild(list);
      html += tmp.innerHTML;
    });
  } else if ((category === 'armor' || category === 'jewelry') && currentTab !== 'all') {
    html += renderSetHeader(currentTab);
    const list = document.createElement('div');
    list.className = 'recipe-list';
    recipes.forEach(r => list.appendChild(buildRecipeCard(r, category)));
    const tmp = document.createElement('div');
    tmp.appendChild(list);
    html += tmp.innerHTML;
  } else {
    const list = document.createElement('div');
    list.className = 'recipe-list';
    recipes.forEach(r => list.appendChild(buildRecipeCard(r, category)));
    const tmp = document.createElement('div');
    tmp.appendChild(list);
    html += tmp.innerHTML;
  }
  pane.innerHTML = html;
}

// ---------- ИКОНКА ДЛЯ РЕЦЕПТА (SVG или PNG) ----------
function getRecipeIconHtml(recipe) {
  if (recipe.result && recipe.result.icon && typeof recipe.result.icon === 'string' && recipe.result.icon.startsWith('img/')) {
    return `<img src="${recipe.result.icon}" alt="" style="width:100%;height:100%;object-fit:contain;">`;
  }
  if (recipe.result && recipe.result.iconKey && SVG[recipe.result.iconKey]) return SVG[recipe.result.iconKey];
  if (recipe.iconKey && SVG[recipe.iconKey]) return SVG[recipe.iconKey];
  return SVG.gold;
}

// ========================================================
//  v0.32: КАРТОЧКА СНАРЯЖЕНИЯ — понятнее для новичка
//  Тир — бейджем в углу, «(двуруч.)» — в названии, главный стат — крупно
//  со стрелкой сравнения с надетым, мелкие статы — одной строкой,
//  хват / стойка / подгонка / фишки тира — в «ⓘ подробнее».
// ========================================================
const FORGE_GEAR_TYPES = ['weapon', 'shield', 'helmet', 'armorTop', 'armorBottom', 'gloves', 'boots', 'ring', 'earring', 'necklace'];
const FORGE_JEWELRY_TYPES = ['ring', 'earring', 'necklace'];

// Главный стат вещи: оружие — атака (у посохов — маг.), щит — блок, доспех — защита, бижутерия — маг. защита.
function getForgeMainStat(res) {
  const st = res.stats || {};
  if (res.type === 'weapon') return (st.mAtk && !st.pAtk) ? { key: 'mAtk', label: 'маг. атака' } : { key: 'pAtk', label: 'атака' };
  if (res.type === 'shield') return { key: 'blockChance', label: 'блок', unit: '%' };
  if (FORGE_JEWELRY_TYPES.includes(res.type)) return { key: 'mDef', label: 'маг. защита' };
  return { key: 'pDef', label: 'защита' };
}

// С чем сравнивать: оружие — с основной рукой (туда оно и наденется, вторая рука не в счёт),
// кольца и серьги — со слабейшей из двух (её и заменишь; свободный слот — не с чем сравнивать).
function getForgeCompareItem(res, key) {
  const eq = state.player.equipment;
  if (res.type === 'weapon') return eq.weapon || null;
  if (res.type === 'shield') return getEquippedShield();
  if (res.type === 'ring' || res.type === 'earring') {
    const a = eq[res.type + '1'], b = eq[res.type + '2'];
    if (!a || !b) return null;
    return getItemStat(a, key) <= getItemStat(b, key) ? a : b;
  }
  return eq[res.type] || null;
}

// Мелкие статы одной строкой (без главного).
function getForgeMinorStats(res, mainKey) {
  const st = res.stats || {};
  const out = [];
  if (st.pAtk && mainKey !== 'pAtk') out.push(`атака +${st.pAtk}`);
  if (st.mAtk && mainKey !== 'mAtk') out.push(`маг. атака +${st.mAtk}`);
  if (st.pDef && mainKey !== 'pDef') out.push(`защита +${st.pDef}`);
  if (st.mDef && mainKey !== 'mDef') out.push(`маг. защита +${st.mDef}`);
  if (st.hpBonus) out.push(`HP +${st.hpBonus}`);
  if (st.mpBonus) out.push(`мана +${st.mpBonus}`);
  if (st.mpRegenIn) out.push(`+${st.mpRegenIn} MP/сек в бою`);
  if (st.flatDamageReduce) out.push(`поглощение ${st.flatDamageReduce}`);
  if (st.critChance) out.push(`крит +${st.critChance}%`);
  if (st.atbSpeedMod) { const pct = Math.round(st.atbSpeedMod * 100); out.push(`скорость ${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`); }
  return out;
}

function buildGearRecipeCard(r, category, matsHtml, actionHtml) {
  const res = r.result;
  const main = getForgeMainStat(res);
  const value = (res.stats || {})[main.key] || 0;
  const unit = main.unit || '';

  // Стрелка сравнения: только если надетая вещь тоже даёт этот стат
  let cmpHtml = '';
  const cmpItem = getForgeCompareItem(res, main.key);
  const cur = cmpItem ? Math.round(getItemStat(cmpItem, main.key) * 10) / 10 : 0;
  if (cmpItem && cur > 0) {
    const diff = Math.round((value - cur) * 10) / 10;
    cmpHtml = diff > 0 ? `<span class="recipe-cmp up" title="Надето: ${escForge(cmpItem.name)} — ${cur}${unit}">▲ +${diff}${unit}</span>`
      : diff < 0 ? `<span class="recipe-cmp down" title="Надето: ${escForge(cmpItem.name)} — ${cur}${unit}">▼ −${Math.abs(diff)}${unit}</span>`
      : `<span class="recipe-cmp same" title="Надето: ${escForge(cmpItem.name)} — ${cur}${unit}">= как надетое</span>`;
  }

  // Подробности — по «ⓘ»
  const details = [];
  if (isTwoHandGripWeapon(res)) details.push(`Хват: +${TWO_HAND_GRIP_SKILL_BONUS}% к урону навыков, уворот −${TWO_HAND_EVASION_PENALTY}. Щит не надеть.`);
  else if (res.type === 'weapon' && res.twoHanded) details.push('Двуручное: щит не надеть.');
  if (res.type === 'shield') details.push(`Стойка: −${SHIELD_STANCE_DAMAGE_CUT}% входящего урона, уворот −${SHIELD_EVASION_PENALTY}.`);
  if (res.type === 'weapon' && !res.twoHanded && canDualWield(res)) details.push('Одноручное: можно со щитом или вторым оружием.');
  else if (res.type === 'weapon' && !res.twoHanded) details.push('Одноручное: можно со щитом.');
  if (r.tier) details.push(`Подгонка до +${getMaxRefine(r.tier)}.`);
  if (r.tier >= 3 && res.type === 'weapon') {
    const t3Text = getTierTraitBonusText({ name: res.name, tier: r.tier });
    if (t3Text) details.push(`★ Тир ${r.tier}: ${t3Text}.`);
  }

  const hand = (res.type === 'weapon' && res.twoHanded && !/двуруч/i.test(r.name)) ? ' <span class="recipe-hand">(двуруч.)</span>' : '';
  const tier = r.tier ? `<span class="recipe-tier t${r.tier}" title="Тир ${r.tier}">Т${r.tier}</span>` : '';
  const minor = getForgeMinorStats(res, main.key);
  const infoBtn = details.length ? `<span class="recipe-info" onclick="this.closest('.recipe-card').classList.toggle('open')">ⓘ подробнее</span>` : '';

  return `<div class="recipe-result">${getRecipeIconHtml(r)}</div><div class="recipe-body">
    <div class="recipe-head"><div class="recipe-name">${r.name}${hand}</div>${tier}</div>
    <div class="recipe-main"><b>${value}${unit}</b><span>${main.label}</span>${cmpHtml}${infoBtn}</div>
    ${minor.length ? `<div class="recipe-minor">${minor.join(' · ')}</div>` : ''}
    ${details.length ? `<div class="recipe-details">${details.map(d => `<div>${d}</div>`).join('')}</div>` : ''}
    <div class="recipe-materials">${matsHtml}</div>
    <div class="recipe-action">${actionHtml}</div></div>`;
}

function escForge(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

function buildRecipeCard(r, category) {
  const can = canCraft(r);
  const price = r.price || 0;
  const canAfford = state.player.gold >= price;
  const canCraftFinal = can && canAfford;

  const card = document.createElement('div');
  card.className = 'recipe-card' + (canCraftFinal ? ' can-craft' : '');

  const matsHtml = r.materials.map(m => {
    const inStore = countMaterialInStorage(m.name);
    const have = countMaterialInInventory(m.name) + inStore;
    const cls = have >= m.qty ? 'have' : 'lack';
    const storeHtml = inStore > 0 ? `<span class="mat-store" title="Из них на складе: ${inStore}">🏦${inStore}</span>` : '';
    return `<div class="recipe-mat ${cls}">${getMatIcon(m.name)}<span>${m.name}</span>${storeHtml}<span class="mat-count">${have} / ${m.qty}</span></div>`;
  }).join('');

  const lines = [];
  const st = r.result.stats || {};
  if (st.pDef) lines.push(`<div class="recipe-bonus">+${st.pDef} защиты</div>`);
  if (st.pAtk) lines.push(`<div class="recipe-bonus">+${st.pAtk} атаки</div>`);
  if (st.mAtk) lines.push(`<div class="recipe-bonus magic-stat">+${st.mAtk} маг. атаки</div>`);
  if (st.mDef) lines.push(`<div class="recipe-bonus magic">+${st.mDef} маг. защиты</div>`);
  if (st.mpBonus) lines.push(`<div class="recipe-bonus mana">+${st.mpBonus} маны</div>`);
  if (st.mpRegenIn) lines.push(`<div class="recipe-bonus mana">+${st.mpRegenIn} MP/сек в бою</div>`);
  if (st.hpBonus) lines.push(`<div class="recipe-bonus food-effect">+${st.hpBonus} HP</div>`);
  if (st.blockChance) lines.push(`<div class="recipe-bonus">Блок ${st.blockChance}% · Поглощение ${st.flatDamageReduce}</div>`);
  if (st.critChance) lines.push(`<div class="recipe-bonus crit">Крит +${st.critChance}%</div>`);
  if (st.atbSpeedMod) {
    const pct = Math.round(st.atbSpeedMod * 100);
    lines.push(`<div class="recipe-bonus speed-malus">Скорость атаки: ${pct > 0 ? '+' : ''}${pct}%</div>`);
  }
  if (r.result.twoHanded) lines.push(`<div class="recipe-bonus two-handed">Двуручное</div>`);
  if (r.result.type === 'shield') lines.push(`<div class="recipe-bonus">Стойка: −${SHIELD_STANCE_DAMAGE_CUT}% входящего урона, уворот −${SHIELD_EVASION_PENALTY}</div>`);
  if (isTwoHandGripWeapon(r.result)) lines.push(`<div class="recipe-bonus two-handed">Хват: +${TWO_HAND_GRIP_SKILL_BONUS}% к урону навыков, уворот −${TWO_HAND_EVASION_PENALTY}</div>`);
  if (r.tier >= 3) lines.push(`<div class="recipe-bonus" style="color:#a0d080;">Тир ${r.tier} · подгонка до +${getMaxRefine(r.tier)}</div>`);
  if (r.tier >= 3 && r.result.type === 'weapon') {
    const t3Text = getTierTraitBonusText({ name: r.result.name, tier: r.tier });
    if (t3Text) lines.push(`<div class="recipe-bonus" style="color:#a0d080;">★ ${t3Text}</div>`);
  }
  if (r.result.food) {
    const dish = r.result.food.dish && DISHES[r.result.food.dish];
    if (dish) lines.push(`<div class="recipe-bonus food-effect">${dish.icon} ${dish.text} на ${buffShopDur(DISH_DURATION)}</div>`);
    lines.push(`<div class="recipe-bonus food-effect">+${r.result.food.healPerSec} HP/сек</div>`);
    lines.push(`<div class="recipe-bonus food-duration">Длительность: ${buffShopDur(getFoodDuration(r.result))} (складывается)</div>`);
  }

  // Цена крафта.
  const priceColor = canAfford ? '' : ' style="color:#e08080;"';
  const priceHtml = `<div class="recipe-price"${priceColor}>🪙 ${price}</div>`;

  // Кнопка.
  let btnHtml;
  if (!can) {
    btnHtml = `<button class="btn" disabled>Не хватает материалов</button>`;
  } else if (!canAfford) {
    btnHtml = `<button class="btn" disabled>Мало Оболов</button>`;
  } else if (isBatchCraftRecipe(r)) {
    // v0.18: материалы и еда — крафт пачкой 1 / 10 / 100.
    const max = getMaxCraftable(r);
    btnHtml = `<div class="craft-qty">
      <span class="craft-qty-max">Можно: ${max}</span>
      <button class="btn success" onclick="craftItemBatch('${category}', '${r.id}', 1)">⚒ 1</button>
      <button class="btn success" onclick="craftItemBatch('${category}', '${r.id}', 10)">×10</button>
      <button class="btn success" onclick="craftItemBatch('${category}', '${r.id}', 100)">×100</button>
    </div>`;
  } else {
    btnHtml = `<button class="btn success" onclick="craftItem('${category}', '${r.id}')">⚒ Создать</button>`;
  }

  // v0.32: снаряжение — новая карточка; ресурсы и еда — как было
  if (FORGE_GEAR_TYPES.includes(r.result.type)) {
    card.classList.add('gear');
    card.innerHTML = buildGearRecipeCard(r, category, matsHtml, priceHtml + btnHtml);
    return card;
  }
  card.innerHTML = `<div class="recipe-result">${getRecipeIconHtml(r)}</div><div class="recipe-body"><div class="recipe-name">${r.name}</div><div class="recipe-materials">${matsHtml}</div>${lines.join('')}<div class="recipe-action">${priceHtml}${btnHtml}</div></div>`;
  return card;
}

// ---------- ПРОВЕРКА: ПОМЕСТИТСЯ ЛИ ПРЕДМЕТ В ИНВЕНТАРЬ ----------
function canAddItemToInventory(resType, resName) {
  const p = state.player;
  const STACKABLE_TYPES = ['material', 'consumable', 'food'];
  const isStackable = STACKABLE_TYPES.includes(resType);

  if (isStackable) {
    const existing = p.inventory.find(i => i.name === resName);
    if (existing) return true;
  }

  return p.inventory.length < INVENTORY_MAX_SLOTS;
}

// ---------- СОЗДАНИЕ ПРЕДМЕТА ----------
function craftItem(category, recipeId) {
  const recipe = RECIPES[category].find(r => r.id === recipeId);
  if (!recipe || !canCraft(recipe)) return;

  const res = recipe.result;
  const price = recipe.price || 0;

  // Проверка Оболов.
  if (state.player.gold < price) {
    showToast('🪙', 'Мало Оболов');
    logLoot(`🪙 Мало Оболов для «${res.name}».`, 'log-info');
    return;
  }

  // Проверка места в инвентаре (ДО списания). Если нет места —
  // ничего не списываем.
  if (!canAddItemToInventory(res.type, res.name)) {
    showToast('📦', 'Инвентарь переполнен — крафт невозможен');
    logLoot(`📦 Инвентарь переполнен — «${res.name}» не создан.`, 'log-info');
    return;
  }

  // ---- Списываем материалы (инвентарь, потом склад) ----
  takeRecipeMaterials(recipe, 1);

  // ---- Списываем Оболы СРАЗУ (до броска редкости и фильтра) ----
  state.player.gold -= price;

  const drop = {
    name: res.name, type: res.type, qty: 1,
    stats: res.stats, sellPrice: res.sellPrice,
    setId: res.setId, twoHanded: res.twoHanded,
    food: res.food,
    tier: recipe.tier || null,      // ← НОВОЕ (v0.07)
  };

  const RARITY_TYPES = ['weapon', 'shield', 'helmet', 'armorTop', 'armorBottom',
                        'gloves', 'boots', 'ring', 'earring', 'necklace'];
  let rarityId = 'white';
  let bonusStats = {};

  if (RARITY_TYPES.includes(res.type)) {
    rarityId = rollRarity();
    const rarity = RARITIES[rarityId];
    const profile = getRarityStatProfile(res);
    bonusStats = rollRarityStats(rarity.statPoints, profile);
    drop.rarity = rarityId;
    drop.bonusStats = bonusStats;
  }

  const craftFilterLevel = state.player.craftFilterLevel || 0;
  const hasRarity = RARITY_TYPES.includes(res.type);

  // ---- Фильтр крафта: материалы сгорели, Оболы списаны, предмет не создан ----
  if (hasRarity && !passesFilter(rarityId, craftFilterLevel)) {
    const rarity = RARITIES[rarityId];
    logLoot(`⚒ Крафт ниже порога: ${res.name} (${rarity.name}) — материалы и Оболы сгорели (−${price})`, 'log-info');
    showToast('⚒', `${res.name} (${rarity.name}) — сгорел (−${price} 🪙)`);

    renderForgeAll(); updateInventoryFooter(); updateForgeGold();
    if (typeof markDeed === 'function') markDeed('forge.burned');   // v0.31: тема у кузнеца
    saveCurrentSlot();
    return;
  }

  // ---- Иконка ----
  if (res.icon && typeof res.icon === 'string' && res.icon.startsWith('img/')) {
    drop.icon = `<img src="${res.icon}" alt="" style="width:100%;height:100%;object-fit:contain;">`;
  } else if (res.iconKey && SVG[res.iconKey]) {
    drop.icon = SVG[res.iconKey];
  } else {
    drop.icon = SVG.gold;
  }

  addToInventory(drop);

  // ---- Лог с учётом редкости и цены ----
  const rarity = RARITIES[rarityId];
  const bonusText = formatRarityBonus(bonusStats);
  let logLine = `⚒ Создано: ${res.name}`;
  if (rarityId !== 'white') {
    logLine += ` (${rarity.name})`;
    if (bonusText) logLine += ` · ${bonusText}`;
  }
  logLine += ` (−${price} 🪙)`;
  logLoot(logLine, rarityId === 'white' ? 'log-craft' : 'log-craft rarity-' + rarityId);

  renderInventory(); renderForgeAll(); updateInventoryFooter(); updateForgeGold();

  if (rarityId === 'white') {
    showToast('⚒', `Создано: ${res.name} (−${price} 🪙)`);
  } else {
    showToast('✨', `Создано: ${res.name} (${rarity.name})${bonusText ? ' · ' + bonusText : ''} (−${price} 🪙)`);
  }

  if (typeof markDeed === 'function') markDeed('forge.crafted');   // v0.31: тема у кузнеца
  if (typeof rapportService === 'function') rapportService('smith');   // v0.32: отношения
  saveCurrentSlot();
}

// ========================================================
//  КРАФТ ПАЧКОЙ (v0.18)
//  Для рецептов, чей результат складывается в стопку
//  (материалы, еда): кнопки 1 / 10 / 100.
//  Если на 10/100 не хватает — делаем сколько можно.
// ========================================================

const BATCH_CRAFT_TYPES = ['material', 'food', 'consumable'];

function isBatchCraftRecipe(recipe) {
  return !!(recipe && recipe.result && BATCH_CRAFT_TYPES.includes(recipe.result.type));
}

// Сколько штук можно сделать прямо сейчас (материалы + Оболы).
function getMaxCraftable(recipe) {
  let max = Infinity;
  recipe.materials.forEach(m => {
    max = Math.min(max, Math.floor(countMaterial(m.name) / m.qty));
  });
  const price = recipe.price || 0;
  if (price > 0) max = Math.min(max, Math.floor(state.player.gold / price));
  return isFinite(max) ? Math.max(0, max) : 0;
}

// Списать материал в количестве qty: сначала из инвентаря, недостающее — со склада.
// Возвращает, сколько взято со склада.
function takeMaterial(name, qty) {
  const inv = state.player.inventory;
  let need = qty;
  while (need > 0) {
    const item = inv.find(i => i.name === name && i.qty > 0);
    if (!item) break;
    const take = Math.min(item.qty, need);
    item.qty -= take; need -= take;
    if (item.qty <= 0) inv.splice(inv.indexOf(item), 1);
  }

  // v0.25: остаток — со склада
  let fromStore = 0;
  if (need > 0 && typeof loadStorage === 'function') {
    const arr = loadStorage();
    for (let i = 0; i < arr.length && need > 0; i++) {
      const s = arr[i];
      if (s.name !== name || !STORAGE_STACKABLE_TYPES.includes(s.type)) continue;
      const take = Math.min(s.qty || 1, need);
      s.qty = (s.qty || 1) - take; need -= take; fromStore += take;
    }
    if (fromStore > 0) saveStorage(arr.filter(s => (s.qty || 0) > 0));
  }
  return fromStore;
}

// Списать все материалы рецепта × n. Если что-то взято со склада — пишем в лог.
function takeRecipeMaterials(recipe, n) {
  const fromStore = [];
  recipe.materials.forEach(m => {
    const got = takeMaterial(m.name, m.qty * n);
    if (got > 0) fromStore.push(`${m.name} ×${got}`);
  });
  if (fromStore.length) logLoot(`🏦 Со склада в кузницу: ${fromStore.join(', ')}`, 'log-info');
}

function craftItemBatch(category, recipeId, count) {
  const recipe = (RECIPES[category] || []).find(r => r.id === recipeId);
  if (!recipe) return;
  if (!isBatchCraftRecipe(recipe)) { craftItem(category, recipeId); return; }

  const n = Math.min(count, getMaxCraftable(recipe));
  if (n <= 0) {
    showToast('⚒', 'Не хватает материалов или Оболов');
    return;
  }
  if (n === 1) { craftItem(category, recipeId); return; }

  const res = recipe.result;
  if (!canAddItemToInventory(res.type, res.name)) {
    showToast('📦', 'Инвентарь переполнен — крафт невозможен');
    return;
  }

  const p = state.player;
  const price = recipe.price || 0;

  takeRecipeMaterials(recipe, n);
  p.gold -= price * n;

  // Первая штука — обычным путём (правильная иконка и поля), остальное — в ту же стопку.
  const drop = {
    name: res.name, type: res.type, qty: 1,
    stats: res.stats, sellPrice: res.sellPrice,
    food: res.food, tier: recipe.tier || null,
    icon: (res.icon && typeof res.icon === 'string' && res.icon.startsWith('img/'))
      ? `<img src="${res.icon}" alt="" style="width:100%;height:100%;object-fit:contain;">`
      : (res.iconKey && SVG[res.iconKey]) ? SVG[res.iconKey] : SVG.gold,
  };
  addToInventory(drop);
  const stack = p.inventory.find(i => i.name === res.name);
  if (stack) stack.qty += n - 1;

  const total = price * n;
  logLoot(`⚒ Создано: ${res.name} ×${n} (−${total} 🪙)`, 'log-craft');
  showToast('⚒', `Создано: ${res.name} ×${n}${n < count ? ` (больше не хватило)` : ''} (−${total} 🪙)`);

  renderInventory(); renderForgeAll(); updateInventoryFooter(); updateForgeGold();
  if (typeof updateTopStatus === 'function') updateTopStatus();
  if (typeof markDeed === 'function') markDeed('forge.crafted');   // v0.31: тема у кузнеца
  if (typeof rapportService === 'function') rapportService('smith');   // v0.32: отношения
  saveCurrentSlot();
}

