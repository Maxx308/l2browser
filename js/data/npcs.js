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
    fullName: 'Алхимик Андервуда',
    desc: 'Седой старик с колбами и ретортами. Разбирает вещи на пыль, переплавляет свойства.',
    icon: 'alchemist',
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
};

// ========================================================
//  SVG-заглушки портретов NPC
// ========================================================
const NPC_SVG = {
  bag: `<img src="img/bags/bag01_worn.png" alt="" style="object-fit:contain; padding:8%; box-sizing:border-box;">`,
  // v0.31: портреты жителей — img/npc/*.jpg (512×512, лицо крупно; исходники — C:\МояИграКлоуд\персонажи)
  trader:  `<img src="img/npc/trader.jpg" alt="">`,
  hostess: `<img src="img/npc/hostess.jpg" alt="">`,
  smith:   `<img src="img/npc/smith.jpg" alt="">`,
  elder:   `<img src="img/npc/elder.jpg" alt="">`,   // v0.31: вместо SVG-заглушки
  refiner: `<img src="img/npc/refiner.jpg" alt="">`,
  mentor:  `<img src="img/npc/mentor.jpg" alt="">`,
  guildmage: `<img src="img/npc/guildmage.jpg" alt="">`,

  alchemist: `<svg viewBox="0 0 100 100" style="width:100%;height:100%;">
    <defs>
      <radialGradient id="alchBg" cx="50%" cy="40%">
        <stop offset="0%" stop-color="#2a2a4a"/>
        <stop offset="100%" stop-color="#0a0a18"/>
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="100" height="100" fill="url(#alchBg)"/>
    <path d="M22 100 Q22 70 50 65 Q78 70 78 100 Z" fill="#2a1a3a" stroke="#8a6ac0" stroke-width="2"/>
    <path d="M38 60 Q50 82 62 60 Q56 68 50 68 Q44 68 38 60 Z" fill="#c8c0b0" stroke="#8a8070" stroke-width="1.5"/>
    <ellipse cx="50" cy="45" rx="14" ry="16" fill="#c8a880" stroke="#8a6a4a" stroke-width="1.5"/>
    <path d="M36 38 Q38 28 50 28 Q62 28 64 38 Q60 32 50 32 Q40 32 36 38 Z" fill="#d0c8b0" stroke="#8a8070" stroke-width="1.2"/>
    <ellipse cx="44" cy="45" rx="1.5" ry="1.8" fill="#0a0a0a"/>
    <ellipse cx="56" cy="45" rx="1.5" ry="1.8" fill="#0a0a0a"/>
    <path d="M78 60 L78 70 L74 82 L82 82 L78 70 Z" fill="#3a8a8a" stroke="#80e0e0" stroke-width="1.2" opacity="0.9"/>
    <ellipse cx="78" cy="80" rx="4" ry="2" fill="#80e0e0" opacity="0.6"/>
    <path d="M76 60 L80 60" stroke="#80e0e0" stroke-width="1.5"/>
    <circle cx="76" cy="76" r="0.8" fill="#e0ffff" opacity="0.8"/>
    <circle cx="80" cy="78" r="0.6" fill="#e0ffff" opacity="0.7"/>
  </svg>`,
};