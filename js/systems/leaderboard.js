// ========================================================
//  СИСТЕМЫ: РЕЙТИНГ ИГРОКОВ (LEADERBOARD)
//  Тянет топ-50 из Supabase, подмешивает ботов,
//  рисует список с сортировкой по уровню / золоту / убийствам.
//
//  Открывается кнопкой 🏆 в городе.
//  Доступен только залогиненным (cloudIsReady() === true).
//
//  Что пишем в рейтинг: имя, раса, класс, уровень, золото, убийства.
//  Throttle на пуш: 30 секунд. При level up и при открытии окна —
//  пушим без throttle.
//
//  НОВОЕ (v0.15):
//  + cloudCleanupLeaderboardGhosts() — при входе в аккаунт
//    чистим «призраков» в leaderboard: строки, у которых
//    в saves уже нет соответствующего слота.
//    ВАЖНО: если saves в облаке пуст — НЕ чистим
//    (защита от ложных удалений, когда сеть упала
//    и сейв не залился в облако).
// ========================================================

// Текущая сортировка: 'level' | 'gold' | 'kills'.
let __lbSortBy = 'level';

// Последний раз, когда мы пушили в облако (для throttle).
let __lbLastPushAt = 0;

// Throttle: 30 секунд между пушами в облако.
const LB_PUSH_THROTTLE_MS = 30 * 1000;

// Сколько строк показывать в топе.
const LB_TOP_N = 50;

// ========================================================
//  БОТЫ (фейковые игроки для «живого» рейтинга)
//  Не идут в Supabase. Держатся в коде.
//  Если реальные игроки обгонят — боты опустятся вниз.
// ========================================================

const LEADERBOARD_BOTS = [
  { character_name: 'Арагорн',   race_id: 'human', class_id: 'warrior', level: 20, gold: 485000, kills: 12450 },
  { character_name: 'Гром',      race_id: 'orc',   class_id: 'warrior', level: 20, gold: 412000, kills: 11200 },
  { character_name: 'Лириэль',   race_id: 'elf',   class_id: 'mage',    level: 19, gold: 378000, kills: 9800  },
  { character_name: 'Торин',     race_id: 'dwarf', class_id: 'warrior', level: 19, gold: 325000, kills: 10500 },
  { character_name: 'Мальтаэль', race_id: 'drow',  class_id: 'mage',    level: 18, gold: 298000, kills: 8100  },
  { character_name: 'Бьорн',     race_id: 'dwarf', class_id: 'mage',    level: 17, gold: 245000, kills: 7300  },
  { character_name: 'Ксандра',   race_id: 'human', class_id: 'mage',    level: 16, gold: 198000, kills: 6100  },
  { character_name: 'Ургаш',     race_id: 'orc',   class_id: 'mage',    level: 15, gold: 156000, kills: 5200  },
  { character_name: 'Финнэль',   race_id: 'elf',   class_id: 'warrior', level: 14, gold: 124000, kills: 4400  },
  { character_name: 'Хельга',    race_id: 'drow',  class_id: 'warrior', level: 12, gold: 87000,  kills: 3100  },
];

// ========================================================
//  ПОДСЧЁТ УБИЙСТВ
// ========================================================

// Сумма всех значений monsterKills[*] = общее число убийств.
function getPlayerKillsTotal() {
  const p = state.player;
  if (!p || !p.monsterKills) return 0;

  let total = 0;
  Object.keys(p.monsterKills).forEach(key => {
    const v = p.monsterKills[key];
    if (typeof v === 'number' && v > 0) total += v;
  });
  return total;
}

// ========================================================
//  v0.26: СКРЫТЫЕ ИЗ РЕЙТИНГА ГЕРОИ
//  Тестовые (имя начинается на «Тест» / «Test», регистр не важен)
//  и те, на ком использовали чит (метка p.usedCheat, ставится в cheat.js).
//  Такой герой не отправляет строку, а уже отправленную удаляет.
//  При показе тестовые имена дополнительно отбрасываются (старые строки).
// ========================================================
function isTestHeroName(name) {
  return /^\s*(тест|test)/i.test(String(name || ''));
}

