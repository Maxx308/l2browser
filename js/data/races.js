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
    desc: 'Универсалы. Не лучшие ни в чём, но и не худшие. Умеют всё — понемногу.',
    available: true,
  },
  orc: {
    id: 'orc', name: 'Орк',
    icon:        'img/races/orc.webp',
    iconWarrior: 'img/races/orc_warrior.webp',
    iconMage:    'img/races/orc_mage.webp',
    desc: 'Гора мышц и упрямства. Думают медленно, бьют сильно, живут долго. Отличный выбор для тех, кто устал от тонких материй.',
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
    desc: 'Живут вечно, стреляют метко, смотрят свысока. Умирают от одной стрелы в спину — ирония судьбы.',
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
    desc: 'Живут в темноте, ненавидят солнце и всех вокруг. Магия — сильная. Характер — так себе.',
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
    desc: 'Низкорослые, бородатые, упрямые. Могут перепить орка и переспорить эльфа. Уважают только пиво и золото.',
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

// Помощник: возвращает статы для пары «раса + класс».
function getRaceClassStats(raceId, classId) {
  const race = RACES[raceId];
  if (race && race.statsByClass && race.statsByClass[classId]) {
    return race.statsByClass[classId];
  }
  const cls = CLASSES[classId];
  return cls ? cls.stats : null;
}