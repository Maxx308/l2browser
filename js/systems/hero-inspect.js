// ========================================================
//  СИСТЕМЫ: ОСМОТР ГЕРОЯ В РЕЙТИНГЕ (v0.25)
//
//  + Каждый игрок вместе со строкой рейтинга отправляет «снимок»
//    героя в колонку leaderboard.profile (jsonb): надетые вещи,
//    характеристики, навыки, владение оружием и стихиями.
//    Инвентарь, склад и золото сверх рейтинга НЕ отправляются.
//  + Нажатие на строку рейтинга — окно «Осмотр героя».
//  + Настройки → «Показывать моё снаряжение в рейтинге» (player.hideProfile).
//
//  БЕЗОПАСНОСТЬ: снимок пишет чужой браузер, ему нельзя доверять.
//  Вещь показывается, только если её название есть в каталоге игры,
//  иконки берутся из своих данных, все числа приводятся к числам,
//  тексты выводятся через escapeHtml.
// ========================================================

const HERO_PROFILE_VERSION = 1;

// Слоты «куклы» в порядке показа.
const INSPECT_SLOTS = [
  { key: 'weapon',      label: 'Оружие' },
  { key: 'shield',      label: 'Левая рука' },   // v0.27: щит или второе оружие
  { key: 'helmet',      label: 'Шлем' },
  { key: 'armorTop',    label: 'Верх' },
  { key: 'armorBottom', label: 'Низ' },
  { key: 'gloves',      label: 'Перчатки' },
  { key: 'boots',       label: 'Ботинки' },
  { key: 'necklace',    label: 'Ожерелье' },
  { key: 'earring1',    label: 'Серьга' },
  { key: 'earring2',    label: 'Серьга' },
  { key: 'ring1',       label: 'Кольцо' },
  { key: 'ring2',       label: 'Кольцо' },
];

// --------------------------------------------------------
//  СНИМОК СВОЕГО ГЕРОЯ (уходит в облако)
// --------------------------------------------------------
function inspectCleanNums(obj) {
  const out = {};
  Object.keys(obj || {}).forEach(k => {
    const v = obj[k];
    if (typeof v === 'number' && isFinite(v) && v !== 0) out[k] = Math.round(v * 100) / 100;
  });
  return out;
}

// forceShow — свой герой в своём окне виден всегда, даже если скрыт от других.
function buildHeroProfile(forceShow) {
  const p = state.player;
  if (p.hideProfile && !forceShow) return { v: HERO_PROFILE_VERSION, hidden: true };

  const eq = {};
  INSPECT_SLOTS.forEach(({ key }) => {
    const it = p.equipment[key];
    if (!it) return;
    eq[key] = {
      n: it.name,
      r: it.rarity || 'white',
      rl: it.refineLevel || 0,
      t: it.tier || 1,
      s: inspectCleanNums(it.stats),
      b: inspectCleanNums(it.bonusStats),
      rb: inspectCleanNums(it.refineBonuses),
    };
  });

  const ws = {};
  Object.keys(WEAPON_SKILLS).forEach(c => { const l = getWeaponSkillLevel(c); if (l > 0) ws[c] = l; });
  const el = {};
  Object.keys(ELEMENTS).forEach(e => { const l = getElementLevel(e); if (l > 0) el[e] = l; });
  const sk = {};
  Object.keys(p.learnedSkills || {}).forEach(id => { if (p.learnedSkills[id] > 0) sk[id] = p.learnedSkills[id]; });

  return {
    v: HERO_PROFILE_VERSION,
    eq,
    st: {
      hp: p.maxHp, mp: p.maxMp,
      pa: Math.floor(p.pAtk || 0), ma: Math.floor(p.mAtk || 0),
      pd: Math.floor(p.pDef || 0), md: Math.floor(p.mDef || 0),
      cr: p.critChance || 10, sp: Math.round((p.atbSpeed || 0) * 100) / 100,
      ac: typeof getPlayerAccuracy === 'function' ? getPlayerAccuracy() : 0,
      ev: typeof getPlayerEvasion === 'function' ? getPlayerEvasion() : 0,
      dr: p.flatDamageReduce || 0, bl: p.blockChance || 0,
    },
    sk, ws, el,
  };
}

