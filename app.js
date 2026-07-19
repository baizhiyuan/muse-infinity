import { worldAssets } from "./config/assets.js";
import { WorldLabsAdapter } from "./services/worldLabs.js";
import { AudioReactiveSignal } from "./lib/audioAnalysis.js";
import { PerformanceController } from "./lib/performance.js";
import { createMemoryWorld, memoryPalette } from "./lib/memoryWorld.js";
import { museumArtworks, salonParticipants } from "./config/museumAssets.js";
import { Museum3D } from "./lib/museum3d.js";
import { loadOpenAccessArtworks } from "./services/museumCollections.js";
import { VoiceConversation } from "./services/voiceConversation.js";

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
  "threshold", "life_question", "companion_selection", "ai_curation", "world_exploration",
  "decision", "world_transformation", "manifesto"
];

const stageMeta = {
  threshold: ["00", "THRESHOLD", "#c9aa72"],
  life_question: ["01", "YOUR QUESTION", "#9e87aa"],
  companion_selection: ["02", "CHOOSE YOUR COMPANY", "#c999a9"],
  ai_curation: ["03", "AI THEME CURATION", "#7caaa9"],
  world_exploration: ["04", "ACROSS TIME", "#91bab1"],
  decision: ["05", "FORM YOUR ANSWER", "#bc7788"],
  world_transformation: ["06", "DREAMING THE WORLD", "#7faab7"],
  manifesto: ["07", "YOUR DREAM WORLD", "#d1b677"]
};

const state = {
  stage: "threshold",
  selectedPortal: null,
  activeSpeaker: null,
  currentQuestion: null,
  dialogueIndex: 0,
  philosophy: { perception: 0, emotion: 0, invention: 0 },
  finalWorld: null,
  userAnswer: "",
  answerLens: null,
  discussionCount: 0,
  exhibitionSceneIndex: 0,
  audioEnabled: false,
  demoMode: new URLSearchParams(location.search).get("demo") === "true",
  performanceMode: "auto",
  worldLoadState: "fallback",
  transformationStart: 0,
  transformationChoice: null,
  memories: new Set(),
  selectedCompanions: new Set(),
  galleryArtworks: [...museumArtworks],
  focusedArtwork: museumArtworks[0]
};

let museum3D = null;
let voiceConversation = null;

const effectModes = {
  soften_boundaries:"mist", shift_light:"mist", fracture_geometry:"fracture",
  multiply_particles:"infinity", emotional_turbulence:"turbulence",
  grow_memory_garden:"garden", open_philosophical_void:"void",
  connect_idea_network:"network", merge_worlds:"hybrid"
};

const characters = salonParticipants;

const questions = [
  "What is art supposed to do to a human being?",
  "Is suffering necessary for great art?",
  "Will AI expand human creativity or make artists unnecessary?"
];

const lifeQuestions = [
  "What makes a life meaningful?",
  "How do I live with uncertainty?",
  "What should I keep, and what should I let go?"
];

const EXHIBITION_MODE = "image";
const exhibitionScenes = [
  { id:"court-of-light", title:"The Court of Light", chapter:"THRESHOLD", artist:"A SHARED BEGINNING", image:"assets/scenes/02-court-of-light.png", prompt:"Before an answer appears, what becomes visible when you slow down?" },
  { id:"monet-water-light", title:"The Garden of Water and Light", chapter:"PERCEPTION", artist:"CLAUDE MONET", image:"assets/scenes/03-monet-water-and-light.png", prompt:"Does meaning arrive through grand events, or through learning to notice ordinary light?", artwork:museumArtworks[0] },
  { id:"sunset-frames", title:"The Sunset Frame Gallery", chapter:"MEMORY", artist:"BETWEEN VOICES", image:"assets/scenes/04-sunset-frame-gallery.png", prompt:"Which memories frame your life, and which ones leave the frame empty?" },
  { id:"van-gogh-sky", title:"The Studio of the Burning Sky", chapter:"INTENSITY", artist:"VINCENT VAN GOGH", image:"assets/scenes/05-van-gogh-burning-sky.png", prompt:"Can struggle deepen attention without becoming the source of meaning itself?", artwork:museumArtworks[1] },
  { id:"petal-transition", title:"The Petal Transition Hall", chapter:"TRANSFORMATION", artist:"THE WORLD IS CHANGING", image:"assets/scenes/06-petal-transition-hall.png", prompt:"What part of your question is beginning to change shape?" },
  { id:"frida-memory", title:"The Courtyard of Living Memory", chapter:"IDENTITY", artist:"FRIDA KAHLO", image:"assets/scenes/07-frida-living-memory.png", prompt:"What can pain become after it is given color, symbol and form?" },
  { id:"kusama-infinity", title:"The Infinite Repetition Chamber", chapter:"INFINITY", artist:"YAYOI KUSAMA", image:"assets/scenes/08-kusama-infinite-dots.png", prompt:"If the self repeats into infinity, what remains uniquely yours?" }
];

