// Пробный VIP общий для аккаунта. Выбранный образ сохраняется вместе с героем.
const VIP_DAY = 24 * 60 * 60 * 1000;
const VIP_MOSCOW_OFFSET = 3 * 60 * 60 * 1000;
const VIP_PERIOD_DAYS = 30;
const VIP_VISIT_GOAL = 15;
const VIP_TRIAL_KEY = 'l2browser_vip_trial_';
const VIP_GUEST_ATTENDANCE_KEY = 'l2browser_vip_attendance_guest';
const VIP_SEAL_KEY = 'l2browser_vip_seal_';
const VIP_FRAMES = { bronze: 'Бронза', silver: 'Серебро', amethyst: 'Аметист' };
const VIP_TITLES = {
  hunter: ['Охотник', 'Охотница'],
  glorious: ['Прославленный охотник', 'Прославленная охотница'],
  magnificent: ['Великолепный охотник', 'Великолепная охотница'],
};
const VIP_VICTORY_STYLES = {
  'warrior-dawn': ['#ffb64f', '#fff0bd', 'spark'],
  'warrior-moon': ['#729adc', '#d2e7ff', 'spark'],
  'warrior-crimson': ['#f47f39', '#ffe4ac', 'spark'],
  'mage-astrarium': ['#708cfc', '#f7d186', 'rune'],
  'mage-rose': ['#d66da4', '#f8c7e4', 'petal'],
  'dwarf-warrior-storm': ['#74bcca', '#c8f4ff', 'spark'],
  'dwarf-warrior-vein': ['#94a9bb', '#f2dcc2', 'spark'],
  'steelwall-forge': ['#ef8b50', '#fff0b0', 'spark'],
  'steelwall-sapphire': ['#3d8cff', '#b4e8ff', 'spark'],
  'dwarf-mage-rune': ['#eb9157', '#ffcf90', 'rune'],
  'dwarf-mage-crystal': ['#4ec7c0', '#ccfafa', 'rune'],
  'orc-warrior-ashes': ['#b95636', '#f7b478', 'spark'],
  'orc-warrior-wind': ['#72b0a7', '#c8e8d2', 'spark'],
  'orc-mage-storm': ['#8b6aff', '#d5c7ff', 'rune'],
  'orc-mage-spirit': ['#dba04e', '#e6efb9', 'petal'],
  'elf-warrior-grove': ['#c5a14f', '#e0edaf', 'petal'],
  'elf-warrior-river': ['#6bafdb', '#e1ecff', 'petal'],
  'elf-mage-frost': ['#5bb6ed', '#cef6ff', 'rune'],
  'elf-mage-fern': ['#88bb4c', '#d2f3a5', 'petal'],
  'drow-warrior-gate': ['#d16b40', '#ffc49a', 'spark'],
  'drow-warrior-dusk': ['#8962c5', '#cab3f4', 'spark'],
  'drow-mage-seal': ['#a064e5', '#e8b8ff', 'rune'],
  'drow-mage-sphere': ['#8d5be9', '#dcc0ff', 'rune'],
};
const vipCalendarDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const VIP_LOOKS = [
  { id: 'warrior-dawn', raceId: 'human', classId: 'warrior', name: 'Клятва рассвета', art: 'img/vip/human-warrior-dawn.webp', motion: 'img/vip/human-warrior-dawn-motion.webp' },
  { id: 'warrior-moon', raceId: 'human', classId: 'warrior', name: 'Ночной дозор', art: 'img/vip/human-warrior-moon.webp', motion: 'img/vip/human-warrior-moon-motion.webp' },
  { id: 'warrior-crimson', raceId: 'human', classId: 'warrior', name: 'Багряная сталь', art: 'img/vip/human-warrior-crimson.webp', motion: 'img/vip/human-warrior-crimson-motion.webp' },
  { id: 'mage-astrarium', raceId: 'human', classId: 'mage', name: 'Хранитель астролябии', art: 'img/vip/human-mage-astrarium.webp', motion: 'img/vip/human-mage-astrarium-motion.webp' },
  { id: 'mage-rose', raceId: 'human', classId: 'mage', name: 'Роза сумерек', art: 'img/vip/human-mage-rose.webp', motion: 'img/vip/human-mage-rose-motion.webp' },
  { id: 'dwarf-warrior-storm', raceId: 'dwarf', classId: 'warrior', name: 'Гром перевала', art: 'img/vip/dwarf-warrior-storm.webp', motion: 'img/vip/dwarf-warrior-storm-motion.webp' },
  { id: 'dwarf-warrior-vein', raceId: 'dwarf', classId: 'warrior', name: 'Серебряная жила', art: 'img/vip/dwarf-warrior-vein.webp', motion: 'img/vip/dwarf-warrior-vein-motion.webp' },
  { id: 'steelwall-forge', raceId: 'dwarf', classId: 'warrior', subclassId: 'dwarf_steelwall', name: 'Щит горна', art: 'img/vip/dwarf-steelwall-forge.webp', motion: 'img/vip/dwarf-steelwall-forge-motion.webp' },
  { id: 'steelwall-sapphire', raceId: 'dwarf', classId: 'warrior', subclassId: 'dwarf_steelwall', name: 'Сапфировый оплот', art: 'img/vip/dwarf-steelwall-sapphire.webp', motion: 'img/vip/dwarf-steelwall-sapphire-motion.webp' },
  { id: 'dwarf-mage-rune', raceId: 'dwarf', classId: 'mage', name: 'Каменное слово', art: 'img/vip/dwarf-mage-rune.webp', motion: 'img/vip/dwarf-mage-rune-motion.webp' },
  { id: 'dwarf-mage-crystal', raceId: 'dwarf', classId: 'mage', name: 'Песня кристаллов', art: 'img/vip/dwarf-mage-crystal.webp', motion: 'img/vip/dwarf-mage-crystal-motion.webp' },
  { id: 'orc-warrior-ashes', raceId: 'orc', classId: 'warrior', name: 'Пепельный вождь', art: 'img/vip/orc-warrior-ashes.webp', motion: 'img/vip/orc-warrior-ashes-motion.webp' },
  { id: 'orc-warrior-wind', raceId: 'orc', classId: 'warrior', name: 'Клятва ветра', art: 'img/vip/orc-warrior-wind.webp', motion: 'img/vip/orc-warrior-wind-motion.webp' },
  { id: 'orc-mage-storm', raceId: 'orc', classId: 'mage', name: 'Грозовой пророк', art: 'img/vip/orc-mage-storm.webp', motion: 'img/vip/orc-mage-storm-motion.webp' },
  { id: 'orc-mage-spirit', raceId: 'orc', classId: 'mage', name: 'Проводница духов', art: 'img/vip/orc-mage-spirit.webp', motion: 'img/vip/orc-mage-spirit-motion.webp' },
  { id: 'elf-warrior-grove', raceId: 'elf', classId: 'warrior', name: 'Страж древней рощи', art: 'img/vip/elf-warrior-grove.webp', motion: 'img/vip/elf-warrior-grove-motion.webp' },
  { id: 'elf-warrior-river', raceId: 'elf', classId: 'warrior', name: 'Серебро лунной реки', art: 'img/vip/elf-warrior-river.webp', motion: 'img/vip/elf-warrior-river-motion.webp' },
  { id: 'elf-mage-frost', raceId: 'elf', classId: 'mage', name: 'Хранитель перевала', art: 'img/vip/elf-mage-frost.webp', motion: 'img/vip/elf-mage-frost-motion.webp' },
  { id: 'elf-mage-fern', raceId: 'elf', classId: 'mage', name: 'Шёпот папоротника', art: 'img/vip/elf-mage-fern.webp', motion: 'img/vip/elf-mage-fern-motion.webp' },
  { id: 'drow-warrior-gate', raceId: 'drow', classId: 'warrior', name: 'Страж обсидиановых врат', art: 'img/vip/drow-warrior-gate.webp', motion: 'img/vip/drow-warrior-gate-motion.webp' },
  { id: 'drow-warrior-dusk', raceId: 'drow', classId: 'warrior', name: 'Лезвие полумрака', art: 'img/vip/drow-warrior-dusk.webp', motion: 'img/vip/drow-warrior-dusk-motion.webp' },
  { id: 'drow-mage-seal', raceId: 'drow', classId: 'mage', name: 'Аметистовая печать', art: 'img/vip/drow-mage-seal.webp', motion: 'img/vip/drow-mage-seal-motion.webp' },
  { id: 'drow-mage-sphere', raceId: 'drow', classId: 'mage', name: 'Сердце сумерек', art: 'img/vip/drow-mage-sphere.webp', motion: 'img/vip/drow-mage-sphere-motion.webp' },
];
let vipOwner = null;
let vipUntil = 0;
let vipAttendance = null;
let vipGuestAttendance = null;
let vipSeal = null;
let vipPickingSeal = false;
let vipSealWrite = null;
let vipSealReadVersion = 0;
let vipRequest = null;
let vipSyncedDay = null;
let vipPendingVisitDay = null;
let vipLegacyServer = false;
let vipRetryAfter = 0;
let vipRetryTimer = null;
let vipTimer = null;
const vipReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function vipDaysLeft() {
  return Math.max(0, Math.ceil((vipUntil - Date.now()) / VIP_DAY));
}

