# Diplomacy 2.0 implementation contract — preparation after stage 0 audit

This document records implementation decisions for the authorized next stage. It is not implemented gameplay or a completed stage. Do not deploy an incomplete schema to the existing production backend. Main remains dbb354ab; engine/save remain schema12 until stage3 implementation and migration tests are complete. Stage1/2 runtime d7c3d59 is undergoing same-APK full native smoke 38023398108 and forward/reverse fixed-world camera comparison 38023545936.

## Preserve and extend

Reuse diplomacySystem / warSystem / armyOrders / gameEngine / commandValidation, serverCommand's authenticated actor and the existing commit_game_command CAS/command receipts. Preserve legacy war leaders, occupation, peace conditions, construction and city IDs, old saves and 195/2924/5411 world topology. Existing schema12 link relations, guarantees, treaties, proposal expiry and active army orders must survive migration. Do not introduce another backend or client-generated mission outcomes.

Relations keep a bounded -100..100 value with recorded reasons. Migration establishes a legacy baseline rather than overwriting old relations with new defaults. Tick/event updates account for religion, government, strategic interests, trade, allies/common enemies, original-owner territorial claims, border conflict, expansion, trust and breaches. No full all-country-pair analysis on camera frames. Keep bounded recent global history and per-pair explanations; IDs use the existing entity sequence. Unknown fields and NaN/Infinity/invalid references fail at command/save boundaries.

## All eighteen actions

| Action | Required real result and validation |
|---|---|
| Improve Relations | Paid bounded diplomatic mission, capacity, monthly progress, duration/cooldown; no instant repeated +15 exploit. |
| Damage Relations | Separate gradual hostile mission with expenses and capacity, distinct from insult. |
| Send Insult | Immediate relation/trust loss, crisis event and possible deterministic AI response, actor cooldown. |
| Send Gift | Chosen validated amount in existing million-dollar money units, exact sender debit/recipient credit, bounded relation benefit, no guaranteed pact. |
| Propose Alliance | Explicit terms, human consent or server-side strategic acceptance, durations/breach history and real defensive/offensive obligations. |
| Defensive Pact | Mutual defense obligation, expiry and termination; distinguish from offensive calls. |
| Non-Aggression Pact | War validation uses active pact and truce; cancellation has a real diplomatic cost. |
| Military Access | Directional grant; permission checked by BFS, every route hop and direct movement; peaceful passage never captures or attacks neutral territory. |
| Guarantee Independence | Directional real defense obligation, bounded duration/capacity and revocation. |
| Declare War | Preserve existing authority/war leadership/participant conflict/truce checks and real ally/guarantor reactions; record causes and expansion. |
| Offer Peace | Reuse validated existing peace settlement, consent and score/cost checks; preserve occupied-territory ownership and reparations accounting. |
| Exchange Technology | Both parties consent; source knows each offered level, recipient learns only its next eligible level; revalidate era/prerequisites, active research and costs at settlement. Later technology graph must use this same eligibility adapter. |
| Trade Agreement | Real aggregated bilateral trade effect in recalcEconomy; costs, duration, war suspension/termination and history. No per-frame individual shipments. |
| Sell/Transfer Province | Sender owns and controls a real noncapital province; no war/occupation/rebellion/army/ownership conflict; recipient pays agreed price once; update every province/city/construction link and derived totals atomically without changing geography. |
| Terminate Treaty | Choose the actual treaty/obligation, remove it once, apply trust/reputation/relations/truce consequences; empty cancellation cannot fabricate immunity. |
| Demand/Ultimatum | Explicit payment or justified original-owner border claim, real threat/eligibility/cost, consent/AI acceptance or refusal event and crisis consequences; never silently grant money or land. |
| Diplomatic Summit | 3–6 explicit participants, individually recorded consent, hosting expense, expiry and revalidation of every participant; agreed multilateral pacts/trade/relations are settled once. No forced third-party war/peace. |
| Political Union | Eligible voluntary federation with clear sovereignty/market/defense terms, strong longstanding cooperation and no conflicting overlord/war. Human counterpart must consent. Preserve country/province/city identities; use and extend existing overlord/war/tribute rules rather than deleting the country catalogue. |

