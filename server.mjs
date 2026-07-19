import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, normalize, resolve, sep } from "node:path";
import { generateWorld, getWorldOperation, worldLabsConfigured } from "./services/worldLabsApi.js";
import { animateTripoModel, checkTripoRig, generateTripoModel, generateTripoMultiviewModel, getTripoTask, rigTripoModel, tripoConfigured } from "./services/tripoApi.js";
import { salonParticipants } from "./config/museumAssets.js";

// LLM config: prefer LLM_* (OpenAI-compatible proxy, e.g. baizhiyuan); fall back to OPENAI_*.
const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
const LLM_BASE_URL = (process.env.LLM_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
const LLM_MODEL = process.env.LLM_MODEL || process.env.OPENAI_MODEL || "gpt-5.6";

const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const root = process.cwd();
const rootPath = resolve(root);
const publicFiles = new Set([
  "index.html",
  "app.js",
  "styles.css",
  "worlds.json",
  "services/museumCollections.js",
  "services/voiceConversation.js",
  "services/worldLabs.js"
]);
const publicDirectories = ["assets/", "config/", "lib/", "node_modules/three/build/", "node_modules/three/examples/jsm/"];
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

const artworkCache = new Map();

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(payload));
}

function safeEqual(actual, expected) {
  const actualBuffer = Buffer.from(String(actual || ""));
  const expectedBuffer = Buffer.from(String(expected || ""));
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function authorizeIntegrationRequest(request, response) {
  const expected = process.env.INTEGRATION_ADMIN_TOKEN;
  if (!expected) {
    sendJson(response, 503, { error: "INTEGRATION_ADMIN_TOKEN is not configured on the server." });
    return false;
  }
  const authorization = String(request.headers.authorization || "");
  const actual = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!safeEqual(actual, expected)) {
    sendJson(response, 401, { error: "A valid integration admin bearer token is required." });
    return false;
  }
  return true;
}

function resolvePublicPath(rawPath) {
  const decoded = decodeURIComponent(rawPath);
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const safePath = normalize(relative).replaceAll("\\", "/");
  if (!safePath || safePath === "." || safePath.startsWith("../") || safePath.includes("/../")) return null;
  if (safePath.split("/").some(segment => segment.startsWith("."))) return null;
  if (!publicFiles.has(safePath) && !publicDirectories.some(directory => safePath.startsWith(directory))) return null;
  const absolutePath = resolve(rootPath, safePath);
  if (absolutePath !== rootPath && !absolutePath.startsWith(`${rootPath}${sep}`)) return null;
  return { absolutePath, safePath };
}

async function readBody(request, limit = 64_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function extractResponseText(payload) {
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && content.text) return content.text;
    }
  }
  return "";
}

function localDialogue({ question, companions = [], artwork }) {
  const speaker = companions[0]?.name || "MUSE";
  const work = artwork?.title ? `${artwork.title} by ${artwork.artist}` : "the work in front of us";
  const lower = String(question || "").toLowerCase();
  let text = `Look again at ${work}. Before deciding what it means, notice which detail your first interpretation ignored. What changed when you gave that detail your attention?`;
  if (lower.includes("feel") || lower.includes("emotion")) text = `${work} does not contain a single emotion; it stages a meeting between the light in the image and the memory you brought into the room.`;
  if (lower.includes("ai") || lower.includes("machine")) text = `A machine can multiply interpretations of ${work}, but the human responsibility is choosing which interpretation deserves to change the room.`;
  return { speaker, text, effect: "mist", live: false, model: "local-curated-fallback" };
}

