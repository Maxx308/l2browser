// ========================================================
//  СИСТЕМЫ: ЭКСПЕДИЦИИ (v0.33) — оффлайн-охота
//
//  + Замер темпа: за обычной охотой следим, сколько герой убивает в час
//    на каждом монстре × подтипе (state.player.huntPace, последние ~2 ч охоты).
//  + Окно экспедиции — с карточки локации на карте: кого бить (только знакомых),
//    на сколько (2 / 4 / 8 ч), прикидка добычи.
//  + Пока герой в пути — экран «В экспедиции» поверх игры: таймер,
//    «К выбору героя» и «Не ждать». Играть им нельзя.
//  + Время старта и конца — с сервера облака (время выдачи ключа входа),
//    переведённые часы устройства ничего не дают. Нет облака — часы устройства.
//  + Возвращение: опыт и Оболы — сразу, вещи и материалы — в «добычу экспедиции»
//    (state.player.expeditionLoot): забрать в сумку / на склад, что не влезло — ждёт.
//  + Зашёл раньше конца (или «Не ждать») — экспедиция закончилась сама по случайной
//    причине, без бонуса. Дождался — +15%.
//
//  Данные — js/data/expeditions.js.
// ========================================================

const EXP_STACKABLE = ['material', 'consumable', 'food'];
const EXP_RARITY_TYPES = ['weapon', 'shield', 'helmet', 'armorTop', 'armorBottom', 'gloves', 'boots', 'ring', 'earring', 'necklace'];

let __expDialog = null;    // { loc, key, hours }
let __expAwayTimer = null;
let __expResolving = false;
let __expLastReport = null;   // отчёт последнего возвращения (окно перерисовывается после «забрать»)
let __expReportLoc = null;    // с какой карточки открыли добычу (для «Новая экспедиция»)

// ---------- ВРЕМЯ ----------
// Время сервера облака: ключ входа (JWT) при обновлении сессии выдаётся с полем iat — «сейчас» по серверу.
async function expServerNow() {
  try {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return null;
    if (typeof cloudIsReady === 'function' && !cloudIsReady()) return null;
    const res = await Promise.race([
      supabaseClient.auth.refreshSession(),
      new Promise(r => setTimeout(() => r(null), 6000)),
    ]);
    const tok = res && res.data && res.data.session && res.data.session.access_token;
    if (!tok) return null;
    const b64 = tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64 + '='.repeat((4 - b64.length % 4) % 4)));
    return payload && payload.iat ? payload.iat * 1000 + 500 : null;
  } catch (e) {
    console.warn('[expeditions] время сервера недоступно', e);
    return null;
  }
}

function expDurationMs(exp) { return (exp.hours || 0) * 3600 * 1000; }

// Сколько прошло (мс). serverNow — если удалось узнать время сервера.
function expElapsedMs(exp, serverNow) {
  let ms;
  if (serverNow && exp.serverTime) ms = serverNow - exp.startedAt;
  else ms = Date.now() - (exp.startedLocal || exp.startedAt);
  return Math.max(0, Math.min(expDurationMs(exp), ms));
}

// Только для показа (таймеры, экран выбора героя) — по часам устройства.
function expLeftMsLocal(exp) {
  if (!exp) return 0;
  return Math.max(0, expDurationMs(exp) - (Date.now() - (exp.startedLocal || exp.startedAt)));
}

function expFormatLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = v => String(v).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function expFormatDuration(ms) {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  if (h && m) return `${h} ч ${m} мин`;
  if (h) return `${h} ч`;
  return `${m} мин`;
}

function expNum(n) { return Math.round(n || 0).toLocaleString('ru-RU'); }

// ---------- ЗАМЕР ТЕМПА ОХОТЫ ----------
const __expPace = { key: null, t: 0 };

function expPaceKey(id, variantId) { return id + '_' + (variantId || 'normal'); }

function expPaceStore() {
  const p = state.player;
  if (!p.huntPace || typeof p.huntPace !== 'object') p.huntPace = {};
  return p.huntPace;
}

// Кого сейчас бьём (цель охоты), null — охоты нет.
function expCurrentHuntKey() {
  const b = state.battle;
  const win = document.getElementById('battle-window');
  if (!win || !win.classList.contains('active')) return null;
  const t = b.lastTarget || b.packTemplate;
  return t && t.id ? expPaceKey(t.id, t.variantId) : null;
}

