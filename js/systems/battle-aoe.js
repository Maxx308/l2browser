// ========================================================
//  СИСТЕМЫ: БОЙ — МАССОВЫЕ НАВЫКИ (v0.19)
//  Данные навыков — js/data/skills-aoe.js.
//
//  Точки входа (вызываются из других файлов):
//  + performAoeSkill(skill, data)   — из playerAttack(), когда выбран навык с aoe.
//  + tickBlizzardRune()             — в начале playerAttack(): взрыв Руны вьюги.
//  + applyRotTicks()                — в ходе монстров (battle-loop.js): Гниение.
//  + trySpreadRot(m)                — в onMonsterDeath(): Гниение перескакивает.
//  + getEntangleAccMult(m) / tickEntangle(m) — в monsterAttack(): шипы эльфа.
//
//  ВАЖНО про смерти: если удар убил сразу нескольких, onMonsterDeath
//  вызывается ПО ОЧЕРЕДИ, и пока очередь не дошла — у моба остаётся HP > 0.
//  Иначе бой решил бы, что «все мертвы», на первом же убитом
//  и не выдал бы награду за остальных.
// ========================================================

// ---------- ЦЕЛИ ----------
function aoeAlive() {
  return (state.battle.monsters || []).filter(m => m.hp > 0);
}
// Текущая цель первой, дальше остальные по порядку.
function aoeTargets(max) {
  return aoeAlive().slice(0, Math.max(1, max || 1));
}

// ---------- РАСЧЁТ УДАРА ----------
// Физический удар по одному мобу. Возвращает { miss, dmg, crit }.
function aoePhysHit(m, mult, elemBonusPct) {
  const p = state.player;
  const weapon = p.equipment.weapon;
  const cat = weapon ? getWeaponCategory(weapon.name) : null;

  let eva = getMonsterEvasion(m);
  const confused = getDebuff('monster', 'confused', m.index);
  if (confused && confused.evasionReduction) eva = eva * (1 - confused.evasionReduction / 100);
  if (!rollHit(getPlayerAccuracy(), eva)) return { miss: true, dmg: 0, crit: false };

  const pierce = checkCrossbowPierce(cat, m.pDef || 0);
  const base = p.pAtk;
  const variance = Math.floor(base * 0.2);
  const raw = base + Math.floor(Math.random() * variance * 2) - variance;
  let dmg = Math.floor(Math.max(1, raw - pierce.effectivePDef) * mult);

  const wb = cat ? getWeaponDamageBonus(cat) : 0;
  if (wb > 0) dmg = Math.floor(dmg * (1 + wb / 100));
  if (elemBonusPct > 0) dmg = Math.floor(dmg * (1 + elemBonusPct / 100));
  const mix = getMixtureAtkMult();
  if (mix > 1) dmg = Math.floor(dmg * mix);
  // v0.19: дубина в руке — массовые навыки сильнее
  const maceBonus = (cat && WEAPON_CATEGORY_TRAITS[cat] && WEAPON_CATEGORY_TRAITS[cat].aoeSkillBonus) || 0;
  if (maceBonus > 0) dmg = Math.floor(dmg * (1 + maceBonus / 100));
  // v0.27: двуручный хват
  const grip = getTwoHandGripBonus();
  if (grip > 0) dmg = Math.floor(dmg * (1 + grip / 100));

  const crit = Math.random() * 100 < getCritChance(cat);
  if (crit) dmg = Math.floor(dmg * getCritMultiplier(cat));
  return { miss: false, dmg: withSkillFlat(Math.max(1, dmg)), crit };
}

// Магический удар по одному мобу. Возвращает { miss, dmg }.
function aoeMagHit(m, mult, elemId) {
  const p = state.player;
  let eva = getMonsterEvasion(m);
  const confused = getDebuff('monster', 'confused', m.index);
  if (confused && confused.evasionReduction) eva = eva * (1 - confused.evasionReduction / 100);
  if (!rollHit(getPlayerAccuracy(), eva)) return { miss: true, dmg: 0 };

  const base = p.mAtk;
  const variance = Math.floor(base * 0.2);
  const raw = base + Math.floor(Math.random() * variance * 2) - variance;
  let dmg = Math.floor(Math.max(1, raw - (m.mDef || 0)) * mult);
  const eb = elemId ? getElementDamageBonus(elemId) : 0;
  if (eb > 0) dmg = Math.floor(dmg * (1 + eb / 100));
  const mix = getMixtureAtkMult();
  if (mix > 1) dmg = Math.floor(dmg * mix);
  return { miss: false, dmg: withSkillFlat(Math.max(1, dmg)) };
}

