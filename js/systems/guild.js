// ========================================================
//  СИСТЕМЫ: ГИЛЬДИЯ МАГОВ
//  + При открытии — отменяем ожидание автостарта боя.
//
//  НОВОЕ (v0.11):
//  + Карточки новых бафов показывают эффекты:
//    «+5 к точности» и «+3% к шансу блока».
// ========================================================

function openGuild() {
  if (state.player.currentLocation !== 'town') return;

  // Отменяем автостарт (если он был).
  if (typeof cancelWaitingForResume === 'function') {
    cancelWaitingForResume('открыта гильдия');
  }

  document.getElementById('guild-overlay').classList.add('active');
  renderGuildList();
  updateGuildGold();
}
function closeGuild() { document.getElementById('guild-overlay').classList.remove('active'); }

function updateGuildGold() {
  const el = document.getElementById('guild-gold');
  if (el) el.textContent = state.player.gold;
}

// v0.19.1: карточки рисует buff-shop.js (кнопки +1 ч / +5 ч / До 12 ч и «Мой набор»).
function renderGuildList() {
  buffShopRender('guild');
}

function buyGuildBuff(buffId) {
  const p = state.player;
  const buff = GUILD_BUFFS[buffId];
  if (!buff) return;
  if (!p.classId) {
    showToast('🔮', 'Сначала выберите класс');
    logLoot(`Сначала выберите класс.`, 'log-info');
    return;
  }
  if (buff.mageOnly && p.classId !== 'mage') {
    showToast('🔮', 'Этот бафф только для магов');
    return;
  }
  if (p.gold < buff.price) {
    showToast('🪙', `Недостаточно Оболов (нужно ${buff.price})`);
    logLoot(`Недостаточно Оболов.`, 'log-info');
    return;
  }

  if (!p.guildBuffs[buffId]) p.guildBuffs[buffId] = { timer: 0 };
  const freeSpace = MAX_BUFF_DURATION - p.guildBuffs[buffId].timer;

  if (freeSpace <= 0) {
    showToast('🔮', 'Максимальная длительность (12 часов) достигнута');
    logLoot(`Максимальная длительность (12 часов) уже достигнута.`, 'log-info');
    return;
  }
  if (freeSpace < buff.duration) {
    const freeMin = Math.ceil(freeSpace / 60);
    const addMin = Math.floor(buff.duration / 60);
    showToast('🔮', `Не поместится: до потолка ${freeMin} мин, бафф даёт ${addMin} мин`);
    logLoot(`Не поместится: до потолка ${freeMin} мин, а бафф даёт ${addMin} мин.`, 'log-info');
    return;
  }

  p.gold -= buff.price;
  if (buff.packRival && p.guildBuffs[buff.packRival]) p.guildBuffs[buff.packRival].timer = 0;   // v0.29
  p.guildBuffs[buffId].timer = addBuffTime(p.guildBuffs[buffId].timer, buff.duration);

  recalcStats();
  updateTopStatus(); updateCharacterPanel();
  renderEffectsPanel();
  renderGuildList();
  updateGuildGold(); updateTraderGold(); updateForgeGold();
  logCombat(`🔮 Активировано: ${buff.name} (+${buffShopDur(buff.duration)})`, 'log-entry levelup');

  showToast('🔮', `${buff.name} активирован (+${buffShopDur(buff.duration)})`);
  const card = document.querySelector(`.guild-card[data-buff-id="${buffId}"]`);
  flashCard(card);

  saveCurrentSlot();
}