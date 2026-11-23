import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeLists } from '../frontend/progress-store.js';
import { summarizeRounds } from './game.js';

const e = (id, solved = true) => ({ id, attempts: 3, solved });

test('mergeLists keeps log order and appends history-only entries', () => {
  const history = [e('old1'), e('old2'), e('new1')];
  const log = [e('new1'), e('new2')];
  assert.deepEqual(mergeLists(history, log).map(x => x.id), ['new1', 'new2', 'old1', 'old2']);
});

test('streaks follow log order after answers change', () => {
  const log = [e('a'), e('b'), e('c', false), e('d'), e('e')];
  const merged = mergeLists([e('c', false), e('d'), e('e'), e('a'), e('b')], log);
  const result = summarizeRounds(merged);
  assert.equal(result.streak, 2);
});
