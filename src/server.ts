import { createServer } from "node:http";
import { buildEventProfile } from "./events/profileBuilder.js";
import { buildGamePlan } from "./events/gamePlanBuilder.js";
import { loadKnowledgeBase } from "./knowledge/store.js";
import { EventInput } from "./events/schema.js";
import { generateAiGuidance } from "./ai/advisor.js";

const port = Number(process.env.PORT ?? 8080);

function sendJson(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "access-control-allow-origin": "http://localhost:3000",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

async function readBody(request: import("node:http").IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "access-control-allow-origin": "http://localhost:3000",
        "access-control-allow-headers": "content-type",
        "access-control-allow-methods": "GET, POST, OPTIONS",
      });
      response.end();
      return;
    }

    if (request.method === "GET" && request.url === "/health") {
      sendJson(response, 200, { ok: true, service: "dj-music-choice-assist" });
      return;
    }

    if (request.method === "POST" && request.url === "/events") {
      const input = JSON.parse(await readBody(request)) as EventInput;
      const profile = buildEventProfile(input);
      const knowledgeBase = await loadKnowledgeBase();
      const gamePlan = buildGamePlan(profile, knowledgeBase);
      let aiGuidance: string | null = null;
      try {
        aiGuidance = await generateAiGuidance(profile, gamePlan);
      } catch (error) {
        console.warn("Vertex AI guidance unavailable; using local guidance.", error);
      }
      sendJson(response, 200, { profile, gamePlan, aiGuidance });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    sendJson(response, 400, { error: message });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`DJ Music Choice API listening on port ${port}`);
});
