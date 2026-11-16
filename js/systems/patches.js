// ========================================================
//  СИСТЕМЫ: ЗАКЛАДКИ ПАТЧЕЙ
//  Правый верхний угол — столбик закладок с версиями.
//  При наведении/тапе — выезжает панель с изменениями.
//
//  Десктоп: hover на закладке → панель выезжает СЛЕВА.
//  Телефон: тап на закладке → панель на ВЕСЬ ЭКРАН.
//
//  Данные берутся из CHANGELOG (js/data/changelog.js).
//
//  НОВОЕ (v0.13p): ГРУППИРОВКА.
//  Если версий больше 10:
//    - последние 10 показываем одиночно (как было),
//    - все старшие — одной группой «vX – vY»,
//    - при наведении на группу — всплывает список
//      внутренних версий справа (или слева, если нет места),
//    - при наведении на версию в списке — панель изменений
//      выезжает как обычно.
//
//  НОВОЕ (v0.14): ЗАГОЛОВОК ПАТЧА.
//  Если у записи есть поле `title` — оно показывается
//  большой строкой в панели (над списком изменений).
// ========================================================

// Текущая открытая версия (или null — ничего не открыто).
let __patchOpenVersion = null;

// Текущая открытая группа (или null).
let __patchOpenGroup = null;

// Сколько последних версий показывать одиночно, если есть группа.
const PATCH_VISIBLE_RECENT = 10;

// --------------------------------------------------------
//  ОПРЕДЕЛЕНИЕ: МОБИЛЬНЫЙ ЛИ РЕЖИМ
// --------------------------------------------------------
function isPatchMobile() {
  // v0.36.4: телефон лёжа — тоже «мобильная» раскладка (тот же запрос, что в patches.css)
  return window.matchMedia('(max-width: 700px), (max-height: 500px) and (orientation: landscape)').matches;
}

// --------------------------------------------------------
//  РАЗБИВКА CHANGELOG НА "НЕДАВНИЕ" И "ГРУППУ"
// --------------------------------------------------------
function getPatchLayout() {
  if (typeof CHANGELOG === 'undefined' || !CHANGELOG.length) {
    return { recent: [], group: null };
  }

  if (CHANGELOG.length <= PATCH_VISIBLE_RECENT) {
    return { recent: CHANGELOG.slice(), group: null };
  }

  const recent = CHANGELOG.slice(0, PATCH_VISIBLE_RECENT);
  const group = CHANGELOG.slice(PATCH_VISIBLE_RECENT);

  return { recent, group };
}

// --------------------------------------------------------
//  РЕНДЕР ЗАКЛАДОК
// --------------------------------------------------------
function renderPatchTabs() {
  const container = document.getElementById('patch-tabs');
  if (!container) return;
  if (typeof CHANGELOG === 'undefined' || !CHANGELOG.length) return;

  container.innerHTML = '';

  const layout = getPatchLayout();

  layout.recent.forEach((entry, idx) => {
    const tab = buildPatchTab(entry, idx === 0);
    container.appendChild(tab);
  });

  if (layout.group && layout.group.length > 0) {
    const groupTab = buildPatchGroupTab(layout.group);
    container.appendChild(groupTab);
  }
}

// Собрать одну одиночную закладку.
function buildPatchTab(entry, isLatest) {
  const tab = document.createElement('div');
  tab.className = 'patch-tab';
  if (isLatest) tab.classList.add('patch-tab-latest');
  tab.dataset.version = entry.version;
  tab.innerHTML = `<span class="pt-version">${entry.version}</span><span class="pt-date">${entry.date}</span>`;

  if (isPatchMobile()) {
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      if (__patchOpenVersion === entry.version) {
        closePatchPanel();
      } else {
        closePatchGroup();
        openPatchPanel(entry.version);
      }
    });
  } else {
    tab.addEventListener('mouseenter', () => {
      closePatchGroup();
      openPatchPanel(entry.version);
    });
    tab.addEventListener('mouseleave', () => {
      setTimeout(() => {
        if (!isPatchMobile() && __patchOpenVersion === entry.version) {
          const panel = document.getElementById('patch-panel');
          if (panel && panel.matches(':hover')) return;
          closePatchPanel();
        }
      }, 150);
    });
  }

  return tab;
}

