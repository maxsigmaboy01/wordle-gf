import { ATTEMPTS, WORD_LENGTH } from '../backend/game.js';
import { LEVEL_COUNT, SURPRISE_LEVEL } from '../backend/campaign.js';
import { appIcons } from './app-icons.js';
import { themeCards } from './menu.js';
import { mascotById, mascots } from './mascots.js';
import { showToast } from './toast.js';
import { readStorage, saveStorage } from './storage.js';
import { el, makeRow } from './views.js';

const PREFS_KEY = 'daily-puzzle-settings';
const SURPRISE_KEY = 'daily-puzzle-surprise';
const ACTIVATIONS = [
  ['manual', 'Manual'],
  ['after-final-try', 'After ' + ATTEMPTS + ' tries'],
  ['shared-link-only', 'Only for shared link']
];
const TILE_SKINS = [['classic', 'Classic'], ['wood', 'Wood'], ['blossom', 'Blossom'], ['night', 'Night']];
export const DEFAULT_HEADLINE = 'You got baited, respectfully.';
export const HEADLINE_MAX = 60;
const SURPRISE_PRESETS = [['safe', 'Safe Place'], ['love', 'I Love You'], ['happy', 'So Happy']];

export const PREF_DEFAULTS = Object.freeze({
  startup: 'menu', reducedMotion: false, highContrast: false, keyHints: true, hints: true, appIcon: 'classic', mascot: 'match', tileSkin: 'classic', mascotVersion: 2
});

export function loadPrefs() {
  const saved = readStorage(PREFS_KEY);
  const prefs = { ...PREF_DEFAULTS };
  if (saved && typeof saved === 'object') {
    if (saved.startup === 'menu' || saved.startup === 'resume') prefs.startup = saved.startup;
    for (const key of ['reducedMotion', 'highContrast', 'keyHints', 'hints']) {
      if (typeof saved[key] === 'boolean') prefs[key] = saved[key];
    }
    if (appIcons.some(icon => icon[0] === saved.appIcon)) prefs.appIcon = saved.appIcon;
    const keptOldDefault = saved.mascotVersion !== 2 && saved.mascot === 'classic';
    if (!keptOldDefault && mascots.some(item => item.id === saved.mascot)) prefs.mascot = saved.mascot;
    if (TILE_SKINS.some(item => item[0] === saved.tileSkin)) prefs.tileSkin = saved.tileSkin;
  }
  return prefs;
}

export function loadSurprise(defaults) {
  const saved = readStorage(SURPRISE_KEY);
  const surprise = {
    enabled: false, failAll: true, reveal: true, activation: 'after-final-try', level: SURPRISE_LEVEL,
    message: defaults.message.slice(), note: defaults.note, headline: DEFAULT_HEADLINE
  };
  if (saved && typeof saved === 'object') {
    for (const key of ['enabled', 'failAll', 'reveal']) {
      if (typeof saved[key] === 'boolean') surprise[key] = saved[key];
    }
    if (Number.isInteger(saved.level) && saved.level >= 1 && saved.level <= LEVEL_COUNT) surprise.level = saved.level;
    if (ACTIVATIONS.some(item => item[0] === saved.activation)) surprise.activation = saved.activation;
    if (Array.isArray(saved.message) && saved.message.length === ATTEMPTS &&
        saved.message.every(line => typeof line === 'string' && /^[A-Z♡♥]{0,5}$/.test(line))) {
      surprise.message = saved.message.slice();
    }
    if (typeof saved.note === 'string' && saved.note.length <= 130) surprise.note = saved.note;
    if (typeof saved.headline === 'string' && saved.headline.trim() && saved.headline.length <= HEADLINE_MAX) surprise.headline = saved.headline;
  }
  return surprise;
}

// matchMedia-like object: the system preference OR the in-app override.
export function createMotion(forced = false) {
  const query = matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = new Set();
  const fire = () => listeners.forEach(listener => listener());
  query.addEventListener('change', fire);
  document.documentElement.classList.toggle('reduce-motion', forced);
  return {
    get matches() { return forced || query.matches; },
    addEventListener(type, listener) { if (type === 'change') listeners.add(listener); },
    removeEventListener(type, listener) { listeners.delete(listener); },
    force(value) {
      if (forced === Boolean(value)) return;
      forced = Boolean(value);
      document.documentElement.classList.toggle('reduce-motion', forced);
      fire();
    }
  };
}

