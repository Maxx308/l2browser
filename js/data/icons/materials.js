// ========================================================
//  ДАННЫЕ: SVG-ИКОНКИ — МАТЕРИАЛЫ И РЕСУРСЫ
//  Золото, руда, кости, кожа, ткань, уголь,
//  материалы Копи (медь, олово, хитин, каменные пластины).
//
//  Вынесено из icons.js (разбивка большого файла).
//
//  Объект SVG_MATERIALS собирается в icons/index.js
//  в общий объект SVG.
// ========================================================

const SVG_MATERIALS = {
  gold: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#8a6a20" stroke="#e0be7a" stroke-width="1.5"/><text x="12" y="16" text-anchor="middle" font-size="11" fill="#e0be7a" font-family="serif" font-weight="bold">О</text></svg>`,

  branch: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M6 20 Q10 12 14 6 M14 6 L18 4 M14 6 L16 10 M12 10 L8 8" stroke="#6a5a3a" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`,

  ironOre: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M5 14 L9 6 L15 6 L19 14 L12 20 Z" fill="#5a5a6a" stroke="#9a9aaa" stroke-width="1.3"/><path d="M9 6 L12 10 L15 6" stroke="#9a9aaa" stroke-width="1" fill="none"/></svg>`,

  leather: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M4 8 Q12 4 20 8 L20 16 Q12 20 4 16 Z" fill="#6a4a2a" stroke="#b8945a" stroke-width="1.2"/></svg>`,

  pelt: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M5 6 Q12 3 19 6 L19 18 Q12 21 5 18 Z" fill="#8a6a4a" stroke="#d0a870" stroke-width="1.2"/><circle cx="9" cy="11" r="1" fill="#3a2a1a"/><circle cx="15" cy="11" r="1" fill="#3a2a1a"/></svg>`,

  stick: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M5 21 L19 4 L20 4 L20 5 L6 22 Z" fill="#8a6a3a" stroke="#d0a870" stroke-width="1.2"/><path d="M7 19 L9 17 M11 15 L13 13 M15 11 L17 9" stroke="#5a3a1a" stroke-width="0.8" opacity="0.6"/></svg>`,

  club: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M5 21 L11 15 Q10 12 13 10 Q16 8 19 5 Q20 6 19 9 Q17 12 15 14 Q12 16 11 15 L5 21 Z" fill="#7a5a2a" stroke="#c0a070" stroke-width="1.3"/><ellipse cx="15" cy="9" rx="4" ry="4" fill="#8a6a3a" stroke="#c0a070" stroke-width="1.3"/></svg>`,

  fur: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M6 14 Q4 8 10 6 Q16 4 18 10 Q20 16 14 18 Q8 20 6 14 Z" fill="#b06a3a" stroke="#e0a060" stroke-width="1.2"/></svg>`,

  frogSkin: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M4 10 Q12 4 20 10 L20 18 Q12 22 4 18 Z" fill="#3a6a2a" stroke="#80c060" stroke-width="1.3"/><circle cx="8" cy="13" r="1" fill="#0a2a05"/><circle cx="16" cy="14" r="1" fill="#0a2a05"/><circle cx="12" cy="16" r="1" fill="#0a2a05"/></svg>`,

  bone: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M5 6 Q3 8 5 10 L15 18 Q17 20 19 18 Q21 16 19 14 L9 6 Q7 4 5 6 Z" fill="#d0c8b0" stroke="#8a8070" stroke-width="1.2"/><circle cx="5" cy="7" r="2" fill="#d0c8b0" stroke="#8a8070" stroke-width="1"/><circle cx="19" cy="17" r="2" fill="#d0c8b0" stroke="#8a8070" stroke-width="1"/></svg>`,

  meat: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M6 12 Q4 6 12 6 Q20 6 18 12 Q20 18 12 18 Q4 18 6 12 Z" fill="#a02030" stroke="#d06070" stroke-width="1.2"/><rect x="2" y="11" width="4" height="2" fill="#d0c8b0" stroke="#8a8070" stroke-width="1"/></svg>`,

  fang: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M6 4 L10 20 L13 12 Z" fill="#e0d8c0" stroke="#8a8070" stroke-width="1.2"/><path d="M18 4 L14 20 L11 12 Z" fill="#e0d8c0" stroke="#8a8070" stroke-width="1.2"/></svg>`,

  cookedMeat: `<svg class="svg-icon" viewBox="0 0 24 24" style="width:36px;height:36px;"><path d="M6 12 Q4 6 12 6 Q20 6 18 12 Q20 18 12 18 Q4 18 6 12 Z" fill="#8a3a20" stroke="#d07040" stroke-width="1.3"/><path d="M7 10 Q12 8 17 10 M7 13 Q12 11 17 13 M8 16 Q12 14 16 16" stroke="#c06030" stroke-width="0.8" fill="none" opacity="0.7"/><rect x="2" y="11" width="4" height="2" fill="#d0c8b0" stroke="#8a8070" stroke-width="1"/></svg>`,

  thread: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M4 20 Q8 16 12 12 Q16 8 20 4" stroke="#d0c8b0" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="4" fill="none" stroke="#e0d8c0" stroke-width="1.3"/><path d="M8 12 Q12 8 16 12 Q12 16 8 12" fill="none" stroke="#a09080" stroke-width="1"/></svg>`,

  fabric: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" fill="#8a7050" stroke="#d0b070" stroke-width="1.3"/><path d="M4 9 L20 9 M4 12 L20 12 M4 15 L20 15" stroke="#a08860" stroke-width="0.8"/><path d="M8 6 L8 18 M12 6 L12 18 M16 6 L16 18" stroke="#a08860" stroke-width="0.8"/></svg>`,

  glue: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M8 4 L16 4 L16 8 L18 10 L18 20 L6 20 L6 10 L8 8 Z" fill="#6a4a20" stroke="#d0a860" stroke-width="1.3"/><ellipse cx="12" cy="14" rx="4" ry="3" fill="#a08040" opacity="0.7"/></svg>`,

  // ========================================================
  //  МАТЕРИАЛЫ КОПИ (v0.12)
  // ========================================================

  // Медь — рыже-оранжевый кусок руды.
  copper: `<svg class="svg-icon" viewBox="0 0 24 24">
    <path d="M6 16 L8 9 L14 7 L19 11 L17 18 L10 19 Z" fill="#b87333" stroke="#e8a060" stroke-width="1.3"/>
    <path d="M8 9 L12 12 L14 7" stroke="#e8a060" stroke-width="0.8" fill="none" opacity="0.7"/>
    <path d="M12 12 L10 19 M12 12 L17 18" stroke="#e8a060" stroke-width="0.8" fill="none" opacity="0.7"/>
    <circle cx="10" cy="12" r="1" fill="#f0c080" opacity="0.6"/>
    <circle cx="14" cy="15" r="0.8" fill="#f0c080" opacity="0.5"/>
  </svg>`,

  // Олово — серый блестящий слиток.
  tin: `<svg class="svg-icon" viewBox="0 0 24 24">
    <path d="M5 14 L9 7 L15 7 L19 14 L12 19 Z" fill="#9a9ab0" stroke="#d0d0e0" stroke-width="1.3"/>
    <path d="M9 7 L12 11 L15 7" stroke="#d0d0e0" stroke-width="0.8" fill="none" opacity="0.8"/>
    <path d="M12 11 L12 19" stroke="#d0d0e0" stroke-width="0.6" fill="none" opacity="0.6"/>
    <circle cx="10" cy="10" r="0.8" fill="#ffffff" opacity="0.7"/>
    <circle cx="14" cy="12" r="0.7" fill="#ffffff" opacity="0.6"/>
  </svg>`,

  // Хитин — коричневый панцирный сегмент с шипами.
  chitin: `<svg class="svg-icon" viewBox="0 0 24 24">
    <path d="M12 3 Q18 5 19 11 Q19 17 12 20 Q5 17 5 11 Q6 5 12 3 Z" fill="#5a3a1a" stroke="#a07040" stroke-width="1.3"/>
    <path d="M12 5 Q16 7 17 12 Q17 16 12 18 Q7 16 7 12 Q8 7 12 5 Z" fill="#7a4a20" stroke="#a07040" stroke-width="0.8" opacity="0.7"/>
    <path d="M12 5 L12 18" stroke="#3a2010" stroke-width="0.8" opacity="0.6"/>
    <path d="M7 9 L17 9 M7 14 L17 14" stroke="#3a2010" stroke-width="0.7" opacity="0.5"/>
    <path d="M9 3 L10 5 M15 3 L14 5 M9 20 L10 18 M15 20 L14 18" stroke="#a07040" stroke-width="0.9" stroke-linecap="round"/>
  </svg>`,

  // Каменные пластины — серая прямоугольная плитка.
  stonePlates: `<svg class="svg-icon" viewBox="0 0 24 24">
    <rect x="4" y="6" width="16" height="12" rx="1" fill="#5a5a68" stroke="#a0a0b0" stroke-width="1.3"/>
    <rect x="6" y="8" width="12" height="8" rx="0.5" fill="#4a4a58" stroke="#8a8a98" stroke-width="0.7" opacity="0.7"/>
    <path d="M8 10 L10 12 L8 14 M12 10 L14 12 L12 14 M16 10 L18 12 L16 14" stroke="#a0a0b0" stroke-width="0.6" fill="none" opacity="0.7"/>
    <circle cx="7" cy="7" r="0.4" fill="#c0c0d0" opacity="0.6"/>
    <circle cx="17" cy="17" r="0.4" fill="#c0c0d0" opacity="0.6"/>
  </svg>`,
};