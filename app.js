import { worldAssets } from "./config/assets.js";
import { WorldLabsAdapter } from "./services/worldLabs.js";
import { AudioReactiveSignal } from "./lib/audioAnalysis.js";
import { PerformanceController } from "./lib/performance.js";
import { createMemoryWorld, memoryPalette } from "./lib/memoryWorld.js";
import { museumArtworks, salonParticipants } from "./config/museumAssets.js";
import { Museum3D } from "./lib/museum3d.js";
import { loadOpenAccessArtworks } from "./services/museumCollections.js";
import { artworkChoices, AXIS_CHAMPIONS, DIALOGUE_DISCLAIMER, voiceFor, formatLine } from "./config/companionDialogues.js";
import { getWorld, listWorlds, DEFAULT_WORLD_KEY, PHILOSOPHY_WORLDS, PHILOSOPHY_QUERIES } from "./config/worlds.js";

const canvas = document.querySelector("#world");
const ctx = canvas.getContext("2d", { alpha: false });
const root = document.documentElement;
const experience = document.querySelector("#experience");
const environmentContainer = document.querySelector("#world-environment");
const worldStatus = document.querySelector("#worldStatus");
const debugPanel = document.querySelector("#debugPanel");

const loadingMemory = document.createElement("div");
loadingMemory.className = "loading-memory";
loadingMemory.innerHTML = "<div><i></i><span>Reconstructing a memory…</span></div>";
document.body.append(loadingMemory);

const audioSignal = new AudioReactiveSignal();
const worldAdapter = new WorldLabsAdapter({
  container: environmentContainer,
  onState: ({ state: loadState }) => {
    state.worldLoadState = loadState;
    const labels = { idle:"LOCAL MEMORY", loading:"GATHERING WORLD", ready:"WORLD LABS READY", fallback:"LOCAL FALLBACK" };
    worldStatus.textContent = labels[loadState] || "LOCAL MEMORY";
    loadingMemory.classList.toggle("visible", loadState === "loading");
  }
});

const performanceController = new PerformanceController({
  initial: "auto",
  onChange: () => {
    syncParticlePool();
    resize();
    updatePerformanceLabel();
  }
});

const STAGES = [
  "threshold", "museum_void", "world_selection", "companion_selection", "world_exploration",
  "summoning", "roundtable", "decision", "world_transformation", "manifesto"
];

const stageMeta = {
  threshold: ["00", "THRESHOLD", "#c9aa72"],
  museum_void: ["01", "BETWEEN WORLDS", "#9e87aa"],
  world_selection: ["02", "BORROWED EYES", "#7caaa9"],
  companion_selection: ["03", "CHOOSE YOUR COMPANY", "#c999a9"],
  world_exploration: ["04", "THE LIVING GALLERY", "#91bab1"],
  summoning: ["05", "THE SUMMONING", "#b59bc0"],
  roundtable: ["06", "SALON OUTSIDE TIME", "#c9aa72"],
  decision: ["07", "THE CONTRADICTION", "#bc7788"],
  world_transformation: ["08", "WORLD REWRITTEN", "#7faab7"],
  manifesto: ["09", "YOUR IMPOSSIBLE WORLD", "#d1b677"]
};

// The closing roundtable is the only part of the arc that knows what the visitor actually did,
// and its digest is posted to a paid endpoint. Every cap is applied AT CONSTRUCTION so the payload
// has a fixed ceiling (~2KB) no matter how long the walk runs — trimming later leaves one forgotten
// path through which an unbounded transcript escapes.
const SESSION_CAPS = { artworks: 5, questions: 3, nameChars: 120, questionChars: 200, lineChars: 160 };

const trimTo = (value, limit) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, limit);

function emptySession() {
  return { visitedArtworks: [], askedQuestions: [], perspectiveLog: [] };
}

function emptyRoundtable() {
  return { status: "idle", data: null, error: null };
}

/** Rolling window: a repeat visit moves the artwork to the end rather than duplicating it. */
function recordVisitedArtwork(session, artwork) {
  const title = trimTo(artwork?.title, SESSION_CAPS.nameChars);
  if (!title) return session;
  const artist = trimTo(artwork?.artist, SESSION_CAPS.nameChars);
  const key = `${title}|${artist}`.toLowerCase();
  const kept = session.visitedArtworks.filter(item => `${item.title}|${item.artist}`.toLowerCase() !== key);
  return { ...session, visitedArtworks: [...kept, { title, artist }].slice(-SESSION_CAPS.artworks) };
}

function recordAskedQuestion(session, question) {
  const text = trimTo(question, SESSION_CAPS.questionChars);
  if (!text) return session;
  const kept = session.askedQuestions.filter(item => item.toLowerCase() !== text.toLowerCase());
  return { ...session, askedQuestions: [...kept, text].slice(-SESSION_CAPS.questions) };
}

/** One line per master — a master's latest reading replaces their previous one. */
function recordPerspective(session, perspective) {
  const speakerId = trimTo(perspective?.speakerId, SESSION_CAPS.nameChars).toLowerCase();
  const line = trimTo(perspective?.text, SESSION_CAPS.lineChars);
  if (!speakerId || !line) return session;
  const speaker = trimTo(perspective?.speaker, SESSION_CAPS.nameChars) || speakerId;
  const kept = session.perspectiveLog.filter(item => item.speakerId !== speakerId);
  return { ...session, perspectiveLog: [...kept, { speakerId, speaker, line }] };
}

const state = {
  stage: "threshold",
  selectedPortal: null,
  activeSpeaker: null,
  session: emptySession(),
  roundtable: emptyRoundtable(),
  philosophy: { perception: 0, emotion: 0, invention: 0 },
  finalWorld: null,
  audioEnabled: false,
  demoMode: new URLSearchParams(location.search).get("demo") === "true",
  performanceMode: "auto",
  worldLoadState: "fallback",
  transformationStart: 0,
  transformationChoice: null,
  memories: new Set(),
  selectedCompanions: new Set(["monet", "van_gogh", "socrates"]),
  galleryArtworks: [...museumArtworks],
  focusedArtwork: museumArtworks[0]
};

let museum3D = null;
let artDialogueTurn = 0;
let typewriterTimer = null;
// Bumped on every popup open/close; a live fetch captures it and discards its own reply when the
// popup has since been closed or reopened for something else.
let dialogueToken = 0;

// The legacy `effectModes` literal lived here: a second, independent effect vocabulary whose keys
// (`soften_boundaries`, …) never matched the server's enum values, so every lookup missed. It was
// already unreachable — its only reader was the scripted dialogue this file no longer has — and
// keeping a dead second list is exactly what let the two vocabularies drift apart in the first
// place. The live `effect` from /api/dialogue is now resolved in one place, config/effects.js,
// and applied to the three.js scene lights by Museum3D#setEffect.

const characters = salonParticipants;

const choices = [
  { id:"perception", label:"Art should teach us to see the world again.", delta:{perception:3,emotion:1,invention:0} },
  { id:"emotion", label:"Art should turn inner experience into a shared language.", delta:{perception:0,emotion:3,invention:1} },
  { id:"invention", label:"Art should create realities that did not exist before.", delta:{perception:1,emotion:0,invention:3} }
];

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

