import {TIERS,type FrameRate} from './quality';
import type {GraphicsPreset} from '../map/settings';
export interface GraphicsPreferences{preset:GraphicsPreset;frameRate:FrameRate;adaptive:boolean}
export function parsePreferences(raw:string|null):GraphicsPreferences|null{
 try{const p=JSON.parse(raw??'null');if(!p||!TIERS.includes(p.preset)||!['Auto',30,60].includes(p.frameRate)||typeof p.adaptive!=='boolean')return null;return{preset:p.preset,frameRate:p.frameRate,adaptive:p.adaptive};}catch{return null;}
}
export async function loadPreferences(){try{const store=await import('expo-secure-store');return parsePreferences(await store.getItemAsync('dominion.graphics.v1'));}catch{return null;}}
let pending=Promise.resolve();
export function savePreferences(value:GraphicsPreferences){pending=pending.then(async()=>{const store=await import('expo-secure-store');await store.setItemAsync('dominion.graphics.v1',JSON.stringify(value));}).catch(()=>{});}
