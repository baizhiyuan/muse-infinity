const allowedProtocols = new Set(["https:", "http:"]);

function isSafePublicUrl(value) {
  try {
    const url = new URL(value);
    return allowedProtocols.has(url.protocol);
  } catch {
    return false;
  }
}

export class WorldLabsAdapter {
  constructor({ container, onState, timeoutMs = 8000 }) {
    this.container = container;
    this.onState = onState;
    this.timeoutMs = timeoutMs;
    this.frame = null;
    this.timer = null;
    this.state = "idle";
  }

  setState(state, detail = "") {
    this.state = state;
    this.onState?.({ state, detail });
  }

  async load(config) {
    this.dispose();
    if (!config || config.sourceType === "mock" || !config.worldUrl) {
      this.setState("fallback", config?.fallbackSceneId || "local-particles");
      return { state: "fallback" };
    }
    if (config.sourceType !== "embed" || !isSafePublicUrl(config.worldUrl)) {
      this.setState("fallback", "unsupported-world-source");
      return { state: "fallback" };
    }

    this.setState("loading", config.title);
    const frame = document.createElement("iframe");
    frame.className = "world-labs-frame";
    frame.title = `${config.title} — World Labs environment`;
    frame.src = config.worldUrl;
    frame.loading = "eager";
    frame.allow = "fullscreen; autoplay; xr-spatial-tracking";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.addEventListener("load", () => {
      clearTimeout(this.timer);
      frame.classList.add("ready");
      this.setState("ready", config.title);
    }, { once: true });
    frame.addEventListener("error", () => this.fail("world-load-error"), { once: true });
    this.container.append(frame);
    this.frame = frame;
    this.timer = setTimeout(() => this.fail("world-load-timeout"), this.timeoutMs);
    return { state: "loading" };
  }

  fail(reason) {
    this.disposeFrame();
    this.setState("fallback", reason);
  }

  setVisible(visible) {
    this.container.classList.toggle("visible", visible && this.state === "ready");
  }

  disposeFrame() {
    clearTimeout(this.timer);
    this.timer = null;
    this.frame?.remove();
    this.frame = null;
  }

  dispose() {
    this.disposeFrame();
    this.container.classList.remove("visible");
    this.state = "idle";
  }
}