function setStage(stage) {
  // Leaving (or never entering) the transformation clears its timers so a stale
  // scheduled setStage("manifesto") can't hijack a later screen.
  if (stage !== "world_transformation") { transformationTimers.forEach(clearTimeout); transformationTimers = []; state.transformationStart = 0; }
  if (state.stage === "world_exploration" && stage !== "world_exploration") teardownMuseumExperience();
  state.stage = stage;
  document.body.dataset.stage = stage;
  const [number, name, color] = stageMeta[stage];
  document.querySelector("#chapterNumber").textContent = number;
  document.querySelector("#chapterName").textContent = name;
  root.style.setProperty("--stage-accent", color);
  document.querySelector("#discovery").textContent = `DISCOVERY ${String(Math.round((STAGES.indexOf(stage) / (STAGES.length - 1)) * 100)).padStart(2,"0")}%`;
  document.querySelector("#meter").classList.toggle("visible", STAGES.indexOf(stage) >= 5);
  worldAdapter.setVisible(stage === "world_exploration");
  if (stage === "world_exploration") activateWorld("monet");
  if (stage === "threshold") worldAdapter.setVisible(false);
  updateMeter();
  render();
  if (stage === "world_exploration") queueMicrotask(initMuseumExperience);
  // The closing chapter reflects on a walk that has already happened, so it can only be requested
  // once the visitor arrives here — never earlier.
  if (stage === "roundtable") queueMicrotask(requestRoundtable);
  // Entered the transformation without going through choose() (keyboard 6 / ?stage=):
  // self-bootstrap the timeline so it isn't a permanent static dead-end.
  if (stage === "world_transformation" && !state.transformationStart) {
    state.transformationChoice = state.transformationChoice || "perception";
    state.transformationStart = globalThis.performance.now();
    scheduleTransformation();
  }
  updateDebugPanel();
}

async function activateWorld(id) {
  let config = worldAssets[id] || worldAssets.monet;
  try {
    const response = await fetch("/worlds.json", { cache: "no-store" });
    if (response.ok) {
      const runtimeAssets = await response.json();
      config = runtimeAssets[id] || config;
    }
  } catch {
    // Local particle fallback remains the source of truth offline.
  }
  await worldAdapter.load(config);
  worldAdapter.setVisible(state.stage === "world_exploration");
}

function updateMeter() {
  for (const key of ["Perception","Emotion","Invention"]) {
    const value = state.philosophy[key.toLowerCase()];
    document.querySelector(`#meter${key}`).style.width = `${Math.min(100, value * 25)}%`;
  }
}

function render() {
  const views = {
    threshold: thresholdView,
    museum_void: museumVoidView,
    world_selection: worldSelectionView,
    companion_selection: companionSelectionView,
    world_exploration: worldExplorationView,
    summoning: summoningView,
    roundtable: roundtableView,
    decision: decisionView,
    world_transformation: transformationView,
    manifesto: manifestoView
  };
  experience.innerHTML = views[state.stage]();
  bindActions();
}

function thresholdView() {
  return `<section class="scene opening-copy threshold-scene">
    <div class="spatial-coordinate">MEMORY SITE 00 · 40°46′N / 73°58′W</div>
    <div class="threshold-copy">
      <p class="eyebrow">A LIVING ARCHIVE BEYOND TIME</p>
      <h1>The Impossible<br>Museum</h1>
      <p class="lede">Enter a cultural memory where artists disagree—and your answer becomes part of the architecture.</p>
      <div class="action-row"><button class="orb-action" data-action="enter" aria-label="Enter the museum"><span>ENTER</span></button><span class="gesture-hint">MOVE TO LOOK · CLICK TO CROSS</span></div>
    </div>
  </section>`;
}

function museumVoidView() {
  return `<section class="scene void-scene">
    <div class="scene-number">01</div>
    <div class="void-copy"><p class="eyebrow">GEOGRAPHY HAS COLLAPSED</p>
    <h1>The Museum<br>Between Worlds</h1>
    <p class="lede">Parisian light crosses a Mexican courtyard. Classical stone dissolves into an infinite interior. History is no longer a line—it is a place you can enter.</p>
    <div class="action-row"><button class="primary-action" data-action="discover-worlds">FOLLOW THE LIGHT <span>→</span></button></div></div>
  </section>`;
}

const WORLD_TINTS = ["#c6a54a", "#c69f4e", "#b98cc0", "#7fb069", "#79b7b0", "#d98c7a", "#8fa9c9", "#c89ba1", "#6db3c9"];

function worldSelectionView() {
  // Every Marble world we have (config/worlds.js) is an independent, selectable exhibition
  // space — walkable enclosed rooms first, open worlds after.
  const worlds = listWorlds();
  return `<section class="scene">
    <p class="eyebrow">02 / CHOOSE A WORLD</p><h2>Which world will hold your exhibition?</h2>
    <div class="world-grid">${worlds.map((w, i) => `<button class="world-node${w.recommended ? " recommended" : ""}" style="--node-color:${WORLD_TINTS[i % WORLD_TINTS.length]}${w.thumb ? `;--artwork:url('${w.thumb}')` : ""}" data-world="${w.key}"><small>${w.enclosed ? "WALKABLE ROOM" : "OPEN WORLD"}${w.recommended ? " · RECOMMENDED" : ""}</small><b>${w.displayName}</b><em>${w.blurb}</em></button>`).join("")}</div>
  </section>`;
}

function companionSelectionView() {
  const selectable = characters.filter(character => character.portrait);
  return `<section class="scene companion-selection">
    <div class="companion-intro"><p class="eyebrow">03 / INVITE UP TO THREE MINDS</p><h2>Who will walk the museum with you?</h2><p class="lede">Choose real historical portraits with public-domain sources. In the gallery, each becomes an interpretive AI companion—not a clone or authentic quotation.</p></div>
    <div class="companion-grid">${selectable.map(character => `<button class="companion-card ${state.selectedCompanions.has(character.id) ? "selected" : ""}" data-companion="${character.id}" style="--portrait:url('${character.portrait}')"><span class="companion-check">${state.selectedCompanions.has(character.id) ? "✓" : "+"}</span><small>INVITE</small><b>${character.fullName}</b><em>AI interpretation · public-domain portrait</em>${character.turnaround ? `<span class="model-readiness">4-VIEW 3D INPUT READY</span>` : ""}</button>`).join("")}</div>
    <div class="companion-footer"><span id="companionCount">${state.selectedCompanions.size} / 3 SELECTED</span><button class="primary-action" data-action="enter-gallery" ${state.selectedCompanions.size ? "" : "disabled"}>ENTER TOGETHER <span>→</span></button></div>
  </section>`;
}

function worldExplorationView() {
  const companions = selectedCompanionRecords();
  const focused = state.focusedArtwork || state.galleryArtworks[0];
  // A Marble world always loads here (resolveSelectedWorld() falls back to the default), and the
  // full-res splat streams for seconds — so cover the viewport with a dark veil until the world
  // is framed. onWorldReady (or the fallback / 60s safety timeout) dismisses it, avoiding the
  // old jarring flash of the procedural box gallery before the real world swaps in.
  const entering = resolveSelectedWorld();
  return `<section class="scene gallery-scene">
    <div class="gallery-viewport" id="museum3d">
      <div class="world-veil" id="worldVeil"><small>ENTERING WORLD</small><b>${escapeHtml(entering.displayName)}</b><span class="veil-pulse">MATERIALISING SPACE</span></div>
      <div class="gallery-title"><p class="eyebrow">${state.finalWorld ? "10 / THE WORLD YOU ARGUED FOR" : "04 / THE LIVING GALLERY"}</p><h2>${state.finalWorld ? "This is the world your choices built." : "Walk into the collection."}</h2><span>DRAG TO LOOK · W A S D TO WALK · CLICK AN ARTWORK OR A MASTER</span></div>
      <div id="worldStatus" style="position:absolute;top:64px;left:24px;z-index:20;font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.08em;color:#9fe3d0;background:rgba(0,0,0,.5);padding:6px 10px;border-radius:6px;pointer-events:none">WORLD · …</div>
      ${state.finalWorld ? `<div class="manifesto-plaque"><small>YOUR IMPOSSIBLE WORLD</small><b>${escapeHtml(state.finalWorld)}</b></div>` : ""}
      <div class="collection-status"><i></i><span id="collectionStatus">OPEN ACCESS COLLECTION · LOCAL CURATION</span></div>
      <div class="companion-dock" aria-label="Your museum companions">${companions.map(character => `<div class="companion-chip" title="${character.fullName}"><img src="${character.portrait}" alt="${character.fullName}"/><span>${character.name}</span></div>`).join("")}</div>
      <aside class="artwork-inspector" id="artworkInspector">
        <button class="inspector-close" data-action="close-inspector" aria-label="Close artwork details">×</button>
        <img id="focusedArtworkImage" src="${focused.image}" alt="${escapeHtml(focused.title)}" />
        <p id="focusedArtworkMeta">${escapeHtml(focused.artist)} · ${escapeHtml(focused.date)}</p>
        <h3 id="focusedArtworkTitle">${escapeHtml(focused.title)}</h3>
        <a id="focusedArtworkSource" href="${focused.sourceUrl}" target="_blank" rel="noreferrer">VIEW MUSEUM RECORD ↗</a>
      </aside>
      <div class="art-dialogue" id="artDialogue" hidden></div>
      ${state.finalWorld ? `<button class="salon-next" data-action="reset">BEGIN AGAIN <span>→</span></button>` : `<button class="salon-next" data-action="summon">SUMMON THE FULL SALON <span>→</span></button>`}
    </div>
  </section>`;
}

