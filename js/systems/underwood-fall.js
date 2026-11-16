// ========================================================
//  СИСТЕМЫ: ПАДЕНИЕ АНДЕРВУДА
//  Цепочка с 20 уровня: Собрание у Старейшины → заставка → совет на привале →
//  прорыв к Ильграду → ворота → герой в открытом Ильграде.
//
//  p.fallStage — где цепочка сейчас ('assembly' | 'cinematic' | 'council' | 'battle' | 'gates'), null — не идёт.
//  Обновил страницу — цепочка продолжается с этой стадии (fallResume), прорыв — с последней пройденной волны.
//  p.underwoodFallen — деревни больше нет: дом героя теперь Ильград (homeTown).
//
//  Тексты, кадры и приметы 17–19 — js/data/fall-lines.js. Нет файла — цепочка не предлагается.
// ========================================================

const FALL_IMG = 'img/story/fall/';
const FALL_MIN_LEVEL = 20;
const FALL_TREMOR_MINUTES = { 18: [20, 30], 19: [8, 12] };

function homeTown() {
  return state.player.underwoodFallen ? 'ilgrad' : 'town';
}

function fallReady() {
  const p = state.player;
  return !!window.FALL_LINES && !!p.classId && (p.level || 1) >= FALL_MIN_LEVEL
    && !p.fallStage && !p.underwoodFallen && !p.ilgradOpen;
}

// Из openElder: на 20 уровне Старейшина сперва зовёт на Собрание.
function fallElderCall() {
  if (!fallReady()) return false;
  openDialogue('elder', 'fall_call');
  return true;
}

function fallStart() {
  if (!fallReady()) return;
  state.player.fallStage = 'assembly';
  fallRun();
}

function fallNext(stage) {
  state.player.fallStage = stage;
  saveCurrentSlot();
  fallRun();
}

function fallRun() {
  const p = state.player, L = window.FALL_LINES;
  if (!L) return;
  [...L.cinematic.map(f => f.img), L.assembly.bg, L.council.bg].forEach(n => { if (n) new Image().src = FALL_IMG + n; });

  if (p.fallStage === 'assembly') {
    fallDialogue(L.assembly, () => {
      p.underwoodFallen = true;
      fallNext('cinematic');
    });
  } else if (p.fallStage === 'cinematic') {
    fallCinematic(L.cinematic, () => {
      annalsFirst('fall.gone');
      fallNext('council');
    });
  } else if (p.fallStage === 'council') {
    fallDialogue(L.council, () => fallNext('battle'));
  } else if (p.fallStage === 'battle') {
    p.currentLocation = 'outskirts';   // в городе бой не начинается, а герой уже на дороге
    breakthroughLoadLines().then(() => breakthroughStart({ real: true, resume: p.fallBattle }));
  } else if (p.fallStage === 'gates') {
    fallDialogue(L.gates, fallOpenCity);
  }
}

// Прорыв закончен (ilgrad-breakthrough.js → breakFinish).
function fallAfterBattle(left) {
  const p = state.player;
  p.breakthroughResult = left;
  p.fallBattle = null;
  fallNext('gates');
}

function fallOpenCity() {
  const p = state.player, left = p.breakthroughResult || 0;
  if (left > 0) annalsFirst('fall.gates', { n: left });
  else annalsFirst('fall.gates0');
  p.fallStage = null;
  p.ilgradOpen = true;
  p.underwoodFallen = true;
  p.currentLocation = 'ilgrad';
  annalsFirst('loc.ilgrad');
  if (typeof loreSyncBeasts === 'function') loreSyncBeasts(false);
  checkLevelUp();   // потолок поднялся до 30
  recalcStats();
  updateTopStatus();
  updateCharacterPanel();
  updateMapUI();
  switchTab('hunt');
  renderMonsters();
  saveCurrentSlot();
  logCombat('🏰 Ильград открыт. Максимальный уровень теперь 30.', 'log-entry levelup');
  showToast('🏰', 'Ильград открыт · уровень до 30');
}

// После загрузки героя, застрявшего посреди цепочки.
function fallResume() {
  if (state.player.fallStage) fallRun();
}

