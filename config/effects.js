// Single source of truth for the visual-effect vocabulary AND for what each effect does to the
// rendered scene.
//
// Before this module the server's json_schema enum and the client's effect->mode map were two
// independent vocabularies: the server's enum values collided with the client map's *values*,
// not its *keys*, so every lookup missed and fell through to a default. Both sides now import
// from here, so the next enum edit cannot silently re-break the mapping.
//
// "light" was dropped deliberately: it had no renderer mode on either side of the old mismatch.
//
// WHY LIGHTING AND NOT PARTICLES: the 2D particle canvas (#world) is `opacity:0` during
// world_exploration and is occluded by #experience regardless, so an effect written into
// `particleMode` moves a debug readout and nothing else. In world mode `applyWorldFraming` also
// nulls `scene.fog`. Scene lighting is therefore the only lever an effect has on actual pixels.

/**
 * The one table. Every other export below is *derived* from it, so an effect that exists in the
 * vocabulary cannot be missing a render mode or a lighting target — totality by construction
 * rather than by a default branch that hides the omission.
 *
 * Colors are hex ints (three.js `Color` accepts them directly); intensities are three.js units
 * relative to the scene's static values (hemi 2.25 / sun 3.1 / point 18). The spreads are wide on
 * purpose: an effect that only nudges intensity is indistinguishable from no effect at all.
 *
 * Order is load-bearing: `server.mjs` indexes `EFFECT_VOCABULARY` positionally in its fallback.
 */
const EFFECT_TABLE = {
  mist: {
    mode: "mist",
    // Boundaries soften: cool, lifted, nearly shadowless — everything drifts toward diffuse blue-grey.
    lighting: {
      hemisphere: { sky: 0xdfe9f5, ground: 0x9aa7b4, intensity: 3.7 },
      directional: { color: 0xc7dbee, intensity: 1.4 },
      point: { color: 0xccd8e8, intensity: 10 }
    }
  },
  fracture: {
    mode: "fracture",
    // Geometry breaks: ambient collapses, one hard white key throws sharp high-contrast edges.
    lighting: {
      hemisphere: { sky: 0x8c9db2, ground: 0x241f1a, intensity: 0.9 },
      directional: { color: 0xffffff, intensity: 5.4 },
      point: { color: 0x9db2d2, intensity: 9 }
    }
  },
  garden: {
    mode: "garden",
    // Memory grows: warm gold key over green bounce, the light of an overgrown afternoon.
    lighting: {
      hemisphere: { sky: 0xdcf3c2, ground: 0x3d5a27, intensity: 3.1 },
      directional: { color: 0xffe3a0, intensity: 3.8 },
      point: { color: 0xffc78a, intensity: 24 }
    }
  },
  network: {
    mode: "network",
    // Ideas connect: night-dark ambient cut by electric violet and cyan — a lit circuit, not a room.
    lighting: {
      hemisphere: { sky: 0x7a63ff, ground: 0x0b1226, intensity: 1.5 },
      directional: { color: 0x8fe6ff, intensity: 2.3 },
      point: { color: 0xb083ff, intensity: 28 }
    }
  }
};

/** Effect names the model is allowed to emit. Goes verbatim into the server's json_schema enum. */
export const EFFECT_VOCABULARY = Object.keys(EFFECT_TABLE);

/** Effect name -> renderer mode. The client resolves scene/particle behaviour through this map. */
export const EFFECT_RENDER_MODES = Object.fromEntries(
  Object.entries(EFFECT_TABLE).map(([name, entry]) => [name, entry.mode])
);

/**
 * Effect name -> concrete three.js light targets. `lib/museum3d.js` reads this and nothing else;
 * there is no second literal on the client, which is what produced the original mismatch.
 */
export const EFFECT_SCENE_LIGHTING = Object.fromEntries(
  Object.entries(EFFECT_TABLE).map(([name, entry]) => [name, entry.lighting])
);

/** Renderer mode used when no effect was supplied. An *unknown* effect is a bug, not a default. */
export const DEFAULT_RENDER_MODE = "salon";

/** Returns null when the effect is valid, otherwise a human-readable reason. */
export function describeInvalidEffect(effect) {
  if (typeof effect !== "string" || !effect) return "effect was missing";
  if (!EFFECT_VOCABULARY.includes(effect)) return `effect "${effect}" is outside the shared vocabulary`;
  return null;
}