// Засчитать прошедшее время прошлой цели и запомнить текущую. Вызывается на тиках, убийствах, старте и конце боя.
function expPaceStamp() {
  const now = performance.now();
  if (__expPace.key && __expPace.t) {
    const dt = (now - __expPace.t) / 1000;
    if (dt > 0 && dt <= HUNT_PACE_MAX_GAP_SEC) {
      const e = expPaceStore()[__expPace.key] || (expPaceStore()[__expPace.key] = { k: 0, s: 0 });
      e.s += dt;
      if (e.s > HUNT_PACE_WINDOW_SEC) { const f = HUNT_PACE_WINDOW_SEC / e.s; e.s *= f; e.k *= f; }
    }
  }
  __expPace.key = expCurrentHuntKey();
  __expPace.t = now;
}

function expPaceKill(m) {
  if (!m || !state.player.classId) return;
  expPaceStamp();
  const key = expPaceKey(m.templateId || m.id, m.variantId);
  const e = expPaceStore()[key] || (expPaceStore()[key] = { k: 0, s: 0 });
  e.k += 1;
}

// Темп на монстре: { kph, k, s } или null, если замера мало.
function expGetPace(id, variantId) {
  const e = (state.player.huntPace || {})[expPaceKey(id, variantId)];
  if (!e || e.s < EXPEDITION_MIN_PACE_SEC || e.k < EXPEDITION_MIN_PACE_KILLS) return { ok: false, k: e ? e.k : 0, s: e ? e.s : 0 };
  return { ok: true, kph: e.k / e.s * 3600, k: e.k, s: e.s };
}

// ---------- КОГО МОЖНО БИТЬ В ЭКСПЕДИЦИИ ----------
function expHuntOptions(loc) {
  const list = [];
  getMonstersByLocation(loc).forEach(t => {
    ALL_VARIANTS.forEach(v => {
      const kills = getMonsterKills(t.id, v);
      const pace = expGetPace(t.id, v);
      let reason = '';
      if (kills < EXPEDITION_MIN_KILLS) reason = `нужно ${EXPEDITION_MIN_KILLS} убийств (сейчас ${kills})`;
      else if (!pace.ok) reason = 'поохотьтесь на них хотя бы 5 минут — так прикинем темп';
      const inst = buildMonsterInstance(t, v);
      list.push({ key: expPaceKey(t.id, v), template: t, variantId: v, name: inst.name, level: inst.level, kills, pace, ok: !reason, reason });
    });
  });
  return list;
}

// Средняя прикидка добычи (без бросков).
function expEstimate(template, variantId, kph, hours) {
  const p = state.player;
  const inst = buildMonsterInstance(template, variantId);
  const kills = kph * EXPEDITION_RATE * hours;
  const xpBonus = (p.xpBonus || 0) + (p.xpBonusFromRefine || 0);
  const xp = kills * inst.xpReward * XP_MONSTER_MULTIPLIER * mult() * (1 + xpBonus / 100);
  const titleMult = getTitleDropMultiplier(template.id, variantId);
  const goldAvg = (inst.goldMin + inst.goldMax) / 2 * (1 + (p.goldBonusFromRefine || 0) / 100) * mult();
  const gold = kills * Math.min(100, inst.goldChance * mult() * titleMult) / 100 * goldAvg;
  return { kills, xp, gold };
}

// ---------- ДОБЫЧА: БРОСКИ ПО НАСТОЯЩЕЙ ТАБЛИЦЕ ----------
function expMakeItem(drop, qty) {
  let stats = null;
  if (drop.stats) {
    stats = {};
    for (const k of ['pAtk','pDef','mDef','mAtk','flatDamageReduce','blockChance','mpBonus','hpBonus','atbSpeedMod','critChance','mpRegenIn']) {
      if (drop.stats[k] !== undefined) stats[k] = drop.stats[k];
    }
  }
  const item = {
    id: 'item_' + Date.now() + '_' + Math.random(),
    name: drop.name, type: drop.type, icon: normalizeIconHtml(drop.icon), qty: qty || 1,
    stats, sellPrice: drop.sellPrice || 1,
    setId: drop.setId || null, twoHanded: drop.twoHanded || false,
    tier: drop.tier || null, refineLevel: 0, refineBonuses: null,
  };
  if (drop.rarity) item.rarity = drop.rarity;
  if (drop.bonusStats) item.bonusStats = drop.bonusStats;
  return item;
}

function expPoolAdd(pool, drop, qty) {
  if (EXP_STACKABLE.includes(drop.type)) {
    const e = pool.find(x => x.drop.name === drop.name && EXP_STACKABLE.includes(x.drop.type));
    if (e) { e.qty += qty; return; }
  }
  pool.push({ drop, qty });
}

