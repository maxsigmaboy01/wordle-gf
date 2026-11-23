import assert from 'node:assert/strict';
import { test } from 'node:test';
import { achievements, calendarMonth, dailyStreak, localDay, treasure } from './progress.js';

const e = (day, extra = {}) => ({ id: 'x' + Math.random(), level: 1, attempts: 3, solved: true, day, ...extra });
const get = (list, id) => list.find(a => a.id === id);

test('empty history', () => {
  assert.deepEqual(dailyStreak([], '2026-11-22'), { current: 0, best: 0, playedToday: false });
  assert.deepEqual(treasure([]), { chests: 0, nextAt: 5, progress: { value: 0, target: 5 } });
  assert.equal(achievements([]).length, 8);
  assert.ok(achievements([]).every(a => !a.unlocked));
  assert.equal(calendarMonth([], 2026, 11).days.length, 30);
});

test('undated entries count for totals only', () => {
  const old = Array.from({ length: 5 }, () => e(undefined));
  assert.deepEqual(dailyStreak(old, '2026-11-22'), { current: 0, best: 0, playedToday: false });
  assert.equal(treasure(old).chests, 1);
  assert.ok(get(achievements(old), 'first-steps').unlocked);
  assert.ok(calendarMonth(old, 2026, 11).days.every(d => !d.played));
});

test('streak crosses month and year boundaries', () => {
  const entries = [e('2026-12-30'), e('2026-12-31'), e('2027-01-01'), e('2027-01-02')];
  assert.deepEqual(dailyStreak(entries, '2027-01-02'), { current: 4, best: 4, playedToday: true });
  assert.equal(dailyStreak([e('2026-02-28'), e('2026-03-01')], '2026-03-01').current, 2);
});

test('today and yesterday rules', () => {
  const entries = [e('2026-11-20'), e('2026-11-21')];
  assert.deepEqual(dailyStreak(entries, '2026-11-21'), { current: 2, best: 2, playedToday: true });
  assert.deepEqual(dailyStreak(entries, '2026-11-22'), { current: 2, best: 2, playedToday: false });
  assert.deepEqual(dailyStreak(entries, '2026-11-23'), { current: 0, best: 2, playedToday: false });
});

test('losses count as played days', () => {
  const entries = [e('2026-11-21', { solved: false, attempts: 6 }), e('2026-11-22', { solved: false, attempts: 6 })];
  assert.equal(dailyStreak(entries, '2026-11-22').current, 2);
});

test('surprise rounds are never wins but keep the streak', () => {
  const entries = [e('2026-11-21'), e('2026-11-22', { surprise: true, solved: false, level: 3 }),
    e('2026-11-23', { surprise: true, solved: true, level: 3, attempts: 1 })];
  assert.equal(dailyStreak(entries, '2026-11-23').current, 3);
  assert.equal(treasure(entries).progress.value, 1);
  assert.ok(!get(achievements(entries), 'sharp-eye').unlocked);
  const cal = calendarMonth(entries, 2026, 11, '2026-11-23').days;
  assert.equal(cal[21].solved, false);
  assert.equal(cal[21].played, true);
  assert.equal(cal[22].isToday, true);
});

test('treasure chests', () => {
  const wins = Array.from({ length: 8 }, () => e('2026-11-22'));
  assert.deepEqual(treasure(wins), { chests: 1, nextAt: 10, progress: { value: 3, target: 5 } });
});

test('calendar offset is Monday-first', () => {
  assert.equal(calendarMonth([], 2026, 11).offset, 6); // 1 Nov 2026 is a Sunday
  assert.equal(calendarMonth([], 2026, 6).offset, 0); // 1 Jun 2026 is a Monday
  assert.equal(calendarMonth([], 2024, 2).days.length, 29);
});

test('achievements', () => {
  const entries = [e('2026-11-20', { attempts: 2 }), e('2026-11-21'), e('2026-11-22')];
  const list = achievements(entries, { themesTried: 4, revealsSeen: 1 });
  for (const id of ['first-steps', 'sharp-eye', 'hat-trick', 'fashionista', 'got-baited']) assert.ok(get(list, id).unlocked, id);
  assert.ok(!get(list, 'week-warrior').unlocked);
  assert.deepEqual(get(list, 'puzzle-pro').progress, { value: 3, target: 25 });
  const levels = [1, 2, 3, 4, 5].map(l => e('2026-11-22', { level: l, surprise: l === 3, solved: l !== 3 }));
  assert.ok(get(achievements(levels), 'treasure-hunter').unlocked);
  assert.ok(!get(achievements(levels.slice(0, 4)), 'treasure-hunter').unlocked);
});

test('localDay formats local date', () => {
  assert.equal(localDay(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});