All actions expose requirements, server-owned costs, cooldown, restrictions, acceptance terms/chance where applicable, consequences and readable history. Client preview is informative; server rechecks on submission and acceptance. Chance is reproducible from campaign seed, tick and unique action sequence. Rejected NPC negotiations commit their legitimate sending cost/cooldown/history rather than throwing away the outcome and enabling free rerolls. Invalid commands make no mutation.

## Offers and atomic accounting

Bound pending offers per sender/pair. Incoming proposals have readable immutable terms and deadlines, accept/reject/leave-pending actions and preserved event records. Acceptance rechecks treasury, capacities, ownership, war/treaty conflicts and technology eligibility against current state. Repeated command IDs use existing receipt replay; stale concurrent attempts lose CAS and retry validation, never settle a gift/province/reward twice. Keep one-time transfers out of recurring budget costs. Trade revenue is explicit production/trade income, not disguised transfer-created cash.

Diplomatic maintenance belongs to the derived country budget and monthly treasury settlement. Do not separately debit it and then subtract it again through monthly balance. Relation missions progress only in game ticks. Mission capacity and proposal indexes are computed once per relevant tick/event; country AI remains staggered and bounded. Stage4 adds deeper diplomatic planning/espionage without replacing stage3 actions or consent.

## Movement and obligations

One shared permission helper covers owned/control territory, alliance/union/access and declared enemies. BFS runs only when issuing an order. Every hop rechecks permissions, including expired access; order type must reflect war vs peaceful movement. Passage leaves ownership/control unchanged. Revocation cancels illegal routes without teleporting/deleting armies; define bounded withdrawal permission before stage6 supply uses the same graph. Declaring war must handle coalition pacts, existing wars, guarantees and voluntary call-to-arms responses consistently with the one-active-war invariant.

## Save/protocol boundary

Introduce schema13 with explicit v12 migration, validated optional initialization, old proposal conversion and legacy relation baseline preservation. Keep exact corrupt-save refusal/checksum validation/atomic generations. Add version-specific pre-migration backup rather than overwriting or deleting an old save. Dynamic-v1 wire must retain every new mutable gameplay field and checksum; cloneGameState already recursively copies unknown mutable leaves. All old city-v12 migration conservation tests continue, with current-version expectations updated explicitly.

Existing installed 0.8.1 clients reject schema13. Resolve protocol/minimum-version rollout at final coordinated Android/backend release; do not deploy schema13 early to production rooms. New functionality is exercised through the real local/server reducer and isolated multiplayer tests meanwhile.

## Required stage3 regression gate

1. Schema12 save with pending human pact, war/peace state and active multistep order migrates and roundtrips exactly except explicit new defaults/version; old file is backed up.
2. Real authenticated commands for all18 actions, both accept/refuse/expiry and stale-condition rejection; cross-player spoofing/unknown fields/invalid amounts/invalid IDs fail atomically.
3. Gift + province sale conserve combined treasury, transfer cities once and retain ownership invariants; duplicate receipt/CAS races cannot duplicate resources.
4. Access permits neutral transit without capture, expires/withdraws correctly; alliances/guarantees/defensive pacts affect actual war participants and call decisions.
5. Relation missions progress only on ticks, consume actual capacity/budget, have readable causes/cooldowns and survive save/load.
6. Technology exchange cannot skip levels/prerequisites/era or duplicate completion from an active research project. Summit/union require every affected human's consent and settle once.
7. AI acceptance reflects relations, strength, threats/common enemies, strategic benefit and trust; player inbox/history survive save/wire/reconnect.
8. Fresh TS/JS/Python/server/save gates, camera paired regression at the same fixture, actual native panel/map/army touch flow and 10,000-tick invariants before starting stage4.
