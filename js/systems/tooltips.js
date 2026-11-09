// ========================================================
//  СИСТЕМЫ: ТУЛТИПЫ
//  Тултипы для предметов инвентаря, экипировки и навыков.
//
//  НАДЁЖНОЕ СКРЫТИЕ:
//  - клик в любом месте страницы,
//  - прокрутка страницы,
//  - переключение вкладки (см. tabs.js),
//  - авто-скрытие через 7 секунд.
//
//  ВАЖНО: тултип владения остался в proficiency-ui.js.
//
//  + Показываем hpBonus (плоское +HP от экипировки).
//
//  НОВОЕ (v0.07):
//  + Показываем ТИР предмета: «Тир N · Точится до +M».
//
//  НОВОЕ (v0.08):
//  + Показываем УРОВЕНЬ ПОДГОНКИ: «Гамбезон (верх) +3».
//  + Показываем БОНУСЫ ПОДГОНКИ отдельным блоком.
// ========================================================

// Таймер авто-скрытия тултипа.
let __tooltipTimer = null;
const TOOLTIP_LIFE_MS = 7000;

// Сброс таймера и запуск нового.
function resetTooltipTimer() {
  clearTimeout(__tooltipTimer);
  __tooltipTimer = setTimeout(() => hideTooltip(), TOOLTIP_LIFE_MS);
}

// Цвета редкости для тултипа (совпадают с CSS).
const RARITY_TT_COLORS = {
  white:  '#c8c0b0',
  green:  '#80e080',
  blue:   '#6a9ae0',
  purple: '#c080ff',
  yellow: '#ffd040',
  red:    '#ff5050',
};

// ---------- ХЕЛПЕР: суффикс подгонки для имени ----------
function getRefineSuffix(item) {
  if (!item) return '';
  const lvl = item.refineLevel || 0;
  return lvl > 0 ? ` +${lvl}` : '';
}

// ---------- ТУЛТИП НАДЕТОЙ ВЕЩИ (клик по слоту экипировки) ----------
function showEquipTooltip(e, slotKey) {
  const p = state.player;
  if (slotKey === 'shield' && hasTwoHandedWeapon()) {
    const tt = document.getElementById('item-tooltip');
    tt.innerHTML = `<div class="tt-name">Слот щита</div><div class="tt-line stat">Недоступно: двуручное оружие</div>`;
    tt.style.display = 'block';
    tt.style.left = Math.min(window.innerWidth - 280, e.clientX + 15) + 'px';
    tt.style.top = Math.min(window.innerHeight - 140, e.clientY + 15) + 'px';
    resetTooltipTimer();
    return;
  }
  const item = p.equipment[slotKey];
  if (!item && slotKey === 'shield') {
    // v0.27: пустая левая рука — подсказка, что можно взять
    const tt = document.getElementById('item-tooltip');
    const dual = isMage() ? '' : ' или второе одноручное оружие (меч, топор, кинжал, дубина)';
    const free = hasFreeHandStyle() ? `<div class="tt-line" style="color:#a0e080;">Сейчас «Свободная рука»: +${FREE_HAND_EVASION_BONUS} к увороту</div>` : '';
    tt.innerHTML = `<div class="tt-name">Левая рука</div><div class="tt-line stat">Нажмите, чтобы взять щит${dual}.</div>${free}`;
    tt.style.display = 'block';
    tt.style.left = Math.min(window.innerWidth - 280, e.clientX + 15) + 'px';
    tt.style.top = Math.min(window.innerHeight - 140, e.clientY + 15) + 'px';
    resetTooltipTimer();
    return;
  }
  if (!item) return;
  showItemTooltip(e, item);
}

