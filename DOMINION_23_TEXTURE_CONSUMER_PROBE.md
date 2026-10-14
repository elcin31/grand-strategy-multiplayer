The isolated `dominion-2.3-texture-consumer-fix` branch removes the producer-side
`SurfaceTexture.updateTexImage` call from pinned Skia 2.6.2's Android map provider.
The object comes from `TextureView.SurfaceTextureListener`; HWUI owns its
consumer. The producer instead renders into the existing native window and
calls the unchanged `present()`. Retained baseline and dev8 logs repeatedly
show `EGLConsumer is not attached to an OpenGL ES context` followed by the
SDK's cleared exception. Exact log hashes/count limitations are recorded in
`DOMINION_23_TEXTURE_CONSUMER_DIAGNOSTIC.json`.

No Java surface lifecycle, global-reference release, native window lifecycle,
drawing callback, buffer presentation, geometry, images, cache, game simulation
or backend is changed. This branch restores the **original EGL swap interval**;
dev10's separate swap-zero experiment is not enabled. Its native source guard,
tests and dormant plugin remain available for reproducible comparison.

Metadata: 2.3.0-dev.11 / code26, unchanged application ID/signing policy, all four
ABI. Local TypeScript, 57 renderer/native tests, 120 Python passes and one skipped
external integration test; real Expo prebuild, native guards and assets pass.
The runtime harness requires the actual consumer-path startup marker and rejects
the old failed producer call. Built native markers are checked in every ABI.

This remains a **candidate**, pending a compiled APK, unchanged A–I native gate,
compatible upgrade, save/restart, army/province interaction, monthly simulation
and repeated LOD validation. Neither eliminating a failed API call nor source
checks establish displayed frame improvement or physical Redmi FPS.

Dev10's compiled source remains `4359abface739209191fd45bc9f276f58f0d9ea9`
on `dominion-2.3-presentation-probe`, APK SHA256
`a7b2ad49b9f0ccf79b8bc2df9c4f3b977e3fe055fc95c6224d971f1a789e3ca0`.
LOD run38534687467 passed; its full matrix and interaction run38534687755
are tracked separately. The accepted default stays on `dominion-2.3-performance`.
Existing gameplay/content, strict long-save and multiplayer release blockers
remain open. No complete 2.3 release is published.