// --------------------------------------------------------
//  КАТАЛОГ ПРЕДМЕТОВ ИГРЫ (название → иконка, тип, сет...)
// --------------------------------------------------------
let __inspectCatalog = null;

function getInspectCatalog() {
  if (__inspectCatalog) return __inspectCatalog;
  const map = new Map();
  const add = (src) => {
    if (!src || !src.name || map.has(src.name)) return;
    map.set(src.name, {
      name: src.name, type: src.type, icon: src.icon || null, iconKey: src.iconKey || null,
      setId: src.setId || null, twoHanded: !!src.twoHanded, sellPrice: src.sellPrice,
    });
  };
  Object.values(RECIPES).forEach(list => (list || []).forEach(r => add(r.result)));
  [...(typeof MONSTERS !== 'undefined' ? MONSTERS : []), ...(typeof MINE_MONSTERS !== 'undefined' ? MINE_MONSTERS : [])]
    .forEach(m => (m.drops || []).forEach(add));
  if (typeof STARTER_WEAPONS !== 'undefined') Object.values(STARTER_WEAPONS).forEach(add);
  __inspectCatalog = map;
  return map;
}

function inspectIconHtml(entry) {
  if (!entry) return '';
  if (entry.icon && entry.icon.startsWith('img/')) return normalizeIconHtml(entry.icon);
  if (entry.iconKey && typeof SVG !== 'undefined' && SVG[entry.iconKey]) return SVG[entry.iconKey];
  return '';
}

// --------------------------------------------------------
//  ПРОВЕРКА ЧУЖОГО СНИМКА
// --------------------------------------------------------
function inspectInt(v, min, max) {
  const n = Math.floor(Number(v));
  return isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
}
// Числа ограничены: чужой снимок не может показать «HP +1 000 000 000».
const INSPECT_NUM_MAX = 100000;
function inspectNum(v) {
  const n = Number(v);
  if (!isFinite(n)) return 0;
  return Math.round(Math.max(-INSPECT_NUM_MAX, Math.min(INSPECT_NUM_MAX, n)) * 100) / 100;
}
function inspectSafeStats(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  Object.keys(obj).slice(0, 30).forEach(k => {
    if (!/^[a-zA-Z]{1,30}$/.test(k)) return;
    const n = inspectNum(obj[k]);
    if (n) out[k] = n;
  });
  return out;
}

// Сырой предмет из снимка → безопасный предмет для подсказки (или null).
function inspectSafeItem(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.n !== 'string') return null;
  const entry = getInspectCatalog().get(raw.n);
  if (!entry) return null;
  return {
    name: entry.name,                        // из каталога, не из снимка
    type: entry.type,
    setId: entry.setId,
    twoHanded: entry.twoHanded,
    icon: inspectIconHtml(entry),
    rarity: hasOwnKey(RARITIES, raw.r) ? raw.r : 'white',
    refineLevel: inspectInt(raw.rl, 0, 30),
    tier: inspectInt(raw.t, 1, 5),
    stats: inspectSafeStats(raw.s),
    bonusStats: inspectSafeStats(raw.b),
    refineBonuses: inspectSafeStats(raw.rb),
  };
}

function inspectSafeProfile(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.hidden) return { hidden: true };
  const eq = {};
  INSPECT_SLOTS.forEach(({ key }) => {
    const it = inspectSafeItem(raw.eq && raw.eq[key]);
    if (it) eq[key] = it;
  });
  const st = {};
  ['hp', 'mp', 'pa', 'ma', 'pd', 'md', 'cr', 'sp', 'ac', 'ev', 'dr', 'bl'].forEach(k => { st[k] = inspectNum(raw.st && raw.st[k]); });
  const pick = (src, dict, max) => {
    const out = {};
    if (!src || typeof src !== 'object') return out;
    Object.keys(src).forEach(k => { if (hasOwnKey(dict, k)) out[k] = inspectInt(src[k], 0, max); });
    return out;
  };
  return {
    eq, st,
    sk: pick(raw.sk, SKILLS, 10),
    ws: pick(raw.ws, WEAPON_SKILLS, WEAPON_MAX_LEVEL),
    el: pick(raw.el, ELEMENTS, ELEMENT_MAX_LEVEL),
  };
}

// --------------------------------------------------------
//  ОКНО
// --------------------------------------------------------
let __inspectItems = {};   // слот → безопасный предмет (для подсказок)