function ringMarkup(coreAction = "open-salon") {
  return `<div class="salon-ring">${characters.map((character,i) => `<div class="character ${state.activeSpeaker===character.id?"active":""} ${character.portrait ? "has-portrait" : ""}" style="--angle:${i*(360/characters.length)}deg;--character-color:${character.color};${character.portrait ? `--portrait:url('${character.portrait}')` : ""}"><span>${character.name}</span></div>`).join("")}<div class="salon-core"><button data-action="${coreAction}">${coreAction === "open-salon" ? "OPEN THE SALON" : "ASK THE IMPOSSIBLE"}</button></div></div>`;
}

function summoningView() {
  return `<section class="scene salon"><p class="eyebrow">05 / SEVEN MINDS. ONE EMPTY SEAT.</p><h2>The Salon Outside Time</h2>${ringMarkup("open-salon")}<p class="lede">Historical figures are represented as AI interpretations grounded in documented themes—not authentic quotations or endorsements.</p></section>`;
}

// The roundtable used to be three preset questions the visitor clicked BEFORE seeing anything, and
// a canned four-turn script behind each one. It is now the closing chapter: the masters read back
// the walk that actually happened, and that same synthesis names the world in Act 5.
function roundtableView() {
  const { status, data, error } = state.roundtable;
  const heading = status === "ready" ? escapeHtml(data.worldTitle) : "The masters read back your walk";
  return `<section class="scene salon roundtable-scene">
    <p class="eyebrow">06 / THE CLOSING ROUNDTABLE</p>
    <h2>${heading}</h2>
    <div class="roundtable-body">
      <p class="roundtable-trail">${walkTrailMarkup()}</p>
      ${roundtableBodyMarkup(status, data, error)}
    </div>
    <div class="action-row" style="justify-content:center">
      <button class="primary-action" data-action="face-contradiction">FACE THE CONTRADICTION <span>→</span></button>
      ${status === "error" ? `<button class="ghost-action" data-action="retry-roundtable">TRY AGAIN</button>` : ""}
    </div>
  </section>`;
}

/** The visitor's own trajectory, stated on screen — so a synthesis that ignores it is visible. */
function walkTrailMarkup() {
  const { visitedArtworks, askedQuestions } = state.session;
  if (!visitedArtworks.length && !askedQuestions.length) {
    return "You walked through without stopping at a work or asking anything aloud.";
  }
  const stops = visitedArtworks.length
    ? `You stopped at ${visitedArtworks.map(item => escapeHtml(item.title)).join(" · ")}.`
    : "You stopped at no particular work.";
  const asks = askedQuestions.length
    ? ` You asked: ${askedQuestions.map(item => `“${escapeHtml(item)}”`).join(" ")}`
    : " You asked nothing aloud.";
  return `${stops}${asks}`;
}

function roundtableBodyMarkup(status, data, error) {
  if (status === "loading") return `<p class="roundtable-status">THE SALON IS READING YOUR WALK…</p>`;
  if (status === "error") {
    return `<p class="roundtable-status is-error">THE ROUNDTABLE COULD NOT BE REACHED — ${escapeHtml(error)}</p>`;
  }
  if (status !== "ready") return "";
  const notice = data.live === true
    ? ""
    : `<p class="roundtable-status is-error">${escapeHtml(data.warning || "LOCAL FALLBACK — this closing was not produced by a live model.")}</p>`;
  // Each thread carries its own disclaimer rather than one shared caption: the compliance claim is
  // about each attributed voice, so it travels with each voice.
  const threads = (data.threads || []).map(thread => `<article class="roundtable-thread">
    <b>${escapeHtml(thread.speaker)}</b>
    <p>${escapeHtml(thread.text)}</p>
    <small class="ai-disclaimer" data-disclaimer="true">${AI_INTERPRETATION_DISCLAIMER}</small>
  </article>`).join("");
  return `${notice}<div class="roundtable-threads">${threads}</div><blockquote class="roundtable-synthesis">${escapeHtml(data.synthesis)}</blockquote>`;
}

function decisionView() {
  return `<section class="scene"><p class="eyebrow">07 / SOCRATES ASKS YOU</p><h2>If art can alter reality, what responsibility should it carry?</h2><div class="choice-grid">${choices.map((choice,i)=>`<button class="choice" data-choice="${choice.id}"><small>0${i+1}</small><span>${choice.label}</span></button>`).join("")}</div></section>`;
}

function transformationView() {
  return `<section class="scene transformation"><p class="eyebrow">08 / YOUR ANSWER HAS ENTERED THE WORLD</p><div class="transformation-mark"></div><h1>The museum is<br>rewriting itself.</h1><p class="lede transformation-copy" id="transformationCopy">Sound falls away. Your chosen idea enters the salon ring.</p></section>`;
}

// The two philosophy axes the visitor leaned into, sorted and joined. This single key drives
// the manifesto title, the world they walk into, and the collection hung on its walls.
function philosophyKey() {
  const ranking = Object.entries(state.philosophy).sort((a,b)=>b[1]-a[1]).map(([key])=>key);
  return ranking.slice(0,2).sort().join("+");
}

function finalWorldKey() {
  return PHILOSOPHY_WORLDS[philosophyKey()] || DEFAULT_WORLD_KEY;
}

// The generic ending. It used to be one of four hardcoded pairs chosen by philosophy key, which
// meant two visitors who walked completely different galleries read the identical closing sentence.
// It survives only as the failure branch, and the manifesto labels it as one when it fires.
const FALLBACK_ENDING = {
  title: "The World Between Worlds",
  copy: "You believe art must balance perception, emotion and invention without allowing any one truth to become final."
};

/** Act 5's ending is the closing roundtable's synthesis of the walk the visitor actually took. */
function finalWorldData() {
  const roundtable = state.roundtable.status === "ready" ? state.roundtable.data : null;
  const title = String(roundtable?.worldTitle || "").trim();
  const copy = String(roundtable?.synthesis || "").trim();
  if (!title || !copy) return { ...FALLBACK_ENDING, source: "fallback", live: false };
  return { title, copy, source: "roundtable", live: roundtable.live === true };
}

function endingNoticeMarkup(ending) {
  if (ending.source === "fallback") {
    return `<p class="ending-notice">GENERIC ENDING — the closing roundtable never completed, so this world was not synthesised from your walk.</p>`;
  }
  if (!ending.live) return `<p class="ending-notice">LOCAL FALLBACK — no live model produced this synthesis.</p>`;
  return "";
}

