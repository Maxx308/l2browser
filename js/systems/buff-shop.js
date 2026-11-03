// ========================================================
//  СИСТЕМЫ: ПОКУПКА БАФФОВ ПАЧКОЙ (v0.19.1)
//  Общие карточки для Гильдии магов и Таверны.
//
//  + На каждой карточке: полоска «сколько залито из 12 ч»
//    и три кнопки: +1 ч / +5 ч (×5) / До 12 ч (v0.26: бафф = 1 ч).
//    Цена под кнопкой считается от текущего таймера и денег.
//    Не хватает на полный залив — «На все Оболы».
//  + Галочка «в наборе» (запоминается: state.player.buffSet).
//  + Панель «Мой набор» сверху: те же три кнопки сразу
//    для всех отмеченных баффов, с общей ценой.
//  + Говорливость (только для магов) у воина — серая,
//    в набор не попадает и не покупается.
//  + Подтверждений нет: цена написана на кнопке.
// ========================================================

const BUFF_SHOP_PACK = 5;    // «×5» = +5 ч (v0.26: было ×10 по 15 мин)

// ---------- источники данных ----------
function buffShopDef(kind) {
  const p = state.player;
  if (kind === 'guild') {
    return {
      kind, defs: Object.values(GUILD_BUFFS), store: p.guildBuffs,
      price: (b) => b.price,
      icon: (b) => b.icon || '',
      emoji: '🔮', listId: 'guild-list', barId: 'guild-setbar',
    };
  }
  return {
    kind, defs: Object.values(TAVERN_BUFFS), store: p.tavernBuffs,
    price: () => getTavernBuffPrice(),
    icon: (b) => (b.iconPng ? buffIconHtml(b) : TAVERN_SVG[b.iconKey] || ''),
    emoji: '🍺', listId: 'tavern-list', barId: 'tavern-setbar',
  };
}

// Можно ли этому герою покупать бафф.
function buffShopAllowed(buff) {
  if (buff.mageOnly && state.player.classId !== 'mage') return false;
  return true;
}

// Бафф по умолчанию в наборе? (пока игрок сам не переключил галочку)
function buffShopDefaultInSet(kind, buff) {
  if (!buffShopAllowed(buff)) return false;
  if (buff.id === 'shieldwall' && !getEquippedShield()) return false;
  if (buff.packMode) return false;   // v0.29: стайные бафы — только по выбору игрока
  return true;
}

function buffShopInSet(kind, buff) {
  if (!buffShopAllowed(buff)) return false;
  const s = state.player.buffSet && state.player.buffSet[kind];
  if (s && typeof s[buff.id] === 'boolean') return s[buff.id];
  return buffShopDefaultInSet(kind, buff);
}

function buffShopToggleSet(kind, buffId) {
  const p = state.player;
  const d = buffShopDef(kind);
  const buff = d.defs.find(b => b.id === buffId);
  if (!buff || !buffShopAllowed(buff)) return;
  if (!p.buffSet) p.buffSet = {};
  if (!p.buffSet[kind]) p.buffSet[kind] = {};
  p.buffSet[kind][buffId] = !buffShopInSet(kind, buff);
  // v0.29: Тихий шаг и Провокатор вместе в наборе быть не могут
  if (buff.packRival && p.buffSet[kind][buffId]) p.buffSet[kind][buff.packRival] = false;
  buffShopRender(kind);
  if (typeof saveCurrentSlot === 'function') saveCurrentSlot();
}

// ---------- расчёт ----------
function buffShopTimer(d, buff) {
  const a = d.store[buff.id];
  return a ? a.timer || 0 : 0;
}

// Сколько покупок поместится до потолка 12 ч.
function buffShopFit(d, buff) {
  return Math.max(0, Math.floor((MAX_BUFF_DURATION - buffShopTimer(d, buff)) / buff.duration));
}

// План покупки одного баффа. mode: 1 | 10 | 'max'. gold — сколько денег можно потратить.
// Возвращает { n, cost, goldLimited }.
function buffShopPlanOne(d, buff, mode, gold) {
  const fit = buffShopFit(d, buff);
  const price = d.price(buff);
  const want = mode === 'max' ? fit : Math.min(mode, fit);
  const afford = price > 0 ? Math.floor(gold / price) : want;
  const n = Math.max(0, Math.min(want, afford));
  return { n, cost: n * price, goldLimited: afford < want };
}