function vipTimeLabel(days) {
  const tens = days % 100;
  const ones = days % 10;
  const unit = tens >= 11 && tens <= 14 ? 'дней' : ones === 1 ? 'день' : ones >= 2 && ones <= 4 ? 'дня' : 'дней';
  return days ? `Осталось ${days} ${unit}` : 'Срок VIP истёк';
}

function vipSaveExpiry(owner, expiry) {
  try { localStorage.setItem(VIP_TRIAL_KEY + owner, String(expiry)); } catch {}
}

function vipMoscowDay(time = Date.now()) {
  return Math.floor((time + VIP_MOSCOW_OFFSET) / VIP_DAY);
}

function vipSealCanPlace() {
  return vipSeal?.earned && !vipSeal.placement && Number.isInteger(state.activeSlotIndex);
}

function vipSealMatches(entry) {
  const seal = vipSeal?.placement;
  return !!seal && seal.slot === state.activeSlotIndex && seal.entry === entry.id && seal.at === entry.at;
}

function vipReadCachedSeal(owner) {
  try { return JSON.parse(localStorage.getItem(VIP_SEAL_KEY + owner)); } catch { return null; }
}

function vipUpdateSeal(data) {
  if (typeof data?.earned !== 'boolean') return;
  const placement = data.placement || null;
  if (vipSeal?.placement && !placement) return; // Более ранний ответ не снимает уже поставленную печать.
  if (vipSeal?.earned === data.earned && vipSeal?.placement?.slot === placement?.slot &&
      vipSeal?.placement?.entry === placement?.entry && vipSeal?.placement?.at === placement?.at) return;
  vipSeal = { earned: data.earned, placement };
  if (placement) vipPickingSeal = false;
  try { localStorage.setItem(VIP_SEAL_KEY + vipOwner, JSON.stringify(vipSeal)); } catch {}
  if (vipDialog.open) vipRenderDialog();
  if (typeof isChronicleOpen === 'function' && isChronicleOpen()) renderChronicle();
}