export function applyPrefs(prefs, motion) {
  motion.force(prefs.reducedMotion);
  document.documentElement.classList.toggle('hc-tiles', prefs.highContrast);
  document.documentElement.dataset.skin = prefs.tileSkin;
  const keys = document.getElementById('menuKeys');
  if (keys) keys.hidden = !prefs.keyHints;
}

const icon = name => '<svg class="ic" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
let uid = 0;

function card(id, iconName, title, sub) {
  const section = el('section', 'set-card');
  if (id) section.id = id;
  const heading = el('h2');
  heading.innerHTML = icon(iconName);
  heading.append(el('span', '', title));
  section.append(heading);
  if (sub) section.append(el('p', 'set-sub', sub));
  return section;
}

function switchRow({ iconName, title, hint, checked, onChange, className = '' }) {
  const id = 'sw' + ++uid;
  const label = el('label', 'set-row ' + className);
  label.htmlFor = id;
  if (iconName) label.insertAdjacentHTML('beforeend', icon(iconName));
  const text = el('span', 'set-text');
  text.append(el('b', '', title));
  if (hint) text.append(el('small', '', hint));
  const wrap = el('span', 'sw');
  const input = el('input');
  input.type = 'checkbox';
  input.id = id;
  input.setAttribute('role', 'switch');
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  wrap.append(input, el('i', 'switch'));
  wrap.lastChild.setAttribute('aria-hidden', 'true');
  label.append(text, wrap);
  return { label, input };
}

function slider(label, iconName, value, onInput) {
  const row = el('div', 'set-slider');
  const id = 'rng' + ++uid;
  row.insertAdjacentHTML('beforeend', icon(iconName));
  const name = el('label', '', label);
  name.htmlFor = id;
  const input = el('input');
  input.type = 'range';
  input.id = id;
  input.min = 0;
  input.max = 100;
  input.step = 5;
  const output = el('output', '', '');
  output.htmlFor = id;
  const paint = () => {
    input.style.setProperty('--v', input.value + '%');
    output.textContent = input.value + '%';
  };
  input.value = value;
  input.addEventListener('input', () => { paint(); onInput(Number(input.value)); });
  paint();
  row.append(name, input, output);
  return { row, input, paint };
}

