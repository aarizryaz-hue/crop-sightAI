# CropSight technical guide

[← Project overview](../README.md) · [Documentation index](README.md)

An installable crop-observation assistant that turns photos into evidence, possible explanations and one useful next question. Choose **Seeds** or **Harvest**, add a whole-plant photo and optionally a close-up, then analyze. Every possible explanation refers to numbered model observations from a supplied photo. Answering the follow-up sends the same photos and your reported observation for a fresh analysis.

English is the default. **Settings → Display language** is the only language switch; Spanish is opt-in. Results use the selected language, not both languages at once. The problem story and expandable research remain below the tool.

This prototype supports a conversation with a supervisor. It does not establish disease, seed viability, food safety or permission to harvest/treat a crop. It uses a pretrained vision API, not a newly trained model.

## Validation status

The committed source reports `cropsight-android-5`. The recorded live demo used `cropsight-android-4` and exposed two substantive errors: unripe fruit was treated as outside Harvest mode, and a damaged tomato was called healthy despite a dark-spot observation. The newer prompt clarifies those cases, but its effectiveness still needs a restarted server and live retesting. See the [actual recording notes and response](../demo/README.md).

The automated suite verifies software behavior with mocked provider responses. It does not establish model accuracy, agricultural safety, translation quality or farmworker usability. The [development history](HANDOFF.md) records earlier checks and their limits.

## Run

Requires Node.js 20+; no server runtime dependencies. Android packaging uses the pinned Bubblewrap development dependency.

```sh
cp .env.example .env
# Edit .env locally and set OPENAI_API_KEY. Do not paste it in chat.
node server.js
# http://127.0.0.1:3000
```

Alternatively, keep using your existing terminal environment. Environment variables override `.env`. Supported settings: `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-4o-mini`), `AI_BASE_URL`, `HOST` (default `127.0.0.1`), and `PORT` (default `3000`). The key stays on the server.

**Restart Node after server changes.** Refreshing the page reloads HTML but does not reload the backend. The startup marker is `CropSight Android v5`; Settings and `/api/status` show `cropsight-android-5` and `analysisVersion: 3`.

The page detects an older running server and preserves its single-photo flow. Two-photo comparison and follow-up need v3. Settings distinguishes a configured key from a successful live analysis; checking status does not spend an API call.

A static host cannot analyze photos. A Node-capable host can set `HOST=0.0.0.0`. Public deployment also needs HTTPS, access control, deployment-level rate limits and provider spending limits. The built-in 10 requests/minute and 2 concurrent requests are single-process demo safeguards.

## Android installation and Google Play

The web app now has an install manifest, normal/maskable icons, a service worker, an installation control in Settings and a privacy page. It can open its interface offline after installation; analysis still requires internet. Photos and results are not cached by the service worker.

**No APK/AAB has been built and no Play listing has been published.** First deploy the complete application to a public HTTPS origin. Do not upload only the previous three files: include `webapp.js`, `public/` and `references/` too.

[Android release instructions](../release/PLAY-STORE.md) cover hosting, publisher contact, private persistent report storage, Bubblewrap generation, signing, Digital Asset Links and Play testing. [Store listing draft](../release/STORE-LISTING.md) includes the prepared icon/feature graphic and the remaining publisher-owned details.

## Uncertainty and evidence

The response schema includes `crop_identification` (`identified`, `tentative`, `unknown`). A tentative name displays as “Possible …” / “Posible …”; an unknown crop stays unknown even when the image is usable. Seed mode no longer forces a crop from a restricted list or infers identity from a possible-problem name. Team-written crop/seed guides are retained as unverified comparison context, not a labeled training/evaluation dataset.

Results with nonexistent detail-photo references, invalid evidence indices or missing required explanation fields are rejected. References are never reassigned to another photo to make the result look valid. The user can retry rather than receiving an invented evidence trail. These checks do not prove model observations are accurate or that an explanation is supported by the photo.

## Why AI is central

The model decides which visible patterns support alternative explanations and what field observation would help distinguish them. The workflow is:

1. **Observe:** compare the whole plant with an optional close-up of the same plant.
2. **Explain:** link possible causes to numbered observations, with a concrete distinguishing check.
3. **Ask:** ask one short multiple-choice field question when useful.
4. **Update:** reanalyze with the answer labeled as worker-reported context, then produce a supervisor summary.

These are model-generated observations, not independently verified evidence. Schema and reference checks prevent malformed results and nonexistent photo references; they do not prove an observation or cause is correct. No confidence percentage is displayed.

The interface shows provider, model, number of views and measured response duration. The backend exposes a request ID without logging photos, answers or model response text.

## 60-second demo

Prepare non-sensitive **real photographs** of one plant: overview and close-up. Rehearse with the final server and network first.

