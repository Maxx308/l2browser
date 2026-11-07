// ========================================================
//  СИСТЕМЫ: ДУШИ САМОЦВЕТОВ (v0.33)
//
//  + Свой бросок у каждого монстра — и в стае на старте, и у подмоги.
//    Монстр с душой: здоровье ×N, точность ×M. В одной стае душ может быть несколько.
//  + Убил его — камень в сумку (Древний — 2, Кровавый — 4).
//  + Ряд камней над карточками монстров: игрок выбирает, до какого цвета
//    искать души (state.player.soulHuntCap — индекс в SOUL_ORDER, 0 = только зелёные).
//  + На карточке врага в бою мерцает камень его цвета.
//  + Старые рубины и сапфиры (обычный дроп до v0.33) забираем при входе и со склада.
//
//  Данные — js/data/souls.js. Подключать ПОСЛЕ battle-core.js.
// ========================================================

// ---------- ВЫБОР ОХОТЫ ----------
function getSoulHuntCap() {
  const v = state.player.soulHuntCap;
  return Number.isInteger(v) && v >= 0 && v < SOUL_ORDER.length ? v : 0;
}

function setSoulHuntCap(i) {
  state.player.soulHuntCap = Math.max(0, Math.min(SOUL_ORDER.length - 1, i | 0));
  renderSoulHuntBar();
  if (typeof saveCurrentSlot === 'function') saveCurrentSlot();
}

function getSoulLocation(locId) {
  return SOUL_LOCATIONS[locId || state.player.currentLocation] || null;
}

// Как часто встречается душа: «примерно 1 монстр из 20» (не зависит от темпа охоты).
function formatSoulFrequency(chance) {
  return `примерно 1 монстр из ${Math.round(100 / chance).toLocaleString('ru-RU')}`;
}

// ---------- РЯД КАМНЕЙ НАД КАРТОЧКАМИ ----------
function renderSoulHuntBar() {
  const bar = document.getElementById('soul-hunt-bar');
  if (!bar) return;
  const loc = getSoulLocation();
  if (!loc || !state.player.classId) {
    bar.style.display = 'none';
    bar.innerHTML = '';
    return;
  }
  bar.style.display = '';
  const cap = getSoulHuntCap();

  const gems = SOUL_ORDER.map((id, i) => {
    const t = SOUL_TYPES[id];
    const gemName = loc.gems[id];
    const def = SOUL_GEM_ITEMS[gemName];
    const on = i <= cap;
    const stones = Object.values(SOUL_STONES_BY_VARIANT);
    const tip = `Душа ${t.gemGen} (${gemName})\n` +
      `Шанс: ${String(t.chance).replace('.', ',')}% на каждого монстра — ${formatSoulFrequency(t.chance)}\n` +
      `Монстр: здоровье ×${t.hpMult}, точность ×${String(t.accMult).replace('.', ',')}\n` +
      `Камней: ${stones.join(' / ')} (обычный / Древний / Кровавый)\n` +
      (i === 0 ? 'Зелёные души встречаются всегда' : (on ? 'Нажмите, чтобы искать только до предыдущего камня' : 'Нажмите, чтобы искать и такие души'));
    const icon = def ? `<img src="${def.icon}" alt="" onerror="this.style.display='none'">` : '';
    return `<button type="button" class="soul-gem soul-${id}${on ? ' on' : ''}" style="--soul:${t.color}" ` +
      `title="${tip}" aria-label="Искать души до ${t.gemGen}" aria-pressed="${on}" data-i="${i}">${icon}</button>`;
  }).join('');

  const top = SOUL_TYPES[SOUL_ORDER[cap]];
  const hint = cap === 0
    ? 'Ищем только зелёные души. Нажмите на камень правее, чтобы искать и более редкие.'
    : `Ищем души до ${top.gemGen}: здоровье монстра до ×${top.hpMult}.`;

  bar.innerHTML = `<span class="soul-hunt-label">💎 Души:</span><span class="soul-hunt-gems">${gems}</span><span class="soul-hunt-hint">${hint}</span>`;
  bar.querySelectorAll('.soul-gem').forEach(btn => {
    btn.onclick = () => {
      const i = +btn.dataset.i;
      // повторный клик по самому дорогому включённому камню — шаг назад
      setSoulHuntCap(i === cap && i > 0 ? i - 1 : i);
    };
  });
}

// ---------- БРОСОК ДУШИ ----------
// Свой бросок у каждого монстра (и у подмоги): от частых к редким, только до выбранного камня.
function rollMonsterSoul() {
  if (!getSoulLocation()) return null;
  const cap = getSoulHuntCap();
  let r = Math.random() * 100;
  for (let i = 0; i <= cap; i++) {
    const t = SOUL_TYPES[SOUL_ORDER[i]];
    if (r < t.chance) return t.id;
    r -= t.chance;
  }
  return null;
}

function applySoulToMonster(m, soulId) {
  const t = SOUL_TYPES[soulId];
  if (!m || !t) return;
  m.soul = soulId;
  m.maxHp = Math.floor(m.maxHp * t.hpMult);
  m.hp = m.maxHp;
  m.accMult = t.accMult;
}

// Бросок для одного монстра. Строка в журнал копится в очереди —
// её выводит soulsFlushLog() после строки о начале боя / о подмоге.
function soulsTryMonster(m) {
  if (!m || m.soul) return null;
  const soulId = rollMonsterSoul();
  if (!soulId) return null;
  applySoulToMonster(m, soulId);
  const t = SOUL_TYPES[soulId];
  if (!Array.isArray(state.battle.soulLogQueue)) state.battle.soulLogQueue = [];
  state.battle.soulLogQueue.push(`💎 ${m.name} несёт душу ${t.gemGen}! Здоровье ×${t.hpMult}, точность ×${String(t.accMult).replace('.', ',')}.`);
  if (typeof annalsFirst === 'function') annalsFirst('soul.seen', { gem: t.gem });
  return soulId;
}

