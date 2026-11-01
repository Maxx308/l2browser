// ========================================================
//  ДАННЫЕ: ДИАЛОГИ
//  Дерево реплик для NPC.
// ========================================================

const DIALOGUES = {
  elder: {
    start: 'greet',

    getStartNode: () => getElderStartNode(),

    nodes: {
      greet: {
        text: 'Что за... Ты откуда взялся?! Прямо из воздуха! Ни ворот, ни тропы, ни стражи не заметили... А ты, я смотрю, и не одет толком, и оружия нет.\n\nСлушай, парень, здесь опасно. За воротами — волки, бандиты, всякое. Хочешь — подкину тебе что-нибудь из старых запасов?',
        options: [
          { text: 'Да, помоги', onSelect: () => acceptFirstStepsQuest() },
          { text: 'Нет, я сам', next: 'decline' },
        ],
      },

      decline: {
        text: 'Ну как хочешь. Только за воротами без оружия не ходят, запомни.\n\nПередумаешь — заходи. Пока ты молодой, помогу.',
        options: [
          { text: 'Ладно', action: 'close' },
        ],
      },

      too_late: {
        text: 'Слушай, парень, ты уже не новичок. Обойдёшься без старых запасов. Ступай.',
        options: [
          { text: 'Понял', action: 'close' },
        ],
      },

      remind_potion: {
        text: 'Ну что, сгонял к торговцу? Купи <span style="color:#80e080; font-weight:700; font-size:1.1em;">Зелье малого лечения</span>. Оно восстанавливает 50 HP.\n\nКстати, в бою зелье можно поставить в слот — оно будет само применяться, когда HP упадёт ниже порога.',
        options: [
          { text: 'Понял', action: 'close' },
        ],
      },

      remind_mixture: {
        text: 'Зелье есть — молодец. Теперь купи <span style="color:#80e080; font-weight:700; font-size:1.1em;">Микстуру атаки</span>. Она на 100 ударов даёт +30% урона. Тоже в слот ставится.',
        options: [
          { text: 'Понял', action: 'close' },
        ],
      },

      choose_weapon: {
        text: 'Держи, парень. Выбери, с чем пойдёшь. Тут всё старое, ржавое, но послужит.',
        options: [
          { text: '🗡 Меч',      onSelect: () => pickStarterWeapon('sword') },
          { text: '🪓 Топор',    onSelect: () => pickStarterWeapon('axe') },
          { text: '🏏 Дубина',   onSelect: () => pickStarterWeapon('club') },
          { text: '🔪 Кинжал',   onSelect: () => pickStarterWeapon('dagger') },
          { text: '🔱 Копьё',    onSelect: () => pickStarterWeapon('spear') },
          { text: '🏹 Лук',      onSelect: () => pickStarterWeapon('bow') },
          { text: '🎯 Арбалет',  onSelect: () => pickStarterWeapon('crossbow') },
          { text: '🔮 Посох',    onSelect: () => pickStarterWeapon('staff') },
          { text: 'Позже выберу', action: 'close' },
        ],
      },

      final: {
        text: 'Вот, держи. Удачи. И запомни: за воротами без оружия не ходят.',
        options: [
          { text: 'Спасибо', action: 'close' },
        ],
      },

      done_greet: {
        text: 'Ступай, парень. Удачи за воротами. Если что — заходи.',
        options: [
          { text: 'Спасибо', action: 'close' },
        ],
      },
    },
  },
};

function getElderStartNode() {
  const started = isQuestStarted('firstSteps');
  const progress = getQuestProgress('firstSteps');

  if (progress && progress.stage === 'done') return 'done_greet';

  if (!started) {
    if (!isQuestAvailable('firstSteps')) return 'too_late';
    return 'greet';
  }

  updateQuestProgress('firstSteps');
  const stage = state.player.quests['firstSteps'].stage;

  if (stage === 'need_potion')  return 'remind_potion';
  if (stage === 'need_mixture') return 'remind_mixture';
  if (stage === 'need_weapon')  return 'choose_weapon';
  if (stage === 'done')         return 'done_greet';

  return 'greet';
}

function acceptFirstStepsQuest() {
  if (!isQuestStarted('firstSteps')) {
    state.player.gold += 100;
    updateTopStatus();
    logCombat('🪙 Старейшина выдал 100 Оболов на первое время.', 'log-entry');
    showToast('🪙', '+100 Оболов');
  }

  startQuest('firstSteps');
  closeDialogue();
  setTimeout(() => openDialogue('elder'), 250);
}

function pickStarterWeapon(weaponType) {
  const weapon = STARTER_WEAPONS[weaponType];
  if (!weapon) return;

  const drop = {
    name: weapon.name,
    type: weapon.type,
    icon: weapon.icon,
    iconKey: weapon.iconKey,
    sellPrice: weapon.sellPrice,
    stats: weapon.stats,
    twoHanded: weapon.twoHanded || false,
  };

  addToInventory(drop);

  const p = state.player;
  const idx = p.inventory.findIndex(i => i.name === weapon.name);
  if (idx >= 0) {
    const item = p.inventory[idx];
    equipItem(item);
  }

  renderInventory();
  renderEquipSlots();
  updateCharacterPanel();
  updateInventoryFooter();

  completeQuest('firstSteps');

  logCombat(`⚔ Получено: ${weapon.name}`, 'log-entry kill');
  showToast('⚔', `Получено: ${weapon.name}`);

  closeDialogue();
  setTimeout(() => openDialogue('elder'), 250);
}