// ========================================================
//  СИСТЕМЫ: БОЙ — СОЮЗНИКИ ГЕРОЯ (v0.38)
//  Призывы подклассов (пока — слуги Некроманта; потом тотемы, звери, пауки, элементали).
//  Не больше 3. Живут до конца боя (рассыпаются при старте следующего).
//
//  state.battle.allies = [{ uid, kind, name, img, hp, maxHp, atk, dodge, slow, skip }]
//   + ходят в начале хода героя (alliesAct), медленные — через ход;
//   + твари иногда бьют союзника вместо героя (alliesTryIntercept);
//   + удары навыков тварей по «вторым целям» уже бьют state.battle.allies (battle-monster-kit.js).
//  Отрисовка — полоска портретов под карточкой героя (alliesRender, из bxSync).
// ========================================================

const ALLY_MAX = 3;
const ALLY_INTERCEPT_PER = 20;    // % шанса, что удар твари уйдёт в союзника, за каждого живого
const ALLY_INTERCEPT_MAX = 50;
const ALLY_PDEF_FACTOR = 0.3;     // защита твари режет удар союзника, как удар героя по герою
let ALLY_UID = 0;

function alliesList() {
  return (state.battle.allies || []).filter(a => a.hp > 0);
}
function alliesHasRoom() {
  return alliesList().length < ALLY_MAX;
}
function alliesAdd(a) {
  if (!state.battle.allies) state.battle.allies = [];
  if (!alliesHasRoom()) return null;
  a.uid = ++ALLY_UID;
  a.hp = Math.max(1, Math.floor(a.hp));
  a.maxHp = Math.max(1, Math.floor(a.maxHp || a.hp));
  a.atk = a.atk > 0 ? Math.max(1, Math.floor(a.atk)) : 0;   // 0 — не бьёт (тотемы Камня и Духов)
  state.battle.allies.push(a);
  alliesRender(true);
  bxShowAllyArrival(a);
  return a;
}
function alliesClear() {
  state.battle.allies = [];
  alliesRender(true);
}

// Убрать павших (и сказать об этом). Зовётся после любого урона союзникам.
function alliesReap() {
  const b = state.battle;
  if (!b.allies || !b.allies.length) return;
  const dead = b.allies.filter(a => a.hp <= 0);
  if (!dead.length) return;
  b.allies = b.allies.filter(a => a.hp > 0);
  dead.forEach(a => {
    logCombat(`💀 ${a.name} рассыпается.`, 'log-entry loss');
    if (typeof subclassOnAllyDeath === 'function') subclassOnAllyDeath(a);
  });
  alliesRender(true);
}

// Ход союзников: каждый бьёт текущую цель героя. Медленные — через ход.
function alliesAct() {
  const b = state.battle;
  if (!b.active) return;
  alliesReap();
  const list = alliesList();
  if (!list.length) return;
  const hits = [];
  const parts = [];
  // лечащие (тотем Духов): HP и мана герою
  const p = state.player;
  list.filter(a => a.healHp || a.healMp).forEach(a => {
    const source = a.totem ? { sourceAlly: a.uid } : undefined;
    const hp = a.healHp ? aoeHeal(p.maxHp * a.healHp / 100, source) : 0;
    const mp = a.healMp ? Math.min(Math.floor(p.maxMp * a.healMp / 100), p.maxMp - p.mp) : 0;
    if (mp > 0) p.mp += mp;
    if (hp > 0 || mp > 0) {
      if (a.totem) {
        bxShowAllySupport(a.uid);
        if (mp > 0) spawnFloatDamage('fighter-player', mp, 'mana', { ...source, fx: 'mana-restore' });
      }
      logCombat(`✚ ${a.name}: ${hp > 0 ? `+${hp} HP` : ''}${hp > 0 && mp > 0 ? ', ' : ''}${mp > 0 ? `+${mp} MP` : ''}`, 'log-entry potion');
    }
  });
  list.forEach(a => {
    if (!a.atk) return;   // не бьёт (тотем Камня, Духов)
    if (a.slow) { a.skip = !a.skip; if (a.skip) return; }
    const m = getCurrentMonster();
    if (!m || m.hp <= 0) return;
    const variance = Math.floor(a.atk * 0.2);
    const raw = a.atk + Math.floor(Math.random() * variance * 2) - variance;
    const dmg = monsterTagDmg(m, Math.max(1, Math.floor(raw - (m.pDef || 0) * ALLY_PDEF_FACTOR)), ['physical']);
    const rage = a.totem && a.kind === 'rage';
    hits.push({ m, miss: false, dmg, type: 'dmg', fx: rage ? 'proj:fire' : 'slash', sourceAlly: rage ? a.uid : null });
    parts.push(dmg);
    if (typeof subclassOnAllyHit === 'function') subclassOnAllyHit(a, m);   // v0.38: паутина и яд пауков
  });
  if (!hits.length) return;
  const r = aoeApply(hits);
  const who = list.some(a => a.totem) ? 'Тотемы' : list.some(a => a.spider) ? 'Пауки' : list.some(a => a.elemental) ? 'Элементали' : (list.length === 1 && list[0].druid ? list[0].name : 'Слуги');
  logCombat(`👥 ${who}: ${parts.length > 1 ? parts.join(' + ') + ' = ' + r.total : r.total}`, 'log-entry player', r.kills ? `убито: ${r.kills}` : '');
}

