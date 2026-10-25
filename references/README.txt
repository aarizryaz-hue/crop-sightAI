Team reference photos (optional)

Put labeled photos here and list them in manifest.json. The server reads this folder once at startup and sends up to 12 examples with each evidence-based (v3) analysis, so the AI can compare color, shape and stage with them.

manifest.json example:
[
  { "file": "lettuce-seeds-1.jpg", "crop": "lettuce", "stage": "seeds", "label": "Lettuce seed lot, dry, pale tan" },
  { "file": "tomato-seedling-1.jpg", "crop": "tomato", "stage": "seeds", "label": "Tomato seedlings, healthy, two true leaves" }
]

Rules: JPEG, PNG or WebP; 300 KB or smaller each; only label what is certain. Restart the server after changes. Examples are visual comparisons, not verified diagnoses.
