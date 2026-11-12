// ========================================================
//  СИСТЕМЫ: АВАТАР ГЕРОЯ В БОЮ
//  PNG расы с учётом класса (воин / маг).
//  Если PNG нет — fallback на SVG.
//
//  Вынесено из mentor.js.
// ========================================================

// ---------- АВАТАР ГЕРОЯ В БОЮ ----------
function updatePlayerAvatar() {
  const slot = document.getElementById('player-avatar-slot');
  const p = state.player;
  if (!slot) return;

  slot.classList.remove('class-warrior', 'class-mage');

  if (!p.classId) {
    slot.innerHTML = '';
    return;
  }

  const raceId = p.raceId || 'human';
  const imgSrc = (typeof getRaceIcon === 'function')
    ? getRaceIcon(raceId, p.classId)
    : `img/races/${raceId}.webp`;

  if (p.classId === 'warrior') slot.classList.add('class-warrior');
  if (p.classId === 'mage')    slot.classList.add('class-mage');

  const imgHtml = `<img class="fighter-avatar-img" src="${imgSrc}" alt=""
    onerror="playerAvatarFallback()">`;
  slot.innerHTML = imgHtml;
}

// Fallback: если PNG не загрузился — показываем SVG по классу.
function playerAvatarFallback() {
  const slot = document.getElementById('player-avatar-slot');
  if (!slot) return;
  const p = state.player;
  if (p.classId === 'mage') {
    slot.innerHTML = `<svg class="fighter-avatar" viewBox="0 0 100 100"><defs><radialGradient id="pMage" cx="50%" cy="40%"><stop offset="0%" stop-color="#6a9ae0"/><stop offset="100%" stop-color="#1a2a6a"/></radialGradient></defs><path d="M50 15 Q70 22 70 45 L70 75 L30 75 L30 45 Q30 22 50 15 Z" fill="url(#pMage)" stroke="#a0c8ff" stroke-width="2"/><circle cx="42" cy="45" r="3" fill="#a0e0ff"/><circle cx="58" cy="45" r="3" fill="#a0e0ff"/></svg>`;
  } else if (p.classId === 'warrior') {
    slot.innerHTML = `<svg class="fighter-avatar" viewBox="0 0 100 100"><defs><radialGradient id="pWr" cx="50%" cy="40%"><stop offset="0%" stop-color="#6a9ad0"/><stop offset="100%" stop-color="#1a3a6a"/></radialGradient></defs><path d="M50 10 L70 25 L70 60 Q50 90 30 60 L30 25 Z" fill="url(#pWr)" stroke="#e0be7a" stroke-width="2"/><circle cx="50" cy="40" r="4" fill="#e0be7a"/></svg>`;
  } else {
    slot.innerHTML = '';
  }
}