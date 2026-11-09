// ========================================================
//  ЯДРО: ПОМОЩНИКИ
//  Маленькие функции, которые нужны везде.
//  + mult() берёт рейт из state.player.cheatRate.
//
//  НОВОЕ (v0.10):
//  + Переработана формула точности/уворота.
//    Цель: при равных уровнях шанс попадания ~70-80%,
//    на 5 уровней ниже ~50%, выше монстра ~95%.
//  + Магу даётся +8 к точности за класс.
//  + Коэффициент уровня одинаковый у игрока и монстра (× 2.5),
//    поэтому шанс не падает с ростом уровня.
//  + Шанс зажат в [25, 95].
//  + Починены бонусы подгонки: accuracyBonus и evasionBonus
//    теперь реально учитываются.
//
//  НОВОЕ (v0.11, групповые бои):
//  + getCurrentMonster() — первый живой моб.
//  + getAliveMonstersCount() — сколько живых.
//  + getTotalMonstersCount() — сколько всего (включая мёртвых).
//  + createMonsterGroup() — создать массив из N мобов.
// ========================================================

// Форматирование времени для таймеров баффов/эффектов.
// Больше 1 минуты → «14м», меньше минуты → «45с».
function formatTime(sec) {
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    return `${m}м`;
  }
  const s = Math.max(0, Math.floor(sec));
  return `${s}с`;
}

// Всплывающая цифра урона/лечения над бойцом
function spawnFloatDamage(elementId, dmg, type) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const float = document.createElement('div');
  float.className = 'float-dmg ' + type;
  if (type === 'heal') float.textContent = `+${dmg}`;
  else if (type === 'food' || type === 'mana') float.textContent = `+${dmg}`;
  else if (type === 'crit') float.textContent = `КРИТ ${dmg}!`;
  else if (type === 'block') float.textContent = `БЛОК`;
  else if (type === 'miss') float.textContent = `ПРОМАХ`;
  else if (type === 'dodge') float.textContent = `УВОРОТ`;
  else float.textContent = `-${dmg}`;
  float.style.left = (rect.left + rect.width / 2 - 20) + 'px';
  float.style.top = (rect.top + 20) + 'px';
  document.body.appendChild(float);
  setTimeout(() => float.remove(), 900);
}

// Запись в лог боя (левая колонка)
// v0.31: note — приписка тусклым шрифтом в той же строке (Цикл мастера, метка, поджог…).
// v0.32: у строки и у каждой части приписки — группа (data-cat) для настроек чата
//        (js/systems/chat-filter.js); cat — явно, иначе угадывается по тексту и классу.
function logCombat(text, cls = 'log-entry', note, cat) {
  const log = document.getElementById('battle-log-combat');
  const div = document.createElement('div');
  div.className = cls; div.textContent = text;
  div.dataset.cat = cat || (typeof guessCombatCat === 'function' ? guessCombatCat(text, cls) : 'sys');
  if (note) {
    String(note).split(' · ').forEach(part => {
      const span = document.createElement('span');
      span.className = 'log-note';
      span.dataset.cat = typeof guessNoteCat === 'function' ? guessNoteCat(part) : 'notes';
      span.textContent = ' · ' + part;
      div.appendChild(span);
    });
  }
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  while (log.children.length > 500) log.removeChild(log.firstChild);
}

// Запись в лог добычи (правая колонка)
// v0.31: note — приписка тусклым шрифтом в той же строке («· 🐾 стая ×5: +20%»), чтобы не занимать отдельную строку.
// v0.32: группа строки (data-cat) — для настроек чата.
function logLoot(text, cls = 'log-loot', note) {
  const log = document.getElementById('battle-log-loot');
  const div = document.createElement('div');
  div.className = cls; div.textContent = text;
  div.dataset.cat = typeof guessLootCat === 'function' ? guessLootCat(cls) : 'sys';
  if (note) {
    const span = document.createElement('span');
    span.className = 'log-note';
    span.textContent = ' · ' + note;
    div.appendChild(span);
  }
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  while (log.children.length > 500) log.removeChild(log.firstChild);
}

// v0.30: окончания под пол героя. «{м|ж}» в тексте → первое для мужского, второе для женского.
// Пример: «Я очутил{ся|ась}», «Слушай, {парень|дочка}». Пол — state.player.gender ('f' — женский).
// Пол пока не выбирается, поэтому везде мужской; когда появятся героини — тексты переписывать не придётся.
function heroText(str) {
  const female = state.player && state.player.gender === 'f';
  return String(str).replace(/\{([^{}|]*)\|([^{}]*)\}/g, (_, m, f) => (female ? f : m));
}

// v0.36: города — безопасные локации с лавками. 'town' — Андервуд, 'ilgrad' — Ильград (js/systems/ilgrad.js).
// «Герой в городе» проверять через isTownLoc, а не === 'town' (Старейшина — только в Андервуде).
const TOWN_LOCS = ['town', 'ilgrad'];
function isTownLoc(loc) {
  return TOWN_LOCS.includes(loc === undefined ? (state.player && state.player.currentLocation) : loc);
}

