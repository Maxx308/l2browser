// ========================================================
//  СИСТЕМЫ: ПОДКЛАССЫ (v0.38)
//  Данные — js/data/subclasses.js.
//
//  1) Подмена навыков: у подкласса три старые активки меняются (mods).
//     id навыка прежний, поэтому меняем сами записи SKILLS[id] под текущего героя
//     (applySubclassSkills, зовётся из recalcStats). Оригиналы хранятся в SC_BASE.
//  2) Посвящение в Храме Ильграда (с SUBCLASS_MIN_LEVEL), смена за SUBCLASS_CHANGE_PRICE.
//  3) Очки навыков: с 26 уровня по 3 (героям выше 25 — доплата при загрузке).
//  4) Бой: механики подклассов (Страж стены, Егерь, Храмовник).
// ========================================================

if (typeof ANNALS_FIRSTS !== 'undefined') ANNALS_FIRSTS.subclass = SUBCLASS_ANNAL;

// ---------- 1. ПОДМЕНА НАВЫКОВ ----------
const SC_MOD_FIELDS = ['name', 'levels', 'maxLevel', 'getDesc', 'getNextDesc', 'stunChance', 'challengeTurns', 'challengePct', 'hits', 'useCheck', 'freezeChance', 'minHpPercent', 'rotMaxLayers', 'isHeal'];
const SC_BASE = {};          // id → исходные поля навыка
let scAppliedFor = undefined;   // какой подкласс сейчас вписан в SKILLS

function getPlayerSubclass() {
  const p = state.player;
  return (p && p.subclass && SUBCLASSES[p.subclass]) ? SUBCLASSES[p.subclass] : null;
}
function hasSubclass(id) {
  // v0.38: в бандле функции видны раньше, чем объявлен state (Энциклопедия при загрузке считает шанс подгонки) — тогда подкласса нет.
  try { return !!(state.player && state.player.subclass === id); } catch (e) { return false; }
}
// Подклассы расы-класса героя, в порядке Храма.
function subclassesForPlayer() {
  const p = state.player;
  return Object.values(SUBCLASSES).filter(s => s.race === p.raceId && s.cls === p.classId);
}

function applySubclassSkills() {
  const sc = getPlayerSubclass();
  const want = sc ? sc.id : null;
  if (scAppliedFor === want) return;
  // вернуть всё, что меняли раньше
  Object.keys(SC_BASE).forEach(id => {
    const s = SKILLS[id], base = SC_BASE[id];
    SC_MOD_FIELDS.forEach(f => { if (base[f] === undefined) delete s[f]; else s[f] = base[f]; });
  });
  if (sc) {
    Object.keys(sc.mods).forEach(id => {
      const s = SKILLS[id], mod = sc.mods[id];
      if (!s) return;
      if (!SC_BASE[id]) {
        SC_BASE[id] = {};
        SC_MOD_FIELDS.forEach(f => { SC_BASE[id][f] = s[f]; });
      }
      SC_MOD_FIELDS.forEach(f => { if (mod[f] !== undefined) s[f] = mod[f]; });
      s.maxLevel = mod.levels ? mod.levels.length : s.maxLevel;
    });
  }
  scAppliedFor = want;
}

// Навык подкласса (новый) — виден только с этим подклассом.
function isSubclassSkillAvailable(skill, player) {
  return !skill.subclassId || player.subclass === skill.subclassId;
}

// ---------- 3. ОЧКИ НАВЫКОВ ----------
const SKILL_POINTS_BOOST_FROM = SUBCLASS_MIN_LEVEL + 1;   // 26
function skillPointsForLevel(level) {
  if (level >= SKILL_POINTS_BOOST_FROM) return 3;
  return level >= 9 ? 2 : 1;
}

// При загрузке: подкласс чужой расы/класса — снять; героям выше 25 доплатить третье очко.
function subclassOnLoad() {
  const p = state.player;
  if (!p) return;
  if (p.subclass) {
    const sc = SUBCLASSES[p.subclass];
    if (!sc || sc.race !== p.raceId || sc.cls !== p.classId) p.subclass = null;
  }
  const owed = Math.max(0, (p.level || 1) - SUBCLASS_MIN_LEVEL);
  const paid = p.skillPts26 || 0;
  if (owed > paid) {
    const add = owed - paid;
    p.skillPoints = (p.skillPoints || 0) + add;
    p.skillPts26 = owed;
    setTimeout(() => {
      if (typeof showToast === 'function') showToast('✦', `+${add} очков навыков: с 26 уровня теперь по 3`);
      if (typeof logLoot === 'function') logLoot(`✦ С 26 уровня за уровень даётся 3 очка навыков. Начислено за прошлые уровни: +${add}.`, 'log-info');
    }, 2100);
  }
  if (typeof ensureSkillSlotsLength === 'function') ensureSkillSlotsLength();   // 4-я ячейка только с подклассом
  scAppliedFor = undefined;
  applySubclassSkills();
}

// ---------- 2. ХРАМ: ПОСВЯЩЕНИЕ ----------
let scPicked = null;   // подкласс, на который смотрит игрок (до подтверждения)
let scJustDedicated = null;

