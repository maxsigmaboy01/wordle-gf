# wordle-gf

A five-letter puzzle with six guesses and a surprise ending. The game checks English words, keeps feedback consistent, and saves progress in the current browser. It supports a physical keyboard, on-screen keys, and light and dark themes.

1. Open [the game editor](romantic_word_puzzle_for_your_partner.html) in a browser.
2. Set a five-letter English answer, or leave it blank for the six-guess surprise mode. Edit the six reveal lines and the caption in the settings panel.
3. Preview the ending, then download the standalone player HTML. The player version opens offline and shows the message after the round ends.

The offline dictionary accepts 12,425 five-letter words, combining the game’s answer list with Berkeley’s public-domain `web2` list, [ENABLE 2K](https://github.com/BartMassey/wordlists/blob/main/README-enable2k.txt), and a small supplement for current usage. The web manifest references the supplied Home Screen icons when the project is served over HTTP or HTTPS.
