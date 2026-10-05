import {version as GAME_VERSION} from '../../package.json';
import type {GameState} from '../types/game';
import {normalizeGameState,CURRENT_STATE_VERSION} from '../../supabase/functions/_shared/stateMigrations';
import {initializeGovernments} from '../../supabase/functions/_shared/governmentSystem';
import {initializePopulation} from '../../supabase/functions/_shared/populationSystem';
import {initializeReligions} from '../../supabase/functions/_shared/religionSystem';
import {initializeResources} from '../../supabase/functions/_shared/resourceSystem';
import {initializeEconomy} from '../../supabase/functions/_shared/economySystem';
import {stateChecksum} from '../../supabase/functions/_shared/sessionState';
export interface CampaignMetadata {id:string;name:string;country:string|null;year:number;month:number;tick:number;lastPlayed:number;gameVersion:string;stateVersion:number;generation:number}
export interface SavedCampaign {format:1;metadata:CampaignMetadata;checksum:string;state:GameState}
export function validateCampaign(input:unknown):GameState {
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Повреждённое сохранение');
 const s=structuredClone(input) as GameState;
 if(!/^[\w-]{1,100}$/.test(s.id)||!s.countries||Array.isArray(s.countries)||!Array.isArray(s.provinces)||!Array.isArray(s.armies)||!Array.isArray(s.players)||!s.players.length||s.players.length>8||!['lobby','running','paused','finished'].includes(s.phase)||!Number.isSafeInteger(s.tick)||s.tick<0||!Number.isSafeInteger(s.year)||!Number.isInteger(s.month)||s.month<1||s.month>12||![0,1,2,3,4].includes(s.speed))throw Error('Некорректная структура кампании');
 if(s.provinces.length>10000||Object.keys(s.countries).length>300||s.armies.length>100000)throw Error('Сохранение превышает допустимый размер');
 const countries=new Set(Object.keys(s.countries)),ids=new Set(s.provinces.map(p=>p.id));
 if(ids.size!==s.provinces.length||!countries.size)throw Error('Некорректные провинции');
 for(const [id,c]of Object.entries(s.countries)){if(c.id!==id||[c.treasury,c.manpower,c.technology,c.stability].some(n=>!Number.isFinite(n)||n<0))throw Error('Некорректная страна');}
 for(const p of s.provinces){if(!countries.has(p.ownerId)||(p.controllerId&&!countries.has(p.controllerId))||!Array.isArray(p.neighbors)||p.neighbors.some(id=>!ids.has(id))||!Number.isFinite(p.income)||p.income<0)throw Error('Некорректное владение провинцией');}
 if(new Set(s.players.map(p=>p.id)).size!==s.players.length||s.players.some(p=>p.countryId&&!countries.has(p.countryId)))throw Error('Некорректные игроки');
 s.battleLog??=[];s.cities??=[];
 initializeGovernments(s);initializePopulation(s);initializeReligions(s);initializeResources(s);normalizeGameState(s);initializeEconomy(s);
 const provincesById=new Map(s.provinces.map(p=>[p.id,p]));
 if(s.dataset)for(const city of s.cities){const p=provincesById.get(city.provinceId);if(!p||city.countryId!==p.ownerId)throw Error('Некорректное владение городом');}
 return s;
}
export function encodeCampaign(state:GameState,generation:number,name?:string):string {
 const s=validateCampaign(state),country=s.players[0]?.countryId??null;
 const saved:SavedCampaign={format:1,metadata:{id:s.id,name:name??s.countries[country??'']?.name??'Новая кампания',country,year:s.year,month:s.month,tick:s.tick,lastPlayed:Date.now(),gameVersion:GAME_VERSION,stateVersion:s.stateVersion??CURRENT_STATE_VERSION,generation},checksum:stateChecksum(s),state:s};
 return JSON.stringify(saved);
}
export function decodeCampaign(text:string):SavedCampaign {
 if(text.length>32*1024*1024)throw Error('Слишком большое сохранение');
 let value:SavedCampaign;try{value=JSON.parse(text);}catch{throw Error('Сохранение повреждено: JSON не читается');}
 if(value.format!==1||!value.metadata||!Number.isSafeInteger(value.metadata.generation)||value.metadata.generation<1||value.metadata.id!==value.state?.id||value.checksum!==stateChecksum(value.state))throw Error('Сохранение повреждено: проверка целостности не пройдена');
 return{...value,state:validateCampaign(value.state)};
}
