// ── Theme Management ──────────────────────────────────────────
// Applies immediately (before DOMContentLoaded) to avoid flash.
(function () {
  const saved = localStorage.getItem('cm-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

function applyTheme(name) {
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem('cm-theme', name);
  const btn = document.getElementById('btn-theme-toggle');
  if (btn) {
    btn.textContent = name === 'dark' ? '☀' : '🌙';
    btn.title = name === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  }
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: name } }));
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}
