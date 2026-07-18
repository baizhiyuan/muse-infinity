import { worldAssets } from "./config/assets.js";
import { WorldLabsAdapter } from "./services/worldLabs.js";
import { AudioReactiveSignal } from "./lib/audioAnalysis.js";
import { PerformanceController } from "./lib/performance.js";
import { createMemoryWorld, memoryPalette } from "./lib/memoryWorld.js";

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
  "threshold", "museum_void", "world_selection", "world_exploration",
  "summoning", "roundtable", "decision", "world_transformation", "manifesto"
];

const stageMeta = {
  threshold: ["00", "THRESHOLD", "#c9aa72"],
  museum_void: ["01", "BETWEEN WORLDS", "#9e87aa"],
  world_selection: ["02", "BORROWED EYES", "#7caaa9"],
  world_exploration: ["03", "WORLD OF LIGHT", "#91bab1"],
  summoning: ["04", "THE SUMMONING", "#b59bc0"],
  roundtable: ["05", "SALON OUTSIDE TIME", "#c9aa72"],
  decision: ["06", "THE CONTRADICTION", "#bc7788"],
  world_transformation: ["07", "WORLD REWRITTEN", "#7faab7"],
  manifesto: ["08", "YOUR IMPOSSIBLE WORLD", "#d1b677"]
};

const state = {
  stage: "threshold",
  selectedPortal: null,
  activeSpeaker: null,
  currentQuestion: null,
  dialogueIndex: 0,
  philosophy: { perception: 0, emotion: 0, invention: 0 },
  finalWorld: null,
  audioEnabled: false,
  demoMode: new URLSearchParams(location.search).get("demo") === "true",
  performanceMode: "auto",
  worldLoadState: "fallback",
  transformationStart: 0,
  transformationChoice: null,
  memories: new Set()
};

const effectModes = {
  soften_boundaries:"mist", shift_light:"mist", fracture_geometry:"fracture",
  multiply_particles:"infinity", emotional_turbulence:"turbulence",
  grow_memory_garden:"garden", open_philosophical_void:"void",
  connect_idea_network:"network", merge_worlds:"hybrid"
};

const characters = [
  ["monet", "MONET", "#8bbcb4"], ["picasso", "PICASSO", "#b76c66"],
  ["kusama", "KUSAMA", "#b58bb7"], ["van_gogh", "VAN GOGH", "#d4ad5e"],
  ["frida", "FRIDA", "#a04f62"], ["socrates", "SOCRATES", "#e6e1d8"],
  ["modern", "MODERN THINKER", "#70a4bb"]
];

const questions = [
  "What is art supposed to do to a human being?",
  "Is suffering necessary for great art?",
  "Will AI expand human creativity or make artists unnecessary?"
];

const dialogueSets = {
  "What is art supposed to do to a human being?": [
    { speaker:"socrates", text:"Before deciding what art should do, should we ask whether the viewer wishes to remain unchanged?", effect:"open_philosophical_void" },
    { speaker:"monet", text:"Art can make perception unstable enough that an ordinary instant becomes newly visible.", effect:"soften_boundaries" },
    { speaker:"picasso", text:"Visibility is too gentle. Art should break the agreement that reality has only one face.", effect:"fracture_geometry" },
    { speaker:"modern", text:"Perhaps its modern purpose is to reclaim attention from systems designed to spend it for us.", effect:"connect_idea_network" }
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
    { speaker:"kusama", text:"Infinity does not erase the self. It makes the border of the self impossible to defend.", effect:"multiply_particles" },
    { speaker:"modern", text:"AI multiplies leverage. The scarce act becomes choosing what deserves existence and taking responsibility for it.", effect:"connect_idea_network" }
  ]
};

const choices = [
  { id:"perception", label:"Art should teach us to see the world again.", delta:{perception:3,emotion:1,invention:0} },
  { id:"emotion", label:"Art should turn inner experience into a shared language.", delta:{perception:0,emotion:3,invention:1} },
  { id:"invention", label:"Art should create realities that did not exist before.", delta:{perception:1,emotion:0,invention:3} }
];

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

