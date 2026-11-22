# Daily Puzzle

Five five-letter puzzles in sequence, with a surprise on level 3. The editor builds a single player HTML file that works offline.

## Run locally

```sh
npm ci
npm test
npm run build
```

Open `dist/index.html` in a browser. For the web manifest and Home Screen icon, serve the `dist/` directory over HTTP or HTTPS.

1. Choose five-letter English answers for levels 1, 2, 4, and 5. Each is an ordinary puzzle with six guesses.
2. Edit the six reveal lines and caption for level 3. Use the preview to check the surprise.
3. Download the standalone player HTML. It starts on level 1 and saves its current level and guesses in the browser. A normal level can be retried after a loss or completed to continue.

The default answers are `PLANT`, `CLOUD`, `BRAVE`, and `SPARK` in that order. Edit [levels.json](backend/data/levels.json) to change the defaults, keeping the third slot `null` for the surprise.

## Project layout

- [Frontend](frontend/) holds the page, styles, browser storage, keyboard, animation, and approved sprite assets.
- [Backend](backend/) holds the game rules, grading, round state, and the dictionaries. The engine is a JavaScript module bundled with the frontend so the player needs no running server.
- [Accepted guesses](backend/data/words.txt) is an alphabetized, one-word-per-line English list. It includes 12,425 words from Berkeley `web2`, [ENABLE 2K](https://github.com/BartMassey/wordlists/blob/main/README-enable2k.txt), and a small modern supplement.
- [Candidate answers](backend/data/answers.txt) contains the smaller list used to choose consistent clues in surprise mode. Keep its order when editing if previously saved games must replay the same clues.

Run `npm run build` after editing any source or dictionary. The generated `dist/` folder is ignored in Git. The player HTML embeds the rules, dictionary, and reveal images.

The surprise mode prefers a feedback pattern that leaves a plausible non-winning answer. In the rare case that the only compatible answer is guessed, it accepts the solve so previous clues stay coherent. Completed rounds and draft guesses are saved per puzzle in the current browser. Shared scores omit the secret message.