// ---- ПРИМЕТЫ 17–19 ----
// Запись в Летописи и голос из сумки — один раз, когда герой дорос. Зовётся при получении уровня и при загрузке.
function fallOmensCheck() {
  const p = state.player, L = window.FALL_LINES;
  if (!L || !p.classId || p.underwoodFallen || !p.chronicle) return;
  const firsts = p.chronicle.firsts || {};
  [17, 18, 19].forEach(lvl => {
    const key = 'fall.' + lvl;
    if (p.level < lvl || firsts[key]) return;
    annalsFirst(key);
    const bag = L.bagAtLevel[lvl];
    if (bag) { logCombat(`🎒 Заплечник: «${heroText(bag)}»`, 'log-entry'); showToast('🎒', heroText(bag)); }
  });
  if (p.level >= FALL_MIN_LEVEL && !firsts['fall.call'] && fallReady()) {
    annalsFirst('fall.call');
    logCombat('🕯 ' + L.callLog, 'log-entry levelup');
    showToast('🕯', L.callLog);
  }
}

let __fallNextTremor = 0;

// Дрожь земли: проверяется после очищенной стаи, чтобы не заводить отдельный таймер.
function fallOmenOnClear() {
  const p = state.player, L = window.FALL_LINES;
  if (!L || p.underwoodFallen || state.battle.breakthrough) return;
  const range = FALL_TREMOR_MINUTES[Math.min(p.level, 19)];
  if (!range) return;
  const now = Date.now(), next = () => now + 60000 * (range[0] + Math.random() * (range[1] - range[0]));
  if (!__fallNextTremor) { __fallNextTremor = next(); return; }
  if (now < __fallNextTremor) return;
  __fallNextTremor = next();
  const inMine = p.currentLocation === 'mine' && Math.random() < 0.4;
  logCombat(inMine ? L.knock : L.tremor, 'log-entry');
  if (!inMine && document.getElementById('bx-stage')) breakShake();
}

// ---- СЦЕНЫ ----
function fallRain(canvas, host, isOn) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const ctx = canvas.getContext('2d');
  const drops = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), v: 0.9 + Math.random() * 0.8, l: 14 + Math.random() * 18 }));
  let w = 0, h = 0, last = performance.now(), alive = true;
  const size = () => { w = canvas.width = host.clientWidth; h = canvas.height = host.clientHeight; };
  window.addEventListener('resize', size);
  size();
  const tick = now => {
    if (!alive) return;
    const dt = Math.min(50, now - last);
    last = now;
    ctx.clearRect(0, 0, w, h);
    if (isOn()) {
      ctx.strokeStyle = 'rgba(205,215,235,.75)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      drops.forEach(d => {
        d.y += d.v * dt / 620;
        d.x -= d.v * dt / 5200;
        if (d.y > 1.05) { d.y = -0.05; d.x = Math.random() * 1.1; }
        const x = d.x * w, y = d.y * h;
        ctx.moveTo(x, y);
        ctx.lineTo(x - d.l * 0.12, y + d.l);
      });
      ctx.stroke();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => { alive = false; window.removeEventListener('resize', size); };
}

