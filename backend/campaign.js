import levels from './data/levels.json' with { type: 'json' };

const defaults = levels.answers;
export const SURPRISE_OFF_ANSWER = levels.surpriseOffAnswer;
export const SURPRISE_DEFAULTS = Object.freeze({
  enabled: true, failAll: true, reveal: true, activation: 'after-final-try'
});
const ACTIVATIONS = ['after-final-try', 'manual', 'shared-link-only'];

export const SURPRISE_LEVEL = defaults.indexOf(null) + 1;
export const LEVEL_COUNT = defaults.length;

// settings: partial/undefined surprise settings; context: 'app' | 'export'.
// No settings => today's behaviour (surprise on, steered, auto reveal).
export function resolveSurprise(settings, context = 'app') {
  const s = { ...SURPRISE_DEFAULTS };
  for (const key of ['enabled', 'failAll', 'reveal']) {
    if (typeof settings?.[key] === 'boolean') s[key] = settings[key];
  }
  if (ACTIVATIONS.includes(settings?.activation)) s.activation = settings.activation;
  const active = s.enabled && (s.activation !== 'shared-link-only' || context === 'export');
  const reveal = active && s.reveal;
  const level = Number.isInteger(settings?.level) && settings.level >= 1 && settings.level <= LEVEL_COUNT
    ? settings.level : SURPRISE_LEVEL;
  return {
    ...s,
    level,
    active,
    steered: active && s.failAll,
    reveal,
    autoReveal: reveal && s.activation !== 'manual',
    manualReveal: reveal && s.activation === 'manual'
  };
}

export function isSurpriseLevel(level, surprise) {
  return Boolean(surprise?.active) && level === (surprise.level ?? SURPRISE_LEVEL);
}

function pick(overrides, isWord, index) {
  const custom = overrides?.[index];
  if (typeof custom === 'string' && isWord(custom)) return custom;
  return defaults[index] ?? SURPRISE_OFF_ANSWER;
}

// Answers ignoring surprise settings: slot 3 stays null. Stable input for save identity.
export function baseAnswers(overrides, isWord) {
  return defaults.map((answer, index) => (answer === null ? null : pick(overrides, isWord, index)));
}

// surprise: result of resolveSurprise (omit for the classic steered level 3).
// The steered slot is surprise.level - 1 (null); every other slot gets a real answer.
export function campaignAnswers(overrides, isWord, surprise) {
  if (!surprise) return baseAnswers(overrides, isWord);
  const steeredIndex = surprise.steered ? (surprise.level ?? SURPRISE_LEVEL) - 1 : -1;
  return defaults.map((_, index) => (index === steeredIndex ? null : pick(overrides, isWord, index)));
}

export function resumeLevel(saved) {
  const level = saved?.level;
  return Number.isInteger(level) && level >= 1 && level <= LEVEL_COUNT ? level : 1;
}

export function nextLevel(level) {
  return level < LEVEL_COUNT ? level + 1 : 1;
}
