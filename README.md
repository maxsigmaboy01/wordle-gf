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

Choose a seasonal theme in **Settings**. The exported player starts with that theme and can switch themes independently. GIFs and their still frames are embedded for offline use. Summer Picnic uses the supplied Classic dinosaur with its own palette.

The default answers are `APPLE`, `CLOUD`, `BRAVE`, and `SPARK` in that order. Edit `answers` in [levels.json](backend/data/levels.json) to change the defaults, keeping the third slot `null` for the surprise. `surpriseOffAnswer` (`OCEAN`) is the level 3 answer when Surprise Mode is off; it is off by default in the Mac app.

## Project layout

- [Frontend](frontend/) holds the page, styles, browser storage, keyboard, animation, and approved sprite assets.
- [Backend](backend/) holds the game rules, grading, round state, and the dictionaries. The engine is a JavaScript module bundled with the frontend so the player needs no running server.
- [Accepted guesses](backend/data/words.txt) is an alphabetized, one-word-per-line English list. It includes 12,592 words from Berkeley `web2`, [ENABLE 2K](https://github.com/BartMassey/wordlists/blob/main/README-enable2k.txt), a small modern supplement, and filtered entries from the American, British, Australian, and Canadian [ESDB 2026.02.25 speller dictionaries](https://github.com/en-wl/wordlist-diff/tree/rel-2026.02.25). The ESDB notice is bundled with the HTML. [License](backend/data/ESDB-LICENSE.txt)
- [Candidate answers](backend/data/answers.txt) contains the smaller list used to choose consistent clues in surprise mode. Keep its order when editing if previously saved games must replay the same clues.

Run `npm run build` after editing any source or dictionary. The generated `dist/` folder is ignored in Git. The player HTML embeds the rules, dictionary, and reveal images.

The surprise mode prefers a feedback pattern that leaves a plausible non-winning answer. In the rare case that the only compatible answer is guessed, it accepts the solve so previous clues stay coherent. Completed rounds and draft guesses are saved per puzzle in the current browser. Shared scores omit the secret message.

## iPhone app

Open the SwiftUI project in Xcode to build and run the offline game on an iPhone. See the [iOS setup](ios/README.md).

## Web player and Mac app

Build a player-only page with `npm run build:player`. Open `dist/player/index.html` on the Mac or serve only the `dist/player` directory and open that address in Safari on the iPhone. The downloaded HTML embeds the sound and theme assets.

The authoring view puts **Export player HTML** in **Settings**. The game sounds and seasonal music can be adjusted there. Music starts off until enabled.

For macOS, install the Rust toolchain, run `npm ci`, then run `npm run build:mac`. The Rust/Tauri app uses the Classic Dino icon and opens a macOS save dialog for player exports. The bundle is generated under `src-tauri/target/release/bundle/macos/`. A local debug bundle can be built using `npm run build:mac -- --debug`.
