# Dominion 2.1 checkpoint

- Branch: `dominion-2.1-overhaul`
- HEAD before this commit: `0263bef6f22dc89876f6c1245a99edebce593e38`
- Completed: recovery from 11fbeec / v2.0.0-playtest.1; HUD and mini-map; calendar with daily clock, monthly accounting, 1–5 speeds, shared host controls and pause voting; schema 18→19 save migration/backup.
- Current: Military 3.0.
- Unfinished: military, AI, resources/construction/production, technology/focus expansion, additional systems, art, integration and APK.
- Known: inherited camera microstutter (deferred). Visual reference received; use gold/graphite/navy, compact panels and era-correct historical art.
- Next: timed movement, multi-day combat and siege, army operations and formations, logistics and reports.
- Checks: typecheck; three focused calendar/save/server-authority tests pass. No long simulations or camera benchmarks.
- Preserve Dominion 2.0 branch, release and APK; only this repo and existing Dominion backend.
