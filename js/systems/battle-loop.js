// ========================================================
//  СИСТЕМЫ: БОЙ — ГЛАВНЫЙ ЦИКЛ ИГРЫ
//  gameLoop(): тик каждые 100 мс (из воркера).
//  Еда, баффы, регены, ATB-цикл, автостарт после ожидания,
//  переход между локациями.
//
//  НОВОЕ (v0.16):
//  + КД скиллов уменьшается ТОЛЬКО при ходе игрока (а не по dt).
//    Теперь 4 хода — это ровно 4 хода.
// ========================================================

function gameLoop() {
  const now = performance.now();
  const dt = Math.min(0.1, (now - state.lastTick) / 1000);
  state.lastTick = now;

  // ---- ЕДА (сытность) ----
  if (state.player.foodTimer > 0) {
    state.player.foodTimer -= dt;
    if (state.player.foodTimer <= 0) {
      state.player.foodTimer = 0;
      state.player.foodTickAccum = 0;
      logCombat(`🍖 Действие сытности закончилось.`, 'log-entry food');
    }
  }
  if (state.player.foodTimer > 0 && state.player.classId) {
    state.player.foodTickAccum = (state.player.foodTickAccum || 0) + dt;
    while (state.player.foodTickAccum >= 1) {
      state.player.foodTickAccum -= 1;
      if (state.player.hp < state.player.maxHp) {
        const heal = Math.min(FOOD_HEAL_PER_SEC, state.player.maxHp - state.player.hp);
        state.player.hp += heal;
        if (state.battle.active) spawnFloatDamage('fighter-player', Math.floor(heal), 'food');
      }
    }
  }

  // ---- v0.20: блюдо ----
  if (state.player.dish && state.player.dish.timer > 0) {
    state.player.dish.timer -= dt;
    if (state.player.dish.timer <= 0) {
      const d = DISHES[state.player.dish.id];
      state.player.dish = null;
      if (d) logCombat(`${d.icon} Действие блюда «${d.name}» закончилось.`, 'log-entry food');
      recalcStats();
      updateCharacterPanel();
    }
  }

  // ---- Гильдейские баффы ----
  if (state.player.guildBuffs) {
    let needRecalc = false;
    Object.keys(state.player.guildBuffs).forEach(buffId => {
      const b = state.player.guildBuffs[buffId];
      if (b && b.timer > 0) {
        b.timer -= dt;
        if (b.timer <= 0) {
          b.timer = 0;
          needRecalc = true;
          logCombat(`🔮 Действие усиления «${GUILD_BUFFS[buffId].name}» закончилось.`, 'log-entry levelup');
        }
      }
    });
    if (needRecalc) {
      recalcStats();
      updateCharacterPanel();
    }
  }

  // ---- Баффы таверны ----
  if (state.player.tavernBuffs) {
    Object.keys(state.player.tavernBuffs).forEach(buffId => {
      const b = state.player.tavernBuffs[buffId];
      if (b && b.timer > 0) {
        b.timer -= dt;
        if (b.timer <= 0) {
          b.timer = 0;
          if (TAVERN_BUFFS[buffId]) {
            logCombat(`🍺 Действие «${TAVERN_BUFFS[buffId].name}» закончилось.`, 'log-entry levelup');
          }
        }
      }
    });
  }

  // ---- Регены (вне боя и в бою) ----
  if (!state.battle.active) {
    state.regenAccumulator += dt;
    while (state.regenAccumulator >= 1) {
      state.regenAccumulator -= 1;
      if (state.player.hp < state.player.maxHp && state.player.classId) {
        const regenHp = 1 + (state.player.hpRegenOutBonus || 0);
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + regenHp);
      }
    }
    state.mpRegenAccumulator += dt;
    while (state.mpRegenAccumulator >= 1) {
      state.mpRegenAccumulator -= 1;
      if (state.player.mp < state.player.maxMp && state.player.classId) {
        const regenMp = (state.player.mpRegenOut || 1) + (state.player.mpRegenOutBonus || 0);
        state.player.mp = Math.min(state.player.maxMp, state.player.mp + regenMp);
      }
    }
    updateTopStatus();
    renderEffectsPanel();
  } else {
    if (state.player.hasManaRegenPassive) {
      state.battle.mpRegenAccum = (state.battle.mpRegenAccum || 0) + dt * (state.player.mpRegenIn || 0.5);
      while (state.battle.mpRegenAccum >= 1) {
        state.battle.mpRegenAccum -= 1;
        if (state.player.mp < state.player.maxMp) {
          state.player.mp = Math.min(state.player.maxMp, state.player.mp + 1);
        }
      }
    }

    if (state.player.hpRegenIn && state.player.hpRegenIn > 0) {
      state.battle.hpRegenAccum = (state.battle.hpRegenAccum || 0) + dt * state.player.hpRegenIn;
      while (state.battle.hpRegenAccum >= 1) {
        state.battle.hpRegenAccum -= 1;
        if (state.player.hp < state.player.maxHp) {
          const heal = Math.min(1, state.player.maxHp - state.player.hp);
          state.player.hp += heal;
          spawnFloatDamage('fighter-player', Math.floor(heal), 'heal');
        }
      }
    }

    renderEffectsPanel();
  }

  // ---- АВТОСТАРТ ПОСЛЕ ОЖИДАНИЯ ----
  if (state.battle.waitingForResume && !state.battle.active) {
    updateAutoWaitIndicator();
    // v0.25: на привале окно боя открыто поверх любой вкладки — ждать «Охоту» не нужно
    // (охоту можно начать «Искать стаю» с любой вкладки, и привал зависал навсегда).
    const restOpen = typeof REST !== 'undefined' && REST.shown;
    if (isReadyToResume() && state.battle.waitingTemplate) {
      if (!isOnHuntTab() && !restOpen) {
        // Ждём возврата на «Охота».
      } else {
        const tpl = state.battle.waitingTemplate;
        const template = [...MONSTERS, ...MINE_MONSTERS].find(mm => mm.id === tpl.id);
        if (template) {
          logCombat(`▶ Восстановление завершено. Возобновляем бой.`, 'log-entry levelup');
          showToast('▶', 'Бой возобновлён');
          state.battle.waitingForResume = false;
          state.battle.waitingTemplate = null;
          startBattle(template, tpl.variantId, tpl.count || 1);
        }
      }
    }
  }

  // ========================================================
  //  ATB-ЦИКЛ БОЯ
  // ========================================================
  if (state.battle.active && state.battle.monsters && state.battle.monsters.length > 0 && state.player.hp > 0) {
    const aliveMonsters = state.battle.monsters.filter(m => m.hp > 0);
    if (aliveMonsters.length === 0) {
      updateBattleUI();
      return;
    }

    const p = state.player;
    const locMult = (LOCATION_PLAYER_ATB_MULT && LOCATION_PLAYER_ATB_MULT[p.currentLocation]) || 1.0;

    // ---- ПАУТИНА замедляет ATB игрока ----
    const webDebuff = getDebuff('player', 'web');
    const webMult = (webDebuff && webDebuff.atbMult) ? webDebuff.atbMult : 1.0;

    const playerSpeed = p.atbSpeed * 0.5 * locMult * webMult;
    const monsterSpeed = 0.7 * 0.5;

    // ---- v0.20: ручной режим — пока игрок выбирает действие, бой на паузе ----
    if (!state.battle.autoBattle && state.battle.manualWait) {
      document.getElementById('battle-status').textContent = 'Ваш ход';
      manualTick(dt);
    } else {
      state.battle.playerATB += playerSpeed * dt;
      // v0.23: у каждого моба своя шкала. Пока скорость у всех одинаковая.
      // monstersATB остался как «часы стаи» — по ним идут тики дебаффов (следующий шаг).
      state.battle.monstersATB += monsterSpeed * dt;
      for (const m of state.battle.monsters) {
        if (m.hp > 0) m.atb = (m.atb || 0) + monsterSpeed * dt;
      }
      document.getElementById('battle-status').textContent = 'ATB заряжается...';

      // ---- Ход игрока (общий для автобоя и ручного режима, см. battle-manual.js) ----
      if (state.battle.playerATB >= 1) {
        if (state.battle.autoBattle || getDebuff('player', 'stun')) doPlayerTurn(null);
        else startManualWait();
      }
    }

    // ---- Ход монстров: бьёт каждый, у кого заполнилась СВОЯ шкала (v0.23) ----
    const readyMonsters = state.battle.monsters.filter(m => m.hp > 0 && (m.atb || 0) >= 1);
    readyMonsters.forEach(m => { m.atb = 0; });

    for (const attacker of readyMonsters) {
        if (!state.battle.active) break;
        if (state.player.hp <= 0) break;
        if (attacker.hp <= 0) continue;

        // ---- v0.19.1: Паралич от Разряда дроу (потом 2 хода невосприимчивости) ----
        if (getDebuff('monster', 'paralysis', attacker.index)) {
          removeDebuff('monster', 'paralysis', attacker.index);
          addDebuff('monster', 'paraImmune', attacker.index, { turnsLeft: 2 });
          logCombat(`⚡ ${attacker.name} парализован и пропускает удар.`, 'log-entry player-magic');
          spawnFloatDamage('fighter-monster', 0, 'block', { mon: attacker, text: 'ПАРАЛИЧ' });
          continue;
        }
        const paraImm = getDebuff('monster', 'paraImmune', attacker.index);
        if (paraImm) {
          paraImm.turnsLeft = (paraImm.turnsLeft || 1) - 1;
          if (paraImm.turnsLeft <= 0) removeDebuff('monster', 'paraImmune', attacker.index);
        }

        const freeze = getDebuff('monster', 'freeze', attacker.index);
        const stun   = getDebuff('monster', 'stun', attacker.index);

        if (freeze) {
          removeDebuff('monster', 'freeze', attacker.index);
          logCombat(`❄ ${attacker.name} пропускает удар (заморожен).`, 'log-entry magic');
          spawnFloatDamage('fighter-monster', 0, 'block');
          continue;
        }
        if (stun) {
          removeDebuff('monster', 'stun', attacker.index);
          logCombat(`💫 ${attacker.name} пропускает удар (оглушён).`, 'log-entry player-skill');
          spawnFloatDamage('fighter-monster', 0, 'block');
          continue;
        }

        monsterAttack(attacker);
    }

    // ---- «Часы стаи»: тики горения, кровотечения, Гниения, Жадности ----
    // (пока как раньше — раз в общий ход стаи; свои часы сделаем следующим шагом)
    if (state.battle.monstersATB >= 1) {
      state.battle.monstersATB = 0;

      const current = getCurrentMonster();
      if (current && current.hp > 0) {
        if (getDebuff('monster', 'burn', current.index)) {
          applyBurnTick();
        }
        if (getDebuff('monster', 'bleed', current.index) && current.hp > 0) {
          applyBleedTick();
        }
        if (getDebuff('monster', 'wound', current.index) && current.hp > 0) {
          applyWoundTick();
        }
      }

      if (state.battle.active) {
        for (const m of state.battle.monsters) {
          if (m.hp > 0) {
            applyGreedMarkTick(m);
          }
        }
      }

      // ---- v0.19: Гниение (Мор орка) — по всем мобам, на ком висит ----
      if (state.battle.active && typeof applyRotTicks === 'function') {
        applyRotTicks();
      }

      if (state.battle.active && state.player.hp > 0 && getDebuff('player', 'bleed')) {
        applyBleedTickOnPlayer();
      }
    }

    updateBattleUI();
  }

  // ---- Переход между локациями ----
  if (state.travel.active) {
    state.travel.timer -= dt;
    const elapsed = state.travel.duration - state.travel.timer;
    const total = state.travel.duration || 30;
    document.getElementById('travel-fill').style.width = (elapsed / total * 100) + '%';
    document.getElementById('travel-time').textContent = Math.max(0, Math.ceil(state.travel.timer));
    if (state.travel.timer <= 0) finishTravel();
  }
}