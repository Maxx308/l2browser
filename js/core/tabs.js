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
//    (v0.29: кнопка убрана — охота всегда идёт случайной стаей.)
//
//  НОВОЕ (v0.12):
//  + updateMapUI() вызывает updateMapMeta() —
//    рисует доп. инфу на карточках карты (время пешком,
//    диапазон уровней мобов).
//
//  НОВОЕ (v0.26):
//  + Кнопка «Магические тропы» на каждой соседней локации (свиток убран).
//
//  НОВОЕ (v0.30):
//  + Вкладка «Владение» ушла в лист персонажа, вместо неё — «Хроники».
// ========================================================

function switchTab(tab) {
  // Скрываем тултип — при переключении вкладки он не нужен.
  if (typeof hideTooltip === 'function') hideTooltip();
  if (typeof closeHuntSheet === 'function') closeHuntSheet();   // шторка с карточкой монстра (телефон)

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
  if (tab === 'chronicle') openChroniclePanel();
}

// Три возможных вида вкладки «ОХОТА»:
//   - город (town)  → city-view
//   - поляна (field) → hunt-view
//   - копи (mine)   → hunt-view (своя сетка внутри renderMonsters)
function updateHuntView() {
  const loc = state.player.currentLocation;
  const isTown = isTownLoc(loc);   // v0.36: Андервуд или Ильград

  document.getElementById('city-view').style.display = isTown ? 'block' : 'none';
  document.getElementById('hunt-view').style.display = isTown ? 'none' : 'block';
  if (typeof renderCityView === 'function') renderCityView();   // v0.36: какой город — шапка, карточки, окна

  document.getElementById('tab-hunt-label').textContent = isTown ? 'ГОРОД' : 'ОХОТА';

  if (!isTown) {
    renderMonsters();
  }
}

function updateMapUI() {
  document.querySelectorAll('.map-card').forEach(c => c.classList.toggle('current', c.dataset.loc === state.player.currentLocation));  updateMapTravelButton();

  // ---- НОВОЕ (v0.12): доп. инфа на карточках ----
  if (typeof updateMapMeta === 'function') {
    updateMapMeta();
  }
  updateHuntView();
}

// v0.26: тропа на каждой локации, куда из текущей есть путь (цена — getMagicPathPrice).
// v0.31: рядом — «🚶 Пешком · время» (раньше пешком было только кликом по карточке; клик тоже остался).
const MAP_TRAVEL_SLOTS = { field: 'map-travel-slot', town: 'map-travel-slot-town', mine: 'map-travel-slot-mine', ilgrad: 'map-travel-slot-ilgrad', outskirts: 'map-travel-slot-outskirts' };

function updateMapTravelButton() {
  const p = state.player;
  Object.keys(MAP_TRAVEL_SLOTS).forEach(loc => {
    const slot = document.getElementById(MAP_TRAVEL_SLOTS[loc]);
    if (!slot) return;
    const here = loc === p.currentLocation;
    const walk = here ? null : getTravelTimeFromCurrent(loc);
    const price = here ? null : getMagicPathPrice(p.currentLocation, loc);
    const btns = [];
    if (walk !== null) {
      btns.push(`<button class="map-travel-btn map-walk-btn" onclick="event.stopPropagation(); tryTravel('${loc}')" title="Идти пешком — бесплатно">🚶 Пешком · ${formatTravelTime(walk)}</button>`);
    }
    if (price !== null) {
      const poor = (p.gold || 0) < price;
      // v0.36.3: короче — «Тропы», полное название в подсказке; обе кнопки одной ширины (css .map-travel-btns)
      btns.push(`<button class="map-travel-btn${poor ? ' map-travel-btn-disabled' : ''}" onclick="event.stopPropagation(); useMagicPath('${loc}')" title="${poor ? `Магические тропы: нужно ${price} Оболов` : 'Магические тропы — сразу, за Оболы'}">🌀 Тропы · 🪙 ${price}</button>`);
    }
    slot.innerHTML = btns.length ? `<div class="map-travel-btns">${btns.join('')}</div>` : '';
  });
}