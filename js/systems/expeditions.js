// ========================================================
//  СИСТЕМЫ: ЭКСПЕДИЦИИ (v0.33) — оффлайн-охота
//
//  + Замер темпа автоохоты по монстрам, подтипам и действующим усилениям.
//  + Окно экспедиции — с карточки локации на карте: кого бить (только знакомых),
//    на сколько (2 / 4 / 8 ч), прикидка добычи.
//  + Пока герой в пути — экран «В экспедиции» поверх игры: таймер,
//    «К выбору героя» и «Не ждать». Играть им нельзя.
//  + Время старта и конца — с сервера облака (время выдачи ключа входа),
//    переведённые часы устройства ничего не дают. Нет облака — часы устройства.
//  + Возвращение: опыт и Оболы — сразу, вещи и материалы — в «добычу экспедиции»
//    (state.player.expeditionLoot): забрать в сумку / на склад, что не влезло — ждёт.
//  + Полная награда соответствует половине темпа автоохоты. Досрочный возврат даёт меньше.
//    Убийства в экспедиции записываются отдельно от боевых.
//  + v0.36.4: уйти можно только из города. Сборы: замер копит и расход зелий/микстур
//    Окно само считает, сколько взять, и докупает у Торговца.
//    Взятое уходит из сумки, остаток возвращается; кончилось — герой вернулся раньше.
//    Таймеры бафов, сытости и блюда списываются за время в пути.
//
//  Данные — js/data/expeditions.js.
// ========================================================

const EXP_STACKABLE = ['material', 'consumable', 'food'];
const EXP_RARITY_TYPES = ['weapon', 'shield', 'helmet', 'armorTop', 'armorBottom', 'gloves', 'boots', 'ring', 'earring', 'necklace'];

let __expDialog = null;    // { loc, key, hours }
let __expStarting = false;
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
function expReturnMs(exp) { return exp.returnMs ?? expDurationMs(exp); }

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
  return Math.max(0, expReturnMs(exp) - (Date.now() - (exp.startedLocal || exp.startedAt)));
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
const __expPace = { key: null, effects: '', store: null, t: 0 };
const EXP_PACE_VER = 3;
const EXP_PACE_PROFILES_LIMIT = 8;
const EXP_HOUR_MS = 3600000;

function expPaceKey(id, variantId) { return id + '_' + (variantId || 'normal'); }

function expPaceStore() {
  const p = state.player;
  if (!p.huntPace || typeof p.huntPace !== 'object') p.huntPace = {};
  return p.huntPace;
}

function expHuntEffects() {
  const p = state.player;
  const effects = {};
  Object.entries(p.guildBuffs || {}).forEach(([id, buff]) => {
    const def = GUILD_BUFFS[id];
    if (def && buff?.timer > 0 && (!def.mageOnly || p.classId === 'mage')) effects['guild:' + id] = buff.timer;
  });
  if (p.foodTimer > 0) effects['food:' + (p.foodKind || 'cookedMeat')] = p.foodTimer;
  if (p.dish?.timer > 0) effects['dish:' + p.dish.id] = p.dish.timer;
  return effects;
}

function expPaceEntry(key, effects) {
  const st = expPaceStore();
  if (st[key]?.v !== EXP_PACE_VER || !st[key].profiles) st[key] = { v: EXP_PACE_VER, profiles: {} };
  const profiles = st[key].profiles;
  let e = profiles[effects];
  if (!e) {
    const others = Object.keys(profiles).filter(Boolean);
    if (effects && others.length >= EXP_PACE_PROFILES_LIMIT) {
      const oldest = others.reduce((a, b) => profiles[a].last <= profiles[b].last ? a : b);
      delete profiles[oldest];
    }
    e = profiles[effects] = { k: 0, s: 0, use: {}, last: Date.now() };
  }
  e.last = Date.now();
  return e;
}

function expRecordUse(shopId, n) {
  const key = expCurrentHuntKey();
  if (!key || !shopId || !(n > 0) || !state.player.classId) return;
  const e = expPaceEntry(key, Object.keys(expHuntEffects()).sort().join('|'));
  e.use[shopId] = (e.use[shopId] || 0) + n;
}

// Кого сейчас бьём (цель охоты), null — охоты нет.
function expCurrentHuntKey() {
  const b = state.battle;
  if (!b.autoBattle || b.breakthrough || state.player.expedition) return null;
  if (!b.active && !b.repeatBattle && !b.waitingForResume) return null;
  const win = document.getElementById('battle-window');
  if (!win || !win.classList.contains('active')) return null;
  const t = b.lastTarget || b.packTemplate;
  return t && t.id ? expPaceKey(t.id, t.variantId) : null;
}

// Засчитать прошедшее время прошлой цели и запомнить текущую. Вызывается на тиках, убийствах, старте и конце боя.
function expPaceStamp() {
  const now = performance.now();
  const key = expCurrentHuntKey();
  const store = state.player.huntPace;
  if (__expPace.key && __expPace.t && __expPace.store === store) {
    const dt = (now - __expPace.t) / 1000;
    if (dt > 0 && dt <= HUNT_PACE_MAX_GAP_SEC) {
      const e = expPaceEntry(__expPace.key, __expPace.effects);
      e.s += dt;
      if (e.s > HUNT_PACE_WINDOW_SEC) {
        const f = HUNT_PACE_WINDOW_SEC / e.s;
        e.s *= f; e.k *= f;
        Object.keys(e.use).forEach(id => { e.use[id] *= f; });
      }
    }
  }
  __expPace.key = key;
  __expPace.effects = key ? Object.keys(expHuntEffects()).sort().join('|') : '';
  __expPace.store = store;
  __expPace.t = now;
}

