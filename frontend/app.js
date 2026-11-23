import { ATTEMPTS as rows, WORD_LENGTH as len, createPuzzle } from '../backend/game.js';
import { LEVEL_COUNT, SURPRISE_LEVEL, baseAnswers, campaignAnswers, isSurpriseLevel, nextLevel, resolveSurprise, resumeLevel } from '../backend/campaign.js';
import words from '../backend/data/words.txt';
import answers from '../backend/data/answers.txt';
import { localDay } from '../backend/progress.js';
import { setupAudio } from './audio.js';
import { setupMenu, menuEnabled } from './menu.js';
import { setupSeasons } from './seasons.js';
import { paintMascot } from './mascots.js';
import { DEFAULT_HEADLINE, HEADLINE_MAX, applyPrefs, createMotion, loadPrefs, loadSurprise, setupSettings } from './settings.js';
import { logResult, noteReveal } from './progress-store.js';
import { showToast } from './toast.js';
import { readStorage, roundIdentifier, saveStorage } from './storage.js';
import { el, makeRow, ranks, renderExamples, renderStats } from './views.js';

const root = document.getElementById('love-puzzle');
const $ = id => document.getElementById(id);
const board = $('board'), keyboard = $('keyboard'), resultDialog = $('resultDialog');
const menuOn = menuEnabled();
const prefs = menuOn ? loadPrefs() : null;
// System preference or, in the mac app, the in-app override.
const reducedMotion = createMotion(Boolean(prefs?.reducedMotion));
const puzzle = createPuzzle({ words, answers });
const audio = setupAudio({
  allowMute: menuOn,
  soundControl: $('soundControl'),
  musicControl: $('musicControl'),
  volumeControl: $('volumeControl'),
  seasonSelect: $('seasonSelect')
});
const presets = {
  safe: ['YOU', 'ARE', 'MY', 'SAFE', 'PLACE', '♡'],
  love: ['I', 'LOVE', 'YOU', 'SO', 'MUCH', '♡'],
  happy: ['YOU', 'MAKE', 'ME', 'SO', 'HAPPY', '♡']
};
const settings = JSON.parse(root.dataset.puzzleConfig || '{}');
const seasons = setupSeasons({
  select: $('seasonSelect'),
  mascot: $('seasonMascot'),
  reducedMotion,
  settings,
  isEditor: Boolean($('editor'))
});
const defaultEnding = "I just wanted to say: I love you. ♡";
// The mac app keeps its own surprise settings; the exported player carries them in its config;
// the web player and iOS builds have none and keep the classic always-on surprise.
const storedSurprise = menuOn ? loadSurprise({ message: presets.safe, note: defaultEnding }) : null;
let surprise = resolveSurprise(storedSurprise ?? settings.surprise, root.dataset.mode === 'play' ? 'export' : 'app');
const cleanHeadline = value => (typeof value === 'string' && value.trim() && value.length <= HEADLINE_MAX ? value : DEFAULT_HEADLINE);
let headline = cleanHeadline(storedSurprise ? storedSurprise.headline : settings.headline);
let message = storedSurprise ? storedSurprise.message.slice() : settings.message || presets.safe.slice();
let ending = storedSurprise ? storedSurprise.note : settings.ending ?? defaultEnding;
const editorAnswersKey = 'daily-puzzle-editor-levels';
let overrides = settings.answers ?? ($('editor') ? readStorage(editorAnswersKey) : null);
let levelAnswers = campaignAnswers(overrides, puzzle.isWord, storedSurprise || settings.surprise ? surprise : undefined);
let level, round, roundId, puzzleId, isBusy;
let menu, settingsUI;
let surpriseConfig = null;
const timers = new Set();
const histories = new Map();

function schedule(callback, delay) {
  const timer = setTimeout(() => {
    timers.delete(timer);
    callback();
  }, delay);
  timers.add(timer);
}

function clearTimers() {
  timers.forEach(clearTimeout);
  timers.clear();
}

