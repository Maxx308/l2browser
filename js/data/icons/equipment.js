// ========================================================
//  ДАННЫЕ: SVG-ИКОНКИ — ЭКИПИРОВКА
//  Броня (гамбезон, мантия), щиты, ювелирка,
//  крафтовое оружие (жезл, посох).
//
//  Вынесено из icons.js (разбивка большого файла).
//
//  Объект SVG_EQUIPMENT собирается в icons/index.js
//  в общий объект SVG.
// ========================================================

const SVG_EQUIPMENT = {

  // ========================================================
  //  БРОНЯ (СТАРАЯ SVG-ВЕРСИЯ)
  //  Используется как fallback, если PNG не загрузится.
  // ========================================================

  armorTop: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M7 4 L12 6 L17 4 L19 10 L17 20 L7 20 L5 10 Z" fill="#3a3a4a" stroke="#8a8a9a" stroke-width="1.3"/></svg>`,

  armorBottom: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M6 4 L12 5 L18 4 L18 20 L6 20 Z" fill="#3a3a4a" stroke="#8a8a9a" stroke-width="1.3"/></svg>`,

  gambeson: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M7 4 L12 6 L17 4 L19 10 L17 20 L7 20 L5 10 Z" fill="#a09060" stroke="#d0c080" stroke-width="1.3"/><path d="M7 10 L17 10 M7 14 L17 14" stroke="#7a6a40" stroke-width="0.8"/></svg>`,

  gambesonPants: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M6 4 L12 5 L18 4 L18 20 L6 20 Z" fill="#a09060" stroke="#d0c080" stroke-width="1.3"/><path d="M6 10 L18 10 M6 15 L18 15" stroke="#7a6a40" stroke-width="0.8"/></svg>`,

  gambesonHelm: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M5 12 Q5 4 12 4 Q19 4 19 12 L19 18 L17 20 L7 20 L5 18 Z" fill="#a09060" stroke="#d0c080" stroke-width="1.3"/><path d="M8 12 L16 12" stroke="#7a6a40" stroke-width="1"/></svg>`,

  gambesonBoots: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M7 4 L13 4 L13 14 L18 14 L18 20 L5 20 L5 12 L7 12 Z" fill="#a09060" stroke="#d0c080" stroke-width="1.3"/></svg>`,

  gambesonGloves: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M7 6 Q7 4 8 4 L10 4 L10 10 L12 4 L14 4 L14 10 L16 5 L18 5 L18 12 Q18 20 12 20 Q7 20 7 14 Z" fill="#a09060" stroke="#d0c080" stroke-width="1.3"/></svg>`,

  robeTop: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M7 4 L12 6 L17 4 L19 10 L17 20 L7 20 L5 10 Z" fill="#5060a0" stroke="#e0be7a" stroke-width="1.3"/><path d="M12 6 L12 20" stroke="#8098e0" stroke-width="0.8"/><circle cx="12" cy="13" r="1.5" fill="#e0be7a" opacity="0.8"/></svg>`,

  robeBottom: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M6 4 L12 5 L18 4 L18 20 L6 20 Z" fill="#5060a0" stroke="#e0be7a" stroke-width="1.3"/><path d="M6 10 L18 10 M6 15 L18 15" stroke="#8098e0" stroke-width="0.8"/></svg>`,

  robeHelm: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M5 12 Q5 4 12 4 Q19 4 19 12 L19 18 L17 20 L7 20 L5 18 Z" fill="#5060a0" stroke="#e0be7a" stroke-width="1.3"/><path d="M8 12 L16 12" stroke="#e0be7a" stroke-width="1"/><circle cx="12" cy="8" r="1.2" fill="#e0be7a"/></svg>`,

  robeBoots: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M7 4 L13 4 L13 14 L18 14 L18 20 L5 20 L5 12 L7 12 Z" fill="#5060a0" stroke="#e0be7a" stroke-width="1.3"/><path d="M7 12 L13 12" stroke="#8098e0" stroke-width="0.8"/></svg>`,

  robeGloves: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M7 6 Q7 4 8 4 L10 4 L10 10 L12 4 L14 4 L14 10 L16 5 L18 5 L18 12 Q18 20 12 20 Q7 20 7 14 Z" fill="#5060a0" stroke="#e0be7a" stroke-width="1.3"/></svg>`,

  // ========================================================
  //  ЩИТЫ
  // ========================================================

  shield: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 3 L20 6 L20 13 Q12 21 4 13 L4 6 Z" fill="#3a5a8a" stroke="#e0be7a" stroke-width="1.4"/></svg>`,

  wickerShield: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#8a6a3a" stroke="#c0a070" stroke-width="1.5"/><path d="M2 12 Q12 8 22 12 M2 12 Q12 16 22 12" stroke="#5a3a1a" stroke-width="1" fill="none"/><path d="M12 2 Q8 12 12 22 M12 2 Q16 12 12 22" stroke="#5a3a1a" stroke-width="1" fill="none"/><circle cx="12" cy="12" r="2" fill="#4a2a10"/></svg>`,

  // ========================================================
  //  ЮВЕЛИРКА (СТАРАЯ SVG-ВЕРСИЯ)
  // ========================================================

  ring: `<svg class="svg-icon" viewBox="0 0 24 24"><ellipse cx="12" cy="15" rx="7" ry="6" fill="none" stroke="#e0be7a" stroke-width="1.8"/><circle cx="12" cy="9" r="3" fill="#6a9ae0" stroke="#a0c8ff" stroke-width="1.2"/></svg>`,

  necklace: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M6 6 Q12 14 18 6" stroke="#e0be7a" stroke-width="1.3" fill="none"/><path d="M12 14 L12 18 L9 20 L12 22 L15 20 L12 18 Z" fill="#6a9ae0" stroke="#a0c8ff" stroke-width="1"/></svg>`,

  earring: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="2.5" fill="none" stroke="#e0be7a" stroke-width="1.4"/><path d="M12 10 L12 16 M10 16 L14 16 L12 20 Z" fill="#6a9ae0" stroke="#a0c8ff" stroke-width="1"/></svg>`,

  noviceRing: `<svg class="svg-icon" viewBox="0 0 24 24"><ellipse cx="12" cy="15" rx="7" ry="6" fill="none" stroke="#8a6a20" stroke-width="1.8"/><circle cx="12" cy="9" r="3.5" fill="#3a6a2a" stroke="#a0e060" stroke-width="1.4"/><circle cx="12" cy="9" r="1.5" fill="#c0f080" opacity="0.9"/></svg>`,

  noviceEarring: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="2.5" fill="none" stroke="#8a6a20" stroke-width="1.4"/><path d="M12 10 L12 15" stroke="#8a6a20" stroke-width="1.2"/><circle cx="12" cy="18" r="3" fill="#3a6a2a" stroke="#a0e060" stroke-width="1.3"/><circle cx="12" cy="18" r="1.2" fill="#c0f080" opacity="0.9"/></svg>`,

  noviceNecklace: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M6 6 Q12 14 18 6" stroke="#8a6a20" stroke-width="1.4" fill="none"/><path d="M12 14 L12 17" stroke="#8a6a20" stroke-width="1.2"/><circle cx="12" cy="20" r="3" fill="#3a6a2a" stroke="#a0e060" stroke-width="1.3"/><circle cx="12" cy="20" r="1.2" fill="#c0f080" opacity="0.9"/></svg>`,

  // ========================================================
  //  КРАФТОВОЕ МАГИЧЕСКОЕ ОРУЖИЕ (ЖЕЗЛ, ПОСОХ)
  // ========================================================

  wand: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M5 21 L14 12" stroke="#6a4a20" stroke-width="2" stroke-linecap="round"/><path d="M5 21 L14 12" stroke="#8a6a3a" stroke-width="1.5" stroke-linecap="round"/><circle cx="16" cy="10" r="4" fill="#5060a0" stroke="#a0c8ff" stroke-width="1.3"/><circle cx="16" cy="10" r="1.5" fill="#e0f0ff" opacity="0.9"/></svg>`,

  staff: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 2 L12 22" stroke="#6a4a20" stroke-width="2.2" stroke-linecap="round"/><path d="M12 2 L12 22" stroke="#8a6a3a" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="4" r="3.5" fill="#5060a0" stroke="#a0c8ff" stroke-width="1.3"/><circle cx="12" cy="4" r="1.5" fill="#e0f0ff" opacity="0.9"/><path d="M9 20 L12 18 L15 20 L12 22 Z" fill="#5060a0" stroke="#a0c8ff" stroke-width="1" opacity="0.7"/></svg>`,
};