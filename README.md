# Field Signal

A hackathon prototype for **worker-to-supervisor communication**: choose a crop, tap a symptom sketch, optionally add a photo, then show a bilingual English/Spanish observation report. It does not diagnose crop disease or replace agricultural training.

## Run

Requires Node.js 18+; no package dependencies.

```sh
node server.js
# Open http://127.0.0.1:3000
```

For optional AI, set `OPENAI_API_KEY` through your environment or hosting secret manager, then restart the server. Do not put the key in browser code, screenshots, source control, or a public demo. `.env` files are ignored by Git but are **not automatically loaded**. The default model is `gpt-4o-mini`; `OPENAI_MODEL` can select a compatible image-input, structured-output model.

`PORT` defaults to `3000`; `HOST` defaults to `127.0.0.1` for a local demo. A Node-capable deployment can set `HOST=0.0.0.0` and its assigned `PORT`. Static hosts support the core flow only, not the AI proxy. Public AI hosting needs HTTPS, access control, deployment-level rate limits and a provider spending budget. The built-in limit (10 calls/minute, 2 concurrent, per process) is only a demo safeguard, not authentication or a distributed quota.

## What is and is not verified

- Core report, desktop/mobile layouts, language switching, bad-photo recovery, missing-key fallback, and print layout have been exercised in Chrome through Playwright.
- `node --test test/server.test.js` checks the HTTP boundary, consent, schema failures, provider failures, timeouts and rate limits using **mocked upstream responses**.
- **No live OpenAI call has been verified in this workspace.** No API key was available. A configured key in `/api/status` does not prove credentials, billing, network or model access work. The UI says so.
- Spanish labels, pictograms and AI translations are drafts. No UC ANR or farmworker-serving partner review or worker usability study has occurred.
- Actual iOS/Android camera pickers, native sharing, installed speech voices and printer dialogs still need device testing. HEIC support depends on the browser; unsupported files show a retry message. JPEG/PNG/WebP are the safer demo inputs.

## 60-second demo

1. **0–10 sec:** Open the running app. “A new worker needs to show a supervisor an unfamiliar symptom.” Choose a crop and **Spots on leaves**.
2. **10–25 sec:** Add a prepared, non-sensitive leaf photo. For a no-network demonstration, **Use demo illustration** instead; explicitly call it an illustration. It is blocked from AI assessment.
3. **25–40 sec:** Switch to **Español**. Show that crop choices, instructions and controls switch. Press **Mostrar reporte bilingüe**.
4. **40–50 sec:** Point out both languages on the same report and the worker-selected observation. Show it on the phone; sharing/copying sends the **text summary only**, not the photo.
5. **50–60 sec:** Open **Imprimir / Guardar PDF** if rehearsed. “This documents observations for human review. Wording and field usefulness still need partner testing.”

Do not make the timed demo depend on AI or TTS. To demonstrate AI separately, rehearse a real photo with a valid server key first, open Optional AI, read the privacy note, consent and run the request. Keep failures visible and continue with the core report. No synthetic response is represented as a live AI result.

## AI and data boundaries

- Photos are resized to at most 1280 pixels on the long edge and re-encoded as JPEG in the browser; original file metadata is not forwarded. Faces, badges and landmarks can still be visible in the pixels.
- Selecting a photo alone does not upload it. AI requires explicit consent for the current photo/crop/symptom. Changing any of these clears old AI output, cancels pending work and resets consent.
- The server sends the resized image and selections to the OpenAI Chat Completions API. `store: false` is explicit. This application writes no photos or reports to disk and logs no request bodies, but hosting infrastructure and the provider have their own retention policies. OpenAI's default abuse-monitoring retention can be up to 30 days, with exceptions and account-specific controls; do not promise zero retention. [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).
- A strict output schema and local checks reject incomplete or malformed responses. Server and browser requests have timeouts. Possible causes use broad categories; unsupported confidence, severity and urgency labels have been removed.
- The prompt forbids definitive diagnoses, named diseases/pests and treatment instructions. **A prompt and schema are not a safety guarantee or a translation review.** Model accuracy and harmful-output behavior remain unvalidated.
- Reports always distinguish worker selections from unverified AI suggestions. An unclear photo yields no cause or inspection lists. Read-aloud uses available local device voices; it may be unavailable.
- Core reports work without a network **after the page has loaded**, or from a saved `index.html`. There is no service worker or installable offline cache. Reloading a hosted page offline is not guaranteed. Refreshing clears observations. Printouts, PDFs and copied summaries persist wherever the user saves or shares them.

## Research grounding (not product validation)

- [UC ANR, “Why It’s Important for UC ANR to Include Farmworkers as Part of Its Clientele,” August 7, 2025](https://ucanr.edu/blog/nuestra-comunidad/article/why-its-important-uc-anr-include-farmworkers-part-its-clientele) reports estimates of 880,000 California farmworkers and 130,000 growers. These are contextual estimates from that article, not app users or a measured addressable market.
- [UC ANR, “Understanding Farmworker Agricultural Learning Needs”](https://ucanr.edu/sites/default/files/2025-08/Farmworker%20Extension%20Project%20Summary.pdf) shows pest management at 39% in its **2023–2024 agricultural-topic-interest chart**. This is not evidence that 39% of all farmworkers need a disease-detection app. The summary identifies in-person learning as preferred.
- [Andrea G. Juarez, UC Davis master's thesis, 2024](https://communitydevelopment.ucdavis.edu/sites/g/files/dgvnsk1186/files/inline-files/Juarez_Thesis_Final.pdf) describes 16 focus groups (July 2023–March 2024) and 136 participants. It is a master's thesis, not a dissertation.

This research supports investigating accessible agricultural communication. It does not establish that an English-only supervisor form is common, that this app is faster than a photo/text conversation, or that the prototype improves learning, reporting or crop outcomes. English and Spanish do not cover all Indigenous-language needs. No institutional endorsement is claimed.

## What would make this competitive

The defensible distinction is an accessible worker-to-supervisor handoff, not AI plant identification. [Plantix](https://plantix.net/en/) already offers photo-based crop diagnosis and treatment suggestions.

Next, run a small consent-based usability study with workers and supervisors: compare an ordinary photo/message with this workflow, measure unaided completion, time and supervisor comprehension, and revise the pictograms and Spanish with a trusted partner. Do not invent outcomes or call a convenience sample a population study.

The [official Sierra Hacks 2026 site](https://www.sierrahacks.tech/) lists the supplied judging weights: innovation 30%, technical implementation 25%, design/UX 20%, relevance/impact 15%, presentation 10% (checked October 24, 2026). Confirm category prizes and live submission requirements with organizers; rubric weights alone do not establish prize availability.