function getLeaderboardHiddenReason(p) {
  if (!p) return null;
  if (p.usedCheat) return 'на герое использовался чит';
  if (isTestHeroName(p.name)) return 'тестовое имя';
  return null;
}

// Удалить строку текущего героя (один раз на героя за сессию).
let __lbHiddenRemoved = null;
function hideMyLeaderboardRow() {
  if (typeof cloudUser === 'undefined' || !cloudUser) return;
  const slot = (state.activeSlotIndex !== null && state.activeSlotIndex !== undefined) ? state.activeSlotIndex : 0;
  const key = cloudUser.id + ':' + slot;
  if (__lbHiddenRemoved === key) return;
  __lbHiddenRemoved = key;
  cloudDeleteLeaderboardRow(slot);
}

// ========================================================
//  ПУШ В ОБЛАКО (upsert своей строки)
// ========================================================

// Отправить свою строку в leaderboard.
// force = true — игнорировать throttle (для level up и open).
async function cloudPushLeaderboard(force) {
  if (typeof cloudIsReady !== 'function' || !cloudIsReady()) return;
  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
  if (typeof cloudUser === 'undefined' || !cloudUser) return;

  const now = Date.now();
  if (!force && (now - __lbLastPushAt) < LB_PUSH_THROTTLE_MS) {
    return; // throttle
  }

  const p = state.player;
  if (!p || !p.classId) return; // персонаж ещё не создан

  // v0.26: тестовый / читерский герой в рейтинг не идёт
  if (getLeaderboardHiddenReason(p)) { hideMyLeaderboardRow(); return; }

  const slot = (state.activeSlotIndex !== null && state.activeSlotIndex !== undefined)
    ? state.activeSlotIndex
    : 0;

  const row = {
    user_id: cloudUser.id,
    slot: slot,
    character_name: p.name || 'Безымянный',
    race_id: p.raceId || 'human',
    class_id: p.classId || 'warrior',
    level: p.level || 1,
    gold: p.gold || 0,
    kills: getPlayerKillsTotal(),
    updated_at: new Date().toISOString(),
  };
  // v0.25: снимок героя для окна «Осмотр героя» (hero-inspect.js)
  if (typeof buildHeroProfile === 'function') {
    try { row.profile = buildHeroProfile(); } catch (e) { console.warn('[leaderboard] profile:', e); }
  }

  try {
    let { error } = await supabaseClient
      .from('leaderboard')
      .upsert(row, { onConflict: 'user_id,slot' });

    // Нет колонки profile в базе — пишем рейтинг без снимка.
    if (error && row.profile && /profile/i.test(error.message || '')) {
      delete row.profile;
      ({ error } = await supabaseClient.from('leaderboard').upsert(row, { onConflict: 'user_id,slot' }));
    }

    if (error) {
      console.warn('[leaderboard] push error:', error.message);
      return;
    }

    __lbLastPushAt = now;
  } catch (e) {
    console.warn('[leaderboard] push exception:', e);
  }
}

// Удалить свою строку из рейтинга (при удалении слота).
async function cloudDeleteLeaderboardRow(slotIndex) {
  if (typeof cloudIsReady !== 'function' || !cloudIsReady()) return;
  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
  if (typeof cloudUser === 'undefined' || !cloudUser) return;

  try {
    const { error } = await supabaseClient
      .from('leaderboard')
      .delete()
      .eq('user_id', cloudUser.id)
      .eq('slot', slotIndex);

    if (error) {
      console.warn('[leaderboard] delete error:', error.message);
    }
  } catch (e) {
    console.warn('[leaderboard] delete exception:', e);
  }
}