const dialogueSets = {
  "What is art supposed to do to a human being?": [
    { speaker:"socrates", text:"Before deciding what art should do, should we ask whether the viewer wishes to remain unchanged?", effect:"open_philosophical_void" },
    { speaker:"monet", text:"Art can make perception unstable enough that an ordinary instant becomes newly visible.", effect:"soften_boundaries" },
    { speaker:"picasso", text:"Visibility is too gentle. Art should break the agreement that reality has only one face.", effect:"fracture_geometry" },
    { speaker:"morisot", text:"Perhaps art teaches attention through intimacy: the ordinary room, the held book, the face before it becomes performance.", effect:"connect_idea_network" }
  ],
  "Is suffering necessary for great art?": [
    { speaker:"socrates", text:"If suffering guarantees greatness, why does so much suffering leave no art behind?", effect:"open_philosophical_void" },
    { speaker:"van_gogh", text:"Pain can intensify what we notice, but attention—not pain itself—gives experience a form.", effect:"emotional_turbulence" },
    { speaker:"frida", text:"The wound is not the artwork. Transformation begins when the wound becomes a language.", effect:"grow_memory_garden" },
    { speaker:"monet", text:"A life may also be made profound by learning to see light change on water.", effect:"shift_light" }
  ],
  "Will AI expand human creativity or make artists unnecessary?": [
    { speaker:"socrates", text:"Are we afraid that machines will stop us creating—or that they will reveal how much of creation was repetition?", effect:"open_philosophical_void" },
    { speaker:"picasso", text:"A tool can fracture form. It cannot decide which fracture is worth carrying into the future.", effect:"fracture_geometry" },
    { speaker:"hilma", text:"A diagram can hold what ordinary sight cannot: not a replacement for mystery, but a structure through which intuition can travel.", effect:"multiply_particles" },
    { speaker:"morisot", text:"A new tool is not a new vision by itself. The human act is still deciding what deserves tenderness and form.", effect:"connect_idea_network" }
  ]
};

const choices = [
  { id:"perception", label:"Art should teach us to see the world again.", delta:{perception:3,emotion:1,invention:0} },
  { id:"emotion", label:"Art should turn inner experience into a shared language.", delta:{perception:0,emotion:3,invention:1} },
  { id:"invention", label:"Art should create realities that did not exist before.", delta:{perception:1,emotion:0,invention:3} }
];

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

