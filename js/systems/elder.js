// ========================================================
//  СИСТЕМЫ: СТАРШИНА (NPC)
//  Клик по карточке в городе → открывает диалог.
//
//  ШАГ 6: АВТОЗАПУСК ДИАЛОГА.
//  Через 3 секунды после появления в городе — автоматически
//  открывается диалог со Старшиной.
//
//  Условия автозапуска:
//    - игрок в городе,
//    - персонаж создан (есть класс),
//    - квест «Первые шаги» ещё НЕ завершён (не 'done'),
//    - в этой сессии автозапуск ещё не срабатывал,
//    - не открыто ни одно окно (торговец, кузница, бой, и т.д.),
//    - игрок на вкладке «Охота» (город).
//
//  Автозапуск срабатывает ОДИН РАЗ ЗА СЕССИЮ (Вариант А).
// ========================================================

// Флаг: автозапуск уже был в этой сессии.
// Сбрасывается при загрузке страницы (переменная модуля).
let __elderAutoShown = false;

// Таймер автозапуска (чтобы можно было отменить).
let __elderAutoTimer = null;

// --------------------------------------------------------
//  КЛИК ПО СТАРШИНЕ (ручной)
// --------------------------------------------------------
function openElder() {
  if (state.player.currentLocation !== 'town') return;

  // Отменяем автозапуск — игрок сам открыл диалог.
  cancelAutoStartElder();

  if (typeof cancelWaitingForResume === 'function') {
    cancelWaitingForResume('открыт старшина');
  }

  // Помечаем, что диалог показан (чтобы автозапуск не сработал позже).
  __elderAutoShown = true;

  openDialogue('elder');
}

// --------------------------------------------------------
//  АВТОЗАПУСК ДИАЛОГА ЧЕРЕЗ 3 СЕКУНДЫ
//  Вызывается из: finishTravel, useMagicPath (в город),
//  onPlayerDeath (после воскрешения), loadSlotAndStart.
// --------------------------------------------------------
function tryAutoStartElderDialogue() {
  // Уже показывали в этой сессии — не повторяем.
  if (__elderAutoShown) return;

  // Персонаж не создан — нечего показывать.
  if (!state.player.classId) return;

  // Не в городе — не показываем.
  if (state.player.currentLocation !== 'town') return;

  // Квест уже завершён — не дёргаем игрока.
  const progress = getQuestProgress('firstSteps');
  if (progress && progress.stage === 'done') {
    __elderAutoShown = true; // больше не проверяем
    return;
  }

  // Уже есть активный таймер — не дублируем.
  if (__elderAutoTimer) return;

  // Запускаем таймер на 3 секунды.
  __elderAutoTimer = setTimeout(() => {
    __elderAutoTimer = null;
    runAutoStartElderDialogue();
  }, 3000);
}

// --------------------------------------------------------
//  ОТМЕНА АВТОЗАПУСКА
//  Вызывается, если игрок что-то открыл или ушёл с вкладки.
// --------------------------------------------------------
function cancelAutoStartElder() {
  if (__elderAutoTimer) {
    clearTimeout(__elderAutoTimer);
    __elderAutoTimer = null;
  }
}

// --------------------------------------------------------
//  ВНУТРЕННЯЯ: ПРОВЕРКА И ЗАПУСК (через 3 сек)
// --------------------------------------------------------
function runAutoStartElderDialogue() {
  // Повторная проверка условий (за 3 секунды могло измениться).

  if (__elderAutoShown) return;
  if (!state.player.classId) return;
  if (state.player.currentLocation !== 'town') return;

  const progress = getQuestProgress('firstSteps');
  if (progress && progress.stage === 'done') {
    __elderAutoShown = true;
    return;
  }

  // Проверяем: не открыто ли какое-то окно.
  if (isAnyOverlayOpen()) return;

  // Проверяем: игрок на вкладке «Охота».
  if (typeof isOnHuntTab === 'function' && !isOnHuntTab()) return;

  // Всё ок — показываем диалог.
  __elderAutoShown = true;

  logCombat('👴 Старейшина окликает вас...', 'log-entry levelup');

  openDialogue('elder');
}

// --------------------------------------------------------
//  ХЕЛПЕР: ОТКРЫТО ЛИ КАКОЕ-ТО ОКНО
// --------------------------------------------------------
function isAnyOverlayOpen() {
  const selectors = [
    '.overlay-base.active',      // торговец, кузница, наставник, гильдия, таверна
    '.cheat-overlay.active',     // чит-меню
    '.settings-overlay.active',  // настройки
    '.dialogue-overlay.active',  // диалог
    '.battle-overlay.active',    // бой
    '.travel-overlay.active',    // переход
    '.slot-picker.active',       // модалка выбора расходников
    '.soon-overlay.active',      // «Скоро»
    '.screen-overlay.active',    // экран старта / создания
  ];
  for (const sel of selectors) {
    if (document.querySelector(sel)) return true;
  }
  return false;
}