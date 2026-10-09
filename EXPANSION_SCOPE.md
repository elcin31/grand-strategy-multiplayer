# Dominion Expansion 2.0 — accepted scope

User instruction: 2026-10-09. Only elcin31/grand-strategy-multiplayer and its existing dedicated backend. No AssetMind resources, new repo/backend/project, topology reduction, rollback of optimized runtime, decorative controls, external LLM AI, unreported feature cuts or claims about physical Redmi FPS. Existing gameplay/state/CAS/save paths must be extended, not replaced. Stage status and exact next action are in DEVELOPMENT_HANDOFF.md; this file keeps the entire remaining scope visible across sessions.

## Sequential gates

0 Recovery/status audit/main/30 commits/baseline → 1 microstutter and frame pacing → 2 army/map interaction → 3 Diplomacy 2.0 → 4 espionage and diplomatic AI → 5 economy/construction → 6 military/supply → 7 technologies → 8 national focus → 9 original historical art/UI → 10 integration/balance/long simulation → 11 Android release/delivery. Relevant regressions must pass before the next major stage; stop feature expansion on performance regression. Record logical commits and handoff after every stage. All stages are authorized; an unfinished stage remains unfinished even if inherited partial functionality exists.

## Map and performance

Measure callback and native presentation P50/P95/P99, dropped/slow frames and 50–100ms stalls; audit UI/JS/React/GC/allocations, gesture/pinch/inertia, raster/static/dynamic layers, geometry/cache/culling/LOD/labels/markers/borders/overlays, art decoding/memory, autosave/AI/network. Same workloads before/after. Camera transform must stay off React's per-frame path; static geometry must not be rebuilt by pan. Simulation systems use monthly game ticks/events. Maintain bounded work/memory and lazy optional panels.

## Army interaction

Controls → explicit country flags/labels → army markers → province → empty map. Own-army tap selects and opens panel; target tap gives validated multi-province move/attack/battle-on-arrival; same-army tap, explicit deselect or Back clears selection and **retains order**. Another army switches. Foreign flag always opens targeted diplomacy. Cancel Movement is a separate authoritative intent. No invisible overlay or panel tap may generate an order. Test selection/deselection/repeated/switch/movement/cancel-only-selection/foreign diplomacy/flag/invalid route/save/authority.

## Diplomacy (all 18 actions)

1 Gradual budget/capacity-limited Improve Relations mission. 2 Gradual Damage Relations. 3 Immediate Insult/cooldown/crisis/response. 4 User-sized Gift with exact sender debit/recipient credit. 5 Alliance with strategic AI acceptance and actual war obligations. 6 Defensive Pact. 7 Non-Aggression Pact. 8 Directional Military Access changes route permission. 9 Independence Guarantee. 10 Declare War. 11 Offer/respond to Peace. 12 Technology Exchange with era/prerequisite/consent checks. 13 Trade Agreement changes real budgets. 14 Sell/Transfer Province validates actual ownership/existence/capital/control/payment/authority and changes exactly one territory owner. 15 Specific treaty termination/duration/breach. 16 Demand/Ultimatum with conditions and consequences. 17 Multilateral Summit/proposals/expiry/participant decisions. 18 Conditional Political Union with real benefits and AI/consent.

Country panel: flag/name/original ruler portrait/government/religion/relations with explained reasons/status/allies/wars/treaties/available military and economy intelligence/action requirements/costs/acceptance/cooldowns/limits/AI responses/event history. Reasons include strategic interests, faith/government, trade/allies/common enemies, disputes/conflicts/aggression, gifts/insults/missions/breaches. Incoming proposals accept/reject/expire. Journal persists offers/answers/treaties/gifts/insults/wars/breaches/exposed spies.

## Espionage and diplomatic AI

Four real mission types: Intelligence (army/preparation/economy/intentions/technologies, incomplete precision), Sabotage (construction delays/infrastructure/building damage), Political Intrigue (unrest/relations/disinformation), Counterintelligence (detection/reduced hostile success/diplomatic exposure). Every mission has budget/country/duration/success/discovery/result/failure/cooldown, server-seeded reproducible outcome, no client success flag. AI pursues protection/common threats/disputes/trade/trust/aggression, initiates gifts/treaties/access/alliances/terminations/threat responses/espionage/counterintelligence. Bounded indexed planning by tick/event, never full-world analysis each frame.

## Economy and construction