function fallText(t) {
  const raw = typeof t === 'function' ? t() : t;
  return heroText(raw).replace(/%name%/g, state.player.name).replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function fallMount(html) {
  const old = document.getElementById('fall-scene');
  if (old) old.remove();
  const el = document.createElement('div');
  el.id = 'fall-scene';
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

// Заставка: автопоказ кадров, «Пропустить», «Дальше».
function fallCinematic(frames, done) {
  const LINE_MS = 1700, HOLD_MS = 3000;
  const el = fallMount(`
    <div class="fs-stage" id="fs-stage">
      <div class="fs-back" id="fs-back"></div>
      <img class="fs-pic" id="fs-pic" alt="">
      <canvas class="fs-rain" id="fs-rain"></canvas>
      <div class="fs-bolt" id="fs-bolt"></div>
      <div class="fs-veil" id="fs-veil"></div>
      <button class="fs-skip" id="fs-skip" type="button">Пропустить</button>
    </div>
    <div class="fs-caption">
      <div class="fs-lines" id="fs-lines" aria-live="polite"></div>
      <button class="fs-next" id="fs-next" type="button">Дальше</button>
    </div>`);
  const $ = id => el.querySelector('#' + id);
  const stage = $('fs-stage'), pic = $('fs-pic'), back = $('fs-back'), veil = $('fs-veil'), linesEl = $('fs-lines'), nextBtn = $('fs-next'), bolt = $('fs-bolt'), skipBtn = $('fs-skip');
  let idx = -1, timers = [], busy = false, rainOn = true, ended = false;
  const stopRain = fallRain($('fs-rain'), stage, () => rainOn);
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  const finishFrame = () => {
    const f = frames[idx];
    linesEl.querySelectorAll('p').forEach(p => p.classList.add('on'));
    nextBtn.classList.add('on');
    if (!f.last) later(() => show(idx + 1), HOLD_MS);
  };
  const show = i => {
    busy = true;
    clear();
    nextBtn.classList.remove('on');
    veil.classList.remove('off');
    linesEl.querySelectorAll('p').forEach(p => p.classList.remove('on'));
    later(() => {
      const f = frames[i];
      idx = i;
      stage.className = 'fs-stage' + (f.stage ? ' ' + f.stage : '');
      bolt.classList.remove('on');
      pic.className = 'fs-pic';
      void pic.offsetWidth;
      if (f.img) {
        pic.src = FALL_IMG + f.img;
        pic.style.visibility = 'visible';
        pic.className = 'fs-pic' + (f.fx ? ' ' + f.fx : '');
        back.style.backgroundImage = `url('${FALL_IMG}${f.img}')`;
      } else {
        pic.style.visibility = 'hidden';
        back.style.backgroundImage = 'none';
      }
      rainOn = !f.rainOff;
      skipBtn.style.display = f.last ? 'none' : '';
      linesEl.innerHTML = f.lines.map(l => typeof l === 'string' ? `<p>${fallText(l)}</p>` : `<p class="say">${fallText(l.say)}</p>`).join('');
      veil.classList.add('off');
      if (f.bolt) later(() => bolt.classList.add('on'), f.bolt);
      const ps = [...linesEl.children];
      ps.forEach((p, n) => later(() => p.classList.add('on'), 800 + n * LINE_MS));
      later(finishFrame, 800 + ps.length * LINE_MS);
      busy = false;
    }, 750);
  };
  const finish = () => {
    if (ended) return;
    ended = true;
    clear();
    stopRain();
    document.removeEventListener('keydown', onKey);
    el.remove();
    done();
  };
  const advance = () => {
    if (busy || ended || idx < 0) return;
    if (!nextBtn.classList.contains('on')) { clear(); finishFrame(); return; }
    if (frames[idx].last) { finish(); return; }
    show(idx + 1);
  };
  const onKey = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); } };
  el.addEventListener('click', advance);
  skipBtn.addEventListener('click', e => { e.stopPropagation(); if (!busy) show(frames.length - 1); });
  document.addEventListener('keydown', onKey);
  show(0);
}

// Портрета ещё нет — вместо него силуэт.
function fallNoFace(img) {
  img.onerror = null;
  img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-6 -6 36 36'%3E%3Crect x='-6' y='-6' width='36' height='36' fill='%2316130f'/%3E%3Ccircle cx='12' cy='8' r='5' fill='%2357504a'/%3E%3Cpath d='M3 24c0-6 4-9 9-9s9 3 9 9z' fill='%2357504a'/%3E%3C/svg%3E";
}

const FALL_SILHOUETTE ='<svg class="fs-face" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="5"/><path d="M3 24c0-6 4-9 9-9s9 3 9 9z"/></svg>';

