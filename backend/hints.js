// Star-token hint system. Pure JS: no DOM, no clock, randomness only through an injectable rng.
export const HINT_TYPES = Object.freeze({
  peek: Object.freeze({ cost: 1, label: 'Letter Peek' }),
  lock: Object.freeze({ cost: 2, label: 'Position Lock' }),
  eliminate: Object.freeze({ cost: 1, label: 'Eliminate 3' })
});
export const START_STARS = 3;
export const MAX_STARS = 5;
export const ELIMINATE_COUNT = 3;
const WIDTH = 5;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const isLetter = value => typeof value === 'string' && /^[A-Z]$/.test(value);

export const REASONS = Object.freeze({
  disabled: 'Hints are turned off.',
  finished: 'The round is finished.',
  stars: 'Not enough stars.',
  safeNormal: 'Nothing safe to reveal.',
  safeSteered: 'Cannot be safely derived.',
  unknown: 'Unknown hint type.'
});

const clampStars = value => Math.max(0, Math.min(MAX_STARS, Number.isInteger(value) ? value : 0));

// A fresh 5-level session. Everything is JSON-serializable.
export function createHintState(overrides = {}) {
  return normalizeHintState({ stars: START_STARS, ...overrides });
}

// Repairs anything loaded from storage; missing/garbage fields fall back to defaults.
export function normalizeHintState(raw) {
  const locks = {};
  for (const [slot, letter] of Object.entries(raw?.locks ?? {})) {
    if (Number.isInteger(+slot) && +slot >= 1 && +slot <= WIDTH && isLetter(letter)) locks[slot] = letter;
  }
  const letters = list => [...new Set(Array.isArray(list) ? list.filter(isLetter) : [])];
  const history = (Array.isArray(raw?.history) ? raw.history : [])
    .filter(item => item && HINT_TYPES[item.type])
    .map(item => ({
      type: item.type,
      detail: String(item.detail ?? ''),
      cost: HINT_TYPES[item.type].cost,
      at: Number.isInteger(item.at) ? item.at : 0
    }));
  return {
    enabled: raw?.enabled !== false,
    stars: raw && 'stars' in raw ? clampStars(raw.stars) : START_STARS,
    peeks: letters(raw?.peeks),
    locks,
    eliminated: letters(raw?.eliminated),
    history
  };
}

// +1 star for winning levels 1-4 (call when Next Level is pressed), capped at MAX_STARS.
export function awardLevelWin(state) {
  const current = normalizeHintState(state);
  return { ...current, stars: clampStars(current.stars + 1) };
}

// Eliminated letters in the guess, or null when it is allowed.
export function guessBlockedBy(state, guess) {
  const blocked = (state?.eliminated ?? []).filter(letter => String(guess).includes(letter));
  return blocked.length ? blocked : null;
}

// What the player already knows from submitted guesses.
function knowledge(round) {
  const green = new Map();
  const present = new Set();
  const seen = new Set();
  (round.guesses ?? []).forEach((guess, row) => {
    [...guess].forEach((letter, slot) => {
      const rank = round.colors?.[row]?.[slot] ?? 0;
      seen.add(letter);
      if (rank === 2) green.set(slot + 1, letter);
      if (rank >= 1) present.add(letter);
    });
  });
  const absent = new Set([...seen].filter(letter => !present.has(letter)));
  return { green, present, absent };
}

function seededRng(seed = 7) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function shuffled(items, rng) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const pickOne = (items, rng) => items[Math.min(items.length - 1, Math.floor(rng() * items.length))];

function candidatesOf(round) {
  if (typeof round.candidateAnswers === 'function') return round.candidateAnswers();
  return [];
}

function derivePeek(round, state, cands, min, rng) {
  const { present } = knowledge(round);
  const taken = new Set([...state.peeks, ...Object.values(state.locks), ...state.eliminated, ...present]);
  const options = LETTERS.filter(letter => !taken.has(letter)
    && cands.filter(word => word.includes(letter)).length >= min);
  return options.length ? { type: 'peek', letter: pickOne(options, rng) } : null;
}

