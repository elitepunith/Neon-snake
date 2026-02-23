# Neon Snake

Cyberpunk arcade snake. Vanilla HTML, CSS, JavaScript — no build step, no dependencies.

---

## Controls

| Input | Action |
|---|---|
| W A S D / Arrows | Move |
| P | Pause / Resume |
| ESC | Restart |
| Swipe / D-pad | Move (mobile) |

---

## Scoring

| Item | Points |
|---|---|
| Food (pink) | Level × 10 |
| Bonus (yellow) | Level × 50 |

10 levels of increasing speed. Bonus items expire if not collected in time.

---

## Run locally

```bash
open index.html
# or
npx serve .
```

---

## Suggested upgrades

**Gameplay**
- Wall mode — lethal borders instead of wrap-around
- Ghost power-up — pass through body once
- Daily challenge with seeded food layout
- Two-player on the same keyboard

**Feel**
- Screen shake on death via canvas transform
- Rounded connected body segments instead of squares
- Haptic feedback on mobile via `navigator.vibrate()`
- Background hue shift per level

**Persistence**
- Local top-10 leaderboard with initials
- Share score as plain text

**Accessibility**
- Reduce-motion mode (disables glitch + particles)
- Color-blind friendly palette toggle

---

## License

MIT — see LICENSE.