function manifestoView() {
  const ending = finalWorldData();
  state.finalWorld = ending.title;
  return `<section class="scene manifesto"><div class="manifesto-card"><p class="eyebrow">YOUR IMPOSSIBLE WORLD</p><h2>${escapeHtml(ending.title)}</h2><p class="manifesto-copy">${escapeHtml(ending.copy)}</p>${endingNoticeMarkup(ending)}<div class="score-row">${Object.entries(state.philosophy).map(([key,value])=>`<span>${key.toUpperCase()}<b>${String(value).padStart(2,"0")}</b></span>`).join("")}</div><div class="action-row" style="justify-content:center"><button class="primary-action" data-action="enter-final-world">ENTER YOUR WORLD <span>→</span></button><button class="ghost-action" data-action="reset">ENTER AGAIN</button></div></div></section>`;
}

function bindActions() {
  experience.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", () => act(button.dataset.action)));
  experience.querySelectorAll("[data-world]").forEach(button => button.addEventListener("click", () => {
    state.selectedPortal = button.dataset.world;
    setStage("companion_selection");
  }));
  experience.querySelectorAll("[data-companion]").forEach(button => button.addEventListener("click", () => {
    const id = button.dataset.companion;
    if (state.selectedCompanions.has(id)) state.selectedCompanions.delete(id);
    else if (state.selectedCompanions.size < 3) state.selectedCompanions.add(id);
    button.classList.toggle("selected", state.selectedCompanions.has(id));
    button.querySelector(".companion-check").textContent = state.selectedCompanions.has(id) ? "✓" : "+";
    const count = document.querySelector("#companionCount");
    if (count) count.textContent = `${state.selectedCompanions.size} / 3 SELECTED`;
    const enter = experience.querySelector("[data-action='enter-gallery']");
    if (enter) enter.disabled = state.selectedCompanions.size === 0;
  }));
  experience.querySelectorAll("[data-memory]").forEach(button => button.addEventListener("click", () => {
    state.memories.add(button.dataset.memory);
    button.style.opacity = ".42";
    button.querySelector("small").textContent = "Memory absorbed into the world.";
    burst(innerWidth * .72, innerHeight * .5, "#9cd0c7", 44);
  }));
  experience.querySelectorAll("[data-choice]").forEach(button => button.addEventListener("click", () => choose(button.dataset.choice)));
}

function act(action) {
  const actions = {
    enter: () => setStage("museum_void"),
    "discover-worlds": () => setStage("world_selection"),
    "enter-gallery": () => setStage("world_exploration"),
    // The finale: the philosophy the visitor argued for picks the world, and re-entering
    // world_exploration now rebuilds it with philosophy scored and state.finalWorld set.
    "enter-final-world": () => { state.selectedPortal = finalWorldKey(); setStage("world_exploration"); },
    "close-inspector": () => document.querySelector("#artworkInspector")?.classList.remove("visible"),
    "close-art-dialogue": closeArtDialogue,
    summon: () => setStage("summoning"),
    "open-salon": () => setStage("roundtable"),
    "face-contradiction": () => { state.activeSpeaker = null; setStage("decision"); },
    "retry-roundtable": requestRoundtable,
    reset,
    "toggle-audio": toggleAudio,
    "toggle-performance": togglePerformance
  };
  actions[action]?.();
}

function selectedCompanionRecords() {
  return characters.filter(character => state.selectedCompanions.has(character.id));
}

// Resolve the world to load: the card the visitor picked (state.selectedPortal holds the
// world key), with optional URL overrides — ?world=<key> and ?render=mesh|splat — for A/B.
function resolveSelectedWorld() {
  const params = new URLSearchParams(location.search);
  let world = getWorld(params.get("world") || state.selectedPortal || DEFAULT_WORLD_KEY);
  const render = params.get("render");
  if (render === "mesh" || render === "splat") world = { ...world, render };
  const wscale = parseFloat(params.get("wscale")); // live immersion-scale tuning knob
  if (Number.isFinite(wscale) && wscale > 0) world = { ...world, worldScale: wscale };
  return world;
}

// The world-entry veil (worldExplorationView) is dismissed exactly once per mount: when the
// Marble world is framed, when it falls back to the box gallery, or by the safety timeout.
let worldVeilTimer = null;
function dismissWorldVeil() {
  if (worldVeilTimer) { clearTimeout(worldVeilTimer); worldVeilTimer = null; }
  const veil = document.querySelector("#worldVeil");
  if (!veil || veil.classList.contains("done")) return;
  veil.classList.add("done"); // CSS fades opacity over ~0.9s, then we remove it from the layout
  setTimeout(() => { veil.hidden = true; }, 1000);
}

async function initMuseumExperience() {
  const container = document.querySelector("#museum3d");
  if (!container || state.stage !== "world_exploration") return;
  teardownMuseumExperience();
  const activeWorld = resolveSelectedWorld();
  const setWorldStatus = (text) => { const el = document.querySelector("#worldStatus"); if (el) el.textContent = text; };
  museum3D = new Museum3D({
    container,
    artworks: state.galleryArtworks,
    companions: selectedCompanionRecords(),
    onArtworkFocus: focusArtwork,
    onCompanionSelect: selectCompanion,
    onReady: () => container.classList.add("ready"),
    onWorldReady: ({ key, render }) => { setWorldStatus(`${key} · ${render} · READY`); dismissWorldVeil(); },
    world: activeWorld
  });
  museum3D.mount();
  setWorldStatus(`${activeWorld.key} · ${activeWorld.render || (activeWorld.meshUrl ? "mesh" : "splat")} · LOADING…`);
  // Safety net: a stalled world load (network, decode) must never trap the live demo behind the
  // veil. onWorldReady clears this timer on a normal (or fallback) reveal.
  worldVeilTimer = setTimeout(dismissWorldVeil, 60000);

  const collectionStatus = document.querySelector("#collectionStatus");
  try {
    // Pre-choice this resolves to the default ending's artist; after the manifesto the
    // visitor's own philosophy picks the collection that hangs in their world.
    const liveArtworks = await loadOpenAccessArtworks(PHILOSOPHY_QUERIES[philosophyKey()] || "Claude Monet");
    if (state.stage !== "world_exploration" || !liveArtworks.length) return;
    state.galleryArtworks = liveArtworks;
    museum3D?.buildGallery(liveArtworks);
    if (collectionStatus) collectionStatus.textContent = `ART INSTITUTE OF CHICAGO · ${liveArtworks.length} OPEN ACCESS WORKS`;
  } catch {
    if (collectionStatus) collectionStatus.textContent = `OPEN ACCESS COLLECTION · ${state.galleryArtworks.length} CACHED WORKS`;
  }
}

function focusArtwork(artwork) {
  state.focusedArtwork = artwork;
  // What the visitor actually walked past is the only ground the closing roundtable stands on.
  state.session = recordVisitedArtwork(state.session, artwork);
  const inspector = document.querySelector("#artworkInspector");
  const image = document.querySelector("#focusedArtworkImage");
  const meta = document.querySelector("#focusedArtworkMeta");
  const title = document.querySelector("#focusedArtworkTitle");
  const source = document.querySelector("#focusedArtworkSource");
  if (image) { image.src = artwork.image; image.alt = `${artwork.title} by ${artwork.artist}`; }
  if (meta) meta.textContent = `${artwork.artist} · ${artwork.date}`;
  if (title) title.textContent = artwork.title;
  if (source) source.href = artwork.sourceUrl;
  inspector?.classList.add("visible");
  // Act4: clicking an artwork opens a game-style dialogue — a companion speaks about
  // THIS work (scripted per-master lines, demo-safe), the visitor answers, and the
  // answer feeds the same philosophy meter that builds the final world. A live
  // /api/dialogue reply enriches the popup asynchronously when available.
  openArtDialogue(artwork);
}

