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
};

// ========================================================
//  SVG-заглушки портретов NPC
// ========================================================
const NPC_SVG = {
  elder: `<svg viewBox="0 0 100 100" style="width:100%;height:100%;">
    <defs>
      <radialGradient id="elderBg" cx="50%" cy="40%">
        <stop offset="0%" stop-color="#4a3a2a"/>
        <stop offset="100%" stop-color="#1a1208"/>
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="100" height="100" fill="url(#elderBg)"/>
    <path d="M22 100 Q22 70 50 65 Q78 70 78 100 Z" fill="#2a1a10" stroke="#8a6a4a" stroke-width="2"/>
    <path d="M38 60 Q50 82 62 60 Q56 68 50 68 Q44 68 38 60 Z" fill="#c8c0b0" stroke="#8a8070" stroke-width="1.5"/>
    <ellipse cx="50" cy="45" rx="14" ry="16" fill="#c8a880" stroke="#8a6a4a" stroke-width="1.5"/>
    <path d="M36 38 Q38 28 50 28 Q62 28 64 38 Q60 32 50 32 Q40 32 36 38 Z" fill="#d0c8b0" stroke="#8a8070" stroke-width="1.2"/>
    <path d="M36 40 Q34 44 35 50 M64 40 Q66 44 65 50" stroke="#d0c8b0" stroke-width="1.5" fill="none"/>
    <ellipse cx="44" cy="45" rx="1.5" ry="1.8" fill="#0a0a0a"/>
    <ellipse cx="56" cy="45" rx="1.5" ry="1.8" fill="#0a0a0a"/>
    <path d="M40 55 Q50 60 60 55" stroke="#d0c8b0" stroke-width="2" fill="none"/>
    <path d="M80 30 L78 100" stroke="#5a3a1a" stroke-width="3" stroke-linecap="round"/>
    <circle cx="80" cy="26" r="6" fill="#6a9ae0" stroke="#a0c8ff" stroke-width="1.5"/>
    <circle cx="80" cy="26" r="2.5" fill="#e0f0ff" opacity="0.9"/>
  </svg>`,

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