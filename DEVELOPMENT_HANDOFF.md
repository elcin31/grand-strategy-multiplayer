# Dominion 2.1 checkpoint

- Branch: `dominion-2.1-overhaul`
- Base / HEAD before this checkpoint: `11fbeec534af1f03464e91ab8d831b2a91d2d871` (Dominion 2.0 playtest tag).
- Completed: recovery; confirmed playtest release and full expansion-v2 ancestry.
- Current stage: HUD redesign.
- Unfinished: stages II–XV from the Dominion 2.1 request.
- Known issues: inherited camera microstutter; deferred by user. No new gameplay blockers identified.
- Next: compact campaign HUD, left navigation, notifications and functional mini-map; then day calendar above monthly tick semantics.
- Preserve: `dominion-2-playtest`, `v2.0.0-playtest.1` and published 2.0 APK. Only this repository and the existing Dominion Supabase project are in scope.
- QA policy: targeted typechecks/tests; one final standalone Android release build; no long simulation, soak or camera matrix.

Earlier Dominion 2.0 handoff and evidence remain in the base commit history.
