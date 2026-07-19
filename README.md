# MUSE∞ — The Impossible Museum

> Ask one question. Walk through the dream gallery it becomes.

MUSE∞ is an AI-native dream museum where one personal question becomes a walkable 3D gallery. A visitor asks an existential theme, chooses artist and thinker companions, explores open-access artworks across connected world-regions, and watches each grounded conversation reshape the surrounding environment.

This repository contains the Build Week engineering baseline for that product: a local Three.js walkable gallery, open-access artwork loading, GPT-5.6 dialogue with honest fallback, deterministic world transformations, and server-only World Labs Marble and Tripo integration points.

For the latest product direction and engineer-facing build spec, read [LATEST_PRODUCT_SPEC.md](LATEST_PRODUCT_SPEC.md).

## Current build result

The current build proves one production-shaped path through the concept without making the judging journey depend on paid services: the browser enters a real Three.js gallery, loads open-access museum records through a server proxy, asks an artwork-aware GPT-5.6 dialogue route when configured, and falls back honestly when it is not. Separate server-only adapters cover OpenAI Realtime, World Labs Marble generation, and Tripo multiview/rigging tasks. Paid generation routes require `INTEGRATION_ADMIN_TOKEN`; the static server exposes only the runtime files needed by the browser and blocks `.env`, repository metadata, server code, tests, and project documents.

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

No account, API key, private data, or database is required for the fallback path. Set `OPENAI_API_KEY` on the server to enable live GPT-5.6 dialogue.

## Validate

```bash
npm run check
npm test
```

The contract suite validates the World Labs and Tripo request shapes without spending credits, then starts the local HTTP server to verify the public runtime surface, deterministic dialogue fallback, and secret-file boundaries.

## Working vertical slice

1. Question gate
2. Museum Between Worlds
3. Continuous dream-gallery route
4. Selection of up to three historical companion perspectives
5. A real WebGL gallery with drag/WASD navigation and clickable artworks
6. Live Art Institute of Chicago Open Access/IIIF loading with local fallback
7. Voice/text questions routed to GPT-5.6 when configured, with honest local fallback
8. Artwork-grounded companion responses and discussion prompts
9. One user choice and a visible particle-world transformation
10. A personalized final dream world and manifesto

The prototype includes a centralized experience state, constrained world-effect vocabulary, cached fallback dialogue, responsive design, reduced-motion support, a deterministic particle renderer, and a Three.js gallery renderer.

## Demo controls

| Key | Destination |
|---|---|
| `1` | Threshold |
| `2` | Museum Between Worlds |
| `3` | World of Light |
| `4` | Companion conversation |
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

The implementation separates responsibilities into:

- `config/assets.js` — centralized world and character placeholders.
- `services/worldLabs.js` — supported hosted/embed loading, lifecycle, timeout and local fallback.
- `lib/audioAnalysis.js` — smoothed low/mid/high/amplitude signal with deterministic simulation.
- `lib/performance.js` — Auto/High/Low quality selection, DPR and particle budgets.
- `lib/museum3d.js` — local WebGL architecture, camera movement, artwork frames, raycasting and companion markers.
- `services/museumCollections.js` — open-access collection loading.
- `services/voiceConversation.js` — speech recognition, GPT-5.6 dialogue request and spoken reply.
- `app.js` — preserved narrative state machine plus the constrained world-effect controller.
- `tests/integration-contracts.mjs` — mocked external API request-contract coverage.
- `tests/server-contracts.mjs` — local HTTP, fallback and private-file boundary coverage.

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

World Labs and Tripo generation/task endpoints are intentionally separate from the public judging path. Configure a long random `INTEGRATION_ADMIN_TOKEN` and send it as `Authorization: Bearer <token>` when invoking those routes; without it, the server returns `503` before any paid provider request is attempted.

## Tripo character assets

Labeled multi-view inputs are stored under:

```text
/assets/generated/turnarounds/
```

