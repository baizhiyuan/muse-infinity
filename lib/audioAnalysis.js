export class AudioReactiveSignal {
  constructor() {
    this.context = null;
    this.analyser = null;
    this.data = null;
    this.source = null;
    this.simulationEnabled = true;
    this.smoothed = { amplitude: 0, low: 0, mid: 0, high: 0 };
  }

  async attachMediaElement(element) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext || !element) return false;
    this.context ||= new AudioContext();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.82;
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
    this.source = this.context.createMediaElementSource(element);
    this.source.connect(this.analyser).connect(this.context.destination);
    this.simulationEnabled = false;
    return true;
  }

  sample(time, speaking = false) {
    let target;
    if (this.analyser && this.data) {
      this.analyser.getByteFrequencyData(this.data);
      const average = (start, end) => {
        let sum = 0;
        for (let i = start; i < end; i += 1) sum += this.data[i] || 0;
        return sum / Math.max(1, end - start) / 255;
      };
      target = {
        low: average(0, 12), mid: average(12, 45), high: average(45, 110),
        amplitude: average(0, this.data.length)
      };
    } else {
      const pulse = speaking ? 0.19 + Math.abs(Math.sin(time * 5.3)) * 0.28 : 0.025;
      target = { amplitude: pulse, low: pulse * .72, mid: pulse, high: pulse * .42 };
    }
    for (const key of Object.keys(this.smoothed)) {
      this.smoothed[key] += (target[key] - this.smoothed[key]) * 0.12;
    }
    return this.smoothed;
  }
}