function pickOpeningSpeaker() {
  const pool = selectedCompanionRecords();
  if (!pool.length) return characters[0];
  return pool[artDialogueTurn++ % pool.length];
}

const AI_INTERPRETATION_DISCLAIMER = "AI INTERPRETATION — NOT AN AUTHENTIC QUOTATION";

/**
 * Clicking a master in the 3D gallery. The conversation dock this used to aim at is gone —
 * the popup is now the single dialogue surface — so the click opens the same game-style
 * popup in ASK mode, aimed at the work currently in focus. The prompt stays truthfully
 * addressed to the group: one question returns three parallel readings, so clicking Monet
 * does not start a private conversation with Monet.
 */
function selectCompanion(companion) {
  if (!companion) return;
  openAskDialogue(companion);
}

function pickReactionSpeaker(axis, openerId) {
  const pool = selectedCompanionRecords();
  const champion = (AXIS_CHAMPIONS[axis] || []).map(id => pool.find(c => c.id === id)).find(c => c && c.id !== openerId);
  return champion || pool.find(c => c.id !== openerId) || pool[0] || characters[0];
}

function artDialogueMarkup(speaker, { choices = true } = {}) {
  return `<button class="art-dialogue-close" data-action="close-art-dialogue" aria-label="Close dialogue">×</button>
    <div class="art-dialogue-head" style="--speaker-color:${speaker.color}">${speaker.portrait ? `<img src="${speaker.portrait}" alt="${escapeHtml(speaker.fullName)}"/>` : ""}<div><small>SPEAKS TO YOU</small><b>${escapeHtml(speaker.fullName)}</b></div></div>
    <p class="art-dialogue-line" id="artDialogueLine"></p>
    <div class="art-dialogue-live" id="artDialogueLive"></div>
    ${choices
      ? `<div class="art-dialogue-choices">${artworkChoices.map((choice, i) => `<button class="art-choice" data-art-choice="${choice.id}" style="--speaker-color:${speaker.color}"><small>0${i + 1}</small><span>${choice.label}</span></button>`).join("")}</div>`
      : `<div class="art-dialogue-choices"><button class="art-choice art-continue" data-action="close-art-dialogue"><span>CONTINUE THE WALK →</span></button></div>`}
    <span class="art-dialogue-disclaimer">${DIALOGUE_DISCLAIMER}</span>`;
}

function openArtDialogue(artwork) {
  const host = document.querySelector("#artDialogue");
  if (!host) return;
  const token = ++dialogueToken;
  const speaker = pickOpeningSpeaker();
  host.hidden = false;
  host.innerHTML = artDialogueMarkup(speaker, { choices: true });
  bindArtDialogue(host, artwork, speaker);
  typewrite(formatLine(voiceFor(speaker.id).opening, artwork));
  fetchLivePerspectives(`Tell me how you see "${artwork.title}".`, artwork, token);
}

/**
 * ASK mode of the same popup: clicking a master opens it with a question input instead of the
 * scripted three answers. The typed question is recorded into the session digest (it feeds the
 * closing roundtable); the machine-generated artwork question above deliberately is not.
 */
function openAskDialogue(companion) {
  const host = document.querySelector("#artDialogue");
  if (!host) return;
  const token = ++dialogueToken;
  const artwork = state.focusedArtwork || state.galleryArtworks[0];
  host.hidden = false;
  host.innerHTML = askDialogueMarkup(companion, artwork);
  host.querySelectorAll("[data-action='close-art-dialogue']").forEach(button => button.addEventListener("click", closeArtDialogue));
  const name = companion.fullName || companion.name || "your companion";
  typewrite(artwork
    ? `${name} turns toward ${artwork.title}. Ask, and all three masters answer in their own voice.`
    : `${name} turns toward you. Ask, and all three masters answer in their own voice.`);
  const input = document.querySelector("#artAskInput");
  if (input && artwork) { input.value = `What do you see in ${artwork.title}?`; input.focus(); input.select?.(); }
  document.querySelector("#artAskForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const question = input?.value.trim();
    if (!question) return;
    state.session = recordAskedQuestion(state.session, question);
    renderLiveNotice("THE MASTERS ARE READING YOUR QUESTION…");
    fetchLivePerspectives(question, artwork, token);
    if (input) input.value = "";
  });
}

function askDialogueMarkup(companion, artwork) {
  return `<button class="art-dialogue-close" data-action="close-art-dialogue" aria-label="Close dialogue">×</button>
    <div class="art-dialogue-head" style="--speaker-color:${companion.color}">${companion.portrait ? `<img src="${companion.portrait}" alt="${escapeHtml(companion.fullName)}"/>` : ""}<div><small>ASK — ALL THREE MASTERS ANSWER</small><b>${escapeHtml(companion.fullName)}</b></div></div>
    <p class="art-dialogue-line" id="artDialogueLine"></p>
    <div class="art-dialogue-live" id="artDialogueLive"></div>
    <form class="art-ask-form" id="artAskForm"><input id="artAskInput" autocomplete="off" placeholder="${escapeHtml(artwork ? `Ask about ${artwork.title}…` : "Ask the masters…")}" aria-label="Question for the masters"/><button>ASK</button></form>
    <span class="art-dialogue-disclaimer">${DIALOGUE_DISCLAIMER}</span>`;
}

function bindArtDialogue(host, artwork, opener) {
  host.querySelectorAll("[data-action='close-art-dialogue']").forEach(button => button.addEventListener("click", closeArtDialogue));
  host.querySelectorAll("[data-art-choice]").forEach(button => button.addEventListener("click", () => onArtChoice(artwork, opener, button.dataset.artChoice)));
}

function onArtChoice(artwork, opener, choiceId) {
  const choice = artworkChoices.find(({ id }) => id === choiceId);
  if (!choice) return;
  for (const key of Object.keys(state.philosophy)) state.philosophy[key] += choice.delta[key] || 0;
  updateMeter();
  const speaker = pickReactionSpeaker(choiceId, opener.id);
  burst(innerWidth * .5, innerHeight * .62, speaker.color, 40);
  const host = document.querySelector("#artDialogue");
  if (!host) return;
  const liveContent = document.querySelector("#artDialogueLive")?.innerHTML || "";
  host.innerHTML = artDialogueMarkup(speaker, { choices: false });
  const liveSlot = document.querySelector("#artDialogueLive");
  if (liveSlot) liveSlot.innerHTML = liveContent;
  bindArtDialogue(host, artwork, speaker);
  typewrite(voiceFor(speaker.id).reactions[choiceId] || "");
}

function renderLiveNotice(message) {
  const liveSlot = document.querySelector("#artDialogueLive");
  if (liveSlot) liveSlot.innerHTML = `<b>SYSTEM</b> ${escapeHtml(message)}`;
}

/**
 * Renders the three live readings into the popup's live slot. Each perspective is recorded into
 * the session digest (it grounds the closing roundtable), re-lights the room via its `effect`
 * (last rendered voice wins), and carries its own per-voice disclaimer.
 */
function renderPerspectives(reply) {
  const liveSlot = document.querySelector("#artDialogueLive");
  if (!liveSlot) return;
  const badge = reply.live === true ? " · LIVE" : " · LOCAL";
  liveSlot.innerHTML = (reply.perspectives || []).map(perspective => {
    state.session = recordPerspective(state.session, perspective);
    museum3D?.setEffect(perspective.effect);
    return `<div class="live-perspective"><b>${escapeHtml(perspective.speaker || "MUSE")}${badge}</b> ${escapeHtml(perspective.text)}<small class="ai-disclaimer">${AI_INTERPRETATION_DISCLAIMER}</small></div>`;
  }).join("");
}

/**
 * One question, three parallel readings (/api/dialogue contract from feat/master-roundtable).
 * The scripted popup content is the primary experience; a failed live call is reported in the
 * live slot honestly instead of pretending nothing was asked.
 */
