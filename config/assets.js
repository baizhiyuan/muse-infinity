export const worldAssets = {
  threshold: {
    id: "threshold",
    title: "A Physical Memory",
    sourceType: "mock",
    worldUrl: "",
    assetUrl: "",
    thumbnailUrl: "",
    fallbackSceneId: "threshold-particles"
  },
  monet: {
    id: "monet",
    title: "World of Light",
    sourceType: "mock",
    worldUrl: "",
    assetUrl: "",
    thumbnailUrl: "",
    fallbackSceneId: "monet-particles"
  }
};

export const characterAssets = {
  socrates: {
    modelUrl: "/models/socrates-tripo.glb",
    representation: "documented_placeholder",
    scale: 1.2,
    note: "Replace with the final web-optimized TRIPO GLB. The current Canvas build uses a procedural marble particle bust."
  }
};

export const worldVariants = [
  "neutral", "monet", "picasso", "kusama", "van_gogh",
  "frida", "socrates", "modern_thinker", "hybrid_final"
];
