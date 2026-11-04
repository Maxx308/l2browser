// ========================================================
//  ДАННЫЕ: КВЕСТЫ
//  «Первые шаги» (Старейшина) и v0.32 — поручения жителей.
//  v0.32: поручение жителя берётся и сдаётся в разговоре (темы с act в OWNER_CHATS);
//    offered — когда поручение «можно взять» (житель уже попросил);
//    needs — что принести (считается по сумке и складу, сдаётся темой разговора);
//    шаг: text может быть функцией (счётчик «3 из 5»), done — свой признак «готово».
//    Награда — не скидка: отношения с жителем, новые темы, запись в летописи.
//
//  Все стартовые оружия — ТИР 1 (точатся до +5).
//  PNG-иконки из img/weapons/starter/.
// ========================================================

const QUESTS = {
  firstSteps: {
    id: 'firstSteps',
    name: 'Первые шаги',
    desc: 'Старейшина Андервуда даёт новичку первые задания.',
    maxLevel: 2,
    stages: ['need_potion', 'need_mixture', 'need_weapon', 'done'],
    // v0.30: для журнала «Поручения» (Хроники)
    giver: 'Старейшина', place: 'Андервуд',
    journal: 'Старейшина помогает тем, кто появился из воздуха. Говорит, за воротами без оружия не ходят.',
    offer: 'Старейшина предлагал помочь новичку. Загляни к нему, пока не поздно.',
    steps: [
      { stage: 'need_potion',  text: 'Купить у Торговца Зелье малого лечения' },
      { stage: 'need_mixture', text: 'Купить у Торговца Микстуру атаки' },
      { stage: 'need_weapon',  text: 'Вернуться к Старейшине и выбрать оружие' },
    ],
    reward: '100 Оболов на первое время и старое оружие на выбор',
  },

  // v0.32: Гундар — тайком, «для знакомого». Берётся и сдаётся в разговоре с кузнецом.
  smithBeard: {
    id: 'smithBeard',
    name: 'Средство для бороды',
    desc: 'Кузнец просит тайком принести всё для одного средства.',
    stages: ['need_items', 'done'],
    giver: 'Кузнец', place: 'Андервуд',
    journal: 'Гундар просил принести всё для «средства для роста». Бороды. Говорит — для знакомого. И сестре — ни слова.',
    offer: 'Кузнец мялся и просил кое-что принести — тайком. Загляни к нему, если надумаешь.',
    offered: () => ownerTopicAsked('smith', 'beard'),
    rapport: { smith: 10, refiner: 3 },   // сестра всё равно узнает
    needs: [
      { name: 'Жабья шкура',   qty: 5, where: 'с Жаб на Зелёной поляне' },
      { name: 'Пещерный гриб', qty: 5, where: 'в Копях' },
    ],
    steps: [
      { stage: 'need_items', text: () => questNeedText('smithBeard', 0), done: () => questNeedMet('smithBeard', 0) },
      { stage: 'need_items', text: () => questNeedText('smithBeard', 1), done: () => questNeedMet('smithBeard', 1) },
      { stage: 'need_items', text: 'Тайком отнести кузнецу' },
    ],
    reward: 'Гундар запомнит. По-своему.',
  },

  // v0.32: Торговец — ящик из разграбленного обоза. Находка — с Бандитов. Открывать или нет — выбор героя.
  traderBox: {
    id: 'traderBox',
    name: 'Ящик без надписи',
    desc: 'Бандиты потрепали обоз Торговца — пропал небольшой ящик.',
    stages: ['find', 'return', 'done'],
    giver: 'Торговец', place: 'Андервуд',
    journal: 'Бандиты на тракте потрепали обоз Торговца. Пропал небольшой ящик без надписи. Торговец обещал заплатить — и просил не открывать.',
    offer: 'Торговец жаловался на убытки: бандиты утащили какой-то ящик. Загляни к нему, если надумаешь искать.',
    offered: () => ownerTopicAsked('trader', 'convoy'),
    find: { stage: 'find', next: 'return', monsters: ['bandit'], chance: 8, icon: '📦',
      toast: 'Ящик без надписи — похоже, тот самый',
      log: '📦 Среди добычи бандита — небольшой ящик без надписи. Похоже, тот самый.' },
    steps: [
      { stage: 'find',   text: 'Найти ящик без надписи — у Бандитов на Зелёной поляне' },
      { stage: 'return', text: 'Вернуть ящик Торговцу (он просил не открывать)' },
    ],
    reward: 'Торговец обещал заплатить. «Почти честно».',
  },

  // v0.32: Марфа — козёл Борька удрал к Поляне. Находка — у Волков.
  hostessBorka: {
    id: 'hostessBorka',
    name: 'Где Борька?',
    desc: 'Козёл Марфы опять удрал за частокол.',
    stages: ['find', 'return', 'done'],
    giver: 'Хозяйка таверны', place: 'Андервуд',
    journal: 'Борька — рыжий козёл Марфы с обломанным рогом — третий день не возвращается. Его видели у Поляны, где ходят волки.',
    offer: 'Марфа места себе не находит: Борька опять удрал. Загляни к ней, если захочешь помочь.',
    offered: () => ownerTopicAsked('hostess', 'borka'),
    rapport: { hostess: 10 },
    find: { stage: 'find', next: 'return', monsters: ['wolf'], chance: 6, icon: '🐐',
      toast: 'Борька нашёлся!',
      log: '🐐 За кустами — отчаянное блеяние. Рыжий козёл с обломанным рогом стоит на пне, а внизу — волки. Были. Борька фыркает, бодает тебя на прощание и рысью уходит к Андервуду.' },
    steps: [
      { stage: 'find',   text: 'Поискать Борьку у Волков на Зелёной поляне' },
      { stage: 'return', text: 'Сказать Марфе, что Борька нашёлся' },
    ],
    reward: 'Марфа будет рада. Очень.',
  },

  // v0.32: Хильда — застёжка на бороду брату ко дню кования. Тайком от Гундара.
  refinerGift: {
    id: 'refinerGift',
    name: 'Подарок, который он не заслужил',
    desc: 'Хильда мастерит подарок брату.',
    stages: ['need_items', 'done'],
    giver: 'Мастерица', place: 'Андервуд',
    journal: 'У Гундара скоро день кования. Хильда хочет сделать ему застёжку на бороду — из меди и рубина. Брату — ни слова.',
    offer: 'Хильда что-то мастерит тайком от брата. Загляни к ней, если хочешь помочь.',
    offered: () => ownerTopicAsked('refiner', 'gift'),
    rapport: { refiner: 10, smith: 3 },   // брат тоже узнает — и сделает вид, что нет
    needs: [
      { name: 'Медь',        qty: 5, where: 'с Гоблинов в Копях' },
      { name: 'Сырой рубин', qty: 1, where: 'с Гоблинов в Копях, редко' },
    ],
    steps: [
      { stage: 'need_items', text: () => questNeedText('refinerGift', 0), done: () => questNeedMet('refinerGift', 0) },
      { stage: 'need_items', text: () => questNeedText('refinerGift', 1), done: () => questNeedMet('refinerGift', 1) },
      { stage: 'need_items', text: 'Отнести Хильде, пока брат не видит' },
    ],
    reward: 'Хильда не скажет спасибо вслух. Но запомнит.',
  },

  // v0.32: Урдах — угасающий рунный камень. Цепочка через Лиэль: показать → сапфиры → вернуть.
  mentorStone: {
    id: 'mentorStone',
    name: 'Угасающий камень',
    desc: 'Рунный камень наставника гаснет.',
    stages: ['to_liel', 'need_items', 'to_urdah', 'done'],
    needsStage: 'need_items',
    giver: 'Наставник', place: 'Андервуд',
    journal: 'Рунный камень на шее Урдаха гаснет. Он отдал его тебе — показать эльфийке из Гильдии. «Только не говори, чей».',
    offer: 'Камень на шее наставника едва теплится. Может, кто-то в Андервуде знает, что с ним?',
    offered: () => ownerTopicAsked('mentor', 'stone'),
    rapport: { mentor: 10 },
    needs: [
      { name: 'Сырой сапфир', qty: 2, where: 'с Кобольдов в Копях, редко' },
    ],
    steps: [
      { stage: 'to_liel',    text: 'Показать камень эльфийке в Гильдии магов' },
      { stage: 'need_items', text: () => questNeedText('mentorStone', 0), done: () => questNeedMet('mentorStone', 0) },
      { stage: 'need_items', text: 'Отдать сапфиры эльфийке' },
      { stage: 'to_urdah',   text: 'Вернуть камень наставнику' },
    ],
    reward: 'Орки не говорят спасибо.',
  },

  // v0.32: Лиэль — «очень старое, не наше, не мирское». Находка — в Копях.
  lielShard: {
    id: 'lielShard',
    name: 'Очень старое',
    desc: 'Эльфийка ищет то, что было здесь до Андервуда.',
    stages: ['find', 'return', 'done'],
    giver: 'Эльфийка из Гильдии', place: 'Андервуд',
    journal: 'Лиэль просила показать ей что-нибудь очень старое — «не наше, не мирское». Говорит, искать надо в Копях, глубоко: люди закапывают прошлое, а камень его хранит.',
    offer: 'Лиэль ищет что-то очень старое. Загляни к ней, если возьмёшься помочь.',
    offered: () => ownerTopicAsked('guildmage', 'old') && rapportStage('guildmage') >= 1,
    rapport: { guildmage: 10 },
    find: { stage: 'find', next: 'return', loc: 'mine', chance: 3, icon: '✨',
      toast: 'Что-то очень старое…',
      log: '✨ Среди камней что-то тускло блеснуло: черепок — гладкий, тёплый, с узором, которого не делал ни один здешний мастер.' },
    steps: [
      { stage: 'find',   text: 'Найти в Копях что-нибудь очень старое' },
      { stage: 'return', text: 'Показать находку эльфийке' },
    ],
    reward: 'Она умеет быть благодарной. Говорит.',
  },
};

