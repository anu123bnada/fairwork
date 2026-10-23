# Local screenshot text extraction

English printed-text OCR is opt-in and runs in a dedicated browser worker. Image
bytes stay in browser memory. No upload endpoint, remote CDN, API key, AI provider,
image persistence or automatic offer save is used. The parent worker is terminated
on cancel, timeout, navigation and completion. The resulting editable text enters
the existing paste flow only after explicit review. Existing optional AI consent
and server-side saving remain separate actions.

`node scripts/prepare-local-ocr.mjs` copies pinned npm dependencies into `vendor/`,
checks existing copies before replacement and writes SHA-256/size provenance.
Keep the lockfile, vendor manifest and license notices with distribution. Runtime
scripts and language data are self-hosted; CSP restricts the worker to same-origin
scripts/connections. Public model files may be browser-cached; private images and
OCR output are not written to cache/storage by this implementation.

Sources: Tesseract.js 7.0.0 (Apache-2.0), Tesseract.js core (Apache-2.0),
`@tesseract.js-data/eng` 1.0.0 (package declares MIT; trained data originates from
Tesseract English model distribution). Full upstream data/license provenance must
be included in the commercial dependency review; package metadata is not a legal
approval. The package postinstall donation helper was not approved or executed.

Limits: PNG/JPEG, 5 MB, 12 million decoded pixels, 45-second timeout, 10,000 output
characters. PDF, handwriting, Sinhala and Tamil are not supported. Recognition
can be wrong. No claim of verified terms, fraud detection or legal correctness.
