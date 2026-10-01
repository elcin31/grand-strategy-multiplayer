# World update QA — ongoing

This is a running report, not the final Phase 20 QA acceptance.

## Fixed during renderer work

| Severity | Issue | Fix / verification |
|---|---|---|
| HIGH | Rectangular grid could not identify geographic territories | Geographic polygons, holes/islands and interior-anchor tests |
| HIGH | Scroll layout competed with map gestures and left little map space | Dedicated landscape canvas and collapsible overlay panel |
| MEDIUM | No camera bounds or zoom invariants | Finite-value clamps and focal-point round-trip tests |
| MEDIUM | Coastal city taps could miss generalized land | Marker hit testing uses assigned province; coordinates checked within coastline tolerance |
| MEDIUM | No native build or embedded-bundle test gate | CI release archive validation and Android cold-launch smoke job |
| LOW | Entry copy incorrectly claimed local transport for online rooms | Corrected copy; offline entry is now a separate real transport |

## Open release gates

| Severity | Gate | Status |
|---|---|---|
| BLOCKER | Complete global world-update acceptance criteria | Not implemented yet; existing scenario remains 8 countries / 12 provinces |
| BLOCKER | Native release build and cold-launch for current change | Pending CI |
| HIGH | Physical-device map FPS and gesture profiling | Pending; CPU query benchmark is not proof of 30/60 FPS |
| HIGH | Save/reconnect/host migration and multiplayer chaos testing | Scheduled Phase 17/20; not claimed working |
| HIGH | Remaining map modes backed by authoritative schemas | Scheduled later phases; unavailable modes are not mock buttons |

The final world-update APK must not be released while BLOCKER/CRITICAL gates remain open. The renderer checkpoint may be built for verification only.
