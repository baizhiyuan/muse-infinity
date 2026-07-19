const WORLD_LABS_BASE = "https://api.worldlabs.ai/marble/v1";

function requireKey() {
  const key = process.env.WORLDLABS_API_KEY;
  if (!key) throw new Error("WORLDLABS_API_KEY is not configured on the server.");
  return key;
}

function safeId(value, label) {
  const id = String(value || "");
  if (!/^[a-zA-Z0-9_-]{6,160}$/.test(id)) throw new Error(`Invalid ${label}.`);
  return id;
}

function safeHttpsUrl(value) {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("World input images must use a public HTTPS URL.");
  return url.toString();
}

async function worldLabsRequest(path, { method = "GET", body } = {}) {
  const response = await fetch(`${WORLD_LABS_BASE}${path}`, {
    method,
    headers: {
      "WLT-Api-Key": requireKey(),
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { message: text.slice(0, 500) }; }
  if (!response.ok) throw new Error(`World Labs returned ${response.status}: ${payload.detail || payload.message || "request failed"}`);
  return payload;
}

export function worldLabsConfigured() {
  return Boolean(process.env.WORLDLABS_API_KEY);
}

export async function generateWorld({ prompt, displayName, imageUrl, model, publicWorld = false, seed, tags = [] } = {}) {
  const textPrompt = String(prompt || "").trim().slice(0, 4000);
  const sourceImage = safeHttpsUrl(imageUrl);
  if (!textPrompt && !sourceImage) throw new Error("A world prompt or public HTTPS image URL is required.");

  const worldPrompt = sourceImage
    ? { type: "image", image_prompt: { source: "uri", uri: sourceImage }, ...(textPrompt ? { text_prompt: textPrompt } : {}) }
    : { type: "text", text_prompt: textPrompt, disable_recaption: false };
  const payload = {
    world_prompt: worldPrompt,
    display_name: String(displayName || "MUSE Infinity World").trim().slice(0, 120),
    model: String(model || process.env.WORLDLABS_MODEL || "marble-1.1"),
    permission: { allow_id_access: false, allowed_readers: [], allowed_writers: [], public: Boolean(publicWorld) },
    tags: Array.isArray(tags) ? tags.slice(0, 8).map(tag => String(tag).slice(0, 40)) : ["muse-infinity"]
  };
  if (Number.isInteger(seed)) payload.seed = Math.max(0, Math.min(2147483647, seed));
  return worldLabsRequest("/worlds:generate", { method: "POST", body: payload });
}

export async function getWorldOperation(operationId) {
  return worldLabsRequest(`/operations/${encodeURIComponent(safeId(operationId, "operation id"))}`);
}
