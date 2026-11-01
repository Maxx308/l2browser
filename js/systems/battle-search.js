// ========================================================
//  СИСТЕМЫ: БОЙ — ПОИСК МОНСТРА И АНИМАЦИЯ СМЕРТИ
//  Состояние поиска (👣) между боями + анимация смерти
//  монстра (HP → 0 серая, надпись «☠ Убит!»).
//
//  ВЫДЕЛЕНО ИЗ battle-core.js (разбивка больших файлов).
// ========================================================

const MONSTER_SEARCH_PHRASES = [
  '🌿 Бродим по чаще...',
  '👀 Ищем добычу...',
  '🍃 Трава шелестит...',
  '🐾 Следы ведут вглубь...',
  '⚔ Охота продолжается...',
];

function getRandomSearchPhrase() {
  return MONSTER_SEARCH_PHRASES[Math.floor(Math.random() * MONSTER_SEARCH_PHRASES.length)];
}

// --------------------------------------------------------
//  СОСТОЯНИЕ ПОИСКА (👣)
// --------------------------------------------------------

function showMonsterSearching(phrase) {
  const normalBox = document.getElementById('monster-normal');
  const searchBox = document.getElementById('monster-search');
  const searchText = document.getElementById('monster-search-text');

  if (normalBox) normalBox.style.display = 'none';
  if (searchBox) searchBox.style.display = 'flex';
  if (searchText) searchText.textContent = phrase || getRandomSearchPhrase();
}

function hideMonsterSearching() {
  const normalBox = document.getElementById('monster-normal');
  const searchBox = document.getElementById('monster-search');

  if (searchBox) searchBox.style.display = 'none';
  if (normalBox) normalBox.style.display = 'block';
  if (typeof hideRestCamp === 'function') hideRestCamp();   // v0.24: убрать карточку привала
}

// --------------------------------------------------------
//  АНИМАЦИЯ СМЕРТИ МОНСТРА
// --------------------------------------------------------
function animateMonsterDeath(callback) {
  const monsterHpBar = document.getElementById('monster-hp-bar');
  const monsterName = document.getElementById('monster-fighter-name');

  if (monsterHpBar) {
    state.battle.monsterHpAnimating = false;
    monsterHpBar.style.transition = 'width 0.3s ease-out';
    monsterHpBar.style.width = '0%';
    monsterHpBar.classList.add('dead');
  }

  if (monsterName) {
    monsterName.classList.remove('fade-in-monster');
    monsterName.classList.add('dead');
    monsterName.textContent = '☠ Убит!';
  }

  setTimeout(() => {
    if (callback) callback();
  }, 600);
}