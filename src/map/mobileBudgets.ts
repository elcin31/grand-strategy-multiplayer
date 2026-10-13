import type {GraphicsPreset} from './settings';
const MiB=1024*1024;
/** Both image caches share one explicit mobile budget; encoded assets stay on disk. */
export const MOBILE_MAP_BUDGETS={
  Performance:{atlasBytes:12*MiB,politicalBytes:12*MiB,atlasEntries:12,detailTiles:4},
  Balanced:{atlasBytes:24*MiB,politicalBytes:16*MiB,atlasEntries:18,detailTiles:6},
  High:{atlasBytes:48*MiB,politicalBytes:32*MiB,atlasEntries:28,detailTiles:8},
  Ultra:{atlasBytes:64*MiB,politicalBytes:40*MiB,atlasEntries:36,detailTiles:8},
} as const;
export const mapBudget=(preset:GraphicsPreset)=>MOBILE_MAP_BUDGETS[preset];

/** Bounded visible border snapshots, separate from the existing terrain/tint
 * budgets. High/Ultra retain vector strokes. Allocation never evicts a live
 * snapshot: a full budget falls back to the original exact vector picture. */
export const borderRasterBudget=(preset:GraphicsPreset)=>preset==='Balanced'?12*MiB:preset==='Performance'?6*MiB:0;
