// ========================================================
//  ЯДРО: ВКЛАДКИ И ВИДЫ
//  + При переключении вкладки прячем тултип,
//    чтобы он не «залипал» на экране.
//  + При переходе на вкладку «Карта» отменяем
//    ожидание автостарта боя.
//
//  НОВОЕ (v0.09):
//  + На вкладке «Инвентарь» вызываем renderSkillLoadout() —
//    рисуем блок «НАВЫКИ» под расходниками.
//
//  НОВОЕ (v0.11):
//  + updateHuntView() вызывает updateHuntModalButton() —
//    показать / скрыть кнопку «🔍 Искать стаю» в шапке.
//    В городе кнопка скрыта, на Поляне / в Копи — видна.
//
//  НОВОЕ (v0.12):
//  + updateMapUI() вызывает updateMapMeta() —
//    рисует доп. инфу на карточках карты (время пешком,
//    диапазон уровней мобов).
//
//  НОВОЕ (v0.26):
//  + Кнопка «Магические тропы» на каждой соседней локации (свиток убран).
// ========================================================

function switchTab(tab) {
  // Скрываем тултип — при переключении вкладки он не нужен.
  if (typeof hideTooltip === 'function') hideTooltip();

  // Если игрок уходит на вкладку «Карта» — отменяем автостарт.
  if (tab === 'map' && typeof cancelWaitingForResume === 'function') {
    cancelWaitingForResume('открыта карта');
  }

  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + tab));

  if (tab === 'character') updateCharacterPanel();
  if (tab === 'inventory') {
    renderInventory();
    renderEquipSlots();
    updateInventoryFooter();
    if (typeof renderSkillLoadout === 'function') renderSkillLoadout();
  }
  if (tab === 'map') updateMapUI();
  if (tab === 'hunt') updateHuntView();
  if (tab === 'proficiency') renderProficiencyPanel();
}

// Три возможных вида вкладки «ОХОТА»:
//   - город (town)  → city-view
//   - поляна (field) → hunt-view
//   - копи (mine)   → hunt-view (своя сетка внутри renderMonsters)
function updateHuntView() {
  const loc = state.player.currentLocation;
  const isTown = loc === 'town';

  document.getElementById('city-view').style.display = isTown ? 'block' : 'none';
  document.getElementById('hunt-view').style.display = isTown ? 'none' : 'block';

  document.getElementById('tab-hunt-label').textContent = isTown ? 'ГОРОД' : 'ОХОТА';

  if (!isTown) {
    renderMonsters();
  }

  // ---- НОВОЕ (v0.11): показать/скрыть кнопку «Искать стаю» ----
  if (typeof updateHuntModalButton === 'function') {
    updateHuntModalButton();
  }
}

function updateMapUI() {
  document.querySelectorAll('.map-card').forEach(c => c.classList.toggle('current', c.dataset.loc === state.player.currentLocation));
  updateMapTravelButton();

  // ---- НОВОЕ (v0.12): доп. инфа на карточках ----
  if (typeof updateMapMeta === 'function') {
    updateMapMeta();
  }
  updateHuntView();
}

// v0.26: тропа на каждой локации, куда из текущей есть путь (цена — getMagicPathPrice).
const MAP_TRAVEL_SLOTS = { field: 'map-travel-slot', town: 'map-travel-slot-town', mine: 'map-travel-slot-mine' };

function updateMapTravelButton() {
  const p = state.player;
  Object.keys(MAP_TRAVEL_SLOTS).forEach(loc => {
    const slot = document.getElementById(MAP_TRAVEL_SLOTS[loc]);
    if (!slot) return;
    const price = loc === p.currentLocation ? null : getMagicPathPrice(p.currentLocation, loc);
    if (price === null) { slot.innerHTML = ''; return; }
    const poor = (p.gold || 0) < price;
    slot.innerHTML = `<button class="map-travel-btn${poor ? ' map-travel-btn-disabled' : ''}" onclick="event.stopPropagation(); useMagicPath('${loc}')"${poor ? ` title="Нужно ${price} Оболов"` : ''}>🌀 Магические тропы · 🪙 ${price}</button>`;
  });
}