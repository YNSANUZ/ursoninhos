(function () {
  'use strict';

  var STORAGE_KEY = 'ursoninhos_theme';
  var DARK = 'dark';
  var LIGHT = 'light';
  var root = document.documentElement;

  function readTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY) === LIGHT ? LIGHT : DARK;
    } catch (error) {
      return DARK;
    }
  }

  function writeTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      // O tema continua funcional durante a visita mesmo sem localStorage.
    }
  }

  function actionIcon(theme) {
    if (theme === DARK) {
      return [
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">',
        '<circle cx="12" cy="12" r="4"></circle>',
        '<path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"></path>',
        '</svg>'
      ].join('');
    }

    return [
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">',
      '<path d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.5 8.5 0 1 0 20.4 15.2Z"></path>',
      '</svg>'
    ].join('');
  }

  function updateButtons(theme) {
    var isDark = theme === DARK;
    var label = isDark ? 'Ativar modo claro' : 'Ativar modo escuro';

    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
      button.innerHTML = actionIcon(theme);
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.setAttribute('aria-pressed', String(!isDark));
    });
  }

  function updateThemeColor(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = theme === LIGHT ? '#fffaf3' : '#0d0906';
  }

  function applyTheme(theme, persist) {
    var normalized = theme === LIGHT ? LIGHT : DARK;
    root.dataset.theme = normalized;
    updateButtons(normalized);
    updateThemeColor(normalized);
    if (persist) writeTheme(normalized);
  }

  function toggleTheme() {
    applyTheme(root.dataset.theme === LIGHT ? DARK : LIGHT, true);
  }

  function createButton(modifier) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle ' + modifier;
    button.dataset.themeToggle = '';
    button.addEventListener('click', toggleTheme);
    return button;
  }

  function mountControls() {
    var actions = document.querySelector('.topbar__actions');
    if (actions && !actions.querySelector('.theme-toggle--desktop')) {
      var desktopItem = document.createElement('li');
      desktopItem.className = 'theme-toggle-desktop-item';
      desktopItem.appendChild(createButton('theme-toggle--desktop'));
      actions.insertBefore(desktopItem, actions.lastElementChild);
    }

    var navList = document.querySelector('.nav__list');
    if (navList && !navList.querySelector('.theme-toggle--mobile')) {
      root.classList.add('has-mobile-theme-menu');
      var mobileItem = document.createElement('li');
      mobileItem.className = 'theme-toggle-mobile-item';
      mobileItem.appendChild(createButton('theme-toggle--mobile'));
      navList.appendChild(mobileItem);
    }

    updateButtons(root.dataset.theme);
  }

  applyTheme(readTheme(), false);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountControls, { once: true });
  } else {
    mountControls();
  }

  window.addEventListener('storage', function (event) {
    if (event.key === STORAGE_KEY) applyTheme(readTheme(), false);
  });
})();
