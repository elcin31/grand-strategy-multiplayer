# Dominion 2.0 — playtest (2026-10-12)

Standalone Android RELEASE APK: **Dominion-2.0-playtest.apk**.
Version 2.0.0 (10); package com.elcin31.grandstrategymultiplayer; Android 7.0+ (API 24); landscape; embedded Hermes; arm64-v8a, armeabi-v7a, x86 and x86_64. Metro and Expo Go are not needed.

## Included

Diplomacy 2.0, espionage and diplomatic AI; Economy 2.0 and construction; Military 2.0, army selection/deselection and supply; Technology Tree 2.0; national focus/courses; new gameplay panels; 42 historical illustrations; existing multiplayer and save/load. The 195-country world, 2924 provinces and 5411 cities are retained. Existing performance improvements are preserved.

## Verification

The exact runtime a180f5851d47c717f9b8fa44e794070bcba625ef passed strict typecheck, 324 JS tests, 110 Python tests, standalone Gradle assembleRelease and APK/native/artwork integrity checks. Original Actions build 38234126548 supplies this binary; metadata changes do not rebuild it.

Existing 10000-tick simulation and production Dominion backend integration passed. Actual native multiplayer creation, once-only course payment, reconnect after menu/process/reboot and host takeover passed. Actual in-place upgrade from 0.8.1 retained UID, campaigns, encrypted preferences and six immutable migration backups (schema 12 -> 18). Exact-binary native smoke passed offline cold launch, main menu, single-player start, map/basic camera input, province and army selection/deselection, diplomacy, save/load, process restart and device reboot without game fatal logs. The previously running 1821-second soak also passed; no new performance pass was started. All six essential original jobs succeeded; the original run's failure is exclusively the deliberately deferred camera comparison. The final publication commit and artifact IDs are attached in PLAYTEST_RELEASE_MANIFEST.json.

## Known issue

**KNOWN ISSUE — CAMERA MICROSTUTTER / PAN-ZOOM PERFORMANCE.**
Camera stutter and failed/incomplete camera benchmark acceptance are deliberately deferred by the user to the next update. They do not block this playtest. No ideal smoothness or physical Xiaomi performance is claimed. No further renderer changes or camera profiling were performed for publication.

The project retains its existing signing certificate to preserve installation/update compatibility. It is an inherited development certificate; the APK itself is a non-debuggable release build.

## Binary identity

APK bytes: 142483341.
SHA-256: 0bb66262090e66bbdfa4151aea1869e78fdc83b76423847093b1fc4ecd023448.
Original artifact: 11741660079, dominion-camera-illustrated-release, run 38234126548.
Runtime commit: a180f5851d47c717f9b8fa44e794070bcba625ef.
Recovered HEAD: 018b4972df48354114754c8602605722956d80b9.
Release tag: v2.0.0-playtest.1.

Direct APK: https://github.com/elcin31/grand-strategy-multiplayer/releases/download/v2.0.0-playtest.1/Dominion-2.0-playtest.apk