- **0–8 seconds:** “A new worker sees a crop problem but needs help describing it to a supervisor.” Select the appropriate Seeds/Harvest stage.
- **8–20 seconds:** Upload the overview and close-up, allow processing, and press **Compare both photos**. Say: “The vision model compares visible patterns and chooses the next observation that would help distinguish causes.”
- **20–40 seconds:** Show the crop, numbered observations and one explanation. Tap its photo-view link. Explain that this is a possible cause, not a diagnosis.
- **40–55 seconds:** Answer the follow-up honestly and show the revised supervisor summary. If the model asks no useful follow-up, explain its specific photo limitation instead; do not fabricate an answer.
- **55–60 seconds:** Show the model label and **Copy summary**. Credits and language controls are in Settings.

API latency varies; two calls may exceed 60 seconds. Practice and use a longer live-demo window if allowed. Do not present mock screenshots as live output or promise a diagnosis/accuracy percentage. The provided Sierra Hacks slides require a live AI demo, named model/API and tool/code credit; beginner eligibility depends on the team's actual experience.

## Checks

```sh
node --test test/*.test.js
```

**37 tests pass.** They cover consent, request validation, bounded inputs and calls, timeouts, schema validation, two-image requests, language selection, follow-up context, invalid evidence references, unusable photos, contradictory verdicts, provider-specific errors, explicit crop uncertainty, report consent/retention, install assets, Android preflight guards and legacy compatibility. Provider responses are mocked; these are software tests, not model-accuracy measurements.

Browser checks use Playwright and installed Chrome: English default, Settings/Spanish persistence, upload/consent, comparison, evidence links, follow-up, copy, cancellation, API errors and responsive layouts at 320/390/768/1280 pixels. See [HANDOFF.md](HANDOFF.md) for the change record and verification limits.

## Alternative providers

An OpenAI-compatible adapter remains available through `AI_BASE_URL` and `OPENAI_MODEL`, with the provider key in `OPENAI_API_KEY`. For Gemini the compatibility base is `https://generativelanguage.googleapis.com/v1beta/openai`; choose an image-capable model available to your account. OpenAI gets strict JSON Schema; compatible providers get JSON mode plus the schema, with local validation afterward. Gemini/custom-provider behavior is mock-tested, not live-verified here. Free tiers, model access and data policies depend on the provider/account.

## Data and limitations

- File selection is local. Consent plus Analyze sends the resized JPEG(s), stage, selected language and any follow-up answer through the server to the configured provider. The answer button clearly says it sends a new request.
- Maximum source file: 15 MB and 50 megapixels. Each photo is re-encoded to JPEG at up to 1280 pixels on its long edge. Browser HEIC support varies; JPG/PNG/WebP are reliable choices. Re-encoding removes original metadata, but visible faces/landmarks remain.
- Voluntary result reports have separate consent and send result text, a reason, a comment and a request ID without photos. Reports are saved privately under `REPORTS_DIR` (local default `data/reports`) and deleted after 30 days by an hourly cleanup. Production needs a real publisher/contact and durable report storage.
- Only mode and language preferences persist in localStorage. Photos/results stay in tab memory and are not saved by the app. `store: false` is sent to OpenAI; provider/infrastructure retention still applies: [OpenAI](https://developers.openai.com/api/docs/guides/your-data), [Gemini](https://ai.google.dev/gemini-api/terms).
- Changing mode/language or replacing a photo cancels old analysis. Replacing/removing a photo resets consent. No automatic paid call occurs on a preference change.
- The v3 prompt requests visual checks and reporting, excludes pesticide/treatment instructions, and asks the model to reject illustrations, unrelated objects and unusable photos. Prompt compliance is not guaranteed.
- Unusable results are normalized to a retake request, without identified crop or possible causes. Conflicting healthy/problem outputs become unclear. Unknown crops remain unknown.
- Accuracy, farmworker usability, actual phone camera behavior and professional Spanish translation have not been validated. No UC ANR endorsement is claimed.

## Research and credits

[UC ANR's August 2025 article](https://ucanr.edu/blog/nuestra-comunidad/article/why-its-important-uc-anr-include-farmworkers-part-its-clientele) reports estimates of 880,000 California farmworkers and 130,000 growers. Its [learning-needs summary](https://ucanr.edu/sites/default/files/2025-08/Farmworker%20Extension%20Project%20Summary.pdf) puts pest management at 39% of its 2023–2024 topic-interest chart and notes a preference for in-person learning. [Andrea G. Juarez's 2024 thesis](https://communitydevelopment.ucdavis.edu/sites/g/files/dgvnsk1186/files/inline-files/Juarez_Thesis_Final.pdf) reports 16 focus groups and 136 participants. These findings motivate the idea; they do not test this app.

Built with assistance from OpenAI Codex and Claude. AI uses the configured provider/model shown in Settings. No new model was trained or benchmark dataset used. Respect licenses and credit the source of any third-party photographs used in the presentation.
