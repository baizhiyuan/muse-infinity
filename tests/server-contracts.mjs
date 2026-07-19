import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

// Captured BEFORE the offline environment blanks it. Only the live contract below may use it.
const liveApiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "";

const port = 43_000 + (process.pid % 1_000);
const baseUrl = `http://127.0.0.1:${port}`;
const environment = {
  ...process.env,
  HOST: "127.0.0.1",
  PORT: String(port),
  OPENAI_API_KEY: "",
  // server.mjs resolves LLM_API_KEY || OPENAI_API_KEY. Clearing only the latter left the
  // no-key contract dependent on the developer's shell not exporting LLM_API_KEY.
  LLM_API_KEY: "",
  WORLDLABS_API_KEY: "",
  TRIPO_API_KEY: "",
  INTEGRATION_ADMIN_TOKEN: "test-admin-token"
};

function startServer(env) {
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const record = { child, diagnostics: "" };
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", chunk => { record.diagnostics += chunk; });
  child.stderr.on("data", chunk => { record.diagnostics += chunk; });
  return record;
}

async function waitFor(record, url) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (record.child.exitCode !== null) throw new Error(`Server exited before startup.\n${record.diagnostics}`);
    try {
      const response = await fetch(`${url}/api/integrations/status`);
      if (response.ok) return;
    } catch {}
    await delay(50);
  }
  throw new Error(`Server did not start in time.\n${record.diagnostics}`);
}

async function stopServer(record) {
  record.child.kill("SIGTERM");
  if (record.child.exitCode === null) await once(record.child, "exit");
}

const offlineServer = startServer(environment);
const server = offlineServer.child;

async function waitForServer() {
  return waitFor(offlineServer, baseUrl);
}

async function expectStatus(path, expected, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  assert.equal(response.status, expected, `${path} returned ${response.status}`);
  return response;
}

/** Shared shape assertion — both the offline and the live path must satisfy it. */
function assertPerspectivesContract(payload, label) {
  assert.ok(Array.isArray(payload.perspectives), `${label}: perspectives was not an array`);
  assert.equal(payload.perspectives.length, 3, `${label}: expected 3 perspectives`);
  const effects = ["mist", "fracture", "garden", "network"];
  for (const [index, item] of payload.perspectives.entries()) {
    assert.equal(typeof item.speakerId, "string", `${label}[${index}]: speakerId not a string`);
    assert.ok(item.speakerId.length > 0, `${label}[${index}]: speakerId was empty`);
    assert.equal(typeof item.speaker, "string", `${label}[${index}]: speaker not a string`);
    assert.ok(item.speaker.length > 0, `${label}[${index}]: speaker was empty`);
    assert.equal(typeof item.text, "string", `${label}[${index}]: text not a string`);
    assert.ok(item.text.trim().length > 0, `${label}[${index}]: text was empty`);
    assert.ok(effects.includes(item.effect), `${label}[${index}]: effect "${item.effect}" outside vocabulary`);
  }
  const ids = new Set(payload.perspectives.map(item => item.speakerId));
  assert.equal(ids.size, 3, `${label}: speakerIds were not distinct`);
}

/**
 * Live-path contract. Skipped without a key, and it spends real tokens when it runs — but the
 * suite otherwise covers only the no-key path, so nothing at all guards the one proven path.
 */