async function vipRefreshSeal() {
  const owner = vipOwner;
  if (!owner || !cloudIsReady() || owner !== slotOwnerId()) return;
  const version = ++vipSealReadVersion;
  try {
    const { data, error } = await supabaseClient.rpc('sync_vip_seal');
    if (!error && version === vipSealReadVersion && owner === vipOwner && owner === slotOwnerId()) vipUpdateSeal(data);
  } catch {}
}

async function vipPlaceSeal(entryId) {
  if (!vipPickingSeal || !vipSealCanPlace() || vipSealWrite || vipOwner !== slotOwnerId()) return;
  const entry = state.player.chronicle?.entries.find(row => row.id === entryId);
  if (!entry || !Number.isSafeInteger(entry.at) || entry.at < 1) return;
  const placement = { slot: state.activeSlotIndex, entry: entry.id, at: entry.at };
  const owner = vipOwner;
  const request = {};
  vipSealWrite = request;
  renderChronicle();
  try {
    let data = { earned: true, placement };
    if (owner !== 'guest') {
      const result = await supabaseClient.rpc('sync_vip_seal', {
        slot_index: placement.slot, entry_id: placement.entry, entry_time: placement.at
      });
      if (result.error) throw result.error;
      data = result.data;
    } else {
      const saved = vipReadCachedSeal('guest');
      if (saved?.placement) data = saved;
    }
    if (vipSealWrite !== request || slotOwnerId() !== owner) return;
    vipUpdateSeal(data);
    const saved = vipSeal?.placement;
    if (!saved) { showToast('✦', 'Печать пока недоступна'); return; }
    showToast('✦', saved.slot === placement.slot && saved.entry === placement.entry && saved.at === placement.at
      ? 'Печать поставлена' : 'Печать уже стоит на другой записи');
  } catch {
    if (vipSealWrite === request) showToast('✦', 'Не удалось сохранить печать. Попробуй ещё раз.');
  } finally {
    if (vipSealWrite === request) {
      vipSealWrite = null;
      if (isChronicleOpen()) renderChronicle();
    }
  }
}

