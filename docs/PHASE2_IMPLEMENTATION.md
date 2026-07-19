# Phase 2 implementation report

## Preservation audit

The existing state machine, narrative stages, cached dialogue, branching choice, philosophy scoring, manifesto resolver, Demo Mode, keyboard controls, and local server were retained. Phase 2 changes are additive and isolated from the dialogue UI.

## Rendering architecture used

The current project was a dependency-free Canvas application, not an existing React Three Fiber application. Rebuilding it during Phase 2 would have violated the document’s critical preservation rule. The upgrade therefore implements the requested separation in browser-native modules:

```text
WorldLabsAdapter ───────┐
                       ├─ World environment layer
Local particle world ──┘

PerformanceController ─┐
AudioReactiveSignal ───┼─ Memory particle/effect layer
Narrative state ───────┘

Constrained effect vocabulary
  → speaker materialization
  → artist spatial preset
  → architecture dissolve
  → philosophy-driven final formation
```

## Implemented upgrades

- Hosted World Labs embed adapter with safe URL validation, async state, fade, timeout, error fallback and disposal.
- Centralized world and character asset configuration.
- Deterministic 620/1,250/2,200-particle quality pools.
- Frame-rate sampling with delayed Auto quality changes.
- Smoothed low/mid/high/amplitude interface with simulated fallback.
- Active speakers gather particles into procedural cultural-memory busts.
- Socrates uses a marble-colored particle silhouette and philosophical void.
- Monet, Picasso, Kusama, Van Gogh, Frida and the modern thinker retain distinct effect presets.
- The user choice now triggers a 7.6-second Demo Mode or 12-second standard transformation with four visible phases.
- Final particle formation differs for perception, emotion and invention choices.
- Development-only visual-effect panel toggled by `D`; disabled in Demo Mode.
- World status is honest and visible: loading, ready or local fallback.

## World Labs method

No credentials, exported splat, or public hosted World Labs URL existed in the project. The implementation therefore supports the documented public hosted/embed route without fabricating an SDK. Add the URL to `worlds.json` and set `sourceType` to `embed`. If it cannot load, the existing point-cloud world remains fully functional.

## TRIPO replacement

Add the final asset at `models/socrates-tripo.glb` and update `config/assets.js` only if its name or scale changes. The current Canvas renderer intentionally does not pretend to load GLB files. A future WebGL layer should sample the model surface or combine a translucent bust with the existing particle halo.

## Known limitations

- This is not yet a Gaussian-Splat renderer.
- No actual World Labs or TRIPO asset could be visually verified because none was supplied.
- Canvas particles are CPU-rendered, so counts are lower than shader/GPU targets.
- The current audio source is simulated until neutral TTS is connected.
- Camera depth is authored through spatial composition rather than a 3D Catmull–Rom camera.

These limits are exposed in documentation and never hidden behind mock claims.
