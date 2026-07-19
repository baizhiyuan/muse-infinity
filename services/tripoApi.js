const TRIPO_BASE = "https://api.tripo3d.ai/v2/openapi";
const DEFAULT_MODEL_VERSION = "P1-20260311";
const DEFAULT_RIG_VERSION = "v2.5-20250123";

function requireKey() {
  const key = process.env.TRIPO_API_KEY;
  if (!key) throw new Error("TRIPO_API_KEY is not configured on the server.");
  return key;
}

function safeId(value, label = "task id") {
  const id = String(value || "");
  if (!/^[a-zA-Z0-9_-]{6,180}$/.test(id)) throw new Error(`Invalid ${label}.`);
  return id;
}

function safeHttpsUrl(value) {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Tripo image inputs must use a public HTTPS URL without embedded credentials.");
  }
  return url.toString();
}

function imageFile({ url, fileToken, object } = {}) {
  const populated = [url, fileToken, object].filter(Boolean);
  if (populated.length !== 1) throw new Error("Each Tripo image requires exactly one URL, file token, or uploaded object.");
  if (url) return { type: "image", url: safeHttpsUrl(url) };
  if (fileToken) return { type: "image", file_token: safeId(fileToken, "file token") };
  const bucket = String(object?.bucket || "");
  const key = String(object?.key || "");
  if (!/^[a-zA-Z0-9._-]{2,100}$/.test(bucket) || !key || key.length > 1200 || key.includes("..")) {
    throw new Error("Invalid Tripo uploaded object.");
  }
  return { type: "image", object: { bucket, key } };
}

function generationOptions(input = {}) {
  const options = {
    model_version: String(input.modelVersion || input.model || process.env.TRIPO_MODEL || DEFAULT_MODEL_VERSION),
    texture: input.texture !== false,
    pbr: input.pbr !== false
  };
  if (Number.isInteger(input.faceLimit)) options.face_limit = Math.max(48, Math.min(20_000, input.faceLimit));
  if (Number.isInteger(input.modelSeed)) options.model_seed = input.modelSeed;
  if (["standard", "detailed"].includes(input.textureQuality)) options.texture_quality = input.textureQuality;
  if (["original_image", "geometry"].includes(input.textureAlignment)) options.texture_alignment = input.textureAlignment;
  if (["default", "align_image"].includes(input.orientation)) options.orientation = input.orientation;
  if (input.autoSize === true) options.auto_size = true;
  if (input.compress === "geometry") options.compress = "geometry";
  return options;
}

async function tripoRequest(path, { method = "GET", body } = {}) {
  const response = await fetch(`${TRIPO_BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${requireKey()}`,
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { message: text.slice(0, 500) }; }
  if (!response.ok || (typeof payload.code === "number" && payload.code !== 0)) {
    throw new Error(`Tripo returned ${response.status}: ${payload.message || payload.error || "request failed"}`);
  }
  return payload;
}

export function tripoConfigured() {
  return Boolean(process.env.TRIPO_API_KEY);
}

export async function generateTripoModel(input = {}) {
  const options = generationOptions(input);
  if (input.imageUrl || input.fileToken || input.object) {
    const file = imageFile({ url: input.imageUrl, fileToken: input.fileToken, object: input.object });
    return tripoRequest("/task", { method: "POST", body: { type: "image_to_model", file, ...options } });
  }

  const prompt = String(input.prompt || "").trim();
  if (!prompt) throw new Error("A Tripo prompt, public HTTPS image URL, file token, or uploaded object is required.");
  const body = { type: "text_to_model", prompt: prompt.slice(0, 1024), ...options };
  if (input.negativePrompt) body.negative_prompt = String(input.negativePrompt).slice(0, 255);
  return tripoRequest("/task", { method: "POST", body });
}

export async function generateTripoMultiviewModel(input = {}) {
  const options = generationOptions(input);
  if (input.originalTaskId) {
    return tripoRequest("/task", {
      method: "POST",
      body: { type: "multiview_to_model", original_task_id: safeId(input.originalTaskId), ...options }
    });
  }

  let files;
  if (Array.isArray(input.imageUrls)) files = input.imageUrls.map(url => imageFile({ url }));
  else if (Array.isArray(input.fileTokens)) files = input.fileTokens.map(fileToken => imageFile({ fileToken }));
  else if (Array.isArray(input.files)) files = input.files.map(file => imageFile(file));
  else throw new Error("Four Tripo views are required in front, left, back, right order.");

  if (files.length !== 4) throw new Error("Tripo multiview generation requires exactly four views: front, left, back, right.");
  return tripoRequest("/task", { method: "POST", body: { type: "multiview_to_model", files, ...options } });
}

export async function getTripoTask(taskId) {
  return tripoRequest(`/task/${encodeURIComponent(safeId(taskId))}`);
}

export async function checkTripoRig(input) {
  return tripoRequest("/task", {
    method: "POST",
    body: {
      type: "animate_prerigcheck",
      original_model_task_id: safeId(input, "model task id"),
      model_version: process.env.TRIPO_RIG_MODEL || DEFAULT_RIG_VERSION
    }
  });
}

export async function rigTripoModel({ input, rigType = "biped", spec = "tripo" } = {}) {
  return tripoRequest("/task", {
    method: "POST",
    body: {
      type: "animate_rig",
      original_model_task_id: safeId(input, "model task id"),
      rig_type: String(rigType),
      spec: String(spec),
      out_format: "glb",
      model_version: process.env.TRIPO_RIG_MODEL || DEFAULT_RIG_VERSION
    }
  });
}

export async function animateTripoModel({ input, animations = ["preset:idle", "preset:walk"] } = {}) {
  const allowed = new Set([
    "preset:idle", "preset:walk", "preset:run", "preset:dive", "preset:climb", "preset:jump",
    "preset:slash", "preset:shoot", "preset:hurt", "preset:fall", "preset:turn"
  ]);
  const safeAnimations = Array.isArray(animations) ? animations.slice(0, 5).map(String).filter(value => allowed.has(value)) : [];
  if (!safeAnimations.length) throw new Error("At least one supported Tripo animation preset is required.");
  return tripoRequest("/task", {
    method: "POST",
    body: {
      type: "animate_retarget",
      original_model_task_id: safeId(input, "rigged model task id"),
      animations: safeAnimations,
      out_format: "glb",
      bake_animation: true,
      export_with_geometry: true
    }
  });
}
