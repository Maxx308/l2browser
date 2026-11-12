// ========================================================
//  СИСТЕМЫ: ПРОРЫВ К ИЛЬГРАДУ (в разработке, запуск — из чит-меню)
//  10 волн по 10 тварей на обычном движке боя. Проиграть нельзя, ставка — люди в обозе.
//  Все цифры — черновик, подбирать симулятором.
//
//  Как уходят люди:
//    • после каждой волны — по таблице BREAK_LOSS_BY_WAVE (у всех одинаково);
//    • каждая живая тварь, кроме той, что сейчас бьют, понемногу прорывается к обозу;
//    • волна дольше BREAK_WAVE_SECONDS — кончается сама, каждая недобитая тварь стоит человека.
//  Герой упал: на BREAK_DOWN_SECONDS его нет, твари идут к обозу все разом, потом он снова в бою.
//  В ручном режиме, пока игрок выбирает ход, бой на паузе — и потери тоже.
//
//  Помощь спутников (роли supply / healer / bruiser / pair, BREAK_HELP): идёт весь бой,
//  сила тает от раза к разу. Имена, портреты и реплики — в js/data/breakthrough-lines.js
//  (подгружается при запуске; нет файла — помощь работает молча).
//
//  Точки подключения: startBattle (без случайной стаи и душ), gameLoop (breakthroughTick),
//  onMonsterDeath (breakthroughOnClear), onPlayerDeath (breakthroughOnHeroDown), closeBattle.
// ========================================================

const BREAK_CONVOY_START = 67;
const BREAK_WAVES = [
  { undeadMilitia: 10 },
  { undeadMilitia: 5, boneHound: 5 },
  { boneHound: 6, ghoul: 4 },
  { ghoul: 6, undeadMilitia: 4 },
  { weeper: 4, undeadMilitia: 6 },
  { boneHound: 5, weeper: 5 },
  { ghoul: 5, weeper: 3, undeadMilitia: 2 },
  { boneColossus: 1, boneHound: 5, undeadMilitia: 4 },
  { boneColossus: 2, ghoul: 4, weeper: 4 },
  { boneColossus: 3, weeper: 3, ghoul: 4 },
];
const BREAK_LOSS_BY_WAVE = [2, 2, 4, 2, 4, 2, 3, 2, 2, 2];   // всего 25: больше 42 человек не дойдёт
const BREAK_ALIVE_MAX = 3;           // живых сразу: остальные подходят порциями
const BREAK_WAVE_SECONDS = 180;
const BREAK_GNAW_PER_SECOND = 0.006; // людей в секунду с каждой свободной твари
const BREAK_DOWN_SECONDS = 5;
const BREAK_DOWN_GNAW_MULT = 3;
const BREAK_WAVE_PAUSE_MS = 1800;
const BREAK_PLATE_MS = 5000;
const BREAK_LAST_WAVE_KILLS = 5;     // последняя волна: столько убито — и спутник остаётся держать дорогу
const BREAK_LAST_WAVE_SECONDS = 120; // ...или столько секунд прошло

const BREAK_HELP = {
  supply:  { percent: [25, 20, 15, 10, 5], below: 0.5, cooldown: 30 },    // % маны от общего запаса
  healer:  { percent: [20, 16, 12, 8, 5], below: 0.6, cooldown: 30, regenTurns: 7 },   // % HP и столько же HP за ход
  fire:    { below: 0.1, minTargets: 3, survivorHp: 0.1 },                 // один раз за прорыв
  bruiser: { volleys: 3, volleyMaxHpPercent: 4, volleyMs: 190, firstAt: 20, cooldown: 25 },   // серия быстрых ударов по всем
  pair:    { allMaxHpPercent: 10, cooldown: 30, cooldownStep: 5 },        // молот по всем, откат 30, 35, 40…
};

function breakTemplate(id) { return OUTSKIRTS_MONSTERS.find(t => t.id === id); }

