// ========================================================
//  СИСТЕМЫ: БОЙ — ОРУЖИЕ И НАВЫКИ МОНСТРОВ (v0.36, нежить Окраин)
//  У твари в шаблоне (monsters.js): weapon — как у какого оружия героя её фишки,
//  skill — навык из MONSTER_SKILLS. Обычные твари этих полей не имеют и не меняются.
//
//  Оружие — шансы из той же таблицы, что у героев (WEAPON_CATEGORY_TRAITS):
//    swords  — кровотечение + парирует обычные физические удары героя (навыки не парирует)
//    axes    — зарубка на герое (до 5, +5% входящего урона за каждую) + второй цель
//    daggers — криты + добивание, когда у героя мало HP
//    spears  — стихия + пробой второй цели
//    maces   — оглушение
//  Подтипы (Древний, Кровавый) поднимают шансы через traitChanceMult.
//
//  Вторые цели пока не с кем бить: state.battle.allies появится вместе с призывами героя
//  (объекты с полем hp). monsterKitHitAllies уже бьёт по этому списку.
// ========================================================

// every — на какой ход твари применяется (счётчик у каждой свой, старт случайный — стая не бьёт разом).
// mult — множитель удара (ниже, чем у героев: твари ходят стаями).
const MONSTER_SKILLS = {
  doubleStrike: { name: 'Двойной удар',     icon: '⚔', every: 4, hits: 2, mult: 0.9 },
  orcRage:      { name: 'Ярость',           icon: '🌑', every: 5, mult: 1.5, recoilPercent: 4, minHpPercent: 50 },
  lifeDrain:    { name: 'Похищение жизни',  icon: '🩸', every: 4, mult: 1.1, drain: true },
  discharge:    { name: 'Разряд',           icon: '⚡', every: 4, mult: 1.3, atbCut: 0.25 },
  whirlwind:    { name: 'Круговой удар',    icon: '🌀', every: 4, mult: 1.4, sweep: true },
};

// Короткая подпись оружия на карточке (само оружие не называем — «завуалированное»).
const MONSTER_WEAPON_LABELS = {
  swords:  'Парирует',
  axes:    'Зарубка',
  daggers: 'Добивает',
  spears:  'Стихия',
  maces:   'Оглушает',
};

// ---- ТЕГИ (данные — MONSTER_TAGS, monsters.js) ----
// Вид урона героя: 'physical' + режущий/колющий/дробящий, 'magic' + стихия.
const MONSTER_TAG_WEAPON_KIND = { swords: 'slash', axes: 'slash', daggers: 'pierce', spears: 'pierce', bows: 'pierce', crossbows: 'pierce', maces: 'blunt', staves: 'blunt' };
const MONSTER_TAG_LIMITS = [-40, 50];
function heroPhysKinds(cat) {
  const kinds = ['physical', MONSTER_TAG_WEAPON_KIND[cat] || 'blunt'];
  if (cat === 'bows' || cat === 'crossbows') kinds.push('ranged');
  return kinds;
}

function monsterHasTagFlag(m, flag) {
  return !!(m && m.tags && m.tags.some(t => MONSTER_TAGS[t] && MONSTER_TAGS[t][flag]));
}

// Сообщаем о стойкости/уязвимости один раз за бой на каждый вид урона (иначе лог зарастёт).
const __tagSeen = new WeakMap();
function monsterTagAnnounce(m, kinds, pct) {
  const key = state.battle.monsters;
  if (!key) return;
  let seen = __tagSeen.get(key);
  if (!seen) __tagSeen.set(key, seen = new Set());
  const id = m.id + '|' + kinds.join('+');
  if (seen.has(id)) return;
  seen.add(id);
  logCombat(pct > 0 ? `🎯 ${m.name}: уязвимость, +${pct}% урона.` : `🛡 ${m.name}: стойкость, ${pct}% урона.`, 'log-entry');
}

