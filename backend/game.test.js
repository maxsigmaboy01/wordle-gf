import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createPuzzle, gradeGuess, summarizeRounds } from './game.js';

const [words, answers] = await Promise.all(
  ['words.txt', 'answers.txt'].map(file => readFile(new URL('data/' + file, import.meta.url), 'utf8'))
);
const puzzle = createPuzzle({ words, answers });

function guess(round, word) {
  for (const letter of word) round.type(letter);
  return round.submit();
}

test('word lists are distinct and include the expanded dictionary', () => {
  const entries = words.trim().split(/\s+/);
  assert.ok(entries.length >= 12592);
  assert.equal(new Set(entries).size, entries.length);
  for (const word of ['SUSHI', 'EMOJI', 'VLOGS', 'BENTO', 'BLING', 'DOULA', 'INBOX', 'KORMA', 'PANKO', 'PHISH', 'QUBIT', 'VOXEL']) assert.equal(puzzle.isWord(word), true);
  for (const invalid of ['QUILK', 'CLVII', 'XREFS']) assert.equal(puzzle.isWord(invalid), false);
});

test('duplicate letters count only the unmatched occurrences', () => {
  assert.deepEqual(gradeGuess('ALLEY', 'APPLE'), [2, 1, 0, 1, 0]);
});

test('the adaptive round preserves its clues, including after reload', () => {
  const round = puzzle.createRound();
  const wordsToTry = ['CRANE', 'STARE', 'HONEY', 'MUSIC', 'CLOUD', 'BRING'];
  for (const word of wordsToTry) assert.equal(guess(round, word), '');
  assert.equal(round.finished(), true);
  assert.equal(round.solved(), false);
  const compatible = answers.trim().split(/\s+/).filter(answer => wordsToTry.every(
    (word, index) => gradeGuess(word, answer).join('') === round.colors[index].join('')
  ));
  assert.ok(compatible.length > 0);
  const restored = puzzle.createRound();
  restored.restore({ guesses: round.guesses, typed: 'Q' });
  assert.deepEqual(restored.colors, round.colors);
  assert.equal(restored.typed, '');
});

test('the adaptive round accepts an exact match when every other clue would contradict history', () => {
  const single = createPuzzle({ words: 'CRANE APPLE', answers: 'APPLE' }).createRound();
  assert.equal(guess(single, 'CRANE'), '');
  assert.equal(guess(single, 'APPLE'), '');
  assert.equal(single.solved(), true);
});

test('invalid and repeated words do not consume a guess', () => {
  const round = puzzle.createRound('APPLE');
  assert.equal(guess(round, 'QUILK'), 'Not in word list.');
  for (let i = 0; i < 5; i++) round.type('BACKSPACE');
  assert.equal(guess(round, 'CRANE'), '');
  assert.equal(guess(round, 'CRANE'), 'You already guessed that word.');
  assert.deepEqual(round.guesses, ['CRANE']);
  const resumed = puzzle.createRound('APPLE');
  resumed.restore(round);
  assert.equal(resumed.typed, 'CRANE');
});

test('progress totals are computed from completed rounds', () => {
  const history = [
    { attempts: 3, solved: true },
    { attempts: 2, solved: true },
    { attempts: 6, solved: false },
    { attempts: 1, solved: true }
  ];
  assert.deepEqual(summarizeRounds(history), {
    played: 4, solved: 3, streak: 1, best: 2, distribution: [1, 1, 1, 0, 0, 1]
  });
});
