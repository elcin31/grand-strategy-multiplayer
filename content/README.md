# Dominion scenario content

`scenarios/rhine-reconstruction-compact.json` is original Dominion content on the existing `modern-world-v2` geography. The pack defines its date, country overrides, province ownership/damage, initial armies, governments, technology/resources, diplomatic relations, event definitions and focus definitions. Unspecified starting entities inherit the current modern-world scenario. No geometry is copied into the pack.

Run `npm run validate:content`. The validator rejects unknown fields and operations, duplicate identifiers, missing country/province references, invalid dates, negative quantities, cyclic focus/event graphs, and unaffordable fallback choices. Content is JSON data; there is no `eval`, script callback or user JavaScript execution.

`supabase/functions/_shared/scenarioContent.ts` is the bundled literal generated from this JSON. Validation checks that its contents and SHA256 exactly match the JSON. Bundling a new pack requires validation and registration in both client and authoritative server builds. Arbitrary client-supplied packs are not accepted as network commands.

Campaign schema27 stores the selected pack ID, immutable definition version and content hash, together with the mutable game state and event receipts. Keep published pack versions available; change an immutable definition by adding a new version and an explicit migration. Never edit a published version in place. Existing campaigns receive the default descriptor without resetting countries, armies, wars, research or their calendar. Local saves receive an exact `before-scenarios-v27.backup` before replacement.

Only the host may select a registered scenario, while the room is in its lobby. The command retains player identities/country selections and clears readiness. A running or paused campaign cannot be replaced through this command.

Events run in the monthly simulation, with one pending chain per country, bounded history, persistent receipts and a deterministic deadline. Decisions use the existing server command/CAS/receipt boundary, charge actual costs and expose blocked-choice reasons. No event polling or work is attached to a camera frame.
