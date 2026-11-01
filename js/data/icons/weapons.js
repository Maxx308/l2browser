// ========================================================
//  ДАННЫЕ: SVG-ИКОНКИ — СТАРТОВЫЕ ОРУЖИЯ
//  8 «убитых» версий оружия, которые выдаёт Старшина
//  в конце квеста «Первые шаги».
//
//  Вынесено из icons.js (разбивка большого файла).
//
//  Объект SVG_WEAPONS собирается в icons/index.js
//  в общий объект SVG.
// ========================================================

const SVG_WEAPONS = {

  // Ржавый меч — короткий, с трещинами и тёмными пятнами.
  starterSword: `<svg class="svg-icon" viewBox="0 0 24 24" style="width:36px;height:36px;">
    <path d="M4 20 L14 10 L19 5 L20 6 L15 11 L5 21 Z" fill="#8a8080" stroke="#5a4a3a" stroke-width="1.3"/>
    <path d="M4 20 L14 10 L15 11 L5 21 Z" fill="#5a4a3a" opacity="0.6"/>
    <path d="M6 18 L9 15 M10 14 L12 12" stroke="#3a2a1a" stroke-width="0.9" opacity="0.7"/>
    <path d="M14 10 L15 11 L16 10 L15 9 Z" fill="#3a2a1a" opacity="0.5"/>
    <circle cx="6" cy="19" r="0.8" fill="#3a2010" opacity="0.7"/>
    <circle cx="10" cy="15" r="0.7" fill="#3a2010" opacity="0.7"/>
    <path d="M5 21 L3 19 L4 18 L6 20 Z" fill="#5a3a1a" stroke="#3a2a10" stroke-width="1"/>
  </svg>`,

  // Старый топор — топорище кривое, лезвие тупое.
  starterAxe: `<svg class="svg-icon" viewBox="0 0 24 24" style="width:36px;height:36px;">
    <path d="M4 21 L10 15 L13 10 L14 6 L16 4 L18 6 L17 9 L15 12 L11 16 L5 22 Z" fill="#7a6a4a" stroke="#4a3a2a" stroke-width="1.3"/>
    <path d="M13 6 L17 4 L19 8 L15 11 L13 9 Z" fill="#7a7070" stroke="#4a4040" stroke-width="1.3"/>
    <path d="M12 9 L14 10" stroke="#3a2a1a" stroke-width="1" opacity="0.7"/>
    <path d="M6 19 L8 17 M9 16 L11 14" stroke="#3a2a1a" stroke-width="0.7" opacity="0.5"/>
    <path d="M14 5 L15 6 L15 8 L13 7 Z" fill="#3a2a1a" opacity="0.5"/>
    <circle cx="17" cy="7" r="0.7" fill="#3a2010" opacity="0.7"/>
  </svg>`,

  // Кривая дубина — изогнутая палка с трещинами.
  starterClub: `<svg class="svg-icon" viewBox="0 0 24 24" style="width:36px;height:36px;">
    <path d="M4 21 Q5 17 8 14 Q11 11 13 9 Q15 7 16 6 Q17 5 18 4 Q19 5 19 6 Q18 8 17 10 Q15 12 13 14 Q11 16 8 19 L6 21 Z" fill="#7a5a3a" stroke="#4a3a1a" stroke-width="1.3"/>
    <path d="M9 13 L11 12 M13 11 L15 9" stroke="#3a2a1a" stroke-width="0.7" opacity="0.6"/>
    <path d="M14 8 L15 8 L15 9 L14 9 Z M11 11 L12 11 L12 12 L11 12 Z" fill="#3a2a1a" opacity="0.7"/>
    <circle cx="16" cy="6" r="0.7" fill="#3a2010" opacity="0.7"/>
  </svg>`,

  // Тусклый кинжал — маленький, тёмный.
  starterDagger: `<svg class="svg-icon" viewBox="0 0 24 24" style="width:36px;height:36px;">
    <path d="M10 20 L17 13 L18 12 L19 12 L19 13 L18 14 L11 21 Z" fill="#6a5a5a" stroke="#3a2a2a" stroke-width="1.2"/>
    <path d="M8 20 L10 22 M9 19 L11 21" stroke="#4a2a1a" stroke-width="1.4"/>
    <path d="M13 15 L14 14" stroke="#2a1a1a" stroke-width="0.8" opacity="0.7"/>
    <circle cx="15" cy="14" r="0.6" fill="#3a2010" opacity="0.7"/>
  </svg>`,

  // Треснувшее копьё — с трещиной поперёк древка.
  starterSpear: `<svg class="svg-icon" viewBox="0 0 24 24" style="width:36px;height:36px;">
    <path d="M12 2 L12 21" stroke="#6a4a2a" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M12 2 L12 21" stroke="#8a6a4a" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M10 4 L12 1 L14 4 L12 5 Z" fill="#7a7070" stroke="#4a4040" stroke-width="1.2"/>
    <path d="M10 11 L14 11 M10 12 L14 12" stroke="#3a2a1a" stroke-width="0.8"/>
    <path d="M12 11 L12 12" stroke="#3a2a1a" stroke-width="0.9"/>
    <circle cx="11" cy="14" r="0.6" fill="#3a2010" opacity="0.7"/>
    <circle cx="13" cy="17" r="0.6" fill="#3a2010" opacity="0.7"/>
  </svg>`,

  // Кривой лук — асимметричный, тетива провисла.
  starterBow: `<svg class="svg-icon" viewBox="0 0 24 24" style="width:36px;height:36px;">
    <path d="M16 3 Q8 12 16 21" stroke="#6a4a2a" stroke-width="2" fill="none"/>
    <path d="M16 3 Q8 12 16 21" stroke="#8a6a4a" stroke-width="1" fill="none"/>
    <path d="M16 3 L14 12 L16 21" stroke="#d0c8b0" stroke-width="0.8" fill="none" opacity="0.8"/>
    <path d="M13 6 L11 8 M11 12 L9 14" stroke="#3a2a1a" stroke-width="0.6" opacity="0.6"/>
    <circle cx="15" cy="8" r="0.6" fill="#3a2010" opacity="0.7"/>
  </svg>`,

  // Хлипкий арбалет — ложе кривое, механизм разболтан.
  starterCrossbow: `<svg class="svg-icon" viewBox="0 0 24 24" style="width:36px;height:36px;">
    <path d="M4 16 Q2 11 8 8 Q11 7 13 9 Q15 11 13 14 Q11 17 8 17 Z" fill="#6a5a3a" stroke="#4a3a1a" stroke-width="1.2"/>
    <path d="M5 15 Q3 12 8 10" stroke="#3a2a1a" stroke-width="0.7" fill="none" opacity="0.6"/>
    <path d="M12 12 L20 12" stroke="#6a4a2a" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M12 12 L20 12" stroke="#8a6a4a" stroke-width="1" stroke-linecap="round"/>
    <path d="M16 10 L18 12 L16 14" stroke="#a09080" stroke-width="1" fill="none"/>
    <circle cx="9" cy="13" r="0.7" fill="#3a2010" opacity="0.7"/>
  </svg>`,

  // Сломанный посох — кристалл потух, трещина в навершии.
  starterStaff: `<svg class="svg-icon" viewBox="0 0 24 24" style="width:36px;height:36px;">
    <path d="M12 6 L12 22" stroke="#6a4a20" stroke-width="2" stroke-linecap="round"/>
    <path d="M12 6 L12 22" stroke="#8a6a3a" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M9 8 L12 5 L15 8 L12 10 Z" fill="#5a4a4a" stroke="#3a2a2a" stroke-width="1.3"/>
    <path d="M12 5 L12 10" stroke="#2a1a1a" stroke-width="0.7" opacity="0.7"/>
    <path d="M10 9 L11 8 M13 8 L14 9" stroke="#2a1a1a" stroke-width="0.6" opacity="0.6"/>
    <circle cx="12" cy="6" r="0.7" fill="#6a4a4a" opacity="0.7"/>
    <circle cx="11" cy="15" r="0.6" fill="#3a2010" opacity="0.7"/>
    <circle cx="13" cy="18" r="0.6" fill="#3a2010" opacity="0.7"/>
  </svg>`,
};