function expPaceKill(m) {
  if (!m || m.fled || !state.player.classId || !expCurrentHuntKey()) return;
  expPaceStamp();
  const key = expPaceKey(m.templateId || m.id, m.variantId);
  expPaceEntry(key, __expPace.effects).k += 1;
}

// Применяем замер с действующими усилениями или замер обычной автоохоты.
function expGetPace(id, variantId, effects = expHuntEffects()) {
  const record = (state.player.huntPace || {})[expPaceKey(id, variantId)];
  if (record?.v !== EXP_PACE_VER) return { ok: false, old: !!record };
  let chosen = null, count = -1;
  Object.entries(record.profiles || {}).forEach(([key, p]) => {
    if (!(p?.s >= EXPEDITION_MIN_PACE_SEC && p.k >= EXPEDITION_MIN_PACE_KILLS)) return;
    const keys = key ? key.split('|') : [];
    if (keys.length < count || keys.some(k => !effects[k])) return;
    const kph = p.k / p.s * 3600;
    if (keys.length === count && kph >= chosen.kph) return;
    const use = Object.fromEntries(Object.entries(p.use || {}).map(([id, qty]) => [id, qty / p.k]));
    chosen = { ok: true, kph, use, effects: keys };
    count = keys.length;
  });
  return chosen || { ok: false };
}

function expHuntStages(opt, hours, effects = expHuntEffects()) {
  const stages = [];
  let remaining = hours * EXP_HOUR_MS;
  while (remaining > 0) {
    const pace = expGetPace(opt.template.id, opt.variantId, effects);
    if (!pace.ok) break;
    const ms = Math.min(remaining, ...pace.effects.map(key => effects[key] * 1000));
    stages.push({ ms, kph: pace.kph, use: pace.use });
    remaining -= ms;
    effects = Object.fromEntries(Object.entries(effects)
      .filter(([, sec]) => sec * 1000 > ms)
      .map(([key, sec]) => [key, sec - ms / 1000]));
  }
  return stages;
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
      else if (pace.old) reason = 'нужен новый замер: 5 минут автоохоты и 10 убийств';
      else if (!pace.ok) reason = 'нужны 5 минут автоохоты и 10 убийств с текущими усилениями или без них';
      const inst = buildMonsterInstance(t, v);
      list.push({ key: expPaceKey(t.id, v), template: t, variantId: v, name: inst.name, level: inst.level, kills, pace, ok: !reason, reason });
    });
  });
  return list;
}

// Средняя прикидка добычи (без бросков).
function expEstimate(template, variantId, kills) {
  const p = state.player;
  const inst = buildMonsterInstance(template, variantId);
  const xpBonus = (p.xpBonus || 0) + (p.xpBonusFromRefine || 0);
  const xp = kills * inst.xpReward * XP_MONSTER_MULTIPLIER * mult() * (1 + xpBonus / 100);
  const titleMult = getTitleDropMultiplier(template.id, variantId);
  const goldAvg = (inst.goldMin + inst.goldMax) / 2 * (1 + (p.goldBonusFromRefine || 0) / 100) * mult();
  const gold = kills * inst.goldChance * mult() * titleMult / 100 * goldAvg;
  return { kills, xp, gold };
}

// ---------- ПРИПАСЫ (v0.36.4) ----------
// Зелья и микстуры герой берёт с собой из города: сколько уйдёт — по замеру на этом монстре.
// Взятое сразу уходит из сумки, остаток возвращается. Кончились — герой приходит раньше.
function expInvCount(shopId) {
  return state.player.inventory.filter(i => i.shopId === shopId).reduce((s, i) => s + (i.qty || 0), 0);
}

function expInvTake(shopId, qty) {
  const inv = state.player.inventory;
  for (let i = inv.length - 1; i >= 0 && qty > 0; i--) {
    const it = inv[i];
    if (it.shopId !== shopId) continue;
    const t = Math.min(it.qty || 0, qty);
    it.qty -= t; qty -= t;
    if (it.qty <= 0) inv.splice(i, 1);
  }
}

// Вернуть припас: в стопку в сумке, в свободную ячейку, а если некуда — в добычу экспедиции.
function expGiveSupply(shopId, qty) {
  if (!(qty > 0)) return;
  const p = state.player;
  const shop = SHOP_ITEMS.find(s => s.id === shopId);
  if (!shop) return;
  const ex = p.inventory.find(i => i.shopId === shopId);
  if (ex) { ex.qty = (ex.qty || 0) + qty; return; }
  const item = {
    name: shop.name, type: 'consumable', icon: SVG[shop.icon], shopId,
    effect: shop.effect, sellPrice: Math.floor(shop.price * 0.3),
  };
  if (p.inventory.length < invMaxSlots()) {
    p.inventory.push({ id: 'item_' + Date.now() + '_' + Math.random(), ...item, qty });
  } else {
    if (!Array.isArray(p.expeditionLoot)) p.expeditionLoot = [];
    expPoolAdd(p.expeditionLoot, item, qty);
  }
}

