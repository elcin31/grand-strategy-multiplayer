`dominion-2.3-texture-presentation-fix` isolates the combination of two already
measured native changes: HWUI owns the TextureView consumer, and the producer
requests asynchronous EGL buffer submission after its window becomes current.
No gesture, map geometry, atlas, cache, simulation, backend, package identity,
signature policy or new gameplay is changed. Version2.3.0-dev.12/code27.

Neither earlier change is accepted in isolation. Dev10 (swap request only)
failed five primary tail metrics. Dev11 (consumer ownership only, original
swap) eliminated472 retained failed-call messages but **failed the complete
native gate**: panP95+83.46%, zoom-inP95+62.71%, zoom-outP95+87.42%, and other
regressions. P50 grew roughly1.76–2.58x. Memory alone passed the32MiB criterion.
See `DOMINION_23_PERFORMANCE_DEV11_UNACCEPTED.json` for every original result.

The new hypothesis is buffer-queue backpressure on the UI-thread producer when
the framework consumer replaces the SDK's failed manual acquisition. It is not
proved by frame quantiles; the combined actual APK must pass the unchanged
A–I gate and all interaction/upgrade/save/monthly/LOD checks before acceptance.
No claim of improvement or physical Redmi FPS is made.

Local prebuild, exact native source guards, TypeScript and57 renderer/native
tests passed. Scope/ownership assertions now use the live application PID while
keeping the complete old baseline log. The dev11 first upgrade validation
incorrectly attributed oldPID2224's warnings to newPID4836; preserved failure
and frozen-APK retest are recorded separately. The installed binary is unchanged.

Default `dominion-2.3-performance` remains the accepted2.2.1 renderer, and every
`src/`, game-engine and asset file remains equal to25fb66d. StageA stays open.
Gameplay/content,59 baseline source failures, strict long-save mismatch, two
real multiplayer clients and the final2.3 release remain unfinished. The ZIP
workflow publishes labelled test checkpoints without creating a GitHub release.