async function handleDialogue(request, response) {
  const body = JSON.parse(await readBody(request) || "{}");
  if (!body.question || typeof body.question !== "string") return sendJson(response, 400, { error: "A question is required." });
  const fallback = localDialogue(body);
  const apiKey = LLM_API_KEY;
  if (!apiKey) return sendJson(response, 200, fallback);

  const companions = Array.isArray(body.companions) ? body.companions.slice(0, 3).map(item => String(item.name || "")).filter(Boolean) : [];
  const artwork = body.artwork || {};
  const prompt = [
    `Visitor question: ${body.question.slice(0, 1200)}`,
    `Companions available: ${companions.join(", ") || "MUSE curator"}`,
    `Artwork in focus: ${artwork.title || "unknown"} by ${artwork.artist || "unknown"}, ${artwork.date || "date unknown"}`
  ].join("\n");

  try {
    const openaiResponse = await fetch(`${LLM_BASE_URL}/v1/responses`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: LLM_MODEL,
        store: false,
        instructions: "You orchestrate a live museum walk. Speak through exactly one of the available historical companions as an explicitly interpretive AI perspective, never as an authentic quotation, endorsement, or impersonation. Ground the answer in the artwork named in the context. Be vivid, conversational, and under 55 words. End with a perceptive question only when it genuinely advances the visitor's looking. Choose one visual effect from mist, fracture, garden, network, or light.",
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "museum_dialogue",
            strict: true,
            schema: {
              type: "object",
              properties: {
                speaker: { type: "string" },
                text: { type: "string" },
                effect: { type: "string", enum: ["mist", "fracture", "garden", "network", "light"] }
              },
              required: ["speaker", "text", "effect"],
              additionalProperties: false
            }
          }
        }
      })
    });
    if (!openaiResponse.ok) throw new Error(`OpenAI returned ${openaiResponse.status}`);
    const payload = await openaiResponse.json();
    const parsed = JSON.parse(extractResponseText(payload));
    sendJson(response, 200, { ...parsed, live: true, model: LLM_MODEL });
  } catch (error) {
    sendJson(response, 200, { ...fallback, warning: error.message });
  }
}

async function handleArtworks(url, response) {
  const query = (url.searchParams.get("q") || "Claude Monet").slice(0, 100);
  const cached = artworkCache.get(query);
  if (cached && Date.now() - cached.time < 10 * 60_000) return sendJson(response, 200, cached.payload);
  const endpoint = new URL("https://api.artic.edu/api/v1/artworks/search");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("limit", "12");
  endpoint.searchParams.set("fields", "id,title,artist_title,artist_display,date_display,image_id,is_public_domain");
  const museumResponse = await fetch(endpoint, { headers: { "user-agent": "MUSE-Infinity/0.2 (open-access museum demo)" } });
  if (!museumResponse.ok) throw new Error(`Museum API returned ${museumResponse.status}`);
  const source = await museumResponse.json();
  const iiif = source.config?.iiif_url || "https://www.artic.edu/iiif/2";
  const artworks = (source.data || []).filter(item => item.is_public_domain && item.image_id).map(item => ({
    id: `aic-${item.id}`,
    title: item.title || "Untitled",
    artist: item.artist_title || String(item.artist_display || "Unknown artist").split("\n")[0],
    date: item.date_display || "Date unknown",
    image: `${iiif}/${item.image_id}/full/843,/0/default.jpg`,
    source: "Art Institute of Chicago",
    sourceUrl: `https://www.artic.edu/artworks/${item.id}`,
    rights: "Public-domain artwork image via Art Institute of Chicago Open Access / IIIF"
  }));
  const payload = { artworks, source: "Art Institute of Chicago Open Access API", query };
  artworkCache.set(query, { time: Date.now(), payload });
  sendJson(response, 200, payload);
}

async function handleRealtimeSession(request, response) {
  if (!LLM_API_KEY) return sendJson(response, 503, { error: "LLM API key is not configured on the server." });
  const sdp = await readBody(request, 200_000);
  const form = new FormData();
  form.set("sdp", sdp);
  form.set("session", JSON.stringify({
    type: "realtime",
    model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1",
    instructions: "You are an interpretive museum companion. Never claim to be the real historical figure and never present generated language as an authentic quotation.",
    audio: { output: { voice: "marin" } }
  }));
  const openaiResponse = await fetch(`${LLM_BASE_URL}/v1/realtime/calls`, {
    method: "POST",
    headers: { authorization: `Bearer ${LLM_API_KEY}` },
    body: form
  });
  const answer = await openaiResponse.text();
  response.writeHead(openaiResponse.status, { "content-type": openaiResponse.headers.get("content-type") || "application/sdp" });
  response.end(answer);
}

