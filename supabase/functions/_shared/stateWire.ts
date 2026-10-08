import type {GameState} from './gameTypes.ts';
import {countryDefinitions,provinceDefinitions,cityDefinitions} from './worldDefinitions.ts';
import {stateChecksum} from './sessionState.ts';
const countries=new Map(countryDefinitions.map(v=>[v.id,v]));
const provinces=new Map(provinceDefinitions.map(v=>[v.id,v]));
const cities=new Map(cityDefinitions.map(v=>[v.id,v]));
const countryKeys=['name','shortName','color','adjective','flag','region'];
const provinceKeys=['name','neighbors','cityIds','x','y','width','height'];
const cityKeys=['name','provinceId'];
type Row=Record<string,unknown>;
function strip(row:Row,definition:unknown,keys:string[]):Row{
 const result={...row},base=definition as Row|undefined;if(!base)return result;
 let mask=0;keys.forEach((key,i)=>{if(Object.hasOwn(row,key)&&JSON.stringify(row[key])===JSON.stringify(base[key])){delete result[key];mask|=1<<i;}});if(mask)result.$static=mask;
 return result;
}
function restore(row:Row,definition:unknown,keys:string[]):Row{
 const base=definition as Row|undefined;if(!base)throw new Error('Unknown dynamic snapshot entity');
 const result={...row},mask=Number(row.$static??0);if(!Number.isInteger(mask)||mask<0||mask>=(1<<keys.length))throw new Error('Invalid static mask');delete result.$static;keys.forEach((key,i)=>{if(mask&(1<<i)){if(Object.hasOwn(row,key)||!Object.hasOwn(base,key))throw new Error('Invalid static field');result[key]=base[key];}});return result;
}
export interface WireResponse{state:GameState;checksum?:string;stateEncoding?:'dynamic-v1';wireChecksum?:string}
/** Opt-in protocol. Old clients keep full snapshots; mutable gameplay fields always travel. */
export function encodeSnapshot<T extends WireResponse>(response:T):T&WireResponse{
 if(response.state.dataset!=='modern-world-v2')return response;
 const s=response.state;
 const state={...s,countries:Object.fromEntries(Object.entries(s.countries).map(([id,c])=>[id,strip(c as unknown as Row,countries.get(id),countryKeys)])),provinces:s.provinces.map(p=>strip(p as unknown as Row,provinces.get(p.id),provinceKeys)),cities:s.cities?.map(c=>strip(c as unknown as Row,cities.get(c.id),cityKeys))} as unknown as GameState;
 return{...response,state,checksum:response.checksum??stateChecksum(s),stateEncoding:'dynamic-v1',wireChecksum:stateChecksum(state)};
}
export function decodeSnapshot<T extends WireResponse>(response:T):T{
 if(!response.stateEncoding)return response;
 if(response.stateEncoding!=='dynamic-v1'||response.state.dataset!=='modern-world-v2'||!response.wireChecksum||stateChecksum(response.state)!==response.wireChecksum)throw new Error('Invalid dynamic snapshot');
 const s=response.state;
 const state={...s,countries:Object.fromEntries(Object.entries(s.countries).map(([id,c])=>[id,restore(c as unknown as Row,countries.get(id),countryKeys)])),provinces:s.provinces.map(p=>restore(p as unknown as Row,provinces.get(p.id),provinceKeys)),cities:s.cities?.map(c=>restore(c as unknown as Row,cities.get(c.id),cityKeys))} as unknown as GameState;
 return{...response,state};
}