function setStage(stage) {
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
    life_question: lifeQuestionView,
    companion_selection: companionSelectionView,
    ai_curation: aiCurationView,
    world_exploration: worldExplorationView,
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
      <p class="lede">Bring one question about your life. Walk through art with the minds you choose, then turn your answer into a world.</p>
      <div class="action-row"><button class="orb-action" data-action="enter" aria-label="Begin with a life question"><span>BEGIN</span></button><span class="gesture-hint">ONE QUESTION · ONE CONTINUOUS JOURNEY</span></div>
    </div>
  </section>`;
}

function lifeQuestionView() {
  return `<section class="scene question-stage">
    <div class="question-stage-copy">
      <p class="eyebrow">01 / BEGIN WITH YOUR LIFE</p>
      <h2>What question are you carrying?</h2>
      <p class="lede">There is no correct question. The museum will use it as the curatorial thread connecting every artwork, companion and space.</p>
    </div>
    <form id="lifeQuestionForm" class="life-question-form">
      <label for="lifeQuestion">YOUR QUESTION</label>
      <textarea id="lifeQuestion" maxlength="240" placeholder="What makes a life meaningful?" required>${escapeHtml(state.currentQuestion || "")}</textarea>
      <div class="question-suggestions">${lifeQuestions.map(question => `<button type="button" data-life-question="${escapeHtml(question)}">${escapeHtml(question)}</button>`).join("")}</div>
      <button class="primary-action" type="submit">CHOOSE WHO WALKS WITH ME <span>→</span></button>
    </form>
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

function worldSelectionView() {
  const worlds = [
    ["light","WORLD OF LIGHT","MONET","#79b7b0",false,museumArtworks[0]], ["fracture","WORLD OF FRACTURE","PICASSO","#a65a58",true,museumArtworks[2]],
    ["infinity","WORLD OF THE UNSEEN","HILMA","#a786b1",true,null], ["emotion","WORLD OF EMOTION","VAN GOGH","#c69f4e",true,museumArtworks[1]],
    ["identity","WORLD OF MEMORY","MORISOT","#c89ba1",true,null]
  ];
  return `<section class="scene">
    <p class="eyebrow">02 / CHOOSE A PERCEPTION</p><h2>Whose eyes do you want to borrow?</h2>
    <div class="world-grid">${worlds.map(([id,title,artist,color,locked,artwork]) => `<button class="world-node ${locked?"locked":""}" style="--node-color:${color}; ${artwork ? `--artwork:url('${artwork.image}')` : ""}" ${locked?"disabled aria-disabled='true'":`data-world="${id}"`}><small>${artist}${locked?" / PREVIEW":" / ENTER"}</small><b>${title}</b>${artwork ? `<em>${artwork.title}</em>` : ""}</button>`).join("")}</div>
  </section>`;
}

function companionSelectionView() {
  const selectable = characters.filter(character => character.portrait);
  return `<section class="scene companion-selection">
    <div class="companion-intro"><p class="eyebrow">02 / INVITE UP TO THREE MINDS</p><h2>Who should challenge your question?</h2><p class="question-reminder">“${escapeHtml(state.currentQuestion)}”</p><p class="lede">Choose artists and thinkers whose different ways of seeing can accompany you through the exhibition.</p></div>
    <div class="companion-grid">${selectable.map(character => `<button class="companion-card ${state.selectedCompanions.has(character.id) ? "selected" : ""}" data-companion="${character.id}" style="--portrait:url('${character.portrait}')"><span class="companion-check">${state.selectedCompanions.has(character.id) ? "✓" : "+"}</span><small>INVITE</small><b>${character.fullName}</b><em>AI interpretation · public-domain portrait</em>${character.turnaround ? `<span class="model-readiness">4-VIEW 3D INPUT READY</span>` : ""}</button>`).join("")}</div>
    <div class="companion-footer"><span id="companionCount">${state.selectedCompanions.size} / 3 SELECTED</span><button class="primary-action" data-action="curate-exhibition" ${state.selectedCompanions.size ? "" : "disabled"}>LET AI CURATE <span>→</span></button></div>
  </section>`;
}

function curationData() {
  const question = (state.currentQuestion || "").toLowerCase();
  if (/meaning|purpose|worth/.test(question)) return ["The Architecture of a Meaningful Life", ["Attention", "Belonging", "What Remains"]];
  if (/uncertain|unknown|future|fear/.test(question)) return ["The Beauty of Not Knowing", ["Thresholds", "Changing Light", "Trusting the Unfinished"]];
  if (/keep|let go|loss|leave/.test(question)) return ["What Memory Chooses to Keep", ["Attachment", "Transformation", "Release"]];
  if (/love|relationship|alone|belong/.test(question)) return ["The Distance Between Two People", ["Recognition", "Intimacy", "Freedom"]];
  return ["A Museum Built Around Your Question", ["How You See", "What You Feel", "What You Can Imagine"]];
}

function aiCurationView() {
  const [title, chapters] = curationData();
  const companions = selectedCompanionRecords();
  const routeScenes = [exhibitionScenes[1], exhibitionScenes[3], exhibitionScenes[5]];
  return `<section class="scene curation-stage">
    <div class="curation-summary">
      <p class="eyebrow">03 / AI THEME CURATION COMPLETE</p>
      <h2>${escapeHtml(title)}</h2>
      <blockquote>“${escapeHtml(state.currentQuestion)}”</blockquote>
      <div class="curation-companions">${companions.map(character => `<span><img src="${character.portrait}" alt=""/>${character.name}</span>`).join("")}</div>
    </div>
    <div class="curation-route" aria-label="Curated exhibition route">
      ${chapters.map((chapter, index) => {
        const scene = routeScenes[index];
        return `<article><small>CHAPTER 0${index + 1}</small><img src="${scene.image}" alt="${escapeHtml(scene.title)}"/><div><b>${escapeHtml(chapter)}</b><span>${escapeHtml(scene.title)} · ${escapeHtml(scene.artist)}</span></div></article>`;
      }).join("")}
      <div class="curation-ready"><span>CURATORIAL SPINE READY</span><button class="primary-action" data-action="enter-gallery">ENTER THE EXHIBITION <span>→</span></button></div>
    </div>
  </section>`;
}

function worldExplorationView() {
  const companions = selectedCompanionRecords();
  const scene = exhibitionScenes[state.exhibitionSceneIndex] || exhibitionScenes[0];
  return `<section class="scene gallery-scene">
    <div class="gallery-viewport image-gallery ready" id="museum3d">
      <img class="scene-backdrop" id="sceneBackdrop" src="${scene.image}" alt="${escapeHtml(scene.title)}" />
      <div class="scene-vignette" aria-hidden="true"></div>
      <div class="gallery-title"><p class="eyebrow"><span id="sceneChapter">${escapeHtml(scene.chapter)}</span> · <span id="sceneArtist">${escapeHtml(scene.artist)}</span></p><h2 id="sceneTitle">${escapeHtml(scene.title)}</h2><span>SCROLL OR USE ARROWS TO MOVE THROUGH THE EXHIBITION</span></div>
      <div class="collection-status"><i></i><span>IMAGE WORLD PROTOTYPE · 3D REPLACEMENT READY</span></div>
      <div class="companion-dock" aria-label="Your museum companions">${companions.map(character => `<div class="companion-chip" title="${character.fullName}"><img src="${character.portrait}" alt="${character.fullName}"/><span>${character.name}</span></div>`).join("")}</div>
      <section class="conversation-dock" aria-label="Talk with your museum companions">
        <div class="conversation-head"><div><small>DISCUSS THIS SCENE</small><b id="voiceState">LOCAL PREVIEW</b></div><button class="mic-button" data-action="voice-listen" aria-label="Speak to your companions"><span>◉</span> TALK</button></div>
        <div class="conversation-log" id="conversationLog"><p id="sceneDiscussionPrompt"><b>${companions[0]?.name || "MUSE"}</b> ${escapeHtml(scene.prompt)}</p></div>
        <form id="galleryQuestionForm" class="conversation-form"><input id="galleryQuestion" autocomplete="off" placeholder="Discuss this artwork with your companions…" aria-label="Question for your companions"/><button>ASK</button></form>
      </section>
      <nav class="scene-navigator" aria-label="Exhibition scenes">
        <button class="scene-arrow" data-scene-direction="-1" aria-label="Previous scene" title="Previous scene" disabled>←</button>
        <div class="scene-progress"><span id="sceneCounter">01 / ${String(exhibitionScenes.length).padStart(2,"0")}</span><div>${exhibitionScenes.map((item,index) => `<button data-scene-index="${index}" class="${index === state.exhibitionSceneIndex ? "active" : ""}" aria-label="Go to ${escapeHtml(item.title)}"></button>`).join("")}</div></div>
        <button class="scene-arrow" data-scene-direction="1" aria-label="Next scene" title="Next scene">→</button>
      </nav>
      <button class="salon-next" data-action="form-answer">FORM MY ANSWER <span>→</span></button>
    </div>
  </section>`;
}

function ringMarkup(coreAction = "open-salon") {
  return `<div class="salon-ring">${characters.map((character,i) => `<div class="character ${state.activeSpeaker===character.id?"active":""} ${character.portrait ? "has-portrait" : ""}" style="--angle:${i*(360/characters.length)}deg;--character-color:${character.color};${character.portrait ? `--portrait:url('${character.portrait}')` : ""}"><span>${character.name}</span></div>`).join("")}<div class="salon-core"><button data-action="${coreAction}">${coreAction === "open-salon" ? "OPEN THE SALON" : "ASK THE IMPOSSIBLE"}</button></div></div>`;
}

function summoningView() {
  return `<section class="scene salon"><p class="eyebrow">05 / SEVEN MINDS. ONE EMPTY SEAT.</p><h2>The Salon Outside Time</h2>${ringMarkup("open-salon")}<p class="lede">Historical figures are represented as AI interpretations grounded in documented themes—not authentic quotations or endorsements.</p></section>`;
}

function roundtableView() {
  return `<section class="scene salon"><p class="eyebrow">06 / ASK ACROSS CENTURIES</p><h2>What should they disagree about?</h2><div class="question-panel"><div class="preset-list">${questions.map((q,i)=>`<button data-question="${escapeHtml(q)}"><small>0${i+1}</small><br>${q}</button>`).join("")}</div></div></section>`;
}

function dialogueView() {
  const turns = dialogueSets[state.currentQuestion];
  const turn = turns[state.dialogueIndex];
  state.activeSpeaker = turn.speaker;
  const speakerLabel = characters.find(({ id })=>id===turn.speaker)?.name || turn.speaker.replace("_"," ").toUpperCase();
  return `<section class="scene dialogue-scene"><p class="speaker-name">${speakerLabel}</p><blockquote>“${turn.text}”</blockquote><div class="dialogue-progress">${turns.map((_,i)=>`<i class="${i<=state.dialogueIndex?"done":""}"></i>`).join("")}</div><button class="primary-action" data-action="next-dialogue">${state.dialogueIndex === turns.length-1 ? "FACE THE CONTRADICTION" : "CONTINUE"}</button></section>`;
}

function decisionView() {
  return `<section class="scene answer-stage">
    <div class="answer-prompt"><p class="eyebrow">05 / AFTER THE EXHIBITION</p><h2>What is your answer now?</h2><p class="question-reminder">“${escapeHtml(state.currentQuestion)}”</p><p class="lede">Your answer does not need to be final. It only needs to be true enough to become a world.</p></div>
    <form id="personalAnswerForm" class="personal-answer-form">
      <label for="personalAnswer">MY ANSWER</label>
      <textarea id="personalAnswer" maxlength="420" placeholder="I think…" required>${escapeHtml(state.userAnswer)}</textarea>
      <div class="answer-lenses">${choices.map((choice,i)=>`<button type="button" class="answer-lens ${state.answerLens === choice.id ? "selected" : ""}" data-answer-choice="${choice.id}" data-answer-text="${escapeHtml(choice.label)}"><small>0${i+1}</small><span>${escapeHtml(choice.label)}</span></button>`).join("")}</div>
      <button class="primary-action" type="submit">GENERATE MY DREAM WORLD <span>→</span></button>
    </form>
  </section>`;
}

function transformationView() {
  return `<section class="scene transformation"><p class="eyebrow">06 / YOUR ANSWER HAS ENTERED THE WORLD</p><div class="transformation-mark"></div><h1>Your Dream World<br>is taking form.</h1><p class="lede transformation-copy" id="transformationCopy">The exhibition dissolves. Your words become light, material and space.</p></section>`;
}

function finalWorldData() {
  const ranking = Object.entries(state.philosophy).sort((a,b)=>b[1]-a[1]).map(([key])=>key);
  const top = ranking.slice(0,2).sort().join("+");
  const endings = {
    "emotion+perception": ["The Garden of Living Light", "You believe art should make inner experience visible by teaching perception to move more slowly."],
    "invention+perception": ["The Museum of Multiple Realities", "You believe art should free perception from a single reality and give form to what does not yet exist."],
    "emotion+invention": ["The Infinite Interior", "You believe inner truth becomes powerful when it invents a world others can enter." ]
  };
  return endings[top] || ["The World Between Worlds", "You believe art must balance perception, emotion and invention without allowing any one truth to become final."];
}

function manifestoView() {
  const [title,copy] = finalWorldData();
  state.finalWorld = title;
  return `<section class="scene manifesto"><div class="manifesto-card"><p class="eyebrow">07 / YOUR PERSONAL DREAM WORLD</p><h2>${title}</h2><blockquote class="answer-echo">“${escapeHtml(state.userAnswer)}”</blockquote><p class="manifesto-copy">${copy}</p><div class="score-row">${Object.entries(state.philosophy).map(([key,value])=>`<span>${key.toUpperCase()}<b>${String(value).padStart(2,"0")}</b></span>`).join("")}</div><div class="action-row" style="justify-content:center"><button class="primary-action" data-action="reset">BEGIN WITH A NEW QUESTION</button></div></div></section>`;
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
    const enter = experience.querySelector("[data-action='curate-exhibition']");
    if (enter) enter.disabled = state.selectedCompanions.size === 0;
  }));
  experience.querySelectorAll("[data-life-question]").forEach(button => button.addEventListener("click", () => {
    const input = experience.querySelector("#lifeQuestion");
    if (input) input.value = button.dataset.lifeQuestion;
  }));
  experience.querySelectorAll("[data-answer-choice]").forEach(button => button.addEventListener("click", () => {
    state.answerLens = button.dataset.answerChoice;
    const input = experience.querySelector("#personalAnswer");
    if (input) input.value = button.dataset.answerText;
    experience.querySelectorAll("[data-answer-choice]").forEach(option => option.classList.toggle("selected", option === button));
  }));
  experience.querySelectorAll("[data-scene-direction]").forEach(button => button.addEventListener("click", () => {
    goToExhibitionScene(state.exhibitionSceneIndex + Number(button.dataset.sceneDirection));
  }));
  experience.querySelectorAll("[data-scene-index]").forEach(button => button.addEventListener("click", () => {
    goToExhibitionScene(Number(button.dataset.sceneIndex));
  }));
  experience.querySelectorAll("[data-memory]").forEach(button => button.addEventListener("click", () => {
    state.memories.add(button.dataset.memory);
    button.style.opacity = ".42";
    button.querySelector("small").textContent = "Memory absorbed into the world.";
    burst(innerWidth * .72, innerHeight * .5, "#9cd0c7", 44);
  }));
  experience.querySelectorAll("[data-question]").forEach(button => button.addEventListener("click", () => {
    state.currentQuestion = button.dataset.question;
    state.dialogueIndex = 0;
    showDialogue();
  }));
  experience.querySelectorAll("[data-choice]").forEach(button => button.addEventListener("click", () => choose(button.dataset.choice)));
  const questionForm = experience.querySelector("#galleryQuestionForm");
  questionForm?.addEventListener("submit", event => {
    event.preventDefault();
    const input = experience.querySelector("#galleryQuestion");
    if (input?.value.trim()) state.discussionCount += 1;
    voiceConversation?.ask(input?.value || "");
    if (input) input.value = "";
  });
  experience.querySelector("#lifeQuestionForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const input = experience.querySelector("#lifeQuestion");
    state.currentQuestion = input?.value.trim() || lifeQuestions[0];
    setStage("companion_selection");
  });
  experience.querySelector("#personalAnswerForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const input = experience.querySelector("#personalAnswer");
    const answer = input?.value.trim();
    if (answer) choose(state.answerLens, answer);
  });
}

