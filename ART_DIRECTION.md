# DOMINION HISTORICAL OIL PAINTING

Dominion 2.1.1 retains all previous suitable artwork and adds 100 distinct original scenes: military 20, economy 18, technology 15, focuses 15, diplomacy 12, events 10, government/religion/society 10.

Realistic traditional oil painting; navy/graphite, restrained ochre and gold, natural atmospheric lighting, credible people and architecture, period-specific equipment. No captions, logos or copied game imagery. Paintings are visual context for actual systems; gameplay values and event messages remain authoritative game data.

Production: OpenAI image_gen created ten sheets, each containing ten independently composed subjects. The first military sheet established the style. Each subject cell was exported as its own WebP; no synthetic variants or duplicated files count toward the 100. The original sheets remain in `/workspace/generated_images` and are shown in the conversation. `generation-sources.json`, source SHA-256 and exact crop rectangles in `art-manifest.json` record provenance. `scripts/prepare-art211.py` reproduces exports from those original sheets, including their actual grid seams.

Android: card-sized WebPs, at most 640×384, display-size native downsampling, memoized images, no decorative bitmap work inside the map frame loop. Static Metro references register assets without decoding them. Panels mount on demand; the collection uses a small virtualized horizontal list. Existing high-resolution loading/menu paintings remain available.

Curation lives in `src/art/curation.ts`: regiment roles, building types, named research/focus themes, political institutions, religious architecture, peace clauses and real chronicle/notification categories. The full collection is available from Statistics. Historical motifs do not introduce unimplemented disasters or event mechanics.

Rights: original AI-assisted artwork generated for this project, permitted project use under the applicable OpenAI terms. No third-party game artwork or claim of exclusive copyright. Audio uses separate original procedural compositions and synthesized cues without third-party samples.