// Урон героя с учётом тегов твари. kinds — виды урона этого удара.
function monsterTagDmg(m, dmg, kinds) {
  if (!m || !m.tags) return dmg;
  const list = kinds.filter(Boolean);
  let pct = 0;
  m.tags.forEach(t => {
    const mods = MONSTER_TAGS[t] && MONSTER_TAGS[t].mods;
    if (mods) list.forEach(k => { pct += mods[k] || 0; });
  });
  pct += monsterTagConditionalPct(m, list);
  if (pct) {
    pct = Math.max(MONSTER_TAG_LIMITS[0], Math.min(MONSTER_TAG_LIMITS[1], pct));
    monsterTagAnnounce(m, list, pct);
    dmg = Math.max(1, Math.floor(dmg * (1 + pct / 100)));
  }
  if (list.includes('fire') && monsterHasTagFlag(m, 'roots')) m.rootBlock = 3;   // огонь гасит лечение Корней
  const final = monsterManaAbsorb(m, dmg);   // весь урон героя проходит здесь — и щит маны тоже
  if (m.undying && final >= m.hp) {          // Неупокоенный: первый смертельный удар
    m.undying = false;
    spawnFloatDamage('fighter-monster', 0, 'block', { mon: m, text: 'НЕ УПОКОЕН' });
    logCombat(`💀 ${m.name} не падает!`, 'log-entry monster');
    return Math.max(0, m.hp - 1);
  }
  return final;
}

// Поправки к урону героя, которые зависят от положения в бою.
function monsterTagConditionalPct(m, kinds) {
  let pct = 0;
  const part = m.maxHp > 0 ? m.hp / m.maxHp : 1;
  if (part > 0.5 && monsterHasTagFlag(m, 'thick')) pct -= 15;
  if (part < 0.3 && monsterHasTagFlag(m, 'savage')) pct += 15;
  if (part < 0.3 && state.player.executeBonus) pct += state.player.executeBonus;   // v0.37: сет Палача +10
  if (kinds.includes('physical') && monsterHasTagFlag(m, 'formation')) pct += getAliveMonstersCount() >= 2 ? -15 : 15;
  return pct;
}

// ---- ДВУСТОРОННИЕ ТЕГИ: сила удара твари (из monsterStrike, до защиты героя) ----
function monsterTagRaw(m, raw) {
  let mult = 1;
  if (monsterHasTagFlag(m, 'packBonus')) {
    const kin = state.battle.monsters.filter(x => x !== m && x.hp > 0 && x.id === m.id).length;
    mult *= kin > 0 ? 1 + Math.min(24, kin * 6) / 100 : 0.8;
  }
  if (monsterHasTagFlag(m, 'savage') && m.maxHp > 0 && m.hp / m.maxHp < 0.3) mult *= 1.35;
  if (m.grudgeBonus) mult *= 1 + m.grudgeBonus / 100;
  if (monsterHasTagFlag(m, 'siege')) {
    m.siegeHits = (m.siegeHits || 0) + 1;
    if (m.siegeHits % 3 === 0) {
      mult *= 2;
      logCombat(`🔨 ${m.name} бьёт со всей силы!`, 'log-entry monster');
    } else mult *= 0.85;
  }
  return mult === 1 ? raw : Math.max(1, Math.floor(raw * mult));
}

const MONSTER_FLEE_BELOW = 0.2, MONSTER_FLEE_CHANCE = 25, MONSTER_THIEF_CHANCE = 15, MONSTER_WAIL_MP_PERCENT = 3;

// Начало хода твари. true — твари больше нет (сбежала).
function monsterTagsOnTurn(m) {
  const p = state.player;
  if (monsterHasTagFlag(m, 'coward') && m.maxHp > 0 && m.hp / m.maxHp < MONSTER_FLEE_BELOW && Math.random() * 100 < MONSTER_FLEE_CHANCE) {
    m.fled = true;
    m.xpReward = 0;
    m.goldChance = 0;
    m.drops = [];
    m.soul = null;
    spawnFloatDamage('fighter-monster', 0, 'block', { mon: m, text: 'СБЕЖАЛ' });
    logCombat(`🏃 ${m.name} сбегает!${m.stolen ? ` Вместе с ${m.stolen} Оболами.` : ''}`, 'log-entry loss');
    onMonsterDeath(m);
    return true;
  }
  if (monsterHasTagFlag(m, 'wail') && p.maxMp > 0 && p.mp > 0) {
    const lost = Math.min(p.mp, Math.ceil(p.maxMp * MONSTER_WAIL_MP_PERCENT / 100));
    p.mp -= lost;
    logCombat(`😱 Плач: −${lost} маны.`, 'log-entry magic');
  }
  return false;
}

