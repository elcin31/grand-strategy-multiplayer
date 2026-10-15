import {politicalResponse} from './internalPolitics23.ts';
import type {GameState,Country} from './gameTypes.ts';
import {generateLeader} from './leaderGeneration.ts';
import {militaryEntity} from './military3System.ts';
import {money} from './economySystem.ts';
import {notify} from './notificationSystem.ts';
export const MOBILIZATION={Peacetime:{name:'Мирное время',army:1,production:1,trade:1,stability:0},Partial:{name:'Частичная мобилизация',army:1.08,production:.96,trade:.98,stability:-.15},General:{name:'Общая мобилизация',army:1.2,production:.88,trade:.92,stability:-.4}};
export const DOCTRINES={Offensive:'Наступление',Defensive:'Оборона',Mobile:'Манёвренная война',Logistics:'Логистика',Siege:'Осадная война'} as const;
export type MilitaryDoctrine=keyof typeof DOCTRINES;
export interface CommanderTraining {id:string;ownerId:string;specialization:'Offense'|'Defense'|'Logistics'|'Siege';startedDay:number;completeDay:number;academy:number;cost:number}
export function academyLevel(s:GameState,owner:string):number{return Math.min(5,s.provinces.filter(p=>p.ownerId===owner&&(p.controllerId??p.ownerId)===owner).reduce((n,p)=>Math.max(n,Math.min(p.buildings?.University??0,(p.buildings?.Barracks??0)+(p.buildings?.MilitaryBase??0))),0));}
export function commanderQuote(s:GameState,owner:string):{cost:number;days:number;academy:number;reason:string|null}{const c=s.countries[owner]!,academy=academyLevel(s,owner),cost=150;return {cost,days:Math.max(10,35-academy*5),academy,reason:(s.commanderTraining??[]).filter(q=>q.ownerId===owner).length>=3?'Одновременно готовятся не более трёх генералов':Object.values(s.commanders??{}).filter(g=>g.countryId===owner).length>=30?'Лимит 30 генералов':c.treasury<cost|| (c.politicalPower??0)<10?'Нужно 150 млн и 10 политической власти':null};}
export function trainCommander(s:GameState,owner:string,specialization:CommanderTraining['specialization']):void{const q=commanderQuote(s,owner);if(q.reason)throw Error(q.reason);const c=s.countries[owner]!;c.treasury=money(c.treasury-q.cost);c.politicalPower!-=10;s.commanderTraining??=[];s.commanderTraining.push({id:militaryEntity(s,'training'),ownerId:owner,specialization,startedDay:s.simulationDay??0,completeDay:(s.simulationDay??0)+q.days,academy:q.academy,cost:q.cost});}
export function dailyCommanderTraining(s:GameState):void{for(const q of s.commanderTraining??[]){if((s.simulationDay??0)<q.completeDay)continue;const c=s.countries[q.ownerId]!,seq=s.nextEntityId??1,leader=generateLeader(c.id,((s.campaignSeed??1)+seq*117)>>>0,c.region??'Europe'),id=militaryEntity(s,'general'),skill=Math.min(85,Math.max(25,Math.floor(leader.militarySkill*.7)+q.academy*3));s.commanders??={};s.commanders[id]={id,countryId:c.id,name:leader.name,skill,experience:0,level:1,specialization:q.specialization,commandLimit:40000+skill*1000,offense:Math.floor(skill*.4)+(q.specialization==='Offense'?8:0),defense:Math.floor(skill*.4)+(q.specialization==='Defense'?8:0),logistics:Math.floor(skill*.3)+(q.specialization==='Logistics'?8:0),siege:Math.floor(skill*.3)+(q.specialization==='Siege'?8:0)};notify(s,c.id,'War','Подготовлен генерал: '+leader.name);}s.commanderTraining=s.commanderTraining?.filter(q=>(s.simulationDay??0)<q.completeDay);}
export function setMobilization(s:GameState,c:Country,level:keyof typeof MOBILIZATION):void{
 if(c.mobilization===level)throw Error('Уровень мобилизации уже установлен');if(s.tick<(c.mobilizationCooldownUntilTick??0))throw Error('Мобилизация изменится через '+((c.mobilizationCooldownUntilTick??0)-s.tick)+' мес.');if((c.politicalPower??0)<15||c.treasury<75)throw Error('Нужно 75 млн и 15 политической власти');
 c.politicalPower!-=15;c.treasury=money(c.treasury-75);const old=c.mobilization??'Peacetime',reserve=c.reserveManpower??0;
 if(level!=='Peacetime'){const count=level==='General'?reserve:old==='General'?0:Math.floor(reserve*.35);c.reserveManpower=reserve-count;c.manpower+=count;}
 else {const returned=Math.floor(c.manpower*.5);c.manpower-=returned;c.reserveManpower=reserve+returned;}
 c.mobilization=level;politicalResponse(c,level==='Peacetime'?{Civic:5,Industrialists:3,Military:-2}:level==='General'?{Military:5,Civic:-8,Industrialists:-5}:{Military:3,Civic:-4,Industrialists:-2},'Изменение мобилизационной нагрузки');c.mobilizationCooldownUntilTick=s.tick+3;if(level==='General')c.stability=Math.max(0,c.stability-2);notify(s,c.id,'War','Объявлена '+MOBILIZATION[level].name.toLocaleLowerCase());
}
export function setDoctrine(s:GameState,c:Country,doctrine:MilitaryDoctrine):void{
 if(c.militaryDoctrine===doctrine)throw Error('Доктрина уже принята');if((c.technologies?.Military??0)<1||doctrine==='Mobile'&&(s.year<1800||(c.technologies?.Military??0)<2)||doctrine==='Logistics'&&s.year<1600||doctrine==='Siege'&&s.year<1200)throw Error('Доктрина требует военной технологии и подходящей эпохи');if(s.tick<(c.doctrineCooldownUntilTick??0))throw Error('Доктрина недавно изменена');if(c.treasury<200||(c.politicalPower??0)<30)throw Error('Нужно 200 млн и 30 политической власти');c.treasury=money(c.treasury-200);c.politicalPower!-=30;c.militaryDoctrine=doctrine;c.doctrineCooldownUntilTick=s.tick+6;
}
export function queuedManpower(s:GameState,owner:string):number{return (s.armyFormations??[]).filter(q=>q.ownerId===owner).reduce((n,q)=>n+Object.values(q.composition).reduce((n,v)=>n+v!,0)-Object.values(q.formed).reduce((n,v)=>n+v!,0),0);}
export function manpowerGrowth(s:GameState,c:Country,normal:number):number{
 // New recruits come from the existing registered population; mobilization only
 // releases the finite latent reserve. Keep old saves' available manpower intact.
 const growth=Math.min(normal,Math.max(0,Math.floor(c.population*.06)-c.army-c.manpower-(c.reserveManpower??0)-queuedManpower(s,c.id)-(c.militaryLosses??0)));
 return Math.max(0,growth);
}
export function monthlyMobilization(s:GameState):void{for(const c of Object.values(s.countries))c.stability=Math.max(0,Math.min(100,c.stability+MOBILIZATION[c.mobilization??'Peacetime'].stability));}
export function initializeMilitaryDevelopment(s:GameState):void{
 s.commanderTraining??=[];if(!Array.isArray(s.commanderTraining)||s.commanderTraining.length>900)throw Error('Invalid commander training');for(const q of s.commanderTraining)if(!s.countries[q.ownerId]||!['Offense','Defense','Logistics','Siege'].includes(q.specialization)||![q.startedDay,q.completeDay,q.academy,q.cost].every(n=>Number.isSafeInteger(n)&&n>=0)||q.startedDay>(s.simulationDay??0)||q.completeDay<=q.startedDay||q.academy>5)throw Error('Invalid commander course');
 for(const c of Object.values(s.countries)){c.mobilization??='Peacetime';c.reserveManpower??=Math.max(0,Math.floor(c.population*.06)-c.army-c.manpower-queuedManpower(s,c.id));c.militaryLosses??=0;if(!Object.hasOwn(MOBILIZATION,c.mobilization)||![c.reserveManpower,c.militaryLosses].every(n=>Number.isSafeInteger(n)&&n>=0)||c.militaryDoctrine!==undefined&&!Object.hasOwn(DOCTRINES,c.militaryDoctrine))throw Error('Invalid military development');for(const n of [c.mobilizationCooldownUntilTick,c.doctrineCooldownUntilTick])if(n!==undefined&&(!Number.isSafeInteger(n)||n<0))throw Error('Invalid military policy');}
}
