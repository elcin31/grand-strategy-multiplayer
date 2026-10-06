import type {GraphicsPreset} from '../map/settings';
export type FrameRate='Auto'|30|60;
export const TIERS:GraphicsPreset[]=['Performance','Balanced','High','Ultra'];
export interface QualityState{tier:GraphicsPreset;bad:number;good:number;changedAt:number}
export function initialQuality(sceneMs:number,physicalPixels:number):GraphicsPreset{
 if(sceneMs>350||physicalPixels>5e6)return 'Performance';
 if(sceneMs<90&&physicalPixels<3e6)return 'High';return 'Balanced';
}
/** Sustained pressure only, bounded by the chosen ceiling; never touches simulation. */
export function adaptQuality(s:QualityState,ceiling:GraphicsPreset,fps:number,target:number,now:number,active:boolean):QualityState{
 if(!active||!Number.isFinite(fps)||fps<=0)return {...s,bad:0,good:0};
 const bad=fps<target*.75?s.bad+1:0,good=fps>=target*.95?s.good+1:0;
 let index=TIERS.indexOf(s.tier);if(now-s.changedAt>=20000){if(bad>=5&&index>0)return{tier:TIERS[index-1]!,bad:0,good:0,changedAt:now};if(good>=15&&index<TIERS.indexOf(ceiling))return{tier:TIERS[index+1]!,bad:0,good:0,changedAt:now};}
 return{...s,bad,good};
}
export function targetFrameRate(mode:FrameRate,tier:GraphicsPreset):number{return mode==='Auto'?(tier==='Performance'?30:60):mode;}
