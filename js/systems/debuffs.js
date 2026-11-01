// ========================================================
//  СИСТЕМЫ: УНИВЕРСАЛЬНЫЕ ДЕБАФФЫ
//  Единая система дебаффов для монстра и игрока.
//
//  Структура: state.battle.debuffs = { monsters: {}, player: {} }
//
//  НОВОЕ (v0.11, групповые бои):
//  + Дебаффы монстров хранятся ПО ИНДЕКСУ моба:
//    state.battle.debuffs.monsters = {
//      0: { burn: {...}, bleed: {...} },
//      1: { freeze: {...} },
//      2: {},
//    }
//  + Все функции addDebuff / getDebuff / removeDebuff
//    принимают индекс моба (для target='monster').
//  + Обратная совместимость: если индекс не передан —
//    работает с текущим мобом (getCurrentMonster().index).
//
//  ШАГ 1 (уникальность оружия):
//  + Тултипы bleed и wound уточнены под мечи и топоры.
//
//  НОВОЕ (v0.12):
//  + Новый дебафф greedMark — «Метка Жадности» (гном).
//    Накладывается активным навыком dwarfGreed (воин) /
//    dwarfGreedMagic (маг). Если монстр умирает с меткой —
//    дроп или золото ×1.25 (зависит от поля type в объекте метки).
//  + Новый дебафф web — «Паутина» (Шелкопряд).
//    Накладывается на игрока при ударе Шелкопряда.
//    Эффект: −50% к скорости ATB игрока на 2 хода.
//    Поле atbMult хранится в объекте дебаффа.
// ========================================================