// v0.35.1: раса героя — для реплик жителей ('human' | 'orc' | 'elf' | 'drow' | 'dwarf').
function heroRace(...ids) {
  const r = (state.player && state.player.raceId) || 'human';
  return ids.length ? ids.includes(r) : r;
}

// Множитель рейтов (опыт, золото, дроп).
// Берётся из state.player.cheatRate. Если там 0/undefined — считаем 1.
function mult() {
  const rate = (state.player && state.player.cheatRate) || 1;
  return rate > 0 ? rate : 1;
}

// ========================================================
//  ТОЧНОСТЬ И УВОРОТ (v0.10)
//
//  Формула:
//    acc = √DEX × 6 + уровень × 2.5 + бонусы
//    eva = √DEX × 6 + уровень × 2.5 + бонусы (щит −5)
//
//  Бонус магу: +8 к точности (компенсация низкого DEX).
//
//  Шанс попадания:
//    chance = 70 + 2 × (acc − eva), зажат в [25, 95]
//
//  Монстры:
//    acc_monster = уровень × 2.5 + 33 + 1.3 × (уровень − 5)  (v0.34.1: надбавка с 6-го уровня)
//    eva_monster = уровень × 2.5 + 30
//
//  Итог: при равных уровнях шанс ~70-80%, шанс
//  НЕ падает с ростом уровня, потому что коэффициент
//  уровня у всех одинаковый (× 2.5).
// ========================================================

// Бонус точности за класс.
// Магу даём +8 — компенсация низкого DEX.
function getClassAccuracyBonus(classId) {
  if (classId === 'mage') return 8;
  return 0;
}

// Точность игрока.
function getPlayerAccuracy() {
  const p = state.player;
  const dex = p.effDEX || p.DEX || 0;
  const lvl = p.level || 1;

  let acc = Math.sqrt(dex) * 6 + lvl * 2.5;

  // Бонус класса (магу +8).
  acc += getClassAccuracyBonus(p.classId);

  // Бонус оружия (дубина +4, меч 0, кинжал/лук/копьё/арбалет −4).
  const weapon = p.equipment.weapon;
  const category = weapon ? getWeaponCategory(weapon.name) : null;
  acc += getWeaponAccuracyBonus(category);

  // v0.27: парное оружие — точность −4.
  if (getOffhandWeapon()) acc -= DUAL_WIELD_ACCURACY_PENALTY;

  // Бонусы подгонки (v0.10 — теперь учитываются).
  acc += (p.accuracyBonus || 0);

  return Math.round(acc);
}

// v0.19.1: перевес в уровнях над монстром даёт уворот максимум за 3 уровня.
// Иначе к 19 уровню мобы 5–10 уровня почти всегда мажут (упирались в 25%).
const EVASION_LEVEL_GAP_CAP = 3;

// v0.27: штраф уворота от стиля боя. С щитом и двуручным сильно не поуворачиваешься.
// Может быть отрицательным: «Свободная рука» даёт уворот.
const SHIELD_EVASION_PENALTY = 5;
const TWO_HAND_EVASION_PENALTY = 8;
// v0.27: монстр попадает минимум в 35% случаев (уворот не выше 65%). Удары героя — порог 25%, как был.
const MONSTER_MIN_HIT_CHANCE = 35;

function getWeaponStyleEvasionPenalty() {
  const p = state.player;
  let pen = 0;
  if (getEquippedShield()) pen += SHIELD_EVASION_PENALTY;
  if (getOffhandWeapon()) pen += DUAL_WIELD_EVASION_PENALTY;
  if (hasFreeHandStyle()) pen -= FREE_HAND_EVASION_BONUS;   // «Свободная рука» — бонус, а не штраф
  if (typeof isTwoHandGripWeapon === 'function' && isTwoHandGripWeapon(p.equipment.weapon) && !(typeof isMage === 'function' && isMage())) {
    pen += TWO_HAND_EVASION_PENALTY;
  }
  return pen;
}

// Уворот игрока.
// attacker — монстр, который бьёт (необязательно). Если передан, часть уворота
// «от уровня» считается не выше, чем (уровень монстра + 3).
// Без attacker (панель персонажа) — полный уворот.
function getPlayerEvasion(attacker) {
  const p = state.player;
  const dex = p.effDEX || p.DEX || 0;
  let lvl = p.level || 1;
  if (attacker && attacker.level) lvl = Math.min(lvl, attacker.level + EVASION_LEVEL_GAP_CAP);

  let eva = Math.sqrt(dex) * 6 + lvl * 2.5;

  // Стиль боя (v0.27): щит −5, двуручное −8 (посохи магов — без штрафа).
  eva -= getWeaponStyleEvasionPenalty();

  // Бонусы подгонки (v0.10 — теперь учитываются).
  eva += (p.evasionBonus || 0);

  if (attacker && attacker.heroEvaMult) eva *= attacker.heroEvaMult;   // v0.36: Чуткий

  return Math.round(eva);
}