// ========================================================
//  ЧИСТКА ПРИЗРАКОВ (v0.15)
// ========================================================
//  Призрак — строка в leaderboard, для которой в saves
//  уже нет соответствующего слота (персонаж удалён).
//
//  ВАЖНО: если saves в облаке ПУСТ — НЕ чистим.
//  Это защита от ситуации, когда сеть упала и сейв не залился,
//  а leaderboard уже есть. Иначе мы зря удалим свою же строку.
// ========================================================
async function cloudCleanupLeaderboardGhosts() {
  if (typeof cloudIsReady !== 'function' || !cloudIsReady()) return;
  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
  if (typeof cloudUser === 'undefined' || !cloudUser) return;

  try {
    // 1. Тянем ВСЕ слоты из saves.
    const { data: savesData, error: savesErr } = await supabaseClient
      .from('saves')
      .select('slot')
      .eq('user_id', cloudUser.id);

    if (savesErr) {
      console.warn('[leaderboard] ghosts: saves fetch error:', savesErr.message);
      return;
    }

    const saveSlots = new Set((savesData || []).map(r => r.slot));

    // ---- ЗАЩИТА: если saves пуст — НЕ чистим. ----
    if (saveSlots.size === 0) {
      // Возможно, игрок только что вошёл с нового устройства,
      // или сеть упала и сейв не залился. Не рискуем.
      return;
    }

    // 2. Тянем ВСЕ строки из leaderboard для нашего user_id.
    const { data: lbData, error: lbErr } = await supabaseClient
      .from('leaderboard')
      .select('slot')
      .eq('user_id', cloudUser.id);

    if (lbErr) {
      console.warn('[leaderboard] ghosts: leaderboard fetch error:', lbErr.message);
      return;
    }

    // 3. Находим призраков: строки в leaderboard, которых нет в saves.
    const ghosts = (lbData || []).filter(r => !saveSlots.has(r.slot));

    if (ghosts.length === 0) {
      return;
    }

    // 4. Удаляем призраков.
    const ghostSlots = ghosts.map(g => g.slot);

    const { error: delErr } = await supabaseClient
      .from('leaderboard')
      .delete()
      .eq('user_id', cloudUser.id)
      .in('slot', ghostSlots);

    if (delErr) {
      console.warn('[leaderboard] ghosts: delete error:', delErr.message);
      return;
    }

    console.log('[leaderboard] Удалены призраки из рейтинга: слоты', ghostSlots.join(', '));
  } catch (e) {
    console.warn('[leaderboard] ghosts exception:', e);
  }
}

// ========================================================
//  ЗАГРУЗКА ТОП-50 ИЗ SUPABASE
// ========================================================

async function cloudFetchLeaderboard(sortBy) {
  if (typeof cloudIsReady !== 'function' || !cloudIsReady()) {
    return { ok: false, error: 'not authorized', rows: [] };
  }
  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    return { ok: false, error: 'no supabase', rows: [] };
  }

  const orderCol = (sortBy === 'gold') ? 'gold'
                 : (sortBy === 'kills') ? 'kills'
                 : 'level';

  try {
    const { data, error } = await supabaseClient
      .from('leaderboard')
      .select('user_id, slot, character_name, race_id, class_id, level, gold, kills, updated_at')
      .order(orderCol, { ascending: false })
      .limit(LB_TOP_N);

    if (error) {
      console.warn('[leaderboard] fetch error:', error.message);
      return { ok: false, error: error.message, rows: [] };
    }

    return { ok: true, rows: data || [] };
  } catch (e) {
    console.warn('[leaderboard] fetch exception:', e);
    return { ok: false, error: String(e), rows: [] };
  }
}

// ========================================================
//  ОБЪЕДИНЕНИЕ С БОТАМИ И СОРТИРОВКА
// ========================================================

// Собираем: боты + реальные игроки, сортируем, обрезаем топ-50.
function buildMergedLeaderboard(realRows, sortBy) {
  const bots = LEADERBOARD_BOTS.map(b => ({
    ...b,
    user_id: null,
    slot: null,
    isBot: true,
    isMe: false,
  }));

  const meHidden = !!getLeaderboardHiddenReason(state.player);
  const reals = (realRows || []).filter(r => !isTestHeroName(r.character_name)).map(r => ({
    ...r,
    isBot: false,
    isMe: isThisMyRow(r),
  })).filter(r => !(meHidden && r.isMe));   // своя строка могла ещё не успеть удалиться

  const merged = [...bots, ...reals];

  const key = (sortBy === 'gold') ? 'gold'
            : (sortBy === 'kills') ? 'kills'
            : 'level';

  merged.sort((a, b) => {
    const va = a[key] || 0;
    const vb = b[key] || 0;
    if (vb !== va) return vb - va;
    // Вторичная сортировка — по имени, чтобы порядок был стабильным.
    return String(a.character_name).localeCompare(String(b.character_name));
  });

  return merged;
}

