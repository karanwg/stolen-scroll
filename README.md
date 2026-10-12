# The Stolen Scroll

A browser metroidvania. You are a ninja chasing the Binoshi — shinobi who stole
your village's Ancient Scroll and are using it to wake monsters, ending with the
Mind Flayer.

Playable now:

- **Chapter I — Kagari Village**: the burning village, Binoshi enemies, double
  jump and dash, and the Balrog.
- **Chapter II — The Drowned Coast**: a storm-lashed coast (about 1.6× the length
  of Chapter I) — stilt village, wreck cove, lighthouse, open strait, floating
  shrine. Kappa, jellyfish, sea tentacles, storm crows. The **Water-Spiders**
  (water-walking) and **Kite Cloth** (float), and the Kraken.
- **Chapter III — The Fallen Star**: about twice the length of Chapter II. Snow
  first — the frozen pass, a Binoshi camp ambush, a cliff temple of bells, an
  onsen, the frozen falls — then, gradually, the wreck: a scorched slope, a
  crater of black glass, the crashed salvage ship MSV Tethys (strip lights,
  hypersleep, a power failure), the alien derelict fused into
  it (the Pilot, the egg chamber), and the nest in the cargo bay: the
  Xenomorph. The **Shadow Dash** (untouchable dash and sprint), the **Grappling Hook** and the **Clinging Claws** (wall jump).
- **Chapter IV — The Upside Down** (the finale): home to Kagari, rebuilt — and
  its villagers sleepwalking to the shrine. The **Otherworld Mirror** lets
  you shift between the real world and the Upside Down beneath it (same map,
  different ground, enemies and hazards; it drains you if you stay). Then the
  Hollow Wood, the Drowned Terraces, a duel with the Binoshi Master, the
  Inverted Pagoda (the world turns over), the Mind Flayer, and dawn.

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
| Move | ← → |
| Jump (hold for height) | Z or Space |
| Slash (hold ↑ / ↓ to aim, ↓ in the air to pogo) | X or J |
| Dash | C, K or Shift |
| Shadow dash (Shadow Dash) | every 3 s a dash makes you untouchable for its length |
| Sprint (Shadow Dash) | keep holding Dash after the burst |
| Interact / meditate at lanterns | ↑ |
| Drop through a beam | ↓ + Jump |
| Float (Kite Cloth) | press and hold Jump in midair; hold Jump inside a geyser to ride it |
| Water walk (Water-Spiders) | just run onto calm water — keep moving or you sink; whitecaps can't be walked on |
| Wall jump (Clinging Claws) | hold toward a wall, then Jump — ice walls are slippery |
| Shift worlds (Otherworld Mirror) | A — blocked (red outline) if something solid is there on the other side |
| Grapple (Grappling Hook) | hold S near a ring; ← → pump the swing, ↑ ↓ reel, Jump to launch off, let go of S to drop |
| Pause · Mute | Esc · M |

## Dev tools

- **`` ` `` (backquote)** opens the tuning panel: every movement, combat and camera
  constant as a live slider (saved to localStorage), ability toggles (float and
  wall jump aren't in Chapter I yet — unlock them here), god mode, hitboxes,
  slow-motion and warp buttons.
- **`/debug/poses.html`** draws every character pose large (`?only=float`, `?style=binoshi`).
- In the console, `H` (from `debug/harness.js`) drives the game deterministically:
  `H.fresh()`, `H.chapter(3)`, `H.warp(x, y)`, `H.hold('right')`, `H.secs(1)`,
  `H.bounceOn(jelly)`, `H.swingTo(...)`, `H.snap('name')` → `.snaps/name.png`.
  Boss pattern bots for balance: `H.xenoFight(); H.fightXeno()`,
  `H.masterFight(); H.fightMaster()`, `H.flayerFight(); H.fightFlayer()`.
- **`/debug/xeno.html`** draws the Xenomorph's poses (`?only=roar&s=3`).

## Layout

```
src/
  config.js            tuning constants (the feel)
  game.js              game loop, modes, combat, triggers, rendering order
  core/                input, camera, synthesized audio, math
  world/               level + collision, themes, stage1–3 layouts
  entities/            player, Binoshi enemies, sea and snow creatures, aliens,
                       the Tethys's machinery, Balrog, Kraken, Xenomorph, props
  render/              ninja rig, skies, terrain, props, water, weather, lighting
  ui/                  HUD, dialogue, menus and cards, tuning panel
  data/story.js        all story text
```

Everything is drawn procedurally on a canvas and every sound is synthesized: no image or audio files.