// ---------- ПРИМЕНЕНИЕ УРОНА ----------
// hits: [{ m, dmg, miss, type, fx }] — по порядку.
// Наносит урон, показывает цифры, по очереди обрабатывает смерти.
// Возвращает { total, kills }.
function aoeApply(hits) {
  let total = 0;
  const pending = new Map();   // моб → суммарный урон (у одного моба может быть несколько попаданий)

  hits.forEach(h => {
    if (h.miss) {
      spawnFloatDamage('fighter-monster', 0, 'miss', { mon: h.m, fx: h.fx });
      return;
    }
    spawnFloatDamage('fighter-monster', h.dmg, h.type || 'dmg', { mon: h.m, fx: h.fx });
    pending.set(h.m, (pending.get(h.m) || 0) + h.dmg);
  });

  // Сначала — не смертельные, потом смерти по очереди.
  const lethal = [];
  pending.forEach((dmg, m) => {
    if (m.hp <= 0) return;
    const real = Math.min(dmg, m.hp);
    total += real;
    if (m.hp - dmg <= 0) lethal.push(m);
    else m.hp -= dmg;
  });

  let kills = 0;
  for (const m of lethal) {
    if (!state.battle.active) break;
    m.hp = 0;
    kills++;
    onMonsterDeath(m);
  }
  return { total, kills };
}

// Опыт стихии / оружия за применение (как у обычных навыков).
function aoeGiveXp(skill, extraElems) {
  const p = state.player;
  if (skill.classId === 'warrior') {
    const w = p.equipment.weapon;
    const cat = w ? getWeaponCategory(w.name) : null;
    if (cat) {
      addWeaponXP(cat);
      if (tryBonusProficiencyXP()) { addWeaponXP(cat); logCombat(`🍺 Бонусный опыт владения!`, 'log-entry levelup'); }
    }
  }
  const elems = extraElems || (skill.element ? [skill.element] : []);
  elems.forEach(e => {
    addElementXP(e);
    if (tryBonusProficiencyXP()) { addElementXP(e); logCombat(`🍺 Бонусный опыт стихии!`, 'log-entry levelup'); }
  });
}

function aoeHeal(amount) {
  const p = state.player;
  const heal = Math.min(Math.floor(amount), p.maxHp - p.hp);
  if (heal <= 0) return 0;
  p.hp += heal;
  spawnFloatDamage('fighter-player', heal, 'heal');
  return heal;
}