function expPoolCount(pool) { return (pool || []).reduce((s, e) => s + (e.qty || 0), 0); }

// Бросить добычу за kills убийств. Возвращает { xp, gold, items: [{drop, qty}] }.
function expRollHunt(template, variantId, kills) {
  const p = state.player;
  const inst = buildMonsterInstance(template, variantId);
  const m = mult();
  const titleMult = getTitleDropMultiplier(template.id, variantId);
  const dropMult = 1 + (titleMult - 1) + (p.dropBonusFromRefine || 0) / 100;
  const goldMult = m * (1 + (p.goldBonusFromRefine || 0) / 100);
  const xpBonus = (p.xpBonus || 0) + (p.xpBonusFromRefine || 0);
  const xpRaw = kills * inst.xpReward * XP_MONSTER_MULTIPLIER * m * (1 + xpBonus / 100);
  const isMine = MINE_MONSTERS.includes(template);

  let gold = 0;
  const items = [];
  const cap = (p.stackCap !== undefined) ? p.stackCap : 3;
  const filter = p.lootFilterLevel || 0;
  const copies = name => countItemCopies(name) + items.filter(e => e.drop.name === name).reduce((s, e) => s + e.qty, 0)
    + (p.expeditionLoot || []).filter(e => e.drop.name === name).reduce((s, e) => s + e.qty, 0);

  for (let k = 0; k < kills; k++) {
    const piles = rollDropCount(inst.goldChance * m * titleMult);
    for (let i = 0; i < piles; i++) {
      const base = inst.goldMin + Math.floor(Math.random() * (inst.goldMax - inst.goldMin + 1));
      const raw = base * goldMult;
      let g = Math.floor(raw) + (Math.random() < raw % 1 ? 1 : 0);
      if (isMine) g = Math.max(10, Math.round(g / 10) * 10);
      gold += g;
    }
    inst.drops.forEach(d => {
      const n = rollDropCount(d.chance * m * dropMult);
      for (let i = 0; i < n; i++) {
        if (EXP_RARITY_TYPES.includes(d.type)) {
          if (cap > 0 && copies(d.name) >= cap) continue;
          const rarityId = rollRarity();
          if (!passesFilter(rarityId, filter)) continue;
          const bonusStats = rollRarityStats(RARITIES[rarityId].statPoints, getRarityStatProfile(d));
          items.push({ drop: { ...d, rarity: rarityId, bonusStats }, qty: 1 });
        } else {
          expPoolAdd(items, { ...d }, 1);
        }
      }
    });
  }
  return { xp: Math.floor(xpRaw), gold, items };
}

// ---------- ОКНО ЗАПУСКА (с карточки локации) ----------
function expIsAway() { return !!(state.player && state.player.expedition); }

function openExpeditionDialog(loc) {
  if (!state.player.classId) return;
  if (expIsAway()) { expShowAway(); return; }
  if ((state.player.expeditionLoot || []).length) { __expReportLoc = loc; expShowReport(null); return; }
  const opts = expHuntOptions(loc);
  const firstOk = opts.find(o => o.ok);
  const prev = __expDialog && __expDialog.loc === loc ? __expDialog : null;
  __expDialog = {
    loc,
    key: (prev && opts.some(o => o.ok && o.key === prev.key)) ? prev.key : (firstOk ? firstOk.key : null),
    hours: prev ? prev.hours : 4,
  };
  expRenderDialog();
}

function closeExpeditionDialog() {
  const el = document.getElementById('exp-overlay');
  if (el) el.remove();
}

function expOverlay(html, cls) {
  let el = document.getElementById('exp-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'exp-overlay';
    document.body.appendChild(el);
  }
  el.className = 'exp-overlay ' + (cls || '');
  el.innerHTML = `<div class="exp-window">${html}</div>`;
  return el;
}