// План для всего набора: по очереди сверху вниз, пока хватает денег.
function buffShopPlanSet(d, mode) {
  let gold = state.player.gold;
  const items = [];
  let goldLimited = false, total = 0;
  d.defs.forEach(buff => {
    if (!buffShopInSet(d.kind, buff)) return;
    const pl = buffShopPlanOne(d, buff, mode, gold);
    if (pl.goldLimited) goldLimited = true;
    if (pl.n > 0) { items.push({ buff, n: pl.n, cost: pl.cost }); gold -= pl.cost; total += pl.cost; }
  });
  return { items, total, goldLimited };
}

// ---------- форматирование ----------
function buffShopWord(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'бафф';
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'баффа';
  return 'баффов';
}
function buffShopNum(n) {
  return Math.round(n).toLocaleString('ru-RU');
}
function buffShopDur(sec) {
  const total = Math.round(sec / 60);
  const h = Math.floor(total / 60), m = total % 60;
  if (h && m) return `${h} ч ${m} мин`;
  if (h) return `${h} ч`;
  return `${m} мин`;
}

// ---------- покупка ----------
function buffShopApply(kind, items) {
  const p = state.player;
  const d = buffShopDef(kind);
  if (!p.classId) { showToast(d.emoji, 'Сначала выберите класс'); return; }

  // v0.29: стайный баф снимает соперника — спрашиваем, если у того ещё есть время
  for (const { buff, n } of items) {
    if (n <= 0 || !buff.packRival) continue;
    const rival = d.store[buff.packRival];
    if (rival && rival.timer > 0) {
      const rivalName = GUILD_BUFFS[buff.packRival].name;
      if (!confirm(`«${buff.name}» не действует вместе с «${rivalName}».\n\nСнять «${rivalName}» (осталось ${buffShopDur(rival.timer)})? Оболы за него не вернутся.`)) return;
    }
  }

  let spent = 0;
  const parts = [];
  items.forEach(({ buff, n }) => {
    if (n <= 0) return;
    const cost = n * d.price(buff);
    if (p.gold < cost) return;
    if (buff.packRival && d.store[buff.packRival]) d.store[buff.packRival].timer = 0;
    if (!d.store[buff.id]) d.store[buff.id] = { timer: 0 };
    p.gold -= cost; spent += cost;
    d.store[buff.id].timer = addBuffTime(d.store[buff.id].timer, n * buff.duration);
    parts.push(`${buff.name} +${buffShopDur(n * buff.duration)}`);
    const card = document.querySelector(`#${d.listId} [data-buff-id="${buff.id}"]`);
    if (card) flashCard(card);
  });
  if (!parts.length) { showToast('🪙', 'Нечего покупать или мало Оболов'); return; }
  if (typeof markDeed === 'function') markDeed(kind + '.buff');   // v0.31: 'tavern.buff' / 'guild.buff' — темы разговоров

  recalcStats();
  updateTopStatus(); updateCharacterPanel();
  renderEffectsPanel();
  if (typeof updateGuildGold === 'function') updateGuildGold();
  if (typeof updateTavernGold === 'function') updateTavernGold();
  if (typeof updateTraderGold === 'function') updateTraderGold();
  if (typeof updateForgeGold === 'function') updateForgeGold();
  buffShopRender(kind);
  const where = kind === 'guild' ? 'Гильдия' : 'Таверна';
  logCombat(`${d.emoji} ${where}: ${parts.join(', ')} (−${buffShopNum(spent)} Оболов)`, 'log-entry levelup');
  showToast(d.emoji, parts.length > 1 ? `Продлено: ${parts.length} ${buffShopWord(parts.length)} (−${buffShopNum(spent)})` : `${parts[0]} (−${buffShopNum(spent)})`);
  saveCurrentSlot();
}

function buffShopBuy(kind, buffId, mode) {
  const d = buffShopDef(kind);
  const buff = d.defs.find(b => b.id === buffId);
  if (!buff || !buffShopAllowed(buff)) return;
  const pl = buffShopPlanOne(d, buff, mode, state.player.gold);
  buffShopApply(kind, [{ buff, n: pl.n }]);
}

function buffShopBuySet(kind, mode) {
  const d = buffShopDef(kind);
  const plan = buffShopPlanSet(d, mode);
  if (mode !== 'max' && plan.goldLimited) { showToast('🪙', 'Не хватает Оболов на весь набор'); return; }
  buffShopApply(kind, plan.items);
}

