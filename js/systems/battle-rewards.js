// ========================================================
//  СИСТЕМЫ: БОЙ — НАГРАДЫ И СМЕРТЬ
//  Дроп, золото, опыт, левелап, смерть монстра и игрока.
//
//  ПОДШАГ 0.2: горение, заморозка, яд — через debuffs.
//  ШАГ 1: сброс дебаффов через clearAllDebuffs().
//  ШАГ 4: похищение души — посох/жезл дают ману при убийстве.
//
//  НОВОЕ (авто-стоп между боями):
//  + Бой всегда доигрывается до конца.
//  + Стоп срабатывает ТОЛЬКО здесь, после смерти монстра.
//
//  НОВОЕ (группировка дропа):
//  + Предметы и золото в логе объединяются в одну строку.
//
//  НОВОЕ (кап одинаковых предметов):
//  + CAPPED_COPIES берётся из state.player.stackCap.
//
//  НОВОЕ (v0.11):
//  + КАП ТЕПЕРЬ РАБОТАЕТ ПО ТИПУ ПРЕДМЕТА, А НЕ ПО setId.
//  + Групповые бои: onMonsterDeath(deadMonster).
//  + Чистка дебаффов мёртвого моба (clearMonsterDebuffs).
//
//  НОВОЕ (v0.10 fix):
//  + trySoulSiphon: округляем «недостачу MP» вниз.
//
//  НОВОЕ (v0.10, балансировка опыта):
//  + checkLevelUp использует getXpForLevel() и MAX_PLAYER_LEVEL.
//  + Опыт с монстра: уровень × XP_MONSTER_MULTIPLIER (×3).
//
//  НОВОЕ (v0.12):
//  + «Жадность» гнома теперь через МЕТКУ (greedMark).
//    Читаем не флаги killedByGreed/killedByGreedMagic,
//    а дебафф greedMark у убитого моба.
//    type === 'warrior' → дроп ×1.25
//    type === 'mage'    → оболы ×1.25
//  + Флаги killedByGreed / killedByGreedMagic больше не используются.
// ========================================================

// Какие типы предметов попадают под кап одинаковых копий.
const CAPPED_TYPES = [
  'weapon', 'shield', 'helmet', 'armorTop', 'armorBottom',
  'gloves', 'boots', 'ring', 'earring', 'necklace'
];

function countItemCopies(itemName) {
  return state.player.inventory
    .filter(i => i.name === itemName)
    .reduce((sum, i) => sum + i.qty, 0);
}

// --------------------------------------------------------
//  ПОХИЩЕНИЕ ДУШИ (посохи/жезлы)
// --------------------------------------------------------
function trySoulSiphon(m) {
  if (!m) return;

  const p = state.player;
  const weapon = p.equipment.weapon;
  if (!weapon) return;

  const category = getWeaponCategory(weapon.name);
  if (category !== 'staves') return;

  const traits = getWeaponTraits(weapon.name);
  if (!traits.soulSiphonChance) return;

  const chance = getTraitChance(traits.soulSiphonChance, category);
  if (Math.random() * 100 >= chance) return;

  const restore = Math.floor(m.maxHp * 0.5);
  const missing = Math.floor(p.maxMp - p.mp);
  const actual = Math.min(restore, missing);

  if (actual <= 0) return;

  p.mp = Math.min(p.maxMp, p.mp + actual);

  logCombat(`💜 Похищение души! +${actual} MP (${m.name}: ${m.maxHp} HP)`, 'log-entry potion');
  showToast('💜', `Похищение души: +${actual} MP`);

  updateTopStatus();
  updateBattleUI();
}