function flipRow(row, nextRow, delay = 0) {
  if (reducedMotion.matches) {
    row.replaceWith(nextRow);
    return;
  }
  schedule(() => audio.play('tile_flip'), delay);
  [...row.children].forEach((tile, col) => {
    const next = nextRow.children[col];
    const start = delay + col * 35;
    schedule(() => tile.classList.add('flip'), start);
    schedule(() => {
      tile.className = next.className + ' flip';
      tile.textContent = next.textContent;
      for (const attr of ['aria-hidden', 'aria-label']) {
        if (next.hasAttribute(attr)) tile.setAttribute(attr, next.getAttribute(attr));
        else tile.removeAttribute(attr);
      }
    }, start + 140);
  });
}

function buildKeyboard() {
  for (const line of ['QWERTYUIOP', 'ASDFGHJKL', '⌫ZXCVBNM↵']) {
    const row = el('div', 'keyrow');
    for (const key of line) {
      const button = el('button', 'key', key === '↵' ? '↵' : key);
      button.type = 'button';
      button.dataset.key = key;
      button.setAttribute('aria-label', key === '↵' ? 'Enter' : key === '⌫' ? 'Backspace' : key);
      if (key === '↵' || key === '⌫') button.classList.add('special');
      if (key === '↵') button.classList.add('submit');
      button.addEventListener('click', event => {
        if (event.detail > 0) board.focus({ preventScroll: true });
        inputKey(key);
      });
      row.appendChild(button);
    }
    keyboard.appendChild(row);
  }
}

function updateUI(pendingRow = -1) {
  const { guesses, colors, typed } = round;
  board.replaceChildren();
  for (let row = 0; row < rows; row++) {
    const letters = guesses[row] ?? (row === guesses.length ? typed : '');
    const rowElement = makeRow(letters, row === pendingRow ? null : colors[row]);
    if (row === guesses.length && !round.finished()) rowElement.dataset.active = '';
    board.appendChild(rowElement);
  }

  const keyColors = {};
  guesses.forEach((guess, row) => {
    if (row === pendingRow) return;
    [...guess].forEach((letter, col) => {
      keyColors[letter] = Math.max(colors[row][col], keyColors[letter] ?? -1);
    });
  });
  for (const button of keyboard.querySelectorAll('[data-key]')) {
    button.classList.remove(...ranks);
    const rank = keyColors[button.dataset.key];
    if (rank !== undefined) button.classList.add(ranks[rank]);
  }
  const remaining = rows - guesses.length;
  $('turnCounter').textContent = guesses.length + ' / ' + rows;
  $('turnBadge').textContent = remaining === 1 ? '1 try left' : remaining + ' tries left';
}

function setStatus(text, error = false) {
  const status = $('status');
  status.textContent = text;
  if (error) status.dataset.tone = 'error';
  else delete status.dataset.tone;
}

function rejectGuess(text) {
  audio.play('invalid_word');
  setStatus(text, true);
  const row = board.children[round.guesses.length];
  row.classList.remove('shake');
  row.classList.add('invalid');
  void row.offsetWidth;
  row.classList.add('shake');
}

function inputKey(key) {
  if (resultDialog.open || isBusy || round.finished()) return;
  if (key === '↵' || key === 'ENTER') {
    audio.play('key_enter');
    const row = round.guesses.length;
    const error = round.submit();
    if (error) return rejectGuess(error);

    setStatus('');
    isBusy = true;
    saveProgress();
    updateUI(row);
    flipRow(board.children[row], makeRow(round.guesses[row], round.colors[row]));
    const finishGuess = () => {
      audio.play(round.colors[row].includes(2) ? 'correct_letter' : 'guess_submitted');
      if (!round.finished() && round.guesses.length === rows - 1) audio.play('last_try');
      updateUI();
      if (menuOn) {
        const greens = round.colors[row].filter(color => color === 2).length;
        document.dispatchEvent(new CustomEvent('puzzlefx', { detail: { type: round.solved() ? 'win' : 'row', row, greens } }));
      }
      if (round.finished()) finishRound();
      else {
        isBusy = false;
        setStatus('Nice! Keep going…');
      }
    };
    if (reducedMotion.matches) finishGuess();
    else schedule(finishGuess, 430);
    return;
  }
  if (!round.type(key)) return;
  if (key === '⌫' || key === 'BACKSPACE') audio.play('key_backspace');
  else audio.tap();

  setStatus('');
  updateUI();
  saveProgress();
  if (/^[A-Z]$/.test(key)) {
    board.children[round.guesses.length]?.children[round.typed.length - 1]?.classList.add('pop');
  }
}

