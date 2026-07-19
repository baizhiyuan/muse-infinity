# MUSE Infinity Latest Product Spec

## Product thesis

MUSE Infinity is an AI-native dream museum for one personal question. The visitor asks an existential theme such as "What makes a life meaningful?", chooses several artist or thinker companions, and enters one continuous 3D gallery-world where public-domain artworks, companion dialogue, and the environment all respond to that question.

The product should not feel like separate random rooms. It should feel like one coherent dream world with distinct regions: each region has its own material language, color, light, artworks, and companion perspective, but the visitor can understand that all regions belong to one generated curatorial journey.

## Competition MVP outcome

The Build Week version should prove one complete path:

1. The visitor enters one question.
2. GPT-5.6 turns it into a curatorial spine.
3. The visitor selects up to three companions.
4. The system creates a continuous gallery plan with multiple artworks per region.
5. The visitor walks through the 3D gallery.
6. Clicking an artwork opens metadata, a companion response, and a visible world reaction.
7. At the end, the visitor receives a personal dream-world synthesis and manifesto.

The core wow moment is not "AI chats with artists." The core wow moment is: "My question became a museum I can walk through, and the people beside me changed how I saw each work."

## Current implementation baseline

Already present in the repository:

- Local browser app served by `server.mjs`.
- Three.js walkable gallery layer in `lib/museum3d.js`.
- Open-access artwork route: `GET /api/artworks?q=...`.
- GPT-5.6 dialogue route: `POST /api/dialogue`, with honest local fallback.
- World Labs generation endpoints behind `INTEGRATION_ADMIN_TOKEN`.
- Tripo generation, multiview, rigging, and polling endpoints behind `INTEGRATION_ADMIN_TOKEN`.
- Public Tripo character manifest route: `GET /api/tripo/characters`.
- Generated visual reference assets under `assets/generated/worlds/`.
- Character turnaround references under `assets/generated/turnarounds/`.
- Contract tests for integration request shapes and private-file boundaries.

The current shipped repo is a strong engineering spike, not the full final dream-gallery product. The next work should concentrate the concept into one beautiful, testable judging path.

## Final demo structure

### Act 1: The Question Gate

User action:

- Types or selects one theme question.
- Example: "What makes a life meaningful?"

GPT-5.6 role:

- Extracts the theme, emotional tone, and three interpretive lenses.
- Produces a constrained JSON journey plan.

Visible result:

- The entrance room changes title, palette, and companion recommendations.
- The UI shows that the museum is being curated around this one question.

### Act 2: Choose Companions

User action:

- Selects up to three companions to walk with.

Recommended companion set for the competition build:

- Claude Monet: light, perception, attention.
- Vincent van Gogh: emotion, intensity, spiritual hunger.
- Frida Kahlo: identity, body, memory.
- Socrates: questioning, ethics, examined life.
- Sigmund Freud: dream, desire, hidden motive.
- Qi Baishi: ordinary life, ink, humor, vitality.
- Pablo Picasso: fragmentation, multiple viewpoints.
- Kusama-inspired infinity guide: repetition, infinity, self-obliteration.

Important representation rule:

- Living artists should not be cloned or impersonated. If a Kusama-like region is used, frame it as an "infinity and repetition" perspective inspired by broad visual concepts, not as the real Yayoi Kusama speaking or endorsing the work.
- Avoid copyrighted characters such as Pikachu or Crayon Shin-chan. Pinocchio can be considered only if using public-domain versions and clearly avoiding Disney styling.

Visible result:

- The selected companions appear as side portraits or, once ready, reviewed 3D figures.
- The gallery route updates to prioritize their lenses.

### Act 3: Continuous Dream Gallery

User action:

- Walks forward through one connected gallery-world.
- Clicks artworks and companion markers.

World shape:

- One continuous backbone path.
- Four to five distinct regions connected by portals, bridges, garden passages, or light corridors.
- Each region contains several artworks, not one empty frame.

Recommended regions for the "meaning of life" demo:

- Threshold Rotunda: a bright glass museum-garden entrance, used for orientation.
- Water and Light Garden: Monet/perception region with reflections, lilies, daylight, and soft movement.
- Emotional Sky Atelier: Van Gogh/emotion region with blue-gold thick paint surfaces, wooden floor, cypress silhouettes, and warm lamps.
- Living Memory Courtyard: Frida/identity region with cobalt walls, tiled ground, plants, household objects, doors, mirrors, and memory frames.
- Infinity/Repetition Passage: yellow-black dot room or soft pink infinity lounge, used as a high-contrast spatial surprise.
- Final Dream World: the visitor's synthesized answer, combining the chosen lenses into one personalized gallery.