function vipGuestCheckIn(checkIn) {
  const now = Date.now();
  const today = vipMoscowDay(now);
  let guest = vipGuestAttendance;
  try {
    const saved = JSON.parse(localStorage.getItem(VIP_GUEST_ATTENDANCE_KEY));
    if (saved && Number.isSafeInteger(saved.started) && Number.isSafeInteger(saved.expiry) &&
        Number.isInteger(saved.days) && saved.days >= 0 && saved.days <= VIP_VISIT_GOAL &&
        (saved.lastVisit === null || Number.isInteger(saved.lastVisit))) guest = saved;
  } catch {}
  const isNew = !guest;
  if (isNew) {
    const expiry = vipUntil || now + VIP_PERIOD_DAYS * VIP_DAY;
    guest = { started: expiry - VIP_PERIOD_DAYS * VIP_DAY, expiry, days: 0, lastVisit: null };
  }
  const firstDay = vipMoscowDay(guest.started);
  const periodStart = firstDay + Math.floor(Math.max(0, today - firstDay) / VIP_PERIOD_DAYS) * VIP_PERIOD_DAYS;
  let days = guest.lastVisit !== null && guest.lastVisit >= periodStart ? guest.days : 0;
  const counted = checkIn && (guest.lastVisit === null || guest.lastVisit < today);
  if (counted) {
    const renewed = days === VIP_VISIT_GOAL - 1;
    days = Math.min(days + 1, VIP_VISIT_GOAL);
    guest = {
      ...guest, days, lastVisit: today,
      expiry: renewed ? Math.max(now, guest.expiry) + VIP_PERIOD_DAYS * VIP_DAY : guest.expiry
    };
    if (renewed) showToast('✦', 'VIP продлён на 30 дней');
  }
  if (isNew || counted) {
    try { localStorage.setItem(VIP_GUEST_ATTENDANCE_KEY, JSON.stringify(guest)); } catch {}
    vipSaveExpiry('guest', guest.expiry);
  }
  vipGuestAttendance = guest;
  vipUntil = guest.expiry;
  vipAttendance = { days, period_end: periodStart + VIP_PERIOD_DAYS - 1, checked_in: guest.lastVisit === today };
  if (!vipSeal?.earned && guest.expiry > guest.started + VIP_PERIOD_DAYS * VIP_DAY) {
    vipUpdateSeal({ earned: true, placement: null });
  }
}