// The surprise level failed while the surprise is on and set to reveal by itself.
function autoRevealNow() {
  return isSurpriseLevel(level, surprise) && surprise.autoReveal && !round.solved();
}

function finishRound() {
  isBusy = true;
  recordResult();
  const fakeOut = autoRevealNow();
  if (fakeOut) audio.play('game_over_fakeout');
  setStatus(round.solved() ? 'Puzzle solved.' : 'Better luck next time.');
  schedule(showStageResult, fakeOut ? 1020 : 400);
}

function prepareResult(preview) {
  clearTimers();
  resultDialog.classList.remove('rv-final');
  if ($('playAgain')) $('playAgain').hidden = false;
  const { guesses, colors } = round;
  $('revealCard').hidden = true;
  seasons.stopMascot();
  $('resultActions').hidden = true;
  $('revealNow').hidden = true;
  $('resultNote').hidden = false;
  $('complaint').textContent = '';
  $('complaint').hidden = true;
  $('reportScam').disabled = false;
  $('shareNotice').textContent = '';
  $('shareFallback').hidden = true;
  $('shareFallback').value = '';
  $('resultBoard').setAttribute('aria-label', 'Puzzle result');
  $('resultBoard').replaceChildren(...Array.from({ length: rows }, (_, index) => (
    makeRow(preview ? '' : guesses[index] || '', preview ? null : colors[index])
  )));
}

function completeResult({ preview = false, canRetry = false } = {}) {
  isBusy = false;
  $('closeResult').disabled = false;
  $('viewResult').hidden = !round.finished();
  $('resultActions').hidden = preview;
  $('continueGame').textContent = level === LEVEL_COUNT ? 'Play again' : 'Next level';
  $('retryLevel').hidden = !canRetry;
  $('closeResult').focus({ preventScroll: true });
}

function showStageResult() {
  if (autoRevealNow()) {
    reveal();
    return;
  }

  prepareResult(false);
  const won = round.solved();
  const attempts = round.guesses.length;
  $('resultTitle').textContent = level === LEVEL_COUNT ? 'Five levels complete' : won ? 'Level cleared' : 'Out of guesses';
  $('resultNote').textContent = won
    ? 'Solved in ' + attempts + (attempts === 1 ? ' guess.' : ' guesses.')
    : levelAnswers[level - 1] ? 'The word was ' + levelAnswers[level - 1] + '.' : 'Better luck next time.';
  $('closeResult').disabled = false;
  if (!resultDialog.open) resultDialog.showModal();
  completeResult({ canRetry: !won });
  // Manual activation: the player (or whoever is holding the phone) taps Reveal.
  $('revealNow').hidden = !(isSurpriseLevel(level, surprise) && surprise.manualReveal && !won);
}

function showRevealMascot() {
  // The app uses the mascot chosen in Settings; the player keeps the theme's own.
  if (menuOn) paintMascot($('seasonMascot'), prefs.mascot, reducedMotion.matches, seasons.current());
  else seasons.showMascot();
}

let lastReveal = null;

