// ========================================================
//  ДАННЫЕ: ДИАЛОГИ
//  Дерево реплик для NPC.
//  v0.30: «{м|ж}» — окончания под пол героя (см. heroText в core/helpers.js).
// ========================================================

// Концовка ответа в болтовне со Старейшиной.
const ELDER_CHAT_TAIL = [
  { text: 'Ещё вопрос', next: 'chat' },
  { text: 'Ладно, пойду', action: 'close' },
];

const DIALOGUES = {
  elder: {
    start: 'greet',

    getStartNode: () => getElderStartNode(),

    nodes: {
      greet: {
        text: 'Что за... Ты откуда взял{ся|ась}?! Прямо из воздуха! Ни ворот, ни тропы, ни стражи не заметили... А ты, я смотрю, и не одет{|а} толком, и оружия нет.\n\nСлушай, {парень|дочка}, это Андервуд, и здесь опасно. За воротами — волки, бандиты, всякое. Хочешь — подкину тебе что-нибудь из старых запасов?',
        options: [
          { text: 'Да, помоги', onSelect: () => acceptFirstStepsQuest() },
          { text: 'Нет, я {сам|сама}', next: 'decline' },
        ],
      },

      decline: {
        text: 'Ну как хочешь. Только за воротами без оружия не ходят, запомни.\n\nПередумаешь — заходи. Пока ты {молодой|молодая}, помогу.',
        options: [
          { text: 'Ладно', action: 'close' },
        ],
      },

      too_late: {
        text: 'Слушай, {парень|дочка}, ты уже не {новичок|новенькая}. Обойдёшься без старых запасов. Ступай.',
        options: [
          { text: 'Можно спросить?', next: 'chat' },
          { text: '{Понял|Поняла}', action: 'close' },
        ],
      },

      remind_potion: {
        text: 'Ну что, сгонял{|а} к торговцу? Купи <span style="color:#80e080; font-weight:700; font-size:1.1em;">Зелье малого лечения</span>. Оно восстанавливает 50 HP.\n\nКстати, в бою зелье можно поставить в слот — оно будет само применяться, когда HP упадёт ниже порога.',
        options: [
          { text: '{Понял|Поняла}', action: 'close' },
        ],
      },

      remind_mixture: {
        text: 'Зелье есть — молодец. Теперь купи <span style="color:#80e080; font-weight:700; font-size:1.1em;">Микстуру атаки</span>. Она на 100 ударов даёт +30% урона. Тоже в слот ставится.',
        options: [
          { text: '{Понял|Поняла}', action: 'close' },
        ],
      },

      choose_weapon: {
        text: 'Держи, {парень|дочка}. Выбери, с чем пойдёшь. Тут всё старое, ржавое, но послужит.',
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
        text: 'Ступай, {парень|дочка}. Удачи за воротами. Если что — заходи.',
        options: [
          { text: 'Можно спросить?', next: 'chat' },
          { text: 'Спасибо', action: 'close' },
        ],
      },

      // v0.30: «захотел — поболтал». Каждый ответ открывает кусок Энциклопедии;
      // заданный вопрос помечен галочкой, его можно перечитать.
      chat: {
        text: 'Спрашивай, пока я добрый.',
        options: [
          { text: () => elderAsked('underwood.place') + 'Где я вообще?', next: 'ask_where' },
          { text: () => elderAsked('underwood.power') + 'Кто здесь главный?', next: 'ask_power' },
          { text: () => elderAsked('underwood.trouble') + 'Откуда здесь монстры?', next: 'ask_monsters' },
          { text: () => elderAsked('underwood.history') + 'Давно стоит Андервуд?', next: 'ask_history' },
          { text: 'Ладно, пойду', action: 'close' },
        ],
      },

      ask_where: {
        text: 'В Андервуде. На карте — окраина столичных земель Объединённого королевства. А отсюда — край света: до столичных стен неделя пути, и там до нас дела нет.',
        onEnter: () => unlockLore('underwood.place'),
        options: ELDER_CHAT_TAIL,
      },

      ask_power: {
        text: 'Я, выходит. Выбрали лет сорок назад — с тех пор и пытаюсь наладить дела. Столичная стража заглядывает раз в сезон: налог возьмёт — и уедет.',
        onEnter: () => { unlockLore('underwood.power'); unlockLore('elder.years'); },
        options: ELDER_CHAT_TAIL,
      },

      ask_monsters: {
        text: 'А кто ж знает. Лет сто назад волки были просто волками. Потом пошли твари — и мелкие да пакостные, и крупные. У нас-то ещё ничего! Есть места, говорят, где от этой нечисти совсем не продохнуть.\n\nА такие, как ты, уже и не редкость. Сколько я вас повидал — не счесть. Появляются и уходят: кто сгинет, а кто, наоборот, до самых верхов поднимается. Говорят, сам Король из ваших… ну, из Появленцев, как мы вас зовём.',
        onEnter: () => { unlockLore('underwood.trouble'); unlockLore('underwood.newcomers'); },
        options: ELDER_CHAT_TAIL,
      },

      ask_history: {
        text: 'Старше меня. Говорят, поставили в первые годы новой эры, когда люди снова стали селиться у дорог. А что было до — в книгах пишут разное. Но одно знаю точно: селились тут на готовом. Что-то здесь и раньше стояло.',
        onEnter: () => { unlockLore('underwood.history'); unlockLore('elder.books'); },
        options: ELDER_CHAT_TAIL,
      },
    },
  },
};