Budget from actual state: tax/production/trade/resources/other income; army/admin/buildings/science/diplomacy/debt-interest expenses; totals/net/treasury/debt. Policies: taxes/investment/science/military/development/infrastructure with tradeoffs. Provinces: population/development/infrastructure/production/resources/buildings/taxes/stability/modifiers. Existing resources drive production, construction, military industry and trade. Ten buildings (Farm, Mine, Factory, Barracks, Fort, University, Port, Infrastructure, Administration, Hospital), cost/time/requirements/level/effects/maintenance/progress and actual construction queue/completion. Aggregated negotiated trade, bounded borrowing/interest/repayment/financial consequences. Recruitment, army maintenance/supply/equipment/rearmament consume economic inputs.

## Military and supply

Era-compatible troop types/composition, count/morale/organization/experience/supply/effectiveness/commander/speed/upkeep. Six commander specialties (offense/defense/logistics/maneuver/siege/terrain) with bounded effects. Combat uses composition/count/readiness/supply/technology/commander/terrain/fort/defense; readable history/results. Surviving defeated armies retreat by valid paths instead of disappearing/teleporting. Paid reinforcement consumes recruits/treasury/manpower/supply/resources. Graph supply uses distance/infrastructure/control/access/enemy blockade/capacity and distant attrition/morale/organization/effectiveness. Indexed/cached event-invalidated/tick supply; AI plans around supply/composition/terrain/attrition/objectives/defense.

## Technologies

Five proper branches: Economy, Military, Infrastructure, Science, State & Communications. Named nodes carry ID/title/era/prerequisites/cost/progress/effects/unlocks/icon. Funding/universities/capacity/modifiers/focus rewards drive research. No graph bypass; campaign era initializes obsolete fundamentals instead of making modern states research ancient basics. Connected touch-friendly tree with locked/available/researching/completed/progress/details/prerequisites/search/filter/landscape and lazy/culling/virtualization as needed. Tests for cycles/prereqs/completion/cost/effect/era/save/network.

## National Course

Original economic/military/diplomatic/political branches; node ID/title/description/original illustration/prerequisites/duration/conditions/rewards/exclusions/events. Effects touch real economy/research/unlocks/army/diplomacy/reforms/decisions/justified claims. Cooperation vs expansion is meaningfully exclusive. Full generic tree for all nations, regional paths, original unique paths for several major powers and extensible catalogue. Events have consequential choices. AI picks strategies based on economy/threat/government/goals. Tick progress and exactly-once reward ledger persist; tree mounts only when opened.

## 19 NEW paintings, minimum

Diplomacy: negotiations/alliance/crisis/gift/peace (5). Military: infantry/era-appropriate mobility/artillery-support/commanders (4). Construction: fortress/university/industry/port (4). Government: monarchy/republic/authoritarian (3). Religion: architecture/institutions/peaceful symbolic scene (3). Additional original diverse ruler/thematic art for espionage/economy/tech/focus/loading/events. Classical historical oil painting, realistic painterly texture/atmospheric restrained light/architecture/serious tone; no glossy/cartoon/inconsistent imagery or protected game assets. Document origin/rights in ASSET_CREDITS.md; optimized WebP/sensible sizes/lazy decoding/bounded caching outside camera movement. Reusing previous 15 files does not meet 19 **new** requirement.

## Integration, authority and verification

Verify full chains: metallurgy→factory→military industry/equipment→budget/rearmament/cost/supply; relations→accepted alliance→war obligation; industrial focus→economic reward/research/building unlock; discovered espionage→relations/event/response; long war→army cost/resources/stability/civil investment/trade. Server validates every intent, money/build/research/reward/spy/combat/territory mutation; use existing atomic CAS/replay receipts. Version/migrate saves without deletion. No NaN/Infinity/money duplication/orphan provinces/duplicate treaties/impossible tech/repeated rewards/invalid spies/army orders/corrupt saves.

Run several characteristic long scenarios and preserve at least 10,000-tick harness, economy/war/treaty/spy/build/research/focus/supply/debt/population statistics and exact restores. Mandatory TS/JS/Python/server/economy/military/diplomacy/espionage/graphs/save/AI/native UI/camera/art/release checks. Specific UX chain includes gift/alliance after army-order deselection; integration chain researches/unlocks/builds/focus/rewards once/saves/restores. Maintain readable Android landscape/large targets/closed panels/error/loading/double-action protection/correct formatting; preserve historical design and map space.

## Final release gate

Only after all stages pass: increment compatible Android versionCode, retain signing certificate, production dedicated endpoint, non-debuggable embedded Hermes bundle/Skia, landscape, offline standalone and install/update QA. Check actual GitHub Actions success/artifact/download/unzip/CRC/bundle/metadata/signature/compatibility. Final name **Dominion-grand-strategy-v2-release.apk**. Attach exact verified file; if impossible give verified concrete build/download path. No final-ready or physical FPS claim from an intermediate checkpoint; disclose changed-signature/update/data risks if actually present. DELIVERY remains pending until finished APK is available to the user.
