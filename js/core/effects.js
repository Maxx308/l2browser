// ========================================================
//  ЯДРО: ПАНЕЛЬ ЭФФЕКТОВ
//  Рисует чипы эффектов в ДВЕ панели:
//    #effects-panel         — вне боя (город/инвентарь)
//    #effects-panel-battle  — внутри боя (overlay)
//
//  + Чип активной микстуры (с счётчиком зарядов).
//  + Цвет по типу микстуры.
//  + Пульсация при низких зарядах.
// ========================================================

function renderEffectsPanel() {
  const p = state.player;
  const eff = state.battle.activeEffects;
  const chips = [];

  // Сытность (еда)
  if (p.foodTimer > 0) {
    chips.push(`<div class="effect-chip food"><span class="ec-icon">🍖</span><span class="ec-name">Сытность</span><span class="ec-value">${formatTime(p.foodTimer)}</span></div>`);
  }
  // v0.20: блюдо
  if (p.dish && p.dish.timer > 0 && DISHES[p.dish.id]) {
    const d = DISHES[p.dish.id];
    chips.push(`<div class="effect-chip food" title="${d.name}: ${d.text}"><span class="ec-icon">${d.icon}</span><span class="ec-name">${d.text}</span><span class="ec-value">${formatTime(p.dish.timer)}</span></div>`);
  }

  // Активная микстура
  const activeMix = state.battle.activeEffects.mixture;
  if (activeMix) {
    const data = MIXTURE_EFFECTS[activeMix.id];
    if (data) {
      // Короткое имя для чипа.
      const shortNames = {
        atkMixture:   'Атака',
        atkMixture2:  'Атака II',
        luckMixture:  'Удача',
        defMixture:   'Крепость',
      };
      const shortName = shortNames[data.id] || data.name;

      // Цвет по типу микстуры.
      let cssClass = 'mixture';
      if (data.id === 'atkMixture' || data.id === 'atkMixture2') cssClass = 'mixture-atk';
      else if (data.id === 'luckMixture') cssClass = 'mixture-luck';
      else if (data.id === 'defMixture') cssClass = 'mixture-def';

      // Пульсация при низких зарядах.
      // Для playerAttacks/enemyAttacks — < 10. Для battles — < 5.
      let pulseClass = '';
      const threshold = (data.chargeType === 'battles') ? 5 : 10;
      if (activeMix.chargesLeft <= threshold) pulseClass = ' low';

      // SVG-иконка микстуры.
      const iconSvg = SVG[data.icon] || '⚗';

      chips.push(`<div class="effect-chip ${cssClass}${pulseClass}"><span class="ec-icon">${iconSvg}</span><span class="ec-name">${shortName}</span><span class="ec-value">(${activeMix.chargesLeft})</span></div>`);
    }
  }

  // Баффы гильдии
  Object.keys(p.guildBuffs).forEach(buffId => {
    const active = p.guildBuffs[buffId];
    if (!active || active.timer <= 0) return;
    const buff = GUILD_BUFFS[buffId];
    if (!buff) return;

    let icon = '🔮', cssClass = 'combat';
    if (buffId === 'berserk') { icon = '🩸'; cssClass = 'berserk'; }
    else if (buffId === 'eloquence') { icon = '💬'; cssClass = 'eloquence'; }

    chips.push(`<div class="effect-chip ${cssClass}"><span class="ec-icon">${icon}</span><span class="ec-name">${buff.name}</span><span class="ec-value">${formatTime(active.timer)}</span></div>`);
  });

  // Баффы таверны
  if (p.tavernBuffs) {
    Object.keys(p.tavernBuffs).forEach(buffId => {
      const active = p.tavernBuffs[buffId];
      if (!active || active.timer <= 0) return;
      const buff = TAVERN_BUFFS[buffId];
      if (!buff) return;

      let icon = '🍺';
      if (buffId === 'rest')  icon = '🛏';
      if (buffId === 'relax') icon = '🍺';

      chips.push(`<div class="effect-chip tavern"><span class="ec-icon">${icon}</span><span class="ec-name">${buff.name}</span><span class="ec-value">${formatTime(active.timer)}</span></div>`);
    });
  }

  const html = chips.length === 0
    ? ''
    : '<div class="effects-panel-title">ЭФФЕКТЫ</div>' + chips.join('');

  // Основная панель (вне боя)
  const panelMain = document.getElementById('effects-panel');
  if (panelMain) {
    if (chips.length === 0) {
      panelMain.classList.remove('active');
      panelMain.innerHTML = '';
    } else {
      panelMain.classList.add('active');
      panelMain.innerHTML = html;
    }
  }

  // Панель в бою (внутри overlay)
  const panelBattle = document.getElementById('effects-panel-battle');
  if (panelBattle) {
    if (chips.length === 0) {
      panelBattle.classList.remove('active');
      panelBattle.innerHTML = '';
    } else {
      panelBattle.classList.add('active');
      panelBattle.innerHTML = html;
    }
  }
}