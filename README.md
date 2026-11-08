# Wheel & Clay

**His wheel. Your hands.**

A browser-based 3D pottery playground powered by Squeekchain. A real hamster sets the rhythm; you give the clay its shape.

**English** · [简体中文](README.zh-CN.md)

[Play in your browser](https://wheel-and-clay.blackhaven-phase1-dashboard.workers.dev/) · [Download the demo · 41s MP4](https://github.com/ananaer/wheel-and-clay/raw/refs/heads/main/media/wheel-and-clay-intro.mp4) · [Changelog](CHANGELOG.md)

[![A hand-shaped double gourd with turquoise flowing glaze in the Wheel & Clay studio, shown in Simulation mode.](media/studio.jpg)](https://wheel-and-clay.blackhaven-phase1-dashboard.workers.dev/)

*The actual studio in Simulation mode. Desktop browser with WebGL required. No wallet or account.*

## Make something only you could make

- **Shape it by hand.** Hold the clay and gently push or pull. Choose a starting form, adjust your touch, and undo or redo. Keyboard and precision tools are available too.
- **Find a challenge.** Nine target forms, three challenge modes, and a golden silhouette to work toward.
- **Give it a finish.** Combine 16 glaze colours with gloss, matte, speckled or two-tone flow. Turn the piece to inspect its surface.
- **Pass it around.** Keep a piece, download its card, or copy a link that opens the same shape and glaze in an interactive 3D view.

Four original soundscapes accompany the studio. The interface defaults to English and can switch to Chinese.

## Choose your pace

| Mode | What you do | When it ends |
| --- | --- | --- |
| Freeform studio | Start with a vase, column or bowl and make your own shape. | Whenever you are ready to glaze. |
| Open practice | Follow any of the nine target silhouettes. | No turn limit. |
| Twenty turns | Shape toward a target with a limited wheel budget. | Set the shape early, or use all 20 pottery-wheel turns. |
| Rescue a pot | Repair a local flaw while protecting the rest of the piece. | Set it early, or use all 12 turns; both repair and preservation matter. |

The turn budget belongs to the **virtual pottery wheel**. It is not a raw sensor count or an on-chain settlement. Scores are local; there is no online leaderboard.

## What the hamster actually changes

Squeektoshi's public wheel-speed data drives a reduced, smoothed pottery-wheel speed. That speed changes how quickly the clay responds and how quickly a challenge uses its turns. When available game power stops, the wheel coasts down and shaping pauses.

- **Live:** reads the public `GET https://api.squeekchain.com/v1/status` endpoint every eight seconds. After a valid running sample, a 90-second buffer prevents a brief zero reading or connection gap from abruptly interrupting a piece. Raw readings remain separate from buffered game power; missing data is never reported as a confirmed stop.
- **Simulation:** offers Steady, Sprint and Rest through the same game mechanics, with a visible simulation label. Rest takes effect without the Live buffer. A piece that used simulated power keeps that label.
- **First visit:** the landing demonstration starts with clearly labelled simulated power. While you are on the homepage, it may switch to fresh running hardware data. Entering the studio or choosing a source locks that choice for your session.

The homepage's shaping, glazing and laser-engraving sequence is a separate introduction. Laser engraving is not a player-operated studio tool.

## Keep and share

Finish and collect your piece, then choose **Copy piece link**. The receiver can rotate the same 3D piece without replacing their current work.

- Up to 12 pieces are stored in the current browser. Clearing browser storage removes that local collection.
- A piece link carries its compact design in the URL fragment. It does not upload an image or include a score, account or local identifier. Anyone with the link can view the design.
- Shared Live/Simulation labels describe the maker's session; they are not hardware attestations or ownership proofs.
- Image sharing depends on browser support. The X entry prepares text and a link; you attach the image and confirm posting yourself.

## Run locally

Use Python 3 and a desktop browser with WebGL. No package installation is required.

```sh
git clone https://github.com/ananaer/wheel-and-clay.git
cd wheel-and-clay
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). Live mode needs access to the Squeekchain API; Simulation can be played without API data. Locally created share links open the public site.

To create a self-contained HTML file and a source archive:

```sh
python3 build.py
```

This produces `Wheel-and-Clay.html` and `Wheel-and-Clay.zip`. These are generated outputs, not files supplied by a fresh clone.

### Development checks

The test suite is run with Node.js 24. It uses local fixtures and does not need a wallet or a live API.

```sh
for test in tests/test_*.cjs tests/test_*.mjs; do
  node "$test" || exit 1
done
```

Logic tests cover shaping, wheel power, the Live buffer, challenge scoring, materials, audio state and share-link validation. Browser interaction and motion review are separate checks; see [QUALITY.md](QUALITY.md).

### Project map

| File | Responsibility |
| --- | --- |
| `core.js` / `engine.js` | API normalization, shaping, transmission, power buffering and scoring |
| `scene.js` / `glazes.js` | Three.js geometry, materials and interaction |
| `app.js` / `orders.js` | Studio state and challenge flows |
| `home.js` / `craft-demo.js` / `engraving.js` | Homepage introduction |
| `share.js` / `piece-link.js` | Cards and portable 3D piece links |
| `audio.js` / `activity.js` | Original procedural sound and page activity |
| `build.py` / `deploy/` | Standalone build and static-hosting preparation |

## Credits and project status

An independent Squeekchain community project. Pottery, scores and cards are created in the browser; the app does not mint NFTs, sign transactions or register work on-chain.

- Official Squeekchain marks and three Sepolia Squeek samples are documented in [BRAND-ASSETS.md](BRAND-ASSETS.md). Palette inspiration does not imply NFT ownership or official endorsement.
- Three.js is bundled locally with its [MIT license](vendor/THREE-LICENSE.txt).
- This repository does not currently specify a project-wide license.

Found a bug or have a game idea? [Open an issue](https://github.com/ananaer/wheel-and-clay/issues).