async function openHeroInspect(row) {
  if (!row) return;
  const overlay = document.getElementById('inspect-overlay');
  if (!overlay) return;
  overlay.classList.add('active');
  renderInspectHeader(row);

  const body = document.getElementById('inspect-body');
  if (row.isBot) { body.innerHTML = inspectNote('🛡', 'Наёмник гильдии', 'Снаряжение скрыто.'); return; }

  // Свой герой — показываем живые данные, без облака.
  if (row.isMe) { renderInspectBody(inspectSafeProfile(buildHeroProfile(true))); return; }

  body.innerHTML = `<div class="inspect-loading">Загружаем героя…</div>`;
  let raw = null;
  try {
    const { data, error } = await supabaseClient
      .from('leaderboard').select('profile')
      .eq('user_id', row.user_id).eq('slot', row.slot).maybeSingle();
    if (error) throw error;
    raw = imgPathsToWebp(data && data.profile);   // v0.36.2: старые пути картинок → .webp
  } catch (e) {
    console.warn('[inspect]', e);
    body.innerHTML = inspectNote('⚠', 'Не удалось загрузить', 'Проверьте интернет и попробуйте ещё раз.');
    return;
  }
  if (!overlay.classList.contains('active')) return;
  const profile = inspectSafeProfile(raw);
  if (!profile) { body.innerHTML = inspectNote('⏳', 'Профиль ещё не обновлён', 'Герой не заходил в игру с новой версией.'); return; }
  renderInspectBody(profile);
}

function closeHeroInspect() {
  document.getElementById('inspect-overlay')?.classList.remove('active');
  if (typeof hideTooltip === 'function') hideTooltip();
}

function inspectNote(icon, title, text) {
  return `<div class="inspect-note"><div class="inspect-note-ico">${icon}</div><b>${title}</b><span>${text}</span></div>`;
}

function renderInspectHeader(row) {
  const head = document.getElementById('inspect-head');
  if (!head) return;
  const raceId = hasOwnKey(RACES, row.race_id) ? row.race_id : 'human';
  const classId = hasOwnKey(CLASSES, row.class_id) ? row.class_id : 'warrior';
  head.innerHTML = `
    <div class="inspect-portrait" style="background-image:url('${getRaceIcon(raceId, classId)}')"></div>
    <div class="inspect-title">
      <div class="inspect-name">${escapeHtml(row.character_name || 'Безымянный')}</div>
      <div class="inspect-sub">${RACES[raceId].name} · ${CLASSES[classId].name} · ур. ${inspectInt(row.level, 1, 999)}</div>
      <div class="inspect-sub dim">💀 ${formatNumber(row.kills || 0)} · 🪙 ${formatNumber(row.gold || 0)}</div>
    </div>`;
}

