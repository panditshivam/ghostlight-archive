---
title: Ghostlight Archive
emoji: 🕯️
colorFrom: green
colorTo: gray
sdk: static
app_file: index.html
pinned: false
license: apache-2.0
---

# Ghostlight Archive

Help Wisp, a wandering lantern-carrying ghost, recover five lost keepsakes. A small open
embedding model searches an original fictional archive in the browser. Matching
rooms light up; every card quotes its complete source passage. Pin clues and
download an evidence trail, or paste your own small archive.

## Play

Choose **Enter the house**. Read each mystery, search it in your own words, and
**Offer this clue to Wisp** on the passage that explains it. Recover five
keepsakes to restore the house and reach the ending. Wrong offers do not remove
progress. There is no timer. **Restart hunt** clears the hunt and pinned trail.
You can also tap a room, read its encounter and explore its source passages
without model inference. Those cards say “Room exploration” instead of a score.

Wisp wanders between rooms. Greet it or use the stationary **Call Wisp** button
for hints and a friendship badge. Visiting all six rooms earns the House historian badge. **Enable sound** starts a quiet synthesized
ambient drone and short room, ghost and recovery motifs. Sound is off initially;
volume and mute are available. Leaving the tab mutes it until explicitly enabled
again. No microphone permission, audio samples or external sound files are used.
**Pause motion** stops the ghost; reduced-motion preferences are honored.
Custom archives end the authored hunt and retain the ordinary search tool.
Game progress, visits and friendship live only in page memory, like the pins.


This is retrieval, not a generative storyteller or a factual verification tool.
Cosine similarity is not a calibrated confidence. Even an unrelated query can
return a nearest neighbor. A keyword comparison makes the simpler baseline
visible, without substituting it when model inference fails.

## Run

Serve this directory over HTTP with `python3 -m http.server 8796`, then open
`http://localhost:8796`. First model load requires Internet access. Browser cache
behavior varies; no offline guarantee is made. No build step is required.

The model is `Xenova/all-MiniLM-L6-v2` at immutable revision
`751bff37182d3f1213fa05d7196b954e230abad9`, q8 ONNX, via Transformers.js 4.3.2
and single-threaded WASM. Mean-pooled, normalized embeddings have 384 dimensions.
Text is capped at 256 model tokens. Model weights are about 23 MB; runtime and
tokenizer downloads are additional. Processing happens in a web worker. Hosting,
font and model-CDN requests occur, but archive text and questions are not sent
to a model server. No analytics, persistence, accounts or API key are included.
Reloading clears custom passages, query history and pins.

Bounds: 1–32 custom passages, 500 characters each; query 1–240 characters;
one in-flight search, top three results. English examples only; multilingual
retrieval is not validated. Embeddings for the current archive are cached in
worker memory; changing the archive invalidates the cache.

## Checks

`npm ci` installs the pinned test-only dependency from the lockfile.
`npm test` checks input bounds, ranking, finite embeddings, trail export and the ordered game state (wrong offers, duplicate clues, ending and replay).
`npm run verify:model` executes the actual model on eight fixed fictional queries
including an irrelevant question. It writes `model-check.json`; this is a
functional illustration, not a held-out model benchmark. Browser WASM is checked
separately from this CPU route. `npm run build` packages an explicit static file
allowlist for hosting. Do not deploy node_modules or model-check.json.

## Open components and credits

App, design and fictional passages: SHIVAM DWIVEDI, Apache-2.0.
Model: Xenova/all-MiniLM-L6-v2, Apache-2.0; based on sentence-transformers/all-MiniLM-L6-v2.
Runtime: Hugging Face Transformers.js, Apache-2.0.
Fonts: DM Sans and Newsreader from Google Fonts, SIL Open Font License.
Wisp is an original inline SVG; the map and animation are CSS. CSS noise is a generated SVG filter; no third-party image or audio assets.
AI assisted implementation and documentation. No human usability study is claimed.
