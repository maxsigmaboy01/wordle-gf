# Daily Puzzle V3 — 8 Theme / Scene System

## Visual direction
ต้นแบบ UI เกมเต็มหน้าต่าง macOS อิง concept Christmas ที่ผู้ใช้เลือก: background กว้าง, คีย์บอร์ด/กระดานอยู่กลาง, HUD ด้านบน, Mascot ข้างกระดาน, icon hints, 6 rows × 5 columns. Dino Classic เป็น default app icon และ mascot fallback เสมอ.

## ธีมที่รองรับ
| id | display name | mood | mascot | background strip | BGM |
| --- | --- | --- | --- | --- | --- |
| classic | Classic Meadow | Forest green / cream, grass | Dino Classic | bg_classic_1600x400.png | bgm_classic_arcade.mp3 |
| christmas | Christmas Village | Pink sky / red / snow | Santa-hat Dino + gift | bg_christmas_1600x400.png | bgm_christmas_party.mp3 |
| halloween | Halloween | Purple / pumpkin / tiny spooky | Witch-hat Dino | bg_halloween_1600x400.png | bgm_halloween_bop.mp3 |
| spring | Spring Blossom | Blossom pink / petals | Sakura Dino | bg_spring_1600x400.png | bgm_spring_hop.mp3 |
| space | Space Night | Blue-violet / moon | Astronaut Dino | bg_space_1600x400.png | bgm_space_boost.mp3 |
| summer | Summer Picnic | Sky blue / golden picnic | Straw-hat Dino | bg_summer_1600x400.png | bgm_summer_sprint.mp3 |
| valentine | Valentine | Blush pink / love letter | Letter + balloon Dino | bg_valentine_1600x400.png | reuse Classic track |
| rainy | Rainy Day | Blue-gray / rain | Yellow raincoat Dino | bg_rainy_1600x400.png | reuse Spring track |

## Layout / anatomy
- macOS topbar / traffic light decoration (native app should defer to Tauri title-bar config)
- Top: pause/home, current level 1..5, five markers, remaining guesses, puzzle #, theme switch and audio
- Center: 5×6 Word Board, hint button, clue-memory chips, tactile keyboard, valid-word errors
- Right: chosen theme tag and remaining stars
- Bottom: 1600×400 pixel-art scene strip, mascot sprite and treasure chest
- Theme affects CSS tokens and scene/mascot art; word game engine and hint economy do not change

## Art fidelity notes
- `docs/V3_THEME_SCREENSHOTS/*` are **design-layout mockups**, not browser test captures.
- `docs/V3_CONCEPT_BOARD.png` is an aspirational concept rendering and may differ from existing production-ready asset resolution.
- Existing `bg_*_1600x400.png` are simplified implementation backgrounds; production artwork should be reviewed against chosen Christmas concept.
- `dino_original_exact.png` is the canonical character. Seasonal sprites are prototypes and should be checked for continuity in body proportions / pixel grid.

## Interaction behavior
- Theme can be changed in the in-game paint-palette icon without resetting puzzle
- Settings > Appearance / Theme page also changes the scene
- Motion reduces under `prefers-reduced-motion` and user Reduced Motion setting
- Music is opt-in by default, SFX enabled by default; audio reacts to theme if enabled
- If seasonal sprite missing, fall back to Dino Classic; do not show broken img in final build
- Surprise Mode off by default, still shows neutral theme art until final reveal

## For dev (recommended refactor)
- `ThemeRegistry`: id, displayName, paletteTokens, background, mascotIdle, music, ambiance
- `HintEngine`: target/candidates, hintType, cost, result, cannotUseReason
- `PuzzleSession`: level, lives, prior feedback, typed row, tokens, hints
- `RevealController`: final row-by-row flips, reduced motion fallback
- `AudioManager`: BGM crossfade, SFX with user gesture, separate gains
- `SettingsStore`: persist preferences and puzzle snapshot across restarts
- Progressive enhancements: particle layers, parallax strips, clickable chest, streaks, theme unlocks, adaptive 5-level difficulty
