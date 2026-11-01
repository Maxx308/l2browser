// ========================================================
//  ЯДРО: ШАПКА СВЕРХУ
//  Обновляет верхнюю панель: HP, MP, опыт, золото, уровень
//  и бейджик свободных очков навыков.
// ========================================================

function updateTopStatus() {
  const p = state.player;
  document.getElementById('top-level').textContent = p.level;
  document.getElementById('top-hp').textContent = `${Math.floor(p.hp)}/${p.maxHp || 0}`;
  document.getElementById('top-hp-fill').style.width = p.maxHp > 0 ? (p.hp / p.maxHp * 100) + '%' : '0%';
  document.getElementById('top-mp').textContent = `${Math.floor(p.mp)}/${p.maxMp || 0}`;
  document.getElementById('top-mp-fill').style.width = p.maxMp > 0 ? (p.mp / p.maxMp * 100) + '%' : '0%';
  document.getElementById('top-xp').textContent = `${p.xp}/${p.xpNext}`;
  document.getElementById('top-xp-fill').style.width = (p.xp / p.xpNext * 100) + '%';
  document.getElementById('top-gold').textContent = p.gold;
  updateSkillPointsBadge();
  updateBattleXpBar();
}

// v0.25: тонкая шкала опыта под HP/MP героя в окне боя.
function updateBattleXpBar() {
  const fill = document.getElementById('bx-hero-xp-fill');
  if (!fill) return;
  const p = state.player;
  const maxed = !isFinite(p.xpNext) || p.xpNext <= 0;
  const pct = maxed ? 100 : Math.max(0, Math.min(100, p.xp / p.xpNext * 100));
  fill.style.width = pct + '%';
  const box = document.getElementById('bx-hero-xp');
  if (box) box.title = maxed ? 'Опыт: максимальный уровень' : `Опыт: ${p.xp} / ${p.xpNext} (${pct.toFixed(1)}%)`;
}

function updateSkillPointsBadge() {
  const badge = document.getElementById('top-skill-points');
  const p = state.player;
  if (!p.classId) { badge.style.display = 'none'; return; }
  badge.style.display = 'inline-flex';
  badge.innerHTML = `НАВЫКИ <b>${p.skillPoints}</b>`;
}