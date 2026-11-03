// ========================================================
//  СИСТЕМЫ: ЭНЦИКЛОПЕДИЯ (v0.30)
//  Раздел «Энциклопедия» во вкладке «Хроники».
//  + unlockLore(key) — герой узнал кусок статьи (данные: js/data/encyclopedia.js).
//  + chronicle.lore { ключ: время } — что узнано; chronicle.loreSeen { ключ: true } — что прочитано.
//    Непрочитанное — метка «новое» и красная точка на «Хрониках».
//  + Предметы — из SHOP_ITEMS: купил — открылась статья.
// ========================================================

let __loreOpen = null;   // открытая статья (id)

function loreState() {
  const c = state.player.chronicle;
  if (!c) return null;
  if (!c.lore) c.lore = {};
  if (!c.loreSeen) c.loreSeen = {};
  return c;
}
function knowsLore(key) {
  const c = state.player.chronicle;
  return !!(c && c.lore && c.lore[key]);
}

// Все статьи: и написанные, и предметы из лавки. { id, cat, title, kind, parts[] }
function getLoreArticles() {
  const list = Object.keys(LORE_ARTICLES).map(id => Object.assign({ id }, LORE_ARTICLES[id]));
  SHOP_ITEMS.forEach(it => list.push({ id: 'item.' + it.id, cat: 'items', title: it.name, kind: 'Товар Торговца', shop: it, parts: [{ key: 'item.' + it.id }] }));
  return list;
}
function getLoreArticle(id) {
  return getLoreArticles().find(a => a.id === id) || null;
}

// Герой узнал кусок статьи. silent — без всплывашки (миграция старых героев).
function unlockLore(key, silent) {
  const c = loreState();
  if (!c || c.lore[key]) return;
  const art = getLoreArticles().find(a => a.parts.some(p => p.key === key));
  if (!art) return;
  c.lore[key] = Date.now();
  if (!silent && typeof showToast === 'function') showToast('📖', `Энциклопедия: ${escChronicle(art.title)}`);
  updateChronicleDot();
  if (isChronicleOpen()) renderChronicle();
}

// Открыть статью целиком (все куски), всплывашка одна.
function unlockLoreArticle(id, silent) {
  const a = getLoreArticle(id);
  if (!a) return;
  a.parts.forEach((p, i) => unlockLore(p.key, silent || i > 0));
}

function loreHasNews() {
  const c = state.player.chronicle;
  if (!c || !c.lore) return false;
  return Object.keys(c.lore).some(k => !(c.loreSeen && c.loreSeen[k]));
}
function loreArticleIsNew(a) {
  const c = state.player.chronicle;
  return a.parts.some(p => knowsLore(p.key) && !(c.loreSeen && c.loreSeen[p.key]));
}

function openLoreArticle(id) {
  const a = getLoreArticle(id);
  if (!a || !knowsLore(a.parts[0].key)) return;
  __loreOpen = id;
  const c = loreState();
  a.parts.forEach(p => { if (knowsLore(p.key)) c.loreSeen[p.key] = true; });
  renderChronicle();
  updateChronicleDot();
}
function closeLoreArticle() {
  __loreOpen = null;
  renderChronicle();
}

// ---- Отрисовка раздела ----
function renderEncyclopedia(box) {
  const arts = getLoreArticles();
  let open = __loreOpen && getLoreArticle(__loreOpen);
  if (open && !knowsLore(open.parts[0].key)) open = null;

  let list = '';
  LORE_CATEGORIES.forEach(cat => {
    const inCat = arts.filter(a => a.cat === cat.id);
    const known = inCat.filter(a => knowsLore(a.parts[0].key));
    list += `<div class="lore-cat">${cat.name} · ${known.length} из ${inCat.length}</div>`;
    inCat.forEach(a => {
      if (!knowsLore(a.parts[0].key)) { list += `<div class="lore-item locked">???</div>`; return; }
      const active = open && open.id === a.id ? ' active' : '';
      const isNew = loreArticleIsNew(a) ? '<span class="lore-new">новое</span>' : '';
      list += `<div class="lore-item${active}" onclick="openLoreArticle('${a.id}')">${escChronicle(a.title)}${isNew}</div>`;
    });
  });

  const article = open ? renderLoreArticle(open) : `<div class="lore-empty">Выбери статью из списка.</div>`;
  box.innerHTML = `<div class="lore${open ? ' has-open' : ''}"><div class="lore-list">${list}</div><div class="lore-article">${article}</div></div>`;
}

function renderLoreArticle(a) {
  const knownParts = a.parts.filter(p => knowsLore(p.key)).length;
  let html = `<div class="lore-back" onclick="closeLoreArticle()">← К списку</div>`;
  html += `<div class="lore-head">`;
  if (a.shop && typeof SVG !== 'undefined' && SVG[a.shop.icon]) html += `<div class="lore-icon">${SVG[a.shop.icon]}</div>`;
  html += `<div><div class="lore-title">${escChronicle(a.title)}</div>`;
  html += `<div class="lore-kind">${escChronicle(a.kind)}${a.parts.length > 1 ? ` · открыто ${knownParts} из ${a.parts.length}` : ''}</div></div></div>`;

  if (a.shop) {
    const it = a.shop;
    const flavor = LORE_ITEM_FLAVOR[it.id];
    if (flavor) html += `<p class="lore-text">${chronicleTextHtml(flavor)}</p>`;
    html += `<div class="lore-stats">`;
    html += `<div><span>Действие</span>${escChronicle(it.effect)}</div>`;
    if (it.description) html += `<div><span>Описание</span>${escChronicle(it.description)}</div>`;
    if (it.usage) html += `<div><span>Применение</span>${escChronicle(it.usage)}</div>`;
    html += `<div><span>Где взять</span>Торговец в Андервуде — ${it.price} Оболов</div>`;
    html += `</div>`;
    return html;
  }

  a.parts.forEach(p => {
    if (!knowsLore(p.key)) {
      html += `<p class="lore-text locked">🔒 ${escChronicle(p.label || '')} — ещё не узнано</p>`;
      return;
    }
    const label = p.label ? `<span class="lore-label">${escChronicle(p.label)} · </span>` : '';
    html += `<p class="lore-text">${label}${chronicleTextHtml(p.text)}</p>`;
  });
  return html;
}
