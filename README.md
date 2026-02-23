# Neon Snake

A cyberpunk-themed arcade snake game built with vanilla HTML, CSS, and JavaScript.
No frameworks. No dependencies. Deployable in one step.

---

## Live Demo

Deploy to Vercel and your game is live. See the deployment section below.

---

## Features

- Classic snake gameplay on a 25x25 grid
- Procedural audio via Web Audio API — no audio files required
- Particle burst effects on food pickup and death
- CRT scanline and vignette overlay
- Glitch animation on title screens
- Responsive canvas that scales to any screen size
- Touch controls for mobile (swipe on canvas or use the D-pad buttons)
- Keyboard support: WASD, arrow keys, P to pause, ESC to restart
- Ten speed levels with progressive difficulty
- Bonus collectibles that spawn randomly and time out
- High score persisted to localStorage
- Zero runtime dependencies

---

## Project Structure

```
neon-snake/
├── index.html       Main HTML document, overlays, touch controls
├── style.css        All styling, CRT effects, responsive breakpoints
├── script.js        Game engine, audio, input handling, canvas rendering
├── vercel.json      Vercel deployment config
├── LICENSE          MIT License
└── README.md        This file
```

---

## Getting Started

No build step required. Open `index.html` in any modern browser.

```bash
# Clone or download the repo, then open the file directly
open index.html

# Or serve locally with any static server
npx serve .
python3 -m http.server 8080
```

---

## Deployment on Vercel

1. Push the project to a GitHub repository.
2. Go to vercel.com and import the repository.
3. Leave all build settings at their defaults — there is no build command.
4. Click Deploy.

The `vercel.json` file handles routing automatically. Every deploy takes under 10 seconds.

---

## Controls

| Input             | Action           |
|-------------------|------------------|
| W / Arrow Up      | Move up          |
| S / Arrow Down    | Move down        |
| A / Arrow Left    | Move left        |
| D / Arrow Right   | Move right       |
| P                 | Pause / Resume   |
| ESC               | Restart          |
| Swipe on canvas   | Move (mobile)    |
| D-pad buttons     | Move (mobile)    |

---

## Scoring

| Item            | Points              |
|-----------------|---------------------|
| Food (pink)     | Level x 10          |
| Bonus (yellow)  | Level x 50          |

The level increases every few food pickups. As the level rises, the snake moves faster and the score multiplier increases. Bonus items spawn randomly and disappear after a short window if not collected.

---

## Browser Support

Tested and working in Chrome, Firefox, Safari, and Edge.
Web Audio API is used for sound. The game runs silently if the browser blocks audio before a user interaction — audio unlocks automatically on the first button click or keypress.

---

## Suggested Upgrades

The following improvements would meaningfully enhance the game without changing its character:

**Gameplay**
- Wall mode toggle: make the borders lethal instead of wrapping
- Two-player mode on the same keyboard
- Configurable starting speed and grid size in a settings menu
- Ghost mode power-up that allows the snake to pass through itself once

**Persistence and social**
- Top-10 local leaderboard stored in localStorage with initials input
- Share score button that generates a plain-text result for social posting
- Daily challenge with a seeded random food layout

**Visual polish**
- Snake body rendered as connected rounded segments rather than individual squares
- Trail afterimage effect on the head at higher speeds
- Dynamic background color shift per level
- Screen shake on death using canvas transform

**Audio**
- Background ambient drone that shifts pitch with the current level
- Distinct sound for level-up versus special pickup

**Mobile**
- Haptic feedback via the Vibration API on eat and death events
- Landscape lock warning on very small screens
- Standalone PWA mode with a manifest and service worker for offline play

**Accessibility**
- Reduce motion mode that disables glitch animations and particles
- Color-blind friendly palette option in settings
- Screen reader announcements for score changes and game events

---

## License

MIT License. See LICENSE file for full terms.
