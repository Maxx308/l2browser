// ========================================================
//  СИСТЕМЫ: БОЙ — СТИЛИ ОРУЖИЯ (v0.19)
//  У каждого типа оружия воина своя особенность:
//   + Мечи     — парирование: шанс полностью отбить физ. удар монстра.
//   + Топоры   — против 2+ врагов обычный удар бьёт двоих по 70%.
//   + Копья    — пробивают насквозь: следующий враг получает 40%.
//   + Дубины   — массовые навыки сильнее на 30% (см. battle-aoe.js).
//   + Кинжалы  — добивание: +50% урона по врагу с HP ниже 30%.
//   + Луки     — обычный удар и навыки летят в самого раненого врага.
//   + Арбалеты — всегда игнорируют 25% защиты (см. checkCrossbowPierce).
//
//  Шансы и проценты берутся из WEAPON_CATEGORY_TRAITS (weaponTypes.js).
//  Парирование растёт с владением (+1% за 5 уровней, как другие фишки).
//  Топоры, копья и кинжалы — только на обычной атаке.
// ========================================================

function getWarriorWeaponCategory() {
  if (isMage()) return null;
  const w = state.player.equipment.weapon;
  return w ? getWeaponCategory(w.name) : null;
}

// ---- ЛУКИ: выбрать самого раненого живого врага ----
// getCurrentMonster() учитывает state.battle.focusIdx (helpers.js).
function updateBowFocus() {
  const b = state.battle;
  const cat = getWarriorWeaponCategory();
  const traits = cat ? (WEAPON_CATEGORY_TRAITS[cat] || {}) : {};
  if (!traits.focusWounded) { b.focusIdx = null; return; }
  const alive = (b.monsters || []).filter(m => m.hp > 0);
  if (alive.length < 2) { b.focusIdx = null; return; }
  let best = null, bestRatio = 2;
  alive.forEach(m => {
    const r = m.maxHp > 0 ? m.hp / m.maxHp : 1;
    if (r < bestRatio - 1e-9) { bestRatio = r; best = m; }
  });
  b.focusIdx = (best && bestRatio < 1) ? best.index : null;
}

// ---- КИНЖАЛЫ: множитель добивания ----
function getExecuteMult(m, cat) {
  if (!m || !cat) return 1;
  const t = WEAPON_CATEGORY_TRAITS[cat] || {};
  if (!t.executeBonus || !m.maxHp) return 1;
  return (m.hp / m.maxHp) * 100 < (t.executeHpPercent || 30) ? 1 + t.executeBonus / 100 : 1;
}

// ---- ТОПОРЫ / КОПЬЯ: кого задевает удар ----
// Возвращает { mainMult, secondMult, second, icon, label } или null.
function planWeaponCleave(cat, m) {
  if (!cat || !m) return null;
  const t = WEAPON_CATEGORY_TRAITS[cat] || {};
  if (!t.cleaveMult && !t.pierceSecondMult) return null;
  const list = state.battle.monsters || [];
  const pos = list.indexOf(m);
  const others = list.filter(x => x !== m && x.hp > 0);
  if (!others.length) return null;
  // «стоящий позади» — следующий живой после цели, иначе первый живой
  const second = others.find(x => list.indexOf(x) > pos) || others[0];
  if (t.cleaveMult) return { mainMult: t.cleaveMult, secondMult: t.cleaveMult, second, icon: '🪓', label: 'Топор задевает второго' };
  return { mainMult: 1, secondMult: t.pierceSecondMult, second, icon: '🔱', label: 'Копьё пробивает насквозь' };
}

