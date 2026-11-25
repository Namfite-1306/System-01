(() => {
  const stylesheet = document.querySelector('#workspace-theme');
  const button = document.querySelector('#theme-toggle');
  let theme = 'obsidian';
  try {
    if (localStorage.getItem('workspace-theme') === 'classic') theme = 'classic';
  } catch {
    /* Theme still works without browser storage. */
  }
  function apply() {
    stylesheet.disabled = theme === 'classic';
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content =
      theme === 'obsidian' ? '#0a0a0a' : '#f3f6f4';
    const label = theme === 'obsidian' ? 'Giao diện sáng' : 'Obsidian & Lime';
    button.lastElementChild.textContent = label;
    button.setAttribute('aria-label', `Dùng ${label}`);
  }
  apply();
  button.addEventListener('click', () => {
    theme = theme === 'obsidian' ? 'classic' : 'obsidian';
    apply();
    try {
      localStorage.setItem('workspace-theme', theme);
    } catch {
      /* Session-only preference. */
    }
  });
})();
