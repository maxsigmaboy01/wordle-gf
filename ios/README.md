# Daily Puzzle for iPhone

The SwiftUI app loads an offline copy of the five-level game in WebKit. The player starts at level 1. Swift stores progress, stats, and themes in the app sandbox, and opens the iOS share sheet for scores.

## Run in Xcode

1. Run `npm ci` in the repository root. Xcode's build phase uses Node.js to bundle the game into the app.
2. Open `DailyPuzzle.xcodeproj` and select the `DailyPuzzle` scheme.
3. Under Signing & Capabilities, select your team with automatic signing. Use a bundle identifier available to that team if needed.
4. Enable Developer Mode on the iPhone. Select the connected phone as the run destination and press Run.

The app targets iOS 17 or later. Xcode also needs its iOS platform components to build and the appropriate device support to run on a connected iPhone.

## Customize the player

Create `ios/player.local.json` before building to give this copy its own message or seasonal theme. This file is ignored by Git. Every field is optional.

```json
{
  "answers": ["PLANT", "CLOUD", null, "BRAVE", "SPARK"],
  "message": ["YOU", "ARE", "MY", "SAFE", "PLACE", "♡"],
  "ending": "I just wanted to say: I love you. ♡",
  "season": "classic"
}
```

Leave the third answer as `null` for the surprise. Themes are `classic`, `christmas`, `spring`, `halloween`, `space`, and `summer`.
