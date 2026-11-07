// ========================================================
//  СИСТЕМЫ: СМЕНА ДНЯ И НОЧИ (v0.32)
//  Время мира — по общим часам (UTC): сутки WORLD_DAY_MIN минут (config.js),
//  у всех игроков одинаково. В сохранении ничего нет — время просто вычисляется.
//  Пока это только ВИД:
//  + на <body> класс tod-<фаза>, на :root переменные --night (0 день … 1 ночь),
//    --dusk (0 … 1 — тёплый вечерний свет) и --dawn (0 … 1 — холодное утро с туманом);
//    их читает css/daynight.css;
//  + значок фазы в верхней строке (подсказка — сколько до следующей);
//  + смена фазы — строчка в журнале; первая ночь — запись в летописи и статья «Сутки»;
//  + монстры с night: true — значок 🌙 на карточке, дневные монстры Поляны — ☀.
//  + v0.34.1: «своё время» на Поляне — ночным ночь, дневным день: стаи больше (battle-pack.js).
//  Настройки → Экран → «Время суток» — посмотреть любую фазу (только вид, в мире время идёт своё).
// ========================================================

const TOD_PREVIEW_KEY = 'l2browser_tod_preview';
const TOD_TICK_MS = 5000;

const WORLD_PHASE_LOG = {
  morning: '🌅 Светает. Туман уползает обратно в лес.',
  day:     '☀ Наступил день. Дневные твари Поляны сбиваются в стаи побольше.',
  evening: '🌇 Солнце садится. Тени становятся длиннее.',
  night:   '🌙 Опустилась ночь. За частоколом кто-то воет — ночные звери сбиваются в большие стаи.',
};

let __todPhase = null;   // фаза мира на прошлом тике — чтобы заметить смену

function todPreview() {
  try { return localStorage.getItem(TOD_PREVIEW_KEY) || ''; } catch (e) { return ''; }
}

// Время мира: { phase, minute, left, preview }. left — минут до следующей фазы.
// real = true — настоящее время мира, без просмотра из настроек.
function worldTime(real) {
  const pv = real ? '' : todPreview();
  const fixed = pv && WORLD_PHASES.find(f => f.id === pv);
  const m = fixed ? (fixed.from + fixed.to) / 2 : (Date.now() / 60000) % WORLD_DAY_MIN;
  const phase = WORLD_PHASES.find(f => m >= f.from && m < f.to) || WORLD_PHASES[0];
  return { phase, minute: m, left: phase.to - m, preview: !!fixed };
}

// Свет по минуте суток: утром ночь уходит, вечером приходит.
// Утро и вечер — разные: утром холодный бледный свет и туман (--dawn), вечером тёплое золото (--dusk).
// Темнота идёт по квадрату: первую половину заката ещё светло, синеет только к концу,
// а утром ночь уходит быстро (иначе тёплый свет и синие сумерки смешивались в грязно-лиловое).
function todLight(m) {
  const mo = WORLD_PHASES.find(f => f.id === 'morning');
  const ev = WORLD_PHASES.find(f => f.id === 'evening');
  if (m < mo.to) { const t = (m - mo.from) / (mo.to - mo.from); return { night: (1 - t) * (1 - t), dusk: 0, dawn: Math.sin(Math.PI * t) }; }
  if (m >= ev.from && m < ev.to) { const t = (m - ev.from) / (ev.to - ev.from); return { night: t * t, dusk: Math.sin(Math.PI * t), dawn: 0 }; }
  return { night: m >= ev.to ? 1 : 0, dusk: 0, dawn: 0 };
}