Design rule:

- Do not make every region marble. Marble can be the threshold material, but each world needs its own texture system: water/glass, impasto/wood, cobalt tile/garden, dots/mirrors, ink/paper, or dream-light.

### Act 4: Artwork Encounters

User action:

- Clicks an artwork frame or pedestal.
- Asks a question by text or voice.

GPT-5.6 role:

- Responds through one selected companion.
- Grounds the response in the actual artwork metadata.
- Returns a constrained visual effect.

Deterministic code role:

- Loads artwork metadata and image from open-access APIs or local fallback.
- Places the artwork onto 3D planes or frames.
- Applies a deterministic scene reaction from the constrained effect.

Visible result:

- Artwork card opens with title, artist, date, source, rights.
- Companion text or voice response appears.
- The environment changes visibly: light bloom, mist, color shift, particles, frame glow, or path reveal.

Required artwork policy:

- Use public-domain or open-access records only.
- Start with Art Institute of Chicago Open Access because it already works.
- Optionally add The Met API later, but only for records explicitly marked public domain.
- Every artwork must keep source URL and rights text.

### Act 5: Final Dream World

User action:

- Chooses which interpretation changed them most.

GPT-5.6 role:

- Writes a short synthesis based on the question, selected companions, artworks visited, and user choice.

Deterministic code role:

- Maps the synthesis into a final world palette, spatial preset, and manifesto card.

Visible result:

- The gallery transforms into the final personal dream world.
- A concise manifesto appears.
- The demo ends with a shareable result state.

## Core data contract

Use this as the target contract between GPT-5.6, the server, and the frontend:

```json
{
  "question": "What makes a life meaningful?",
  "theme": "meaning and attention",
  "companions": [
    {
      "id": "monet",
      "name": "Claude Monet",
      "lens": "light and perception"
    }
  ],
  "journey": {
    "title": "A Museum for a Meaningful Life",
    "spine": "The visitor moves from attention, to emotion, to memory, to infinity, then synthesis.",
    "regions": [
      {
        "id": "water-light-garden",
        "title": "Water and Light Garden",
        "lens": "attention",
        "environmentPrompt": "Luminous water garden gallery with glass, reflections, lilies, soft daylight, and walkable paths.",
        "companionIds": ["monet"],
        "artworks": [
          {
            "id": "aic-16568",
            "title": "Water Lilies",
            "artist": "Claude Monet",
            "date": "1906",
            "image": "https://...",
            "source": "Art Institute of Chicago",
            "sourceUrl": "https://www.artic.edu/artworks/16568/water-lilies",
            "rights": "Public-domain artwork image via Art Institute of Chicago Open Access / IIIF"
          }
        ],
        "transition": "A reflective path opens into a warmer blue-gold room."
      }
    ]
  },
  "finalSynthesis": {
    "title": "Your Dream Gallery",
    "manifesto": "A meaningful life is attention made visible.",
    "visualPreset": "hybrid_final"
  }
}
```

## OpenAI implementation requirements

GPT-5.6 should be used for:

- Turning the user question into the structured curatorial plan.
- Selecting or ranking open-access artworks by theme and companion lens.
- Generating grounded companion responses during artwork encounters.
- Producing the final manifesto from actual user choices.

GPT-5.6 should not directly control arbitrary scene objects. It should return constrained JSON: region IDs, artwork IDs, companion IDs, text, and visual effect enums. The frontend owns deterministic rendering.

Do not store model responses unless the user explicitly opts in. Keep `store: false` for the competition path.

## World Labs implementation requirements

World Labs should be used for environment generation only after the approved scene references are chosen.

Best competition use:

- Generate one connected base world from a carefully written prompt and selected reference images.
- Keep artworks separate as runtime planes/cards so metadata and interactions remain testable.
- Do not bake final artwork images permanently into the world if that prevents click interaction and rights display.

World Labs generation must:

- Require `INTEGRATION_ADMIN_TOKEN`.
- Never run automatically on page load.
- Save operation ID, prompt, source images, and output URL in documentation.
- Have a local deterministic fallback so judging does not depend on paid generation.

## Tripo implementation requirements

