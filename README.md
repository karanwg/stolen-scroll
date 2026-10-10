# The Stolen Scroll

A browser metroidvania. You are a ninja chasing the Binoshi — shinobi who stole
your village's Ancient Scroll and are using it to wake monsters, ending with the
Mind Flayer.

Playable now:

- **Chapter I — Kagari Village**: the burning village, Binoshi enemies, double
  jump and dash, and the Balrog.
- **Chapter II — The Drowned Coast**: a storm-lashed coast (about 1.6× the length
  of Chapter I) — stilt village, wreck cove, lighthouse, open strait, floating
  shrine. Kappa, jellyfish, sea tentacles, storm crows. The **Mizugumo**
  (water-walking) and **Kite Cloth** (float), and the Kraken.

Finishing a chapter rolls straight into the next; **Chapter Select** on the title
screen replays any chapter you've reached (abilities carry over).

## Run

```bash
pnpm install
pnpm dev
```

Open http://localhost:5180.

## Controls

| Action | Keys |
|---|---|
| Move | ← → or A D |
| Jump (hold for height) | Z or Space |
| Slash (hold ↑ / ↓ to aim, ↓ in the air to pogo) | X or J |
| Dash | C, K or Shift |
| Interact / meditate at lanterns | ↑ or W |
| Drop through a beam | ↓ + Jump |
| Float (Kite Cloth) | press and hold Jump in midair; hold Jump inside a geyser to ride it |
| Water walk (Mizugumo) | just run onto calm water — keep moving or you sink; whitecaps can't be walked on |
| Wall jump (once unlocked) | hold toward a wall, then Jump |
| Pause · Mute | Esc · M |

## Dev tools

- **`` ` `` (backquote)** opens the tuning panel: every movement, combat and camera
  constant as a live slider (saved to localStorage), ability toggles (float and
  wall jump aren't in Chapter I yet — unlock them here), god mode, hitboxes,
  slow-motion and warp buttons.
- **`/debug/poses.html`** draws every character pose large (`?only=float`, `?style=binoshi`).
- In the console, `H` (from `debug/harness.js`) drives the game deterministically:
  `H.fresh()`, `H.chapter(2)`, `H.warp(x, y)`, `H.hold('right')`, `H.secs(1)`,
  `H.bounceOn(jelly)`, `H.snap('name')` → `.snaps/name.png`.

## Layout

```
src/
  config.js            tuning constants (the feel)
  game.js              game loop, modes, combat, triggers, rendering order
  core/                input, camera, synthesized audio, math
  world/               level + collision, themes, stage1 + stage2 layouts
  entities/            player, Binoshi enemies, sea creatures, Balrog, Kraken, props
  render/              ninja rig, skies, terrain, props, water, weather, lighting
  ui/                  HUD, dialogue, menus and cards, tuning panel
  data/story.js        all story text
```

Everything is drawn procedurally on a canvas and every sound is synthesized: no image or audio files.
