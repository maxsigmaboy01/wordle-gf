import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { LEVEL_COUNT, SURPRISE_LEVEL, campaignAnswers, nextLevel, resumeLevel } from './campaign.js';
import { createPuzzle } from './game.js';

const [words, answers] = await Promise.all(
  ['words.txt', 'answers.txt'].map(file => readFile(new URL('data/' + file, import.meta.url), 'utf8'))
);
const puzzle = createPuzzle({ words, answers });

test('the campaign has four valid fixed puzzles around the level-three surprise', () => {
  const levels = campaignAnswers(null, puzzle.isWord);
  assert.equal(LEVEL_COUNT, 5);
  assert.equal(SURPRISE_LEVEL, 3);
  assert.equal(levels[2], null);
  for (const word of levels.filter(Boolean)) assert.ok(puzzle.isWord(word));
});

test('campaign overrides cannot replace the surprise or supply nonexistent words', () => {
  const levels = campaignAnswers(['SUSHI', 'ZZZZZ', 'APPLE', 'EMOJI'], puzzle.isWord);
  assert.deepEqual(levels, ['SUSHI', 'CLOUD', null, 'EMOJI', 'SPARK']);
});

test('the current level can resume or advance and replay starts at level one', () => {
  assert.equal(resumeLevel({ level: 3 }), 3);
  assert.equal(resumeLevel({ level: 6 }), 1);
  assert.equal(resumeLevel(null), 1);
  assert.deepEqual([1, 2, 3, 4, 5].map(nextLevel), [2, 3, 4, 5, 1]);
});

import { SURPRISE_OFF_ANSWER, resolveSurprise } from './campaign.js';

test('no surprise settings behaves exactly as before (on, steered, auto reveal)', () => {
  for (const s of [undefined, null, {}]) {
    const r = resolveSurprise(s);
    assert.deepEqual([r.active, r.steered, r.reveal, r.autoReveal, r.manualReveal], [true, true, true, true, false]);
    assert.equal(r.activation, 'after-final-try');
  }
  assert.deepEqual(resolveSurprise(undefined, 'export'), resolveSurprise(undefined, 'app'));
  assert.deepEqual(campaignAnswers(null, puzzle.isWord, resolveSurprise()), campaignAnswers(null, puzzle.isWord));
});

test('the default off answer is a valid distinct answer', () => {
  assert.ok(puzzle.isWord(SURPRISE_OFF_ANSWER));
  assert.ok(answers.split(/\s+/).includes(SURPRISE_OFF_ANSWER));
  assert.ok(!campaignAnswers(null, puzzle.isWord).includes(SURPRISE_OFF_ANSWER));
});

test('enabled:false makes level 3 an ordinary puzzle with an overridable answer', () => {
  const r = resolveSurprise({ enabled: false });
  assert.deepEqual([r.active, r.steered, r.reveal, r.autoReveal], [false, false, false, false]);
  assert.equal(campaignAnswers(null, puzzle.isWord, r)[2], SURPRISE_OFF_ANSWER);
  assert.equal(campaignAnswers([null, null, 'MAPLE'], puzzle.isWord, r)[2], 'MAPLE');
  assert.equal(campaignAnswers([null, null, 'ZZZZZ'], puzzle.isWord, r)[2], SURPRISE_OFF_ANSWER);
  assert.equal(campaignAnswers(null, puzzle.isWord, r).includes(null), false);
});

test('failAll:false grades normally against a real answer but keeps the reveal', () => {
  const r = resolveSurprise({ failAll: false });
  assert.deepEqual([r.active, r.steered, r.reveal, r.autoReveal], [true, false, true, true]);
  assert.equal(campaignAnswers(null, puzzle.isWord, r)[2], SURPRISE_OFF_ANSWER);
});

test('reveal:false hides the message while steering still applies', () => {
  const r = resolveSurprise({ reveal: false });
  assert.deepEqual([r.active, r.steered, r.reveal, r.autoReveal, r.manualReveal], [true, true, false, false, false]);
});

