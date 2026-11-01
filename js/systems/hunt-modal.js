// ========================================================
//  СИСТЕМЫ: МОДАЛКА «ИСКАТЬ СТАЮ»
//  Кнопка в шапке → модалка: ползунок ×N + сетка монстров.
//
//  Работает только на Поляне / в Копи.
//  Клик по монстру → бой с выбранным количеством.
//
//  НОВОЕ (v0.11).
// ========================================================

// Текущее выбранное количество мобов.
let __huntModalCount = 1;

// --------------------------------------------------------
//  ОТКРЫТИЕ / ЗАКРЫТИЕ
// --------------------------------------------------------
function openHuntModal() {
  // Работает только вне города.
  if (state.player.currentLocation === 'town') return;

  // Если идёт бой — нельзя.
  if (state.battle.active) {
    showToast('⚔', 'Сначала закончите бой');
    return;
  }

  // Если нет класса.
  if (!state.player.classId) {
    showToast('❗', 'Сначала выберите класс');
    return;
  }

  // Отменяем ожидание автостарта боя.
  if (typeof cancelWaitingForResume === 'function') {
    cancelWaitingForResume('открыта модалка поиска');
  }

  // Отменяем автостарт Старшины.
  if (typeof cancelAutoStartElder === 'function') {
    cancelAutoStartElder();
  }

  __huntModalCount = 1;
  renderHuntModal();

  const overlay = document.getElementById('hunt-modal-overlay');
  if (overlay) overlay.classList.add('active');
}

function closeHuntModal() {
  const overlay = document.getElementById('hunt-modal-overlay');
  if (overlay) overlay.classList.remove('active');
}

// --------------------------------------------------------
//  ВЫБОР КОЛИЧЕСТВА
// --------------------------------------------------------
function setHuntCount(count) {
  __huntModalCount = count;

  // Подсветить активную кнопку.
  document.querySelectorAll('.hunt-count-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.count, 10) === count);
  });

  // Обновить подсказку.
  const hint = document.getElementById('hunt-modal-hint');
  if (hint) {
    if (count === 1) {
      hint.textContent = 'Выберите монстра, чтобы начать одиночный бой.';
    } else {
      hint.textContent = `Выберите монстра — попадётся группа из ${count} мобов. Урон группы растёт!`;
    }
  }
}

// --------------------------------------------------------
//  РИСОВАНИЕ МОДАЛКИ
// --------------------------------------------------------
function renderHuntModal() {
  const grid = document.getElementById('hunt-modal-grid');
  if (!grid) return;

  grid.innerHTML = '';

  const loc = state.player.currentLocation;

  // Показываем монстров только текущей локации.
  if (loc === 'field') {
    ['normal', 'ancient', 'bloody'].forEach(variantId => {
      MONSTERS.forEach(m => {
        grid.appendChild(buildHuntModalMonsterCard(m, variantId));
      });
    });
  } else if (loc === 'mine') {
    ['normal', 'ancient', 'bloody'].forEach(variantId => {
      MINE_MONSTERS.forEach(m => {
        grid.appendChild(buildHuntModalMonsterCard(m, variantId));
      });
    });
  }

  // Подсветить активную кнопку ×N.
  document.querySelectorAll('.hunt-count-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.count, 10) === __huntModalCount);
  });

  setHuntCount(__huntModalCount);
}

// --------------------------------------------------------
//  КАРТОЧКА МОНСТРА ДЛЯ МОДАЛКИ
//  Похожа на buildMonsterCard, но БЕЗ дропа и титулов —
//  только аватар, имя, уровень. Клик → бой с группой.
// --------------------------------------------------------
function buildHuntModalMonsterCard(template, variantId) {
  const monster = buildMonsterInstance(template, variantId);
  const variant = MONSTER_VARIANTS[variantId];

  const card = document.createElement('div');
  card.className = 'monster-card ' + variant.cssClass +
    (monster.attackType === 'magic' ? ' magic-type' : '');

  card.innerHTML = `
    <div class="monster-portrait-img" style="background-image:url('${monster.art}')"></div>
    <div class="monster-name">${monster.name}</div>
    <div class="monster-level">Ур. ${monster.level}${monster.attackType === 'magic' ? ' · Магия' : ''}</div>
    <div class="monster-hp-line">❤ ${monster.maxHp} HP</div>
  `;

  card.onclick = () => {
    closeHuntModal();
    selectMonsterGroup(template, variantId, __huntModalCount);
  };

  return card;
}

// --------------------------------------------------------
//  КЛИК ПО ФОНУ ЗАКРЫВАЕТ
// --------------------------------------------------------
document.addEventListener('click', (e) => {
  const overlay = document.getElementById('hunt-modal-overlay');
  if (!overlay || !overlay.classList.contains('active')) return;
  if (e.target === overlay) closeHuntModal();
});

// --------------------------------------------------------
//  ESC ЗАКРЫВАЕТ
// --------------------------------------------------------
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const overlay = document.getElementById('hunt-modal-overlay');
  if (overlay && overlay.classList.contains('active')) closeHuntModal();
});

// --------------------------------------------------------
//  ПОКАЗ / СКРЫТИЕ КНОПКИ В ШАПКЕ
//  Кнопка видна только на Поляне / в Копи.
//  Вызывается из updateHuntView() в tabs.js.
// --------------------------------------------------------
function updateHuntModalButton() {
  const btn = document.getElementById('btn-hunt-modal');
  if (!btn) return;

  const loc = state.player.currentLocation;
  if (loc === 'town') {
    btn.style.display = 'none';
  } else {
    btn.style.display = 'inline-flex';
  }
}