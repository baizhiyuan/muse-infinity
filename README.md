# MUSE∞ — The Impossible Museum

> Enter any museum. Meet any mind. Rewrite art history.

MUSE∞ is a browser-based cultural experience where conversation changes the world. A visitor enters an impossible museum, borrows an artistic perspective, summons a salon across centuries, faces conflicting interpretations, and makes a choice that physically rewrites the surrounding visual system into a personal museum world.

This repository contains the reliable frontend vertical slice plus the Phase 2 point-cloud architecture. It uses a deterministic local particle world and cached dialogue as the lowest fallback, while exposing a typed World Labs embed adapter that can be activated with a public hosted-world URL.

## Run

Requirements: Node.js 20 or newer.

```bash
npm start
```

Open `http://localhost:4173`.

For the 75–100 second judging path, open:

```text
http://localhost:4173/?demo=true
```

No account, API key, private data, database, or installation is required.

## Working vertical slice

1. Threshold
2. Museum Between Worlds
3. Five visible artistic world nodes
4. Fully explorable World of Light
5. Seven abstract participant representations
6. Three deterministic discussion prompts
7. Four contrasting dialogue turns
8. One user choice
9. A visible particle-world transformation
10. A personalized final world and manifesto

The prototype includes a centralized experience state, constrained world-effect vocabulary, cached fallback dialogue, responsive design, reduced-motion support, and a dependency-free particle renderer.

## Demo controls

| Key | Destination |
|---|---|
| `1` | Threshold |
| `2` | Museum Between Worlds |
| `3` | World of Light |
| `4` | Salon |
| `5` | Discussion questions |
| `6` | Transformation |
| `7` | Final world |
| `R` | Reset |
| `M` | Sound on/off |
| `P` | Auto → High → Low performance |
| `D` | Development visual-effect panel; unavailable in Demo Mode |

## Architecture

```text
User interaction
      ↓
Deterministic experience state machine
      ↓
Dialogue/choice data → Philosophy scoring
      ↓                       ↓
Constrained effect name   Final-world resolver
      ↓                       ↓
Canvas effect mapper      Personal manifesto
      ↓
World environment adapter + memory-particle renderer
      ↓
Particles, character formation, architecture and world blend
```

The dialogue layer never manipulates individual scene objects. It returns a constrained effect such as `mist`, `fracture`, `infinity`, `void`, `network`, `garden`, or `turbulence`. The frontend owns the deterministic visual implementation.

Phase 2 separates responsibilities into:

- `config/assets.js` — centralized world and character placeholders.
- `services/worldLabs.js` — supported hosted/embed loading, lifecycle, timeout and local fallback.
- `lib/audioAnalysis.js` — smoothed low/mid/high/amplitude signal with deterministic simulation.
- `lib/performance.js` — Auto/High/Low quality selection, DPR and particle budgets.
- `app.js` — preserved narrative state machine plus the constrained world-effect controller.

## World Labs integration

The project does not invent or depend on an undocumented World Labs SDK. It supports the safest integration currently possible without credentials: an official/public hosted interactive world embedded behind the authored particle and interface layers.

Edit [`worlds.json`](worlds.json):

```json
{
  "monet": {
    "id": "monet",
    "title": "World of Light",
    "sourceType": "embed",
    "worldUrl": "https://YOUR-PUBLIC-HOSTED-WORLD-URL",
    "assetUrl": "",
    "thumbnailUrl": "",
    "fallbackSceneId": "monet-particles"
  }
}
```

Only put a public hosted-world URL in this file. Never put an API key in browser-readable configuration. If the world is missing, unsupported, blocked, or not loaded within eight seconds, the full journey continues with the local authored particle world. The footer truthfully displays `WORLD LABS READY` or `LOCAL FALLBACK`.

## TRIPO Socrates asset

The current Socrates is an original procedural marble particle memory. The final asset replacement point is centralized in `config/assets.js`:

```text
/models/socrates-tripo.glb
```

Before adding it, optimize the GLB for the web, preserve its license/generation record, confirm scale/orientation, and add it to `THIRD_PARTY_NOTICES.md`. The Canvas prototype does not silently claim to render a GLB it cannot load; the path is explicitly documented as a placeholder for the future WebGL renderer.

## Fallback levels

1. Public World Labs hosted world behind the full authored particle layer.
2. Reserved local splat/asset path when a supported WebGL renderer is introduced.
3. Reserved local GLB environment.
4. Current local point-cloud architecture, lighting, character memories and cached dialogue.

The fourth level is complete and always available. World or network failure never blocks questions, choices, scoring, transformation, or the manifesto.

## Performance

- `Auto` samples frame rate over several seconds and changes quality only after a cooldown.
- `High` uses up to 2,200 deterministic Canvas particles and higher DPR.
- `Medium` uses 1,250 particles.
- `Low` uses 620 particles and DPR 1.
- Particle count values are intentionally conservative because this version uses Canvas rather than instanced GPU geometry.
- Inactive hosted worlds are hidden; replaced frames are removed and timers disposed.

## Safety and representation

- Dialogue is labeled as AI interpretation, not authentic quotation.
- The prototype does not clone voices or imply endorsement.
- No copyrighted artwork, music, brand asset, or third-party character model is included.
- Historical and living creators are represented through abstract particles and documented thematic perspectives.
- The current build uses no personal data.

## Codex collaboration

The frontend vertical slice was built with Codex during the hackathon workflow. Codex helped convert the product concept into a deterministic scene architecture; implement the state machine, visual-effect mapper, particle renderer, branching dialogue, philosophy scoring, Demo Mode, responsive interface, and local server; and verify the complete interaction path in a real browser.

Key human product decisions retained in the implementation:

- Conversation must alter the world, not sit in a chat panel.
- Only one world is explorable in the MVP.
- Seven independent autonomous agents are excluded.
- The critical judging path has no live-service dependency.
- Historical dialogue is interpretive and never presented as quotation.

Before submission, add the `/feedback` session ID for the task where the majority of core functionality was built.

## Next phase

1. Replace cached dialogue with a GPT-5.6 structured-output orchestrator while retaining mock fallback.
2. Port the same effect/state contracts to React Three Fiber before adding a single chosen splat renderer.
3. Connect neutral TTS audio to the implemented analyser signal.
4. Add the final licensed/generated Socrates GLB at the documented path.

Do not add five complete worlds, seven autonomous agents, accounts, multiplayer, unrestricted WASD movement, or live APIs on the critical judging path.

## Current limitations

- Visual depth is simulated with layered Canvas particles and incomplete architecture rather than a full WebGL/splat renderer.
- Dialogue is deterministic mock content, not yet GPT-5.6 output.
- Audio-reactive values use a deterministic simulated signal until TTS audio is attached.
- Four artistic worlds are visible previews only.
- The final share card is rendered in-app but not yet exported as an image.
- No actual World Labs hosted URL or TRIPO GLB was present in the project at implementation time; both integrations therefore truthfully run at documented fallback level.

## License and attribution

The current prototype contains original source code and no copied third-party assets. Google Fonts are loaded from their public stylesheet and gracefully fall back to local serif/sans-serif fonts. Add every future model, texture, audio file, open-source package, museum record, and generated asset to `THIRD_PARTY_NOTICES.md` before submission.
