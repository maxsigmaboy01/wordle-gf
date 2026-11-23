import classicThumb from './assets/themes/classic.png';
import christmasThumb from './assets/themes/christmas.png';
import springThumb from './assets/themes/spring.png';
import halloweenThumb from './assets/themes/halloween.png';
import spaceThumb from './assets/themes/space.png';
import summerThumb from './assets/themes/summer.png';
import valentineThumb from './assets/themes/valentine.png';
import rainyThumb from './assets/themes/rainy.png';
import duckLoop from './assets/companions/summer_duck.gif';
import duckStill from './assets/companions/summer_duck.png';
import santaLoop from './assets/seasons/02_christmas_santa_wave.gif';
import santaStill from './assets/seasons/02_christmas_santa_wave.png';
import bunnyLoop from './assets/seasons/03_spring_blossom_bunny.gif';
import bunnyStill from './assets/seasons/03_spring_blossom_bunny.png';
import ghostLoop from './assets/seasons/04_halloween_pumpkin_ghost.gif';
import ghostStill from './assets/seasons/04_halloween_pumpkin_ghost.png';
import { appIconSrc } from './app-icons.js';
import { paintMascot } from './mascots.js';
import { setupDinoFx } from './dino-fx.js';
import { noteTheme } from './progress-store.js';
import { setupProgress } from './progress-ui.js';
import { setupScene } from './scene.js';
import { initToast, showToast } from './toast.js';
import { el } from './views.js';

export const themeCards = [
  ['classic', 'Classic', 'The original, cozy look.', classicThumb],
  ['christmas', 'Christmas', 'A cozy holiday edition.', christmasThumb],
  ['spring', 'Spring Blossom', 'Fresh and full of blooms.', springThumb],
  ['halloween', 'Halloween', 'Spooky, but still cute.', halloweenThumb],
  ['space', 'Space Night', 'A starry adventure.', spaceThumb],
  ['summer', 'Summer Picnic', 'Sunny, relaxed vibes.', summerThumb],
  ['valentine', 'Valentine', 'Sweet and a little extra.', valentineThumb],
  ['rainy', 'Rainy Day', 'Cozy drizzle vibes.', rainyThumb]
];

export function menuEnabled() {
  if (document.getElementById('love-puzzle')?.dataset.mode === 'play') return false;
  return Boolean(window.__TAURI__) || location.hash.startsWith('#menu');
}

