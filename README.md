# Wheel & Clay · 轮间

A small, bilingual pottery studio in the browser. Public wheel-speed data from Squeektoshi the hamster sets the rhythm; you shape, glaze, and collect the pottery.

**[Play Wheel & Clay](https://wheel-and-clay.blackhaven-phase1-dashboard.workers.dev/)**

Shape a vase, bowl, or cylinder; follow a target in open practice or a twenty-turn challenge; or repair a damaged pot within twelve turns. Choose a glaze and surface finish, save a keepsake locally, and download a PNG or open a sharing prompt. English and Chinese interfaces are available.

## Interaction design

The interface includes a playback-linked record control, a scroll transition into the studio, clear material selection, keyboard shaping and orbit controls, and confirmation before replacing an unfinished pot. Dialogs pause game-time consumption. Capture or local-storage failures leave the current piece available to retry.

See the [69-item interaction review](INTERACTIONS.md) for references, options, implemented changes, browser observations and remaining device-specific checks.

## Run locally

Use Python 3 and a modern browser with WebGL enabled. There are no npm dependencies, package installation steps, or build services required. Three.js is included in `vendor/`.

From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [the local studio](http://127.0.0.1:8000/). To start in English with simulated wheel power, open [English simulation](http://127.0.0.1:8000/?lang=en&mode=sim).

The source uses browser ES modules, so serve the source over HTTP instead of opening `index.html` directly. The generated standalone HTML below can also be used without a development server.

## Build

```sh
python3 build.py
```

The build uses only the Python standard library. It creates:

- `Wheel-and-Clay.html`: a self-contained page with styles, application code, and Three.js embedded.
- `Wheel-and-Clay.zip`: a local package of the project and standalone page.
- `qa/`: clearly labelled fixtures for offline, timeout, missing WebGL, and simulated hardware responses. These fixtures are for local checks and must not be published as live data.

These outputs are ignored by Git. Simulation and the interface do not need a network connection after the page is loaded. Live mode still requires the public API.

## Test

The tests use Node.js built-ins and perform no live API requests. Use Node.js 22.7 or later; this source was checked with Node.js 24.

```sh
node tests/test_engine.cjs
node tests/test_glazes.mjs
node tests/test_audio_activity.mjs
node tests/test_share.mjs
```

Each script prints its passing count and exits with a nonzero status on failure. They cover shaping, wheel inertia, challenge accounting, signal validation, glaze parameters, synthesized audio and audio permissions, activity evidence, and share payloads. WebGL rendering, pointer interaction, and native browser sharing also need browser checks.

## LIVE, SIM, and turn counts

- **LIVE** reads public hardware status from `https://api.squeekchain.com/v1/status` every eight seconds. The interface also reads public activity statistics to show recent evidence of movement. Requests omit credentials.
- **SIM** provides labelled, local steady, sprint, and rest states. A piece that used simulation remains marked as simulated even if the player later switches to LIVE.
- **Unknown is not zero.** Missing, stale, invalid, or non-hardware readings are shown as unknown. An unknown signal pauses shaping and challenge consumption; it is not treated as a resting hamster. A valid hardware zero is a distinct state, and the virtual pottery wheel coasts to rest.
- **Hardware count is separate.** Connection details show the accepted work-event count within the reporting counter epoch and estimated device-day distance (the device day starts at 12:00 UTC). An accepted magnet passage is a work event, not proof of one complete animal-driven revolution.
- **Game turns are virtual pottery-wheel credits.** They are calculated by integrating the smoothed virtual wheel speed over active game time. They are not a hardware revolution counter, a count of raw sensor pulses, or a physical measurement of the hamster's actual wheel. The shaping response and challenge budgets are game rules.

The app is a public-data, read-only experience. It does not connect a wallet, request signatures, submit transactions, or control hardware. It is an interactive pottery studio, not a hamster video stream.

Up to twelve pieces and interface preferences are stored in the current browser's local storage. Clearing that browser's data removes them. Exporting or sharing happens only through the player's controls; the X action opens a compose prompt with the public play URL and a short caption.

## Prepare static hosting

After building, prepare the static hosting directory:

```sh
python3 deploy/prepare.py
```

This checks the bundled page and writes exactly `index.html`, `THREE-LICENSE.txt`, and `_headers` into `deploy/public/`. It does not authenticate or deploy. The included `deploy/wrangler.toml` describes a Cloudflare Workers static-assets deployment; any hosting credentials are supplied outside this repository. The app can also be served by another static host.

## Source map

| Files | Purpose |
| --- | --- |
| `index.html`, `style.css`, `app.js` | Studio markup, styles, and application state |
| `core.js`, `activity.js` | Public signal validation and activity evidence |
| `engine.js`, `scene.js` | Pottery geometry, interaction, wheel dynamics, and WebGL rendering |
| `orders.js`, `glazes.js` | Practice, challenges, repair commissions, and materials |
| `audio.js` | Locally synthesized soundscape and wheel audio |
| `home.js`, `home.css` | Welcome page |
| `share.js`, `share.css` | Keepsake download and share controls |
| `tests/` | Dependency-free Node.js checks |
| `build.py`, `deploy/` | Local packaging and static-host preparation |

## Third-party license

The bundled Three.js distribution is covered by its MIT license in [`vendor/THREE-LICENSE.txt`](vendor/THREE-LICENSE.txt). Preserve that notice when distributing it. No project-wide license has been added for the original Wheel & Clay code; the Three.js license applies to Three.js itself.
