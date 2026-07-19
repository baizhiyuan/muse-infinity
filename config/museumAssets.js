export const museumArtworks = [
  {
    id: "monet-water-lilies",
    title: "Water Lilies",
    artist: "Claude Monet",
    date: "1906",
    image: "assets/museum/monet-water-lilies-1906.jpg",
    source: "Art Institute of Chicago",
    sourceUrl: "https://www.artic.edu/artworks/16568/water-lilies",
    rights: "Public domain artwork image via Art Institute of Chicago Open Access / IIIF"
  },
  {
    id: "van-gogh-bedroom",
    title: "The Bedroom",
    artist: "Vincent van Gogh",
    date: "1889",
    image: "assets/museum/van-gogh-bedroom-1889.jpg",
    source: "Art Institute of Chicago",
    sourceUrl: "https://www.artic.edu/artworks/28560/the-bedroom",
    rights: "Public domain artwork image via Art Institute of Chicago Open Access / IIIF"
  },
  {
    id: "seurat-grande-jatte",
    title: "A Sunday on La Grande Jatte",
    artist: "Georges Seurat",
    date: "1884-86",
    image: "assets/museum/seurat-grande-jatte-1884.jpg",
    source: "Art Institute of Chicago",
    sourceUrl: "https://www.artic.edu/artworks/27992/a-sunday-on-la-grande-jatte-1884",
    rights: "Public domain artwork image via Art Institute of Chicago Open Access / IIIF"
  }
];

export const salonParticipants = [
  {
    id: "monet",
    name: "MONET",
    fullName: "Claude Monet",
    color: "#8bbcb4",
    portrait: "assets/museum/portrait-claude-monet.jpg",
    turnaround: "assets/generated/turnarounds/claude-monet-turnaround-v1.png",
    views: ["front", "left", "back", "right"].map(view => `assets/generated/turnarounds/views/claude-monet/${view}.png`),
    model: "assets/characters/monet.glb",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Autoportret_Claude_Monet.jpg",
    rights: "Public domain self-portrait reproduction via Wikimedia Commons",
    turnaroundRights: "AI-generated interpretive multi-view reference based on the listed public-domain source; side and back views are not authentic historical records."
  },
  {
    id: "picasso",
    name: "PICASSO",
    fullName: "Pablo Picasso",
    color: "#b76c66",
    portrait: "assets/museum/portrait-pablo-picasso.jpg",
    turnaround: "assets/generated/turnarounds/pablo-picasso-turnaround-v1.png",
    views: ["front", "left", "back", "right"].map(view => `assets/generated/turnarounds/views/pablo-picasso/${view}.png`),
    model: "assets/characters/picasso.glb",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Portrait_de_Picasso,_1908.jpg",
    rights: "Public-domain 1908 portrait photograph by an anonymous photographer via Wikimedia Commons",
    turnaroundRights: "AI-generated interpretive multi-view reference based on the listed public-domain source; side and back views are not authentic historical records."
  },
  {
    id: "hilma",
    name: "HILMA",
    fullName: "Hilma af Klint",
    color: "#b58bb7",
    portrait: "assets/museum/portrait-hilma-af-klint.jpg",
    turnaround: "assets/generated/turnarounds/hilma-af-klint-turnaround-v1.png",
    views: ["front", "left", "back", "right"].map(view => `assets/generated/turnarounds/views/hilma-af-klint/${view}.png`),
    model: null,
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Hilma_af_Klint,_portrait_photograph_published_in_1901.jpg",
    rights: "Public-domain 1901 portrait photograph by an unknown photographer via Wikimedia Commons",
    turnaroundRights: "AI-generated interpretive multi-view reference based on the listed public-domain source; side and back views are not authentic historical records."
  },
  {
    id: "van_gogh",
    name: "VAN GOGH",
    fullName: "Vincent van Gogh",
    color: "#d4ad5e",
    portrait: "assets/museum/portrait-vincent-van-gogh.jpg",
    turnaround: "assets/generated/turnarounds/vincent-van-gogh-turnaround-v1.png",
    views: ["front", "left", "back", "right"].map(view => `assets/generated/turnarounds/views/vincent-van-gogh/${view}.png`),
    model: "assets/characters/van-gogh.glb",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Van_Gogh_self_portrait_1889.jpg",
    rights: "Public domain self-portrait reproduction via Wikimedia Commons",
    turnaroundRights: "AI-generated interpretive multi-view reference based on the listed public-domain source; side and back views are not authentic historical records."
  },
  {
    id: "frida",
    name: "FRIDA",
    fullName: "Frida Kahlo",
    color: "#a04f62",
    portrait: "assets/museum/portrait-frida-kahlo.jpg",
    turnaround: "assets/generated/turnarounds/frida-kahlo-turnaround-v1.png",
    views: ["front", "left", "back", "right"].map(view => `assets/generated/turnarounds/views/frida-kahlo/${view}.png`),
    model: "assets/characters/frida.glb",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Frida_Kahlo,_by_Guillermo_Kahlo.jpg",
    rights: "Public-domain portrait photograph by Guillermo Kahlo via Wikimedia Commons",
    turnaroundRights: "AI-generated interpretive multi-view reference based on the listed public-domain source; side and back views are not authentic historical records."
  },
  {
    id: "socrates",
    name: "SOCRATES",
    fullName: "Socrates",
    color: "#d0c8bb",
    portrait: "assets/museum/portrait-socrates.jpg",
    turnaround: "assets/generated/turnarounds/socrates-bust-turnaround-v1.png",
    views: ["front", "left", "back", "right"].map(view => `assets/generated/turnarounds/views/socrates/${view}.png`),
    model: "assets/characters/socrates.glb",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Bust_Socrates_Musei_Capitolini_MC1163.jpg",
    rights: "Public-domain photograph of a classical Socrates bust via Wikimedia Commons; not a true-life portrait",
    turnaroundRights: "AI-generated multi-view interpretation of the documented marble bust; it does not claim to reconstruct Socrates' true appearance."
  },
  {
    id: "morisot",
    name: "MORISOT",
    fullName: "Berthe Morisot",
    color: "#c89ba1",
    portrait: "assets/museum/portrait-berthe-morisot.jpg",
    turnaround: "assets/generated/turnarounds/berthe-morisot-turnaround-v1.png",
    views: ["front", "left", "back", "right"].map(view => `assets/generated/turnarounds/views/berthe-morisot/${view}.png`),
    model: null,
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Berthe_Morisot,_1875.jpg",
    rights: "Public domain archival portrait via Wikimedia Commons",
    turnaroundRights: "AI-generated interpretive multi-view reference based on the listed public-domain source; side and back views are not authentic historical records."
  }
];
