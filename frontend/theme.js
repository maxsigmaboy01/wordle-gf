(() => {
  const root = document.documentElement;
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const storageKey = 'daily-puzzle-theme';
  let preference;
  try { preference = localStorage.getItem(storageKey); } catch {}
  if (preference !== 'dark' && preference !== 'light') preference = null;

  function applyTheme() {
    const theme = preference || (systemTheme.matches ? 'dark' : 'light');
    root.dataset.theme = theme;
    document.getElementById('themeBtn')?.setAttribute('aria-pressed', String(theme === 'dark'));
  }

  applyTheme();
  systemTheme.addEventListener('change', applyTheme);
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('themeBtn');
    applyTheme();
    button.addEventListener('click', () => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(storageKey, preference); } catch {}
      applyTheme();
    });
  });
})();