// Это моя строка? (по user_id + slot)
function isThisMyRow(row) {
  if (typeof cloudUser === 'undefined' || !cloudUser) return false;
  if (row.user_id !== cloudUser.id) return false;

  const mySlot = (state.activeSlotIndex !== null && state.activeSlotIndex !== undefined)
    ? state.activeSlotIndex
    : 0;

  return row.slot === mySlot;
}

// ========================================================
//  UI — ОТКРЫТИЕ / ЗАКРЫТИЕ
// ========================================================

function openLeaderboard() {
  if (typeof cloudIsReady === 'function' && !cloudIsReady()) {
    if (typeof showToast === 'function') showToast('🏆', 'Рейтинг доступен только с аккаунтом');
    return;
  }

  if (!isTownLoc(state.player.currentLocation)) return;   // v0.36: Андервуд или Ильград

  if (typeof cancelWaitingForResume === 'function') {
    cancelWaitingForResume('открыт рейтинг');
  }

  // Принудительный пуш своей строки — чтобы сразу попасть в список.
  cloudPushLeaderboard(true);

  const overlay = document.getElementById('leaderboard-overlay');
  if (!overlay) return;

  overlay.classList.add('active');
  renderLeaderboard();
}

function closeLeaderboard() {
  const overlay = document.getElementById('leaderboard-overlay');
  if (overlay) overlay.classList.remove('active');
}

// ========================================================
//  ПЕРЕКЛЮЧЕНИЕ СОРТИРОВКИ
// ========================================================

function switchLeaderboardSort(sortBy) {
  if (sortBy !== 'level' && sortBy !== 'gold' && sortBy !== 'kills') return;
  __lbSortBy = sortBy;
  renderLeaderboard();
}

// ========================================================
//  РЕНДЕР
// ========================================================

async function renderLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  if (!list) return;

  // Подсветить активную кнопку сортировки.
  document.querySelectorAll('.leaderboard-sort-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === __lbSortBy);
  });

  // Показать «загрузка…» пока тянем.
  list.innerHTML = `<div class="leaderboard-empty">Загружаем...</div>`;

  // Тянем из облака.
  const res = await cloudFetchLeaderboard(__lbSortBy);

  const realRows = res.ok ? res.rows : [];
  const merged = buildMergedLeaderboard(realRows, __lbSortBy);

  // Топ-50.
  const top = merged.slice(0, LB_TOP_N);

  // Есть ли мой персонаж в топе?
  const myIndexInTop = top.findIndex(r => r.isMe);

  // Если меня нет в топе — ищем «лучшего моего» вне топ-50.
  let myOutOfTop = null;
  if (myIndexInTop === -1) {
    const myRows = merged.filter(r => r.isMe);
    if (myRows.length > 0) {
      // Мой лучший (первый в отсортированном массиве).
      const myBest = myRows[0];
      const myBestIndex = merged.indexOf(myBest);
      if (myBestIndex >= LB_TOP_N) {
        myOutOfTop = { row: myBest, rank: myBestIndex + 1 };
      }
    }
  }

  // ---- Рисуем ----
  const html = [];
  __lbShownRows = [];

  if (top.length === 0) {
    html.push(`<div class="leaderboard-empty">Пока никого нет в рейтинге.</div>`);
  } else {
    top.forEach((row, idx) => {
      html.push(buildLeaderboardRowHtml(row, idx + 1, __lbShownRows.push(row) - 1));
    });
  }

  // Если я вне топ-50 — рисуем разделитель и свою строку.
  if (myOutOfTop) {
    html.push(`<div class="leaderboard-divider">— ВАШ ПЕРСОНАЖ —</div>`);
    html.push(buildLeaderboardRowHtml(myOutOfTop.row, myOutOfTop.rank, __lbShownRows.push(myOutOfTop.row) - 1));
  }

  // v0.26: свой герой скрыт — объясняем почему его нет в списке
  const hiddenReason = getLeaderboardHiddenReason(state.player);
  if (hiddenReason) {
    html.push(`<div class="leaderboard-divider">— ВАШ ПЕРСОНАЖ —</div>`);
    html.push(`<div class="leaderboard-empty">${escapeHtml(state.player.name || 'Герой')} не участвует в рейтинге: ${hiddenReason}.</div>`);
  }

  list.innerHTML = html.join('');
}