// --------------------------------------------------------
//  СМЕРТЬ МОНСТРА → НАГРАДЫ
// --------------------------------------------------------
function onMonsterDeath(deadMonster) {
  const m = deadMonster || state.battle.monster;
  const p = state.player;
  if (!m) return;

  if (m._deathProcessed) return;
  m._deathProcessed = true;
  m.hp = 0;

  const mult_ = mult();

  // ---- v0.12: ПРОВЕРЯЕМ МЕТКУ ЖАДНОСТИ ----
  // Дебафф живёт в state.battle.debuffs.monsters[m.index].greedMark.
  // Читаем ДО clearMonsterDebuffs (который чистит всё в конце).
  // v0.19.1: каждая метка +25% (дроп у воина / Оболы у мага) и +10% опыта, до 5 меток.
  const greedMark = getDebuff('monster', 'greedMark', m.index);
  const greedN = greedMark ? ((Array.isArray(greedMark.marks) && greedMark.marks.length) || 1) : 0;
  const greedDropMult = (greedMark && greedMark.type === 'warrior') ? 1 + greedN * GREED_REWARD_PER_MARK / 100 : 1.0;
  const greedGoldMult = (greedMark && greedMark.type === 'mage')    ? 1 + greedN * GREED_REWARD_PER_MARK / 100 : 1.0;
  const greedXpMult = 1 + greedN * GREED_XP_PER_MARK / 100;

  const titleMult = getTitleDropMultiplier(m.id, m.variantId);
  const luckMult = getMixtureLuckMult();
  // v0.25: + «Дроп» от подгонки (раньше считался, но не применялся)
  const refineDropMult = 1 + (p.dropBonusFromRefine || 0) / 100;
  const totalDropMult = 1 + (titleMult - 1) + (luckMult - 1) + (refineDropMult - 1);
  // v0.25: + «Оболы» от подгонки — больше Оболов с каждой выпавшей кучки
  const refineGoldMult = 1 + (p.goldBonusFromRefine || 0) / 100;

  // ---- ОПЫТ ----
  const tavernXpMult = getXpMultiplierFromTavern();
  // v0.25: + опыт от подгонки (вехи бижутерии и случайный «+1% Опыт» — раньше не учитывался)
  const xpBonusTotal = Math.round(((p.xpBonus || 0) + (p.xpBonusFromRefine || 0)) * 10) / 10;
  const skillXpMult = 1 + xpBonusTotal / 100;
  const baseXpGain = m.xpReward * XP_MONSTER_MULTIPLIER * mult_;
  // v0.25: дробная часть — шансом на +1 (иначе на слабых монстрах 3 × 1.33 = 3.99 → 3 и бонусы пропадали)
  const xpRaw = baseXpGain * tavernXpMult * skillXpMult * greedXpMult;
  const xpGain = Math.floor(xpRaw) + (Math.random() < xpRaw % 1 ? 1 : 0);

  let xpLog = `💀 ${m.name} убит! +${xpGain} опыта.`;
  const bonusNotes = [];
  if (tavernXpMult > 1.0) bonusNotes.push(`Отдых +${TAVERN_XP_BONUS_PERCENT}%`);
  if (skillXpMult > 1.0) bonusNotes.push(`Опыт +${xpBonusTotal}%`);
  if (greedN > 0) bonusNotes.push(`Жадность ×${greedN} +${greedN * GREED_XP_PER_MARK}%`);
  if (bonusNotes.length > 0) xpLog += ` (${bonusNotes.join(', ')})`;
  logCombat(xpLog, 'log-entry kill');
  p.xp += xpGain;

  // ---- ЗОЛОТО ----
  const goldChance = m.goldChance * mult_ * titleMult;
  const goldCount = rollDropCount(goldChance);
  let totalGold = 0;
  for (let i = 0; i < goldCount; i++) {
    const baseGold = m.goldMin + Math.floor(Math.random() * (m.goldMax - m.goldMin + 1));
    // дробная часть — шансом на +1, иначе +1% на кучке в 5 Оболов съедался округлением
    const goldRaw = baseGold * mult_ * greedGoldMult * refineGoldMult;
    let gold = Math.floor(goldRaw) + (Math.random() < goldRaw % 1 ? 1 : 0);
    // v0.25: в Копях суммы круглые — до десятков (+60, а не +57)
    if (p.currentLocation === 'mine') gold = Math.max(10, Math.round(gold / 10) * 10);
    p.gold += gold;
    totalGold += gold;
  }
  if (totalGold > 0) {
    logLoot(`🪙 +${totalGold} Оболов`, 'log-gold');
  }

  // ---- v0.12: лог срабатывания метки ----
  if (greedDropMult > 1.0) {
    logLoot(`💰 Жадность ×${greedN}! Дроп +${greedN * GREED_REWARD_PER_MARK}%`, 'log-info');
  }
  if (greedGoldMult > 1.0) {
    logLoot(`💰 Жадность ×${greedN}! Оболы +${greedN * GREED_REWARD_PER_MARK}%`, 'log-info');
  }

  // ---- ПРЕДМЕТЫ ----
  const RARITY_TYPES = [
    'weapon', 'shield', 'helmet', 'armorTop', 'armorBottom',
    'gloves', 'boots', 'ring', 'earring', 'necklace'
  ];
  const CAPPED_COPIES = (p.stackCap !== undefined) ? p.stackCap : 3;
  const lootFilterLevel = p.lootFilterLevel || 0;

  const lootGroups = new Map();

  m.drops.forEach(d => {
    const dropChance = d.chance * mult_ * totalDropMult * greedDropMult;
    const count = rollDropCount(dropChance);
    if (count <= 0) return;

    for (let i = 0; i < count; i++) {
      if (CAPPED_TYPES.includes(d.type) && CAPPED_COPIES > 0) {
        const already = countItemCopies(d.name);
        if (already >= CAPPED_COPIES) {
          continue;
        }
      }

      const item = { ...d };

      if (RARITY_TYPES.includes(d.type)) {
        const rarityId = rollRarity();
        const rarity = RARITIES[rarityId];
        const profile = getRarityStatProfile(d);
        const bonusStats = rollRarityStats(rarity.statPoints, profile);
        item.rarity = rarityId;
        item.bonusStats = bonusStats;

        if (!passesFilter(item.rarity, lootFilterLevel)) {
          continue;
        }
      }

      addToInventory(item);

      const groupKey = d.name + '|' + (item.rarity || '');
      if (!lootGroups.has(groupKey)) {
        lootGroups.set(groupKey, {
          name: d.name,
          rarity: item.rarity || null,
          bonusStats: item.bonusStats || null,
          count: 0,
        });
      }
      lootGroups.get(groupKey).count++;
    }
  });

  lootGroups.forEach(group => {
    const rarity = group.rarity ? RARITIES[group.rarity] : null;
    const countStr = group.count > 1 ? ` ×${group.count}` : '';

    if (rarity && rarity.id !== 'white') {
      const bonusText = formatRarityBonus(group.bonusStats);
      logLoot(`✨ ${group.name}${countStr} (${rarity.name})${bonusText ? ' · ' + bonusText : ''}`, 'log-loot');
    } else {
      logLoot(`📦 ${group.name}${countStr}`, 'log-loot');
    }
  });

  // ---- ЛЕВЕЛАП ----
  checkLevelUp();

  // ---- ТИТУЛЫ ----
  const oldTitle = getMonsterTitle(m.id, m.variantId);
  incrementMonsterKills(m.id, m.variantId);
  const newTitle = getMonsterTitle(m.id, m.variantId);

  if (newTitle !== oldTitle) {
    const loc = getMonsterLocation(m.id);
    const locName = loc ? LOCATION_NAMES[loc] : '';

    if (newTitle === 'hunter') {
      showToast('👑', `${m.name}: титул Охотник! ×1.5 к дропу`);
    } else if (newTitle === 'glorious') {
      const variantName = getVariantDisplayName(m.variantId);
      showToast('👑', `Прославленный охотник! Все ${variantName} — ${locName}, ×2.0`);
    } else if (newTitle === 'magnificent') {
      showToast('🌟', `ВЕЛИКОЛЕПНЫЙ ОХОТНИК! Вся ${locName} — ×3.0!`);
    }
  }

  updateBattleKillsCounter(m);
  updateTopStatus();
  updateCharacterPanel();
  updateInventoryFooter();
  updateSkillPointsBadge();

  trySoulSiphon(m);

  // v0.19: Гниение перескакивает на соседа (до очистки дебаффов).
  if (typeof trySpreadRot === 'function') {
    trySpreadRot(m);
  }

  if (typeof clearMonsterDebuffs === 'function') {
    clearMonsterDebuffs(m.index);
  }

  saveCurrentSlot();

  // ========================================================
  //  ГРУППОВЫЕ БОИ: проверяем, остались ли живые
  // ========================================================
  const aliveLeft = state.battle.monsters.filter(x => x.hp > 0).length;

  if (aliveLeft > 0) {
    const next = getCurrentMonster();
    if (next) {
      switchMonsterUI(next);
    }
    updateBattleUI();
    return;
  }

  // ========================================================
  //  ВСЕ МЕРТВЫ — КОНЕЦ БОЯ
  // ========================================================
  const deadMonsterId = m.id;
  const deadVariantId = m.variantId;
  const deadTemplateId = m.templateId || m.id;

  state.battle.active = false;
  state.battle.monsters = [];
  state.battle.monstersATB = 0;

  clearAllDebuffs();

  // ---- АВТО-СТОП МЕЖДУ БОЯМИ ----
  if (shouldWaitForRecovery()) {
    const hpPct = Math.floor((p.hp / p.maxHp) * 100);
    const mpPct = Math.floor((p.mp / p.maxMp) * 100);
    let reason = 'порог';
    if (p.stopHpPercent > 0 && hpPct < p.stopHpPercent) reason = `HP ${hpPct}% < ${p.stopHpPercent}%`;
    else if (p.stopMpPercent > 0 && mpPct < p.stopMpPercent) reason = `MP ${mpPct}% < ${p.stopMpPercent}%`;

    state.battle.waitingTemplate = {
      id: deadTemplateId,
      variantId: deadVariantId,
      count: (state.battle.repeatCount || 1),
    };
    state.battle.waitingForResume = true;

    logCombat(`🏕 Привал: ${reason}. Ждём восстановления до ${p.resumeHpPercent}% HP / ${p.resumeMpPercent}% MP.`, 'log-entry');
    showToast('🏕', `Привал: ${reason}`);

    // v0.24: окно боя не закрываем — после «Победы» на арене привал (battle-rest.js),
    // сессия охоты и «Добыча» продолжают считаться.
    enterRestCamp();
    updateAutoWaitIndicator();

    saveCurrentSlot();
    return;
  }

  // ---- ПОВТОР ИЛИ ЗАКРЫТИЕ ----
  if (state.battle.repeatBattle) {
    const nextTemplate = [...MONSTERS, ...MINE_MONSTERS].find(mm => mm.id === deadTemplateId);
    const nextVariantId = deadVariantId;
    const nextCount = (state.battle.repeatCount || 1);

    if (!nextTemplate) {
      document.getElementById('battle-window').classList.remove('active');
      document.getElementById('hunt-hint').style.display = 'block';
      renderMonsters();
      return;
    }

    animateMonsterDeath(() => {
      if (!state.battle.repeatBattle) {
        document.getElementById('battle-window').classList.remove('active');
        document.getElementById('hunt-hint').style.display = 'block';
        renderMonsters();
        return;
      }

      const monsterSlot = document.getElementById('monster-avatar-slot');
      if (monsterSlot) {
        monsterSlot.classList.remove('fade-in-monster');
        monsterSlot.classList.add('fade-out-monster');
      }

      setTimeout(() => {
        if (!state.battle.repeatBattle) {
          if (monsterSlot) monsterSlot.classList.remove('fade-out-monster');
          document.getElementById('battle-window').classList.remove('active');
          document.getElementById('hunt-hint').style.display = 'block';
          renderMonsters();
          return;
        }

        if (monsterSlot) monsterSlot.classList.remove('fade-out-monster');
        showMonsterSearching();

        setTimeout(() => {
          if (!state.battle.repeatBattle) {
            hideMonsterSearching();
            document.getElementById('battle-window').classList.remove('active');
            document.getElementById('hunt-hint').style.display = 'block';
            renderMonsters();
            return;
          }

          hideMonsterSearching();
          startBattle(nextTemplate, nextVariantId, nextCount);
        }, 1500);

      }, 300);

    });

  } else {
    document.getElementById('battle-status').textContent = 'Монстр повержен.';
    setTimeout(() => {
      if (state.battle.active) return;
      document.getElementById('battle-window').classList.remove('active');
      document.getElementById('hunt-hint').style.display = 'block';
      renderMonsters();
    }, 1500);
  }
}