function breakWaveQueue(wave) {
  const list = [];
  Object.entries(wave).forEach(([id, n]) => { for (let i = 0; i < n; i++) list.push(id); });
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// Реплики грузятся только при запуске прорыва: у обычных игроков файла может не быть.
function breakthroughLoadLines() {
  return new Promise(resolve => {
    if (window.BREAK_LINES) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'js/data/breakthrough-lines.js?t=' + Date.now();
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.body.appendChild(s);
  });
}

function breakthroughStart() {
  const p = state.player;
  if (!p.classId) { showToast('⚔', 'Сначала выберите класс у Наставника'); return; }
  if (state.battle.active) closeBattle();
  if (p.hp < 1) p.hp = 1;
  state.battle.breakthrough = {
    wave: 0, convoy: BREAK_CONVOY_START, gnaw: 0, queue: [], time: 0, down: 0, between: true,
    help: {
      cd: { supply: 0, healer: 0, bruiser: BREAK_HELP.bruiser.firstAt, pair: BREAK_HELP.pair.cooldown },
      used: { supply: 0, healer: 0, bruiser: 0, pair: 0 },
      fireUsed: false, regen: null, lastAtb: 0,
    },
  };
  const lines = window.BREAK_LINES;
  breakPlate(lines && lines.intro, breakNextWave);
}

function breakNextWave() {
  const br = state.battle.breakthrough;
  if (!br) return;
  br.wave++;
  br.between = false;
  br.time = 0;
  br.queue = breakWaveQueue(BREAK_WAVES[br.wave - 1]);
  startBattle(breakTemplate(br.queue.shift()), 'normal');
  state.battle.packTemplate = null;   // подмоги нет: волна приходит сама
  breakTopUp();
  logCombat(`— Волна ${br.wave} из ${BREAK_WAVES.length} —`, 'log-entry separator');
  const title = document.getElementById('battle-title-text');
  if (title) title.textContent = 'Прорыв к Ильграду';
  breakRender();
  updateBattleUI();
}

function breakTopUp() {
  const b = state.battle, br = b.breakthrough;
  let alive = getAliveMonstersCount();
  while (alive < BREAK_ALIVE_MAX && br.queue.length) {
    const t = breakTemplate(br.queue.shift());
    const m = buildMonsterInstance(t, 'normal');
    m.index = b.monsters.length;
    m.templateId = t.id;
    m.atb = 0;
    m.reinforcement = true;
    b.monsters.push(m);
    alive++;
  }
}

function breakLose(n) {
  const br = state.battle.breakthrough;
  const lost = Math.min(n, br.convoy);
  if (lost <= 0) return;
  br.convoy -= lost;
  const hud = document.getElementById('bx-break');
  if (hud) {
    const s = document.createElement('span');
    s.className = 'bxb-minus';
    s.textContent = '−' + lost;
    hud.appendChild(s);
    setTimeout(() => s.remove(), 1000);
  }
}

function breakGnaw(amount) {
  const br = state.battle.breakthrough;
  br.gnaw += amount;
  while (br.gnaw >= 1) { br.gnaw -= 1; breakLose(1); }
}

// Из gameLoop, до хода героя и тварей: пока герой лежит, основной цикл боя стоит.
function breakthroughTick(dt) {
  const b = state.battle, br = b.breakthrough;
  if (!br || br.between || br.paused) return;   // paused — спутник на арене, бой ждёт
  if (br.down <= 0 && !b.active) return;
  if (br.down <= 0 && !b.autoBattle && b.manualWait) return;   // ручной режим: выбор хода — пауза

  br.time += dt;

  if (br.wave === BREAK_WAVES.length) {   // последняя волна: спутник остаётся, обоз уходит
    const killed = breakWaveTotal(br) - getAliveMonstersCount() - br.queue.length;
    if (killed >= BREAK_LAST_WAVE_KILLS || br.time >= BREAK_LAST_WAVE_SECONDS) { breakEndWave(false); return; }
  }
  if (br.time >= BREAK_WAVE_SECONDS) { breakEndWave(true); return; }

  const alive = getAliveMonstersCount();
  if (br.down > 0) {
    state.player.hp = 0;   // зелье не поднимает: героя сейчас нет
    breakGnaw(dt * alive * BREAK_GNAW_PER_SECOND * BREAK_DOWN_GNAW_MULT);
    br.down -= dt;
    if (br.down <= 0) breakHeroBack();
  } else {
    breakTopUp();
    breakGnaw(dt * Math.max(0, alive - 1) * BREAK_GNAW_PER_SECOND);
    breakHelpTick(dt);
  }
  if (state.battle.breakthrough === br) breakRender();
}

function breakWaveTotal(br) {
  return Object.values(BREAK_WAVES[br.wave - 1]).reduce((a, n) => a + n, 0);
}

// ---- ПОМОЩЬ СПУТНИКОВ ----
function breakHelpTick(dt) {
  const b = state.battle, br = b.breakthrough, p = state.player, h = br.help;
  Object.keys(h.cd).forEach(k => { h.cd[k] = Math.max(0, h.cd[k] - dt); });

  // Регенерация: срабатывает, когда герой сделал ход.
  const atb = b.playerATB || 0;
  if (h.regen && atb < h.lastAtb - 0.4) {
    const heal = Math.min(h.regen.hp, p.maxHp - p.hp);
    if (heal > 0) { p.hp += heal; spawnFloatDamage('fighter-player', heal, 'heal'); }
    if (--h.regen.turns <= 0) h.regen = null;
  }
  h.lastAtb = atb;

  if (!b.active || p.hp <= 0 || p.maxHp <= 0) return;
  const hpPart = p.hp / p.maxHp;

  if (!h.fireUsed && hpPart <= BREAK_HELP.fire.below && breakFire()) return;

  // За один тик — одно действие: бой встаёт на паузу, пока спутник не закончит.
  if (h.cd.healer <= 0 && hpPart < BREAK_HELP.healer.below) { breakHeal(); return; }
  if (h.cd.supply <= 0 && p.maxMp > 0 && p.mp / p.maxMp < BREAK_HELP.supply.below) { breakSupply(); return; }
  if (h.cd.bruiser <= 0 && getAliveMonstersCount() > 0) { breakBruiser(); return; }
  if (h.cd.pair <= 0 && getAliveMonstersCount() > 0) breakPair();
}

function breakHeal() {
  const br = state.battle.breakthrough, h = br.help, p = state.player, def = BREAK_HELP.healer;
  const step = h.used.healer++;
  h.cd.healer = def.cooldown;
  const pct = def.percent[Math.min(step, def.percent.length - 1)];
  const heal = Math.min(Math.floor(p.maxHp * pct / 100), p.maxHp - p.hp);
  breakAct('healer', step, `+${heal} HP, регенерация ${pct} HP на ${def.regenTurns} ходов`, done => {
    breakBolt('.bx-hero .bx-bar.hp', '#8dffa8');
    breakFill('hp', heal, () => {
      h.regen = { hp: pct, turns: def.regenTurns };
      spawnFloatDamage('fighter-player', heal, 'heal');
      done();
    });
  });
}

function breakSupply() {
  const br = state.battle.breakthrough, h = br.help, p = state.player, def = BREAK_HELP.supply;
  const step = h.used.supply++;
  h.cd.supply = def.cooldown;
  const pct = def.percent[Math.min(step, def.percent.length - 1)];
  const mana = Math.min(Math.floor(p.maxMp * pct / 100), p.maxMp - p.mp);
  breakAct('supply', step, `+${mana} маны`, done => {
    breakBolt('.bx-hero .bx-bar.mp', '#ffe066');
    breakFill('mp', mana, () => {
      spawnFloatDamage('fighter-player', mana, 'mana');
      done();
    });
  });
}

// Серия быстрых ударов по всем.
function breakBruiser() {
  const br = state.battle.breakthrough, h = br.help, def = BREAK_HELP.bruiser;
  const step = h.used.bruiser++;
  h.cd.bruiser = def.cooldown;
  breakAct('bruiser', step, 'серия ударов по всем', done => {
    let left = def.volleys;
    const volley = () => {
      if (state.battle.breakthrough !== br) return;
      state.battle.monsters.filter(m => m.hp > 0).forEach(m => {
        breakSlash(m);
        if (state.battle.active) breakHit(m, m.maxHp * def.volleyMaxHpPercent / 100, ['physical', 'blunt']);
      });
      if (--left > 0 && state.battle.active) setTimeout(volley, def.volleyMs);
      else setTimeout(done, def.volleyMs);
    };
    volley();
  });
}

// Удар молотом по всем: всё оглушено.
function breakPair() {
  const br = state.battle.breakthrough, h = br.help, def = BREAK_HELP.pair;
  const step = h.used.pair++;
  h.cd.pair = def.cooldown + def.cooldownStep * h.used.pair;
  breakAct('pair', step, 'молот по всем, все оглушены', done => {
    const stage = bxStage();
    const pos = bxCenter(document.getElementById('bx-enemy-row'));
    const hammer = document.createElement('img');
    hammer.className = 'bxa-hammer';
    hammer.src = 'img/tags/fx_hammer.webp';
    hammer.alt = '';
    hammer.style.left = pos.x + 'px';
    hammer.style.top = pos.y + 'px';
    stage.appendChild(hammer);
    setTimeout(() => {
      if (state.battle.breakthrough !== br) { hammer.remove(); return; }
      const ring = document.createElement('div');
      ring.className = 'bxa-ring';
      ring.style.left = pos.x + 'px';
      ring.style.top = pos.y + 'px';
      stage.appendChild(ring);
      breakShake();
      state.battle.monsters.filter(m => m.hp > 0).forEach(m => {
        addDebuff('monster', 'stun', m.index, { turnsLeft: 1 });
        spawnFloatDamage('fighter-monster', 0, 'block', { mon: m, text: 'ОГЛУШЁН' });
        if (state.battle.active) breakHit(m, m.maxHp * def.allMaxHpPercent / 100, ['physical', 'blunt']);
      });
      setTimeout(() => { hammer.remove(); ring.remove(); done(); }, 520);
    }, 340);
  });
}

function breakShake() {
  const stage = bxStage();
  stage.classList.remove('bxa-shake');
  void stage.offsetWidth;
  stage.classList.add('bxa-shake');
  setTimeout(() => stage.classList.remove('bxa-shake'), 520);
}

// Разряд от портрета спутника до полоски героя.
function breakBolt(targetSelector, color) {
  const stage = bxStage();
  const fromEl = document.querySelector('#bx-action img');
  const toEl = document.querySelector(targetSelector);
  if (!stage || !fromEl || !toEl) return;
  const a = bxCenter(fromEl), z = bxCenter(toEl);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'bxa-bolt');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', '4');
  line.setAttribute('stroke-linejoin', 'round');
  line.style.filter = `drop-shadow(0 0 7px ${color})`;
  svg.appendChild(line);
  stage.appendChild(svg);
  let n = 0;
  const redraw = () => {
    const pts = [`${a.x},${a.y}`];
    for (let i = 1; i < 8; i++) {
      const t = i / 8;
      pts.push(`${a.x + (z.x - a.x) * t + (Math.random() - .5) * 34},${a.y + (z.y - a.y) * t + (Math.random() - .5) * 34}`);
    }
    pts.push(`${z.x},${z.y}`);
    line.setAttribute('points', pts.join(' '));
    if (++n < 8) setTimeout(redraw, 100); else svg.remove();
  };
  redraw();
}