// v0.25: строки, которые сейчас на экране — по индексу открываем «Осмотр героя».
let __lbShownRows = [];
function openLeaderboardInspect(idx) {
  if (typeof openHeroInspect === 'function') openHeroInspect(__lbShownRows[idx]);
}

// Одна строка HTML. idx — номер в __lbShownRows (клик → «Осмотр героя»).
function buildLeaderboardRowHtml(row, rank, idx) {
  const cls = ['leaderboard-row'];
  if (rank === 1) cls.push('rank-1');
  if (rank === 2) cls.push('rank-2');
  if (rank === 3) cls.push('rank-3');
  if (row.isMe) cls.push('me');

  // Строку пишет чужой браузер: раса и класс — только из справочника игры, уровень — число.
  const raceId = hasOwnKey(RACES, row.race_id) ? row.race_id : 'human';
  const classId = hasOwnKey(CLASSES, row.class_id) ? row.class_id : 'warrior';
  const icon = (typeof getRaceIcon === 'function')
    ? getRaceIcon(raceId, classId)
    : `img/races/${raceId}.webp`;

  // Названия расы и класса.
  const raceName = RACES[raceId].name;
  const className = CLASSES[classId].name;
  const level = Math.max(1, Math.floor(Number(row.level)) || 1);

  const name = escapeHtml(row.character_name || 'Безымянный');

  return `
    <div class="${cls.join(' ')} lb-clickable" onclick="openLeaderboardInspect(${idx})" title="Осмотреть героя">
      <div class="lb-rank">#${rank}</div>
      <div class="lb-race-icon" style="background-image:url('${icon}')"></div>
      <div>
        <div class="lb-name">${name}</div>
        <div class="lb-class">${raceName} · ${className}</div>
      </div>
      <div class="lb-col"><span class="lb-icon">⭐</span>${level}</div>
      <div class="lb-col"><span class="lb-icon">🪙</span>${formatNumber(row.gold || 0)}</div>
      <div class="lb-col"><span class="lb-icon">💀</span>${formatNumber(row.kills || 0)}</div>
    </div>
  `;
}

// ========================================================
//  ХЕЛПЕРЫ
// ========================================================

// Формат чисел: 12450 → «12 450».
function formatNumber(n) {
  const num = Number(n) || 0;
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Есть ли ключ в справочнике (без «constructor», «toString» и прочего из прототипа).
function hasOwnKey(dict, key) {
  return !!dict && typeof key === 'string' && Object.prototype.hasOwnProperty.call(dict, key);
}

// Экранирование HTML (имена могут содержать спец-символы).
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ========================================================
//  КНОПКА ОБНОВЛЕНИЯ
// ========================================================

function refreshLeaderboard() {
  const btn = document.getElementById('leaderboard-refresh-btn');
  if (btn) {
    btn.classList.add('loading');
    setTimeout(() => btn.classList.remove('loading'), 600);
  }
  // Принудительный пуш, потом перерисовка.
  cloudPushLeaderboard(true);
  renderLeaderboard();
}

// ========================================================
//  КЛИК ПО ФОНУ / ESC ЗАКРЫВАЕТ
// ========================================================

document.addEventListener('click', (e) => {
  const overlay = document.getElementById('leaderboard-overlay');
  if (!overlay || !overlay.classList.contains('active')) return;
  if (e.target === overlay) closeLeaderboard();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const overlay = document.getElementById('leaderboard-overlay');
  if (overlay && overlay.classList.contains('active')) closeLeaderboard();
});

// ========================================================
//  ПОКАЗ / СКРЫТИЕ КНОПКИ 🏆 В ГОРОДЕ
//  Кнопка видна только залогиненным (cloudIsReady() === true).
//  Вызывается из cloud.js и start-screen.js.
// ========================================================

function updateLeaderboardButtonVisibility() {
  const card = document.getElementById('city-card-leaderboard');
  if (!card) return;

  const canSee = (typeof cloudIsReady === 'function') && cloudIsReady();

  if (canSee) {
    card.style.display = '';
  } else {
    card.style.display = 'none';
  }
}