function act(action) {
  const actions = {
    enter: () => setStage("life_question"),
    "curate-exhibition": () => setStage("ai_curation"),
    "enter-gallery": () => setStage("world_exploration"),
    "close-inspector": () => document.querySelector("#artworkInspector")?.classList.remove("visible"),
    "voice-listen": () => voiceConversation?.listen(),
    "form-answer": () => setStage("decision"),
    "open-salon": () => setStage("roundtable"),
    "next-dialogue": nextDialogue,
    reset,
    "toggle-audio": toggleAudio,
    "toggle-performance": togglePerformance
  };
  actions[action]?.();
}

function selectedCompanionRecords() {
  return characters.filter(character => state.selectedCompanions.has(character.id));
}

let sceneTransitionTimer = 0;
let exhibitionAbortController = null;
function goToExhibitionScene(index) {
  const nextIndex = Math.max(0, Math.min(exhibitionScenes.length - 1, index));
  if (nextIndex === state.exhibitionSceneIndex) return;
  state.exhibitionSceneIndex = nextIndex;
  const scene = exhibitionScenes[nextIndex];
  const image = document.querySelector("#sceneBackdrop");
  const chapter = document.querySelector("#sceneChapter");
  const artist = document.querySelector("#sceneArtist");
  const title = document.querySelector("#sceneTitle");
  const counter = document.querySelector("#sceneCounter");
  const prompt = document.querySelector("#sceneDiscussionPrompt");
  const companion = selectedCompanionRecords()[0]?.name || "MUSE";
  if (!image) return;
  state.focusedArtwork = scene.artwork || null;
  clearTimeout(sceneTransitionTimer);
  image.classList.add("changing");
  sceneTransitionTimer = setTimeout(async () => {
    image.src = scene.image;
    image.alt = scene.title;
    try { await image.decode(); } catch {}
    if (chapter) chapter.textContent = scene.chapter;
    if (artist) artist.textContent = scene.artist;
    if (title) title.textContent = scene.title;
    if (counter) counter.textContent = `${String(nextIndex + 1).padStart(2,"0")} / ${String(exhibitionScenes.length).padStart(2,"0")}`;
    if (prompt) prompt.innerHTML = `<b>${escapeHtml(companion)}</b> ${escapeHtml(scene.prompt)}`;
    document.querySelectorAll("[data-scene-index]").forEach((button, buttonIndex) => button.classList.toggle("active", buttonIndex === nextIndex));
    const previous = document.querySelector("[data-scene-direction='-1']");
    const next = document.querySelector("[data-scene-direction='1']");
    if (previous) previous.disabled = nextIndex === 0;
    if (next) next.disabled = nextIndex === exhibitionScenes.length - 1;
    image.classList.remove("changing");
  }, 240);
}

