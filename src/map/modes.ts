import type {GameState} from '../types/game';
import type {MapMode} from './settings';
import {RELIGIONS} from '../../supabase/functions/_shared/religionSystem';
import {RESOURCES} from '../../supabase/functions/_shared/resourceSystem';
import {GOVERNMENT_TYPES} from '../../supabase/functions/_shared/governmentSystem';
import {pairKey,warBetween} from '../../supabase/functions/_shared/diplomacySystem';
export const GOVERNMENT_COLORS=['#718F8A','#6F83A0','#8887A8','#A88E63','#9B705E','#956862','#778D74','#8C7185','#688D97','#8E875E'];
export const TERRAIN_COLORS={plains:'#839a6b',forest:'#386b53',mountain:'#9b9694',desert:'#c7aa70',urban:'#6d7898'};
export const DIPLOMATIC_COLORS={own:'#689bd1',ally:'#59aa83',enemy:'#cd6964',pact:'#aaa579',guarantee:'#b495c3',neutral:'#64727d'};
export function diplomaticCategory(s:GameState,reference:string,target:string):keyof typeof DIPLOMATIC_COLORS {
 if(reference===target)return'own';if(warBetween(s,reference,target))return'enemy';
 const l=s.diplomacy?.[pairKey(reference,target)];
 if(l?.treaties.some(t=>t==='Alliance'||t==='DefensivePact')||s.wars?.some(w=>w.attackers.includes(reference)&&w.attackers.includes(target)||w.defenders.includes(reference)&&w.defenders.includes(target)))return'ally';
 if(l?.treaties.includes('NonAggression'))return'pact';if(l?.guarantors.length)return'guarantee';return'neutral';
}
export function relationColor(value:number):string {const t=Math.max(-1,Math.min(1,value/100));const neutral=[100,114,125],end=t<0?[205,105,100]:[89,170,131];return`rgb(${neutral.map((n,i)=>Math.round(n+(end[i]!-n)*Math.abs(t))).join(',')})`;}
export interface LegendItem {label:string;color:string}
export function mapLegend(s:GameState,mode:MapMode):LegendItem[]{
 if(mode==='Religion'){const used=new Set(s.provinces.map(p=>p.religion));return Object.entries(RELIGIONS).filter(([id])=>used.has(id)).map(([,r])=>({label:r.name,color:r.color}));}
 if(mode==='Resources')return Object.values(RESOURCES).map(r=>({label:r.name,color:r.color}));
 if(mode==='Government')return GOVERNMENT_TYPES.map((label,i)=>({label,color:GOVERNMENT_COLORS[i]!}));
 if(mode==='Terrain')return Object.entries(TERRAIN_COLORS).map(([key,color])=>({label:({plains:'Равнины',forest:'Лес',mountain:'Горы',desert:'Пустыня',urban:'Город'})[key as keyof typeof TERRAIN_COLORS],color}));
 if(mode==='Diplomatic')return Object.entries(DIPLOMATIC_COLORS).map(([key,color])=>({label:({own:'Своя страна',ally:'Союзники',enemy:'Противники',pact:'Пакт',guarantee:'Гарантии',neutral:'Нейтральные'})[key as keyof typeof DIPLOMATIC_COLORS],color}));
 if(mode==='Relations')return[-100,0,100].map(value=>({label:String(value),color:relationColor(value)}));
 if(mode==='Political')return[{label:'Граница страны',color:'#d1d6cc'},{label:'Оккупация: цвет контролёра',color:'#dda06f'}];
 return[{label:mode==='Stability'?'Высокие беспорядки':'Меньше',color:'#424d5b'},{label:mode==='Stability'?'Спокойствие':'Больше',color:'#c5a159'}];
}