// ========================================================
//  СТАРТОВЫЕ ОРУЖИЯ (ТИР 1)
//  Выдаются по выбору в конце квеста «Первые шаги».
//  Все обычные (white), без бонусов.
// ========================================================

const STARTER_WEAPONS = {
  sword: {
    id: 'starterSword',
    name: 'Ржавый меч',
    type: 'weapon',
    icon: 'img/weapons/starter/sword.png',
    sellPrice: 3,
    tier: 1,
    stats: { pAtk: 4 },
  },
  axe: {
    id: 'starterAxe',
    name: 'Старый топор',
    type: 'weapon',
    icon: 'img/weapons/starter/axe.png',
    sellPrice: 3,
    tier: 1,
    stats: { pAtk: 4 },
  },
  club: {
    id: 'starterClub',
    name: 'Кривая дубина',
    type: 'weapon',
    icon: 'img/weapons/starter/club.png',
    sellPrice: 3,
    tier: 1,
    stats: { pAtk: 4 },
  },
  dagger: {
    id: 'starterDagger',
    name: 'Тусклый кинжал',
    type: 'weapon',
    icon: 'img/weapons/starter/dagger.png',
    sellPrice: 3,
    tier: 1,
    stats: { pAtk: 4 },
  },
  spear: {
    id: 'starterSpear',
    name: 'Треснувшее копьё',
    type: 'weapon',
    icon: 'img/weapons/starter/spear.png',
    sellPrice: 3,
    twoHanded: true,
    tier: 1,
    stats: { pAtk: 5 },   // v0.27: двуручное сильнее
  },
  bow: {
    id: 'starterBow',
    name: 'Кривой лук',
    type: 'weapon',
    icon: 'img/weapons/starter/bow.png',
    sellPrice: 3,
    twoHanded: true,
    tier: 1,
    stats: { pAtk: 5 },   // v0.27: двуручное сильнее
  },
  crossbow: {
    id: 'starterCrossbow',
    name: 'Хлипкий арбалет',
    type: 'weapon',
    icon: 'img/weapons/starter/crossbow.png',
    sellPrice: 3,
    twoHanded: true,
    tier: 1,
    stats: { pAtk: 5 },   // v0.27: двуручное сильнее
  },
  staff: {
    id: 'starterStaff',
    name: 'Сломанный посох',
    type: 'weapon',
    icon: 'img/weapons/starter/staff.png',
    sellPrice: 3,
    twoHanded: true,
    tier: 1,
    stats: { mAtk: 4, mpBonus: 5 },
  },
};