async function initMuseumExperience() {
  const container = document.querySelector("#museum3d");
  if (!container || state.stage !== "world_exploration") return;
  teardownMuseumExperience();
  if (EXHIBITION_MODE === "image") {
    exhibitionScenes.forEach(scene => { const image = new Image(); image.src = scene.image; });
    exhibitionAbortController = new AbortController();
    let lastWheelAt = 0;
    container.addEventListener("wheel", event => {
      const now = Date.now();
      if (Math.abs(event.deltaY) < 18 || now - lastWheelAt < 700) return;
      lastWheelAt = now;
      goToExhibitionScene(state.exhibitionSceneIndex + (event.deltaY > 0 ? 1 : -1));
    }, { passive:true, signal:exhibitionAbortController.signal });
    addEventListener("keydown", event => {
      if (event.key === "ArrowRight") goToExhibitionScene(state.exhibitionSceneIndex + 1);
      if (event.key === "ArrowLeft") goToExhibitionScene(state.exhibitionSceneIndex - 1);
    }, { signal:exhibitionAbortController.signal });
    state.focusedArtwork = exhibitionScenes[state.exhibitionSceneIndex]?.artwork || null;
  } else {
    museum3D = new Museum3D({
      container,
      artworks: state.galleryArtworks,
      companions: selectedCompanionRecords(),
      onArtworkFocus: focusArtwork,
      onReady: () => container.classList.add("ready")
    });
    museum3D.mount();
  }
  voiceConversation = new VoiceConversation({
    context: () => ({
      companions: selectedCompanionRecords().map(({ id, fullName }) => ({ id, name: fullName })),
      lifeQuestion: state.currentQuestion,
      scene: exhibitionScenes[state.exhibitionSceneIndex],
      artwork: state.focusedArtwork ? { title: state.focusedArtwork.title, artist: state.focusedArtwork.artist, date: state.focusedArtwork.date } : null
    }),
    onState: updateVoiceState,
    onUserText: text => appendConversation("YOU", text),
    onReply: reply => appendConversation(reply.speaker || "MUSE", reply.text, reply.live)
  });

  if (EXHIBITION_MODE === "image") return;
  const collectionStatus = document.querySelector("#collectionStatus");
  try {
    const liveArtworks = await loadOpenAccessArtworks("Claude Monet");
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
}

function appendConversation(speaker, text, live = false) {
  const log = document.querySelector("#conversationLog");
  if (!log) return;
  const paragraph = document.createElement("p");
  const label = document.createElement("b");
  label.textContent = speaker;
  paragraph.append(label, document.createTextNode(` ${text}`));
  if (live) paragraph.dataset.live = "true";
  log.append(paragraph);
  log.scrollTop = log.scrollHeight;
}

function updateVoiceState(status) {
  const label = document.querySelector("#voiceState");
  const mic = document.querySelector(".mic-button");
  const labels = {
    listening: "LISTENING…",
    thinking: "GPT-5.6 THINKING…",
    live: "GPT-5.6 LIVE",
    local: "LOCAL FALLBACK",
    offline: "CONNECTION PAUSED",
    unsupported: "TYPE YOUR QUESTION"
  };
  if (label) label.textContent = labels[status] || "VOICE TOUR";
  mic?.classList.toggle("listening", status === "listening");
}

function teardownMuseumExperience() {
  clearTimeout(sceneTransitionTimer);
  exhibitionAbortController?.abort();
  exhibitionAbortController = null;
  museum3D?.dispose();
  museum3D = null;
  voiceConversation?.dispose();
  voiceConversation = null;
}

function showDialogue() {
  state.stage = "roundtable";
  const turn = dialogueSets[state.currentQuestion][state.dialogueIndex];
  particleMode = effectModes[turn.effect] || "salon";
  experience.innerHTML = dialogueView();
  bindActions();
}

function nextDialogue() {
  const turns = dialogueSets[state.currentQuestion];
  if (state.dialogueIndex < turns.length - 1) {
    state.dialogueIndex += 1;
    showDialogue();
  } else {
    state.activeSpeaker = null;
    setStage("decision");
  }
}

function choose(id, answer = "") {
  const choice = choices.find(item => item.id === id);
  const delta = choice?.delta || { perception:1, emotion:1, invention:1 };
  for (const key of Object.keys(state.philosophy)) state.philosophy[key] += delta[key];
  state.userAnswer = answer;
  updateMeter();
  particleMode = id === "invention" ? "fracture" : id === "emotion" ? "turbulence" : id === "perception" ? "mist" : "hybrid";
  state.transformationChoice = id || "hybrid";
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
  write(.20, "The voices of your companions recede. Your own answer remains.");
  write(.46, "The exhibition architecture dissolves into color, weather and memory.");
  write(.73, "A personal landscape assembles around the meaning of your words.");
  transformationTimers.push(setTimeout(() => setStage("manifesto"), duration));
}

function reset() {
  transformationTimers.forEach(clearTimeout);
  teardownMuseumExperience();
  Object.assign(state, { stage:"threshold", selectedPortal:null, activeSpeaker:null, currentQuestion:null, dialogueIndex:0, philosophy:{perception:0,emotion:0,invention:0}, finalWorld:null, userAnswer:"", answerLens:null, discussionCount:0, exhibitionSceneIndex:0, transformationStart:0, transformationChoice:null, selectedCompanions:new Set(), galleryArtworks:[...museumArtworks], focusedArtwork:museumArtworks[0] });
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
  const keys={"1":"threshold","2":"life_question","3":"companion_selection","4":"ai_curation","5":"world_exploration","6":"decision","7":"manifesto"};
  if(keys[event.key]) setStage(keys[event.key]);
  if(event.key.toLowerCase()==="r") reset();
  if(event.key.toLowerCase()==="m") toggleAudio();
  if(event.key.toLowerCase()==="p") togglePerformance();
  if(event.altKey && event.key.toLowerCase()==="d" && ["localhost","127.0.0.1"].includes(location.hostname) && !state.demoMode) {
    debugPanel.hidden = !debugPanel.hidden;
    updateDebugPanel();
  }
});

document.querySelectorAll("[data-action='reset']").forEach(button=>button.addEventListener("click",reset));
document.querySelector("[data-action='toggle-audio']").addEventListener("click",toggleAudio);
document.querySelector("[data-action='toggle-performance']").addEventListener("click",togglePerformance);
syncParticlePool(); resize(); updatePerformanceLabel(); setStage("threshold"); requestAnimationFrame(renderWorld);

if (state.demoMode) {
  document.querySelector("#discovery").textContent = "DEMO MODE / 90 SEC PATH";
}
