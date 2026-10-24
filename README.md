# Field Signal

A picture-and-audio field guide that helps farmworkers show an unfamiliar crop problem to a supervisor or agricultural adviser.

**Flow:** pick a crop → tap a symptom → add a photo → AI photo assessment (optional) → bilingual (English / Español) visual report → read aloud or print.

## Why
UC Agriculture and Natural Resources focus groups with Central Valley farmworkers found pest management was the most common topic of interest (39%). Many farmworkers speak Spanish or Indigenous languages and have limited formal schooling, so long English-only forms are a barrier.

Sources: UC ANR “Understanding Farmworker Agricultural Learning Needs” (2025); UC ANR “Why It’s Important for UC ANR to Include Farmworkers as Part of Its Clientele”; Juarez, A., UC Davis (2024).

## Run it
Requires Node.js 18+. No dependencies.

```bash
# Core version only (symptom report works without AI)
node server.js

# With AI photo assessment (ChatGPT API)
OPENAI_API_KEY=sk-... node server.js
# optional: OPENAI_MODEL=gpt-4o-mini
```

Then open http://localhost:3000.

The API key is read on the server and is never sent to the browser. Do not hard-code it into `index.html`, and do not commit it to git.

## How the AI assessment works
1. The worker uploads a photo (automatically downscaled), selects a crop and a symptom, and presses **Assess photo**.
2. The server sends the photo and selections to the OpenAI API with a fixed safety prompt.
3. The result shows possible causes with confidence levels, severity, what to check, and a bilingual summary for the supervisor. It is added to the printable report.

## Scope and limits
- Field Signal documents observations. It does **not** diagnose plant disease, and the AI prompt forbids definite diagnoses and specific pesticide doses.
- AI output can be wrong. Every result says to confirm with a supervisor or agricultural adviser.
- Symptom labels are draft wording. Have UC ANR and farmworker-serving partners review translations before field use.