// Полоска наполняется на глазах; когда заполнилась — можно воевать дальше.
function breakFill(stat, amount, cb) {
  const p = state.player;
  const steps = 16, target = p[stat] + amount;
  let i = 0;
  const step = () => {
    if (!state.battle.breakthrough) return;
    i++;
    p[stat] = i >= steps ? target : p[stat] + amount / steps;
    updateTopStatus();
    updateBattleUI();
    if (i < steps) setTimeout(step, 50); else cb();
  };
  step();
}

function breakSlash(m) {
  const card = bxMonCard(m);
  if (!card) return;
  const pos = bxCenter(card);
  const el = document.createElement('div');
  el.className = 'bxa-slash';
  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';
  el.style.setProperty('--r', (-65 + Math.random() * 130) + 'deg');
  bxStage().appendChild(el);
  setTimeout(() => el.remove(), 260);
}

// Пауза боя: спутник выходит крупно, run(done) играет действие, после done бой идёт дальше.
function breakAct(role, step, note, run, sayOverride) {
  const br = state.battle.breakthrough;
  br.paused = true;
  const lines = window.BREAK_LINES;
  const who = lines && lines.who && lines.who[role];
  const list = lines && lines.say && lines.say[role];
  const say = sayOverride || (list && step >= 0 ? list[Math.min(step, list.length - 1)] : '');
  const people = who ? (Array.isArray(who) ? who : [who]) : [];
  const name = people.map(x => x.name).join(' и ');
  logCombat(`${name ? name + ': ' : 'Помощь: '}${say ? '«' + say + '» ' : ''}(${note})`, 'log-entry player-skill');

  const old = document.getElementById('bx-action');
  if (old) old.remove();
  const el = document.createElement('div');
  el.id = 'bx-action';
  el.innerHTML = `<div class="bxa-card">${people.map(x => `<img src="${x.img}" alt="">`).join('')}` +
    `<div class="bxa-text"><b>${name}</b><span>${say}</span></div></div>`;
  bxStage().appendChild(el);

  setTimeout(() => {
    if (state.battle.breakthrough !== br) return;
    run(() => {
      setTimeout(() => {
        el.classList.add('out');
        setTimeout(() => {
          el.remove();
          br.paused = false;
          updateBattleUI();
        }, 240);
      }, 420);
    });
  }, 620);
}