function applyDayNight() {
  const t = worldTime();
  const light = todLight(t.minute);
  const root = document.documentElement;
  root.style.setProperty('--night', light.night.toFixed(3));
  root.style.setProperty('--dusk', light.dusk.toFixed(3));
  root.style.setProperty('--dawn', light.dawn.toFixed(3));
  WORLD_PHASES.forEach(f => document.body.classList.toggle('tod-' + f.id, f.id === t.phase.id));

  const chip = document.getElementById('top-tod');
  if (chip) {
    const next = WORLD_PHASES[(WORLD_PHASES.indexOf(t.phase) + 1) % WORLD_PHASES.length];
    chip.innerHTML = `${t.phase.icon} <b>${t.phase.name}</b>`;
    chip.classList.toggle('tod-preview', t.preview);
    chip.title = t.preview
      ? 'Просмотр из настроек — в мире время идёт своё'
      : `${next.name} — примерно через ${Math.max(1, Math.ceil(t.left))} мин`;
  }

  // Смена фазы в мире (не просмотр) — строчка в журнале. Первая ночь — летопись и Энциклопедия.
  const p = state.player;
  const real = worldTime(true).phase.id;
  if (__todPhase && __todPhase !== real && p && p.classId && typeof logCombat === 'function') {
    logCombat(WORLD_PHASE_LOG[real], 'log-entry', null, 'sys');
    // v0.34.1: на Поляне сменилось «своё время» монстров — перерисовать карточки (строка «их время»)
    if (p.currentLocation === 'field' && typeof renderMonsters === 'function') renderMonsters();
  }
  __todPhase = real;
  if (real === 'night' && p && p.classId && p.chronicle) {
    if (typeof annalsFirst === 'function') annalsFirst('night');
    if (typeof unlockLore === 'function') unlockLore('day');
  }
}

// ---- Значок времени суток у монстра (карточки на «Охоте») ----
// v0.34.1: на Поляне у каждого монстра своё время — ночным 🌙 ночь, дневным ☀ день.
// В своё время стаи больше (battle-pack.js — isPackPrimeTime). В Копях значка нет.
function nightBadgeHtml(template) {
  const onField = typeof MONSTERS !== 'undefined' && MONSTERS.some(mm => mm.id === template.id);
  if (!template.night && !onField) return '';
  const tail = onField ? ' В своё время стаи на 1 больше, а за бой приходит до 15.' : '';
  return template.night
    ? `<div class="monster-night" title="Ночной: выходит на охоту в темноте.${tail}">🌙</div>`
    : `<div class="monster-night monster-day" title="Дневной: активен днём.${tail}">☀</div>`;
}

// Строка на карточке, пока у монстра его время: «🌙 Их время — стаи больше».
function primeTimeLineHtml(template) {
  if (typeof isPackPrimeTime !== 'function' || !isPackPrimeTime(template)) return '';
  return template.night
    ? `<div class="monster-prime prime-night" title="Ночь: стаи на 1 больше, за бой — до 15">🌙 Ночь — их время: стаи больше</div>`
    : `<div class="monster-prime prime-day" title="День: стаи на 1 больше, за бой — до 15">☀ День — их время: стаи больше</div>`;
}

// ---- Настройки → Экран → «Время суток» ----
function renderTodButtons() {
  const box = document.getElementById('tod-buttons');
  if (!box) return;
  const cur = todPreview();
  const opts = [{ id: '', name: 'Как в мире', icon: '' }].concat(WORLD_PHASES);
  box.innerHTML = opts.map(o =>
    `<button class="settings-btn${cur === o.id ? ' active' : ''}" onclick="setTodPreview('${o.id}')">${o.icon ? o.icon + ' ' : ''}${o.name}</button>`).join('');
  const now = document.getElementById('tod-current-value');
  if (now) { const w = worldTime(true); now.textContent = `${w.phase.icon} ${w.phase.name}`; }
}

function setTodPreview(id) {
  try {
    if (id) localStorage.setItem(TOD_PREVIEW_KEY, id);
    else localStorage.removeItem(TOD_PREVIEW_KEY);
  } catch (e) {}
  applyDayNight();
  renderTodButtons();
}

applyDayNight();
setInterval(applyDayNight, TOD_TICK_MS);
