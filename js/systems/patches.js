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
  return window.matchMedia('(max-width: 700px)').matches;
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

    list.appendChild(item);
  });

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
  if (list) list.classList.add('visible');
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