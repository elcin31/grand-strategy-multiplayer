# Dominion 2.2 — map foundation checkpoint

- Branch: `dominion-2.2-world-map-overhaul`; recovered HEAD `604f9d3ffc5876e5a594d4821ae49828abdc485a` from confirmed 2.1.2. Runtime baseline `4d10489`, release `v2.1.2-playtest.1` verified. Use `git rev-parse HEAD` for the current checkpoint SHA.
- Five attached concepts inspected; art direction in `MAP_ART_DIRECTION.md`.
- Existing Skia tile renderer, native TextureView/recorder fixes, UI-thread camera, world geometry and save schema retained. No gameplay/backend migration planned.
- Foundation: offline atlas structure and implementation plan. Dependencies installed.
- Next: precompute worldwide Natural Earth relief/landcover tiles and river/lake vectors in Dominion's equirectangular coordinates, then integrate static geography and dynamic political rendering.
- APK 2.2 is not built yet. Previous releases remain unchanged.