function vipScheduleStatus() {
  clearTimeout(vipTimer);
  if (!vipOwner) return;
  const now = Date.now();
  const days = vipDaysLeft();
  const untilNextDay = (vipMoscowDay(now) + 1) * VIP_DAY - VIP_MOSCOW_OFFSET - now;
  const untilStatusChange = days ? vipUntil - now - (days - 1) * VIP_DAY : Infinity;
  vipTimer = setTimeout(() => {
    vipRefreshTrial();
    vipRefreshUi();
    vipScheduleStatus();
  }, Math.max(25, Math.min(untilNextDay, untilStatusChange) + 25));
}

function vipRefreshTrial(checkIn = false) {
  const owner = slotOwnerId();
  if (owner !== vipOwner) {
    if (vipDialog.open) vipDialog.close();
    vipOwner = owner;
    vipUntil = 0;
    vipAttendance = null;
    vipGuestAttendance = null;
    vipSeal = owner ? vipReadCachedSeal(owner) : null;
    vipPickingSeal = false;
    vipSealWrite = null;
    vipSealReadVersion++;
    vipRequest = null;
    vipSyncedDay = null;
    vipPendingVisitDay = null;
    vipLegacyServer = false;
    vipRetryAfter = 0;
    clearTimeout(vipRetryTimer);
    if (owner) {
      try {
        const cached = Number(localStorage.getItem(VIP_TRIAL_KEY + owner));
        if (Number.isSafeInteger(cached) && cached > 0) vipUntil = cached;
      } catch {}
    }
    vipScheduleStatus();
  }
  if (owner === 'guest') {
    const previousExpiry = vipUntil;
    vipGuestCheckIn(checkIn);
    if (vipUntil !== previousExpiry) vipScheduleStatus();
    return;
  }
  if (!cloudIsReady()) return;

  const day = vipMoscowDay();
  if (vipPendingVisitDay !== day) vipPendingVisitDay = null;
  const syncedToday = vipSyncedDay === day;
  if (checkIn && !(syncedToday && (vipAttendance?.checked_in || vipLegacyServer))) vipPendingVisitDay = day;
  if (vipRequest || Date.now() < vipRetryAfter || (syncedToday && vipPendingVisitDay === null)) return;
  const request = {};
  vipRequest = request;
  const visit = vipPendingVisitDay === day;
  const isCurrent = () => vipRequest === request && slotOwnerId() === owner;
  // Вызов запускается после завершения обработчика входа Supabase.
  setTimeout(async () => {
    if (!isCurrent()) return;
    let updated = false;
    let renewed = false;
    let expiryChanged = false;
    try {
      const { data, error } = await supabaseClient.rpc('sync_vip', { check_in: visit });
      if (!isCurrent()) return;
      const legacy = error?.code === 'PGRST202' || error?.code === '42883';
      let expiry = Number(data?.expiry);
      if (legacy) {
        const trial = await supabaseClient.rpc('claim_vip_trial');
        if (!isCurrent()) return;
        if (trial.error) throw trial.error;
        expiry = Number(trial.data);
      } else {
        if (error) throw error;
        if (!Number.isInteger(data?.days) || data.days < 0 || data.days > VIP_VISIT_GOAL ||
            !Number.isInteger(data.period_end) || typeof data.checked_in !== 'boolean') {
          throw new Error('Invalid VIP attendance');
        }
      }
      if (!Number.isSafeInteger(expiry) || expiry < 1) throw new Error('Invalid VIP expiry');
      vipSyncedDay = day;
      vipLegacyServer = legacy;
      vipAttendance = legacy ? null : data;
      if (vipPendingVisitDay === day && (visit || legacy || data.checked_in)) vipPendingVisitDay = null;
      expiryChanged = expiry !== vipUntil;
      vipUntil = expiry;
      vipSaveExpiry(owner, expiry);
      vipRetryAfter = 0;
      clearTimeout(vipRetryTimer);
      updated = true;
      renewed = !legacy && data.renewed === true;
    } catch {
      if (!isCurrent()) return;
      const delay = 60_000;
      vipRetryAfter = Date.now() + delay;
      clearTimeout(vipRetryTimer);
      vipRetryTimer = setTimeout(() => vipRefreshTrial(), delay);
    } finally {
      if (vipRequest === request) vipRequest = null;
    }
    if (updated) {
      if (renewed) showToast('✦', 'VIP продлён на 30 дней');
      vipScheduleStatus();
      if (vipPendingVisitDay === vipMoscowDay()) vipRefreshTrial();
      if (!vipLegacyServer) vipRefreshSeal();
      if (expiryChanged && state.player.classId && Number.isInteger(state.activeSlotIndex) &&
          !document.getElementById('start-screen').classList.contains('active')) cloudPushLeaderboard(true);
    }
    vipRefreshUi();
  }, 0);
}

