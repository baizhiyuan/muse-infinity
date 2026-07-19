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

export const WORLDS = {
  // Generated via the Marble API (world_id 705b7748…) — a bright, enclosed, photorealistic
  // museum gallery hall with FLAT walls. Output is a raw .spz + trimesh collider (no baked
  // matrix), so we apply the semantics_metadata transform by hand: scale·Rx(π)+ty on BOTH
  // the splat and the collider (rawMarble). profile decoded post-transform.
  "bright-gallery-hall": {
    key: "bright-gallery-hall",
    name: "Bright Gallery Hall",
    displayName: "明亮画廊大厅",
    blurb: "阳光穹顶下的白墙画廊长廊 —— 大理石地面、雕像、天光,一座真正的美术馆内部。",
    meshUrl: null,
    splatUrl: `${A}/bright-gallery.spz`,
    colliderUrl: `${A}/bright-gallery-collider.glb`,
    render: "splat",
    rawMarble: true,
    metric: { scale: 0.80177665, ty: 0.5 },
    profile: { spawn: { x: 0, z: -1.14 }, groundY: 0, bounds: { minX: -2.42, maxX: 2.36, minZ: -26.84, maxZ: 24.55 }, yaw: 0, cameraFar: 300 },
    enclosed: true,
    recommended: true,
  },
  "yellow-polka-dot-infinity-room": {
    key: "yellow-polka-dot-infinity-room",
    name: "Yellow Polka Dot Infinity Room",
    displayName: "无限圆点镜屋",
    blurb: "草间弥生式的无限镜屋 —— 圆点与倒影在此永不落幕,叩问自我与无限。",
    meshUrl: `${A}/yellow-polka-dot-infinity-room-mesh.glb`,
    splatUrl: `${A}/yellow-polka-dot-infinity-room.spz`,
    colliderUrl: `${A}/yellow-polka-dot-infinity-room-collider.glb`,
    render: "mesh",
    worldScale: 3, // scale the whole world up so a 1.75 m visitor feels small/immersed (tune via ?wscale=)
    metric: { scale: 0.969, ty: 0.5906 },
    profile: { spawn: { x: 0.04, z: 0.25 }, groundY: 0.0, bounds: { minX: -4.43, maxX: 8.48, minZ: -2.68, maxZ: 5.45 }, yaw: -Math.PI / 2, cameraFar: 200 },
    enclosed: true,
    recommended: true,
  },
  "van-gogh-inspired-gallery-interior": {
    key: "van-gogh-inspired-gallery-interior",
    name: "Van Gogh Inspired Gallery Interior",
    displayName: "梵高画廊",
    blurb: "回旋笔触与星夜色调铺满的长廊 —— 一间为激情与孤独而建的画室。",
    meshUrl: null,
    splatUrl: `${A}/van-gogh-inspired-gallery-interior.spz`,
    colliderUrl: `${A}/van-gogh-inspired-gallery-interior-collider.glb`,
    render: "splat",
    metric: { scale: 1.4984, ty: 1.366 },
    profile: { spawn: { x: 1.79, z: 0.3 }, groundY: 0.0, bounds: { minX: -2.47, maxX: 10.0, minZ: -14.62, maxZ: 13.73 }, yaw: 0, cameraFar: 200 },
    enclosed: true,
    recommended: true,
  },
  "elegant-floral-palace-interior": {
    key: "elegant-floral-palace-interior",
    name: "Elegant Floral Palace Interior",
    displayName: "花影宫殿",
    blurb: "繁花簇拥的宫殿厅堂 —— 转瞬即逝的美,凝成可以漫步的永恒。",
    meshUrl: null,
    splatUrl: `${A}/elegant-floral-palace-interior.spz`,
    colliderUrl: `${A}/elegant-floral-palace-interior-collider.glb`,
    render: "splat",
    metric: { scale: 1.0516, ty: 0.6954 },
    profile: { spawn: { x: 1.16, z: 0.78 }, groundY: 0.2, bounds: { minX: -8.12, maxX: 12.73, minZ: -10.4, maxZ: 11.44 }, yaw: 0, cameraFar: 200 },
    enclosed: true,
    recommended: true,
  },
  "fantasy-realm-of-shimmering-spheres": {
    key: "fantasy-realm-of-shimmering-spheres",
    name: "Fantasy Realm of Shimmering Spheres",
    displayName: "流光球境",
    blurb: "悬浮微光球体铺成的狭长梦径 —— 走进潜意识的星海。",
    meshUrl: `${A}/fantasy-realm-of-shimmering-spheres-mesh.glb`,
    splatUrl: null,
    colliderUrl: `${A}/fantasy-realm-of-shimmering-spheres-collider.glb`,
    render: "mesh",
    metric: { scale: 1.5061, ty: 1.1685 },
    profile: { spawn: { x: 0.12, z: 0.83 }, groundY: 0.5, bounds: { minX: -2.08, maxX: 2.08, minZ: -6.83, maxZ: 9.99 }, yaw: 0, cameraFar: 200 },
    enclosed: true,
    recommended: true,
  },

  // ---- larger / outdoor worlds (splat-only, spawn less reliable — offered but not default) ----
  "grand-conservatory-with-lush-gardens": {
    key: "grand-conservatory-with-lush-gardens",
    name: "Grand Conservatory with Lush Gardens",
    displayName: "琉璃温室花园",
    blurb: "钢架玻璃穹顶下的巨型温室花园 —— 光与藤蔓交织的殿堂。",
    meshUrl: null,
    splatUrl: `${A}/grand-conservatory-with-lush-gardens.spz`,
    colliderUrl: `${A}/grand-conservatory-with-lush-gardens-collider.glb`,
    render: "splat",
    metric: { scale: 2.4943, ty: 1.4334 },
    profile: { spawn: { x: -1.6, z: -4.8 }, groundY: 0.9, bounds: { minX: -47.15, maxX: 41.28, minZ: -56.41, maxZ: 39.15 }, yaw: 0, cameraFar: 400 },
    enclosed: false,
    recommended: false,
  },
  "mexican-courtyard-bedroom-fantasy": {
    key: "mexican-courtyard-bedroom-fantasy",
    name: "Mexican Courtyard Bedroom Fantasy",
    displayName: "墨西哥庭院卧室",
    blurb: "弗里达式的庭院与卧房 —— 炽烈色彩里的痛楚与生命力。",
    meshUrl: null,
    splatUrl: `${A}/mexican-courtyard-bedroom-fantasy.spz`,
    colliderUrl: `${A}/mexican-courtyard-bedroom-fantasy-collider.glb`,
    render: "splat",
    metric: { scale: 2.9798, ty: 1.5802 },
    profile: { spawn: { x: 2.21, z: -1.23 }, groundY: 0.1, bounds: { minX: -21.02, maxX: 23.04, minZ: -22.3, maxZ: 17.39 }, yaw: 0, cameraFar: 400 },
    enclosed: false,
    recommended: false,
  },
  "enchanted-water-garden-sanctuary": {
    key: "enchanted-water-garden-sanctuary",
    name: "Enchanted Water Garden Sanctuary",
    displayName: "水影花园圣所",
    blurb: "睡莲与倒影的水上圣所 —— 莫奈笔下的宁静与流动。",
    meshUrl: null,
    splatUrl: `${A}/enchanted-water-garden-sanctuary.spz`,
    colliderUrl: `${A}/enchanted-water-garden-sanctuary-collider.glb`,
    render: "splat",
    metric: { scale: 1.7552, ty: 1.1188 },
    profile: { spawn: { x: 3.2, z: -17.58 }, groundY: 1.1, bounds: { minX: -6.36, maxX: 23.3, minZ: -41.25, maxZ: 16.21 }, yaw: 0, cameraFar: 400 },
    enclosed: false,
    recommended: false,
  },
  "dreamlike-coastal-villa-gardens": {
    key: "dreamlike-coastal-villa-gardens",
    name: "Dreamlike Coastal Villa Gardens",
    displayName: "海岸别墅花园",
    blurb: "临海别墅的梦境庭园 —— 海风、露台与无尽地平线。",
    meshUrl: null,
    splatUrl: `${A}/dreamlike-coastal-villa-gardens.spz`,
    colliderUrl: `${A}/dreamlike-coastal-villa-gardens-collider.glb`,
    render: "splat",
    metric: { scale: 2.3438, ty: 1.6394 },
    profile: { spawn: { x: -3.94, z: 0.0 }, groundY: 5.6, bounds: { minX: -30.63, maxX: 21.07, minZ: -39.06, maxZ: 33.44 }, yaw: 0, cameraFar: 400 },
    enclosed: false,
    recommended: false,
  },
  "sunlit-palace-gardens": {
    key: "sunlit-palace-gardens",
    name: "Sunlit Palace Gardens",
    displayName: "阳光宫苑",
    blurb: "沐浴晨光的宫廷花园 —— 开阔恢弘的巴洛克庭院。",
    meshUrl: `${A}/sunlit-palace-gardens-mesh.glb`,
    splatUrl: `${A}/sunlit-palace-gardens.spz`,
    colliderUrl: `${A}/sunlit-palace-gardens-collider.glb`,
    render: "splat",
    metric: { scale: 1.7981, ty: 1.1657 },
    profile: { spawn: { x: -14.79, z: 39.91 }, groundY: 2.8, bounds: { minX: -75.29, maxX: 68.24, minZ: 1.12, maxZ: 82.68 }, yaw: 0, cameraFar: 400 },
    enclosed: false,
    recommended: false,
  },
};