// Описание всех типов дебаффов.
const DEBUFF_DEFS = {
  burn: {
    icon: '🔥',
    name: 'Горение',
    cssClass: 'debuff-burn',
    tooltip: (d) => `Горение · ${d.damage || 0} dmg/ход · осталось ${d.turnsLeft} ход.`,
  },
  bleed: {
    icon: '🩸',
    name: 'Кровотечение',
    cssClass: 'debuff-bleed',
    tooltip: (d) => `Кровотечение · ${d.damage || 0} dmg/ход · осталось ${d.turnsLeft} ход.`,
  },
  wound: {
    icon: '🪓',
    name: 'Зарубка',
    cssClass: 'debuff-wound',
    displayCount: (d) => d.stacks || 1,
    tooltip: (d) => {
      const stacks = d.stacks || 0;
      const bonus = stacks * 5;
      return `Зарубка ×${stacks} · +${bonus}% урона · осталось ${d.turnsLeft} ход.`;
    },
  },
  freeze: {
    icon: '❄',
    name: 'Заморозка',
    cssClass: 'debuff-freeze',
    tooltip: (d) => `Заморозка · пропустит ${d.turnsLeft} удар.`,
  },
  // v0.19.1: Паралич (Разряд дроу) и невосприимчивость к нему
  paralysis: {
    icon: '⚡',
    name: 'Паралич',
    cssClass: 'debuff-paralysis',
    tooltip: () => `Паралич · пропустит следующий удар.`,
  },
  resonance: {
    icon: '✦',
    name: 'Стихийный резонанс',
    cssClass: 'debuff-rune',
    displayCount: () => '',
    tooltip: () => `Стихийный резонанс · следующий Огненный шар или Ледяная стрела — без маны.`,
  },
  potionRegen: {
    icon: '🧪',
    name: 'Зелье лечения',
    cssClass: 'debuff-regen',
    displayCount: (d) => d.turnsLeft || 0,
    tooltip: (d) => `Зелье лечения · +${d.perTurn || 10} HP на каждом вашем ходу, осталось ${d.turnsLeft || 0}.`,
  },
  guard: {
    icon: '🛡',
    name: 'Защита',
    cssClass: 'debuff-guard',
    displayCount: () => '',
    tooltip: () => `Защита · −40% урона от ударов до следующего хода.`,
  },
  stormCharge: {
    icon: '⚡',
    name: 'Заряд молнии',
    cssClass: 'debuff-paralysis',
    displayCount: () => '',
    tooltip: () => `Заряд молнии · следующий Разряд гарантированно парализует цель.`,
  },
  // v0.23: перезарядка пассивки «Скорость молнии» (дроу-воин)
  lsCooldown: {
    icon: '⏳',
    name: 'Скорость молнии: перезарядка',
    cssClass: 'debuff-paraimmune',
    tooltip: (d) => `Скорость молнии перезаряжается · ещё ${d.turnsLeft} ход.`,
  },
  paraImmune: {
    icon: '🛡',
    name: 'Невосприимчив к параличу',
    cssClass: 'debuff-paraimmune',
    tooltip: (d) => `Невосприимчив к параличу · ещё ${d.turnsLeft} ход.`,
  },
  stun: {
    icon: '💫',
    name: 'Оглушение',
    cssClass: 'debuff-stun',
    tooltip: (d) => `Оглушение · пропустит ${d.turnsLeft} удар.`,
  },
  poison: {
    icon: '☠',
    name: 'Яд',
    cssClass: 'debuff-poison',
    tooltip: (d) => `Яд ур.${d.level || 1} · ${d.damage || 0} dmg/ход · осталось ${d.turnsLeft} ход.`,
  },
  confused: {
    icon: '🎯',
    name: 'Сбит с толку',
    cssClass: 'debuff-confused',
    tooltip: (d) => `Сбит с толку · уворот −${d.evasionReduction || 0}% · осталось ${d.turnsLeft} ход.`,
  },

  // ---- v0.12: МЕТКА ЖАДНОСТИ (гном) ----
  greedMark: {
    icon: '💰',
    name: 'Метка Жадности',
    cssClass: 'debuff-greed',
    // v0.19.1: до 5 меток
    displayCount: (d) => {
      const n = (Array.isArray(d.marks) && d.marks.length) || 1;
      return n > 1 ? `${d.turnsLeft} ×${n}` : d.turnsLeft;
    },
    tooltip: (d) => {
      const n = (Array.isArray(d.marks) && d.marks.length) || 1;
      const what = (d.type === 'mage') ? 'Оболы' : 'Дроп';
      return `Метка Жадности ×${n}/5 · при убийстве: ${what} +${n * 25}%, опыт +${n * 10}% · осталось ${d.turnsLeft} ход.`;
    },
  },

  // ---- v0.19: массовые навыки ----
  rot: {
    icon: '☠',
    name: 'Гниение',
    cssClass: 'debuff-rot',
    // v0.19.1: до 2 слоёв (каждый со своим таймером), Гнев усиливает урон
    displayCount: (d) => {
      const L = (d.layers && d.layers.length) || 1;
      const t = d.layers ? Math.max(...d.layers.map(x => x.turnsLeft || 0)) : (d.turnsLeft || 0);
      return L > 1 ? `${t} ×${L}` : t;
    },
    tooltip: (d) => {
      const L = d.layers || [{ turnsLeft: d.turnsLeft, damage: d.damage }];
      const w = (typeof getRotWrathMult === 'function') ? getRotWrathMult() : 1;
      const dmg = Math.floor(L.reduce((s, x) => s + (x.damage || 0), 0) * w);
      const wr = w > 1 ? ` (Гнев +${Math.round((w - 1) * 100)}%)` : '';
      return `Гниение · слоёв: ${L.length}/2 · ${dmg} dmg/ход${wr} · осталось ${Math.max(...L.map(x => x.turnsLeft || 0))} ход. Перескакивает при смерти.`;
    },
  },
  entangle: {
    icon: '🌿',
    name: 'Шипы',
    cssClass: 'debuff-entangle',
    tooltip: (d) => `Опутан шипами · точность −${d.accReduction || 0}% · осталось ${d.turnsLeft} ход.`,
  },
  rune: {
    icon: '✶',
    name: 'Руна вьюги',
    cssClass: 'debuff-rune',
    tooltip: () => `Руна вьюги · буран обрушится на следующий ход.`,
  },

  // ---- v0.12: ПАУТИНА (Шелкопряд) ----
  web: {
    icon: '🕸',
    name: 'Паутина',
    cssClass: 'debuff-web',
    tooltip: (d) => {
      const pct = Math.round((1 - (d.atbMult || 0.5)) * 100);
      return `Паутина · −${pct}% скорость ATB · осталось ${d.turnsLeft} ход.`;
    },
  },
};