function vipLooksFor(player) {
  const raceId = player.raceId || 'human';
  return VIP_LOOKS.filter(look =>
    look.raceId === raceId &&
    look.classId === player.classId &&
    (!look.subclassId || look.subclassId === player.subclass));
}

function vipLookFor(player) {
  if (!vipDaysLeft() || !player.vipLook) return null;
  return vipLooksFor(player).find(look => look.id === player.vipLook) || null;
}

function vipHeroPortrait(player, animated = false) {
  const look = vipLookFor(player);
  if (look) return animated && !vipReducedMotion.matches ? look.motion : look.art;
  return getHeroPortrait(player.raceId || 'human', player.classId, player.subclass);
}

function vipPlayVictoryEffect() {
  const look = vipLookFor(state.player);
  const style = look && VIP_VICTORY_STYLES[look.id];
  if (!style || vipReducedMotion.matches || state.player.hp <= 0 ||
      !document.getElementById('battle-window').classList.contains('active')) return;
  const card = document.getElementById('bx-hero-card');
  card.querySelector('.vip-victory')?.remove();
  const effect = document.createElement('span');
  const [color, highlight, shape] = style;
  effect.className = 'vip-victory';
  effect.dataset.shape = shape;
  effect.setAttribute('aria-hidden', 'true');
  effect.style.setProperty('--vip-effect', color);
  effect.style.setProperty('--vip-highlight', highlight);

  for (let i = 0; i < 16; i++) {
    const spark = document.createElement('i');
    const angle = i * Math.PI / 8;
    const x = Math.cos(angle), y = Math.sin(angle);
    const edge = Math.max(Math.abs(x), Math.abs(y));
    spark.style.cssText = `--x:${50 + 49 * x / edge}%;--y:${50 + 49 * y / edge}%;` +
      `--dx:${x * (9 + i % 4 * 3)}px;--dy:${y * (8 + i % 3 * 5) - 6}px;` +
      `--angle:${i * 22.5}deg;--delay:${i % 5 * 30}ms;--length:${5 + i % 4 * 2}px`;
    effect.append(spark);
  }
  card.append(effect);
  setTimeout(() => effect.remove(), 1000);
}

function vipEarnedTitles() {
  let best = -1;
  for (const monster of ALL_HUNT_MONSTERS) {
    for (const variant of ALL_VARIANTS) {
      if (getMonsterKills(monster.id, variant) < KILL_THRESHOLDS.title) continue;
      best = Math.max(best, TITLE_LADDER.indexOf(getMonsterTitle(monster.id, variant)));
      if (best === TITLE_LADDER.length - 1) return TITLE_LADDER;
    }
  }
  return TITLE_LADDER.slice(0, best + 1);
}

function vipFrameId(frame) {
  return hasOwnKey(VIP_FRAMES, frame) ? frame : 'bronze';
}

function vipProfileSnapshot(player) {
  if (!vipDaysLeft()) return null;
  return {
    until: vipUntil,
    look: vipLookFor(player)?.id || null,
    frame: vipFrameId(player.vipFrame),
    title: player.vipTitle && vipEarnedTitles().includes(player.vipTitle) ? player.vipTitle : null,
    female: player.gender === 'f',
  };
}

function vipPublicProfile(raw, raceId, classId, subclass) {
  if (!Number.isSafeInteger(raw?.until) || raw.until <= Date.now()) return null;
  const look = vipLooksFor({ raceId, classId, subclass }).find(item => item.id === raw.look);
  const title = hasOwnKey(VIP_TITLES, raw.title) ? VIP_TITLES[raw.title][raw.female === true ? 1 : 0] : '';
  return { look, frame: vipFrameId(raw.frame), title };
}