function expRenderDialog() {
  const d = __expDialog;
  if (!d) return;
  const opts = expHuntOptions(d.loc);
  const place = LOCATION_NAMES[d.loc] || d.loc;
  const sel = opts.find(o => o.key === d.key && o.ok) || null;

  const rows = opts.slice().sort((a, b) => (b.ok - a.ok)).map(o => {
    const kph = o.pace.ok ? Math.round(o.pace.kph) : 0;
    const info = o.ok
      ? `<span class="exp-mon-pace">ваш темп ~${expNum(kph)}/ч → в экспедиции ~${expNum(kph * EXPEDITION_RATE)}/ч</span>`
      : `<span class="exp-mon-why">🔒 ${o.reason}</span>`;
    return `<button type="button" class="exp-mon variant-${o.variantId}${o.ok ? '' : ' locked'}${sel && sel.key === o.key ? ' on' : ''}" data-key="${o.key}"${o.ok ? '' : ' disabled'}>
      <span class="exp-mon-pic" style="background-image:url('${o.template.art}')"></span>
      <span class="exp-mon-body"><span class="exp-mon-name">${o.name} <small>ур. ${o.level}</small></span>${info}</span>
    </button>`;
  }).join('');

  const hours = EXPEDITION_HOURS.map(h => `<button type="button" class="exp-hours${d.hours === h ? ' on' : ''}" data-h="${h}">${h} ч</button>`).join('');

  let est = '<div class="exp-est exp-est-empty">Выберите, на кого охотиться.</div>';
  if (sel) {
    const e = expEstimate(sel.template, sel.variantId, sel.pace.kph, d.hours);
    est = `<div class="exp-est">
      <div>Примерно: <b>${expNum(e.kills)}</b> убийств · <b>+${expNum(e.xp)}</b> опыта · <b>~${expNum(e.gold)}</b> Оболов, плюс дроп</div>
      <div class="exp-est-bonus">Дождётесь конца — ещё +${Math.round(EXPEDITION_FULL_BONUS * 100)}% ко всему</div>
    </div>`;
  }

  expOverlay(`
    <div class="exp-head"><span>⛺ Экспедиция: ${place}</span><button type="button" class="exp-x" onclick="closeExpeditionDialog()" aria-label="Закрыть">×</button></div>
    <div class="exp-note">Герой уйдёт охотиться сам — вдвое медленнее, чем с вами. Пока он в пути, им нельзя играть. Без душ самоцветов.</div>
    <div class="exp-sub">На кого</div>
    <div class="exp-mons">${rows}</div>
    <div class="exp-sub">На сколько</div>
    <div class="exp-hours-row">${hours}</div>
    ${est}
    <div class="exp-actions"><button type="button" class="exp-btn exp-btn-main"${sel ? '' : ' disabled'} onclick="expStartHunt()">Отправиться</button></div>
  `);

  document.querySelectorAll('#exp-overlay .exp-mon:not(.locked)').forEach(b => {
    b.onclick = () => { __expDialog.key = b.dataset.key; expRenderDialog(); };
  });
  document.querySelectorAll('#exp-overlay .exp-hours').forEach(b => {
    b.onclick = () => { __expDialog.hours = +b.dataset.h; expRenderDialog(); };
  });
}

async function expStartHunt() {
  const d = __expDialog;
  if (!d || expIsAway()) return;
  const o = expHuntOptions(d.loc).find(x => x.key === d.key && x.ok);
  if (!o) return;
  if (state.travel.active) { showToast('⛺', 'Сначала дойдите до места'); return; }

  const btn = document.querySelector('#exp-overlay .exp-btn-main');
  if (btn) { btn.disabled = true; btn.textContent = 'Собираемся…'; }

  // Охота, если шла, заканчивается — герой уходит.
  const b = state.battle;
  if (b.active || b.repeatBattle || b.waitingForResume) closeBattle();

  const srv = await expServerNow();
  state.player.expedition = {
    type: 'hunt',
    loc: d.loc,
    monsterId: o.template.id,
    variantId: o.variantId,
    name: o.name,
    kph: o.pace.kph,
    hours: d.hours,
    startedAt: srv || Date.now(),
    startedLocal: Date.now(),
    serverTime: !!srv,
  };
  logCombat(`⛺ ${state.player.name} уходит в экспедицию: ${LOCATION_NAMES[d.loc] || d.loc}, ${o.name}, ${d.hours} ч.`, 'log-entry levelup');
  saveCurrentSlot();
  expShowAway();
}