function breakHit(m, raw, kinds) {
  const dmg = monsterTagDmg(m, Math.max(1, Math.floor(raw)), kinds);
  m.hp -= dmg;
  spawnFloatDamage('fighter-monster', dmg, 'dmg', { mon: m });
  if (m.hp <= 0) { m.hp = 0; onMonsterDeath(m); }
}

// Один раз за прорыв, когда герою совсем плохо: сносит почти всю волну. true — сработало.
function breakFire() {
  const b = state.battle, br = b.breakthrough, h = br.help, def = BREAK_HELP.fire;
  const alive = b.monsters.filter(m => m.hp > 0);
  if (alive.length + br.queue.length < def.minTargets) return false;
  h.fireUsed = true;
  const lines = window.BREAK_LINES;
  breakAct('healer', -1, 'огонь по всей волне', done => {
    if (state.battle.breakthrough !== br) return;
    br.queue = [];
    const veil = breakEnsureUi().veil;
    veil.classList.remove('fire'); void veil.offsetWidth; veil.classList.add('fire');
    breakShake();
    const now = b.monsters.filter(m => m.hp > 0);
    if (now.length) {
      const survivor = now[now.length - 1];
      survivor.hp = Math.max(1, Math.floor(survivor.maxHp * def.survivorHp));
      now.slice(0, -1).forEach(m => {
        spawnFloatDamage('fighter-monster', m.hp, 'fire', { mon: m });
        m.hp = 0;
        onMonsterDeath(m);
      });
    }
    updateBattleUI();
    const after = lines && lines.say && lines.say.fireAfter;
    const text = document.querySelector('#bx-action .bxa-text span');
    if (after && text) setTimeout(() => { text.textContent = after; }, 1000);
    setTimeout(done, after ? 2400 : 1000);
  }, lines && lines.say && lines.say.fire);
  return true;
}

