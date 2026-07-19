// Stage-grouped background score with game-style narration ducking.
//
// All three recordings are public-domain performances curated from Wikimedia Commons —
// see THIRD_PARTY_NOTICES.md. The casting is thematic: Mussorgsky's Promenade IS music
// about walking through an art exhibition (opening + finale acts), Debussy scores the
// impressionist gallery walk, Satie scores the salon. Pure instrumentals only.

const TRACKS = {
  promenade: "assets/audio/promenade.ogg",
  "clair-de-lune": "assets/audio/clair-de-lune.opus",
  gymnopedie: "assets/audio/gymnopedie.ogg"
};

// Acts share tracks so a stage change inside one act never restarts its music.
const STAGE_TRACKS = {
  threshold: "promenade",
  museum_void: "promenade",
  world_selection: "promenade",
  companion_selection: "promenade",
  world_exploration: "clair-de-lune",
  summoning: "gymnopedie",
  roundtable: "gymnopedie",
  decision: "gymnopedie",
  world_transformation: "promenade",
  manifesto: "promenade"
};

const FULL_VOLUME = 0.32;   // background level — the room stays in front
const DUCKED_VOLUME = 0.07; // while a master is speaking
const FADE_TICK_MS = 60;
const FADE_RATE = 0.22;     // exponential approach per tick — ducking must react in ~half a second
const SNAP_EPSILON = 0.005;

export class BackgroundMusic {
  constructor() {
    this.enabled = false;
    this.ducked = false;
    this.stage = "threshold";
    this.players = new Map(); // track key -> HTMLAudioElement, created lazily and reused
    this.activeKey = null;
    this.fadeTimer = null;
  }

  /** Must be called from a user gesture the first time — starting audio needs one. */
  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (this.enabled) this.syncTrack();
    else this.ensureFade(); // targets all drop to 0; players pause on arrival
  }

  setStage(stage) {
    this.stage = stage;
    if (this.enabled) this.syncTrack();
  }

  /** Game-style ducking: lower — never stop — the score while someone is speaking. */
  duck(isSpeaking) {
    this.ducked = Boolean(isSpeaking);
    this.ensureFade();
  }

  syncTrack() {
    const key = STAGE_TRACKS[this.stage] || "promenade";
    this.activeKey = key;
    let player = this.players.get(key);
    if (!player) {
      player = new Audio(TRACKS[key]);
      player.loop = true;
      player.preload = "auto";
      player.volume = 0;
      this.players.set(key, player);
    }
    // A failed play (autoplay policy, missing codec) leaves the demo silent but alive.
    if (player.paused) player.play().catch(() => {});
    this.ensureFade();
  }

  targetFor(key) {
    if (!this.enabled || key !== this.activeKey) return 0;
    return this.ducked ? DUCKED_VOLUME : FULL_VOLUME;
  }

  ensureFade() {
    if (this.fadeTimer) return;
    this.fadeTimer = setInterval(() => {
      let settled = true;
      for (const [key, player] of this.players) {
        const target = this.targetFor(key);
        const diff = target - player.volume;
        if (Math.abs(diff) <= SNAP_EPSILON) {
          player.volume = target;
          if (target === 0 && !player.paused) player.pause();
          continue;
        }
        settled = false;
        player.volume += diff * FADE_RATE;
      }
      if (settled) {
        clearInterval(this.fadeTimer);
        this.fadeTimer = null;
      }
    }, FADE_TICK_MS);
  }

  dispose() {
    if (this.fadeTimer) { clearInterval(this.fadeTimer); this.fadeTimer = null; }
    for (const player of this.players.values()) { player.pause(); player.src = ""; }
    this.players.clear();
  }
}
