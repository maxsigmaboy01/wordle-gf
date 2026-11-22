import { ATTEMPTS as rows, WORD_LENGTH as len, createPuzzle } from '../backend/game.js';
import { LEVEL_COUNT, SURPRISE_LEVEL, campaignAnswers, nextLevel, resumeLevel } from '../backend/campaign.js';
import words from '../backend/data/words.txt';
import answers from '../backend/data/answers.txt';
import { setupSeasons } from './seasons.js';
import { readStorage, roundIdentifier, saveStorage } from './storage.js';
import { el, makeRow, ranks, renderExamples, renderStats } from './views.js';

const root = document.getElementById('love-puzzle');
const $ = id => document.getElementById(id);
const board = $('board'), keyboard = $('keyboard'), resultDialog = $('resultDialog');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const puzzle = createPuzzle({ words, answers });
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
let message = settings.message || presets.safe.slice();
let ending = settings.ending ?? defaultEnding;
const editorAnswersKey = 'daily-puzzle-editor-levels';
let levelAnswers = campaignAnswers(settings.answers ?? ($('editor') ? readStorage(editorAnswersKey) : null), puzzle.isWord);
let level, round, roundId, puzzleId, isBusy;
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
    const row = round.guesses.length;
    const error = round.submit();
    if (error) return rejectGuess(error);

    setStatus('');
    isBusy = true;
    saveProgress();
    updateUI(row);
    flipRow(board.children[row], makeRow(round.guesses[row], round.colors[row]));
    const finishGuess = () => {
      updateUI();
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

  setStatus('');
  updateUI();
  saveProgress();
  if (/^[A-Z]$/.test(key)) {
    board.children[round.guesses.length]?.children[round.typed.length - 1]?.classList.add('pop');
  }
}

function finishRound() {
  isBusy = true;
  recordResult();
  setStatus(round.solved() ? 'Puzzle solved.' : 'Better luck next time.');
  schedule(showStageResult, level === SURPRISE_LEVEL ? 1020 : 400);
}

function prepareResult(preview) {
  clearTimers();
  const { guesses, colors } = round;
  $('revealCard').hidden = true;
  seasons.stopMascot();
  $('resultActions').hidden = true;
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
  if (level === SURPRISE_LEVEL) {
    reveal();
    return;
  }

  prepareResult(false);
  const won = round.solved();
  const attempts = round.guesses.length;
  $('resultTitle').textContent = level === LEVEL_COUNT ? 'Five levels complete' : won ? 'Level cleared' : 'Out of guesses';
  $('resultNote').textContent = won
    ? 'Solved in ' + attempts + (attempts === 1 ? ' guess.' : ' guesses.')
    : 'The word was ' + levelAnswers[level - 1] + '.';
  $('closeResult').disabled = false;
  if (!resultDialog.open) resultDialog.showModal();
  completeResult({ canRetry: !won });
}

function reveal(preview = false) {
  prepareResult(preview);
  isBusy = true;
  $('resultTitle').textContent = preview ? 'Level 3 preview' : 'Game over';
  $('resultNote').textContent = preview ? '' : 'Better luck next time.';
  $('resultNote').hidden = preview;
  $('revealDesc').textContent = ending;
  $('revealDesc').hidden = !ending;
  $('closeResult').disabled = true;
  if (!resultDialog.open) resultDialog.showModal();
  message.forEach((line, index) => {
    flipRow($('resultBoard').children[index], makeRow(line, null, index), index * 155);
  });

  function finishReveal() {
    $('resultTitle').textContent = 'You got baited, respectfully.';
    seasons.showMascot();
    $('revealCard').hidden = false;
    $('resultBoard').setAttribute('aria-label', 'Revealed message');
    $('resultNote').hidden = true;
    completeResult({ preview });
  }
  if (reducedMotion.matches) finishReveal();
  else schedule(finishReveal, 1210);
}

