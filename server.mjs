import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT || 4173);
const root = process.cwd();
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

createServer(async (request, response) => {
  try {
    const rawPath = new URL(request.url, `http://${request.headers.host}`).pathname;
    const relative = rawPath === "/" ? "index.html" : rawPath.slice(1);
    const safePath = normalize(relative).replace(/^(\.\.[/\\])+/, "");
    const body = await readFile(join(root, safePath));
    response.writeHead(200, { "content-type": mime[extname(safePath)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, () => {
  console.log(`MUSE∞ is running at http://localhost:${port}`);
});
