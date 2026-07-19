# MUSE∞ Asset Pipeline

This project separates three asset categories so the demo can improve visually without creating copyright, likeness, or submission-risk problems.

## 1. Generated original concept assets

These files were generated as original visual direction assets for this project and are safe to use as concept imagery, UI backgrounds, or Devpost explanation images:

- `assets/generated/muse-hero-romantic-v2.png` — recommended bright, romantic museum-garden entrance direction.
- `assets/generated/muse-hero-conservatory-v3.png` — current production hero: a brighter glass conservatory, rose garden and open museum threshold.
- `assets/generated/between-worlds-romantic-v2.png` — bright rotunda/portal direction for the Museum Between Worlds stage.
- `assets/generated/world-selection-gallery-v2.png` — airy gallery-wall direction for choosing a world.
- `assets/generated/monet-light-world-v2.png` — luminous water-garden direction for the Monet exploration stage.
- `assets/generated/museum-salon-romantic-v2.png` — recommended airy companion-conversation background for artist and thinker scenes.
- `assets/generated/transformation-romantic-v2.png` — bright spatial rewrite direction for the transformation stage.
- `assets/generated/manifesto-garden-v2.png` — serene final dream-world direction for the manifesto stage.
- `assets/generated/muse-hero-concept.png` — impossible museum exterior and garden archive direction.
- `assets/generated/perspective-masks-grid.png` — four abstract non-likeness perspective masks.
- `assets/generated/transformation-gallery-concept.png` — museum-to-world transformation direction.
- `assets/generated/turnarounds/claude-monet-turnaround-v1.png` — AI-generated front/left/back/right 3D input sheet derived from the listed public-domain Monet self-portrait.
- `assets/generated/turnarounds/vincent-van-gogh-turnaround-v1.png` — AI-generated front/left/back/right 3D input sheet derived from the listed public-domain Van Gogh self-portrait.
- `assets/generated/turnarounds/berthe-morisot-turnaround-v1.png` — AI-generated front/left/back/right 3D input sheet derived from the listed public-domain Morisot portrait.
- `assets/generated/turnarounds/pablo-picasso-turnaround-v1.png` — AI-generated front/left/back/right 3D input sheet derived from the listed public-domain 1908 Picasso photograph.
- `assets/generated/turnarounds/frida-kahlo-turnaround-v1.png` — AI-generated front/left/back/right 3D input sheet derived from the listed public-domain Frida Kahlo photograph.
- `assets/generated/turnarounds/hilma-af-klint-turnaround-v1.png` — AI-generated front/left/back/right 3D input sheet derived from the listed public-domain Hilma af Klint photograph.
- `assets/generated/turnarounds/socrates-bust-turnaround-v1.png` — AI-generated four-view reconstruction input based on the listed public-domain photograph of a classical marble bust.

The v2 romantic assets are the preferred production direction. The darker first-pass assets are exploration material only and should not define the final mood.

Generated scene images must not be described as World Labs output, historical evidence, museum collection records, or authentic depictions of named philosophers/artists.

The turnaround sheets are production inputs, not historical records. Their frontal identity reference comes from the documented public-domain portrait or sculpture listed in `THIRD_PARTY_NOTICES.md`; unseen angles, costume continuation, lighting and geometry are interpretive AI synthesis. Each sheet has mechanically cropped front, left, back and right files under `assets/generated/turnarounds/views/` for Tripo's ordered multiview input. Any model produced from them must retain an "AI interpretation" label.

## 2. Public-domain artwork/reference assets

Artwork images should come from open-access/public-domain sources only, with source URLs and license notes recorded in `THIRD_PARTY_NOTICES.md`.

Good candidates:

- The Metropolitan Museum of Art Open Access API.
- National Gallery of Art open access images.
- Rijksmuseum public-domain collection records.
- Wikimedia Commons files only when the license and source are clear.

Do not use copyrighted modern magazine scans, museum website images, or reference-site screenshots as project assets unless their license explicitly allows reuse.

## 3. Artist and philosopher participant assets

For named historical artists, use real public-domain portraits, self-portraits, or archival photographs when available. Record the source URL and rights marker in `THIRD_PARTY_NOTICES.md`.

Good initial participants for the MVP:

- Claude Monet — public-domain self-portrait or archival portrait.
- Vincent van Gogh — public-domain self-portrait.
- Berthe Morisot — public-domain archival portrait or portrait painting.
- Socrates — classical bust imagery only, because no real portrait exists.

Use AI generation only to create the surrounding UI treatment, lighting harmonization, or non-likeness symbolic cards. Do not invent fake "real" portraits.

Avoid photorealistic portraits of living artists, celebrities, or exact likeness reconstruction unless the source and rights are clear. The demo should frame every participant as an AI interpretation of a perspective, not as a cloned person.

## Next production pass

1. Pick one visual system for the whole MVP: romantic museum garden + pale stone + glass conservatory + soft daylight.
2. Replace generic Canvas colors with the generated scene palette.
3. Add three public-domain artwork cards with recorded source URLs. Done for the initial Art Institute of Chicago set.
4. Add real public-domain artist portraits where available; keep generated masks only as optional non-named perspective cards. Done for Monet, Van Gogh and Morisot.
5. Keep the live demo path runnable without external asset servers.
6. Deploy the ordered view assets over HTTPS, submit one character at a time through the explicit Tripo multiview route, then review likeness, topology, texture seams and rights metadata before bundling any GLB. Turnaround inputs are ready; generated GLB files are not yet bundled and no credits are spent automatically.

## Open-source references

Use open-source projects as licensed infrastructure or interaction references, not as untracked copied code:

- three.js — MIT license; best next step for a real 3D museum/conservatory renderer.
- OpenSeadragon — New BSD license; useful if the MVP needs zoomable IIIF artwork inspection.
- IIIF ecosystem references — useful for museum image pipeline and manifests.

Do not import demo code whose license prohibits redistribution or commercial use. If a visual demo is only inspiration, rebuild the effect locally and document it as inspiration rather than bundled dependency.

The current build now uses the npm-published MIT-licensed `three` package for the walkable gallery. It does not copy a third-party gallery demo.