function renderInspectBody(profile) {
  const body = document.getElementById('inspect-body');
  if (!body) return;
  if (profile.hidden) { body.innerHTML = inspectNote('🔒', 'Снаряжение скрыто', 'Игрок решил не показывать свою сборку.'); return; }

  __inspectItems = profile.eq;

  // ---- Кукла ----
  const slots = INSPECT_SLOTS.map(({ key, label }) => {
    const it = profile.eq[key];
    if (!it) return `<div class="inspect-slot empty"><div class="inspect-slot-ico"></div><span>${label}</span></div>`;
    const color = (RARITIES[it.rarity] || RARITIES.white).color;
    return `<div class="inspect-slot filled" style="--rc:${color}" data-slot="${key}">
        <div class="inspect-slot-ico">${it.icon || '❔'}${it.refineLevel ? `<em>+${it.refineLevel}</em>` : ''}</div>
        <span>${label}</span>
      </div>`;
  }).join('');

  // ---- Сеты: считаем сами по надетым вещам ----
  const sets = [];
  const mini = getJewelryMiniSet(profile.eq);
  if (mini) sets.push(`Бижутерия тира ${mini.tier}+: ${mini.count} ${mini.count >= 5 ? 'вещей' : 'вещи'} — +${mini.bonus} маг. защиты`);
  Object.keys(SETS).forEach(id => {
    const set = SETS[id];
    const worn = Object.values(profile.eq).filter(it => set.pieces.includes(it.name)).length;
    const need = (id === 'novice' || id === 'malachite') ? 5 : set.pieces.length;   // 2 кольца + 2 серьги + ожерелье
    if (worn >= need) sets.push(`${set.name}: ${set.bonusText}`);
  });

  // ---- Характеристики ----
  const s = profile.st;
  const stat = (label, v) => `<div class="inspect-stat"><span>${label}</span><b>${v}</b></div>`;
  const stats = [
    stat('❤ HP', s.hp), stat('💧 MP', s.mp),
    stat('⚔ Атака', s.pa), stat('✦ Маг. атака', s.ma),
    stat('🛡 Защита', s.pd), stat('🔰 Маг. защита', s.md),
    stat('💥 Крит', s.cr + '%'), stat('⏱ Скорость', s.sp),
    stat('🎯 Точность', s.ac), stat('💨 Уворот', s.ev),
    stat('🧱 Поглощение', s.dr), stat('🛡 Блок', s.bl + '%'),
  ].join('');

  // ---- Навыки ----
  const skills = Object.keys(profile.sk).filter(id => profile.sk[id] > 0).map(id => {
    const sk = SKILLS[id];
    const ico = sk.iconPng ? `<img src="${sk.iconPng}" alt="">` : '✦';
    return `<div class="inspect-skill" title="${sk.name} — ур. ${profile.sk[id]}">${ico}<em>${profile.sk[id]}</em></div>`;
  }).join('');

  // ---- Владение ----
  const prof = (dict, levels) => Object.keys(levels).filter(k => levels[k] > 0)
    .sort((a, b) => levels[b] - levels[a])
    .map(k => `<div class="inspect-prof"><img src="${dict[k].icon}" alt=""><span>${dict[k].name}</span><b>${levels[k]}</b></div>`).join('');
  const profHtml = prof(WEAPON_SKILLS, profile.ws) + prof(ELEMENTS, profile.el);

  body.innerHTML = `
    <div class="inspect-doll">${slots}</div>
    ${sets.length ? `<div class="inspect-sets">${sets.map(t => `<div>🧩 ${t}</div>`).join('')}</div>` : ''}
    <div class="inspect-section">ХАРАКТЕРИСТИКИ</div>
    <div class="inspect-stats">${stats}</div>
    <div class="inspect-section">НАВЫКИ</div>
    <div class="inspect-skills">${skills || '<span class="dim">Нет изученных навыков</span>'}</div>
    <div class="inspect-section">ВЛАДЕНИЕ</div>
    <div class="inspect-profs">${profHtml || '<span class="dim">Пока нет</span>'}</div>`;

  // Подсказки к вещам: наведение (ПК) и нажатие (телефон).
  body.querySelectorAll('.inspect-slot.filled').forEach(el => {
    const it = __inspectItems[el.dataset.slot];
    el.onmouseenter = (e) => showItemTooltip(e, it);
    el.onmouseleave = () => hideTooltip();
    el.onclick = (e) => { e.stopPropagation(); showItemTooltip(e, it); };
  });
}

// --------------------------------------------------------
//  НАСТРОЙКА «ПОКАЗЫВАТЬ МОЁ СНАРЯЖЕНИЕ»
// --------------------------------------------------------
function renderProfilePrivacyButtons() {
  const cont = document.getElementById('profile-privacy-buttons');
  if (!cont) return;
  cont.innerHTML = '';
  const shown = !state.player.hideProfile;
  [[true, 'Показывать'], [false, 'Скрыть']].forEach(([value, label]) => {
    const btn = document.createElement('button');
    btn.className = 'settings-btn' + (value === shown ? ' active' : '');
    btn.textContent = label;
    btn.onclick = () => {
      state.player.hideProfile = !value;
      renderProfilePrivacyButtons();
      saveCurrentSlot();
      if (typeof cloudPushLeaderboard === 'function') cloudPushLeaderboard(true);
    };
    cont.appendChild(btn);
  });
}

// Клик по фону / Esc закрывают окно осмотра (раньше, чем рейтинг).
document.addEventListener('click', (e) => {
  const overlay = document.getElementById('inspect-overlay');
  if (overlay && overlay.classList.contains('active') && e.target === overlay) closeHeroInspect();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const overlay = document.getElementById('inspect-overlay');
  if (overlay && overlay.classList.contains('active')) { e.stopImmediatePropagation(); closeHeroInspect(); }
}, true);
