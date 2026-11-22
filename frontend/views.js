import { gradeGuess, summarizeRounds, WORD_LENGTH } from '../backend/game.js';

export const ranks = ['gray', 'yellow', 'green'];

export function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function makeRow(letters, pattern, revealIndex) {
  const row = el('div', 'guess-row');
  for (let col = 0; col < WORD_LENGTH; col++) {
    const letter = letters[col] || '';
    const tile = el('div', 'tile', letter);
    if (revealIndex !== undefined) {
      tile.classList.add(letter ? 'word' : 'ghost');
      if (letter && [1, 4].includes(revealIndex)) tile.classList.add('word-gold');
    } else if (pattern) {
      tile.classList.add(ranks[pattern[col]]);
      tile.setAttribute('aria-label', letter + ', ' + ['absent', 'wrong position', 'correct position'][pattern[col]]);
    } else if (letter) {
      tile.classList.add('filled');
    }
    if (!letter) tile.setAttribute('aria-hidden', 'true');
    row.appendChild(tile);
  }
  return row;
}

export function renderExamples(container) {
  container.replaceChildren(...['CRANE', 'STARE', 'PLAIN'].map(word => makeRow(word, gradeGuess(word, 'PLAIN'))));
}

export function renderStats(container, chart, history) {
  const result = summarizeRounds(history);
  const rate = result.played ? Math.round(result.solved / result.played * 100) : 0;
  const stats = [
    ['Games played', result.played],
    ['Current streak', result.streak],
    ['Best streak', result.best],
    ['Win rate', rate + '%']
  ];
  container.replaceChildren(...stats.map(([label, value]) => {
    const item = el('div', 'stat');
    item.append(el('dt', '', label), el('dd', '', String(value)));
    return item;
  }));

  const max = Math.max(1, ...result.distribution);
  chart.replaceChildren(...result.distribution.map((count, index) => {
    const item = el('li', 'distribution-row');
    const number = el('span', '', String(index + 1));
    const track = el('div', 'bar-track');
    const bar = el('div', 'bar');
    bar.style.width = (count / max * 100) + '%';
    track.setAttribute('aria-hidden', 'true');
    track.append(bar);
    item.append(number, track, el('span', 'bar-count', String(count)));
    return item;
  }));
}