// Display order for the world-selection screen: enclosed / recommended first.
export const WORLD_ORDER = [
  "yellow-polka-dot-infinity-room",
  "van-gogh-inspired-gallery-interior",
  "elegant-floral-palace-interior",
  "fantasy-realm-of-shimmering-spheres",
  "grand-conservatory-with-lush-gardens",
  "mexican-courtyard-bedroom-fantasy",
  "enchanted-water-garden-sanctuary",
  "dreamlike-coastal-villa-gardens",
  "sunlit-palace-gardens",
];

// Fantasy shimmering-spheres tunnel is our clearest (mesh) world and the one where companions
// read as recognisable full-body figures (the gold dot room dyes them into blobs). Benchmark
// vs official Marble worlds says visual quality is the gap, so the demo defaults to it.
export const DEFAULT_WORLD_KEY = "bright-gallery-hall";

export const getWorld = (key) => WORLDS[key] || WORLDS[DEFAULT_WORLD_KEY];
export const listWorlds = () => WORLD_ORDER.map((k) => WORLDS[k]).filter(Boolean);

// ---- The visitor's philosophy decides the world they finally walk into ----------------
//
// Keyed by the top-two philosophy axes (sorted + joined) — the SAME key app.js already
// ranks on to title the manifesto, so world, title and collection stay in lockstep.
// Every target is `enclosed: true`: an open world would strand the visitor on a plain.

export const PHILOSOPHY_WORLDS = {
  "emotion+perception": "elegant-floral-palace-interior",     // The Garden of Living Light
  "invention+perception": "bright-gallery-hall",              // The Museum of Multiple Realities (generated gallery)
  "emotion+invention": "van-gogh-inspired-gallery-interior",  // The Infinite Interior
};

// Art Institute query per ending. These MUST be artist names: the open-access endpoint
// filters on is_public_domain, and abstract theme phrases return zero rows — on an empty
// result app.js keeps the local placeholders, so a bad query silently costs us the payoff.
export const PHILOSOPHY_QUERIES = {
  "emotion+perception": "Claude Monet",
  "invention+perception": "Wassily Kandinsky",
  "emotion+invention": "Vincent van Gogh",
};
