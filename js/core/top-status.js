// ========================================================
//  ЯДРО: ШАПКА СВЕРХУ
//  Обновляет верхнюю панель: HP, MP, опыт, золото, уровень
//  и бейджик свободных очков навыков.
// ========================================================

function updateTopStatus() {
  const p = state.player;
  // v0.36.2: вне боя вызывается 10 раз в секунду — пишем на страницу только изменившееся (setText / setBarWidth).
  setText(document.getElementById('top-level'), p.level);
  setText(document.getElementById('top-hp'), `${Math.floor(p.hp)}/${p.maxHp || 0}`);
  setBarWidth(document.getElementById('top-hp-fill'), p.maxHp > 0 ? p.hp / p.maxHp * 100 : 0);
  setText(document.getElementById('top-mp'), `${Math.floor(p.mp)}/${p.maxMp || 0}`);
  setBarWidth(document.getElementById('top-mp-fill'), p.maxMp > 0 ? p.mp / p.maxMp * 100 : 0);
  setText(document.getElementById('top-xp'), `${p.xp}/${p.xpNext}`);
  setBarWidth(document.getElementById('top-xp-fill'), p.xp / p.xpNext * 100);
  setText(document.getElementById('top-gold'), p.gold);
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
  setBarWidth(fill, pct);
  const box = document.getElementById('bx-hero-xp');
  if (box) {
    const title = maxed ? 'Опыт: максимальный уровень' : `Опыт: ${p.xp} / ${p.xpNext} (${pct.toFixed(1)}%)`;
    if (box.title !== title) box.title = title;
  }
}

function updateSkillPointsBadge() {
  const badge = document.getElementById('top-skill-points');
  const p = state.player;
  if (!p.classId) { if (badge.style.display !== 'none') badge.style.display = 'none'; return; }
  if (badge.style.display !== 'inline-flex') badge.style.display = 'inline-flex';
  const b = badge.querySelector('b');
  if (b) setText(b, p.skillPoints);   // v0.36.2: меняем только цифру
  else badge.innerHTML = `НАВЫКИ <b>${p.skillPoints}</b>`;
}