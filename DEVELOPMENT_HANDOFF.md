# Dominion 2.1.2 — living world checkpoint

- Working branch `dominion-2.1.2-living-world`, recovered from 2.1.1 HEAD `b7bea68`; published runtime/tag `f35f191` / `v2.1.1-playtest.1` verified. Previous releases untouched.
- Completed first implementation stage: daily bounded war AI in existing `ai3System`, friendly long-distance staging, strategic target/readiness/combat evaluation, reserve defence, coordinated attacks, siege assaults and persistent army operation memory. Removed competing monthly tactical redirects and permanent sole-capital garrison rule. Human takeover stops national automation without deleting legal marches.
- Budgets: 24 countries / 96 army decisions / 12000 route nodes per day; rotating nations/stacks, existing route/access validation and bounded cache. No camera or render AI work. Schema 25 migrates names/settings/plans from 24.
- Short warfare checks passed (3): distant sole army moves, captures two successive provinces; reserve defends attacked front; weak army avoids suicidal attack; save/load and human takeover covered. Typecheck passed.
- Next: independent server formation queue/templates, military creation/list UI, faster march/ETA; then diplomacy/geopolitics, commander plans/mobilization/development, difficulty and lean release checks.
- Existing backend `dfjsnjxnyjspwugjguhq`, v211 endpoints, authorization/package/certificate remain baseline. Final coordinated backend bundle/rollout and existing Android workflow still required. No physical device claim.