export function setupSettings(app) {
  const $ = id => document.getElementById(id);
  const { root, prefs, seasons, seasonSelect, audio, motion } = app;
  const screen = $('settingsScreen');
  const invoke = window.__TAURI__?.core?.invoke;
  const showIcons = Boolean(window.__TAURI__) || location.hash.startsWith('#menu');
  const surprise = { ...app.surprise, message: app.surprise.message.slice() };
  let page = 'general';

  function persist() { saveStorage(PREFS_KEY, prefs); }
  function pushIcon() {
    if (!invoke) return;
    try { Promise.resolve(invoke('set_app_icon', { id: prefs.appIcon })).catch(() => {}); } catch {}
  }
  function setPref(key, value) {
    prefs[key] = value;
    persist();
    applyPrefs(prefs, motion);
  }

  // ---- shell -------------------------------------------------------------
  screen.innerHTML =
    '<aside class="menu-side"><div class="menu-brand"><img class="brand-icon" alt="" width="36" height="36"><span>Daily Puzzle</span></div>' +
    '<nav class="menu-nav" aria-label="Settings sections">' +
    [['general', 'gear', 'General'], ['audio', 'sound', 'Audio'], ['themes', 'palette', 'Themes'],
      ['mascot', 'face', 'Mascot'], ['surprise', 'heart', 'Surprise Mode']].map(([id, name, label]) =>
      '<button type="button" class="menu-nav-item" data-set="' + id + '" title="' + label + '">' + icon(name) +
      '<span>' + label + '</span></button>').join('') +
    '</nav><button type="button" class="menu-nav-item menu-side-quit set-home" data-set="home" title="Back to menu">' +
    icon('back') + '<span>Back to menu</span></button></aside>' +
    '<section class="menu-main set-main"><div class="set-wrap" tabindex="-1">' +
    '<div class="set-page" id="setGeneral"></div><div class="set-page" id="setSurprise" hidden></div></div></section>';
  const general = $('setGeneral'), surprisePage = $('setSurprise');

  // ---- General page ------------------------------------------------------
  const head = el('header', 'set-head');
  head.innerHTML = '<span class="set-head-ic">' + icon('gear') + '</span><div><h1>Settings</h1>' +
    '<p>Customize your Daily Puzzle experience.</p></div><img class="set-deco" alt="" width="130" height="113">';
  head.querySelector('img').src = document.querySelector('.mascot-chest').src;
  const columns = el('div', 'set-cols');
  general.append(head, columns);

  // Theme
  const themeCard = card('setThemeCard', 'palette', 'Theme', 'Change the look and feel of the game.');
  const themeGrid = el('div', 'set-themes');
  themeGrid.setAttribute('role', 'radiogroup');
  themeGrid.setAttribute('aria-label', 'Theme');
  for (const [id, name, , still] of themeCards) {
    const button = el('button', 'set-theme');
    button.type = 'button';
    button.dataset.theme = id;
    button.setAttribute('role', 'radio');
    button.innerHTML = '<span class="theme-art"><img alt="" width="64" height="64"></span>' +
      '<span class="theme-badge" aria-hidden="true">' + icon('check') + '</span><b></b>';
    button.querySelector('img').src = still;
    button.querySelector('b').textContent = name;
    button.addEventListener('click', () => {
      if (seasons.current() === id) return;
      seasonSelect.value = id;
      seasonSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    themeGrid.append(button);
  }
  themeGrid.addEventListener('keydown', event => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = themeCards.findIndex(item => item[0] === seasons.current());
    themeGrid.children[(index + step + themeCards.length) % themeCards.length].click();
    themeGrid.querySelector('[aria-checked="true"]').focus();
  });
  const dark = switchRow({
    iconName: 'contrast', title: 'Dark mode', hint: 'Easier on the eyes at night.', className: 'set-divided',
    checked: document.documentElement.dataset.theme === 'dark',
    onChange: () => $('themeBtn').click()
  });
  themeCard.append(themeGrid, dark.label);
  function syncTheme() {
    for (const button of themeGrid.children) {
      const on = button.dataset.theme === seasons.current();
      button.setAttribute('aria-checked', String(on));
      button.tabIndex = on ? 0 : -1;
    }
    dark.input.checked = document.documentElement.dataset.theme === 'dark';
  }
  seasonSelect.addEventListener('change', syncTheme);

  // Keyboard / tile skin: changes keys, empty tiles and the board frame only; green/yellow/gray stay as they are.
  const skinCard = card('setSkinCard', 'keyboard', 'Keyboard / Tile Skin', 'Customize the game\u2019s look.');
  const skins = el('div', 'set-skins');
  skins.setAttribute('role', 'radiogroup');
  skins.setAttribute('aria-label', 'Keyboard and tile skin');
  for (const [id, name] of TILE_SKINS) {
    const button = el('button', 'skin-opt');
    button.type = 'button';
    button.dataset.skin = id;
    button.setAttribute('role', 'radio');
    button.innerHTML = '<span class="skin-chip" aria-hidden="true"><span>A</span></span><b></b>' +
      '<span class="theme-badge" aria-hidden="true">' + icon('check') + '</span>';
    button.querySelector('b').textContent = name;
    button.addEventListener('click', () => {
      if (prefs.tileSkin === id) return;
      setPref('tileSkin', id);
      syncSkins();
      showToast(name + ' keys applied');
    });
    skins.append(button);
  }
  function syncSkins() {
    for (const button of skins.children) {
      const on = button.dataset.skin === prefs.tileSkin;
      button.setAttribute('aria-checked', String(on));
      button.tabIndex = on ? 0 : -1;
    }
  }
  skins.addEventListener('keydown', event => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = TILE_SKINS.findIndex(item => item[0] === prefs.tileSkin);
    skins.children[(index + step + TILE_SKINS.length) % TILE_SKINS.length].click();
    skins.querySelector('[aria-checked="true"]').focus();
  });
  skinCard.append(skins);

  // Mascot: used on Home, the play side panel and the final reveal.
  const mascotCard = card('setMascotCard', 'face', 'Mascot', 'Choose your in-game companion.');
  const mascot = el('div', 'set-mascot');
  mascot.setAttribute('role', 'radiogroup');
  mascot.setAttribute('aria-label', 'Mascot');
  for (const item of mascots) {
    const button = el('button', 'mascot-opt');
    button.type = 'button';
    button.dataset.mascot = item.id;
    button.setAttribute('role', 'radio');
    button.innerHTML = '<span class="mascot-thumb"><img alt="" width="72" height="72"></span><span class="set-text"><b></b>' +
      '<em class="set-tag"></em></span><span class="theme-badge" aria-hidden="true">' + icon('check') + '</span>';
    button.querySelector('img').src = item.still;
        button.querySelector('b').textContent = item.name;
    button.querySelector('em').textContent = item.tag;
    button.addEventListener('click', () => {
      if (prefs.mascot === item.id) return;
      setPref('mascot', item.id);
      document.dispatchEvent(new Event('mascotchange'));
      syncMascot();
      showToast(item.name + ' selected');
    });
    mascot.append(button);
  }
  function syncMascot() {
    for (const button of mascot.children) {
      const on = button.dataset.mascot === prefs.mascot;
      button.setAttribute('aria-checked', String(on));
      button.tabIndex = on ? 0 : -1;
    }
  }
  mascot.addEventListener('keydown', event => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = mascots.findIndex(item => item.id === mascotById(prefs.mascot).id);
    mascot.children[(index + step + mascots.length) % mascots.length].click();
    mascot.querySelector('[aria-checked="true"]').focus();
  });
  mascotCard.append(mascot);

  // Audio
  const audioCard = card('setAudioCard', 'sound', 'Audio', 'Adjust game sounds and music.');
  const mix = audio.mix;
  const state = mix.get();
  const mute = switchRow({
    title: 'Mute all', checked: state.muted, className: 'set-mute',
    onChange: value => { mix.setMuted(value); audioCard.classList.toggle('is-muted', value); }
  });
  audioCard.querySelector('h2').append(mute.label);
  audioCard.classList.toggle('is-muted', state.muted);
  const music = slider('Music volume', 'music', state.music, value => mix.setVolume('music', value));
  const sfx = slider('SFX volume', 'sparkle', state.sfx, value => mix.setVolume('sfx', value));
  const musicOn = switchRow({
    iconName: 'music', title: 'Background music', hint: 'Plays a loop that matches your theme.', className: 'set-divided',
    checked: state.musicOn, onChange: value => mix.setMusic(value)
  });
  audioCard.append(music.row, sfx.row, musicOn.label);

  // Startup
  const startCard = card('setStartCard', 'play', 'Startup', 'Choose what to show when the app opens.');
  const startGroup = el('div', 'set-radios');
  startGroup.setAttribute('role', 'radiogroup');
  startGroup.setAttribute('aria-label', 'Startup');
  for (const [value, label] of [['menu', 'Open to Main Menu'], ['resume', 'Resume last puzzle']]) {
    const row = el('label', 'set-radio');
    const input = el('input');
    input.type = 'radio';
    input.name = 'startup';
    input.value = value;
    input.checked = prefs.startup === value;
    input.addEventListener('change', () => { if (input.checked) setPref('startup', value); });
    row.append(input, el('span', '', label));
    startGroup.append(row);
  }
  startCard.append(startGroup);

  // Accessibility
  const accessCard = card('setAccessCard', 'eye', 'Accessibility', 'Make the game more comfortable for everyone.');
  accessCard.append(
    switchRow({
      iconName: 'motion', title: 'Reduced motion', hint: 'Freezes the dino, GIFs and weather effects.', checked: prefs.reducedMotion,
      onChange: value => setPref('reducedMotion', value)
    }).label,
    switchRow({
      iconName: 'contrast', title: 'High contrast tiles', hint: 'Stronger color difference.',
      checked: prefs.highContrast, onChange: value => setPref('highContrast', value)
    }).label,
    switchRow({
      iconName: 'keyboard', title: 'Keyboard shortcut help', hint: 'Show key hints on the menu.',
      checked: prefs.keyHints, onChange: value => setPref('keyHints', value)
    }).label
  );

  // App icon
  const iconCard = card('setIconCard', 'apps', 'App Icon', 'Choose the app icon on your Mac.');
  const iconGrid = el('div', 'set-icons');
  iconGrid.setAttribute('role', 'radiogroup');
  iconGrid.setAttribute('aria-label', 'App icon');
  for (const [id, name, src] of appIcons) {
    const button = el('button', 'set-icon');
    button.type = 'button';
    button.dataset.icon = id;
    button.setAttribute('role', 'radio');
    button.innerHTML = '<img alt="" width="64" height="64"><span class="theme-badge" aria-hidden="true">' +
      icon('check') + '</span><b></b>';
    button.querySelector('img').src = src;
    button.querySelector('b').textContent = name;
    button.addEventListener('click', () => {
      if (prefs.appIcon === id) return;
      setPref('appIcon', id);
      document.dispatchEvent(new Event('appiconchange'));
      pushIcon();
      syncIcons();
    });
    iconGrid.append(button);
  }
  function syncIcons() {
    for (const button of iconGrid.children) {
      const on = button.dataset.icon === prefs.appIcon;
      button.setAttribute('aria-checked', String(on));
      button.tabIndex = on ? 0 : -1;
    }
  }
  iconGrid.addEventListener('keydown', event => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = appIcons.findIndex(item => item[0] === prefs.appIcon);
    iconGrid.children[(index + step + appIcons.length) % appIcons.length].click();
    iconGrid.querySelector('[aria-checked="true"]').focus();
  });
  iconCard.append(iconGrid);
  iconCard.hidden = !showIcons;

  // Game: level answers + export
  const gameCard = card('setGameCard', 'pencil', 'Game', 'Level answers and sharing.');
  const answerForm = el('form', 'set-answers');
  answerForm.noValidate = false;
  const answerFields = el('div', 'set-answer-grid');
  const answerStatus = el('p', 'set-note', '');
  answerStatus.setAttribute('role', 'status');
  const applyAnswers = el('button', 'menu-btn', 'Apply answers and restart');
  applyAnswers.type = 'submit';
  const answerSub = el('p', 'set-sub', '');
  answerForm.append(el('h3', '', 'Level answers'), answerSub, answerFields, applyAnswers, answerStatus);
  function renderAnswers() {
    const answers = app.getAnswers();
    const steered = answers.indexOf(null);
    answerSub.textContent = 'Five-letter words for each level.' +
      (steered >= 0 ? ' Level ' + (steered + 1) + ' is set by Surprise Mode while it is steering the game.' : '');
    answerFields.replaceChildren(...answers.map((word, index) => {
      const field = el('div', 'set-field');
      const label = el('label', '', 'Level ' + (index + 1));
      const input = el('input', 'set-input');
      input.id = 'setAnswer' + index;
      label.htmlFor = input.id;
      input.dataset.index = index;
      if (word === null) {
        input.disabled = true;
        input.placeholder = 'Surprise level';
        input.setAttribute('aria-label', 'Level ' + (index + 1) + ': Surprise level');
        field.append(label, input, el('small', 'set-note', 'Surprise level'));
        return field;
      }
      input.value = word;
      input.maxLength = WORD_LENGTH;
      input.pattern = '[A-Za-z]{5}';
      input.required = true;
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.addEventListener('input', () => { input.setCustomValidity(''); answerStatus.textContent = ''; });
      field.append(label, input);
      return field;
    }));
  }
  answerForm.addEventListener('submit', event => {
    event.preventDefault();
    const next = app.getAnswers().slice();
    for (const input of answerFields.querySelectorAll('input:not(:disabled)')) {
      const word = input.value.toUpperCase();
      input.setCustomValidity(/^[A-Z]{5}$/.test(word) && !app.isWord(word) ? 'Choose a word from the dictionary.' : '');
      if (!input.validity.valid) { input.reportValidity(); return; }
      next[Number(input.dataset.index)] = word;
    }
    app.setAnswers(next);
    answerStatus.textContent = 'Answers applied. Starting again from level 1.';
  });
  const exportRow = el('div', 'set-export');
  const exportBtn = el('button', 'menu-btn', 'Export player HTML');
  exportBtn.type = 'button';
  const exportNote = el('p', 'set-note', '');
  exportNote.setAttribute('role', 'status');
  exportBtn.addEventListener('click', () => app.exportGame(exportBtn, exportNote));
  exportRow.append(el('h3', '', 'Share your puzzle'),
    el('p', 'set-sub', 'Save a single offline HTML file with your answers, theme and surprise.'), exportBtn, exportNote);
  const hintsSwitch = switchRow({
    iconName: 'star', title: 'Hints', hint: 'Show the star hint button while you play. Stars are kept if you turn it off.',
    checked: prefs.hints, onChange: value => { setPref('hints', value); app.setHints?.(value); }
  });
  hintsSwitch.label.classList.add('set-hints');
  gameCard.append(hintsSwitch.label, answerForm, exportRow);

  columns.append(themeCard, skinCard, mascotCard, audioCard, startCard, accessCard, iconCard, gameCard);

  // ---- Surprise Mode page -------------------------------------------------
  const sHead = el('header', 'set-head sur-head');
  sHead.innerHTML = '<span class="set-head-ic heart">' + icon('heart') + '</span><div>' +
    '<h1>Surprise Mode <span class="set-badge">' + icon('bolt') + 'Hidden / Prank Mode</span></h1>' +
    '<p>Set up a secret romantic twist (a playful prank) for someone special.</p></div>' +
    '<span class="sur-envelope" aria-hidden="true">' + icon('gift') + '</span>';

  const status = el('p', 'set-note sur-status', '');
  status.setAttribute('role', 'status');
  const dirty = () => { status.textContent = 'Unsaved changes.'; };

  const main = switchRow({
    iconName: 'bolt', title: 'Enable Surprise Mode', hint: 'Turn on the hidden romantic/prank mode.',
    checked: surprise.enabled, className: 'sur-main',
    onChange: value => { surprise.enabled = value; syncBody(); dirty(); }
  });
  main.label.classList.add('set-card', 'sur-enable');

  const body = el('div', 'sur-body');
  const levelCard = el('section', 'set-card sur-level');
  const levelHead = el('h2', '', '');
  levelHead.innerHTML = icon('target') + '<span>Surprise level</span>';
  const levelRow = el('div', 'sur-level-row');
  levelRow.setAttribute('role', 'radiogroup');
  levelRow.setAttribute('aria-label', 'Surprise level');
  const levelButtons = Array.from({ length: LEVEL_COUNT }, (_, index) => {
    const button = el('button', 'sur-pill', String(index + 1));
    button.type = 'button';
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-label', 'Level ' + (index + 1));
    button.addEventListener('click', () => { surprise.level = index + 1; syncLevel(); dirty(); });
    return button;
  });
  levelRow.append(...levelButtons);
  levelRow.addEventListener('keydown', event => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    surprise.level = (surprise.level - 1 + step + LEVEL_COUNT) % LEVEL_COUNT + 1;
    syncLevel(); dirty();
    levelButtons[surprise.level - 1].focus();
  });
  function syncLevel() {
    levelButtons.forEach((button, index) => {
      const on = index + 1 === surprise.level;
      button.setAttribute('aria-checked', String(on));
      button.tabIndex = on ? 0 : -1;
    });
  }
  syncLevel();
  levelCard.append(levelHead, levelRow, el('p', 'set-sub', 'Which level plays the trick. Level 1 means it starts right away.'));
  const switches = el('section', 'set-card sur-switches');
  switches.append(
    switchRow({
      iconName: 'target', title: 'Make every guess fail', hint: 'Keep the game going until the reveal.',
      checked: surprise.failAll, onChange: value => { surprise.failAll = value; dirty(); }
    }).label,
    switchRow({
      iconName: 'gift', title: 'Reveal message after final try', hint: 'Show your custom message at the end.',
      checked: surprise.reveal, className: 'set-divided', onChange: value => { surprise.reveal = value; dirty(); }
    }).label
  );

  const msgCard = el('section', 'set-card sur-message');
  const lines = el('div', 'sur-lines');
  lines.innerHTML = '<h2>' + icon('apps') + '<span>Custom Message <small>(' + ATTEMPTS + ' rows)</small></span></h2>' +
    '<p class="set-sub">The message revealed at the end.</p>';
  const presetRow = el('div', 'sur-presets');
  presetRow.setAttribute('role', 'group');
  presetRow.setAttribute('aria-label', 'Message presets');
  for (const [key, label] of SURPRISE_PRESETS) {
    const button = el('button', 'preset-btn', label);
    button.type = 'button';
    button.addEventListener('click', () => {
      surprise.message = app.presets[key].slice();
      for (const [index, input] of lineInputs.entries()) input.value = surprise.message[index];
      paintPreview();
      dirty();
    });
    presetRow.append(button);
  }
  lines.append(presetRow);
  const lineInputs = [];
  const board = el('div', 'board sur-board');
  board.setAttribute('role', 'img');
  const previewBox = el('div', 'sur-preview');
  previewBox.innerHTML = '<h2>' + icon('eye') + '<span>Preview <small>(End State)</small></span></h2>' +
    '<p class="set-sub">How it will look when revealed.</p>';
  previewBox.append(board);
  function paintPreview() {
    board.replaceChildren(...surprise.message.map((line, index) => {
      const row = makeRow(line, null, index);
      for (const tile of row.children) {
        if (tile.classList.contains('ghost')) {
          tile.classList.remove('ghost');
          tile.classList.add('blank');
        }
        tile.removeAttribute('aria-hidden');
      }
      return row;
    }));
    board.setAttribute('aria-label', 'Preview: ' + surprise.message.filter(Boolean).join(', '));
  }
  surprise.message.forEach((line, index) => {
    const row = el('div', 'sur-line');
    const number = el('span', 'sur-num', String(index + 1));
    number.setAttribute('aria-hidden', 'true');
    const input = el('input', 'set-input word-input');
    input.id = 'surLine' + index;
    input.value = line;
    input.maxLength = WORD_LENGTH;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Message row ' + (index + 1));
    input.addEventListener('input', () => {
      const clean = input.value.toUpperCase().replace(/[^A-Z♡♥]/g, '').slice(0, WORD_LENGTH);
      if (input.value !== clean) input.value = clean;
      surprise.message[index] = clean;
      paintPreview();
      dirty();
    });
    row.append(number, input);
    lineInputs.push(input);
    lines.append(row);
  });
  paintPreview();
  msgCard.append(lines, previewBox);

  const headCard = el('section', 'set-card sur-headline');
  headCard.innerHTML = '<h2>' + icon('sparkle') + '<span>Reveal headline</span></h2>' +
    '<p class="set-sub">The big title when the message is revealed.</p>';
  const headInput = el('input', 'set-input');
  headInput.type = 'text';
  headInput.id = 'surHeadline';
  headInput.maxLength = HEADLINE_MAX;
  headInput.value = surprise.headline;
  headInput.placeholder = DEFAULT_HEADLINE;
  headInput.setAttribute('aria-label', 'Reveal headline');
  headInput.addEventListener('input', () => { surprise.headline = headInput.value; dirty(); });
  headCard.append(headInput);

  const noteCard = el('section', 'set-card sur-note');
  noteCard.innerHTML = '<h2>' + icon('pencil') + '<span>Final note</span></h2>' +
    '<p class="set-sub">A short message shown below the board.</p>';
  const noteInput = el('input', 'set-input');
  noteInput.type = 'text';
  noteInput.id = 'surNote';
  noteInput.maxLength = 130;
  noteInput.value = surprise.note;
  noteInput.setAttribute('aria-label', 'Final note');
  noteInput.addEventListener('input', () => { surprise.note = noteInput.value; dirty(); });
  noteCard.append(noteInput);

  const actCard = el('section', 'set-card sur-act');
  const actLeft = el('div', 'sur-act-main');
  actLeft.innerHTML = '<h2>' + icon('bolt') + '<span>Activation</span></h2><p class="set-sub">When to trigger the reveal.</p>';
  const selectWrap = el('div', 'set-select');
  const select = el('select');
  select.id = 'surActivation';
  select.setAttribute('aria-label', 'Activation');
  for (const [value, label] of ACTIVATIONS) select.append(new Option(label, value));
  select.value = surprise.activation;
  select.addEventListener('change', () => { surprise.activation = select.value; dirty(); });
  selectWrap.innerHTML = icon('chevron');
  selectWrap.prepend(select);
  actLeft.append(selectWrap);
  const privacy = el('aside', 'sur-privacy');
  privacy.innerHTML = icon('lock') + '<span class="set-text"><b>Privacy</b><small>Keep this hidden from normal players.</small></span>';
  actCard.append(actLeft, privacy);

  body.append(levelCard, switches, msgCard, headCard, noteCard, actCard);

  const actions = el('div', 'sur-actions');
  const save = el('button', 'menu-btn primary', '');
  save.type = 'button';
  save.innerHTML = icon('check') + '<span>Save Setup</span>';
  const test = el('button', 'menu-btn', '');
  test.type = 'button';
  test.innerHTML = icon('play') + '<span>Test Reveal</span>';
  actions.append(save, test);
  save.addEventListener('click', () => {
    // An empty headline falls back to the default text.
    if (!surprise.headline.trim()) { surprise.headline = DEFAULT_HEADLINE; headInput.value = DEFAULT_HEADLINE; }
    saveStorage(SURPRISE_KEY, surprise);
    app.applySurprise({ ...surprise, message: surprise.message.slice() });
    renderAnswers();
    status.textContent = 'Saved.';
    showToast('Settings saved');
  });
  test.addEventListener('click', () => app.testReveal(surprise.message.slice(), surprise.note, surprise.headline.trim() || DEFAULT_HEADLINE));

  function syncBody() {
    body.classList.toggle('is-off', !surprise.enabled);
    body.inert = !surprise.enabled;
  }
  syncBody();
  surprisePage.append(sHead, main.label, body, actions, status);

  // ---- navigation --------------------------------------------------------
  const navItems = [...screen.querySelectorAll('[data-set]')];
  function setPage(name) {
    page = name;
    const isSurprise = name === 'surprise';
    general.hidden = isSurprise;
    surprisePage.hidden = !isSurprise;
    for (const item of navItems) {
      if (item.dataset.set === 'home') continue;
      if (item.dataset.set === name || (!isSurprise && name === 'general' && item.dataset.set === 'general')) {
        item.setAttribute('aria-current', 'page');
      } else item.removeAttribute('aria-current');
    }
    const target = { audio: 'setAudioCard', themes: 'setThemeCard', mascot: 'setMascotCard' }[name];
    const scroller = screen.querySelector('.set-main');
    if (target) {
      const card = $(target);
      scroller.scrollTo({ top: card.offsetTop - 12, behavior: motion.matches ? 'auto' : 'smooth' });
    } else scroller.scrollTop = 0;
  }
  screen.addEventListener('click', event => {
    const item = event.target.closest('[data-set]');
    if (!item) return;
    if (item.dataset.set === 'home') app.goHome();
    else setPage(item.dataset.set);
  });
  screen.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); app.goHome(); }
  });

  function refresh() {
    syncTheme();
    syncIcons();
    syncMascot();
    syncSkins();
    renderAnswers();
    const live = mix.get();
    mute.input.checked = live.muted;
    audioCard.classList.toggle('is-muted', live.muted);
    musicOn.input.checked = live.musicOn;
    for (const [control, value] of [[music, live.music], [sfx, live.sfx]]) {
      control.input.value = value;
      control.paint();
    }
  }
  syncTheme();
  syncIcons();
  syncMascot();
  syncSkins();
  renderAnswers();
  pushIcon();

  return {
    visible: () => !screen.hidden,
    hide() { screen.hidden = true; },
    show(name = 'general') {
      $('menuScreen').hidden = true;
      root.classList.add('menu-away');
      screen.hidden = false;
      refresh();
      setPage(name);
      screen.querySelector('.set-wrap').focus({ preventScroll: true });
    },
    page: () => page
  };
}
