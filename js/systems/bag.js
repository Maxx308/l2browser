// ========================================================
//  СИСТЕМЫ: ЗАПЛЕЧНИК РАСТЁТ (v0.35.1)
//  Поручения сумки — js/data/bag-quests.js (BAG_QUESTS, лежат и в QUESTS — для журнала).
//  state.player.bag = { level, v: 2 } — level = сколько поручений выполнено (+1 ячейка за каждое).
//  Нажатие на сумку в снаряжении — разговор (DIALOGUES.bagtalk), красная точка — он чего-то хочет.
//  «Убей» считается здесь (bagOnKill, из onMonsterDeath), «принеси» — как у жителей (сумка + склад).
// ========================================================

function bagLevel() {
  const b = state.player && state.player.bag;
  return (b && b.level) || 0;
}
// Сколько ячеек дал Заплечник.
function bagSlotBonus() { return bagLevel(); }

// Картинка и описание по уровню (BAG_LOOKS).
function bagLook() {
  const lvl = bagLevel();
  let look = BAG_LOOKS[0];
  BAG_LOOKS.forEach(l => { if (lvl >= l.from) look = l; });
  return look;
}
function bagLookImg() { return bagLook().img; }

// Номер текущего поручения (первое не выполненное); BAG_QUESTS.length — всё сделано.
function bagQuestIndex() {
  const i = BAG_QUESTS.findIndex(b => !isQuestDone(b.id));
  return i < 0 ? BAG_QUESTS.length : i;
}

// Что сейчас с поручением: none (ещё не знакомы) / wait (рано) / offer / active / ready / alldone.
function bagQuestState() {
  if (typeof bagMet !== 'function' || !bagMet()) return { status: 'none' };
  const i = bagQuestIndex();
  if (i >= BAG_QUESTS.length) return { status: 'alldone' };
  const q = BAG_QUESTS[i];
  const pr = getQuestProgress(q.id);
  if (!pr) return { q, status: state.player.level >= q.minLevel ? 'offer' : 'wait' };
  if (q.kill) return { q, status: pr.stage === 'ready' ? 'ready' : 'active' };
  return { q, status: questNeedsReady(q.id) ? 'ready' : 'active' };
}
function bagHasNews() {
  const s = bagQuestState().status;
  return s === 'offer' || s === 'ready';
}

// Счётчик «убей» для журнала.
function bagKillText(id) {
  const q = QUESTS[id];
  const pr = getQuestProgress(id);
  const n = (pr && pr.n) || 0;
  return `${q.kill.what}: ${Math.min(n, q.kill.n)} из ${q.kill.n}`;
}

// Подходит ли убитый под «убей».
function bagKillFits(k, m) {
  if (k.loc && getMonsterLocation(m.id) !== k.loc) return false;
  if (k.monster && m.id !== k.monster) return false;
  if (k.variant && (m.variantId || 'normal') !== k.variant) return false;
  if (k.night) {
    const tpl = MONSTERS.find(x => x.id === m.id);
    if (!tpl || !tpl.night || typeof worldTime !== 'function' || worldTime(true).phase.id !== 'night') return false;
  }
  return true;
}

// Из onMonsterDeath (battle-rewards.js).
function bagOnKill(m) {
  const st = bagQuestState();
  if (st.status !== 'active' || !st.q.kill) return;
  const q = st.q, pr = getQuestProgress(q.id);
  if (!pr || pr.stage !== 'work' || !bagKillFits(q.kill, m)) return;
  pr.n = (pr.n || 0) + 1;
  if (pr.n >= q.kill.n) {
    setQuestStage(q.id, 'ready');
    showToast('🎒', 'Заплечник: «Готово. Поговорим?»');
    updateBagDot();
  } else if (typeof isChronicleOpen === 'function' && isChronicleOpen()) {
    renderChronicle();
  }
}

// Красная точка на сумке в снаряжении.
function updateBagDot() {
  const slot = document.querySelector('.equip-slot[data-slot="bag"]');
  if (slot) slot.classList.toggle('has-news', bagHasNews());
}

// Взяться за поручение.
function bagStartQuest(q) {
  if (!q || isQuestStarted(q.id)) return;
  startQuest(q.id);
  const pr = getQuestProgress(q.id);
  if (q.kill) pr.n = 0;
  updateBagDot();
  saveCurrentSlot();
}