// --------------------------------------------------------
//  ПЕРЕКЛЮЧЕНИЕ UI НА СЛЕДУЮЩЕГО МОБА (v0.11)
// --------------------------------------------------------
function switchMonsterUI(m) {
  if (!m) return;

  const monsterSlot = document.getElementById('monster-avatar-slot');
  const monsterName = document.getElementById('monster-fighter-name');
  const monsterHpBar = document.getElementById('monster-hp-bar');

  if (monsterSlot) {
    monsterSlot.classList.remove('fade-in-monster', 'fade-out-monster');
    monsterSlot.innerHTML = `<img src="${m.art}" alt="">`;
    void monsterSlot.offsetWidth;
    monsterSlot.classList.add('fade-in-monster');
  }
  if (monsterName) {
    monsterName.classList.remove('dead', 'fade-in-monster');
    monsterName.textContent = m.name;
    void monsterName.offsetWidth;
    monsterName.classList.add('fade-in-monster');
  }
  if (monsterHpBar) {
    monsterHpBar.classList.remove('dead');
  }

  updateBattleKillsCounter(m);
}

// --------------------------------------------------------
//  СМЕРТЬ ИГРОКА
// --------------------------------------------------------
function onPlayerDeath() {
  const p = state.player;
  const lostXp = Math.floor(p.xp * 0.1);
  p.xp = Math.max(0, p.xp - lostXp);
  logCombat(`☠ ${p.name} погиб. Потеряно ${lostXp} опыта (10%).`, 'log-entry loss');

  p.foodTimer = 0;
  p.foodTickAccum = 0;
  p.dish = null;
  p.guildBuffs = {};
  p.tavernBuffs = {};

  state.battle.activeEffects.mixture = null;

  state.battle.active = false;
  state.battle.monsters = [];
  state.battle.monstersATB = 0;

  clearAllDebuffs();

  state.battle.waitingForResume = false;
  state.battle.waitingTemplate = null;

  hideMonsterSearching();

  renderEffectsPanel();
  recalcStats();

  showToast('💀', `${p.name} погиб. Потеряно ${lostXp} опыта`);

  saveCurrentSlot();

  setTimeout(() => {
    state.player.currentLocation = 'town';
    state.player.hp = Math.floor(state.player.maxHp * 0.5);
    document.getElementById('battle-window').classList.remove('active');
    document.querySelectorAll('.monster-card').forEach(c => c.classList.remove('selected'));
    updateMapUI();
    updateTopStatus();
    updateCharacterPanel();
    switchTab('hunt');
    renderMonsters();
    saveCurrentSlot();

    if (typeof tryAutoStartElderDialogue === 'function') {
      tryAutoStartElderDialogue();
    }
  }, 2000);
}