// Из startBattle — сразу после создания стаи (до того, как нарисованы карточки).
function soulsOnBattleStart(monsters) {
  state.battle.soulLogQueue = [];
  (monsters || []).forEach(m => soulsTryMonster(m));
}

function soulsFlushLog() {
  const q = state.battle.soulLogQueue;
  if (!Array.isArray(q) || !q.length) return;
  q.forEach(line => logCombat(line, 'log-entry soul-log'));
  state.battle.soulLogQueue = [];
}
const soulsLogBattleStart = soulsFlushLog;   // старое имя (battle-core.js)

// ---------- НАГРАДА ----------
// Сколько камней положить в сумку (стакаются по имени). Возвращает, сколько легло.
function addSoulGems(name, count) {
  const def = SOUL_GEM_ITEMS[name];
  const p = state.player;
  if (!def || count <= 0) return 0;
  purgeRetiredGems(p.inventory);

  const existing = p.inventory.find(i => i.name === name && i.soulGem);
  if (existing) {
    existing.qty = (existing.qty || 1) + count;
    renderInventory();
    return count;
  }
  if (p.inventory.length >= INVENTORY_MAX_SLOTS) {
    showToast('📦', `Сумка полна — «${name}» потерян`);
    logLoot(`📦 Инвентарь переполнен — «${name}» потерян.`, 'log-info');
    return 0;
  }
  p.inventory.push({
    id: 'item_' + Date.now() + '_' + Math.random(),
    name, type: 'material',
    icon: normalizeIconHtml(def.icon),
    qty: count,
    stats: null,
    sellPrice: def.sellPrice || 1,
    tier: def.tier,
    rarity: def.color,
    soulGem: true,
    refineLevel: 0, refineBonuses: null,
  });
  renderInventory();
  return count;
}

// Из onMonsterDeath.
function soulsOnMonsterDeath(m) {
  if (!m || !m.soul) return;
  const loc = getSoulLocation();
  const name = loc && loc.gems[m.soul];
  if (!name) return;
  const count = SOUL_STONES_BY_VARIANT[m.variantId] || 1;
  const got = addSoulGems(name, count);
  // «Добыча за сессию» (battle-session.js): камни идут мимо addToInventory — записываем сами
  if (typeof bsessNoteLoot === 'function') {
    const def = SOUL_GEM_ITEMS[name];
    bsessNoteLoot({ name, icon: def.icon, rarity: def.color, type: 'material' }, count, got > 0);
  }
  if (got <= 0) return;
  const t = SOUL_TYPES[m.soul];
  logLoot(`💎 ${name}${got > 1 ? ' ×' + got : ''}`, 'log-loot soul-loot rarity-' + m.soul, `душа ${t.gemGen}`);
  showToast('💎', `${name}${got > 1 ? ' ×' + got : ''}`);
  if (typeof annalsFirst === 'function') annalsFirst('soul.taken', { gem: t.gem });
  if (typeof bumpChronicleCounter === 'function') bumpChronicleCounter('soulGems', got);
}

// ---------- КАМЕНЬ НА КАРТОЧКЕ ВРАГА В БОЮ ----------
// Маленький гранёный камешек. Цвета берёт из --soul / --soul-hi / --soul-lo карточки врага.
const SOUL_GEM_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <polygon points="6,3 18,3 22,9 2,9" fill="var(--soul-hi)"/>
  <polygon points="8,9 12,3 16,9" fill="#fff" fill-opacity=".55"/>
  <polygon points="2,9 12,9 12,21" fill="var(--soul)"/>
  <polygon points="12,9 22,9 12,21" fill="var(--soul-lo)"/>
  <path d="M2 9h20M8 9l4 12 4-12" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".8"/>
  <polygon points="6,3 18,3 22,9 12,21 2,9" fill="none" stroke="#000" stroke-opacity=".75" stroke-width="1.2" stroke-linejoin="round"/>
  <path class="bx-soul-spark" d="M6.5 5.2l.5-1.4.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5z" fill="#fff"/>
</svg>`;

function soulBadgeHtml(m) {
  if (!m || !m.soul) return '';
  const t = SOUL_TYPES[m.soul];
  const img = SOUL_GEM_SVG;
  return `<div class="bx-soul-aura"></div><div class="bx-soul soul-${m.soul}" title="Душа ${t.gemGen}: здоровье ×${t.hpMult}, точность ×${String(t.accMult).replace('.', ',')}">${img}</div>`;
}

// ---------- ИЗЪЯТИЕ СТАРЫХ КАМНЕЙ (при входе) ----------
function retireOldGemsOnLoad() {
  const p = state.player;
  let n = purgeRetiredGems(p.inventory);
  if (typeof loadStorage === 'function') {
    // loadStorage уже отдаёт склад без старых камней — сохраняем очищенный
    const raw = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; } })();
    const before = Array.isArray(raw) ? raw.filter(isRetiredGem).reduce((s, i) => s + (i.qty || 1), 0) : 0;
    if (before > 0) {
      writeStorageLocal(loadStorage(), getStorageLocalUpdatedAt() || undefined);
      n += before;
    }
  }
  if (n > 0) {
    setTimeout(() => {
      showToast('💎', `Старые рубины и сапфиры изъяты: ${n} шт.`);
      logLoot(`💎 Рубины и сапфиры больше не падают с Гоблинов и Кобольдов — теперь это камни душ. Старые камни изъяты: ${n} шт.`, 'log-info');
    }, 1800);
  }
  return n;
}