// ========================================================
//  ГЛАВНАЯ: ПРИМЕНИТЬ МАССОВЫЙ НАВЫК
//  Мана и КД уже списаны в playerAttack().
// ========================================================
function performAoeSkill(skill, data) {
  const p = state.player;
  const lvl = getSkillLevel(skill.id);
  const kind = skill.aoe.kind;
  let line = '';

  switch (kind) {

    // ---- Человек-воин: Круговой удар ----
    case 'whirlwind': {
      const hits = aoeTargets(data.targets).map(m => ({ m, ...aoePhysHit(m, data.multiplier, 0), fx: 'slash' }))
        .map(h => ({ ...h, type: h.crit ? 'crit' : 'dmg' }));
      const r = aoeApply(hits);
      aoeGiveXp(skill, []);
      line = `🌀 КРУГОВОЙ УДАР (Ур.${lvl})! Целей: ${hits.length}, урон: ${r.total}.`;
      if (r.kills > 0 && typeof humanCycleOnKill === 'function') humanCycleOnKill('whirlwind');   // v0.19.1: Цикл мастера
      break;
    }

    // ---- Человек-маг: Стихийный залп ----
    case 'volley': {
      const ELEM = ['fire', 'ice', 'lightning'];
      const used = new Set();
      const hits = [];
      for (let i = 0; i < data.shots; i++) {
        const alive = aoeAlive();
        if (!alive.length) break;
        const m = alive[Math.floor(Math.random() * alive.length)];
        const el = ELEM[Math.floor(Math.random() * ELEM.length)];
        used.add(el);
        const h = aoeMagHit(m, data.multiplier, el);
        hits.push({ m, ...h, type: el === 'fire' ? 'fire' : 'magic', fx: 'proj:' + (el === 'fire' ? 'fire' : el === 'ice' ? 'ice' : 'arcane') });
        // Эффект стихии
        if (!h.miss && Math.random() * 100 < data.effectChance) {
          if (el === 'fire') {
            const pureMAtk = Math.floor(5 + p.INT * 0.8);
            addDebuff('monster', 'burn', m.index, { turnsLeft: 3, damage: Math.max(1, Math.floor(pureMAtk * 0.12)) });
            logCombat(`🔥 ${m.name} подожжён!`, 'log-entry fire');
          } else if (el === 'ice') {
            addDebuff('monster', 'freeze', m.index, { turnsLeft: 1 });
            logCombat(`❄ ${m.name} заморожен!`, 'log-entry magic');
          } else {
            cutMonstersATB(0.15);
            logCombat(`⚡ Разряд сбил ATB стаи!`, 'log-entry player-magic');
          }
        }
      }
      const r = aoeApply(hits);
      aoeGiveXp(skill, [...used]);
      line = `✦ СТИХИЙНЫЙ ЗАЛП (Ур.${lvl})! Снарядов: ${hits.length}, урон: ${r.total}.`;
      // v0.19.1: «Стихийный резонанс» — все три стихии в одном залпе → следующий Шар / Ледяная стрела без маны
      if (used.size >= 3 && !getDebuff('player', 'resonance')) {
        addDebuff('player', 'resonance', { turnsLeft: 1 });
        line += ' Стихийный резонанс: следующий Огненный шар или Ледяная стрела — без маны!';
      }
      break;
    }

    // ---- Орк-воин: Кровавая жатва ----
    case 'harvest': {
      const eb = getElementDamageBonus('death');
      const hits = aoeTargets(data.targets).map(m => ({ m, ...aoePhysHit(m, data.multiplier, eb), fx: 'slash-red' }))
        .map(h => ({ ...h, type: h.crit ? 'crit' : 'dmg' }));
      const r = aoeApply(hits);
      aoeGiveXp(skill);
      let healStr = '';
      if (r.kills > 0) {
        const healed = aoeHeal(p.maxHp * data.healPercent / 100 * r.kills);
        if (healed > 0) healStr = ` Жатва: +${healed} HP.`;
      }
      line = `🩸 КРОВАВАЯ ЖАТВА (Ур.${lvl})! Целей: ${hits.length}, урон: ${r.total}, убито: ${r.kills}.${healStr}`;
      break;
    }

    // ---- Орк-маг: Мор ----
    case 'pestilence': {
      const eb = getElementDamageBonus('death');
      const perTurn = Math.max(1, Math.floor(p.mAtk * data.dotPercent / 100 * (1 + eb / 100)));
      const targets = aoeTargets(data.targets);
      let doubled = 0;
      targets.forEach(m => {
        if (addRotLayer(m, data.turns, perTurn, skill.rotMaxLayers || 2)) doubled++;
        const two = rotLayers(getDebuff('monster', 'rot', m.index)).length > 1;
        spawnFloatDamage('fighter-monster', 0, 'poison', { mon: m, fx: 'toxic', text: two ? '☠ Гниение ×2' : '☠ Гниение' });
      });
      aoeGiveXp(skill);
      line = `☠ МОР (Ур.${lvl})! Гниение на ${targets.length} врагах: ${perTurn} урона за ход, ${data.turns} хода.` + (doubled ? ` Второй слой: ${doubled}.` : '');
      break;
    }

    // ---- Эльф-воин: Терновый вихрь ----
    case 'thorns': {
      const eb = getElementDamageBonus('life');
      const hits = aoeTargets(data.targets).map(m => ({ m, ...aoePhysHit(m, data.multiplier, eb), fx: 'slash-green' }))
        .map(h => ({ ...h, type: h.crit ? 'crit' : 'dmg' }));
      hits.forEach(h => {
        if (h.miss) return;
        addDebuff('monster', 'entangle', h.m.index, { turnsLeft: data.turns, accReduction: data.accReduction });
      });
      const r = aoeApply(hits);
      aoeGiveXp(skill);
      line = `🌿 ТЕРНОВЫЙ ВИХРЬ (Ур.${lvl})! Целей: ${hits.length}, урон: ${r.total}. Опутаны: точность −${data.accReduction}%.`;
      // v0.19.1: комбо — враг погиб от Вихря → бесплатное Дыхание природы
      // (без маны, без отката, при любом HP; один раз за Вихрь, ×1.5 если убито 2+).
      if (r.kills > 0 && typeof triggerNatureBreath === 'function') triggerNatureBreath(r.kills);
      break;
    }

    // ---- Эльф-маг: Похищение жизни ----
    case 'drain': {
      const fall = skill.aoe.falloff;
      // v0.19.1: комбо — пока Исцеление на перезарядке, урон (и лечение) +50%
      const healCd = (state.battle.skillCooldowns && state.battle.skillCooldowns.heal) || 0;
      const comboMult = (healCd > 0 && p.learnedSkills.heal) ? 1 + (skill.healCdBonusPercent || 50) / 100 : 1;
      const hits = aoeTargets(data.targets).map((m, i) => ({ m, ...aoeMagHit(m, data.multiplier * comboMult * (fall[i] || fall[fall.length - 1]), 'life'), type: 'magic', fx: 'proj:life' }));
      const r = aoeApply(hits);
      aoeGiveXp(skill);
      const healed = aoeHeal(r.total * data.healPercent / 100);
      line = `🌿 ПОХИЩЕНИЕ ЖИЗНИ (Ур.${lvl})!${comboMult > 1 ? ' Исцеление питает удар: +50%!' : ''} Урон: ${r.total}${healed > 0 ? `, +${healed} HP` : ''}.`;
      break;
    }

    // ---- Дроу-воин: Искровой разрез ----
    case 'spark': {
      const eb = getElementDamageBonus('lightning');
      const hits = aoeTargets(data.targets).map((m, i) => ({ m, ...aoePhysHit(m, data.multiplier, eb), fx: i === 0 ? 'slash-blue' : 'bolt' }))
        .map(h => ({ ...h, type: h.crit ? 'crit' : (h.fx === 'bolt' ? 'magic' : 'dmg') }));
      const r = aoeApply(hits);
      cutMonstersATB(data.atbCut / 100);
      aoeGiveXp(skill);
      line = `⚡ ИСКРОВОЙ РАЗРЕЗ (Ур.${lvl})! Урон: ${r.total}, ATB стаи −${data.atbCut}%.`;
      break;
    }

    // ---- Дроу-маг: Цепная молния ----
    case 'chain': {
      const fall = skill.aoe.falloff;
      // v0.19.1: если в цепи есть парализованный Разрядом — он проводник, молния не слабеет на прыжках
      const chainTargets = aoeTargets(data.targets);
      const conductor = chainTargets.some(m => getDebuff('monster', 'paralysis', m.index));
      const hits = chainTargets.map((m, i) => {
        const k = conductor ? 1 : (fall[i] || fall[fall.length - 1]);
        return { m, ...aoeMagHit(m, data.multiplier * k, 'lightning'), type: 'magic', fx: 'bolt' };
      });
      const r = aoeApply(hits);
      aoeGiveXp(skill);
      if (conductor) logCombat(`⚡ Парализованный враг проводит ток: молния не слабеет на прыжках!`, 'log-entry player-magic');
      // Цепной разум: шанс снизить КД
      const chainLvl = p.learnedSkills['chainMind'] || 0;
      if (chainLvl > 0 && SKILLS['chainMind']) {
        const cd = SKILLS['chainMind'].levels[chainLvl - 1];
        if (cd && cd.chance && Math.random() * 100 < cd.chance) {
          state.battle.skillCooldowns[skill.id] = Math.max(0, (state.battle.skillCooldowns[skill.id] || 0) - 1);
          logCombat(`🧠 Цепной разум! КД «Цепной молнии» снижен на 1.`, 'log-entry player-skill');
        }
      }
      line = `⚡ ЦЕПНАЯ МОЛНИЯ (Ур.${lvl})! Прыжков: ${hits.length}, урон: ${r.total}.`;
      break;
    }

    // ---- Гном-воин: Ледяной раскол ----
    case 'quake': {
      const eb = getElementDamageBonus('ice');
      const hits = aoeTargets(data.targets).map(m => ({ m, ...aoePhysHit(m, data.multiplier, eb), fx: 'ice' }))
        .map(h => ({ ...h, type: h.crit ? 'crit' : 'magic' }));
      // v0.19.1: Раскол разносит Метки Жадности на всех задетых (до урона — чтобы убитые тоже считались)
      if (typeof copyGreedMarks === 'function') copyGreedMarks(hits.filter(h => !h.miss).map(h => h.m), 'warrior');
      let frozen = 0;
      hits.forEach(h => {
        if (h.miss || h.m.hp - h.dmg <= 0) return;
        if (Math.random() * 100 < data.freezeChance) {
          addDebuff('monster', 'freeze', h.m.index, { turnsLeft: 1 });
          frozen++;
        }
      });
      const r = aoeApply(hits);
      aoeGiveXp(skill);
      line = `❄ ЛЕДЯНОЙ РАСКОЛ (Ур.${lvl})! Целей: ${hits.length}, урон: ${r.total}, заморожено: ${frozen}.`;
      break;
    }

    // ---- Гном-маг: Руна вьюги (взрыв — на следующий ход) ----
    case 'rune': {
      const targets = aoeTargets(data.targets);
      targets.forEach(m => {
        addDebuff('monster', 'rune', m.index, { turnsLeft: 1 });
        spawnFloatDamage('fighter-monster', 0, 'magic', { mon: m, fx: 'rune', text: '✶ Руна' });
      });
      state.battle.blizzardRune = {
        group: state.battle.monsters,
        multiplier: data.multiplier, targets: data.targets, atbCut: data.atbCut, lvl,
      };
      aoeGiveXp(skill);
      line = `✶ РУНА ВЬЮГИ (Ур.${lvl})! Руна начерчена — буран обрушится на следующий ход.`;
      break;
    }
  }

  if (line) logCombat(line, skill.classId === 'mage' ? 'log-entry player-magic' : 'log-entry player-skill');

  const mixtureData = getActiveMixtureData();
  if (mixtureData && mixtureData.chargeType === 'playerAttacks') tickMixtureCharge();

  updateTopStatus();
  updateBattleUI();
  if (state.battle.active) checkHealPotion();
}