// Сдать поручение: забрать «принеси», +1 уровень и ячейка, новый вид на 10/20/30.
let __bagDone = null;   // последнее сданное — для текста ответа
function bagFinishQuest(q) {
  const st = bagQuestState();
  if (st.status !== 'ready' || st.q !== q) return;
  if (q.needs) takeQuestNeeds(q.id);
  const lookBefore = bagLook();
  completeQuest(q.id);
  const p = state.player;
  p.bag.level = BAG_QUESTS.filter(b => isQuestDone(b.id)).length;
  if (q.id === 'bag8' && typeof bumpChronicleCounter === 'function') bumpChronicleCounter('trust', 1);
  __bagDone = q;

  const lvl = p.bag.level;
  logCombat(`🎒 Заплечник подрос: уровень ${lvl}. Ячеек в сумке: ${invMaxSlots()} (+1).`, 'log-entry levelup');
  showToast('🎒', `Заплечник: уровень ${lvl} · +1 ячейка`);
  if (typeof annalsFirst === 'function') annalsFirst('bag.grew');
  if (typeof unlockLore === 'function') unlockLore('bag.grow');
  if (bagLook() !== lookBefore) {
    showToast('🎒', 'Заплечник выглядит иначе');
    if (typeof annalsFirst === 'function') annalsFirst('bag.look.' + bagLook().from);
    if (typeof unlockLore === 'function') unlockLore('bag.look' + bagLook().from);
  }

  if (typeof renderInventory === 'function') renderInventory();
  if (typeof updateInventoryFooter === 'function') updateInventoryFooter();
  if (typeof renderEquipSlots === 'function') renderEquipSlots();
  updateBagDot();
  saveCurrentSlot();
}

// «Не отдам» (камешек): доверие −1 один раз, поручение остаётся.
function bagRefuse(q) {
  const pr = getQuestProgress(q.id);
  if (!pr || pr.refused) return;
  pr.refused = true;
  if (typeof bumpChronicleCounter === 'function') bumpChronicleCounter('trust', -1);
  saveCurrentSlot();
}

// ---- Разговор с Заплечником (нажатие на сумку) ----
function bagTalkHead() {
  return `*Уровень ${bagLevel()} · ячеек в сумке: ${invMaxSlots()}*\n\n`;
}
function bagTalkProgress(q) {
  if (q.kill) return bagKillText(q.id);
  return q.needs.map((n, j) => questNeedText(q.id, j)).join('\n');
}

DIALOGUES.bagtalk = {
  start: 'hello',
  nodes: {
    hello: {
      text: () => {
        const st = bagQuestState(), q = st.q;
        if (st.status === 'offer')  return bagTalkHead() + q.ask;
        if (st.status === 'active') return bagTalkHead() + q.nag + '\n\n*' + bagTalkProgress(q) + '*';
        if (st.status === 'ready')  return bagTalkHead() + (q.kill ? 'Ну? Я же чувствую — дело сделано.' : 'Ну? Я же чувствую — всё при тебе.');
        if (st.status === 'wait')   return bagTalkHead() + BAG_WAIT;
        if (st.status === 'alldone') return bagTalkHead() + BAG_ALL_DONE;
        return bagTalkHead() + BAG_IDLE[Math.floor(Math.random() * BAG_IDLE.length)];
      },
      options: () => {
        const st = bagQuestState(), q = st.q;
        if (st.status === 'offer') return [
          { text: 'Ладно', next: 'yes' },
          { text: 'Потом', action: 'close' },
        ];
        if (st.status === 'ready') {
          const opts = [{ text: q.give, next: 'done' }];
          if (q.refuse && !getQuestProgress(q.id).refused) opts.push({ text: q.refuse, next: 'refuse' });
          return opts.concat([{ text: 'Потом', action: 'close' }]);
        }
        return [{ text: 'Ладно', action: 'close' }];
      },
    },
    yes: {
      onEnter: () => { const st = bagQuestState(); if (st.status === 'offer') bagStartQuest(st.q); },
      text: () => { const q = BAG_QUESTS[bagQuestIndex()]; return q ? q.yes : ''; },
      options: [{ text: 'Договорились', action: 'close' }],
    },
    done: {
      onEnter: () => { const st = bagQuestState(); if (st.status === 'ready') bagFinishQuest(st.q); },
      text: () => (__bagDone ? __bagDone.thanks : '') + `\n\n*Заплечник подрос: уровень ${bagLevel()} · ячеек в сумке: ${invMaxSlots()}.*`,
      options: [{ text: 'Носи на здоровье', action: 'close' }],
    },
    refuse: {
      onEnter: () => { const st = bagQuestState(); if (st.q && st.q.refuse) bagRefuse(st.q); },
      text: () => { const q = BAG_QUESTS[bagQuestIndex()]; return (q && q.refuseReply) || ''; },
      options: [{ text: 'Потом поговорим', action: 'close' }],
    },
  },
};

function openBagTalk() {
  if (typeof __activeDialogue !== 'undefined' && __activeDialogue) return;
  if (typeof hideTooltip === 'function') hideTooltip();
  openDialogue('bagtalk', 'hello');
}
