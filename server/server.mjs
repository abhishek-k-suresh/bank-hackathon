// Optional live AI chat for the Future Me prototype.
// Keeps the API key on the server side; the browser only talks to localhost:8787.
// Run:  cd server && npm install && set ANTHROPIC_API_KEY=sk-ant-... && node server.mjs
// The app works fully offline without this server (scripted answers).

import http from "node:http";
import Anthropic from "@anthropic-ai/sdk";

const PORT = 8787;
const MODEL = "claude-opus-5-5";
const client = new Anthropic(); // reads ANTHROPIC_API_KEY (or an `ant auth login` profile)

const SYSTEM = `You are "Future Me", a friendly money companion inside a bank app, built for a hackathon prototype.
You speak to one customer, by first name, in plain Australian English, 2 to 5 short sentences, no bullet lists, no markdown.
You have a JSON snapshot of their last three months and projections. Quote the numbers from it; never invent figures.
Rules you always follow:
- You give general information, not financial advice. Say so briefly if the customer asks what they should do with investments, loans or super, and suggest talking to a person at the bank.
- You never block, delay or judge a payment. Nudges are suggestions.
- If the snapshot shows a hardship gap, drop the playful tone, be calm and practical, and mention Westpac Assist as a free human option.
- If the customer mentions urgency, someone pressuring them to pay, a "safe account", or a stranger asking for money, warn plainly that these are scam signs and suggest calling the bank on the number on their card.
- If you do not know something, say so.`;

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" });
  res.end(JSON.stringify(body));
}

http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true, model: MODEL });
  if (req.method !== "POST" || req.url !== "/chat") return json(res, 404, { error: "not found" });

  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    const { messages, context } = JSON.parse(raw || "{}");
    const history = (messages || []).filter(m => m.role === "user" || m.role === "assistant").slice(-12);
    // Claude requires the conversation to start with a user turn; drop a leading greeting from the app.
    while (history.length && history[0].role !== "user") history.shift();
    if (!history.length) return json(res, 400, { error: "no user message" });

    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 1024,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
        { type: "text", text: "Customer snapshot (JSON):\n" + JSON.stringify(context || {}, null, 1) },
      ],
      messages: history,
    });

    if (response.stop_reason === "refusal") return json(res, 200, { reply: "I can't help with that one, but I'm happy to talk about your spending or your Car Fund." });
    const reply = response.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    json(res, 200, { reply });
  } catch (err) {
    console.error(err?.status || "", err?.message || err);
    json(res, 500, { error: String(err?.message || err) });
  }
}).listen(PORT, () => console.log(`Future Me live AI on http://localhost:${PORT} (model ${MODEL})`));