// Разговор на фоне: ряд портретов, реплики по нажатию, выборы.
// Элемент списка: { t }, { who, t }, { bag, t }, а также fx / bg / cast / hideRow; { choice: [{ text, reply: [...] }] }.
function fallDialogue(scene, done) {
  const el = fallMount(`
    <div class="fs-stage" id="fs-stage">
      <img class="fs-bg" id="fs-bg" alt="">
      <canvas class="fs-rain" id="fs-rain"></canvas>
      <div class="fs-shade"></div>
      <div class="fs-row" id="fs-row"></div>
      <div class="fs-veil" id="fs-veil"></div>
    </div>
    <div class="fs-panel">
      <div class="fs-speech" id="fs-speech">
        <img class="fs-solo" id="fs-solo" src="${FALL_IMG}bag.webp" alt="">
        <div class="fs-body">
          <div class="fs-name" id="fs-name"></div>
          <div class="fs-text" id="fs-text" aria-live="polite"></div>
        </div>
      </div>
      <div class="fs-choices" id="fs-choices"></div>
      <div class="fs-hint" id="fs-hint">нажми, чтобы продолжить</div>
    </div>`);
  const $ = id => el.querySelector('#' + id);
  const stage = $('fs-stage'), bg = $('fs-bg'), row = $('fs-row'), veil = $('fs-veil'), nameEl = $('fs-name'), textEl = $('fs-text'), solo = $('fs-solo'), speech = $('fs-speech'), choices = $('fs-choices'), hint = $('fs-hint');
  const CAST = window.FALL_LINES.cast;
  let queue = scene.lines, pos = -1, waiting = false, ended = false, swap = 0, cards = {};
  const stopRain = fallRain($('fs-rain'), stage, () => true);

  const setCast = ids => {
    row.innerHTML = '';
    row.classList.remove('hide');
    cards = {};
    ids.forEach(id => {
      const c = CAST[id];
      const card = document.createElement('div');
      card.className = 'fs-who';
      card.innerHTML = (c.img ? `<img class="fs-face" src="${c.img}" alt="" onerror="fallNoFace(this)">` : FALL_SILHOUETTE) + `<span>${c.short || c.name}</span>`;
      row.appendChild(card);
      cards[id] = card;
    });
  };
  const setBg = name => { bg.src = name.startsWith('img/') ? name : FALL_IMG + name; };
  const showLine = l => {
    Object.values(cards).forEach(c => c.classList.remove('on'));
    textEl.classList.remove('on');
    clearTimeout(swap);
    if (l.bg) setBg(l.bg);
    if (l.cast) setCast(l.cast);
    if (l.fx === 'look') {
      bg.classList.add('look');
      stage.classList.add('rumble');
      setTimeout(() => stage.classList.remove('rumble'), 2100);
    }
    if (l.fx === 'back') bg.classList.remove('look');
    if (l.hideRow) row.classList.add('hide');
    solo.classList.toggle('on', !!l.bag);
    if (l.who && cards[l.who]) cards[l.who].classList.add('on');
    swap = setTimeout(() => {
      nameEl.textContent = l.bag ? 'Заплечник' : (l.who ? CAST[l.who].name : '');
      textEl.className = 'fs-text' + (l.who || l.bag ? '' : ' narr');
      textEl.innerHTML = fallText(l.t);
      void textEl.offsetWidth;
      textEl.classList.add('on');
    }, 160);
  };
  const pick = opt => {
    choices.classList.remove('on');
    speech.style.display = '';
    hint.style.display = '';
    waiting = false;
    queue = (opt.reply || []).concat(queue.slice(pos + 1));
    pos = -1;
    next();
  };
  const ask = l => {
    waiting = true;
    speech.style.display = 'none';
    hint.style.display = 'none';
    Object.values(cards).forEach(c => c.classList.remove('on'));
    choices.innerHTML = '';
    l.choice.forEach(opt => {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = fallText(opt.text);
      b.addEventListener('click', e => { e.stopPropagation(); pick(opt); });
      choices.appendChild(b);
    });
    choices.classList.add('on');
  };
  const finish = () => {
    ended = true;
    clearTimeout(swap);
    stopRain();
    document.removeEventListener('keydown', onKey);
    veil.classList.remove('off');
    setTimeout(() => { el.remove(); done(); }, 700);
  };
  function next() {
    if (waiting || ended) return;
    pos++;
    if (pos >= queue.length) { finish(); return; }
    const l = queue[pos];
    if (l.choice) ask(l); else showLine(l);
  }
  const onKey = e => {
    if (waiting) {
      const i = Number(e.key) - 1;
      const opts = queue[pos] && queue[pos].choice;
      if (opts && opts[i]) pick(opts[i]);
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); next(); }
  };
  el.addEventListener('click', next);
  document.addEventListener('keydown', onKey);
  setBg(scene.bg);
  setCast(scene.cast);
  setTimeout(() => { veil.classList.add('off'); next(); }, 300);
}

// ---- Чит-меню: проба всей цепочки ----
function cheatFallReset() {
  const p = state.player;
  p.underwoodFallen = false;
  p.fallStage = null;
  p.fallBattle = null;
  p.breakthroughResult = undefined;
  p.ilgradOpen = false;
  if (p.chronicle && p.chronicle.firsts) ['fall.gone', 'fall.gates', 'fall.gates0'].forEach(k => delete p.chronicle.firsts[k]);
  if (p.currentLocation === 'ilgrad' || p.currentLocation === 'outskirts') p.currentLocation = 'town';
  checkLevelUp();
  updateTopStatus();
  updateCharacterPanel();
  updateMapUI();
  if (typeof renderCheatMenu === 'function') renderCheatMenu();
  saveCurrentSlot();
  showToast('🕯', 'Андервуд снова стоит');
}

function cheatFallStart() {
  closeCheatMenu();
  if (!window.FALL_LINES) { showToast('⚠', 'Нет файла сюжета'); return; }
  cheatFallReset();
  const p = state.player;
  if (p.level < FALL_MIN_LEVEL) cheatAddLevels(FALL_MIN_LEVEL - p.level);
  fallStart();
}