async function fetchLivePerspectives(question, artwork, token) {
  try {
    const response = await fetch("/api/dialogue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question,
        companions: selectedCompanionRecords().map(({ id, fullName }) => ({ id, name: fullName })),
        artwork: artwork ? { title: artwork.title, artist: artwork.artist, date: artwork.date } : null
      })
    });
    const reply = await response.json().catch(() => null);
    if (token !== dialogueToken) return; // popup was closed or reopened meanwhile
    if (!response.ok || !Array.isArray(reply?.perspectives)) {
      renderLiveNotice(reply?.warning || reply?.error || `The live readings could not be reached (HTTP ${response.status}).`);
      return;
    }
    renderPerspectives(reply);
  } catch (error) {
    if (token === dialogueToken) renderLiveNotice(`The live readings could not be reached — ${error.message}`);
  }
}

function typewrite(text) {
  if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; }
  const node = document.querySelector("#artDialogueLine");
  if (!node) return;
  let shown = 0;
  node.textContent = "";
  typewriterTimer = setInterval(() => {
    shown = Math.min(text.length, shown + 2);
    node.textContent = text.slice(0, shown);
    if (shown >= text.length) { clearInterval(typewriterTimer); typewriterTimer = null; }
  }, 24);
  node.addEventListener("click", () => {
    if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; }
    node.textContent = text;
  }, { once: true });
}

function closeArtDialogue() {
  if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; }
  dialogueToken += 1; // invalidate any in-flight live fetch
  const host = document.querySelector("#artDialogue");
  if (host) { host.hidden = true; host.innerHTML = ""; }
}

function teardownMuseumExperience() {
  museum3D?.dispose();
  museum3D = null;
  closeArtDialogue();
  if (worldVeilTimer) { clearTimeout(worldVeilTimer); worldVeilTimer = null; }
}

/**
 * Asks the closing roundtable to synthesise the walk. The digest is already capped at construction
 * (SESSION_CAPS); the server re-clamps it, because a client cap is a product decision and not a
 * boundary. Renders in place rather than through setStage — the stage has not changed.
 */
async function requestRoundtable() {
  state.roundtable = { status: "loading", data: null, error: null };
  renderRoundtable();
  try {
    const response = await fetch("/api/roundtable", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        session: state.session,
        companions: selectedCompanionRecords().map(({ id, fullName }) => ({ id, name: fullName }))
      })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.warning || payload?.error || `HTTP ${response.status}`);
    if (!payload || !Array.isArray(payload.threads)) throw new Error("The roundtable response carried no threads.");
    state.roundtable = { status: "ready", data: payload, error: null };
  } catch (error) {
    // No canned closing behind a failure — the visitor is told the salon did not answer.
    state.roundtable = { status: "error", data: null, error: error.message };
  }
  renderRoundtable();
}

function renderRoundtable() {
  if (state.stage !== "roundtable") return;
  experience.innerHTML = roundtableView();
  bindActions();
}

function choose(id) {
  const choice = choices.find(item => item.id === id);
  for (const key of Object.keys(state.philosophy)) state.philosophy[key] += choice.delta[key];
  updateMeter();
  particleMode = id === "invention" ? "fracture" : id === "emotion" ? "turbulence" : "mist";
  state.transformationChoice = id;
  state.transformationStart = globalThis.performance.now();
  setStage("world_transformation");
  burst(innerWidth/2, innerHeight/2, stageMeta.world_transformation[2], performanceController.config().particles * .18);
  scheduleTransformation();
}

let transformationTimers = [];
function scheduleTransformation() {
  transformationTimers.forEach(clearTimeout);
  const duration = state.demoMode ? 7600 : 12000;
  const write = (ratio, text) => transformationTimers.push(setTimeout(() => {
    const node = document.querySelector("#transformationCopy");
    if (node) node.textContent = text;
  }, duration * ratio));
  write(.20, "The active perspective expands. Character memories leave their seats.");
  write(.46, "Architecture dissolves. A second artistic system passes through the darkness.");
  write(.73, "Particles reassemble around the philosophy you chose.");
  transformationTimers.push(setTimeout(() => setStage("manifesto"), duration));
}

function reset() {
  transformationTimers.forEach(clearTimeout);
  teardownMuseumExperience();
  // `session` and `roundtable` MUST be cleared here. This function enumerates state keys explicitly
  // and has always omitted some (`memories`), which meant a second run inherited the first run's
  // data — now also cleared. A judge who watches two runs would otherwise see run one's walk
  // synthesised as run two's ending.
  Object.assign(state, { stage:"threshold", selectedPortal:null, activeSpeaker:null, session:emptySession(), roundtable:emptyRoundtable(), memories:new Set(), philosophy:{perception:0,emotion:0,invention:0}, finalWorld:null, transformationStart:0, transformationChoice:null, selectedCompanions:new Set(["monet","van_gogh","socrates"]), galleryArtworks:[...museumArtworks], focusedArtwork:museumArtworks[0] });
  particleMode = "threshold";
  setStage("threshold");
}

function togglePerformance() {
  state.performanceMode = performanceController.toggle();
  updatePerformanceLabel();
}

function updatePerformanceLabel() {
  const label = document.querySelector("#performanceLabel");
  if (label) label.textContent = performanceController.mode.toUpperCase();
}

function updateDebugPanel() {
  const canDebug = ["localhost", "127.0.0.1"].includes(location.hostname) && !state.demoMode;
  if (!canDebug || debugPanel.hidden) return;
  debugPanel.innerHTML = `<strong>MUSE∞ VISUAL DEBUG</strong><br>stage: ${state.stage}<br>effect: ${particleMode}<br>speaker: ${state.activeSpeaker || "none"}<br>particles: ${particles.length}<br>quality: ${performanceController.resolved}<br>world: ${state.worldLoadState}<br><button data-debug-effect="mist">MONET</button><button data-debug-effect="fracture">PICASSO</button><button data-debug-effect="infinity">HILMA</button><button data-debug-effect="turbulence">VAN GOGH</button><button data-debug-effect="garden">FRIDA</button><button data-debug-effect="void">SOCRATES</button><button data-debug-effect="network">NETWORK</button>`;
  debugPanel.querySelectorAll("[data-debug-effect]").forEach(button => button.addEventListener("click", () => {
    particleMode = button.dataset.debugEffect;
    updateDebugPanel();
  }));
}

function toggleAudio() {
  state.audioEnabled = !state.audioEnabled;
  document.querySelector("#audioIcon").textContent = state.audioEnabled ? "◉" : "◌";
  if (state.audioEnabled) tone();
}

function tone() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const audio = new AudioContext();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sine"; osc.frequency.value = 92;
  gain.gain.setValueAtTime(.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(.035, audio.currentTime+.08);
  gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime+1.2);
  osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime+1.3);
}

// A deterministic, dependency-free point-world renderer. It acts as the visual
// effect mapper: narrative state chooses a constrained mode; particles render it.
let width = 0, height = 0, dpr = 1, time = 0, particleMode = "threshold";
let transformationProgress = 0;
let audioReactive = { amplitude:0, low:0, mid:0, high:0 };
const pointer = { x:innerWidth*.5, y:innerHeight*.5 };
let particles = [];
const memoryWorld = createMemoryWorld();
const camera = { z:-4.4, targetZ:-4.4, x:0, y:.15 };

const fract = value => value - Math.floor(value);
const seeded = (index, offset = 0) => fract(Math.sin(index * 12.9898 + offset * 78.233) * 43758.5453);
function createParticle(index) {
  return {
    seed:index * 12.9898,
    x:seeded(index,1), y:seeded(index,2), z:seeded(index,3),
    vx:0, vy:0, life:1, burst:false, color:null
  };
}

