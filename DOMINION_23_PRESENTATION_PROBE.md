The isolated `dominion-2.3-presentation-probe` branch tests one native submission
change: request EGL swap interval zero once a newly created window surface is
current. The camera remains scheduled by the accepted UI-runtime worklets.

This is **not an accepted optimization or a finished Dominion 2.3 release**.
The driver may clamp the request to its minimum. The default renderer remains on
`dominion-2.3-performance`, with `src/`, game engine and map assets equal to
`25fb66de948dc061262148b25f4094f25c160932`. The previous immutable-border
prototype is not included. No new gameplay systems are enabled.

Hypothesis: avoid an additional presentation wait inside the main-thread
`eglSwapBuffers` call without changing any geometry, resolution, gesture,
simulation, texture cache or presentation backend. The actual marker-scoped
Perfetto evidence is retained in `DOMINION_23_UI_SWAP_DIAGNOSTIC.json`.
These are inclusive wall-time slices in a software emulator, not GPU execution
time or physical Redmi results.

Local checks: TypeScript; 55 camera/renderer/native guard tests; seven APK guard
tests; real Expo Android prebuild; exact pinned native SHA and lifecycle guards;
original map assets and native bundle references. Runtime startup validation
requires a successful native request rather than merely a packaged marker.

Required next: compile all four ABI, verify the actual signed standalone APK,
run the unchanged A–I compositor/frame-time gate, then cold launch, update over
2.2.1, save/reload, interaction, monthly simulation and repeated LOD checks.
Only measured acceptance permits incorporating the patch into the default branch.
If rejected, preserve the candidate and raw evidence on this isolated branch.

Existing release blockers remain: 59 failures reproduced on the exact accepted
hotfix; strict save/restore inequality in the 10,000-step legacy simulation;
unfinished gameplay/content/integration validation; no two-client multiplayer
verification. No GitHub release may be described as complete until these pass.