// ========================================================
//  РУНА ВЬЮГИ: ВЗРЫВ
//  Вызывается в начале хода игрока. Не тратит ход.
// ========================================================
function tickBlizzardRune() {
  const rune = state.battle.blizzardRune;
  if (!rune) return;
  state.battle.blizzardRune = null;
  // Бой сменился — руна сгорела.
  if (!state.battle.active || rune.group !== state.battle.monsters) return;

  // Сначала те, на ком руна, потом остальные живые.
  const alive = aoeAlive();
  const marked = alive.filter(m => getDebuff('monster', 'rune', m.index));
  const rest = alive.filter(m => !marked.includes(m));
  const targets = [...marked, ...rest].slice(0, rune.targets);
  alive.forEach(m => { if (getDebuff('monster', 'rune', m.index)) removeDebuff('monster', 'rune', m.index); });
  if (!targets.length) return;

  const hits = targets.map(m => ({ m, ...aoeMagHit(m, rune.multiplier, 'ice'), type: 'magic', fx: 'blizzard' }));
  // v0.19.1: Буран разносит Метки Жадности мага на всех задетых
  if (typeof copyGreedMarks === 'function') copyGreedMarks(hits.filter(h => !h.miss).map(h => h.m), 'mage');
  const r = aoeApply(hits);
  cutMonstersATB(rune.atbCut / 100);
  logCombat(`🌨 БУРАН (Руна вьюги, Ур.${rune.lvl})! Урон: ${r.total}, ATB стаи −${rune.atbCut}%.`, 'log-entry player-magic');
  updateBattleUI();
}

