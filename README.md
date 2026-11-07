# GRONKILLION 🏈

**Think NFL. Go Deep. Score Big.**
*The obvious answers get first downs. The legends get touchdowns.*

GRONKILLION is a browser-based NFL trivia game. A drive is seven timed plays. Each play is an open-ended prompt with many correct answers, and the less obvious your answer, the more yards you gain. Seven legendary answers carry the ball into the end zone for a touchdown.

## Play

Open `index.html` in any modern browser. There is no server, build step, account or API key. If GitHub Pages is enabled for this repo, the game is also playable at the Pages URL.

- **Kickoff** starts today's Daily Challenge, or Unlimited Mode once the Daily is done.
- Each play gives you a 3-second snap count to read the prompt, then 25 seconds to answer.
- Press **Enter** or **Submit Answer**. Wrong answers don't end the play; your first accepted answer locks it in.

### Scoring

| Tier | Points | Meaning |
|---|---:|---|
| Chalk Pick | 10 | Extremely obvious answer |
| Starter | 15 | Commonly known answer |
| Pro Bowler | 30 | Good football knowledge |
| All-Pro | 60 | Uncommon, impressive answer |
| Hall of Famer | 85 | Very obscure answer |
| GRONKILLION | 100 | Extremely rare, legendary answer |

A perfect drive is worth 700 points and goes from your own goal line to the opposing end zone. Rarity tiers are curated estimates of how likely an average fan is to recall each answer, not live player statistics.

### Modes

- **Daily Challenge:** the same seven plays for everyone on a given UTC date, selected with the date as a seed. One scored attempt per day.
- **Unlimited Mode:** play as many drives as you like. Recently used questions are avoided.

## Features

- 40 prompts across 12 categories. Each answer list is complete for its stated scope, with facts through the 2025 season, Super Bowl LX, the 2026 NFL Draft and the Pro Football Hall of Fame Class of 2026.
- Forgiving answer matching: capitalization, punctuation, apostrophes and suffixes (Jr., III) don't matter; nicknames, team cities, abbreviations, historical franchise names and old stadium names all work; small typos are accepted conservatively. A last name shared by several well-known players asks for a first name.
- Retro pixel-art presentation: a night stadium whose crowd reacts to your drive, a pixel field with a running back who runs (or catches a pass) to each new spot, tier lines that sweep ahead of the ball, a segmented play clock, tier mascots, a drive-log chart and a pixel touchdown celebration.
- Small typos are corrected, but you confirm the correction with a second submit before it locks in.
- Progress is saved in localStorage, so a refresh resumes the drive. The game still works when storage is blocked.
- Optional Web Audio sound effects (muted by default) and a shareable results summary that reveals no answers.
- Keyboard navigation, screen-reader announcements, reduced-motion support and layouts down to phone width.

## Project layout

```
index.html       The complete game (generated; open this to play)
build.py         Assembles index.html from src/
src/shell.html   Page markup
src/styles.css   Styles
src/data.js      Question database plus team, stadium and player aliases
src/sprites.js   Pixel sprites as character grids, rendered once to SVG symbols
src/engine.js    Game engine: validation, timer, scoring, field, rendering, storage, sound, sharing
test/unit.py     Answer-validation and data-integrity checks
test/play.py     End-to-end gameplay checks
```

Edit the files in `src/`, then rebuild the single-file game:

```bash
python3 build.py
```

## Tests

The tests drive the real page in headless Chromium through Playwright:

```bash
pip install playwright
python -m playwright install chromium
python3 test/unit.py
python3 test/play.py   # saves screenshots to test/shots/
```

## Adding a question

Questions live in `src/data.js` under `GRONK_DATA.questions`. Each one lists its answers by rarity tier, plus optional `near` notes shown when a well-known wrong answer is entered. Keep every answer list complete for the question's stated scope, and give every question at least one `gronkillion` answer so a perfect 700 stays possible (`test/unit.py` checks this).

---

GRONKILLION is an independent football trivia game and is not affiliated with or endorsed by the NFL. Player and team names are used as factual references only. Font: VT323 (SIL Open Font License), loaded from Google Fonts. All pixel art is original and drawn in code.