async function handleIntegrationRoute(request, response, url) {
  const path = url.pathname;
  if (request.method === "GET" && path === "/api/integrations/status") {
    return sendJson(response, 200, {
      openai: Boolean(LLM_API_KEY),
      worldLabs: worldLabsConfigured(),
      tripo: tripoConfigured()
    });
  }
  const isPublicCharacterManifest = request.method === "GET" && path === "/api/tripo/characters";
  if ((path.startsWith("/api/worlds/") || (path.startsWith("/api/tripo/") && !isPublicCharacterManifest)) && !authorizeIntegrationRequest(request, response)) {
    return;
  }
  if (request.method === "POST" && path === "/api/worlds/generate") {
    return sendJson(response, 202, await generateWorld(JSON.parse(await readBody(request, 128_000) || "{}")));
  }
  if (request.method === "GET" && path.startsWith("/api/worlds/operations/")) {
    return sendJson(response, 200, await getWorldOperation(decodeURIComponent(path.slice("/api/worlds/operations/".length))));
  }
  if (request.method === "POST" && path === "/api/tripo/models") {
    return sendJson(response, 202, await generateTripoModel(JSON.parse(await readBody(request, 128_000) || "{}")));
  }
  if (request.method === "POST" && path === "/api/tripo/multiview") {
    return sendJson(response, 202, await generateTripoMultiviewModel(JSON.parse(await readBody(request, 128_000) || "{}")));
  }
  if (request.method === "GET" && path === "/api/tripo/characters") {
    return sendJson(response, 200, {
      characters: salonParticipants.map(({ id, fullName, views, model }) => ({ id, fullName, views, model }))
    });
  }
  if (request.method === "POST" && path.startsWith("/api/tripo/characters/")) {
    const characterId = decodeURIComponent(path.slice("/api/tripo/characters/".length));
    const character = salonParticipants.find(item => item.id === characterId);
    if (!character?.views?.length) return sendJson(response, 404, { error: "Character multiview assets were not found." });
    const body = JSON.parse(await readBody(request, 64_000) || "{}");
    const publicBaseUrl = String(body.publicBaseUrl || process.env.PUBLIC_APP_URL || "");
    if (!publicBaseUrl) return sendJson(response, 400, { error: "Set PUBLIC_APP_URL to the deployed public HTTPS app URL." });
    const base = new URL(publicBaseUrl);
    if (base.protocol !== "https:" || base.username || base.password) {
      return sendJson(response, 400, { error: "PUBLIC_APP_URL must be the deployed public HTTPS app URL." });
    }
    const baseWithSlash = new URL(base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`, base.origin);
    const imageUrls = character.views.map(assetPath => new URL(assetPath, baseWithSlash).toString());
    const task = await generateTripoMultiviewModel({
      imageUrls,
      faceLimit: Number.isInteger(body.faceLimit) ? body.faceLimit : 12_000,
      texture: body.texture !== false,
      pbr: body.pbr !== false,
      textureAlignment: body.textureAlignment || "original_image",
      orientation: body.orientation || "align_image"
    });
    return sendJson(response, 202, { character: { id: character.id, fullName: character.fullName }, views: imageUrls, task });
  }
  if (request.method === "GET" && path.startsWith("/api/tripo/tasks/")) {
    return sendJson(response, 200, await getTripoTask(decodeURIComponent(path.slice("/api/tripo/tasks/".length))));
  }
  if (request.method === "POST" && path === "/api/tripo/rig-check") {
    const body = JSON.parse(await readBody(request, 64_000) || "{}");
    return sendJson(response, 200, await checkTripoRig(body.input));
  }
  if (request.method === "POST" && path === "/api/tripo/rig") {
    return sendJson(response, 202, await rigTripoModel(JSON.parse(await readBody(request, 64_000) || "{}")));
  }
  if (request.method === "POST" && path === "/api/tripo/retarget") {
    return sendJson(response, 202, await animateTripoModel(JSON.parse(await readBody(request, 64_000) || "{}")));
  }
  return false;
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const rawPath = url.pathname;
    if (request.method === "POST" && rawPath === "/api/dialogue") return await handleDialogue(request, response);
    if (request.method === "GET" && rawPath === "/api/artworks") return await handleArtworks(url, response);
    if (request.method === "POST" && rawPath === "/api/realtime/session") return await handleRealtimeSession(request, response);
    if (rawPath.startsWith("/api/integrations/") || rawPath.startsWith("/api/worlds/") || rawPath.startsWith("/api/tripo/")) {
      const handled = await handleIntegrationRoute(request, response, url);
      if (handled !== false) return handled;
      return sendJson(response, 404, { error: "Unknown integration route." });
    }
    const publicPath = resolvePublicPath(rawPath);
    if (!publicPath) throw new Error("Not found");
    const body = await readFile(publicPath.absolutePath);
    response.writeHead(200, { "content-type": mime[extname(publicPath.safePath)] || "application/octet-stream" });
    response.end(body);
  } catch (error) {
    if (request.url?.startsWith("/api/")) {
      const status = String(error.message || "").includes("_API_KEY is not configured") ? 503 : 500;
      return sendJson(response, status, { error: error.message || "Request failed" });
    }
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, host, () => {
  console.log(`MUSE∞ is running at http://${host}:${port}`);
});
