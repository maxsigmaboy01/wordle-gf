import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createPuzzle, gradeGuess } from './game.js';
import {
  HINT_TYPES, MAX_STARS, START_STARS, awardLevelWin, createHintState, guessBlockedBy,
  hintOptions, normalizeHintState, useHint
} from './hints.js';

const [words, answers] = await Promise.all(
  ['words.txt', 'answers.txt'].map(file => readFile(new URL('data/' + file, import.meta.url), 'utf8'))
);
const puzzle = createPuzzle({ words, answers });

function lcg(seed) {
  let v = seed;
  return () => (v = (v * 1664525 + 1013904223) % 4294967296) / 4294967296;
}
function guess(round, word) {
  for (const letter of word) round.type(letter);
  return round.submit();
}
const rich = (stars = MAX_STARS) => createHintState({ stars });

test('costs, start and cap', () => {
  assert.deepEqual([HINT_TYPES.peek.cost, HINT_TYPES.lock.cost, HINT_TYPES.eliminate.cost], [1, 2, 1]);
  assert.equal(createHintState().stars, START_STARS);
  let state = createHintState({ stars: 4 });
  state = awardLevelWin(awardLevelWin(state));
  assert.equal(state.stars, MAX_STARS);
});

test('normal mode: each hint is correct and costs the right stars', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const rng = lcg(seed);
    const round = puzzle.createRound('APPLE');
    let state = rich();
    let r = useHint(round, state, 'peek', rng);
    assert.ok(r.ok && 'APPLE'.includes(r.fact.letter));
    assert.equal(r.state.stars, 4);
    r = useHint(round, r.state, 'lock', rng);
    assert.ok(r.ok && 'APPLE'[r.fact.slot - 1] === r.fact.letter);
    assert.equal(r.state.stars, 2);
    r = useHint(round, r.state, 'eliminate', rng);
    assert.ok(r.ok && r.fact.letters.length === 3);
    for (const letter of r.fact.letters) assert.ok(!'APPLE'.includes(letter));
    assert.equal(r.state.stars, 1);
    assert.equal(round.guesses.length, 0);
  }
});

test('no duplicate peeks, lock slots or eliminated letters; known info is not repeated', () => {
  const rng = lcg(3);
  const round = puzzle.createRound('APPLE');
  guess(round, 'ALLEY'); // A green at slot 1, L and E known, Y absent
  let state = rich();
  const peeks = new Set();
  for (let i = 0; i < 2; i++) {
    const r = useHint(round, state, 'peek', rng);
    if (i === 1) { assert.equal(r.ok, false); break; } // only P is left to reveal
    assert.ok(r.ok);
    assert.ok(!peeks.has(r.fact.letter));
    assert.equal(r.fact.letter, 'P', 'player already knows A, L, E');
    peeks.add(r.fact.letter);
    state = r.state;
  }
  const locked = new Set();
  state = rich();
  for (let i = 0; i < 4; i++) {
    const r = useHint(round, state, 'lock', rng);
    if (!r.ok) { assert.equal(i > 0, true); break; }
    assert.notEqual(r.fact.slot, 1, 'slot 1 is known green');
    assert.ok(!locked.has(r.fact.slot));
    locked.add(r.fact.slot);
    state = { ...r.state, stars: 5 };
  }
  state = rich();
  const gone = new Set();
  for (let i = 0; i < 4; i++) {
    const r = useHint(round, state, 'eliminate', rng);
    assert.ok(r.ok);
    for (const letter of r.fact.letters) {
      assert.ok(!'APPLE'.includes(letter) && letter !== 'Y' && !gone.has(letter));
      gone.add(letter);
    }
    state = { ...r.state, stars: 5 };
  }
});

test('insufficient stars, disabled and finished rounds are unavailable and free', () => {
  const round = puzzle.createRound('APPLE');
  const poor = createHintState({ stars: 1 });
  const options = hintOptions(round, poor);
  assert.deepEqual(options.map(o => o.available), [true, false, true]);
  assert.match(options[1].reason, /stars/);
  const refused = useHint(round, poor, 'lock');
  assert.equal(refused.ok, false);
  assert.equal(refused.state.stars, 1);
  assert.equal(useHint(round, createHintState({ stars: 0 }), 'peek').state.stars, 0);
  assert.equal(hintOptions(round, { ...rich(), enabled: false }).some(o => o.available), false);
  guess(round, 'APPLE');
  assert.equal(round.finished(), true);
  const done = hintOptions(round, rich());
  assert.ok(done.every(o => !o.available && o.reason));
  assert.equal(useHint(round, rich(), 'peek').ok, false);
});

