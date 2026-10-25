# CropSight — Android and evidence fixes

Updated October 24, 2026. This section supersedes the previous pass below.

## Completed now

- Removed forced seed classifications and conflicting “never Unknown” instructions. The model can return a usable photo with unknown identity. Added a required identification status; tentative names remain labeled in English and Spanish.
- Removed fallback inference of a crop from problem names. Retained the user's newer crop/seed guides and centered green interface, while treating guides as unverified context.
- Restored strict output/reference validation. Nonexistent detail photos and invalid evidence links fail the response instead of being relabeled or silently dropped. Restored conflicting-healthy-result normalization.
- Added install manifest, app icons, maskable icon and a Settings install control. The service worker caches only interface assets; API calls/results/photos are not cached. It does not force an update over a tab's in-memory photos.
- Added a publisher-configurable privacy page and separate-consent in-app reporting. Reports save text without photos, use private files, and have 30-day retention. Publisher identity/contact and durable storage must be configured before release.
- Added pinned Bubblewrap Android build tooling, HTTPS/deployment preflight, signing/build instructions and Digital Asset Links generation. The pinned generator targets API 36.
- Prepared a store-listing draft and 1024×500 feature graphic. All changes remain local until deployment/publication is completed.

## Verification

37 Node tests pass. Browser tests pass at 320/390/768/1280 widths with no uncaught errors. A fresh non-incognito Chrome profile reports zero PWA installability errors. Tested the tentative label, reporting consent and actual local file persistence, installation-prompt wiring, Spanish settings, offline shell reload and recovery, and confirmed CacheStorage has no API entries. Also rechecked two-photo/follow-up/copy and error recovery with a mock provider.

No live API call was made against the revised prompt/schema. The user's server on port 3000 still reports `cropsight-evidence-3` and needs a restart to load `cropsight-android-4`. Its key was not extracted or moved. Tests used separate servers with mock responses. No physical Android device or Play-installed package has been tested.

No Android APK/AAB exists yet. Generation is intentionally gated on the real public HTTPS origin; the publisher has not supplied that address or Play Console account status. No signing key/account/certificate or publication outcome is invented.

The server has no npm runtime dependencies; production dependency audit reports zero vulnerabilities. Bubblewrap's development dependency tree reports upstream audit findings. Those dependencies are not installed with `npm ci --omit=dev` on the web server. Do not run a force-upgrade without revalidating the Android toolchain.

## What is needed to finish

See [release/PLAY-STORE.md](release/PLAY-STORE.md). Required inputs: stable hosted HTTPS origin, Play Console account access/status, real publisher name/support email, permanent application ID, and durable report storage. After these are available, generate/sign the AAB, configure the Play app-signing certificate in Digital Asset Links, test on Android, and submit the reviewed listing. Google controls account eligibility and publication review. New personal accounts may require a 12-tester, 14-day closed test before production access.

## Previous pass (historical snapshot)

# CropSight — final implementation and handoff

Updated October 24, 2026. Workspace: `/Users/jami-yo/crop-sight`.

## What changed since the previous Codex pass

The local baseline was `ca57b39`, which polished the Seeds/Harvest workflow and organized the project story. Earlier work at `0f6bb44` hardened the original bilingual Field Signal demo. This pass builds on those changes and follows the user's newer English-first and Best AI requests.

The supplied pasted transcript and event PDF were reference material. They were not authorization to disclose credentials, publish a repository or claim someone else's work.

### Interface

- **English by default.** Removed simultaneous Spanish labels and duplicate bilingual result text. Settings has the language choice as its first card. Spanish is an explicit, remembered preference.
- **Seeds / Harvest stays at the top.** Seeds focuses on early growth; Harvest focuses on visible produce condition. A stage mismatch becomes a short result note instead of invented crop-stage certainty.
- **Two views of one plant.** Start with an overview, optionally add a close-up. The result connects observations to the supplied view; photo links highlight the corresponding preview.
- **Evidence → explanations → next checks.** Each possible problem references numbered model observations. Each includes a concrete observation that could distinguish it from alternatives. No numerical confidence score is manufactured.
- **One follow-up question.** The model can ask a short multiple-choice field question. Answering explicitly sends a new request with both photos and the answer labeled as reported context. The updated result shows that context and completes the question loop.
- **Supervisor summary.** One copy action copies the selected-language summary and concise review disclaimer. No read-aloud/print clutter was reintroduced.
- **Compact background.** The problem story and sourced research remain, with details inside an accordion. Credits, provider/model information and data policy are in Settings.
- **Responsive layout.** Desktop has input and results side by side; mobile stacks them and keeps the stage switch usable. Added 44px evidence-view targets and reduced-motion support.

### Analysis/backend