// Сколько каждого припаса уйдёт за hours часов на этом монстре.
function expSupplyNeeds(stages) {
  const amounts = {};
  stages.forEach(stage => {
    const kills = stage.kph * EXPEDITION_RATE * stage.ms / EXP_HOUR_MS;
    Object.entries(stage.use).forEach(([id, perKill]) => {
      amounts[id] = (amounts[id] || 0) + perKill * kills;
    });
  });
  return Object.entries(amounts).map(([id, amount]) => {
    const shop = SHOP_ITEMS.find(s => s.id === id);
    if (!shop || !(amount > 0)) return null;
    return { id, shop, need: Math.max(1, Math.ceil(amount - 1e-6)), have: expInvCount(id) };
  }).filter(r => r && r.need > 0)
    // без чего не воевать — первым: на него Оболы на докупку идут в первую очередь
    .sort((a, b) => (expSupplyKind(a.id).kind === 'hard' ? 0 : 1) - (expSupplyKind(b.id).kind === 'hard' ? 0 : 1));
}

// Как припас влияет на экспедицию:
//  'hard' — без него герой к тварям не суётся (зелья, Микстура крепости): кончился — вернулся раньше;
//  'atk'  — Микстура атаки: кончилась — дальше бьёт медленнее (темп ÷ (1 + урон%));
//  'luck' — Микстура удачи: пока есть — +шанс дропа, кончилась — просто без бонуса.
function expSupplyKind(id) {
  const m = (typeof MIXTURE_EFFECTS !== 'undefined') ? MIXTURE_EFFECTS[id] : null;
  if (m && m.atkPercent) return { kind: 'atk', value: m.atkPercent };
  if (m && m.luckPercent) return { kind: 'luck', value: m.luckPercent };
  return { kind: 'hard', value: 0 };
}

// Прогон экспедиции по припасам: supplies [{ id, qty, perKill }], rate — убийств в мс
// на полной силе, T — сколько мс прошло. Возвращает убийства (без бонуса +15%), сколько мс
// герой на самом деле охотился, что кончилось первым (ranOut), сколько убийств шло с удачей.
function expSimulate(supplies, rate, T) {
  let atk = null, luck = null, hardCap = Infinity, hardBy = null;
  (supplies || []).forEach(s => {
    if (!(s.perKill > 0)) return;
    const cap = (s.qty || 0) / s.perKill;   // на сколько убийств хватит
    const k = expSupplyKind(s.id);
    if (k.kind === 'atk') { if (!atk || cap < atk.cap) atk = { cap, value: k.value, s }; }
    else if (k.kind === 'luck') { if (!luck || cap < luck.cap) luck = { cap, value: k.value, s }; }
    else if (cap < hardCap) { hardCap = cap; hardBy = s; }
  });
  if (!(rate > 0)) return { kills: 0, ms: T, ranOut: null, luckKills: 0, luckValue: 0, atkOutMs: null };
  const rate2 = atk ? rate / (1 + atk.value / 100) : rate;
  const atkMs = atk ? atk.cap / rate : Infinity;
  const killsAt = t => (t <= atkMs ? rate * t : atk.cap + rate2 * (t - atkMs));
  const timeFor = K => (!atk || K <= atk.cap ? K / rate : atkMs + (K - atk.cap) / rate2);
  let kills = killsAt(T), ms = T, ranOut = null;
  if (kills > hardCap) { kills = hardCap; ms = timeFor(hardCap); ranOut = hardBy; }
  return {
    kills, ms, ranOut,
    luckKills: luck ? Math.min(kills, luck.cap) : 0, luckValue: luck ? luck.value : 0,
    atkOutMs: atk && atkMs < ms ? atkMs : null, atkName: atk ? atk.s.name : '',
  };
}

// Каждый отрезок использует свой замер. Остатки расходников переходят дальше.
function expSimulateTrip(supplies, stages, elapsed) {
  const used = Object.fromEntries(supplies.map(s => [s.id, 0]));
  const result = { kills: 0, ms: 0, ranOut: null, luckKills: 0, luckValue: 0, atkOutMs: null, atkName: '', used };
  for (const stage of stages) {
    const duration = Math.min(stage.ms, elapsed - result.ms);
    if (duration <= 0) break;
    const stock = supplies.map(s => ({
      ...s, qty: Math.max(0, s.qty - used[s.id]), perKill: stage.use[s.id] || 0,
    }));
    const sim = expSimulate(stock, stage.kph * EXPEDITION_RATE / EXP_HOUR_MS, duration);
    if (result.atkOutMs === null && sim.atkOutMs !== null) {
      result.atkOutMs = result.ms + sim.atkOutMs;
      result.atkName = sim.atkName;
    }
    stock.forEach(s => { used[s.id] += Math.min(s.qty, s.perKill * sim.kills); });
    result.kills += sim.kills;
    result.ms += sim.ms;
    result.luckKills += sim.luckKills;
    result.luckValue = Math.max(result.luckValue, sim.luckValue);
    if (sim.ranOut) { result.ranOut = sim.ranOut; break; }
  }
  result.pacedOut = !result.ranOut && result.ms < elapsed - 1;
  return result;
}

