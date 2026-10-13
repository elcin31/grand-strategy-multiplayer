# Dominion 2.2 — map implementation checkpoint

- Branch `dominion-2.2-world-map-overhaul`, recovered from confirmed 2.1.2 `604f9d3`. Foundation commit `0012db3`; `git rev-parse HEAD` gives this checkpoint SHA. Previous APK/releases untouched.
- Implemented: static worldwide Natural Earth landcover/shaded-relief atlas, bathymetric water, 1454 river / 1355 lake features, three offline tile levels, runtime clipping to existing land geometry; colour-only political tiles and independent borders; country labels/capital stars and city LOD.
- Strategic layers: actual army flags/supply/status, confirmed routes/arrows/ETA, control-derived war fronts, occupation hatching, active battle/siege indicators; real building/resource symbols, six economy filters, explicitly schematic accepted-contract capital links and local infrastructure links.
- Province: existing movable window now has overview/cities/infrastructure/resources/construction/military tabs; uses existing commands and historical art. Compact map mode/filter bars and consistent mini-map palette.
- 183 WebP atlas assets: 11.59 MB total. Source archives excluded, reproducible generator and licence/hash manifest included. Atlas LRU 32 MB plus viewport cap; existing political raster LRU 32 MB. No per-frame geography generation.
- Gameplay/backend/save schema 25/IDs and existing UI-thread camera retained. Static geography takes no GameState input. No backend rollout required; 2.1.2 compatible.
- Next: focused map-data/selection checks, short native screenshots and standalone 2.2/code14 build. Physical Redmi performance is not yet measured.