// ---------- ГЕРОЙ В ПУТИ ----------
function expShowAway() {
  const exp = state.player.expedition;
  if (!exp) return;
  const place = LOCATION_NAMES[exp.loc] || exp.loc;
  const tpl = [...MONSTERS, ...MINE_MONSTERS].find(t => t.id === exp.monsterId);
  expOverlay(`
    <div class="exp-head"><span>⛺ ${state.player.name} в экспедиции</span></div>
    <div class="exp-away-pic" style="background-image:url('${tpl ? tpl.art : ''}')"></div>
    <div class="exp-away-where">${place} · ${exp.name} · ${exp.hours} ч</div>
    <div class="exp-away-left" id="exp-away-left"></div>
    <div class="exp-away-bar"><div class="exp-away-fill" id="exp-away-fill"></div></div>
    <div class="exp-note">Дождётесь конца — +${Math.round(EXPEDITION_FULL_BONUS * 100)}% ко всей добыче. Можно поиграть другим героем, пока этот в пути.</div>
    <div class="exp-actions">
      <button type="button" class="exp-btn" onclick="expToCharacterSelect()">К выбору героя</button>
      <button type="button" class="exp-btn" onclick="expResolve(true)">Не ждать</button>
    </div>
  `, 'exp-away');
  expTickAway();
  clearInterval(__expAwayTimer);
  __expAwayTimer = setInterval(expTickAway, 1000);
}

function expTickAway() {
  const exp = state.player.expedition;
  if (!exp) { clearInterval(__expAwayTimer); __expAwayTimer = null; return; }
  const left = expLeftMsLocal(exp);
  const el = document.getElementById('exp-away-left');
  const fill = document.getElementById('exp-away-fill');
  if (el) el.textContent = left > 0 ? `Вернётся через ${expFormatLeft(left)}` : 'Возвращается…';
  if (fill) fill.style.width = (100 - left / expDurationMs(exp) * 100).toFixed(2) + '%';
  if (left <= 0) { clearInterval(__expAwayTimer); __expAwayTimer = null; expResolve(false); }
}

function expToCharacterSelect() {
  saveCurrentSlot();
  try { sessionStorage.removeItem(RESUME_SESSION_KEY); } catch (e) {}
  location.reload();
}

// ---------- ВОЗВРАЩЕНИЕ ----------
function expPickReason() {
  const night = typeof worldTime === 'function' && worldTime(true).phase.id === 'night';
  const met = typeof bagMet === 'function' && bagMet();
  const list = EXPEDITION_EARLY_REASONS.filter(r => (!r.night || night) && (!r.bag || met));
  const r = list[Math.floor(Math.random() * list.length)];
  return r ? heroText(r.text) : '';
}

function expPickBagLine(rep) {
  if (typeof bagMet !== 'function' || !bagMet()) return '';
  let pool = EXPEDITION_BAG_LINES.full;
  if (rep.kills < 40) pool = EXPEDITION_BAG_LINES.small;
  else if (!rep.full) pool = EXPEDITION_BAG_LINES.early;
  else if (rep.kills >= 500 && Math.random() < 0.5) pool = EXPEDITION_BAG_LINES.big;
  const line = pool[Math.floor(Math.random() * pool.length)] || '';
  return heroText(line.replace('%kills%', expNum(rep.kills)));
}

// early = true — «Не ждать» (или вошли раньше). Финал — по времени сервера.
async function expResolve(early) {
  const p = state.player;
  const exp = p.expedition;
  if (!exp || __expResolving) return;
  __expResolving = true;
  try {
    clearInterval(__expAwayTimer); __expAwayTimer = null;
    const srv = await expServerNow();
    const elapsed = expElapsedMs(exp, srv);
    const full = elapsed >= expDurationMs(exp) - 1000;
    const template = [...MONSTERS, ...MINE_MONSTERS].find(t => t.id === exp.monsterId);

    let killsRaw = (exp.kph || 0) * EXPEDITION_RATE * (elapsed / 3600000) * (full ? 1 + EXPEDITION_FULL_BONUS : 1);
    let kills = Math.floor(killsRaw) + (Math.random() < killsRaw % 1 ? 1 : 0);
    if (!template) kills = 0;

    const levelBefore = p.level;
    const loot = template && kills > 0 ? expRollHunt(template, exp.variantId, kills) : { xp: 0, gold: 0, items: [] };

    p.expedition = null;
    p.currentLocation = 'town';
    p.xp += loot.xp;
    p.gold += loot.gold;
    if (template) { const key = killKey(template.id, exp.variantId); p.monsterKills[key] = (p.monsterKills[key] || 0) + kills; }
    if (!Array.isArray(p.expeditionLoot)) p.expeditionLoot = [];
    loot.items.forEach(e => expPoolAdd(p.expeditionLoot, e.drop, e.qty));
    checkLevelUp();

    const rep = {
      loc: exp.loc, name: exp.name, hours: exp.hours, elapsed, full,
      kills, xp: loot.xp, gold: loot.gold, levels: p.level - levelBefore,
      reason: full ? '' : expPickReason(),
    };
    rep.bagLine = expPickBagLine(rep);
    if (typeof annalsFirst === 'function') annalsFirst('expedition.hunt');

    logCombat(`⛺ Экспедиция окончена: ${exp.name} ×${expNum(kills)}, +${expNum(loot.xp)} опыта, +${expNum(loot.gold)} Оболов${full ? ` (+${Math.round(EXPEDITION_FULL_BONUS * 100)}% за полную)` : ''}.`, 'log-entry levelup');
    updateTopStatus();
    updateCharacterPanel();
    updateMapUI();
    saveCurrentSlot();
    expShowReport(rep);
  } finally {
    __expResolving = false;
  }
}

