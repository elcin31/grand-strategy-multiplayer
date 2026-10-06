# Dominion 0.3.0 (3) — release acceptance in progress

This report is a working checkpoint, not a release-ready claim. Final artifact/commit and CI evidence will be recorded only after completion.

## Build

- Repository: elcin31/grand-strategy-multiplayer; baseline main 701c37a.
- Android application: com.elcin31.grandstrategymultiplayer.
- Expo/package version 0.3.0; Android versionCode 3.
- Build: Gradle assembleRelease, bundled Hermes JavaScript and native Skia, non-debuggable manifest gate, landscape orientation.
- Requested file: Dominion-final-release.apk; workflow artifact dominion-final-release.
- Dedicated production backend only: dfjsnjxnyjspwugjguhq.supabase.co. No service role key on the client.
- Signing retains the existing Expo-generated Android test certificate for compatibility with prior sideload checkpoints. This is a non-debuggable release variant, but not a Play Store signing configuration. Changing the certificate would require uninstalling existing signed installations or a formal key migration.

## Validation

- Measured full-world CPU performance and optimized AI context/capital lookup and unchanged multiplayer snapshot decoding. See PERFORMANCE_REPORT.md.
- Strict TypeScript and regression suite: final result pending after the long-simulation fixes.
- Python APK/world-import regressions: 3 passed with Shapely installed.
- Fuzz/chaos tests and rollback-only dedicated PostgreSQL checks passed; live HTTP CI pending.
- First long simulation found invalid imported province IDs at tick 1,850. Second found stale post-peace derived data at tick 2,000. Both were fixed with failing-then-passing regressions. Full rerun pending.
- Android prebuild and native landscape configuration pass locally. Final native build, reboot smoke and downloaded binary inspection pending.
- No physical-device testing is claimed. Emulator framestats cannot establish physical Android 60/30 FPS or thermal performance.

## Known issues / limits

See BUG_REPORT.md for severity and historical fixes. Existing limitations include pre-tribute HUD budget, no allied-land transit, dormant all-offline multiplayer clock, campaign-lifetime receipt storage, same-installation credential recovery, procedural terrain/resources and narrow-card text clipping. No new gameplay systems were added during hardening.
