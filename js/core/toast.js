// ========================================================
//  ЯДРО: ВСПЛЫВАЮЩИЕ УВЕДОМЛЕНИЯ (TOAST)
//  Плашка по центру под шапкой статуса. Висит 2.5 сек,
//  потом плавно тает. Можно вызвать откуда угодно:
//    showToast('🔮', 'Берсерк активирован (+15 мин)')
//    showToast('🍖', 'Сытность +15 мин')
//    showToast('⚒', 'Создано: Гамбезон (верх)')
// ========================================================

const TOAST_LIFE_MS = 2500;

function showToast(icon, text) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text">${text}</span>`;
  container.appendChild(el);

  // Даём браузеру отрисовать элемент, потом добавляем класс
  // .visible — это запускает CSS-анимацию плавного появления.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('visible'));
  });

  // Через TOAST_LIFE_MS начинаем прятать
  setTimeout(() => {
    el.classList.remove('visible');
    // После окончания fade-out убираем элемент
    setTimeout(() => el.remove(), 400);
  }, TOAST_LIFE_MS);
}

// Мигание карточки золотом (используется, например, в Гильдии).
// Добавляет класс .flash-gold на 1 секунду, потом снимает.
function flashCard(el) {
  if (!el) return;
  el.classList.add('flash-gold');
  setTimeout(() => el.classList.remove('flash-gold'), 1000);
}