function ensureSubclassOverlay() {
  let ov = document.getElementById('sc-overlay');
  if (ov) return ov;
  ov = document.createElement('div');
  ov.className = 'sc-overlay overlay-base';
  ov.id = 'sc-overlay';
  ov.innerHTML = `
    <div class="sc-window window-base">
      <div class="window-header">
        <div class="window-title">✦ ХРАМ · ПОСВЯЩЕНИЕ</div>
        <div class="window-header-actions"><button class="btn danger" onclick="closeSubclassTemple()">Закрыть</button></div>
      </div>
      <div class="window-content"><div class="sc-pane" id="sc-pane"></div></div>
    </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) closeSubclassTemple(); });
  document.body.appendChild(ov);
  return ov;
}

function openSubclassTemple() {
  if (state.player.currentLocation !== 'ilgrad') return;
  if (typeof cancelWaitingForResume === 'function') cancelWaitingForResume('открыт храм');
  scPicked = null;
  scJustDedicated = null;
  ensureSubclassOverlay().classList.add('active');
  renderSubclassTemple();
}
function closeSubclassTemple() {
  const ov = document.getElementById('sc-overlay');
  if (ov) ov.classList.remove('active');
}

function scCardHtml(sc, mode) {
  const role = SUBCLASS_ROLES[sc.role] || { name: '', icon: '' };
  const p = state.player;
  const mine = p.subclass === sc.id;
  let action = '';
  if (mode === 'locked') action = '';
  else if (!sc.ready) action = `<button class="btn" disabled>Путь ещё не открыт</button>`;
  else if (mine) action = `<div class="sc-mine">✦ Твой путь</div>`;
  else if (p.subclass) action = `<button class="btn" onclick="scPick('${sc.id}')">Просить иного знака — ${SUBCLASS_CHANGE_PRICE.toLocaleString('ru-RU')} 🪙</button>`;
  else action = `<button class="btn success" onclick="scPick('${sc.id}')">Смотреть на эту свечу</button>`;
  const cls = 'sc-card' + (mine ? ' sc-card-mine' : '') + (!sc.ready ? ' sc-card-closed' : '') + (scPicked === sc.id ? ' sc-card-picked' : '');
  return `<div class="${cls}">
    <div class="sc-portrait"><img src="${sc.portrait}" alt="" loading="lazy"><div class="sc-candle"></div></div>
    <div class="sc-role">${role.icon} ${role.name}</div>
    <div class="sc-name">${sc.name}</div>
    <div class="sc-blurb">${sc.blurb}</div>
    <div class="sc-action">${action}</div>
  </div>`;
}

function renderSubclassTemple() {
  const pane = document.getElementById('sc-pane');
  if (!pane) return;
  const p = state.player;
  const list = subclassesForPlayer();
  const cur = getPlayerSubclass();

  // После посвящения — отдельный экран.
  if (scJustDedicated) {
    const sc = SUBCLASSES[scJustDedicated];
    pane.innerHTML = `
      <div class="sc-dedicated">
        <div class="sc-portrait sc-portrait-big"><img src="${sc.portrait}" alt=""><div class="sc-candle sc-candle-lit"></div></div>
        <div class="sc-dedicated-text">
          <div class="sc-name">${sc.name}</div>
          <p>*Свеча у образа горит ровно и ярко. Мать Исмера касается твоего плеча.*</p>
          <p>— Боги сказали своё слово. Отныне ты — <b>${sc.name}</b>. Таинство откроет тебе новые приёмы.</p>
          <p class="sc-hint">Изменились три приёма класса (теперь до 7 уровня), открылись новые навыки подкласса. Очки — в Таинстве.</p>
          <div class="sc-buttons">
            <button class="btn success" onclick="closeSubclassTemple(); openMentor(); if (typeof applyTownWindowTitles === 'function') applyTownWindowTitles();">✦ Открыть Таинство</button>
            <button class="btn" onclick="closeSubclassTemple()">Закрыть</button>
          </div>
        </div>
      </div>`;
    return;
  }

  let intro, mode = '';
  if (p.level < SUBCLASS_MIN_LEVEL) {
    mode = 'locked';
    intro = `*У алтаря три свечи — каждая у своего образа. Ни одна не горит.*<br>Мать Исмера качает головой: — Рано. Боги говорят с теми, кто прошёл долгий путь. Приходи, когда окрепнешь. <span class="sc-req">С ${SUBCLASS_MIN_LEVEL} уровня</span>`;
  } else if (!cur) {
    intro = `*У алтаря три свечи — каждая у своего образа.*<br>Мать Исмера: — Встань и смотри. Боги сами укажут тебе путь — та свеча, что вспыхнет, и есть твой знак.`;
  } else {
    intro = `*Свеча у образа «${cur.name}» горит ровно.*<br>Мать Исмера: — Знак тебе уже дан. Но боги милостивы — если сердце просит иного, принеси дар храму, и мы спросим снова.`;
  }

  let confirmHtml = '';
  if (scPicked && SUBCLASSES[scPicked]) {
    const sc = SUBCLASSES[scPicked];
    const price = cur ? SUBCLASS_CHANGE_PRICE : 0;
    const priceTxt = price ? ` Дар храму — <b>${price.toLocaleString('ru-RU')} 🪙</b>. Вложенные в прежний путь очки вернутся.` : '';
    confirmHtml = `<div class="sc-confirm">
      <p>*Свеча у образа «${sc.name}» вспыхивает ярче остальных.*${priceTxt}</p>
      <div class="sc-buttons">
        <button class="btn success" onclick="scAccept()">✦ Принять знак</button>
        <button class="btn" onclick="scPick(null)">Отвести взгляд</button>
      </div>
    </div>`;
  }

  pane.innerHTML = `
    <div class="sc-intro">${intro}</div>
    <div class="sc-grid">${list.map(sc => scCardHtml(sc, mode)).join('')}</div>
    ${confirmHtml}
    <div class="sc-foot">Пока игра в бете, путь можно сменить: ${SUBCLASS_CHANGE_PRICE.toLocaleString('ru-RU')} 🪙, вложенные очки возвращаются.</div>`;
  if (confirmHtml) {
    const c = pane.querySelector('.sc-confirm');
    if (c && c.scrollIntoView) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function scPick(id) {
  if (id && (!SUBCLASSES[id] || !SUBCLASSES[id].ready)) return;
  scPicked = id;
  renderSubclassTemple();
}

// Вернуть очки, вложенные в навыки прежнего подкласса (вызывать ДО смены p.subclass).
function subclassRefund(oldId) {
  const p = state.player;
  const sc = SUBCLASSES[oldId];
  if (!sc) return 0;
  let back = 0;
  Object.keys(sc.mods).forEach(id => {
    const lvl = p.learnedSkills[id] || 0;
    if (lvl > 5) { back += lvl - 5; p.learnedSkills[id] = 5; }
  });
  Object.values(SKILLS).forEach(s => {
    if (s.subclassId !== oldId) return;
    const lvl = p.learnedSkills[s.id] || 0;
    if (lvl > 0) back += lvl;
    delete p.learnedSkills[s.id];
    if (Array.isArray(p.skillSlots)) p.skillSlots = p.skillSlots.map(x => (x === s.id ? null : x));
    if (state.battle && state.battle.skillToggles) delete state.battle.skillToggles[s.id];
  });
  p.skillPoints = (p.skillPoints || 0) + back;
  return back;
}

function scAccept() {
  const p = state.player;
  const id = scPicked;
  const sc = SUBCLASSES[id];
  if (!sc || !sc.ready || sc.race !== p.raceId || sc.cls !== p.classId) return;
  if (p.level < SUBCLASS_MIN_LEVEL) return;
  if (p.subclass === id) return;
  if (state.battle && state.battle.active) { showToast('⚔', 'Сначала закончи бой'); return; }
  const changing = !!p.subclass;
  if (changing) {
    if (p.gold < SUBCLASS_CHANGE_PRICE) { showToast('🪙', `Нужен дар храму: ${SUBCLASS_CHANGE_PRICE.toLocaleString('ru-RU')} Оболов`); return; }
    p.gold -= SUBCLASS_CHANGE_PRICE;
    const back = subclassRefund(p.subclass);
    logCombat(`✦ Иной знак. Возвращено очков навыков: ${back}. (−${SUBCLASS_CHANGE_PRICE} 🪙)`, 'log-entry levelup');
  }
  p.subclass = id;
  if (typeof ensureSkillSlotsLength === 'function') ensureSkillSlotsLength();   // открылась 4-я ячейка
  applySubclassSkills();
  recalcStats();
  updateCharacterPanel();
  updateTopStatus();
  updateSkillPointsBadge();
  if (typeof renderSkillSlots === 'function') renderSkillSlots();
  if (typeof renderSkillLoadout === 'function') renderSkillLoadout();
  if (typeof annalsFirst === 'function') annalsFirst('subclass', { name: sc.name }, { loc: 'ilgrad' });
  logCombat(`✦ Посвящение: ${p.name} — ${sc.name}.`, 'log-entry levelup');
  if (!changing) logCombat('✦ Открылась 4-я ячейка навыков. Поставить навык в неё можно в Инвентаре.', 'log-entry levelup');
  showToast('✦', `Посвящение: ${sc.name}`);
  // Гибрид: сумка проговаривается (очень завуалированно — про Воича). Один раз на героя.
  if (sc.role === 'hybrid' && typeof bagMet === 'function' && bagMet() && typeof addChronicleEntry === 'function') {
    const c = p.chronicle;
    if (c && !(c.firsts && c.firsts.bagHybrid)) {
      if (!c.firsts) c.firsts = {};
      c.firsts.bagHybrid = Date.now();
      addChronicleEntry('Знал я когда-то одного такого. Нет. Не знал.', { speaker: 'bag', loc: 'ilgrad' });
      setTimeout(() => showToast('🎒', `${bagSpeakerName()}: «Знал я когда-то одного такого. Нет. Не знал.»`), 1800);
    }
  }
  scPicked = null;
  scJustDedicated = id;
  renderSubclassTemple();
  saveCurrentSlot();
}

// ---------- 4. БОЙ ----------
DEBUFF_DEFS.challenged = { icon: '📣', name: 'Вызов', cssClass: 'debuff-confused',
  tooltip: (d) => `Вызов · бьёт только героя, получает +${SKILLS.whirlwind.challengePct || 15}% урона · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.holdLine = { icon: '🛡', name: 'Глухая оборона', cssClass: 'debuff-guard',
  tooltip: (d) => `Глухая оборона · входящий урон −${d.cut}% · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.lastStand = { icon: '🏰', name: 'Последний рубеж', cssClass: 'debuff-guard',
  tooltip: (d) => `Последний рубеж · входящий урон −${d.cut}% · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.retortCd = { icon: '⏳', name: 'Ответ щита: перезарядка', cssClass: 'debuff-paraimmune',
  tooltip: (d) => `Ответ щита перезаряжается · ещё ${d.turnsLeft} ход.` };
DEBUFF_DEFS.zeal = { icon: '🎲', name: 'Азарт', cssClass: 'debuff-rune',
  displayCount: (d) => d.stacks || 0,
  tooltip: (d) => `Азарт ${d.stacks || 0}/${JAEGER_ZEAL_MAX} · копится на критах, тратят Добивание и Ускользнуть. Сгорает после боя.` };
DEBUFF_DEFS.jgMark = { icon: '🎯', name: 'Метка егеря', cssClass: 'debuff-confused',
  displayCount: () => '',
  tooltip: () => { const l = state.player.learnedSkills.jgMark || 1; return `Метка егеря · +${SKILLS.jgMark.levels[l - 1].bonus}% урона героя, крит по ней — 2 заряда Азарта.`; } };
DEBUFF_DEFS.evade = { icon: '💨', name: 'Ускользнуть', cssClass: 'debuff-guard',
  displayCount: (d) => d.charges || 0,
  tooltip: (d) => `Ускользнуть · ещё ${d.charges || 0} атак(и) твари пройдут мимо.` };
DEBUFF_DEFS.seal = { icon: '✴', name: 'Печать света', cssClass: 'debuff-rune',
  tooltip: (d) => `Печать света · удар оружием +${d.pct}% силы света · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.radiance = { icon: '☀', name: 'Сияние', cssClass: 'debuff-rune',
  displayCount: (d) => d.turn || 0,
  tooltip: (d) => `Сияние · ход ${d.turn || 0}/${SKILLS.tpRadiance.maxTurns} разгона.` };

// Нежить — твари с тегом «Мёртвый».
function scIsUndead(m) {
  return !!(m && m.tags && m.tags.includes('dead'));
}
function scSkillLvl(id) { return state.player.learnedSkills[id] || 0; }
function scSkillData(id) { const l = scSkillLvl(id); return l ? SKILLS[id].levels[l - 1] : null; }
// Данные изменённой активки подкласса (поля mods, которых нет в SKILLS).
function scMod(subId, skillId) {
  return hasSubclass(subId) ? SUBCLASSES[subId].mods[skillId] : null;
}

function subclassOnBattleStart() {
  const b = state.battle;
  b.scLastStandUsed = false;
  b.tpRadTurn = 0;
  b.elLastElem = null;
  b.prBarrier = 0;
  b.prCleanseAcc = 0;
  b.nmCorpse = null;
  b.bkPaid = 0; b.bkThirst = false;
  if (typeof alliesClear === 'function') alliesClear();   // слуги прошлого боя рассыпались
  if (scIsElf()) elfOnBattleStart(); else { b.drSpirit = null; b.drGrowth = 0; }   // дух Друида живёт всю охоту
  if (scIsDrow()) drowOnBattleStart();
  if (scIsDwarf()) dwarfOnBattleStart();
}

// Таймеры, которые считаются ходами героя.
const SC_PLAYER_TIMERS = ['holdLine', 'lastStand', 'retortCd', 'seal', 'intercedeCd', 'trance', 'frenzy', 'ancestor', 'bondCd', 'guardianCd', 'thirstCd', 'bark', 'rooting', 'wind', 'budCd', 'stormArmor', 'double', 'haste', 'mistCd', 'shadowStep', 'stormFront', 'closeArmor', 'bellows', 'runeGuard', 'wardCd'];
const SC_MONSTER_TIMERS = ['challenged', 'weakened', 'shock', 'curseAche', 'rooted', 'webbed'];

// Начало хода героя: таймеры подкласса, Сияние, Благословение, ход слуг.
function subclassOnHeroTurn() {
  const b = state.battle;
  if (!b || !b.debuffs) return;
  SC_PLAYER_TIMERS.forEach(id => {
    const d = getDebuff('player', id);
    if (!d) return;
    d.turnsLeft = (d.turnsLeft || 1) - 1;
    if (d.turnsLeft <= 0) removeDebuff('player', id);
    else renderDebuffBar('player');
  });
  const mons = b.debuffs.monsters || {};
  let changed = false;
  Object.keys(mons).forEach(idx => {
    SC_MONSTER_TIMERS.forEach(id => {
      const d = mons[idx] && mons[idx][id];
      if (!d) return;
      d.turnsLeft = (d.turnsLeft || 1) - 1;
      if (d.turnsLeft <= 0) delete mons[idx][id];
      changed = true;
    });
  });
  if (changed) renderDebuffBar('monster');
  if (scIsOrc()) orcOnHeroTurn();
  if (scIsElf()) elfOnHeroTurn();
  if (scIsDrow()) drowOnHeroTurn();
  if (scIsDwarf()) dwarfOnHeroTurn();
  templarRadianceTick();
  priestBlessingTick();
  if (typeof alliesAct === 'function') alliesAct();
}

// Ослабление твари (Оковы света, Проклятие слабости): множитель её урона.
function subclassMonsterWeakMult(m) {
  const w = m ? getDebuff('monster', 'weakened', m.index) : null;
  return w ? 1 - (w.pct || 0) / 100 : 1;
}

// Множитель входящего урона (Глухая оборона, Последний рубеж, Обет, Благословение, ослабление твари).
function subclassDamageTakenMult(attacker) {
  if (scIsDwarf()) return dwarfDamageTakenMult(attacker);
  if (scIsDrow()) return drowDamageTakenMult(attacker, arguments[1]);
  if (scIsElf()) return elfDamageTakenMult(attacker);
  if (scIsOrc()) return orcDamageTakenMult(attacker);
  let mult = 1;
  const hold = getDebuff('player', 'holdLine');
  if (hold) mult *= 1 - (hold.cut || 0) / 100;
  const ls = getDebuff('player', 'lastStand');
  if (ls) mult *= 1 - (ls.cut || 0) / 100;
  const bl = getDebuff('player', 'blessing');
  if (bl) mult *= 1 - (bl.cut || 0) / 100;
  if (attacker && hasSubclass('human_templar') && scIsUndead(attacker)) {
    const v = scSkillData('tpVow');
    if (v) mult *= 1 - v.pct / 100;
  }
  if (attacker) mult *= subclassMonsterWeakMult(attacker);
  return mult;
}

// Прибавка к блоку (Глухая оборона со щитом).
function subclassBlockBonus() {
  return (getDebuff('player', 'holdLine') && getEquippedShield()) ? (SKILLS.wgHoldLine.shieldBlock || 0) : 0;
}

// Множитель ВСЕГО урона героя по твари (зовётся из monsterTagDmg):
// Вызов (Страж стены), Метка и Серебряный наконечник (Егерь), Обет (Храмовник).
function subclassHeroDmgMult(m) {
  if (scIsDwarf()) return dwarfHeroDmgMult(m);
  if (scIsDrow()) return drowHeroDmgMult(m);
  if (scIsElf()) return elfHeroDmgMult(m);
  if (scIsOrc()) return orcHeroDmgMult(m);
  if (!m) return 1;
  const p = state.player;
  let mult = 1;
  if (p.subclass === 'human_wallguard') {
    if (getDebuff('monster', 'challenged', m.index)) mult *= 1 + (SKILLS.whirlwind.challengePct || 15) / 100;
  } else if (p.subclass === 'human_huntsman') {
    if (getDebuff('monster', 'jgMark', m.index) && semiPassiveReady('jgMark')) mult *= 1 + scSkillData('jgMark').bonus / 100;
    if (scIsUndead(m) && scSkillData('jgSilver')) mult *= 1 + scSkillData('jgSilver').undead / 100;
  } else if (p.subclass === 'human_templar') {
    if (scIsUndead(m) && scSkillData('tpVow')) mult *= 1 + scSkillData('tpVow').pct / 100;
  } else if (p.subclass === 'human_elementalist') {
    const f = scSkillData('elFusion');
    if (f && elementalistEffectsOn(m) >= 2) mult *= 1 + f.pct / 100;
  }
  return mult;
}
// Старое имя (Страж стены) — для совместимости вызовов.
function subclassChallengeMult(m) { return subclassHeroDmgMult(m); }

// Сила крита: Глаз егеря (лук / арбалет / кинжал).
function subclassCritMultBonus(cat) {
  if (scIsOrc()) return orcCritMultBonus(cat);
  if (!hasSubclass('human_huntsman') || !JAEGER_WEAPONS.includes(cat)) return 0;
  const d = scSkillData('jgEye');
  return d ? d.critDmg / 100 : 0;
}

// ---- Страж стены: щит ----
// Защита и поглощение надетого щита с учётом «Мастера щита».
function wallguardShieldStats() {
  const sh = getEquippedShield();
  if (!sh) return null;
  const def = getItemStat(sh, 'pDef') || 0;
  const absorb = (sh.stats && sh.stats.flatDamageReduce) || 0;
  const mLvl = state.player.learnedSkills.wgShieldMastery || 0;
  const pct = mLvl > 0 ? SKILLS.wgShieldMastery.levels[mLvl - 1].shieldPct : 0;
  return { def: def * (1 + pct / 100), absorb: absorb * (1 + pct / 100), pct };
}

// Пассивки подклассов в recalcStats (после основных пассивок).
function subclassApplyPassives(p) {
  if (scIsDwarf()) { dwarfApplyPassives(p); return; }
  if (scIsDrow()) { drowApplyPassives(p); return; }
  if (scIsElf()) { elfApplyPassives(p); return; }
  if (scIsOrc()) { orcApplyPassives(p); return; }
  if (p.subclass === 'human_wallguard') {
    const mLvl = p.learnedSkills.wgShieldMastery || 0;
    if (mLvl > 0 && getEquippedShield()) {
      const d = SKILLS.wgShieldMastery.levels[mLvl - 1];
      const sh = getEquippedShield();
      const addDef = Math.round((getItemStat(sh, 'pDef') || 0) * d.shieldPct / 100);
      const addAbs = ((sh.stats && sh.stats.flatDamageReduce) || 0) * d.shieldPct / 100;
      p.blockChance += d.block;
      p.pDef += addDef;
      p.flatDamageReduce += addAbs;
      p.skillBonuses.push(`Мастер щита (ур.${mLvl}): +${d.block}% блока, защита щита +${addDef}, поглощение +${addAbs.toFixed(1)}`);
    }
    const lsLvl = p.learnedSkills.wgLastStand || 0;
    if (lsLvl > 0) p.skillBonuses.push(`Последний рубеж (ур.${lsLvl}): раз за бой выжить с 1 HP`);
  } else if (p.subclass === 'human_huntsman') {
    const eye = p.learnedSkills.jgEye || 0;
    const w = p.equipment.weapon;
    const cat = w ? getWeaponCategory(w.name) : null;
    if (eye > 0) {
      const d = SKILLS.jgEye.levels[eye - 1];
      if (JAEGER_WEAPONS.includes(cat)) {
        p.critChance += d.crit;
        p.skillBonuses.push(`Глаз егеря (ур.${eye}): +${d.crit}% крита, +${d.critDmg}% урона крита`);
      } else {
        p.skillBonuses.push(`Глаз егеря (ур.${eye}): не действует — нужен лук, арбалет или кинжал`);
      }
    }
    const sil = p.learnedSkills.jgSilver || 0;
    if (sil > 0) p.skillBonuses.push(`Серебряный наконечник (ур.${sil}): +${SKILLS.jgSilver.levels[sil - 1].undead}% по нежити`);
  } else if (p.subclass === 'human_templar') {
    const vow = p.learnedSkills.tpVow || 0;
    if (vow > 0) { const v = SKILLS.tpVow.levels[vow - 1].pct; p.skillBonuses.push(`Обет против тьмы (ур.${vow}): нежить бьёт на ${v}% слабее, по ней +${v}%`); }
    const bal = p.learnedSkills.tpBalance || 0;
    if (bal > 0) p.skillBonuses.push(`Равновесие (ур.${bal}): +${SKILLS.tpBalance.levels[bal - 1].mp} MP за удар оружием`);
  }
}

// Прибавка к атаке удара навыка: Удар щитом / второй удар Меча и щита — защита щита,
// Карающий удар — часть маг. атаки.
function subclassHitAtk(skillId, hitIndex) {
  if (scIsDwarf()) return dwarfHitAtk(skillId);
  if (scIsDrow()) return drowHitAtk(skillId);
  if (scIsElf()) return elfHitAtk(skillId);
  if (scIsOrc()) return orcHitAtk(skillId);
  const p = state.player;
  if (p.subclass === 'human_wallguard') {
    const sh = wallguardShieldStats();
    if (sh && (skillId === 'powerStrike' || (skillId === 'doubleStrike' && hitIndex === 1))) {
      return Math.floor(sh.def * WALLGUARD_SHIELD_DEF_MULT);
    }
  } else if (p.subclass === 'human_templar' && skillId === 'powerStrike') {
    return Math.floor(p.mAtk * SUBCLASSES.human_templar.mods.powerStrike.magPart);
  }
  return 0;
}
function wallguardHitAtk(skillId, hitIndex) { return subclassHitAtk(skillId, hitIndex); }

// Множитель навыка перед ударом (Добивание Егеря тратит Азарт).
function subclassStrikeMult(skill, data, m, notes) {
  if (scIsDrow()) return drowStrikeMult(skill, data, m, notes);
  if (scIsOrc()) return orcStrikeMult(skill, data, m, notes);
  const mod = scMod('human_huntsman', 'powerStrike');
  if (!mod || skill.id !== 'powerStrike') return data.multiplier;
  const z = jaegerZealTake();
  let mult = data.multiplier + mod.perCharge * z;
  if (m && m.maxHp > 0 && m.hp / m.maxHp * 100 < mod.lowHpPct) { mult *= 1 + mod.lowHpBonus / 100; notes.push('добивание раненого'); }
  notes.push(`🎲 Азарт ×${z}`);
  return mult;
}

// После удара навыка (сильный / двойной). Возвращает приписку или ''.
function subclassAfterStrike(skill, m, hitsLanded, totalDamage) {
  if (scIsDwarf()) return dwarfAfterStrike(skill, m, hitsLanded, totalDamage);
  if (scIsDrow()) return drowAfterStrike(skill, m, hitsLanded, totalDamage);
  if (scIsElf()) return elfAfterStrike(skill, m, hitsLanded, totalDamage);
  if (scIsOrc()) return orcAfterStrike(skill, m, hitsLanded, totalDamage);
  const p = state.player;
  if (p.subclass === 'human_wallguard') {
    if (skill.id !== 'doubleStrike' || hitsLanded < 2 || !m || m.hp <= 0 || !getEquippedShield()) return '';
    if (Math.random() * 100 >= (SKILLS.doubleStrike.stunChance || 0)) return '';
    addDebuff('monster', 'stun', m.index, { turnsLeft: 1 });
    return '💫 оглушён щитом';
  }
  if (p.subclass === 'human_templar') {
    if (skill.id === 'doubleStrike') {
      const d = getSkillData('doubleStrike');
      const heal = aoeHeal(totalDamage * (d.heal || 0) / 100);
      return heal > 0 ? `✚ +${heal} HP` : '';
    }
    if (skill.id === 'powerStrike' && m && m.hp > 0 && scIsUndead(m) &&
        Math.random() * 100 < SUBCLASSES.human_templar.mods.powerStrike.stunUndead) {
      addDebuff('monster', 'stun', m.index, { turnsLeft: 1 });
      return '💫 нежить оглушена светом';
    }
  }
  return '';
}

// Круговой: дополнительные попадания (Волна света — свет от маг. атаки).
function subclassWhirlExtraHits(hits, data) {
  if (!hasSubclass('human_templar')) return [];
  const part = SUBCLASSES.human_templar.mods.whirlwind.magPart;
  return hits.filter(h => !h.miss && h.m).map(h => ({ m: h.m, ...aoeMagHit(h.m, data.multiplier * part, null), type: 'magic', fx: 'slash' }));
}
// После Кругового: Вызов (Страж стены), лечение за задетых (Храмовник).
function subclassAfterWhirl(hits, data) {
  const p = state.player;
  if (p.subclass === 'human_wallguard') {
    const turns = SKILLS.whirlwind.challengeTurns || 3;
    let n = 0;
    hits.forEach(h => {
      if (h.miss || !h.m || h.m.hp <= 0) return;
      addDebuff('monster', 'challenged', h.m.index, { turnsLeft: turns });
      n++;
    });
    // «Бьют только героя» заработает, когда у героев появятся союзники (state.battle.allies).
    return n ? `📣 вызов: ${n}` : '';
  }
  if (p.subclass === 'human_templar') {
    const touched = new Set(hits.filter(h => !h.miss && h.m).map(h => h.m)).size;
    if (!touched) return '';
    const heal = aoeHeal(p.maxHp * (data.heal || 0) / 100 * touched);
    return heal > 0 ? `✚ +${heal} HP` : '';
  }
  return '';
}
function wallguardAfterWhirl(hits) { return subclassAfterWhirl(hits, {}); }

// ---- Егерь: Азарт и Метка ----
function jaegerZeal() {
  const d = getDebuff('player', 'zeal');
  return d ? (d.stacks || 0) : 0;
}
function jaegerZealAdd(n) {
  if (n <= 0) return;
  const cur = jaegerZeal();
  const next = Math.min(JAEGER_ZEAL_MAX, cur + n);
  if (next === cur) return;
  addDebuff('player', 'zeal', { stacks: next, turnsLeft: 999 });
}
function jaegerZealSpend(n) {
  const cur = jaegerZeal();
  const next = Math.max(0, cur - n);
  if (next > 0) addDebuff('player', 'zeal', { stacks: next, turnsLeft: 999 });
  else removeDebuff('player', 'zeal');
}
function jaegerZealTake() {
  const z = jaegerZeal();
  removeDebuff('player', 'zeal');
  return z;
}

// Крит героя по твари: Азарт, Метка, Серебряный наконечник.
function subclassOnCrit(m) {
  if (!hasSubclass('human_huntsman') || !m) return;
  let gain = 1;
  const marked = !!getDebuff('monster', 'jgMark', m.index);
  const markOn = semiPassiveReady('jgMark');
  if (marked && markOn) gain = 2;
  if (scIsUndead(m) && scSkillData('jgSilver')) gain += 1;
  jaegerZealAdd(gain);
  if (markOn && !marked && m.hp > 0) {
    // метка одна — снимаем с остальных
    const mons = state.battle.debuffs && state.battle.debuffs.monsters || {};
    Object.keys(mons).forEach(idx => { if (mons[idx] && mons[idx].jgMark) delete mons[idx].jgMark; });
    addDebuff('monster', 'jgMark', m.index, { turnsLeft: 999 });
  }
}

// ---- Храмовник: Печать света и Равновесие ----
// Удар оружием (навык или обычный): плоская прибавка светом и мана. Возвращает прибавку к урону.
function subclassOnWeaponHit(m) {
  if (scIsDwarf()) return dwarfOnWeaponHit(m);
  if (scIsDrow()) return drowOnWeaponHit(m);
  if (scIsElf()) return elfOnWeaponHit(m);
  const p = state.player;
  if (p.subclass !== 'human_templar') return 0;
  const bal = scSkillData('tpBalance');
  if (bal) {
    let mp = Math.floor(bal.mp);
    if (Math.random() < bal.mp - mp) mp++;
    if (mp > 0) p.mp = Math.min(p.maxMp, p.mp + mp);
  }
  const seal = getDebuff('player', 'seal');
  return seal ? Math.floor(scHybridPower() * seal.pct / 100) : 0;
}

// v0.38: «сила света» воина-гибрида: маг. атака + половина физ. (у воина маг. атака мала — свет от неё почти не бил).
function scHybridPower() { const p = state.player; return (p.mAtk || 0) + (p.pAtk || 0) * 0.5; }

// Сияние: в начале хода героя бьёт всех врагов, пока есть мана.
function templarRadianceTick() {
  const p = state.player;
  const b = state.battle;
  if (!b.active || !hasSubclass('human_templar') || !semiPassiveReady('tpRadiance')) return;
  const s = SKILLS.tpRadiance;
  const d = scSkillData('tpRadiance');
  const alive = (b.monsters || []).filter(m => m.hp > 0);
  if (!alive.length) return;
  if (p.mp < d.mp) {
    if (b.tpRadTurn > 0) {
      b.tpRadTurn = 0;
      removeDebuff('player', 'radiance');
      logCombat(`☀ Сияние гаснет — нет маны.`, 'log-entry');
    }
    return;
  }
  p.mp -= d.mp;
  b.tpRadTurn = Math.min(s.maxTurns, (b.tpRadTurn || 0) + 1);
  const pct = d.base + s.ramp * (b.tpRadTurn - 1);
  addDebuff('player', 'radiance', { turn: b.tpRadTurn, turnsLeft: 999 });
  const hits = alive.map(m => {
    let dmg = Math.max(1, Math.floor(scHybridPower() * pct / 100));
    if (scIsUndead(m)) dmg *= s.undeadMult;
    return { m, miss: false, dmg: monsterTagDmg(m, dmg, ['magic', 'life']), type: 'magic', fx: 'slash' };
  });
  const r = aoeApply(hits);
  logCombat(`☀ Сияние: ${r.total} (${pct}% силы света, целей: ${hits.length})`, 'log-entry player-magic', r.kills ? `убито: ${r.kills}` : '');
}

// Полупассивка стоит в слоте и изучена.
function semiPassiveReady(id) {
  const p = state.player;
  return !!(p.learnedSkills[id] && Array.isArray(p.skillSlots) && p.skillSlots.includes(id) && SKILLS[id] &&
    (!SKILLS[id].subclassId || p.subclass === SKILLS[id].subclassId));
}

// Ускользнуть: атака твари проходит мимо. true — удар снят.
function subclassTryEvade(m) {
  const ev = getDebuff('player', 'evade');
  if (!ev || !(ev.charges > 0)) return false;
  const p = state.player;
  ev.charges -= 1;
  if (ev.charges <= 0) removeDebuff('player', 'evade'); else renderDebuffBar('player');
  const atb = (ev.atb || 0) / 100;
  if (atb > 0) state.battle.playerATB = Math.min(1, (state.battle.playerATB || 0) + atb);
  spawnFloatDamage('fighter-player', 0, 'dodge');
  logCombat(`💨 ${p.name} ускользает от ${m.name}.`, 'log-entry player-skill', atb > 0 ? `ATB +${ev.atb}%` : '');
  updateBattleUI();
  return true;
}

// Ответ щита. cause: 'crit' | 'block'. Возвращает true, если тварь умерла.
function wallguardRetort(m, cause) {
  const p = state.player;
  if (!m || m.hp <= 0 || p.hp <= 0 || !state.battle.active) return false;
  if (!semiPassiveReady('wgShieldRetort') || getDebuff('player', 'retortCd')) return false;
  const sh = wallguardShieldStats();
  if (!sh) return false;
  const s = SKILLS.wgShieldRetort;
  const d = s.levels[p.learnedSkills.wgShieldRetort - 1];
  if (cause === 'block' && Math.random() * 100 >= d.blockChance) return false;
  const base = p.pAtk + (sh.def + sh.absorb) * WALLGUARD_SHIELD_DEF_MULT;
  const variance = Math.floor(base * 0.2);
  const raw = base + Math.floor(Math.random() * variance * 2) - variance;
  let dmg = Math.floor(Math.max(1, raw - (m.pDef || 0)) * d.power);
  dmg = monsterTagDmg(m, withSkillFlat(Math.max(1, dmg)), ['physical', 'blunt']);
  m.hp -= dmg;
  spawnFloatDamage('fighter-monster', dmg, 'crit', { mon: m });
  addDebuff('player', 'retortCd', { turnsLeft: s.retortEvery || 3 });
  const notes = [cause === 'crit' ? 'в ответ на крит' : 'после блока'];
  if (m.hp > 0) { addDebuff('monster', 'stun', m.index, { turnsLeft: 1 }); notes.push('💫 оглушён'); }
  logCombat(`🛡 Ответ щита: ${dmg}`, 'log-entry player-skill', notes.join(' · '));
  if (m.hp <= 0) { m.hp = 0; onMonsterDeath(m); return true; }
  return false;
}

// Последний рубеж: вызывается из onPlayerDeath. true — герой выжил.
function subclassTryLastStand() {
  const p = state.player;
  const b = state.battle;
  if (!b || !b.active || b.scLastStandUsed || p.hp > 0) return false;
  if (!hasSubclass('human_wallguard')) return false;
  const lvl = p.learnedSkills.wgLastStand || 0;
  if (!lvl) return false;
  const s = SKILLS.wgLastStand;
  const d = s.levels[lvl - 1];
  b.scLastStandUsed = true;
  p.hp = 1;
  addDebuff('player', 'lastStand', { turnsLeft: s.turns, cut: d.cut });
  spawnFloatDamage('fighter-player', 0, 'block', { text: 'РУБЕЖ' });
  logCombat(`🏰 Последний рубеж! ${p.name} стоит на 1 HP: ${s.turns} хода урон −${d.cut}%.`, 'log-entry player-skill');
  updateTopStatus();
  updateBattleUI();
  return true;
}

// Сильная тварь для автобоя: Древняя/Кровавая или на 2+ уровня выше героя.
function scStrongMonster(m) {
  return !!m && ((m.variantId && m.variantId !== 'normal') || (m.level || 0) >= (state.player.level || 1) + 2);
}

// ---- Автобой: когда применять новые активки ----
SKILLS.wgHoldLine.autoCheck = function () {
  if (getDebuff('player', 'holdLine')) return false;
  const alive = (state.battle.monsters || []).filter(m => m.hp > 0);
  return alive.length >= 2 || alive.some(scStrongMonster);
};
SKILLS.jgEvade.autoCheck = function () {
  const p = state.player;
  return !getDebuff('player', 'evade') && p.maxHp > 0 && p.hp / p.maxHp < 0.5;
};
SKILLS.tpSeal.autoCheck = function () {
  return !getDebuff('player', 'seal');
};

// Новые активки подкласса. true — навык обработан (ход потрачен).
// v0.38: навык с freeTurn не тратит ход — шкала сразу полная, герой ходит ещё раз.
function performSubclassActive(skill, data) {
  const ok = scPerformActive(skill, data);
  if (ok && skill.freeTurn && state.battle && state.battle.active) state.battle.playerATB = Math.max(state.battle.playerATB || 0, skill.freeTurn === true ? 1 : skill.freeTurn);   // число — какая доля хода возвращается
  return ok;
}
function scPerformActive(skill, data) {
  if (scIsDwarf()) { if (!dwarfPerformActive(skill, data)) return false; updateBattleUI(); checkHealPotion(); return true; }
  if (scIsDrow()) { if (!drowPerformActive(skill, data)) return false; updateBattleUI(); checkHealPotion(); return true; }
  if (scIsElf()) { if (!elfPerformActive(skill, data)) return false; updateBattleUI(); checkHealPotion(); return true; }
  if (scIsOrc()) { if (!orcPerformActive(skill, data)) return false; updateBattleUI(); checkHealPotion(); return true; }
  const p = state.player;
  if (skill.id === 'wgHoldLine') {
    addDebuff('player', 'holdLine', { turnsLeft: skill.turns, cut: data.cut });
    const blk = getEquippedShield() ? ` и +${skill.shieldBlock}% блока` : '';
    logCombat(`🛡 Глухая оборона: ${skill.turns} ходов урон −${data.cut}%${blk}.`, 'log-entry player-skill');
    spawnFloatDamage('fighter-player', 0, 'block', { text: 'ОБОРОНА' });
  } else if (skill.id === 'jgEvade') {
    jaegerZealSpend(skill.zealCost);
    addDebuff('player', 'evade', { charges: skill.misses, atb: data.atb, turnsLeft: 999 });
    logCombat(`💨 Ускользнуть: две следующие атаки пройдут мимо.`, 'log-entry player-skill', `🎲 −${skill.zealCost} Азарта`);
    spawnFloatDamage('fighter-player', 0, 'dodge', { text: 'УХОД' });
  } else if (skill.id === 'tpSeal') {
    addDebuff('player', 'seal', { turnsLeft: skill.turns, pct: data.pct });
    logCombat(`✴ Печать света: ${skill.turns} ходов удары оружием +${data.pct}% маг. атаки светом.`, 'log-entry player-skill');
    spawnFloatDamage('fighter-player', 0, 'magic', { text: 'ПЕЧАТЬ' });
  } else if (skill.id === 'elLightning') {
    elementalistLightning(skill, data);
  } else if (skill.id === 'prBlessing') {
    addDebuff('player', 'blessing', { cut: data.cut, regen: data.regen, turnsLeft: 999 });
    logCombat(`✚ Благословение: до конца боя урон −${data.cut}%, ${data.regen}% HP за ход.`, 'log-entry player-skill');
    spawnFloatDamage('fighter-player', 0, 'heal', { text: 'БЛАГОСЛОВЕНИЕ' });
    addElementXP('life');
  } else if (skill.id === 'nmRaise') {
    const c = state.battle.nmCorpse;
    const a = necroRaise(c, data.power, 'skill');
    if (c) state.battle.nmCorpse = null;
    if (!a) logCombat(`💀 Поднять павшего: нет места для слуги.`, 'log-entry');
    addElementXP('death');
  } else {
    return false;
  }
  updateBattleUI();
  checkHealPotion();
  return true;
}

// ========================================================
//  ЧЕЛОВЕК-МАГ: Элементалист, Жрец, Некромант
// ========================================================
DEBUFF_DEFS.shock = { icon: '⚡', name: 'Под током', cssClass: 'debuff-paralysis',
  tooltip: (d) => `Под током · эффект Молнии для Сплава стихий · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.weakened = { icon: '🕸', name: 'Ослаблен', cssClass: 'debuff-confused',
  tooltip: (d) => `Ослаблен · бьёт на ${d.pct}% слабее · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.blessing = { icon: '✚', name: 'Благословение', cssClass: 'debuff-regen',
  displayCount: () => '',
  tooltip: (d) => `Благословение · входящий урон −${d.cut}%, ${d.regen}% HP за ход · до конца боя.` };
DEBUFF_DEFS.barrier = { icon: '🔆', name: 'Барьер Благодати', cssClass: 'debuff-guard',
  displayCount: (d) => d.amount || 0,
  tooltip: (d) => `Барьер Благодати · примет ещё ${d.amount || 0} урона · пропадёт после боя.` };
DEBUFF_DEFS.intercedeCd = { icon: '⏳', name: 'Заступничество: перезарядка', cssClass: 'debuff-paraimmune',
  tooltip: (d) => `Заступничество перезаряжается · ещё ${d.turnsLeft} ход.` };

// ---- Элементалист ----
// Сколько разных стихий висит на твари: горение, заморозка, ток.
function elementalistEffectsOn(m) {
  if (!m) return 0;
  return ['burn', 'freeze', 'shock'].filter(id => getDebuff('monster', id, m.index)).length;
}
const SC_SPELL_ELEM = { fireball: 'fire', iceArrow: 'ice', elLightning: 'lightning', elementalVolley: 'storm' };

// Стихия заклинания (Жрец — свет = Жизнь, Некромант — Смерть).
function subclassSpellElem(skillId, elemId) {
  if (scIsDrow()) return drowSpellElem(skillId, elemId);
  if (scIsElf()) return (hasSubclass('elf_grovekeeper') && skillId === 'fireball') ? 'life' : elemId;   // Колючая лоза — Жизнь
  if (scIsOrc()) return orcSpellElem(skillId, elemId);
  const p = state.player;
  if (skillId !== 'fireball' && skillId !== 'iceArrow') return elemId;
  if (p.subclass === 'human_priest') return 'life';
  if (p.subclass === 'human_necromancer') return 'death';
  return elemId;
}

// Цена в мане: Смена стихий (Элементалист).
function subclassMpCost(skill, cost) {
  if (scIsDwarf()) return dwarfMpCost(skill, cost);
  if (scIsDrow()) return drowMpCost(skill, cost);
  if (scIsOrc()) return orcMpCost(skill, cost);
  const p = state.player;
  if (p.subclass !== 'human_elementalist' || !cost) return cost;
  const elem = SC_SPELL_ELEM[skill.id];
  if (!elem) return cost;
  const b = state.battle;
  const prev = b.elLastElem;
  b.elLastElem = elem;
  const d = scSkillData('elShift');
  if (d && prev && prev !== elem) return Math.max(1, Math.ceil(cost * (1 - d.pct / 100)));
  return cost;
}

// Урон одиночного заклинания до нанесения (Раскол, Кара по нежити).
function subclassSpellDmg(skill, m, dmg) {
  if (scIsOrc()) return orcSpellDmg(skill, m, dmg);
  const p = state.player;
  if (!m) return dmg;
  if (p.subclass === 'human_elementalist' && skill.id === 'fireball' && getDebuff('monster', 'freeze', m.index)) {
    removeDebuff('monster', 'freeze', m.index);
    m._elShatter = true;
    return Math.floor(dmg * SUBCLASSES.human_elementalist.mods.fireball.shatterMult);
  }
  if (p.subclass === 'elf_grovekeeper' && skill.id === 'fireball') return Math.floor(dmg * SUBCLASSES.elf_grovekeeper.mods.fireball.dmgMult);   // Колючая лоза
  if (p.subclass === 'human_priest' && skill.id === 'fireball' && scIsUndead(m)) {
    return Math.floor(dmg * SUBCLASSES.human_priest.mods.fireball.undeadMult);
  }
  if (p.subclass === 'human_necromancer' && skill.id === 'fireball') m._nmRaise = true;   // убьёт — встанет
  return dmg;
}

// После одиночного заклинания: свои эффекты и строка журнала. true — обработано (обычную ветку не зовём).
function subclassSpellAfter(skill, m, dmg) {
  if (scIsDwarf()) return dwarfSpellAfter(skill, m, dmg);
  if (scIsDrow()) return drowSpellAfter(skill, m, dmg);
  if (scIsElf()) return elfSpellAfter(skill, m, dmg);
  if (scIsOrc()) return orcSpellAfter(skill, m, dmg);
  const p = state.player;
  const sc = p.subclass;
  if (skill.id !== 'fireball' && skill.id !== 'iceArrow') return false;
  if (sc === 'human_elementalist' && skill.id === 'fireball') {
    spawnFloatDamage('fighter-monster', dmg, 'fire');
    const d = getSkillData('fireball');
    const pureMAtk = Math.floor(5 + p.INT * 0.8);
    const burnDmg = Math.max(1, Math.floor(pureMAtk * (d.burnPercent / 100)));
    const notes = [];
    if (m._elShatter) { notes.push('❄🔥 Раскол ×1.5'); m._elShatter = false; }
    if (m.hp > 0) { addDebuff('monster', 'burn', m.index, { turnsLeft: skill.burnTurns, damage: burnDmg }); notes.push(`🔥 поджог ${burnDmg} × ${skill.burnTurns} хода`); }
    logCombat(`🔥 ${skill.name}: ${dmg}`, 'log-entry player-skill', notes.join(' · '));
    return true;
  }
  if (sc === 'human_priest') {
    spawnFloatDamage('fighter-monster', dmg, 'magic');
    const notes = [];
    if (skill.id === 'fireball') {
      const heal = aoeHeal(dmg * SUBCLASSES.human_priest.mods.fireball.healPct / 100);
      if (scIsUndead(m)) notes.push('нежить ×1.5');
      if (heal > 0) notes.push(`✚ +${heal} HP`);
      logCombat(`✚ ${skill.name}: ${dmg}`, 'log-entry player-magic', notes.join(' · '));
    } else {
      const d = getSkillData('iceArrow');
      const mod = SUBCLASSES.human_priest.mods.iceArrow;
      if (m.hp > 0) {
        if (Math.random() * 100 < d.stun) { addDebuff('monster', 'stun', m.index, { turnsLeft: 1 }); notes.push('💫 оглушён'); }
        addDebuff('monster', 'weakened', m.index, { turnsLeft: mod.weakTurns, pct: mod.weakPct });
        notes.push(`бьёт слабее на ${mod.weakPct}%`);
      }
      logCombat(`✚ ${skill.name}: ${dmg}`, 'log-entry player-magic', notes.join(' · '));
    }
    return true;
  }
  if (sc === 'human_necromancer') {
    spawnFloatDamage('fighter-monster', dmg, 'magic');
    const notes = [];
    if (skill.id === 'fireball') {
      if (m.hp > 0) m._nmRaise = false;
      else notes.push(alliesHasRoom() ? '💀 встанет слугой' : 'места для слуги нет');
    } else if (m.hp > 0) {
      const d = getSkillData('iceArrow');
      addDebuff('monster', 'weakened', m.index, { turnsLeft: SUBCLASSES.human_necromancer.mods.iceArrow.weakTurns, pct: d.weak });
      notes.push(`бьёт слабее на ${d.weak}%`);
    }
    logCombat(`💀 ${skill.name}: ${dmg}`, 'log-entry player-magic', notes.join(' · '));
    return true;
  }
  return false;
}

// Массовое заклинание (Стихийный залп) у подклассов мага. Возвращает { line, notes } или null.
function subclassVolley(skill, data) {
  const p = state.player;
  const sc = p.subclass;
  if (sc === 'human_elementalist') {
    const ELEM = ['fire', 'ice', 'lightning'];
    const hits = [];
    let burned = 0, froze = 0, shocked = 0;
    for (let i = 0; i < data.shots; i++) {
      const alive = aoeAlive();
      if (!alive.length) break;
      const m = alive[Math.floor(Math.random() * alive.length)];
      const el = i < 3 ? ELEM[i] : ELEM[Math.floor(Math.random() * 3)];   // первые три — все стихии
      const h = aoeMagHit(m, data.multiplier, el);
      hits.push({ m, ...h, type: el === 'fire' ? 'fire' : 'magic', fx: 'proj:' + (el === 'fire' ? 'fire' : el === 'ice' ? 'ice' : 'arcane') });
      if (h.miss) continue;
      if (el === 'lightning') addDebuff('monster', 'shock', m.index, { turnsLeft: SKILLS.elLightning.shockTurns });
      if (Math.random() * 100 < data.effectChance) {
        if (el === 'fire') { addDebuff('monster', 'burn', m.index, { turnsLeft: 3, damage: Math.max(1, Math.floor(Math.floor(5 + p.INT * 0.8) * 0.12)) }); burned++; }
        else if (el === 'ice') { addDebuff('monster', 'freeze', m.index, { turnsLeft: 1 }); froze++; }
        else { cutMonstersATB(0.15); shocked++; }
      }
    }
    const r = aoeApply(hits);
    aoeGiveXp(skill, ELEM);
    const notes = [];
    if (burned) notes.push(`🔥 подожжено: ${burned}`);
    if (froze) notes.push(`❄ заморожено: ${froze}`);
    if (shocked) notes.push(`⚡ ATB стаи −${15 * shocked}%`);
    if (!getDebuff('player', 'resonance')) { addDebuff('player', 'resonance', { turnsLeft: 1 }); notes.push('✦ резонанс: следующий Шар или Стрела без маны'); }
    return { line: `✦ ${skill.name}: ${r.total} (снарядов: ${hits.length})`, notes };
  }
  if (sc === 'human_priest') {
    const hits = [];
    let healed = 0;
    for (let i = 0; i < data.shots; i++) {
      const alive = aoeAlive();
      if (!alive.length) break;
      const m = alive[Math.floor(Math.random() * alive.length)];
      const h = aoeMagHit(m, data.multiplier, 'life');
      hits.push({ m, ...h, type: 'magic', fx: 'proj:arcane' });
      if (!h.miss) healed += aoeHeal(p.maxHp * data.heal / 100);
    }
    const r = aoeApply(hits);
    aoeGiveXp(skill, ['life']);
    return { line: `✚ ${skill.name}: ${r.total} (капель: ${hits.length})`, notes: healed > 0 ? [`✚ +${healed} HP`] : [] };
  }
  if (sc === 'human_necromancer') {
    const targets = aoeTargets(data.targets);
    targets.forEach(m => { m._nmRaise = true; });
    const hits = targets.map(m => ({ m, ...aoeMagHit(m, data.multiplier, 'death'), type: 'magic', fx: 'proj:arcane' }));
    const before = alliesList().length;
    const r = aoeApply(hits);
    targets.forEach(m => { if (m.hp > 0) m._nmRaise = false; });
    aoeGiveXp(skill, ['death']);
    const risen = alliesList().length - before;
    return { line: `💀 ${skill.name}: ${r.total} (целей: ${hits.length})`, notes: risen > 0 ? [`встало слуг: ${risen}`] : [] };
  }
  return null;
}

// Удар молнии.
function elementalistLightning(skill, data) {
  const m = getCurrentMonster();
  if (!m || m.hp <= 0) return;
  const h = aoeMagHit(m, data.multiplier, 'lightning');
  const hits = [{ m, ...h, type: 'magic', fx: 'proj:arcane' }];
  const notes = [];
  addElementXP('lightning');
  if (!h.miss) {
    cutMonstersATB(data.atbCut / 100);
    notes.push(`ATB −${data.atbCut}%`);
    if (m.maxMp > 0 && m.mp > 0) {
      const burn = Math.min(m.mp, Math.ceil(m.maxMp * data.manaBurn / 100));
      m.mp -= burn;
      if (m.mp <= 0 && typeof monsterManaBroke === 'function') monsterManaBroke(m);
      notes.push(`мана −${burn}`);
    }
    if (getDebuff('monster', 'burn', m.index)) {
      const burst = Math.max(1, Math.floor(h.dmg * skill.burstPct / 100));
      aoeAlive().filter(x => x !== m).forEach(x => hits.push({ m: x, miss: false, dmg: monsterTagDmg(x, burst, ['magic', 'fire']), type: 'fire', fx: 'proj:fire' }));
      if (hits.length > 1) notes.push(`💥 взрыв: ${hits.length - 1}`);
    }
    addDebuff('monster', 'shock', m.index, { turnsLeft: skill.shockTurns });
  }
  const r = aoeApply(hits);
  logCombat(`⚡ ${skill.name}: ${h.miss ? 'промах' : r.total}`, 'log-entry player-magic', notes.join(' · '));
}

// Смерть твари (зовётся из onMonsterDeath ДО очистки её дебаффов): Отголосок, трупы Некроманта.
function subclassOnMonsterDeath(m) {
  if (scIsDwarf()) { dwarfOnMonsterDeath(m); return; }
  if (scIsDrow()) { drowOnMonsterDeath(m); return; }
  if (scIsElf()) { elfOnMonsterDeath(m); return; }
  if (scIsOrc()) { orcOnMonsterDeath(m); return; }
  const p = state.player;
  const b = state.battle;
  if (p.subclass === 'human_elementalist' && semiPassiveReady('elEcho')) {
    const d = scSkillData('elEcho');
    const others = (b.monsters || []).filter(x => x !== m && x.hp > 0);
    if (others.length && Math.random() * 100 < d.chance) {
      const jumped = [];
      [['burn', '🔥'], ['freeze', '❄'], ['shock', '⚡']].forEach(([id, ic]) => {
        const deb = getDebuff('monster', id, m.index);
        if (!deb) return;
        const t = others[Math.floor(Math.random() * others.length)];
        addDebuff('monster', id, t.index, Object.assign({}, deb));
        jumped.push(`${ic} → ${t.name}`);
      });
      if (jumped.length) logCombat(`✦ Отголосок: ${jumped.join(', ')}`, 'log-entry player-magic');
    }
  }
  if (p.subclass === 'human_necromancer') {
    const snap = { name: m.name, maxHp: m.maxHp, atk: m.atk, tags: (m.tags || []).slice() };
    if (m._nmRaise && alliesHasRoom()) { m._nmRaise = false; necroRaise(snap, necroRaisePower(), 'free'); }
    else b.nmCorpse = snap;
  }
}

// ---- Жрец ----
// Любое лечение героя: healed — сколько прибавилось, overflow — сколько ушло сверх полного HP.
function subclassOnHeroHeal(healed, overflow) {
  if (scIsDwarf()) return;
  if (scIsDrow()) { drowOnHeroHeal(healed, overflow); return; }
  if (scIsElf()) { elfOnHeroHeal(healed, overflow); return; }
  if (scIsOrc()) { orcOnHeroHeal(healed, overflow); return; }
  const p = state.player;
  const b = state.battle;
  if (p.subclass !== 'human_priest' || !b || !b.active) return;
  const g = scSkillData('prGrace');
  if (g && overflow > 0) {
    const cap = Math.floor(p.maxHp * g.cap / 100);
    const next = Math.min(cap, (b.prBarrier || 0) + Math.floor(overflow));
    if (next !== b.prBarrier) {
      b.prBarrier = next;
      if (next > 0) addDebuff('player', 'barrier', { amount: next, turnsLeft: 999 });
    }
  }
  const c = scSkillData('prCleanse');
  if (c && healed > 0) {
    b.prCleanseAcc = (b.prCleanseAcc || 0) + healed;
    const step = p.maxHp * c.step / 100;
    while (b.prCleanseAcc >= step) {
      b.prCleanseAcc -= step;
      const bad = ['poison', 'bleed', 'web'].find(id => getDebuff('player', id));
      if (!bad) { b.prCleanseAcc = Math.min(b.prCleanseAcc, step); break; }
      removeDebuff('player', bad);
      logCombat(`✚ Очищение: снят эффект «${DEBUFF_DEFS[bad].name}».`, 'log-entry potion');
    }
  }
}

// Благословение: лечение в начале хода.
function priestBlessingTick() {
  const bl = getDebuff('player', 'blessing');
  if (!bl || !state.battle.active) return;
  aoeHeal(state.player.maxHp * bl.regen / 100);
}

// Удар по герою до HP: Барьер Благодати (Жрец), Костяная плата (Некромант). Возвращает остаток урона.
function subclassAbsorbHit(dmg) {
  if (scIsDwarf()) return (dmg > 0 && state.battle && state.battle.active) ? dwarfAbsorbHit(dmg) : dmg;
  if (scIsDrow()) return dmg;
  if (scIsElf()) return (dmg > 0 && state.battle && state.battle.active) ? elfAbsorbHit(dmg) : dmg;
  if (scIsOrc()) return (dmg > 0 && state.battle && state.battle.active) ? orcAbsorbHit(dmg) : dmg;
  const p = state.player;
  const b = state.battle;
  if (dmg <= 0 || !b || !b.active) return dmg;
  if (p.subclass === 'human_priest' && b.prBarrier > 0) {
    const take = Math.min(b.prBarrier, dmg);
    b.prBarrier -= take;
    dmg -= take;
    if (b.prBarrier > 0) addDebuff('player', 'barrier', { amount: b.prBarrier, turnsLeft: 999 });
    else removeDebuff('player', 'barrier');
    logCombat(`🔆 Барьер Благодати принял ${take} урона.`, 'log-entry potion', b.prBarrier > 0 ? `осталось ${b.prBarrier}` : 'барьер рассыпался');
    return dmg;
  }
  if (p.subclass === 'human_necromancer' && semiPassiveReady('nmBonePlate')) {
    const d = scSkillData('nmBonePlate');
    if (dmg > p.maxHp * d.over / 100) {
      const a = allyTakeDamageFor(dmg);
      if (a) {
        logCombat(`🦴 Костяная плата: удар в ${dmg} принял ${a.name}.`, 'log-entry player-skill');
        return 0;
      }
    }
  }
  return dmg;
}

// После удара твари по герою: Заступничество.
function subclassAfterHeroHit() {
  if (scIsDwarf()) { dwarfAfterHeroHit(arguments[0], arguments[1], arguments[2]); return; }
  if (scIsDrow()) { drowAfterHeroHit(arguments[0], arguments[1], arguments[2]); return; }
  if (scIsElf()) { elfAfterHeroHit(arguments[0], arguments[1], arguments[2]); return; }
  if (scIsOrc()) { orcAfterHeroHit(); return; }
  const p = state.player;
  if (p.hp <= 0 || p.subclass !== 'human_priest' || !semiPassiveReady('prIntercede')) return;
  const s = SKILLS.prIntercede;
  if (getDebuff('player', 'intercedeCd') || p.hp / p.maxHp * 100 >= s.threshold) return;
  const d = scSkillData('prIntercede');
  const heal = aoeHeal(p.maxHp * d.heal / 100);
  addDebuff('player', 'intercedeCd', { turnsLeft: s.every });
  logCombat(`✚ Заступничество: +${heal} HP.`, 'log-entry potion');
}

SKILLS.prBlessing.autoCheck = function () { return !getDebuff('player', 'blessing'); };

// ---- Некромант ----
function necroAllies() { return typeof alliesList === 'function' ? alliesList() : []; }
function necroRaisePower() {
  const d = scSkillData('nmRaise');
  return d ? d.power : SKILLS.nmRaise.levels[0].power;
}
function necroKindFor(tags) {
  if (tags.includes('flesh')) return 'zombie';
  if (tags.includes('construct') || tags.includes('stone') || tags.includes('wood')) return 'spirit';
  return 'skeleton';
}
// Поднять слугу. src — снимок убитой твари или null (скелет-страж). how: 'skill' | 'free'.
function necroRaise(src, powerPct, how) {
  const p = state.player;
  if (!alliesHasRoom()) return null;
  const f = powerPct / 100;
  let a;
  if (src) {
    const kind = necroKindFor(src.tags || []);
    const K = NECRO_KINDS[kind];
    a = { kind, name: K.name, img: K.img, hp: src.maxHp * K.hp * f, atk: src.atk * K.atk * f * 2, dodge: K.dodge, slow: K.slow, from: src.name };
  } else {
    const K = NECRO_KINDS.skeleton;
    a = { kind: 'skeleton', name: 'Скелет-страж', img: K.img, hp: p.maxHp * 0.4, atk: p.mAtk * 0.5, dodge: K.dodge, slow: false };
  }
  const bonds = scSkillData('nmBonds');
  if (bonds) { a.atk += p.mAtk * bonds.atk / 100; a.hp += p.maxHp * bonds.hp / 100; }
  a.maxHp = a.hp;
  const added = alliesAdd(a);
  if (added) {
    logCombat(`💀 Встаёт ${added.name}${added.from ? ` (из «${added.from}»)` : ''}: ${added.hp} HP, удар ${added.atk}.`, 'log-entry player-skill', how === 'free' ? 'бесплатно' : '');
    spawnFloatDamage('fighter-player', 0, 'magic', { text: 'ВСТАНЬ' });
  }
  return added;
}
// Слуга пал: Пир смерти.
function subclassOnAllyDeath(a) {
  if (scIsDwarf()) { dwarfOnAllyDeath(a); return; }
  if (scIsElf()) { elfOnAllyDeath(a); return; }
  if (scIsOrc()) { orcOnAllyDeath(a); return; }
  const p = state.player;
  if (p.subclass !== 'human_necromancer') return;
  const d = scSkillData('nmFeast');
  if (!d) return;
  const mp = Math.floor(p.maxMp * d.mp / 100);
  const got = Math.min(mp, p.maxMp - p.mp);
  p.mp += got;
  if (got > 0) logCombat(`💀 Пир смерти: +${got} MP.`, 'log-entry player-magic');
}
SKILLS.nmRaise.autoCheck = function () { return alliesHasRoom(); };

// ========================================================
//  ОРК: Скала, Берсерк, Вождь, Проклинатель, Костоправ, Шаман
//  Общие функции подклассов выше передают орку управление через scIsOrc().
// ========================================================
function scIsOrc() {
  const p = state.player;
  return !!(p && p.raceId === 'orc' && p.subclass);
}
function scHpPct() {
  const p = state.player;
  return p.maxHp > 0 ? p.hp / p.maxHp * 100 : 100;
}
function scTwoHanded() {
  return typeof isTwoHandGripWeapon === 'function' && isTwoHandGripWeapon(state.player.equipment.weapon);
}
function scTotems() { return (typeof alliesList === 'function' ? alliesList() : []).filter(a => a.totem); }

DEBUFF_DEFS.trance = { icon: '🥁', name: 'Боевой транс', cssClass: 'debuff-regen',
  tooltip: (d) => `Боевой транс · реген ×${d.mult}, ${d.heal}% HP за ход · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.frenzy = { icon: '🩸', name: 'Неистовство', cssClass: 'debuff-bleed',
  tooltip: (d) => `Неистовство · ATB +${d.atb}%, урон +${d.dmg}%, входящий +${d.def}% · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.ancestor = { icon: '🐺', name: 'Дух предка', cssClass: 'debuff-rune',
  displayCount: (d) => d.turnsLeft,
  tooltip: (d) => d.form === 'wolf' ? `Волк · ATB и урон +${d.pct}% · осталось ${d.turnsLeft} ход.` : `Медведь · входящий урон −${d.pct}%, 2% HP за ход · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.warpaint = { icon: '🎨', name: 'Боевая раскраска', cssClass: 'debuff-rune',
  displayCount: () => '',
  tooltip: (d) => `Боевая раскраска · урон +${d.dmg}%, входящий −${d.cut}% · до конца боя.` };
DEBUFF_DEFS.bondCd = { icon: '⏳', name: 'Кровная связь: перезарядка', cssClass: 'debuff-paraimmune',
  tooltip: (d) => `Кровная связь перезаряжается · ещё ${d.turnsLeft} ход.` };
DEBUFF_DEFS.guardianCd = { icon: '⏳', name: 'Дух-хранитель: перезарядка', cssClass: 'debuff-paraimmune',
  tooltip: (d) => `Дух-хранитель отдыхает · ещё ${d.turnsLeft} ход.` };
DEBUFF_DEFS.thirstCd = { icon: '⏳', name: 'Жажда крови: перезарядка', cssClass: 'debuff-paraimmune',
  tooltip: (d) => `Жажда крови · ещё ${d.turnsLeft} ход.` };
DEBUFF_DEFS.curseWither = { icon: '🥀', name: 'Сухотка', cssClass: 'debuff-rot',
  tooltip: (d) => `Сухотка · ${Math.floor(d.dmg)} урона в следующий ход, растёт ×1.5 · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.curseAche = { icon: '🦴', name: 'Ломота', cssClass: 'debuff-rot',
  tooltip: (d) => `Ломота · ${Math.floor(d.dmg)} урона каждый раз, когда тварь действует · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.curseDoom = { icon: '⚖', name: 'Приговор', cssClass: 'debuff-rot',
  displayCount: (d) => Math.floor(d.stored || 0),
  tooltip: (d) => `Приговор · накоплено ${Math.floor(d.stored || 0)} урона, выдаст через ${d.turnsLeft} ход.` };

// ---- Множители ----
function orcHeroDmgMult(m) {
  const p = state.player;
  let mult = 1;
  const fr = getDebuff('player', 'frenzy');
  if (fr) mult *= 1 + fr.dmg / 100;
  const an = getDebuff('player', 'ancestor');
  if (an && an.form === 'wolf') mult *= 1 + an.pct / 100;
  const wp = getDebuff('player', 'warpaint');
  if (wp) mult *= 1 + wp.dmg / 100;
  if (p.subclass === 'orc_berserker' && scTwoHanded()) {
    const d = scSkillData('bkTwoHand');
    if (d) mult *= 1 + d.dmg / 100;
  }
  return mult;
}
function orcDamageTakenMult(attacker) {
  let mult = 1;
  const fr = getDebuff('player', 'frenzy');
  if (fr) mult *= 1 + fr.def / 100;
  const an = getDebuff('player', 'ancestor');
  if (an && an.form === 'bear') mult *= 1 - an.pct / 100;
  const wp = getDebuff('player', 'warpaint');
  if (wp) mult *= 1 - wp.cut / 100;
  if (attacker) mult *= subclassMonsterWeakMult(attacker);
  return mult;
}
function orcCritMultBonus(cat) {
  if (!hasSubclass('orc_berserker') || !scTwoHanded()) return 0;
  const d = scSkillData('bkTwoHand');
  return d ? d.crit / 100 : 0;
}
// Шкала хода героя: Неистовство, Волк.
function subclassAtbMult() {
  let mult = 1;
  const fr = getDebuff('player', 'frenzy');
  if (fr) mult *= 1 + fr.atb / 100;
  const an = getDebuff('player', 'ancestor');
  if (an && an.form === 'wolf') mult *= 1 + an.pct / 100;
  const wd = getDebuff('player', 'wind');   // Песнь ветра (Певец клинка)
  if (wd) mult *= 1 + wd.atb / 100;
  if (typeof drowAtbMult === 'function') mult *= drowAtbMult();   // Ускорение (Ткач снов)
  return mult;
}
// Реген в бою: Боевой транс (×), Кровь кипит (+).
function subclassRegen() {
  const p = state.player;
  let mult = 1, add = 0;
  const tr = getDebuff('player', 'trance');
  if (tr) mult = tr.mult;
  if (p.subclass === 'orc_rock') {
    const d = scSkillData('rkBoil');
    if (d) add += d.regen * Math.floor((100 - scHpPct()) / 10);
  }
  if (typeof drowRegenMult === 'function') mult *= drowRegenMult();   // Колыбельная (Ткач снов)
  return { mult, add };
}

function orcApplyPassives(p) {
  if (p.subclass === 'orc_berserker') {
    const d = scSkillData('bkTwoHand');
    if (d && scTwoHanded()) {
      p.evasionBonus += TWO_HAND_EVASION_PENALTY / 2;
      p.skillBonuses.push(`Двуручник (ур.${scSkillLvl('bkTwoHand')}): +${d.dmg}% урона, +${d.crit}% урона крита, штраф уворота вдвое меньше`);
    } else if (d) p.skillBonuses.push(`Двуручник: не действует — нужно двуручное оружие`);
    const e = scSkillData('bkEdge');
    if (e) p.skillBonuses.push(`На краю (ур.${scSkillLvl('bkEdge')}): ниже 50% HP вампиризм ${e.steal}%, ниже 25% — ${e.steal * 2}%`);
  } else if (p.subclass === 'orc_chieftain') {
    const d = scSkillData('chAncestralBlood');
    if (d) {
      const add = Math.floor(p.maxHp * d.pct / 100);
      p.scMAtkAdd = (p.scMAtkAdd || 0) + add;
      p.skillBonuses.push(`Кровь предков (ур.${scSkillLvl('chAncestralBlood')}): +${add} маг. атаки от макс. HP`);
    }
  } else if (p.subclass === 'orc_rock') {
    const h = scSkillData('rkHide');
    if (h) p.skillBonuses.push(`Шкура вместо щита (ур.${scSkillLvl('rkHide')}): ${h.chance}% принять удар на шкуру (−50%)${getEquippedShield() ? ' — не действует со щитом' : ''}`);
  }
}

// ---- Удары воина ----
function orcStrikeMult(skill, data, m, notes) {
  const p = state.player;
  let mult = data.multiplier;
  if (skill.id !== 'orcRage') return mult;
  const lost = Math.max(0, 100 - scHpPct());
  if (p.subclass === 'orc_rock') {
    mult *= 1 + lost / 100;
    if (lost >= 10) notes.push(`ярость ×${(1 + lost / 100).toFixed(2)}`);
  } else if (p.subclass === 'orc_berserker') {
    const bonus = Math.min(SUBCLASSES.orc_berserker.mods.orcRage.maxBonus, lost);
    mult *= 1 + bonus / 100;
    if (bonus >= 5) notes.push(`безумие +${Math.round(bonus)}%`);
  }
  return mult;
}
function orcHitAtk(skillId) {
  const p = state.player;
  if (p.subclass === 'orc_chieftain' && skillId === 'powerStrike') return Math.floor(p.mAtk * SUBCLASSES.orc_chieftain.mods.powerStrike.magPart);
  return 0;
}
// Защита твари против удара навыка.
function subclassStrikeDef(skill, def, m) {
  const p = state.player;
  if (p.subclass === 'elf_pathfinder') {   // Прицельный выстрел, Глаз ястреба
    let cut = 0;
    if (skill.id === 'powerStrike') cut += getSkillData('powerStrike').pierce || 0;
    const h = scSkillData('pfHawk'); if (h) cut += h.ignore;
    return Math.floor(def * Math.max(0, 1 - cut / 100));
  }
  if (p.subclass === 'orc_berserker' && skill.id === 'powerStrike' && scTwoHanded()) {
    const d = getSkillData('powerStrike');
    return Math.floor(def * (1 - (d.pierce || 0) / 100));
  }
  if (p.subclass === 'orc_chieftain' && skill.id === 'orcRage' && m) {
    return Math.floor((def + (m.mDef || 0)) / 2);
  }
  return def;
}
// Плоская прибавка к удару навыка (после множителей).
function subclassStrikeFlat(skill, m) {
  const p = state.player;
  if (p.subclass === 'orc_rock' && skill.id === 'powerStrike') {
    const d = getSkillData('powerStrike');
    return Math.floor(p.maxHp * (d.hpPct || 0) / 100);
  }
  if (p.subclass === 'orc_chieftain' && skill.id === 'powerStrike' && m) {
    return Math.floor((m.maxHp || 0) * SUBCLASSES.orc_chieftain.mods.powerStrike.enemyHpPct / 100);
  }
  return 0;
}
function orcAfterStrike(skill, m, hitsLanded, totalDamage) {
  const p = state.player;
  if (p.subclass === 'orc_rock') {
    if (skill.id === 'powerStrike' && m && m.hp > 0 && Math.random() * 100 < SUBCLASSES.orc_rock.mods.powerStrike.stun) {
      addDebuff('monster', 'stun', m.index, { turnsLeft: 1 });
      return '💫 оглушён тараном';
    }
    if (skill.id === 'orcRage' && totalDamage > 0) {
      const heal = aoeHeal(totalDamage * SUBCLASSES.orc_rock.mods.orcRage.lifePct / 100);
      return heal > 0 ? `🩸 +${heal} HP` : '';
    }
  }
  return '';
}
// Отдача (Ярость / Гнев). true — отдача обработана здесь (героя не бьём).
function subclassRecoilHook(skill, recoil) {
  const p = state.player;
  if (p.subclass === 'orc_berserker' && skill.id === 'orcRage' && scHpPct() < SUBCLASSES.orc_berserker.mods.orcRage.noRecoilBelow) {
    logCombat(`🩸 На краю безумия — отдачи нет.`, 'log-entry player-skill');
    return true;
  }
  if (p.subclass === 'orc_shaman' && skill.id === 'spiritWrath') {
    const t = scTotems();
    if (t.length) {
      const tot = t.reduce((a, b) => (b.hp > a.hp ? b : a), t[0]);
      tot.hp -= recoil;
      logCombat(`🗿 Отдачу Гнева (${recoil}) принял ${tot.name}.`, 'log-entry player-skill');
      alliesReap(); alliesRender();
      return true;
    }
  }
  return false;
}
// Кровавая жатва: цели и множитель.
function subclassHarvest(data) {
  const p = state.player;
  if (p.subclass === 'orc_berserker' && scTwoHanded()) {
    const mod = SUBCLASSES.orc_berserker.mods.bloodHarvest;
    return { targets: data.targets + mod.twoHandTargets, mult: data.multiplier * mod.twoHandMult };
  }
  return { targets: data.targets, mult: data.multiplier };
}
function subclassAfterHarvest(hits) {
  const p = state.player;
  const alive = hits.filter(h => !h.miss && h.m && h.m.hp > 0).map(h => h.m);
  if (!alive.length) return '';
  if (p.subclass === 'orc_rock') {
    const mod = SUBCLASSES.orc_rock.mods.bloodHarvest;
    alive.forEach(m => addDebuff('monster', 'weakened', m.index, { turnsLeft: mod.roarTurns, pct: mod.roarPct }));
    return `📣 рык: ${alive.length}`;
  }
  if (p.subclass === 'orc_chieftain') {
    const d = getSkillData('bloodHarvest');
    const per = Math.max(1, Math.floor(p.mAtk * SUBCLASSES.orc_chieftain.mods.bloodHarvest.rotPct / 100));
    alive.forEach(m => addRotLayer(m, d.rotTurns || 2, per, 2));
    return `☠ гниение: ${alive.length}`;
  }
  return '';
}

// ---- Кровавая цена (Берсерк) ----
function orcMpCost(skill, cost) {
  const p = state.player;
  if (p.subclass !== 'orc_berserker' || skill.id === 'bkFrenzy') return cost;
  if (scHpPct() <= BERSERK_FREE_BELOW) return 0;
  const hp = Math.min(Math.floor(p.maxHp * BERSERK_HP_COST / 100), Math.max(0, p.hp - 1));
  if (hp > 0) {
    p.hp -= hp;
    state.battle.bkPaid = (state.battle.bkPaid || 0) + hp;
    spawnFloatDamage('fighter-player', hp, 'dmg');
  }
  return 0;
}

// ---- Урон героя по твари (после всех множителей): На краю, Приговор ----
let scDoomRelease = false;
function subclassOnHeroDamage(m, dmg) {
  if (scIsDrow()) { drowOnHeroDamage(m, dmg); return; }
  if (scIsElf()) { elfOnHeroDamage(m, dmg); return; }
  const p = state.player;
  if (!m || dmg <= 0 || !scIsOrc()) return;
  if (p.subclass === 'orc_berserker') {
    const e = scSkillData('bkEdge');
    const hp = scHpPct();
    if (e && hp < 50) {
      const pct = e.steal * (hp < 25 ? 2 : 1);
      const want = Math.floor(dmg * pct / 100);
      if (want > 0) { const got = Math.min(want, p.maxHp - p.hp); if (got > 0) p.hp += got; }
    }
  } else if (p.subclass === 'orc_hexer' && !scDoomRelease) {
    const doom = getDebuff('monster', 'curseDoom', m.index);
    if (doom) doom.stored = (doom.stored || 0) + dmg * 0.3;
  }
}

// ---- Проклятия (Проклинатель) ----
const HEX_CURSES = ['curseWither', 'curseAche', 'curseDoom'];
function hexerCursesOn(m) {
  if (!m) return 0;
  return HEX_CURSES.concat(['rot']).filter(id => getDebuff('monster', id, m.index)).length;
}
function hexerNextCurse(m) {
  if (!m || m.hp <= 0) return null;
  return HEX_CURSES.find(id => !getDebuff('monster', id, m.index)) || null;
}
function hexerCurseMult(m) {
  const d = scSkillData('hxBlackBook');
  return d ? 1 + d.pct / 100 * hexerCursesOn(m) : 1;
}
function hexerCurseHit(m, raw, label) {
  const dmg = monsterTagDmg(m, Math.max(1, Math.floor(raw * hexerCurseMult(m))), ['magic', 'death']);
  return { m, miss: false, dmg, type: 'poison', fx: 'toxic-small', label };
}
function hexerCastCurse(skill, data) {
  const p = state.player;
  const m = getCurrentMonster();
  const id = hexerNextCurse(m);
  if (!id) { logCombat(`☠ ${skill.name}: на цели уже все проклятия.`, 'log-entry'); return; }
  const base = p.mAtk * data.base / 100;
  if (id === 'curseWither') addDebuff('monster', id, m.index, { turnsLeft: 6, dmg: base * 0.3 });
  else if (id === 'curseAche') addDebuff('monster', id, m.index, { turnsLeft: 5, dmg: base });
  else addDebuff('monster', id, m.index, { turnsLeft: 3, stored: 0 });
  addElementXP('death');
  spawnFloatDamage('fighter-monster', 0, 'poison', { mon: m, fx: 'toxic', text: DEBUFF_DEFS[id].name.toUpperCase() });
  logCombat(`☠ ${skill.name}: ${DEBUFF_DEFS[id].icon} ${DEBUFF_DEFS[id].name} на ${m.name}.`, 'log-entry poison', `проклятий на цели: ${hexerCursesOn(m)}`);
}
// Сухотка и Приговор — в начале хода героя.
function hexerCurseTick() {
  const b = state.battle;
  if (!b.active) return;
  const hits = [];
  const notes = [];
  (b.monsters || []).filter(m => m.hp > 0).forEach(m => {
    const w = getDebuff('monster', 'curseWither', m.index);
    if (w) {
      hits.push(hexerCurseHit(m, w.dmg, 'Сухотка'));
      w.dmg *= 1.5;
      w.turnsLeft -= 1;
      if (w.turnsLeft <= 0) removeDebuff('monster', 'curseWither', m.index);
    }
    const d = getDebuff('monster', 'curseDoom', m.index);
    if (d) {
      d.turnsLeft -= 1;
      if (d.turnsLeft <= 0) {
        removeDebuff('monster', 'curseDoom', m.index);
        if (d.stored >= 1) { hits.push(hexerCurseHit(m, d.stored, 'Приговор')); notes.push(`⚖ приговор ${m.name}`); }
      }
    }
  });
  if (!hits.length) return;
  scDoomRelease = true;
  const r = aoeApply(hits);
  scDoomRelease = false;
  logCombat(`☠ Проклятия: ${r.total}`, 'log-entry poison', notes.concat(r.kills ? [`убито: ${r.kills}`] : []).join(' · '));
  renderDebuffBar('monster');
}
// Ломота — когда тварь действует.
function subclassOnMonsterAct(m) {
  if (scIsDwarf()) { if (m && m.hp > 0) dwarfOnMonsterAct(m); return; }
  if (!hasSubclass('orc_hexer') || !m || m.hp <= 0) return;
  const a = getDebuff('monster', 'curseAche', m.index);
  if (!a) return;
  const h = hexerCurseHit(m, a.dmg, 'Ломота');
  scDoomRelease = true;
  const r = aoeApply([h]);
  scDoomRelease = false;
  logCombat(`🦴 Ломота: ${r.total}`, 'log-entry poison', r.kills ? 'тварь сломалась' : '');
}

// ---- Заклинания мага ----
function orcSpellElem(skillId, elemId) {
  if (hasSubclass('orc_healer') && skillId === 'fireball') return 'death';
  return elemId;
}
function orcSpellDmg(skill, m, dmg) {
  const p = state.player;
  if (!m) return dmg;
  if (p.subclass === 'orc_hexer' && skill.id === 'spiritWrath') {
    const rot = getDebuff('monster', 'rot', m.index);
    const layers = rot ? rotLayers(rot).length : 0;
    return Math.floor(dmg * (1 + 0.10 * hexerCursesOn(m) + 0.05 * layers));
  }
  if (p.subclass === 'orc_shaman' && skill.id === 'fireball') {
    return Math.floor(dmg * (1 + SUBCLASSES.orc_shaman.mods.fireball.perTotem / 100 * scTotems().length));
  }
  return dmg;
}
function orcSpellAfter(skill, m, dmg) {
  const p = state.player;
  if (p.subclass === 'orc_hexer' && skill.id === 'fireball') {
    spawnFloatDamage('fighter-monster', dmg, 'fire');
    const d = getSkillData('fireball');
    const mod = SUBCLASSES.orc_hexer.mods.fireball;
    const notes = [];
    if (m.hp > 0) {
      const burnDmg = Math.max(1, Math.floor(Math.floor(5 + p.INT * 0.8) * d.burnPercent / 100));
      addDebuff('monster', 'burn', m.index, { turnsLeft: skill.burnTurns, damage: burnDmg });
      addRotLayer(m, mod.rotTurns, Math.max(1, Math.floor(p.mAtk * mod.rotPct / 100)), skill.rotMaxLayers || 4);
      notes.push(`🔥 поджог ${burnDmg}`, '☠ слой Гниения');
    }
    logCombat(`🔥 ${skill.name}: ${dmg}`, 'log-entry player-skill', notes.join(' · '));
    return true;
  }
  if (p.subclass === 'orc_healer' && skill.id === 'fireball') {
    spawnFloatDamage('fighter-monster', dmg, 'magic');
    const d = getSkillData('fireball');
    if (m.hp > 0) addDebuff('monster', 'weakened', m.index, { turnsLeft: SUBCLASSES.orc_healer.mods.fireball.weakTurns, pct: d.weak });
    logCombat(`🌑 ${skill.name}: ${dmg}`, 'log-entry player-magic', m.hp > 0 ? `бьёт слабее на ${d.weak}%` : '');
    return true;
  }
  if (p.subclass === 'orc_healer' && skill.id === 'spiritWrath') {
    if (typeof addRotWrathStack === 'function') addRotWrathStack();
    spawnFloatDamage('fighter-monster', dmg, 'magic');
    const d = getSkillData('spiritWrath');
    const heal = aoeHeal(dmg * d.heal / 100);
    logCombat(`🩸 ${skill.name}: ${dmg}`, 'log-entry player-skill', heal > 0 ? `🩸 +${heal} HP` : '');
    return true;
  }
  return false;
}
// Мор: урон за ход (Круг гнили — за тотемы).
function subclassPestilencePerTurn(perTurn) {
  if (!hasSubclass('orc_shaman')) return perTurn;
  return Math.floor(perTurn * (1 + SUBCLASSES.orc_shaman.mods.pestilence.perTotem / 100 * scTotems().length));
}
// Тик Гниения: Иссушение лечит Костоправа.
function subclassOnRotTick(total) {
  if (!hasSubclass('orc_healer') || total <= 0) return;
  const d = getSkillData('pestilence');
  if (!d || !d.heal) return;
  const heal = aoeHeal(total * d.heal / 100);
  if (heal > 0) logCombat(`🩸 Иссушение: +${heal} HP.`, 'log-entry potion');
}

// ---- Лечение (Костоправ) ----
let scVitalityBusy = false;
function orcOnHeroHeal(healed, overflow) {
  const p = state.player;
  if (p.subclass !== 'orc_healer' || !state.battle.active || healed <= 0 || scVitalityBusy) return;
  const v = scSkillData('hlVitality');
  if (v) {
    const extra = Math.min(Math.floor(healed * v.pct / 100), p.maxHp - p.hp);
    if (extra > 0) p.hp += extra;
  }
  const br = scSkillData('hlBrews');
  if (br) {
    const mp = Math.min(Math.floor(healed * br.pct / 100), p.maxMp - p.mp);
    if (mp > 0) p.mp += mp;
  }
}
function orcAfterHeroHit() {
  const p = state.player;
  if (p.hp <= 0 || p.subclass !== 'orc_healer' || !semiPassiveReady('hlBloodBond')) return;
  const s = SKILLS.hlBloodBond;
  if (getDebuff('player', 'bondCd') || scHpPct() >= s.threshold) return;
  const d = scSkillData('hlBloodBond');
  const alive = (state.battle.monsters || []).filter(m => m.hp > 0);
  if (!alive.length) return;
  const per = Math.max(1, Math.floor(p.mAtk * d.pct / 100));
  const hits = alive.map(m => ({ m, miss: false, dmg: monsterTagDmg(m, per, ['magic', 'death']), type: 'poison', fx: 'toxic-small' }));
  const r = aoeApply(hits);
  const heal = aoeHeal(r.total);
  addDebuff('player', 'bondCd', { turnsLeft: s.every });
  logCombat(`🩸 Кровная связь: −${r.total} врагам, +${heal} HP вам.`, 'log-entry potion');
}

// ---- Удар по герою до HP: Дух-хранитель, Шкура ----
function orcAbsorbHit(dmg) {
  const p = state.player;
  if (p.subclass !== 'orc_rock') return dmg;
  if (semiPassiveReady('rkGuardian') && !getDebuff('player', 'guardianCd') && dmg > p.maxHp * SKILLS.rkGuardian.over / 100) {
    const d = scSkillData('rkGuardian');
    const take = Math.floor(dmg * d.take / 100);
    dmg -= take;
    addDebuff('player', 'guardianCd', { turnsLeft: SKILLS.rkGuardian.every });
    logCombat(`👻 Дух-хранитель забрал ${take} урона.`, 'log-entry player-skill');
  }
  const h = scSkillData('rkHide');
  if (h && !getEquippedShield() && Math.random() * 100 < h.chance) {
    const before = dmg;
    dmg = Math.max(1, Math.floor(dmg / 2));
    logCombat(`🐗 На шкуру: ${before} → ${dmg}.`, 'log-entry player-skill');
  }
  return dmg;
}

// ---- Крит твари по герою: Проклятие крови (Вождь) ----
function subclassOnMonsterCrit(m) {
  if (!hasSubclass('orc_chieftain') || !semiPassiveReady('chBloodCurse') || !m || m.hp <= 0) return;
  const d = scSkillData('chBloodCurse');
  addRotLayer(m, SKILLS.chBloodCurse.turns, Math.max(1, Math.floor(state.player.mAtk * d.pct / 100)), 2);
  logCombat(`🩸 Проклятие крови: ${m.name} гниёт.`, 'log-entry poison');
}

// ---- Смерть твари ----
function orcOnMonsterDeath(m) {
  const p = state.player;
  const b = state.battle;
  if (p.subclass === 'orc_berserker') {
    if (b.bkPaid > 0) { const back = aoeHeal(b.bkPaid * BERSERK_HP_BACK / 100); b.bkPaid = 0; if (back > 0) logCombat(`🩸 Кровь возвращается: +${back} HP.`, 'log-entry potion'); }
    if (semiPassiveReady('bkThirst') && !getDebuff('player', 'thirstCd')) b.bkThirst = true;
  } else if (p.subclass === 'orc_chieftain') {
    const d = scSkillData('chTribute');
    if (d) {
      const mp = Math.min(Math.floor(p.maxMp * d.mp / 100), p.maxMp - p.mp);
      if (mp > 0) p.mp += mp;
      aoeHeal(p.maxHp * d.hp / 100);
    }
  } else if (p.subclass === 'orc_hexer') {
    const on = HEX_CURSES.concat(['rot']).filter(id => getDebuff('monster', id, m.index));
    if (!on.length) return;
    const c = scSkillData('hxCarrion');
    if (c) { const mp = Math.min(Math.floor(p.maxMp * c.mp / 100), p.maxMp - p.mp); if (mp > 0) p.mp += mp; }
    if (semiPassiveReady('hxBurst')) {
      const others = (b.monsters || []).filter(x => x !== m && x.hp > 0);
      if (!others.length) return;
      const t = others[Math.floor(Math.random() * others.length)];
      HEX_CURSES.forEach(id => { const deb = getDebuff('monster', id, m.index); if (deb && !getDebuff('monster', id, t.index)) addDebuff('monster', id, t.index, Object.assign({}, deb)); });
      const d = scSkillData('hxBurst');
      const per = Math.max(1, Math.floor(p.mAtk * d.pct / 100 * on.length));
      const hits = others.map(x => ({ m: x, miss: false, dmg: monsterTagDmg(x, per, ['magic', 'death']), type: 'poison', fx: 'toxic' }));
      // урон — без немедленных смертей внутри чужой смерти: смертельный удар оставляет 1 HP
      hits.forEach(h => { h.m.hp = Math.max(1, h.m.hp - h.dmg); spawnFloatDamage('fighter-monster', h.dmg, 'poison', { mon: h.m }); });
      logCombat(`💥 Взрыв проклятий: ${per} каждому рядом`, 'log-entry poison', `проклятия → ${t.name}`);
    }
  }
}

// ---- Начало хода героя ----
function orcOnHeroTurn() {
  const p = state.player;
  const b = state.battle;
  if (!b.active) return;
  b.bkPaid = 0;
  const tr = getDebuff('player', 'trance');
  if (tr) aoeHeal(p.maxHp * tr.heal / 100);
  const an = getDebuff('player', 'ancestor');
  if (an && an.form === 'bear') aoeHeal(p.maxHp * 0.02);
  if (p.subclass === 'orc_hexer') hexerCurseTick();
  if (b.bkThirst) {
    b.bkThirst = false;
    const d = scSkillData('bkThirst');
    const n = scTwoHanded() ? 2 : 1;
    const targets = aoeAlive().slice(0, n);
    if (d && targets.length) {
      addDebuff('player', 'thirstCd', { turnsLeft: SKILLS.bkThirst.every });
      const hits = targets.map(m => ({ m, ...aoePhysHit(m, d.mult, 0), fx: 'slash-red' })).map(h => ({ ...h, type: h.crit ? 'crit' : 'dmg' }));
      const r = aoeApply(hits);
      logCombat(`🩸 Жажда крови: ${r.total}`, 'log-entry player-skill', r.kills ? `убито: ${r.kills}` : '');
    }
  }
}

// ---- Тотемы (Шаман) ----
function shamanSummonTotem(data) {
  const p = state.player;
  const kinds = Object.keys(TOTEM_KINDS);
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const K = TOTEM_KINDS[kind];
  const f = data.power / 100;
  const oak = scSkillData('smOak');
  const voice = scSkillData('smVoice');
  const vm = voice ? 1 + voice.pct / 100 : 1;
  const hp = p.maxHp * K.hp * f * (oak ? 1 + oak.pct / 100 : 1);
  const a = { kind, totem: true, name: K.name, img: K.img, hp, maxHp: hp, atk: K.atk ? p.mAtk * K.atk * f * vm : 0,
    taunt: !!K.taunt, healHp: K.healHp ? K.healHp * vm : 0, healMp: K.healMp ? K.healMp * vm : 0, dodge: 0, slow: false };
  // четвёртый заменяет самый старый
  if (!alliesHasRoom()) {
    const old = scTotems()[0];
    if (old) { state.battle.allies = state.battle.allies.filter(x => x !== old); logCombat(`🗿 ${old.name} уходит в землю.`, 'log-entry'); }
  }
  const added = alliesAdd(a);
  if (added) logCombat(`🗿 ${added.name}: ${K.desc}. ${added.hp} HP${added.atk ? `, выстрел ${added.atk}` : ''}.`, 'log-entry player-skill');
  addElementXP('death');
}
// Разбитый тотем: Месть тотема.
function orcOnAllyDeath(a) {
  const p = state.player;
  if (p.subclass !== 'orc_shaman' || !a.totem || !semiPassiveReady('smVengeance')) return;
  const d = scSkillData('smVengeance');
  const alive = (state.battle.monsters || []).filter(m => m.hp > 0);
  if (!alive.length) return;
  const per = Math.max(1, Math.floor(p.mAtk * d.pct / 100));
  const hits = alive.map(m => ({ m, miss: false, dmg: monsterTagDmg(m, per, ['magic', 'death']), type: 'poison', fx: 'toxic' }));
  const r = aoeApply(hits);
  logCombat(`💥 Месть тотема: ${r.total}`, 'log-entry poison', r.kills ? `убито: ${r.kills}` : '');
}

// ---- Новые активки орка ----
function orcPerformActive(skill, data) {
  const p = state.player;
  if (skill.id === 'rkTrance') {
    addDebuff('player', 'trance', { turnsLeft: skill.turns, mult: data.mult, heal: data.heal });
    logCombat(`🥁 Боевой транс: ${skill.turns} ходов реген ×${data.mult} и ${data.heal}% HP за ход.`, 'log-entry player-skill');
    spawnFloatDamage('fighter-player', 0, 'heal', { text: 'ТРАНС' });
  } else if (skill.id === 'bkFrenzy') {
    const cost = Math.min(Math.floor(p.maxHp * skill.hpCost / 100), Math.max(0, p.hp - 1));
    p.hp -= cost;
    addDebuff('player', 'frenzy', { turnsLeft: skill.turns, atb: data.atb, dmg: data.dmg, def: skill.defCut });
    logCombat(`🩸 Неистовство: ${skill.turns} хода ATB +${data.atb}%, урон +${data.dmg}%.`, 'log-entry player-skill', `−${cost} HP`);
    spawnFloatDamage('fighter-player', cost, 'dmg');
  } else if (skill.id === 'chAncestor') {
    const form = scHpPct() > 50 ? 'wolf' : 'bear';
    addDebuff('player', 'ancestor', { turnsLeft: skill.turns, form, pct: form === 'wolf' ? data.wolf : data.bear });
    DEBUFF_DEFS.ancestor.icon = form === 'wolf' ? '🐺' : '🐻';
    logCombat(form === 'wolf' ? `🐺 Зов предка: пришёл Волк — ATB и урон +${data.wolf}%.` : `🐻 Зов предка: пришёл Медведь — урон по вам −${data.bear}%, 2% HP за ход.`, 'log-entry player-skill');
    addElementXP('death');
  } else if (skill.id === 'hxCurse') {
    hexerCastCurse(skill, data);
  } else if (skill.id === 'hlWarpaint') {
    addDebuff('player', 'warpaint', { turnsLeft: 999, dmg: data.dmg, cut: data.cut });
    logCombat(`🎨 Боевая раскраска: до конца боя урон +${data.dmg}%, входящий −${data.cut}%.`, 'log-entry player-skill');
  } else if (skill.id === 'smTotem') {
    shamanSummonTotem(data);
  } else {
    return false;
  }
  return true;
}

SKILLS.rkTrance.autoCheck = function () { return !getDebuff('player', 'trance') && scHpPct() < 60; };
SKILLS.bkFrenzy.autoCheck = function () {
  if (getDebuff('player', 'frenzy') || scHpPct() <= 50) return false;
  const alive = (state.battle.monsters || []).filter(m => m.hp > 0);
  return alive.length >= 2 || alive.some(scStrongMonster);
};
SKILLS.chAncestor.autoCheck = function () { return !getDebuff('player', 'ancestor'); };
SKILLS.hlWarpaint.autoCheck = function () { return !getDebuff('player', 'warpaint'); };
SKILLS.smTotem.autoCheck = function () { return scTotems().length < ALLY_MAX; };

// ========================================================
//  ЭЛЬФ: Терновый страж, Следопыт, Певец клинка, Звездочёт, Хранитель Рощи, Друид
//  Общие функции подклассов передают эльфу управление через scIsElf().
// ========================================================
function scIsElf() {
  const p = state.player;
  return !!(p && p.raceId === 'elf' && p.subclass);
}

DEBUFF_DEFS.rooted = { icon: '🌿', name: 'Опутан', cssClass: 'debuff-entangle',
  tooltip: (d) => `Опутан корнями · шкала хода медленнее на ${d.pct}% · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.bark = { icon: '🪵', name: 'Кора', cssClass: 'debuff-guard',
  tooltip: (d) => `Кора · входящий урон −${d.cut}% · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.rooting = { icon: '🌳', name: 'Укоренение', cssClass: 'debuff-guard',
  tooltip: (d) => `Укоренение · ${d.share}% удара уходит в корни, половина рассасывается · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.rootPool = { icon: '🍂', name: 'Отложенный урон', cssClass: 'debuff-bleed',
  displayCount: (d) => Math.ceil(d.amount || 0),
  tooltip: (d) => `Отложенный урон · ${Math.ceil(d.amount || 0)} придёт за ближайшие ходы. Лечение гасит его первым.` };
DEBUFF_DEFS.seeds = { icon: '🌱', name: 'Семена терна', cssClass: 'debuff-entangle',
  displayCount: (d) => (d.list || []).length,
  tooltip: (d) => `Семена терна × ${(d.list || []).length} · ближайшее распустится через ${Math.min(...(d.list || [{ t: 0 }]).map(x => x.t))} ход.` };
DEBUFF_DEFS.song = { icon: '🎵', name: 'Песнь', cssClass: 'debuff-rune',
  displayCount: (d) => d.level || 0,
  tooltip: (d) => `Песнь ${d.level || 0}/${SONG_MAX} · урон +${(d.level || 0) * SONG_DMG}%, уворот +${(d.level || 0) * SONG_EVA}. Чередуйте удар оружием и навык.` };
DEBUFF_DEFS.wind = { icon: '🍃', name: 'Песнь ветра', cssClass: 'debuff-regen',
  tooltip: (d) => `Песнь ветра · шкала хода +${d.atb}%, Песнь не падает · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.lifeEdge = { icon: '🌸', name: 'Клинок Жизни', cssClass: 'debuff-regen',
  displayCount: (d) => d.charges || 0,
  tooltip: (d) => `Клинок Жизни · ещё ${d.charges || 0} удара с уроном Жизнью.` };
DEBUFF_DEFS.star = { icon: '🌠', name: 'Падающая звезда', cssClass: 'debuff-rune',
  displayCount: (d) => d.turnsLeft,
  tooltip: (d) => `Падающая звезда · упадёт через ${d.turnsLeft} ход.` };
DEBUFF_DEFS.hot = { icon: '🌿', name: 'Лечение во времени', cssClass: 'debuff-regen',
  displayCount: (d) => d.count || 0,
  tooltip: (d) => `Лечение во времени · ростков: ${d.count || 0}, ещё ~${Math.round(d.total || 0)} HP.` };
DEBUFF_DEFS.grove = { icon: '🌳', name: 'Дар рощи', cssClass: 'debuff-regen',
  displayCount: () => '',
  tooltip: (d) => `Дар рощи · ${d.regen}% HP за ход, лечение +${d.heal}%, урон +${d.dmg || 0}% · до конца боя.` };
DEBUFF_DEFS.budCd = { icon: '⏳', name: 'Бутон: перезарядка', cssClass: 'debuff-paraimmune',
  tooltip: (d) => `Бутон набирается · ещё ${d.turnsLeft} ход.` };

// ---- Множители ----
function elfHeroDmgMult(m) {
  const p = state.player;
  let mult = 1;
  if (p.subclass === 'elf_bladesinger') {
    const s = getDebuff('player', 'song');
    if (s) mult *= 1 + s.level * SONG_DMG / 100;
  } else if (p.subclass === 'elf_grovekeeper') {
    const g = getDebuff('player', 'grove');
    if (g && g.dmg) mult *= 1 + g.dmg / 100;
  } else if (p.subclass === 'elf_stargazer' && m) {
    const f = scSkillData('sgFocus');
    const b = state.battle;
    if (f && b.sgFocus && b.sgFocus.idx === m.index) mult *= 1 + f.pct / 100 * b.sgFocus.n;
    const c = scSkillData('sgClear');
    if (c && (m.mDef || 0) > 0) mult *= 1 + c.pct / 100 * Math.min(1, (m.mDef || 0) / 40);
  }
  return mult;
}
function elfDamageTakenMult(attacker) {
  let mult = 1;
  const bark = getDebuff('player', 'bark');
  if (bark) mult *= 1 - bark.cut / 100;
  if (hasSubclass('elf_thornguard') && semiPassiveReady('tgBarbs')) { const tb = scSkillData('tgBarbs'); if (tb && tb.cut) mult *= 1 - tb.cut / 100; }   // Шипастая кора
  if (attacker) mult *= subclassMonsterWeakMult(attacker);
  return mult;
}
function subclassEvasionBonus() {
  if (!hasSubclass('elf_bladesinger')) return 0;
  const s = getDebuff('player', 'song');
  return s ? s.level * SONG_EVA : 0;
}
function subclassAccuracyBonus() {
  if (scIsDrow()) return drowAccuracyBonus();
  if (!hasSubclass('elf_pathfinder')) return 0;
  const d = scSkillData('pfHawk');
  return d ? d.acc : 0;
}
// Шкала хода твари: опутана корнями.
function subclassMonsterAtbMult(m) {
  const web = m ? getDebuff('monster', 'webbed', m.index) : null;   // паутина пауков (дроу)
  const r = m ? getDebuff('monster', 'rooted', m.index) : null;
  return (r ? 1 - r.pct / 100 : 1) * (web ? 1 - web.pct / 100 : 1);
}
// Щит маны тварей: Ясный взор.
function subclassManaShieldMult() {
  if (!hasSubclass('elf_stargazer')) return 1;
  const c = scSkillData('sgClear');
  return c ? 1 - c.pct / 100 : 1;
}
// Исцеление ранит любую тварь (Звездочёт).
function subclassHealHurtsAny() {
  return hasSubclass('elf_stargazer');
}
// Гармония: после расчёта атак.
function subclassFinalAtk(p) {
  if (p.subclass !== 'elf_bladesinger') return;
  const d = scSkillData('bsHarmony');
  if (!d) return;
  const pa = p.pAtk, ma = p.mAtk;
  p.mAtk = ma + Math.floor(pa * d.pct / 100);
  p.pAtk = pa + Math.floor(ma * d.pct / 100);
}

function elfApplyPassives(p) {
  if (p.subclass === 'elf_pathfinder') {
    const h = scSkillData('pfHawk');
    if (h) p.skillBonuses.push(`Глаз ястреба (ур.${scSkillLvl('pfHawk')}): +${h.acc} точности, навыки пробивают ${h.ignore}% защиты`);
  } else if (p.subclass === 'elf_thornguard') {
    const r = scSkillData('tgRoots');
    if (r) p.skillBonuses.push(`Корни принимают удар (ур.${scSkillLvl('tgRoots')}): ${r.share}% удара приходит за 3 хода, половина рассасывается`);
    const s = scSkillData('tgSap');
    if (s) p.skillBonuses.push(`Сок древа (ур.${scSkillLvl('tgSap')}): лечение +${s.pct}%`);
  } else if (p.subclass === 'elf_bladesinger') {
    const h = scSkillData('bsHarmony');
    if (h) p.skillBonuses.push(`Гармония (ур.${scSkillLvl('bsHarmony')}): ${h.pct}% физ. атаки → маг. и обратно`);
  }
}

// ---- Удары воина ----
function elfHitAtk(skillId) {
  const p = state.player;
  if (p.subclass === 'elf_bladesinger' && skillId === 'powerStrike') return Math.floor(p.mAtk * SUBCLASSES.elf_bladesinger.mods.powerStrike.magPart);
  return 0;
}
function subclassNeverMiss(skill) {
  return hasSubclass('elf_pathfinder') && skill.id === 'powerStrike';
}
function elfAfterStrike(skill, m, hitsLanded, totalDamage) {
  const p = state.player;
  if (p.subclass === 'elf_thornguard' && skill.id === 'powerStrike' && m && m.hp > 0) {
    const mod = SUBCLASSES.elf_thornguard.mods.powerStrike;
    addDebuff('monster', 'rooted', m.index, { turnsLeft: mod.slowTurns, pct: mod.slowPct });
    return '🌿 опутан: ход медленнее';
  }
  if (p.subclass === 'elf_pathfinder' && skill.id === 'powerStrike' && m && m.hp > 0) {
    const n = pathfinderPlant(m, SUBCLASSES.elf_pathfinder.mods.powerStrike.seeds, true);
    return n ? `🌱 семян: ${n}` : '';
  }
  if (p.subclass === 'elf_bladesinger' && skill.id === 'powerStrike' && totalDamage > 0) {
    bladesingerLivingHeal(totalDamage);
  }
  return '';
}

// ---- Терновый вихрь ----
function subclassThorns(data) {
  const p = state.player;
  if (p.subclass === 'elf_thornguard') return { targets: data.targets + SUBCLASSES.elf_thornguard.mods.thornWhirl.extraTargets };
  if (p.subclass === 'elf_pathfinder') return { targets: SUBCLASSES.elf_pathfinder.mods.thornWhirl.fixedTargets };
  return { targets: data.targets };
}
function subclassAfterThorns(hits, data) {
  const p = state.player;
  const touched = hits.filter(h => !h.miss && h.m && h.m.hp > 0).map(h => h.m);
  if (p.subclass === 'elf_thornguard') {
    const pct = SUBCLASSES.elf_thornguard.mods.thornWhirl.slowPct;
    touched.forEach(m => { removeDebuff('monster', 'entangle', m.index); addDebuff('monster', 'rooted', m.index, { turnsLeft: data.turns, pct }); });
    return touched.length ? `🌿 корни: ход медленнее на ${pct}%` : '';
  }
  if (p.subclass === 'elf_pathfinder') {
    let n = 0;
    touched.forEach(m => { n += pathfinderPlant(m, 1, true); });
    return n ? `🌱 семян: ${n}` : '';
  }
  if (p.subclass === 'elf_bladesinger') {
    const d = getSkillData('thornWhirl');
    const all = new Set(hits.filter(h => !h.miss && h.m).map(h => h.m)).size;
    const heal = all ? aoeHeal(p.maxHp * (d.heal || 0) / 100 * all) : 0;
    return heal > 0 ? `🌸 +${heal} HP` : '';
  }
  return '';
}

// ---- Семена терна (Следопыт) ----
function pathfinderSeeds(m) {
  const d = m ? getDebuff('monster', 'seeds', m.index) : null;
  return d ? (d.list || []) : [];
}
// Посадить n семян. force — без броска шанса и без полупассивки (навыки Следопыта). Возвращает сколько посажено.
function pathfinderPlant(m, n, force) {
  const p = state.player;
  if (!m || m.hp <= 0 || p.subclass !== 'elf_pathfinder') return 0;
  const seedLvl = scSkillLvl('pfSeed');
  const power = seedLvl ? SKILLS.pfSeed.levels[seedLvl - 1].power : SKILLS.pfSeed.levels[0].power;
  const grow = scSkillData('pfGrowth');
  const turns = SKILLS.pfSeed.turns - (grow ? 1 : 0);
  const dmg = p.pAtk * power / 100 * (grow ? 1 + grow.pct / 100 : 1);
  let deb = getDebuff('monster', 'seeds', m.index);
  const list = deb ? deb.list : [];
  let planted = 0;
  for (let i = 0; i < n && list.length < SEED_MAX; i++) { list.push({ t: turns, dmg }); planted++; }
  if (planted) {
    if (deb) { deb.list = list; renderDebuffBar('monster'); }
    else addDebuff('monster', 'seeds', m.index, { list, turnsLeft: 999 });
  }
  return planted;
}
// Распустить семена: в начале хода — созревшие; Цветение — все сразу.
function pathfinderBloom(m, all, mult) {
  const list = pathfinderSeeds(m);
  if (!list.length) return null;
  const ripe = all ? list.slice() : list.filter(x => x.t <= 0);
  if (!ripe.length) return null;
  const rest = all ? [] : list.filter(x => x.t > 0);
  const raw = ripe.reduce((s, x) => s + x.dmg, 0) * (mult || 1);
  if (rest.length) getDebuff('monster', 'seeds', m.index).list = rest;
  else removeDebuff('monster', 'seeds', m.index);
  return { m, miss: false, dmg: monsterTagDmg(m, Math.max(1, Math.floor(raw)), ['physical', 'life']), type: 'dmg', fx: 'slash-green', n: ripe.length };
}
function pathfinderTick() {
  const b = state.battle;
  const hits = [];
  (b.monsters || []).filter(m => m.hp > 0).forEach(m => {
    const list = pathfinderSeeds(m);
    if (!list.length) return;
    list.forEach(x => { x.t -= 1; });
    const h = pathfinderBloom(m, false, 1);
    if (h) hits.push(h);
  });
  if (!hits.length) { renderDebuffBar('monster'); return; }
  const r = aoeApply(hits);
  logCombat(`🌱 Семена распустились: ${r.total}`, 'log-entry player', `семян: ${hits.reduce((s, h) => s + h.n, 0)}${r.kills ? ` · убито: ${r.kills}` : ''}`);
  renderDebuffBar('monster');
}

// ---- Песнь (Певец клинка) ----
function subclassOnHeroAction(kind) {
  if (scIsDrow()) { subclassOnHeroActionDrow(kind, arguments[1]); return; }
  const p = state.player;
  if (p.subclass !== 'elf_bladesinger') return;
  const b = state.battle;
  const cur = getDebuff('player', 'song');
  let level = cur ? cur.level : 0;
  if (b.bsLast && b.bsLast !== kind) level = Math.min(SONG_MAX, level + 1);
  else if (b.bsLast === kind && !getDebuff('player', 'wind')) level = Math.max(0, level - 2);
  b.bsLast = kind;
  if (level > 0) addDebuff('player', 'song', { level, turnsLeft: 999 });
  else removeDebuff('player', 'song');
}
function bladesingerLivingHeal(dmg) {
  const d = scSkillData('bsLiving');
  if (d && dmg > 0) aoeHeal(dmg * d.pct / 100);
}

// ---- Удар оружием: Клинок Жизни (Певец), семена (Следопыт) ----
function elfOnWeaponHit(m) {
  const p = state.player;
  if (p.subclass === 'elf_pathfinder') {
    if (m && semiPassiveReady('pfSeed') && Math.random() * 100 < SKILLS.pfSeed.chance) pathfinderPlant(m, 1, false);
    return 0;
  }
  if (p.subclass === 'elf_bladesinger') {
    const e = getDebuff('player', 'lifeEdge');
    if (!e) return 0;
    e.charges -= 1;
    if (e.charges <= 0) removeDebuff('player', 'lifeEdge'); else renderDebuffBar('player');
    const add = Math.floor(p.mAtk * e.pct / 100 * (1 + getElementDamageBonus('life') / 100));
    bladesingerLivingHeal(add);
    return add;
  }
  return 0;
}

// ---- Переопределение навыка целиком (до обычных веток). true — обработано. ----
function subclassOverrideSkill(skill, data, m) {
  if (scIsDwarf()) return dwarfOverrideSkill(skill, data, m);
  if (scIsDrow()) return drowOverrideSkill(skill, data, m);
  if (!scIsElf()) return false;
  const p = state.player;
  const sc = p.subclass;
  // Цветение
  if (sc === 'elf_pathfinder' && skill.id === 'natureHeal') {
    const mod = SUBCLASSES.elf_pathfinder.mods.natureHeal;
    const h = pathfinderBloom(m, true, mod.bloomMult);
    if (!h) { logCombat(`🌸 ${skill.name}: на цели нет семян.`, 'log-entry'); return true; }
    const r = aoeApply([h]);
    const heal = aoeHeal(r.total * mod.lifePct / 100);
    addLifeXP();
    logCombat(`🌸 ${skill.name}: ${r.total}`, 'log-entry player-skill', `семян: ${h.n}${heal > 0 ? ` · +${heal} HP` : ''}`);
    updateBattleUI(); checkHealPotion();
    return true;
  }
  // Кора / Дыхание с Клинком Жизни
  if (skill.id === 'natureHeal' && (sc === 'elf_thornguard' || sc === 'elf_bladesinger')) {
    const healed = aoeHeal(rollHealAmount(data.multiplier));
    addLifeXP();
    const notes = [];
    if (sc === 'elf_thornguard') {
      addDebuff('player', 'bark', { turnsLeft: SUBCLASSES.elf_thornguard.mods.natureHeal.barkTurns, cut: data.bark });
      notes.push(`🪵 кора −${data.bark}%`);
    } else {
      const mod = SUBCLASSES.elf_bladesinger.mods.natureHeal;
      addDebuff('player', 'lifeEdge', { charges: mod.edgeHits, pct: mod.edgePct, turnsLeft: 999 });
      notes.push(`🌸 2 удара Жизнью`);
    }
    logCombat(`🌿 ${skill.name}: +${healed} HP`, 'log-entry potion', notes.join(' · '));
    updateTopStatus(); updateBattleUI(); checkHealPotion();
    return true;
  }
  // Падающая звезда
  if (sc === 'elf_stargazer' && skill.id === 'fireball') {
    if (!m || m.hp <= 0) return true;
    addDebuff('monster', 'star', m.index, { turnsLeft: SUBCLASSES.elf_stargazer.mods.fireball.delay, mult: data.starMult });
    stargazerFocus(m);
    addElementXP('fire');
    logCombat(`🌠 ${skill.name}: упадёт на ${m.name} через 2 хода.`, 'log-entry player-magic');
    spawnFloatDamage('fighter-monster', 0, 'magic', { mon: m, text: '🌠' });
    updateBattleUI();
    return true;
  }
  // Росток
  if (sc === 'elf_grovekeeper' && skill.id === 'heal' && !(typeof healStrikeApplies === 'function' && healStrikeApplies(m))) {
    const mod = SUBCLASSES.elf_grovekeeper.mods.heal;
    const total = rollHealAmount(data.multiplier) * mod.hotBonus;
    grovekeeperAddHot(total, mod.hotTurns, 'Росток');
    addLifeXP();
    logCombat(`🌱 ${skill.name}: ~${Math.round(total)} HP за ${mod.hotTurns} хода.`, 'log-entry potion');
    updateBattleUI();
    return true;
  }
  // Друид: Исцеление лечит и духа
  if (sc === 'elf_druid' && skill.id === 'heal' && !(typeof healStrikeApplies === 'function' && healStrikeApplies(m))) {
    const amount = rollHealAmount(data.multiplier);
    const healed = aoeHeal(amount);
    const sp = druidSpirit();
    let sh = 0;
    if (sp) { sh = Math.min(amount, sp.maxHp - sp.hp); sp.hp += sh; alliesRender(); }
    addLifeXP();
    logCombat(`🌿 ${skill.name}: +${healed} HP${sp ? `, духу +${Math.floor(sh)}` : ''}`, 'log-entry potion');
    druidSharedHunt(m);
    updateBattleUI(); checkHealPotion();
    return true;
  }
  return false;
}

// ---- Похищение жизни ----
function subclassDrain(skill, data) {
  const p = state.player;
  const sc = p.subclass;
  const fall = skill.aoe.falloff;
  if (sc === 'elf_stargazer') {
    const hits = aoeTargets(data.targets).map(m => ({ m, ...aoeMagHit(m, data.multiplier * 0.7, 'life'), type: 'magic', fx: 'proj:life' }));
    const r = aoeApply(hits);
    aoeGiveXp(skill);
    const healed = aoeHeal(r.total * data.healPercent / 200);
    return { line: `🌠 ${skill.name}: ${r.total} (целей: ${hits.length})`, notes: healed > 0 ? [`+${healed} HP`] : [] };
  }
  if (sc === 'elf_grovekeeper') {
    const hits = aoeTargets(data.targets).map((m, i) => ({ m, ...aoeMagHit(m, data.multiplier * (fall[i] || fall[fall.length - 1]), 'life'), type: 'magic', fx: 'proj:life' }));
    const r = aoeApply(hits);
    aoeGiveXp(skill);
    const mod = SUBCLASSES.elf_grovekeeper.mods.lifeDrain;
    const total = r.total * data.healPercent / 100 * mod.hotBonus;
    if (total >= 1) grovekeeperAddHot(total, mod.hotTurns, 'Дыхание рощи');
    return { line: `🌿 ${skill.name}: ${r.total}`, notes: total >= 1 ? [`~${Math.round(total)} HP за ${mod.hotTurns} хода`] : [] };
  }
  if (sc === 'elf_druid') {
    const hits = aoeTargets(data.targets).map((m, i) => ({ m, ...aoeMagHit(m, data.multiplier * (fall[i] || fall[fall.length - 1]), 'life'), type: 'magic', fx: 'proj:life' }));
    const r = aoeApply(hits);
    aoeGiveXp(skill);
    const amount = r.total * data.healPercent / 100;
    const healed = aoeHeal(amount);
    const sp = druidSpirit();
    if (sp) { sp.hp = Math.min(sp.maxHp, sp.hp + amount); alliesRender(); }
    druidSharedHunt(hits[0] && hits[0].m);
    return { line: `🌿 ${skill.name}: ${r.total}`, notes: healed > 0 ? [`+${healed} HP`] : [] };
  }
  return null;
}

// ---- Заклинания мага ----
function elfSpellAfter(skill, m, dmg) {
  if (hasSubclass('elf_grovekeeper') && skill.id === 'fireball') {   // Колючая лоза: Жизнь, 15% урона — лечением за 3 хода
    const mod = SUBCLASSES.elf_grovekeeper.mods.fireball;
    spawnFloatDamage('fighter-monster', dmg, 'magic');
    const total = dmg * mod.hotPct / 100;
    if (total >= 1) grovekeeperAddHot(total, mod.hotTurns, skill.name);
    logCombat(`🌿 ${skill.name}: ${dmg}`, 'log-entry player-magic', total >= 1 ? `~${Math.round(total)} HP за ${mod.hotTurns} хода` : '');
    return true;
  }
  if (hasSubclass('elf_druid') && skill.id === 'fireball') {
    const sp = druidSpirit();
    if (sp && m && m.hp > 0) druidSpiritStrike(m, SUBCLASSES.elf_druid.mods.fireball.spiritPct / 100, 'по зову');
    druidSharedHunt(m);
  }
  return false;   // обычная строка и поджог — как у Огненного шара
}
// Сосредоточение: заклинание в цель.
function stargazerFocus(m) {
  const b = state.battle;
  if (!m || !hasSubclass('elf_stargazer')) return;
  if (b.sgFocus && b.sgFocus.idx === m.index) b.sgFocus.n = Math.min(5, b.sgFocus.n + 1);
  else b.sgFocus = { idx: m.index, n: 0 };
}
function stargazerTick() {
  const b = state.battle;
  const hits = [];
  const sgRelease = [];
  (b.monsters || []).forEach(m => {
    const st = getDebuff('monster', 'star', m.index);
    if (!st) return;
    st.turnsLeft -= 1;
    if (st.turnsLeft > 0) return;
    removeDebuff('monster', 'star', m.index);
    let target = m.hp > 0 ? m : aoeAlive()[0];
    if (!target) return;
    sgRelease.push(target);
    hits.push({ m: target, ...aoeMagHit(target, st.mult, 'fire'), type: 'fire', fx: 'proj:fire' });
  });
  // Отражённый свет
  if (b.sgOverflow > 0 && semiPassiveReady('sgReflect')) {
    const t = aoeAlive()[0];
    if (t) hits.push({ m: t, miss: false, dmg: monsterTagDmg(t, Math.floor(b.sgOverflow), ['magic']), type: 'magic', fx: 'proj:arcane', reflect: true });
  }
  b.sgOverflow = 0;
  if (!hits.length) return;
  const r = aoeApply(hits);
  const fell = hits.filter(h => !h.reflect).length;
  if (fell) logCombat(`🌠 Звезда упала: ${hits.filter(h => !h.reflect).reduce((s, h) => s + (h.dmg || 0), 0)}`, 'log-entry player-magic', r.kills ? `убито: ${r.kills}` : '');
  if (hits.some(h => h.reflect)) logCombat(`✨ Отражённый свет: ${hits.find(h => h.reflect).dmg}`, 'log-entry player-magic');
}

// ---- Лечение во времени (Хранитель Рощи) ----
function grovekeeperAddHot(total, turns, src) {
  const b = state.battle;
  if (!b.gkHots) b.gkHots = [];
  b.gkHots.push({ per: total / turns, turns, src });
  grovekeeperHotBadge();
}
function grovekeeperHotBadge() {
  const b = state.battle;
  const list = b.gkHots || [];
  if (!list.length) { removeDebuff('player', 'hot'); return; }
  addDebuff('player', 'hot', { count: list.length, total: list.reduce((s, h) => s + h.per * h.turns, 0), turnsLeft: 999 });
}
function grovekeeperTick() {
  const p = state.player;
  const b = state.battle;
  const gift = getDebuff('player', 'grove');
  if (gift) aoeHeal(p.maxHp * gift.regen / 100);
  const list = b.gkHots || [];
  if (!list.length) return;
  const dew = scSkillData('gkDew');
  let sum = 0;
  list.forEach(h => {
    sum += h.per;
    h.turns -= 1;
    if (dew && h.turns >= 0 && Math.random() * 100 < dew.chance) h.turns += 1;
  });
  b.gkHots = list.filter(h => h.turns > 0);
  const healed = aoeHeal(sum);
  if (healed > 0) logCombat(`🌿 Лечение во времени: +${healed} HP.`, 'log-entry potion');
  grovekeeperHotBadge();
}

// ---- Друид: дух-зверь на всю охоту ----
function druidSpirit() {
  return (typeof alliesList === 'function' ? alliesList() : []).find(a => a.druid) || null;
}
function druidPowerMult() {
  const b = state.battle;
  return 1 + (b.drGrowth || 0) / 100;
}
function druidSummon(data) {
  const p = state.player;
  const kinds = Object.keys(DRUID_KINDS);
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const K = DRUID_KINDS[kind];
  const f = data.power / 100;
  const bonds = scSkillData('drBonds');
  let hp = p.maxHp * K.hp * f + (bonds ? p.maxHp * bonds.hp / 100 : 0);
  let atk = p.mAtk * K.atk * f + (bonds ? p.mAtk * bonds.atk / 100 : 0);
  const a = { kind, druid: true, name: K.name, img: K.img, hp, maxHp: hp, atk, baseAtk: atk, baseHp: hp,
    healHp: K.healHp || 0, healMp: K.healMp || 0, atbCut: K.atbCut || 0, dodge: 10, slow: false };
  const added = alliesAdd(a);
  if (added) {
    druidApplyGrowth();
    state.battle.drSpirit = added;
    logCombat(`🐾 Приходит дух: ${added.name} — ${K.desc}. ${added.hp} HP, удар ${added.atk}.`, 'log-entry player-skill');
  }
}
function druidApplyGrowth() {
  const sp = druidSpirit();
  if (!sp) return;
  const k = druidPowerMult();
  const lost = sp.maxHp - sp.hp;
  sp.atk = Math.max(1, Math.floor(sp.baseAtk * k));
  sp.maxHp = Math.max(1, Math.floor(sp.baseHp * k));
  sp.hp = Math.max(1, sp.maxHp - lost);
  alliesRender(true);
}
function druidSpiritStrike(m, mult, why) {
  const sp = druidSpirit();
  if (!sp || !m || m.hp <= 0) return 0;
  const raw = sp.atk * mult;
  const dmg = monsterTagDmg(m, Math.max(1, Math.floor(raw - (m.pDef || 0) * ALLY_PDEF_FACTOR)), ['physical']);
  if (sp.atbCut) cutMonstersATB(sp.atbCut / 100);
  const r = aoeApply([{ m, miss: false, dmg, type: 'dmg', fx: 'slash' }]);
  logCombat(`🐾 ${sp.name}${why ? ` (${why})` : ''}: ${r.total}`, 'log-entry player', r.kills ? 'добыча!' : '');
  return r.total;
}
// Общая охота: заклинание с шансом крита героя — бесплатный удар духа.
function druidSharedHunt(m) {
  if (!hasSubclass('elf_druid') || !semiPassiveReady('drHunt') || !druidSpirit()) return;
  if (Math.random() * 100 >= (state.player.critChance || 10)) return;
  const t = (m && m.hp > 0) ? m : aoeAlive()[0];
  if (t) druidSpiritStrike(t, scSkillData('drHunt').mult, 'общая охота');
}

// ---- Удар по герою до HP: Корни (Терновый страж) ----
function elfAbsorbHit(dmg) {
  const p = state.player;
  const b = state.battle;
  if (p.subclass !== 'elf_thornguard') return dmg;
  let share = 0;
  const rooting = getDebuff('player', 'rooting');
  const roots = scSkillData('tgRoots');
  if (rooting) share = rooting.share; else if (roots) share = roots.share;
  if (!share) return dmg;
  const moved = Math.floor(dmg * share / 100);
  if (moved <= 0) return dmg;
  const kept = Math.floor(moved / 2);   // половина ушедшего в корни рассасывается (и Укоренение, и пассивные корни)
  b.tgPool = (b.tgPool || 0) + kept;
  addDebuff('player', 'rootPool', { amount: b.tgPool, turnsLeft: 999 });
  return dmg - moved;
}
// Отложенный урон приходит в начале хода героя (треть за ход).
function thornguardPoolTick() {
  const p = state.player;
  const b = state.battle;
  if (!(b.tgPool > 0)) return;
  let part = b.tgPool <= 5 ? b.tgPool : Math.ceil(b.tgPool / 3);
  b.tgPool -= part;
  part = Math.floor(part);
  if (b.tgPool > 0.5) addDebuff('player', 'rootPool', { amount: b.tgPool, turnsLeft: 999 });
  else { b.tgPool = 0; removeDebuff('player', 'rootPool'); }
  if (part <= 0) return;
  p.hp -= part;
  spawnFloatDamage('fighter-player', part, 'dmg');
  logCombat(`🍂 Корни отдают урон: ${part}.`, 'log-entry monster', b.tgPool > 0 ? `в корнях ещё ${Math.ceil(b.tgPool)}` : '');
  if (p.hp <= 0) { p.hp = 0; onPlayerDeath(); }
}

// ---- Лечение героя ----
let scElfHealBusy = false;
function elfOnHeroHeal(healed, overflow) {
  const p = state.player;
  const b = state.battle;
  if (!b.active || scElfHealBusy) return;
  scElfHealBusy = true;
  try {
    if (p.subclass === 'elf_thornguard') {
      const s = scSkillData('tgSap');
      if (s && healed > 0) { const extra = Math.min(Math.floor(healed * s.pct / 100), p.maxHp - p.hp); if (extra > 0) { p.hp += extra; healed += extra; } }
      // лечение сначала гасит отложенный урон
      if (b.tgPool > 0 && healed > 0) {
        const take = Math.min(b.tgPool, healed);
        b.tgPool -= take;
        p.hp -= take;
        if (b.tgPool > 0.5) addDebuff('player', 'rootPool', { amount: b.tgPool, turnsLeft: 999 });
        else { b.tgPool = 0; removeDebuff('player', 'rootPool'); }
      }
    } else if (p.subclass === 'elf_grovekeeper') {
      const g = getDebuff('player', 'grove');
      if (g && healed > 0) { const extra = Math.min(Math.floor(healed * g.heal / 100), p.maxHp - p.hp); if (extra > 0) { p.hp += extra; healed += extra; } }
      const c = scSkillData('gkCycle');
      if (c && healed > 0) { const mp = Math.min(Math.floor(healed * c.pct / 100), p.maxMp - p.mp); if (mp > 0) p.mp += mp; }
    } else if (p.subclass === 'elf_bladesinger' && overflow >= 1 && semiPassiveReady('bsSprout')) {
      const m = getCurrentMonster();
      if (m && m.hp > 0) {
        const d = scSkillData('bsSprout');
        const dmg = monsterTagDmg(m, Math.max(1, Math.floor(overflow * d.pct / 100)), ['magic', 'life']);
        m.hp -= Math.min(dmg, m.hp - 1);   // росток не добивает (лечение может прийти посреди чужого хода)
        spawnFloatDamage('fighter-monster', dmg, 'magic', { mon: m });
        bladesingerLivingHeal(dmg);
      }
    }
  } finally { scElfHealBusy = false; }
}

// ---- После удара твари: Шипастая кора, Бутон ----
function elfAfterHeroHit(m, dmg, crit) {
  const p = state.player;
  if (p.hp <= 0) return;
  if (p.subclass === 'elf_thornguard' && m && m.hp > 0 && dmg > 0 && semiPassiveReady('tgBarbs')) {
    const d = scSkillData('tgBarbs');
    const back = monsterTagDmg(m, Math.max(1, Math.floor(dmg * d.pct / 100 * (crit ? 2 : 1))), ['physical', 'life']);
    m.hp -= back;
    spawnFloatDamage('fighter-monster', back, 'dmg', { mon: m });
    logCombat(`🌵 Шипастая кора: ${back}${crit ? ' (за крит ×2)' : ''}`, 'log-entry player');
    if (m.hp <= 0) { m.hp = 0; onMonsterDeath(m); }
  }
  if (p.subclass === 'elf_grovekeeper' && semiPassiveReady('gkBud') && !getDebuff('player', 'budCd') && p.hp / p.maxHp * 100 < SKILLS.gkBud.threshold) {
    const d = scSkillData('gkBud');
    grovekeeperAddHot(p.maxHp * d.total / 100, SKILLS.gkBud.turns, 'Бутон');
    addDebuff('player', 'budCd', { turnsLeft: SKILLS.gkBud.every });
    logCombat(`🌷 Бутон раскрылся: ${d.total}% HP за 3 хода.`, 'log-entry potion');
  }
}

// ---- Смерть твари ----
function elfOnMonsterDeath(m) {
  const p = state.player;
  const b = state.battle;
  if (p.subclass === 'elf_druid' && druidSpirit()) {
    const g = scSkillData('drGrowing');
    if (g) {
      const before = b.drGrowth || 0;
      b.drGrowth = Math.min(g.cap, before + g.per);
      if (b.drGrowth !== before) druidApplyGrowth();
    }
  }
}
// Урон по твари: Отражённый свет копит излишек при убийстве.
function elfOnHeroDamage(m, dmg) {
  if (!hasSubclass('elf_stargazer') || !m) return;
  const over = dmg - m.hp;
  const d = scSkillData('sgReflect');
  if (over > 0 && d && semiPassiveReady('sgReflect')) state.battle.sgOverflow = (state.battle.sgOverflow || 0) + over * d.pct / 100;
}

// ---- Начало хода героя ----
function elfOnHeroTurn() {
  const p = state.player;
  const b = state.battle;
  if (!b.active) return;
  if (p.subclass === 'elf_thornguard') thornguardPoolTick();
  else if (p.subclass === 'elf_pathfinder') pathfinderTick();
  else if (p.subclass === 'elf_stargazer') stargazerTick();
  else if (p.subclass === 'elf_grovekeeper') grovekeeperTick();
}

// Начало боя: дух Друида возвращается (живёт всю охоту).
function elfOnBattleStart() {
  const b = state.battle;
  b.tgPool = 0; b.bsLast = null; b.sgFocus = null; b.sgOverflow = 0; b.gkHots = [];
  if (hasSubclass('elf_druid') && b.drSpirit && b.drSpirit.hp > 0) {
    const sp = b.drSpirit;
    sp.hp = sp.maxHp;
    if (!state.battle.allies) state.battle.allies = [];
    state.battle.allies.push(sp);
    alliesRender(true);
  } else if (!hasSubclass('elf_druid')) {
    b.drSpirit = null; b.drGrowth = 0;
  }
}
function elfOnAllyDeath(a) {
  if (a.druid) {
    state.battle.drSpirit = null;
    state.battle.drGrowth = 0;
    logCombat(`🐾 Дух-зверь уходит в лес. Связь придётся растить заново.`, 'log-entry loss');
  }
}

// ---- Новые активки эльфа ----
function elfPerformActive(skill, data) {
  const p = state.player;
  const m = getCurrentMonster();
  if (skill.id === 'tgRoot') {
    addDebuff('player', 'rooting', { turnsLeft: skill.turns, share: data.share });
    logCombat(`🌳 Укоренение: ${skill.turns} ходов ${data.share}% удара уходит в корни.`, 'log-entry player-skill');
    spawnFloatDamage('fighter-player', 0, 'block', { text: 'КОРНИ' });
  } else if (skill.id === 'pfLeaves') {
    const hits = aoeAlive().map(x => ({ m: x, ...aoePhysHit(x, data.multiplier, getElementDamageBonus('life')), fx: 'slash-green' })).map(h => ({ ...h, type: h.crit ? 'crit' : 'dmg' }));
    hits.forEach(h => { if (!h.miss) pathfinderPlant(h.m, 1, true); });
    const r = aoeApply(hits);
    addLifeXP();
    logCombat(`🍃 ${skill.name}: ${r.total} (целей: ${hits.length})`, 'log-entry player-skill', 'каждому семя');
  } else if (skill.id === 'bsWind') {
    addDebuff('player', 'wind', { turnsLeft: skill.turns, atb: data.atb });
    logCombat(`🍃 Песнь ветра: ${skill.turns} ходов шкала хода +${data.atb}%, Песнь не падает.`, 'log-entry player-skill');
    addLifeXP();
  } else if (skill.id === 'sgStarfall') {
    if (!m) return true;
    const hits = [{ m, ...aoeMagHit(m, data.multiplier, 'life'), type: 'magic', fx: 'proj:life' }];
    const st = getDebuff('monster', 'star', m.index);
    if (st) { removeDebuff('monster', 'star', m.index); hits.push({ m, ...aoeMagHit(m, st.mult, 'fire'), type: 'fire', fx: 'proj:fire' }); }
    stargazerFocus(m);
    const r = aoeApply(hits);
    addLifeXP();
    logCombat(`✨ ${skill.name}: ${r.total}`, 'log-entry player-magic', st ? '🌠 звезда упала сразу' : '');
  } else if (skill.id === 'gkGift') {
    addDebuff('player', 'grove', { turnsLeft: 999, regen: data.regen, heal: data.heal, dmg: data.dmg || 0 });
    logCombat(`🌳 Дар рощи: до конца боя ${data.regen}% HP за ход и лечение +${data.heal}%.`, 'log-entry player-skill');
    addLifeXP();
  } else if (skill.id === 'drSpirit') {
    const sp = druidSpirit();
    if (!sp) druidSummon(data);
    else if (m) druidSpiritStrike(m, data.rage, 'ярость духа');
    addLifeXP();
  } else {
    return false;
  }
  return true;
}

SKILLS.tgRoot.autoCheck = function () {
  if (getDebuff('player', 'rooting')) return false;
  const alive = (state.battle.monsters || []).filter(m => m.hp > 0);
  return alive.length >= 2 || alive.some(scStrongMonster);
};
SKILLS.bsWind.autoCheck = function () { return !getDebuff('player', 'wind'); };
SKILLS.gkGift.autoCheck = function () { return !getDebuff('player', 'grove'); };

// ========================================================
//  ДРОУ: Грозовой страж, Ассасин, Теневой ткач, Буревестник, Ткач снов, Паучий владыка
//  Общие функции подклассов передают дроу управление через scIsDrow().
// ========================================================
function scIsDrow() {
  const p = state.player;
  return !!(p && p.raceId === 'drow' && p.subclass);
}

DEBUFF_DEFS.static = { icon: '⚡', name: 'Статика', cssClass: 'debuff-paralysis',
  displayCount: (d) => d.stacks || 0,
  tooltip: (d) => `Статика ${d.stacks || 0}/${STATIC_MAX} · на ${STATIC_MAX} — разряд молнии и шкала хода −50%.` };
DEBUFF_DEFS.stormArmor = { icon: '🌩', name: 'Грозовой доспех', cssClass: 'debuff-guard',
  tooltip: (d) => `Грозовой доспех · входящий урон −${d.cut || 0}%, удар по вам даёт 2 заряда Статики и молнию в ответ · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.venom = { icon: '🕷', name: 'Яд', cssClass: 'debuff-poison',
  displayCount: (d) => d.stacks || 0,
  tooltip: (d) => `Яд × ${d.stacks || 0} · ${Math.floor((d.per || 0) * (d.stacks || 0))} урона в ход.` };
DEBUFF_DEFS.shadowStep = { icon: '👣', name: 'Шаг тени', cssClass: 'debuff-rune',
  tooltip: (d) => `Шаг тени · этот ход урон +${d.dmg}%.` };
DEBUFF_DEFS.double = { icon: '👥', name: 'Теневой двойник', cssClass: 'debuff-rune',
  displayCount: (d) => d.turnsLeft,
  tooltip: (d) => `Теневой двойник · повторяет удары на ${d.pct}% · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.chargedBlade = { icon: '🗡', name: 'Заряженный клинок', cssClass: 'debuff-paralysis',
  displayCount: () => '',
  tooltip: (d) => `Заряженный клинок · следующий удар оружием +${d.pct}% силы молнии.` };
DEBUFF_DEFS.tension = { icon: '🌩', name: 'Напряжение', cssClass: 'debuff-paralysis',
  displayCount: (d) => d.stacks || 0,
  tooltip: (d) => (d.stacks || 0) >= 5 ? `Напряжение готово · следующая молния усилена и без маны.` : `Напряжение ${d.stacks || 0}/5 · молнии подряд.` };
DEBUFF_DEFS.stormFront = { icon: '⛈', name: 'Грозовой фронт', cssClass: 'debuff-paralysis',
  tooltip: (d) => `Грозовой фронт · молния каждый ход · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.sleep = { icon: '💤', name: 'Сон', cssClass: 'debuff-freeze',
  displayCount: (d) => d.turnsLeft,
  tooltip: (d) => `Сон · пропускает ходы, пока её не ударят · ещё ${d.turnsLeft} ход.` };
DEBUFF_DEFS.haste = { icon: '💨', name: 'Ускорение', cssClass: 'debuff-regen',
  tooltip: (d) => `Ускорение · шкала хода +${d.atb}% · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.mistCd = { icon: '⏳', name: 'Сонная дымка: перезарядка', cssClass: 'debuff-paraimmune',
  tooltip: (d) => `Сонная дымка собирается · ещё ${d.turnsLeft} ход.` };
DEBUFF_DEFS.webbed = { icon: '🕸', name: 'Паутина', cssClass: 'debuff-web',
  tooltip: (d) => `Паутина · шкала хода медленнее на ${d.pct}% · осталось ${d.turnsLeft} ход.` };

// ---- Общее: яд ----
function drowAddVenom(m, n, per) {
  if (!m || m.hp <= 0) return;
  const v = getDebuff('monster', 'venom', m.index);
  const stacks = Math.min(5, (v ? v.stacks : 0) + n);
  addDebuff('monster', 'venom', m.index, { stacks, per: Math.max(per, v ? v.per : 0), turnsLeft: 999 });
}
function drowVenomTick() {
  const hits = [];
  aoeAlive().forEach(m => {
    const v = getDebuff('monster', 'venom', m.index);
    if (!v || !v.stacks) return;
    hits.push({ m, miss: false, dmg: monsterTagDmg(m, Math.max(1, Math.floor(v.per * v.stacks)), ['poison']), type: 'poison', fx: 'toxic-small' });
  });
  if (!hits.length) return;
  const r = aoeApply(hits);
  logCombat(`🕷 Яд: ${r.total}`, 'log-entry poison', r.kills ? `убито: ${r.kills}` : '');
}
// Сон: спит ли кто-то.
function drowAnyAsleep() {
  return (state.battle.monsters || []).some(m => m.hp > 0 && getDebuff('monster', 'sleep', m.index));
}
function drowSleep(m, turns) {
  if (!m || m.hp <= 0) return false;
  if (monsterHasTagFlag(m, 'stunImmune')) return false;
  addDebuff('monster', 'sleep', m.index, { turnsLeft: turns });
  spawnFloatDamage('fighter-monster', 0, 'block', { mon: m, text: 'СОН' });
  return true;
}
// Ход твари: спящая пропускает (battle-loop).
function subclassMonsterSkip(m) {
  const s = getDebuff('monster', 'sleep', m.index);
  if (!s) return false;
  s.turnsLeft -= 1;
  if (s.turnsLeft <= 0) removeDebuff('monster', 'sleep', m.index); else renderDebuffBar('monster');
  logCombat(`💤 ${m.name} спит.`, 'log-entry magic');
  return true;
}

// ---- Множители ----
function drowHeroDmgMult(m) {
  const p = state.player;
  const b = state.battle;
  let mult = 1;
  if (p.subclass === 'drow_assassin') {
    const st = getDebuff('player', 'shadowStep');
    if (st) mult *= 1 + st.dmg / 100;
    const v = m ? getDebuff('monster', 'venom', m.index) : null;
    if (v && semiPassiveReady('asSting')) mult *= 1 + 0.03 * v.stacks;
  } else if (p.subclass === 'drow_shadowweaver') {
    const d = getDebuff('player', 'double');
    if (d) mult *= 1 + d.pct / 100;
  } else if (p.subclass === 'drow_stormcaller') {
    if (b.scSurge) mult *= scSkillData('scTension').mult;
  } else if (p.subclass === 'drow_dreamweaver') {
    const n = scSkillData('dwNightmare');
    if (n && m && getDebuff('monster', 'sleep', m.index)) mult *= 1 + n.pct / 100;
  }
  return mult;
}
function drowDamageTakenMult(attacker, isMagic) {
  const p = state.player;
  let mult = 1;
  if (attacker) mult *= subclassMonsterWeakMult(attacker);
  if (p.subclass === 'drow_stormguard') {
    const g = scSkillData('sgGround');
    if (g) {
      if (isMagic) mult *= 1 - g.magic / 100;
      const st = attacker ? getDebuff('monster', 'static', attacker.index) : null;
      if (st) mult *= 1 - 0.05 * st.stacks;
    }
    const arm = getDebuff('player', 'stormArmor');
    if (arm && arm.cut) mult *= 1 - arm.cut / 100;   // Грозовой доспех
  }
  return mult;
}
function drowAtbMult() {
  let mult = 1;
  const h = getDebuff('player', 'haste');
  if (h) mult *= 1 + h.atb / 100;
  return mult;
}

function drowApplyPassives(p) {
  if (p.subclass === 'drow_assassin') {
    const d = scSkillData('asDual');
    const off = getOffhandWeapon();
    if (d && off) {
      p.offhandPAtk = Math.floor(getItemStat(off, 'pAtk') * d.off / 100);
      p.skillBonuses.push(`Парные клинки (ур.${scSkillLvl('asDual')}): вторая рука ${d.off}% (+${p.offhandPAtk}), без штрафа точности`);
    } else if (d) p.skillBonuses.push(`Парные клинки: не действует — нужно оружие во второй руке`);
  } else if (p.subclass === 'drow_shadowweaver') {
    const f = scSkillData('swFlesh');
    if (f) { p.maxMp = Math.floor(p.maxMp * (1 + f.mp / 100)); p.skillBonuses.push(`Плоть грозы (ур.${scSkillLvl('swFlesh')}): +${f.mp}% макс. MP`); }
  } else if (p.subclass === 'drow_stormguard') {
    const g = scSkillData('sgGround');
    if (g) p.skillBonuses.push(`Заземление (ур.${scSkillLvl('sgGround')}): маг. урон по вам −${g.magic}%`);
  }
}
function drowAccuracyBonus() {
  if (hasSubclass('drow_assassin') && scSkillData('asDual') && getOffhandWeapon()) return DUAL_WIELD_ACCURACY_PENALTY;
  return 0;
}

// ---- Удары воина ----
function drowHitAtk(skillId) {
  const p = state.player;
  if (p.subclass === 'drow_shadowweaver' && skillId === 'powerStrike') return Math.floor(p.mAtk * SUBCLASSES.drow_shadowweaver.mods.powerStrike.magPart);
  return 0;
}
function drowStrikeMult(skill, data, m, notes) {
  if (hasSubclass('drow_assassin') && skill.id === 'powerStrike' && m && (m.atb || 0) < SUBCLASSES.drow_assassin.mods.powerStrike.backAtb / 100) {
    notes.push('🗡 в спину ×1.5');
    return data.multiplier * SUBCLASSES.drow_assassin.mods.powerStrike.backMult;
  }
  return data.multiplier;
}
function drowAfterStrike(skill, m, hitsLanded, totalDamage) {
  const p = state.player;
  if (skill.id !== 'powerStrike' || !m || m.hp <= 0) return '';
  if (p.subclass === 'drow_stormguard') { m.atb = Math.max(0, (m.atb || 0) - SUBCLASSES.drow_stormguard.mods.powerStrike.atbCut / 100); return '⚡ ход −30%'; }
  if (p.subclass === 'drow_shadowweaver') { m.atb = Math.max(0, (m.atb || 0) - SUBCLASSES.drow_shadowweaver.mods.powerStrike.atbCut / 100); return '⚡ ход −20%'; }
  return '';
}
// Удар оружием: Заряженный клинок, Ядовитое жало.
function drowOnWeaponHit(m) {
  const p = state.player;
  if (!m) return 0;
  if (p.subclass === 'drow_assassin' && semiPassiveReady('asSting')) {
    drowAddVenom(m, 1, p.pAtk * scSkillData('asSting').tick / 100);
    return 0;
  }
  if (p.subclass === 'drow_shadowweaver') {
    const cb = getDebuff('player', 'chargedBlade');
    if (!cb) return 0;
    removeDebuff('player', 'chargedBlade');
    m.atb = Math.max(0, (m.atb || 0) - 0.10);
    return Math.floor(scHybridPower() * cb.pct / 100 * (1 + getElementDamageBonus('lightning') / 100));
  }
  return 0;
}

// ---- Разряд ----
// Гарантированный паралич (Грозовой страж: цель со Статикой).
function subclassDischargeParalyze(m) {
  return hasSubclass('drow_stormguard') && !!m && !!getDebuff('monster', 'static', m.index);
}
// После Разряда (до строки журнала). Возвращает приписку.
function subclassAfterDischarge(m, dmg) {
  const p = state.player;
  if (p.subclass === 'drow_assassin') {
    state.battle.playerATB = Math.min(1, (state.battle.playerATB || 0) + SUBCLASSES.drow_assassin.mods.discharge.selfAtb / 100);
    return 'ваш ход +30%';
  }
  if (p.subclass === 'drow_shadowweaver' && semiPassiveReady('swBlade')) {
    addDebuff('player', 'chargedBlade', { pct: scSkillData('swBlade').pct, turnsLeft: 999 });
    return '🗡 клинок заряжен';
  }
  return '';
}
// Паралич наложен (из onDischargeZeroed).
function subclassOnParalyze(m) {
  const p = state.player;
  if (p.subclass === 'drow_shadowweaver') {
    const f = scSkillData('swFlesh');
    if (f) { const mp = Math.min(Math.floor(p.maxMp * 0.05), p.maxMp - p.mp); if (mp > 0) p.mp += mp; }
    const d = getDebuff('player', 'double');
    if (d) { d.turnsLeft += 2; renderDebuffBar('player'); logCombat(`👥 Двойник держится дольше: +2 хода.`, 'log-entry player-skill'); }
    else { addDebuff('player', 'double', { turnsLeft: 2, pct: shadowDoublePct() }); logCombat(`👥 Из тени шагает двойник на 2 хода.`, 'log-entry player-skill'); }
  } else if (p.subclass === 'drow_spiderlord' && m && m.hp > 0) {
    spiderList().forEach(s => { if (m.hp > 0) spiderBite(s, m, 'на парализованного'); });
  }
}
function shadowDoublePct() {
  const lvl = scSkillLvl('swDouble');
  let pct = lvl ? SKILLS.swDouble.levels[lvl - 1].pct : SKILLS.swDouble.levels[0].pct;
  const deep = scSkillData('swDeep');
  if (deep) pct += deep.pct;
  return pct;
}

// ---- Искровой разрез ----
function subclassSpark(data) {
  const p = state.player;
  const mod = getPlayerSubclass() && getPlayerSubclass().mods.sparkSlash;
  if (!scIsDrow() || !mod) return { targets: data.targets };
  if (mod.fixedTargets) return { targets: mod.fixedTargets };
  if (mod.extraTargets) return { targets: data.targets + mod.extraTargets };
  return { targets: data.targets };
}
function subclassAfterSpark(hits) {
  if (!hasSubclass('drow_stormguard')) return '';
  let n = 0;
  hits.forEach(h => { if (!h.miss && h.m && h.m.hp > 0) { stormguardStatic(h.m, 1, true); n++; } });
  return n ? `⚡ Статика: ${n}` : '';
}

// ---- Статика (Грозовой страж) ----
function stormguardStatic(m, n, quiet) {
  const p = state.player;
  if (!m || m.hp <= 0) return;
  const st = getDebuff('monster', 'static', m.index);
  const stacks = (st ? st.stacks : 0) + n;
  if (stacks >= STATIC_MAX && semiPassiveReady('sgStatic')) {
    removeDebuff('monster', 'static', m.index);
    const d = scSkillData('sgStatic');
    const dmg = monsterTagDmg(m, Math.max(1, Math.floor(p.pAtk * d.pct / 100)), ['magic', 'lightning']);
    m.atb = Math.max(0, (m.atb || 0) * 0.5);
    m.hp -= dmg;
    spawnFloatDamage('fighter-monster', dmg, 'magic', { mon: m });
    logCombat(`⚡ Статика разрядилась: ${dmg}`, 'log-entry player-magic', 'ход твари −50%');
    if (m.hp <= 0) { m.hp = 0; onMonsterDeath(m); }
  } else {
    addDebuff('monster', 'static', m.index, { stacks: Math.min(STATIC_MAX, stacks), turnsLeft: 999 });
  }
}

// ---- Наследие Грозы: Проводник ----
function subclassStormLegacyFreq(freq) {
  return (hasSubclass('drow_stormguard') && scSkillData('sgConductor')) ? Math.max(1, freq - 1) : freq;
}
function subclassStormLegacyBonus() {
  const d = hasSubclass('drow_stormguard') ? scSkillData('sgConductor') : null;
  return d ? Math.floor(state.player.pDef * d.def / 100) : 0;
}

// ---- Удар твари по герою ----
function drowAfterHeroHit(m, dmg, crit) {
  const p = state.player;
  if (p.hp <= 0 || !m) return;
  if (p.subclass === 'drow_stormguard' && m.hp > 0) {
    const arm = getDebuff('player', 'stormArmor');
    if (arm) {
      const bolt = monsterTagDmg(m, Math.max(1, Math.floor(p.pAtk * arm.pct / 100)), ['magic', 'lightning']);
      m.hp -= bolt;
      spawnFloatDamage('fighter-monster', bolt, 'magic', { mon: m });
      logCombat(`🌩 Грозовой доспех: ${bolt}`, 'log-entry player-magic');
      if (m.hp <= 0) { m.hp = 0; onMonsterDeath(m); return; }
      stormguardStatic(m, 2);
    } else if (semiPassiveReady('sgStatic')) {
      stormguardStatic(m, 1);
    }
  }
  if (p.subclass === 'drow_dreamweaver' && semiPassiveReady('dwMist') && !getDebuff('player', 'mistCd') && p.hp / p.maxHp * 100 < SKILLS.dwMist.threshold) {
    let n = 0;
    aoeAlive().forEach(x => { if (drowSleep(x, 1)) n++; });
    addDebuff('player', 'mistCd', { turnsLeft: scSkillData('dwMist').every });
    logCombat(`💤 Сонная дымка: уснули ${n}.`, 'log-entry player-magic');
  }
}

// ---- Урон по твари: будит спящую ----
function drowOnHeroDamage(m, dmg) {
  if (m && dmg > 0 && getDebuff('monster', 'sleep', m.index)) {
    removeDebuff('monster', 'sleep', m.index);
    logCombat(`💤 ${m.name} просыпается.`, 'log-entry');
  }
}

// ---- Смерть твари: Лёгкая рука ----
function drowOnMonsterDeath(m) {
  if (hasSubclass('drow_assassin')) {
    const d = scSkillData('asLight');
    if (d) state.battle.playerATB = Math.min(1, (state.battle.playerATB || 0) + d.atb / 100);
  }
}

// ---- Буревестник: Напряжение и молнии ----
function subclassOnHeroActionDrow(kind, skill) {
  const b = state.battle;
  b.scSurge = false;
  if (!hasSubclass('drow_stormcaller')) return;
  const isBolt = skill && LIGHTNING_SPELLS.includes(skill.id);
  const t = getDebuff('player', 'tension');
  const stacks = t ? t.stacks : 0;
  if (!isBolt) { if (t) removeDebuff('player', 'tension'); return; }
  const ten = scSkillData('scTension');
  if (ten && stacks >= 5) {
    b.scSurge = true;   // эта молния — усиленная и бесплатная
    removeDebuff('player', 'tension');
    logCombat(`🌩 Напряжение: молния ×${ten.mult} и без маны!`, 'log-entry player-skill');
    return;
  }
  if (ten) addDebuff('player', 'tension', { stacks: Math.min(5, stacks + 1), turnsLeft: 999 });
}
function drowMpCost(skill, cost) {
  return state.battle.scSurge ? 0 : cost;
}
function subclassChainMindBonus() {
  const d = hasSubclass('drow_stormcaller') ? scSkillData('scBlood') : null;
  return d ? d.chance : 0;
}
function subclassOnChainMind() {
  const p = state.player;
  if (!hasSubclass('drow_stormcaller') || !semiPassiveReady('scSpark')) return;
  const alive = aoeAlive();
  if (!alive.length) return;
  const t = alive[Math.floor(Math.random() * alive.length)];
  const d = scSkillData('scSpark');
  const h = aoeMagHit(t, d.pct / 100, 'lightning');
  const r = aoeApply([{ m: t, ...h, type: 'magic', fx: 'bolt' }]);
  logCombat(`✨ Искрение: ${h.miss ? 'мимо' : r.total}`, 'log-entry player-magic');
}
function stormcallerFrontTick() {
  const f = getDebuff('player', 'stormFront');
  if (!f) return;
  const alive = aoeAlive();
  if (!alive.length) return;
  const t = alive[Math.floor(Math.random() * alive.length)];
  const h = aoeMagHit(t, f.pct / 100, 'lightning');
  const r = aoeApply([{ m: t, ...h, type: 'magic', fx: 'bolt' }]);
  logCombat(`⛈ Грозовой фронт: ${h.miss ? 'мимо' : r.total}`, 'log-entry player-magic');
}

// ---- Заклинания мага ----
function drowSpellElem(skillId, elemId) {
  if (skillId !== 'fireball') return elemId;
  if (hasSubclass('drow_stormcaller')) return 'lightning';
  if (hasSubclass('drow_spiderlord')) return 'death';
  return elemId;
}
function drowSpellAfter(skill, m, dmg) {
  const p = state.player;
  if (skill.id !== 'fireball') return false;
  if (p.subclass === 'drow_stormcaller') {
    spawnFloatDamage('fighter-monster', dmg, 'magic');
    const other = aoeAlive().find(x => x !== m);
    const notes = [];
    if (other) {
      const splash = monsterTagDmg(other, Math.max(1, Math.floor(dmg * SUBCLASSES.drow_stormcaller.mods.fireball.splash / 100)), ['magic', 'lightning']);
      other.hp -= Math.min(splash, other.hp - 1);
      spawnFloatDamage('fighter-monster', splash, 'magic', { mon: other });
      notes.push(`отскок в ${other.name}: ${splash}`);
    }
    logCombat(`⚡ ${skill.name}: ${dmg}`, 'log-entry player-magic', notes.join(' · '));
    return true;
  }
  if (p.subclass === 'drow_spiderlord') {
    spawnFloatDamage('fighter-monster', dmg, 'poison');
    const lvl = scSkillLvl('slVenom');
    const tick = lvl ? SKILLS.slVenom.levels[lvl - 1].tick : 4;
    if (m.hp > 0) drowAddVenom(m, 2, p.mAtk * tick / 100);
    logCombat(`🕷 ${skill.name}: ${dmg}`, 'log-entry player-magic', m.hp > 0 ? '🕷 яд ×2' : '');
    return true;
  }
  return false;
}
// Переопределение целиком: Сон, Живая искра.
function drowOverrideSkill(skill, data, m) {
  const p = state.player;
  if (p.subclass !== 'drow_dreamweaver') return false;
  if (skill.id === 'fireball') {
    const alive = aoeAlive().filter(x => !getDebuff('monster', 'sleep', x.index));
    const t = alive.find(x => x !== m) || alive[0];
    if (!t || (t === m && alive.length === 1)) {
      // усыплять некого (неспящая тварь одна — текущая цель) — Кошмар: молния по ней
      if (!m || m.hp <= 0) return true;
      const h = aoeMagHit(m, data.multiplier, 'lightning');
      const r = aoeApply([{ m, ...h, type: 'magic', fx: 'bolt' }]);
      addElementXP('lightning');
      logCombat(`💤 Кошмар: ${h.miss ? 'мимо' : r.total}`, 'log-entry player-magic', r.kills ? `убито: ${r.kills}` : '');
      updateBattleUI();
      return true;
    }
    const ok = drowSleep(t, SUBCLASSES.drow_dreamweaver.mods.fireball.sleepTurns);
    logCombat(ok ? `💤 ${skill.name}: ${t.name} засыпает.` : `💤 ${t.name} не поддаётся сну.`, 'log-entry player-magic');
    updateBattleUI();
    return true;
  }
  if (skill.id === 'discharge') {
    const mod = SUBCLASSES.drow_dreamweaver.mods.discharge;
    const notes = [];
    if (m && m.hp > 0) {
      const h = aoeMagHit(m, data.multiplier * mod.dmgPart, 'lightning');
      const r = aoeApply([{ m, ...h, type: 'magic', fx: 'bolt' }]);
      notes.push(h.miss ? 'искра мимо' : `искра ${r.total}`);
    }
    const heal = aoeHeal(rollHealAmount(data.multiplier));
    state.battle.playerATB = Math.min(1, (state.battle.playerATB || 0) + mod.selfAtb / 100);
    addElementXP('lightning');
    logCombat(`✨ ${skill.name}: +${heal} HP`, 'log-entry potion', notes.concat(['ваш ход +30%']).join(' · '));
    updateBattleUI(); checkHealPotion();
    return true;
  }
  return false;
}
// Цепная молния: цели и последствия.
function subclassChainTargets(data) {
  if (hasSubclass('drow_spiderlord')) return data.targets + spiderList().length;
  return data.targets;
}
function subclassAfterChain(hits) {
  const p = state.player;
  const cur = getCurrentMonster();
  if (p.subclass === 'drow_dreamweaver') {
    let n = 0;
    hits.forEach(h => { if (!h.miss && h.m && h.m.hp > 0 && h.m !== cur && drowSleep(h.m, SUBCLASSES.drow_dreamweaver.mods.chainLightning.sleepTurns)) n++; });
    return n ? `💤 уснули: ${n}` : '';
  }
  return '';
}

// ---- Лечение (Ткач снов): Колыбельная ----
let scDrowHealBusy = false;
function drowOnHeroHeal(healed, overflow) {
  const p = state.player;
  if (p.subclass !== 'drow_dreamweaver' || !state.battle.active || healed <= 0 || scDrowHealBusy) return;
  const l = scSkillData('dwLullaby');
  if (!l || !drowAnyAsleep()) return;
  scDrowHealBusy = true;
  const extra = Math.min(Math.floor(healed * l.heal / 100), p.maxHp - p.hp);
  if (extra > 0) p.hp += extra;
  scDrowHealBusy = false;
}
function drowRegenMult() {
  const l = hasSubclass('drow_dreamweaver') ? scSkillData('dwLullaby') : null;
  return (l && drowAnyAsleep()) ? l.regen : 1;
}

// ---- Пауки (Паучий владыка) ----
function spiderList() { return (typeof alliesList === 'function' ? alliesList() : []).filter(a => a.spider); }
function spiderMother() { return spiderList().find(a => a.kind === 'mother') || null; }
function spiderMake(kind, power) {
  const p = state.player;
  const K = SPIDER_KINDS[kind];
  const brood = kind === 'spawn' ? scSkillData('slBrood') : null;
  const k = power / 100 * (brood ? 1 + brood.pct / 100 : 1);
  const hp = p.maxHp * K.hp * k;
  return { kind, spider: true, name: K.name, img: K.img, hp, maxHp: hp, atk: p.mAtk * K.atk * k, dodge: 10, slow: false };
}
function spiderPower() {
  const d = scSkillData('slMother');
  return d ? d.power : SKILLS.slMother.levels[0].power;
}
function spiderLay(why) {
  if (!spiderMother() || !alliesHasRoom()) return null;
  const a = alliesAdd(spiderMake('spawn', spiderPower()));
  if (a) logCombat(`🕷 Матка откладывает паучонка${why ? ` (${why})` : ''}: ${a.hp} HP.`, 'log-entry player-skill');
  return a;
}
function spiderBite(s, m, why) {
  if (!s || !m || m.hp <= 0) return;
  const dmg = monsterTagDmg(m, Math.max(1, Math.floor(s.atk - (m.pDef || 0) * ALLY_PDEF_FACTOR)), ['physical', 'poison']);
  const r = aoeApply([{ m, miss: false, dmg, type: 'dmg', fx: 'slash' }]);
  subclassOnAllyHit(s, m);
  logCombat(`🕷 ${s.name}${why ? ` (${why})` : ''}: ${r.total}`, 'log-entry player');
}
// Удар союзника (из alliesAct): паутина и яд пауков.
function subclassOnAllyHit(a, m) {
  if (scIsDwarf()) { dwarfOnAllyHit(a, m); return; }
  const p = state.player;
  if (!a.spider || !m || m.hp <= 0) return;
  const silk = scSkillData('slSilk');
  addDebuff('monster', 'webbed', m.index, { turnsLeft: 2, pct: silk ? silk.slow : 15 });
  if (semiPassiveReady('slVenom')) drowAddVenom(m, 1, p.mAtk * scSkillData('slVenom').tick / 100);
}

// ---- Начало хода героя ----
function drowOnHeroTurn() {
  const p = state.player;
  const b = state.battle;
  if (!b.active) return;
  drowVenomTick();
  if (p.subclass === 'drow_stormcaller') stormcallerFrontTick();
  if (p.subclass === 'drow_spiderlord' && spiderMother()) {
    b.slLayTimer = (b.slLayTimer || 0) + 1;
    if (b.slLayTimer >= SKILLS.slMother.layEvery) { b.slLayTimer = 0; spiderLay(); }
  }
}
function drowOnBattleStart() {
  const b = state.battle;
  b.scSurge = false;
  b.slLayTimer = 0;
}

// ---- Новые активки дроу ----
function drowPerformActive(skill, data) {
  const p = state.player;
  const m = getCurrentMonster();
  if (skill.id === 'sgArmor') {
    addDebuff('player', 'stormArmor', { turnsLeft: skill.turns, pct: data.pct, cut: data.cut || 0 });
    logCombat(`🌩 Грозовой доспех: ${skill.turns} ходов удары по вам дают Статику и молнию в ответ.`, 'log-entry player-skill');
    spawnFloatDamage('fighter-player', 0, 'magic', { text: 'ДОСПЕХ' });
  } else if (skill.id === 'asStep') {
    addDebuff('player', 'shadowStep', { turnsLeft: 2, dmg: data.dmg });
    state.battle.playerATB = 1;
    logCombat(`👣 Шаг тени: ход прямо сейчас, урон +${data.dmg}%.`, 'log-entry player-skill');
    spawnFloatDamage('fighter-player', 0, 'dodge', { text: 'ШАГ' });
  } else if (skill.id === 'swDouble') {
    const deep = scSkillData('swDeep');
    addDebuff('player', 'double', { turnsLeft: skill.turns + (deep ? 1 : 0), pct: shadowDoublePct() });
    logCombat(`👥 Теневой двойник: ${skill.turns + (deep ? 1 : 0)} ходов повторяет удары на ${shadowDoublePct()}%.`, 'log-entry player-skill');
  } else if (skill.id === 'scStormFront') {
    addDebuff('player', 'stormFront', { turnsLeft: skill.turns + 1, pct: data.pct });
    logCombat(`⛈ Грозовой фронт: ${skill.turns} хода молнии бьют сами.`, 'log-entry player-magic');
    addElementXP('lightning');
  } else if (skill.id === 'dwHaste') {
    addDebuff('player', 'haste', { turnsLeft: skill.turns, atb: data.atb });
    logCombat(`💨 Ускорение: ${skill.turns} ходов шкала хода +${data.atb}%.`, 'log-entry player-skill');
  } else if (skill.id === 'slMother') {
    if (!spiderMother()) {
      if (!alliesHasRoom()) { const old = spiderList().find(s => s.kind === 'spawn'); if (old) old.hp = 0; alliesReap(); }
      const a = alliesAdd(spiderMake('mother', data.power));
      if (a) logCombat(`🕷 Паучиха-матка выходит из тени: ${a.hp} HP, укус ${a.atk}.`, 'log-entry player-skill');
      state.battle.slLayTimer = 0;
    } else if (!spiderLay('по приказу')) {
      if (m) spiderBite(spiderMother(), m, 'по приказу');
    }
    addElementXP('death');
  } else {
    return false;
  }
  return true;
}

SKILLS.sgArmor.autoCheck = function () {
  if (getDebuff('player', 'stormArmor')) return false;
  const alive = (state.battle.monsters || []).filter(m => m.hp > 0);
  return alive.length >= 2 || alive.some(scStrongMonster);
};
SKILLS.swDouble.autoCheck = function () { return !getDebuff('player', 'double'); };
SKILLS.scStormFront.autoCheck = function () { return !getDebuff('player', 'stormFront'); };
SKILLS.dwHaste.autoCheck = function () { return !getDebuff('player', 'haste'); };

// ========================================================
//  ГНОМ: Стальная стена, Молотобоец, Старатель, Мастер горна, Рунный мастер, Заклинатель камня
//  Общие функции подклассов передают гному управление через scIsDwarf().
// ========================================================
function scIsDwarf() {
  const p = state.player;
  return !!(p && p.raceId === 'dwarf' && p.subclass);
}

DEBUFF_DEFS.breach = { icon: '🔨', name: 'Пролом', cssClass: 'debuff-wound',
  displayCount: (d) => d.stacks || 0,
  tooltip: (d) => `Пролом × ${d.stacks || 0} · защита −${(d.stacks || 0) * BREACH_PCT}%.` };
DEBUFF_DEFS.heat = { icon: '🔥', name: 'Жар', cssClass: 'debuff-burn',
  displayCount: (d) => d.stacks || 0,
  tooltip: (d) => `Жар ${d.stacks || 0}/${HEAT_MAX} · защита −${(d.stacks || 0) * 5}%.` };
DEBUFF_DEFS.closeArmor = { icon: '🛡', name: 'Сомкнутая броня', cssClass: 'debuff-guard',
  tooltip: (d) => `Сомкнутая броня · поглощение ×${d.mult} · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.temper = { icon: '⚒', name: 'Закалка', cssClass: 'debuff-guard',
  displayCount: (d) => d.stacks || 0,
  tooltip: (d) => `Закалка · +${d.stacks || 0} поглощения до конца боя.` };
DEBUFF_DEFS.veinSense = { icon: '💎', name: 'Чутьё жилы', cssClass: 'debuff-rune',
  displayCount: () => '',
  tooltip: (d) => `Чутьё жилы · редкая добыча +${d.rare}% · до конца боя.` };
DEBUFF_DEFS.bellows = { icon: '🔥', name: 'Раздутые мехи', cssClass: 'debuff-burn',
  tooltip: (d) => `Раздутые мехи · урон +${d.dmg || 0}%, огонь −${d.cut}% маны, Шар +2 Жара · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.runeStone = { icon: '🪨', name: 'Руна Камня', cssClass: 'debuff-guard', displayCount: () => '',
  tooltip: (d) => `Руна Камня · урон по вам −${d.pct}% · до конца боя.` };
DEBUFF_DEFS.runePower = { icon: '⚔', name: 'Руна Силы', cssClass: 'debuff-rune', displayCount: () => '',
  tooltip: (d) => `Руна Силы · ваш урон +${d.pct}% · до конца боя.` };
DEBUFF_DEFS.runeLife = { icon: '✚', name: 'Руна Жизни', cssClass: 'debuff-regen', displayCount: () => '',
  tooltip: (d) => `Руна Жизни · ${d.regen}% HP за ход · до конца боя.` };
DEBUFF_DEFS.runeGuard = { icon: '❄', name: 'Защита вьюги', cssClass: 'debuff-guard',
  tooltip: (d) => `После бурана · урон по вам −${d.cut}% · осталось ${d.turnsLeft} ход.` };
DEBUFF_DEFS.trapRune = { icon: '✶', name: 'Руна-ловушка', cssClass: 'debuff-rune', displayCount: () => '',
  tooltip: () => `Руна-ловушка · взорвётся, когда тварь соберётся ударить.` };
DEBUFF_DEFS.wardShield = { icon: '🔰', name: 'Охранная руна', cssClass: 'debuff-guard',
  displayCount: (d) => d.amount || 0,
  tooltip: (d) => `Охранная руна · примет ещё ${d.amount || 0} урона.` };
DEBUFF_DEFS.wardCd = { icon: '⏳', name: 'Охранная руна: перезарядка', cssClass: 'debuff-paraimmune',
  tooltip: (d) => `Охранная руна гаснет · ещё ${d.turnsLeft} ход.` };

// ---- Защита твари: Пролом и Жар (меняем саму тварь — она живёт один бой) ----
function dwarfDefSync(m) {
  if (!m) return;
  if (m._dwBaseP === undefined) { m._dwBaseP = m.pDef || 0; m._dwBaseM = m.mDef || 0; }
  const br = getDebuff('monster', 'breach', m.index);
  const ht = getDebuff('monster', 'heat', m.index);
  const cut = (br ? br.stacks * BREACH_PCT : 0) + (ht ? ht.stacks * 5 : 0);
  const k = Math.max(0, 1 - cut / 100);
  m.pDef = Math.floor(m._dwBaseP * k);
  m.mDef = Math.floor(m._dwBaseM * k);
}
function dwarfBreach(m, n) {
  if (!m || m.hp <= 0) return 0;
  const br = getDebuff('monster', 'breach', m.index);
  const stacks = Math.min(BREACH_MAX, (br ? br.stacks : 0) + (n || 1));
  addDebuff('monster', 'breach', m.index, { stacks, turnsLeft: 999 });
  dwarfDefSync(m);
  return stacks;
}
function dwarfHeat(m, n) {
  const p = state.player;
  if (!m || m.hp <= 0) return 0;
  const ht = getDebuff('monster', 'heat', m.index);
  let stacks = Math.min(HEAT_MAX, (ht ? ht.stacks : 0) + n);
  if (stacks >= HEAT_MAX && semiPassiveReady('fmSparks')) {
    const d = scSkillData('fmSparks');
    const others = aoeAlive().filter(x => x !== m);
    if (others.length) {
      const per = Math.max(1, Math.floor(p.mAtk * d.pct / 100));
      others.forEach(x => { const dmg = monsterTagDmg(x, per, ['magic', 'fire']); x.hp = Math.max(1, x.hp - dmg); spawnFloatDamage('fighter-monster', dmg, 'fire', { mon: x }); });
      logCombat(`✨ Искры: ${m.name} вспыхивает — ${per} соседям.`, 'log-entry player-magic');
    }
    stacks = 2;
  }
  addDebuff('monster', 'heat', m.index, { stacks, turnsLeft: 999 });
  dwarfDefSync(m);
  return stacks;
}
function dwarfGreedCount(m) {
  const g = m ? getDebuff('monster', 'greedMark', m.index) : null;
  return g ? ((Array.isArray(g.marks) && g.marks.length) || 1) : 0;
}
function dwarfWeaponCat() {
  const w = state.player.equipment.weapon;
  return w ? getWeaponCategory(w.name) : null;
}

// ---- Множители ----
function dwarfHeroDmgMult(m) {
  const p = state.player;
  let mult = 1;
  if (p.subclass === 'dwarf_hammerer') {
    const h = scSkillData('hmHeavy');
    const cat = dwarfWeaponCat();
    if (h && (cat === 'maces' || cat === 'axes')) mult *= 1 + h.pct / 100;
    const ice = scSkillData('hmIce');
    if (ice && m && getDebuff('monster', 'freeze', m.index)) mult *= 1 + ice.dmg / 100;
  } else if (p.subclass === 'dwarf_forgemaster') {
    const bw = getDebuff('player', 'bellows');
    if (bw && bw.dmg) mult *= 1 + bw.dmg / 100;
  } else if (p.subclass === 'dwarf_runemaster') {
    const r = getDebuff('player', 'runePower');
    if (r) mult *= 1 + r.pct / 100;
  }
  return mult;
}
function dwarfDamageTakenMult(attacker) {
  const p = state.player;
  let mult = 1;
  if (attacker) mult *= subclassMonsterWeakMult(attacker);
  if (p.subclass === 'dwarf_steelwall' && attacker) mult *= Math.max(0.5, 1 - 0.04 * dwarfGreedCount(attacker));
  const rs = getDebuff('player', 'runeStone');
  if (rs) mult *= 1 - rs.pct / 100;
  const rg = getDebuff('player', 'runeGuard');
  if (rg) mult *= 1 - rg.cut / 100;
  return mult;
}
// Поглощение удара твари (Сомкнуть броню, Закалка).
function subclassFlatReduce(base) {
  if (!hasSubclass('dwarf_steelwall')) return base;
  const c = getDebuff('player', 'closeArmor');
  const t = getDebuff('player', 'temper');
  return base * (c ? c.mult : 1) + (t ? t.stacks : 0);
}
// Несдвигаемый: не оглушить, шкалу не сбить.
function subclassPlayerUnmovable() {
  return hasSubclass('dwarf_steelwall') && !!scSkillData('swlUnmoved');
}

function dwarfApplyPassives(p) {
  if (p.subclass === 'dwarf_steelwall') {
    const s = scSkillData('swlSteel');
    if (s && typeof T4_SETS !== 'undefined') {
      let heavy = 0;
      Object.values(p.equipment).forEach(it => {
        if (!it || !it.setId || !it.stats || !it.stats.pDef) return;
        const set = T4_SETS.find(x => x.id === it.setId);
        if (set && set.weight === 'heavy') heavy += getItemStat(it, 'pDef');
      });
      const add = Math.floor(heavy * s.pct / 100);
      p.pDef += add;
      p.skillBonuses.push(`Гномья сталь (ур.${scSkillLvl('swlSteel')}): +${add} защиты от тяжёлой брони`);
    }
    const u = scSkillData('swlUnmoved');
    if (u) { p.maxHp = Math.floor(p.maxHp * (1 + u.hp / 100)); p.skillBonuses.push(`Несдвигаемый (ур.${scSkillLvl('swlUnmoved')}): не оглушить, +${u.hp}% HP`); }
  } else if (p.subclass === 'dwarf_prospector') {
    const l = scSkillData('prLode'); if (l) p.skillBonuses.push(`Жила (ур.${scSkillLvl('prLode')}): ресурсы +${l.pct}%`);
    const t = scSkillData('prThrift'); if (t) p.skillBonuses.push(`Скупой расчёт (ур.${scSkillLvl('prThrift')}): Оболы +${t.pct}%`);
  } else if (p.subclass === 'dwarf_forgemaster') {
    const s = scSkillData('fmSmith'); if (s) p.skillBonuses.push(`Рука мастера (ур.${scSkillLvl('fmSmith')}): двойной бросок редкости ${s.reroll}%, экономия материалов ${s.save}%`);
  } else if (p.subclass === 'dwarf_runemaster') {
    const s = scSkillData('rmSteady'); if (s) p.skillBonuses.push(`Твёрдая рука (ур.${scSkillLvl('rmSteady')}): подгонка +${s.chance}%, неудача за полцены`);
  }
}

// ---- Удары воина ----
function dwarfHitAtk(skillId) {
  const p = state.player;
  if (p.subclass === 'dwarf_steelwall' && skillId === 'powerStrike') return Math.floor(p.pDef * SUBCLASSES.dwarf_steelwall.mods.powerStrike.defPart);
  return 0;
}
function dwarfAfterStrike(skill, m, hitsLanded, totalDamage) {
  const p = state.player;
  if (!m) return '';
  if (p.subclass === 'dwarf_hammerer') {
    if (skill.id === 'powerStrike' && m.hp > 0) return `🔨 пролом ×${dwarfBreach(m, 1)}`;
    if (skill.id === 'dwarfGreed' && m.hp > 0 && getDebuff('monster', 'freeze', m.index)) {
      addGreedMark(m, getSkillData('dwarfGreed').markTurns || 3, 'warrior');
      return '💰 по льду — ещё метка';
    }
  }
  if (p.subclass === 'dwarf_prospector' && skill.id === 'powerStrike' && m.hp <= 0) {
    m._dwExtraRoll = (m._dwExtraRoll || 0) + 1;
    return '⛏ лишний бросок добычи';
  }
  return '';
}
function dwarfOnWeaponHit(m) {
  const p = state.player;
  if (p.subclass === 'dwarf_hammerer' && m && semiPassiveReady('hmCrack')) {
    const b = state.battle;
    b.hmHits = (b.hmHits || 0) + 1;
    if (b.hmHits >= scSkillData('hmCrack').every) { b.hmHits = 0; dwarfBreach(m, 1); }
  }
  return 0;
}
// Ледяной раскол: Раскол (Молотобоец).
function subclassQuakeHit(h) {
  if (!hasSubclass('dwarf_hammerer') || h.miss || !h.m) return;
  if (getDebuff('monster', 'freeze', h.m.index)) {
    h.dmg = Math.floor(h.dmg * 2);
    removeDebuff('monster', 'freeze', h.m.index);
    h.shattered = true;
  }
}
function subclassQuakeFreezeBonus() {
  const d = hasSubclass('dwarf_hammerer') ? scSkillData('hmIce') : null;
  return d ? d.freeze : 0;
}
// Жадность: сколько меток можно.
function subclassGreedMax() {
  return hasSubclass('dwarf_prospector') ? PROSPECTOR_GREED_MAX : GREED_MAX_MARKS;
}
function subclassGreedPerMark() {
  return hasSubclass('dwarf_prospector') ? PROSPECTOR_GREED_PER : GREED_REWARD_PER_MARK;
}

// ---- Добыча (battle-rewards): множители и лишние броски ----
function subclassLootMods(m, greedN) {
  const p = state.player;
  const r = { drop: 1, rare: 1, material: 1, gold: 1, rolls: 0 };
  if (!scIsDwarf() || !m) return r;
  if (m._dwExtraRoll) r.rolls += m._dwExtraRoll;
  if (m._veinTouched) r.rolls += 1;
  if (p.subclass === 'dwarf_prospector') {
    const v = getDebuff('player', 'veinSense');
    if (v) r.rare = 1 + v.rare / 100;
    const l = scSkillData('prLode'); if (l) r.material = 1 + l.pct / 100;
    const t = scSkillData('prThrift'); if (t) r.gold = 1 + t.pct / 100;
    const eye = scSkillData('prEye');
    if (eye && semiPassiveReady('prEye') && greedN >= eye.need) r.rolls += 1;
  }
  return r;
}
// Лишняя добыча сверх таблицы: руда, пыль.
function subclassBonusLoot(m, greedN) {
  const p = state.player;
  if (!scIsDwarf() || !m) return;
  const giveOre = (why) => {
    addToInventory({ name: 'Руда железа', icon: 'img/materials/iron_ore.webp', type: 'material', sellPrice: 3, qty: 1 });
    logLoot(`⛏ Руда железа`, 'log-loot', why);
  };
  if (p.subclass === 'dwarf_prospector' && greedN > 0 && Math.random() * 100 < 10 * greedN) giveOre(`метки Жадности ×${greedN}`);
  if (p.subclass === 'dwarf_prospector' && m.soul && semiPassiveReady('prEye') && greedN >= scSkillData('prEye').need && typeof addDustToInventory === 'function') {
    addDustToInventory('green', 1);
    logLoot(`✨ Зелёная пыль ×1`, 'log-loot', 'Глаз старателя');
  }
  if (p.subclass === 'dwarf_forgemaster' && greedN > 0 && m._dwHot) giveOre('раскалённая тварь');
}

// ---- Заклинания мага ----
function dwarfMpCost(skill, cost) {
  const b = getDebuff('player', 'bellows');
  if (b && skill.id === 'fireball') return Math.max(1, Math.ceil(cost * (1 - b.cut / 100)));
  return cost;
}
function dwarfSpellAfter(skill, m, dmg) {
  const p = state.player;
  if (skill.id !== 'fireball' || !m) return false;
  if (p.subclass === 'dwarf_forgemaster' && m.hp > 0) {
    dwarfHeat(m, getDebuff('player', 'bellows') ? 2 : 1);
  }
  if (p.subclass === 'dwarf_stonecaller') {
    stonecallerElementals().forEach(e => { if (m.hp > 0) stonecallerStrike(e, m, 0.5, 'разгорелся'); });
  }
  return false;   // обычная строка и поджог
}
function dwarfOverrideSkill(skill, data, m) {
  if (hasSubclass('dwarf_runemaster') && skill.id === 'fireball') {
    if (!m || m.hp <= 0) return true;
    if (getDebuff('monster', 'trapRune', m.index)) dwarfOnMonsterAct(m);   // старая ловушка взрывается сразу
    if (m.hp <= 0) return true;
    const nowMod = SUBCLASSES.dwarf_runemaster.mods.fireball;
    const hNow = aoeMagHit(m, data.multiplier * nowMod.nowMult, 'fire');
    const rNow = aoeApply([{ m, ...hNow, type: 'fire', fx: 'proj:fire' }]);
    if (m.hp <= 0) { addElementXP('fire'); logCombat(`✶ ${skill.name}: ${hNow.miss ? 'мимо' : rNow.total}`, 'log-entry player-magic'); updateBattleUI(); return true; }
    addDebuff('monster', 'trapRune', m.index, { mult: data.multiplier * SUBCLASSES.dwarf_runemaster.mods.fireball.trapMult, turnsLeft: 999 });
    addElementXP('fire');
    logCombat(`✶ ${skill.name}: ${hNow.miss ? 'мимо' : rNow.total}, на ${m.name} начерчена ловушка.`, 'log-entry player-magic');
    spawnFloatDamage('fighter-monster', 0, 'magic', { mon: m, text: '✶' });
    updateBattleUI();
    return true;
  }
  return false;
}
// Руна-ловушка: тварь собирается ударить.
function dwarfOnMonsterAct(m) {
  const t = getDebuff('monster', 'trapRune', m.index);
  if (!t) return;
  removeDebuff('monster', 'trapRune', m.index);
  const h = aoeMagHit(m, t.mult, 'fire');
  const r = aoeApply([{ m, ...h, type: 'fire', fx: 'proj:fire' }]);
  logCombat(`✶ Руна-ловушка взрывается: ${h.miss ? 'мимо' : r.total}`, 'log-entry player-magic');
}
// Руна вьюги: множитель для цели (Закалка) и последствия.
function subclassRuneMult(m) {
  if (!hasSubclass('dwarf_forgemaster') || !m) return 1;
  const ht = getDebuff('monster', 'heat', m.index);
  if (!ht) return 1;
  removeDebuff('monster', 'heat', m.index);
  dwarfBreach(m, 1);
  m._dwTempered = true;
  return SUBCLASSES.dwarf_forgemaster.mods.blizzardRune.temperMult;
}
function subclassAfterRune(targets) {
  const p = state.player;
  if (p.subclass === 'dwarf_forgemaster') {
    const n = targets.filter(m => m._dwTempered).length;
    targets.forEach(m => { m._dwTempered = false; });
    if (n) logCombat(`⚒ Закалка: ${n} — ×1.8 и пролом.`, 'log-entry player-magic');
  } else if (p.subclass === 'dwarf_runemaster') {
    const mod = SUBCLASSES.dwarf_runemaster.mods.blizzardRune;
    addDebuff('player', 'runeGuard', { turnsLeft: mod.guardTurns + 1, cut: mod.guardCut });
  } else if (p.subclass === 'dwarf_stonecaller') {
    const lvl = scSkillLvl('scSummon');
    if (lvl) stonecallerSummon(SKILLS.scSummon.levels[lvl - 1], 'из бурана');
  }
}

// ---- Рунный мастер: руны ----
const RUNE_CYCLE = ['runeStone', 'runePower', 'runeLife'];
function runemasterNextRune() {
  return RUNE_CYCLE.find(id => !getDebuff('player', id)) || null;
}
function runemasterAbsorb(dmg) {
  const b = state.battle;
  if (!(b.rmShield > 0)) return dmg;
  const take = Math.min(b.rmShield, dmg);
  b.rmShield -= take;
  if (b.rmShield > 0) addDebuff('player', 'wardShield', { amount: b.rmShield, turnsLeft: 999 }); else removeDebuff('player', 'wardShield');
  logCombat(`🔰 Охранная руна приняла ${take}.`, 'log-entry potion');
  return dmg - take;
}

// ---- Заклинатель камня: элементали ----
function stonecallerElementals() { return (typeof alliesList === 'function' ? alliesList() : []).filter(a => a.elemental); }
function stonecallerSummon(data, why) {
  const p = state.player;
  const b = state.battle;
  const list = stonecallerElementals();
  // все трое стоят — Слияние
  if (list.length >= 3 && !list.some(e => e.kind === 'great')) {
    const fus = scSkillData('scFusion');
    const k = fus ? fus.mult : 1.2;
    const hp = list.reduce((s, e) => s + e.maxHp, 0) * k;
    const atk = list.reduce((s, e) => s + e.atk, 0) * k;
    list.forEach(e => { e.hp = 0; e.fused = true; });
    b.allies = (b.allies || []).filter(a => !a.fused);
    const g = alliesAdd({ kind: 'great', elemental: true, name: 'Великий элементаль', img: 'img/allies/elemental_great.webp', hp, maxHp: hp, atk,
      taunt: true, burn: true, vein: true, absorb: list[0].absorb || 0, dodge: 0, slow: false });
    if (g) logCombat(`🗿 Слияние! Великий элементаль: ${g.hp} HP, удар ${g.atk}.`, 'log-entry player-skill');
    return;
  }
  if (list.some(e => e.kind === 'great')) { logCombat(`🗿 Великий элементаль уже стоит.`, 'log-entry'); return; }
  const kind = ELEMENTAL_ORDER[(b.scNext || 0) % ELEMENTAL_ORDER.length];
  b.scNext = (b.scNext || 0) + 1;
  const K = ELEMENTAL_KINDS[kind];
  const f = data.power / 100;
  const sb = scSkillData('scStoneblood');
  const a = { kind, elemental: true, name: K.name, img: K.img, hp: p.maxHp * K.hp * f, atk: p.mAtk * K.atk * f + (sb ? p.mAtk * sb.atk / 100 : 0),
    taunt: !!K.taunt, burn: !!K.burn, vein: !!K.vein, absorb: sb ? Math.ceil(p.flatDamageReduce || 0) : 0, dodge: 0, slow: false };
  a.maxHp = a.hp;
  if (!alliesHasRoom()) return;
  const added = alliesAdd(a);
  if (added) logCombat(`🗿 ${added.name}${why ? ` (${why})` : ''}: ${K.desc}. ${added.hp} HP, удар ${added.atk}.`, 'log-entry player-skill');
  addElementXP('ice');
}
function stonecallerStrike(e, m, mult, why) {
  if (!e || !m || m.hp <= 0) return;
  const dmg = monsterTagDmg(m, Math.max(1, Math.floor(e.atk * mult - (m.pDef || 0) * ALLY_PDEF_FACTOR)), ['physical']);
  dwarfOnAllyHit(e, m);
  const r = aoeApply([{ m, miss: false, dmg, type: 'dmg', fx: 'slash' }]);
  logCombat(`🗿 ${e.name}${why ? ` (${why})` : ''}: ${r.total}`, 'log-entry player');
}
// Удар элементаля: метки Жадности, поджог, кристаллы жилы.
function dwarfOnAllyHit(a, m) {
  const p = state.player;
  if (!a.elemental || !m || m.hp <= 0) return;
  addGreedMark(m, 3, 'mage');
  if (a.burn && !getDebuff('monster', 'burn', m.index)) addDebuff('monster', 'burn', m.index, { turnsLeft: 3, damage: Math.max(1, Math.floor(p.mAtk * 0.15)) });
  if (a.vein) {
    m._veinTouched = true;
    const other = aoeAlive().find(x => x !== m);
    if (other) {
      const dmg = monsterTagDmg(other, Math.max(1, Math.floor(a.atk * 0.5)), ['physical']);
      other.hp = Math.max(1, other.hp - dmg);   // кристалл не добивает посреди чужого хода
      other._veinTouched = true;
      spawnFloatDamage('fighter-monster', dmg, 'dmg', { mon: other });
    }
  }
}
function dwarfOnAllyDeath(a) {
  const p = state.player;
  if (!a.elemental || a.fused || !semiPassiveReady('scShards')) return;
  const d = scSkillData('scShards');
  const alive = aoeAlive();
  if (!alive.length) return;
  const el = a.kind === 'fire' ? 'fire' : 'ice';
  const per = Math.max(1, Math.floor(p.mAtk * d.pct / 100));
  const hits = alive.map(m => ({ m, miss: false, dmg: monsterTagDmg(m, per, ['magic', el]), type: el === 'fire' ? 'fire' : 'magic', fx: 'slash' }));
  const r = aoeApply(hits);
  logCombat(`💥 Осколки: ${a.name} взрывается — ${r.total}`, 'log-entry player-magic');
}

// ---- Удар по герою до HP / после ----
function dwarfAbsorbHit(dmg) {
  if (hasSubclass('dwarf_runemaster')) return runemasterAbsorb(dmg);
  return dmg;
}
function dwarfAfterHeroHit(m, dmg, crit) {
  const p = state.player;
  if (p.hp <= 0) return;
  if (p.subclass === 'dwarf_steelwall' && semiPassiveReady('swlTemper')) {
    const t = getDebuff('player', 'temper');
    const max = scSkillData('swlTemper').max;
    const stacks = Math.min(max, (t ? t.stacks : 0) + 1);
    addDebuff('player', 'temper', { stacks, turnsLeft: 999 });
  }
  if (p.subclass === 'dwarf_runemaster' && semiPassiveReady('rmWard') && !getDebuff('player', 'wardCd') && p.hp / p.maxHp * 100 < SKILLS.rmWard.threshold) {
    const d = scSkillData('rmWard');
    const b = state.battle;
    b.rmShield = (b.rmShield || 0) + Math.floor(p.maxHp * d.shield / 100);
    addDebuff('player', 'wardShield', { amount: b.rmShield, turnsLeft: 999 });
    addDebuff('player', 'wardCd', { turnsLeft: d.every });
    logCombat(`🔰 Охранная руна: щит ${b.rmShield}.`, 'log-entry potion');
  }
}

// ---- Смерть твари ----
function dwarfOnMonsterDeath(m) {
  const p = state.player;
  if (p.subclass === 'dwarf_runemaster' && dwarfGreedCount(m) > 0) {
    const mp = Math.min(Math.floor(p.maxMp * SUBCLASSES.dwarf_runemaster.mods.dwarfGreedMagic.mpBack / 100), p.maxMp - p.mp);
    if (mp > 0) p.mp += mp;
  }
  if (p.subclass === 'dwarf_forgemaster' && getDebuff('monster', 'heat', m.index)) m._dwHot = true;
}

// ---- Начало хода героя и боя ----
function dwarfOnHeroTurn() {
  const life = getDebuff('player', 'runeLife');
  if (life && state.battle.active) aoeHeal(state.player.maxHp * life.regen / 100);
}
function dwarfOnBattleStart() {
  const b = state.battle;
  b.hmHits = 0; b.rmShield = 0; b.scNext = 0;
}

// ---- Новые активки гнома ----
function dwarfPerformActive(skill, data) {
  const p = state.player;
  const m = getCurrentMonster();
  if (skill.id === 'swlClose') {
    addDebuff('player', 'closeArmor', { turnsLeft: skill.turns, mult: data.mult });
    logCombat(`🛡 Сомкнуть броню: ${skill.turns} ходов поглощение ×${data.mult}.`, 'log-entry player-skill');
    spawnFloatDamage('fighter-player', 0, 'block', { text: 'БРОНЯ' });
  } else if (skill.id === 'hmAnvil') {
    if (!m) return true;
    const br = getDebuff('monster', 'breach', m.index);
    const full = br && br.stacks >= BREACH_MAX;
    const h = aoePhysHit(m, full ? data.full : data.mult, 0);
    const r = aoeApply([{ m, ...h, type: h.crit ? 'crit' : 'dmg', fx: 'slash' }]);
    if (full && m.hp > 0) addDebuff('monster', 'stun', m.index, { turnsLeft: 1 });
    logCombat(`🔨 ${skill.name}: ${h.miss ? 'промах' : r.total}`, 'log-entry player-skill', full ? '3 пролома — ×3 и оглушение' : '');
  } else if (skill.id === 'prVein') {
    addDebuff('player', 'veinSense', { rare: data.rare, turnsLeft: 999 });
    logCombat(`💎 Чутьё жилы: до конца боя редкая добыча +${data.rare}%.`, 'log-entry player-skill');
  } else if (skill.id === 'fmBellows') {
    addDebuff('player', 'bellows', { turnsLeft: skill.turns, cut: data.cut, dmg: data.dmg || 0 });
    logCombat(`🔥 Раздуть мехи: ${skill.turns} ходов огонь дешевле на ${data.cut}%, Шар +2 Жара.`, 'log-entry player-skill');
  } else if (skill.id === 'rmInscribe') {
    if (!runemasterNextRune()) { logCombat(`✶ Все руны уже горят.`, 'log-entry'); return true; }
    RUNE_CYCLE.forEach(id => addDebuff('player', id, { pct: data.pct, regen: data.regen, turnsLeft: 999 }));
    logCombat(`✶ Начертаны руны Камня, Силы и Жизни.`, 'log-entry player-skill');
  } else if (skill.id === 'scSummon') {
    stonecallerSummon(data);
  } else {
    return false;
  }
  return true;
}
SKILLS.swlClose.autoCheck = function () {
  if (getDebuff('player', 'closeArmor')) return false;
  const alive = (state.battle.monsters || []).filter(m => m.hp > 0);
  return alive.length >= 2 || alive.some(scStrongMonster);
};
SKILLS.prVein.autoCheck = function () { return !getDebuff('player', 'veinSense'); };
SKILLS.fmBellows.autoCheck = function () { return !getDebuff('player', 'bellows'); };
SKILLS.scSummon.autoCheck = function () { return !stonecallerElementals().some(e => e.kind === 'great'); };

// ========================================================
//  ГНОМ: ремесло вне боя — ковка, Переплавка, подгонка
// ========================================================
// Ковка: бросок редкости (Рука мастера — двойной бросок).
function subclassForgeRarity() {
  const r1 = rollRarity();
  const d = hasSubclass('dwarf_forgemaster') ? scSkillData('fmSmith') : null;
  if (!d || Math.random() * 100 >= d.reroll) return r1;
  const r2 = rollRarity();
  return RARITY_ORDER.indexOf(r2) > RARITY_ORDER.indexOf(r1) ? r2 : r1;
}
// Ковка: материалы не потратились.
function subclassForgeSaveMaterials() {
  const d = hasSubclass('dwarf_forgemaster') ? scSkillData('fmSmith') : null;
  return !!d && Math.random() * 100 < d.save;
}
// Подгонка: шанс и цена неудачи (Твёрдая рука).
function subclassRefineChanceBonus() {
  const d = hasSubclass('dwarf_runemaster') ? scSkillData('rmSteady') : null;
  return d ? d.chance : 0;
}
function subclassRefineFailRefund(price) {
  const d = hasSubclass('dwarf_runemaster') ? scSkillData('rmSteady') : null;
  return d ? Math.floor(price / 2) : 0;
}
// Подгонка: лучший из двух случайных бонусов (Руническая вязь).
const RUNE_WEAVE_RANK = ['mpBonus', 'hpBonus', 'critBonus', 'xpBonusPercent', 'dropBonusPercent', 'goldBonusPercent', 'profBonusPercent', 'mpRegenOutBonus', 'hpRegenOutBonus', 'blockBonus', 'accuracyBonus', 'evasionBonus'];
function subclassRefinePick(pool) {
  const first = pool[Math.floor(Math.random() * pool.length)];
  const d = hasSubclass('dwarf_runemaster') ? scSkillData('rmWeave') : null;
  if (!d || Math.random() * 100 >= d.chance) return first;
  const second = pool[Math.floor(Math.random() * pool.length)];
  const rank = b => { const i = RUNE_WEAVE_RANK.indexOf(b.key); return i < 0 ? 99 : i; };
  return rank(second) < rank(first) ? second : first;
}

// ---- Переплавка (Мастер горна): кнопка в кузнице ----
function smeltAvailable() {
  return hasSubclass('dwarf_forgemaster') && !!scSkillData('fmSmelt');
}
function smeltRecipeFor(item) {
  if (!item || typeof RECIPES === 'undefined') return null;
  for (const cat of Object.keys(RECIPES)) {
    const r = (RECIPES[cat] || []).find(x => x && x.result && x.result.name === item.name && Array.isArray(x.materials));
    if (r) return r;
  }
  return null;
}
const SMELT_TYPES = ['weapon', 'shield', 'helmet', 'armorTop', 'armorBottom', 'gloves', 'boots', 'ring', 'earring', 'necklace'];
function smeltCandidates() {
  return (state.player.inventory || []).map((it, i) => ({ it, i })).filter(x => SMELT_TYPES.includes(x.it.type) && smeltRecipeFor(x.it));
}
function smeltReturn(item) {
  const d = scSkillData('fmSmelt');
  const r = smeltRecipeFor(item);
  if (!d || !r) return [];
  return r.materials.map(mt => ({ name: mt.name, qty: Math.floor(mt.qty * d.pct / 100) })).filter(x => x.qty > 0);
}
function openSmelt() {
  if (!smeltAvailable()) return;
  let ov = document.getElementById('smelt-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.className = 'sc-overlay overlay-base';
    ov.id = 'smelt-overlay';
    ov.innerHTML = `<div class="sc-window window-base"><div class="window-header"><div class="window-title">♨ ПЕРЕПЛАВКА</div>
      <div class="window-header-actions"><button class="btn danger" onclick="closeSmelt()">Закрыть</button></div></div>
      <div class="window-content"><div class="sc-pane" id="smelt-pane"></div></div></div>`;
    ov.addEventListener('click', e => { if (e.target === ov) closeSmelt(); });
    document.body.appendChild(ov);
  }
  ov.classList.add('active');
  renderSmelt();
}
function closeSmelt() { const ov = document.getElementById('smelt-overlay'); if (ov) ov.classList.remove('active'); }
function renderSmelt() {
  const pane = document.getElementById('smelt-pane');
  if (!pane) return;
  const d = scSkillData('fmSmelt');
  const list = smeltCandidates();
  const rows = list.map(({ it, i }) => {
    const back = smeltReturn(it);
    const rar = it.rarity && RARITIES[it.rarity] ? ` <span style="color:${RARITIES[it.rarity].color || 'inherit'}">(${RARITIES[it.rarity].name})</span>` : '';
    const ref = it.refineLevel ? ` +${it.refineLevel}` : '';
    const txt = back.length ? back.map(b => `${b.name} ×${b.qty}`).join(', ') : 'слишком мало — ничего не вернётся';
    return `<div class="smelt-row"><div class="smelt-name">${it.name}${ref}${rar}</div><div class="smelt-back">→ ${txt}</div>
      <button class="btn${back.length ? ' success' : ''}" ${back.length ? '' : 'disabled'} onclick="smeltItem(${i})">Переплавить</button></div>`;
  }).join('');
  pane.innerHTML = `<div class="sc-intro">Гундар ворчит, но уступает тебе горн: «Только не порть мне меха». Снаряжение из сумки (надетое не трогаем) переплавляется в ${d.pct}% материалов своего рецепта. Подгонка и редкость пропадают.</div>
    ${rows || '<div class="sc-foot">В сумке нет снаряжения, которое можно переплавить.</div>'}`;
}
function smeltItem(index) {
  const p = state.player;
  const it = p.inventory[index];
  if (!it || !SMELT_TYPES.includes(it.type)) return;
  const back = smeltReturn(it);
  if (!back.length) return;
  if (!confirm(`Переплавить «${it.name}»?\n\nВернётся: ${back.map(b => `${b.name} ×${b.qty}`).join(', ')}.\nВещь пропадёт вместе с подгонкой.`)) return;
  if ((it.qty || 1) > 1) it.qty -= 1; else p.inventory.splice(index, 1);
  back.forEach(b => {
    const src = smeltSourceItem(b.name);
    for (let k = 0; k < b.qty; k++) addToInventory(Object.assign({}, src, { qty: 1 }));   // addToInventory кладёт по одной
  });
  logLoot(`♨ Переплавка «${it.name}»: ${back.map(b => `${b.name} ×${b.qty}`).join(', ')}`, 'log-loot');
  showToast('♨', `Переплавлено: ${it.name}`);
  if (typeof renderInventory === 'function') renderInventory();
  if (typeof updateInventoryFooter === 'function') updateInventoryFooter();
  if (typeof renderForgeAll === 'function') renderForgeAll();
  renderSmelt();
  saveCurrentSlot();
}
// Как выглядит материал (иконка, цена) — берём из рецепта, где он результат, или из добычи тварей.
function smeltSourceItem(name) {
  for (const cat of Object.keys(RECIPES)) {
    const r = (RECIPES[cat] || []).find(x => x && x.result && x.result.name === name);
    if (r) return { name, icon: r.result.icon, type: r.result.type || 'material', sellPrice: r.result.sellPrice || 1 };
  }
  const pools = [typeof MONSTERS !== 'undefined' ? MONSTERS : [], typeof MINE_MONSTERS !== 'undefined' ? MINE_MONSTERS : [], typeof OUTSKIRTS_MONSTERS !== 'undefined' ? OUTSKIRTS_MONSTERS : []];
  for (const pool of pools) {
    for (const mon of (Array.isArray(pool) ? pool : Object.values(pool))) {
      const dr = (mon.drops || []).find(x => x.name === name);
      if (dr) return { name, icon: dr.icon, type: dr.type || 'material', sellPrice: dr.sellPrice || 1 };
    }
  }
  return { name, type: 'material', sellPrice: 1 };
}
// Кнопка в шапке кузницы.
function smeltButtonSync() {
  const actions = document.querySelector('#forge-overlay .window-header-actions');
  if (!actions) return;
  let btn = document.getElementById('btn-smelt');
  if (smeltAvailable()) {
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'btn';
      btn.id = 'btn-smelt';
      btn.textContent = '♨ Переплавка';
      btn.onclick = openSmelt;
      actions.insertBefore(btn, actions.firstChild);
    }
  } else if (btn) btn.remove();
}
