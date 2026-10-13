/** Dominion 2.2 worldwide cartography. No hand-authored mountain icons.
 * Shaded relief/landcover: offline Natural Earth atlas. Geography is descriptive;
 * GameState.provinces[].terrain remains authoritative for movement and combat.
 */
export {atlasLevel,atlasSurface,smoothDetail} from './atlas22';
export const TERRAIN_SOURCE={name:'Natural Earth I shaded relief / landcover',license:'Public domain',projection:'EPSG:4326 equirectangular',worldWidth:1440,worldHeight:720,maxPixelsPerWorldUnit:6} as const;
