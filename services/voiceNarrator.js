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
    this.playing = true;
    const generation = this.generation;
    let pending = null;
    while (this.enabled && generation === this.generation) {
      if (!pending) {
        if (!this.queue.length) break;
        pending = this.fetchSegment(this.queue.shift()).catch(() => null);
      }
      const url = await pending;
      // Prefetch the next segment while this one speaks — no dead air between masters.
      pending = this.queue.length ? this.fetchSegment(this.queue.shift()).catch(() => null) : null;
      if (!url) continue;
      if (generation !== this.generation) { URL.revokeObjectURL(url); break; }
      await this.play(url);
    }
    if (pending) pending.then(url => { if (url) URL.revokeObjectURL(url); });
    this.playing = false;
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
        resolve();
      };
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
  }
}
