export const QUALITY = {
  high: { particles: 2200, dpr: 1.75, trails: true },
  medium: { particles: 1250, dpr: 1.35, trails: true },
  low: { particles: 620, dpr: 1, trails: false }
};

export class PerformanceController {
  constructor({ initial = "auto", onChange }) {
    this.mode = initial;
    this.resolved = initial === "auto" ? "medium" : initial;
    this.onChange = onChange;
    this.frames = [];
    this.lastChange = 0;
  }

  frame(now) {
    if (this.mode !== "auto") return;
    this.frames.push(now);
    while (this.frames.length && now - this.frames[0] > 4000) this.frames.shift();
    if (this.frames.length < 90 || now - this.lastChange < 8000) return;
    const seconds = (this.frames.at(-1) - this.frames[0]) / 1000;
    const fps = seconds > 0 ? (this.frames.length - 1) / seconds : 60;
    const next = fps < 38 ? "low" : fps > 56 ? "high" : "medium";
    if (next !== this.resolved) {
      this.resolved = next;
      this.lastChange = now;
      this.onChange?.(next, fps);
    }
  }

  toggle() {
    const sequence = ["auto", "high", "low"];
    this.mode = sequence[(sequence.indexOf(this.mode) + 1) % sequence.length];
    this.resolved = this.mode === "auto" ? "medium" : this.mode;
    this.frames.length = 0;
    this.onChange?.(this.resolved, null);
    return this.mode;
  }

  config() {
    return QUALITY[this.resolved];
  }
}