export function setupMenu(app) {
  const $ = id => document.getElementById(id);
  const { root, seasons, seasonSelect, soundControl, reducedMotion, prefs } = app;
  const screen = $('menuScreen'), themeDialog = $('themeDialog'), grid = $('themeGrid');
  const tauri = window.__TAURI__;
  let pending = seasons.current();

  document.documentElement.classList.add('has-menu');
  $('homeBtn').hidden = false;
  initToast();
  const scene = setupScene(() => seasons.current());
  const fx = setupDinoFx({ reducedMotion });
  const sideTemplate = $('sideTpl').content.firstElementChild;
  noteTheme(seasons.current());

  const progress = setupProgress({
    reducedMotion,
    getHistory: app.getHistory,
    sidebar: sideTemplate,
    chestSrc: document.querySelector('.mascot-chest').src
  });
  document.body.append(progress.screen);

  // Small in-app confirm before a new game wipes progress.
  const confirmDialog = document.createElement('dialog');
  confirmDialog.className = 'confirm-dialog';
  confirmDialog.dataset.menuOnly = '';
  confirmDialog.setAttribute('aria-labelledby', 'confirmTitle');
  confirmDialog.innerHTML = '<span class="confirm-ic" aria-hidden="true"><svg class="ic"><use href="#i-refresh"/></svg></span>' +
    '<h2 id="confirmTitle">Start a new game?</h2><p>Your current progress will reset.</p>' +
    '<div class="confirm-actions"><button type="button" class="menu-btn" data-confirm="no">Keep playing</button>' +
    '<button type="button" class="menu-btn primary" data-confirm="yes">New game</button></div>';
  document.body.append(confirmDialog);

  // Quit only makes sense inside the app.
  const invoke = tauri?.core?.invoke;
  if (!invoke) screen.querySelector('[data-menu="quit"]').remove();

  // ---- Play screen inside the app shell (menu mode only) ----------------------
  // The same sidebar as Home, a header, the board card and a side panel. All of it is built here so
  // the web player, iOS and exported HTML never see it; `data-menu-only` / `data-menu-wrap` mark what
  // the export strips or unwraps (see downloadGame in app.js).
  const phone = $('puzzlePhone');
  const playSide = sideTemplate.cloneNode(true);
  playSide.id = 'playSide';
  playSide.dataset.menuOnly = '';
  playSide.querySelector('[data-menu="play"]').setAttribute('aria-current', 'page');

  const legend = [['green', 'Right letter, right place.'], ['yellow', 'Right letter, wrong place.'], ['gray', 'Not in the word.']];
  const playHead = el('header', 'play-head');
  playHead.dataset.menuOnly = '';
  playHead.innerHTML = '<div class="play-head-text"><p class="eyebrow" id="playEyebrow"></p>' +
    '<h1>Find the hidden word.</h1>' +
    '<p class="play-sub"><strong id="playLevel"></strong><progress id="playTrack" aria-label="Level progress"></progress>' +
    '<span>Six tries. Five letters. You know the drill.</span></p></div>' +
    '<div class="play-head-actions">' +
    '<button type="button" class="menu-btn" data-menu="help"><svg class="ic" aria-hidden="true"><use href="#i-help"/></svg><span>Rules</span></button>' +
    '<button type="button" class="menu-btn" data-menu="new-game"><svg class="ic" aria-hidden="true"><use href="#i-refresh"/></svg><span>New</span></button></div>';
  const playAside = el('aside', 'play-aside');
  playAside.dataset.menuOnly = '';
  playAside.setAttribute('aria-label', 'Hints');
  playAside.innerHTML = '<div class="aside-mascot"><img id="playMascot" alt="" width="160" height="160"><b>You got this!</b></div>' +
    '<ul class="legend" aria-label="Tile colors">' +
    legend.map(([tone, text]) => '<li><i class="chip ' + tone + '" aria-hidden="true"></i>' + text + '</li>').join('') + '</ul>' +
    '<p class="aside-hint"><svg class="ic" aria-hidden="true"><use href="#i-keyboard"/></svg><span>Physical keyboard works, too.<br>Press Enter to submit your guess.</span></p>';
  // The theme's companion keeps the dino company: small in the play panel, and on Home it stands
  // opposite the dino so the two flank the menu. Themes without one show nothing (no src, so CSS hides it).
  const companions = {
    christmas: { loop: santaLoop, still: santaStill },
    spring: { loop: bunnyLoop, still: bunnyStill },
    halloween: { loop: ghostLoop, still: ghostStill },
    summer: { loop: duckLoop, still: duckStill }
  };
  const homeFriend = el('div', 'home-friend');
  homeFriend.dataset.menuOnly = '';
  homeFriend.setAttribute('aria-hidden', 'true');
  $('menuMascot').parentElement.before(homeFriend);
  for (const host of [playAside.querySelector('.aside-mascot'), homeFriend]) {
    const friend = el('img', 'companion');
    friend.alt = '';
    friend.width = friend.height = 512;
    host.append(friend);
  }
  const playCard = el('div', 'play-card');
  playCard.dataset.menuWrap = '';
  const playBody = el('div', 'play-body');
  playBody.dataset.menuWrap = '';
  const playMain = el('div', 'play-main');
  playMain.dataset.menuWrap = '';
  playCard.append(phone.querySelector('.meter'), $('board'), phone.querySelector('.status-slot'), $('keyboard'), $('viewResult'));
  playBody.append(playCard, playAside);
  playMain.append(playHead, playBody);
  phone.querySelector('.instructions').after(playMain);
  phone.prepend(playSide);

  function syncPlay() {
    $('playEyebrow').textContent = 'Daily challenge \u00b7 Puzzle #' + app.puzzleNumber();
    $('playLevel').textContent = $('levelNumber').textContent;
    $('playTrack').max = $('levelTrack').max;
    $('playTrack').value = $('levelTrack').value;
  }

  // The chosen mascot (Settings > Mascot) on Home, the sidebar and the play panel.
  function paintMascots() {
    const id = prefs?.mascot ?? 'classic';
    const friend = companions[seasons.current()];
    for (const img of document.querySelectorAll('.companion')) {
      if (friend) img.src = reducedMotion.matches ? friend.still : friend.loop;
      else img.removeAttribute('src');
    }
    for (const img of document.querySelectorAll('#menuMascot, .side-dino, #playMascot')) {
      paintMascot(img, id, reducedMotion.matches, seasons.current());
    }
  }

  // The sidebar brand mark is the app icon picked in Settings (the web player keeps its own tile mark).
  function paintBrand() {
    const src = appIconSrc(prefs?.appIcon);
    for (const img of document.querySelectorAll('.menu-brand .brand-icon')) img.src = src;
  }

  // ---- Home: a retro title screen with a cursor menu ----------------------------
  const homeMenu = $('homeMenu');
  const items = [...homeMenu.querySelectorAll('.home-item')];
  const usable = item => !item.disabled && item.getAttribute('aria-disabled') !== 'true';
  let cursor = 0;
  let hopTimer = 0;

  function setCursor(index, { quiet = false } = {}) {
    const item = items[index];
    if (!item || !usable(item)) return;
    const moved = index !== cursor;
    cursor = index;
    for (const other of items) other.classList.toggle('is-sel', other === item);
    homeMenu.setAttribute('aria-activedescendant', item.id);
    if (!moved || quiet) return;
    app.play('key_tap_b');
    const mascot = $('menuMascot');
    if (mascot.dataset.mascot === 'classic') fx.playFx(mascot, 'wave');
    else if (!reducedMotion.matches) {
      mascot.classList.remove('is-hop');
      void mascot.offsetWidth;
      mascot.classList.add('is-hop');
      clearTimeout(hopTimer);
      hopTimer = setTimeout(() => mascot.classList.remove('is-hop'), 420);
    }
  }

  function moveCursor(step) {
    let index = cursor;
    for (let tries = 0; tries < items.length; tries++) {
      index = (index + step + items.length) % items.length;
      if (usable(items[index])) return setCursor(index);
    }
  }

  const shown = () => !screen.hidden;
  const visible = () => shown() || Boolean(app.settings?.visible()) || progress.visible();

  function refresh() {
    $('menuPuzzle').textContent = 'Puzzle #' + app.puzzleNumber();
    $('menuSound').checked = soundControl.checked;
    const resumable = app.hasProgress();
    const cont = $('menuContinue');
    cont.setAttribute('aria-disabled', String(!resumable));
    cont.title = resumable ? '' : 'No game in progress';
    progress.refresh();
    paintMascots();
  }

  const overlays = () => [...app.dialogs.slice(1), themeDialog, confirmDialog];

  function closeOverlays() {
    for (const dialog of overlays()) if (dialog.open) dialog.close();
  }

  const blocked = () => app.dialogs[0].open;

  function showMenu() {
    if (blocked()) return;
    closeOverlays();
    app.settings?.hide();
    progress.hide();
    root.classList.add('menu-away');
    screen.hidden = false;
    refresh();
    // Resume is the natural first stop when there is a game to go back to.
    setCursor(app.hasProgress() ? items.indexOf($('menuContinue')) : 0, { quiet: true });
    homeMenu.focus({ preventScroll: true });
  }

  function showGame() {
    if (blocked()) return;
    closeOverlays();
    app.settings?.hide();
    progress.hide();
    screen.hidden = true;
    root.classList.remove('menu-away');
    syncPlay();
    paintMascots();
    app.focusGame();
  }

  function showStats() {
    if (blocked()) return;
    closeOverlays();
    app.settings?.hide();
    screen.hidden = true;
    root.classList.add('menu-away');
    progress.show();
    paintMascots();
    app.play('menu_open');
  }

  function openOnly(open) {
    if (blocked()) return;
    closeOverlays();
    open();
  }

  // Ask first when a game is in progress; nothing to lose means no dialog.
  function startNewGame() {
    app.newGame();
    showGame();
  }

  function askNewGame() {
    if (blocked() || confirmDialog.open) return;
    if (!app.needsConfirm()) return startNewGame();
    closeOverlays();
    app.play('menu_open');
    confirmDialog.showModal();
    confirmDialog.querySelector('[data-confirm="no"]').focus();
  }

  function buildThemeGrid() {
    grid.replaceChildren(...themeCards.map(([id, name, note, still]) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'theme-card';
      card.dataset.theme = id;
      card.setAttribute('role', 'radio');
      card.innerHTML = '<span class="theme-art"><img alt="" width="128" height="128"></span>' +
        '<span class="theme-badge" aria-hidden="true"><svg class="ic"><use href="#i-check"/></svg></span>' +
        '<b></b><small></small>';
      card.querySelector('img').src = still;
      card.querySelector('b').textContent = name;
      card.querySelector('small').textContent = note;
      card.addEventListener('click', () => select(id));
      return card;
    }));
  }

  function select(id) {
    pending = id;
    for (const card of grid.children) {
      const on = card.dataset.theme === id;
      card.setAttribute('aria-checked', String(on));
      card.tabIndex = on ? 0 : -1;
    }
  }

  function openThemes() {
    openOnly(() => {
      select(seasons.current());
      app.play('menu_open');
      themeDialog.showModal();
      grid.querySelector('[aria-checked="true"]')?.focus();
    });
  }

  function applyTheme() {
    if (pending !== seasons.current()) {
      seasonSelect.value = pending;
      seasonSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    themeDialog.close();
  }

  function route(action) {
    switch (action) {
      case 'home': return showMenu();
      case 'continue': case 'start': return showGame();
      case 'play': return showGame();
      case 'new-game': return askNewGame();
      case 'themes': return openThemes();
      case 'settings':
        if (blocked()) return;
        progress.hide();
        return openOnly(app.openSettings);
      case 'stats': return showStats();
      case 'help': return openOnly(app.openHelp);
      case 'quit': if (invoke) invoke('quit_app'); return;
    }
  }

  // While the board animates a guess or the level-3 fake-out, hold the last action until it is idle.
  let queued = null, waiter = 0;
  function go(action) {
    if (!app.isBusy()) return route(action);
    queued = action;
    if (waiter) return;
    waiter = setInterval(() => {
      if (app.isBusy()) return;
      clearInterval(waiter);
      waiter = 0;
      const next = queued;
      queued = null;
      route(next);
    }, 80);
  }

  buildThemeGrid();
  select(pending);

  for (const area of [screen, playSide, playHead, progress.screen]) {
    area.addEventListener('click', event => {
      const target = event.target.closest('[data-menu]');
      if (!target || !usable(target)) return;
      if (target.classList.contains('home-item')) pick(target);
      else go(target.dataset.menu);
    });
  }
  items.forEach((item, index) => {
    item.id ||= 'homeItem' + index;
    item.addEventListener('mouseenter', () => setCursor(index));
  });
  // The dialogs and screens play their own opening sound; the rest get a soft select blip here.
  function pick(item) {
    const action = item.dataset.menu;
    if (action === 'continue' || action === 'quit' || (action === 'new-game' && !app.needsConfirm())) app.play('menu_open');
    go(action);
  }
  // Home keys: arrows / W S move, Enter / Space pick. Everything else (letters!) is ignored, never typed into the board.
  const homeKeys = { ArrowDown: 1, s: 1, S: 1, ArrowUp: -1, w: -1, W: -1 };
  document.addEventListener('keydown', event => {
    if (!shown() || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (document.querySelector('dialog[open]') || event.target.closest?.('input, textarea, select')) return;
    const step = homeKeys[event.key];
    if (step) {
      event.preventDefault();
      moveCursor(step);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!event.repeat) {
        pick(items[cursor]);
      }
    }
  });
  // Space activates a focused button on key-up; Home already handled it on key-down.
  document.addEventListener('keyup', event => {
    if (event.key === ' ' && shown() && !event.target.closest?.('input, textarea, select')) event.preventDefault();
  });
  document.addEventListener('appiconchange', paintBrand);
  paintBrand();
  $('homeBtn').addEventListener('click', () => go('home'));
  $('menuSound').addEventListener('change', event => {
    soundControl.checked = event.target.checked;
    soundControl.dispatchEvent(new Event('change', { bubbles: true }));
  });
  soundControl.addEventListener('change', () => { $('menuSound').checked = soundControl.checked; });
  seasonSelect.addEventListener('change', () => {
    select(seasons.current());
    noteTheme(seasons.current());
    scene.render();
    paintMascots();
    progress.refresh();
    showToast(seasons.label() + ' applied!');
  });
  confirmDialog.addEventListener('click', event => {
    const choice = event.target.closest('[data-confirm]')?.dataset.confirm;
    if (event.target === confirmDialog || choice === 'no') confirmDialog.close();
    else if (choice === 'yes') {
      confirmDialog.close();
      startNewGame();
    }
  });
  progress.screen.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); go('home'); }
  });
  reducedMotion.addEventListener('change', paintMascots);
  document.addEventListener('mascotchange', paintMascots);
  $('themeApply').addEventListener('click', applyTheme);
  $('themeCancel').addEventListener('click', () => themeDialog.close());
  $('themeX').addEventListener('click', () => themeDialog.close());
  themeDialog.addEventListener('click', event => { if (event.target === themeDialog) themeDialog.close(); });
  grid.addEventListener('keydown', event => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = themeCards.findIndex(card => card[0] === pending);
    const next = themeCards[(index + step + themeCards.length) % themeCards.length][0];
    select(next);
    grid.querySelector('[aria-checked="true"]').focus();
  });

  if (tauri?.event?.listen) {
    const typing = () => document.activeElement?.matches?.('input, textarea, select, [contenteditable]');
    tauri.event.listen('menu-action', event => {
      // Cmd+N must not wipe a game while someone is typing in a settings field.
      if (event.payload === 'new-game' && typing()) return;
      go(event.payload);
    }).catch?.(() => {});
  } else {
    // Native menu owns these shortcuts in the app; in a browser preview handle them here.
    document.addEventListener('keydown', event => {
      if (!event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      if (event.target.isContentEditable || event.target.closest?.('input, textarea, select')) return;
      const action = { 1: 'home', 2: 'play', n: 'new-game', t: 'themes', 4: 'stats', ',': 'settings' }[event.key.toLowerCase()];
      if (!action) return;
      event.preventDefault();
      go(action);
    });
  }

  if (app.startOnGame) showGame();
  else showMenu();
  return { visible, showMenu, showGame, go, syncPlay };
}