function reveal(preview = false, content = { message, ending, headline }) {
  prepareResult(preview);
  lastReveal = content;
  // The final-reveal look (ref 06) is for the app only; the player keeps its own layout.
  resultDialog.classList.toggle('rv-final', menuOn);
  if ($('playAgain')) $('playAgain').hidden = preview;
  isBusy = true;
  $('resultTitle').textContent = preview ? 'Level 3 preview' : 'Game over';
  $('resultNote').textContent = preview ? '' : 'Better luck next time.';
  $('resultNote').hidden = preview;
  $('revealDesc').textContent = content.ending;
  $('revealDesc').hidden = !content.ending;
  $('closeResult').disabled = true;
  if (!resultDialog.open) resultDialog.showModal();
  content.message.forEach((line, index) => {
    flipRow($('resultBoard').children[index], makeRow(line, null, index), index * 155);
  });

  function finishReveal() {
    $('resultTitle').textContent = cleanHeadline(content.headline ?? headline);
    showRevealMascot();
    audio.play('plot_twist_reveal');
    if (menuOn && !preview) noteReveal();
    schedule(() => { if (resultDialog.open) audio.play('treasure_pop'); }, 280);
    $('revealCard').hidden = false;
    $('resultBoard').setAttribute('aria-label', 'Revealed message');
    $('resultNote').hidden = !menuOn;
    if (menuOn) $('resultNote').textContent = 'Six guesses. Zero chance.\nThis game was rigged from the start.';
    completeResult({ preview });
  }
  if (reducedMotion.matches) finishReveal();
  else schedule(finishReveal, 1210);
}

function identity() {
  // In the app, the surprise level flips between steered (null) and a real word with the settings;
  // keep it out of the key (baseAnswers) so saves and stats survive changes and match older saves.
  const answers = menuOn ? baseAnswers(overrides, puzzle.isWord) : levelAnswers;
  const data = JSON.stringify([root.dataset.mode, answers,
    root.dataset.mode === 'play' ? [settings.session, message, ending] : null]);
  let hash = 2166136261;
  for (const char of data) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  return hash >>> 0;
}

function progressKey() {
  return 'daily-puzzle-campaign-v1-' + puzzleId;
}

function historyKey() {
  return 'daily-puzzle-history-' + puzzleId;
}

function history() {
  const key = historyKey();
  const saved = readStorage(key);
  if (Array.isArray(saved)) {
    return saved.filter(item => typeof item?.id === 'string' && Number.isInteger(item.attempts) &&
      item.attempts >= 1 && item.attempts <= rows && typeof item.solved === 'boolean');
  }
  return histories.get(key) ?? [];
}

function saveProgress() {
  saveStorage(progressKey(), {
    id: roundId,
    level,
    guesses: round.guesses,
    typed: round.typed,
    answer: levelAnswers[level - 1] ?? null
  });
}

function recordResult() {
  const results = history();
  if (results.some(result => result.id === roundId)) return;
  // `day` feeds streaks and the calendar; `surprise` marks a steered round (never counts as a win).
  const entry = {
    id: roundId, level, attempts: round.guesses.length, solved: round.solved(), day: localDay(),
    surprise: (levelAnswers[level - 1] ?? null) === null
  };
  results.push(entry);
  histories.set(historyKey(), results);
  saveStorage(historyKey(), results);
  // The app also keeps one log across every campaign, so daily streaks do not reset with new answers.
  if (menuOn) logResult(entry);
}

function startLevel(number, saved = null) {
  clearTimers();
  $('viewResult').hidden = true;
  if (resultDialog.open) resultDialog.close();
  level = number;
  round = puzzle.createRound(levelAnswers[level - 1] || '');
  isBusy = false;
  roundId = typeof saved?.id === 'string' ? saved.id : roundIdentifier();
  round.restore(saved);
  saveProgress();
  $('puzzleNumber').textContent = 'Puzzle No. ' + (100 + puzzleId % 900);
  menu?.syncPlay();
  $('levelNumber').textContent = 'Level ' + level + ' of ' + LEVEL_COUNT;
  $('levelTrack').max = LEVEL_COUNT;
  $('levelTrack').value = level;
  setStatus('');
  updateUI();
  if (round.finished()) finishRound();
}

