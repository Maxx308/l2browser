// ========================================================
//  ДАННЫЕ: ПОДКЛАССЫ (v0.38)
//  У каждой расы каждый класс делится на 3 подкласса (5 × 2 × 3 = 30).
//  Берутся в Храме Ильграда с SUBCLASS_MIN_LEVEL уровня («посвящение»):
//  по сюжету знак будто бы дают боги, на деле игрок выбирает сам.
//  Пока бета — сменить можно за SUBCLASS_CHANGE_PRICE Оболов.
//
//  Каркас подкласса:
//   + mods  — три старые активки класса меняются (имя, описание, уровни до 7).
//             id навыка остаётся прежним: вложенные очки и место в слоте не теряются.
//   + новые навыки (subclassId): 2 активки (одна — полупассивка: стоит в слоте,
//     срабатывает сама, ничего не стоит) и 2 пассивки. Открываются вместе с подклассом.
//
//  ready: true — подкласс доделан и его можно взять. Остальные видны в Храме,
//  но закрыты («путь ещё не открыт»).
//  Логика — js/systems/subclass.js. Подключать ПОСЛЕ skills-aoe.js.
// ========================================================

const SUBCLASS_MIN_LEVEL = 25;
const SUBCLASS_CHANGE_PRICE = 100000;
const SUBCLASS_SKILL_MAX_LEVEL = 7;   // изменённые активки качаются до 7

const SUBCLASS_ROLES = {
  tank:    { name: 'Танк',        icon: '🛡' },
  damage:  { name: 'Урон',        icon: '⚔' },
  hybrid:  { name: 'Гибрид',      icon: '✦' },
  ruin:    { name: 'Разрушитель', icon: '🔥' },
  support: { name: 'Опора',       icon: '✚' },
  allies:  { name: 'Союзники',    icon: '👥' },
  economy: { name: 'Ремесло',     icon: '⚒' },
};

// Порядок внутри расы-класса — как в Храме: танк / урон / гибрид, разрушитель / опора / союзники.
const SUBCLASSES = {
  // ---- ЧЕЛОВЕК ----
  human_wallguard:    { race: 'human', cls: 'warrior', role: 'tank',    name: 'Страж стены',     ready: true,
    preview: 'Защита и приёмы со щитом',
    blurb: 'Держит удар, пока стоит стена. Щит не обязателен, но лучшие приёмы — только со щитом.' },
  human_huntsman:     { race: 'human', cls: 'warrior', role: 'damage',  name: 'Егерь',     ready: true,
    preview: 'Криты и сильное добивание',
    blurb: 'Луки, арбалеты, кинжалы. Копит азарт на критах и спускает его в одно добивание.' },
  human_templar:      { race: 'human', cls: 'warrior', role: 'hybrid',  name: 'Храмовник', ready: true,
    preview: 'Оружие и магия Света',
    rarityProfile: 'neutral',   // статы редкости 50/50: все шесть поровну
    blurb: 'Воин со светом в руках: каждый удар подкреплён магией, нежить горит.' },
  human_elementalist: { race: 'human', cls: 'mage',    role: 'ruin',    name: 'Элементалист', ready: true,
    preview: 'Сочетания стихий',
    blurb: 'Сила в сочетаниях стихий: лёд раскалывает огонь, молния выжигает ману.' },
  human_priest:       { race: 'human', cls: 'mage',    role: 'support', name: 'Жрец',         ready: true,
    preview: 'Лечение себя и союзников',
    blurb: 'Свет и Жизнь. Один — почти бессмертный маг без зелий, с союзниками — их опора.' },
  human_necromancer:  { race: 'human', cls: 'mage',    role: 'allies',  name: 'Некромант',    ready: true,
    preview: 'Призывает павших',
    blurb: 'Поднимает павших: зомби, скелеты, духи. До трёх слуг в бою.' },

  // ---- ОРК ----
  orc_rock:      { race: 'orc', cls: 'warrior', role: 'tank',    name: 'Скала',          ready: true,
    preview: 'Восстанавливает здоровье в бою',
    blurb: 'Перелечивает любой урон. Щит не нужен — нужна кровь орка.' },
  orc_berserker: { race: 'orc', cls: 'warrior', role: 'damage',  name: 'Берсерк',        ready: true,
    preview: 'Двуручное оружие и удары за здоровье',
    blurb: 'Двуручное оружие и навыки за здоровье. Чем ближе к смерти, тем страшнее.' },
  orc_chieftain: { race: 'orc', cls: 'warrior', role: 'hybrid',  name: 'Вождь',          ready: true,
    preview: 'Боевой клич и сила предков',
    blurb: 'Боевой клич и сила предков. Любое оружие и броня.' },
  orc_hexer:     { race: 'orc', cls: 'mage',    role: 'ruin',    name: 'Проклинатель',   ready: true,
    preview: 'Накапливает проклятия',
    blurb: 'Разные проклятия на одной цели — и урон растёт с каждым ходом.' },
  orc_healer:    { race: 'orc', cls: 'mage',    role: 'support', name: 'Костоправ',      ready: true,
    preview: 'Лечится через Гниение',
    blurb: 'Лечит через кровь и Гниение: чем больше ран у врага, тем крепче сам.' },
  orc_shaman:    { race: 'orc', cls: 'mage',    role: 'allies',  name: 'Шаман',          ready: true,
    preview: 'Призывает тотемы духов',
    blurb: 'Тотемы духов — по одному за призыв, никогда не знаешь какой.' },

  // ---- ЭЛЬФ ----
  elf_thornguard:  { race: 'elf', cls: 'warrior', role: 'tank',    name: 'Терновый страж', ready: true,
    preview: 'Получает урон постепенно',
    blurb: 'Растягивает удары во времени — рана приходит, когда он уже готов.' },
  elf_pathfinder:  { race: 'elf', cls: 'warrior', role: 'damage',  name: 'Следопыт', ready: true,
    preview: 'Точные удары и отложенный урон',
    blurb: 'Луки, глефы и копья. Верные попадания и отложенный урон.' },
  elf_bladesinger: { race: 'elf', cls: 'warrior', role: 'hybrid',  name: 'Певец клинка', ready: true,
    preview: 'Лечится ударами клинка',
    blurb: 'Клинок и Жизнь: танец, в котором каждый удар лечит.' },
  elf_stargazer:   { race: 'elf', cls: 'mage',    role: 'ruin',    name: 'Звездочёт', ready: true,
    preview: 'Урон по одной цели',
    blurb: 'Снайпер против одной цели: звезда падает не сразу, но наверняка.' },
  elf_grovekeeper: { race: 'elf', cls: 'mage',    role: 'support', name: 'Хранитель Рощи', ready: true,
    preview: 'Постепенное лечение',
    blurb: 'Лечение во времени и дары рощи.' },
  elf_druid:       { race: 'elf', cls: 'mage',    role: 'allies',  name: 'Друид', ready: true,
    preview: 'Призыв духа-зверя',
    blurb: 'Один дух-зверь на всю охоту — и он растёт вместе с тобой.' },

  // ---- ДРОУ ----
  drow_stormguard:   { race: 'drow', cls: 'warrior', role: 'tank',    name: 'Грозовой страж', ready: true,
    preview: 'Задерживает ходы врагов',
    blurb: 'Тварь просто не успевает ходить.' },
  drow_assassin:     { race: 'drow', cls: 'warrior', role: 'damage',  name: 'Ассасин', ready: true,
    preview: 'Парные кинжалы и быстрые ходы',
    blurb: 'Парные кинжалы и внеочередные ходы.' },
  drow_shadowweaver: { race: 'drow', cls: 'warrior', role: 'hybrid',  name: 'Теневой ткач', ready: true,
    preview: 'Оружие и удары молнией',
    blurb: 'Сталь и молния из тени.' },
  drow_stormcaller:  { race: 'drow', cls: 'mage',    role: 'ruin',    name: 'Буревестник', ready: true,
    preview: 'Копит заряд молнии',
    blurb: 'Молния за молнией — напряжение копится до разряда.' },
  drow_dreamweaver:  { race: 'drow', cls: 'mage',    role: 'support', name: 'Ткач снов', ready: true,
    preview: 'Усыпляет лишних врагов',
    blurb: 'Усыпляет лишних, пока сам разбирается с остальными.' },
  drow_spiderlord:   { race: 'drow', cls: 'mage',    role: 'allies',  name: 'Паучий владыка', ready: true,
    preview: 'Призывает паучиху и выводок',
    blurb: 'Паучиха-матка и её выводок.' },

  // ---- ГНОМ ----
  dwarf_steelwall:   { race: 'dwarf', cls: 'warrior', role: 'tank',    name: 'Стальная стена', ready: true,
    preview: 'Крепнет, получая удары',
    blurb: 'Поглощает удары сталью — с каждым ударом крепче.' },
  dwarf_hammerer:    { race: 'dwarf', cls: 'warrior', role: 'damage',  name: 'Молотобоец', ready: true,
    preview: 'Ломает броню молотами и топорами',
    blurb: 'Молоты и топоры: ломает броню и раскалывает лёд.' },
  dwarf_prospector:  { race: 'dwarf', cls: 'warrior', role: 'economy', name: 'Старатель', ready: true,
    preview: 'Больше добычи с охоты',
    blurb: 'Середнячок в бою — и больше всех добычи.' },
  dwarf_forgemaster: { race: 'dwarf', cls: 'mage',    role: 'economy', name: 'Мастер горна', ready: true,
    preview: 'Ковка более редких вещей',
    blurb: 'Жар в бою и у наковальни: ковка с лучшей редкостью.' },
  dwarf_runemaster:  { race: 'dwarf', cls: 'mage',    role: 'economy', name: 'Рунный мастер', ready: true,
    preview: 'Экономия при подгонке',
    blurb: 'Руны на себя и на вещи: подгонка без лишних трат.' },
  dwarf_stonecaller: { race: 'dwarf', cls: 'mage',    role: 'allies',  name: 'Заклинатель камня', ready: true,
    preview: 'Призывает элементалей',
    blurb: 'Элементали камня, огня и жилы.' },
};
Object.keys(SUBCLASSES).forEach(id => {
  SUBCLASSES[id].id = id;
  SUBCLASSES[id].portrait = `img/subclasses/${id}.webp`;
  if (!SUBCLASSES[id].mods) SUBCLASSES[id].mods = {};
});

const SUBCLASS_GUIDES = {
  human_wallguard: {
    play: 'Принимайте удары на щит и отвечайте, когда противник открывается.',
    strength: 'Блоки, оглушение щитом и запасной шанс пережить смертельный удар.',
    limit: 'Без щита теряете часть защиты и ответных ударов.',
  },
  human_huntsman: {
    play: 'Набирайте Азарт критическими ударами и тратьте его на добивание.',
    strength: 'Много быстрых попаданий и сильный удар по ослабленной цели.',
    limit: 'Добивание требует зарядов. Часть бонусов работает с луком, арбалетом или кинжалом.',
  },
  human_templar: {
    play: 'Чередуйте удары оружием и магию Света, чтобы лечиться прямо в бою.',
    strength: 'Свет полезен против нежити и бьёт сразу по нескольким врагам.',
    limit: 'Сияние тратит ману каждый ход и набирает силу постепенно.',
  },
  human_elementalist: {
    play: 'Чередуйте огонь, лёд и молнию. Заморозьте врага, затем расколите его Огненным шаром.',
    strength: 'Сочетания стихий усиливают урон, а Стихийный залп даёт бесплатное заклинание.',
    limit: 'Особые эффекты зависят от того, в каком порядке вы применяете заклинания.',
  },
  human_priest: {
    play: 'Лечитесь светом и превращайте лишнее лечение в защитный барьер.',
    strength: 'Лечение снимает вредные эффекты, а свет особенно силён против нежити.',
    limit: 'Чтобы собрать барьер, нужно получить больше лечения, чем сейчас требуется.',
  },
  human_necromancer: {
    play: 'Поднимайте павших врагов и сражайтесь вместе с тремя слугами.',
    strength: 'Костяное копьё может бесплатно поднять слугу, а «Костяная плата» переносит на него сильный удар.',
    limit: 'Вид слуги зависит от павшего врага. После боя слуг нужно призвать заново.',
  },
  orc_rock: {
    play: 'Переживайте тяжёлые удары и восстанавливайтесь в бою, особенно на низком здоровье.',
    strength: 'Здоровье усиливает таран, а Ярость возвращает часть урона лечением.',
    limit: 'Часть защиты раскрывается только без щита, восстановлению нужно время.',
  },
  orc_berserker: {
    play: 'Тратьте здоровье на мощные удары и добивайте врагов, чтобы вернуть часть потерь.',
    strength: 'Двуручное оружие пробивает защиту, а убийство даёт удар по следующему врагу.',
    limit: 'Навыки расходуют здоровье. Во время Неистовства входящий урон растёт.',
  },
  orc_chieftain: {
    play: 'Зовите духа предка и сочетайте оружие с магией Смерти.',
    strength: 'Дух даёт усиление атаки или защиты, а убийства возвращают здоровье и ману.',
    limit: 'Усиление духа временное, а отдача Ярости расходует здоровье.',
  },
  orc_hexer: {
    play: 'Накладывайте разные проклятия и копите Гниение на цели.',
    strength: 'Каждое новое проклятие усиливает урон. Когда враг гибнет, проклятия могут задеть соседей.',
    limit: 'Чтобы раскрыть силу на одной цели, нужно успеть накопить несколько эффектов.',
  },
  orc_healer: {
    play: 'Ослабляйте врагов и лечитесь за счёт магии Смерти и Гниения.',
    strength: 'Гнев лечит без отдачи, а Гниение помогает восстанавливаться против стаи.',
    limit: 'Часть восстановления приходит постепенно, пока Гниение наносит урон.',
  },
  orc_shaman: {
    play: 'Призывайте тотемы и усиливайте заклинания, пока они стоят рядом.',
    strength: 'Камень прикрывает, Ярость стреляет, Духи возвращают здоровье и ману.',
    limit: 'Тип тотема случаен. Четвёртый призыв заменяет самый старый тотем.',
  },
  elf_thornguard: {
    play: 'Опутывайте врагов корнями и превращайте часть сильного удара в постепенный урон.',
    strength: 'Часть отложенного урона исчезает, а опутанные враги атакуют реже.',
    limit: 'Оставшийся урон всё равно поступает позже. Его важно пережить.',
  },
  elf_pathfinder: {
    play: 'Сейте терновые семена ударами и раскрывайте их в подходящий момент.',
    strength: 'Точные попадания, пробивание защиты и возможность сразу раскрыть семена.',
    limit: 'Семенам нужно время, если не раскрыть их специальным приёмом.',
  },
  elf_bladesinger: {
    play: 'Чередуйте удары клинком и магию Жизни, чтобы лечиться во время атаки.',
    strength: 'Урон магией Жизни восстанавливает здоровье, а лишнее лечение может ранить врага.',
    limit: 'Часть силы зависит от ритма ударов. «Песнь ветра» помогает сохранить Песнь.',
  },
  elf_stargazer: {
    play: 'Сосредоточьтесь на одной цели и обрушивайте на неё звёзды.',
    strength: 'Повторные заклинания по одной цели усиливают урон, а «Звёздный луч» ускоряет падение звезды.',
    limit: 'Звезда падает с задержкой, а при смене цели нужно снова набирать усиление.',
  },
  elf_grovekeeper: {
    play: 'Заранее накладывайте лечение и поддерживайте здоровье на протяжении боя.',
    strength: 'Лечение продолжается между ходами и может возвращать ману.',
    limit: 'Часть лечения приходит постепенно. Его нужно начать до опасного удара.',
  },
  elf_druid: {
    play: 'Призывайте духа-зверя и охотьтесь вместе с ним. Повторный призыв отдаёт приказ атаковать.',
    strength: 'Рысь сильнее бьёт, Олень лечит, а Филин даёт ману. Живой дух остаётся между боями.',
    limit: 'Какой дух придёт, решает случай. Если он погибнет, накопленный рост пропадёт.',
  },
  drow_stormguard: {
    play: 'Принимайте удары и копите на врагах Статику для ответных разрядов.',
    strength: 'Молния задерживает ход врага. Защита помогает пережить магические атаки.',
    limit: 'Для ответных разрядов и части эффектов нужны удары по вам.',
  },
  drow_assassin: {
    play: 'Используйте быстрые ходы и бейте до того, как враг накопит ход.',
    strength: 'Парное оружие усиливает атаки, яд накапливается, а убийство приближает ваш следующий ход.',
    limit: 'Часть бонусов требует оружия в обеих руках, а сильный удар зависит от шкалы врага.',
  },
  drow_shadowweaver: {
    play: 'Заряжайте оружие молнией и призывайте двойника, который повторяет удары.',
    strength: 'Двойник добавляет урон, а паралич может вызвать его или продлить его действие.',
    limit: 'Двойник временный. Продление зависит от того, удастся ли парализовать врага.',
  },
  drow_stormcaller: {
    play: 'Бейте молниями подряд, копите Напряжение и пускайте цепь по стае.',
    strength: 'Цепная молния поражает несколько врагов, а накопленное Напряжение усиливает разряд.',
    limit: 'До усиленного удара нужно набрать серию молний.',
  },
  drow_dreamweaver: {
    play: 'Усыпляйте часть стаи и разбирайтесь с остальными врагами по очереди.',
    strength: 'Спящие враги дают время восстановить здоровье и подготовить сильный удар.',
    limit: 'Урон будит спящих. Важен порядок, в котором вы выбираете цели.',
  },
  drow_spiderlord: {
    play: 'Призывайте матку и давайте выводку время вырасти. Паралич зовёт всех пауков в атаку.',
    strength: 'Укусы замедляют цели паутиной и накапливают яд.',
    limit: 'Матке нужно время, чтобы вывести паучат. Укусы после Разряда требуют паралича.',
  },
  dwarf_steelwall: {
    play: 'Переживайте серии ударов и наращивайте поглощение урона по ходу боя.',
    strength: 'Сильная защита под частыми атаками и устойчивость к оглушению.',
    limit: 'Часть защиты набирается от полученных ударов, а «Гномья сталь» требует подходящей брони.',
  },
  dwarf_hammerer: {
    play: 'Пробивайте защиту врага тяжёлым оружием и используйте заморозку для сильных ударов.',
    strength: 'Проломы усиливают удары по крепкой цели. Раскол хорошо работает по замороженным врагам.',
    limit: 'Часть бонусов требует молота, дубины или топора. Для самого сильного удара нужны три Пролома.',
  },
  dwarf_prospector: {
    play: 'Накладывайте Метки Жадности перед добиванием и собирайте больше добычи с охоты.',
    strength: 'Метки, дополнительные попытки добычи и повышенный шанс полезных материалов.',
    limit: 'Для части бонусов враг должен прожить достаточно долго, чтобы накопить метки.',
  },
  dwarf_forgemaster: {
    play: 'Разогревайте врагов огнём и используйте накопленный Жар перед бураном.',
    strength: 'Жар усиливает связку заклинаний. В кузнице проще получить более редкую вещь или сберечь материалы.',
    limit: 'Связка требует подготовить цель. Часть навыков даёт пользу только в кузнице.',
  },
  dwarf_runemaster: {
    play: 'Наносите руны на себя и ставьте взрывную руну на врага перед его ударом.',
    strength: 'Руны дают защиту и лечение, а подгонка снаряжения обходится выгоднее.',
    limit: 'Взрывная руна ждёт действия врага. Часть преимуществ относится только к подгонке.',
  },
  dwarf_stonecaller: {
    play: 'Собирайте элементалей Камня, Огня и Жилы, затем объединяйте их в Великого.',
    strength: 'Камень прикрывает, Огонь поджигает, Жила задевает второго врага и помогает с добычей.',
    limit: 'До слияния надо собрать все три стихии и сохранить их в бою.',
  },
};

function scX(v) { return `<span class="val">×${v.toFixed(2)}</span>`; }
function scV(v) { return `<span class="val">${v}</span>`; }
function scNext(skill, lvl, fmt) {
  if (lvl >= skill.maxLevel) return '';
  const n = skill.levels[lvl];
  return `Следующий уровень: ${fmt(n)}${lvl + 1 > 5 ? ' (ступень подкласса)' : ''}`;
}

// ========================================================
//  СТРАЖ СТЕНЫ (человек-воин, танк)
// ========================================================
const WALLGUARD_SHIELD_DEF_MULT = 3;   // защита щита ×3 в Ударе щитом (иначе щит Т2 с защитой 2 ничего не даёт)

