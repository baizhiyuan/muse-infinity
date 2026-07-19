import assert from "node:assert/strict";

process.env.WORLDLABS_API_KEY = "test-worldlabs-key";
process.env.TRIPO_API_KEY = "test-tripo-key";

const calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  return new Response(JSON.stringify({ code: 0, data: { task_id: "task_test123" }, operation_id: "operation_test123" }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
};

const { generateWorld, getWorldOperation } = await import("../services/worldLabsApi.js");
const { animateTripoModel, checkTripoRig, generateTripoModel, generateTripoMultiviewModel, getTripoTask, rigTripoModel } = await import("../services/tripoApi.js");

await generateWorld({ prompt: "A bright romantic museum conservatory", displayName: "MUSE Garden" });
assert.equal(calls.at(-1).url, "https://api.worldlabs.ai/marble/v1/worlds:generate");
assert.equal(calls.at(-1).options.headers["WLT-Api-Key"], "test-worldlabs-key");
assert.equal(JSON.parse(calls.at(-1).options.body).world_prompt.type, "text");

await getWorldOperation("operation_test123");
assert.equal(calls.at(-1).url, "https://api.worldlabs.ai/marble/v1/operations/operation_test123");

await generateTripoModel({ imageUrl: "https://example.com/turnaround.png", prompt: "Museum companion bust", faceLimit: 8000 });
assert.equal(calls.at(-1).url, "https://api.tripo3d.ai/v2/openapi/task");
assert.equal(calls.at(-1).options.headers.authorization, "Bearer test-tripo-key");
assert.equal(JSON.parse(calls.at(-1).options.body).type, "image_to_model");
assert.equal(JSON.parse(calls.at(-1).options.body).file.url, "https://example.com/turnaround.png");

await generateTripoMultiviewModel({
  imageUrls: ["https://example.com/front.png", "https://example.com/left.png", "https://example.com/back.png", "https://example.com/right.png"],
  faceLimit: 12_000
});
assert.equal(calls.at(-1).url, "https://api.tripo3d.ai/v2/openapi/task");
assert.equal(JSON.parse(calls.at(-1).options.body).type, "multiview_to_model");
assert.equal(JSON.parse(calls.at(-1).options.body).model_version, "P1-20260311");
assert.deepEqual(JSON.parse(calls.at(-1).options.body).files.map(file => file.url), [
  "https://example.com/front.png", "https://example.com/left.png", "https://example.com/back.png", "https://example.com/right.png"
]);

await getTripoTask("task_test123");
assert.equal(calls.at(-1).url, "https://api.tripo3d.ai/v2/openapi/task/task_test123");

await checkTripoRig("task_test123");
assert.equal(calls.at(-1).url, "https://api.tripo3d.ai/v2/openapi/task");
assert.equal(JSON.parse(calls.at(-1).options.body).type, "animate_prerigcheck");
assert.equal(JSON.parse(calls.at(-1).options.body).model_version, "v2.5-20250123");

await rigTripoModel({ input: "task_test123" });
assert.equal(calls.at(-1).url, "https://api.tripo3d.ai/v2/openapi/task");
assert.equal(JSON.parse(calls.at(-1).options.body).type, "animate_rig");
assert.equal(JSON.parse(calls.at(-1).options.body).model_version, "v2.5-20250123");

await animateTripoModel({ input: "task_test123" });
assert.equal(calls.at(-1).url, "https://api.tripo3d.ai/v2/openapi/task");
assert.equal(JSON.parse(calls.at(-1).options.body).type, "animate_retarget");

await assert.rejects(() => generateWorld({ imageUrl: "http://insecure.example/world.jpg" }), /public HTTPS URL/);
await assert.rejects(() => generateTripoModel({ imageUrl: "http://insecure.example/person.png" }), /public HTTPS URL/);
await assert.rejects(() => generateTripoMultiviewModel({ imageUrls: ["https://example.com/front.png"] }), /exactly four views/);

console.log(`integration-contracts: ${calls.length} requests validated`);