// v0.34.1: точность монстров с 6-го уровня растёт быстрее — догоняет уворот, который герой
// набирает подгонкой (+1 Уворот в случайных бонусах) и ловкостью с редкости.
// По симулятору к 20 ур. уворот героя ~92, и Каменный голем (15 ур.) попадал лишь в ~38%.
// Теперь средний герой своего уровня получает ~65%, уворотчик («Свободная рука») — ~40%.
// Поляна (ур. 1–5) — как было: там подгонки почти нет.
const MONSTER_ACC_EXTRA_FROM_LEVEL = 5;     // с какого уровня монстра начинается надбавка
const MONSTER_ACC_EXTRA_PER_LEVEL = 1.3;    // сколько точности сверху за каждый уровень выше

// Точность монстра.
function getMonsterAccuracy(monster) {
  const lvl = (monster && monster.level) || 1;
  const extra = Math.max(0, lvl - MONSTER_ACC_EXTRA_FROM_LEVEL) * MONSTER_ACC_EXTRA_PER_LEVEL;
  // v0.33: монстр с душой самоцвета метче (accMult ×1.2…×1.6, battle-souls.js)
  return Math.round((lvl * 2.5 + 33 + extra) * ((monster && monster.accMult) || 1));
}

// Уворот монстра.
function getMonsterEvasion(monster) {
  const lvl = (monster && monster.level) || 1;
  return Math.round((lvl * 2.5 + 30) * ((monster && monster.evaMult) || 1));   // v0.36: Смрад, Непоколебимый
}

// Шанс попадания: 70 + 2 × (Точность − Уворот), зажат в [25, 95].
// minChance — нижний порог (по умолчанию 25%; удары монстров по герою — MONSTER_MIN_HIT_CHANCE).
function getHitChance(attackerAccuracy, targetEvasion, minChance = 25) {
  let chance = 70 + 2 * (attackerAccuracy - targetEvasion);
  if (chance < minChance) chance = minChance;
  if (chance > 95) chance = 95;
  return chance;
}

// Бросок на попадание. true — попал, false — промах.
function rollHit(attackerAccuracy, targetEvasion, minChance) {
  const chance = getHitChance(attackerAccuracy, targetEvasion, minChance);
  return Math.random() * 100 < chance;
}

// ========================================================
//  ГРУППОВЫЕ БОИ: ПОМОЩНИКИ (v0.11)
// ========================================================

// Возвращает первого живого моба из группы.
// Если группа пуста или все мертвы — null.
function getCurrentMonster() {
  if (!state.battle || !Array.isArray(state.battle.monsters)) return null;
  // v0.20: цель, выбранная игроком тапом, главнее всего (и лука тоже)
  if (typeof getManualTarget === 'function') {
    const mt = getManualTarget();
    if (mt) return mt;
  }
  // v0.19: лук выбирает цель сам (самого раненого) — см. updateBowFocus()
  const f = state.battle.focusIdx;
  if (f !== null && f !== undefined) {
    const fm = state.battle.monsters.find(m => m.index === f && m.hp > 0);
    if (fm) return fm;
  }
  return state.battle.monsters.find(m => m.hp > 0) || null;
}

// Сколько мобов в группе ещё живы.
function getAliveMonstersCount() {
  if (!state.battle || !Array.isArray(state.battle.monsters)) return 0;
  return state.battle.monsters.filter(m => m.hp > 0).length;
}

// Сколько всего мобов в группе (включая мёртвых).
function getTotalMonstersCount() {
  if (!state.battle || !Array.isArray(state.battle.monsters)) return 0;
  return state.battle.monsters.length;
}

// Создаёт массив мобов из шаблона.
// template — запись из MONSTERS или MINE_MONSTERS.
// variantId — 'normal' / 'ancient' / 'bloody'.
// count — сколько мобов.
// Каждому мобу даётся уникальный index (0, 1, 2, ...).
function createMonsterGroup(template, variantId, count) {
  const group = [];
  const n = Math.max(1, Math.min(10, count || 1)); // зажимаем 1-10

  for (let i = 0; i < n; i++) {
    const m = buildMonsterInstance(template, variantId || 'normal');
    m.index = i;              // ← уникальный индекс в группе
    m.templateId = template.id;
    m.atb = 0;                // v0.23: своя шкала ATB у каждого моба
    group.push(m);
  }
  return group;
}

// v0.23: сбить ATB стаи на долю (0.15 = 15%).
// Сбивает шкалу КАЖДОМУ живому мобу и «часы стаи» (по ним пока идут тики дебаффов).
function cutMonstersATB(fraction) {
  const b = state.battle;
  b.monstersATB = Math.max(0, (b.monstersATB || 0) - fraction);
  (b.monsters || []).forEach(m => { if (m.hp > 0) m.atb = Math.max(0, (m.atb || 0) - fraction); });
}