// ---------- ОКНО ВОЗВРАЩЕНИЯ / ДОБЫЧА ЭКСПЕДИЦИИ ----------
// rep = null — просто показать, что лежит в добыче (зашли с карты).
function expShowReport(rep) {
  const p = state.player;
  const pool = p.expeditionLoot || [];
  const place = rep ? (LOCATION_NAMES[rep.loc] || rep.loc) : '';

  let head = '⛺ Добыча экспедиции';
  let body = '';
  if (rep) {
    head = rep.full ? '⛺ Экспедиция завершена' : '⛺ Экспедиция закончилась раньше';
    body += `<div class="exp-rep-where">${place} · ${rep.name} · ${expFormatDuration(rep.elapsed)}${rep.full ? '' : ` из ${rep.hours} ч`}</div>`;
    if (rep.reason) body += `<div class="exp-rep-reason">${rep.reason}</div>`;
    if (rep.bagLine) {
      body += `<div class="exp-rep-bag"><div class="exp-rep-bag-ico">🎒</div><div><div class="exp-rep-bag-name">${typeof bagSpeakerName === 'function' ? bagSpeakerName() : 'Заплечник'}</div><div class="exp-rep-bag-line">«${rep.bagLine}»</div></div></div>`;
    }
    body += `<div class="exp-rep-stats">
      <div><i>Убито</i><b>${expNum(rep.kills)}</b></div>
      <div><i>Опыт</i><b>+${expNum(rep.xp)}</b></div>
      <div><i>Оболы</i><b>+${expNum(rep.gold)}</b></div>
    </div>`;
    if (rep.full) body += `<div class="exp-rep-bonus">+${Math.round(EXPEDITION_FULL_BONUS * 100)}% за полную экспедицию</div>`;
    if (rep.levels > 0) body += `<div class="exp-rep-bonus">✦ Новый уровень: ${p.level}!</div>`;
  }

  const order = (typeof RARITY_ORDER !== 'undefined') ? RARITY_ORDER : [];
  const chips = pool.slice().sort((a, b) => (order.indexOf(b.drop.rarity) - order.indexOf(a.drop.rarity)) || (b.qty - a.qty)).map(e => {
    const r = e.drop.rarity && RARITIES[e.drop.rarity];
    const col = r && r.id !== 'white' ? ` style="--c:${r.color}"` : '';
    return `<span class="exp-chip${col ? ' rare' : ''}"${col}>${normalizeIconHtml(e.drop.icon) ? `<span class="exp-chip-ico">${normalizeIconHtml(e.drop.icon)}</span>` : ''}${e.drop.name}${e.qty > 1 ? ` ×${expNum(e.qty)}` : ''}</span>`;
  }).join('');

  const used = p.inventory.length;
  const room = INVENTORY_MAX_SLOTS - used;
  body += `<div class="exp-sub">Добыча${pool.length ? '' : ' — пусто'}</div>`;
  if (pool.length) {
    body += `<div class="exp-chips">${chips}</div>`;
    body += `<div class="exp-rep-room${room <= 0 ? ' warn' : ''}">В сумке ${used}/${INVENTORY_MAX_SLOTS} — что не влезет, подождёт здесь (кнопка ⛺ на карте).</div>`;
  } else if (rep) {
    body += `<div class="exp-note">Вещей и материалов не выпало.</div>`;
  }

  const againLoc = rep ? rep.loc : __expReportLoc;
  const again = againLoc ? `<button type="button" class="exp-btn" onclick="expAgain('${againLoc}')">${rep ? 'Снова в путь' : 'Новая экспедиция'}</button>` : '';
  expOverlay(`
    <div class="exp-head"><span>${head}</span><button type="button" class="exp-x" onclick="expCloseReport()" aria-label="Закрыть">×</button></div>
    ${body}
    <div class="exp-actions">
      ${pool.length ? `<button type="button" class="exp-btn exp-btn-main" onclick="expTakeToBag()">Забрать в сумку</button>
      <button type="button" class="exp-btn" onclick="expTakeToStorage()">На склад</button>` : ''}
      ${again}
      ${pool.length ? '' : '<button type="button" class="exp-btn" onclick="expCloseReport()">Закрыть</button>'}
    </div>
  `, 'exp-report');
  __expLastReport = rep;
}