SUBCLASSES.human_wallguard.mods = {
  // Сильный удар → Удар щитом
  powerStrike: {
    name: 'Удар щитом',
    levels: [
      { mpCost: 10, multiplier: 2.0 }, { mpCost: 11, multiplier: 2.25 },
      { mpCost: 13, multiplier: 2.5 }, { mpCost: 14, multiplier: 2.75 },
      { mpCost: 15, multiplier: 3.0 }, { mpCost: 16, multiplier: 3.25 },
      { mpCost: 17, multiplier: 3.5 },
    ],
    getDesc: (lvl, skill = SKILLS.powerStrike) => { const d = skill.levels[lvl-1]; return `Со щитом: (атака + защита щита ×${WALLGUARD_SHIELD_DEF_MULT}) × ${scX(d.multiplier)}. Без щита — обычный сильный удар на ${scX(d.multiplier)}. <b>Цикл мастера:</b> убийство — КД «Меча и щита» −1. MP: ${scV(d.mpCost)}. КД: ${skill.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.powerStrike, lvl, n => `×${n.multiplier.toFixed(2)}, MP ${n.mpCost}`),
  },
  // Двойной удар → Меч и щит
  doubleStrike: {
    name: 'Меч и щит',
    stunChance: 20,
    levels: [
      { mpCost: 10, multiplier: 0.90 }, { mpCost: 11, multiplier: 0.95 },
      { mpCost: 12, multiplier: 1.00 }, { mpCost: 13, multiplier: 1.05 },
      { mpCost: 15, multiplier: 1.10 }, { mpCost: 16, multiplier: 1.15 },
      { mpCost: 17, multiplier: 1.20 },
    ],
    getDesc: (lvl, skill = SKILLS.doubleStrike) => { const d = skill.levels[lvl-1]; return `Два удара по ${scX(d.multiplier)}. Со щитом второй удар — щитом: к атаке прибавляется защита щита ×${WALLGUARD_SHIELD_DEF_MULT}, шанс ${scV(skill.stunChance + '%')} оглушить. <b>Цикл мастера:</b> убийство — КД «Кругового вызова» −1. MP: ${scV(d.mpCost)}. КД: ${skill.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.doubleStrike, lvl, n => `×${n.multiplier.toFixed(2)} каждый удар, MP ${n.mpCost}`),
  },
  // Круговой удар → Круговой вызов
  whirlwind: {
    name: 'Круговой вызов',
    challengeTurns: 3, challengePct: 15,
    levels: [
      { mpCost: 14, multiplier: 0.90, targets: 3 }, { mpCost: 15, multiplier: 0.97, targets: 3 },
      { mpCost: 16, multiplier: 1.05, targets: 3 }, { mpCost: 17, multiplier: 1.12, targets: 3 },
      { mpCost: 18, multiplier: 1.20, targets: 4 }, { mpCost: 19, multiplier: 1.27, targets: 4 },
      { mpCost: 20, multiplier: 1.35, targets: 4 },
    ],
    getDesc: (lvl, skill = SKILLS.whirlwind) => { const w = skill; const d = w.levels[lvl-1]; return `Удар по кругу: до ${scV(d.targets)} врагов на ${scX(d.multiplier)}. <b>Вызов:</b> задетые ${w.challengeTurns} хода бьют только героя и получают ${scV('+' + w.challengePct + '%')} урона от всех. <b>Цикл мастера:</b> убил хоть одного — КД «Удара щитом» −1. MP: ${scV(d.mpCost)}. КД: ${w.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.whirlwind, lvl, n => `${n.targets} цели, ×${n.multiplier.toFixed(2)}, MP ${n.mpCost}`),
  },
};

const SUBCLASS_SKILLS = {
  // Глухая оборона: тратит ход, 5 ходов меньше урона; автобой — только против стаи или сильной твари.
  wgHoldLine: {
    id: 'wgHoldLine', subclassId: 'human_wallguard', name: 'Глухая оборона', type: 'active',
    iconPng: 'img/skills/subclass/wgHoldLine.webp',
    maxLevel: 5, cooldown: 8, turns: 5, shieldBlock: 5,
    levels: [
      { mpCost: 0, cut: 15 }, { mpCost: 0, cut: 17 }, { mpCost: 0, cut: 20 },
      { mpCost: 0, cut: 22 }, { mpCost: 0, cut: 25 },
    ],
    getDesc: (lvl) => { const s = SKILLS.wgHoldLine; const d = s.levels[lvl-1]; return `Тратит ход: ${s.turns} ходов входящий урон ${scV('−' + d.cut + '%')}, со щитом ещё ${scV('+' + s.shieldBlock + '%')} блока. Без маны. Автобой ставит оборону только против стаи из двух и больше или сильной твари. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.wgHoldLine, lvl, n => `−${n.cut}% урона`),
  },
  // Ответ щита — полупассивка: стоит в слоте, срабатывает сама.
  wgShieldRetort: {
    id: 'wgShieldRetort', subclassId: 'human_wallguard', name: 'Ответ щита', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/wgShieldRetort.webp',
    maxLevel: 5, retortEvery: 3, needsShield: true,
    levels: [
      { mpCost: 0, power: 0.9, blockChance: 20 }, { mpCost: 0, power: 1.0, blockChance: 25 },
      { mpCost: 0, power: 1.1, blockChance: 30 }, { mpCost: 0, power: 1.2, blockChance: 35 },
      { mpCost: 0, power: 1.3, blockChance: 40 },
    ],
    getDesc: (lvl) => { const s = SKILLS.wgShieldRetort; const d = s.levels[lvl-1]; return `<b>Срабатывает сам</b>, пока стоит в слоте; только со щитом. Крит твари по вам — мгновенный удар щитом: (атака + защита и поглощение щита ×${WALLGUARD_SHIELD_DEF_MULT}) × ${scX(d.power)} и оглушение на 1 ход. После блока — с шансом ${scV(d.blockChance + '%')}. Не чаще раза в ${s.retortEvery} хода. Ничего не стоит — цена в занятом слоте.`; },
    getNextDesc: (lvl) => scNext(SKILLS.wgShieldRetort, lvl, n => `×${n.power.toFixed(2)}, после блока ${n.blockChance}%`),
  },
  // Мастер щита — только со щитом.
  wgShieldMastery: {
    id: 'wgShieldMastery', subclassId: 'human_wallguard', name: 'Мастер щита', type: 'passive',
    iconPng: 'img/skills/subclass/wgShieldMastery.webp',
    maxLevel: 5,
    levels: [
      { block: 3, shieldPct: 20 }, { block: 4, shieldPct: 25 }, { block: 5, shieldPct: 30 },
      { block: 6, shieldPct: 35 }, { block: 7, shieldPct: 40 },
    ],
    getDesc: (lvl) => { const d = SKILLS.wgShieldMastery.levels[lvl-1]; return `Пассивно, только со щитом: ${scV('+' + d.block + '%')} блока, защита и поглощение щита ${scV('+' + d.shieldPct + '%')}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.wgShieldMastery, lvl, n => `+${n.block}% блока, щит +${n.shieldPct}%`),
  },
  // Последний рубеж — раз за бой.
  wgLastStand: {
    id: 'wgLastStand', subclassId: 'human_wallguard', name: 'Последний рубеж', type: 'passive',
    iconPng: 'img/skills/subclass/wgLastStand.webp',
    maxLevel: 5, turns: 2,
    levels: [ { cut: 30 }, { cut: 35 }, { cut: 40 }, { cut: 45 }, { cut: 50 } ],
    getDesc: (lvl) => { const s = SKILLS.wgLastStand; const d = s.levels[lvl-1]; return `Пассивно, раз за бой: смертельный удар оставляет ${scV('1 HP')}, и ${s.turns} хода входящий урон ${scV('−' + d.cut + '%')}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.wgLastStand, lvl, n => `−${n.cut}% урона`),
  },
};

// ========================================================
//  ЕГЕРЬ (человек-воин, урон)
//  Азарт 0–5: +1 за крит, держится до конца боя. Тратит Добивание и Ускользнуть.
// ========================================================
const JAEGER_ZEAL_MAX = 5;
const JAEGER_WEAPONS = ['bows', 'crossbows', 'daggers'];

SUBCLASSES.human_huntsman.mods = {
  // Сильный удар → Добивание (тратит весь Азарт, без маны)
  powerStrike: {
    name: 'Добивание',
    perCharge: 0.4, lowHpPct: 30, lowHpBonus: 50, minZeal: 2,
    levels: [
      { mpCost: 0, multiplier: 1.3 }, { mpCost: 0, multiplier: 1.4 }, { mpCost: 0, multiplier: 1.5 },
      { mpCost: 0, multiplier: 1.6 }, { mpCost: 0, multiplier: 1.7 }, { mpCost: 0, multiplier: 1.8 },
      { mpCost: 0, multiplier: 1.9 },
    ],
    getDesc: (lvl, skill = SKILLS.powerStrike) => { const s = skill, mod = SUBCLASSES.human_huntsman.mods.powerStrike, d = s.levels[lvl-1];
      const full = d.multiplier + mod.perCharge * JAEGER_ZEAL_MAX;
      return `Тратит весь Азарт: ${scX(d.multiplier)} + ${scV('×' + mod.perCharge.toFixed(1))} за каждый заряд (${scX(full)} на ${JAEGER_ZEAL_MAX}). Цель ниже ${mod.lowHpPct}% HP — ещё ${scV('+' + mod.lowHpBonus + '%')}. Нужно от ${mod.minZeal} зарядов. Без маны. <b>Цикл мастера:</b> убийство — КД Шквала −1. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.powerStrike, lvl, n => `база ×${n.multiplier.toFixed(2)}`),
    useCheck: () => (jaegerZeal() < SUBCLASSES.human_huntsman.mods.powerStrike.minZeal ? `нужно ${SUBCLASSES.human_huntsman.mods.powerStrike.minZeal} заряда Азарта` : ''),
  },
  // Двойной удар → Шквал (копит Азарт)
  doubleStrike: {
    name: 'Шквал', hits: 3,
    levels: [
      { mpCost: 7, multiplier: 0.60 }, { mpCost: 8, multiplier: 0.63 }, { mpCost: 8, multiplier: 0.67 },
      { mpCost: 9, multiplier: 0.70 }, { mpCost: 9, multiplier: 0.73 }, { mpCost: 10, multiplier: 0.77 },
      { mpCost: 11, multiplier: 0.80 },
    ],
    getDesc: (lvl, skill = SKILLS.doubleStrike) => { const s = skill, d = s.levels[lvl-1]; return `Три быстрых удара по ${scX(d.multiplier)}. Крит — отдельно на каждый, и каждый крит — заряд Азарта. <b>Цикл мастера:</b> убийство — КД Веера −1. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.doubleStrike, lvl, n => `×${n.multiplier.toFixed(2)} каждый удар, MP ${n.mpCost}`),
  },
  // Круговой удар → Веер
  whirlwind: {
    name: 'Веер',
    levels: [
      { mpCost: 14, multiplier: 0.90, targets: 3 }, { mpCost: 15, multiplier: 0.97, targets: 3 },
      { mpCost: 16, multiplier: 1.05, targets: 3 }, { mpCost: 17, multiplier: 1.12, targets: 4 },
      { mpCost: 18, multiplier: 1.20, targets: 4 }, { mpCost: 19, multiplier: 1.27, targets: 4 },
      { mpCost: 20, multiplier: 1.35, targets: 4 },
    ],
    getDesc: (lvl, skill = SKILLS.whirlwind) => { const s = skill, d = s.levels[lvl-1]; return `Веер ударов или стрел: до ${scV(d.targets)} врагов на ${scX(d.multiplier)}. Каждый крит — заряд Азарта. <b>Цикл мастера:</b> убил хоть одного — КД Добивания −1. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.whirlwind, lvl, n => `${n.targets} цели, ×${n.multiplier.toFixed(2)}, MP ${n.mpCost}`),
  },
};

// ========================================================
//  ХРАМОВНИК (человек-воин, гибрид)
// ========================================================
SUBCLASSES.human_templar.mods = {
  // Сильный удар → Карающий удар
  powerStrike: {
    name: 'Карающий удар',
    magPart: 0.5, stunUndead: 20,
    levels: [
      { mpCost: 10, multiplier: 2.0 }, { mpCost: 11, multiplier: 2.25 },
      { mpCost: 13, multiplier: 2.5 }, { mpCost: 14, multiplier: 2.75 },
      { mpCost: 15, multiplier: 3.0 }, { mpCost: 16, multiplier: 3.25 },
      { mpCost: 17, multiplier: 3.5 },
    ],
    getDesc: (lvl, skill = SKILLS.powerStrike) => { const s = skill, mod = SUBCLASSES.human_templar.mods.powerStrike, d = s.levels[lvl-1]; return `Удар светом: (атака + маг. атака ×${mod.magPart}) × ${scX(d.multiplier)}. Нежить оглушает с шансом ${scV(mod.stunUndead + '%')}. <b>Цикл мастера:</b> убийство — КД Удара с молитвой −1. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.powerStrike, lvl, n => `×${n.multiplier.toFixed(2)}, MP ${n.mpCost}`),
  },
  // Двойной удар → Удар с молитвой
  doubleStrike: {
    name: 'Удар с молитвой',
    levels: [
      { mpCost: 10, multiplier: 0.90, heal: 10 }, { mpCost: 11, multiplier: 0.95, heal: 12 },
      { mpCost: 12, multiplier: 1.00, heal: 13 }, { mpCost: 13, multiplier: 1.05, heal: 15 },
      { mpCost: 15, multiplier: 1.10, heal: 17 }, { mpCost: 16, multiplier: 1.15, heal: 18 },
      { mpCost: 17, multiplier: 1.20, heal: 20 },
    ],
    getDesc: (lvl, skill = SKILLS.doubleStrike) => { const s = skill, d = s.levels[lvl-1]; return `Два удара по ${scX(d.multiplier)}, каждый лечит ${scV(d.heal + '%')} нанесённого. <b>Цикл мастера:</b> убийство — КД Волны света −1. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.doubleStrike, lvl, n => `×${n.multiplier.toFixed(2)}, лечение ${n.heal}%, MP ${n.mpCost}`),
  },
  // Круговой удар → Волна света
  whirlwind: {
    name: 'Волна света',
    magPart: 0.5,
    levels: [
      { mpCost: 14, multiplier: 0.90, targets: 3, heal: 2 },   { mpCost: 15, multiplier: 0.97, targets: 3, heal: 2.3 },
      { mpCost: 16, multiplier: 1.05, targets: 3, heal: 2.7 }, { mpCost: 17, multiplier: 1.12, targets: 3, heal: 3 },
      { mpCost: 18, multiplier: 1.20, targets: 4, heal: 3.3 }, { mpCost: 19, multiplier: 1.27, targets: 4, heal: 3.7 },
      { mpCost: 20, multiplier: 1.35, targets: 4, heal: 4 },
    ],
    getDesc: (lvl, skill = SKILLS.whirlwind) => { const s = skill, mod = SUBCLASSES.human_templar.mods.whirlwind, d = s.levels[lvl-1]; return `Волна по кругу: до ${scV(d.targets)} врагов — удар на ${scX(d.multiplier)} и свет на ${scX(d.multiplier * mod.magPart)} от маг. атаки. За каждого задетого лечит ${scV(d.heal + '%')} макс. HP. <b>Цикл мастера:</b> убил хоть одного — КД Карающего удара −1. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.whirlwind, lvl, n => `${n.targets} цели, ×${n.multiplier.toFixed(2)}, лечение ${n.heal}%`),
  },
};

Object.assign(SUBCLASS_SKILLS, {
  // ---- Егерь ----
  jgEvade: {
    id: 'jgEvade', subclassId: 'human_huntsman', name: 'Ускользнуть', type: 'active',
    iconPng: 'img/skills/subclass/jgEvade.webp',
    maxLevel: 5, cooldown: 6, zealCost: 2, misses: 2,
    levels: [ { mpCost: 0, atb: 10 }, { mpCost: 0, atb: 15 }, { mpCost: 0, atb: 20 }, { mpCost: 0, atb: 25 }, { mpCost: 0, atb: 30 } ],
    getDesc: (lvl) => { const s = SKILLS.jgEvade, d = s.levels[lvl-1]; return `Тратит ${s.zealCost} заряда Азарта: две следующие атаки твари проходят мимо, каждая — ${scV('+' + d.atb + '%')} к шкале ATB. Без маны. Автобой уходит при HP ниже 50%. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.jgEvade, lvl, n => `+${n.atb}% ATB`),
    useCheck: () => (jaegerZeal() < SKILLS.jgEvade.zealCost ? `нужно ${SKILLS.jgEvade.zealCost} заряда Азарта` : ''),
  },
  jgMark: {
    id: 'jgMark', subclassId: 'human_huntsman', name: 'Метка егеря', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/jgMark.webp',
    maxLevel: 5,
    levels: [ { mpCost: 0, bonus: 10 }, { mpCost: 0, bonus: 12 }, { mpCost: 0, bonus: 15 }, { mpCost: 0, bonus: 17 }, { mpCost: 0, bonus: 20 } ],
    getDesc: (lvl) => { const d = SKILLS.jgMark.levels[lvl-1]; return `<b>Срабатывает сама</b>, пока стоит в слоте. Крит по цели без метки ставит на неё Метку (метка одна). По меченой — ${scV('+' + d.bonus + '%')} вашего урона, а крит по ней даёт ${scV('2')} заряда Азарта. Ничего не стоит — цена в занятом слоте.`; },
    getNextDesc: (lvl) => scNext(SKILLS.jgMark, lvl, n => `+${n.bonus}% урона по меченой`),
  },
  jgEye: {
    id: 'jgEye', subclassId: 'human_huntsman', name: 'Глаз егеря', type: 'passive',
    iconPng: 'img/skills/subclass/jgEye.webp',
    maxLevel: 5,
    levels: [ { crit: 3, critDmg: 10 }, { crit: 4, critDmg: 15 }, { crit: 5, critDmg: 20 }, { crit: 6, critDmg: 25 }, { crit: 8, critDmg: 30 } ],
    getDesc: (lvl) => { const d = SKILLS.jgEye.levels[lvl-1]; return `Пассивно, с луком, арбалетом или кинжалом: ${scV('+' + d.crit + '%')} шанса крита и ${scV('+' + d.critDmg + '%')} к урону крита.`; },
    getNextDesc: (lvl) => scNext(SKILLS.jgEye, lvl, n => `+${n.crit}% крита, +${n.critDmg}% урона крита`),
  },
  jgSilver: {
    id: 'jgSilver', subclassId: 'human_huntsman', name: 'Серебряный наконечник', type: 'passive',
    iconPng: 'img/skills/subclass/jgSilver.webp',
    maxLevel: 5,
    levels: [ { undead: 10 }, { undead: 12 }, { undead: 15 }, { undead: 17 }, { undead: 20 } ],
    getDesc: (lvl) => { const d = SKILLS.jgSilver.levels[lvl-1]; return `Пассивно: ${scV('+' + d.undead + '%')} урона по нежити (твари с тегом «Мёртвый»), крит по нежити — ещё заряд Азарта.`; },
    getNextDesc: (lvl) => scNext(SKILLS.jgSilver, lvl, n => `+${n.undead}% по нежити`),
  },

  // ---- Храмовник ----
  tpSeal: {
    id: 'tpSeal', subclassId: 'human_templar', name: 'Печать света', type: 'active', freeTurn: true,
    iconPng: 'img/skills/subclass/tpSeal.webp',
    maxLevel: 5, cooldown: 8, turns: 5,
    levels: [ { mpCost: 10, pct: 20 }, { mpCost: 11, pct: 25 }, { mpCost: 12, pct: 30 }, { mpCost: 13, pct: 35 }, { mpCost: 14, pct: 40 } ],
    getDesc: (lvl) => { const s = SKILLS.tpSeal, d = s.levels[lvl-1]; return `Не тратит ход: ${s.turns} ходов каждый ваш удар оружием добавляет свет — ${scV(d.pct + '%')} силы света (маг. атака + половина физ.) сверху. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.tpSeal, lvl, n => `${n.pct}% маг. атаки, MP ${n.mpCost}`),
  },
  tpRadiance: {
    id: 'tpRadiance', subclassId: 'human_templar', name: 'Сияние', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/tpRadiance.webp',
    maxLevel: 5, ramp: 5, maxTurns: 10, undeadMult: 2,
    levels: [ { mpCost: 0, base: 8, mp: 4 }, { mpCost: 0, base: 9, mp: 4 }, { mpCost: 0, base: 10, mp: 3 }, { mpCost: 0, base: 11, mp: 3 }, { mpCost: 0, base: 12, mp: 2 } ],
    getDesc: (lvl) => { const s = SKILLS.tpRadiance, d = s.levels[lvl-1]; return `<b>Горит само</b>, пока стоит в слоте и есть мана: каждый ваш ход бьёт всех врагов светом на ${scV(d.base + '%')} силы света (маг. атака + половина физ.), +${s.ramp}% за каждый ход подряд (до ${s.maxTurns} ходов). Нежить — ×${s.undeadMult}. Стоит ${scV(d.mp)} MP за ход; мана кончилась — гаснет, и разгон с нуля.`; },
    getNextDesc: (lvl) => scNext(SKILLS.tpRadiance, lvl, n => `${n.base}% маг. атаки, ${n.mp} MP за ход`),
  },
  tpVow: {
    id: 'tpVow', subclassId: 'human_templar', name: 'Обет против тьмы', type: 'passive',
    iconPng: 'img/skills/subclass/tpVow.webp',
    maxLevel: 5,
    levels: [ { pct: 10 }, { pct: 12 }, { pct: 15 }, { pct: 17 }, { pct: 20 } ],
    getDesc: (lvl) => { const d = SKILLS.tpVow.levels[lvl-1]; return `Пассивно: нежить бьёт вас на ${scV(d.pct + '%')} слабее, а вы её — на ${scV(d.pct + '%')} сильнее.`; },
    getNextDesc: (lvl) => scNext(SKILLS.tpVow, lvl, n => `${n.pct}%`),
  },
  tpBalance: {
    id: 'tpBalance', subclassId: 'human_templar', name: 'Равновесие', type: 'passive',
    iconPng: 'img/skills/subclass/tpBalance.webp',
    maxLevel: 5,
    levels: [ { mp: 1 }, { mp: 1.5 }, { mp: 2 }, { mp: 2.5 }, { mp: 3 } ],
    getDesc: (lvl) => { const d = SKILLS.tpBalance.levels[lvl-1]; return `Пассивно: каждый удар оружием возвращает ${scV(d.mp)} MP (дробная часть — шансом). Кормит Сияние.`; },
    getNextDesc: (lvl) => scNext(SKILLS.tpBalance, lvl, n => `${n.mp} MP за удар`),
  },
});

// ========================================================
//  ЧЕЛОВЕК-МАГ: уровни 1–7 трёх старых заклинаний
// ========================================================
const SC_FIREBALL_LEVELS = [
  { mpCost: 10, multiplier: 2.00, burnPercent: 10 }, { mpCost: 11, multiplier: 2.24, burnPercent: 12 },
  { mpCost: 13, multiplier: 2.48, burnPercent: 15 }, { mpCost: 14, multiplier: 2.72, burnPercent: 17 },
  { mpCost: 15, multiplier: 2.96, burnPercent: 20 }, { mpCost: 16, multiplier: 3.20, burnPercent: 22 },
  { mpCost: 17, multiplier: 3.44, burnPercent: 25 },
];
const SC_ICE_LEVELS = [
  { mpCost: 12, multiplier: 2.07 }, { mpCost: 13, multiplier: 2.34 }, { mpCost: 14, multiplier: 2.61 },
  { mpCost: 15, multiplier: 2.88 }, { mpCost: 17, multiplier: 3.15 }, { mpCost: 18, multiplier: 3.42 },
  { mpCost: 19, multiplier: 3.69 },
];
const SC_VOLLEY_LEVELS = [
  { mpCost: 16, multiplier: 0.80, shots: 3, effectChance: 10 }, { mpCost: 17, multiplier: 0.87, shots: 3, effectChance: 12 },
  { mpCost: 19, multiplier: 0.95, shots: 3, effectChance: 14 }, { mpCost: 20, multiplier: 1.02, shots: 3, effectChance: 17 },
  { mpCost: 22, multiplier: 1.10, shots: 4, effectChance: 20 }, { mpCost: 23, multiplier: 1.17, shots: 4, effectChance: 22 },
  { mpCost: 24, multiplier: 1.25, shots: 4, effectChance: 25 },
];
const scMap = (arr, fn) => arr.map((x, i) => Object.assign({}, x, fn(x, i)));

// ========================================================
//  ЭЛЕМЕНТАЛИСТ (человек-маг, разрушитель)
// ========================================================
SUBCLASSES.human_elementalist.mods = {
  fireball: {
    name: 'Огненный шар', shatterMult: 1.5,
    levels: SC_FIREBALL_LEVELS,
    getDesc: (lvl, skill = SKILLS.fireball) => { const s = skill, d = s.levels[lvl-1]; return `Огненный удар на ${scX(d.multiplier)}, поджог на ${s.burnTurns} хода по ${scV(d.burnPercent + '%')} маг. атаки. <b>Раскол:</b> по замороженной — ${scX(1.5)}, заморозка спадает. MP: ${scV(d.mpCost)}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.fireball, lvl, n => `×${n.multiplier.toFixed(2)}, поджог ${n.burnPercent}%, MP ${n.mpCost}`),
  },
  iceArrow: {
    name: 'Ледяная стрела', freezeChance: 35,
    levels: SC_ICE_LEVELS,
    getDesc: (lvl, skill = SKILLS.iceArrow) => { const s = skill, d = s.levels[lvl-1]; return `Ледяной удар на ${scX(d.multiplier)}. Шанс ${scV(s.freezeChance + '%')} заморозить (пропуск удара); замороженную Огненный шар раскалывает. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.iceArrow, lvl, n => `×${n.multiplier.toFixed(2)}, MP ${n.mpCost}`),
  },
  elementalVolley: {
    name: 'Буря стихий',
    levels: SC_VOLLEY_LEVELS,
    getDesc: (lvl, skill = SKILLS.elementalVolley) => { const s = skill, d = s.levels[lvl-1]; return `${scV(d.shots)} снаряда по ${scX(d.multiplier)} — огонь, лёд и молния <b>гарантированно</b> все три. Шанс ${scV(d.effectChance + '%')} эффекта стихии. Резонанс — каждый раз: следующий Шар или Стрела без маны. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.elementalVolley, lvl, n => `${n.shots} снаряда, ×${n.multiplier.toFixed(2)}, эффект ${n.effectChance}%`),
  },
};

// ========================================================
//  ЖРЕЦ (человек-маг, опора). Свет = магия Жизни.
// ========================================================
SUBCLASSES.human_priest.mods = {
  fireball: {
    name: 'Кара', undeadMult: 1.5, healPct: 20,
    levels: SC_FIREBALL_LEVELS,
    getDesc: (lvl, skill = SKILLS.fireball) => { const s = skill, d = s.levels[lvl-1]; return `Удар светом на ${scX(d.multiplier)}, нежить — ${scX(1.5)}. Лечит ${scV('20%')} нанесённого. Усиливается и качает Жизнь. MP: ${scV(d.mpCost)}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.fireball, lvl, n => `×${n.multiplier.toFixed(2)}, MP ${n.mpCost}`),
  },
  iceArrow: {
    name: 'Оковы света', weakTurns: 3, weakPct: 20,
    levels: scMap(SC_ICE_LEVELS, (x, i) => ({ stun: [25, 27, 30, 32, 35, 37, 40][i] })),
    getDesc: (lvl, skill = SKILLS.iceArrow) => { const s = skill, d = s.levels[lvl-1], mod = SUBCLASSES.human_priest.mods.iceArrow; return `Свет на ${scX(d.multiplier)}. Шанс ${scV(d.stun + '%')} оглушить; цель ${mod.weakTurns} хода бьёт на ${scV(mod.weakPct + '%')} слабее. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.iceArrow, lvl, n => `×${n.multiplier.toFixed(2)}, оглушение ${n.stun}%`),
  },
  elementalVolley: {
    name: 'Благодатный дождь',
    levels: scMap(SC_VOLLEY_LEVELS, (x, i) => ({ heal: [2, 2.2, 2.5, 2.7, 3, 3.2, 3.5][i] })),
    getDesc: (lvl, skill = SKILLS.elementalVolley) => { const s = skill, d = s.levels[lvl-1]; return `${scV(d.shots)} капли света по ${scX(d.multiplier)} в случайных врагов, каждое попадание лечит ${scV(d.heal + '%')} макс. HP. Качает Жизнь. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.elementalVolley, lvl, n => `${n.shots} капли, ×${n.multiplier.toFixed(2)}, лечение ${n.heal}%`),
  },
};

// ========================================================
//  НЕКРОМАНТ (человек-маг, союзники)
//  Поднимает не саму тварь, а нежить со статами от убитой (до 3, после боя рассыпаются):
//  Плоть → зомби, Конструкт/Камень/Древо → дух, остальные → скелет.
// ========================================================
const NECRO_ALLY_MAX = 3;
const NECRO_KINDS = {
  zombie:   { name: 'Зомби',  img: 'img/allies/necro_zombie.webp',   hp: 0.60, atk: 0.40, dodge: 0,  slow: true },
  skeleton: { name: 'Скелет', img: 'img/allies/necro_skeleton.webp', hp: 0.35, atk: 0.60, dodge: 5,  slow: false },
  spirit:   { name: 'Дух',    img: 'img/allies/necro_spirit.webp',   hp: 0.25, atk: 0.50, dodge: 50, slow: false },
};
SUBCLASSES.human_necromancer.mods = {
  fireball: {
    name: 'Костяное копьё',
    levels: SC_FIREBALL_LEVELS,
    getDesc: (lvl, skill = SKILLS.fireball) => { const s = skill, d = s.levels[lvl-1]; return `Копьё Смерти на ${scX(d.multiplier)}. Убило — павший встаёт бесплатно, если есть место (до ${NECRO_ALLY_MAX} слуг). Усиливается и качает Смерть. MP: ${scV(d.mpCost)}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.fireball, lvl, n => `×${n.multiplier.toFixed(2)}, MP ${n.mpCost}`),
  },
  iceArrow: {
    name: 'Проклятие слабости', weakTurns: 3,
    levels: scMap(SC_ICE_LEVELS, (x, i) => ({ weak: [15, 17, 18, 20, 22, 23, 25][i] })),
    getDesc: (lvl, skill = SKILLS.iceArrow) => { const s = skill, d = s.levels[lvl-1], mod = SUBCLASSES.human_necromancer.mods.iceArrow; return `Проклятие Смерти на ${scX(d.multiplier)}: цель ${mod.weakTurns} хода бьёт на ${scV(d.weak + '%')} слабее. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.iceArrow, lvl, n => `×${n.multiplier.toFixed(2)}, ослабление ${n.weak}%`),
  },
  elementalVolley: {
    name: 'Зов могил',
    levels: scMap(SC_VOLLEY_LEVELS, x => ({ targets: x.shots })),
    getDesc: (lvl, skill = SKILLS.elementalVolley) => { const s = skill, d = s.levels[lvl-1]; return `Смерть бьёт до ${scV(d.targets)} врагов на ${scX(d.multiplier)} каждого. Убитые встают слугами, пока есть место. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.elementalVolley, lvl, n => `${n.targets} цели, ×${n.multiplier.toFixed(2)}`),
  },
};

Object.assign(SUBCLASS_SKILLS, {
  // ---- Элементалист ----
  elLightning: {
    id: 'elLightning', subclassId: 'human_elementalist', name: 'Удар молнии', type: 'active',
    iconPng: 'img/skills/subclass/elLightning.webp',
    maxLevel: 5, cooldown: 4, shockTurns: 2, burstPct: 50,
    levels: [
      { mpCost: 14, multiplier: 1.8, atbCut: 20, manaBurn: 20 }, { mpCost: 15, multiplier: 2.0, atbCut: 25, manaBurn: 25 },
      { mpCost: 16, multiplier: 2.2, atbCut: 30, manaBurn: 30 }, { mpCost: 17, multiplier: 2.4, atbCut: 35, manaBurn: 35 },
      { mpCost: 18, multiplier: 2.6, atbCut: 40, manaBurn: 40 },
    ],
    getDesc: (lvl) => { const s = SKILLS.elLightning, d = s.levels[lvl-1]; return `Молния на ${scX(d.multiplier)}: шкала ATB стаи ${scV('−' + d.atbCut + '%')}, у магических тварей выжигает ${scV(d.manaBurn + '%')} маны. По горящей — <b>взрыв</b>: соседи получают ${scV(s.burstPct + '%')} урона. Цель ${s.shockTurns} хода «под током». Качает Молнию. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.elLightning, lvl, n => `×${n.multiplier.toFixed(2)}, ATB −${n.atbCut}%, мана −${n.manaBurn}%`),
  },
  elEcho: {
    id: 'elEcho', subclassId: 'human_elementalist', name: 'Отголосок', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/elEcho.webp',
    maxLevel: 5,
    levels: [ { mpCost: 0, chance: 60 }, { mpCost: 0, chance: 70 }, { mpCost: 0, chance: 80 }, { mpCost: 0, chance: 90 }, { mpCost: 0, chance: 100 } ],
    getDesc: (lvl) => { const d = SKILLS.elEcho.levels[lvl-1]; return `<b>Срабатывает сам</b>, пока стоит в слоте. Тварь умерла горящей, замороженной или под током — с шансом ${scV(d.chance + '%')} эффект перескакивает на соседа. Ничего не стоит — цена в занятом слоте.`; },
    getNextDesc: (lvl) => scNext(SKILLS.elEcho, lvl, n => `шанс ${n.chance}%`),
  },
  elFusion: {
    id: 'elFusion', subclassId: 'human_elementalist', name: 'Сплав стихий', type: 'passive',
    iconPng: 'img/skills/subclass/elFusion.webp',
    maxLevel: 5,
    levels: [ { pct: 10 }, { pct: 12 }, { pct: 15 }, { pct: 17 }, { pct: 20 } ],
    getDesc: (lvl) => { const d = SKILLS.elFusion.levels[lvl-1]; return `Пассивно: если на цели эффекты двух стихий (горение, заморозка, ток) — ${scV('+' + d.pct + '%')} вашего урона по ней.`; },
    getNextDesc: (lvl) => scNext(SKILLS.elFusion, lvl, n => `+${n.pct}%`),
  },
  elShift: {
    id: 'elShift', subclassId: 'human_elementalist', name: 'Смена стихий', type: 'passive',
    iconPng: 'img/skills/subclass/elShift.webp',
    maxLevel: 5,
    levels: [ { pct: 10 }, { pct: 12 }, { pct: 15 }, { pct: 17 }, { pct: 20 } ],
    getDesc: (lvl) => { const d = SKILLS.elShift.levels[lvl-1]; return `Пассивно: заклинание другой стихии, чем прошлое, стоит на ${scV(d.pct + '%')} меньше маны.`; },
    getNextDesc: (lvl) => scNext(SKILLS.elShift, lvl, n => `−${n.pct}% MP`),
  },

  // ---- Жрец ----
  prBlessing: {
    id: 'prBlessing', subclassId: 'human_priest', name: 'Благословение', type: 'active', freeTurn: true,
    iconPng: 'img/skills/subclass/prBlessing.webp',
    maxLevel: 5, cooldown: 3,
    levels: [
      { mpCost: 15, cut: 8, regen: 1 }, { mpCost: 16, cut: 10, regen: 1.2 }, { mpCost: 17, cut: 11, regen: 1.5 },
      { mpCost: 18, cut: 13, regen: 1.7 }, { mpCost: 19, cut: 15, regen: 2 },
    ],
    getDesc: (lvl) => { const d = SKILLS.prBlessing.levels[lvl-1]; return `Не тратит ход: до конца боя входящий урон ${scV('−' + d.cut + '%')} и ${scV(d.regen + '%')} макс. HP лечения в начале каждого вашего хода. Автобой благословляет себя в начале боя. MP: ${scV(d.mpCost)}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.prBlessing, lvl, n => `−${n.cut}% урона, ${n.regen}% HP за ход`),
  },
  prIntercede: {
    id: 'prIntercede', subclassId: 'human_priest', name: 'Заступничество', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/prIntercede.webp',
    maxLevel: 5, threshold: 35, every: 4,
    levels: [ { mpCost: 0, heal: 15 }, { mpCost: 0, heal: 17 }, { mpCost: 0, heal: 20 }, { mpCost: 0, heal: 22 }, { mpCost: 0, heal: 25 } ],
    getDesc: (lvl) => { const s = SKILLS.prIntercede, d = s.levels[lvl-1]; return `<b>Срабатывает само</b>, пока стоит в слоте: HP упало ниже ${s.threshold}% — лечение на ${scV(d.heal + '%')} макс. HP. Не чаще раза в ${s.every} хода. Ничего не стоит — цена в занятом слоте.`; },
    getNextDesc: (lvl) => scNext(SKILLS.prIntercede, lvl, n => `лечение ${n.heal}%`),
  },
  prGrace: {
    id: 'prGrace', subclassId: 'human_priest', name: 'Благодать', type: 'passive',
    iconPng: 'img/skills/subclass/prGrace.webp',
    maxLevel: 5,
    levels: [ { cap: 20 }, { cap: 25 }, { cap: 30 }, { cap: 35 }, { cap: 40 } ],
    getDesc: (lvl) => { const d = SKILLS.prGrace.levels[lvl-1]; return `Пассивно, только в бою: лечение сверх полного HP (любое — навыки, зелья, реген) копится барьером до ${scV(d.cap + '%')} макс. HP. Барьер принимает удары первым; после боя пропадает.`; },
    getNextDesc: (lvl) => scNext(SKILLS.prGrace, lvl, n => `барьер до ${n.cap}%`),
  },
  prCleanse: {
    id: 'prCleanse', subclassId: 'human_priest', name: 'Очищение', type: 'passive',
    iconPng: 'img/skills/subclass/prCleanse.webp',
    maxLevel: 5,
    levels: [ { step: 14 }, { step: 13 }, { step: 12 }, { step: 11 }, { step: 10 } ],
    getDesc: (lvl) => { const d = SKILLS.prCleanse.levels[lvl-1]; return `Пассивно: каждые ${scV(d.step + '%')} макс. HP, восстановленные любым лечением, снимают с вас один вредный эффект (яд, кровотечение, паутина).`; },
    getNextDesc: (lvl) => scNext(SKILLS.prCleanse, lvl, n => `каждые ${n.step}%`),
  },

  // ---- Некромант ----
  nmRaise: {
    id: 'nmRaise', subclassId: 'human_necromancer', name: 'Поднять павшего', type: 'active', freeTurn: true,
    fxAnim: 'summon',
    iconPng: 'img/skills/subclass/nmRaise.webp',
    maxLevel: 5, cooldown: 3,
    levels: [ { mpCost: 14, power: 40 }, { mpCost: 15, power: 45 }, { mpCost: 16, power: 50 }, { mpCost: 17, power: 55 }, { mpCost: 18, power: 60 } ],
    getDesc: (lvl) => { const d = SKILLS.nmRaise.levels[lvl-1]; return `Не тратит ход: поднимает последнюю убитую тварь нежитью на ${scV(d.power + '%')} её силы: Плоть — зомби (крепкий, медленный), Конструкт / Камень / Древо — дух (хрупкий, увёртливый), остальные — скелет. Трупа нет — встаёт скелет-страж от вашей маг. атаки. До ${NECRO_ALLY_MAX} слуг, после боя рассыпаются. Ваши бесплатные подъёмы (Копьё, Зов могил) — той же силы. MP: ${scV(d.mpCost)}. КД: ${SKILLS.nmRaise.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.nmRaise, lvl, n => `${n.power}% силы`),
    useCheck: () => (necroAllies().length >= NECRO_ALLY_MAX ? 'нет места для слуги' : ''),
  },
  nmBonePlate: {
    id: 'nmBonePlate', subclassId: 'human_necromancer', name: 'Костяная плата', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/nmBonePlate.webp',
    maxLevel: 5,
    levels: [ { mpCost: 0, over: 20 }, { mpCost: 0, over: 18 }, { mpCost: 0, over: 16 }, { mpCost: 0, over: 14 }, { mpCost: 0, over: 12 } ],
    getDesc: (lvl) => { const d = SKILLS.nmBonePlate.levels[lvl-1]; return `<b>Срабатывает сама</b>, пока стоит в слоте: удар по вам больше ${scV(d.over + '%')} макс. HP целиком принимает слуга. Ничего не стоит — цена в занятом слоте.`; },
    getNextDesc: (lvl) => scNext(SKILLS.nmBonePlate, lvl, n => `удар больше ${n.over}% HP`),
  },
  nmBonds: {
    id: 'nmBonds', subclassId: 'human_necromancer', name: 'Узы смерти', type: 'passive',
    iconPng: 'img/skills/subclass/nmBonds.webp',
    maxLevel: 5,
    levels: [ { atk: 6, hp: 5 }, { atk: 8, hp: 7 }, { atk: 10, hp: 10 }, { atk: 12, hp: 12 }, { atk: 15, hp: 15 } ],
    getDesc: (lvl) => { const d = SKILLS.nmBonds.levels[lvl-1]; return `Пассивно: каждый слуга получает ${scV(d.atk + '%')} вашей маг. атаки к удару и ${scV(d.hp + '%')} вашего макс. HP.`; },
    getNextDesc: (lvl) => scNext(SKILLS.nmBonds, lvl, n => `${n.atk}% маг. атаки, ${n.hp}% HP`),
  },
  nmFeast: {
    id: 'nmFeast', subclassId: 'human_necromancer', name: 'Пир смерти', type: 'passive',
    iconPng: 'img/skills/subclass/nmFeast.webp',
    maxLevel: 5,
    levels: [ { mp: 8 }, { mp: 10 }, { mp: 12 }, { mp: 14 }, { mp: 16 } ],
    getDesc: (lvl) => { const d = SKILLS.nmFeast.levels[lvl-1]; return `Пассивно: слуга пал — вы получаете ${scV(d.mp + '%')} макс. MP.`; },
    getNextDesc: (lvl) => scNext(SKILLS.nmFeast, lvl, n => `${n.mp}% MP`),
  },
});

// ========================================================
//  ОРК: уровни 1–7 старых навыков
// ========================================================
const SC_WAR_PS_LEVELS = [
  { mpCost: 10, multiplier: 2.0 }, { mpCost: 11, multiplier: 2.25 }, { mpCost: 13, multiplier: 2.5 },
  { mpCost: 14, multiplier: 2.75 }, { mpCost: 15, multiplier: 3.0 }, { mpCost: 16, multiplier: 3.25 },
  { mpCost: 17, multiplier: 3.5 },
];
const SC_RAGE_LEVELS = [
  { mpCost: 0, multiplier: 2.2, recoilPercent: 4, harvestCdCut: 1 }, { mpCost: 0, multiplier: 2.4, recoilPercent: 4, harvestCdCut: 1 },
  { mpCost: 0, multiplier: 2.6, recoilPercent: 4, harvestCdCut: 1 }, { mpCost: 0, multiplier: 2.8, recoilPercent: 4, harvestCdCut: 2 },
  { mpCost: 0, multiplier: 3.5, recoilPercent: 4, harvestCdCut: 2 }, { mpCost: 0, multiplier: 3.7, recoilPercent: 4, harvestCdCut: 2 },
  { mpCost: 0, multiplier: 3.9, recoilPercent: 4, harvestCdCut: 2 },
];
const SC_HARVEST_LEVELS = [
  { mpCost: 12, multiplier: 0.70, targets: 5, healPercent: 5 }, { mpCost: 13, multiplier: 0.77, targets: 5, healPercent: 5.5 },
  { mpCost: 14, multiplier: 0.85, targets: 5, healPercent: 6 }, { mpCost: 15, multiplier: 0.92, targets: 5, healPercent: 7 },
  { mpCost: 16, multiplier: 1.00, targets: 5, healPercent: 8 }, { mpCost: 17, multiplier: 1.07, targets: 5, healPercent: 8.5 },
  { mpCost: 18, multiplier: 1.15, targets: 5, healPercent: 9 },
];
const SC_WRATH_LEVELS = [
  { mpCost: 0, multiplier: 2.70, recoilPercent: 4 }, { mpCost: 0, multiplier: 3.03, recoilPercent: 4 },
  { mpCost: 0, multiplier: 3.35, recoilPercent: 4 }, { mpCost: 0, multiplier: 3.68, recoilPercent: 4 },
  { mpCost: 0, multiplier: 4.00, recoilPercent: 4 }, { mpCost: 0, multiplier: 4.30, recoilPercent: 4 },
  { mpCost: 0, multiplier: 4.60, recoilPercent: 4 },
];
const SC_PEST_LEVELS = [
  { mpCost: 16, targets: 3, dotPercent: 28, turns: 3 }, { mpCost: 17, targets: 3, dotPercent: 31, turns: 3 },
  { mpCost: 19, targets: 4, dotPercent: 34, turns: 4 }, { mpCost: 20, targets: 4, dotPercent: 38, turns: 5 },
  { mpCost: 22, targets: 5, dotPercent: 44, turns: 6 }, { mpCost: 23, targets: 5, dotPercent: 47, turns: 6 },
  { mpCost: 24, targets: 5, dotPercent: 50, turns: 6 },
];
const scPct = (arr) => arr;   // для читаемости таблиц ниже

// ========================================================
//  СКАЛА (орк-воин, танк): перелечивает урон
// ========================================================
SUBCLASSES.orc_rock.mods = {
  powerStrike: {
    name: 'Таран', stun: 15,
    levels: scMap(SC_WAR_PS_LEVELS, (x, i) => ({ hpPct: [5, 5.5, 6, 6.5, 7, 7.5, 8][i] })),
    getDesc: (lvl, skill = SKILLS.powerStrike) => { const s = skill, d = s.levels[lvl-1]; return `Таран на ${scX(d.multiplier)} и ещё ${scV(d.hpPct + '%')} вашего макс. HP. Шанс ${scV('15%')} оглушить. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.powerStrike, lvl, n => `×${n.multiplier.toFixed(2)} + ${n.hpPct}% HP`),
  },
  orcRage: {
    name: 'Ответная ярость', minHpPercent: 0, lifePct: 30,
    levels: scMap(SC_RAGE_LEVELS, () => ({ recoilPercent: 0 })),
    getDesc: (lvl, skill = SKILLS.orcRage) => { const s = skill, d = s.levels[lvl-1]; return `Удар на ${scX(d.multiplier)}, при любом HP и без отдачи. Чем меньше у вас HP, тем сильнее — до ${scX(2)} на последнем издыхании. ${scV('30%')} урона возвращается здоровьем. Убийство: КД Жатвы −${scV(d.harvestCdCut)}. Качает Смерть. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.orcRage, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  bloodHarvest: {
    name: 'Жатва с рыком', roarTurns: 3, roarPct: 15,
    levels: SC_HARVEST_LEVELS,
    getDesc: (lvl, skill = SKILLS.bloodHarvest) => { const s = skill, d = s.levels[lvl-1]; return `Широкий удар по всем (до ${scV(d.targets)}) на ${scX(d.multiplier)}. <b>Рык:</b> задетые 3 хода бьют только вас и на ${scV('15%')} слабее. За каждого убитого — ${scV(d.healPercent + '%')} макс. HP. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.bloodHarvest, lvl, n => `×${n.multiplier.toFixed(2)}, лечение ${n.healPercent}%`),
  },
};

// ========================================================
//  БЕРСЕРК (орк-воин, урон): навыки за кровь
//  Кровавая цена: все навыки стоят 4% макс. HP вместо маны; убийство возвращает (BERSERK_HP_BACK %);
//  ниже 15% HP навыки HP не тратят.
// ========================================================
const BERSERK_HP_COST = 4;
const BERSERK_FREE_BELOW = 15;
const BERSERK_HP_BACK = 100;   // % заплаченной крови, который возвращает убийство
SUBCLASSES.orc_berserker.mods = {
  powerStrike: {
    name: 'Сокрушить',
    levels: scMap(SC_WAR_PS_LEVELS, (x, i) => ({ mpCost: 0, pierce: [30, 33, 37, 40, 43, 47, 50][i] })),
    getDesc: (lvl, skill = SKILLS.powerStrike) => { const s = skill, d = s.levels[lvl-1]; return `Сокрушающий удар на ${scX(d.multiplier)}. С двуручным пробивает ${scV(d.pierce + '%')} защиты (против Толстокожих). <b>Кровавая цена:</b> ${BERSERK_HP_COST}% HP вместо маны, убийство возвращает заплаченное. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.powerStrike, lvl, n => `×${n.multiplier.toFixed(2)}, пробой ${n.pierce}%`),
  },
  orcRage: {
    name: 'Безумная ярость', minHpPercent: 0, maxBonus: 60, noRecoilBelow: 30,
    levels: SC_RAGE_LEVELS,
    getDesc: (lvl, skill = SKILLS.orcRage) => { const s = skill, d = s.levels[lvl-1]; return `Удар на ${scX(d.multiplier)} при любом HP: ${scV('+1%')} урона за каждый 1% потерянного HP (до ${scV('+60%')}). Отдача ${scV(d.recoilPercent + '%')} HP, ниже 30% HP — без отдачи. Убийство: КД Размаха −${scV(d.harvestCdCut)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.orcRage, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  bloodHarvest: {
    name: 'Кровавый размах', twoHandTargets: 1, twoHandMult: 1.0,
    levels: scMap(SC_HARVEST_LEVELS, () => ({ mpCost: 0 })),
    getDesc: (lvl, skill = SKILLS.bloodHarvest) => { const s = skill, d = s.levels[lvl-1]; return `Широкий удар по всем (до ${scV(d.targets)}) на ${scX(d.multiplier)}; с двуручным — ещё одна цель. За каждого убитого — ${scV(d.healPercent + '%')} макс. HP. <b>Кровавая цена:</b> ${BERSERK_HP_COST}% HP, убийство возвращает заплаченное. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.bloodHarvest, lvl, n => `×${n.multiplier.toFixed(2)}, лечение ${n.healPercent}%`),
  },
};

// ========================================================
//  ВОЖДЬ (орк-воин, гибрид): Смерть и предки
// ========================================================
SUBCLASSES.orc_chieftain.mods = {
  powerStrike: {
    name: 'Удар предков', magPart: 0.5, enemyHpPct: 2,
    levels: SC_WAR_PS_LEVELS,
    getDesc: (lvl, skill = SKILLS.powerStrike) => { const s = skill, d = s.levels[lvl-1]; return `(атака + маг. атака ×0.5) × ${scX(d.multiplier)} и ещё ${scV('2%')} от макс. HP врага. Сила предков — Смерть. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.powerStrike, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  orcRage: {
    name: 'Клинок духов',
    levels: SC_RAGE_LEVELS,
    getDesc: (lvl, skill = SKILLS.orcRage) => { const s = skill, d = s.levels[lvl-1]; return `Удар на ${scX(d.multiplier)}, половина урона — магия Смерти: защиту режет наполовину физ., наполовину маг. Без маны, отдача ${scV(d.recoilPercent + '%')} HP, только при HP от 50%. Убийство: КД Жатвы −${scV(d.harvestCdCut)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.orcRage, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  bloodHarvest: {
    name: 'Жатва предков', rotPct: 15,
    levels: scMap(SC_HARVEST_LEVELS, (x, i) => ({ rotTurns: i < 3 ? 2 : 3 })),
    getDesc: (lvl, skill = SKILLS.bloodHarvest) => { const s = skill, d = s.levels[lvl-1]; return `Широкий удар по всем (до ${scV(d.targets)}) на ${scX(d.multiplier)}, задетые гниют ${scV(d.rotTurns)} хода (${scV('15%')} маг. атаки за ход). За каждого убитого — ${scV(d.healPercent + '%')} макс. HP. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.bloodHarvest, lvl, n => `×${n.multiplier.toFixed(2)}, гниение ${n.rotTurns} хода`),
  },
};

// ========================================================
//  ПРОКЛИНАТЕЛЬ (орк-маг, разрушитель): разные проклятия на одной цели
// ========================================================
SUBCLASSES.orc_hexer.mods = {
  fireball: {
    name: 'Трупный огонь', rotPct: 15, rotTurns: 3,
    levels: SC_FIREBALL_LEVELS,
    getDesc: (lvl, skill = SKILLS.fireball) => { const s = skill, d = s.levels[lvl-1]; return `Огонь на ${scX(d.multiplier)}: поджог по ${scV(d.burnPercent + '%')} маг. атаки и слой Гниения (${scV('15%')} маг. атаки, 3 хода). MP: ${scV(d.mpCost)}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.fireball, lvl, n => `×${n.multiplier.toFixed(2)}, MP ${n.mpCost}`),
  },
  spiritWrath: {
    name: 'Гнев',
    levels: SC_WRATH_LEVELS,
    getDesc: (lvl, skill = SKILLS.spiritWrath) => { const s = skill, d = s.levels[lvl-1]; return `Гнев духов на ${scX(d.multiplier)} и ${scV(DEATH_MAGIC_MAX_HP_PERCENT + '%')} макс. HP врага. ${scV('+10%')} за каждое разное проклятие на цели и ${scV('+5%')} за слой Гниения. Отдача ${scV(d.recoilPercent + '%')}, только при HP от 50%. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.spiritWrath, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  pestilence: {
    name: 'Мор', rotMaxLayers: 4,
    levels: SC_PEST_LEVELS,
    getDesc: (lvl, skill = SKILLS.pestilence) => { const s = skill, d = s.levels[lvl-1]; return `Гниение на ${scV(d.targets)} врагов: ${scV(d.dotPercent + '%')} маг. атаки и ${scV(DEATH_MAGIC_MAX_HP_PERCENT + '%')} макс. HP за ход, ${scV(d.turns)} хода. До <b>4 слоёв</b>. Перескакивает при смерти. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.pestilence, lvl, n => `${n.targets} цели, ${n.dotPercent}%, ${n.turns} хода`),
  },
};

// ========================================================
//  КОСТОПРАВ (орк-маг, опора): лечит через кровь и Гниение
// ========================================================
SUBCLASSES.orc_healer.mods = {
  fireball: {
    name: 'Порча', weakTurns: 3,
    levels: scMap(SC_FIREBALL_LEVELS, (x, i) => ({ weak: [15, 17, 18, 20, 22, 23, 25][i] })),
    getDesc: (lvl, skill = SKILLS.fireball) => { const s = skill, d = s.levels[lvl-1]; return `Порча Смертью на ${scX(d.multiplier)}: цель 3 хода бьёт на ${scV(d.weak + '%')} слабее. MP: ${scV(d.mpCost)}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.fireball, lvl, n => `×${n.multiplier.toFixed(2)}, ослабление ${n.weak}%`),
  },
  spiritWrath: {
    name: 'Кровопуск', minHpPercent: 0,
    levels: scMap(SC_WRATH_LEVELS, (x, i) => ({ recoilPercent: 0, heal: [20, 22, 25, 27, 30, 32, 35][i] })),
    getDesc: (lvl, skill = SKILLS.spiritWrath) => { const s = skill, d = s.levels[lvl-1]; return `Гнев на ${scX(d.multiplier)} и ${scV(DEATH_MAGIC_MAX_HP_PERCENT + '%')} макс. HP врага — без отдачи и при любом HP: ${scV(d.heal + '%')} урона лечит вас. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.spiritWrath, lvl, n => `×${n.multiplier.toFixed(2)}, лечение ${n.heal}%`),
  },
  pestilence: {
    name: 'Иссушение',
    levels: scMap(SC_PEST_LEVELS, (x, i) => ({ heal: [20, 22, 25, 27, 30, 32, 35][i] })),
    getDesc: (lvl, skill = SKILLS.pestilence) => { const s = skill, d = s.levels[lvl-1]; return `Гниение на ${scV(d.targets)} врагов: ${scV(d.dotPercent + '%')} маг. атаки за ход, ${scV(d.turns)} хода. Каждый тик Гниения лечит вас на ${scV(d.heal + '%')} нанесённого. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.pestilence, lvl, n => `${n.dotPercent}%, лечение ${n.heal}%`),
  },
};

// ========================================================
//  ШАМАН (орк-маг, союзники): случайные тотемы
// ========================================================
const TOTEM_KINDS = {
  stone:  { name: 'Тотем Камня',  img: 'img/allies/totem_stone.webp',  hp: 0.6, atk: 0,   taunt: true, desc: 'принимает удары' },
  rage:   { name: 'Тотем Ярости', img: 'img/allies/totem_rage.webp',   hp: 0.3, atk: 0.6, desc: 'стреляет' },
  spirit: { name: 'Тотем Духов',  img: 'img/allies/totem_spirit.webp', hp: 0.3, atk: 0,   healHp: 2, healMp: 2, desc: 'лечит и даёт ману' },
};
SUBCLASSES.orc_shaman.mods = {
  fireball: {
    name: 'Искра предков', perTotem: 15,
    levels: SC_FIREBALL_LEVELS,
    getDesc: (lvl, skill = SKILLS.fireball) => { const s = skill, d = s.levels[lvl-1]; return `Огонь предков на ${scX(d.multiplier)}, поджог по ${scV(d.burnPercent + '%')} маг. атаки. ${scV('+15%')} урона за каждый стоящий тотем. MP: ${scV(d.mpCost)}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.fireball, lvl, n => `×${n.multiplier.toFixed(2)}, MP ${n.mpCost}`),
  },
  spiritWrath: {
    name: 'Гнев',
    levels: SC_WRATH_LEVELS,
    getDesc: (lvl, skill = SKILLS.spiritWrath) => { const s = skill, d = s.levels[lvl-1]; return `Гнев духов на ${scX(d.multiplier)} и ${scV(DEATH_MAGIC_MAX_HP_PERCENT + '%')} макс. HP врага. Отдачу ${scV(d.recoilPercent + '%')} принимает тотем, если он стоит. Только при HP от 50%. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.spiritWrath, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  pestilence: {
    name: 'Круг гнили', perTotem: 20,
    levels: SC_PEST_LEVELS,
    getDesc: (lvl, skill = SKILLS.pestilence) => { const s = skill, d = s.levels[lvl-1]; return `Гниение на ${scV(d.targets)} врагов: ${scV(d.dotPercent + '%')} маг. атаки за ход, ${scV(d.turns)} хода; ${scV('+20%')} урона за каждый тотем в круге. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.pestilence, lvl, n => `${n.targets} цели, ${n.dotPercent}%`),
  },
};

Object.assign(SUBCLASS_SKILLS, {
  // ---- Скала ----
  rkTrance: {
    id: 'rkTrance', subclassId: 'orc_rock', name: 'Боевой транс', type: 'active', freeTurn: true,
    iconPng: 'img/skills/subclass/rkTrance.webp',
    maxLevel: 5, cooldown: 8, turns: 5,
    levels: [ { mpCost: 0, mult: 3, heal: 2 }, { mpCost: 0, mult: 3, heal: 2.5 }, { mpCost: 0, mult: 3, heal: 3 }, { mpCost: 0, mult: 3, heal: 3.5 }, { mpCost: 0, mult: 3, heal: 4 } ],
    getDesc: (lvl) => { const s = SKILLS.rkTrance, d = s.levels[lvl-1]; return `Не тратит ход: ${s.turns} ходов реген в бою ×${d.mult} и ${scV(d.heal + '%')} макс. HP в начале каждого вашего хода. Без затрат. Автобой входит в транс при HP ниже 60%. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.rkTrance, lvl, n => `${n.heal}% HP за ход`),
  },
  rkGuardian: {
    id: 'rkGuardian', subclassId: 'orc_rock', name: 'Дух-хранитель', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/rkGuardian.webp',
    maxLevel: 5, every: 4, over: 15,
    levels: [ { mpCost: 0, take: 50 }, { mpCost: 0, take: 55 }, { mpCost: 0, take: 60 }, { mpCost: 0, take: 65 }, { mpCost: 0, take: 70 } ],
    getDesc: (lvl) => { const s = SKILLS.rkGuardian, d = s.levels[lvl-1]; return `<b>Срабатывает сам</b>, пока стоит в слоте: удар больше ${s.over}% макс. HP — дух предка забирает ${scV(d.take + '%')} урона. Не чаще раза в ${s.every} хода. Ничего не стоит — цена в занятом слоте.`; },
    getNextDesc: (lvl) => scNext(SKILLS.rkGuardian, lvl, n => `забирает ${n.take}%`),
  },
  rkHide: {
    id: 'rkHide', subclassId: 'orc_rock', name: 'Шкура вместо щита', type: 'passive',
    iconPng: 'img/skills/subclass/rkHide.webp',
    maxLevel: 5,
    levels: [ { chance: 15 }, { chance: 17 }, { chance: 20 }, { chance: 22 }, { chance: 25 } ],
    getDesc: (lvl) => { const d = SKILLS.rkHide.levels[lvl-1]; return `Пассивно, только без щита: ${scV(d.chance + '%')} шанс принять удар на шкуру — урон вдвое меньше.`; },
    getNextDesc: (lvl) => scNext(SKILLS.rkHide, lvl, n => `${n.chance}%`),
  },
  rkBoil: {
    id: 'rkBoil', subclassId: 'orc_rock', name: 'Кровь кипит', type: 'passive',
    iconPng: 'img/skills/subclass/rkBoil.webp',
    maxLevel: 5,
    levels: [ { regen: 0.2 }, { regen: 0.25 }, { regen: 0.3 }, { regen: 0.35 }, { regen: 0.4 } ],
    getDesc: (lvl) => { const d = SKILLS.rkBoil.levels[lvl-1]; return `Пассивно: за каждые 10% потерянного HP — ${scV('+' + d.regen)} HP/сек регена в бою (до +${(d.regen * 9).toFixed(1)} на краю).`; },
    getNextDesc: (lvl) => scNext(SKILLS.rkBoil, lvl, n => `+${n.regen} HP/сек за 10%`),
  },

  // ---- Берсерк ----
  bkFrenzy: {
    id: 'bkFrenzy', subclassId: 'orc_berserker', name: 'Неистовство', type: 'active',
    iconPng: 'img/skills/subclass/bkFrenzy.webp',
    maxLevel: 5, cooldown: 8, turns: 4, hpCost: 10, defCut: 15,
    levels: [ { mpCost: 0, atb: 25, dmg: 20 }, { mpCost: 0, atb: 27, dmg: 22 }, { mpCost: 0, atb: 30, dmg: 25 }, { mpCost: 0, atb: 32, dmg: 27 }, { mpCost: 0, atb: 35, dmg: 30 } ],
    getDesc: (lvl) => { const s = SKILLS.bkFrenzy, d = s.levels[lvl-1]; return `Тратит ${s.hpCost}% HP: ${s.turns} хода шкала ATB быстрее на ${scV(d.atb + '%')}, урон ${scV('+' + d.dmg + '%')}, но входящий урон +${s.defCut}%. Автобой — при HP выше 50% против стаи или сильной твари. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.bkFrenzy, lvl, n => `ATB +${n.atb}%, урон +${n.dmg}%`),
  },
  bkThirst: {
    id: 'bkThirst', subclassId: 'orc_berserker', name: 'Жажда крови', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/bkThirst.webp',
    maxLevel: 5, every: 2,
    levels: [ { mpCost: 0, mult: 0.8 }, { mpCost: 0, mult: 0.9 }, { mpCost: 0, mult: 1.0 }, { mpCost: 0, mult: 1.1 }, { mpCost: 0, mult: 1.2 } ],
    getDesc: (lvl) => { const s = SKILLS.bkThirst, d = s.levels[lvl-1]; return `<b>Срабатывает сама</b>, пока стоит в слоте: убийство — в начале следующего хода бесплатный удар на ${scX(d.mult)} по новой цели (с двуручным — по двум). Не чаще раза в ${s.every} хода. Ничего не стоит — цена в занятом слоте.`; },
    getNextDesc: (lvl) => scNext(SKILLS.bkThirst, lvl, n => `×${n.mult.toFixed(2)}`),
  },
  bkTwoHand: {
    id: 'bkTwoHand', subclassId: 'orc_berserker', name: 'Двуручник', type: 'passive',
    iconPng: 'img/skills/subclass/bkTwoHand.webp',
    maxLevel: 5,
    levels: [ { dmg: 5, crit: 5 }, { dmg: 6, crit: 6 }, { dmg: 7, crit: 7 }, { dmg: 8, crit: 8 }, { dmg: 10, crit: 10 } ],
    getDesc: (lvl) => { const d = SKILLS.bkTwoHand.levels[lvl-1]; return `Пассивно, только с двуручным: урон ${scV('+' + d.dmg + '%')}, урон крита ${scV('+' + d.crit + '%')}, штраф уворота двуручного вдвое меньше.`; },
    getNextDesc: (lvl) => scNext(SKILLS.bkTwoHand, lvl, n => `+${n.dmg}%, крит +${n.crit}%`),
  },
  bkEdge: {
    id: 'bkEdge', subclassId: 'orc_berserker', name: 'На краю', type: 'passive',
    iconPng: 'img/skills/subclass/bkEdge.webp',
    maxLevel: 5,
    levels: [ { steal: 5 }, { steal: 6 }, { steal: 7 }, { steal: 8 }, { steal: 10 } ],
    getDesc: (lvl) => { const d = SKILLS.bkEdge.levels[lvl-1]; return `Пассивно: при HP ниже 50% ${scV(d.steal + '%')} вашего урона возвращается здоровьем, ниже 25% — вдвое больше.`; },
    getNextDesc: (lvl) => scNext(SKILLS.bkEdge, lvl, n => `${n.steal}%`),
  },

  // ---- Вождь ----
  chAncestor: {
    id: 'chAncestor', subclassId: 'orc_chieftain', name: 'Зов предка', type: 'active',
    iconPng: 'img/skills/subclass/chAncestor.webp',
    maxLevel: 5, cooldown: 8, turns: 6,
    levels: [
      { mpCost: 10, wolf: 15, bear: 10 }, { mpCost: 11, wolf: 17, bear: 12 }, { mpCost: 12, wolf: 20, bear: 14 },
      { mpCost: 13, wolf: 22, bear: 16 }, { mpCost: 14, wolf: 25, bear: 18 },
    ],
    getDesc: (lvl) => { const s = SKILLS.chAncestor, d = s.levels[lvl-1]; return `Тратит ход: ${s.turns} ходов рядом дух предка. HP выше 50% — <b>Волк</b>: шкала ATB и урон ${scV('+' + d.wolf + '%')}. Ниже — <b>Медведь</b>: входящий урон ${scV('−' + d.bear + '%')} и 2% HP за ход. Кто придёт, решают предки. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.chAncestor, lvl, n => `Волк +${n.wolf}%, Медведь −${n.bear}%`),
  },
  chBloodCurse: {
    id: 'chBloodCurse', subclassId: 'orc_chieftain', name: 'Проклятие крови', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/chBloodCurse.webp',
    maxLevel: 5, turns: 3,
    levels: [ { mpCost: 0, pct: 20 }, { mpCost: 0, pct: 25 }, { mpCost: 0, pct: 30 }, { mpCost: 0, pct: 35 }, { mpCost: 0, pct: 40 } ],
    getDesc: (lvl) => { const d = SKILLS.chBloodCurse.levels[lvl-1]; return `<b>Срабатывает само</b>, пока стоит в слоте: тварь, ударившая вас критом, гниёт 3 хода — ${scV(d.pct + '%')} маг. атаки за ход. Ничего не стоит — цена в занятом слоте.`; },
    getNextDesc: (lvl) => scNext(SKILLS.chBloodCurse, lvl, n => `${n.pct}% маг. атаки`),
  },
  chAncestralBlood: {
    id: 'chAncestralBlood', subclassId: 'orc_chieftain', name: 'Кровь предков', type: 'passive',
    iconPng: 'img/skills/subclass/chAncestralBlood.webp',
    maxLevel: 5,
    levels: [ { pct: 2 }, { pct: 2.5 }, { pct: 3 }, { pct: 3.5 }, { pct: 4 } ],
    getDesc: (lvl) => { const d = SKILLS.chAncestralBlood.levels[lvl-1]; return `Пассивно: ${scV(d.pct + '%')} вашего макс. HP прибавляется к маг. атаке.`; },
    getNextDesc: (lvl) => scNext(SKILLS.chAncestralBlood, lvl, n => `${n.pct}% HP`),
  },
  chTribute: {
    id: 'chTribute', subclassId: 'orc_chieftain', name: 'Дань павших', type: 'passive',
    iconPng: 'img/skills/subclass/chTribute.webp',
    maxLevel: 5,
    levels: [ { mp: 1.5, hp: 0.5 }, { mp: 1.7, hp: 0.6 }, { mp: 2, hp: 0.7 }, { mp: 2.2, hp: 0.8 }, { mp: 2.5, hp: 1 } ],
    getDesc: (lvl) => { const d = SKILLS.chTribute.levels[lvl-1]; return `Пассивно: каждое убийство — ${scV(d.mp + '%')} макс. MP и ${scV(d.hp + '%')} макс. HP.`; },
    getNextDesc: (lvl) => scNext(SKILLS.chTribute, lvl, n => `${n.mp}% MP, ${n.hp}% HP`),
  },

  // ---- Проклинатель ----
  hxCurse: {
    id: 'hxCurse', subclassId: 'orc_hexer', name: 'Наслать проклятие', type: 'active',
    iconPng: 'img/skills/subclass/hxCurse.webp',
    maxLevel: 5, cooldown: 2,
    levels: [ { mpCost: 12, base: 20 }, { mpCost: 13, base: 24 }, { mpCost: 14, base: 28 }, { mpCost: 15, base: 32 }, { mpCost: 16, base: 36 } ],
    getDesc: (lvl) => { const d = SKILLS.hxCurse.levels[lvl-1]; return `Вешает на цель следующее проклятие, которого на ней ещё нет (сила — ${scV(d.base + '%')} маг. атаки):<br>• <b>Сухотка</b> — 6 ходов, урон растёт ×1.5 каждый ход;<br>• <b>Ломота</b> — 5 ходов бьёт тварь каждый раз, когда она сама действует;<br>• <b>Приговор</b> — 3 хода копит 30% всего вашего урона по цели и выдаёт разом. MP: ${scV(d.mpCost)}. КД: ${SKILLS.hxCurse.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.hxCurse, lvl, n => `сила ${n.base}%`),
    useCheck: () => (hexerNextCurse(getCurrentMonster()) ? '' : 'все проклятия уже висят'),
  },
  hxBurst: {
    id: 'hxBurst', subclassId: 'orc_hexer', name: 'Взрыв проклятий', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/hxBurst.webp',
    maxLevel: 5,
    levels: [ { mpCost: 0, pct: 40 }, { mpCost: 0, pct: 50 }, { mpCost: 0, pct: 60 }, { mpCost: 0, pct: 70 }, { mpCost: 0, pct: 80 } ],
    getDesc: (lvl) => { const d = SKILLS.hxBurst.levels[lvl-1]; return `<b>Срабатывает сам</b>, пока стоит в слоте: проклятая тварь умерла — её проклятия перескакивают на соседа, а все рядом получают ${scV(d.pct + '%')} маг. атаки за каждое проклятие. Ничего не стоит — цена в занятом слоте.`; },
    getNextDesc: (lvl) => scNext(SKILLS.hxBurst, lvl, n => `${n.pct}% за проклятие`),
  },
  hxBlackBook: {
    id: 'hxBlackBook', subclassId: 'orc_hexer', name: 'Чёрная книга', type: 'passive',
    iconPng: 'img/skills/subclass/hxBlackBook.webp',
    maxLevel: 5,
    levels: [ { pct: 6 }, { pct: 7 }, { pct: 8 }, { pct: 9 }, { pct: 10 } ],
    getDesc: (lvl) => { const d = SKILLS.hxBlackBook.levels[lvl-1]; return `Пассивно: каждое разное проклятие на цели (Гниение, Сухотка, Ломота, Приговор) — ${scV('+' + d.pct + '%')} к урону всех ваших проклятий по ней.`; },
    getNextDesc: (lvl) => scNext(SKILLS.hxBlackBook, lvl, n => `+${n.pct}% за проклятие`),
  },
  hxCarrion: {
    id: 'hxCarrion', subclassId: 'orc_hexer', name: 'Падаль кормит', type: 'passive',
    iconPng: 'img/skills/subclass/hxCarrion.webp',
    maxLevel: 5,
    levels: [ { mp: 3 }, { mp: 3.5 }, { mp: 4 }, { mp: 4.5 }, { mp: 5 } ],
    getDesc: (lvl) => { const d = SKILLS.hxCarrion.levels[lvl-1]; return `Пассивно: проклятая тварь умерла — вы получаете ${scV(d.mp + '%')} макс. MP.`; },
    getNextDesc: (lvl) => scNext(SKILLS.hxCarrion, lvl, n => `${n.mp}% MP`),
  },

  // ---- Костоправ ----
  hlWarpaint: {
    id: 'hlWarpaint', subclassId: 'orc_healer', name: 'Боевая раскраска', type: 'active', freeTurn: true,
    iconPng: 'img/skills/subclass/hlWarpaint.webp',
    maxLevel: 5, cooldown: 3,
    levels: [ { mpCost: 12, dmg: 10, cut: 5 }, { mpCost: 13, dmg: 12, cut: 6 }, { mpCost: 14, dmg: 15, cut: 7 }, { mpCost: 15, dmg: 17, cut: 8 }, { mpCost: 16, dmg: 20, cut: 10 } ],
    getDesc: (lvl) => { const d = SKILLS.hlWarpaint.levels[lvl-1]; return `Не тратит ход: до конца боя ваш урон ${scV('+' + d.dmg + '%')}, входящий ${scV('−' + d.cut + '%')}. Автобой раскрашивается в начале боя. MP: ${scV(d.mpCost)}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.hlWarpaint, lvl, n => `+${n.dmg}% урона, −${n.cut}% входящего`),
  },
  hlBloodBond: {
    id: 'hlBloodBond', subclassId: 'orc_healer', name: 'Кровная связь', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/hlBloodBond.webp',
    maxLevel: 5, threshold: 35, every: 4,
    levels: [ { mpCost: 0, pct: 50 }, { mpCost: 0, pct: 60 }, { mpCost: 0, pct: 70 }, { mpCost: 0, pct: 80 }, { mpCost: 0, pct: 90 } ],
    getDesc: (lvl) => { const s = SKILLS.hlBloodBond, d = s.levels[lvl-1]; return `<b>Срабатывает сама</b>, пока стоит в слоте: HP упало ниже ${s.threshold}% — тянет кровь со всех врагов (${scV(d.pct + '%')} маг. атаки с каждого) и лечит вас на всю сумму. Не чаще раза в ${s.every} хода.`; },
    getNextDesc: (lvl) => scNext(SKILLS.hlBloodBond, lvl, n => `${n.pct}% маг. атаки`),
  },
  hlVitality: {
    id: 'hlVitality', subclassId: 'orc_healer', name: 'Живучесть', type: 'passive',
    iconPng: 'img/skills/subclass/hlVitality.webp',
    maxLevel: 5,
    levels: [ { pct: 10 }, { pct: 12 }, { pct: 15 }, { pct: 17 }, { pct: 20 } ],
    getDesc: (lvl) => { const d = SKILLS.hlVitality.levels[lvl-1]; return `Пассивно, в бою: любое лечение (навыки, зелья, реген, еда) лечит ещё на ${scV(d.pct + '%')} сверху.`; },
    getNextDesc: (lvl) => scNext(SKILLS.hlVitality, lvl, n => `+${n.pct}%`),
  },
  hlBrews: {
    id: 'hlBrews', subclassId: 'orc_healer', name: 'Отвары', type: 'passive',
    iconPng: 'img/skills/subclass/hlBrews.webp',
    maxLevel: 5,
    levels: [ { pct: 10 }, { pct: 12 }, { pct: 15 }, { pct: 17 }, { pct: 20 } ],
    getDesc: (lvl) => { const d = SKILLS.hlBrews.levels[lvl-1]; return `Пассивно, в бою: любое лечение возвращает ещё и ману — ${scV(d.pct + '%')} от вылеченного.`; },
    getNextDesc: (lvl) => scNext(SKILLS.hlBrews, lvl, n => `${n.pct}%`),
  },

  // ---- Шаман ----
  smTotem: {
    id: 'smTotem', subclassId: 'orc_shaman', name: 'Призыв тотема', type: 'active', freeTurn: 0.15,
    fxAnim: 'summon',
    iconPng: 'img/allies/totem_spirit.webp',
    maxLevel: 5, cooldown: 1,
    levels: [ { mpCost: 8, power: 60 }, { mpCost: 9, power: 70 }, { mpCost: 10, power: 80 }, { mpCost: 11, power: 90 }, { mpCost: 12, power: 100 } ],
    getDesc: (lvl) => { const d = SKILLS.smTotem.levels[lvl-1]; return `Быстрый: ${scV('15%')} хода сразу возвращается. Ставит случайный тотем (сила ${scV(d.power + '%')}): <b>Камня</b> — крепкий, принимает удары на себя; <b>Ярости</b> — стреляет; <b>Духов</b> — каждый ход 2% HP и 2% MP. До 3 тотемов, четвёртый заменяет самый старый. MP: ${scV(d.mpCost)}. КД: ${SKILLS.smTotem.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.smTotem, lvl, n => `сила ${n.power}%`),
  },
  smVengeance: {
    id: 'smVengeance', subclassId: 'orc_shaman', name: 'Месть тотема', type: 'active', semiPassive: true,
    iconPng: 'img/allies/totem_rage.webp',
    maxLevel: 5,
    levels: [ { mpCost: 0, pct: 80 }, { mpCost: 0, pct: 100 }, { mpCost: 0, pct: 120 }, { mpCost: 0, pct: 140 }, { mpCost: 0, pct: 160 } ],
    getDesc: (lvl) => { const d = SKILLS.smVengeance.levels[lvl-1]; return `<b>Срабатывает сама</b>, пока стоит в слоте: разбитый тотем взрывается — все враги получают ${scV(d.pct + '%')} маг. атаки Смертью.`; },
    getNextDesc: (lvl) => scNext(SKILLS.smVengeance, lvl, n => `${n.pct}%`),
  },
  smOak: {
    id: 'smOak', subclassId: 'orc_shaman', name: 'Резной дуб', type: 'passive',
    iconPng: 'img/allies/totem_stone.webp',
    maxLevel: 5,
    levels: [ { pct: 20 }, { pct: 25 }, { pct: 30 }, { pct: 35 }, { pct: 40 } ],
    getDesc: (lvl) => { const d = SKILLS.smOak.levels[lvl-1]; return `Пассивно: тотемы крепче — ${scV('+' + d.pct + '%')} HP.`; },
    getNextDesc: (lvl) => scNext(SKILLS.smOak, lvl, n => `+${n.pct}% HP`),
  },
  smVoice: {
    id: 'smVoice', subclassId: 'orc_shaman', name: 'Голос предков', type: 'passive',
    iconPng: 'img/skills/subclass/smVoice.webp',
    maxLevel: 5,
    levels: [ { pct: 10 }, { pct: 14 }, { pct: 18 }, { pct: 21 }, { pct: 25 } ],
    getDesc: (lvl) => { const d = SKILLS.smVoice.levels[lvl-1]; return `Пассивно: выстрелы тотема Ярости и лечение тотема Духов ${scV('+' + d.pct + '%')}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.smVoice, lvl, n => `+${n.pct}%`),
  },
});

// ========================================================
//  ЭЛЬФ: уровни 1–7 старых навыков
// ========================================================
const SC_NHEAL_LEVELS = [
  { mpCost: 10, multiplier: 2.00 }, { mpCost: 11, multiplier: 2.25 }, { mpCost: 13, multiplier: 2.50 },
  { mpCost: 14, multiplier: 2.75 }, { mpCost: 15, multiplier: 3.00 }, { mpCost: 16, multiplier: 3.25 },
  { mpCost: 17, multiplier: 3.50 },
];
const SC_THORN_LEVELS = [
  { mpCost: 12, multiplier: 1.00, targets: 2, accReduction: 20, turns: 2 }, { mpCost: 13, multiplier: 1.07, targets: 2, accReduction: 24, turns: 2 },
  { mpCost: 14, multiplier: 1.15, targets: 3, accReduction: 27, turns: 2 }, { mpCost: 15, multiplier: 1.22, targets: 3, accReduction: 31, turns: 2 },
  { mpCost: 16, multiplier: 1.30, targets: 3, accReduction: 35, turns: 2 }, { mpCost: 17, multiplier: 1.37, targets: 3, accReduction: 38, turns: 2 },
  { mpCost: 18, multiplier: 1.45, targets: 4, accReduction: 40, turns: 2 },
];
const SC_DRAIN_LEVELS = [
  { mpCost: 16, multiplier: 2.00, targets: 3, healPercent: 10 }, { mpCost: 17, multiplier: 2.15, targets: 3, healPercent: 12 },
  { mpCost: 19, multiplier: 2.30, targets: 3, healPercent: 15 }, { mpCost: 20, multiplier: 2.45, targets: 3, healPercent: 17 },
  { mpCost: 22, multiplier: 2.60, targets: 4, healPercent: 20 }, { mpCost: 23, multiplier: 2.75, targets: 4, healPercent: 22 },
  { mpCost: 24, multiplier: 2.90, targets: 4, healPercent: 25 },
];

// ========================================================
//  ТЕРНОВЫЙ СТРАЖ (эльф-воин, танк): растягивает урон во времени
// ========================================================
SUBCLASSES.elf_thornguard.mods = {
  powerStrike: {
    name: 'Подсечка', slowTurns: 2, slowPct: 30,
    levels: SC_WAR_PS_LEVELS,
    getDesc: (lvl, skill = SKILLS.powerStrike) => { const s = skill, d = s.levels[lvl-1]; return `Подсечка на ${scX(d.multiplier)}: цель опутана на 2 хода — её шкала хода растёт на ${scV('30%')} медленнее. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.powerStrike, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  natureHeal: {
    name: 'Кора', barkTurns: 3,
    levels: scMap(SC_NHEAL_LEVELS, (x, i) => ({ bark: [10, 11, 12, 14, 15, 17, 20][i] })),
    getDesc: (lvl, skill = SKILLS.natureHeal) => { const s = skill, d = s.levels[lvl-1]; return `Лечение на ${scX(d.multiplier)} от маг. атаки, и 3 хода кора: входящий урон ${scV('−' + d.bark + '%')}. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.natureHeal, lvl, n => `×${n.multiplier.toFixed(2)}, кора −${n.bark}%`),
  },
  thornWhirl: {
    name: 'Терновый вызов', slowPct: 30, extraTargets: 1,
    levels: SC_THORN_LEVELS,
    getDesc: (lvl, skill = SKILLS.thornWhirl) => { const s = skill, d = s.levels[lvl-1]; return `Бьёт ${scV(d.targets + 1)} врагов на ${scX(d.multiplier)} и опутывает на ${d.turns} хода: шкала хода опутанных растёт на ${scV('30%')} медленнее, и они бьют только вас. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.thornWhirl, lvl, n => `${n.targets + 1} цели, ×${n.multiplier.toFixed(2)}`),
  },
};

// ========================================================
//  СЛЕДОПЫТ (эльф-воин, урон): верные попадания и семена терна
// ========================================================
const SEED_MAX = 5;
SUBCLASSES.elf_pathfinder.mods = {
  powerStrike: {
    name: 'Прицельный выстрел', seeds: 2,
    levels: scMap(SC_WAR_PS_LEVELS, (x, i) => ({ pierce: [20, 23, 27, 30, 33, 37, 40][i] })),
    getDesc: (lvl, skill = SKILLS.powerStrike) => { const s = skill, d = s.levels[lvl-1]; return `Выстрел на ${scX(d.multiplier)}: <b>не промахивается</b>, пробивает ${scV(d.pierce + '%')} защиты и сажает ${scV('2')} семени терна. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.powerStrike, lvl, n => `×${n.multiplier.toFixed(2)}, пробой ${n.pierce}%`),
  },
  natureHeal: {
    name: 'Цветение', isHeal: false, bloomMult: 1.5, lifePct: 30,
    levels: SC_NHEAL_LEVELS.map(x => ({ mpCost: x.mpCost })),
    getDesc: (lvl, skill = SKILLS.natureHeal) => { const s = skill, d = s.levels[lvl-1]; return `Все семена на цели распускаются сразу и на ${scX(1.5)}; ${scV('30%')} урона лечит вас. Нужно хоть одно семя. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.natureHeal, lvl, n => `MP ${n.mpCost}`),
    useCheck: () => (pathfinderSeeds(getCurrentMonster()).length ? '' : 'на цели нет семян'),
  },
  thornWhirl: {
    name: 'Терновый залп', fixedTargets: 3,
    levels: SC_THORN_LEVELS,
    getDesc: (lvl, skill = SKILLS.thornWhirl) => { const s = skill, d = s.levels[lvl-1]; return `Залп по ${scV('3')} врагам на ${scX(d.multiplier)}: каждому семя терна, опутывание (точность −${scV(d.accReduction + '%')}). MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.thornWhirl, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
};

// ========================================================
//  ПЕВЕЦ КЛИНКА (эльф-воин, гибрид): Песнь 0–5
//  Чередование удара оружием и навыка +1 Песнь; два одинаковых подряд −2.
// ========================================================
const SONG_MAX = 5;
const SONG_DMG = 10;   // % урона за уровень Песни (было 5)
const SONG_EVA = 3;   // уворот за уровень
SUBCLASSES.elf_bladesinger.mods = {
  powerStrike: {
    name: 'Поющий клинок', magPart: 0.5,
    levels: SC_WAR_PS_LEVELS,
    getDesc: (lvl, skill = SKILLS.powerStrike) => { const s = skill, d = s.levels[lvl-1]; return `(атака + маг. атака ×0.5) × ${scX(d.multiplier)}, Жизнь. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.powerStrike, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  natureHeal: {
    name: 'Дыхание природы', edgeHits: 2, edgePct: 40,
    levels: SC_NHEAL_LEVELS,
    getDesc: (lvl, skill = SKILLS.natureHeal) => { const s = skill, d = s.levels[lvl-1]; return `Лечение на ${scX(d.multiplier)} от маг. атаки, и 2 следующих удара оружием добавляют ${scV('40%')} маг. атаки Жизнью. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.natureHeal, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  thornWhirl: {
    name: 'Вихрь лепестков',
    levels: scMap(SC_THORN_LEVELS, (x, i) => ({ heal: [2, 2.3, 2.7, 3, 3.3, 3.7, 4][i] })),
    getDesc: (lvl, skill = SKILLS.thornWhirl) => { const s = skill, d = s.levels[lvl-1]; return `Бьёт ${scV(d.targets)} врагов на ${scX(d.multiplier)}, опутывает (точность −${scV(d.accReduction + '%')}), за каждого задетого лечит ${scV(d.heal + '%')} макс. HP. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.thornWhirl, lvl, n => `${n.targets} цели, лечение ${n.heal}%`),
  },
};

// ========================================================
//  ЗВЕЗДОЧЁТ (эльф-маг, разрушитель): снайпер против одной цели
// ========================================================
SUBCLASSES.elf_stargazer.mods = {
  fireball: {
    name: 'Падающая звезда', delay: 2,
    levels: scMap(SC_FIREBALL_LEVELS, (x, i) => ({ starMult: [3.5, 3.75, 4.0, 4.25, 4.5, 4.75, 5.0][i] })),
    getDesc: (lvl, skill = SKILLS.fireball) => { const s = skill, d = s.levels[lvl-1]; return `Звезда падает на цель <b>через 2 хода</b> и бьёт на ${scX(d.starMult)}. Цель погибла раньше — звезда упадёт на соседа. MP: ${scV(d.mpCost)}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.fireball, lvl, n => `×${n.starMult.toFixed(2)}`),
  },
  heal: {
    name: 'Исцеление',
    levels: SC_NHEAL_LEVELS,
    getDesc: (lvl, skill = SKILLS.heal) => { const s = skill, d = s.levels[lvl-1]; return `Исцеление на ${scX(d.multiplier)} от маг. атаки. При здоровье от 70% — <b>ранит любую тварь</b> с той же силой. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.heal, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  lifeDrain: {
    name: 'Звездопад',
    levels: SC_DRAIN_LEVELS,
    getDesc: (lvl, skill = SKILLS.lifeDrain) => { const s = skill, d = s.levels[lvl-1]; return `Звёзды падают на ${scV(d.targets)} врагов, каждому ${scX(d.multiplier * 0.7)} — без ослабления по цепочке. ${scV(Math.round(d.healPercent / 2) + '%')} урона лечат. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.lifeDrain, lvl, n => `${n.targets} цели, ×${(n.multiplier * 0.7).toFixed(2)}`),
  },
};

// ========================================================
//  ХРАНИТЕЛЬ РОЩИ (эльф-маг, опора): лечение во времени
// ========================================================
SUBCLASSES.elf_grovekeeper.mods = {
  fireball: {
    name: 'Колючая лоза', hotPct: 15, hotTurns: 3, dmgMult: 1.2,
    levels: SC_FIREBALL_LEVELS,
    getDesc: (lvl, skill = SKILLS.fireball) => { const s = skill, d = s.levels[lvl-1]; return `Лоза Жизни на ${scX(d.multiplier * 1.2)}; ${scV('15%')} урона возвращается вам лечением за 3 хода. MP: ${scV(d.mpCost)}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.fireball, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  heal: {
    name: 'Росток', hotTurns: 4, hotBonus: 1.5,
    levels: SC_NHEAL_LEVELS,
    getDesc: (lvl, skill = SKILLS.heal) => { const s = skill, d = s.levels[lvl-1]; return `Росток лечит за 4 хода на ${scX(d.multiplier * 1.5)} от маг. атаки (в полтора раза больше обычного Исцеления, но не сразу). MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.heal, lvl, n => `×${(n.multiplier * 1.5).toFixed(2)} за 4 хода`),
  },
  lifeDrain: {
    name: 'Дыхание рощи', hotBonus: 1.5, hotTurns: 3,
    levels: SC_DRAIN_LEVELS,
    getDesc: (lvl, skill = SKILLS.lifeDrain) => { const s = skill, d = s.levels[lvl-1]; return `Цепь Жизни по ${scV(d.targets)} врагам: ${scX(d.multiplier)} первому, дальше слабее. Вместо мгновенного лечения — ${scV(Math.round(d.healPercent * 1.5) + '%')} урона лечением за 3 хода. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.lifeDrain, lvl, n => `${n.targets} цели, ×${n.multiplier.toFixed(2)}`),
  },
};

// ========================================================
//  ДРУИД (эльф-маг, союзники): один дух-зверь на всю охоту
// ========================================================
const DRUID_KINDS = {
  lynx: { name: 'Рысь',   img: 'img/allies/druid_lynx.webp',  hp: 0.30, atk: 0.60, desc: 'бьёт сильнее всех' },
  stag: { name: 'Олень',  img: 'img/allies/druid_stag.webp',  hp: 0.50, atk: 0.30, healHp: 2, desc: 'лечит вас каждый ход' },
  owl:  { name: 'Филин',  img: 'img/allies/druid_owl.webp',   hp: 0.30, atk: 0.40, healMp: 2, atbCut: 10, desc: 'сбивает шкалу хода и даёт ману' },
};
SUBCLASSES.elf_druid.mods = {
  fireball: {
    name: 'Зов когтей', spiritPct: 50,
    levels: SC_FIREBALL_LEVELS,
    getDesc: (lvl, skill = SKILLS.fireball) => { const s = skill, d = s.levels[lvl-1]; return `Огонь на ${scX(d.multiplier)}, поджог по ${scV(d.burnPercent + '%')} маг. атаки — и дух-зверь сразу бьёт ту же цель на ${scV('50%')} своей силы. MP: ${scV(d.mpCost)}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.fireball, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  heal: {
    name: 'Исцеление',
    levels: SC_NHEAL_LEVELS,
    getDesc: (lvl, skill = SKILLS.heal) => { const s = skill, d = s.levels[lvl-1]; return `Исцеление на ${scX(d.multiplier)} от маг. атаки — лечит и вас, и духа-зверя на ту же силу. При здоровье от 70% ранит мёртвых. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.heal, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  lifeDrain: {
    name: 'Похищение жизни',
    levels: SC_DRAIN_LEVELS,
    getDesc: (lvl, skill = SKILLS.lifeDrain) => { const s = skill, d = s.levels[lvl-1]; return `Цепь Жизни по ${scV(d.targets)} врагам: ${scX(d.multiplier)} первому, дальше слабее. ${scV(d.healPercent + '%')} урона лечат вас, столько же — духа. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.lifeDrain, lvl, n => `${n.targets} цели, ×${n.multiplier.toFixed(2)}`),
  },
};

Object.assign(SUBCLASS_SKILLS, {
  // ---- Терновый страж ----
  tgRoot: {
    id: 'tgRoot', subclassId: 'elf_thornguard', name: 'Укоренение', type: 'active', freeTurn: true,
    iconPng: 'img/skills/subclass/tgRoot.webp',
    maxLevel: 5, cooldown: 8, turns: 5,
    levels: [ { mpCost: 0, share: 40 }, { mpCost: 0, share: 45 }, { mpCost: 0, share: 50 }, { mpCost: 0, share: 55 }, { mpCost: 0, share: 60 } ],
    getDesc: (lvl) => { const s = SKILLS.tgRoot, d = s.levels[lvl-1]; return `Не тратит ход: ${s.turns} ходов ${scV(d.share + '%')} каждого удара уходит в корни (приходит за 3 хода), и половина ушедшего рассасывается. Без затрат. Автобой — против стаи или сильной твари. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.tgRoot, lvl, n => `${n.share}% в корни`),
  },
  tgBarbs: {
    id: 'tgBarbs', subclassId: 'elf_thornguard', name: 'Шипастая кора', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/tgBarbs.webp',
    maxLevel: 5,
    levels: [ { mpCost: 0, pct: 20, cut: 8 }, { mpCost: 0, pct: 24, cut: 10 }, { mpCost: 0, pct: 27, cut: 12 }, { mpCost: 0, pct: 31, cut: 13 }, { mpCost: 0, pct: 35, cut: 15 } ],
    getDesc: (lvl) => { const d = SKILLS.tgBarbs.levels[lvl-1]; return `<b>Работает сама</b>, пока стоит в слоте: входящий урон ${scV('−' + d.cut + '%')}, а тварь, попавшая по вам — ${scV(d.pct + '%')} урона возвращается ей шипами, за крит — вдвое. Ничего не стоит — цена в занятом слоте.`; },
    getNextDesc: (lvl) => scNext(SKILLS.tgBarbs, lvl, n => `${n.pct}%`),
  },
  tgRoots: {
    id: 'tgRoots', subclassId: 'elf_thornguard', name: 'Корни принимают удар', type: 'passive',
    iconPng: 'img/skills/subclass/tgRoots.webp',
    maxLevel: 5,
    levels: [ { share: 20 }, { share: 24 }, { share: 27 }, { share: 31 }, { share: 35 } ],
    getDesc: (lvl) => { const d = SKILLS.tgRoots.levels[lvl-1]; return `Пассивно, в бою: ${scV(d.share + '%')} каждого удара приходит не сразу, а за 3 хода, и половина отложенного рассасывается. Любое лечение сначала гасит отложенный урон.`; },
    getNextDesc: (lvl) => scNext(SKILLS.tgRoots, lvl, n => `${n.share}%`),
  },
  tgSap: {
    id: 'tgSap', subclassId: 'elf_thornguard', name: 'Сок древа', type: 'passive',
    iconPng: 'img/skills/subclass/tgSap.webp',
    maxLevel: 5,
    levels: [ { pct: 10 }, { pct: 12 }, { pct: 15 }, { pct: 17 }, { pct: 20 } ],
    getDesc: (lvl) => { const d = SKILLS.tgSap.levels[lvl-1]; return `Пассивно, в бою: любое лечение, включая реген, сильнее на ${scV(d.pct + '%')}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.tgSap, lvl, n => `+${n.pct}%`),
  },

  // ---- Следопыт ----
  pfSeed: {
    id: 'pfSeed', subclassId: 'elf_pathfinder', name: 'Семя терна', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/pfSeed.webp',
    maxLevel: 5, chance: 30, turns: 3,
    levels: [ { mpCost: 0, power: 30 }, { mpCost: 0, power: 35 }, { mpCost: 0, power: 40 }, { mpCost: 0, power: 45 }, { mpCost: 0, power: 50 } ],
    getDesc: (lvl) => { const s = SKILLS.pfSeed, d = s.levels[lvl-1]; return `<b>Срабатывает само</b>, пока стоит в слоте: любой ваш удар с шансом ${s.chance}% сажает в цель семя терна (до ${SEED_MAX}). Через ${s.turns} хода семя распускается — ${scV(d.power + '%')} атаки, защита не режет. Ничего не стоит — цена в занятом слоте.`; },
    getNextDesc: (lvl) => scNext(SKILLS.pfSeed, lvl, n => `${n.power}% атаки`),
  },
  pfLeaves: {
    id: 'pfLeaves', subclassId: 'elf_pathfinder', name: 'Шквал листьев', type: 'active',
    iconPng: 'img/skills/subclass/pfLeaves.webp',
    maxLevel: 5, cooldown: 4,
    levels: [ { mpCost: 8, multiplier: 0.60 }, { mpCost: 8, multiplier: 0.65 }, { mpCost: 9, multiplier: 0.70 }, { mpCost: 9, multiplier: 0.75 }, { mpCost: 10, multiplier: 0.80 } ],
    getDesc: (lvl) => { const d = SKILLS.pfLeaves.levels[lvl-1]; return `Листья режут всех врагов на ${scX(d.multiplier)}, каждому — семя терна. MP: ${scV(d.mpCost)}. КД: ${SKILLS.pfLeaves.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.pfLeaves, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  pfHawk: {
    id: 'pfHawk', subclassId: 'elf_pathfinder', name: 'Глаз ястреба', type: 'passive',
    iconPng: 'img/skills/subclass/pfHawk.webp',
    maxLevel: 5,
    levels: [ { acc: 5, ignore: 10 }, { acc: 6, ignore: 12 }, { acc: 7, ignore: 15 }, { acc: 8, ignore: 17 }, { acc: 10, ignore: 20 } ],
    getDesc: (lvl) => { const d = SKILLS.pfHawk.levels[lvl-1]; return `Пассивно: точность ${scV('+' + d.acc)}, удары навыков пробивают ${scV(d.ignore + '%')} защиты твари.`; },
    getNextDesc: (lvl) => scNext(SKILLS.pfHawk, lvl, n => `+${n.acc} точности, пробой ${n.ignore}%`),
  },
  pfGrowth: {
    id: 'pfGrowth', subclassId: 'elf_pathfinder', name: 'Буйный рост', type: 'passive',
    iconPng: 'img/skills/subclass/pfGrowth.webp',
    maxLevel: 5,
    levels: [ { pct: 10 }, { pct: 12 }, { pct: 15 }, { pct: 17 }, { pct: 20 } ],
    getDesc: (lvl) => { const d = SKILLS.pfGrowth.levels[lvl-1]; return `Пассивно: семена бьют на ${scV(d.pct + '%')} сильнее и распускаются на ход раньше.`; },
    getNextDesc: (lvl) => scNext(SKILLS.pfGrowth, lvl, n => `+${n.pct}%`),
  },

  // ---- Певец клинка ----
  bsWind: {
    id: 'bsWind', subclassId: 'elf_bladesinger', name: 'Песнь ветра', type: 'active', freeTurn: true,
    iconPng: 'img/skills/subclass/bsWind.webp',
    maxLevel: 5, cooldown: 8, turns: 5,
    levels: [ { mpCost: 6, atb: 20 }, { mpCost: 6, atb: 22 }, { mpCost: 7, atb: 25 }, { mpCost: 7, atb: 27 }, { mpCost: 8, atb: 30 } ],
    getDesc: (lvl) => { const s = SKILLS.bsWind, d = s.levels[lvl-1]; return `Не тратит ход: ${s.turns} ходов шкала хода ${scV('+' + d.atb + '%')}, и Песнь не падает (одинаковые действия подряд её не сбивают). Считается навыком для Песни. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.bsWind, lvl, n => `+${n.atb}% ATB`),
  },
  bsSprout: {
    id: 'bsSprout', subclassId: 'elf_bladesinger', name: 'Росток жизни', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/bsSprout.webp',
    maxLevel: 5,
    levels: [ { mpCost: 0, pct: 60 }, { mpCost: 0, pct: 70 }, { mpCost: 0, pct: 80 }, { mpCost: 0, pct: 90 }, { mpCost: 0, pct: 100 } ],
    getDesc: (lvl) => { const d = SKILLS.bsSprout.levels[lvl-1]; return `<b>Срабатывает сам</b>, пока стоит в слоте: лечение сверх полного HP бьёт цель Жизнью — ${scV(d.pct + '%')} излишка. Ничего не стоит — цена в занятом слоте.`; },
    getNextDesc: (lvl) => scNext(SKILLS.bsSprout, lvl, n => `${n.pct}%`),
  },
  bsHarmony: {
    id: 'bsHarmony', subclassId: 'elf_bladesinger', name: 'Гармония', type: 'passive',
    iconPng: 'img/skills/subclass/bsHarmony.webp',
    maxLevel: 5,
    levels: [ { pct: 10 }, { pct: 12 }, { pct: 15 }, { pct: 17 }, { pct: 20 } ],
    getDesc: (lvl) => { const d = SKILLS.bsHarmony.levels[lvl-1]; return `Пассивно: ${scV(d.pct + '%')} физ. атаки прибавляется к маг. атаке и ${scV(d.pct + '%')} маг. атаки — к физической.`; },
    getNextDesc: (lvl) => scNext(SKILLS.bsHarmony, lvl, n => `${n.pct}%`),
  },
  bsLiving: {
    id: 'bsLiving', subclassId: 'elf_bladesinger', name: 'Живой клинок', type: 'passive',
    iconPng: 'img/skills/subclass/bsLiving.webp',
    maxLevel: 5,
    levels: [ { pct: 6 }, { pct: 7 }, { pct: 8 }, { pct: 9 }, { pct: 10 } ],
    getDesc: (lvl) => { const d = SKILLS.bsLiving.levels[lvl-1]; return `Пассивно: ваш урон Жизнью лечит вас на ${scV(d.pct + '%')} от нанесённого.`; },
    getNextDesc: (lvl) => scNext(SKILLS.bsLiving, lvl, n => `${n.pct}%`),
  },

  // ---- Звездочёт ----
  sgReflect: {
    id: 'sgReflect', subclassId: 'elf_stargazer', name: 'Отражённый свет', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/sgReflect.webp',
    maxLevel: 5,
    levels: [ { mpCost: 0, pct: 60 }, { mpCost: 0, pct: 70 }, { mpCost: 0, pct: 80 }, { mpCost: 0, pct: 90 }, { mpCost: 0, pct: 100 } ],
    getDesc: (lvl) => { const d = SKILLS.sgReflect.levels[lvl-1]; return `<b>Срабатывает сам</b>, пока стоит в слоте: урон сверх нужного для убийства уходит в следующую тварь — ${scV(d.pct + '%')} излишка, в начале вашего хода. Ничего не стоит — цена в занятом слоте.`; },
    getNextDesc: (lvl) => scNext(SKILLS.sgReflect, lvl, n => `${n.pct}%`),
  },
  sgStarfall: {
    id: 'sgStarfall', subclassId: 'elf_stargazer', name: 'Звёздный луч', type: 'active',
    iconPng: 'img/skills/subclass/sgStarfall.webp',
    maxLevel: 5, cooldown: 4,
    levels: [ { mpCost: 14, multiplier: 2.2 }, { mpCost: 15, multiplier: 2.4 }, { mpCost: 16, multiplier: 2.6 }, { mpCost: 17, multiplier: 2.8 }, { mpCost: 18, multiplier: 3.0 } ],
    getDesc: (lvl) => { const d = SKILLS.sgStarfall.levels[lvl-1]; return `Луч в одну цель на ${scX(d.multiplier)}; если на цель уже летит звезда — она падает прямо сейчас. MP: ${scV(d.mpCost)}. КД: ${SKILLS.sgStarfall.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.sgStarfall, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  sgFocus: {
    id: 'sgFocus', subclassId: 'elf_stargazer', name: 'Сосредоточение', type: 'passive',
    iconPng: 'img/skills/subclass/sgFocus.webp',
    maxLevel: 5,
    levels: [ { pct: 6 }, { pct: 7 }, { pct: 8 }, { pct: 9 }, { pct: 10 } ],
    getDesc: (lvl) => { const d = SKILLS.sgFocus.levels[lvl-1]; return `Пассивно: каждое заклинание подряд в ту же цель — ${scV('+' + d.pct + '%')} урона по ней (до 5 раз). Сменили цель — счёт заново.`; },
    getNextDesc: (lvl) => scNext(SKILLS.sgFocus, lvl, n => `+${n.pct}% за раз`),
  },
  sgClear: {
    id: 'sgClear', subclassId: 'elf_stargazer', name: 'Ясный взор', type: 'passive',
    iconPng: 'img/skills/subclass/sgClear.webp',
    maxLevel: 5,
    levels: [ { pct: 10 }, { pct: 14 }, { pct: 18 }, { pct: 21 }, { pct: 25 } ],
    getDesc: (lvl) => { const d = SKILLS.sgClear.levels[lvl-1]; return `Пассивно: ваши заклинания на ${scV(d.pct + '%')} сильнее против маг. защиты (урон по твари с маг. защитой), щит маны тварей берёт на ${scV(d.pct + '%')} меньше.`; },
    getNextDesc: (lvl) => scNext(SKILLS.sgClear, lvl, n => `${n.pct}%`),
  },

  // ---- Хранитель Рощи ----
  gkGift: {
    id: 'gkGift', subclassId: 'elf_grovekeeper', name: 'Дар рощи', type: 'active', freeTurn: true,
    iconPng: 'img/skills/subclass/gkGift.webp',
    maxLevel: 5, cooldown: 3,
    levels: [ { mpCost: 14, regen: 1.5, heal: 10, dmg: 6 }, { mpCost: 15, regen: 1.8, heal: 12, dmg: 7 }, { mpCost: 16, regen: 2.2, heal: 15, dmg: 9 }, { mpCost: 17, regen: 2.6, heal: 17, dmg: 10 }, { mpCost: 18, regen: 3, heal: 20, dmg: 12 } ],
    getDesc: (lvl) => { const d = SKILLS.gkGift.levels[lvl-1]; return `Не тратит ход: до конца боя ${scV(d.regen + '%')} макс. HP лечения в начале каждого хода, всё ваше лечение ${scV('+' + d.heal + '%')} и урон ${scV('+' + d.dmg + '%')}. Автобой — в начале боя. MP: ${scV(d.mpCost)}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.gkGift, lvl, n => `${n.regen}% HP за ход, лечение +${n.heal}%`),
  },
  gkBud: {
    id: 'gkBud', subclassId: 'elf_grovekeeper', name: 'Бутон', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/gkBud.webp',
    maxLevel: 5, threshold: 40, every: 5, turns: 3,
    levels: [ { mpCost: 0, total: 30 }, { mpCost: 0, total: 35 }, { mpCost: 0, total: 40 }, { mpCost: 0, total: 45 }, { mpCost: 0, total: 50 } ],
    getDesc: (lvl) => { const s = SKILLS.gkBud, d = s.levels[lvl-1]; return `<b>Распускается сам</b>, пока стоит в слоте: HP упало ниже ${s.threshold}% — лечит ${scV(d.total + '%')} макс. HP за 3 хода. Не чаще раза в ${s.every} ходов.`; },
    getNextDesc: (lvl) => scNext(SKILLS.gkBud, lvl, n => `${n.total}% HP`),
  },
  gkDew: {
    id: 'gkDew', subclassId: 'elf_grovekeeper', name: 'Живительная роса', type: 'passive',
    iconPng: 'img/skills/subclass/gkDew.webp',
    maxLevel: 5,
    levels: [ { chance: 20 }, { chance: 25 }, { chance: 30 }, { chance: 35 }, { chance: 40 } ],
    getDesc: (lvl) => { const d = SKILLS.gkDew.levels[lvl-1]; return `Пассивно: каждый тик лечения во времени с шансом ${scV(d.chance + '%')} продлевает его на ход.`; },
    getNextDesc: (lvl) => scNext(SKILLS.gkDew, lvl, n => `${n.chance}%`),
  },
  gkCycle: {
    id: 'gkCycle', subclassId: 'elf_grovekeeper', name: 'Круговорот жизни', type: 'passive',
    iconPng: 'img/skills/subclass/gkCycle.webp',
    maxLevel: 5,
    levels: [ { pct: 10 }, { pct: 12 }, { pct: 15 }, { pct: 17 }, { pct: 20 } ],
    getDesc: (lvl) => { const d = SKILLS.gkCycle.levels[lvl-1]; return `Пассивно, в бою: любое лечение возвращает ману — ${scV(d.pct + '%')} от вылеченного.`; },
    getNextDesc: (lvl) => scNext(SKILLS.gkCycle, lvl, n => `${n.pct}%`),
  },

  // ---- Друид ----
  drSpirit: {
    id: 'drSpirit', subclassId: 'elf_druid', name: 'Дух-зверь', type: 'active',
    fxAnim: 'summon',
    iconPng: 'img/allies/druid_lynx.webp',
    maxLevel: 5, cooldown: 3,
    levels: [ { mpCost: 14, power: 60, rage: 1.6 }, { mpCost: 15, power: 70, rage: 1.75 }, { mpCost: 16, power: 80, rage: 1.9 }, { mpCost: 17, power: 90, rage: 2.05 }, { mpCost: 18, power: 100, rage: 2.2 } ],
    getDesc: (lvl) => { const d = SKILLS.drSpirit.levels[lvl-1]; return `Нет духа — зовёт одного случайного (сила ${scV(d.power + '%')}): <b>Рысь</b> бьёт сильнее всех, <b>Олень</b> лечит вас, <b>Филин</b> сбивает шкалу хода и даёт ману. Дух живёт всю охоту и копит силу за убийства. Дух есть — <b>Ярость духа</b>: удар на ${scX(d.rage)} его силы. MP: ${scV(d.mpCost)}. КД: ${SKILLS.drSpirit.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.drSpirit, lvl, n => `сила ${n.power}%, ярость ×${n.rage.toFixed(1)}`),
  },
  drHunt: {
    id: 'drHunt', subclassId: 'elf_druid', name: 'Общая охота', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/drHunt.webp',
    maxLevel: 5,
    levels: [ { mpCost: 0, mult: 0.8 }, { mpCost: 0, mult: 0.9 }, { mpCost: 0, mult: 1.0 }, { mpCost: 0, mult: 1.1 }, { mpCost: 0, mult: 1.2 } ],
    getDesc: (lvl) => { const d = SKILLS.drHunt.levels[lvl-1]; return `<b>Срабатывает сама</b>, пока стоит в слоте: заклинание с шансом крита героя — дух бьёт ту же цель бесплатно на ${scX(d.mult)} своей силы. Ничего не стоит — цена в занятом слоте.`; },
    getNextDesc: (lvl) => scNext(SKILLS.drHunt, lvl, n => `×${n.mult.toFixed(1)}`),
  },
  drBonds: {
    id: 'drBonds', subclassId: 'elf_druid', name: 'Узы рощи', type: 'passive',
    iconPng: 'img/skills/subclass/drBonds.webp',
    maxLevel: 5,
    levels: [ { atk: 6, hp: 5 }, { atk: 8, hp: 7 }, { atk: 10, hp: 10 }, { atk: 12, hp: 12 }, { atk: 15, hp: 15 } ],
    getDesc: (lvl) => { const d = SKILLS.drBonds.levels[lvl-1]; return `Пассивно: дух получает ${scV(d.atk + '%')} вашей маг. атаки к удару и ${scV(d.hp + '%')} вашего макс. HP.`; },
    getNextDesc: (lvl) => scNext(SKILLS.drBonds, lvl, n => `${n.atk}% маг. атаки, ${n.hp}% HP`),
  },
  drGrowing: {
    id: 'drGrowing', subclassId: 'elf_druid', name: 'Растущая связь', type: 'passive',
    iconPng: 'img/skills/subclass/drGrowing.webp',
    maxLevel: 5,
    levels: [ { per: 1, cap: 20 }, { per: 1.2, cap: 22 }, { per: 1.5, cap: 25 }, { per: 1.7, cap: 27 }, { per: 2, cap: 30 } ],
    getDesc: (lvl) => { const d = SKILLS.drGrowing.levels[lvl-1]; return `Пассивно: каждое убийство на охоте делает духа сильнее на ${scV(d.per + '%')} (до ${scV('+' + d.cap + '%')}). Дух пал — рост с нуля.`; },
    getNextDesc: (lvl) => scNext(SKILLS.drGrowing, lvl, n => `+${n.per}% за убийство, до +${n.cap}%`),
  },
});

// ========================================================
//  ДРОУ: уровни 1–7 старых навыков
// ========================================================
const SC_DISCHARGE_LEVELS = [
  { mpCost: 12, multiplier: 1.80, atbReduction: 20 }, { mpCost: 13, multiplier: 2.00, atbReduction: 25 },
  { mpCost: 15, multiplier: 2.20, atbReduction: 30 }, { mpCost: 16, multiplier: 2.40, atbReduction: 35 },
  { mpCost: 18, multiplier: 2.60, atbReduction: 40 }, { mpCost: 19, multiplier: 2.80, atbReduction: 42 },
  { mpCost: 20, multiplier: 3.00, atbReduction: 45 },
];
const SC_SPARK_LEVELS = [
  { mpCost: 10, multiplier: 0.80, targets: 2, atbCut: 10 }, { mpCost: 11, multiplier: 0.85, targets: 2, atbCut: 10 },
  { mpCost: 12, multiplier: 0.90, targets: 2, atbCut: 10 }, { mpCost: 13, multiplier: 0.95, targets: 2, atbCut: 10 },
  { mpCost: 14, multiplier: 1.00, targets: 2, atbCut: 10 }, { mpCost: 15, multiplier: 1.05, targets: 2, atbCut: 12 },
  { mpCost: 16, multiplier: 1.10, targets: 2, atbCut: 15 },
];
const SC_CHAIN_LEVELS = [
  { mpCost: 14, multiplier: 1.60, targets: 2 }, { mpCost: 15, multiplier: 1.70, targets: 2 },
  { mpCost: 17, multiplier: 1.80, targets: 3 }, { mpCost: 18, multiplier: 1.90, targets: 3 },
  { mpCost: 20, multiplier: 2.00, targets: 3 }, { mpCost: 21, multiplier: 2.10, targets: 3 },
  { mpCost: 22, multiplier: 2.20, targets: 4 },
];
const SC_DISCHARGE_DESC = (s, d, extra) => `Разряд на ${scX(d.multiplier)}, шкала хода твари ${scV('−' + d.atbReduction + '%')}. ${extra} MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`;

// ========================================================
//  ГРОЗОВОЙ СТРАЖ (дроу-воин, танк-контроль): тварь не успевает ходить
// ========================================================
const STATIC_MAX = 3;
SUBCLASSES.drow_stormguard.mods = {
  powerStrike: {
    name: 'Громовой удар', atbCut: 30,
    levels: SC_WAR_PS_LEVELS,
    getDesc: (lvl, skill = SKILLS.powerStrike) => { const s = skill, d = s.levels[lvl-1]; return `Громовой удар на ${scX(d.multiplier)}, шкала хода цели ${scV('−30%')}. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.powerStrike, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  discharge: {
    name: 'Разряд',
    levels: SC_DISCHARGE_LEVELS,
    getDesc: (lvl, skill = SKILLS.discharge) => SC_DISCHARGE_DESC(skill, skill.levels[lvl-1], 'По цели со Статикой <b>паралич гарантирован</b> (невосприимчивость после паралича остаётся).'),
    getNextDesc: (lvl) => scNext(SKILLS.discharge, lvl, n => `×${n.multiplier.toFixed(2)}, ATB −${n.atbReduction}%`),
  },
  sparkSlash: {
    name: 'Искровой вызов', fixedTargets: 3,
    levels: SC_SPARK_LEVELS,
    getDesc: (lvl, skill = SKILLS.sparkSlash) => { const s = skill, d = s.levels[lvl-1]; return `Разрез по ${scV('3')} врагам на ${scX(d.multiplier)}, шкала стаи ${scV('−' + d.atbCut + '%')}. Каждому — заряд Статики, и задетые бьют только вас. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.sparkSlash, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
};

// ========================================================
//  АССАСИН (дроу-воин, урон): внеочередные ходы
// ========================================================
SUBCLASSES.drow_assassin.mods = {
  powerStrike: {
    name: 'Удар в спину', backMult: 1.5, backAtb: 50,
    levels: SC_WAR_PS_LEVELS,
    getDesc: (lvl, skill = SKILLS.powerStrike) => { const s = skill, d = s.levels[lvl-1]; return `Удар на ${scX(d.multiplier)}; если цель не готова к удару (её шкала хода ниже половины) — ещё ${scX(1.5)}. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.powerStrike, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  discharge: {
    name: 'Искра в клинке', selfAtb: 30,
    levels: scMap(SC_DISCHARGE_LEVELS, x => ({ mpCost: Math.ceil(x.mpCost * 0.6) })),
    getDesc: (lvl, skill = SKILLS.discharge) => SC_DISCHARGE_DESC(skill, skill.levels[lvl-1], `Дешевле обычного, и после — ваша шкала хода ${scV('+30%')}.`),
    getNextDesc: (lvl) => scNext(SKILLS.discharge, lvl, n => `×${n.multiplier.toFixed(2)}, MP ${n.mpCost}`),
  },
  sparkSlash: {
    name: 'Искровой разрез', fixedTargets: 3,
    levels: SC_SPARK_LEVELS,
    getDesc: (lvl, skill = SKILLS.sparkSlash) => { const s = skill, d = s.levels[lvl-1]; return `Разрез по ${scV('3')} врагам на ${scX(d.multiplier)}, шкала стаи ${scV('−' + d.atbCut + '%')}. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.sparkSlash, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
};

// ========================================================
//  ТЕНЕВОЙ ТКАЧ (дроу-воин, гибрид): сталь и молния из тени
// ========================================================
SUBCLASSES.drow_shadowweaver.mods = {
  powerStrike: {
    name: 'Сумеречный удар', magPart: 0.5, atbCut: 20,
    levels: SC_WAR_PS_LEVELS,
    getDesc: (lvl, skill = SKILLS.powerStrike) => { const s = skill, d = s.levels[lvl-1]; return `(атака + маг. атака ×0.5) × ${scX(d.multiplier)}, молния, шкала хода цели ${scV('−20%')}. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.powerStrike, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  discharge: {
    name: 'Разряд',
    levels: SC_DISCHARGE_LEVELS,
    getDesc: (lvl, skill = SKILLS.discharge) => SC_DISCHARGE_DESC(skill, skill.levels[lvl-1], 'Паралич — Теневой двойник держится на 2 хода дольше, а если его нет — появляется на 2 хода.'),
    getNextDesc: (lvl) => scNext(SKILLS.discharge, lvl, n => `×${n.multiplier.toFixed(2)}, ATB −${n.atbReduction}%`),
  },
  sparkSlash: {
    name: 'Теневой разрез', extraTargets: 1,
    levels: SC_SPARK_LEVELS,
    getDesc: (lvl, skill = SKILLS.sparkSlash) => { const s = skill, d = s.levels[lvl-1]; return `Разрез по ${scV(d.targets + 1)} врагам на ${scX(d.multiplier)}, шкала стаи ${scV('−' + d.atbCut + '%')}; двойник режет вместе с вами. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.sparkSlash, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
};

// ========================================================
//  БУРЕВЕСТНИК (дроу-маг, разрушитель): Напряжение и перезарядки
// ========================================================
const LIGHTNING_SPELLS = ['discharge', 'chainLightning', 'fireball', 'scStormFront'];   // fireball у Буревестника — Шаровая молния
SUBCLASSES.drow_stormcaller.mods = {
  fireball: {
    name: 'Шаровая молния', splash: 50,
    levels: SC_FIREBALL_LEVELS,
    getDesc: (lvl, skill = SKILLS.fireball) => { const s = skill, d = s.levels[lvl-1]; return `Шаровая молния на ${scX(d.multiplier)}; отскакивает в соседа на ${scV('50%')}. Молния — копит Напряжение. MP: ${scV(d.mpCost)}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.fireball, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  discharge: {
    name: 'Разряд',
    levels: SC_DISCHARGE_LEVELS,
    getDesc: (lvl, skill = SKILLS.discharge) => SC_DISCHARGE_DESC(skill, skill.levels[lvl-1], 'Копит Напряжение.'),
    getNextDesc: (lvl) => scNext(SKILLS.discharge, lvl, n => `×${n.multiplier.toFixed(2)}, ATB −${n.atbReduction}%`),
  },
  chainLightning: {
    name: 'Цепная молния',
    levels: SC_CHAIN_LEVELS,
    getDesc: (lvl, skill = SKILLS.chainLightning) => { const s = skill, d = s.levels[lvl-1]; return `Молния прыгает по ${scV(d.targets)} врагам: ${scX(d.multiplier)} первому, каждый прыжок −30% (через парализованного — не слабеет). Копит Напряжение. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.chainLightning, lvl, n => `${n.targets} цели, ×${n.multiplier.toFixed(2)}`),
  },
};

// ========================================================
//  ТКАЧ СНОВ (дроу-маг, опора-контроль)
// ========================================================
SUBCLASSES.drow_dreamweaver.mods = {
  fireball: {
    name: 'Сон', sleepTurns: 3,
    levels: SC_FIREBALL_LEVELS,
    getDesc: (lvl, skill = SKILLS.fireball) => { const s = skill, d = s.levels[lvl-1]; return `Усыпляет тварь на 3 хода — до первого удара по ней. В стае выбирает <b>лишнюю</b>: не текущую цель. Усыплять некого — <b>Кошмар</b>: молния по текущей цели на ${scX(d.multiplier)}. MP: ${scV(d.mpCost)}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.fireball, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  discharge: {
    name: 'Живая искра', selfAtb: 30, dmgPart: 0.6,
    levels: SC_DISCHARGE_LEVELS,
    getDesc: (lvl, skill = SKILLS.discharge) => { const s = skill, d = s.levels[lvl-1]; return `Искра на ${scX(d.multiplier * 0.6)} и лечение на ${scX(d.multiplier)} от маг. атаки; ваша шкала хода ${scV('+30%')}. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.discharge, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  chainLightning: {
    name: 'Цепь сна', sleepTurns: 2,
    levels: SC_CHAIN_LEVELS,
    getDesc: (lvl, skill = SKILLS.chainLightning) => { const s = skill, d = s.levels[lvl-1]; return `Молния по ${scV(d.targets)} врагам (${scX(d.multiplier)} первому, дальше слабее); все задетые, кроме текущей цели, засыпают на 2 хода. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.chainLightning, lvl, n => `${n.targets} цели, ×${n.multiplier.toFixed(2)}`),
  },
};

// ========================================================
//  ПАУЧИЙ ВЛАДЫКА (дроу-маг, союзники): матка и паучата
// ========================================================
const SPIDER_KINDS = {
  mother: { name: 'Паучиха-матка', img: 'img/allies/spider_mother.webp', hp: 0.5, atk: 0.45 },
  spawn:  { name: 'Паучонок',      img: 'img/allies/spider_spawn.webp',  hp: 0.2, atk: 0.30 },
};
SUBCLASSES.drow_spiderlord.mods = {
  fireball: {
    name: 'Ядовитый плевок',
    levels: SC_FIREBALL_LEVELS,
    getDesc: (lvl, skill = SKILLS.fireball) => { const s = skill, d = s.levels[lvl-1]; return `Плевок ядом на ${scX(d.multiplier)} и 2 слоя яда. MP: ${scV(d.mpCost)}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.fireball, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  discharge: {
    name: 'Разряд',
    levels: SC_DISCHARGE_LEVELS,
    getDesc: (lvl, skill = SKILLS.discharge) => SC_DISCHARGE_DESC(skill, skill.levels[lvl-1], 'Паралич — все пауки бросаются на цель.'),
    getNextDesc: (lvl) => scNext(SKILLS.discharge, lvl, n => `×${n.multiplier.toFixed(2)}, ATB −${n.atbReduction}%`),
  },
  chainLightning: {
    name: 'Цепная молния',
    levels: SC_CHAIN_LEVELS,
    getDesc: (lvl, skill = SKILLS.chainLightning) => { const s = skill, d = s.levels[lvl-1]; return `Молния по ${scV(d.targets)} врагам и ещё по одному за каждого паука (прыгает через паутину). MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.chainLightning, lvl, n => `${n.targets} цели, ×${n.multiplier.toFixed(2)}`),
  },
};

Object.assign(SUBCLASS_SKILLS, {
  // ---- Грозовой страж ----
  sgArmor: {
    id: 'sgArmor', subclassId: 'drow_stormguard', name: 'Грозовой доспех', type: 'active', freeTurn: true,
    iconPng: 'img/skills/subclass/sgArmor.webp',
    maxLevel: 5, cooldown: 8, turns: 5,
    levels: [ { mpCost: 0, pct: 5, cut: 15 }, { mpCost: 0, pct: 6, cut: 18 }, { mpCost: 0, pct: 7, cut: 22 }, { mpCost: 0, pct: 8, cut: 26 }, { mpCost: 0, pct: 10, cut: 30 } ],
    getDesc: (lvl) => { const s = SKILLS.sgArmor, d = s.levels[lvl-1]; return `Не тратит ход: ${s.turns} ходов входящий урон ${scV('−' + d.cut + '%')}, каждый удар по вам даёт твари 2 заряда Статики и бьёт её молнией на ${scV(d.pct + '%')} атаки. Без затрат. Автобой — против стаи или сильной твари. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.sgArmor, lvl, n => `${n.pct}% атаки`),
  },
  sgStatic: {
    id: 'sgStatic', subclassId: 'drow_stormguard', name: 'Статика', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/sgStatic.webp',
    maxLevel: 5,
    levels: [ { mpCost: 0, pct: 25 }, { mpCost: 0, pct: 28 }, { mpCost: 0, pct: 32 }, { mpCost: 0, pct: 36 }, { mpCost: 0, pct: 40 } ],
    getDesc: (lvl) => { const d = SKILLS.sgStatic.levels[lvl-1]; return `<b>Работает сама</b>, пока стоит в слоте: каждый удар по вам — заряд Статики на ударившую тварь. На ${STATIC_MAX} — разряд: ${scV(d.pct + '%')} атаки молнией и шкала хода ${scV('−50%')}, заряды сгорают.`; },
    getNextDesc: (lvl) => scNext(SKILLS.sgStatic, lvl, n => `${n.pct}% атаки`),
  },
  sgGround: {
    id: 'sgGround', subclassId: 'drow_stormguard', name: 'Заземление', type: 'passive',
    iconPng: 'img/skills/subclass/sgGround.webp',
    maxLevel: 5,
    levels: [ { magic: 10 }, { magic: 12 }, { magic: 15 }, { magic: 17 }, { magic: 20 } ],
    getDesc: (lvl) => { const d = SKILLS.sgGround.levels[lvl-1]; return `Пассивно: магический урон по вам ${scV('−' + d.magic + '%')}, и каждый заряд Статики на твари — её удары ${scV('−5%')}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.sgGround, lvl, n => `маг. урон −${n.magic}%`),
  },
  sgConductor: {
    id: 'sgConductor', subclassId: 'drow_stormguard', name: 'Проводник', type: 'passive',
    iconPng: 'img/skills/subclass/sgConductor.webp',
    maxLevel: 5,
    levels: [ { def: 30 }, { def: 40 }, { def: 50 }, { def: 60 }, { def: 70 } ],
    getDesc: (lvl) => { const d = SKILLS.sgConductor.levels[lvl-1]; return `Пассивно: Наследие Грозы бьёт на один удар чаще, и к ответной молнии прибавляется ${scV(d.def + '%')} вашей физ. защиты.`; },
    getNextDesc: (lvl) => scNext(SKILLS.sgConductor, lvl, n => `+${n.def}% защиты`),
  },

  // ---- Ассасин ----
  asStep: {
    id: 'asStep', subclassId: 'drow_assassin', name: 'Шаг тени', type: 'active',
    iconPng: 'img/skills/subclass/asStep.webp',
    maxLevel: 5, cooldown: 6,
    levels: [ { mpCost: 10, dmg: 10 }, { mpCost: 10, dmg: 15 }, { mpCost: 11, dmg: 20 }, { mpCost: 11, dmg: 25 }, { mpCost: 12, dmg: 30 } ],
    getDesc: (lvl) => { const d = SKILLS.asStep.levels[lvl-1]; return `Шаг в тень: шкала хода сразу полная — следующий ход прямо сейчас, и он ${scV('+' + d.dmg + '%')} к урону. MP: ${scV(d.mpCost)}. КД: ${SKILLS.asStep.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.asStep, lvl, n => `+${n.dmg}%`),
  },
  asSting: {
    id: 'asSting', subclassId: 'drow_assassin', name: 'Ядовитое жало', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/asSting.webp',
    maxLevel: 5,
    levels: [ { mpCost: 0, tick: 4 }, { mpCost: 0, tick: 5 }, { mpCost: 0, tick: 6 }, { mpCost: 0, tick: 7 }, { mpCost: 0, tick: 8 } ],
    getDesc: (lvl) => { const d = SKILLS.asSting.levels[lvl-1]; return `<b>Работает само</b>, пока стоит в слоте: каждый удар — слой яда (до 5). Каждый ход слой бьёт на ${scV(d.tick + '%')} атаки, и каждый слой — ${scV('+3%')} к вашему урону по цели.`; },
    getNextDesc: (lvl) => scNext(SKILLS.asSting, lvl, n => `${n.tick}% за слой`),
  },
  asDual: {
    id: 'asDual', subclassId: 'drow_assassin', name: 'Парные клинки', type: 'passive',
    iconPng: 'img/skills/subclass/asDual.webp',
    maxLevel: 5,
    levels: [ { off: 47 }, { off: 49 }, { off: 51 }, { off: 53 }, { off: 55 } ],
    getDesc: (lvl) => { const d = SKILLS.asDual.levels[lvl-1]; return `Пассивно, с парным оружием: вторая рука даёт ${scV(d.off + '%')} своей атаки вместо 40%, штрафа точности нет.`; },
    getNextDesc: (lvl) => scNext(SKILLS.asDual, lvl, n => `${n.off}%`),
  },
  asLight: {
    id: 'asLight', subclassId: 'drow_assassin', name: 'Лёгкая рука', type: 'passive',
    iconPng: 'img/skills/subclass/asLight.webp',
    maxLevel: 5,
    levels: [ { atb: 15 }, { atb: 19 }, { atb: 22 }, { atb: 26 }, { atb: 30 } ],
    getDesc: (lvl) => { const d = SKILLS.asLight.levels[lvl-1]; return `Пассивно: убийство — ваша шкала хода ${scV('+' + d.atb + '%')}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.asLight, lvl, n => `+${n.atb}%`),
  },

  // ---- Теневой ткач ----
  swDouble: {
    id: 'swDouble', subclassId: 'drow_shadowweaver', name: 'Теневой двойник', type: 'active', freeTurn: true,
    iconPng: 'img/skills/subclass/swDouble.webp',
    maxLevel: 5, cooldown: 9, turns: 5,
    levels: [ { mpCost: 16, pct: 40 }, { mpCost: 17, pct: 45 }, { mpCost: 18, pct: 50 }, { mpCost: 19, pct: 55 }, { mpCost: 20, pct: 60 } ],
    getDesc: (lvl) => { const s = SKILLS.swDouble, d = s.levels[lvl-1]; return `Не тратит ход: ${s.turns} ходов рядом теневой двойник и повторяет каждый ваш удар на ${scV(d.pct + '%')}. Его не убить. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.swDouble, lvl, n => `${n.pct}%`),
  },
  swBlade: {
    id: 'swBlade', subclassId: 'drow_shadowweaver', name: 'Заряженный клинок', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/swBlade.webp',
    maxLevel: 5,
    levels: [ { mpCost: 0, pct: 20 }, { mpCost: 0, pct: 23 }, { mpCost: 0, pct: 26 }, { mpCost: 0, pct: 28 }, { mpCost: 0, pct: 30 } ],
    getDesc: (lvl) => { const d = SKILLS.swBlade.levels[lvl-1]; return `<b>Работает сам</b>, пока стоит в слоте: после Разряда следующий удар оружием добавляет ${scV(d.pct + '%')} силы молнии (маг. атака + половина физ.) и сбивает шкалу цели на ${scV('10%')}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.swBlade, lvl, n => `${n.pct}%`),
  },
  swDeep: {
    id: 'swDeep', subclassId: 'drow_shadowweaver', name: 'Глубокая тень', type: 'passive',
    iconPng: 'img/skills/subclass/swDeep.webp',
    maxLevel: 5,
    levels: [ { pct: 10 }, { pct: 12 }, { pct: 15 }, { pct: 17 }, { pct: 20 } ],
    getDesc: (lvl) => { const d = SKILLS.swDeep.levels[lvl-1]; return `Пассивно: двойник повторяет на ${scV('+' + d.pct + '%')} сильнее и держится на ход дольше.`; },
    getNextDesc: (lvl) => scNext(SKILLS.swDeep, lvl, n => `+${n.pct}%`),
  },
  swFlesh: {
    id: 'swFlesh', subclassId: 'drow_shadowweaver', name: 'Плоть грозы', type: 'passive',
    iconPng: 'img/skills/subclass/swFlesh.webp',
    maxLevel: 5,
    levels: [ { mp: 10 }, { mp: 12 }, { mp: 15 }, { mp: 17 }, { mp: 20 } ],
    getDesc: (lvl) => { const d = SKILLS.swFlesh.levels[lvl-1]; return `Пассивно: макс. MP ${scV('+' + d.mp + '%')}, и каждый паралич возвращает ${scV('5%')} макс. MP.`; },
    getNextDesc: (lvl) => scNext(SKILLS.swFlesh, lvl, n => `+${n.mp}% MP`),
  },

  // ---- Буревестник ----
  scStormFront: {
    id: 'scStormFront', subclassId: 'drow_stormcaller', name: 'Грозовой фронт', type: 'active',
    iconPng: 'img/skills/subclass/scStormFront.webp',
    maxLevel: 5, cooldown: 7, turns: 4,
    levels: [ { mpCost: 18, pct: 60 }, { mpCost: 19, pct: 70 }, { mpCost: 20, pct: 80 }, { mpCost: 21, pct: 90 }, { mpCost: 22, pct: 100 } ],
    getDesc: (lvl) => { const s = SKILLS.scStormFront, d = s.levels[lvl-1]; return `Тратит ход: ${s.turns} хода в начале каждого вашего хода молния бьёт случайную тварь на ${scV(d.pct + '%')} маг. атаки. Копит Напряжение. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.scStormFront, lvl, n => `${n.pct}%`),
  },
  scSpark: {
    id: 'scSpark', subclassId: 'drow_stormcaller', name: 'Искрение', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/scSpark.webp',
    maxLevel: 5,
    levels: [ { mpCost: 0, pct: 50 }, { mpCost: 0, pct: 60 }, { mpCost: 0, pct: 70 }, { mpCost: 0, pct: 80 }, { mpCost: 0, pct: 90 } ],
    getDesc: (lvl) => { const d = SKILLS.scSpark.levels[lvl-1]; return `<b>Работает само</b>, пока стоит в слоте: сработал Цепной разум — бесплатная искра в случайную тварь на ${scV(d.pct + '%')} маг. атаки.`; },
    getNextDesc: (lvl) => scNext(SKILLS.scSpark, lvl, n => `${n.pct}%`),
  },
  scBlood: {
    id: 'scBlood', subclassId: 'drow_stormcaller', name: 'Буря в крови', type: 'passive',
    iconPng: 'img/skills/subclass/scBlood.webp',
    maxLevel: 5,
    levels: [ { chance: 10 }, { chance: 14 }, { chance: 18 }, { chance: 21 }, { chance: 25 } ],
    getDesc: (lvl) => { const d = SKILLS.scBlood.levels[lvl-1]; return `Пассивно: Цепной разум срабатывает на ${scV('+' + d.chance + '%')} чаще.`; },
    getNextDesc: (lvl) => scNext(SKILLS.scBlood, lvl, n => `+${n.chance}%`),
  },
  scTension: {
    id: 'scTension', subclassId: 'drow_stormcaller', name: 'Напряжение', type: 'passive',
    iconPng: 'img/skills/subclass/scTension.webp',
    maxLevel: 5,
    levels: [ { mult: 1.4 }, { mult: 1.5 }, { mult: 1.6 }, { mult: 1.7 }, { mult: 1.8 } ],
    getDesc: (lvl) => { const d = SKILLS.scTension.levels[lvl-1]; return `Пассивно: 5 молний подряд (Разряд, Шаровая, Цепная, Фронт) — следующая молния ${scX(d.mult)} и без маны. Другое действие сбрасывает счёт.`; },
    getNextDesc: (lvl) => scNext(SKILLS.scTension, lvl, n => `×${n.mult.toFixed(1)}`),
  },

  // ---- Ткач снов ----
  dwHaste: {
    id: 'dwHaste', subclassId: 'drow_dreamweaver', name: 'Ускорение', type: 'active', freeTurn: true,
    iconPng: 'img/skills/subclass/dwHaste.webp',
    maxLevel: 5, cooldown: 8, turns: 5,
    levels: [ { mpCost: 12, atb: 25 }, { mpCost: 13, atb: 27 }, { mpCost: 14, atb: 30 }, { mpCost: 15, atb: 32 }, { mpCost: 16, atb: 35 } ],
    getDesc: (lvl) => { const s = SKILLS.dwHaste, d = s.levels[lvl-1]; return `Не тратит ход: ${s.turns} ходов шкала хода ${scV('+' + d.atb + '%')}. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.dwHaste, lvl, n => `+${n.atb}%`),
  },
  dwMist: {
    id: 'dwMist', subclassId: 'drow_dreamweaver', name: 'Сонная дымка', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/dwMist.webp',
    maxLevel: 5, threshold: 40,
    levels: [ { mpCost: 0, every: 7 }, { mpCost: 0, every: 6 }, { mpCost: 0, every: 6 }, { mpCost: 0, every: 5 }, { mpCost: 0, every: 4 } ],
    getDesc: (lvl) => { const s = SKILLS.dwMist, d = s.levels[lvl-1]; return `<b>Работает сама</b>, пока стоит в слоте: HP упало ниже ${s.threshold}% — все враги засыпают на ход (до первого удара). Не чаще раза в ${scV(d.every)} ходов.`; },
    getNextDesc: (lvl) => scNext(SKILLS.dwMist, lvl, n => `раз в ${n.every} ходов`),
  },
  dwLullaby: {
    id: 'dwLullaby', subclassId: 'drow_dreamweaver', name: 'Колыбельная', type: 'passive',
    iconPng: 'img/skills/subclass/dwLullaby.webp',
    maxLevel: 5,
    levels: [ { heal: 15, regen: 2 }, { heal: 17, regen: 2 }, { heal: 20, regen: 2 }, { heal: 22, regen: 2.5 }, { heal: 25, regen: 3 } ],
    getDesc: (lvl) => { const d = SKILLS.dwLullaby.levels[lvl-1]; return `Пассивно: пока хоть одна тварь спит — реген в бою ×${d.regen}, а любое лечение ${scV('+' + d.heal + '%')}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.dwLullaby, lvl, n => `лечение +${n.heal}%, реген ×${n.regen}`),
  },
  dwNightmare: {
    id: 'dwNightmare', subclassId: 'drow_dreamweaver', name: 'Кошмар', type: 'passive',
    iconPng: 'img/skills/subclass/dwNightmare.webp',
    maxLevel: 5,
    levels: [ { pct: 20 }, { pct: 25 }, { pct: 30 }, { pct: 35 }, { pct: 40 } ],
    getDesc: (lvl) => { const d = SKILLS.dwNightmare.levels[lvl-1]; return `Пассивно: удар, который будит спящую тварь, — ${scV('+' + d.pct + '%')} урона.`; },
    getNextDesc: (lvl) => scNext(SKILLS.dwNightmare, lvl, n => `+${n.pct}%`),
  },

  // ---- Паучий владыка ----
  slMother: {
    id: 'slMother', subclassId: 'drow_spiderlord', name: 'Паучиха-матка', type: 'active', freeTurn: 0.7,
    fxAnim: 'summon',
    iconPng: 'img/allies/spider_mother.webp',
    maxLevel: 5, cooldown: 3, layEvery: 2,
    levels: [ { mpCost: 14, power: 60 }, { mpCost: 15, power: 70 }, { mpCost: 16, power: 80 }, { mpCost: 17, power: 90 }, { mpCost: 18, power: 100 } ],
    getDesc: (lvl) => { const d = SKILLS.slMother.levels[lvl-1]; return `Быстрый: ${scV('70%')} хода сразу возвращается. Нет матки — призывает её на весь бой (сила ${scV(d.power + '%')}). Каждые 2 хода она откладывает паучонка (до 2, всего 3 паука). Повторное применение сразу добавляет паучонка. Если выводок полный, матка сразу кусает цель. Укусы опутывают паутиной: шкала хода твари медленнее. MP: ${scV(d.mpCost)}. КД: ${SKILLS.slMother.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.slMother, lvl, n => `сила ${n.power}%`),
  },
  slVenom: {
    id: 'slVenom', subclassId: 'drow_spiderlord', name: 'Паучий яд', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/slVenom.webp',
    maxLevel: 5,
    levels: [ { mpCost: 0, tick: 4 }, { mpCost: 0, tick: 5 }, { mpCost: 0, tick: 6 }, { mpCost: 0, tick: 7 }, { mpCost: 0, tick: 8 } ],
    getDesc: (lvl) => { const d = SKILLS.slVenom.levels[lvl-1]; return `<b>Работает сам</b>, пока стоит в слоте: каждый укус паука — слой яда (до 5), слой бьёт на ${scV(d.tick + '%')} вашей маг. атаки каждый ход.`; },
    getNextDesc: (lvl) => scNext(SKILLS.slVenom, lvl, n => `${n.tick}% за слой`),
  },
  slBrood: {
    id: 'slBrood', subclassId: 'drow_spiderlord', name: 'Плодовитость', type: 'passive',
    iconPng: 'img/allies/spider_spawn.webp',
    maxLevel: 5,
    levels: [ { pct: 20 }, { pct: 25 }, { pct: 30 }, { pct: 35 }, { pct: 40 } ],
    getDesc: (lvl) => { const d = SKILLS.slBrood.levels[lvl-1]; return `Пассивно: паучата сильнее на ${scV(d.pct + '%')} (здоровье и укус).`; },
    getNextDesc: (lvl) => scNext(SKILLS.slBrood, lvl, n => `+${n.pct}%`),
  },
  slSilk: {
    id: 'slSilk', subclassId: 'drow_spiderlord', name: 'Шёлковые нити', type: 'passive',
    iconPng: 'img/skills/subclass/slSilk.webp',
    maxLevel: 5,
    levels: [ { slow: 20 }, { slow: 25 }, { slow: 30 }, { slow: 35 }, { slow: 40 } ],
    getDesc: (lvl) => { const d = SKILLS.slSilk.levels[lvl-1]; return `Пассивно: паутина пауков замедляет шкалу хода твари на ${scV(d.slow + '%')} (без нити — на 15%).`; },
    getNextDesc: (lvl) => scNext(SKILLS.slSilk, lvl, n => `−${n.slow}%`),
  },
});

// ========================================================
//  ГНОМ: уровни 1–7 старых навыков
// ========================================================
const SC_GREED_W_LEVELS = [
  { mpCost: 10, multiplier: 0.90, markTurns: 3 }, { mpCost: 11, multiplier: 0.95, markTurns: 4 },
  { mpCost: 12, multiplier: 1.00, markTurns: 4 }, { mpCost: 13, multiplier: 1.05, markTurns: 5 },
  { mpCost: 15, multiplier: 1.15, markTurns: 6 }, { mpCost: 16, multiplier: 1.20, markTurns: 6 },
  { mpCost: 17, multiplier: 1.25, markTurns: 7 },
];
const SC_GREED_M_LEVELS = [
  { mpCost: 12, multiplier: 2.00, markTurns: 3 }, { mpCost: 13, multiplier: 2.20, markTurns: 4 },
  { mpCost: 14, multiplier: 2.40, markTurns: 4 }, { mpCost: 15, multiplier: 2.60, markTurns: 5 },
  { mpCost: 17, multiplier: 2.90, markTurns: 6 }, { mpCost: 18, multiplier: 3.10, markTurns: 6 },
  { mpCost: 19, multiplier: 3.30, markTurns: 7 },
];
const SC_QUAKE_LEVELS = [
  { mpCost: 12, multiplier: 0.60, targets: 5, freezeChance: 25 }, { mpCost: 13, multiplier: 0.67, targets: 5, freezeChance: 30 },
  { mpCost: 14, multiplier: 0.75, targets: 5, freezeChance: 35 }, { mpCost: 15, multiplier: 0.82, targets: 5, freezeChance: 40 },
  { mpCost: 16, multiplier: 0.90, targets: 5, freezeChance: 45 }, { mpCost: 17, multiplier: 0.97, targets: 5, freezeChance: 48 },
  { mpCost: 18, multiplier: 1.05, targets: 5, freezeChance: 50 },
];
const SC_RUNE_LEVELS = [
  { mpCost: 18, multiplier: 1.30, targets: 3, atbCut: 15 }, { mpCost: 19, multiplier: 1.40, targets: 3, atbCut: 15 },
  { mpCost: 21, multiplier: 1.50, targets: 4, atbCut: 15 }, { mpCost: 22, multiplier: 1.60, targets: 4, atbCut: 15 },
  { mpCost: 24, multiplier: 1.70, targets: 5, atbCut: 15 }, { mpCost: 25, multiplier: 1.80, targets: 5, atbCut: 17 },
  { mpCost: 26, multiplier: 1.90, targets: 5, atbCut: 20 },
];
const BREACH_PCT = 15;    // Пролом: −15% защиты твари за каждый
const BREACH_MAX = 3;
const HEAT_MAX = 5;       // Жар: −5% защиты за единицу

// ========================================================
//  СТАЛЬНАЯ СТЕНА (гном-воин, танк): плоское поглощение
// ========================================================
SUBCLASSES.dwarf_steelwall.mods = {
  powerStrike: {
    name: 'Удар-наковальня', defPart: 0.6,
    levels: SC_WAR_PS_LEVELS,
    getDesc: (lvl, skill = SKILLS.powerStrike) => { const s = skill, d = s.levels[lvl-1]; return `(атака + ${scV('60%')} физ. защиты) × ${scX(d.multiplier)}. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.powerStrike, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  dwarfGreed: {
    name: 'Жадность',
    levels: SC_GREED_W_LEVELS,
    getDesc: (lvl, skill = SKILLS.dwarfGreed) => { const s = skill, d = s.levels[lvl-1]; return `Удар на ${scX(d.multiplier)} и Метка Жадности на ${scV(d.markTurns)} хода (до 5). Каждая метка: +25% добычи и +10% опыта при убийстве — и ${scV('−4%')} к ударам этой твари по вам. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.dwarfGreed, lvl, n => `×${n.multiplier.toFixed(2)}, метка ${n.markTurns} хода`),
  },
  frostQuake: {
    name: 'Ледяной вызов',
    levels: SC_QUAKE_LEVELS,
    getDesc: (lvl, skill = SKILLS.frostQuake) => { const s = skill, d = s.levels[lvl-1]; return `Лёд бьёт всех (до ${scV(d.targets)}) на ${scX(d.multiplier)}, заморозка ${scV(d.freezeChance + '%')}; задетые бьют только вас. Разносит Метки Жадности. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.frostQuake, lvl, n => `×${n.multiplier.toFixed(2)}, заморозка ${n.freezeChance}%`),
  },
};

// ========================================================
//  МОЛОТОБОЕЦ (гном-воин, урон): ломает броню и раскалывает лёд
// ========================================================
SUBCLASSES.dwarf_hammerer.mods = {
  powerStrike: {
    name: 'Сокрушающий молот',
    levels: SC_WAR_PS_LEVELS,
    getDesc: (lvl, skill = SKILLS.powerStrike) => { const s = skill, d = s.levels[lvl-1]; return `Удар на ${scX(d.multiplier)} и <b>Пролом</b>: защита цели ${scV('−' + BREACH_PCT + '%')} до конца боя (до ${BREACH_MAX}). MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.powerStrike, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  dwarfGreed: {
    name: 'Жадность',
    levels: SC_GREED_W_LEVELS,
    getDesc: (lvl, skill = SKILLS.dwarfGreed) => { const s = skill, d = s.levels[lvl-1]; return `Удар на ${scX(d.multiplier)} и Метка Жадности на ${scV(d.markTurns)} хода; по замороженной — ${scV('2')} метки. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.dwarfGreed, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  frostQuake: {
    name: 'Раскол',
    levels: SC_QUAKE_LEVELS,
    getDesc: (lvl, skill = SKILLS.frostQuake) => { const s = skill, d = s.levels[lvl-1]; return `Лёд бьёт всех (до ${scV(d.targets)}) на ${scX(d.multiplier)}, заморозка ${scV(d.freezeChance + '%')}. Уже замороженные получают ${scX(2)} и оттаивают. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.frostQuake, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
};

// ========================================================
//  СТАРАТЕЛЬ (гном-воин, ремесло): середнячок в бою, больше всех добычи
// ========================================================
const PROSPECTOR_GREED_MAX = 7;
const PROSPECTOR_GREED_PER = 30;
SUBCLASSES.dwarf_prospector.mods = {
  powerStrike: {
    name: 'Удар кайлом',
    levels: SC_WAR_PS_LEVELS,
    getDesc: (lvl, skill = SKILLS.powerStrike) => { const s = skill, d = s.levels[lvl-1]; return `Удар на ${scX(d.multiplier)}; убил — лишний бросок добычи. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.powerStrike, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  dwarfGreed: {
    name: 'Жадность',
    levels: SC_GREED_W_LEVELS,
    getDesc: (lvl, skill = SKILLS.dwarfGreed) => { const s = skill, d = s.levels[lvl-1]; return `Удар на ${scX(d.multiplier)} и Метка Жадности на ${scV(d.markTurns)} хода — до ${scV(PROSPECTOR_GREED_MAX)} меток, каждая ${scV('+' + PROSPECTOR_GREED_PER + '%')} добычи. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.dwarfGreed, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  frostQuake: {
    name: 'Ледяной раскол',
    levels: SC_QUAKE_LEVELS,
    getDesc: (lvl, skill = SKILLS.frostQuake) => { const s = skill, d = s.levels[lvl-1]; return `Лёд бьёт всех (до ${scV(d.targets)}) на ${scX(d.multiplier)}, заморозка ${scV(d.freezeChance + '%')}, разносит Метки Жадности. Убитая с метками может выронить руду (10% за метку). MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.frostQuake, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
};

// ========================================================
//  МАСТЕР ГОРНА (гном-маг, ремесло-разрушитель огнём): Жар
// ========================================================
SUBCLASSES.dwarf_forgemaster.mods = {
  fireball: {
    name: 'Огненный шар',
    levels: SC_FIREBALL_LEVELS,
    getDesc: (lvl, skill = SKILLS.fireball) => { const s = skill, d = s.levels[lvl-1]; return `Огонь на ${scX(d.multiplier)}, поджог по ${scV(d.burnPercent + '%')} маг. атаки и ${scV('+1 Жар')} цели (до ${HEAT_MAX}; каждая единица — ${scV('−5%')} защиты твари). MP: ${scV(d.mpCost)}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.fireball, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  dwarfGreedMagic: {
    name: 'Жадность',
    levels: SC_GREED_M_LEVELS,
    getDesc: (lvl, skill = SKILLS.dwarfGreedMagic) => { const s = skill, d = s.levels[lvl-1]; return `Удар на ${scX(d.multiplier)} и Метка Жадности (+25% Оболов). Раскалённая (с Жаром) тварь с меткой роняет руду. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.dwarfGreedMagic, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  blizzardRune: {
    name: 'Руна закалки', temperMult: 1.8,
    levels: SC_RUNE_LEVELS,
    getDesc: (lvl, skill = SKILLS.blizzardRune) => { const s = skill, d = s.levels[lvl-1]; return `Руна, на следующий ход буран: ${scV(d.targets)} врагов по ${scX(d.multiplier)}, шкала стаи −${scV(d.atbCut + '%')}. По раскалённым — <b>Закалка</b>: ${scX(1.8)}, Жар сгорает и оставляет Пролом (защита −15%). MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.blizzardRune, lvl, n => `${n.targets} цели, ×${n.multiplier.toFixed(2)}`),
  },
};

// ========================================================
//  РУННЫЙ МАСТЕР (гном-маг, ремесло-опора): руны в бою и на вещах
// ========================================================
SUBCLASSES.dwarf_runemaster.mods = {
  fireball: {
    name: 'Руна-ловушка', nowMult: 0.6, trapMult: 1.2,
    levels: SC_FIREBALL_LEVELS,
    getDesc: (lvl, skill = SKILLS.fireball) => { const s = skill, d = s.levels[lvl-1]; return `Огонь на ${scX(d.multiplier * 0.6)} сразу и руна-ловушка: она взрывается на ${scX(d.multiplier * 1.2)}, когда тварь сама соберётся ударить. Ловушка на твари уже есть — старая взрывается сразу. MP: ${scV(d.mpCost)}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.fireball, lvl, n => `×${(n.multiplier * 0.6).toFixed(2)} + ×${(n.multiplier * 1.2).toFixed(2)}`),
  },
  dwarfGreedMagic: {
    name: 'Жадность', mpBack: 3,
    levels: SC_GREED_M_LEVELS,
    getDesc: (lvl, skill = SKILLS.dwarfGreedMagic) => { const s = skill, d = s.levels[lvl-1]; return `Удар на ${scX(d.multiplier)} и Метка Жадности (+25% Оболов). Убийство твари с меткой — ${scV('3%')} макс. MP. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.dwarfGreedMagic, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  blizzardRune: {
    name: 'Руна вьюги', guardTurns: 3, guardCut: 15,
    levels: SC_RUNE_LEVELS,
    getDesc: (lvl, skill = SKILLS.blizzardRune) => { const s = skill, d = s.levels[lvl-1]; return `Руна, на следующий ход буран: ${scV(d.targets)} врагов по ${scX(d.multiplier)}, шкала стаи −${scV(d.atbCut + '%')}. После бурана 3 хода урон по вам ${scV('−15%')}. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.blizzardRune, lvl, n => `${n.targets} цели, ×${n.multiplier.toFixed(2)}`),
  },
};

// ========================================================
//  ЗАКЛИНАТЕЛЬ КАМНЯ (гном-маг, союзники): элементали камня, огня и жилы
// ========================================================
const ELEMENTAL_KINDS = {
  stone: { name: 'Элементаль камня', img: 'img/allies/elemental_stone.webp', hp: 0.6, atk: 0.3, taunt: true, desc: 'принимает удары' },
  fire:  { name: 'Элементаль огня',  img: 'img/allies/elemental_fire.webp',  hp: 0.3, atk: 0.5, burn: true, desc: 'поджигает' },
  vein:  { name: 'Элементаль жилы',  img: 'img/allies/elemental_vein.webp',  hp: 0.35, atk: 0.4, vein: true, desc: 'задевает ещё одного врага и даёт дополнительный шанс добычи с задетых целей' },
};
const ELEMENTAL_ORDER = ['stone', 'fire', 'vein'];
SUBCLASSES.dwarf_stonecaller.mods = {
  fireball: {
    name: 'Огненный шар',
    levels: SC_FIREBALL_LEVELS,
    getDesc: (lvl, skill = SKILLS.fireball) => { const s = skill, d = s.levels[lvl-1]; return `Огонь на ${scX(d.multiplier)}, поджог по ${scV(d.burnPercent + '%')} маг. атаки. Элементали разгораются: каждый сразу бьёт ещё раз на ${scV('50%')}. MP: ${scV(d.mpCost)}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.fireball, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  dwarfGreedMagic: {
    name: 'Жадность',
    levels: SC_GREED_M_LEVELS,
    getDesc: (lvl, skill = SKILLS.dwarfGreedMagic) => { const s = skill, d = s.levels[lvl-1]; return `Удар на ${scX(d.multiplier)} и Метка Жадности (+25% Оболов). Удары элементалей тоже ставят метки. MP: ${scV(d.mpCost)}. КД: ${s.cooldown} ATB.`; },
    getNextDesc: (lvl) => scNext(SKILLS.dwarfGreedMagic, lvl, n => `×${n.multiplier.toFixed(2)}`),
  },
  blizzardRune: {
    name: 'Руна вьюги',
    levels: SC_RUNE_LEVELS,
    getDesc: (lvl, skill = SKILLS.blizzardRune) => { const s = skill, d = s.levels[lvl-1]; return `Руна, на следующий ход буран: ${scV(d.targets)} врагов по ${scX(d.multiplier)}, шкала стаи −${scV(d.atbCut + '%')} — и из бурана бесплатно выходит элементаль. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.blizzardRune, lvl, n => `${n.targets} цели, ×${n.multiplier.toFixed(2)}`),
  },
};

Object.assign(SUBCLASS_SKILLS, {
  // ---- Стальная стена ----
  swlClose: {
    id: 'swlClose', subclassId: 'dwarf_steelwall', name: 'Сомкнуть броню', type: 'active',
    iconPng: 'img/skills/subclass/swlClose.webp',
    maxLevel: 5, cooldown: 8, turns: 5,
    levels: [ { mpCost: 0, mult: 2.0 }, { mpCost: 0, mult: 2.2 }, { mpCost: 0, mult: 2.4 }, { mpCost: 0, mult: 2.7 }, { mpCost: 0, mult: 3.0 } ],
    getDesc: (lvl) => { const s = SKILLS.swlClose, d = s.levels[lvl-1]; return `Тратит ход: ${s.turns} ходов поглощение урона ${scX(d.mult)}. Без затрат. Автобой — против стаи или сильной твари. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.swlClose, lvl, n => `×${n.mult.toFixed(1)}`),
  },
  swlTemper: {
    id: 'swlTemper', subclassId: 'dwarf_steelwall', name: 'Закалка', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/swlTemper.webp',
    maxLevel: 5,
    levels: [ { mpCost: 0, max: 6 }, { mpCost: 0, max: 7 }, { mpCost: 0, max: 8 }, { mpCost: 0, max: 9 }, { mpCost: 0, max: 10 } ],
    getDesc: (lvl) => { const d = SKILLS.swlTemper.levels[lvl-1]; return `<b>Работает сама</b>, пока стоит в слоте: каждый удар по вам — ${scV('+1')} поглощения до конца боя (до ${scV('+' + d.max)}).`; },
    getNextDesc: (lvl) => scNext(SKILLS.swlTemper, lvl, n => `до +${n.max}`),
  },
  swlSteel: {
    id: 'swlSteel', subclassId: 'dwarf_steelwall', name: 'Гномья сталь', type: 'passive',
    iconPng: 'img/skills/subclass/swlSteel.webp',
    maxLevel: 5,
    levels: [ { pct: 10 }, { pct: 12 }, { pct: 15 }, { pct: 17 }, { pct: 20 } ],
    getDesc: (lvl) => { const d = SKILLS.swlSteel.levels[lvl-1]; return `Пассивно: защита от тяжёлой брони (сеты Оплот и Палач) ${scV('+' + d.pct + '%')}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.swlSteel, lvl, n => `+${n.pct}%`),
  },
  swlUnmoved: {
    id: 'swlUnmoved', subclassId: 'dwarf_steelwall', name: 'Несдвигаемый', type: 'passive',
    iconPng: 'img/skills/subclass/swlUnmoved.webp',
    maxLevel: 5,
    levels: [ { hp: 4 }, { hp: 5 }, { hp: 6 }, { hp: 8 }, { hp: 10 } ],
    getDesc: (lvl) => { const d = SKILLS.swlUnmoved.levels[lvl-1]; return `Пассивно: вас не оглушить и не сбить вашу шкалу хода; макс. HP ${scV('+' + d.hp + '%')}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.swlUnmoved, lvl, n => `+${n.hp}% HP`),
  },

  // ---- Молотобоец ----
  hmAnvil: {
    id: 'hmAnvil', subclassId: 'dwarf_hammerer', name: 'Удар по наковальне', type: 'active',
    iconPng: 'img/skills/subclass/hmAnvil.webp',
    maxLevel: 5, cooldown: 5,
    levels: [ { mpCost: 12, mult: 1.8, full: 3.4 }, { mpCost: 13, mult: 1.9, full: 3.6 }, { mpCost: 14, mult: 2.0, full: 3.8 }, { mpCost: 15, mult: 2.1, full: 4.0 }, { mpCost: 16, mult: 2.2, full: 4.2 } ],
    getDesc: (lvl) => { const d = SKILLS.hmAnvil.levels[lvl-1]; return `Удар на ${scX(d.mult)}; по цели с ${BREACH_MAX} Проломами — ${scX(d.full)} и оглушение. MP: ${scV(d.mpCost)}. КД: ${SKILLS.hmAnvil.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.hmAnvil, lvl, n => `×${n.mult.toFixed(1)} / ×${n.full.toFixed(1)}`),
  },
  hmCrack: {
    id: 'hmCrack', subclassId: 'dwarf_hammerer', name: 'Трещина', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/hmCrack.webp',
    maxLevel: 5,
    levels: [ { mpCost: 0, every: 4 }, { mpCost: 0, every: 4 }, { mpCost: 0, every: 3 }, { mpCost: 0, every: 3 }, { mpCost: 0, every: 2 } ],
    getDesc: (lvl) => { const d = SKILLS.hmCrack.levels[lvl-1]; return `<b>Работает сама</b>, пока стоит в слоте: каждый ${scV(d.every + '-й')} удар оружием — бесплатный Пролом.`; },
    getNextDesc: (lvl) => scNext(SKILLS.hmCrack, lvl, n => `каждый ${n.every}-й`),
  },
  hmHeavy: {
    id: 'hmHeavy', subclassId: 'dwarf_hammerer', name: 'Тяжёлая рука', type: 'passive',
    iconPng: 'img/skills/subclass/hmHeavy.webp',
    maxLevel: 5,
    levels: [ { pct: 15 }, { pct: 18 }, { pct: 22 }, { pct: 26 }, { pct: 30 } ],
    getDesc: (lvl) => { const d = SKILLS.hmHeavy.levels[lvl-1]; return `Пассивно, с молотом (дубиной) или топором: урон ${scV('+' + d.pct + '%')}, поглощение тварей (Толстокожий и т. п.) не режет ваш урон.`; },
    getNextDesc: (lvl) => scNext(SKILLS.hmHeavy, lvl, n => `+${n.pct}%`),
  },
  hmIce: {
    id: 'hmIce', subclassId: 'dwarf_hammerer', name: 'Лёд и сталь', type: 'passive',
    iconPng: 'img/skills/subclass/hmIce.webp',
    maxLevel: 5,
    levels: [ { freeze: 10, dmg: 20 }, { freeze: 10, dmg: 22 }, { freeze: 10, dmg: 25 }, { freeze: 12, dmg: 27 }, { freeze: 15, dmg: 30 } ],
    getDesc: (lvl) => { const d = SKILLS.hmIce.levels[lvl-1]; return `Пассивно: заморозка Раскола ${scV('+' + d.freeze + '%')}, урон по замороженным ${scV('+' + d.dmg + '%')}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.hmIce, lvl, n => `+${n.freeze}% заморозки, +${n.dmg}% урона`),
  },

  // ---- Старатель ----
  prVein: {
    id: 'prVein', subclassId: 'dwarf_prospector', name: 'Чутьё жилы', type: 'active',
    iconPng: 'img/skills/subclass/prVein.webp',
    maxLevel: 5, cooldown: 3,
    levels: [ { mpCost: 10, rare: 50 }, { mpCost: 11, rare: 62 }, { mpCost: 12, rare: 75 }, { mpCost: 13, rare: 87 }, { mpCost: 14, rare: 100 } ],
    getDesc: (lvl) => { const d = SKILLS.prVein.levels[lvl-1]; return `Тратит ход: до конца боя редкая добыча (шанс 2% и ниже) выпадает на ${scV('+' + d.rare + '%')} чаще. Автобой — в начале боя. MP: ${scV(d.mpCost)}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.prVein, lvl, n => `+${n.rare}%`),
  },
  prEye: {
    id: 'prEye', subclassId: 'dwarf_prospector', name: 'Глаз старателя', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/prEye.webp',
    maxLevel: 5,
    levels: [ { mpCost: 0, need: 7 }, { mpCost: 0, need: 6 }, { mpCost: 0, need: 6 }, { mpCost: 0, need: 5 }, { mpCost: 0, need: 5 } ],
    getDesc: (lvl) => { const d = SKILLS.prEye.levels[lvl-1]; return `<b>Работает сам</b>, пока стоит в слоте: тварь убита с ${scV(d.need)}+ метками Жадности — лишний бросок добычи; тварь с душой — ещё щепоть зелёной пыли.`; },
    getNextDesc: (lvl) => scNext(SKILLS.prEye, lvl, n => `от ${n.need} меток`),
  },
  prLode: {
    id: 'prLode', subclassId: 'dwarf_prospector', name: 'Жила', type: 'passive',
    iconPng: 'img/skills/subclass/prLode.webp',
    maxLevel: 5,
    levels: [ { pct: 10 }, { pct: 12 }, { pct: 15 }, { pct: 17 }, { pct: 20 } ],
    getDesc: (lvl) => { const d = SKILLS.prLode.levels[lvl-1]; return `Пассивно: ресурсы (материалы) с тварей выпадают на ${scV('+' + d.pct + '%')} чаще.`; },
    getNextDesc: (lvl) => scNext(SKILLS.prLode, lvl, n => `+${n.pct}%`),
  },
  prThrift: {
    id: 'prThrift', subclassId: 'dwarf_prospector', name: 'Скупой расчёт', type: 'passive',
    iconPng: 'img/skills/subclass/prThrift.webp',
    maxLevel: 5,
    levels: [ { pct: 8 }, { pct: 10 }, { pct: 12 }, { pct: 14 }, { pct: 16 } ],
    getDesc: (lvl) => { const d = SKILLS.prThrift.levels[lvl-1]; return `Пассивно: Оболов с тварей ${scV('+' + d.pct + '%')}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.prThrift, lvl, n => `+${n.pct}%`),
  },

  // ---- Мастер горна ----
  fmBellows: {
    id: 'fmBellows', subclassId: 'dwarf_forgemaster', name: 'Раздуть мехи', type: 'active', freeTurn: true,
    iconPng: 'img/skills/subclass/fmBellows.webp',
    maxLevel: 5, cooldown: 8, turns: 5,
    levels: [ { mpCost: 10, cut: 20, dmg: 8 }, { mpCost: 10, cut: 22, dmg: 10 }, { mpCost: 11, cut: 25, dmg: 11 }, { mpCost: 11, cut: 27, dmg: 13 }, { mpCost: 12, cut: 30, dmg: 15 } ],
    getDesc: (lvl) => { const s = SKILLS.fmBellows, d = s.levels[lvl-1]; return `Не тратит ход: ${s.turns} ходов ваш урон ${scV('+' + d.dmg + '%')}, огненные заклинания стоят на ${scV(d.cut + '%')} меньше маны, а Огненный шар даёт ${scV('+2 Жара')}. MP: ${scV(d.mpCost)}. КД: ${s.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.fmBellows, lvl, n => `урон +${n.dmg}%, −${n.cut}% MP`),
  },
  fmSparks: {
    id: 'fmSparks', subclassId: 'dwarf_forgemaster', name: 'Искры', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/fmSparks.webp',
    maxLevel: 5,
    levels: [ { mpCost: 0, pct: 60 }, { mpCost: 0, pct: 70 }, { mpCost: 0, pct: 80 }, { mpCost: 0, pct: 90 }, { mpCost: 0, pct: 100 } ],
    getDesc: (lvl) => { const d = SKILLS.fmSparks.levels[lvl-1]; return `<b>Работают сами</b>, пока стоят в слоте: на ${HEAT_MAX} Жара тварь вспыхивает — соседи получают ${scV(d.pct + '%')} маг. атаки огнём, а у неё Жар остывает до 2.`; },
    getNextDesc: (lvl) => scNext(SKILLS.fmSparks, lvl, n => `${n.pct}%`),
  },
  fmSmith: {
    id: 'fmSmith', subclassId: 'dwarf_forgemaster', name: 'Рука мастера', type: 'passive',
    iconPng: 'img/skills/subclass/fmSmith.webp',
    maxLevel: 5,
    levels: [ { reroll: 20, save: 10 }, { reroll: 30, save: 12 }, { reroll: 40, save: 15 }, { reroll: 50, save: 17 }, { reroll: 60, save: 20 } ],
    getDesc: (lvl) => { const d = SKILLS.fmSmith.levels[lvl-1]; return `Пассивно, в кузнице: с шансом ${scV(d.reroll + '%')} редкость бросается дважды и берётся лучшая; ${scV(d.save + '%')} шанс не потратить материалы.`; },
    getNextDesc: (lvl) => scNext(SKILLS.fmSmith, lvl, n => `${n.reroll}% двойной бросок, ${n.save}% экономии`),
  },
  fmSmelt: {
    id: 'fmSmelt', subclassId: 'dwarf_forgemaster', name: 'Переплавка', type: 'passive',
    iconPng: 'img/skills/subclass/fmSmelt.webp',
    maxLevel: 5,
    levels: [ { pct: 30 }, { pct: 35 }, { pct: 40 }, { pct: 45 }, { pct: 50 } ],
    getDesc: (lvl) => { const d = SKILLS.fmSmelt.levels[lvl-1]; return `Пассивно: в кузнице появляется кнопка «Переплавка» — ненужное снаряжение (не надетое) превращается в ${scV(d.pct + '%')} материалов его рецепта.`; },
    getNextDesc: (lvl) => scNext(SKILLS.fmSmelt, lvl, n => `${n.pct}%`),
  },

  // ---- Рунный мастер ----
  rmInscribe: {
    id: 'rmInscribe', subclassId: 'dwarf_runemaster', name: 'Начертать руны', type: 'active', freeTurn: true,
    iconPng: 'img/skills/subclass/rmInscribe.webp',
    maxLevel: 5, cooldown: 2,
    levels: [ { mpCost: 10, pct: 10, regen: 1.5 }, { mpCost: 11, pct: 12, regen: 1.8 }, { mpCost: 12, pct: 15, regen: 2.2 }, { mpCost: 13, pct: 17, regen: 2.6 }, { mpCost: 14, pct: 20, regen: 3 } ],
    getDesc: (lvl) => { const d = SKILLS.rmInscribe.levels[lvl-1]; return `Не тратит ход: чертит разом три руны до конца боя: <b>Камня</b> — урон по вам ${scV('−' + d.pct + '%')}; <b>Силы</b> — ваш урон ${scV('+' + d.pct + '%')}; <b>Жизни</b> — ${scV(d.regen + '%')} HP за ход. MP: ${scV(d.mpCost)}. КД: ${SKILLS.rmInscribe.cooldown}.`; },
    getNextDesc: (lvl) => scNext(SKILLS.rmInscribe, lvl, n => `${n.pct}%, ${n.regen}% HP`),
    useCheck: () => (runemasterNextRune() ? '' : 'все руны уже горят'),
  },
  rmWard: {
    id: 'rmWard', subclassId: 'dwarf_runemaster', name: 'Охранная руна', type: 'active', semiPassive: true,
    iconPng: 'img/skills/subclass/rmWard.webp',
    maxLevel: 5, threshold: 35,
    levels: [ { mpCost: 0, shield: 14, every: 7 }, { mpCost: 0, shield: 16, every: 6 }, { mpCost: 0, shield: 18, every: 6 }, { mpCost: 0, shield: 19, every: 5 }, { mpCost: 0, shield: 20, every: 5 } ],
    getDesc: (lvl) => { const s = SKILLS.rmWard, d = s.levels[lvl-1]; return `<b>Вспыхивает сама</b>, пока стоит в слоте: HP упало ниже ${s.threshold}% — щит на ${scV(d.shield + '%')} макс. HP. Не чаще раза в ${scV(d.every)} ходов.`; },
    getNextDesc: (lvl) => scNext(SKILLS.rmWard, lvl, n => `щит ${n.shield}%`),
  },
  rmSteady: {
    id: 'rmSteady', subclassId: 'dwarf_runemaster', name: 'Твёрдая рука', type: 'passive',
    iconPng: 'img/skills/subclass/rmSteady.webp',
    maxLevel: 5,
    levels: [ { chance: 5 }, { chance: 6 }, { chance: 7 }, { chance: 8 }, { chance: 10 } ],
    getDesc: (lvl) => { const d = SKILLS.rmSteady.levels[lvl-1]; return `Пассивно, у мастерицы подгонки: шанс подгонки ${scV('+' + d.chance + '%')}, а неудача стоит половину цены.`; },
    getNextDesc: (lvl) => scNext(SKILLS.rmSteady, lvl, n => `+${n.chance}%`),
  },
  rmWeave: {
    id: 'rmWeave', subclassId: 'dwarf_runemaster', name: 'Руническая вязь', type: 'passive',
    iconPng: 'img/skills/subclass/rmWeave.webp',
    maxLevel: 5,
    levels: [ { chance: 40 }, { chance: 55 }, { chance: 70 }, { chance: 85 }, { chance: 100 } ],
    getDesc: (lvl) => { const d = SKILLS.rmWeave.levels[lvl-1]; return `Пассивно: с шансом ${scV(d.chance + '%')} случайный бонус подгонки бросается дважды и берётся лучший (для мага ценнее мана, HP и крит, потом опыт и добыча).`; },
    getNextDesc: (lvl) => scNext(SKILLS.rmWeave, lvl, n => `${n.chance}%`),
  },

  // ---- Заклинатель камня ----
  scSummon: {
    id: 'scSummon', subclassId: 'dwarf_stonecaller', name: 'Призвать элементаля', type: 'active', freeTurn: 0.3,
    fxAnim: 'summon',
    iconPng: 'img/allies/elemental_stone.webp',
    maxLevel: 5, cooldown: 2,
    levels: [ { mpCost: 12, power: 60 }, { mpCost: 13, power: 70 }, { mpCost: 14, power: 80 }, { mpCost: 15, power: 90 }, { mpCost: 16, power: 100 } ],
    getDesc: (lvl) => { const d = SKILLS.scSummon.levels[lvl-1]; return `Сразу возвращает ${scV('30%')} шкалы хода. Призывает элементалей по очереди (сила ${scV(d.power + '%')}), пропуская тех, кто уже в бою. <b>Камень</b> принимает удары, <b>Огонь</b> поджигает, <b>Жила</b> задевает ещё одного врага и оставляет ему хотя бы 1 единицу здоровья. Задетые Жилой враги дают дополнительный шанс на добычу. Если все три стихии в бою, следующее применение сливает их в <b>Великого элементаля</b> (сумма ×1.2, все способности). Пока он жив, призыв недоступен. Тратит ${scV(d.mpCost)} маны. Перезарядка занимает ${SKILLS.scSummon.cooldown} хода.`; },
    getNextDesc: (lvl) => scNext(SKILLS.scSummon, lvl, n => `сила ${n.power}%`),
    useCheck: () => stonecallerSummonBlockReason(),
  },
  scShards: {
    id: 'scShards', subclassId: 'dwarf_stonecaller', name: 'Осколки', type: 'active', semiPassive: true,
    iconPng: 'img/allies/elemental_vein.webp',
    maxLevel: 5,
    levels: [ { mpCost: 0, pct: 60 }, { mpCost: 0, pct: 75 }, { mpCost: 0, pct: 90 }, { mpCost: 0, pct: 105 }, { mpCost: 0, pct: 120 } ],
    getDesc: (lvl) => { const d = SKILLS.scShards.levels[lvl-1]; return `<b>Работают сами</b>, пока стоят в слоте: разбитый элементаль взрывается своей стихией — все враги получают ${scV(d.pct + '%')} маг. атаки.`; },
    getNextDesc: (lvl) => scNext(SKILLS.scShards, lvl, n => `${n.pct}%`),
  },
  scStoneblood: {
    id: 'scStoneblood', subclassId: 'dwarf_stonecaller', name: 'Каменная кровь', type: 'passive',
    iconPng: 'img/skills/subclass/scStoneblood.webp',
    maxLevel: 5,
    levels: [ { atk: 10 }, { atk: 14 }, { atk: 18 }, { atk: 21 }, { atk: 25 } ],
    getDesc: (lvl) => { const d = SKILLS.scStoneblood.levels[lvl-1]; return `Пассивно: элементали наследуют ваше поглощение урона и ${scV(d.atk + '%')} маг. атаки к удару.`; },
    getNextDesc: (lvl) => scNext(SKILLS.scStoneblood, lvl, n => `${n.atk}%`),
  },
  scFusion: {
    id: 'scFusion', subclassId: 'dwarf_stonecaller', name: 'Великое слияние', type: 'passive',
    iconPng: 'img/allies/elemental_great.webp',
    maxLevel: 5,
    levels: [ { mult: 1.26 }, { mult: 1.32 }, { mult: 1.38 }, { mult: 1.44 }, { mult: 1.5 } ],
    getDesc: (lvl) => { const d = SKILLS.scFusion.levels[lvl-1]; return `Пассивно: Великий элементаль получает ×${d.mult.toFixed(2)} от суммы трёх (вместо ×1.2).`; },
    getNextDesc: (lvl) => scNext(SKILLS.scFusion, lvl, n => `×${n.mult.toFixed(2)}`),
  },
});

Object.assign(SKILLS, SUBCLASS_SKILLS);

// Летопись: запись о посвящении (vars.name — подкласс). Вписывается в ANNALS_FIRSTS
// из js/systems/subclass.js — annals.js грузится позже этого файла.
const SUBCLASS_ANNAL = 'Посвящение в Храме Ильграда. Мать Исмера говорит, знак дают боги: свеча вспыхнула у образа «%name%». Странно — я будто знал{|а} заранее, какая вспыхнет.';