// Попавший удар.
function monsterTagOnHit(m) {
  const p = state.player;
  if (!monsterHasTagFlag(m, 'thief') || p.gold <= 0 || Math.random() * 100 >= MONSTER_THIEF_CHANCE) return;
  const n = Math.min(p.gold, m.level * 6);
  p.gold -= n;
  m.stolen = (m.stolen || 0) + n;
  logCombat(`🫳 ${m.name} стащил ${n} Оболов!`, 'log-entry loss');
  updateTopStatus();
}

// Смерть твари (из onMonsterDeath, сбежавшая тоже приходит сюда).
function monsterTagsOnDeath(dead) {
  const p = state.player;
  if (dead.stolen && !dead.fled) {
    const back = dead.stolen * 2;
    p.gold += back;
    logLoot(`🪙 +${back} Оболов`, 'log-gold', 'вернул украденное вдвое');
  }
  if (dead.fled) return;
  state.battle.monsters.filter(m => m !== dead && m.hp > 0).forEach(m => {
    if (monsterHasTagFlag(m, 'scavenge')) {
      const heal = Math.min(m.maxHp - m.hp, Math.floor(m.maxHp * 0.1));
      if (heal > 0) { m.hp += heal; spawnFloatDamage('fighter-monster', heal, 'heal', { mon: m }); }
    }
    if (monsterHasTagFlag(m, 'grudge') && m.id === dead.id) m.grudgeBonus = Math.min(30, (m.grudgeBonus || 0) + 10);
  });
}

// «Часы стаи»: лечение Корней.
function monsterTagsClock() {
  state.battle.monsters.forEach(m => {
    if (m.hp <= 0 || !monsterHasTagFlag(m, 'roots')) return;
    if (m.rootBlock > 0) { m.rootBlock--; return; }
    const heal = Math.min(m.maxHp - m.hp, Math.max(1, Math.floor(m.maxHp * 0.02)));
    if (heal > 0) { m.hp += heal; spawnFloatDamage('fighter-monster', heal, 'heal', { mon: m }); }
  });
}

// ---- МАНА МАГИЧЕСКИХ ТВАРЕЙ (поля mp, mpCost в шаблоне; подтипы и души умножают запас) ----
// Заклинание тратит ману, щит забирает половину урона на ману. На нуле — щит лопнул,
// удары слабее и физические, навыков и стихии нет. Сюда же встанут молчание и похищение маны.
const MONSTER_MANA_SHIELD_PERCENT = 50;
const MONSTER_DRY_ATK_MULT = 0.7;

function monsterManaAbsorb(m, dmg) {
  if (!m.maxMp || m.mp <= 0 || dmg <= 0) return dmg;
  const mp = Math.min(Math.ceil(m.mp), Math.round(dmg * MONSTER_MANA_SHIELD_PERCENT / 100));
  if (mp <= 0) return dmg;
  m.mp = Math.max(0, m.mp - mp);
  if (m.mp <= 0) monsterManaBroke(m);
  return Math.max(1, dmg - mp);
}

function monsterManaBroke(m) {
  spawnFloatDamage('fighter-monster', 0, 'block', { mon: m, text: 'ЩИТ ЛОПНУЛ' });
  logCombat(`💥 ${m.name}: мана иссякла, щит лопнул. Теперь бьёт слабее и без магии.`, 'log-entry player-skill');
}

// В начале хода твари. mpDry — ход начат без маны: заклинания нет.
function monsterManaTurn(m) {
  if (!m.maxMp) return;
  m.mpDry = m.mp <= 0;
  if (m.mpDry) return;
  m.mp = Math.max(0, m.mp - m.mpCost);
  if (m.mp <= 0) monsterManaBroke(m);
}

// Бесплотная тварь: чистый шанс увернуться, точность героя не влияет.
function monsterTrueDodge(m) {
  if (!m || !m.tags) return false;
  const tag = m.tags.map(t => MONSTER_TAGS[t]).find(t => t && t.trueDodge);
  return !!tag && Math.random() * 100 < tag.trueDodge;
}

