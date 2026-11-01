// ========================================================
//  ДАННЫЕ: SVG-ИКОНКИ — РАСХОДНИКИ И ПЫЛЬ
//  Зелья, микстуры, свиток телепортации, пыль алхимии.
//
//  Вынесено из icons.js (разбивка большого файла).
//
//  Объект SVG_CONSUMABLES собирается в icons/index.js
//  в общий объект SVG.
// ========================================================

const SVG_CONSUMABLES = {

  // ========================================================
  //  ЗЕЛЬЯ И МИКСТУРЫ
  // ========================================================

  potionHeal: `<svg class="svg-icon" viewBox="0 0 24 24" style="width:36px;height:36px;"><rect x="10" y="3" width="4" height="3" fill="#6a4a20" stroke="#b8945a" stroke-width="1"/><path d="M8 6 L16 6 L16 12 Q20 14 20 18 Q20 21 12 21 Q4 21 4 18 Q4 14 8 12 Z" fill="#3a8a3a" stroke="#80c080" stroke-width="1.3"/><path d="M6 16 Q12 14 18 16" stroke="#a0ffa0" stroke-width="1" fill="none" opacity="0.7"/></svg>`,

  potionAtk: `<svg class="svg-icon" viewBox="0 0 24 24" style="width:36px;height:36px;"><rect x="10" y="3" width="4" height="3" fill="#6a4a20" stroke="#b8945a" stroke-width="1"/><path d="M8 6 L16 6 L16 12 Q20 14 20 18 Q20 21 12 21 Q4 21 4 18 Q4 14 8 12 Z" fill="#8a3a1a" stroke="#e07030" stroke-width="1.3"/><path d="M9 14 L12 18 L15 14 M12 18 L12 11" stroke="#ffcc60" stroke-width="1.5" fill="none"/></svg>`,

  potionAtk2: `<svg class="svg-icon" viewBox="0 0 24 24" style="width:36px;height:36px;"><rect x="10" y="3" width="4" height="3" fill="#6a4a20" stroke="#b8945a" stroke-width="1"/><path d="M8 6 L16 6 L16 12 Q20 14 20 18 Q20 21 12 21 Q4 21 4 18 Q4 14 8 12 Z" fill="#8a1a0a" stroke="#ff6020" stroke-width="1.3"/><path d="M9 14 L12 18 L15 14 M12 18 L12 11" stroke="#ffcc60" stroke-width="1.6" fill="none"/><path d="M15 8 L17 6 M17 8 L15 6" stroke="#ffd080" stroke-width="1" opacity="0.9"/><circle cx="19" cy="6" r="1.5" fill="#ffd080" opacity="0.7"/></svg>`,

  potionLuck: `<svg class="svg-icon" viewBox="0 0 24 24" style="width:36px;height:36px;"><rect x="10" y="3" width="4" height="3" fill="#6a4a20" stroke="#b8945a" stroke-width="1"/><path d="M8 6 L16 6 L16 12 Q20 14 20 18 Q20 21 12 21 Q4 21 4 18 Q4 14 8 12 Z" fill="#3a8a3a" stroke="#80e080" stroke-width="1.3"/><path d="M12 10 Q13.5 11.5 12 13 Q10.5 11.5 12 10 Z M9 13 Q10.5 14.5 9 16 Q7.5 14.5 9 13 Z M15 13 Q16.5 14.5 15 16 Q13.5 14.5 15 13 Z" fill="#c0ff80" opacity="0.9"/><circle cx="12" cy="13.5" r="1" fill="#e0ffc0"/></svg>`,

  potionDef: `<svg class="svg-icon" viewBox="0 0 24 24" style="width:36px;height:36px;"><rect x="10" y="3" width="4" height="3" fill="#6a4a20" stroke="#b8945a" stroke-width="1"/><path d="M8 6 L16 6 L16 12 Q20 14 20 18 Q20 21 12 21 Q4 21 4 18 Q4 14 8 12 Z" fill="#3a5a8a" stroke="#a0c8ff" stroke-width="1.3"/><path d="M12 10 L16 12 L16 15 Q12 19 8 15 L8 12 Z" fill="#a0c8ff" stroke="#e0f0ff" stroke-width="1" opacity="0.9"/><path d="M12 12 L12 17" stroke="#e0f0ff" stroke-width="0.8" opacity="0.7"/></svg>`,

  // ========================================================
  //  СВИТОК ТЕЛЕПОРТАЦИИ
  // ========================================================

  scrollTeleport: `<svg class="svg-icon" viewBox="0 0 24 24" style="width:36px;height:36px;"><path d="M4 4 L18 4 L18 20 L4 20 Z" fill="#d0b070" stroke="#8a6a20" stroke-width="1.3"/><path d="M4 4 Q6 4 6 6 L6 18 Q6 20 4 20 Z" fill="#a08040" stroke="#8a6a20" stroke-width="1"/><path d="M18 4 Q16 4 16 6 L16 18 Q16 20 18 20 Z" fill="#a08040" stroke="#8a6a20" stroke-width="1"/><circle cx="11" cy="12" r="3.5" fill="#6a9ae0" stroke="#a0c8ff" stroke-width="1" opacity="0.9"/><path d="M11 8 L11 6 M11 16 L11 18 M7 12 L5 12 M15 12 L17 12" stroke="#6a9ae0" stroke-width="1" opacity="0.7"/></svg>`,

  // ========================================================
  //  АЛХИМИЯ: ПЫЛЬ (v0.10)
  //  5 цветных «кристаллов» — по одному на редкость.
  // ========================================================

  dustGreen: `<svg class="svg-icon" viewBox="0 0 24 24">
    <defs>
      <radialGradient id="dustGreenG" cx="40%" cy="35%">
        <stop offset="0%" stop-color="#c0ffc0"/>
        <stop offset="100%" stop-color="#3a8a3a"/>
      </radialGradient>
    </defs>
    <path d="M12 2 L18 8 L16 18 L8 18 L6 8 Z" fill="url(#dustGreenG)" stroke="#80e080" stroke-width="1.2"/>
    <path d="M12 2 L12 10 L8 18" stroke="#e0ffe0" stroke-width="0.7" fill="none" opacity="0.6"/>
    <path d="M12 2 L12 10 L16 18" stroke="#e0ffe0" stroke-width="0.7" fill="none" opacity="0.6"/>
    <circle cx="9" cy="8" r="0.8" fill="#ffffff" opacity="0.9"/>
    <circle cx="14" cy="12" r="0.6" fill="#ffffff" opacity="0.7"/>
  </svg>`,

  dustBlue: `<svg class="svg-icon" viewBox="0 0 24 24">
    <defs>
      <radialGradient id="dustBlueG" cx="40%" cy="35%">
        <stop offset="0%" stop-color="#c0e0ff"/>
        <stop offset="100%" stop-color="#2a4a9a"/>
      </radialGradient>
    </defs>
    <path d="M12 2 L18 8 L16 18 L8 18 L6 8 Z" fill="url(#dustBlueG)" stroke="#6a9ae0" stroke-width="1.2"/>
    <path d="M12 2 L12 10 L8 18" stroke="#e0f0ff" stroke-width="0.7" fill="none" opacity="0.6"/>
    <path d="M12 2 L12 10 L16 18" stroke="#e0f0ff" stroke-width="0.7" fill="none" opacity="0.6"/>
    <circle cx="9" cy="8" r="0.8" fill="#ffffff" opacity="0.9"/>
    <circle cx="14" cy="12" r="0.6" fill="#ffffff" opacity="0.7"/>
  </svg>`,

  dustPurple: `<svg class="svg-icon" viewBox="0 0 24 24">
    <defs>
      <radialGradient id="dustPurpleG" cx="40%" cy="35%">
        <stop offset="0%" stop-color="#e0c0ff"/>
        <stop offset="100%" stop-color="#6a2a9a"/>
      </radialGradient>
    </defs>
    <path d="M12 2 L18 8 L16 18 L8 18 L6 8 Z" fill="url(#dustPurpleG)" stroke="#c080ff" stroke-width="1.2"/>
    <path d="M12 2 L12 10 L8 18" stroke="#f0e0ff" stroke-width="0.7" fill="none" opacity="0.6"/>
    <path d="M12 2 L12 10 L16 18" stroke="#f0e0ff" stroke-width="0.7" fill="none" opacity="0.6"/>
    <circle cx="9" cy="8" r="0.8" fill="#ffffff" opacity="0.9"/>
    <circle cx="14" cy="12" r="0.6" fill="#ffffff" opacity="0.7"/>
  </svg>`,

  dustYellow: `<svg class="svg-icon" viewBox="0 0 24 24">
    <defs>
      <radialGradient id="dustYellowG" cx="40%" cy="35%">
        <stop offset="0%" stop-color="#fff0a0"/>
        <stop offset="100%" stop-color="#a08020"/>
      </radialGradient>
    </defs>
    <path d="M12 2 L18 8 L16 18 L8 18 L6 8 Z" fill="url(#dustYellowG)" stroke="#ffd040" stroke-width="1.2"/>
    <path d="M12 2 L12 10 L8 18" stroke="#fff8d0" stroke-width="0.7" fill="none" opacity="0.6"/>
    <path d="M12 2 L12 10 L16 18" stroke="#fff8d0" stroke-width="0.7" fill="none" opacity="0.6"/>
    <circle cx="9" cy="8" r="0.8" fill="#ffffff" opacity="0.9"/>
    <circle cx="14" cy="12" r="0.6" fill="#ffffff" opacity="0.7"/>
  </svg>`,

  dustRed: `<svg class="svg-icon" viewBox="0 0 24 24">
    <defs>
      <radialGradient id="dustRedG" cx="40%" cy="35%">
        <stop offset="0%" stop-color="#ffb0b0"/>
        <stop offset="100%" stop-color="#8a1010"/>
      </radialGradient>
    </defs>
    <path d="M12 2 L18 8 L16 18 L8 18 L6 8 Z" fill="url(#dustRedG)" stroke="#ff5050" stroke-width="1.2"/>
    <path d="M12 2 L12 10 L8 18" stroke="#ffd0d0" stroke-width="0.7" fill="none" opacity="0.6"/>
    <path d="M12 2 L12 10 L16 18" stroke="#ffd0d0" stroke-width="0.7" fill="none" opacity="0.6"/>
    <circle cx="9" cy="8" r="0.8" fill="#ffffff" opacity="0.9"/>
    <circle cx="14" cy="12" r="0.6" fill="#ffffff" opacity="0.7"/>
  </svg>`,
};

// ---- v0.20: зелья и микстуры — PNG-картинки (img/potions/) вместо SVG ----
(function () {
  const img = (n) => `<img class="svg-icon potion-png" src="img/potions/${n}.png" alt="" style="width:36px;height:36px;object-fit:contain;">`;
  Object.assign(SVG_CONSUMABLES, {
    potionHeal:  img('heal'),
    potionHeal2: img('heal2'),
    potionAtk:   img('atk'),
    potionAtk2:  img('atk2'),
    potionLuck:  img('luck'),
    potionDef:   img('def'),
  });
  // пыль алхимии — img/dust/ (заполняет ячейку, как картинки материалов)
  const dust = (n) => `<img class="svg-icon dust-png" src="img/dust/${n}.png" alt="" style="width:100%;height:100%;object-fit:contain;">`;
  Object.assign(SVG_CONSUMABLES, {
    dustGreen: dust('green'), dustBlue: dust('blue'), dustPurple: dust('purple'), dustYellow: dust('yellow'), dustRed: dust('red'),
  });
})();
