// ========================================================
//  СИСТЕМЫ: ЭНЦИКЛОПЕДИЯ (v0.30)
//  Раздел «Энциклопедия» во вкладке «Хроники».
//  + unlockLore(key) — герой узнал кусок статьи (данные: js/data/encyclopedia.js).
//  + chronicle.lore { ключ: время } — что узнано; chronicle.loreSeen { ключ: true } — что прочитано.
//    Непрочитанное — метка «новое» и красная точка на «Хрониках».
//  + Предметы — из SHOP_ITEMS: купил — открылась статья.
//  + v0.32: Усиления — из GUILD_BUFFS / TAVERN_BUFFS / RECIPES.consumables (еда):
//    наложил баф или съел блюдо впервые — открылась статья (ключи 'buff.<id>' / 'food.<id>').
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
  Object.values(GUILD_BUFFS).forEach(b => list.push(loreBuffArticle('guild', b)));
  Object.values(TAVERN_BUFFS).forEach(b => list.push(loreBuffArticle('tavern', b)));
  RECIPES.consumables.forEach(r => { if (r.result.type === 'food') list.push(loreFoodArticle(r)); });
  return list;
}

// ---- v0.32: Усиления ----
function loreBuffArticle(kind, b) {
  const guild = kind === 'guild';
  return {
    id: 'buff.' + b.id, cat: 'buffs', order: guild ? 1 : 2, title: b.name,
    kind: guild ? 'Чары Гильдии магов' : 'Таверна «Козье вымя»', icon: b.iconPng,
    parts: [{ key: 'buff.' + b.id, text: LORE_BUFF_FLAVOR[b.id] || b.desc, rows: loreBuffRows(kind, b) }],
  };
}

function loreBuffRows(kind, b) {
  const rows = [];
  const pct = v => (v > 0 ? '+' : '−') + Math.abs(v) + '%';
  if (kind === 'tavern') {
    if (b.effect === 'xpPercent') rows.push(['Опыт', `+${b.value}% к получаемому`]);
    if (b.effect === 'profPercent') rows.push(['Владение', `+${b.value}% шанс бонусного опыта за удар`]);
  } else {
    const e = b.effects || {};
    if (e.pAtkPercent) rows.push(['Физ. атака', pct(e.pAtkPercent)]);
    if (e.mAtkPercent) rows.push(['Маг. атака', pct(e.mAtkPercent)]);
    if (e.pDefPercent) rows.push(['Физ. защита', pct(e.pDefPercent)]);
    if (e.mDefPercent) rows.push(['Маг. защита', pct(e.mDefPercent)]);
    if (e.atbPercent) rows.push([b.id === 'eloquence' ? 'Скорость каста' : 'Скорость ATB', pct(e.atbPercent)]);
    if (e.accuracyFlat) rows.push(['Точность', '+' + e.accuracyFlat]);
    if (e.blockFlat) rows.push(['Шанс блока', `+${e.blockFlat}% — только со щитом`]);
    if (b.packMode === 'quiet') {
      rows.push(['Стаи', 'меньше на старте']);
      rows.push(['Подмога', `почти не приходит (×${PACK_BUFF_MODS.quiet.reinforceMult})`]);
      rows.push(['Стайный бонус', 'меньше — стаи мельче']);
    } else if (b.packMode === 'provoke') {
      rows.push(['Стаи', 'больше на старте']);
      rows.push(['Подмога', `сбегается (×${PACK_BUFF_MODS.provoke.reinforceMult})`]);
      rows.push(['Стайный бонус', `дроп до +${PACK_DROP_MAX}%, Оболы до +${PACK_GOLD_MAX}%`]);
    }
    if (b.mageOnly) rows.push(['Кому', 'только магам']);
    if (b.packRival) rows.push(['Не вместе с', `«${GUILD_BUFFS[b.packRival].name}»: покупка одного снимает другой`]);
  }
  const price = kind === 'tavern' ? getTavernBuffPrice() : b.price;
  rows.push(['Действие', `${buffShopDur(b.duration)} за ${buffShopNum(price)} Оболов, время складывается до ${MAX_BUFF_DURATION / 3600} ч`]);
  rows.push(['Где взять', kind === 'tavern' ? 'Таверна «Козье вымя», Андервуд' : 'Гильдия магов, Андервуд']);
  rows.push(['При гибели', 'спадает']);
  return rows;
}

function loreFoodArticle(r) {
  const dish = r.result.food && r.result.food.dish && DISHES[r.result.food.dish];
  const rows = [];
  // v0.35.1: блюдо — только бонус; еда — сытость своего вида (FOOD_KINDS)
  if (dish) {
    rows.push(['Бонус', `${dish.text} на ${buffShopDur(DISH_DURATION)}`]);
    rows.push(['Сытость', 'не даёт — только бонус']);
    rows.push(['Одно за раз', 'другое блюдо заменяет бонус, то же — продлевает']);
  } else {
    const k = FOOD_KINDS[getFoodKindId(r.result)];
    rows.push(['Сытость', `${foodKindText(k)} на ${buffShopDur(getFoodDuration(r.result))}`]);
    rows.push(['Одна за раз', 'та же еда продлевает, другая заменяет — остаток прежней пропадает']);
  }
  rows.push(['Где взять', `Кузница, «Расходники»: ${r.materials.map(m => `${m.name} ×${m.qty}`).join(', ')} и ${buffShopNum(r.price)} Оболов`]);
  rows.push(['При гибели', dish ? 'сытость и бонус пропадают' : 'сытость пропадает']);
  return {
    id: 'food.' + r.id, cat: 'buffs', order: 4, title: r.name, kind: dish ? 'Блюдо' : 'Еда', icon: r.icon,
    parts: [{ key: 'food.' + r.id, text: LORE_FOOD_FLAVOR[r.id] || '', rows }],
  };
}