function expCloseReport() {
  closeExpeditionDialog();
  const n = expPoolCount(state.player.expeditionLoot);
  if (n > 0) showToast('⛺', 'Добыча экспедиции ждёт — кнопка ⛺ на карте');
  updateMapUI();
  if (typeof updateHuntView === 'function') updateHuntView();
}

function expAgain(loc) {
  closeExpeditionDialog();
  if ((state.player.expeditionLoot || []).length) {
    // забрать что влезет, остальное подождёт — и в путь
    expTakeToBag(true);
  }
  __expDialog = __expDialog && __expDialog.loc === loc ? __expDialog : null;
  openExpeditionDialogForce(loc);
}

function openExpeditionDialogForce(loc) {
  const opts = expHuntOptions(loc);
  const firstOk = opts.find(o => o.ok);
  const prev = __expDialog;
  __expDialog = {
    loc,
    key: (prev && opts.some(o => o.ok && o.key === prev.key)) ? prev.key : (firstOk ? firstOk.key : null),
    hours: prev ? prev.hours : 4,
  };
  expRenderDialog();
}

// Забрать в сумку: материалы — в свои стопки, вещи — в свободные ячейки. Что не влезло — остаётся.
function expTakeToBag(silent) {
  const p = state.player;
  const pool = p.expeditionLoot || [];
  let moved = 0;
  for (let i = pool.length - 1; i >= 0; i--) {
    const e = pool[i];
    if (EXP_STACKABLE.includes(e.drop.type)) {
      const ex = p.inventory.find(it => it.name === e.drop.name && EXP_STACKABLE.includes(it.type) && !it.soulGem);
      if (ex) { ex.qty = (ex.qty || 1) + e.qty; moved += e.qty; pool.splice(i, 1); continue; }
      if (p.inventory.length < INVENTORY_MAX_SLOTS) { p.inventory.push(expMakeItem(e.drop, e.qty)); moved += e.qty; pool.splice(i, 1); }
    } else {
      while (e.qty > 0 && p.inventory.length < INVENTORY_MAX_SLOTS) { p.inventory.push(expMakeItem(e.drop, 1)); e.qty--; moved++; }
      if (e.qty <= 0) pool.splice(i, 1);
    }
  }
  renderInventory();
  updateInventoryFooter();
  saveCurrentSlot();
  if (!silent) {
    const left = expPoolCount(pool);
    showToast('🎒', left ? `В сумку: ${moved}, не влезло: ${left}` : `В сумку: ${moved}`);
    if (pool.length) expShowReport(__expLastReport); else expCloseReport();
  }
}

// На склад: по правилам склада (стопки до лимита, 30 ячеек). Что не влезло — остаётся.
function expTakeToStorage() {
  const p = state.player;
  const pool = p.expeditionLoot || [];
  const arr = loadStorage();
  let moved = 0;
  for (let i = pool.length - 1; i >= 0; i--) {
    const e = pool[i];
    if (EXP_STACKABLE.includes(e.drop.type)) {
      const sample = expMakeItem(e.drop, 1);
      const key = getStorageGroupKey(sample);
      arr.forEach(s => {
        if (e.qty <= 0 || getStorageGroupKey(s) !== key) return;
        const add = Math.min(storageStackMax(s) - (s.qty || 1), e.qty);
        if (add > 0) { s.qty = (s.qty || 1) + add; e.qty -= add; moved += add; }
      });
      while (e.qty > 0 && arr.length < STORAGE_MAX_SLOTS) {
        const add = Math.min(storageStackMax(sample), e.qty);
        arr.push(expMakeItem(e.drop, add)); e.qty -= add; moved += add;
      }
    } else {
      while (e.qty > 0 && arr.length < STORAGE_MAX_SLOTS) { arr.push(expMakeItem(e.drop, 1)); e.qty--; moved++; }
    }
    if (e.qty <= 0) pool.splice(i, 1);
  }
  saveStorage(arr);
  if (typeof updateStorageCounters === 'function') updateStorageCounters();
  saveCurrentSlot();
  const left = expPoolCount(pool);
  showToast('🏦', left ? `На склад: ${moved}, не влезло: ${left}` : `На склад: ${moved}`);
  if (pool.length) expShowReport(__expLastReport); else expCloseReport();
}