function syncParticlePool() {
  const target = performanceController.config().particles;
  if (particles.length < target) {
    for (let i=particles.length;i<target;i+=1) particles.push(createParticle(i));
  } else if (particles.length > target) particles.length = target;
}

function resize() {
  dpr = Math.min(devicePixelRatio || 1, performanceController.config().dpr);
  width = innerWidth; height = innerHeight;
  canvas.width = width*dpr; canvas.height = height*dpr;
  canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
  ctx.setTransform(dpr,0,0,dpr,0,0);
}

function burst(x,y,color,count) {
  for (let i=0;i<Math.min(count,particles.length);i++) {
    const p = particles[i]; const angle = seeded(i,9)*Math.PI*2; const speed = 1+seeded(i,10)*5;
    p.x=x/width; p.y=y/height; p.vx=Math.cos(angle)*speed; p.vy=Math.sin(angle)*speed; p.life=1; p.burst=true; p.color=color;
  }
}

function stageMode() {
  if (state.stage === "world_transformation") return particleMode;
  if (state.stage === "world_exploration") return "mist";
  if (["summoning","roundtable","decision"].includes(state.stage)) return particleMode === "threshold" ? "salon" : particleMode;
  return state.stage;
}

function renderWorld(now) {
  performanceController.frame(now);
  time = now * .00035;
  audioReactive = audioSignal.sample(time, Boolean(state.activeSpeaker));
  transformationProgress = state.stage === "world_transformation" && state.transformationStart
    ? Math.min(1, (now - state.transformationStart) / (state.demoMode ? 7600 : 12000)) : 0;
  const mode = stageMode();
  const backgrounds = {
    threshold:[8,6,10], museum_void:[7,5,11], world_selection:[5,9,12], mist:[5,14,15],
    salon:[9,5,13], void:[3,3,6], fracture:[17,5,12], infinity:[10,5,19], turbulence:[11,8,17], network:[4,12,18], garden:[14,7,11]
  };
  const bg = backgrounds[mode] || backgrounds.salon;
  const gradient = ctx.createRadialGradient(width*.5,height*.48,0,width*.5,height*.48,Math.max(width,height)*.72);
  gradient.addColorStop(0,`rgb(${bg[0]+8},${bg[1]+6},${bg[2]+8})`); gradient.addColorStop(1,`rgb(${bg.join(",")})`);
  ctx.fillStyle=gradient; ctx.fillRect(0,0,width,height);

  drawCinematicAtmosphere(mode);

  ctx.globalCompositeOperation="lighter";
  for (let i=0;i<particles.length;i++) drawParticle(particles[i],i,mode);
  drawMemoryArchitecture(mode);
  ctx.globalCompositeOperation="source-over";

  if (["salon","void","fracture","infinity","turbulence","network","garden"].includes(mode)) drawSalonGeometry(mode);
  drawVignette();
  requestAnimationFrame(renderWorld);
}

function drawParticle(p,i,mode) {
  if (p.burst) {
    p.x += p.vx/width; p.y += p.vy/height; p.vx*=.985; p.vy*=.985; p.life-=.012;
    if (p.life<=0) { p.burst=false; p.x=seeded(i,12); p.y=seeded(i,13); p.life=1; p.color=null; }
  }
  const noise = Math.sin(p.seed + time*(1+(i%7)*.04));
  let x=p.x*width, y=p.y*height, alpha=.035+(p.z*.13), size=.25+p.z*.82;
  const dx=pointer.x-x, dy=pointer.y-y, dist=Math.hypot(dx,dy);
  if (dist<160) { x-=dx*(1-dist/160)*.08; y-=dy*(1-dist/160)*.08; }

  if (mode==="threshold") { x += Math.sin(time+p.seed)*14; y += noise*8; }
  if (mode==="museum_void") { x = width*.5 + (p.x-.5)*width*(.25+p.z) + Math.sin(time+p.seed)*35; y += Math.cos(time*.7+p.seed)*24; }
  if (mode==="world_selection") { const col=i%5; x=(col+.5)*width/5 + (p.x-.5)*width/7; y=height*.5+(p.y-.5)*height*.7; }
  if (mode==="mist") { x += Math.sin(time*.55+p.y*8)*65; y += Math.cos(time*.45+p.x*7)*12; alpha*=.7; size*=1.35; }
  if (["salon","void","fracture","infinity","turbulence","network","garden"].includes(mode)) {
    const angle=p.x*Math.PI*2+time*(mode==="turbulence"?1.6:.12);
    let radius=(.18+p.y*.3)*Math.min(width,height);
    if (mode==="void") radius*=1.35;
    if (mode==="fracture") radius += (i%3-1)*55*Math.sin(time*2+p.seed);
    if (mode==="infinity") radius=(.08+(i%9)*.045)*Math.min(width,height);
    if (mode==="garden") y=height*.82-p.y*height*.55+Math.sin(p.seed+time)*14;
    else { x=width*.5+Math.cos(angle)*radius; y=height*.51+Math.sin(angle)*radius*.56; }
  }
  if (["threshold","museum_void","world_selection"].includes(mode)) alpha *= .24;
  if (state.activeSpeaker && ["salon","void","fracture","infinity","turbulence","network","garden"].includes(mode) && i % 4 === 0) {
    const anchor = characterAnchor(state.activeSpeaker);
    const local = i % 210;
    const theta = local * 2.399;
    const headRadius = local < 125 ? 12 + Math.sqrt(local) * 2.15 : 25 + (local-125) * .62;
    const targetX = anchor.x + Math.cos(theta) * headRadius * (local < 125 ? .72 : 1.35);
    const targetY = anchor.y + (local < 125 ? Math.sin(theta) * headRadius : 24 + Math.sin(theta) * 17);
    const materialize = Math.min(.92, .68 + audioReactive.amplitude);
    x += (targetX-x)*materialize;
    y += (targetY-y)*materialize;
    alpha = Math.min(.88, alpha + .24 + audioReactive.mid*.5);
    size += audioReactive.high * 2.2;
  }

  if (state.stage === "world_transformation") {
    const progress = transformationProgress;
    const chaos = Math.sin(progress*Math.PI) * (70 + audioReactive.low*90);
    x += Math.sin(p.seed*2 + time*8) * chaos;
    y += Math.cos(p.seed + time*6) * chaos*.45;
    if (progress > .36) {
      const blend = Math.min(1,(progress-.36)/.64);
      const final = finalParticleTarget(p,i,state.transformationChoice);
      const eased = blend*blend*(3-2*blend);
      x += (final.x-x)*eased;
      y += (final.y-y)*eased;
      alpha += eased*.18;
      size += eased*p.z*1.5;
    }
  }
  const palette = mode==="mist"?[125,190,182]:mode==="fracture"?[196,77,96]:mode==="turbulence"?[109,139,211]:mode==="garden"?[164,73,94]:mode==="network"?[90,160,190]:[205,184,153];
  const activeColor = characters.find(({ id })=>id===state.activeSpeaker)?.color;
  ctx.fillStyle=(state.activeSpeaker && i%4===0 ? activeColor : p.color) || `rgba(${palette.join(",")},${Math.max(0,alpha*p.life)})`;
  ctx.beginPath(); ctx.arc(x,y,size,0,Math.PI*2); ctx.fill();
}

function characterAnchor(speaker) {
  const index = Math.max(0, characters.findIndex(({ id })=>id===speaker));
  const angle = index * Math.PI*2/7 - Math.PI/2;
  const radius = Math.min(width,height)*.24;
  return { x:width*.5+Math.cos(angle)*radius, y:height*.51+Math.sin(angle)*radius*.56 };
}

