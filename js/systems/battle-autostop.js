// ========================================================
//  СИСТЕМЫ: БОЙ — АВТО-СТОП / АВТО-СТАРТ
//  Ползунки HP/MP, ожидание восстановления,
//  индикатор ожидания, отмена ожидания, пауза.
//
//  ВЫДЕЛЕНО ИЗ battle-core.js (разбивка больших файлов).
// ========================================================

// --------------------------------------------------------
//  ХЕЛПЕРЫ (таверна, дроп)
// --------------------------------------------------------

function getXpMultiplierFromTavern() {
  const p = state.player;
  if (!p.tavernBuffs || !p.tavernBuffs.rest) return 1.0;
  if (p.tavernBuffs.rest.timer <= 0) return 1.0;
  return 1 + (TAVERN_XP_BONUS_PERCENT / 100);
}

function hasRelaxBuff() {
  const p = state.player;
  return p.tavernBuffs && p.tavernBuffs.relax && p.tavernBuffs.relax.timer > 0;
}

// tryBonusProficiencyXP() живёт в battle-skills.js.

function rollDropCount(chance) {
  if (chance <= 0) return 0;
  const guaranteed = Math.floor(chance / 100);
  const remainder = chance % 100;
  let count = guaranteed;
  if (remainder > 0 && Math.random() * 100 < remainder) count++;
  return count;
}

// --------------------------------------------------------
//  ПОЛЗУНКИ: СТОП / СТАРТ
// --------------------------------------------------------

function onStopSliderChange(kind) {
  const p = state.player;
  const stopSlider   = document.getElementById(kind === 'hp' ? 'stopHpSlider'   : 'stopMpSlider');
  const resumeSlider = document.getElementById(kind === 'hp' ? 'resumeHpSlider' : 'resumeMpSlider');
  if (!stopSlider || !resumeSlider) return;

  let stopVal = parseInt(stopSlider.value, 10) || 0;
  const resumeVal = parseInt(resumeSlider.value, 10) || 0;
  if (resumeVal < stopVal) {
    resumeSlider.value = String(stopVal);
  }

  if (kind === 'hp') {
    p.stopHpPercent   = stopVal;
    p.resumeHpPercent = parseInt(resumeSlider.value, 10) || 0;
  } else {
    p.stopMpPercent   = stopVal;
    p.resumeMpPercent = parseInt(resumeSlider.value, 10) || 0;
  }

  updateAutoStopLabels();
  updateAutoWaitIndicator();
  saveCurrentSlot();
}

function onResumeSliderChange(kind) {
  const p = state.player;
  const stopSlider   = document.getElementById(kind === 'hp' ? 'stopHpSlider'   : 'stopMpSlider');
  const resumeSlider = document.getElementById(kind === 'hp' ? 'resumeHpSlider' : 'resumeMpSlider');
  if (!stopSlider || !resumeSlider) return;

  let resumeVal = parseInt(resumeSlider.value, 10) || 0;
  const stopVal = parseInt(stopSlider.value, 10) || 0;

  if (resumeVal < stopVal) {
    resumeSlider.value = String(stopVal);
    resumeVal = stopVal;
  }

  if (kind === 'hp') {
    p.resumeHpPercent = resumeVal;
  } else {
    p.resumeMpPercent = resumeVal;
  }

  updateAutoStopLabels();
  updateAutoWaitIndicator();
  saveCurrentSlot();
}

function updateAutoStopLabels() {
  const p = state.player;

  function setLabel(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (value > 0) {
      el.textContent = value + '%';
      el.classList.remove('off');
    } else {
      el.textContent = 'выкл';
      el.classList.add('off');
    }
  }

  setLabel('stopHpValue',   p.stopHpPercent   || 0);
  setLabel('stopMpValue',   p.stopMpPercent   || 0);
  setLabel('resumeHpValue', p.resumeHpPercent || 0);
  setLabel('resumeMpValue', p.resumeMpPercent || 0);
}

