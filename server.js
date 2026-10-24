// Field Signal server: serves index.html and proxies photo assessments to the OpenAI API.
// The API key stays on the server (env var OPENAI_API_KEY). It is never sent to the browser.
//
// Run:  OPENAI_API_KEY=sk-... node server.js        (Node 18+, no dependencies)
// Then open http://localhost:3000

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const KEY = process.env.OPENAI_API_KEY;
const MAX_BODY = 8 * 1024 * 1024; // 8 MB photo limit

const SYSTEM_PROMPT = `You are an agricultural extension assistant helping farmworkers, especially new ones, describe crop problems to a supervisor or agricultural adviser.

Look at the photo and the user's selections (crop, symptom they tapped). Return ONLY a JSON object with these keys:
- "photo_usable": boolean. false if the photo is blurry, too dark, not a plant, or does not show the problem clearly.
- "photo_note": short string explaining the photo quality or what is visible.
- "likely_causes": array of up to 3 objects {"name": string, "name_es": string, "why": string, "why_es": string, "confidence": "low"|"medium"|"high"}. Cover the broad categories that fit what is visible: pest damage, fungal or bacterial disease, nutrient deficiency, water stress (too much or too little), heat or sun damage, mechanical or chemical injury. Use "low" when the photo is ambiguous.
- "severity": "minor" | "moderate" | "severe" | "unclear".
- "what_to_check": array of up to 4 short plain-language checks a new worker can do (e.g. look at the underside of leaves, check soil moisture, see whether damage spreads).
- "report_to_supervisor": one or two plain sentences summarizing what was observed, in English.
- "report_to_supervisor_es": the same summary in Spanish.
- "urgent": boolean. true if the damage looks like it is spreading fast or the supervisor should be told today.

Rules:
- You are NOT making a diagnosis. Say "possible" or "may be consistent with". Never state a definite disease or pest.
- Do not recommend specific pesticides, doses, or chemical treatments. Say to ask the supervisor or adviser before any treatment.
- If you cannot tell, say so and set confidence to "low".
- Output valid JSON only, no prose outside the JSON.`;

function send(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("too_large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function assess(req, res) {
  if (!KEY) return send(res, 503, { error: "AI assessment is not configured on this server." });

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (e) {
    return send(res, e.message === "too_large" ? 413 : 400, { error: "Invalid or too-large request." });
  }

  const { image, crop, symptom } = body;
  if (typeof image !== "string" || !/^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(image)) {
    return send(res, 400, { error: "Send a photo as a base64 image data URL." });
  }

  const userText = `Crop: ${String(crop || "unknown").slice(0, 40)}. Symptom the worker tapped: ${String(symptom || "not selected").slice(0, 60)}.`;

  let upstream;
  try {
    upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: image, detail: "low" } },
            ],
          },
        ],
      }),
    });
  } catch {
    return send(res, 502, { error: "Could not reach the AI service. Check the connection and try again." });
  }

  if (!upstream.ok) {
    console.error("OpenAI error", upstream.status);
    return send(res, 502, { error: "The AI service returned an error. Try again later." });
  }

  const data = await upstream.json();
  let result;
  try {
    result = JSON.parse(data.choices[0].message.content);
  } catch {
    return send(res, 502, { error: "The AI response could not be read. Try again." });
  }
  return send(res, 200, { result, disclaimer: "AI observation only. Not a diagnosis. Confirm with a supervisor or agricultural adviser." });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/api/assess") return assess(req, res);

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    const file = path.join(__dirname, "index.html");
    return fs.readFile(file, (err, data) => {
      if (err) return send(res, 500, { error: "Missing index.html" });
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(data);
    });
  }

  if (req.method === "GET" && url.pathname === "/api/status") {
    return send(res, 200, { aiEnabled: Boolean(KEY), model: MODEL });
  }

  send(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Field Signal running at http://localhost:${PORT}`);
  console.log(KEY ? `AI assessment enabled (model: ${MODEL})` : "AI assessment disabled: set OPENAI_API_KEY to enable it.");
});