// План сборов по окну: сколько берём, сколько докупаем, на сколько часов хватит.
function expSupplyPlan(opt, hours) {
  const d = __expDialog || {};
  const take = d.take || {};
  const stages = expHuntStages(opt, hours);
  const rows = expSupplyNeeds(stages);
  const location = state.player.currentLocation;
  let gold = state.player.gold;
  let cost = 0;
  rows.forEach(r => {
    r.take = Math.max(0, Math.min(99999, Math.floor(take[r.id] !== undefined ? take[r.id] : r.need)));
    const want = Math.max(0, r.take - r.have);
    const canBuy = d.buy !== false && isShopItemSoldInTown(r.shop, location);
    r.buy = canBuy ? Math.min(want, Math.floor(gold / r.shop.price)) : 0;
    r.noGold = canBuy && r.buy < want;
    r.soldOnlyInIlgrad = r.shop.town === 'ilgrad' && location !== 'ilgrad';
    gold -= r.buy * r.shop.price;
    cost += r.buy * r.shop.price;
    r.got = Math.min(r.take, r.have + r.buy);
    r.short = Math.max(0, r.take - r.got);
    r.name = r.shop.name;
  });
  const stock = rows.map(r => ({ id: r.id, name: r.name, qty: r.got }));
  const sim = expSimulateTrip(stock, stages, hours * EXP_HOUR_MS);
  return { rows, cost, sim, stages };
}

