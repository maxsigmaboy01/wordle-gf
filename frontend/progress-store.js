// Cross-campaign progress for the app shell.
// - 'daily-puzzle-log': every finished round from every campaign ({id, level, attempts, solved, day, surprise}).
//   Streaks, the calendar, chests and most achievements read it, so they span all campaigns.
// - 'daily-puzzle-progress': {themesTried: [theme ids], revealsSeen: number}.
import { readStorage, saveStorage } from './storage.js';

const LOG_KEY = 'daily-puzzle-log';
const PROGRESS_KEY = 'daily-puzzle-progress';
const THEME_IDS = ['classic', 'christmas', 'spring', 'halloween', 'space', 'summer', 'valentine', 'rainy'];

const validEntry = item => typeof item?.id === 'string' && Number.isInteger(item.attempts) && item.attempts >= 1 &&
  typeof item.solved === 'boolean';

export function loadLog() {
  const saved = readStorage(LOG_KEY);
  return Array.isArray(saved) ? saved.filter(validEntry) : [];
}

export function logResult(entry) {
  const log = loadLog();
  if (log.some(item => item.id === entry.id)) return;
  log.push(entry);
  saveStorage(LOG_KEY, log);
}

// Log order is chronological, so it comes first; history ids missing from the log (older, undated rounds) follow in their own order.
export function mergeLists(history, log) {
  const byId = new Map();
  for (const item of log) byId.set(item.id, { ...item });
  for (const item of history) byId.set(item.id, { ...item, ...byId.get(item.id) });
  return [...byId.values()];
}

export function mergeEntries(history) {
  return mergeLists(history, loadLog());
}

export function loadProgress() {
  const saved = readStorage(PROGRESS_KEY);
  const tried = Array.isArray(saved?.themesTried) ? saved.themesTried.filter(id => THEME_IDS.includes(id)) : [];
  const reveals = Number.isInteger(saved?.revealsSeen) && saved.revealsSeen > 0 ? saved.revealsSeen : 0;
  return { themesTried: new Set(tried), revealsSeen: reveals };
}

function persist(progress) {
  saveStorage(PROGRESS_KEY, { themesTried: [...progress.themesTried], revealsSeen: progress.revealsSeen });
}

export function noteTheme(id) {
  if (!THEME_IDS.includes(id)) return;
  const progress = loadProgress();
  if (progress.themesTried.has(id)) return;
  progress.themesTried.add(id);
  persist(progress);
}

export function noteReveal() {
  const progress = loadProgress();
  progress.revealsSeen += 1;
  persist(progress);
}
