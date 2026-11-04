// ========================================================
//  СИСТЕМЫ: НАСТАВНИК
//  Только прокачка навыков.
//
//  ВАЖНО:
//  - Слоты скиллов в бою вынесены в skill-slots.js.
//  - Аватар героя вынесен в player-avatar.js.
//  - Тултип скиллов вынесен в tooltips.js.
//
//  НОВОЕ (v0.16):
//  + Кнопка «Сбросить навыки» за 5000 Оболов.
//    Возвращает все очки, стирает выученные навыки.
// ========================================================

function getSkillLevel(skillId) { return state.player.learnedSkills[skillId] || 0; }

function getSkillData(skillId) {
  const lvl = getSkillLevel(skillId);
  if (lvl === 0) return null;
  return SKILLS[skillId].levels[lvl - 1];
}

function isSkillAvailableForPlayer(skill, player) {
  if (skill.classId && skill.classId !== player.classId) return false;
  if (skill.raceId && skill.raceId !== player.raceId) return false;
  return true;
}

function openMentor() {
  if (state.player.currentLocation !== 'town') return;

  if (typeof cancelWaitingForResume === 'function') {
    cancelWaitingForResume('открыт наставник');
  }

  document.getElementById('mentor-overlay').classList.add('active');
  renderMentorSkills();

  // v0.31: Энциклопедия — наставник; точка на «Поговорить»
  if (typeof unlockLore === 'function') unlockLore('mentor');
  if (typeof updateTalkButtons === 'function') updateTalkButtons();
}

function closeMentor() { document.getElementById('mentor-overlay').classList.remove('active'); }

// ---- СБРОС НАВЫКОВ ----
function resetSkills() {
  const p = state.player;
  
  // Считаем, сколько всего очков было потрачено
  let totalSpent = 0;
  for (const skillId in p.learnedSkills) {
    totalSpent += p.learnedSkills[skillId];
  }
  
  if (totalSpent === 0) {
    showToast('⚠', 'У вас нет выученных навыков');
    return;
  }
  
  const price = 5000;
  if (p.gold < price) {
    showToast('🪙', `Недостаточно Оболов (нужно ${price})`);
    return;
  }
  
  const ok = confirm(`Сбросить ВСЕ навыки?\n\n` +
    `Вы вернёте ${totalSpent} очков навыков.\n` +
    `Стоимость: ${price} Оболов.\n\n` +
    `Это действие нельзя отменить.`);
    
  if (!ok) return;
  
  // Списываем золото
  p.gold -= price;
  
  // Очищаем навыки и возвращаем очки
  p.learnedSkills = {};
  p.skillPoints += totalSpent;
  
  // Очищаем слоты активных навыков, так как скиллов больше нет
  if (p.skillSlots) {
    p.skillSlots = [null, null, null];
  }
  
  // Пересчитываем статы (чтобы убрать бонусы от пассивок)
  recalcStats();
  updateCharacterPanel();
  updateTopStatus();
  updateSkillPointsBadge();
  renderMentorSkills();
  renderSkillSlots();
  if (typeof renderSkillLoadout === 'function') renderSkillLoadout();
  
  logCombat(`🔄 Навыки сброшены. Возвращено ${totalSpent} очков. (−${price} 🪙)`, 'log-entry levelup');
  showToast('🔄', `Навыки сброшены (−${price} 🪙)`);
  if (typeof markDeed === 'function') markDeed('mentor.reset');   // v0.31: тема у наставника

  saveCurrentSlot();
}