function identity() {
  const data = JSON.stringify([root.dataset.mode, levelAnswers,
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
    typed: round.typed
  });
}

function recordResult() {
  const results = history();
  if (results.some(result => result.id === roundId)) return;
  results.push({ id: roundId, level, attempts: round.guesses.length, solved: round.solved() });
  histories.set(historyKey(), results);
  saveStorage(historyKey(), results);
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
  $('levelNumber').textContent = 'Level ' + level + ' of ' + LEVEL_COUNT;
  $('levelTrack').max = LEVEL_COUNT;
  $('levelTrack').value = level;
  setStatus('');
  updateUI();
  if (round.finished()) finishRound();
}

function resetCampaign(restore = false) {
  puzzleId = identity();
  const saved = restore ? readStorage(progressKey()) : null;
  startLevel(resumeLevel(saved), saved);
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

$('shareResult').addEventListener('click', async () => {
  const score = round.solved() ? round.guesses.length : 'X';
  const text = 'Daily Puzzle #' + (100 + puzzleId % 900) +
    ' · Level ' + level + '/' + LEVEL_COUNT + ' · ' + score + '/' + rows;
  try {
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
    if (!input.reportValidity()) return null;
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

function downloadGame() {
  const answers = editLevelAnswers();
  if (!answers) return;

  const copy = document.documentElement.cloneNode(true);
  delete copy.dataset.theme;
  delete copy.dataset.season;
  const game = copy.querySelector('#love-puzzle');
  game.dataset.mode = 'play';
  game.dataset.puzzleConfig = JSON.stringify({
    message,
    ending,
    answers,
    season: seasons.current(),
    session: roundIdentifier()
  });
  game.querySelector('#editor').remove();
  copy.querySelector('[rel="icon"]').href = game.querySelector('.brand img').getAttribute('src');
  copy.querySelector('[rel="apple-touch-icon"]')?.remove();
  copy.querySelector('[rel="manifest"]')?.remove();
  for (const id of ['board', 'keyboard', 'resultBoard', 'revealDesc', 'levelNumber', 'puzzleNumber', 'turnBadge', 'turnCounter',
    'resultNote', 'complaint', 'shareNotice', 'status', 'helpHeading', 'helpText', 'helpExamples', 'statsMetrics', 'statsChart']) {
    game.querySelector('#' + id).replaceChildren();
  }
  game.querySelector('#help').removeAttribute('open');
  game.querySelector('#statsDialog').removeAttribute('open');
  game.querySelector('#shareFallback').hidden = true;
  game.querySelector('#themeBtn').hidden = true;
  game.querySelector('#seasonField').hidden = true;
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
  $('helpHeading').textContent = showTheme ? 'Settings' : 'How to play';
  $('helpText').textContent = showTheme
    ? 'Choose a seasonal theme and display mode.'
    : 'Each level gives you six tries to guess a five-letter word. Green marks the right spot, yellow marks a different spot, and gray means the letter is absent.';
  $('themeBtn').hidden = !showTheme;
  $('seasonField').hidden = !showTheme;
  $('helpExamples').hidden = showTheme;
  $('helpGamepad').hidden = showTheme;
  if (!showTheme) renderExamples($('helpExamples'));
  help.showModal();
  $(showTheme ? 'seasonSelect' : 'helpClose').focus();
}

$('helpBtn').addEventListener('click', () => openHelp());
$('settingsBtn').addEventListener('click', () => openHelp(true));
$('helpClose').addEventListener('click', () => help.close());
$('statsBtn').addEventListener('click', () => {
  renderStats($('statsMetrics'), $('statsChart'), history());
  statsDialog.showModal();
});
$('statsClose').addEventListener('click', () => statsDialog.close());

document.addEventListener('keydown', event => {
  if (help.open || statsDialog.open) return;
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

if ($('editor')) {
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
  $('downloadCustomBtn').addEventListener('click', downloadGame);
  renderEditor();
}

buildKeyboard();
resetCampaign(true);
