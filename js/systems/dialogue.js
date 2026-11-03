// ========================================================
//  СИСТЕМЫ: ДВИЖОК ДИАЛОГОВ
//  Открывает окно с портретом NPC, текстом и кнопками.
//  Читает данные из DIALOGUES (js/data/dialogues.js).
//  v0.30: тексты идут через heroText() — «{м|ж}» под пол героя.
//         opt.text может быть функцией (галочка у заданного вопроса),
//         node.onEnter() — вызывается, когда реплика показана.
//         «*…*» в тексте — действие/описание (не речь).
// ========================================================

let __activeDialogue = null;

function openDialogue(npcId, startNodeId) {
  const dialogue = DIALOGUES[npcId];
  if (!dialogue) return;

  const npc = NPCS[npcId];
  if (!npc) return;

  let startNode = startNodeId;
  if (!startNode) {
    if (typeof dialogue.getStartNode === 'function') {
      startNode = dialogue.getStartNode();
    } else {
      startNode = dialogue.start;
    }
  }

  const node = dialogue.nodes[startNode];
  if (!node) return;

  __activeDialogue = { npcId, nodeId: startNode };

  const overlay = document.getElementById('dialogue-overlay');
  if (!overlay) return;

  renderDialogue(npc, node);
  overlay.classList.add('active');
}

function renderDialogue(npc, node) {
  const overlay = document.getElementById('dialogue-overlay');
  if (!overlay) return;

  // v0.30: реплика что-то открывает (например, кусок Энциклопедии).
  if (typeof node.onEnter === 'function') node.onEnter();

  const npcIconHtml = (typeof NPC_SVG !== 'undefined' && NPC_SVG[npc.icon])
    ? NPC_SVG[npc.icon]
    : `<div class="dialogue-portrait-fallback">?</div>`;

  const buttonsHtml = node.options.map((opt, idx) => {
    let cls = 'dialogue-option';
    if (opt.action === 'close') cls += ' dialogue-option-close';
    const text = typeof opt.text === 'function' ? opt.text() : opt.text;
    return `<button class="${cls}" onclick="onDialogueOption(${idx})">${heroText(text)}</button>`;
  }).join('');

  overlay.innerHTML = `
    <div class="dialogue-box" id="dialogue-box">
      <div class="dialogue-portrait">
        ${npcIconHtml}
      </div>
      <div class="dialogue-content">
        <div class="dialogue-name">${npc.fullName || npc.name}</div>
        <div class="dialogue-text">${heroText(node.text).replace(/\*([^*]+)\*/g, '<span class="dlg-act">$1</span>')}</div>
        <div class="dialogue-options" id="dialogue-options">
          ${buttonsHtml}
        </div>
      </div>
    </div>
  `;

  __activeDialogue.currentNode = node;
}

function onDialogueOption(idx) {
  if (!__activeDialogue || !__activeDialogue.currentNode) return;

  const node = __activeDialogue.currentNode;
  const opt = node.options[idx];
  if (!opt) return;

  if (opt.action === 'close') {
    closeDialogue();
    return;
  }

  if (typeof opt.onSelect === 'function') {
    closeDialogue();
    opt.onSelect();
    return;
  }

  if (opt.next) {
    const dialogue = DIALOGUES[__activeDialogue.npcId];
    const nextNode = dialogue.nodes[opt.next];
    if (nextNode) {
      __activeDialogue.nodeId = opt.next;
      const npc = NPCS[__activeDialogue.npcId];
      renderDialogue(npc, nextNode);
    }
    return;
  }

  closeDialogue();
}

function closeDialogue() {
  const npcId = __activeDialogue && __activeDialogue.npcId;
  __activeDialogue = null;
  const overlay = document.getElementById('dialogue-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.innerHTML = '';
  }
  // v0.30: поговорили со Старейшиной — герой узнал, где оказался (летопись перепишется),
  // в Энциклопедии появились Андервуд и Старейшина.
  if (npcId === 'elder' && typeof learnChronicleFact === 'function') {
    learnChronicleFact('start_place');
    unlockLore('underwood');
    unlockLore('elder');
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && __activeDialogue) {
    closeDialogue();
  }
});