// Лечение ранит мёртвых: при здоровье от HEAL_STRIKE_MIN_HP% навык лечения бьёт цель с тегом healHurts.
// Перезарядка общая: ударил — нечем лечиться ближайшие ходы.
// Только маг: у воина маг. атака мала, удар лечением слабее обычного (по симулятору опыт падал на 15%).
const HEAL_STRIKE_MIN_HP = 70;
function healStrikeApplies(m) {
  const p = state.player;
  return isMage() && !!m && m.hp > 0 && p.maxHp > 0 && (p.hp / p.maxHp) * 100 >= HEAL_STRIKE_MIN_HP && monsterHasTagFlag(m, 'healHurts');
}

// Шипы: ближний удар героя возвращается уроном «уровень твари − поглощение героя». Убить героя не могут.
function monsterThorns(m, cat) {
  if (!m || m.hp <= 0 || !monsterHasTagFlag(m, 'thorns') || isMage() || cat === 'bows' || cat === 'crossbows') return 0;
  const p = state.player;
  const dmg = Math.min(Math.max(0, m.level - Math.floor(p.flatDamageReduce || 0)), p.hp - 1);
  if (dmg <= 0) return 0;
  p.hp -= dmg;
  spawnFloatDamage('fighter-player', dmg, 'dmg');
  return dmg;
}

// Мини-значки тегов поверх портрета; подсказка — при наведении, полный список — в Энциклопедии.
function monsterTagsHtml(monster) {
  if (!monster.tags || !monster.tags.length) return '';
  const icons = monster.tags.map(id => {
    const t = MONSTER_TAGS[id];
    return t ? `<span class="monster-tag tag-${id}" title="${t.name}${t.desc ? ': ' + t.desc : ''}"><img src="${t.icon}" alt="${t.name}"></span>` : '';
  }).join('');
  return `<div class="monster-tags">${icons}</div>`;
}

// Фишки оружия, которые идут через обычные traits монстра (battle-monster-attack.js).
function monsterWeaponTraits(cat) {
  const t = WEAPON_CATEGORY_TRAITS[cat];
  if (!t) return null;
  if (cat === 'swords')  return { bleedChance: MONSTER_WEAPON_TRAIT_CHANCES.bleedChance, bleedTurns: 3, bleedDamageDivisor: 6 };
  if (cat === 'maces')   return { stunChance: t.stunChance, stunTurns: 1 };
  if (cat === 'spears')  return { elementChance: MONSTER_WEAPON_TRAIT_CHANCES.elementChance, elementBonusPercent: 30 };
  if (cat === 'daggers') return { critChance: 10 + t.critBonus, critMult: 2.2 };   // как кинжал героя: база 10% + бонус
  return null;
}

function monsterKitLineHtml(monster) {
  const parts = [];
  if (monster.weapon && MONSTER_WEAPON_LABELS[monster.weapon]) parts.push(MONSTER_WEAPON_LABELS[monster.weapon]);
  if (monster.skill && MONSTER_SKILLS[monster.skill]) parts.push(MONSTER_SKILLS[monster.skill].name);
  return parts.length ? `<div class="monster-kit">${parts.join(' · ')}</div>` : '';
}

// Какой навык применить на этом ходу (или null).
function monsterKitPickSkill(m) {
  const s = m.skill && MONSTER_SKILLS[m.skill];
  if (!s || m.mpDry) return null;
  if (m.kitTurn === undefined) m.kitTurn = Math.floor(Math.random() * s.every);
  m.kitTurn++;
  if (m.kitTurn < s.every) return null;
  m.kitTurn = 0;
  if (s.minHpPercent && (m.hp / m.maxHp) * 100 < s.minHpPercent) return null;
  spawnFloatDamage('fighter-monster', 0, 'block', { mon: m, text: s.name.toUpperCase() });
  logCombat(`${s.icon} ${m.name} применяет «${s.name}»!`, 'log-entry monster');
  return s;
}

// Удар до защиты героя: навык, зарубки на герое, добивание.
function monsterKitRaw(m, skill, raw) {
  const p = state.player;
  let mult = skill ? skill.mult : 1;
  const wound = getDebuff('player', 'wound');
  if (wound) mult *= 1 + (wound.stacks || 0) * 0.05;
  if (m.weapon === 'daggers' && p.maxHp > 0) {
    const t = WEAPON_CATEGORY_TRAITS.daggers;
    if ((p.hp / p.maxHp) * 100 < t.executeHpPercent) {
      mult *= 1 + t.executeBonus / 100;
      logCombat(`🗡 ${m.name} добивает раненого!`, 'log-entry monster');
    }
  }
  return mult === 1 ? raw : Math.max(1, Math.floor(raw * mult));
}