function syncAutoStopUI() {
  const p = state.player;

  const sh = document.getElementById('stopHpSlider');
  const rh = document.getElementById('resumeHpSlider');
  const sm = document.getElementById('stopMpSlider');
  const rm = document.getElementById('resumeMpSlider');

  if (sh) sh.value = String(p.stopHpPercent   || 0);
  if (rh) rh.value = String(p.resumeHpPercent || 0);
  if (sm) sm.value = String(p.stopMpPercent   || 0);
  if (rm) rm.value = String(p.resumeMpPercent || 0);

  updateAutoStopLabels();
  updateAutoWaitIndicator();
}

// --------------------------------------------------------
//  ПРОВЕРКИ ГОТОВНОСТИ
// --------------------------------------------------------

function shouldWaitForRecovery() {
  const p = state.player;
  if (p.maxHp <= 0 || p.maxMp <= 0) return false;

  const hpPct = (p.hp / p.maxHp) * 100;
  const mpPct = (p.mp / p.maxMp) * 100;

  if (p.stopHpPercent > 0 && hpPct < p.stopHpPercent) return true;
  if (p.stopMpPercent > 0 && mpPct < p.stopMpPercent) return true;
  return false;
}

function isReadyToResume() {
  const p = state.player;
  if (p.maxHp <= 0 || p.maxMp <= 0) return false;

  if ((p.resumeHpPercent || 0) <= 0 && (p.resumeMpPercent || 0) <= 0) return false;

  const hpPct = (p.hp / p.maxHp) * 100;
  const mpPct = (p.mp / p.maxMp) * 100;

  if (p.resumeHpPercent > 0 && hpPct < p.resumeHpPercent) return false;
  if (p.resumeMpPercent > 0 && mpPct < p.resumeMpPercent) return false;
  return true;
}

// --------------------------------------------------------
//  ИНДИКАТОР ОЖИДАНИЯ
// --------------------------------------------------------

function updateAutoWaitIndicator() {
  const ind = document.getElementById('auto-wait-indicator');
  if (!ind) return;

  const p = state.player;

  if (!state.battle.waitingForResume) {
    ind.style.display = 'none';
    ind.classList.remove('wait-hp', 'wait-mp');
    return;
  }

  const hpPct = p.maxHp > 0 ? Math.floor((p.hp / p.maxHp) * 100) : 0;
  const mpPct = p.maxMp > 0 ? Math.floor((p.mp / p.maxMp) * 100) : 0;

  const needHp = p.resumeHpPercent > 0 && hpPct < p.resumeHpPercent;
  const needMp = p.resumeMpPercent > 0 && mpPct < p.resumeMpPercent;

  ind.style.display = 'block';
  ind.classList.remove('wait-hp', 'wait-mp');

  if (needHp) {
    ind.classList.add('wait-hp');
    ind.textContent = `⏸ Ожидание: ❤ ${hpPct}% / нужно ${p.resumeHpPercent}%`;
  } else if (needMp) {
    ind.classList.add('wait-mp');
    ind.textContent = `⏸ Ожидание: 💧 ${mpPct}% / нужно ${p.resumeMpPercent}%`;
  } else {
    ind.style.display = 'none';
  }
}

// --------------------------------------------------------
//  ОТМЕНА ОЖИДАНИЯ
// --------------------------------------------------------
function cancelWaitingForResume(reason) {
  if (!state.battle.waitingForResume) return;

  state.battle.waitingForResume = false;
  state.battle.waitingTemplate = null;

  const ind = document.getElementById('auto-wait-indicator');
  if (ind) {
    ind.style.display = 'none';
    ind.classList.remove('wait-hp', 'wait-mp');
  }

  if (reason) {
    logCombat(`⏹ Ожидание отменено: ${reason}.`, 'log-entry');
  }
}

// v0.19.1: удалена pauseBattleForRecovery() — пауза посреди боя не используется:
// стоп по HP/MP срабатывает только после последнего убитого монстра (battle-rewards.js).