async function runLiveDialogueContract() {
  if (!liveApiKey) {
    console.log("server-contracts: live dialogue contract SKIPPED (no LLM_API_KEY / OPENAI_API_KEY)");
    return;
  }
  const livePort = port + 1;
  const liveUrl = `http://127.0.0.1:${livePort}`;
  const record = startServer({ ...environment, PORT: String(livePort), LLM_API_KEY: liveApiKey });
  try {
    await waitFor(record, liveUrl);
    for (const arm of ["A", "B"]) {
      const response = await fetch(`${liveUrl}/api/dialogue?arm=${arm}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: "What should I notice here?",
          companions: [{ id: "monet" }, { id: "van_gogh" }, { id: "socrates" }],
          artwork: { title: "Water Lilies", artist: "Claude Monet", date: "1906" }
        }),
        signal: AbortSignal.timeout(120_000)
      });
      assert.equal(response.status, 200, `live arm=${arm} returned ${response.status}\n${record.diagnostics}`);
      const payload = await response.json();
      assert.equal(payload.live, true, `live arm=${arm}: live flag was not true`);
      assert.equal(payload.arm, arm, `live arm=${arm}: response reported arm ${payload.arm}`);
      assertPerspectivesContract(payload, `live arm=${arm}`);
    }
    console.log("server-contracts: live dialogue contract validated for arms A and B");
  } finally {
    await stopServer(record);
  }
}

try {
  await waitForServer();

  const indexResponse = await expectStatus("/", 200);
  assert.match(await indexResponse.text(), /"three": "\.\/node_modules\/three\/build\/three\.module\.js"/);
  await expectStatus("/app.js", 200);
  await expectStatus("/assets/generated/muse-hero-conservatory-v3.png", 200);
  await expectStatus("/node_modules/three/build/three.module.js", 200);
  await expectStatus("/worlds.json", 200);

  for (const privatePath of [
    "/.env",
    "/.git/config",
    "/server.mjs",
    "/package.json",
    "/tests/integration-contracts.mjs",
    "/services/worldLabsApi.js",
    "/services/tripoApi.js",
    "/README.md"
  ]) {
    await expectStatus(privatePath, 404);
  }

  const statusResponse = await expectStatus("/api/integrations/status", 200);
  assert.deepEqual(await statusResponse.json(), { openai: false, worldLabs: false, tripo: false });

  const fallbackResponse = await expectStatus("/api/dialogue", 200, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "What should I notice?" })
  });
  const fallbackPayload = await fallbackResponse.json();
  assert.equal(fallbackPayload.live, false);
  assert.equal(fallbackPayload.fallback, true);
  // Offline mode must speak the same shape as the live path, or the client would need to branch.
  assertPerspectivesContract(fallbackPayload, "fallback");

  // The closing roundtable. Asserted here mainly for its server-side re-clamp: the client caps the
  // digest too, but the server must not trust that, so an over-long digest is sent deliberately.
  const roundtableResponse = await expectStatus("/api/roundtable", 200, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      // Ten times every cap on every axis, while staying under readBody's 64KB transport limit —
      // this must exercise the digest clamp, not the body limit.
      session: {
        visitedArtworks: Array.from({ length: 50 }, (_, index) => ({ title: `Work ${index}`, artist: "x".repeat(300) })),
        askedQuestions: Array.from({ length: 30 }, () => "q".repeat(300)),
        perspectiveLog: Array.from({ length: 30 }, () => ({ speakerId: "monet", speaker: "Claude Monet", line: "l".repeat(300) }))
      }
    })
  });
  const roundtablePayload = await roundtableResponse.json();
  assert.equal(roundtablePayload.live, false);
  assert.equal(roundtablePayload.fallback, true);
  assert.equal(typeof roundtablePayload.worldTitle, "string");
  assert.ok(roundtablePayload.worldTitle.length > 0, "roundtable: worldTitle was empty");
  assert.ok(roundtablePayload.synthesis.trim().length > 0, "roundtable: synthesis was empty");
  assert.equal(roundtablePayload.threads.length, 3, "roundtable: expected 3 threads");
  for (const [index, thread] of roundtablePayload.threads.entries()) {
    assert.ok(thread.speakerId?.length > 0, `roundtable thread[${index}]: speakerId was empty`);
    assert.ok(thread.speaker?.length > 0, `roundtable thread[${index}]: speaker was empty`);
    assert.ok(thread.text?.trim().length > 0, `roundtable thread[${index}]: text was empty`);
  }
  // A 40-entry oversized digest must not reach the prompt. The offline synthesis quotes the first
  // artwork and the first question verbatim, so an unclamped field would surface here.
  assert.ok(roundtablePayload.synthesis.length < 1_000, "roundtable: server did not re-clamp the digest");

  await expectStatus("/api/tripo/characters", 200);
  await expectStatus("/api/worlds/generate", 401, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "test" })
  });
  await expectStatus("/api/worlds/generate", 503, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-admin-token" },
    body: JSON.stringify({ prompt: "test" })
  });

  console.log("server-contracts: public surface and secret boundaries validated");
  await runLiveDialogueContract();
} finally {
  server.kill("SIGTERM");
  if (server.exitCode === null) await once(server, "exit");
}
