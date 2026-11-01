// ========================================================
//  v0.22: ПОДСКАЗКИ ПО ХАРАКТЕРИСТИКАМ (окно персонажа)
//  Тап/клик по строке «Сила», «Ловкость» и т.д. раскрывает
//  пояснение: что даёт характеристика и сколько именно у вас.
//  Цифры считаются по тем же формулам, что и в stats.js / helpers.js.
// ========================================================

const STAT_INFO_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIT', 'MEN'];
let openStatInfo = null;

function toggleStatInfo(key) {
  openStatInfo = (openStatInfo === key) ? null : key;
  renderStatInfo();
}

// Скорость шкалы от характеристики (без экипировки, баффов и навыков).
function statAtbFrom(value) {
  const d = Math.max(0, value - 10);
  return 0.7 + 3.0 * d / (d + 90);
}

function statInfoHtml(key) {
  const p = state.player;
  if (!p.classId) return 'Сначала выберите класс.';
  const mage = p.classId === 'mage';
  const eff = (k) => p['eff' + k] || p[k] || 0;
  const v = eff(key);
  const lvl = p.level || 1;
  const f1 = (x) => (Math.round(x * 10) / 10).toString().replace('.', ',');
  const f2 = (x) => x.toFixed(2).replace('.', ',');
  const main = mage ? ['INT', 'WIT', 'MEN'] : ['STR', 'DEX', 'CON'];
  const isMain = main.includes(key);
  const own = isMain
    ? `<div class="stat-info-main">Основная характеристика ${mage ? 'мага' : 'воина'}: редкость вещей добавляет именно её.</div>`
    : `<div class="stat-info-side">Для ${mage ? 'мага' : 'воина'} второстепенная.</div>`;
  const rows = [];

  if (key === 'STR') {
    rows.push(`Физическая атака: <b>+0,8</b> за единицу. Сейчас Сила даёт <b>+${Math.floor(v * 0.8)}</b> к атаке (до оружия и навыков).`);
    rows.push(mage ? 'Маг бьёт магией — его урон от Силы не зависит.' : 'Чем выше атака, тем больше урон обычными ударами и навыками воина.');
  } else if (key === 'DEX') {
    const accEva = Math.sqrt(v) * 6;
    rows.push(`Точность и уворот: <b>+${f1(accEva)}</b> к каждому (растёт всё медленнее с каждой единицей).`);
    if (!mage) {
      const now = statAtbFrom(v), next = statAtbFrom(v + 1);
      rows.push(`Скорость шкалы боя (как часто вы ходите): <b>${f2(now)}</b> от Ловкости (у монстров 0,70). +1 Ловкости сейчас даёт <b>+${f1((next / now - 1) * 100)}%</b> скорости.`);
    } else {
      rows.push('У мага скорость шкалы зависит от Мудрости, а не от Ловкости.');
    }
  } else if (key === 'CON') {
    const perPt = (2.77 + 0.45 * (lvl - 1)) * (mage ? 1.2 : 1);
    rows.push(`Здоровье: <b>+${f1(perPt)} HP</b> за единицу на вашем ${lvl} уровне (с уровнем растёт). Сейчас Телосложение даёт <b>${Math.floor(v * perPt)} HP</b>.`);
    rows.push(`Физическая защита: <b>+0,3</b> за единицу — сейчас <b>+${Math.floor(v * 0.3)}</b>. Против монстров срабатывает 30% защиты.`);
  } else if (key === 'INT') {
    rows.push(`Магическая атака: <b>+0,8</b> за единицу. Сейчас Интеллект даёт <b>+${Math.floor(v * 0.8)}</b> (до посоха и навыков).`);
    rows.push(mage ? 'От маг. атаки зависят урон заклинаний, лечение и поджог.' : 'Воин бьёт оружием — его урон от Интеллекта не зависит.');
  } else if (key === 'WIT') {
    if (mage) {
      const now = statAtbFrom(v), next = statAtbFrom(v + 1);
      rows.push(`Скорость шкалы боя (скорость каста): <b>${f2(now)}</b> от Мудрости (у монстров 0,70). +1 Мудрости сейчас даёт <b>+${f1((next / now - 1) * 100)}%</b> скорости.`);
    } else {
      rows.push('Скорость шкалы мага (скорость каста). Воину ничего не даёт: его скорость — от Ловкости.');
    }
  } else if (key === 'MEN') {
    const mpPt = mage ? (0.905 + 0.256 * lvl + 0.0185 * lvl * lvl) : (0.722 + 0.194 * lvl + 0.0042 * lvl * lvl);
    rows.push(`Мана: <b>+${f1(mpPt)} MP</b> за единицу на вашем ${lvl} уровне (с уровнем растёт). Сейчас Дух даёт <b>${Math.floor(v * mpPt)} MP</b>; чем больше запас, тем быстрее восстанавливается мана.`);
    rows.push(`Магическая защита: <b>+0,3</b> за единицу — сейчас <b>+${Math.floor(v * 0.3)}</b>. Против магии монстров срабатывает 50%.`);
    if (!mage) rows.push('Воину мана нужна на навыки (10–15 MP за удар).');
  }
  return own + rows.map(r => `<div class="stat-info-line">• ${r}</div>`).join('');
}

function renderStatInfo() {
  STAT_INFO_KEYS.forEach(k => {
    const box = document.getElementById('cs-info-' + k.toLowerCase());
    const row = document.getElementById('cs-row-' + k.toLowerCase());
    if (!box) return;
    const open = openStatInfo === k;
    box.style.display = open ? 'block' : 'none';
    if (row) row.classList.toggle('open', open);
    if (open) box.innerHTML = statInfoHtml(k);
  });
}