Tripo should be used for reviewed 3D companions, one character at a time.

Input requirements:

- White-background full-body multiview sheets.
- Ordered views: front, left, back, right.
- Public HTTPS asset URLs through `PUBLIC_APP_URL`.
- Human review before submitting each job.

Output requirements:

- Download temporary outputs immediately.
- Optimize GLB for web.
- Record source references, generation task ID, and rights notes.
- Set the approved `model` path in `config/museumAssets.js`.

Do not claim a companion is loaded in 3D until the GLB exists, has been reviewed, and renders in the browser.

## Art and IP boundaries

Allowed:

- Public-domain museum artworks.
- Open-access museum APIs with recorded metadata.
- Original generated environment concepts.
- AI interpretations of deceased historical figures when labeled clearly.
- Pinocchio only in a public-domain, non-Disney visual interpretation if needed.

Avoid:

- Copyrighted characters such as Pikachu and Crayon Shin-chan.
- Photorealistic avatars or voices of living artists.
- Unlicensed contemporary artworks.
- Museum website screenshots unless the license permits reuse.
- Presenting generated side/back views as authentic historical record.

## Three-minute demo script

0:00-0:20: "I came with one question: what makes a life meaningful?"

0:20-0:45: The product turns the question into a museum journey and lets the visitor choose companions.

0:45-1:30: Show the continuous 3D gallery. Walk from the bright threshold into the first region. Multiple artworks are visible.

1:30-2:10: Click an artwork, ask a question, and show GPT-5.6 returning a companion response plus a visual effect.

2:10-2:35: Explain GPT-5.6's role: curatorial plan, artwork-grounded dialogue, final synthesis. Mention that the renderer uses constrained effects so the demo is not a mock.

2:35-2:50: Explain Codex's role: converting the concept into a working browser app, API routes, Three.js gallery, tests, and fallbacks.

2:50-3:00: Show the final dream world and manifesto.

Live changes that must happen during the recording:

- The selected question changes the museum plan or visible theme label.
- Clicking an artwork opens real metadata and companion interpretation.
- A user choice or dialogue effect visibly changes the scene.

## Engineering task list

Priority 0: judging path

- Add one "question to journey" route or local fixture that returns the core data contract.
- Render a visible journey spine from the current question.
- Ensure each region has two to four artworks with metadata and source links.
- Keep local fallback fully truthful and runnable without keys.

Priority 1: visual coherence

- Replace the all-marble feeling with region-specific material presets.
- Use the approved generated images as visual reference, not necessarily as runtime backgrounds.
- Keep the first scene bright, romantic, airy, and museum-like.
- Make the Kusama/infinity region much bolder if used: yellow-black dots, mirrored tunnel, or soft infinite accumulation lounge.

Priority 2: companions

- Keep the demo to three active companions even if the library contains more.
- Prefer deceased historical figures with public-domain portrait sources.
- Add reviewed 3D GLB models only after Tripo output is approved.

Priority 3: sponsored APIs

- Add explicit admin-only buttons or scripts for World Labs and Tripo generation.
- Never spend sponsor credits from page load.
- Log task IDs and output URLs in local docs.

## Acceptance criteria

- `npm run check` passes.
- `npm test` passes.
- `http://localhost:4173/?demo=true` completes in under two minutes.
- The demo path works with no user API key.
- The app never exposes `.env`, server code, tests, or project docs through the static server.
- At least three artworks are visible in the gallery.
- Each visible artwork has title, artist, date, source, source URL, and rights text.
- At least one artwork click triggers a non-static scene change.
- GPT-5.6 responses are labeled live only when `OPENAI_API_KEY` is configured.
- World Labs and Tripo routes require `INTEGRATION_ADMIN_TOKEN`.

## Non-goals before submission

- Do not build five complete fully generated worlds.
- Do not make every companion a fully animated 3D character.
- Do not add multiplayer.
- Do not add accounts.
- Do not scrape LinkedIn, Instagram, museum websites, or private social data.
- Do not rely on copyrighted character IP.
- Do not let paid generation block the judging path.

## Recommended next commit scope

The next engineering commit should be small and high-impact:

- Add the journey data contract and one precomputed "meaning of life" demo journey.
- Render multiple artworks per region.
- Make the first scene and world regions visually distinct.
- Add one visible GPT-5.6-curated label or response path.
- Keep all provider generation routes opt-in and server-only.
