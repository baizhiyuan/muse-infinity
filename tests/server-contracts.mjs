import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

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
const server = spawn(process.execPath, ["server.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: environment,
  stdio: ["ignore", "pipe", "pipe"]
});

let diagnostics = "";
server.stdout.setEncoding("utf8");
server.stderr.setEncoding("utf8");
server.stdout.on("data", chunk => { diagnostics += chunk; });
server.stderr.on("data", chunk => { diagnostics += chunk; });

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Server exited before startup.\n${diagnostics}`);
    try {
      const response = await fetch(`${baseUrl}/api/integrations/status`);
      if (response.ok) return;
    } catch {}
    await delay(50);
  }
  throw new Error(`Server did not start in time.\n${diagnostics}`);
}

async function expectStatus(path, expected, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  assert.equal(response.status, expected, `${path} returned ${response.status}`);
  return response;
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
  assert.equal((await fallbackResponse.json()).live, false);

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
} finally {
  server.kill("SIGTERM");
  if (server.exitCode === null) await once(server, "exit");
}
