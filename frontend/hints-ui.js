// Hint UI for the app shell (menu mode only): the star counter, the "Hints" pill on the board card, the hint dialog,
// the clue pills above the keyboard and the struck-through keys. The rules live in backend/hints.js; this file only
// draws them and asks app.js to commit a confirmed hint. Everything it builds is marked data-menu-only.
import { hintOptions, useHint } from '../backend/hints.js';
import { showToast } from './toast.js';
import { el } from './views.js';

const COPY = {
  peek: { name: 'Letter Peek', note: 'See a letter in the word', icon: 'magnify' },
  lock: { name: 'Position Lock', note: 'Reveal one exact slot', icon: 'lock' },
  eliminate: { name: 'Eliminate 3', note: 'Remove three letters', icon: 'close' }
};
const star = '<svg class="star" aria-hidden="true"><use href="#i-star"/></svg>';
const icon = name => '<svg class="ic" aria-hidden="true"><use href="#i-' + name + '"/></svg>';

// app: { getRound, getState, canOpen, commit(result), play }
export function setupHintsUI(app) {
  const $ = id => document.getElementById(id);
  const button = $('hintBtn'), clueRow = $('clueRow'), keyboard = $('keyboard');
  const dialog = el('dialog', 'hint-dialog');
  dialog.dataset.menuOnly = '';
  dialog.setAttribute('aria-labelledby', 'hintTitle');
  dialog.innerHTML = '<h2 id="hintTitle">Need a little nudge?</h2>' +
    '<p class="hint-sub" id="hintSub"></p>' +
    '<div class="hint-cards" id="hintCards" role="radiogroup" aria-labelledby="hintTitle"></div>' +
    '<p class="hint-note" id="hintNote" role="status"></p>' +
    '<div class="hint-actions"><button type="button" class="menu-btn" id="hintNo">Not yet</button>' +
    '<button type="button" class="menu-btn primary" id="hintYes" disabled><span id="hintYesLabel">Use hint</span>' + icon('arrow') + '</button></div>';
  document.body.append(dialog);
  const cards = $('hintCards'), yes = $('hintYes');
  let options = [], picked = '', opener = null;

  const cardOf = type => [...cards.children].find(card => card.dataset.type === type);
  const usable = card => card.getAttribute('aria-disabled') !== 'true';

  function stars() { return app.getState().stars; }

  function pick(type, { focus = true } = {}) {
    const card = cardOf(type);
    if (!card || !usable(card)) return;
    picked = type;
    for (const other of cards.children) {
      const on = other === card;
      other.setAttribute('aria-checked', String(on));
      other.tabIndex = on ? 0 : -1;
    }
    $('hintYesLabel').textContent = 'Use ' + COPY[type].name;
    yes.disabled = false;
    $('hintNote').textContent = '';
    if (focus) card.focus();
  }

  function render() {
    options = hintOptions(app.getRound(), app.getState());
    $('hintSub').innerHTML = 'Your stars: <b class="hint-stars">' + star + ' ' + stars() + '</b><span aria-hidden="true"> &middot; </span>Pick one hint to use';
    picked = '';
    yes.disabled = true;
    $('hintYesLabel').textContent = 'Use hint';
    $('hintNote').textContent = '';
    cards.replaceChildren(...options.map(option => {
      const copy = COPY[option.type];
      const card = el('button', 'hint-card');
      card.type = 'button';
      card.dataset.type = option.type;
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', 'false');
      card.tabIndex = -1;
      if (!option.available) card.setAttribute('aria-disabled', 'true');
      card.innerHTML = '<span class="hint-ic">' + icon(copy.icon) + '</span><b class="hint-name"></b><span class="hint-desc"></span>' +
        '<span class="hint-cost" aria-label="Costs ' + option.cost + (option.cost === 1 ? ' star' : ' stars') + '">' + star + ' ' + option.cost + '</span>' +
        '<span class="hint-check" aria-hidden="true">' + icon('check') + '</span>';
      card.querySelector('.hint-name').textContent = copy.name;
      card.querySelector('.hint-desc').textContent = option.available ? copy.note : option.reason;
      if (!option.available) card.setAttribute('aria-description', option.reason);
      card.addEventListener('click', () => pick(option.type));
      return card;
    }));
    // One card is reachable with Tab; arrows then move between the usable ones.
    const first = [...cards.children].find(usable);
    if (first) first.tabIndex = 0;
    else $('hintNote').textContent = 'No hints are available right now.';
  }

  function open() {
    if (dialog.open || !app.canOpen()) return false;
    opener = document.activeElement;
    render();
    app.play('menu_open');
    dialog.showModal();
    ([...cards.children].find(usable) ?? $('hintNo')).focus();
    return true;
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  function confirm() {
    if (!picked) return;
    const round = app.getRound();
    const result = useHint(round, app.getState(), picked);
    if (!result.ok) {
      // Nothing was spent. Show why and refresh the cards in place.
      render();
      $('hintNote').textContent = result.reason;
      showToast(result.reason);
      return;
    }
    close();
    app.commit(result);
    app.play('hint_used');
    const entry = result.state.history.at(-1);
    showToast(COPY[picked].name + ': ' + (entry?.detail ?? 'hint added'));
  }

  // ---- dialog events -------------------------------------------------------
  yes.addEventListener('click', confirm);
  $('hintNo').addEventListener('click', close);
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  dialog.addEventListener('close', () => {
    // Back to the game: the board takes the keys again.
    if (opener?.isConnected && opener !== document.body && opener.closest?.('#hintBtn')) opener.focus({ preventScroll: true });
    else app.focusGame?.();
    opener = null;
  });
  dialog.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    const inCards = event.target.closest?.('.hint-card');
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (step && inCards) {
      event.preventDefault();
      const list = [...cards.children].filter(usable);
      if (!list.length) return;
      const at = list.indexOf(event.target);
      pick(list[(at + step + list.length) % list.length].dataset.type);
    } else if (event.key === 'Enter' && inCards && !event.repeat) {
      event.preventDefault();
      // First Enter selects the focused card, the next one confirms it.
      if (usable(inCards) && picked !== inCards.dataset.type) pick(inCards.dataset.type);
      else confirm();
    } else if (event.key === 'Tab') {
      // Keep Tab inside the dialog.
      const stops = [...dialog.querySelectorAll('.hint-card[tabindex="0"], button:not([disabled]):not(.hint-card)')];
      if (!stops.length) return;
      const at = stops.indexOf(document.activeElement);
      const next = stops[(at + (event.shiftKey ? -1 : 1) + stops.length) % stops.length];
      if ((event.shiftKey && at <= 0) || (!event.shiftKey && at === stops.length - 1) || at < 0) {
        event.preventDefault();
        next.focus();
      }
    }
    event.stopPropagation();
  });

  // ---- the board card -----------------------------------------------------
  button.addEventListener('click', event => {
    if (event.detail > 0) button.blur();
    open();
  });
  // "?" opens the dialog (H is a letter and Cmd+H belongs to the system).
  document.addEventListener('keydown', event => {
    if (event.key !== '?' || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (event.target.closest?.('input, textarea, select') || event.target.isContentEditable) return;
    if (document.querySelector('dialog[open]')) return;
    if (open()) event.preventDefault();
  });

  // ---- sync with the round ------------------------------------------------
  function pills(state) {
    const list = [];
    for (const letter of state.peeks) list.push(['Contains ' + letter, 'magnify', 'Contains the letter ' + letter]);
    Object.keys(state.locks).sort().forEach(slot => list.push(['Slot ' + slot + ' is ' + state.locks[slot], 'lock', 'Slot ' + slot + ' is ' + state.locks[slot]]));
    for (let i = 0; i < state.eliminated.length; i += 3) {
      const group = state.eliminated.slice(i, i + 3);
      list.push(['No ' + group.join(' · '), 'close', 'Not in the word: ' + group.join(', ')]);
    }
    return list;
  }

  function sync() {
    const state = app.getState();
    const round = app.getRound();
    const on = state.enabled !== false;
    $('hudStars').hidden = !on;
    $('hudStarCount').textContent = state.stars;
    $('hudStars').setAttribute('aria-label', state.stars + (state.stars === 1 ? ' hint star' : ' hint stars'));
    button.hidden = !on;
    $('hintBtnCount').textContent = state.stars;
    const finished = Boolean(round?.finished());
    button.disabled = finished;
    button.setAttribute('aria-label', 'Hints, ' + state.stars + (state.stars === 1 ? ' star' : ' stars') + (finished ? ', round finished' : ''));
    clueRow.replaceChildren(...pills(state).map(([text, name, label]) => {
      const pill = el('span', 'clue-pill');
      pill.setAttribute('role', 'listitem');
      pill.setAttribute('aria-label', label);
      pill.innerHTML = icon(name);
      pill.append(el('span', '', text));
      return pill;
    }));
    const gone = new Set(state.eliminated);
    for (const key of keyboard.querySelectorAll('[data-key]')) {
      const out = gone.has(key.dataset.key);
      key.classList.toggle('eliminated', out);
      key.setAttribute('aria-label', out ? key.dataset.key + ', eliminated' : key.dataset.key === '↵' ? 'Enter' : key.dataset.key === '⌫' ? 'Backspace' : key.dataset.key);
    }
    // A round that ends (or a settings change) while the dialog is open closes it.
    if (dialog.open && (finished || !on)) close();
  }

  return { sync, open, close, isOpen: () => dialog.open };
}
