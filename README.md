# best-flight-game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/0xzunid/best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/0xzunid/best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Skyline Courier — Ring Run.** A complete, original flight game that runs offline in a desktop browser from its own static files: take off from runway 36 in a little prop courier plane, fly a loop course through 8 glowing gold rings over farmland, a winding river and a small town, then land back on the runway before the 5-minute clock runs out. Chase view over recognisable terrain, the aircraft in frame, a lit instrument panel (artificial horizon, altimeter and speed tapes, compass, vertical speed), and a HUD with altitude, speed and heading. Keyboard + mouse, synthesized WebAudio engine hum and chimes, no libraries, no network requests.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. Hold W to spool the throttle, pull up (↑) at 55 m/s to rotate, steer with ←/→ to bank and turn. Fly through each gold ring in order — the HUD points at the next one — then land on runway 36: touch down gently under 100 kt on the centreline and roll to a stop. R restarts, M mutes.

## Scoring

- Ring +100 pts (chain rings into a combo for a bonus)
- Landing +200 pts, plus 2 pts per second left on the clock
- Win: all 8 rings + a safe landing. Crash, or run out of time, and the sortie ends.

## Files

- `game/` — the playable game: `index.html` + ES modules under `src/` (config, world, render, input, audio, shots)
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `screenshots/` — 4 real renders of the game: title on the runway, mid-course, threading a ring, sortie complete
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

---

<sub>Entered on [make.fun](https://make.fun/?ref=1q7g6m7h&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