// ========================================================
//  ГНИЕНИЕ (Мор орка)
//  Тикает в ход монстров по ВСЕМ мобам, на ком висит.
// ========================================================
// ---- v0.19.1: слои Гниения ----
// rot = { layers: [{ turnsLeft, damage }], maxTurns, turnsLeft, damage }
// turnsLeft / damage наверху — для старого кода и значка (макс. ходов, сумма урона).
function rotLayers(rot) {
  if (!rot) return [];
  if (!Array.isArray(rot.layers)) rot.layers = [{ turnsLeft: rot.turnsLeft || 0, damage: rot.damage || 1 }];
  return rot.layers;
}
function rotSync(rot) {
  const L = rotLayers(rot);
  rot.turnsLeft = L.length ? Math.max(...L.map(x => x.turnsLeft)) : 0;
  rot.damage = L.reduce((s, x) => s + x.damage, 0);
}
// Повесить слой. Возвращает true, если это второй (или обновлённый) слой.
function addRotLayer(m, turns, damage, maxLayers) {
  const rot = getDebuff('monster', 'rot', m.index);
  if (!rot) {
    addDebuff('monster', 'rot', m.index, { layers: [{ turnsLeft: turns, damage }], maxTurns: turns, turnsLeft: turns, damage });
    return false;
  }
  const L = rotLayers(rot);
  if (L.length < maxLayers) L.push({ turnsLeft: turns, damage });
  else {
    // слоёв уже максимум — обновляем самый старый
    let oldest = 0;
    L.forEach((x, i) => { if (x.turnsLeft < L[oldest].turnsLeft) oldest = i; });
    L[oldest] = { turnsLeft: turns, damage };
  }
  rot.maxTurns = Math.max(rot.maxTurns || 0, turns);
  rotSync(rot);
  return true;
}