function resetCampaign(restore = false) {
  puzzleId = identity();
  let saved = restore ? readStorage(progressKey()) : null;
  const next = resumeLevel(saved);
  // The level was saved with another answer (steered or not): restart it only. Old saves carry no mark
  // except level 3, which was steered; any other unmarked level held its base answer.
  if (menuOn && saved) {
    const stored = 'answer' in saved ? saved.answer ?? null
      : next === SURPRISE_LEVEL ? null : baseAnswers(overrides, puzzle.isWord)[next - 1] ?? null;
    if (stored !== (levelAnswers[next - 1] ?? null)) saved = null;
  }
  startLevel(next, saved);
}

$('viewResult').addEventListener('click', showStageResult);
$('closeResult').addEventListener('click', () => resultDialog.close());
resultDialog.addEventListener('cancel', event => {
  if (isBusy) event.preventDefault();
});
resultDialog.addEventListener('close', () => {
  if (!resultDialog.open) seasons.stopMascot();
  if (!$('viewResult').hidden) $('viewResult').focus({ preventScroll: true });
});
$('revealNow').addEventListener('click', () => reveal());
$('continueGame').addEventListener('click', () => {
  startLevel(nextLevel(level));
  board.focus();
});
$('retryLevel').addEventListener('click', () => {
  startLevel(level);
  board.focus();
});
$('reportScam').addEventListener('click', event => {
  $('complaint').hidden = false;
  $('complaint').textContent = 'Complaint received. Developer is not sorry.';
  event.currentTarget.disabled = true;
});

$('playAgain')?.addEventListener('click', () => {
  resetCampaign();
  board.focus({ preventScroll: true });
});

$('copyMessage')?.addEventListener('click', async () => {
  const lines = (lastReveal?.message ?? message).filter(Boolean);
  const note = lastReveal?.ending ?? ending;
  const text = lines.join('\n') + (note ? '\n\n' + note : '');
  try {
    await navigator.clipboard.writeText(text);
    $('shareNotice').textContent = '';
    $('shareFallback').hidden = true;
    showToast('Message copied');
  } catch {
    // No clipboard access: show the text selected so it can be copied by hand.
    const field = $('shareFallback');
    field.value = lines.join(' ') + (note ? ' - ' + note : '');
    field.hidden = false;
    field.select();
    $('shareNotice').textContent = 'Copy the message below.';
  }
});