// ---------- КНОПКА НА КАРТОЧКЕ ЛОКАЦИИ ----------
function expRenderMapButtons() {
  ['field', 'mine'].forEach(loc => {
    const card = document.querySelector(`.map-card[data-loc="${loc}"]`);
    if (!card) return;
    let box = card.querySelector('.map-exp');
    if (!box) {
      box = document.createElement('div');
      box.className = 'map-exp';
      card.appendChild(box);
    }
    if (!state.player.classId) { box.innerHTML = ''; return; }
    const exp = state.player.expedition;
    const poolN = expPoolCount(state.player.expeditionLoot);
    let label = '⛺ Экспедиция';
    if (exp && exp.loc === loc) label = `⛺ В пути · ${expFormatLeft(expLeftMsLocal(exp))}`;
    else if (poolN > 0) label = `⛺ Добыча экспедиции · ${expNum(poolN)}`;
    box.innerHTML = `<button type="button" class="map-travel-btn map-exp-btn" onclick="event.stopPropagation(); openExpeditionDialog('${loc}')">${label}</button>`;
  });
}

// ---------- ЭКРАН ВЫБОРА ГЕРОЯ ----------
// Подпись на карточке героя: в экспедиции / вернулся / ждёт добыча.
function expSlotBadgeHtml(player) {
  if (!player) return '';
  const exp = player.expedition;
  if (exp) {
    const left = expLeftMsLocal(exp);
    const place = LOCATION_NAMES[exp.loc] || exp.loc;
    if (left > 0) {
      return `<div class="slot-exp" title="Зайдёте раньше — герой вернётся раньше, без бонуса">⛺ В экспедиции · ${place} · осталось ${expFormatLeft(left)}<small>+${Math.round(EXPEDITION_FULL_BONUS * 100)}%, если дождаться</small></div>`;
    }
    return `<div class="slot-exp done">⛺ Экспедиция окончена — заходите за добычей</div>`;
  }
  if ((player.expeditionLoot || []).length) return `<div class="slot-exp done">⛺ Ждёт добыча экспедиции</div>`;
  return '';
}

// Обновление страницы (телефон свернул вкладку): героя в пути НЕ вводим в игру автоматически —
// иначе экспедиция оборвалась бы сама. Остаётся экран выбора героя.
function expBlocksAutoResume(savedPlayer) {
  const exp = savedPlayer && savedPlayer.expedition;
  return !!(exp && expLeftMsLocal(exp) > 0);
}

// Из loadSlotAndStart — после initGame.
function expOnEnterGame() {
  const p = state.player;
  if (p.expedition) {
    // Зашли героем в пути — он уже вернулся (раньше — по случайной причине, или как раз к концу).
    setTimeout(() => expResolve(true), 600);
    return;
  }
  if (expPoolCount(p.expeditionLoot) > 0) setTimeout(() => showToast('⛺', 'Добыча экспедиции ждёт — кнопка ⛺ на карте'), 2200);
}

// ---------- ЗАМЕР ТЕМПА: ПОДКЛЮЧЕНИЕ К БОЮ ----------
(function expInstall() {
  const origStart = startBattle;
  startBattle = function () { const r = origStart.apply(this, arguments); expPaceStamp(); return r; };

  const origDeath = onMonsterDeath;
  onMonsterDeath = function (deadMonster) {
    const m = deadMonster || (typeof getCurrentMonster === 'function' ? getCurrentMonster() : null);
    const fresh = m && !m._deathProcessed;
    const r = origDeath.apply(this, arguments);
    if (fresh && m._deathProcessed) expPaceKill(m);
    return r;
  };

  const origClose = closeBattle;
  closeBattle = function () { expPaceStamp(); const r = origClose.apply(this, arguments); __expPace.key = null; return r; };

  // Таймер: и замер (если охота идёт), и кнопка на карте с отсчётом,
  // и подпись «осталось …» на экране выбора героя (раз в полминуты).
  let slotTick = 0;
  setInterval(() => {
    if (__expPace.key || expCurrentHuntKey()) expPaceStamp();
    const mapPanel = document.getElementById('panel-map');
    if (mapPanel && mapPanel.classList.contains('active') && state.player.expedition) expRenderMapButtons();
    const start = document.getElementById('start-screen');
    if (++slotTick % 6 === 0 && start && start.classList.contains('active') && document.querySelector('.slot-exp') && typeof renderSlots === 'function') renderSlots();
  }, 5000);
})();