// Удар твари может уйти в союзника. true — удар принят союзником (по герою не бьём).
function alliesTryIntercept(m, skill) {
  const list = alliesList();
  if (!list.length || !m || m.hp <= 0) return false;
  // «принимает удары» (тотем Камня): +30% к шансу, и бьют именно его
  const taunts = list.filter(a => a.taunt);
  const chance = Math.min(ALLY_INTERCEPT_MAX + (taunts.length ? 20 : 0), ALLY_INTERCEPT_PER * list.length + (taunts.length ? 30 : 0));
  if (Math.random() * 100 >= chance) return false;
  const pool = taunts.length ? taunts : list;
  const a = pool[Math.floor(Math.random() * pool.length)];
  if (a.dodge && Math.random() * 100 < a.dodge) {
    logCombat(`💨 ${m.name} бьёт ${a.name} — мимо.`, 'log-entry');
    return true;
  }
  allyTakeHit(a, m, skill);
  return true;
}

// Урон твари по союзнику: без защиты героя, со своим разбросом.
function allyTakeHit(a, m, skill) {
  const base = m.mpDry ? Math.floor(m.atk * MONSTER_DRY_ATK_MULT) : m.atk;
  const variance = Math.floor(base * 0.3);
  let raw = base + Math.floor(Math.random() * variance * 2) - variance;
  if (typeof monsterKitRaw === 'function') raw = monsterKitRaw(m, skill, raw);
  const mult = typeof subclassMonsterWeakMult === 'function' ? subclassMonsterWeakMult(m) : 1;   // Оковы / Проклятие слабости
  const dmg = Math.max(1, Math.floor(raw * mult) - (a.absorb || 0));   // v0.38: Каменная кровь — элементали держат поглощение героя
  a.hp -= dmg;
  bxNoteAllyHit(a.uid, m, dmg);
  logCombat(`🩸 ${m.name} бьёт ${a.name}: ${dmg}`, 'log-entry monster', a.hp > 0 ? `осталось ${Math.max(0, Math.floor(a.hp))}/${a.maxHp}` : '');
  alliesReap();
  alliesRender();
}

// Принять урон за героя (Костяная плата). Возвращает союзника или null.
function allyTakeDamageFor(dmg) {
  const list = alliesList();
  if (!list.length) return null;
  const a = list.reduce((best, x) => (x.hp > best.hp ? x : best), list[0]);
  a.hp -= dmg;
  alliesReap();
  alliesRender();
  return a;
}

// ---------- Отрисовка ----------
let ALLY_SIG = '';
function alliesRender(force) {
  const hero = document.getElementById('fighter-player');
  if (!hero) return;
  let box = document.getElementById('bx-allies');
  const list = (state.battle && state.battle.active) ? alliesList() : [];
  if (!list.length) {
    if (box) { box.remove(); ALLY_SIG = ''; }
    return;
  }
  if (!box) {
    box = document.createElement('div');
    box.id = 'bx-allies';
    box.className = 'bx-allies';
    hero.appendChild(box);
    force = true;
  }
  const sig = list.map(a => `${a.uid}:${Math.max(0, Math.floor(a.hp))}/${a.maxHp}`).join('|');
  if (!force && sig === ALLY_SIG) return;
  ALLY_SIG = sig;
  const cards = new Map(Array.from(box.children, card => [Number(card.dataset.allyUid), card]));
  list.forEach(a => {
    let card = cards.get(a.uid);
    cards.delete(a.uid);
    if (!card) {
      card = document.createElement('div');
      card.className = a.totem ? 'bx-ally bx-ally-totem' : 'bx-ally';
      card.dataset.allyUid = a.uid;
      card.innerHTML = '<img alt=""><div class="bx-ally-hp"><i></i></div>';
      card.firstElementChild.src = a.img;
      box.appendChild(card);
    }
    const pct = Math.max(0, Math.min(100, a.hp / a.maxHp * 100));
    const role = a.atk ? ` · удар ${a.atk}` : (a.healHp ? ' · лечит' : (a.taunt ? ' · принимает удары' : ''));
    card.title = `${a.name} · ${Math.max(0, Math.floor(a.hp))}/${a.maxHp} HP${role}${a.slow ? ' · медленный' : ''}${a.dodge ? ` · уворот ${a.dodge}%` : ''}`;
    card.querySelector('.bx-ally-hp i').style.width = `${pct.toFixed(1)}%`;
  });
  cards.forEach(card => card.remove());
}