// ---------- рисование ----------
function buffShopEffectsHtml(kind, buff) {
  const out = [];
  if (kind === 'tavern') {
    if (buff.effect === 'xpPercent') out.push(`<div class="plus">+${buff.value}% к получаемому опыту</div>`);
    else if (buff.effect === 'profPercent') out.push(`<div class="plus">+${buff.value}% шанс бонусного опыта владения</div>`);
    return out.join('');
  }
  const eff = buff.effects || {};
  const sign = (v) => (v > 0 ? '+' : '') + v;
  const cls = (v) => (v > 0 ? 'plus' : 'minus');
  if (eff.pAtkPercent) out.push(`<div class="${cls(eff.pAtkPercent)}">${sign(eff.pAtkPercent)}% физ. атака</div>`);
  if (eff.mAtkPercent) out.push(`<div class="${cls(eff.mAtkPercent)}">${sign(eff.mAtkPercent)}% маг. атака</div>`);
  if (eff.pDefPercent) out.push(`<div class="${cls(eff.pDefPercent)}">${sign(eff.pDefPercent)}% физ. защита</div>`);
  if (eff.mDefPercent) out.push(`<div class="${cls(eff.mDefPercent)}">${sign(eff.mDefPercent)}% маг. защита</div>`);
  if (eff.atbPercent) out.push(`<div class="plus">+${eff.atbPercent}% ${buff.id === 'eloquence' ? 'скорость каста' : 'скорость ATB'}</div>`);
  if (eff.accuracyFlat) out.push(`<div class="plus">+${eff.accuracyFlat} к точности</div>`);
  if (eff.blockFlat) out.push(`<div class="plus">+${eff.blockFlat}% к шансу блока</div>`);
  // v0.29: стайные бафы (battle-pack.js)
  if (buff.packMode === 'quiet') {
    out.push(`<div class="plus">Стаи меньше на старте</div>`);
    out.push(`<div class="plus">Подмога почти не приходит (×${PACK_BUFF_MODS.quiet.reinforceMult})</div>`);
    out.push(`<div class="minus">Меньше стайного бонуса к дропу</div>`);
  } else if (buff.packMode === 'provoke') {
    out.push(`<div class="plus">Больше стайного бонуса: дроп до +${PACK_DROP_MAX}%, Оболы до +${PACK_GOLD_MAX}%</div>`);
    out.push(`<div class="minus">Стаи больше на старте</div>`);
    out.push(`<div class="minus">Подмога сбегается (×${PACK_BUFF_MODS.provoke.reinforceMult})</div>`);
  }
  if (buff.packRival) out.push(`<div class="note">Не действует вместе с «${GUILD_BUFFS[buff.packRival].name}»</div>`);
  return out.join('');
}

function buffShopButton(label, price, onclick, disabled, extraCls) {
  return `<button class="btn success bs-btn ${extraCls || ''}" onclick="${onclick}" ${disabled ? 'disabled' : ''}>` +
    `<span class="bs-btn-label">${label}</span><span class="bs-btn-price">${price}</span></button>`;
}

// Три кнопки для одного баффа или для набора.
function buffShopButtonsHtml(kind, plans, onclickFn, fitAll) {
  const [p1, p10, pmax] = plans;
  const btns = [];
  // +1 ч
  btns.push(buffShopButton(`+${buffShopDur(plans.dur1)}`,
    p1.n ? `🪙 ${buffShopNum(p1.cost)}` : '—', onclickFn(1), !p1.n));
  // ×5
  btns.push(buffShopButton(p10.n ? `+${buffShopDur(plans.dur10)}` : `+${buffShopDur(plans.durPack)}`,
    p10.n ? `🪙 ${buffShopNum(p10.cost)}` : '—', onclickFn(BUFF_SHOP_PACK), !p10.n));
  // До 12 ч / На все Оболы
  let maxLabel = 'До 12 ч';
  if (!fitAll) maxLabel = 'Максимум';
  else if (pmax.goldLimited) maxLabel = 'На все Оболы';
  btns.push(buffShopButton(maxLabel, pmax.n ? `🪙 ${buffShopNum(pmax.cost)}` : '—', onclickFn("'max'"), !pmax.n, 'bs-btn-max'));
  return `<div class="bs-actions">${btns.join('')}</div>`;
}

