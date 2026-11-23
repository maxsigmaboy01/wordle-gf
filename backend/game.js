export const ATTEMPTS = 6;
export const WORD_LENGTH = 5;

export function gradeGuess(guess, answer) {
  const pattern = Array(WORD_LENGTH).fill(0);
  const unmatched = new Map();
  for (let index = 0; index < WORD_LENGTH; index++) {
    const letter = answer[index];
    if (guess[index] === letter) pattern[index] = 2;
    else unmatched.set(letter, (unmatched.get(letter) ?? 0) + 1);
  }
  for (let index = 0; index < WORD_LENGTH; index++) {
    const letter = guess[index];
    const available = unmatched.get(letter) ?? 0;
    if (!pattern[index] && available > 0) {
      pattern[index] = 1;
      unmatched.set(letter, available - 1);
    }
  }
  return pattern;
}

function parseWordList(text) {
  return [...new Set(text.toUpperCase().match(/\b[A-Z]{5}\b/g) ?? [])];
}

export function createPuzzle({ words, answers }) {
  const candidates = parseWordList(answers);
  if (!candidates.length) throw new Error('The candidate answer list is empty.');
  const dictionary = new Set([...candidates, ...parseWordList(words)]);
  const isWord = word => dictionary.has(word);

  function createRound(answer = '') {
    const guesses = [];
    const colors = [];
    let possibleAnswers = candidates;
    let typed = '';
    const hintLog = [];
    const eliminated = new Set();

    const solved = () => colors.at(-1)?.every(rank => rank === 2) ?? false;
    const finished = () => guesses.length === ATTEMPTS || solved();

    function score(guess) {
      if (answer) return gradeGuess(guess, answer);

      const partitions = new Map();
      for (const candidate of possibleAnswers) {
        const pattern = gradeGuess(guess, candidate).join('');
        if (pattern === '22222') continue;
        if (!partitions.has(pattern)) partitions.set(pattern, []);
        partitions.get(pattern).push(candidate);
      }

      // A forced exact match is accepted to preserve every previous clue.
      if (!partitions.size) return gradeGuess(guess, possibleAnswers[0]);

      let bestPattern;
      let bestScore = -1;
      for (const [pattern, matches] of partitions) {
        const colored = [...pattern].filter(rank => rank !== '0').length;
        const weight = matches.length * (1 + Math.min(2, colored) * .03);
        if (weight > bestScore) {
          bestPattern = pattern;
          bestScore = weight;
        }
      }
      possibleAnswers = partitions.get(bestPattern);
      return [...bestPattern].map(Number);
    }

    function guessError(word) {
      if (word.length !== WORD_LENGTH) return 'Enter a five-letter word.';
      if (!isWord(word)) return 'Not in word list.';
      const blocked = [...eliminated].filter(letter => word.includes(letter));
      if (blocked.length) return `Eliminated letters: ${blocked.join(', ')}.`;
      if (guesses.includes(word)) return 'You already guessed that word.';
      return '';
    }

    function submit() {
      if (finished()) return 'Round complete.';
      const error = guessError(typed);
      if (error) return error;
      colors.push(score(typed));
      guesses.push(typed);
      typed = '';
      return '';
    }

    function type(key) {
      if (finished()) return false;
      if (key === '⌫' || key === 'BACKSPACE') {
        if (!typed) return false;
        typed = typed.slice(0, -1);
        return true;
      }
      if (!/^[A-Z]$/.test(key) || typed.length === WORD_LENGTH) return false;
      typed += key;
      return true;
    }

    // Hint facts: {type:'peek',letter} | {type:'lock',letter,slot 1-5} | {type:'eliminate',letters}.
    // A steered round (no fixed answer) narrows its candidates so later feedback stays consistent.
    // Returns false when the fact is malformed or would leave no candidate (then it is ignored).
    function applyHintFacts(fact) {
      let keep;
      if (fact?.type === 'peek' && /^[A-Z]$/.test(fact.letter)) {
        keep = word => word.includes(fact.letter);
      } else if (fact?.type === 'lock' && /^[A-Z]$/.test(fact.letter) && fact.slot >= 1 && fact.slot <= WORD_LENGTH) {
        keep = word => word[fact.slot - 1] === fact.letter;
      } else if (fact?.type === 'eliminate' && Array.isArray(fact.letters) && fact.letters.every(l => /^[A-Z]$/.test(l))) {
        keep = word => !fact.letters.some(letter => word.includes(letter));
      } else return false;
      if (!answer) {
        const next = possibleAnswers.filter(keep);
        if (!next.length) return false;
        possibleAnswers = next;
      }
      if (fact.type === 'eliminate') for (const letter of fact.letters) eliminated.add(letter);
      hintLog.push({ at: guesses.length, fact: JSON.parse(JSON.stringify(fact)) });
      return true;
    }

    // Candidates still consistent with feedback and hints (a fixed round has just its answer).
    const candidateAnswers = () => (answer ? [answer] : possibleAnswers.slice());

    function restore(saved) {
      if (!Array.isArray(saved?.guesses)) return;
      const log = Array.isArray(saved.hintLog) ? saved.hintLog : [];
      const replayHints = () => {
        for (const entry of log) if (entry?.at === guesses.length) applyHintFacts(entry.fact);
      };
      replayHints();
      for (const guess of saved.guesses.slice(0, ATTEMPTS)) {
        if (typeof guess !== 'string' || guessError(guess) || finished()) break;
        typed = guess;
        submit();
        replayHints();
      }
      if (!finished() && typeof saved.typed === 'string' && /^[A-Z]{0,5}$/.test(saved.typed)) {
        typed = saved.typed;
      }
    }

    return {
      guesses,
      colors,
      get typed() { return typed; },
      type,
      submit,
      restore,
      applyHintFacts,
      candidateAnswers,
      steered: !answer,
      hintLog,
      solved,
      finished
    };
  }

  return { isWord, createRound };
}

export function summarizeRounds(history) {
  const distribution = Array(ATTEMPTS).fill(0);
  let solved = 0;
  let streak = 0;
  let best = 0;
  for (const result of history) {
    distribution[result.attempts - 1]++;
    if (result.solved) {
      solved++;
      streak++;
      best = Math.max(best, streak);
    } else {
      streak = 0;
    }
  }

  return { played: history.length, solved, streak, best, distribution };
}
