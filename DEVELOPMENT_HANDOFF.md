# Dominion 2.1 checkpoint

- Branch: `dominion-2.1-overhaul`
- HEAD before this commit: `0263bef6f22dc89876f6c1245a99edebce593e38`
- Completed: recovery from 11fbeec / v2.0.0-playtest.1; HUD and mini-map; calendar with daily clock, monthly accounting, 1–5 speeds, shared host controls and pause voting; schema 18→19 save migration/backup.
- Current: final integration / lean QA / Android release.
- Unfinished: resources/construction/production, technology/focus expansion, additional systems, art, integration and APK.
- Known: inherited camera microstutter (deferred). Visual reference received; use gold/graphite/navy, compact panels and era-correct historical art.
- Next: persistent strategic goals and personalities; staggered operational/tactical planning, group and escort orders; integrate with expanded industry.
- Military: 18 regiment types, formations, multi-waypoint routes/ETA/redeployment, split/merge/escort and group commands, commanders, daily battles/sieges and reports. Legal ownership retained under occupation.
- Checks: six focused military/selection tests pass; typecheck; three focused calendar/save/server-authority tests pass. No long simulations or camera benchmarks.
- Preserve Dominion 2.0 branch, release and APK; only this repo and existing Dominion backend.

- AI: persistent six-month strategic memory and six preferences; goal-based policies/research/focuses; staggered tactical support/retreat/assault, group planning and escorts; supply/coalition/reserve guards retained. Typecheck passed.

- Resources: 35 resources, deterministic secondary deposits preserving originals; bounded stockpiles and actual extraction/consumption, shortages and price/producer rankings; consenting trade contracts and bounded auto-buy; economy receives only actual export revenue. Schema 21.

- Construction: 40 building types, paid material requirements, technology/era/deposit/coast restrictions; real national capacity/queue priorities/bulk orders; suspension under occupation, damage/repair and opt-in auto-repair; six staged national projects; full filtered catalogue UI.

- Production: 15 material/energy-limited recipes, per-enterprise specialization and orders, civil/military allocation, actual recruitment/reinforcement equipment spending and shortages. Typecheck and six focused industry/trade/calendar/save/authority checks passed after fixing extraction of weighted legacy deposits.

- Technology: 100 original connected nodes in nine directions; graph/prerequisite validation, institution requirements, actual capabilities and bounded effects across economy/army/logistics/research/construction/intelligence. Modern new campaigns receive foundational knowledge; old save discoveries and paid progress retained. Direction-filtered graph stays independent of map camera. Typecheck and two targeted DAG/research/save/capability checks passed.

- Focuses: 120 original nodes, eight countries with unique branches, exclusive paths, eight spirits, eight timed decisions and once-only event choices. Two targeted focus/decision/save checks pass.
- Strategy: fog projections for client/server, war goals including allied intervention, constrained peace demands, reparations/guarantees/disarmament; exhaustion economy/politics; vassal autonomy and consent-based integration; four advisers, world chronicle and six rankings; optional eight-step tutorial. Two targeted authority/fog/war/save checks pass. Schema 23.

- Art/UI: official visual reference adapted into compact gold/navy controls, original SVG icons, army context dock, actual SVG flags and three new era-appropriate optimized WebP paintings. All 2.0 illustrations retained.