// Собрать закладку-группу.
function buildPatchGroupTab(groupEntries) {
  const first = groupEntries[groupEntries.length - 1]; // самая старая
  const last  = groupEntries[0];                        // самая новая из группы

  const tab = document.createElement('div');
  tab.className = 'patch-tab patch-tab-group';
  tab.dataset.group = 'old';
  tab.innerHTML = `
    <span class="pt-version">${first.version} – ${last.version}</span>
    <span class="pt-date">${groupEntries.length} патчей</span>
    <span class="pt-arrow">▸</span>
  `;

  const list = document.createElement('div');
  list.className = 'patch-group-list';
  list.dataset.groupList = 'old';
  // v0.36.4: старых версий уже 35 — столбиком они уходили за край экрана.
  // Теперь это сетка «чипов» со своей прокруткой и заголовком.
  const head = document.createElement('div');
  head.className = 'patch-group-head';
  head.textContent = `Старые версии · ${groupEntries.length}`;
  list.appendChild(head);
  const grid = document.createElement('div');
  grid.className = 'patch-group-grid';
  list.appendChild(grid);

  groupEntries.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'patch-group-item';
    item.dataset.version = entry.version;
    item.innerHTML = `<span class="pt-version">${entry.version}</span><span class="pt-date">${entry.date}</span>`;

    if (isPatchMobile()) {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        if (__patchOpenVersion === entry.version) {
          closePatchPanel();
        } else {
          openPatchPanel(entry.version);
        }
      });
    } else {
      item.addEventListener('mouseenter', () => {
        openPatchPanel(entry.version);
      });
    }

    grid.appendChild(item);
  });
  // Тап по заголовку/пустому месту списка не должен закрывать группу (клик по закладке-группе — это toggle).
  list.addEventListener('click', (e) => e.stopPropagation());

  tab.appendChild(list);

  if (isPatchMobile()) {
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      if (__patchOpenGroup === 'old') {
        closePatchGroup();
      } else {
        closePatchPanel();
        openPatchGroup();
      }
    });
  } else {
    tab.addEventListener('mouseenter', () => {
      openPatchGroup();
    });
    tab.addEventListener('mouseleave', () => {
      setTimeout(() => {
        if (isPatchMobile()) return;
        const group = document.getElementById('patch-tabs');
        const groupTab = group ? group.querySelector('.patch-tab-group') : null;
        const list = group ? group.querySelector('.patch-group-list') : null;
        if (groupTab && groupTab.matches(':hover')) return;
        if (list && list.matches(':hover')) return;
        const panel = document.getElementById('patch-panel');
        if (panel && panel.matches(':hover')) return;   // читаем старый патч — список не прячем
        closePatchGroup();
      }, 150);
    });
  }

  return tab;
}

// --------------------------------------------------------
//  ОТКРЫТЬ/ЗАКРЫТЬ СПИСОК ВНУТРИ ГРУППЫ
// --------------------------------------------------------
function openPatchGroup() {
  if (__patchOpenGroup === 'old') return;
  __patchOpenGroup = 'old';

  const list = document.querySelector('.patch-group-list');
  if (list) {
    list.classList.add('visible');
    positionPatchGroupList(list);
  }
}

// v0.36.4: список держим целиком на экране.
// Десктоп — слева от столбика закладок, низом к закладке-группе (мышь ведём прямо влево),
// но не выше верхнего края. Телефон — под рядом чипов, на всю ширину.
function positionPatchGroupList(list) {
  const tab = list.closest('.patch-tab-group');
  const container = document.getElementById('patch-tabs');
  if (!tab || !container) return;
  const pad = 10;
  list.style.top = list.style.right = list.style.maxHeight = '';
  if (isPatchMobile()) {
    // v0.37: закладки теперь внизу страницы — места под ними может не быть, тогда список над закладкой
    const r = tab.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 6 - pad;
    const above = r.top - 6 - pad;
    if (below >= 220 || below >= above) {
      list.style.top = (r.bottom + 6) + 'px';
      list.style.maxHeight = Math.max(160, below) + 'px';
    } else {
      list.style.maxHeight = Math.max(160, above) + 'px';
      list.style.top = Math.max(pad, r.top - 6 - list.offsetHeight) + 'px';
    }
    return;
  }
  const r = tab.getBoundingClientRect();
  // v0.37: экран до входа — закладки строкой по низу, список над своей закладкой
  const startScreen = document.getElementById('start-screen');
  if (startScreen && startScreen.classList.contains('launcher')) {
    list.style.right = Math.max(pad, window.innerWidth - r.right) + 'px';
    list.style.maxHeight = Math.max(160, r.top - 6 - pad) + 'px';
    list.style.top = Math.max(pad, r.top - 6 - list.offsetHeight) + 'px';
    return;
  }
  list.style.right = (window.innerWidth - r.left + 6) + 'px';
  list.style.maxHeight = (window.innerHeight - pad * 2) + 'px';
  const h = list.offsetHeight;
  list.style.top = Math.max(pad, Math.min(r.bottom - h, window.innerHeight - pad - h)) + 'px';
}

function closePatchGroup() {
  __patchOpenGroup = null;
  const list = document.querySelector('.patch-group-list');
  if (list) list.classList.remove('visible');
}

