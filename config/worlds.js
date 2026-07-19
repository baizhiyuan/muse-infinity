// MUSE∞ — World Labs (Marble) world registry.
//
// Each Marble world GLB was re-exported by THREE.GLTFExporter, so its root node matrix
// already bakes: metric_scale_factor · Rx(π) + ground_plane_offset. We therefore render
// every world at its NATIVE scale — no bounding-box renormalisation (that was the old bug
// that squashed a 196 m garden into 40 units and wrecked the proportions).
//
//   • mesh  path  — GLTFLoader auto-applies the baked root matrix. Zero manual transform.
//   • splat path  — the .spz is raw marble_opencv; we reproduce the same root matrix by hand:
//                   scale = metric.scale, quaternion = Rx(π), position = (0, metric.ty, 0).
//                   (Algebraically identical to the mesh's baked matrix.)
//   • collider    — loaded hidden for both paths; drives ground-snapping + walk bounds.
//
// `profile` (spawn / groundY / bounds) is VERIFIED offline by decoding the collider vertex
// cloud (scratchpad/glb_dissect + batch_profiles): p50 centroid = spawn, p5/p95 inset 0.3 m
// = walk bounds, densest low-Y bin = ground. Never guessed at runtime.

const A = "/assets/worlds";
// Scene thumbnails for the world-selection cards live OUTSIDE the gitignored /assets/worlds
// dir. Every filename equals the world's `key` exactly, so `${T}/${key}.jpg` always resolves.
const T = "/assets/thumbs";