// --------------------------------------------------------
//  ХЕЛПЕР: определить индекс моба
//  Если index === undefined / null / -1 → берём текущего.
//  Возвращает число или null.
// --------------------------------------------------------
function resolveMonsterIndex(index) {
  if (index !== undefined && index !== null && index >= 0) return index;
  const cur = (typeof getCurrentMonster === 'function') ? getCurrentMonster() : null;
  return cur ? cur.index : null;
}

// --------------------------------------------------------
//  ДОБАВИТЬ / ОБНОВИТЬ ДЕБАФФ
//  target: 'monster' | 'player'
//  id:     'burn' | 'bleed' | 'web' | ...
//  index:  индекс моба (только для target='monster');
//          если не передан — берётся текущий.
//  data:   { turnsLeft, stacks?, damage?, level?, evasionReduction?, type?, atbMult? }
// --------------------------------------------------------
function addDebuff(target, id, index, data) {
  // Обратная совместимость: если 3-й аргумент — объект,
  // значит index не передан. Сдвигаем.
  if (typeof index === 'object' && index !== null) {
    data = index;
    index = undefined;
  }

  if (!state.battle.debuffs) state.battle.debuffs = { monsters: {}, player: {} };
  if (!state.battle.debuffs.monsters) state.battle.debuffs.monsters = {};
  if (!state.battle.debuffs.player) state.battle.debuffs.player = {};

  if (target === 'player') {
    state.battle.debuffs.player[id] = { ...data };
    renderDebuffBar('player');
    return;
  }

  // target === 'monster'
  const idx = resolveMonsterIndex(index);
  if (idx === null) return;   // нет текущего моба — не накладываем

  if (!state.battle.debuffs.monsters[idx]) state.battle.debuffs.monsters[idx] = {};
  state.battle.debuffs.monsters[idx][id] = { ...data };

  renderDebuffBar('monster');
}

// --------------------------------------------------------
//  СНЯТЬ ДЕБАФФ
// --------------------------------------------------------
function removeDebuff(target, id, index) {
  if (!state.battle.debuffs) return;

  if (target === 'player') {
    if (state.battle.debuffs.player) delete state.battle.debuffs.player[id];
    renderDebuffBar('player');
    return;
  }

  const idx = resolveMonsterIndex(index);
  if (idx === null) return;

  if (state.battle.debuffs.monsters && state.battle.debuffs.monsters[idx]) {
    delete state.battle.debuffs.monsters[idx][id];
  }
  renderDebuffBar('monster');
}

// --------------------------------------------------------
//  ПРОЧИТАТЬ ДЕБАФФ (или null)
// --------------------------------------------------------
function getDebuff(target, id, index) {
  if (!state.battle.debuffs) return null;

  if (target === 'player') {
    if (!state.battle.debuffs.player) return null;
    return state.battle.debuffs.player[id] || null;
  }

  const idx = resolveMonsterIndex(index);
  if (idx === null) return null;
  if (!state.battle.debuffs.monsters || !state.battle.debuffs.monsters[idx]) return null;
  return state.battle.debuffs.monsters[idx][id] || null;
}

// --------------------------------------------------------
//  ТИК ДЕБАФФОВ (уменьшение turnsLeft)
// --------------------------------------------------------
function tickDebuffs(target, index) {
  if (target === 'player') {
    if (!state.battle.debuffs || !state.battle.debuffs.player) return;
    const list = state.battle.debuffs.player;
    Object.keys(list).forEach(id => {
      const d = list[id];
      if (!d) return;
      d.turnsLeft = (d.turnsLeft || 0) - 1;
      if (d.turnsLeft <= 0) delete list[id];
    });
    renderDebuffBar('player');
    return;
  }

  const idx = resolveMonsterIndex(index);
  if (idx === null) return;
  if (!state.battle.debuffs.monsters || !state.battle.debuffs.monsters[idx]) return;

  const list = state.battle.debuffs.monsters[idx];
  Object.keys(list).forEach(id => {
    const d = list[id];
    if (!d) return;
    d.turnsLeft = (d.turnsLeft || 0) - 1;
    if (d.turnsLeft <= 0) delete list[id];
  });
  renderDebuffBar('monster');
}