// ---- v0.19.1: Гнев усиливает Гниение до конца боя ----
function getRotWrathMult() {
  const s = SKILLS.pestilence || {};
  return 1 + (state.battle.rotWrath || 0) * (s.wrathBonusPercent || 10) / 100;
}
function addRotWrathStack() {
  const p = state.player;
  if (!p.learnedSkills || !p.learnedSkills.pestilence) return;
  const s = SKILLS.pestilence || {};
  const max = s.wrathBonusMax || 3;
  const cur = state.battle.rotWrath || 0;
  if (cur >= max) return;
  state.battle.rotWrath = cur + 1;
  logCombat(`🌑 Гнев питает Гниение: +${state.battle.rotWrath * (s.wrathBonusPercent || 10)}% к его урону до конца боя.`, 'log-entry poison');
}

function applyRotTicks() {
  if (!state.battle.active) return;
  const hits = [];
  const w = getRotWrathMult();
  aoeAlive().forEach(m => {
    const rot = getDebuff('monster', 'rot', m.index);
    if (!rot) return;
    const L = rotLayers(rot);
    const dmg = withSkillFlat(Math.max(1, Math.floor(L.reduce((s, x) => s + x.damage, 0) * w)));
    hits.push({ m, miss: false, dmg, type: 'poison', fx: 'toxic-small' });
    L.forEach(x => { x.turnsLeft -= 1; });
    rot.layers = L.filter(x => x.turnsLeft > 0);
    if (!rot.layers.length) removeDebuff('monster', 'rot', m.index);
    else rotSync(rot);
  });
  if (!hits.length) return;
  const r = aoeApply(hits);
  const wr = w > 1 ? ` (Гнев +${Math.round((w - 1) * 100)}%)` : '';
  logCombat(`☠ Гниение: ${r.total} урона${wr}${r.kills ? `, сгнило: ${r.kills}` : ''}.`, 'log-entry poison');
  updateBattleUI();
}