// Попавший удар: запомнить урон, зарубка, вторые цели.
function monsterKitOnHit(m, skill, dmg, chanceMult) {
  m.kitLastHit = dmg;
  if (m.weapon === 'axes' && state.player.hp > 0) {
    const chance = MONSTER_WEAPON_TRAIT_CHANCES.woundChance * chanceMult;
    if (Math.random() * 100 < chance) {
      const w = getDebuff('player', 'wound');
      if (w) {
        w.stacks = Math.min(5, (w.stacks || 1) + 1);
        w.turnsLeft = 4;
        renderDebuffBar('player');
      } else {
        addDebuff('player', 'wound', { turnsLeft: 4, stacks: 1 });
      }
      const n = getDebuff('player', 'wound').stacks;
      logCombat(`🪓 ${m.name} оставил зарубку! ×${n} (+${n * 5}% входящего урона, 4 хода)`, 'log-entry loss');
    }
  }
  monsterKitHitAllies(m, skill, dmg);
}

// Удар задевает помощников героя (призывы — позже; пока список пуст).
function monsterKitHitAllies(m, skill, dmg) {
  const allies = (state.battle.allies || []).filter(a => a.hp > 0);
  if (!allies.length) return;
  if (skill && skill.sweep) {
    allies.forEach(a => { a.hp -= dmg; });
    return;
  }
  const t = WEAPON_CATEGORY_TRAITS[m.weapon] || {};
  const mult = m.weapon === 'axes' ? t.cleaveMult : m.weapon === 'spears' ? t.pierceSecondMult : 0;
  if (mult) allies[0].hp -= Math.max(1, Math.floor(dmg * mult));
}

// После всех ударов навыка: отдача, похищение, сбитая шкала.
function monsterKitAfterSkill(m, skill, landed) {
  if (m.hp <= 0 || state.player.hp <= 0 || !state.battle.active) return;
  if (skill.recoilPercent) {
    const r = Math.floor(m.maxHp * skill.recoilPercent / 100);
    m.hp = Math.max(1, m.hp - r);
    spawnFloatDamage('fighter-monster', r, 'dmg', { mon: m });
    logCombat(`💢 ${m.name}: отдача от Ярости, ${r} HP.`, 'log-entry');
  }
  if (skill.drain && landed > 0) {
    const heal = Math.min(landed, m.maxHp - m.hp);
    if (heal > 0) {
      m.hp += heal;
      spawnFloatDamage('fighter-monster', 0, 'block', { mon: m, text: `+${heal} HP` });
      logCombat(`🩸 ${m.name} восстанавливает ${heal} HP.`, 'log-entry monster');
    }
  }
  if (skill.atbCut && landed > 0) {
    state.battle.playerATB = Math.max(0, (state.battle.playerATB || 0) - skill.atbCut);
    logCombat(`⚡ ${m.name} сбивает вашу шкалу хода на ${Math.round(skill.atbCut * 100)}%.`, 'log-entry monster');
  }
}

// Меч: тварь парирует обычный физический удар героя. true — удар отбит.
function tryMonsterParry(m) {
  if (m.weapon !== 'swords') return false;
  const chance = WEAPON_CATEGORY_TRAITS.swords.parryChance * (m.traitChanceMult || 1);
  if (Math.random() * 100 >= chance) return false;
  spawnFloatDamage('fighter-monster', 0, 'block', { mon: m, text: 'ПАРИРОВАЛ' });
  logCombat(`🛡 ${m.name} парирует удар!`, 'log-entry');
  return true;
}

// Зарубка на герое тает раз в ход стаи (battle-loop.js).
function applyWoundTickOnPlayer() {
  const w = getDebuff('player', 'wound');
  if (!w) return;
  w.turnsLeft = (w.turnsLeft || 0) - 1;
  if (w.turnsLeft <= 0) {
    removeDebuff('player', 'wound');
    logCombat(`🪓 Зарубка затянулась.`, 'log-entry');
  } else {
    renderDebuffBar('player');
  }
}
