# Third-party notices

## Current prototype

No third-party 3D models, music, voice recordings, copied source code, or private museum data are bundled in this vertical slice.

Web typography requests:

- DM Sans — Google Fonts / SIL Open Font License
- Gilda Display — Google Fonts / SIL Open Font License

Original generated concept assets are documented in `ASSET_PIPELINE.md` and stored under `assets/generated/`. They are concept/UI assets for this project, not historical records, licensed museum collection images, or authentic likenesses of named people.

Generated stage backgrounds currently bundled:

- `assets/generated/muse-hero-romantic-v2.png`
- `assets/generated/muse-hero-conservatory-v3.png`
- `assets/generated/between-worlds-romantic-v2.png`
- `assets/generated/world-selection-gallery-v2.png`
- `assets/generated/monet-light-world-v2.png`
- `assets/generated/museum-salon-romantic-v2.png`
- `assets/generated/transformation-romantic-v2.png`
- `assets/generated/manifesto-garden-v2.png`

## Bundled open-access museum assets

The following public-domain artwork images were downloaded from the Art Institute of Chicago Open Access API / IIIF service at the recommended 843px size:

- `assets/museum/monet-water-lilies-1906.jpg` — Claude Monet, *Water Lilies*, 1906. Source: https://www.artic.edu/artworks/16568/water-lilies
- `assets/museum/van-gogh-bedroom-1889.jpg` — Vincent van Gogh, *The Bedroom*, 1889. Source: https://www.artic.edu/artworks/28560/the-bedroom
- `assets/museum/seurat-grande-jatte-1884.jpg` — Georges Seurat, *A Sunday on La Grande Jatte — 1884*, 1884-86. Source: https://www.artic.edu/artworks/27992/a-sunday-on-la-grande-jatte-1884

The following historical portrait images were downloaded from Wikimedia Commons pages marked as public domain:

- `assets/museum/portrait-claude-monet.jpg` — Claude Monet self-portrait reproduction. Source: https://commons.wikimedia.org/wiki/File:Autoportret_Claude_Monet.jpg
- `assets/museum/portrait-vincent-van-gogh.jpg` — Vincent van Gogh self-portrait reproduction. Source: https://commons.wikimedia.org/wiki/File:Van_Gogh_self_portrait_1889.jpg
- `assets/museum/portrait-berthe-morisot.jpg` — Berthe Morisot archival portrait. Source: https://commons.wikimedia.org/wiki/File:Berthe_Morisot,_1875.jpg
- `assets/museum/portrait-pablo-picasso.jpg` — Pablo Picasso portrait photograph, 1908, anonymous photographer. Source: https://commons.wikimedia.org/wiki/File:Portrait_de_Picasso,_1908.jpg
- `assets/museum/portrait-frida-kahlo.jpg` — Frida Kahlo portrait photograph by Guillermo Kahlo. Source: https://commons.wikimedia.org/wiki/File:Frida_Kahlo,_by_Guillermo_Kahlo.jpg
- `assets/museum/portrait-hilma-af-klint.jpg` — Hilma af Klint portrait photograph published in 1901, unknown photographer. Source: https://commons.wikimedia.org/wiki/File:Hilma_af_Klint,_portrait_photograph_published_in_1901.jpg
- `assets/museum/portrait-socrates.jpg` — photograph of the classical Socrates bust at the Capitoline Museums. Source: https://commons.wikimedia.org/wiki/File:Bust_Socrates_Musei_Capitolini_MC1163.jpg — the sculpture is an ancient representational tradition, not a true-life portrait.

## AI-generated interpretive character inputs

The following original turnaround sheets were generated for this project from the public-domain portrait references listed above:

- `assets/generated/turnarounds/claude-monet-turnaround-v1.png`
- `assets/generated/turnarounds/vincent-van-gogh-turnaround-v1.png`
- `assets/generated/turnarounds/berthe-morisot-turnaround-v1.png`
- `assets/generated/turnarounds/pablo-picasso-turnaround-v1.png`
- `assets/generated/turnarounds/frida-kahlo-turnaround-v1.png`
- `assets/generated/turnarounds/hilma-af-klint-turnaround-v1.png`
- `assets/generated/turnarounds/socrates-bust-turnaround-v1.png`

They are multi-view production references for possible 3D generation. Side and back views, clothing continuation, lighting and geometry are AI interpretations rather than authentic historical records. Socrates is explicitly a reconstruction of a classical bust, not the historical person. No third-party 3D model or cloned voice is included.

The files under `assets/generated/turnarounds/views/` are mechanical crops of those same seven project-owned sheets, created solely to provide Tripo's required `[front, left, back, right]` input order. They introduce no additional source material.

## Runtime open-source dependency

- Three.js `0.180.0` — MIT License — https://github.com/mrdoob/three.js
- Use: local WebGL rendering for the walkable museum gallery.

## Runtime open-access collection service

- Art Institute of Chicago Open Access API and IIIF Image API.
- Documentation: https://api.artic.edu/docs/
- The runtime filters records to those marked `is_public_domain` and retains a link to the museum record.

## Planned dependencies — not yet included

The following were evaluated as possible future references or integrations and are not part of the current source:

- React Three Fiber / Drei
- OpenVGAL
- Open Museum MCP
- Cleveland Museum of Art Open Access API

If any are integrated, verify the exact version, license, attribution, data terms, image-level rights marker, and transformation requirements before submission.

## Runtime external-world configuration

No World Labs URL or asset is bundled at present. When a public hosted World Labs environment is added to `worlds.json`, record its world ID, creator/owner, creation date, permitted embedding terms, and URL here.

No TRIPO model is bundled at present. When `models/socrates-tripo.glb` is added, record its generation account, creation date, ownership, applicable terms, and any source inputs here.