export const WORLDS = {
  // Generated via the Marble API (world_id 705b7748…) — a bright, enclosed, photorealistic
  // museum gallery hall with FLAT walls. Output is a raw .spz + trimesh collider (no baked
  // matrix), so we apply the semantics_metadata transform by hand: scale·Rx(π)+ty on BOTH
  // the splat and the collider (rawMarble). profile decoded post-transform.
  "bright-gallery-hall": {
    key: "bright-gallery-hall",
    thumb: `${T}/bright-gallery-hall.jpg`,
    name: "Bright Gallery Hall",
    displayName: "Bright Gallery Hall",
    blurb: "A sunlit white-walled museum hall — marble floors, statues and skylights: a true gallery interior.",
    meshUrl: null,
    splatUrl: `${A}/bright-gallery.spz`,
    colliderUrl: `${A}/bright-gallery-collider.glb`,
    render: "splat",
    rawMarble: true,
    metric: { scale: 0.80177665, ty: 0.5 },
    profile: { spawn: { x: 0, z: -1.14 }, groundY: 0, bounds: { minX: -2.42, maxX: 2.36, minZ: -26.84, maxZ: 24.55 }, yaw: 0, cameraFar: 300 },
    enclosed: true,
    // Retired from the lineup (user verdict: too plain next to the lush prompt-image worlds).
    // Kept only for ?world= debugging.
    recommended: false,
  },
  "yellow-polka-dot-infinity-room": {
    key: "yellow-polka-dot-infinity-room",
    thumb: `${T}/yellow-polka-dot-infinity-room.jpg`,
    name: "Yellow Polka Dot Infinity Room",
    displayName: "Infinity Dot Room",
    blurb: "A Kusama-style infinity mirror room — dots and reflections without end, a question of self and infinity.",
    meshUrl: `${A}/yellow-polka-dot-infinity-room-mesh.glb`,
    splatUrl: `${A}/yellow-polka-dot-infinity-room.spz`,
    colliderUrl: `${A}/yellow-polka-dot-infinity-room-collider.glb`,
    render: "mesh",
    worldScale: 2, // feedback #11: 3 overshot - figures receded into gold blobs; 2 keeps the room grand while companions stay recognisable
    companionBoost: true, // feedback #12 defect A: room's emissive gold texture overwhelms PBR companions; self-light them so identity survives
    metric: { scale: 0.969, ty: 0.5906 },
    profile: { spawn: { x: 0.04, z: 0.25 }, groundY: 0.0, bounds: { minX: -4.43, maxX: 8.48, minZ: -2.68, maxZ: 5.45 }, yaw: -Math.PI / 2, cameraFar: 200 },
    enclosed: true,
    recommended: true,
    // Hidden from the chooser; reserved as the exclusive philosophy-ending world.
    finaleOnly: true,
  },
  "van-gogh-inspired-gallery-interior": {
    key: "van-gogh-inspired-gallery-interior",
    thumb: `${T}/van-gogh-inspired-gallery-interior.jpg`,
    name: "Van Gogh Inspired Gallery Interior",
    displayName: "Van Gogh Gallery",
    blurb: "A corridor of swirling brushwork and starry-night tones — a studio built for passion and solitude.",
    meshUrl: null,
    splatUrl: `${A}/van-gogh-inspired-gallery-interior.spz`,
    colliderUrl: `${A}/van-gogh-inspired-gallery-interior-collider.glb`,
    render: "splat",
    worldScale: 1.7, // feedback #11: at worldScale 1 companions towered over the frame; bright-gallery-hall is the proportion benchmark, this tunes toward it
    metric: { scale: 1.4984, ty: 1.366 },
    profile: { spawn: { x: 1.79, z: 0.3 }, groundY: 0.0, bounds: { minX: -2.47, maxX: 10.0, minZ: -14.62, maxZ: 13.73 }, yaw: 0, cameraFar: 200 },
    enclosed: true,
    recommended: true,
    // Hidden from the chooser; reserved as the exclusive philosophy-ending world.
    finaleOnly: true,
  },
  "elegant-floral-palace-interior": {
    key: "elegant-floral-palace-interior",
    thumb: `${T}/elegant-floral-palace-interior.jpg`,
    name: "Elegant Floral Palace Interior",
    displayName: "Floral Palace",
    blurb: "A blossom-filled palace hall — fleeting beauty turned into a walkable eternity.",
    meshUrl: null,
    splatUrl: `${A}/elegant-floral-palace-interior.spz`,
    colliderUrl: `${A}/elegant-floral-palace-interior-collider.glb`,
    render: "splat",
    worldScale: 1.7, // feedback #11: at worldScale 1 companions towered over the frame; bright-gallery-hall is the proportion benchmark, this tunes toward it
    metric: { scale: 1.0516, ty: 0.6954 },
    profile: { spawn: { x: 1.16, z: 0.78 }, groundY: 0.2, bounds: { minX: -8.12, maxX: 12.73, minZ: -10.4, maxZ: 11.44 }, yaw: 0, cameraFar: 200 },
    enclosed: true,
    recommended: true,
    // Shelved from the finale after #13: black-void interior — an asset-quality defect, not a
    // transform one (collider floor plateau matches this config exactly). Still finaleOnly so
    // it never appears anywhere.
    finaleOnly: true,
  },
  "fantasy-realm-of-shimmering-spheres": {
    key: "fantasy-realm-of-shimmering-spheres",
    thumb: `${T}/fantasy-realm-of-shimmering-spheres.jpg`,
    name: "Fantasy Realm of Shimmering Spheres",
    displayName: "Shimmering Spheres",
    blurb: "A narrow dream-path of floating luminous spheres — a walk into the starfield of the subconscious.",
    meshUrl: `${A}/fantasy-realm-of-shimmering-spheres-mesh.glb`,
    splatUrl: null,
    colliderUrl: `${A}/fantasy-realm-of-shimmering-spheres-collider.glb`,
    render: "mesh",
    worldScale: 1.8, // feedback #11: at worldScale 1 companions towered over the frame; bright-gallery-hall is the proportion benchmark, this tunes toward it
    metric: { scale: 1.5061, ty: 1.1685 },
    profile: { spawn: { x: 0.12, z: 0.83 }, groundY: 0.5, bounds: { minX: -2.08, maxX: 2.08, minZ: -6.83, maxZ: 9.99 }, yaw: 0, cameraFar: 200 },
    enclosed: true,
    recommended: true,
  },

  // ---- larger / outdoor worlds (splat-only, spawn less reliable — offered but not default) ----
  "grand-conservatory-with-lush-gardens": {
    key: "grand-conservatory-with-lush-gardens",
    thumb: `${T}/grand-conservatory-with-lush-gardens.jpg`,
    name: "Grand Conservatory with Lush Gardens",
    displayName: "Glass Conservatory",
    blurb: "A vast glass-domed conservatory garden — a hall where light and vines interweave.",
    meshUrl: null,
    splatUrl: `${A}/grand-conservatory-with-lush-gardens.spz`,
    colliderUrl: `${A}/grand-conservatory-with-lush-gardens-collider.glb`,
    render: "splat",
    worldScale: 1.7, // open worlds tuned like the finale ones (feedback #11): world grand, people human-scale
    metric: { scale: 2.4943, ty: 1.4334 },
    profile: { spawn: { x: -1.6, z: -4.8 }, groundY: 0.9, bounds: { minX: -47.15, maxX: 41.28, minZ: -56.41, maxZ: 39.15 }, yaw: 0, cameraFar: 400 },
    enclosed: false,
    recommended: false,
  },
  "mexican-courtyard-bedroom-fantasy": {
    key: "mexican-courtyard-bedroom-fantasy",
    thumb: `${T}/mexican-courtyard-bedroom-fantasy.jpg`,
    name: "Mexican Courtyard Bedroom Fantasy",
    displayName: "Mexican Courtyard",
    blurb: "A Frida-esque courtyard and bedroom — pain and vitality in blazing color.",
    meshUrl: null,
    splatUrl: `${A}/mexican-courtyard-bedroom-fantasy.spz`,
    colliderUrl: `${A}/mexican-courtyard-bedroom-fantasy-collider.glb`,
    render: "splat",
    worldScale: 1.7, // open worlds tuned like the finale ones (feedback #11): world grand, people human-scale
    metric: { scale: 2.9798, ty: 1.5802 },
    profile: { spawn: { x: 2.21, z: -1.23 }, groundY: 0.1, bounds: { minX: -21.02, maxX: 23.04, minZ: -22.3, maxZ: 17.39 }, yaw: 0, cameraFar: 400 },
    enclosed: false,
    recommended: false,
  },
  "enchanted-water-garden-sanctuary": {
    key: "enchanted-water-garden-sanctuary",
    thumb: `${T}/enchanted-water-garden-sanctuary.jpg`,
    name: "Enchanted Water Garden Sanctuary",
    displayName: "Water Garden",
    blurb: "A water sanctuary of lilies and reflections — Monet's stillness and flow.",
    meshUrl: null,
    splatUrl: `${A}/enchanted-water-garden-sanctuary.spz`,
    colliderUrl: `${A}/enchanted-water-garden-sanctuary-collider.glb`,
    render: "splat",
    worldScale: 1.7, // open worlds tuned like the finale ones (feedback #11): world grand, people human-scale
    metric: { scale: 1.7552, ty: 1.1188 },
    profile: { spawn: { x: 3.2, z: -17.58 }, groundY: 1.1, bounds: { minX: -6.36, maxX: 23.3, minZ: -41.25, maxZ: 16.21 }, yaw: 0, cameraFar: 400 },
    enclosed: false,
    recommended: false,
  },
  "dreamlike-coastal-villa-gardens": {
    key: "dreamlike-coastal-villa-gardens",
    thumb: `${T}/dreamlike-coastal-villa-gardens.jpg`,
    name: "Dreamlike Coastal Villa Gardens",
    displayName: "Coastal Villa",
    blurb: "A dreamlike seaside villa garden — sea breeze, terraces and an endless horizon.",
    meshUrl: null,
    splatUrl: `${A}/dreamlike-coastal-villa-gardens.spz`,
    colliderUrl: `${A}/dreamlike-coastal-villa-gardens-collider.glb`,
    render: "splat",
    worldScale: 1.7, // open worlds tuned like the finale ones (feedback #11): world grand, people human-scale
    metric: { scale: 2.3438, ty: 1.6394 },
    profile: { spawn: { x: -3.94, z: 0.0 }, groundY: 5.6, bounds: { minX: -30.63, maxX: 21.07, minZ: -39.06, maxZ: 33.44 }, yaw: 0, cameraFar: 400 },
    enclosed: false,
    recommended: false,
  },
  "sunlit-palace-gardens": {
    key: "sunlit-palace-gardens",
    thumb: `${T}/sunlit-palace-gardens.jpg`,
    name: "Sunlit Palace Gardens",
    displayName: "Sunlit Gardens",
    blurb: "A palace garden bathed in morning light — an open, grand Baroque courtyard.",
    meshUrl: `${A}/sunlit-palace-gardens-mesh.glb`,
    splatUrl: `${A}/sunlit-palace-gardens.spz`,
    colliderUrl: `${A}/sunlit-palace-gardens-collider.glb`,
    // Back on splat: the 184MB texture mesh spreads its texels over a +-75m garden and reads
    // BLURRIER up close than the splat (user report); the splat is upright since the
    // double-flip fix and renders at DPR 2 now.
    render: "splat",
    worldScale: 1.7, // open worlds tuned like the finale ones (feedback #11): world grand, people human-scale
    metric: { scale: 1.7981, ty: 1.1657 },
    profile: { spawn: { x: -14.79, z: 39.91 }, groundY: 2.8, bounds: { minX: -75.29, maxX: 68.24, minZ: 1.12, maxZ: 82.68 }, yaw: 0, cameraFar: 400 },
    enclosed: false,
    recommended: false,
  },
};