// Нанести урон второй цели. Если основная цель уже мертва, держим её «живой»,
// пока обрабатывается вторая, чтобы бой не закончился раньше времени.
function applyWeaponCleave(m, plan, dmg) {
  const m2 = plan && plan.second;
  if (!m2 || m2.hp <= 0 || !state.battle.active) return;
  const d2 = Math.max(1, Math.floor(dmg));
  const saved = m.hp;
  if (saved <= 0) m.hp = 1;
  logCombat(`${plan.icon} ${plan.label}: ${m2.name} получает ${d2} урона.`, 'log-entry player');
  aoeApply([{ m: m2, dmg: d2, type: 'dmg' }]);
  if (saved <= 0) m.hp = saved;
}

// ---- v0.19.1: ДРОУ — Разряд сбил шкалу стаи до нуля ----
// Цель парализована на 1 удар (если не невосприимчива), КД Искрового разреза −1.
function onDischargeZeroed(m) {
  const p = state.player;
  if (m && m.hp > 0) {
    if (getDebuff('monster', 'paraImmune', m.index)) {
      logCombat(`⚡ ${m.name} пока невосприимчив к параличу.`, 'log-entry');
    } else if (!getDebuff('monster', 'paralysis', m.index)) {
      addDebuff('monster', 'paralysis', m.index, { turnsLeft: 1 });
      logCombat(`⚡ ПАРАЛИЧ! Шкала стаи сбита в ноль — ${m.name} пропустит удар.`, 'log-entry player-skill');
    }
  }
  if (p.learnedSkills.sparkSlash && (state.battle.skillCooldowns.sparkSlash || 0) > 0) {
    state.battle.skillCooldowns.sparkSlash -= 1;
    logCombat(`⚡ Разряд заряжает клинок: КД Искрового разреза −1.`, 'log-entry player-skill');
  }
  // дроу-маг: КД Цепной молнии −1
  if (p.learnedSkills.chainLightning && (state.battle.skillCooldowns.chainLightning || 0) > 0) {
    state.battle.skillCooldowns.chainLightning -= 1;
    logCombat(`⚡ Разряд питает бурю: КД Цепной молнии −1.`, 'log-entry player-skill');
  }
}

// ---- v0.19.1: ЧЕЛОВЕК-ВОИН — «Цикл мастера» ----
// Убийство Двойным ударом → КД Кругового −1; Круговым → КД Сильного −1; Сильным → КД Двойного −1.
const HUMAN_CYCLE = { doubleStrike: 'whirlwind', whirlwind: 'powerStrike', powerStrike: 'doubleStrike' };
function humanCycleOnKill(fromId) {
  const p = state.player;
  if (p.raceId !== 'human' || isMage()) return;
  const to = HUMAN_CYCLE[fromId];
  if (!to || !p.learnedSkills[to] || !SKILLS[to]) return;
  const cd = state.battle.skillCooldowns[to] || 0;
  if (cd <= 0) return;
  state.battle.skillCooldowns[to] = cd - 1;
  logCombat(`🔁 Цикл мастера: КД «${SKILLS[to].name}» −1.`, 'log-entry player-skill');
}

// ---- МЕЧИ: парирование физического удара ----
// Возвращает true, если удар отбит.
function tryWeaponParry(attacker) {
  if (!attacker || attacker.attackType === 'magic') return false;
  const cat = getWarriorWeaponCategory();
  const t = cat ? getEquippedWeaponTraits() : {};   // v0.24: с бонусом тира 3
  let chance = t.parryChance ? getTraitChance(t.parryChance, cat) : 0;
  // v0.27: меч во второй руке тоже парирует — с половинным шансом
  const off = cat ? getOffhandWeapon() : null;
  const offCat = off ? getWeaponCategory(off.name) : null;
  const offT = off ? getWeaponTraits(off.name) : {};
  if (offT.parryChance) chance += getTraitChance(offT.parryChance, offCat) * DUAL_WIELD_TRAIT_MULT;
  if (!chance) return false;
  if (Math.random() * 100 >= chance) return false;
  spawnFloatDamage('fighter-player', 0, 'block', { text: 'ПАРИР' });
  logCombat(`⚔ Парирование! ${state.player.name} отбивает удар ${attacker.name}.`, 'log-entry block');
  return true;
}
