export class VoiceConversation {
  constructor({ context, onState, onUserText, onReply }) {
    this.context = context;
    this.onState = onState;
    this.onUserText = onUserText;
    this.onReply = onReply;
    this.recognition = null;
  }

  async ask(question) {
    const clean = question.trim();
    if (!clean) return;
    this.onUserText?.(clean);
    this.onState?.("thinking");
    try {
      const response = await fetch("/api/dialogue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: clean, ...this.context() })
      });
      if (!response.ok) throw new Error(`Dialogue request failed (${response.status})`);
      const reply = await response.json();
      this.onReply?.(reply);
      this.speak(reply.text);
      this.onState?.(reply.live ? "live" : "local");
    } catch (error) {
      this.onReply?.({ speaker: "MUSE", text: "The live conversation is unavailable, but the gallery remains open. Try the question again when the model connection is restored.", live: false, error: error.message });
      this.onState?.("offline");
    }
  }

  listen() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      this.onState?.("unsupported");
      return;
    }
    this.recognition?.abort?.();
    const recognition = new Recognition();
    recognition.lang = document.documentElement.lang === "zh" ? "zh-CN" : "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => this.onState?.("listening");
    recognition.onerror = () => this.onState?.("offline");
    recognition.onend = () => {
      if (this.recognition === recognition) this.recognition = null;
    };
    recognition.onresult = event => {
      const text = event.results?.[0]?.[0]?.transcript || "";
      if (text) this.ask(text);
    };
    this.recognition = recognition;
    recognition.start();
  }

  speak(text) {
    if (!window.speechSynthesis || !text) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.94;
    utterance.pitch = 0.92;
    speechSynthesis.speak(utterance);
  }

  dispose() {
    this.recognition?.abort?.();
    window.speechSynthesis?.cancel?.();
  }
}