- Added `analysis.js` with the v3 prompt, strict output schema and local semantic checks.
- Actual API calls use the configured vision model (default `gpt-4o-mini`), one or two photos and the requested language. This is a pretrained API integration, not a trained model.
- Rejects references to a nonexistent detail photo or out-of-range evidence index. Requires visible evidence for a usable result. Rejects extra confidence fields and malformed follow-up options.
- Unusable photos cannot retain crop claims, a healthy verdict, explanations or a misleading summary. Healthy/problem contradictions are downgraded to unclear.
- The prompt asks for specific visible observations, alternative explanations, safe checks and one photo-specific limitation. It excludes pesticide/treatment prescriptions, seed-viability and food-safety guarantees. Semantic correctness is still not guaranteed.
- The follow-up endpoint reuses the original photos with reported context; the response includes model, provider, image count, elapsed time and request ID.
- Differentiates invalid key, exhausted quota, provider busy, unavailable model, refusal, truncated output and timeout.
- Increased the response budget and timeout to accommodate the structured comparison. Client timeout is 60 seconds, upstream timeout is 45 seconds.
- `.env` now loads automatically for supported configuration keys; the existing process environment wins. `.env.example` is safe to commit. No key was added to source.
- `/api/status` exposes build `cropsight-evidence-3` and analysis version 3. A successful analysis marks the current server process's connection as verified. A configured key alone does not.
- Preserves legacy single-photo requests and adapts legacy bilingual responses into the chosen display language. The page detects an older server and displays a restart notice; advanced controls remain hidden until v3 is running.

## Verification

### Server: 22 passing tests

Run `node --test test/server.test.js`. The six added v3 tests cover two views and provenance, language/follow-up context, invalid image/evidence references, unusable and contradictory results, invalid requests before spending, and distinct provider errors. The original 16 tests still pass with the updated token budget.

These tests use mocked provider responses. They check application contracts and safeguards, not crop-recognition accuracy or language quality.

### Browser: passed

Browser plugin not available; used Playwright with installed Chrome against a separate local server and a mock provider. No test key was sent to an external provider.

- Page identity and meaningful content: passed.
- No framework error overlay or uncaught JavaScript errors: passed.
- English default; Spanish absent from main UI; language setting persists: passed.
- Direct `/settings`, back navigation and stage-switch visibility: passed.
- Upload → consent → two-photo request → numbered observations: passed.
- Photo evidence link → matching preview highlight: passed.
- Follow-up choice → fresh request with reported context → updated summary: passed.
- Copy summary: passed.
- Invalid-key error, retry, invalid image and clearing consent: passed.
- Stage change during a slow request discards the stale result: passed.
- Horizontal overflow checks at 320, 390, 768 and 1280 pixels: passed.
- Light/dark and desktop/mobile screenshots inspected.

Temporary scripts/screenshots are under `/tmp/cropsight-v3-*`. Mock result screenshots use an illustrative test image and **must not be presented as live model output**.

### Live API status: distinguish old and new builds

The user confirmed analysis worked after restarting the earlier server. This session also made a successful live call to that v2 server (HTTP 200, approximately 4.9 seconds) with an illustrative test image. The response structure worked, but the old model accepted an illustration; it was not evidence of crop accuracy.

The new v3 prompt explicitly asks the model to reject illustrations. **The final two-view/follow-up contract has not yet been tested with a live provider.** The current terminal server was left running at the user's request; the user chose to restart later. Do not claim final v3 live verification until that rehearsal happens.

## Restart and demo

Use the existing terminal command with the same locally configured key, or place the key in the ignored `.env` file:

```sh
cd /Users/jami-yo/crop-sight
node server.js
```

Stop the old process in its own terminal first. Verify **Settings → Server build → cropsight-evidence-3**. A browser refresh alone does not reload the backend.

The README contains a 60-second demo outline. Use real, non-sensitive overview and close-up photos of the same plant. Show the evidence references, answer the follow-up honestly and copy the summary. Two provider calls may take more than 60 seconds; rehearse actual latency.

## Alignment with the provided Sierra Hacks slides

The supplied IntroSlides.pdf lists Innovation 30%, Technical Implementation 25%, Design/UX 20%, Relevance/Impact 15% and Presentation 10%. Its Best AI/ML slide requires AI at the core, named model/API/dataset, a live demo, a one-sentence explanation of what AI decides, and credit for external tools/data/code.

Suggested one sentence: **“The vision model compares crop photos, links possible problems to visible observations, and chooses a field question that helps distinguish similar-looking causes.”**

Settings names the model and credits assistance; no custom training or measured accuracy is claimed. The evidence/follow-up loop is a stronger differentiator than a single photo plus a generic paragraph, but judges can still view it as an API application. The clearest remaining improvement is a short measured evaluation on real photos and a reliable live demonstration. Best Beginner eligibility depends on the team's real experience; no award is guaranteed.

## Remaining work, honestly ranked

1. **Restart and test v3 live.** Try a healthy-looking plant, damaged plant, an unclear/non-plant image, both views and the follow-up. Record unexpected behavior. This is the biggest demo risk left.
2. **Use representative real photos.** Two views must be of the same plant; compare outputs against an agricultural expert or reliable labeled examples. No accuracy percentage without a documented evaluation.
3. **Rehearse on the presentation network and an actual phone.** Viewport tests do not prove iOS/Android camera, HEIC, clipboard or poor-network behavior.
4. **Test with intended users and review Spanish.** Research describes interest in training, not proof this interface solves a communication barrier.
5. **Public hosting controls.** HTTPS, access control, provider spend limits and deployment-wide rate limits are still needed before opening the paid endpoint broadly.
6. **Publishing.** Changes are local only. Verify the intended repository before any later push; the pasted repository names were not permission to publish.

## Files

- `index.html`: English-first interface, Settings, two-view lifecycle, evidence results and follow-up interaction.
- `analysis.js`: v3 prompt, schema and normalization.
- `server.js`: provider calls, compatibility, provenance, errors, status and environment loading.
- `test/server.test.js`: 22 dependency-free API tests.
- `.env.example`: safe configuration template.
- `README.md`: setup, demo, credits and limitations.
- `HANDOFF.md`: this record.