Each sheet is also split into the exact Tripo order `[front, left, back, right]` under `assets/generated/turnarounds/views/<character>/`. The server exposes explicit Tripo OpenAPI v2 single-view, multiview, polling, rigging and animation routes. Set `PUBLIC_APP_URL` only after these files are available on the deployed public HTTPS site, then submit one reviewed character at a time through `POST /api/tripo/characters/:id`. Submission is never automatic because it consumes credits.

After a model succeeds, download the temporary output immediately, optimize it for the web, preserve its generation/source record, and set the reviewed path on that participant in `config/museumAssets.js`. The Three.js gallery loads non-null GLB paths with `GLTFLoader`; it never invents a placeholder person when a file is absent.

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
- Bundled collection images and historical portraits are limited to documented public-domain/open-access sources; no third-party character model is included.
- Historical and living creators are represented through abstract particles and documented thematic perspectives.
- The current build uses no personal data.

## Codex collaboration

The frontend vertical slice was built with Codex during the hackathon workflow. Codex helped convert the product concept into a deterministic scene architecture; implement the state machine, visual-effect mapper, particle renderer, branching dialogue, philosophy scoring, Demo Mode, responsive interface, and local server; and verify the complete interaction path in a real browser.

Key human product decisions retained in the implementation:

- Conversation must alter the world, not sit in a chat panel.
- The MVP should feel like one continuous dream gallery, not disconnected random rooms.
- Up to three active companions are stronger than a crowded cast.
- Independent autonomous agents are excluded.
- The critical judging path has no live-service dependency.
- Historical dialogue is interpretive and never presented as quotation.

Before submission, add the `/feedback` session ID for the task where the majority of core functionality was built.

## OpenAI Build Week judging access

- **Track:** Apps for Your Life
- **Repository access:** Public under the MIT License so judges can inspect and run the source without an invitation.
- **Testing path:** Run `npm start`, then open `http://localhost:4173/?demo=true` for the shortest complete path.
- **Credentials:** None required. The local fallback does not require an API key or private account.
- **Core Codex Session ID:** `PENDING - replace with the /feedback Session ID before the Devpost submission is finalized.`

### Submission-readiness disclosure

This repository is being published during the submission period as a work in progress. The current visual journey, 3D gallery, collection API route, GPT-5.6 dialogue endpoint and deterministic fallback are implemented. Live GPT-5.6 still requires a server-side `OPENAI_API_KEY`; when it is absent, the UI reports `LOCAL FALLBACK`. Do not describe fallback text as a live model response. Before final submission, deploy with the key configured, verify one live response, record the core `/feedback` Session ID above, and update this disclosure with the hosted test URL.

## Next phase

1. Connect the implemented WebRTC session bridge to the gallery microphone for interruptible speech-to-speech.
2. Route the returned dialogue effect into the Three.js lights, materials and architecture.
3. Add one licensed/generated historical bust GLB at the documented path.
4. Optionally replace the authored conservatory with one public World Labs Marble world while preserving the local fallback.

Do not add five complete worlds, seven autonomous agents, accounts, multiplayer, unrestricted WASD movement, or live APIs on the critical judging path.

## Current limitations

- The gallery is real WebGL geometry, but it is an authored local conservatory rather than a Gaussian-splat or generated World Labs environment.
- GPT-5.6 dialogue only becomes live when `OPENAI_API_KEY` is configured; otherwise the interface clearly reports its local fallback.
- Audio-reactive values use a deterministic simulated signal until TTS audio is attached.
- Four artistic worlds are visible previews only.
- The final share card is rendered in-app but not yet exported as an image.
- No actual World Labs hosted URL or Tripo GLB is present; both integrations therefore truthfully remain documented Phase 3 asset paths.

## License and attribution

The current prototype is released under the [MIT License](LICENSE) and contains original application source code. Three.js, Google Fonts, generated scene assets, and every bundled public-domain museum/portrait image are recorded in `THIRD_PARTY_NOTICES.md`. Add every future model, texture, audio file, open-source package, museum record, and generated asset there before submission.
