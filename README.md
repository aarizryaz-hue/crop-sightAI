# CropSight

A photo-based crop observation tool for farmworkers and supervisors. Choose **Seeds** or **Harvest**, add a photo, consent to processing, and press **Analyze photo**. The result puts the detected crop first, followed by visible observations, checks and a bilingual supervisor summary.

- **Seeds:** seeds, seedlings, germination and early transplants.
- **Harvest:** ripeness, fruit/produce condition and visible damage.
- English and Spanish appear together. There is no language switch or manual crop/symptom form.
- The problem story and research remain on the page, organized below the tool with expandable source details.
- This is a prototype for human review, not a diagnosis, seed viability test or food-safety assessment.

## Run

Requires Node.js 18+; no application dependencies.

```sh
node server.js
# http://127.0.0.1:3000
```

Set `OPENAI_API_KEY` in the server's environment before starting. The default model is `gpt-4o-mini`; `OPENAI_MODEL` overrides it. `.env` files are ignored by Git but are not automatically loaded. Keep keys out of browser code, chat, screenshots and commits.

If the server is already running, restart it with your existing launch command and the same secret settings. A page refresh loads the new HTML but **does not reload server.js**. Current startup includes:

```text
CropSight Seeds/Harvest v2 — bounded error logging; no photo or response text logged.
```

`GET /api/status` returns `version: "cropsight-seeds-harvest-2"`. `aiEnabled: true` means a key is configured, not that billing/model access or a live request has been verified.

`HOST` defaults to `127.0.0.1`; `PORT` defaults to `3000`. A Node-capable host can set `HOST=0.0.0.0` and its assigned port. Static hosting displays the interface but **cannot analyze photos**. Public AI hosting needs HTTPS, authenticated access, deployment-level request limits and a provider spending budget. The 10 requests/minute, 2 concurrent requests per process are demo safeguards only.

## Alternative providers

The existing OpenAI-compatible adapter is preserved. Set `AI_BASE_URL` and `OPENAI_MODEL`, with the provider's key in `OPENAI_API_KEY`. For example, Gemini's compatibility base URL is `https://generativelanguage.googleapis.com/v1beta/openai`; select a currently available image-capable model for your account. OpenAI uses strict JSON Schema; compatible providers receive JSON mode plus the schema in the prompt. Every response is validated locally.

The status endpoint identifies OpenAI or Google Gemini so consent names the actual recipient. Unknown providers get generic wording. Custom-provider compatibility is tested using mocked responses, not a live Gemini call. Pricing, model availability and retention are provider/account dependent.

## Demo

1. Choose **Seeds** for a seedling/early-growth photo, or **Harvest** for a fruit/produce photo.
2. Add a prepared, non-sensitive JPG, PNG or WebP. Check consent and press **Analyze photo**.
3. Show the detected crop, visible condition and English/Spanish observations.
4. Use **Copy / Copiar** to copy the bilingual supervisor summary. It copies text, not the photo.
5. If useful for judging, open **The research behind the idea** below the tool.

Changing the stage clears old results and requires a new Analyze action; it does not silently spend another API request. Replacing/removing a photo cancels pending work, clears results and resets consent. Only the selected stage is remembered between page loads; photos and results are not persisted.

For a 60-second pitch, rehearse with the actual provider and network first. An API failure leaves the photo available for retry. Do not represent mocked results as a live analysis.

## Validation

```sh
node --test test/server.test.js
```

**16 server tests pass.** These cover consent, request sizes, category/mode validation, structured responses, blank or malformed content, timeouts, budgets, unusable photos, contradictory verdicts and the compatible-provider adapter.

Browser QA uses Playwright with installed Chrome. It exercises both stage payloads, consent, photo replacement, stale-result cancellation, error recovery, bilingual results/copy, research disclosure, no-key behavior and layouts at 320, 390, 768 and 1280 pixels. See [HANDOFF.md](HANDOFF.md) for the full change record and verification details.

The presenter reported a successful live tomato assessment and supplied screenshots. This editing session did not repeat a paid provider call. API accuracy, real iOS/Android camera behavior and native Spanish wording remain unvalidated.

## Privacy and limits

- A file selection stays local. Only Analyze sends the resized JPEG, selected stage and compatibility defaults through the server to the configured provider.
- Maximum file size: 15 MB; maximum decoded image: 50 megapixels; JPEG output: 1280 pixels on the long edge. Browser HEIC support varies. Re-encoding strips original metadata, but faces and landmarks may remain in the pixels.
- The app stores no photos/reports on disk and logs no model response text. `store: false` is sent to OpenAI. Hosting infrastructure and providers have their own retention rules: [OpenAI](https://developers.openai.com/api/docs/guides/your-data), [Gemini](https://ai.google.dev/gemini-api/terms).
- The prompt excludes pesticides, doses and definite diagnoses. It allows possible problems and general non-chemical options to discuss with a supervisor. Prompts/schema checks cannot guarantee safe or accurate content.
- A crop name is displayed when returned by the model. Missing/unclear identification gets a readable fallback; the app never fills it with an invented certainty.
- An unusable photo cannot show a healthy verdict, identified crop, problem list or urgent flag. A contradictory healthy/problem response is downgraded to unclear.
- “No obvious damage in this photo” is not proof the plant is healthy, the seed will germinate, or the produce is safe to eat.
- No worker study, accuracy percentage, professional translation review or institutional endorsement is claimed.

## Research

[UC ANR's August 2025 article](https://ucanr.edu/blog/nuestra-comunidad/article/why-its-important-uc-anr-include-farmworkers-part-its-clientele) reports estimates of 880,000 California farmworkers and 130,000 growers. Its [learning-needs summary](https://ucanr.edu/sites/default/files/2025-08/Farmworker%20Extension%20Project%20Summary.pdf) places pest management at 39% in the 2023–2024 topic-interest chart and identifies in-person learning as preferred. [Andrea G. Juarez's 2024 master's thesis](https://communitydevelopment.ucdavis.edu/sites/g/files/dgvnsk1186/files/inline-files/Juarez_Thesis_Final.pdf) reports 16 focus groups and 136 participants.

These findings motivate accessible agricultural communication; they do not measure CropSight's effectiveness. The next useful study compares this workflow against an ordinary photo/message, measuring worker completion and supervisor comprehension.