// ---- РЕНДЕР ----
function renderMentorSkills() {
  const cont = document.getElementById('mentor-pane-skills');
  const p = state.player;
  
  if (!p.classId) {
    cont.innerHTML = `<div class="mentor-info">Класс выбирается при создании персонажа. Сбросьте персонажа и создайте заново, чтобы сменить класс.</div>`;
    return;
  }

  // Считаем, сколько очков потрачено
  let totalSpent = 0;
  for (const id in p.learnedSkills) totalSpent += p.learnedSkills[id];
  
  // Хедер с очками и кнопкой сброса
  const header = `
    <div class="skill-points-header" style="display:flex; justify-content:space-between; align-items:center;">
      <div>Свободных очков: <b>${p.skillPoints}</b></div>
      ${totalSpent > 0 ? `<button class="btn danger" onclick="resetSkills()">🔄 Сбросить навыки (5000 🪙)</button>` : ''}
    </div>
  `;

  const availableSkills = Object.values(SKILLS).filter(s => isSkillAvailableForPlayer(s, p));

  const list = document.createElement('div');
  list.className = 'skills-list';
  
  availableSkills.forEach(skill => {
    const lvl = getSkillLevel(skill.id);
    const isLearned = lvl > 0;
    const isMaxed = lvl >= skill.maxLevel;
    const lockedByLevel = !!(skill.minLevel && p.level < skill.minLevel);   // v0.19
    const canUpgrade = !isMaxed && !lockedByLevel && p.skillPoints >= 1;
    
    const card = document.createElement('div');
    card.className = 'skill-card' + (isMaxed ? ' maxed' : (isLearned ? ' learned' : ''));
    
    let actionHtml;
    if (isMaxed) actionHtml = `<div class="skill-maxed-badge">МАКС</div>`;
    else if (lockedByLevel) actionHtml = `<button class="btn" disabled>🔒 Откроется на ${skill.minLevel} уровне</button>`;
    else if (!isLearned) actionHtml = canUpgrade
      ? `<button class="btn success" onclick="upgradeSkill('${skill.id}')">Изучить — 1 очко</button>`
      : `<button class="btn" disabled>Нужно 1 очко</button>`;
    else actionHtml = canUpgrade
      ? `<button class="btn success" onclick="upgradeSkill('${skill.id}')">Улучшить до Ур. ${lvl + 1} — 1 очко</button>`
      : `<button class="btn" disabled>Нужно 1 очко</button>`;
      
    const currentLevel = lvl > 0 ? lvl : 1;
    const descHtml = skill.getDesc(currentLevel);
    const nextHtml = isLearned && !isMaxed ? skill.getNextDesc(lvl) : (!isLearned ? skill.getNextDesc(0) : '');
    const levelBadge = isLearned ? `<div class="skill-card-level-badge">Ур. ${lvl}/${skill.maxLevel}</div>` : '';
    
    card.innerHTML = `
      <div class="skill-card-icon">${skill.icon || ''}${levelBadge}</div>
      <div class="skill-card-body">
        <div class="skill-card-name">${skill.name}</div>
        <div class="skill-card-type ${skill.type === 'active' ? 'active-skill' : 'passive-skill'}">${skill.type === 'active' ? 'Активный' : 'Пассивный'} · Ур. ${lvl} / ${skill.maxLevel}</div>
        <div class="skill-card-desc">${descHtml}</div>
        ${nextHtml ? `<div class="skill-card-next">${nextHtml}</div>` : ''}
        <div class="skill-card-action">${actionHtml}</div>
      </div>
    `;
    list.appendChild(card);
  });
  
  cont.innerHTML = header;
  cont.appendChild(list);
}

function upgradeSkill(skillId) {
  const p = state.player;
  const skill = SKILLS[skillId];
  if (!skill) return;
  const curLvl = getSkillLevel(skillId);
  if (curLvl >= skill.maxLevel) return;
  if (p.skillPoints < 1) return;
  if (skill.minLevel && p.level < skill.minLevel) return;   // v0.19: массовые — с 10 уровня

  p.skillPoints -= 1;
  p.learnedSkills[skillId] = curLvl + 1;

  if (curLvl === 0 && skill.type === 'active') {
    state.battle.skillToggles[skillId] = true;
    if (typeof tryAutoPlaceSkillInSlot === 'function') {
      tryAutoPlaceSkillInSlot(skillId);
    }
  }

  recalcStats();
  updateCharacterPanel();
  updateSkillPointsBadge();
  renderMentorSkills();
  renderSkillSlots();

  if (typeof renderSkillLoadout === 'function') renderSkillLoadout();

  logCombat(`✦ ${skill.name} → Ур. ${p.learnedSkills[skillId]}`, 'log-entry levelup');
  if (typeof markDeed === 'function') markDeed('mentor.learned');   // v0.31: тема у наставника
  if (typeof rapportService === 'function') rapportService('mentor');   // v0.32: отношения
  saveCurrentSlot();
}