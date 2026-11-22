# Daily Puzzle

A five-letter puzzle with a surprise ending. The editor builds a single player HTML file that works offline.

## Run locally

```sh
npm ci
npm test
npm run build
```

Open `dist/index.html` in a browser. For the web manifest and Home Screen icon, serve the `dist/` directory over HTTP or HTTPS.

1. Leave the answer blank for the surprise mode or choose a five-letter English answer for a fixed puzzle.
2. Edit the six reveal lines and caption. Preview the result.
3. Download the standalone player HTML. It shows no editor, and its reveal text appears at the end of the round.

## Project layout

- [Frontend](frontend/) holds the page, styles, browser storage, keyboard, animation, and approved sprite assets.
- [Backend](backend/) holds the game rules, grading, round state, and the dictionaries. The engine is a JavaScript module bundled with the frontend so the player needs no running server.
- [Accepted guesses](backend/data/words.txt) is an alphabetized, one-word-per-line English list. It includes 12,425 words from Berkeley `web2`, [ENABLE 2K](https://github.com/BartMassey/wordlists/blob/main/README-enable2k.txt), and a small modern supplement.
- [Candidate answers](backend/data/answers.txt) contains the smaller list used to choose consistent clues in surprise mode. Keep its order when editing if previously saved games must replay the same clues.

Run `npm run build` after editing any source or dictionary. The generated `dist/` folder is ignored in Git. The player HTML embeds the rules, dictionary, and reveal images.

The surprise mode prefers a feedback pattern that leaves a plausible non-winning answer. In the rare case that the only compatible answer is guessed, it accepts the solve so previous clues stay coherent. Completed rounds and draft guesses are saved per puzzle in the current browser. Shared scores omit the secret message.
