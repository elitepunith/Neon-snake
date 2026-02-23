# Neon Snake

A cyberpunk arcade snake game. Vanilla HTML, CSS, and JavaScript — no build step, no dependencies.

---

## Controls

| Input | Action |
|---|---|
| W / Arrow Up | Move up |
| S / Arrow Down | Move down |
| A / Arrow Left | Move left |
| D / Arrow Right | Move right |
| P | Pause / Resume |
| ESC | Restart |
| Swipe / D-pad | Move (mobile) |

---

## Scoring

| Item | Points |
|---|---|
| Food (pink dot) | Level x 10 |
| Bonus (yellow square) | Level x 50 |

Speed and score multiplier increase every few pickups across 10 levels. Bonus items expire if ignored.

---

## Run locally

```bash
# No build needed — open directly
open index.html

# Or with any static server
npx serve .
```

---

## Suggested upgrades

**Gameplay**
- Wall mode — lethal borders instead of wrap-around
- Ghost power-up — pass through your own body once
- Two-player on the same keyboard
- Seeded daily challenge

**Polish**
- Screen shake on death via canvas transform
- Connected rounded body segments instead of squares
- Dynamic background hue shift per level
- Haptic feedback on mobile via Vibration API

**Persistence**
- Top-10 leaderboard with initials stored in localStorage
- Share score as plain text

**Accessibility**
- Reduce-motion mode (disables glitch and particles)
- Color-blind palette option

---

## License

MIT — see LICENSE.