// Последняя живая тварь убита. true — бой продолжается под управлением прорыва.
function breakthroughOnClear() {
  const br = state.battle.breakthrough;
  if (br.queue.length) {
    breakTopUp();
    const next = getCurrentMonster();
    if (next) switchMonsterUI(next);
    updateBattleUI();
    return true;
  }
  breakEndWave(false);
  return true;
}

function breakEndWave(timedOut) {
  const b = state.battle, br = b.breakthrough;
  const leftovers = timedOut ? getAliveMonstersCount() + br.queue.length : 0;
  if (br.down > 0) breakHeroBack();
  b.active = false;
  b.monsters = [];
  b.monstersATB = 0;
  b.packIncoming = 0;
  br.queue = [];
  br.between = true;
  br.help.regen = null;
  clearAllDebuffs();
  breakLose((BREAK_LOSS_BY_WAVE[br.wave - 1] || 0) + leftovers);
  logCombat(timedOut
    ? `⏳ Обоз не может ждать: волна ${br.wave} прорвалась к людям. Осталось людей: ${br.convoy}.`
    : `🛡 Волна ${br.wave} позади. Осталось людей: ${br.convoy}.`, 'log-entry separator');
  breakRender();
  saveCurrentSlot();
  setTimeout(() => {
    if (state.battle.breakthrough !== br) return;
    if (br.wave >= BREAK_WAVES.length) {
      const lines = window.BREAK_LINES;
      breakPlate(lines && lines.last, breakFinish);
    } else breakNextWave();
  }, BREAK_WAVE_PAUSE_MS);
}