// ========================================================
//  v0.30: ЗАПЛЕЧНИК — первое знакомство с сумкой.
//  Запускается при первом наведении/нажатии на слот сумки (js/systems/chronicle.js).
//  Тексты общие с летописью: «*…*» — действие/описание (не речь), «{м|ж}» — пол героя.
//  trust — сдвиг скрытой шкалы доверия (за встречу от −2 до +2).
// ========================================================
const BAG_MEET = {
  greet: 'Ну? Чего уставил{ся|ась}? Сумок не видел{|а}?.. Ладно, ладно. Давай знакомиться. Только сразу предупреждаю: я понятия не имею, что тут происходит.',
  first: [
    { text: '[Сбросить сумку с плеч]', trust: -1,
      reply: '*Ремни соскальзывают с плеч, сумка падает в траву.\nМоргаешь — и она снова за спиной. Ремни на месте, будто их и не трогали.*\n\n…Вот и я не понял, как это работает. Похоже, мы теперь вместе. Моя пре-е-елесть.\n…Тьфу. Откуда это вообще?' },
    { text: '[Промолчать]', trust: 0,
      reply: 'Молчишь? Ладно. Я и за двоих поговорить могу. Привык… Хотя к чему привык — не помню.' },
    { text: 'Я тоже ничего не понимаю', trust: 1,
      reply: 'Да? Ну хоть в этом мы заодно. Уже что-то.' },
  ],
  naming: 'Как меня звать?.. Погоди. Вертится что-то… Заплечник. Да. Зови меня Заплечником. Почему так? Понятия не имею. Само всплыло.',
  name: [
    { text: 'Подходит', trust: 1, reply: 'Вот и я думаю. Как влитое.' },
    { text: 'Странное имя', trust: 0, reply: 'Вишу за плечом — значит, Заплечник. Всё логично. Наверное.' },
    { text: 'Буду звать тебя мешком', trust: -1, reply: 'Попробуй.' },
  ],
  final: 'Договоримся так: ты складываешь, я храню. Остальное — потом.',
};

// Узлы разговора: greet → first_N (ответ + имя) → name_N (реакция + уговор).
function buildBagMeetNodes() {
  const nodes = {
    greet: { text: BAG_MEET.greet, options: BAG_MEET.first.map((o, i) => ({ text: o.text, next: 'first_' + i })) },
  };
  BAG_MEET.first.forEach((o, i) => {
    nodes['first_' + i] = {
      text: o.reply + '\n\n' + BAG_MEET.naming,
      onEnter: () => bagMeetChoose('first', i),
      options: BAG_MEET.name.map((n, j) => ({ text: n.text, next: 'name_' + j })),
    };
  });
  BAG_MEET.name.forEach((n, j) => {
    nodes['name_' + j] = {
      text: n.reply + '\n\n' + BAG_MEET.final,
      onEnter: () => bagMeetChoose('name', j),
      options: [{ text: 'Договорились', action: 'close' }],
    };
  });
  return nodes;
}
DIALOGUES.bag = { start: 'greet', nodes: buildBagMeetNodes() };

// Галочка у вопроса, который уже задавали.
function elderAsked(loreKey) {
  return (typeof knowsLore === 'function' && knowsLore(loreKey)) ? '✓ ' : '';
}

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
    if (typeof unlockLoreArticle === 'function') unlockLoreArticle('obol');   // v0.30: Энциклопедия — Обол
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