// ========================================================
//  ДАННЫЕ: NPC
//  Жители Андервуда. Каждый NPC имеет:
//    - id
//    - name
//    - icon — картинка или SVG-заглушка
//    - desc — короткое описание
//    - dialogueStart — id стартовой сцены (опционально)
// ========================================================

const NPCS = {
  elder: {
    id: 'elder',
    name: 'Старейшина',
    fullName: 'Старейшина Андервуда',
    desc: 'Седой, хмурый, но справедливый. Видел многое.',
    icon: 'elder',
    dialogueStart: 'elder_intro',
  },

  alchemist: {
    id: 'alchemist',
    name: 'Алхимик',
    // v0.35.1: ученик Ефим (имя — черновик); назовётся в разговоре
    get fullName() {
      const named = typeof ownerTopicAsked === 'function' && ownerTopicAsked('alchemist', 'name');
      return named ? 'Ефим, Алхимик Андервуда' : 'Алхимик Андервуда';
    },
    desc: 'Парень лет двадцати в прожжённом фартуке, без бровей. Разбирает вещи на пыль, переплавляет свойства.',
    icon: 'alchemist',
    dialogueStart: null,
  },

  // v0.35.1: кладовщица-дроу на Складе. Имя Вирна — черновик; назовётся в разговоре.
  keeper: {
    id: 'keeper',
    name: 'Кладовщица',
    get fullName() {
      const named = typeof ownerTopicAsked === 'function' && ownerTopicAsked('keeper', 'name');
      return named ? 'Вирна, Склад Андервуда' : 'Кладовщица Склада';
    },
    desc: 'Дроу за стойкой Склада. Говорит мало, помнит всё.',
    icon: 'keeper',
    dialogueStart: null,
  },

  // v0.31: владельцы мест — с ними можно поговорить (кнопка 💬 в шапке окна, js/systems/townsfolk.js).
  trader: {
    id: 'trader',
    name: 'Торговец',
    fullName: 'Торговец Андервуда',
    desc: 'Держит лавку у ворот. Имени не называет.',
    icon: 'trader',
    dialogueStart: null,
  },

  // Имя — когда сама назовётся (тема «Как тебя зовут?»).
  hostess: {
    id: 'hostess',
    name: 'Хозяйка',
    get fullName() {
      const named = typeof ownerTopicAsked === 'function' && ownerTopicAsked('hostess', 'name');
      return named ? 'Марфа, хозяйка «Козьего вымени»' : 'Хозяйка «Козьего вымени»';
    },
    desc: 'Держит таверну «Козье вымя». Всех кормит, всех знает.',
    icon: 'hostess',
    dialogueStart: null,
  },

  // Гном-кузнец. Имя — когда назовётся (тема «Как тебя зовут?»).
  smith: {
    id: 'smith',
    name: 'Кузнец',
    get fullName() {
      const named = typeof ownerTopicAsked === 'function' && ownerTopicAsked('smith', 'name');
      return named ? 'Гундар, кузнец Андервуда' : 'Кузнец Андервуда';
    },
    desc: 'Гном. Ворчит с утра до ночи, зато руки золотые.',
    icon: 'smith',
    dialogueStart: null,
  },

  // Гномка из Мастерской, сестра кузнеца. Имя — когда назовётся.
  refiner: {
    id: 'refiner',
    name: 'Мастерица',
    get fullName() {
      const named = typeof ownerTopicAsked === 'function' && ownerTopicAsked('refiner', 'name');
      return named ? 'Хильда, мастерица Андервуда' : 'Мастерица Андервуда';
    },
    desc: 'Гномка, сестра кузнеца. Подгоняет снаряжение по руке.',
    icon: 'refiner',
    dialogueStart: null,
  },

  // Орк-ветеран, наставник. Имя — когда назовётся.
  mentor: {
    id: 'mentor',
    name: 'Наставник',
    get fullName() {
      const named = typeof ownerTopicAsked === 'function' && ownerTopicAsked('mentor', 'name');
      return named ? 'Урдах, наставник Андервуда' : 'Наставник Андервуда';
    },
    desc: 'Орк-ветеран со шрамами. Неожиданно спокойный.',
    icon: 'mentor',
    dialogueStart: null,
  },

  // Эльфийка из Гильдии магов. Юная по эльфийским меркам, умна, непроницаема.
  guildmage: {
    id: 'guildmage',
    name: 'Эльфийка',
    get fullName() {
      const named = typeof ownerTopicAsked === 'function' && ownerTopicAsked('guildmage', 'name');
      return named ? 'Лиэль, Гильдия магов' : 'Эльфийка из Гильдии магов';
    },
    desc: 'Юная эльфийка в очках. Что она делает в Андервуде — не говорит.',
    icon: 'guildmage',
    dialogueStart: null,
  },

  // v0.30: говорящая сумка. Имя «???», пока не представился (факт bag_name в летописи).
  bag: {
    id: 'bag',
    get name() { return typeof bagSpeakerName === 'function' ? bagSpeakerName() : '???'; },
    desc: '',
    icon: 'bag',
    dialogueStart: null,
  },

  // v0.35.1: разговор с Заплечником — поручения (js/systems/bag.js). Нажатие на сумку в снаряжении.
  bagtalk: {
    id: 'bagtalk',
    name: 'Заплечник',
    desc: '',
    icon: 'bag',
    dialogueStart: null,
  },
};

// ========================================================
//  SVG-заглушки портретов NPC
// ========================================================
const NPC_SVG = {
  // v0.35.1: вид меняется с уровнем Заплечника (BAG_LOOKS)
  get bag() {
    const img = typeof bagLookImg === 'function' ? bagLookImg() : 'img/bags/bag01_worn.webp';
    return `<img src="${img}" alt="" style="object-fit:contain; padding:8%; box-sizing:border-box;">`;
  },
  // v0.31: портреты жителей — img/npc/*.webp (512×512, лицо крупно; исходники — C:\МояИграКлоуд\персонажи)
  trader:  `<img src="img/npc/trader.webp" alt="">`,
  hostess: `<img src="img/npc/hostess.webp" alt="">`,
  smith:   `<img src="img/npc/smith.webp" alt="">`,
  elder:   `<img src="img/npc/elder.webp" alt="">`,   // v0.31: вместо SVG-заглушки
  refiner: `<img src="img/npc/refiner.webp" alt="">`,
  mentor:  `<img src="img/npc/mentor.webp" alt="">`,
  guildmage: `<img src="img/npc/guildmage.webp" alt="">`,

  alchemist: `<img src="img/npc/alchemist.webp" alt="">`,   // v0.35.1: ученик Ефим вместо SVG-заглушки
  keeper:    `<img src="img/npc/keeper.webp" alt="">`,   // v0.35.1: кладовщица Вирна
};