// ========================================================
//  СБОРКА SVG-ИКОНОК
//  Собирает все разбитые файлы в один объект SVG.
//
//  ВАЖНО: этот файл подключается ПОСЛЕ всех остальных
//  файлов из папки icons/ — потому что он зависит от них.
//
//  Порядок подключения в index.html:
//    icons/materials.js
//    icons/consumables.js
//    icons/equipment.js
//    icons/weapons.js
//    icons/skills.js
//    icons/index.js   ← этот
// ========================================================

const SVG = {
  ...SVG_MATERIALS,
  ...SVG_CONSUMABLES,
  ...SVG_EQUIPMENT,
  ...SVG_WEAPONS,
  ...SVG_SKILLS,
};