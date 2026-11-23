// Pure progress helpers (streaks, calendar, achievements, treasure). No DOM, no clock:
// callers pass `today` as a local 'YYYY-MM-DD' string (see localDay).
//
// Entry: {id, level, attempts, solved, day?:'YYYY-MM-DD', surprise?:boolean}
// Rules:
// - Undated entries (no valid `day`) count for totals but never for day-based features.
// - A day is "played" when any round was completed that day, win or loss, surprise or not.
//   So a steered surprise loss never breaks a streak.
// - A "win" is solved && !surprise. Surprise rounds never count as wins (solves, chests, achievements).
// - Treasure Hunter: a level is cleared by a win, or by completing the surprise round on that level;
//   all LEVELS levels needed. Pass one campaign's entries (history is stored per campaign).

const LEVELS = 5;
const CHEST_SIZE = 5;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;

const pad = n => String(n).padStart(2, '0');
const isDay = d => typeof d === 'string' && DAY_RE.test(d);
const toUtc = day => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
const fromUtc = ms => {
  const d = new Date(ms);
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
};
const isWin = e => !!e && e.solved === true && !e.surprise;

export function localDay(date = new Date()) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

function playedDays(entries) {
  return [...new Set((entries ?? []).filter(e => e && isDay(e.day)).map(e => e.day))].sort();
}

function longestRun(days) {
  let best = 0, run = 0, prev = null;
  for (const day of days) {
    run = prev !== null && toUtc(day) - prev === DAY_MS ? run + 1 : 1;
    prev = toUtc(day);
    best = Math.max(best, run);
  }
  return best;
}

export function dailyStreak(entries, today) {
  const days = playedDays(entries);
  const set = new Set(days);
  const playedToday = set.has(today);
  let current = 0;
  if (isDay(today)) {
    let cursor = toUtc(today);
    if (!playedToday) cursor -= DAY_MS; // alive if last played day is yesterday
    while (set.has(fromUtc(cursor))) { current++; cursor -= DAY_MS; }
  }
  return { current, best: longestRun(days), playedToday };
}

// month is 1-12. Returns {year, month, offset, days:[{day, played, solved, isToday?}]};
// offset = blank cells before the 1st, Monday-first (Mon=0 ... Sun=6).
export function calendarMonth(entries, year, month, today = '') {
  const byDay = new Map();
  for (const e of entries ?? []) {
    if (!e || !isDay(e.day)) continue;
    const cur = byDay.get(e.day) ?? { played: true, solved: false };
    if (isWin(e)) cur.solved = true;
    byDay.set(e.day, cur);
  }
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const days = [];
  for (let d = 1; d <= count; d++) {
    const day = year + '-' + pad(month) + '-' + pad(d);
    const info = byDay.get(day);
    days.push({ day, played: !!info, solved: !!info?.solved, ...(day === today ? { isToday: true } : {}) });
  }
  return { year, month, offset, days };
}

export function treasure(entries) {
  const wins = (entries ?? []).filter(isWin).length;
  return { chests: Math.floor(wins / CHEST_SIZE), nextAt: (Math.floor(wins / CHEST_SIZE) + 1) * CHEST_SIZE,
    progress: { value: wins % CHEST_SIZE, target: CHEST_SIZE } };
}

export function achievements(entries, { themesTried = 0, revealsSeen = 0, today = '' } = {}) {
  const list = (entries ?? []).filter(Boolean);
  const wins = list.filter(isWin);
  const best = longestRun(playedDays(list));
  const cleared = new Set(list.filter(e => isWin(e) || (e.solved !== undefined && e.surprise)).map(e => e.level));
  const levelsCleared = [1, 2, 3, 4, 5].slice(0, LEVELS).filter(l => cleared.has(l)).length;
  const make = (id, title, description, value, target) => ({
    id, title, description, unlocked: value >= target, progress: { value: Math.min(value, target), target }
  });
  return [
    make('first-steps', 'First Steps', 'Solve your first puzzle.', wins.length, 1),
    make('sharp-eye', 'Sharp Eye', 'Solve a puzzle in 2 guesses.', wins.some(e => e.attempts <= 2) ? 1 : 0, 1),
    make('hat-trick', 'Hat Trick', 'Play 3 days in a row.', best, 3),
    make('week-warrior', 'Week Warrior', 'Play 7 days in a row.', best, 7),
    make('puzzle-pro', 'Puzzle Pro', 'Solve 25 puzzles.', wins.length, 25),
    make('treasure-hunter', 'Treasure Hunter', 'Clear all 5 levels of one campaign.', levelsCleared, LEVELS),
    make('fashionista', 'Fashionista', 'Try 4 themes.', themesTried, 4),
    make('got-baited', 'Got Baited', 'See the surprise reveal.', revealsSeen, 1)
  ];
}
