// Single source of truth for the visual-effect vocabulary.
//
// Before this module the server's json_schema enum and the client's effect->mode map were two
// independent vocabularies: the server's enum values collided with the client map's *values*,
// not its *keys*, so every lookup missed and fell through to a default. Both sides now import
// from here, so the next enum edit cannot silently re-break the mapping.
//
// "light" was dropped deliberately: it had no renderer mode on either side of the old mismatch.

/** Effect names the model is allowed to emit. Goes verbatim into the server's json_schema enum. */
export const EFFECT_VOCABULARY = ["mist", "fracture", "garden", "network"];

/** Effect name -> renderer mode. The client resolves scene/particle behaviour through this map. */
export const EFFECT_RENDER_MODES = {
  mist: "mist",
  fracture: "fracture",
  garden: "garden",
  network: "network"
};

/** Renderer mode used when no effect was supplied. An *unknown* effect is a bug, not a default. */
export const DEFAULT_RENDER_MODE = "salon";

/** Returns null when the effect is valid, otherwise a human-readable reason. */
export function describeInvalidEffect(effect) {
  if (typeof effect !== "string" || !effect) return "effect was missing";
  if (!EFFECT_VOCABULARY.includes(effect)) return `effect "${effect}" is outside the shared vocabulary`;
  return null;
}
