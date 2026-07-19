# MUSE∞ integration map

The runtime does not require an MCP server. MCP is useful for development-time documentation or private app access; the public product itself should use server-side APIs.

## Required for the competition build

### OpenAI Responses API

- Purpose: GPT-5.6 interprets the visitor's spoken/text question in the context of the selected companions and the artwork currently in focus.
- Current endpoint: `POST /api/dialogue` proxies to `POST https://api.openai.com/v1/responses`.
- Secret: `OPENAI_API_KEY`, server-side only.
- Model default: `gpt-5.6`.
- Fallback: clearly labeled local curated response. Never describe fallback text as live GPT-5.6.

### OpenAI Realtime API

- Purpose: the final natural, interruptible speech-to-speech experience.
- Current server bridge: `POST /api/realtime/session` proxies browser SDP to `POST https://api.openai.com/v1/realtime/calls`.
- Secret: the same server-side `OPENAI_API_KEY`.
- Model default: `gpt-realtime-2.1`.
- Current UI path: browser speech recognition → GPT-5.6 Responses → browser speech synthesis. This keeps GPT-5.6 in the core loop while the Realtime client UI is completed.

## Museum collection APIs

### Art Institute of Chicago Open Access API + IIIF

- Purpose: live public-domain artwork metadata and CORS-enabled images.
- Key: none.
- Current route: `GET /api/artworks?q=Claude%20Monet`.
- Runtime fallback: three locally cached, attributed public-domain works.

### Metropolitan Museum of Art Collection API (optional expansion)

- Purpose: add more public-domain works and departments.
- Key: none.
- Use only records where the object is explicitly marked public domain and retain source links.

## 3D generation APIs for the next asset pass

### World Labs Marble API

- Best for: generating or reconstructing an entire persistent museum/garden world from text, images, video, or rough 3D structure.
- Secret: `WORLDLABS_API_KEY`, server-side only.
- Integration point: replace the `mock` source in `worlds.json` with a published world, or download an allowed export and render it locally.
- Server routes now available:
  - `POST /api/worlds/generate` with `{ prompt, displayName, imageUrl?, publicWorld? }`.
  - `GET /api/worlds/operations/:operationId` for completion polling.
- The browser never receives `WORLDLABS_API_KEY`, and generation never starts automatically on page load.
- Both routes require `Authorization: Bearer <INTEGRATION_ADMIN_TOKEN>` before the provider is contacted.

### Tripo API

- Best for: converting one or multiple reference views into a web-ready object/character bust and exporting GLB.
- Secret: `TRIPO_API_KEY`, server-side only.
- Integration point: place optimized output under `models/` and load it with Three.js `GLTFLoader`.
- Required cleanup: retopology, texture-size reduction, Draco/Meshopt compression, scale/orientation check, and license record.
- Current status: labeled multi-view input sheets and ordered front/left/back/right files are ready under `assets/generated/turnarounds/`; no GLB is claimed or bundled until an authenticated generation task completes and the output is reviewed.
- Renderer status: `lib/museum3d.js` already includes an optional `GLTFLoader` path. After review, set a participant's `model` field in `config/museumAssets.js`; null model fields intentionally render no fake stand-in.
- Server routes now available:
  - `POST /api/tripo/models` with a text prompt, public HTTPS `imageUrl`, or previously uploaded `fileToken`.
  - `POST /api/tripo/multiview` with exactly four HTTPS URLs, file tokens, or upload objects in `[front, left, back, right]` order.
  - `GET /api/tripo/characters` returns the reviewed asset manifests; `POST /api/tripo/characters/:id` submits one character using `PUBLIC_APP_URL`.
  - `GET /api/tripo/tasks/:taskId` for progress and output polling.
  - `POST /api/tripo/rig-check`, `/api/tripo/rig`, and `/api/tripo/retarget` for optional character animation.
- Model generation and rigging are explicit actions because they consume credits. Completed GLB URLs are temporary and must be downloaded to durable storage before they expire.
- Every Tripo generation, task, rigging and retargeting route requires `Authorization: Bearer <INTEGRATION_ADMIN_TOKEN>`. The read-only character manifest remains public.
- The task client follows Tripo OpenAPI v2, uses `P1-20260311` for new multiview jobs, and defaults rig checks/rigging to `v2.5-20250123`. Both values can be overridden server-side. The bundled split images are never submitted automatically.

## Connection status

`GET /api/integrations/status` returns booleans for OpenAI, World Labs and Tripo configuration. It never returns a key or key fragment.

Local development loads `.env` through `node --env-file-if-exists=.env server.mjs`. The `.env` file is ignored by Git.

The local static server uses an explicit public-file allowlist. Runtime HTML, CSS, browser modules, Three.js, world configuration and visual assets are served; `.env`, `.git`, server implementation, tests, package metadata and project documents are not web-readable.

## Portrait-to-3D policy

Historical portraits are evidence for identity, but generated unseen angles are inventions. For the competition build:

1. Use real public-domain portraits in the interface.
2. Use 3D busts only for deceased historical figures with a clear source record.
3. Label every 3D result as an AI interpretation, not a reconstruction or authentic likeness.
4. Do not create photorealistic living-artist avatars or cloned voices.
5. Prefer three strong active companions over a crowded or legally ambiguous cast.

## MCPs that help during development

- OpenAI Developer Docs MCP: current API schemas and model guidance.
- Browser control: local interaction testing and screenshots.
- GitHub connector/plugin: optional repository and issue workflow; not required by the app.

No museum MCP is required. The museum services expose standard REST/IIIF APIs, which are simpler and more reliable for the public demo.
