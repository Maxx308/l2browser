// История обновлений доступна со стартового экрана.
function openPatchNotes() {
  const dialog = document.getElementById('patch-notes');
  const select = document.getElementById('patch-version');
  if (!CHANGELOG.length) return;
  if (!select.options.length) {
    CHANGELOG.forEach(entry => {
      select.add(new Option(`${entry.version} · ${entry.date}`, entry.version));
    });
    renderPatchNotes(select.value);
  }
  dialog.showModal();
}

function renderPatchNotes(version) {
  const entry = CHANGELOG.find(item => item.version === version);
  if (!entry) return;
  const article = document.getElementById('patch-entry');
  article.innerHTML = `
    ${entry.title ? `<h3>${entry.title}</h3>` : ''}
    <ul class="patch-changes">
      ${entry.changes.map(change => `<li><span aria-hidden="true">${change.icon || '•'}</span><div>${change.text}</div></li>`).join('')}
    </ul>
  `;
  article.scrollTop = 0;
}