test('a guess with an eliminated letter is rejected without using a try', () => {
  const round = puzzle.createRound('APPLE');
  const r = useHint(round, rich(), 'eliminate', lcg(5));
  const letter = r.fact.letters[0];
  assert.deepEqual(guessBlockedBy(r.state, 'XX' + letter + 'XX'), [letter]);
  assert.equal(guessBlockedBy(r.state, 'APPLE'), null);
  const word = answers.trim().split(/\s+/).find(w => w.includes(letter) && puzzle.isWord(w));
  assert.match(guess(round, word), /Eliminated letters/);
  assert.equal(round.guesses.length, 0);
});

test('steered: at least two candidates remain and later feedback honours the facts', () => {
  for (let seed = 1; seed <= 15; seed++) {
    const rng = lcg(seed);
    const round = puzzle.createRound();
    assert.equal(round.steered, true);
    guess(round, 'CRANE');
    let state = rich();
    const facts = [];
    for (const type of ['peek', 'eliminate', 'lock']) {
      const r = useHint(round, state, type, rng);
      if (!r.ok) continue;
      facts.push(r.fact);
      state = { ...r.state, stars: 5 };
      assert.ok(round.candidateAnswers().length >= 2);
    }
    assert.ok(facts.length > 0);
    const second = ['MOIST', 'PLUMB', 'DOILY', 'FUDGY', 'SHOWN', 'BLIMP', 'TOUGH']
      .find(word => !guessBlockedBy(state, word) && puzzle.isWord(word) && !round.guesses.includes(word));
    assert.equal(guess(round, second), '');
    const rest = round.candidateAnswers();
    assert.ok(rest.length >= 1);
    for (const word of rest) {
      assert.deepEqual(gradeGuess('CRANE', word), round.colors[0]);
      assert.deepEqual(gradeGuess(second, word), round.colors[1]);
      for (const f of facts) {
        if (f.type === 'peek') assert.ok(word.includes(f.letter));
        if (f.type === 'lock') assert.equal(word[f.slot - 1], f.letter);
        if (f.type === 'eliminate') assert.ok(f.letters.every(l => !word.includes(l)));
      }
    }
  }
});

test('steered: a hint is unavailable when it would leave fewer than two candidates', () => {
  const small = createPuzzle({ words: 'CRANE APPLE', answers: 'APPLE AMPLE' }).createRound();
  assert.equal(small.candidateAnswers().length, 2);
  // Peek A keeps both; lock slot 2 (P vs M) would leave one; eliminate needs 3 letters keeping both.
  const options = hintOptions(small, rich());
  assert.equal(options[0].available, true);
  assert.equal(options[1].available, true); // slot 1/3/4/5 letters shared by both
  const r = useHint(small, rich(), 'lock', () => 0);
  assert.ok(r.ok && r.fact.slot !== 2);
  const single = createPuzzle({ words: 'CRANE APPLE', answers: 'APPLE' }).createRound();
  const none = hintOptions(single, rich());
  assert.ok(none.every(o => !o.available && /safely/.test(o.reason)));
  const refused = useHint(single, rich(), 'peek');
  assert.equal(refused.ok, false);
  assert.equal(refused.state.stars, MAX_STARS);
});

test('steered round restores guesses and hints with identical feedback', () => {
  const rng = lcg(11);
  const round = puzzle.createRound();
  guess(round, 'CRANE');
  const a = useHint(round, rich(), 'peek', rng);
  guess(round, 'MOIST');
  const b = useHint(round, a.state, 'eliminate', rng);
  const saved = JSON.parse(JSON.stringify({ guesses: round.guesses, hintLog: round.hintLog, hints: b.state }));
  const restored = puzzle.createRound();
  restored.restore(saved);
  assert.deepEqual(restored.colors, round.colors);
  assert.deepEqual(restored.candidateAnswers(), round.candidateAnswers());
  assert.deepEqual(restored.hintLog, round.hintLog);
});

test('hint state round-trips through JSON and repairs bad data', () => {
  const round = puzzle.createRound('APPLE');
  let state = rich();
  for (const type of ['peek', 'lock', 'eliminate']) state = useHint(round, state, type, lcg(2)).state;
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
  assert.deepEqual(normalizeHintState(JSON.parse(JSON.stringify(state))), state);
  assert.equal(state.history.length, 3);
  const bad = normalizeHintState({ stars: -4, locks: { 9: 'A', 2: 'zz' }, peeks: ['A', 'A', 7] });
  assert.equal(bad.stars, 0);
  assert.deepEqual(bad.locks, {});
  assert.deepEqual(bad.peeks, ['A']);
  assert.equal(normalizeHintState(null).stars, START_STARS);
});