function setStage(stage) {
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

function worldSelectionView() {
  const worlds = [
    ["light","WORLD OF LIGHT","MONET","#79b7b0",false], ["fracture","WORLD OF FRACTURE","PICASSO","#a65a58",true],
    ["infinity","WORLD OF INFINITY","KUSAMA","#a786b1",true], ["emotion","WORLD OF EMOTION","VAN GOGH","#c69f4e",true],
    ["identity","WORLD OF IDENTITY","FRIDA KAHLO","#984c5c",true]
  ];
  return `<section class="scene">
    <p class="eyebrow">02 / CHOOSE A PERCEPTION</p><h2>Whose eyes do you want to borrow?</h2>
    <div class="world-grid">${worlds.map(([id,title,artist,color,locked]) => `<button class="world-node ${locked?"locked":""}" style="--node-color:${color}" ${locked?"disabled aria-disabled='true'":`data-world="${id}"`}><small>${artist}${locked?" / PREVIEW":" / ENTER"}</small><b>${title}</b></button>`).join("")}</div>
  </section>`;
}

function worldExplorationView() {
  return `<section class="scene monet-layout">
    <div><p class="eyebrow">03 / CLAUDE MONET</p><h1>World<br>of Light</h1><p class="lede">The world appears only where attention touches it. Explore three fragments of a perception built from water, atmosphere and time.</p></div>
    <div class="memory-objects">
      <button class="memory-object" data-memory="reflection"><span>A reflection</span><small>Seeing is not the same as knowing.</small></button>
      <button class="memory-object" data-memory="time"><span>A changing light</span><small>Dawn and dusk occupy the same water.</small></button>
      <button class="memory-object" data-memory="question"><span>A suspended question</span><small>What remains when the moment disappears?</small></button>
      <button class="memory-object" data-action="summon"><span>Summon the impossible salon</span><small>Bring conflicting minds into this world.</small></button>
    </div>
  </section>`;
}

function ringMarkup(coreAction = "open-salon") {
  return `<div class="salon-ring">${characters.map(([id,name,color],i) => `<div class="character ${state.activeSpeaker===id?"active":""}" style="--angle:${i*(360/7)}deg;--character-color:${color}"><span>${name}</span></div>`).join("")}<div class="salon-core"><button data-action="${coreAction}">${coreAction === "open-salon" ? "OPEN THE SALON" : "ASK THE IMPOSSIBLE"}</button></div></div>`;
}

function summoningView() {
  return `<section class="scene salon"><p class="eyebrow">04 / SEVEN MINDS. ONE EMPTY SEAT.</p><h2>The Salon Outside Time</h2>${ringMarkup("open-salon")}<p class="lede">Historical figures are represented as AI interpretations grounded in documented themes—not authentic quotations or endorsements.</p></section>`;
}

function roundtableView() {
  return `<section class="scene salon"><p class="eyebrow">05 / ASK ACROSS CENTURIES</p><h2>What should they disagree about?</h2><div class="question-panel"><div class="preset-list">${questions.map((q,i)=>`<button data-question="${escapeHtml(q)}"><small>0${i+1}</small><br>${q}</button>`).join("")}</div></div></section>`;
}

function dialogueView() {
  const turns = dialogueSets[state.currentQuestion];
  const turn = turns[state.dialogueIndex];
  state.activeSpeaker = turn.speaker;
  const speakerLabel = characters.find(([id])=>id===turn.speaker)?.[1] || turn.speaker.replace("_"," ").toUpperCase();
  return `<section class="scene dialogue-scene"><p class="speaker-name">${speakerLabel}</p><blockquote>“${turn.text}”</blockquote><div class="dialogue-progress">${turns.map((_,i)=>`<i class="${i<=state.dialogueIndex?"done":""}"></i>`).join("")}</div><button class="primary-action" data-action="next-dialogue">${state.dialogueIndex === turns.length-1 ? "FACE THE CONTRADICTION" : "CONTINUE"}</button></section>`;
}

function decisionView() {
  return `<section class="scene"><p class="eyebrow">06 / SOCRATES ASKS YOU</p><h2>If art can alter reality, what responsibility should it carry?</h2><div class="choice-grid">${choices.map((choice,i)=>`<button class="choice" data-choice="${choice.id}"><small>0${i+1}</small><span>${choice.label}</span></button>`).join("")}</div></section>`;
}

function transformationView() {
  return `<section class="scene transformation"><p class="eyebrow">07 / YOUR ANSWER HAS ENTERED THE WORLD</p><div class="transformation-mark"></div><h1>The museum is<br>rewriting itself.</h1><p class="lede transformation-copy" id="transformationCopy">Sound falls away. Your chosen idea enters the salon ring.</p></section>`;
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
  return `<section class="scene manifesto"><div class="manifesto-card"><p class="eyebrow">YOUR IMPOSSIBLE WORLD</p><h2>${title}</h2><p class="manifesto-copy">${copy}</p><div class="score-row">${Object.entries(state.philosophy).map(([key,value])=>`<span>${key.toUpperCase()}<b>${String(value).padStart(2,"0")}</b></span>`).join("")}</div><div class="action-row" style="justify-content:center"><button class="primary-action" data-action="reset">ENTER AGAIN</button></div></div></section>`;
}

function bindActions() {
  experience.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", () => act(button.dataset.action)));
  experience.querySelectorAll("[data-world]").forEach(button => button.addEventListener("click", () => {
    state.selectedPortal = button.dataset.world;
    setStage("world_exploration");
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
}

function act(action) {
  const actions = {
    enter: () => setStage("museum_void"),
    "discover-worlds": () => setStage("world_selection"),
    summon: () => setStage("summoning"),
    "open-salon": () => setStage("roundtable"),
    "next-dialogue": nextDialogue,
    reset,
    "toggle-audio": toggleAudio,
    "toggle-performance": togglePerformance
  };
  actions[action]?.();
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
  Object.assign(state, { stage:"threshold", selectedPortal:null, activeSpeaker:null, currentQuestion:null, dialogueIndex:0, philosophy:{perception:0,emotion:0,invention:0}, finalWorld:null, transformationStart:0, transformationChoice:null });
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
  debugPanel.innerHTML = `<strong>MUSE∞ VISUAL DEBUG</strong><br>stage: ${state.stage}<br>effect: ${particleMode}<br>speaker: ${state.activeSpeaker || "none"}<br>particles: ${particles.length}<br>quality: ${performanceController.resolved}<br>world: ${state.worldLoadState}<br><button data-debug-effect="mist">MONET</button><button data-debug-effect="fracture">PICASSO</button><button data-debug-effect="infinity">KUSAMA</button><button data-debug-effect="turbulence">VAN GOGH</button><button data-debug-effect="garden">FRIDA</button><button data-debug-effect="void">SOCRATES</button><button data-debug-effect="network">NETWORK</button>`;
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
  const activeColor = characters.find(([id])=>id===state.activeSpeaker)?.[2];
  ctx.fillStyle=(state.activeSpeaker && i%4===0 ? activeColor : p.color) || `rgba(${palette.join(",")},${Math.max(0,alpha*p.life)})`;
  ctx.beginPath(); ctx.arc(x,y,size,0,Math.PI*2); ctx.fill();
}

function characterAnchor(speaker) {
  const index = Math.max(0, characters.findIndex(([id])=>id===speaker));
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
  if(event.key.toLowerCase()==="d" && ["localhost","127.0.0.1"].includes(location.hostname) && !state.demoMode) {
    debugPanel.hidden = !debugPanel.hidden;
    updateDebugPanel();
  }
});

document.querySelectorAll("[data-action='reset']").forEach(button=>button.addEventListener("click",reset));
document.querySelector("[data-action='toggle-audio']").addEventListener("click",toggleAudio);
document.querySelector("[data-action='toggle-performance']").addEventListener("click",togglePerformance);
syncParticlePool(); resize(); updatePerformanceLabel(); render(); requestAnimationFrame(renderWorld);

if (state.demoMode) {
  document.querySelector("#discovery").textContent = "DEMO MODE / 90 SEC PATH";
}
