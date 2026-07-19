// Sequential per-master narration over /api/tts.
//
// MiniMax T2A synthesises ONE utterance per request (the moss project hit this: a long reply
// must be split, and the next segment may start only after the current one ENDS, or lines get
// cut off mid-sentence). So: split into sentence-bounded segments, synthesise one at a time,
// advance on the audio element's `ended` event, and prefetch the next segment while the
// current one is speaking so the hand-off has no dead air.

const SEGMENT_CHAR_LIMIT = 280;

export function splitIntoSegments(text, limit = SEGMENT_CHAR_LIMIT) {
  const clean = String(text || "").trim();
  if (!clean) return [];
  if (clean.length <= limit) return [clean];
  const sentences = clean.match(/[^.!?…]+[.!?…]*\s*/g) || [clean];
  const segments = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + sentence).length > limit && current) { segments.push(current.trim()); current = ""; }
    current += sentence;
  }
  if (current.trim()) segments.push(current.trim());
  return segments;
}

export class VoiceNarrator {
  constructor() {
    this.enabled = false;
    this.queue = [];
    this.audio = null;
    this.playing = false;
    // Bumped by stop(): in-flight fetch/playback loops compare against it and bail out, so a
    // closed popup can never keep talking over the next scene.
    this.generation = 0;
    // Handle to force-finish the in-flight segment; set by play(), used by stop().
    this.settleCurrent = null;
    // Optional callback(speaking: boolean) — fires true when a segment starts speaking and
    // false when the queue truly drains. The background score ducks on it, game-style.
    this.onSpeaking = null;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) this.stop();
  }

  /** Appends lines [{speakerId, text}]. Call stop() first when new content supersedes old. */
  enqueue(lines) {
    if (!this.enabled) return;
    for (const line of lines || []) {
      for (const segment of splitIntoSegments(line?.text)) {
        this.queue.push({ speakerId: line.speakerId, text: segment });
      }
    }
    if (!this.playing) this.drain();
  }

  async drain() {
    if (this.playing) return;
    this.playing = true;
    let generation = this.generation;
    let pending = null;
    while (this.enabled) {
      if (generation !== this.generation) {
        // Superseded mid-flight (stop() ran — e.g. the visitor answered before the masters
        // finished). Do NOT exit: drop the stale prefetch, adopt the new generation, and keep
        // draining whatever was enqueued after the stop. Exiting here is the bug where a
        // mid-narration choice silenced every line that followed.
        if (pending) pending.then(url => { if (url) URL.revokeObjectURL(url); });
        pending = null;
        generation = this.generation;
      }
      if (!pending) {
        if (!this.queue.length) break;
        pending = this.fetchSegment(this.queue.shift()).catch(() => null);
      }
      const url = await pending;
      // Prefetch the next segment while this one speaks — no dead air between masters.
      pending = this.queue.length ? this.fetchSegment(this.queue.shift()).catch(() => null) : null;
      if (!url) continue;
      if (generation !== this.generation) { URL.revokeObjectURL(url); continue; }
      await this.play(url);
    }
    if (pending) pending.then(url => { if (url) URL.revokeObjectURL(url); });
    this.playing = false;
    // A line enqueued in the gap between the loop's last queue check and the flag flip above
    // would otherwise wait for the next enqueue; pick it up now (still speaking, no unduck).
    if (this.enabled && this.queue.length) { this.drain(); return; }
    this.onSpeaking?.(false);
  }

  async fetchSegment({ speakerId, text }) {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ speakerId, text })
    });
    if (!response.ok) throw new Error(`TTS request failed (${response.status})`);
    return URL.createObjectURL(await response.blob());
  }

  play(url) {
    return new Promise(resolve => {
      const audio = new Audio(url);
      this.audio = audio;
      let settled = false;
      // Watchdog: if `ended` never fires (decode stall, backgrounded tab, headless), the queue
      // must still advance — one stuck segment may not silence every master after it.
      let watchdog = setTimeout(() => done(), 20_000);
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        URL.revokeObjectURL(url);
        if (this.audio === audio) this.audio = null;
        if (this.settleCurrent === done) this.settleCurrent = null;
        resolve();
      };
      // stop() force-finishes the in-flight segment through this handle — a paused audio
      // element never fires `ended`, so without it the queue would sit silent until the
      // watchdog expired.
      this.settleCurrent = done;
      this.onSpeaking?.(true);
      audio.addEventListener("loadedmetadata", () => {
        clearTimeout(watchdog);
        watchdog = setTimeout(done, (Number.isFinite(audio.duration) ? audio.duration : 15) * 1000 + 2500);
      }, { once: true });
      audio.addEventListener("ended", done, { once: true });
      audio.addEventListener("error", done, { once: true });
      audio.play().catch(done);
    });
  }

  stop() {
    this.generation += 1;
    this.queue = [];
    if (this.audio) { this.audio.pause(); this.audio.src = ""; this.audio = null; }
    // Resolve the awaited play() NOW so the drain loop can move on to whatever is enqueued
    // next, instead of waiting out the watchdog in silence.
    this.settleCurrent?.();
  }
}