// --------------------------------------------------------
//  ОТКРЫТЬ ПАНЕЛЬ ПАТЧА
//  НОВОЕ (v0.14): если у записи есть title — показываем его.
// --------------------------------------------------------
function openPatchPanel(version) {
  const container = document.getElementById('patch-tabs');
  if (!container) return;

  const entry = CHANGELOG.find(c => c.version === version);
  if (!entry) return;

  __patchOpenVersion = version;

  container.querySelectorAll('.patch-tab, .patch-group-item').forEach(t => {
    t.classList.toggle('active', t.dataset.version === version);
  });

  let panel = document.getElementById('patch-panel');
  if (panel) panel.remove();

  panel = document.createElement('div');
  panel.className = 'patch-panel';
  panel.id = 'patch-panel';

  const changesHtml = entry.changes.map(c => `
    <div class="patch-change">
      <span class="pc-icon">${c.icon || '•'}</span>
      <span class="pc-text">${c.text}</span>
    </div>
  `).join('');

  const mobile = isPatchMobile();

  // ---- Заголовок патча (если есть title) ----
  const titleHtml = entry.title
    ? `<div class="patch-panel-hero">${entry.title}</div>`
    : '';

  panel.innerHTML = `
    <div class="patch-panel-header">
      <div class="patch-panel-title">${entry.version}</div>
      <div class="patch-panel-date">${entry.date}</div>
      ${mobile ? '<button class="patch-panel-close" onclick="closePatchPanel()">×</button>' : ''}
    </div>
    ${titleHtml}
    <div class="patch-panel-body">
      ${changesHtml}
    </div>
  `;

  if (!mobile) {
    panel.addEventListener('mouseleave', () => {
      setTimeout(() => {
        const tab = container.querySelector(`.patch-tab[data-version="${version}"], .patch-group-item[data-version="${version}"]`);
        if (tab && tab.matches(':hover')) return;
        closePatchPanel();
      }, 150);
    });
  }

  container.appendChild(panel);

  const groupList = container.querySelector('.patch-group-list.visible');
  const fromGroup = !!(groupList && groupList.querySelector(`.patch-group-item[data-version="${version}"]`));

  // v0.37: экран до входа — версии строкой по низу страницы, панель выезжает НАД строкой:
  // над своей закладкой (не за краями окна) или левее списка старых версий, низом к нему.
  const startScreen = document.getElementById('start-screen');
  if (!mobile && startScreen && startScreen.classList.contains('launcher')) {
    const pad = 10;
    panel.style.top = 'auto';
    if (fromGroup) {
      const lr = groupList.getBoundingClientRect();
      panel.style.left = 'auto';
      panel.style.right = (window.innerWidth - lr.left + 6) + 'px';
      panel.style.bottom = Math.max(pad, window.innerHeight - lr.bottom) + 'px';
      panel.style.maxHeight = Math.max(200, lr.bottom - pad) + 'px';
    } else {
      const tab = container.querySelector(`.patch-tab[data-version="${version}"]`);
      const tr = tab ? tab.getBoundingClientRect() : container.getBoundingClientRect();
      const w = panel.offsetWidth;
      const left = Math.max(pad, Math.min(tr.left + tr.width / 2 - w / 2, window.innerWidth - w - pad));
      panel.style.right = 'auto';
      panel.style.left = left + 'px';
      panel.style.bottom = (window.innerHeight - tr.top + 8) + 'px';
      panel.style.maxHeight = Math.max(200, tr.top - 8 - pad) + 'px';
    }
    requestAnimationFrame(() => panel.classList.add('visible'));
    return;
  }

  // v0.36.4: старый патч из открытого списка — панель встаёт левее списка, а не поверх него.
  if (!mobile && fromGroup) {
    const lr = groupList.getBoundingClientRect();
    panel.style.right = (window.innerWidth - lr.left + 6) + 'px';
    const top = Math.max(10, Math.min(lr.top, window.innerHeight * 0.2));
    panel.style.top = top + 'px';
    panel.style.maxHeight = (window.innerHeight - top - 10) + 'px';
  }

  requestAnimationFrame(() => panel.classList.add('visible'));
}

// --------------------------------------------------------
//  ЗАКРЫТЬ ПАНЕЛЬ
// --------------------------------------------------------
function closePatchPanel() {
  __patchOpenVersion = null;
  const container = document.getElementById('patch-tabs');
  if (container) {
    container.querySelectorAll('.patch-tab, .patch-group-item').forEach(t => t.classList.remove('active'));
  }
  const panel = document.getElementById('patch-panel');
  if (panel) {
    panel.classList.remove('visible');
    setTimeout(() => panel.remove(), 200);
  }
}

// --------------------------------------------------------
//  КЛИК МИМО НА ТЕЛЕФОНЕ — ЗАКРЫТЬ ВСЁ
// --------------------------------------------------------
document.addEventListener('click', (e) => {
  if (!isPatchMobile()) return;
  if (!__patchOpenVersion && !__patchOpenGroup) return;
  const container = document.getElementById('patch-tabs');
  if (container && container.contains(e.target)) return;
  closePatchPanel();
  closePatchGroup();
});

// --------------------------------------------------------
//  ПРИ ПЕРЕХОДЕ НА ДЕСКТОП/ТЕЛЕФОН — ЗАКРЫТЬ ВСЁ
// --------------------------------------------------------
window.addEventListener('resize', () => {
  if (__patchOpenVersion || __patchOpenGroup) {
    closePatchPanel();
    closePatchGroup();
    setTimeout(() => renderPatchTabs(), 50);
  }
});