test('activation manual needs a button; invalid values fall back to the default', () => {
  const r = resolveSurprise({ activation: 'manual' });
  assert.deepEqual([r.steered, r.autoReveal, r.manualReveal], [true, false, true]);
  assert.equal(resolveSurprise({ activation: 'bogus' }).activation, 'after-final-try');
});

test('shared-link-only is active in exports and inactive inside the app', () => {
  const s = { activation: 'shared-link-only' };
  assert.equal(resolveSurprise(s, 'app').active, false);
  assert.equal(campaignAnswers(null, puzzle.isWord, resolveSurprise(s, 'app'))[2], SURPRISE_OFF_ANSWER);
  const e = resolveSurprise(s, 'export');
  assert.deepEqual([e.active, e.steered, e.autoReveal], [true, true, true]);
  assert.equal(campaignAnswers(null, puzzle.isWord, e)[2], null);
  assert.equal(resolveSurprise({ ...s, enabled: false }, 'export').active, false);
});

import { baseAnswers, isSurpriseLevel } from './campaign.js';

test('the surprise level is configurable 1..5 and invalid values fall back to 3', () => {
  assert.equal(resolveSurprise().level, 3);
  for (const l of [1, 2, 3, 4, 5]) assert.equal(resolveSurprise({ level: l }).level, l);
  for (const l of [0, 6, 2.5, '1', null, NaN]) assert.equal(resolveSurprise({ level: l }).level, 3);
});

test('surprise on level 1 and 5 steers that slot and gives level 3 a real answer', () => {
  assert.deepEqual(campaignAnswers(null, puzzle.isWord, resolveSurprise({ level: 1 })),
    [null, 'CLOUD', SURPRISE_OFF_ANSWER, 'BRAVE', 'SPARK']);
  assert.deepEqual(campaignAnswers(null, puzzle.isWord, resolveSurprise({ level: 5 })),
    ['APPLE', 'CLOUD', SURPRISE_OFF_ANSWER, 'BRAVE', null]);
  assert.deepEqual(campaignAnswers(null, puzzle.isWord, resolveSurprise({ level: 3 })),
    ['APPLE', 'CLOUD', null, 'BRAVE', 'SPARK']);
});

test('level 3 off the surprise uses a valid override, else OCEAN; steered slot ignores overrides', () => {
  const r = resolveSurprise({ level: 1 });
  assert.equal(campaignAnswers([null, null, 'MAPLE'], puzzle.isWord, r)[2], 'MAPLE');
  assert.equal(campaignAnswers([null, null, 'ZZZZZ'], puzzle.isWord, r)[2], 'OCEAN');
  assert.equal(campaignAnswers(['SUSHI'], puzzle.isWord, r)[0], null);
});

test('inactive or non-steered surprise leaves all answers real, whatever the level', () => {
  for (const s of [{ level: 1, activation: 'shared-link-only' }, { level: 1, enabled: false }, { level: 1, failAll: false }]) {
    const a = campaignAnswers(null, puzzle.isWord, resolveSurprise(s, 'app'));
    assert.deepEqual(a, ['APPLE', 'CLOUD', SURPRISE_OFF_ANSWER, 'BRAVE', 'SPARK']);
  }
  assert.equal(campaignAnswers(null, puzzle.isWord, resolveSurprise({ level: 1, activation: 'shared-link-only' }, 'export'))[0], null);
});

test('isSurpriseLevel needs an active surprise on that level', () => {
  const r = resolveSurprise({ level: 2 });
  assert.deepEqual([1, 2, 3].map(l => isSurpriseLevel(l, r)), [false, true, false]);
  assert.equal(isSurpriseLevel(2, resolveSurprise({ level: 2, enabled: false })), false);
  assert.equal(isSurpriseLevel(3, resolveSurprise()), true);
});

test('baseAnswers equals the old default and is independent of surprise', () => {
  for (const o of [null, ['SUSHI', 'ZZZZZ', 'APPLE', 'EMOJI']]) {
    assert.deepEqual(baseAnswers(o, puzzle.isWord), campaignAnswers(o, puzzle.isWord));
  }
  assert.deepEqual(baseAnswers(null, puzzle.isWord), ['APPLE', 'CLOUD', null, 'BRAVE', 'SPARK']);
});