$('shareResult').addEventListener('click', async () => {
  const score = round.solved() ? round.guesses.length : 'X';
  const text = 'Daily Puzzle #' + (100 + puzzleId % 900) +
    ' · Level ' + level + '/' + LEVEL_COUNT + ' · ' + score + '/' + rows;
  try {
    if (window.DailyPuzzleNative) {
      window.DailyPuzzleNative.share(text);
      return;
    }
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
  } catch (error) {
    if (error.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(text);
    $('shareNotice').textContent = 'Score copied.';
  } catch {
    const field = $('shareFallback');
    field.value = text;
    field.hidden = false;
    field.select();
    $('shareNotice').textContent = 'Copy the score below.';
  }
});

function renderEditor() {
  const grid = $('editorGrid');
  grid.replaceChildren();
  for (let index = 0; index < rows; index++) {
    const field = el('div', 'field');
    const label = el('label', '', 'บรรทัด ' + (index + 1));
    const input = el('input', 'word-input');
    input.id = 'msgline' + index;
    label.htmlFor = input.id;
    input.value = message[index];
    input.maxLength = len;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.addEventListener('input', () => {
      const line = input.value.toUpperCase().replace(/[^A-Z♡♥]/g, '').slice(0, len);
      if (input.value !== line) input.value = line;
      message[index] = line;
      if (resultDialog.open) reveal(true);
    });
    field.append(label, input);
    grid.appendChild(field);
  }
}

function editLevelAnswers() {
  const result = levelAnswers.slice();
  for (const input of $('levelFields').querySelectorAll('input')) {
    const word = input.value.toUpperCase();
    input.setCustomValidity(/^[A-Z]{5}$/.test(word) && !puzzle.isWord(word)
      ? 'เลือกคำภาษาอังกฤษที่มีในพจนานุกรม'
      : '');
    if (!input.validity.valid) {
      if ($('help').open) $('help').close();
      input.reportValidity();
      return null;
    }
    result[Number(input.dataset.index)] = word;
  }
  return result;
}

function renderLevelEditor() {
  const fields = $('levelFields');
  levelAnswers.forEach((word, index) => {
    if (word === null) return;
    const field = el('div', 'field');
    const label = el('label', '', 'ด่าน ' + (index + 1));
    const input = el('input', 'word-input');
    input.id = 'levelAnswer' + (index + 1);
    input.dataset.index = index;
    input.value = word;
    input.maxLength = len;
    input.pattern = '[A-Za-z]{5}';
    input.required = true;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.addEventListener('input', () => {
      input.setCustomValidity('');
      $('answerStatus').hidden = true;
    });
    label.htmlFor = input.id;
    field.append(label, input);
    fields.appendChild(field);
  });
}

async function downloadGame(button = $('downloadCustomBtn'), notice = $('exportNotice')) {
  const answers = menuOn ? levelAnswers.slice() : editLevelAnswers();
  if (!answers) return;

  const copy = document.documentElement.cloneNode(true);
  delete copy.dataset.theme;
  delete copy.dataset.season;
  delete copy.dataset.skin;
  copy.classList.remove('has-menu', 'reduce-motion', 'hc-tiles');
  const game = copy.querySelector('#love-puzzle');
  game.dataset.mode = 'play';
  game.dataset.puzzleConfig = JSON.stringify({
    message,
    ending,
    headline,
    answers,
    season: seasons.current(),
    session: roundIdentifier(),
    ...(menuOn ? { surprise: surpriseConfig } : {})
  });
  game.querySelector('#editor').remove();
  game.classList.remove('menu-away');
  // Undo the app shell: unwrap the play layout, then drop everything only the app uses.
  for (const wrapper of copy.querySelectorAll('[data-menu-wrap]')) wrapper.replaceWith(...wrapper.childNodes);
  for (const node of copy.querySelectorAll('[data-menu-only], #revealActions')) node.remove();
  game.querySelector('#resultDialog').classList.remove('rv-final');
  for (const id of ['menuIcons', 'menuScreen', 'settingsScreen', 'themeDialog', 'homeBtn']) copy.querySelector('#' + id)?.remove();
  copy.querySelector('[rel="apple-touch-icon"]')?.remove();
  copy.querySelector('[rel="manifest"]')?.remove();
  for (const id of ['board', 'keyboard', 'resultBoard', 'revealDesc', 'levelNumber', 'puzzleNumber', 'turnBadge', 'turnCounter',
    'resultNote', 'complaint', 'shareNotice', 'exportNotice', 'status', 'helpHeading', 'helpText', 'helpExamples', 'statsMetrics', 'statsChart']) {
    game.querySelector('#' + id).replaceChildren();
  }
  game.querySelector('#help').removeAttribute('open');
  game.querySelector('#statsDialog').removeAttribute('open');
  game.querySelector('#shareFallback').hidden = true;
  game.querySelector('#themeBtn').hidden = true;
  game.querySelector('#seasonField').hidden = true;
  game.querySelector('#audioSettings').hidden = true;
  game.querySelector('#exportSettings').hidden = true;
  game.querySelector('#seasonMascot').removeAttribute('src');
  delete game.querySelector('#status').dataset.tone;
  game.querySelector('#resultDialog').removeAttribute('open');
  game.querySelector('#resultTitle').textContent = 'Game over';
  game.querySelector('#levelTrack').value = 1;
  game.querySelector('#viewResult').hidden = true;
  game.querySelector('#revealCard').hidden = true;
  game.querySelector('#resultActions').hidden = true;
  game.querySelector('#complaint').hidden = true;
  const html = '<!doctype html>\n' + copy.outerHTML;
  const invoke = window.__TAURI__?.core?.invoke;
  if (invoke) {
    button.disabled = true;
    notice.textContent = '';
    try {
      if (await invoke('export_game', { html })) notice.textContent = 'Player HTML saved.';
    } catch {
      notice.textContent = 'Could not save the player HTML.';
    } finally {
      button.disabled = false;
    }
    return;
  }
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const link = el('a');
  link.href = url;
  link.download = 'a-little-word-puzzle-for-you.html';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

const help = $('help');
const statsDialog = $('statsDialog');

function openHelp(showTheme = false) {
  audio.play('menu_open');
  $('helpHeading').textContent = showTheme ? 'Settings' : 'How to play';
  $('helpText').textContent = showTheme
    ? 'Choose a theme, display mode, and audio preferences.'
    : 'Each level gives you six tries to guess a five-letter word. Green marks the right spot, yellow marks a different spot, and gray means the letter is absent.';
  $('themeBtn').hidden = !showTheme;
  $('seasonField').hidden = !showTheme;
  $('audioSettings').hidden = !showTheme;
  $('exportSettings').hidden = !showTheme || !$('editor');
  $('exportNotice').textContent = '';
  $('helpExamples').hidden = showTheme;
  $('helpGamepad').hidden = showTheme;
  if (!showTheme) renderExamples($('helpExamples'));
  help.showModal();
  $(showTheme ? 'seasonSelect' : 'helpClose').focus();
}

$('helpBtn').addEventListener('click', () => (menuOn && isBusy ? menu.go('help') : openHelp()));
$('settingsBtn').addEventListener('click', () => (menuOn ? menu.go('settings') : openHelp(true)));
$('helpClose').addEventListener('click', () => help.close());
$('statsBtn').addEventListener('click', () => {
  if (menuOn) return menu.go('stats');
  if (isBusy) return;
  audio.play('menu_open');
  renderStats($('statsMetrics'), $('statsChart'), history());
  statsDialog.showModal();
});
$('statsClose').addEventListener('click', () => statsDialog.close());

document.addEventListener('keydown', event => {
  if (help.open || statsDialog.open || document.querySelector('dialog[open]') || menu?.visible()) return;
  const target = event.target;
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing ||
      target.isContentEditable || target.closest?.('input, textarea, select')) return;
  // A Thai layout changes the key's text, but its physical letter position stays the same.
  const thaiLetterKey = /[\u0E00-\u0E7F]/.test(event.key) && /^Key[A-Z]$/.test(event.code);
  const key = thaiLetterKey ? event.code.slice(3) : event.key.toUpperCase();
  if (!/^[A-Z]$/.test(key) && key !== 'ENTER' && key !== 'BACKSPACE') return;
  if (key === 'ENTER' && target.closest?.('button, a[href]')) return;
  if (resultDialog.open || isBusy || round.finished()) return;
  event.preventDefault();
  if (key === 'ENTER' && event.repeat) return;
  if (/^[A-Z]$/.test(key) && target.closest?.('button, a[href]')) {
    board.focus({ preventScroll: true });
  }
  inputKey(key);
});

if ($('editor') && !menuOn) {
  const answerStatus = $('answerStatus');
  renderLevelEditor();
  $('answerForm').addEventListener('submit', event => {
    event.preventDefault();
    const answers = editLevelAnswers();
    if (!answers) return;
    levelAnswers = answers;
    saveStorage(editorAnswersKey, answers);
    answerStatus.textContent = 'ใช้คำตอบที่ตั้งไว้แล้ว';
    answerStatus.hidden = false;
    resetCampaign();
    board.focus();
  });

  $('endingInput').value = ending;
  $('endingInput').addEventListener('input', event => {
    ending = event.target.value;
    if (resultDialog.open) $('revealDesc').textContent = ending;
  });
  for (const button of root.querySelectorAll('[data-preset]')) {
    button.addEventListener('click', () => {
      const key = button.dataset.preset;
      message = presets[key].slice();
      ending = {
        safe: defaultEnding,
        love: "I couldn't find a better way to say it. I love you, always. ♡",
        happy: "Every day feels brighter with you. I love you. ♡"
      }[key];
      $('endingInput').value = ending;
      renderEditor();
      if (resultDialog.open) reveal(true);
    });
  }
  $('previewBtn').addEventListener('click', () => { if (!isBusy) reveal(true); });
  $('resetBtn').addEventListener('click', () => { resetCampaign(); board.focus(); });
  $('downloadCustomBtn').addEventListener('click', () => downloadGame());
  renderEditor();
}

buildKeyboard();
resetCampaign(true);

function applySurprise(next) {
  surprise = resolveSurprise(next, 'app');
  surpriseConfig = { enabled: next.enabled, failAll: next.failAll, reveal: next.reveal, activation: next.activation, level: surprise.level };
  message = next.message.slice();
  ending = next.note;
  headline = cleanHeadline(next.headline);
  const answers = campaignAnswers(overrides, puzzle.isWord, surprise);
  if (JSON.stringify(answers) === JSON.stringify(levelAnswers)) return;
  // A level flipped between "steered" and "a real word". Only the current level restarts, and only if
  // its own answer changed; other levels keep their progress.
  const changed = (answers[level - 1] ?? null) !== (levelAnswers[level - 1] ?? null);
  levelAnswers = answers;
  if (changed) startLevel(level);
}

if (menuOn) {
  if ($('editor')) $('editor').hidden = true;
  const { enabled, failAll, reveal: revealAfter, activation } = storedSurprise;
  surpriseConfig = { enabled, failAll, reveal: revealAfter, activation, level: surprise.level };
  applyPrefs(prefs, reducedMotion);
  settingsUI = setupSettings({
    root,
    prefs,
    seasons,
    seasonSelect: $('seasonSelect'),
    audio,
    motion: reducedMotion,
    surprise: storedSurprise,
    isWord: puzzle.isWord,
    getAnswers: () => levelAnswers,
    setAnswers: next => {
      // The steered slot arrives as null: keep whatever custom word it had.
      overrides = next.map((word, index) => word ?? overrides?.[index] ?? null);
      saveStorage(editorAnswersKey, overrides);
      levelAnswers = campaignAnswers(overrides, puzzle.isWord, surprise);
      resetCampaign();
    },
    applySurprise,
    presets,
    testReveal: (lines, note, title) => { if (!isBusy) reveal(true, { message: lines, ending: note, headline: title }); },
    exportGame: downloadGame,
    goHome: () => menu.go('home')
  });
  menu = setupMenu({
    root,
    prefs,
    seasons,
    reducedMotion,
    soundControl: $('soundControl'),
    seasonSelect: $('seasonSelect'),
    dialogs: [resultDialog, help, statsDialog],
    settings: settingsUI,
    startOnGame: prefs.startup === 'resume',
    puzzleNumber: () => 100 + puzzleId % 900,
    hasProgress: () => {
      const saved = readStorage(progressKey());
      return Boolean(saved && (saved.level > 1 || saved.guesses?.length || saved.typed));
    },
    play: name => audio.play(name),
    openHelp: () => openHelp(),
    openSettings: () => settingsUI.show(),
    getHistory: history,
    needsConfirm: () => {
      const saved = readStorage(progressKey());
      return Boolean(saved && (saved.level > 1 || saved.guesses?.length));
    },
    isBusy: () => isBusy,
    newGame: () => resetCampaign(),
    focusGame: () => board.focus({ preventScroll: true })
  });
  // Preview deep links for the browser build.
  if (location.hash === '#menu-settings') settingsUI.show('general');
  if (location.hash === '#menu-surprise') settingsUI.show('surprise');
}