// Ключ статьи о еде для предмета из сумки: блюдо — по dish, простая еда — по рецепту с тем же именем.
function loreFoodKey(item) {
  if (!item || !item.food) return null;
  if (item.food.dish) return 'food.' + item.food.dish;
  const r = RECIPES.consumables.find(x => x.result.type === 'food' && x.result.name === item.name);
  return r ? 'food.' + r.id : null;
}

// Открыть сразу несколько кусков — одна всплывашка на всех: «Энциклопедия: Берсерк и ещё 2».
function unlockLoreMany(keys, silent) {
  const fresh = keys.filter(k => k && !knowsLore(k));
  if (!fresh.length) return;
  fresh.forEach(k => unlockLore(k, true));
  if (silent || typeof showToast !== 'function') return;
  const first = getLoreArticles().find(a => a.parts.some(p => p.key === fresh[0]));
  if (!first) return;
  showToast('📖', `Энциклопедия: ${escChronicle(first.title)}${fresh.length > 1 ? ` и ещё ${fresh.length - 1}` : ''}`);
}

// Старый герой: то, что действует прямо сейчас, он уже накладывал.
function unlockLoreActiveBuffs() {
  const p = state.player;
  const keys = [];
  Object.keys(p.guildBuffs || {}).forEach(id => { if (p.guildBuffs[id] && p.guildBuffs[id].timer > 0) keys.push('buff.' + id); });
  Object.keys(p.tavernBuffs || {}).forEach(id => { if (p.tavernBuffs[id] && p.tavernBuffs[id].timer > 0) keys.push('buff.' + id); });
  if (p.dish && p.dish.timer > 0) keys.push('food.' + p.dish.id);
  if (p.foodTimer > 0) keys.push('satiety');
  unlockLoreMany(keys, true);
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
// Куски byTalk (из разговоров с жителями) так не открываются.
function unlockLoreArticle(id, silent) {
  const a = getLoreArticle(id);
  if (!a) return;
  // v0.34.1: куски с when() открываются только своим делом (убийствами и т.п.)
  a.parts.forEach((p, i) => { if (!p.byTalk && typeof p.when !== 'function') unlockLore(p.key, silent || i > 0); });
}

// ---- v0.34.1: куски, которые открываются делом (when() в данных): Бестиарий, Зелёная поляна ----
// silent — без всплывашки (вход героем: открыть то, что он уже «заслужил» раньше).
function loreSyncBeasts(silent) {
  if (!state.player || !state.player.chronicle) return;
  const keys = [];
  Object.keys(LORE_ARTICLES).forEach(id => {
    (LORE_ARTICLES[id].parts || []).forEach(p => {
      if (typeof p.when !== 'function' || knowsLore(p.key)) return;
      let ok = false;
      try { ok = !!p.when(); } catch (e) { ok = false; }
      if (ok) keys.push(p.key);
    });
  });
  if (keys.length) unlockLoreMany(keys, silent);
}

// Из onMonsterDeath (battle-rewards.js) — после счётчика убийств.
function loreOnKill(m) {
  const c = state.player && state.player.chronicle;
  if (!c || !m) return;
  // ночная охота на локации — для куска «Ночью»
  if (typeof worldTime === 'function' && worldTime(true).phase.id === 'night' && typeof getMonsterLocation === 'function') {
    const loc = getMonsterLocation(m.id);
    if (loc) { if (!c.nightKills) c.nightKills = {}; c.nightKills[loc] = true; }
  }
  loreSyncBeasts(false);
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
    const inCat = arts.filter(a => a.cat === cat.id).sort((x, y) => (x.order || 0) - (y.order || 0));
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
  if (a.portrait) html += `<div class="lore-portrait"><img src="${a.portrait}" alt=""></div>`;   // v0.31: портрет жителя
  if (a.icon) html += `<div class="lore-icon lore-icon-big"><img src="${a.icon}" alt=""></div>`;   // v0.32: значок бафа / еды
  html += `<div><div class="lore-title">${escChronicle(a.title)}</div>`;
  const kind = a.race ? `${a.race} · ${a.kind}` : a.kind;   // v0.31: раса жителя
  html += `<div class="lore-kind">${escChronicle(kind)}${a.parts.length > 1 ? ` · открыто ${knownParts} из ${a.parts.length}` : ''}</div>`;
  // v0.32: отношения с жителем — словами, без цифр
  if (typeof OWNER_CHATS !== 'undefined' && OWNER_CHATS[a.id] && typeof rapportWord === 'function') {
    html += `<div class="lore-rapport">🤝 ${chronicleTextHtml(rapportWord(a.id))}</div>`;
  }
  html += `</div></div>`;

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
    // v0.32: таблица под куском (статья «Подгонка»)
    if (p.rows) html += `<div class="lore-stats lore-rows">${p.rows.map(r => `<div><span>${r[2] ? `<img class="lore-row-icon" src="${r[2]}" alt="">` : ''}${escChronicle(r[0])}</span>${escChronicle(r[1])}</div>`).join('')}</div>`;
  });
  return html;
}
