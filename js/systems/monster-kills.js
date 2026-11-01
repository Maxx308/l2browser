// ========================================================
//  СИСТЕМЫ: СЧЁТЧИК УБИЙСТВ МОНСТРОВ + ТИТУЛЫ
//  Хранит, сколько раз убит каждый монстр × подтип.
//  По мере убийств открывает статы на карточке.
//
//  ТИТУЛЫ (иерархия):
//    none        — нет титула (×1.0).
//    hunter      — 1000+ убийств одного монстра × подтипа (×1.5).
//    glorious    — «Охотник» у ВСЕХ монстров одного подтипа
//                  на локации (×2.0).
//    magnificent — «Охотник» у ВСЕХ подтипов на локации (×3.0).
//
//  Множители НЕ складываются. Берётся лучший (по иерархии).
//
//  НОВОЕ:
//  + pDef открывается вместе с atk (порог 50).
//  + mDef открывается вместе с drop (порог 150).
//  + evasion открывается вместе с gold (порог 400).
// ========================================================

// Пороги открытия статов (общие для всех).
const KILL_THRESHOLDS = {
  hp:      10,    // после 10 — видно HP
  atk:     50,    // после 50 — видно атаку + физ. защиту
  drop:    150,   // после 150 — видно % дропа + маг. защиту
  gold:    400,   // после 400 — видно % Оболов + уворот
  title:   1000,  // после 1000 — титул «Охотник»
};

// Ключ = id_подтип (например 'silkworm_normal').
function killKey(monsterId, variantId) {
  return monsterId + '_' + variantId;
}

// Сколько раз убит этот монстр с этим подтипом.
function getMonsterKills(monsterId, variantId) {
  const key = killKey(monsterId, variantId);
  return state.player.monsterKills[key] || 0;
}

// +1 к счётчику.
function incrementMonsterKills(monsterId, variantId) {
  const key = killKey(monsterId, variantId);
  if (!state.player.monsterKills[key]) state.player.monsterKills[key] = 0;
  state.player.monsterKills[key] += 1;
}

// Открыт ли стат?
function isStatUnlocked(monsterId, variantId, statName) {
  const kills = getMonsterKills(monsterId, variantId);
  const threshold = KILL_THRESHOLDS[statName];
  if (!threshold) return true;
  return kills >= threshold;
}

// --------------------------------------------------------
//  ЛОКАЦИИ МОНСТРОВ
// --------------------------------------------------------

// Возвращает локацию монстра: 'field' или 'mine'.
function getMonsterLocation(monsterId) {
  if (MONSTERS.some(m => m.id === monsterId)) return 'field';
  if (MINE_MONSTERS.some(m => m.id === monsterId)) return 'mine';
  return null;
}

// Возвращает массив монстров на локации.
function getMonstersByLocation(loc) {
  if (loc === 'field') return MONSTERS;
  if (loc === 'mine')  return MINE_MONSTERS;
  return [];
}

// Отображаемое имя подтипа для тостов.
function getVariantDisplayName(variantId) {
  switch (variantId) {
    case 'normal':  return 'обычные';
    case 'ancient': return 'Древние';
    case 'bloody':  return 'Кровавые';
    default:        return variantId;
  }
}

// --------------------------------------------------------
//  ТИТУЛЫ
// --------------------------------------------------------

// Все подтипы, которые надо проверять.
const ALL_VARIANTS = ['normal', 'ancient', 'bloody'];

// Возвращает id титула для конкретного монстра × подтипа:
//   'none' | 'hunter' | 'glorious' | 'magnificent'
function getMonsterTitle(monsterId, variantId) {
  if (getMonsterKills(monsterId, variantId) < KILL_THRESHOLDS.title) {
    return 'none';
  }

  const loc = getMonsterLocation(monsterId);
  if (!loc) return 'hunter';
  const allMonsters = getMonstersByLocation(loc);

  // «Великолепный»: у ВСЕХ монстров × ВСЕХ подтипов на локации — «Охотник».
  const allVariants = allMonsters.every(m =>
    ALL_VARIANTS.every(v => getMonsterKills(m.id, v) >= KILL_THRESHOLDS.title)
  );
  if (allVariants) return 'magnificent';

  // «Прославленный»: у ВСЕХ монстров этого подтипа на локации — «Охотник».
  const allSameVariant = allMonsters.every(m =>
    getMonsterKills(m.id, variantId) >= KILL_THRESHOLDS.title
  );
  if (allSameVariant) return 'glorious';

  // Иначе просто «Охотник».
  return 'hunter';
}

// Множитель шанса дропа и золота по титулу.
function getTitleDropMultiplier(monsterId, variantId) {
  const title = getMonsterTitle(monsterId, variantId);
  switch (title) {
    case 'hunter':      return 1.5;
    case 'glorious':    return 2.0;
    case 'magnificent': return 3.0;
    default:            return 1.0;
  }
}

// Старая функция — для совместимости.
function hasMonsterTitle(monsterId, variantId) {
  return getMonsterTitle(monsterId, variantId) !== 'none';
}