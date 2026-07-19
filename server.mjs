import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, normalize, resolve, sep } from "node:path";
import { generateWorld, getWorldOperation, worldLabsConfigured } from "./services/worldLabsApi.js";
import { animateTripoModel, checkTripoRig, generateTripoModel, generateTripoMultiviewModel, getTripoTask, rigTripoModel, tripoConfigured } from "./services/tripoApi.js";
import { salonParticipants } from "./config/museumAssets.js";
import { EFFECT_VOCABULARY, describeInvalidEffect } from "./config/effects.js";
import { TTS_MODEL, voiceForSpeaker } from "./config/masterVoices.js";

// LLM config: prefer LLM_* (OpenAI-compatible proxy, e.g. baizhiyuan); fall back to OPENAI_*.
const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
const LLM_BASE_URL = (process.env.LLM_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");

// Model choice is the AC3 latency lever, not an aesthetic preference.
//
// AC3 budgets a three-perspective turn at P50 <= 3.0s. `gpt-5.6` cannot reach it on this proxy:
// measured end-to-end it decodes at roughly 25 output tokens/second, and three ~55-word readings
// are ~250 output tokens, so the call floors out near 9-12s. The cost is decode throughput, not
// hidden reasoning — `reasoning.effort: "none"` was measured and moved the number by well under a
// second, because gpt-5.6 was already spending only ~40 reasoning tokens here. Shortening the word
// cap does not rescue it either: a SINGLE one-perspective gpt-5.6 call, shortest prompt tested,
// never came in under 4.4s. No arrangement of an ~25 tok/s model meets a 3s budget.
//
// `gpt-5.3-codex-spark` serves the identical strict-json_schema request in ~2.3-2.8s on the same
// proxy, same prompts, same three-perspective payload. It is a throughput difference, not a
// quality tradeoff dressed up as one — the arm/schema architecture below is unchanged.
const DEFAULT_LLM_MODEL = "gpt-5.3-codex-spark";
const LLM_MODEL = process.env.LLM_MODEL || process.env.OPENAI_MODEL || DEFAULT_LLM_MODEL;

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
  "services/voiceNarrator.js",
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

// One bounded retry. A second attempt is worth it for transport faults, 5xx, 429, and for a
// well-formed 200 carrying the wrong shape — a count/enum mismatch is exactly the stochastic
// failure a retry recovers. A non-429 4xx is a request defect: retrying only doubles the latency.
const LLM_RETRY_LIMIT = 1;

// A visitor-facing request must fail rather than hang. `fetch` has no default timeout, so without
// this a stalled proxy connection holds the turn open forever and the demo reads as frozen with
// nothing on stderr.
//
// This is a HANG-GUARD, not a latency control, and the distinction cost us the whole feature once:
// the previous 15s value was justified against a "~2.5s P50" that came from short synthetic prompts
// fired straight at the proxy. Measured through the server on the real ~5300-char payload, P50 is
// ~9.7s — so 15s was ~1.5x the median, not the wide margin the comment claimed, and gpt-5.6 sat
// past it entirely and 502'd on 6/6 requests with no clue as to why.
//
// Sized now against the real distribution: if spark's P95/P50 ratio resembles the ~2.1x measured on
// gpt-5.6, P95 lands near 20s. 45s clears that with room and still catches a genuinely dead socket.
// A timeout that fires on a merely-slow call converts a survivable wait into a 502 in front of an
// audience, which is the only stage-fatal failure mode this feature has.
const LLM_TIMEOUT_MS = 45_000;

function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

async function requestLLM({ instructions, input, schema }) {
  let llmResponse;
  try {
    llmResponse = await fetch(`${LLM_BASE_URL}/v1/responses`, {
      method: "POST",
      headers: { authorization: `Bearer ${LLM_API_KEY}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      body: JSON.stringify({
        model: LLM_MODEL,
        store: false,
        instructions,
        input,
        text: { format: { type: "json_schema", name: schema.name, strict: true, schema: schema.schema } }
      })
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    const detail = timedOut ? `no response within ${LLM_TIMEOUT_MS}ms` : error.message;
    throw Object.assign(new Error(`LLM transport failed: ${detail}`), { retryable: true });
  }

  if (!llmResponse.ok) {
    const detail = await llmResponse.text().catch(() => "");
    throw Object.assign(new Error(`LLM proxy returned ${llmResponse.status}: ${detail.slice(0, 300)}`), {
      retryable: isRetryableStatus(llmResponse.status)
    });
  }

  const payload = await llmResponse.json().catch(error => {
    throw Object.assign(new Error(`LLM envelope was not JSON: ${error.message}`), { retryable: true });
  });
  const text = extractResponseText(payload);
  if (!text) throw Object.assign(new Error("LLM response carried no output_text content."), { retryable: true });

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw Object.assign(new Error(`LLM output was not valid JSON: ${error.message}`), { retryable: true });
  }

  // Schema-conformance failure. strict json_schema makes this rare, not impossible.
  const problem = schema.validate?.(parsed);
  if (problem) throw Object.assign(new Error(`LLM output failed conformance: ${problem}`), { retryable: true });

  return parsed;
}

/**
 * Shared LLM entrypoint for every live endpoint. Owns the /v1/responses fetch, stderr logging,
 * one bounded retry, and throwing on failure. It NEVER returns canned prose — callers that want
 * a fallback must choose it explicitly and label it, so no failure can hide behind an HTTP 200.
 */
async function callLLM({ instructions, input, schema }) {
  if (!LLM_API_KEY) throw new Error("LLM_API_KEY is not configured on the server.");
  let lastError = null;
  for (let attempt = 1; attempt <= LLM_RETRY_LIMIT + 1; attempt += 1) {
    try {
      return await requestLLM({ instructions, input, schema });
    } catch (error) {
      lastError = error;
      console.error(
        `[llm] schema=${schema.name} model=${LLM_MODEL} attempt=${attempt}/${LLM_RETRY_LIMIT + 1} ` +
        `inputChars=${String(input || "").length} failed: ${error.message}`
      );
      if (!error.retryable) break;
    }
  }
  throw lastError;
}

/** One request returns this many parallel, non-interacting perspectives. */
const PERSPECTIVE_COUNT = 3;

/** Used to top up the roster when the visitor invited fewer than three companions. */
const DEFAULT_MASTER_IDS = ["monet", "van_gogh", "socrates"];

// The strict json_schema subset accepted by OpenAI-compatible proxies has no dependable
// array-length keyword. `minItems`/`maxItems` are not rejected by this proxy, but nothing
// proves they are ENFORCED, so relying on them would be faith, not a guarantee. The count is
// stated in prose and asserted below: that DETECTS a wrong count, it does not PREVENT one.
// A detected mismatch is retryable, which is why the weaker guarantee is survivable.
const perspectiveItemSchema = {
  type: "object",
  properties: {
    speakerId: { type: "string" },
    speaker: { type: "string" },
    text: { type: "string" },
    effect: { type: "string", enum: EFFECT_VOCABULARY }
  },
  required: ["speakerId", "speaker", "text", "effect"],
  additionalProperties: false
};

function describeInvalidPerspective(item) {
  if (!item || typeof item !== "object") return "perspective was not an object";
  if (typeof item.speakerId !== "string" || !item.speakerId.trim()) return "speakerId was empty";
  if (typeof item.speaker !== "string" || !item.speaker.trim()) return "speaker was empty";
  if (typeof item.text !== "string" || !item.text.trim()) return "text was empty";
  return describeInvalidEffect(item.effect);
}

/** Arm A: one call returning all three perspectives. */
const perspectivesSchema = {
  name: "museum_perspectives",
  schema: {
    type: "object",
    properties: { perspectives: { type: "array", items: perspectiveItemSchema } },
    required: ["perspectives"],
    additionalProperties: false
  },
  validate(parsed) {
    if (!parsed || typeof parsed !== "object") return "response was not an object";
    if (!Array.isArray(parsed.perspectives)) return "perspectives was not an array";
    if (parsed.perspectives.length !== PERSPECTIVE_COUNT) {
      return `expected ${PERSPECTIVE_COUNT} perspectives, received ${parsed.perspectives.length}`;
    }
    for (const item of parsed.perspectives) {
      const problem = describeInvalidPerspective(item);
      if (problem) return problem;
    }
    const ids = new Set(parsed.perspectives.map(item => item.speakerId.trim().toLowerCase()));
    if (ids.size !== PERSPECTIVE_COUNT) return "two perspectives claimed the same speakerId";
    return null;
  }
};

/** Arm B: one call per master, merged into the same response shape. */
const singlePerspectiveSchema = {
  name: "museum_perspective",
  schema: perspectiveItemSchema,
  validate: describeInvalidPerspective
};

/**
 * Resolves the visitor's invited companions to authored masters, topping up to exactly three.
 * A participant with no `lens` is skipped: three voices without three lenses are one voice
 * three times, which is the failure this whole feature exists to avoid.
 */
function selectMasters(companions) {
  const chosen = [];
  const seen = new Set();
  const take = participant => {
    if (!participant?.lens || seen.has(participant.id) || chosen.length >= PERSPECTIVE_COUNT) return;
    seen.add(participant.id);
    chosen.push(participant);
  };
  for (const item of Array.isArray(companions) ? companions : []) {
    take(salonParticipants.find(participant => participant.id === item?.id));
  }
  for (const id of DEFAULT_MASTER_IDS) take(salonParticipants.find(participant => participant.id === id));
  for (const participant of salonParticipants) take(participant);
  return chosen;
}

function describeArtwork(artwork = {}) {
  return `Artwork in focus: ${artwork.title || "unknown"} by ${artwork.artist || "unknown"} (${artwork.date || "date unknown"})`;
}

/** The master's authored lens, verbatim. Divergence is data, not a hope placed in one prompt. */
function describeMaster(master, index) {
  const { lens } = master;
  return [
    `--- PERSPECTIVE ${index + 1} ---`,
    `speakerId (copy verbatim): ${master.id}`,
    `speaker (copy verbatim): ${master.fullName}`,
    `Voice instruction, obey exactly: ${lens.systemPrompt}`,
    `Lens: ${lens.lens}`,
    `Attend only to: ${lens.attention.join("; ")}`,
    `Questioning style: ${lens.questionStyle}`,
    `Draw on this vocabulary: ${lens.vocabulary.join(", ")}`,
    `Never use these words: ${lens.forbidden.join(", ")}`
  ].join("\n");
}

// The compliance framing every attributed voice carries, on every endpoint. Stated once so a new
// endpoint cannot ship a subtly weaker version of the claim the product makes to its visitors.
const INTERPRETIVE_FRAMING =
  "Every perspective is an explicitly interpretive AI reading — never an authentic quotation, " +
  "never an endorsement, never impersonation of the real historical person.";

const PERSPECTIVE_RULES =
  `${INTERPRETIVE_FRAMING} Ground every ` +
  "perspective in the artwork named in the context. Answer the visitor's specific question rather " +
  "than restating the artwork, and vary the opening — a different question must produce a " +
  "differently-shaped reply, not one stock sentence with the nouns swapped. " +
  "Reply in English, under 55 words each. " +
  `Choose one visual effect per perspective from ${EFFECT_VOCABULARY.join(", ")}.`;

// The vocabulary lists are quarantined per master because this is a single call that can see all
// three of them. Without the quarantine a term leaks into a neighbouring voice whenever it also
// happens to describe the artwork literally, and the three readings stop being tellable apart.
const PARALLEL_INSTRUCTIONS =
  `You compose a museum wall of parallel readings. Return exactly ${PERSPECTIVE_COUNT} perspectives — ` +
  "one for each master described in the context, in the order given, and no others. The masters do " +
  "not address, answer, or acknowledge one another; each looks at the same artwork alone. Obey each " +
  "master's own voice instruction, vocabulary, and forbidden words. Each vocabulary belongs to its " +
  "own master alone: never let a term listed under one master appear in another master's " +
  "perspective, in any inflected form, even when it would literally describe what is depicted — " +
  "reach for a different word instead. " + PERSPECTIVE_RULES;

function buildPerspectiveInput({ question, masters, artwork }) {
  return [
    `Visitor question: ${question.slice(0, 1200)}`,
    describeArtwork(artwork),
    "",
    ...masters.map(describeMaster)
  ].join("\n");
}

/**
 * Re-anchors a model-claimed speakerId to a real master. The model is told to copy the ids; when
 * it does not, we map positionally rather than shipping a speaker the client cannot resolve.
 */
function resolveMaster(claimedId, masters, index, label) {
  const claimed = String(claimedId || "").trim().toLowerCase();
  const matched = masters.find(master => master.id === claimed);
  if (!matched) console.error(`[${label}] unknown speakerId "${claimedId}" mapped positionally to ${masters[index].id}`);
  return matched || masters[index];
}

function reconcilePerspectives(perspectives, masters) {
  return perspectives.map((item, index) => {
    const master = resolveMaster(item.speakerId, masters, index, "dialogue");
    return { speakerId: master.id, speaker: master.fullName, text: item.text.trim(), effect: item.effect };
  });
}

/** Arm A — one call, all three perspectives, one atomic success or failure. */
async function fetchPerspectivesTogether({ question, masters, artwork }) {
  const parsed = await callLLM({
    instructions: PARALLEL_INSTRUCTIONS,
    input: buildPerspectiveInput({ question, masters, artwork }),
    schema: perspectivesSchema
  });
  return reconcilePerspectives(parsed.perspectives, masters);
}

/** Arm B — three concurrent calls, one per master, merged into the identical response shape. */
async function fetchPerspectivesInParallel({ question, masters, artwork }) {
  const parsed = await Promise.all(masters.map(master => callLLM({
    instructions: `${master.lens.systemPrompt} ${PERSPECTIVE_RULES}`,
    input: buildPerspectiveInput({ question, masters: [master], artwork }),
    schema: singlePerspectiveSchema
  })));
  return reconcilePerspectives(parsed, masters);
}

/**
 * No-key offline mode. Returns the same three-perspective shape so the client never has to know
 * which mode produced it — but every entry is labelled, and none of it is model output.
 */
function localPerspectives({ question, masters, artwork }) {
  const work = artwork?.title ? `${artwork.title} by ${artwork.artist}` : "the work in front of us";
  const lower = String(question || "").toLowerCase();
  const angle = lower.includes("feel") || lower.includes("emotion")
    ? "what it asks you to feel"
    : lower.includes("ai") || lower.includes("machine")
      ? "what a machine can and cannot decide about it"
      : "what your first glance left out";
  return masters.map((master, index) => ({
    speakerId: master.id,
    speaker: master.fullName,
    text: `Offline reading ${index + 1}: through a lens of ${master.lens.attention[0]}, ${work} rewards asking ${angle}.`,
    effect: EFFECT_VOCABULARY[index % EFFECT_VOCABULARY.length]
  }));
}

async function handleDialogue(request, response, url) {
  const body = JSON.parse(await readBody(request) || "{}");
  if (!body.question || typeof body.question !== "string") return sendJson(response, 400, { error: "A question is required." });

  const masters = selectMasters(body.companions);
  const artwork = body.artwork || {};

  // Deliberate, documented exception to the honesty rule: running with no key configured is an
  // opt-in offline mode, not a disguised failure. It is labelled as such on the wire.
  if (!LLM_API_KEY) {
    return sendJson(response, 200, {
      perspectives: localPerspectives({ question: body.question, masters, artwork }),
      live: false,
      model: "local-curated-fallback",
      fallback: true,
      warning: "LOCAL FALLBACK — no API key configured"
    });
  }

  // Bake-off dispatch. Both arms return the identical shape, so the client never branches on it.
  // Without this the bake-off would run arm A twice and report the difference as noise.
  const arm = url?.searchParams.get("arm") === "B" ? "B" : "A";
  const fetchPerspectives = arm === "B" ? fetchPerspectivesInParallel : fetchPerspectivesTogether;

  try {
    const perspectives = await fetchPerspectives({ question: body.question, masters, artwork });
    sendJson(response, 200, { perspectives, live: true, model: LLM_MODEL, arm });
  } catch (error) {
    // No canned prose behind a 200. A failure must be visible to the client and to stderr.
    console.error(
      `[dialogue] arm=${arm} failed after retries: ${error.message} ` +
      `(question chars=${body.question.length}, masters=${masters.map(master => master.id).join(",")})`
    );
    sendJson(response, 502, {
      error: "The live dialogue model could not be reached.",
      warning: error.message,
      live: false,
      arm
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Closing roundtable — a synthesis of the walk the visitor actually took.
// ---------------------------------------------------------------------------------------------

/**
 * Server-side re-clamp of the visitor's trajectory digest.
 *
 * The client caps the same fields at construction, but a client cap is a product decision, not a
 * security boundary. This body crosses a trust boundary and flows straight into a paid prompt, so
 * the server re-derives every bound itself rather than trusting the client's discipline.
 */
const DIGEST_CAPS = {
  artworks: 5,
  questions: 3,
  perspectives: PERSPECTIVE_COUNT,
  scanLimit: 32,
  nameChars: 120,
  questionChars: 200,
  lineChars: 160
};

function clampText(value, limit) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, limit) : "";
}

function clampList(value, limit) {
  return (Array.isArray(value) ? value : []).slice(0, limit);
}

function clampDigest(raw = {}) {
  const visitedArtworks = clampList(raw.visitedArtworks, DIGEST_CAPS.artworks)
    .map(item => ({
      title: clampText(item?.title, DIGEST_CAPS.nameChars),
      artist: clampText(item?.artist, DIGEST_CAPS.nameChars)
    }))
    .filter(item => item.title);

  const askedQuestions = clampList(raw.askedQuestions, DIGEST_CAPS.questions)
    .map(item => clampText(item, DIGEST_CAPS.questionChars))
    .filter(Boolean);

  // One line per speaker. Scanning is itself bounded — a client sending 10k entries must not cost
  // us a 10k-element pass just to discover it only gets three of them through.
  const seen = new Set();
  const perspectiveLog = [];
  for (const item of clampList(raw.perspectiveLog, DIGEST_CAPS.scanLimit)) {
    if (perspectiveLog.length >= DIGEST_CAPS.perspectives) break;
    const speakerId = clampText(item?.speakerId, DIGEST_CAPS.nameChars).toLowerCase();
    const line = clampText(item?.line, DIGEST_CAPS.lineChars);
    if (!speakerId || !line || seen.has(speakerId)) continue;
    seen.add(speakerId);
    perspectiveLog.push({ speakerId, speaker: clampText(item?.speaker, DIGEST_CAPS.nameChars) || speakerId, line });
  }

  return { visitedArtworks, askedQuestions, perspectiveLog };
}

const roundtableThreadSchema = {
  type: "object",
  properties: {
    speakerId: { type: "string" },
    speaker: { type: "string" },
    text: { type: "string" }
  },
  required: ["speakerId", "speaker", "text"],
  additionalProperties: false
};

const roundtableSchema = {
  name: "museum_roundtable",
  schema: {
    type: "object",
    properties: {
      worldTitle: { type: "string" },
      synthesis: { type: "string" },
      threads: { type: "array", items: roundtableThreadSchema }
    },
    required: ["worldTitle", "synthesis", "threads"],
    additionalProperties: false
  },
  validate(parsed) {
    if (!parsed || typeof parsed !== "object") return "response was not an object";
    if (!clampText(parsed.worldTitle, 200)) return "worldTitle was empty";
    if (!clampText(parsed.synthesis, 200)) return "synthesis was empty";
    if (!Array.isArray(parsed.threads)) return "threads was not an array";
    if (parsed.threads.length !== PERSPECTIVE_COUNT) {
      return `expected ${PERSPECTIVE_COUNT} threads, received ${parsed.threads.length}`;
    }
    for (const thread of parsed.threads) {
      if (!thread || typeof thread !== "object") return "thread was not an object";
      if (!clampText(thread.speakerId, 200)) return "thread speakerId was empty";
      if (!clampText(thread.speaker, 200)) return "thread speaker was empty";
      if (!clampText(thread.text, 200)) return "thread text was empty";
    }
    const ids = new Set(parsed.threads.map(thread => thread.speakerId.trim().toLowerCase()));
    if (ids.size !== PERSPECTIVE_COUNT) return "two threads claimed the same speakerId";
    return null;
  }
};

const ROUNDTABLE_INSTRUCTIONS =
  "The visitor has finished walking the gallery and the masters now close the visit together. " +
  `Return exactly ${PERSPECTIVE_COUNT} threads, one for each master described in the context, in ` +
  "the order given. Each thread is that master's single closing remark about THIS visitor's walk, " +
  "spoken in that master's own lens and vocabulary, under 55 words, never addressing the other " +
  "masters. Then name the world these choices built. " +
  "The artworks the visitor stopped at and the questions they asked are listed verbatim in the " +
  "context — draw on those exact items and invent no others; if a list is empty, say so plainly " +
  "rather than inventing a stop or a question. " +
  "worldTitle: three to seven words, no quotation marks. " +
  "synthesis: 45 to 70 words addressed to the visitor as \"you\", naming at least one artwork they " +
  "actually stopped at and at least one question they actually asked. " +
  `${INTERPRETIVE_FRAMING} ` +
  "The interface renders that disclaimer beside every thread already, so do NOT write a disclaimer " +
  "sentence into the thread text or the synthesis — spending words restating it makes all three " +
  "threads share the same phrasing, which is the opposite of three distinct readings. " +
  "Reply in English.";

function describeDigest(digest) {
  const artworks = digest.visitedArtworks.length
    ? digest.visitedArtworks.map(item => `- ${item.title}${item.artist ? ` by ${item.artist}` : ""}`).join("\n")
    : "- (none: the visitor stopped at no artwork)";
  const questions = digest.askedQuestions.length
    ? digest.askedQuestions.map(item => `- ${item}`).join("\n")
    : "- (none: the visitor asked nothing aloud)";
  const readings = digest.perspectiveLog.length
    ? digest.perspectiveLog.map(item => `- ${item.speaker}: ${item.line}`).join("\n")
    : "- (none)";
  return [
    "Artworks this visitor actually stopped at, in order:",
    artworks,
    "",
    "Questions this visitor actually asked, in order:",
    questions,
    "",
    "What each master already told them during the walk:",
    readings
  ].join("\n");
}

function buildRoundtableInput({ digest, masters }) {
  return [describeDigest(digest), "", ...masters.map(describeMaster)].join("\n");
}

/**
 * No-key offline mode, same shape as the live path. It is assembled mechanically from the
 * visitor's own digest — it is not reasoning, and the response labels it as such.
 */
function localRoundtable({ digest, masters }) {
  const stop = digest.visitedArtworks[0];
  const work = stop ? `${stop.title}${stop.artist ? ` by ${stop.artist}` : ""}` : "the room you walked";
  const question = digest.askedQuestions[0] || "what you came here to ask";
  return {
    worldTitle: "The World Between Worlds",
    synthesis:
      `Offline synthesis: you stopped at ${work} and asked about ${question}. With no model ` +
      "configured this closing is assembled from your own trajectory rather than reasoned about.",
    threads: masters.map((master, index) => ({
      speakerId: master.id,
      speaker: master.fullName,
      text: `Offline reading ${index + 1}: through a lens of ${master.lens.attention[0]}, ${work} is where your walk keeps returning.`
    }))
  };
}

async function handleRoundtable(request, response) {
  const body = JSON.parse(await readBody(request) || "{}");
  const digest = clampDigest(body.session);
  const masters = selectMasters(body.companions);

  // Same documented exception as /api/dialogue: no key configured is an opt-in offline mode, and
  // it says so on the wire. Every other failure is a failure and is reported as one.
  if (!LLM_API_KEY) {
    return sendJson(response, 200, {
      ...localRoundtable({ digest, masters }),
      live: false,
      model: "local-curated-fallback",
      fallback: true,
      warning: "LOCAL FALLBACK — no API key configured"
    });
  }

  try {
    const parsed = await callLLM({
      instructions: ROUNDTABLE_INSTRUCTIONS,
      input: buildRoundtableInput({ digest, masters }),
      schema: roundtableSchema
    });
    sendJson(response, 200, {
      worldTitle: parsed.worldTitle.trim(),
      synthesis: parsed.synthesis.trim(),
      threads: parsed.threads.map((thread, index) => {
        const master = resolveMaster(thread.speakerId, masters, index, "roundtable");
        return { speakerId: master.id, speaker: master.fullName, text: thread.text.trim() };
      }),
      live: true,
      model: LLM_MODEL
    });
  } catch (error) {
    console.error(
      `[roundtable] failed after retries: ${error.message} ` +
      `(artworks=${digest.visitedArtworks.length}, questions=${digest.askedQuestions.length}, ` +
      `masters=${masters.map(master => master.id).join(",")})`
    );
    sendJson(response, 502, {
      error: "The closing roundtable could not be synthesised.",
      warning: error.message,
      live: false
    });
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

// ---------------------------------------------------------------------------------------------
// Per-master narration — MiniMax T2A v2 (contract learned + verified in the moss project).
// ---------------------------------------------------------------------------------------------

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const MINIMAX_T2A_ENDPOINT = "https://api.minimax.io/v1/t2a_v2";
const TTS_TIMEOUT_MS = 20_000;
// One narrated SEGMENT per request (the client splits longer text on sentence boundaries and
// queues segments); this cap is a server-side backstop, not the splitting mechanism.
const TTS_TEXT_LIMIT = 600;

/**
 * Synthesises one narration segment in the requested master's cast voice and streams the mp3
 * bytes back. Honest failures only: no key -> 503, upstream trouble -> 502 with the reason.
 */
async function handleTts(request, response) {
  const body = JSON.parse(await readBody(request) || "{}");
  const text = String(body.text || "").trim().slice(0, TTS_TEXT_LIMIT);
  if (!text) return sendJson(response, 400, { error: "Text is required." });
  if (!MINIMAX_API_KEY) {
    return sendJson(response, 503, { error: "MINIMAX_API_KEY is not configured; narration is unavailable." });
  }
  const voice = voiceForSpeaker(body.speakerId);
  try {
    const ttsResponse = await fetch(MINIMAX_T2A_ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${MINIMAX_API_KEY}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
      body: JSON.stringify({
        model: TTS_MODEL,
        text,
        stream: false,
        language_boost: "auto",
        output_format: "hex",
        voice_setting: { voice_id: voice.voiceId, speed: voice.speed ?? 1.0, vol: 1.0, pitch: 0 },
        audio_setting: { sample_rate: 32000, format: "mp3" }
      })
    });
    if (!ttsResponse.ok) throw new Error(`MiniMax returned HTTP ${ttsResponse.status}`);
    const payload = await ttsResponse.json();
    const status = payload?.base_resp?.status_code;
    if (status !== 0) throw new Error(`MiniMax status ${status}: ${payload?.base_resp?.status_msg || "unknown"}`);
    const audioHex = payload?.data?.audio;
    if (typeof audioHex !== "string" || !audioHex) throw new Error("MiniMax response carried no audio.");
    const audio = Buffer.from(audioHex, "hex");
    response.writeHead(200, { "content-type": "audio/mpeg", "content-length": audio.length, "cache-control": "no-store" });
    response.end(audio);
  } catch (error) {
    console.error(`[tts] voice=${voice.voiceId} textChars=${text.length} failed: ${error.message}`);
    sendJson(response, 502, { error: "Narration could not be synthesised.", warning: error.message });
  }
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const rawPath = url.pathname;
    if (request.method === "POST" && rawPath === "/api/dialogue") return await handleDialogue(request, response, url);
    if (request.method === "POST" && rawPath === "/api/roundtable") return await handleRoundtable(request, response);
    if (request.method === "POST" && rawPath === "/api/tts") return await handleTts(request, response);
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
    const ext = extname(publicPath.safePath);
    // Code files must never be heuristically cached: with no cache headers the browser kept
    // reusing a stale museum3d.js for the whole session, so shipped fixes (e.g. the splat
    // orientation flip) never reached the viewer without a hard refresh. Big binary assets
    // (spz/glb/textures) stay heuristically cacheable - they are large and rarely change.
    const isCode = [".html", ".js", ".mjs", ".css", ".json"].includes(ext);
    const headers = { "content-type": mime[ext] || "application/octet-stream" };
    if (isCode) headers["cache-control"] = "no-cache";
    response.writeHead(200, headers);
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
  console.log(`[tts] ${MINIMAX_API_KEY ? `enabled model=${TTS_MODEL} (per-master MiniMax voices)` : "disabled — no MINIMAX_API_KEY, the voice toggle will report narration unavailable"}`);

  // Announce the RESOLVED model, not the default. `.env` shipping LLM_MODEL=gpt-5.6 silently
  // overrode DEFAULT_LLM_MODEL and made the whole perf fix inert — the only symptom was every
  // dialogue request 502ing after two 15s timeouts, which reads like an outage rather than a
  // config override. A model that cannot meet the latency budget must be visible at boot.
  const fromEnv = Boolean(process.env.LLM_MODEL || process.env.OPENAI_MODEL);
  const source = !fromEnv ? "default"
    : LLM_MODEL === DEFAULT_LLM_MODEL ? "env, matches default"
    : `env, OVERRIDING default ${DEFAULT_LLM_MODEL}`;
  console.log(`[llm] model=${LLM_MODEL} (${source}) timeout=${LLM_TIMEOUT_MS}ms`);
  if (LLM_MODEL !== DEFAULT_LLM_MODEL) {
    console.warn(
      `[llm] WARNING: ${DEFAULT_LLM_MODEL} is the only model measured to fit the ${LLM_TIMEOUT_MS}ms budget ` +
      `on the real three-perspective payload. ${LLM_MODEL} may time out on every dialogue request.`
    );
  }
});
