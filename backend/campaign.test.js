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
