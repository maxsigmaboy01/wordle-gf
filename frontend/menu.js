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
  ['classic', 'Classic Meadow', 'The original, cozy look.', classicThumb],
  ['christmas', 'Christmas Village', 'A cozy holiday edition.', christmasThumb],
  ['spring', 'Spring Blossom', 'Fresh and full of blooms.', springThumb],
  ['halloween', 'Halloween', 'Spooky, but still cute.', halloweenThumb],
  ['space', 'Space Night', 'A starry adventure.', spaceThumb],
  ['summer', 'Summer Picnic', 'Sunny, relaxed vibes.', summerThumb],
  ['valentine', 'Valentine', 'Sweet and a little extra.', valentineThumb],
  ['rainy', 'Rainy Day', 'Cozy drizzle vibes.', rainyThumb]
];

export const themeName = id => themeCards.find(card => card[0] === id)?.[1] ?? '';

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

  // Pause overlay: a native modal dialog, so the board gets no keys while it is open and it dims everything behind it.
  const pauseDialog = document.createElement('dialog');
  pauseDialog.className = 'pause-dialog';
  pauseDialog.id = 'pauseDialog';
  pauseDialog.dataset.menuOnly = '';
  pauseDialog.setAttribute('aria-labelledby', 'pauseTitle');
  const pauseItems = [['resume', 'RESUME'], ['new-game', 'NEW GAME'], ['help', 'HOW TO PLAY'], ['settings', 'SETTINGS'], ['home', 'HOME']];
  pauseDialog.innerHTML = '<h2 class="pause-title" id="pauseTitle">PAUSED</h2>' +
    '<nav class="home-menu" id="pauseMenu" role="menu" aria-label="Pause menu">' +
    pauseItems.map(([action, label]) => '<button type="button" role="menuitem" tabindex="-1" class="home-item" data-menu="' + action + '">' + cursorSvgText() + '<span>' + label + '</span></button>').join('') +
    '</nav><p class="pause-hint">ESC TO RESUME</p>';
  document.body.append(pauseDialog);
  function cursorSvgText() {
    return '<svg class="home-cursor" viewBox="0 0 4 7" aria-hidden="true" shape-rendering="crispEdges"><path d="M0 0h1v1h1v1h1v1h1v1H3v1H2v1H1v1H0z" fill="currentColor"/></svg>';
  }

  // Quit only makes sense inside the app.
  const invoke = tauri?.core?.invoke;
  if (!invoke) screen.querySelector('[data-menu="quit"]').remove();

  // ---- Play screen inside the app shell (menu mode only) ----------------------
  // A focused view: thin HUD on top, the board card centered, the mascots standing beside it. No sidebar.
  // All of it is built here so the web player, iOS and exported HTML never see it; `data-menu-only` /
  // `data-menu-wrap` mark what the export strips or unwraps (see downloadGame in app.js).
  const phone = $('puzzlePhone');
  const hud = el('header', 'play-hud');
  hud.dataset.menuOnly = '';
  hud.innerHTML = '<div class="hud-left"><button type="button" class="hud-btn" data-menu="pause" aria-label="Pause menu" title="Pause (Esc)"><svg class="ic" aria-hidden="true"><use href="#i-pause"/></svg></button></div>' +
    '<div class="hud-center" role="status"><span class="hud-level"><span class="hud-word">Level</span><b id="hudLevel"></b></span>' +
    '<span class="hud-pips" id="hudPips" aria-hidden="true"></span><span class="hud-tries" id="hudTries"></span>' +
    '<span class="hud-stars" id="hudStars" role="img"><svg class="star" aria-hidden="true"><use href="#i-star"/></svg><b id="hudStarCount"></b></span></div>' +
    '<div class="hud-right"><span class="hud-puzzle" id="hudPuzzle"></span>' +
    '<button type="button" class="hud-btn" id="hudTheme" data-menu="themes" aria-label="Change theme" title="Theme"><svg class="ic" aria-hidden="true"><use href="#i-palette"/></svg></button>' +
    '<button type="button" class="hud-btn hud-sound" id="hudSound" aria-pressed="true" aria-label="Sound" title="Sound"><svg class="ic" aria-hidden="true"><use href="#i-sound"/></svg></button></div>';
  // The theme's companion keeps the dino company: on Home it stands opposite the dino, and on the play
  // screen it stands opposite the dino beside the board. Themes without one show nothing (no src, so CSS hides it).
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
  const sideL = el('div', 'play-side play-side-l');
  const sideR = el('div', 'play-side play-side-r');
  for (const side of [sideL, sideR]) {
    side.dataset.menuOnly = '';
    side.setAttribute('aria-hidden', 'true');
  }
  const mascot = el('img', 'play-mascot');
  mascot.id = 'playMascot';
  mascot.alt = '';
  mascot.width = mascot.height = 160;
  sideL.append(mascot);
  for (const host of [sideR, homeFriend]) {
    const friend = el('img', 'companion');
    friend.alt = '';
    friend.width = friend.height = 512;
    host.append(friend);
  }
  // The treasure chest stands on the scene floor on the right: full size alone, small beside a companion.
  const chest = el('img', 'play-chest');
  chest.alt = '';
  chest.width = 130;
  chest.height = 113;
  chest.src = document.querySelector('.mascot-chest').src;
  // Wide screens only (CSS): the theme name, a quiet label rather than a panel.
  const themePill = el('span', 'theme-pill');
  sideR.append(chest, themePill);
  const playCard = el('div', 'play-card');
  playCard.dataset.menuWrap = '';
  const playStage = el('div', 'play-stage');
  playStage.dataset.menuWrap = '';
  const cardHead = el('div', 'card-head');
  cardHead.dataset.menuOnly = '';
  cardHead.innerHTML = '<span class="card-label">Find the five-letter word</span>' +
    '<button type="button" class="hint-btn" id="hintBtn" aria-haspopup="dialog" title="Hints (?)"><span>Hints</span>' +
    '<svg class="star" aria-hidden="true"><use href="#i-star"/></svg><b id="hintBtnCount"></b></button>';
  const clueRow = el('div', 'clue-row');
  clueRow.id = 'clueRow';
  clueRow.dataset.menuOnly = '';
  clueRow.setAttribute('role', 'list');
  clueRow.setAttribute('aria-label', 'Hints used');
  playCard.append(cardHead, phone.querySelector('.meter'), $('board'), phone.querySelector('.status-slot'), clueRow, $('keyboard'), $('viewResult'));
  playStage.append(sideL, playCard, sideR);
  phone.querySelector('.instructions').after(playStage);
  phone.prepend(hud);

  // HUD readout: level, pips, tries, puzzle number and the sound toggle. Called whenever the board redraws.
  function syncPlay() {
    const max = Number($('levelTrack').max) || 5, now = Number($('levelTrack').value) || 1;
    $('hudLevel').textContent = now + ' / ' + max;
    if ($('hudPips').children.length !== max) $('hudPips').replaceChildren(...Array.from({ length: max }, () => document.createElement('i')));
    [...$('hudPips').children].forEach((pip, index) => {
      pip.className = index < now - 1 ? 'done' : index === now - 1 ? 'now' : '';
    });
    $('hudTries').textContent = $('turnBadge').textContent.replace(' left', '');
    $('hudPuzzle').textContent = '#' + app.puzzleNumber();
    $('hudSound').setAttribute('aria-pressed', String(soundControl.checked));
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
    sideR.classList.toggle('has-friend', Boolean(friend));
    themePill.textContent = themeName(seasons.current());
  }

  // The sidebar brand mark is the app icon picked in Settings (the web player keeps its own tile mark).
  function paintBrand() {
    const src = appIconSrc(prefs?.appIcon);
    for (const img of document.querySelectorAll('.menu-brand .brand-icon')) img.src = src;
  }

  // ---- Home: a retro title screen with a cursor menu ----------------------------
  const usable = item => !item.disabled && item.getAttribute('aria-disabled') !== 'true';

  // One cursor menu component, used by Home and the pause overlay: a highlighted row, a blinking arrow,
  // arrow keys / W S to move, Enter / Space to pick, mouse hover to move and click to pick.
  function cursorMenu(nav, { onMove, onPick }) {
    const list = [...nav.querySelectorAll('.home-item')];
    let at = 0;
    function set(index, { quiet = false } = {}) {
      const item = list[index];
      if (!item || !usable(item)) return;
      const moved = index !== at;
      at = index;
      for (const other of list) other.classList.toggle('is-sel', other === item);
      nav.setAttribute('aria-activedescendant', item.id);
      if (moved && !quiet) onMove?.(item);
    }
    function move(step) {
      let index = at;
      for (let tries = 0; tries < list.length; tries++) {
        index = (index + step + list.length) % list.length;
        if (usable(list[index])) return set(index);
      }
    }
    const keys = { ArrowDown: 1, s: 1, S: 1, ArrowUp: -1, w: -1, W: -1 };
    // Returns true when the key was a menu key.
    function key(event) {
      const step = keys[event.key];
      if (step) {
        event.preventDefault();
        move(step);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!event.repeat) onPick(list[at]);
      } else return false;
      return true;
    }
    list.forEach((item, index) => {
      item.id ||= nav.id + 'Item' + index;
      item.addEventListener('mouseenter', () => set(index));
    });
    return { items: list, set, move, key, get at() { return at; } };
  }

  let hopTimer = 0;
  const home = cursorMenu($('homeMenu'), {
    onMove() {
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
    },
    onPick: pick
  });
  const homeMenu = $('homeMenu');

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

  const overlays = () => [...app.dialogs.slice(1), themeDialog, confirmDialog, pauseDialog];

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
    home.set(app.hasProgress() ? home.items.indexOf($('menuContinue')) : 0, { quiet: true });
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

  // ---- Pause ----------------------------------------------------------------------
  let pauseMenu = null;
  function gameVisible() {
    return screen.hidden && !app.settings?.visible() && !progress.visible() && !app.dialogs[0].open;
  }
  function openPause() {
    if (pauseDialog.open || !gameVisible() || document.querySelector('dialog[open]')) return;
    app.play('menu_open');
    pauseDialog.showModal();
    pauseMenu.set(0, { quiet: true });
    pauseDialog.focus({ preventScroll: true });
  }
  function closePause() {
    if (!pauseDialog.open) return;
    pauseDialog.close();
    app.play('menu_open');
    if (gameVisible()) app.focusGame();
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
      case 'pause': return openPause();
      case 'resume': return closePause();
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

  for (const area of [screen, hud, pauseDialog, progress.screen]) {
    area.addEventListener('click', event => {
      const target = event.target.closest('[data-menu]');
      if (!target || !usable(target)) return;
      if (target.classList.contains('home-item') && area !== pauseDialog) pick(target);
      else if (area === pauseDialog) pickPause(target);
      else go(target.dataset.menu);
    });
  }
  pauseMenu = cursorMenu($('pauseMenu'), { onMove: () => app.play('key_tap_b'), onPick: pickPause });
  // The dialogs and screens play their own opening sound; the rest get a soft select blip here.
  function pickPause(item) {
    const action = item?.dataset.menu;
    if (!action) return;
    if (action === 'resume') closePause();
    else go(action);
  }
  function pick(item) {
    const action = item.dataset.menu;
    if (action === 'continue' || action === 'quit' || (action === 'new-game' && !app.needsConfirm())) app.play('menu_open');
    go(action);
  }
  // Home keys: arrows / W S move, Enter / Space pick. Everything else (letters!) is ignored, never typed into the board.
  document.addEventListener('keydown', event => {
    if (!shown() || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (document.querySelector('dialog[open]') || event.target.closest?.('input, textarea, select')) return;
    home.key(event);
  });
  // Pause keys: the same cursor keys; Esc closes. The dialog is modal, so nothing reaches the board.
  pauseDialog.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closePause();
    } else if (pauseMenu.key(event)) event.stopPropagation();
  });
  pauseDialog.addEventListener('cancel', event => { event.preventDefault(); closePause(); });
  // Esc on the play screen opens the pause menu (Home is reachable from it).
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (!gameVisible() || document.querySelector('dialog[open]')) return;
    event.preventDefault();
    go('pause');
  });
  // Space activates a focused button on key-up; Home already handled it on key-down.
  document.addEventListener('keyup', event => {
    if (event.key === ' ' && shown() && !event.target.closest?.('input, textarea, select')) event.preventDefault();
  });
  document.addEventListener('appiconchange', paintBrand);
  paintBrand();
  $('homeBtn').addEventListener('click', () => go('home'));
  $('hudSound').addEventListener('click', () => {
    soundControl.checked = !soundControl.checked;
    soundControl.dispatchEvent(new Event('change', { bubbles: true }));
  });
  $('menuSound').addEventListener('change', event => {
    soundControl.checked = event.target.checked;
    soundControl.dispatchEvent(new Event('change', { bubbles: true }));
  });
  soundControl.addEventListener('change', () => { $('menuSound').checked = soundControl.checked; syncPlay(); });
  seasonSelect.addEventListener('change', () => {
    select(seasons.current());
    noteTheme(seasons.current());
    scene.render();
    paintMascots();
    progress.refresh();
    showToast(themeName(seasons.current()) + ' applied!');
  });
  pauseDialog.addEventListener('click', event => { if (event.target === pauseDialog) closePause(); });
  pauseDialog.addEventListener('close', () => { if (gameVisible()) app.focusGame(); });
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
  // Changing the theme in the middle of a round only repaints; hand the keys back to the board afterwards.
  themeDialog.addEventListener('close', () => { if (gameVisible()) app.focusGame(); });
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
