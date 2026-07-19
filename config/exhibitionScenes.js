// MUSE∞ — the exhibition spine.
//
// Ported from the codex immersive-3d-exhibition branch (config/immersiveAssets.js): the ordered
// list of scenes the visitor walks through, one continuous journey. Each scene keeps the codex
// title / chapter / artist / prompt / thumbnail and its curated `artworks` order (interpretive
// studies first), but the raw splat/collider paths are replaced by a `worldKey` into OUR Marble
// world registry (config/worlds.js) — this repo owns world positioning, so scenes only name which
// world to load. characterCatalog / transform / spawn are dropped: our chosen companions walk
// every scene and worlds.js profiles own the camera.

import { museumArtworks } from "./museumAssets.js";

const [waterLilies, bedroom, grandeJatte] = museumArtworks;

const interpretiveStudy = (id, title, artist, image, prompt) => ({
  id,
  title,
  artist,
  date: "AI interpretive study",
  image,
  source: "MUSE visual study",
  rights: "AI-generated interpretive image; not an authentic historical artwork.",
  prompt
});

const studies = {
  picasso: interpretiveStudy(
    "picasso-multiple-realities",
    "Multiple Realities",
    "After Pablo Picasso",
    "assets/generated/worlds/picasso-multiple-realities-world-v1.png",
    "Which viewpoint does this image refuse to make final?"
  ),
  vanGogh: interpretiveStudy(
    "van-gogh-emotional-sky",
    "The Emotional Sky",
    "After Vincent van Gogh",
    "assets/generated/worlds/van-gogh-emotional-sky-world-v1.png",
    "Where does observation become emotional intensity?"
  ),
  qiBaishi: interpretiveStudy(
    "qi-baishi-living-ink",
    "Living Ink",
    "After Qi Baishi",
    "assets/generated/worlds/qi-baishi-living-ink-world-v2.png",
    "How little form is needed before life appears?"
  ),
  frida: interpretiveStudy(
    "frida-living-memory",
    "Living Memory",
    "After Frida Kahlo",
    "assets/generated/worlds/frida-living-memory-world-v1.png",
    "Which symbol turns private memory into a shared language?"
  ),
  kusama: interpretiveStudy(
    "kusama-infinite-self",
    "Infinite Self",
    "After Yayoi Kusama",
    "assets/generated/worlds/infinity-accumulation-self-obliteration-world-v5.png",
    "Does repetition dissolve the self or make it more visible?"
  ),
  future: interpretiveStudy(
    "future-being",
    "A World Still Becoming",
    "MUSE + visitor",
    "assets/generated/worlds/future-being-gallery-v1.png",
    "Which part of this world feels like an answer you authored?"
  )
};

export const exhibitionScenes = [
  {
    worldKey: "grand-conservatory-with-lush-gardens",
    id: "threshold-conservatory",
    title: "The Threshold Conservatory",
    chapter: "01 / ARRIVAL",
    artist: "A cross-temporal salon",
    prompt: "What must become visible before an answer can begin?",
    thumbnail: "assets/scenes/01-entrance-conservatory.png",
    artworks: [grandeJatte, waterLilies, bedroom]
  },
  {
    worldKey: "elegant-floral-palace-interior",
    id: "court-of-light",
    title: "The Court of Light",
    chapter: "02 / QUESTION",
    artist: "Sigmund Freud",
    prompt: "Which part of your question belongs to you, and which part was inherited?",
    thumbnail: "assets/scenes/02-court-of-light.png",
    artworks: [bedroom, grandeJatte, waterLilies]
  },
  {
    worldKey: "enchanted-water-garden-sanctuary",
    id: "water-and-light",
    title: "The Garden of Water and Light",
    chapter: "03 / PERCEPTION",
    artist: "Claude Monet",
    prompt: "Can a life change simply because attention becomes more precise?",
    thumbnail: "assets/scenes/03-monet-water-and-light.png",
    artworks: [waterLilies, grandeJatte, bedroom]
  },
  {
    worldKey: "dreamlike-coastal-villa-gardens",
    id: "sunset-frames",
    title: "The Sunset Frame Gallery",
    chapter: "04 / INVENTION",
    artist: "Pablo Picasso",
    prompt: "What changes when the same truth is seen from more than one angle?",
    thumbnail: "assets/scenes/04-sunset-frame-gallery.png",
    artworks: [studies.picasso, grandeJatte, bedroom]
  },
  {
    worldKey: "van-gogh-inspired-gallery-interior",
    id: "burning-sky",
    title: "The Studio of the Burning Sky",
    chapter: "05 / INTENSITY",
    artist: "Vincent van Gogh",
    prompt: "Can struggle deepen attention without becoming the source of meaning itself?",
    thumbnail: "assets/scenes/05-van-gogh-burning-sky.png",
    artworks: [bedroom, studies.vanGogh, waterLilies]
  },
  {
    worldKey: "sunlit-palace-gardens",
    id: "petal-transition",
    title: "The Petal Transition Hall",
    chapter: "06 / TRANSFORMATION",
    artist: "Qi Baishi",
    prompt: "How little can an image contain and still hold an entire world?",
    thumbnail: "assets/scenes/06-petal-transition-hall.png",
    artworks: [studies.qiBaishi, waterLilies, grandeJatte]
  },
  {
    worldKey: "mexican-courtyard-bedroom-fantasy",
    id: "living-memory",
    title: "The Courtyard of Living Memory",
    chapter: "07 / IDENTITY",
    artist: "Frida Kahlo",
    prompt: "What can pain become after it is given color, symbol and form?",
    thumbnail: "assets/scenes/07-frida-living-memory.png",
    artworks: [studies.frida, bedroom, waterLilies]
  },
  {
    worldKey: "yellow-polka-dot-infinity-room",
    id: "infinite-repetition",
    title: "The Infinite Repetition Chamber",
    chapter: "08 / INFINITY",
    artist: "Yayoi Kusama",
    prompt: "If the self repeats into infinity, what remains uniquely yours?",
    thumbnail: "assets/scenes/08-kusama-infinite-dots.png",
    artworks: [studies.kusama, grandeJatte, waterLilies]
  },
  {
    worldKey: "fantasy-realm-of-shimmering-spheres",
    id: "personal-dream-world",
    title: "Your Dream World",
    chapter: "09 / ANSWER",
    artist: "A world formed from your answer",
    prompt: "What will you carry back into the life outside this world?",
    thumbnail: "assets/scenes/09-final-dream-world.png",
    isFinal: true,
    artworks: [studies.future, waterLilies, bedroom]
  }
];
