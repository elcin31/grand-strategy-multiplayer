# Dominion asset provenance

The illustration completion pass reuses the same original portrait atlas for fictional commanders and the same building/military paintings for technology branches and open war panels. Commander visual identity derives from the existing stable ID; it does not add a save field. No extra generated artwork or third-party image was introduced by this completion pass.

## Original camera-pass artwork — 2026-10-09

Five additional original ImageGen compositions are embedded as six optimized
WebPs: a 12-person fictional ruler atlas, ten-building atlas, six-government
institution atlas, eight-faith architecture atlas and alternate night-port
loading scene (low/high). All were generated from text only; no AoH3 artwork,
photograph, screenshot or real person's portrait was supplied. The existing
military, economy, diplomacy, campaign and menu paintings are retained.

Files: `assets/art/rulers-atlas.webp`, `buildings-atlas.webp`,
`government-atlas.webp`, `religion-atlas.webp`, `loading-port-low.webp`,
`loading-port-high.webp`. Their complete checksums, dimensions and generated
source identifiers are in `assets/art/manifest.json`. Added compressed bytes:
818,030; all 15 WebPs together: 2,188,634 bytes. Four atlases together occupy
11,713,536 bytes if all decode at full source resolution; they are mounted by
the relevant panel, never by the map or hidden/collapsed sections. Shared
sources avoid a separate full image per card. Actual native memory is measured
separately; these pixel counts are not a peak-memory claim.

Final prompt set / built-in ImageGen: historical oil-painted fictional busts
(4×3, six men/six women, diverse faces, no real person); ten original
construction scenes in a fixed 5×2 order (farm, mine, factory, barracks, fort,
university, port, infrastructure, administration, hospital); government council
scenes in a 3×2 order (monarchy, republic, federation, military, theocracy,
community elders); respectful religious architecture in a 4×2 order
(Christianity, Islam, Hinduism, Buddhism, Judaism, Shinto, Sikhism, sacred grove);
16:9 lantern-lit historic port with campaign map. Shared constraints: navy,
burgundy, antique gold and parchment, original brushwork, no text/logos,
watermarks, screenshots or copied game material. Source originals remain in
the generating conversation; repo-native WebP derivatives are the shipped
assets. Secular/other/traditional belief cards use the neutral garden motif;
different Christian/Islamic branches share family architecture. Portrait seed
selects the same fictional painted miniature after save/reconnect.

## Original visual update artwork — 2026-10-09
All six illustrations under `assets/art/` were commissioned through OpenAI ImageGen specifically for Dominion in this session, from textual descriptions. No AoH3 screenshot, game artwork or other external image was supplied as generation input. Subjects: main-menu army/city panorama; campaign cartographic table; military commander; diplomacy council; trading-port economy; loading atlas.

The project user owns these outputs to the extent permitted by applicable law under OpenAI's output ownership terms: https://openai.com/policies/terms-of-use/ . They are supplied for embedding and distribution with Dominion. No third-party game license or required attribution is attached to these generated outputs. Output ownership does not guarantee exclusivity or copyright eligibility in every jurisdiction. WebP derivatives retain the original composition; source identifiers/checksums/dimensions are recorded in assets/art/manifest.json.

Heraldry and fictional miniature portraits in src/components/Heraldry.tsx are original project vector code, not extracted game sprites. Native platform fonts are used without redistributing external fonts.

## Existing assets retained
- Natural Earth world geography and populated places: public domain. https://www.naturalearthdata.com/about/terms-of-use/ . Existing source provenance remains in src/world/data/source.json and src/map/source.json.
- Flag SVGs: flag-icons MIT license, retained in src/world/data/flag-icons-LICENSE.txt. https://github.com/lipis/flag-icons . Existing required copyright/license notice remains packaged in the repository.
- Terrain/resource/game estimates: existing original game data; historical visuals do not imply factual resource deposits or demographic forecasts.

## Research only — not shipped
Age of History 3 screenshots on Steam, SteamDB and developer/community pages were viewed solely for visual/UX research. None are included in Dominion or licensed as project assets.

## Derived coastal construction sites — 2026-10-10

`supabase/functions/_shared/waterAccess.ts` and `WATER_ACCESS_REPORT.json` derive approximate port sites from the existing public-domain Natural Earth province geometry, using `scripts/derive-water-access.py`. Only exterior shores count; internal simplification holes or unrepresented land are excluded. No province/city/geometry is removed or modified, and no runtime GIS dependency is added. The report pins the unchanged source SHA. This is a game approximation, not maritime navigation data.