function vipRefreshUi() {
  if (document.getElementById('start-screen').classList.contains('active')) renderSlots();
  if (state.player.classId) {
    updateCharacterPanel();
    updatePlayerAvatar();
  }
  if (vipDialog.open) vipRenderDialog();
}

function vipRenderCharacter() {
  const days = vipDaysLeft();
  const hasVip = state.player.classId && days > 0;
  const badge = document.getElementById('vip-character-badge');
  const actions = document.getElementById('vip-character-actions');
  badge.hidden = !state.player.classId || !vipOwner;
  const expired = vipUntil > 0 && !days;
  badge.textContent = expired ? 'Вернуть VIP' : 'VIP';
  badge.setAttribute('aria-label', expired ? 'Вернуть VIP' : 'VIP — статус и образы');
  actions.hidden = !hasVip;
  if (hasVip) actions.querySelector('.vip-duration').textContent = vipTimeLabel(days);
  document.getElementById('cs-portrait').classList.toggle('vip-portrait-equipped', !!vipLookFor(state.player));
}

function vipOpenWardrobe() {
  vipRefreshTrial();
  if (!state.player.classId || !vipOwner || vipDialog.open) return;
  vipWardrobe.hidden = true;
  vipRenderDialog();
  vipDialog.showModal();
}

function vipRenderDialog() {
  const hasVip = vipDaysLeft() > 0;
  const expiryLabel = hasVip ? `Действует до ${vipCalendarDate.format(vipMoscowDay(vipUntil) * VIP_DAY)}`
    : vipUntil ? 'Срок VIP истёк' : 'Проверяем статус';
  vipDialog.querySelector('.vip-duration').textContent = expiryLabel;

  const activity = vipAttendance;
  const days = activity?.days;
  const count = document.getElementById('vip-renewal-count');
  count.textContent = `${days ?? '—'} из ${VIP_VISIT_GOAL} дней`;
  if (activity) vipRenewalMeter.setAttribute('aria-valuenow', days);
  else vipRenewalMeter.removeAttribute('aria-valuenow');
  for (const [index, mark] of vipRenewalMarks.entries()) {
    mark.classList.toggle('filled', index < days);
  }
  document.getElementById('vip-renewal-rule').textContent = activity
    ? `Заходи в игру в любые 15 дней по ${vipCalendarDate.format(activity.period_end * VIP_DAY)} включительно (МСК).`
    : 'Заходи в игру в любые 15 дней из 30.';

  const confirmedToday = activity?.checked_in && (vipOwner === 'guest' || vipSyncedDay === vipMoscowDay());
  const reachedGoal = days === VIP_VISIT_GOAL;
  const status = document.getElementById('vip-renewal-status');
  status.classList.toggle('counted', reachedGoal || !!confirmedToday);
  const statusText = reachedGoal ? '✓ VIP продлён на 30 дней'
    : confirmedToday ? '✓ Сегодняшний вход засчитан'
    : vipLegacyServer ? 'Прогресс пока недоступен'
    : vipRetryAfter > Date.now() ? 'Проверим вход, когда восстановится связь'
    : !activity || vipPendingVisitDay !== null || vipRequest ? 'Проверяем сегодняшний вход…'
    : 'Войди за героя, чтобы зачесть день';
  if (status.textContent !== statusText) status.textContent = statusText;
  document.getElementById('vip-open-seal').hidden = !vipSealCanPlace();

  if (hasVip && vipWardrobe.hidden) vipFillWardrobe();
  if (!hasVip && !vipWardrobe.hidden) vipPreview.querySelector('img').removeAttribute('src');
  vipWardrobe.hidden = !hasVip;
}

