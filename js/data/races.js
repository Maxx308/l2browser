// ========================================================
//  ДАННЫЕ: РАСЫ ПЕРСОНАЖА
//  Доступны: Человек, Орк, Гном, Эльф, Дроу.
//
//  НОВОЕ (v0.16):
//  + Дроу доступен для выбора.
//  + Название изменено на «Дроу» (вместо «Тёмный эльф (Дроу)»),
//    чтобы не ломать колонки в рейтинге.
// ========================================================

const RACES = {
  human: {
    id: 'human', name: 'Человек',
    icon:        'img/races/human.webp',
    iconWarrior: 'img/races/human_warrior.webp',
    iconMage:    'img/races/human_mage.webp',
    desc: 'Навык «Опыт» ускоряет прокачку и помогает развивать владение оружием и стихиями.',
    creation: {
      label: 'Бонус к опыту',
      strength: 'Получает больше опыта и чаще получает бонус к владению.',
      weakness: 'Запас здоровья меньше, чем у орка или гнома того же класса.',
      warrior: {
        style: 'Оружие и двойные удары',
        strength: '«Двойной удар» дважды атакует одну цель. «Привал» ускоряет восстановление здоровья вне боя.',
        weakness: 'Базовый темп атак ниже, чем у воина-эльфа или дроу.',
      },
      mage: {
        style: 'Огонь, лёд и мана',
        strength: '«Ледяная стрела» может заморозить врага, а «Медитация» ускоряет восстановление маны вне боя.',
        weakness: 'Базовый запас здоровья меньше, чем у мага-орка или гнома.',
      },
    },
    available: true,
  },
  orc: {
    id: 'orc', name: 'Орк',
    icon:        'img/races/orc.webp',
    iconWarrior: 'img/races/orc_warrior.webp',
    iconMage:    'img/races/orc_mage.webp',
    desc: 'Кровь орка помогает восстанавливать здоровье даже во время боя.',
    creation: {
      label: 'Живучесть',
      strength: 'Большой запас здоровья и восстановление прямо в бою.',
      weakness: 'По базовой скорости действий уступает эльфам того же класса.',
      warrior: {
        style: 'Сила и живучесть',
        strength: '«Железная шкура» поглощает часть урона. «Ярость» наносит сильный удар без расхода маны.',
        weakness: '«Ярость» доступна от половины здоровья. Если враг выжил, удар ранит и самого орка.',
      },
      mage: {
        style: 'Магия Смерти и запас маны',
        strength: '«Шаманская мудрость» увеличивает запас маны и силу заклинаний. «Гнев» бьёт без расхода маны.',
        weakness: '«Гнев» доступен от половины здоровья и ранит орка, если враг пережил удар.',
      },
    },
    available: true,
    statsByClass: {
      warrior: { STR: 40, DEX: 26, CON: 47, INT: 18, WIT: 12, MEN: 27 },
      mage:    { STR: 27, DEX: 24, CON: 31, INT: 31, WIT: 15, MEN: 42 },
    },
  },
  elf: {
    id: 'elf', name: 'Эльф',
    icon:        'img/races/elf.webp',
    iconWarrior: 'img/races/elf_warrior.webp',
    iconMage:    'img/races/elf_mage.webp',
    desc: 'Благословение Леса помогает развивать магию Жизни.',
    creation: {
      label: 'Магия Жизни',
      strength: 'У эльфа есть лечение в обоих классах.',
      weakness: 'Запас здоровья меньше, чем у орка или гнома того же класса.',
      warrior: {
        style: 'Ловкость и лечение',
        strength: '«Грация» помогает уворачиваться, а «Дыхание природы» восстанавливает здоровье в бою.',
        weakness: 'Базовая атака оружием слабее, чем у воина-человека или орка.',
      },
      mage: {
        style: 'Заклинания и лечение',
        strength: 'Лечит себя заклинаниями Жизни и быстро действует.',
        weakness: 'Меньше здоровья, чем у мага-орка или гнома.',
      },
    },
    available: true,
    statsByClass: {
      warrior: { STR: 36, DEX: 35, CON: 36, INT: 23, WIT: 14, MEN: 26 },
      mage:    { STR: 21, DEX: 24, CON: 25, INT: 37, WIT: 23, MEN: 40 },
    },
  },
  drow: {
    id: 'drow', name: 'Дроу',
    icon:        'img/races/drow.webp',
    iconWarrior: 'img/races/drow_warrior.webp',
    iconMage:    'img/races/drow_mage.webp',
    desc: '«Разряд» отодвигает ход врага. Наследие Грозы позволяет отвечать молнией на его удары.',
    creation: {
      label: 'Молния',
      strength: 'Может сбить темп противника и при подходящих условиях парализовать его.',
      weakness: 'Базовый запас здоровья меньше, чем у других рас того же класса.',
      warrior: {
        style: 'Увороты и молния',
        strength: 'Уворот ускоряет следующий ход и заряжает «Разряд», чтобы парализовать врага.',
        weakness: 'Если враг попадает, низкий запас здоровья оставляет меньше времени на восстановление.',
      },
      mage: {
        style: 'Молнии и контроль',
        strength: '«Разряд» задерживает врага, а «Цепной разум» может ускорить перезарядку навыков.',
        weakness: 'Базовый запас здоровья ниже, чем у мага любой другой расы.',
      },
    },
    available: true,
    // Статы из Lineage 2 C4 (округлены под наш баланс)
    statsByClass: {
      warrior: { STR: 37, DEX: 34, CON: 35, INT: 24, WIT: 13, MEN: 27 },
      mage:    { STR: 23, DEX: 25, CON: 24, INT: 38, WIT: 20, MEN: 40 },
    },
  },
  dwarf: {
    id: 'dwarf', name: 'Гном',
    icon:        'img/races/dwarf.webp',
    iconWarrior: 'img/races/dwarf_warrior.webp',
    iconMage:    'img/races/dwarf_mage.webp',
    desc: 'Каменная кожа смягчает удары, а метки Жадности повышают награду за убитого монстра.',
    creation: {
      label: 'Больше наград',
      strength: 'Поглощает часть урона и может получать больше наград за охоту.',
      weakness: 'Чтобы получить бонус Жадности, цель должна умереть, пока на ней есть метки.',
      warrior: {
        style: 'Защита и добыча',
        strength: '«Крепкая стойка» даёт здоровье и защиту, а метки Жадности приносят больше добычи и опыта.',
        weakness: 'Базовый темп атак ниже, чем у воина-эльфа или дроу.',
      },
      mage: {
        style: 'Руны и Оболы',
        strength: '«Рунное знание» усиливает магию и увеличивает запас маны. Жадность даёт больше Оболов и опыта.',
        weakness: 'Базовая сила заклинаний ниже, чем у человека-мага.',
      },
    },
    available: true,
    statsByClass: {
      warrior: { STR: 39, DEX: 27, CON: 45, INT: 20, WIT: 10, MEN: 27 },
      mage:    { STR: 27, DEX: 24, CON: 33, INT: 32, WIT: 18, MEN: 38 },
    },
  },
};

// Помощник: возвращает картинку расы под выбранный класс.
function getRaceIcon(raceId, classId) {
  const race = RACES[raceId];
  if (!race) return '';
  if (classId === 'warrior' && race.iconWarrior) return race.iconWarrior;
  if (classId === 'mage'    && race.iconMage)    return race.iconMage;
  return race.icon;
}

// v0.38: портрет героя — подкласса, если он выбран (и подходит к расе и классу), иначе расы под класс.
function getHeroPortrait(raceId, classId, subclassId) {
  const sc = (subclassId && typeof SUBCLASSES !== 'undefined') ? SUBCLASSES[subclassId] : null;
  if (sc && sc.portrait && sc.race === raceId && sc.cls === classId) return sc.portrait;
  return getRaceIcon(raceId, classId);
}

// Помощник: возвращает статы для пары «раса + класс».
function getRaceClassStats(raceId, classId) {
  const race = RACES[raceId];
  if (race && race.statsByClass && race.statsByClass[classId]) {
    return race.statsByClass[classId];
  }
  const cls = CLASSES[classId];
  return cls ? cls.stats : null;
}