// ---------- ТУЛТИП ПРЕДМЕТА ----------
function showItemTooltip(e, item) {
  const tt = document.getElementById('item-tooltip');
  const lines = [];

  const rarityId = item.rarity || 'white';
  const rarity = (typeof RARITIES !== 'undefined' && RARITIES[rarityId]) ? RARITIES[rarityId] : null;
  const nameColor = RARITY_TT_COLORS[rarityId] || RARITY_TT_COLORS.white;

  // ---- НОВОЕ: имя с суффиксом подгонки ----
  const refineSuffix = getRefineSuffix(item);
  lines.push(`<div class="tt-name" style="color:${nameColor};">${item.name}${refineSuffix}</div>`);

  // v0.33: камень души — вместо редкости пишем, сколько пыли даст
  const soulGem = (typeof getSoulGemDef === 'function') ? getSoulGemDef(item) : null;
  if (soulGem) {
    const y = getDisenchantYield(item);
    const dust = y && ALCHEMY_DUST[y.color];
    lines.push(`<div class="tt-line" style="color:${nameColor}; font-weight:600;">💎 Камень души</div>`);
    if (y && dust) lines.push(`<div class="tt-line" style="color:${dust.color};">У Алхимика: ${y.min}–${y.max} ${dust.name.toLowerCase()} за штуку</div>`);
  } else if (rarity && rarityId !== 'white') {
    const bonusText = formatRarityBonus(item.bonusStats);
    let rarityLine = `Редкость: ${rarity.name}`;
    if (rarity.statPercent && getEquipSlotForType(item.type)) rarityLine += ` · +${rarity.statPercent}% к статам`;
    if (bonusText) rarityLine += ` · ${bonusText}`;
    lines.push(`<div class="tt-line" style="color:${nameColor}; font-weight:600;">${rarityLine}</div>`);
  }

  if (item.twoHanded) lines.push(`<div class="tt-line two-handed">Двуручное оружие</div>`);
  if (item.type === 'shield') {
    lines.push(`<div class="tt-line block">Стойка: −${SHIELD_STANCE_DAMAGE_CUT}% ко всему входящему урону</div>`);
    lines.push(`<div class="tt-line" style="color:#d08070;">Уворот: −${SHIELD_EVASION_PENALTY}</div>`);
  }
  if (isTwoHandGripWeapon(item)) {
    lines.push(`<div class="tt-line two-handed">Двуручный хват: +${TWO_HAND_GRIP_SKILL_BONUS}% к урону навыков</div>`);
    lines.push(`<div class="tt-line" style="color:#d08070;">Уворот: −${TWO_HAND_EVASION_PENALTY} (кроме магов)</div>`);
  }
  if (item.type === 'weapon' && !item.twoHanded) lines.push(`<div class="tt-line type">Одноручное</div>`);
  // v0.27: парное оружие
  if (item.type === 'weapon' && getOffhandWeapon() === item) {
    lines.push(`<div class="tt-line two-handed">Во второй руке: +${getOffhandPAtk()} к обычной атаке (${DUAL_WIELD_OFFHAND_PERCENT}%), скорость +${DUAL_WIELD_ATB_BONUS}%, фишки — с половинным шансом. Свои статы не даёт.</div>`);
  } else if (canDualWield(item) && !isMage()) {
    lines.push(`<div class="tt-line type">Можно во вторую руку (слот щита)</div>`);
  }

  // ---- ТИР ПРЕДМЕТА ----
  const itemTier = (typeof getItemTier === 'function') ? getItemTier(item) : (item.tier || 1);
  if (itemTier && getEquipSlotForType(item.type)) {
    const maxRef = (typeof getMaxRefine === 'function') ? getMaxRefine(itemTier) : (itemTier * 5);
    lines.push(`<div class="tt-line tier" style="color: #a0d080;">Тир ${itemTier} · Точится до +${maxRef}</div>`);
  }
  // v0.33: требование уровня — красным, если герой ещё не дорос
  const reqLevel = getItemReqLevel(item);
  if (reqLevel) {
    const ok = canWearByLevel(item);
    lines.push(`<div class="tt-line" style="color:${ok ? '#a0d080' : '#e07060'};${ok ? '' : ' font-weight:600;'}">${ok ? '' : '🔒 '}Требуется уровень: ${reqLevel}</div>`);
  }

  // ---- ОСНОВНЫЕ СТАТЫ ПРЕДМЕТА ----
  if (item.stats) {
    // v0.26: итог с надбавкой редкости, в скобках — сколько дала редкость
    const rs = (stat) => {
      const add = getRarityStatBonus(item, stat);
      return `+${getItemStat(item, stat)}` + (add ? ` <span style="color:${nameColor};">(+${add} редкость)</span>` : '');
    };
    if (item.stats.pAtk) lines.push(`<div class="tt-line stat">Атака: ${rs('pAtk')}</div>`);
    if (item.stats.mAtk) lines.push(`<div class="tt-line magic">Маг. атака: ${rs('mAtk')}</div>`);
    if (item.stats.pDef) lines.push(`<div class="tt-line stat">Защита: ${rs('pDef')}</div>`);
    if (item.stats.mDef) lines.push(`<div class="tt-line magic">Маг. защита: ${rs('mDef')}</div>`);

    if (item.stats.hpBonus) lines.push(`<div class="tt-line" style="color: #a0e080;">HP: ${rs('hpBonus')}</div>`);
    if (item.stats.mpBonus) lines.push(`<div class="tt-line mana">Мана: ${rs('mpBonus')}</div>`);
    if (item.stats.mpRegenIn) lines.push(`<div class="tt-line mana">Реген маны в бою: +${item.stats.mpRegenIn}/сек</div>`);

    if (item.stats.flatDamageReduce) lines.push(`<div class="tt-line block">Поглощение урона: -${item.stats.flatDamageReduce}</div>`);
    if (item.stats.blockChance) lines.push(`<div class="tt-line block">Шанс блока: ${item.stats.blockChance}%</div>`);
    if (item.stats.critChance) lines.push(`<div class="tt-line crit">Шанс крита: +${item.stats.critChance}%</div>`);
    if (item.stats.atbSpeedMod) {
      const pct = Math.round(item.stats.atbSpeedMod * 100);
      lines.push(`<div class="tt-line speed">Скорость атаки: ${pct >= 0 ? '+' : ''}${pct}%</div>`);
    }
  }

  // v0.24: оружие тира 3 — фишки типа сильнее.
  if (item.type === 'weapon' && typeof getTierTraitBonusText === 'function') {
    const t3Text = getTierTraitBonusText(item);
    if (t3Text) lines.push(`<div class="tt-line" style="color:#a0d080;">★ Фишка тира 3: ${t3Text}</div>`);
  }

  // ========================================================
  //  НОВОЕ: БЛОК БОНУСОВ ПОДГОНКИ
  //  Показываем только если предмет точен (refineLevel > 0).
  // ========================================================
  const itemRefine = item.refineLevel || 0;
  const rb = item.refineBonuses;
  if (itemRefine > 0 && rb) {
    // Заголовок блока.
    lines.push(`<div class="tt-line refine-title">🔧 Подгонка +${itemRefine}:</div>`);

    // Вехи (гарантированные бонусы).
    if (rb.pAtkFlat)         lines.push(`<div class="tt-line stat">Атака: +${rb.pAtkFlat} (вехи)</div>`);
    if (rb.mAtkFlat)         lines.push(`<div class="tt-line magic">Маг. атака: +${rb.mAtkFlat} (вехи)</div>`);
    if (rb.pDefFlat)         lines.push(`<div class="tt-line stat">Защита: +${rb.pDefFlat} (вехи)</div>`);
    if (rb.mDefFlat)         lines.push(`<div class="tt-line magic">Маг. защита: +${rb.mDefFlat} (вехи)</div>`);
    if (rb.xpMsPercent)      lines.push(`<div class="tt-line" style="color:#e0c070;">Опыт: +${rb.xpMsPercent}% (вехи)</div>`);
    if (rb.profMsPercent)    lines.push(`<div class="tt-line" style="color:#e0c070;">Мастерство: +${rb.profMsPercent}% (вехи)</div>`);

    // Случайные бонусы.
    if (rb.hpBonus)          lines.push(`<div class="tt-line" style="color: #a0e080;">HP: +${rb.hpBonus}</div>`);
    if (rb.mpBonus)          lines.push(`<div class="tt-line mana">Мана: +${rb.mpBonus}</div>`);
    if (rb.hpRegenOutBonus)  lines.push(`<div class="tt-line" style="color: #a0e080;">HP/сек: +${Math.round(rb.hpRegenOutBonus * 100) / 100}</div>`);
    if (rb.mpRegenOutBonus)  lines.push(`<div class="tt-line mana">MP/сек: +${Math.round(rb.mpRegenOutBonus * 100) / 100}</div>`);
    if (rb.accuracyBonus)    lines.push(`<div class="tt-line stat">Точность: +${rb.accuracyBonus}</div>`);
    if (rb.evasionBonus)     lines.push(`<div class="tt-line stat">Уворот: +${rb.evasionBonus}</div>`);
    if (rb.critBonus)        lines.push(`<div class="tt-line crit">Крит: +${rb.critBonus}%</div>`);
    if (rb.blockBonus)       lines.push(`<div class="tt-line block">Блок: +${rb.blockBonus}%</div>`);
    if (rb.xpBonusPercent)   lines.push(`<div class="tt-line" style="color: #a0e080;">Опыт: +${rb.xpBonusPercent}%</div>`);
    if (rb.profBonusPercent) lines.push(`<div class="tt-line" style="color: #a0e080;">Владение: +${rb.profBonusPercent}%</div>`);
    if (rb.goldBonusPercent) lines.push(`<div class="tt-line" style="color: #d4b060;">Оболы: +${rb.goldBonusPercent}%</div>`);
    if (rb.dropBonusPercent) lines.push(`<div class="tt-line" style="color: #a0e080;">Дроп: +${rb.dropBonusPercent}%</div>`);
  } else if (itemRefine > 0) {
    // На всякий случай: уровень есть, а бонусов нет (старое сохранение).
    lines.push(`<div class="tt-line refine-title">🔧 Подгонка +${itemRefine}</div>`);
  }

  // ---- РАСХОДНИКИ / ЕДА / СВИТКИ ----
  if (item.effect) lines.push(`<div class="tt-line effect">${item.effect}</div>`);
  // v0.35.1: блюдо — только бонус; еда — сытость своего вида (FOOD_KINDS)
  if (item.food && item.food.dish && DISHES[item.food.dish]) {
    const d = DISHES[item.food.dish];
    lines.push(`<div class="tt-line food-effect">${d.icon} ${d.text} · ${buffShopDur(getFoodDuration(item))}</div>`);
    lines.push(`<div class="tt-line type" style="color: #a0d080;">Клик чтобы съесть. Не насыщает. То же блюдо продлевает (макс. 12 ч), другое заменяет.</div>`);
  } else if (item.food) {
    const k = FOOD_KINDS[getFoodKindId(item)];
    lines.push(`<div class="tt-line food-effect">${k.icon} Сытость: ${foodKindText(k)} · ${buffShopDur(getFoodDuration(item))}</div>`);
    lines.push(`<div class="tt-line type" style="color: #a0d080;">Клик чтобы съесть. Та же еда складывается (макс. 12 ч), другая заменяет.</div>`);
  }
  if (item.shopId === 'teleportScroll') {   // v0.26: остался только на складе
    lines.push(`<div class="tt-line type" style="color: #c0a0ff;">Больше не используется — теперь магические тропы. Заберите со склада: +${(item.qty || 1) * TELEPORT_SCROLL_REFUND} Оболов.</div>`);
  }

  // ---- v0.25: МИНИ-СЕТ БИЖУТЕРИИ (вещи этого тира и выше) ----
  if ((item.type === 'ring' || item.type === 'earring' || item.type === 'necklace') && typeof JEWELRY_MINISET_MDEF !== 'undefined') {
    const t = Math.min(3, Math.max(1, getItemTier(item)));
    const steps = JEWELRY_MINISET_MDEF[t];
    const n = countJewelryOfTier(state.player.equipment, t);
    const now = steps[n] || 0;
    lines.push(`<div class="tt-line" style="color:#9ab8ff;">💍 Бижутерия тира ${t}+: надето ${n}/5 → +${now} маг. защиты` +
      `<br><span style="opacity:.75;">2 / 3 / 4 / 5 вещей: +${steps[2]} / +${steps[3]} / +${steps[4]} / +${steps[5]}</span></div>`);
  }

  // ---- СЕТЫ ----
  if (item.setId && SETS[item.setId]) {
    const set = SETS[item.setId];
    const p = state.player;
    if (set.isFullSetEquipped) {
      // Сет бижутерии: 2 кольца + 2 серьги + ожерелье (v0.25: для любого такого сета, не только «Новичка»)
      const have = ['ring1', 'ring2', 'earring1', 'earring2', 'necklace']
        .filter(k => p.equipment[k] && set.pieces.includes(p.equipment[k].name)).length;
      lines.push(`<div class="tt-line set">${set.name}: ${have}/5<br>Полный сет: ${set.bonusText}</div>`);
    } else {
      const eq = set.pieces.filter(name => Object.values(p.equipment).some(ee => ee && ee.name === name)).length;
      let step2 = '';
      if (set.bonus10Text) {
        const ref = Object.values(p.equipment).filter(ee => ee && set.pieces.includes(ee.name) && (ee.refineLevel || 0) >= 10).length;
        step2 = `<br>Все части +10 (${ref}/${set.pieces.length}): ${set.bonus10Text}`;
      }
      // v0.25: ступени по частям — действующая подсвечена
      let tiers = '';
      if (set.skillFlatTiers) {
        const active = getSetSkillFlatTier(set, eq);
        tiers = Object.keys(set.skillFlatTiers).map(k => {
          const on = active && active.pieces === Number(k);
          return `<br><span style="opacity:${on ? 1 : 0.55}">${on ? '✓ ' : ''}${k} вещи: +${set.skillFlatTiers[k]} к урону навыков и ДОТов</span>`;
        }).join('');
      }
      lines.push(`<div class="tt-line set">${set.name}: ${eq}/${set.pieces.length}${tiers}<br>Полный сет: ${set.bonusText}${step2}</div>`);
    }
  }

  tt.innerHTML = lines.join('');
  tt.style.display = 'block';
  tt.style.left = Math.min(window.innerWidth - 320, e.clientX + 15) + 'px';
  tt.style.top = Math.min(window.innerHeight - 220, e.clientY + 15) + 'px';
  resetTooltipTimer();
}

