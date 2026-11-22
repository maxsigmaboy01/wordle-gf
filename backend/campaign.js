import defaults from './data/levels.json' with { type: 'json' };

export const SURPRISE_LEVEL = defaults.indexOf(null) + 1;
export const LEVEL_COUNT = defaults.length;

export function campaignAnswers(overrides, isWord) {
  return defaults.map((answer, index) => {
    if (answer === null) return null;
    const custom = overrides?.[index];
    return typeof custom === 'string' && isWord(custom) ? custom : answer;
  });
}

export function resumeLevel(saved) {
  const level = saved?.level;
  return Number.isInteger(level) && level >= 1 && level <= LEVEL_COUNT ? level : 1;
}

export function nextLevel(level) {
  return level < LEVEL_COUNT ? level + 1 : 1;
}