// --------------------------------------------------------
//  ЛЕВЕЛАП (v0.10 — новая формула)
//  xpNext = getXpForLevel(level + 1).
//  На капе (MAX_PLAYER_LEVEL) — xpNext = Infinity.
// --------------------------------------------------------
function checkLevelUp() {
  const p = state.player;
  if (!p.classId) return;

  // Достигли капа — не поднимаем выше.
  if (p.level >= MAX_PLAYER_LEVEL) {
    p.xpNext = Infinity;
    return;
  }

  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level++;

    // Следующий уровень — по новой формуле.
    // Если дошли до капа — xpNext = Infinity.
    if (p.level >= MAX_PLAYER_LEVEL) {
      p.xpNext = Infinity;
    } else {
      p.xpNext = getXpForLevel(p.level + 1);
    }

    const gain = (p.level >= 9) ? 2 : 1;
    p.skillPoints += gain;
    recalcStats();
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    logCombat(`✦ УРОВЕНЬ ${p.level}! +${gain} очков навыков.`, 'log-entry levelup');
    updateSkillPointsBadge();

    if (p.level >= MAX_PLAYER_LEVEL) {
      logCombat(`🏆 Достигнут максимальный уровень (${MAX_PLAYER_LEVEL}). Ждём новых земель!`, 'log-entry levelup');
      showToast('🏆', `Максимальный уровень: ${MAX_PLAYER_LEVEL}!`);
      break;
    }
  }
}