// ---------- ТУЛТИП НАВЫКА ----------
function showSkillTooltip(e, skill) {
  const tt = document.getElementById('item-tooltip');
  const lvl = getSkillLevel(skill.id);
  const data = skill.levels[lvl - 1];
  const isMaxed = lvl >= skill.maxLevel;
  let lines = `<div class="tt-name">${skill.name}</div>`;
  lines += `<div class="tt-line stat">${skill.type === 'active' ? `Активный · MP: ${data.mpCost} · КД ${skill.cooldown}` : 'Пассивный'} · Ур. ${lvl}/${skill.maxLevel}</div>`;
  lines += `<div class="tt-line effect">${skill.getDesc(lvl).replace(/<[^>]*>/g, '')}</div>`;
  if (!isMaxed) lines += `<div class="tt-line next">Следующий ур.: ${skill.getNextDesc(lvl).replace(/<[^>]*>/g, '')}</div>`;
  else lines += `<div class="tt-line maxed">МАКСИМАЛЬНЫЙ УРОВЕНЬ</div>`;
  tt.innerHTML = lines;
  tt.style.display = 'block';
  tt.style.left = Math.min(window.innerWidth - 340, e.clientX + 15) + 'px';
  tt.style.top = Math.min(window.innerHeight - 200, e.clientY + 15) + 'px';
  resetTooltipTimer();
}

// ---------- СКРЫТЬ ТУЛТИП ----------
function hideTooltip() {
  const tt = document.getElementById('item-tooltip');
  if (tt) tt.style.display = 'none';
  clearTimeout(__tooltipTimer);
  __tooltipTimer = null;
}

// ---------- ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ ----------
document.addEventListener('click', hideTooltip);
document.addEventListener('scroll', hideTooltip, true);