function deriveLock(round, state, cands, min, rng) {
  const { green } = knowledge(round);
  const pairs = [];
  for (let slot = 1; slot <= WIDTH; slot++) {
    if (state.locks[slot] || green.has(slot)) continue;
    for (const letter of new Set(cands.map(word => word[slot - 1]))) {
      if (cands.filter(word => word[slot - 1] === letter).length >= min) pairs.push({ slot, letter });
    }
  }
  return pairs.length ? { type: 'lock', ...pickOne(pairs, rng) } : null;
}

function deriveEliminate(round, state, cands, min, rng) {
  const { absent, present } = knowledge(round);
  const taken = new Set([...absent, ...present, ...state.eliminated, ...state.peeks, ...Object.values(state.locks)]);
  const pool = LETTERS.filter(letter => !taken.has(letter));
  const attempt = order => {
    let rest = cands;
    const letters = [];
    for (const letter of order) {
      const next = rest.filter(word => !word.includes(letter));
      // A letter must be absent from every remaining candidate set we keep (never from the answer).
      if (next.length < min || next.length === 0) continue;
      rest = next;
      letters.push(letter);
      if (letters.length === ELIMINATE_COUNT) return { type: 'eliminate', letters: letters.sort() };
    }
    return null;
  };
  for (let i = 0; i < 10; i++) {
    const fact = attempt(shuffled(pool, rng));
    if (fact) return fact;
  }
  return attempt(pool); // deterministic, same as the availability check
}

const DERIVERS = { peek: derivePeek, lock: deriveLock, eliminate: deriveEliminate };

function derive(round, state, type, rng) {
  const cands = candidatesOf(round);
  if (!cands.length) return null;
  // Surprise rounds must keep at least two candidates after the hint is applied.
  const min = round.steered ? 2 : 1;
  return DERIVERS[type](round, state, cands, min, rng);
}

function blockedReason(round, state, type) {
  if (!HINT_TYPES[type]) return REASONS.unknown;
  if (state.enabled === false) return REASONS.disabled;
  if (round.finished?.()) return REASONS.finished;
  if (state.stars < HINT_TYPES[type].cost) return REASONS.stars;
  return '';
}

export function hintOptions(round, rawState) {
  const state = normalizeHintState(rawState);
  return Object.keys(HINT_TYPES).map(type => {
    const cost = HINT_TYPES[type].cost;
    let reason = blockedReason(round, state, type);
    if (!reason && !derive(round, state, type, seededRng())) {
      reason = round.steered ? REASONS.safeSteered : REASONS.safeNormal;
    }
    return { type, label: HINT_TYPES[type].label, cost, available: !reason, reason };
  });
}

function describe(fact) {
  if (fact.type === 'peek') return `Contains the letter ${fact.letter}`;
  if (fact.type === 'lock') return `Slot ${fact.slot} is ${fact.letter}`;
  return `No ${fact.letters.join(' / ')}`;
}

// Confirming a hint: deducts stars, never consumes a guess. On failure nothing changes.
// On success the fact is also applied to the round (narrows steered candidates, blocks eliminated letters).
export function useHint(round, rawState, type, rng = Math.random) {
  const state = normalizeHintState(rawState);
  const reason = blockedReason(round, state, type);
  if (reason) return { ok: false, state, reason };
  const fact = derive(round, state, type, rng);
  if (!fact) return { ok: false, state, reason: round.steered ? REASONS.safeSteered : REASONS.safeNormal };
  if (typeof round.applyHintFacts === 'function' && !round.applyHintFacts(fact)) {
    return { ok: false, state, reason: REASONS.safeSteered };
  }
  const cost = HINT_TYPES[type].cost;
  const next = {
    ...state,
    stars: clampStars(state.stars - cost),
    peeks: type === 'peek' ? [...state.peeks, fact.letter] : state.peeks,
    locks: type === 'lock' ? { ...state.locks, [fact.slot]: fact.letter } : state.locks,
    eliminated: type === 'eliminate' ? [...state.eliminated, ...fact.letters] : state.eliminated,
    history: [...state.history, { type, detail: describe(fact), cost, at: round.guesses?.length ?? 0 }]
  };
  return { ok: true, state: next, fact };
}