function buffShopRender(kind) {
  const d = buffShopDef(kind);
  const cont = document.getElementById(d.listId);
  if (!cont) return;
  const p = state.player;
  cont.innerHTML = '';

  d.defs.forEach(buff => {
    const allowed = buffShopAllowed(buff);
    const timer = buffShopTimer(d, buff);
    const fit = buffShopFit(d, buff);
    const full = fit === 0;
    const inSet = buffShopInSet(kind, buff);
    const pct = Math.min(100, timer / MAX_BUFF_DURATION * 100);

    const card = document.createElement('div');
    card.className = 'guild-card bs-card' + (kind === 'tavern' ? ' tavern-card' : '') +
      (inSet ? ' in-set' : '') + (full ? ' is-full' : '') + (!allowed ? ' is-locked' : '');
    card.dataset.buffId = buff.id;

    const p1 = buffShopPlanOne(d, buff, 1, p.gold);
    const p10 = buffShopPlanOne(d, buff, BUFF_SHOP_PACK, p.gold);
    const pmax = buffShopPlanOne(d, buff, 'max', p.gold);
    const plans = [p1, p10, pmax];
    plans.dur1 = buff.duration; plans.dur10 = p10.n * buff.duration; plans.durPack = BUFF_SHOP_PACK * buff.duration;

    const setChip = allowed
      ? `<button class="bs-set-chip ${inSet ? 'on' : ''}" onclick="buffShopToggleSet('${kind}','${buff.id}')" aria-pressed="${inSet}" title="Покупать вместе с набором">${inSet ? '✓ в наборе' : '+ в набор'}</button>`
      : '';
    const note = kind === 'tavern' ? `<div class="note">${buff.desc}</div>` : '';
    const lock = !allowed ? `<div class="bs-locked">Только для магов</div>` : '';
    const timeText = timer > 0 ? `осталось ${buffShopDur(timer)}` : 'не активен';
    const priceOne = d.price(buff);

    card.innerHTML =
      `${setChip}` +
      `<div class="guild-card-icon">${d.icon(buff)}</div>` +
      `<div class="guild-card-name">${buff.name}</div>` +
      `<div class="guild-card-effects">${buffShopEffectsHtml(kind, buff)}${note}</div>` +
      `<div class="bs-meter" title="Залито ${buffShopDur(timer)} из 12 ч">` +
        `<div class="bs-meter-track"><div class="bs-meter-fill" style="width:${pct.toFixed(1)}%"></div></div>` +
        `<div class="bs-meter-text"><span>${timeText}</span><span>макс. 12 ч</span></div>` +
      `</div>` +
      `<div class="guild-card-duration">${buffShopDur(buff.duration)} за 🪙 ${buffShopNum(priceOne)}</div>` +
      (allowed ? buffShopButtonsHtml(kind, plans, (m) => `buffShopBuy('${kind}','${buff.id}',${m})`, !full) : lock);
    cont.appendChild(card);
  });

  buffShopRenderSetBar(kind);
}

function buffShopRenderSetBar(kind) {
  const d = buffShopDef(kind);
  const bar = document.getElementById(d.barId);
  if (!bar) return;
  const inSet = d.defs.filter(b => buffShopInSet(kind, b));
  const word = buffShopWord;
  if (!inSet.length) {
    bar.innerHTML = `<div class="bs-setbar-head"><span class="bs-setbar-title">${d.emoji} Мой набор пуст</span>` +
      `<span class="bs-setbar-hint">Отметьте баффы кнопкой «+ в набор», чтобы продлевать их одним нажатием</span></div>`;
    return;
  }
  const p1 = buffShopPlanSet(d, 1), p10 = buffShopPlanSet(d, BUFF_SHOP_PACK), pmax = buffShopPlanSet(d, 'max');
  const allFull = inSet.every(b => buffShopFit(d, b) === 0);
  const dur = inSet[0].duration;
  // +1 ч / +5 ч всем — только если хватает на всех; частично покупает лишь «на все Оболы»
  const btn = (label, plan, mode, cls) => {
    const partial = mode !== "'max'" && plan.goldLimited;
    const ok = plan.items.length && !partial;
    return buffShopButton(label, ok ? `🪙 ${buffShopNum(plan.total)}` : (partial ? 'мало Оболов' : '—'),
      `buffShopBuySet('${kind}',${mode})`, !ok, cls);
  };
  const maxLabel = allFull ? 'Все на максимуме' : (pmax.goldLimited ? 'Всем на все Оболы' : 'Всем до 12 ч');
  bar.innerHTML =
    `<div class="bs-setbar-head"><span class="bs-setbar-title">${d.emoji} Мой набор: ${inSet.length} ${word(inSet.length)}</span>` +
    `<span class="bs-setbar-hint">${inSet.map(b => b.name).join(' · ')}</span></div>` +
    `<div class="bs-actions bs-actions-set">` +
      btn(`+${buffShopDur(dur)} всем`, p1, 1) +
      btn(`+${buffShopDur(dur * BUFF_SHOP_PACK)} всем`, p10, BUFF_SHOP_PACK) +
      btn(maxLabel, pmax, "'max'", 'bs-btn-max') +
    `</div>`;
}