// Chooser shows the walkable default first, then the open experimental worlds; finale worlds
// (finaleOnly: true) are reserved for the philosophy endings and hidden from this list.
export const WORLD_ORDER = [
  "fantasy-realm-of-shimmering-spheres",
  "grand-conservatory-with-lush-gardens",
  "mexican-courtyard-bedroom-fantasy",
  "enchanted-water-garden-sanctuary",
  "dreamlike-coastal-villa-gardens",
  "sunlit-palace-gardens",
];

// The shimmering-spheres tunnel is the Act-4 living gallery — full acceptance pass #12 (grand
// space, recognisable companions, feet on the ground) — and renders the 181MB highest-quality
// texture mesh, so the demo defaults to it.
export const DEFAULT_WORLD_KEY = "fantasy-realm-of-shimmering-spheres";

export const getWorld = (key) => WORLDS[key] || WORLDS[DEFAULT_WORLD_KEY];
// Safety filter: finale-reserved worlds can never leak into the chooser, even if someone
// re-adds them to WORLD_ORDER.
export const listWorlds = () => WORLD_ORDER.map((k) => WORLDS[k]).filter((w) => w && !w.finaleOnly);

// ---- The visitor's philosophy decides the world they finally walk into ----------------
//
// Keyed by the top-two philosophy axes (sorted + joined) — the SAME key app.js already
// ranks on to title the manifesto, so world, title and collection stay in lockstep.
// Every target is `enclosed: true`: an open world would strand the visitor on a plain.