function breakFinish() {
  const br = state.battle.breakthrough;
  if (!br) return;
  const left = br.convoy;
  breakCleanup();
  state.player.breakthroughResult = left;
  document.getElementById('battle-window').classList.remove('active');
  document.getElementById('hunt-hint').style.display = 'block';
  renderMonsters();
  saveCurrentSlot();
  showSoon('ПРОРЫВ', left > 0
    ? `Обоз дошёл до ворот. Из ${BREAK_CONVOY_START} человек осталось ${left}.`
    : 'Из шестидесяти семи дошли только мы.');
}

// Из onPlayerDeath: в прорыве герой не умирает окончательно и опыт не теряет.
function breakthroughOnHeroDown() {
  const br = state.battle.breakthrough;
  if (br.down > 0) return;
  br.down = BREAK_DOWN_SECONDS;
  state.player.hp = 0;
  logCombat('☠ Ты упал' + heroText('{|а}') + '. Твари идут к обозу.', 'log-entry loss');
  breakEnsureUi().veil.classList.add('on');
  if (!br.help.fireUsed && !br.between) breakFire();
}

function breakHeroBack() {
  const br = state.battle.breakthrough, p = state.player;
  br.down = 0;
  p.hp = Math.max(1, Math.floor(p.maxHp * 0.5));
  breakEnsureUi().veil.classList.remove('on');
  logCombat(heroText('👣 Ты снова идёшь впереди. Не помнишь, как отстал{|а}.'), 'log-entry');
  updateTopStatus();
  updateBattleUI();
}

// Чёрный экран с короткой надписью. Нажатие — пропустить. Нет текста — сразу дальше.
function breakPlate(textLines, done) {
  if (!textLines || !textLines.length) { done(); return; }
  const el = document.createElement('div');
  el.id = 'bx-break-plate';
  el.innerHTML = textLines.map(t => `<p>${t}</p>`).join('');
  document.body.appendChild(el);
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    el.remove();
    done();
  };
  el.addEventListener('click', finish);
  setTimeout(finish, BREAK_PLATE_MS);
}

// Игрок закрыл окно боя (пока только в пробе из чит-меню).
function breakthroughAbort() {
  const p = state.player;
  if (p.hp <= 0) p.hp = Math.max(1, Math.floor(p.maxHp * 0.5));
  breakCleanup();
}

function breakCleanup() {
  state.battle.breakthrough = null;
  ['bx-break', 'bx-break-veil', 'bx-action', 'bx-break-plate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
}

function breakEnsureUi() {
  const stage = document.getElementById('bx-stage');
  let hud = document.getElementById('bx-break');
  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'bx-break';
    hud.innerHTML = '<span class="bxb-wave"></span><span class="bxb-convoy">Обоз: <b></b></span><span class="bxb-time"></span>';
    stage.appendChild(hud);
  }
  let veil = document.getElementById('bx-break-veil');
  if (!veil) {
    veil = document.createElement('div');
    veil.id = 'bx-break-veil';
    stage.appendChild(veil);
  }
  return { hud, veil };
}

function breakRender() {
  const br = state.battle.breakthrough;
  if (!br) return;
  const { hud } = breakEnsureUi();
  const left = Math.max(0, Math.ceil(BREAK_WAVE_SECONDS - br.time));
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  const wave = `Волна ${br.wave}/${BREAK_WAVES.length}`;
  const set = (sel, v) => { const el = hud.querySelector(sel); if (el.textContent !== v) el.textContent = v; };
  set('.bxb-wave', wave);
  set('.bxb-convoy b', String(br.convoy));
  set('.bxb-time', br.between ? '' : clock);
}

function cheatStartBreakthrough() {
  closeCheatMenu();
  breakthroughLoadLines().then(breakthroughStart);
}