function finalParticleTarget(p,i,choice) {
  if (choice === "perception") {
    return { x:p.x*width, y:height*(.35+p.y*.38)+Math.sin(p.x*11+time)*42 };
  }
  if (choice === "emotion") {
    const angle=p.x*Math.PI*5+time*.25; const radius=(.06+p.y*.38)*Math.min(width,height);
    return { x:width*.5+Math.cos(angle)*radius, y:height*.53+Math.sin(angle)*radius*.58 };
  }
  const columns=18, row=Math.floor(i/columns)%13, column=i%columns;
  return { x:width*.18+column*(width*.64/(columns-1))+Math.sin(row+time)*10, y:height*.24+row*(height*.52/12)+Math.cos(column+time)*8 };
}

function drawSalonGeometry(mode) {
  const radius=Math.min(width,height)*.25;
  ctx.save(); ctx.translate(width/2,height*.51); ctx.strokeStyle=mode==="fracture"?"rgba(197,80,104,.2)":"rgba(232,222,204,.09)"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.ellipse(0,0,radius,radius*.56,0,0,Math.PI*2); ctx.stroke();
  if (mode==="fracture") {
    for(let i=0;i<7;i++){ctx.rotate(.67);ctx.beginPath();ctx.moveTo(-radius*.9,Math.sin(time+i)*28);ctx.lineTo(radius*.9,Math.cos(time*1.7+i)*45);ctx.stroke();}
  }
  if (mode==="network") {
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*radius,Math.sin(a)*radius*.56);ctx.stroke();}
  }
  ctx.restore();
}

function drawCinematicAtmosphere(mode) {
  const exposure = mode === "threshold" ? .72 : mode === "museum_void" ? .9 : .55;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const light = ctx.createRadialGradient(width*.52,height*.43,0,width*.52,height*.43,Math.min(width,height)*.52);
  light.addColorStop(0,`rgba(72,122,117,${.12*exposure})`);
  light.addColorStop(.4,`rgba(67,49,75,${.09*exposure})`);
  light.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=light; ctx.fillRect(0,0,width,height);
  const groundFog = ctx.createLinearGradient(0,height*.48,0,height);
  groundFog.addColorStop(0,"rgba(8,12,13,0)");
  groundFog.addColorStop(.68,`rgba(75,101,95,${.055*exposure})`);
  groundFog.addColorStop(1,"rgba(6,7,8,.26)");
  ctx.fillStyle=groundFog; ctx.fillRect(0,height*.42,width,height*.58);
  ctx.restore();
}

function drawMemoryArchitecture(mode) {
  const visibleStages = ["threshold","museum_void","world_selection","mist","fracture","turbulence","hybrid"];
  if (!visibleStages.includes(mode) && state.stage !== "world_transformation") return;

  const stageTargets = {
    threshold:-4.6, museum_void:-1.35, world_selection:.2,
    world_exploration:1.65, world_transformation:2.45
  };
  camera.targetZ = stageTargets[state.stage] ?? -2.1;
  camera.z += (camera.targetZ-camera.z) * .018;
  camera.x += (((pointer.x/Math.max(1,width))-.5)*1.05-camera.x)*.035;
  camera.y += ((.1-((pointer.y/Math.max(1,height))-.5)*.42)-camera.y)*.035;

  const focal = Math.min(width,height)*1.2;
  const reveal = mode === "threshold" ? .78 : mode === "museum_void" ? 1 : .72;
  const stride = performanceController.config().particles < 900 ? 3 : performanceController.config().particles < 1800 ? 2 : 1;
  const stageDrift = state.stage === "world_transformation" ? Math.sin(transformationProgress*Math.PI)*1.25 : 0;

  ctx.save();
  ctx.globalCompositeOperation="lighter";
  for (let i=0;i<memoryWorld.length;i+=stride) {
    const p=memoryWorld[i];
    const depth=p.z-camera.z;
    if (depth<1.2) continue;
    const scale=focal/depth;
    const fracture=stageDrift*Math.sin(p.seed+time*7)*(p.family==="stone"?.65:.24);
    const x=width*.5+(p.x-camera.x+fracture)*scale;
    const y=height*.56-(p.y-camera.y+fracture*.18)*scale;
    if (x < -20 || x > width+20 || y < -20 || y > height+20) continue;

    const rgb=memoryPalette[p.family] || memoryPalette.dust;
    const depthFade=Math.max(.08,Math.min(.82,scale/105));
    const familyAlpha=p.family==="dust"?.28:p.family==="mist"?.24:p.family==="garden"?.7:.9;
    const pulse=.82+Math.sin(time*1.8+p.seed)*.18;
    const alpha=depthFade*familyAlpha*reveal*pulse;
    const size=Math.max(.38,Math.min(3.4,p.size*(.35+scale*.021)));
    ctx.fillStyle=`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
    ctx.fillRect(x,y,size,size);
    if ((p.family==="gold" || p.family==="cyan") && size>1.15 && i%7===0) {
      ctx.fillStyle=`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha*.12})`;
      ctx.beginPath();ctx.arc(x,y,size*4.5,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.restore();

  // A small, readable portal plane gives the point cloud a visual anchor.
  const portalDepth=15.25-camera.z;
  const portalScale=focal/portalDepth;
  const portalX=width*.5-camera.x*portalScale;
  const portalY=height*.56-(-.25-camera.y)*portalScale;
  const portalGlow=ctx.createRadialGradient(portalX,portalY,0,portalX,portalY,portalScale*1.8);
  portalGlow.addColorStop(0,`rgba(196,166,117,${.055*reveal})`);
  portalGlow.addColorStop(1,"rgba(196,166,117,0)");
  ctx.fillStyle=portalGlow;ctx.fillRect(portalX-portalScale*2,portalY-portalScale*2,portalScale*4,portalScale*4);
}

function drawVignette() {
  const vignette=ctx.createRadialGradient(width*.5,height*.5,Math.min(width,height)*.23,width*.5,height*.5,Math.max(width,height)*.72);
  vignette.addColorStop(0,"rgba(0,0,0,0)");
  vignette.addColorStop(.66,"rgba(4,3,7,.12)");
  vignette.addColorStop(1,"rgba(3,2,5,.82)");
  ctx.fillStyle=vignette;ctx.fillRect(0,0,width,height);
}

addEventListener("resize",resize);
addEventListener("pointermove",event=>{pointer.x=event.clientX;pointer.y=event.clientY;});
addEventListener("keydown",event=>{
  const keys={"1":"threshold","2":"museum_void","3":"world_exploration","4":"summoning","5":"roundtable","6":"world_transformation","7":"manifesto"};
  if(keys[event.key]) setStage(keys[event.key]);
  if(event.key.toLowerCase()==="r") reset();
  if(event.key.toLowerCase()==="m") toggleAudio();
  if(event.key.toLowerCase()==="p") togglePerformance();
  if(event.key==="Escape") closeArtDialogue();
  if(event.altKey && event.key.toLowerCase()==="d" && ["localhost","127.0.0.1"].includes(location.hostname) && !state.demoMode) {
    debugPanel.hidden = !debugPanel.hidden;
    updateDebugPanel();
  }
});

if (["localhost", "127.0.0.1"].includes(location.hostname)) window.__museDebug = { openArtDialogue, openAskDialogue, closeArtDialogue };

document.querySelectorAll("[data-action='reset']").forEach(button=>button.addEventListener("click",reset));
document.querySelector("[data-action='toggle-audio']").addEventListener("click",toggleAudio);
document.querySelector("[data-action='toggle-performance']").addEventListener("click",togglePerformance);
syncParticlePool(); resize(); updatePerformanceLabel(); const __start = new URLSearchParams(location.search).get("stage"); setStage(STAGES.includes(__start) ? __start : "threshold"); requestAnimationFrame(renderWorld);

if (state.demoMode) {
  document.querySelector("#discovery").textContent = "DEMO MODE / 90 SEC PATH";
}
