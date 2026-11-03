// ========================================================
//  СИСТЕМЫ: ТАВЕРНА «КОЗЬЕ ВЫМЯ»
//  Баффы за золото: Отдых (XP) и Расслабон (владение).
//  v0.26: 1 час за 2000 Оболов (BUFF_DURATION / BUFF_PRICE в config.js).
//  Максимум: 12 часов (общий потолок MAX_BUFF_DURATION).
//  + При открытии — отменяем ожидание автостарта боя.
// ========================================================

// ---------- ОКНО ----------
function openTavern() {
  if (state.player.currentLocation !== 'town') return;

  // Отменяем автостарт (если он был).
  if (typeof cancelWaitingForResume === 'function') {
    cancelWaitingForResume('открыта таверна');
  }

  document.getElementById('tavern-overlay').classList.add('active');
  renderTavernBuffs();
  updateTavernGold();

  // v0.31: Энциклопедия — хозяйка таверны; точка на «Поговорить»
  if (typeof unlockLore === 'function') unlockLore('hostess');
  if (typeof updateTalkButtons === 'function') updateTalkButtons();
}

function closeTavern() {
  document.getElementById('tavern-overlay').classList.remove('active');
}

function updateTavernGold() {
  const el = document.getElementById('tavern-gold');
  if (el) el.textContent = state.player.gold;
}

// ---------- РИСОВАНИЕ КАРТОЧЕК БАФФОВ ----------
// v0.19.1: карточки рисует buff-shop.js (кнопки пачкой и «Мой набор»).
function renderTavernBuffs() {
  buffShopRender('tavern');
}

// ---------- ПОКУПКА БАФФА ----------
function buyTavernBuff(buffId) {
  const p = state.player;
  const buff = TAVERN_BUFFS[buffId];
  if (!buff) return;

  if (!p.classId) {
    showToast('🍺', 'Сначала выберите класс');
    logLoot(`Сначала выберите класс.`, 'log-info');
    return;
  }

  const price = getTavernBuffPrice();

  if (p.gold < price) {
    showToast('🪙', `Недостаточно Оболов (нужно ${price})`);
    logLoot(`Недостаточно Оболов. Нужно ${price}.`, 'log-info');
    return;
  }

  if (!p.tavernBuffs[buffId]) p.tavernBuffs[buffId] = { timer: 0 };
  const freeSpace = MAX_BUFF_DURATION - p.tavernBuffs[buffId].timer;

  // Вариант Б: если бафф не помещается целиком до потолка — не даём купить.
  if (freeSpace <= 0) {
    showToast('🍺', 'Максимальная длительность (12 часов) достигнута');
    logLoot(`Максимальная длительность (12 часов) уже достигнута.`, 'log-info');
    return;
  }
  if (freeSpace < buff.duration) {
    const freeMin = Math.ceil(freeSpace / 60);
    const addMin = Math.floor(buff.duration / 60);
    showToast('🍺', `Не поместится: до потолка ${freeMin} мин, бафф даёт ${addMin} мин`);
    logLoot(`Не поместится: до потолка ${freeMin} мин, а бафф даёт ${addMin} мин.`, 'log-info');
    return;
  }

  p.gold -= price;
  p.tavernBuffs[buffId].timer = addBuffTime(p.tavernBuffs[buffId].timer, buff.duration);

  // Пересчёт статов (на случай, если бафф влияет на статы — пока нет, но на будущее)
  recalcStats();
  updateTopStatus(); updateCharacterPanel();
  renderEffectsPanel();
  renderTavernBuffs();
  updateTavernGold(); updateTraderGold(); updateForgeGold(); updateGuildGold();
  logCombat(`🍺 Таверна: активировано «${buff.name}» (+${buffShopDur(buff.duration)})`, 'log-entry levelup');

  showToast('🍺', `${buff.name} активирован (+${buffShopDur(buff.duration)})`);
  const card = document.querySelector(`.tavern-card[data-buff-id="${buffId}"]`);
  flashCard(card);

  saveCurrentSlot();
}