// --------------------------------------------------------
//  ПОЛНАЯ ОЧИСТКА ДЕБАФФОВ
// --------------------------------------------------------
function clearAllDebuffs() {
  if (!state.battle.debuffs) {
    state.battle.debuffs = { monsters: {}, player: {} };
  } else {
    state.battle.debuffs.monsters = {};
    state.battle.debuffs.player = {};
  }
  renderDebuffBar('monster');
  renderDebuffBar('player');
}

// --------------------------------------------------------
//  ОЧИСТКА ДЕБАФФОВ КОНКРЕТНОГО МОБА (v0.11)
//  Вызывается при смерти моба.
// --------------------------------------------------------
function clearMonsterDebuffs(index) {
  if (!state.battle.debuffs || !state.battle.debuffs.monsters) return;
  if (index === undefined || index === null) return;
  delete state.battle.debuffs.monsters[index];
  renderDebuffBar('monster');
}

// --------------------------------------------------------
//  РЕНДЕР ДЕБАФФ-БАРА
//  target: 'monster' | 'player'
//  Для 'monster' — берёт дебаффы ТЕКУЩЕГО моба.
// --------------------------------------------------------
function renderDebuffBar(target) {
  const barId = target === 'monster' ? 'monster-debuff-bar' : 'player-debuff-bar';
  const bar = document.getElementById(barId);
  if (!bar) return;

  let list = {};

  if (target === 'player') {
    list = (state.battle.debuffs && state.battle.debuffs.player) || {};
  } else {
    const cur = (typeof getCurrentMonster === 'function') ? getCurrentMonster() : null;
    if (cur && state.battle.debuffs && state.battle.debuffs.monsters) {
      list = state.battle.debuffs.monsters[cur.index] || {};
    }
  }

  const ids = Object.keys(list);

  if (ids.length === 0) {
    if (bar.innerHTML) bar.innerHTML = '';
    bar.dataset.ids = '';
    return;
  }

  // v0.19.1: бар перерисовывается на каждом обновлении боя (много раз в секунду).
  // Если набор дебаффов тот же — меняем только цифры, не пересоздаём значки
  // (иначе анимация появления запускалась заново и значки «дёргались»).
  const sig = ids.join(',');
  if (bar.dataset.ids === sig && bar.children.length === ids.length) {
    ids.forEach((id, i) => {
      const def = DEBUFF_DEFS[id];
      const d = list[id];
      if (!def) return;
      const count = typeof def.displayCount === 'function' ? def.displayCount(d) : (d.turnsLeft || 0);
      const el = bar.children[i].querySelector('.dc-count');
      if (el && el.textContent !== String(count)) el.textContent = count;
    });
    return;
  }
  bar.dataset.ids = sig;

  bar.innerHTML = ids.map(id => {
    const d = list[id];
    const def = DEBUFF_DEFS[id];
    if (!def) return '';

    let count;
    if (typeof def.displayCount === 'function') {
      count = def.displayCount(d);
    } else {
      count = d.turnsLeft || 0;
    }

    return `<div class="debuff-chip ${def.cssClass}" onmouseenter="showDebuffTooltip(event, '${target}', '${id}')" onmouseleave="hideTooltip()">
      <span class="dc-icon">${def.icon}</span>
      <span class="dc-count">${count}</span>
    </div>`;
  }).join('');
}

// --------------------------------------------------------
//  ТУЛТИП ДЕБАФФА
// --------------------------------------------------------
function showDebuffTooltip(e, target, id) {
  const cur = (typeof getCurrentMonster === 'function') ? getCurrentMonster() : null;
  const idx = (target === 'monster' && cur) ? cur.index : undefined;
  const d = getDebuff(target, id, idx);
  if (!d) return;
  const def = DEBUFF_DEFS[id];
  if (!def) return;

  const tt = document.getElementById('item-tooltip');
  if (!tt) return;

  const text = def.tooltip ? def.tooltip(d) : def.name;
  const lines = `<div class="tt-name">${def.icon} ${def.name}</div><div class="tt-line stat">${text}</div>`;

  tt.innerHTML = lines;
  tt.style.display = 'block';
  tt.style.left = Math.min(window.innerWidth - 300, e.clientX + 15) + 'px';
  tt.style.top = Math.min(window.innerHeight - 100, e.clientY + 15) + 'px';

  if (typeof resetTooltipTimer === 'function') resetTooltipTimer();
}