// ---------- ДОБЫЧА: БРОСКИ ПО НАСТОЯЩЕЙ ТАБЛИЦЕ ----------
function expMakeItem(drop, qty) {
  let stats = null;
  if (drop.stats) {
    stats = {};
    for (const k of ['pAtk','pDef','mDef','mAtk','flatDamageReduce','blockChance','mpBonus','hpBonus','atbSpeedMod','critChance','mpRegenIn','evasionMod']) {
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
  if (drop.shopId) { item.shopId = drop.shopId; item.effect = drop.effect; }   // v0.36.4: вернувшиеся припасы
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
// luck = { kills, value } — первые luck.kills убийств шли под Микстурой удачи (+value% к шансу дропа).
function expRollHunt(template, variantId, kills, luck) {
  const p = state.player;
  const inst = buildMonsterInstance(template, variantId);
  const m = mult();
  const titleMult = getTitleDropMultiplier(template.id, variantId);
  const dropMult = 1 + (titleMult - 1) + (p.dropBonusFromRefine || 0) / 100;
  const goldMult = m * (1 + (p.goldBonusFromRefine || 0) / 100);
  const xpBonus = (p.xpBonus || 0) + (p.xpBonusFromRefine || 0);
  const xpRaw = kills * inst.xpReward * XP_MONSTER_MULTIPLIER * m * (1 + xpBonus / 100);
  // Оболы круглые до десятков — в Копях и на Окраинах (как в обычном бою)
  const isMine = MINE_MONSTERS.includes(template) || (typeof OUTSKIRTS_MONSTERS !== 'undefined' && OUTSKIRTS_MONSTERS.includes(template));

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
    const dm = (luck && k < luck.kills) ? dropMult + luck.value / 100 : dropMult;
    inst.drops.forEach(d => {
      if (d.soulGem) return;
      const n = rollDropCount(d.chance * m * dm);
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
    take: {}, buy: prev ? prev.buy !== false : true,
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
  const plan = sel ? expSupplyPlan(sel, d.hours) : null;
  const inTown = isTownLoc(state.player.currentLocation);

  const rows = opts.slice().sort((a, b) => (b.ok - a.ok)).map(o => {
    const kph = o.pace.ok ? Math.round(o.pace.kph) : 0;
    const info = o.ok
      ? `<span class="exp-mon-pace">автоохота ~${expNum(kph)}/ч · на старте похода до ${expNum(kph * EXPEDITION_RATE)}/ч</span>`
      : `<span class="exp-mon-why">🔒 ${o.reason}</span>`;
    return `<button type="button" class="exp-mon variant-${o.variantId}${o.ok ? '' : ' locked'}${sel && sel.key === o.key ? ' on' : ''}" data-key="${o.key}"${o.ok ? '' : ' disabled'}>
      <span class="exp-mon-pic" style="background-image:url('${o.template.art}')"></span>
      <span class="exp-mon-body"><span class="exp-mon-name">${o.name} <small>ур. ${o.level}</small></span>${info}</span>
    </button>`;
  }).join('');

  const hours = EXPEDITION_HOURS.map(h => `<button type="button" class="exp-hours${d.hours === h ? ' on' : ''}" data-h="${h}">${h} ч</button>`).join('');

  let est = '<div class="exp-est exp-est-empty">Выберите, на кого охотиться.</div>';
  if (plan) {
    const sim = plan.sim;
    const full = !sim.ranOut && !sim.pacedOut;
    const rewardKills = sim.kills / (full ? 1 : 1 + EXPEDITION_FULL_BONUS);
    const e = expEstimate(sel.template, sel.variantId, rewardKills);
    const paceLine = plan.stages.length > 1
      ? `<div class="exp-rep-supplies">${plan.stages.map(stage => `${expFormatDuration(stage.ms)} по ${expNum(stage.kph * EXPEDITION_RATE)}/ч`).join(' · затем ')}</div>`
      : '';
    const paceNotice = sim.pacedOut
      ? `<div class="exp-pack-warn">Хватит примерно на ${expFormatDuration(sim.ms)}. Затем усиления из замера закончатся. Для более долгого похода нужен обычный замер автоохоты.</div>`
      : '';
    const balanceNote = inTown ? `Закупка припасов у Торговца · в кошельке ${expNum(state.player.gold)} Оболов` : 'Прогноз по припасам в сумке';
    est = `<div class="exp-est">
      <div>Примерно <b>${expNum(sim.kills)}</b> убийств в походе · <b>+${expNum(e.xp)}</b> опыта, плюс предметы</div>
      ${huntBalanceHtml(e.gold, plan.cost, balanceNote, true)}
      ${paceLine}
      ${paceNotice}
    </div>`;
  }

  // v0.36.4: отправиться можно только из города — там же и сборы
  let pack = '';
  if (plan) {
    if (!plan.rows.length) {
      pack = `<div class="exp-sub">Сборы</div><div class="exp-note">Припасы не нужны: на этой охоте вы не пили зелий и не брали микстур.</div>`;
    } else {
      const lines = plan.rows.map(r => {
        const icon = SVG[r.shop.icon] || '🧪';
        const tail = [];
        tail.push(`в сумке ${expNum(r.have)}`);
        if (r.buy > 0) tail.push(`<b>докупит ${expNum(r.buy)}</b>`);
        const reason = r.noGold ? ' · мало Оболов' : (r.soldOnlyInIlgrad ? ' · продаётся в Ильграде' : '');
        if (r.short > 0) tail.push(`<span class="exp-pack-warn">не хватает ${expNum(r.short)}${reason}</span>`);
        return `<div class="exp-pack-row">
          <span class="exp-pack-ico">${icon}</span>
          <span class="exp-pack-body"><span class="exp-pack-name">${r.shop.name}</span><span class="exp-pack-info">нужно ~${expNum(r.need)} · ${tail.join(' · ')}</span></span>
          <input type="number" class="exp-pack-qty" min="0" step="1" value="${r.take}" data-id="${r.id}" aria-label="Сколько взять: ${r.shop.name}">
        </div>`;
      }).join('');
      let sum = '';
      const sim = plan.sim;
      if (sim.atkOutMs !== null) {
        sum += sim.atkOutMs < 60000
          ? `<div class="exp-pack-warn">«${sim.atkName}» не взята — герой бьёт медленнее, чем на вашей охоте.</div>`
          : `<div class="exp-pack-warn">«${sim.atkName}» кончится примерно через ${expFormatDuration(sim.atkOutMs)} — дальше герой бьёт медленнее.</div>`;
      }
      if (sim.ranOut) sum += `<div class="exp-pack-warn">Хватит примерно на ${expFormatDuration(sim.ms)} из ${d.hours} ч: кончится «${sim.ranOut.name}», и герой вернётся раньше.</div>`;
      else sum += '<div class="exp-pack-ok">Хватит на запланированную охоту. Остаток припасов вернётся в сумку.</div>';
      pack = `<div class="exp-sub">Сборы</div>
        <div class="exp-pack">${lines}</div>
        ${inTown ? `<label class="exp-pack-buy"><input type="checkbox" id="exp-pack-buy"${d.buy !== false ? ' checked' : ''}> Докупить недостающее у Торговца</label>` : ''}
        <div class="exp-pack-sum">${sum}</div>`;
    }
  }
  const townNote = inTown ? '' : `<div class="exp-pack-warn exp-town-note">Собраться в экспедицию можно только в городе: вернитесь туда — герой закупится и уйдёт.</div>`;

  expOverlay(`
    <div class="exp-head"><span>⛺ Экспедиция: ${place}</span><button type="button" class="exp-x" onclick="closeExpeditionDialog()" aria-label="Закрыть">×</button></div>
    <div class="exp-note">Темп похода — до ${expNum(EXPEDITION_RATE * 100)}% вашей автоохоты. Убийства идут в отдельный счётчик походов. Души самоцветов добываются в бою.</div>
    <div class="exp-sub">На кого</div>
    <div class="exp-mons">${rows}</div>
    <div class="exp-sub">На сколько</div>
    <div class="exp-hours-row">${hours}</div>
    ${est}
    ${pack}
    ${townNote}
    <div class="exp-actions"><button type="button" class="exp-btn exp-btn-main"${inTown && plan?.sim.ms > 0 ? '' : ' disabled'} onclick="expStartHunt()">Отправиться</button></div>
  `);

  document.querySelectorAll('#exp-overlay .exp-mon:not(.locked)').forEach(b => {
    b.onclick = () => { __expDialog.key = b.dataset.key; __expDialog.take = {}; expRenderDialog(); };
  });
  document.querySelectorAll('#exp-overlay .exp-hours').forEach(b => {
    b.onclick = () => { __expDialog.hours = +b.dataset.h; __expDialog.take = {}; expRenderDialog(); };
  });
  document.querySelectorAll('#exp-overlay .exp-pack-qty').forEach(inp => {
    inp.onchange = () => {
      const v = Math.max(0, Math.floor(+inp.value || 0));
      __expDialog.take = __expDialog.take || {};
      __expDialog.take[inp.dataset.id] = v;
      expRenderDialog();
    };
  });
  const buyBox = document.getElementById('exp-pack-buy');
  if (buyBox) buyBox.onchange = () => { __expDialog.buy = buyBox.checked; expRenderDialog(); };
}

async function expStartHunt() {
  const d = __expDialog;
  if (!d || __expStarting || expIsAway()) return;
  const o = expHuntOptions(d.loc).find(x => x.key === d.key && x.ok);
  if (!o) return;
  if (state.travel.active) { showToast('⛺', 'Сначала дойдите до места'); return; }
  if (!isTownLoc(state.player.currentLocation)) { showToast('⛺', 'Собраться в экспедицию можно только в городе'); return; }

  const btn = document.querySelector('#exp-overlay .exp-btn-main');
  const slot = state.activeSlotIndex;
  __expStarting = true;
  if (btn) { btn.disabled = true; btn.textContent = 'Собираемся…'; }
  try {
    const srv = await expServerNow();
    if (__expDialog !== d || slot !== state.activeSlotIndex || !isTownLoc() || state.travel.active) return;
    const plan = expSupplyPlan(o, d.hours);
    if (!(plan.sim.ms > 0)) { showToast('⛺', 'Для похода нужен замер автоохоты и припасы по этому замеру'); return; }

    const b = state.battle;
    if (b.active || b.repeatBattle || b.waitingForResume) closeBattle();
    const goldBefore = state.player.gold;
    plan.rows.forEach(r => { if (r.buy > 0) buyItem(r.id, r.buy); });
    const supplyCost = goldBefore - state.player.gold;
    const supplies = plan.rows.map(r => {
      const qty = Math.min(r.take, expInvCount(r.id));
      expInvTake(r.id, qty);
      return { id: r.id, name: r.name, qty };
    });
    if (supplies.length) {
      renderInventory();
      if (typeof renderEquipSlots === 'function') renderEquipSlots();
      if (typeof renderConsumablesPanel === 'function') renderConsumablesPanel();
      if (typeof updateInventoryFooter === 'function') updateInventoryFooter();
    }

    const sim = expSimulateTrip(supplies, plan.stages, d.hours * EXP_HOUR_MS);
    const now = Date.now();
    state.player.expedition = {
      type: 'hunt', loc: d.loc, monsterId: o.template.id, variantId: o.variantId, name: o.name,
      hours: d.hours, startedAt: srv || now, startedLocal: now, serverTime: !!srv,
      stages: plan.stages, supplies, supplyCost, returnMs: sim.ms,
    };
    logCombat(`⛺ ${state.player.name} уходит в экспедицию: ${LOCATION_NAMES[d.loc] || d.loc}, ${o.name}, ${expFormatDuration(sim.ms)}.`, 'log-entry levelup');
    saveCurrentSlot();
    expShowAway();
  } finally {
    __expStarting = false;
    if (btn?.isConnected) { btn.disabled = false; btn.textContent = 'Отправиться'; }
  }
}

// ---------- ГЕРОЙ В ПУТИ ----------
function expShowAway() {
  const exp = state.player.expedition;
  if (!exp) return;
  const place = LOCATION_NAMES[exp.loc] || exp.loc;
  const tpl = ALL_HUNT_MONSTERS.find(t => t.id === exp.monsterId);
  expOverlay(`
    <div class="exp-head"><span>⛺ ${state.player.name} в экспедиции</span></div>
    <div class="exp-away-pic" style="background-image:url('${tpl ? tpl.art : ''}')"></div>
    <div class="exp-away-where">${place} · ${exp.name} · ${expFormatDuration(expReturnMs(exp))}</div>
    <div class="exp-away-left" id="exp-away-left"></div>
    <div class="exp-away-bar"><div class="exp-away-fill" id="exp-away-fill"></div></div>
    <div class="exp-note">Пока герой в пути, можно играть другим персонажем. При досрочном возвращении награда меньше.</div>
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
  if (fill) fill.style.width = (100 - left / Math.max(1, expReturnMs(exp)) * 100).toFixed(2) + '%';
  if (left <= 0) { clearInterval(__expAwayTimer); __expAwayTimer = null; expResolve(false); }
}

function expToCharacterSelect() {
  saveCurrentSlot();
  try { sessionStorage.removeItem(RESUME_SESSION_KEY); } catch (e) {}
  location.reload();
}

// ---------- ВОЗВРАЩЕНИЕ ----------
// loc — где охотился герой: у Окраин свои причины. Город — тот, куда он вернулся.
function expPickReason(loc) {
  const night = typeof worldTime === 'function' && worldTime(true).phase.id === 'night';
  const met = typeof bagMet === 'function' && bagMet();
  const list = EXPEDITION_EARLY_REASONS.filter(r => (!r.night || night) && (!r.bag || met) && (!r.loc || r.loc.includes(loc)));
  const r = list[Math.floor(Math.random() * list.length)];
  if (!r) return '';
  const town = EXPEDITION_TOWN_CASES[homeTown()] || EXPEDITION_TOWN_CASES.town;
  return heroText(r.text.replace('%townTo%', town.to).replace('%townIn%', town.in));
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

// v0.36.4: пока герой в пути, время бафов, сытости и блюда идёт, как на обычной охоте.
// Возвращает true, если было что тратить (для строчки в отчёте).
function expBurnTimers(sec) {
  const p = state.player;
  if (!(sec > 0)) return false;
  let any = false, recalc = false;
  if (p.foodTimer > 0) {
    any = true;
    p.foodTimer -= sec;
    if (p.foodTimer <= 0) { p.foodTimer = 0; p.foodTickAccum = 0; p.foodKind = null; }
  }
  if (p.dish && p.dish.timer > 0) {
    any = true;
    p.dish.timer -= sec;
    if (p.dish.timer <= 0) { p.dish = null; recalc = true; }
  }
  ['guildBuffs', 'tavernBuffs'].forEach(k => {
    Object.values(p[k] || {}).forEach(b => {
      if (!b || !(b.timer > 0)) return;
      any = true;
      b.timer = Math.max(0, b.timer - sec);
      if (!b.timer) recalc = true;
    });
  });
  if (recalc && typeof recalcStats === 'function') recalcStats();
  return any;
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
    const duration = expDurationMs(exp);
    const returnMs = expReturnMs(exp);
    if (!early && elapsed < returnMs - 1000) { expShowAway(); return; }
    const template = ALL_HUNT_MONSTERS.find(t => t.id === exp.monsterId);

    const supplies = exp.supplies || [];
    // В старом сохранении у уже начатого похода есть один темп и общий расход.
    const stages = exp.stages || [{
      ms: duration, kph: exp.kph || 0, use: Object.fromEntries(supplies.map(s => [s.id, s.perKill])),
    }];
    const sim = expSimulateTrip(supplies, stages, elapsed >= returnMs - 1000 ? duration : elapsed);
    const full = !sim.ranOut && !sim.pacedOut && sim.ms >= duration - 1000;
    const supplyRep = supplies.map(s => {
      const used = Math.min(s.qty || 0, Math.round(sim.used[s.id] || 0));
      const left = (s.qty || 0) - used;
      expGiveSupply(s.id, left);
      return { name: s.name, used, left };
    }).filter(s => s.used > 0 || s.left > 0);
    const burned = expBurnTimers(sim.ms / 1000);

    const kills = template ? Math.floor(sim.kills + 1e-8) : 0;
    const rewardFactor = full ? 1 : 1 / (1 + EXPEDITION_FULL_BONUS);
    const rewardBudget = kills * rewardFactor;
    const rewardRolls = Math.floor(rewardBudget) + (Math.random() < rewardBudget % 1 ? 1 : 0);

    const levelBefore = p.level;
    const luck = { kills: Math.round(sim.luckKills * rewardFactor), value: sim.luckValue };
    const loot = template && rewardRolls > 0 ? expRollHunt(template, exp.variantId, rewardRolls, luck) : { xp: 0, gold: 0, items: [] };

    p.expedition = null;
    p.currentLocation = homeTown();
    p.xp += loot.xp;
    p.gold += loot.gold;
    let totalKills = 0;
    if (template) {
      const key = killKey(template.id, exp.variantId);
      if (!p.expeditionKills) p.expeditionKills = {};
      totalKills = p.expeditionKills[key] = (p.expeditionKills[key] || 0) + kills;
    }
    if (!Array.isArray(p.expeditionLoot)) p.expeditionLoot = [];
    loot.items.forEach(e => expPoolAdd(p.expeditionLoot, e.drop, e.qty));
    checkLevelUp();

    const rep = {
      loc: exp.loc, name: exp.name, hours: exp.hours, elapsed: sim.ms, full,
      kills, totalKills, xp: loot.xp, gold: loot.gold, supplyCost: exp.supplyCost, levels: p.level - levelBefore,
      reason: sim.ranOut ? heroText(EXPEDITION_SUPPLY_OUT_REASON.replace('%name%', sim.ranOut.name))
        : sim.pacedOut ? 'Усиления закончились. Для продолжения нужен замер обычной автоохоты.'
        : full ? '' : expPickReason(exp.loc),
      supplies: supplyRep, burned,
    };
    rep.bagLine = expPickBagLine(rep);
    if (typeof annalsFirst === 'function') annalsFirst('expedition.hunt');

    logCombat(`⛺ Экспедиция окончена: ${exp.name} ×${expNum(kills)}, +${expNum(loot.xp)} опыта, +${expNum(loot.gold)} Оболов.`, 'log-entry levelup');
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
      <div><i>Убито в походе</i><b>${expNum(rep.kills)}</b></div>
      <div><i>Опыт</i><b>+${expNum(rep.xp)}</b></div>
    </div>`;
    const balanceNote = Number.isFinite(rep.supplyCost) ? 'Фактическая закупка припасов у Торговца' : 'Цена закупки для этого похода не записана';
    body += huntBalanceHtml(rep.gold, rep.supplyCost, balanceNote);
    body += `<div class="exp-rep-supplies">Всего в экспедициях на эту цель · ${expNum(rep.totalKills)}</div>`;
    if (rep.full) body += '<div class="exp-rep-bonus">Полная награда за поход</div>';
    if (rep.levels > 0) body += `<div class="exp-rep-bonus">✦ Новый уровень: ${p.level}!</div>`;
    if (rep.supplies && rep.supplies.length) {
      const s = rep.supplies.map(x => `${x.name}: ушло ${expNum(x.used)}${x.left > 0 ? `, вернулось ${expNum(x.left)}` : ''}`).join(' · ');
      body += `<div class="exp-rep-supplies">🎒 ${s}</div>`;
    }
    if (rep.burned) body += `<div class="exp-rep-supplies">⏳ Бафы и сытость тоже потратили ${expFormatDuration(rep.elapsed)}</div>`;
  }

  const order = (typeof RARITY_ORDER !== 'undefined') ? RARITY_ORDER : [];
  const chips = pool.slice().sort((a, b) => (order.indexOf(b.drop.rarity) - order.indexOf(a.drop.rarity)) || (b.qty - a.qty)).map(e => {
    const r = e.drop.rarity && RARITIES[e.drop.rarity];
    const col = r && r.id !== 'white' ? ` style="--c:${r.color}"` : '';
    return `<span class="exp-chip${col ? ' rare' : ''}"${col}>${normalizeIconHtml(e.drop.icon) ? `<span class="exp-chip-ico">${normalizeIconHtml(e.drop.icon)}</span>` : ''}${e.drop.name}${e.qty > 1 ? ` ×${expNum(e.qty)}` : ''}</span>`;
  }).join('');

  const used = p.inventory.length;
  const room = invMaxSlots() - used;
  body += `<div class="exp-sub">Добыча${pool.length ? '' : ' — пусто'}</div>`;
  if (pool.length) {
    body += `<div class="exp-chips">${chips}</div>`;
    body += `<div class="exp-rep-room${room <= 0 ? ' warn' : ''}">В сумке ${used}/${invMaxSlots()} — что не влезет, подождёт здесь (кнопка ⛺ на карте).</div>`;
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
    take: {}, buy: prev ? prev.buy !== false : true,
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
      if (p.inventory.length < invMaxSlots()) { p.inventory.push(expMakeItem(e.drop, e.qty)); moved += e.qty; pool.splice(i, 1); }
    } else {
      while (e.qty > 0 && p.inventory.length < invMaxSlots()) { p.inventory.push(expMakeItem(e.drop, 1)); e.qty--; moved++; }
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
  ['field', 'mine', 'outskirts'].forEach(loc => {   // Окраины Ильграда — карточка видна только при открытом городе
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
    // v0.36.3: до 5 ур. кнопки нет (если герой не в походе и его не ждёт добыча) — новичку она только мешала
    const busy = (exp && exp.loc === loc) || poolN > 0;
    if (!busy && (state.player.level || 1) < EXPEDITION_MIN_LEVEL) { box.innerHTML = ''; return; }
    let label = '⛺ Экспедиция';
    if (exp && exp.loc === loc) label = `⛺ В пути · ${expFormatLeft(expLeftMsLocal(exp))}`;
    else if (poolN > 0) label = `⛺ Добыча · ${expNum(poolN)}`;
    box.innerHTML = `<button type="button" class="map-exp-btn${busy ? ' busy' : ''}" onclick="event.stopPropagation(); openExpeditionDialog('${loc}')" title="Экспедиция: герой охотится сам 2–8 часов, даже когда вас нет в игре">${label}</button>`;
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
      return `<div class="slot-exp" title="При досрочном возвращении награда меньше">⛺ В экспедиции · ${place} · осталось ${expFormatLeft(left)}</div>`;
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
  startBattle = function () { expPaceStamp(); const r = origStart.apply(this, arguments); expPaceStamp(); return r; };

  const origDeath = onMonsterDeath;
  onMonsterDeath = function (deadMonster) {
    const m = deadMonster || (typeof getCurrentMonster === 'function' ? getCurrentMonster() : null);
    if (m && !m._deathProcessed) expPaceKill(m);
    const r = origDeath.apply(this, arguments);
    expPaceStamp();
    return r;
  };

  const origClose = closeBattle;
  closeBattle = function () { expPaceStamp(); const r = origClose.apply(this, arguments); __expPace.key = null; return r; };

  const origPlayerDeath = onPlayerDeath;
  onPlayerDeath = function () { const r = origPlayerDeath.apply(this, arguments); expPaceStamp(); return r; };

  const origToggleAuto = toggleAuto;
  toggleAuto = function () { expPaceStamp(); const r = origToggleAuto.apply(this, arguments); expPaceStamp(); return r; };

  // v0.36.4: расход припасов на охоте — зелье (одно за бой) и заряды микстуры
  const origPotion = checkHealPotion;
  checkHealPotion = function () {
    const eff = state.battle.activeEffects;
    const before = !!(eff && eff.healPotionUsed);
    const slot = state.player.potionSlot;
    const r = origPotion.apply(this, arguments);
    if (!before && eff && eff.healPotionUsed && slot) expRecordUse(slot, 1);
    return r;
  };

  const origMix = tickMixtureCharge;
  tickMixtureCharge = function (n) {
    // n > 1 сам вызывает себя по одному заряду — считаем только одиночные, чтобы не задвоить
    if ((n || 1) === 1) {
      const m = getActiveMixture();
      const d = m && MIXTURE_EFFECTS[m.id];
      if (d && d.charges) expRecordUse(m.id, 1 / d.charges);
    }
    return origMix.apply(this, arguments);
  };

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