function vipFillWardrobe() {
  const looks = vipLooksFor(state.player);
  const blank = document.getElementById('vip-empty');
  blank.hidden = looks.length > 0;
  const selection = document.getElementById('vip-wardrobe-choices');
  selection.innerHTML = looks.map(look => `<button type="button" class="btn" data-look="${look.id}">${look.name}</button>`).join('');
  selection.hidden = !looks.length;
  document.getElementById('vip-wardrobe-preview').hidden = !looks.length;
  if (looks.length) vipPreviewLook(vipLookFor(state.player) || looks[0], !vipReducedMotion.matches);
  const player = state.player;
  document.getElementById('vip-profile-frame').value = vipFrameId(player.vipFrame);
  const title = document.getElementById('vip-profile-title');
  const female = player.gender === 'f' ? 1 : 0;
  title.replaceChildren(new Option('Без подписи', ''),
    ...vipEarnedTitles().map(id => new Option(VIP_TITLES[id][female], id)));
  title.value = Array.from(title.options).some(option => option.value === player.vipTitle) ? player.vipTitle : '';
}

function vipPreviewLook(look, playing) {
  const preview = document.getElementById('vip-wardrobe-preview');
  preview.dataset.look = look.id;
  preview.dataset.playing = String(playing);
  const portrait = preview.querySelector('img');
  const source = playing ? look.motion : look.art;
  if (portrait.getAttribute('src') !== source) portrait.src = source;
  portrait.alt = look.name;
  document.getElementById('vip-look-name').textContent = look.name;
  document.getElementById('vip-motion').textContent = playing ? 'Пауза' : 'Включить движение';
  const equipped = state.player.vipLook === look.id;
  document.getElementById('vip-look-status').textContent = equipped ? 'Образ на герое' : '';
  document.getElementById('vip-equip').textContent = equipped ? 'Снять образ' : 'Надеть образ';
  document.querySelectorAll('#vip-wardrobe-choices button').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.look === look.id));
  });
}

const vipDialog = document.getElementById('vip-dialog');
const vipWardrobe = document.getElementById('vip-wardrobe');
const vipPreview = document.getElementById('vip-wardrobe-preview');
const vipRenewalMeter = document.getElementById('vip-renewal-meter');
const vipRenewalMarks = Array.from({ length: VIP_VISIT_GOAL }, () => document.createElement('i'));
vipRenewalMeter.append(...vipRenewalMarks);
vipDialog.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.id === 'vip-close') { vipDialog.close(); return; }
  if (button.id === 'vip-open-seal' && vipSealCanPlace()) {
    vipDialog.close();
    switchTab('chronicle');
    switchChronicleSection('annals');
    return;
  }
  const look = vipLooksFor(state.player).find(item => item.id === (button.dataset.look || vipPreview.dataset.look));
  if (!look || !vipDaysLeft()) return;
  const playing = vipPreview.dataset.playing === 'true';
  if (button.dataset.look) vipPreviewLook(look, playing);
  else if (button.id === 'vip-motion') vipPreviewLook(look, !playing);
  else if (button.id === 'vip-equip') {
    state.player.vipLook = state.player.vipLook === look.id ? null : look.id;
    vipPreviewLook(look, playing);
    vipRefreshUi();
    saveCurrentSlot(true);
  }
});
vipDialog.addEventListener('change', event => {
  if (!vipDaysLeft()) return;
  const { id, value } = event.target;
  if (id === 'vip-profile-frame') state.player.vipFrame = vipFrameId(value);
  else if (id === 'vip-profile-title' && (!value || vipEarnedTitles().includes(value))) state.player.vipTitle = value || null;
  else return;
  saveCurrentSlot(true);
});
vipDialog.addEventListener('close', () => {
  if (!vipDialog.open) vipPreview.querySelector('img').removeAttribute('src');
});

vipReducedMotion.addEventListener('change', () => {
  vipRefreshUi();
  if (!vipDialog.open || !vipReducedMotion.matches) return;
  const look = vipLooksFor(state.player).find(item => item.id === vipPreview.dataset.look);
  if (look) vipPreviewLook(look, false);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  vipRefreshTrial();
  vipScheduleStatus();
  vipRefreshUi();
});
window.addEventListener('online', () => {
  vipRetryAfter = 0;
  vipRefreshTrial();
  vipRefreshSeal();
});