export const PHILOSOPHY_WORLDS = {
  // Each ending lands in a world the chooser never offered (finaleOnly), so the finale reads
  // as generated for the visitor. PHILOSOPHY_QUERIES stays unchanged and stays in lockstep.
  // feedback #13: two endings now share the luminous Van Gogh studio (clear corridor, real
  // paintings — the best-rated of the three) while the floral asset is shelved for its
  // black-void interior (asset quality, not transform — its collider floor plateau matches
  // config exactly). The Monet/Kandinsky/Van Gogh collections still personalise each ending.
  "emotion+perception": "van-gogh-inspired-gallery-interior", // Monet collection — luminous studio
  "invention+perception": "yellow-polka-dot-infinity-room",   // Kandinsky collection — abstract dot room
  "emotion+invention": "van-gogh-inspired-gallery-interior",  // Van Gogh collection — his own studio world
};

// Art Institute query per ending. These MUST be artist names: the open-access endpoint
// filters on is_public_domain, and abstract theme phrases return zero rows — on an empty
// result app.js keeps the local placeholders, so a bad query silently costs us the payoff.
export const PHILOSOPHY_QUERIES = {
  "emotion+perception": "Claude Monet",
  "invention+perception": "Wassily Kandinsky",
  "emotion+invention": "Vincent van Gogh",
};