// Моб умер с Гниением — сильнейший слой перескакивает на соседа без Гниения.
// Если перескочить некуда — все остальные Гниения длятся на 1 ход дольше (макс 6).
function trySpreadRot(dead) {
  if (!dead || !state.battle.debuffs || !state.battle.debuffs.monsters) return;
  const list = state.battle.debuffs.monsters[dead.index];
  const rot = list && list.rot;
  if (!rot) return;
  const alive = (state.battle.monsters || []).filter(m => m !== dead && m.hp > 0);
  const next = alive.find(m => !getDebuff('monster', 'rot', m.index));
  if (next) {
    const best = rotLayers(rot).reduce((a, b) => (b.damage > a.damage ? b : a), { damage: rot.damage || 1 });
    const turns = rot.maxTurns || 3;
    addDebuff('monster', 'rot', next.index, { layers: [{ turnsLeft: turns, damage: best.damage }], maxTurns: turns, turnsLeft: turns, damage: best.damage });
    spawnFloatDamage('fighter-monster', 0, 'poison', { mon: next, fx: 'toxic', text: '☠ Гниение' });
    logCombat(`☠ Гниение перекинулось на ${next.name}!`, 'log-entry poison');
    return;
  }
  const cap = (SKILLS.pestilence && SKILLS.pestilence.rotMaxTurns) || 6;
  let n = 0;
  alive.forEach(m => {
    const r2 = getDebuff('monster', 'rot', m.index);
    if (!r2) return;
    rotLayers(r2).forEach(x => { x.turnsLeft = Math.min(cap, x.turnsLeft + 1); });
    rotSync(r2);
    n++;
  });
  if (n) {
    logCombat(`☠ Гниению некуда перескочить — остальные гниют на 1 ход дольше.`, 'log-entry poison');
    if (typeof renderDebuffBar === 'function') renderDebuffBar('monster');
  }
}

// ========================================================
//  ДЫХАНИЕ ПРИРОДЫ — бесплатное срабатывание от Тернового вихря (v0.19.1)
// ========================================================
function triggerNatureBreath(kills) {
  const p = state.player;
  const lvl = (p.learnedSkills && p.learnedSkills.natureHeal) || 0;
  if (!lvl || !SKILLS.natureHeal) return;
  const d = SKILLS.natureHeal.levels[lvl - 1];
  if (!d) return;
  let amount = rollHealAmount(d.multiplier);
  if (kills >= 2) amount = Math.floor(amount * 1.5);
  const healed = aoeHeal(amount);
  for (let i = 0; i < Math.floor(getLifeXpMultiplier()); i++) addElementXP('life');
  const extra = kills >= 2 ? ' (×1.5 за двоих)' : '';
  if (healed > 0) logCombat(`🌿 Природа благодарит: Дыхание природы +${healed} HP${extra}.`, 'log-entry potion');
  else logCombat(`🌿 Природа благодарит, но HP уже полное.`, 'log-entry');
}

// ========================================================
//  ШИПЫ (Терновый вихрь эльфа)
// ========================================================
function getEntangleAccMult(m) {
  const e = m ? getDebuff('monster', 'entangle', m.index) : null;
  return e ? (1 - (e.accReduction || 0) / 100) : 1;
}
function tickEntangle(m) {
  const e = m ? getDebuff('monster', 'entangle', m.index) : null;
  if (!e) return;
  e.turnsLeft = (e.turnsLeft || 0) - 1;
  if (e.turnsLeft <= 0) removeDebuff('monster', 'entangle', m.index);
}

// ========================================================
//  Стоит ли тратить массовый навык прямо сейчас?
//  (вызывается из tryUseActiveSkill)
// ========================================================
function canUseAoeNow(skill) {
  if (!skill || !skill.aoe) return true;
  if (skill.aoe.minTargets && aoeAlive().length < skill.aoe.minTargets) return false;
  if (skill.aoe.kind === 'rune' && state.battle.blizzardRune) return false;
  return true;
}
