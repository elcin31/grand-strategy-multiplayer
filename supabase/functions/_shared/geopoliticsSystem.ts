import {setMobilization} from './militaryDevelopment.ts';
import type {GameState,Country} from './gameTypes.ts';
import {diplomaticLink,pairKey,warBetween} from './diplomacySystem.ts';
import {relationChange,logDiplomacy} from './diplomacy2System.ts';
import {money} from './economySystem.ts';
import {militaryEntity} from './military3System.ts';
import {notify} from './notificationSystem.ts';
export interface RegionalInterests {neighbours:string[];rivals:string[];partners:string[];claimedProvinceIds:string[];reviewTick:number;reason:string}
export interface Coalition {id:string;targetId:string;members:string[];startedTick:number;untilTick:number}
export type CrisisKind='Border'|'Ultimatum'|'Mobilization'|'TradeRoutes'|'Intervention';
export type CrisisResolution='Negotiate'|'Concede'|'Mobilize'|'StandFirm';
export interface DiplomaticCrisis {id:string;from:string;to:string;provinceId:string;kind:CrisisKind;startedTick:number;deadlineTick:number;status:'Open'|'Resolved';reason:string;resolution?:CrisisResolution;resolvedTick?:number;respondedBy?:string[]}
export function internationalThreat(c:Country):number{return c.internationalThreat??0;}
function worldNotice(s:GameState,countries:string[],message:string):void{for(const p of s.players)if(p.countryId&&!p.aiControlled&&!countries.includes(p.countryId))notify(s,p.countryId,'Diplomacy',message);}
export function refreshRegionalInterests(s:GameState,c:Country,neighbours:string[],claims:string[]):void{
 c.regionalInterests={neighbours:[...neighbours],rivals:neighbours.filter(id=>(s.diplomacy?.[pairKey(c.id,id)]?.rivals.length??0)>0||internationalThreat(s.countries[id]!)>=35),partners:neighbours.filter(id=>(s.diplomacy?.[pairKey(c.id,id)]?.relation??0)>=20),claimedProvinceIds:claims.slice(0,20),reviewTick:s.tick+6,reason:claims.length?'Возврат спорных территорий':neighbours.some(id=>internationalThreat(s.countries[id]!)>35)?'Сдерживание региональной угрозы':'Развитие торговых путей и безопасных границ'};
}
export function openCrisis(s:GameState,from:string,to:string,provinceId:string,kind:CrisisKind,reason:string):void{
 const c=s.countries[from]!,p=s.provinces.find(p=>p.id===provinceId);if(!c||!s.countries[to]||from===to||!p||warBetween(s,from,to)||s.tick<(c.crisisCooldownUntilTick??0)||(c.politicalPower??0)<10||s.diplomaticCrises?.some(x=>x.status==='Open'&&[x.from,x.to].includes(from)))return;
 const l=s.diplomacy?.[pairKey(from,to)];if(l?.treaties.includes('Alliance')||s.tick<(l?.truceUntilTick??0))return;
 c.politicalPower!-=10;c.crisisCooldownUntilTick=s.tick+18;s.diplomaticCrises??=[];s.diplomaticCrises.unshift({id:militaryEntity(s,'crisis'),from,to,provinceId,kind,startedTick:s.tick,deadlineTick:s.tick+3,status:'Open',reason});s.diplomaticCrises=s.diplomaticCrises.slice(0,80);
 logDiplomacy(s,[from,to],'Crisis','Международный кризис: '+reason);notify(s,to,'Diplomacy',c.name+': '+reason,provinceId);notify(s,from,'Diplomacy','Начался дипломатический кризис',provinceId);
}
export function resolveCrisis(s:GameState,actor:string,id:string,resolution:CrisisResolution):void{
 const x=s.diplomaticCrises?.find(x=>x.id===id&&x.status==='Open');if(!x||![x.from,x.to].includes(actor))throw Error('Кризис недоступен');const c=s.countries[actor]!,other=actor===x.from?x.to:x.from;
 if(resolution==='Mobilize'){
  if(x.respondedBy?.includes(actor))throw Error('Позиция уже заявлена');if((c.mobilization??'Peacetime')==='Peacetime')setMobilization(s,c,'Partial');else {if((c.politicalPower??0)<10)throw Error('Нужно 10 политической власти');c.politicalPower!-=10;}c.internationalThreat=Math.min(100,internationalThreat(c)+3);x.respondedBy??=[];x.respondedBy.push(actor);relationChange(s,actor,other,'crisis:'+id,'Демонстрация силы',-5);return;
 }
 if(resolution==='Negotiate'){if(c.treasury<25)throw Error('Нужно 25 млн для переговоров');c.treasury=money(c.treasury-25);relationChange(s,actor,other,'crisis:'+id,'Урегулирование кризиса',12);}
 if(resolution==='Concede'){if(c.treasury<50)throw Error('Нужно 50 млн для компенсации');c.treasury=money(c.treasury-50);s.countries[other]!.treasury=money(s.countries[other]!.treasury+50);c.stability=Math.max(0,c.stability-1);relationChange(s,actor,other,'crisis:'+id,'Дипломатический компромисс',20);}
 if(resolution==='StandFirm'){if((c.politicalPower??0)<5)throw Error('Нужно 5 политической власти');c.politicalPower!-=5;relationChange(s,actor,other,'crisis:'+id,'Нерешённый территориальный спор',-10);}
 else {diplomaticLink(s,actor,other).truceUntilTick=Math.max(s.tick+6,diplomaticLink(s,actor,other).truceUntilTick);s.countries[x.from]!.internationalThreat=Math.max(0,internationalThreat(s.countries[x.from]!)-3);}
 x.status='Resolved';x.resolution=resolution;x.resolvedTick=s.tick;logDiplomacy(s,[x.from,x.to],'CrisisResolved','Кризис завершён: '+({Negotiate:'переговоры',Concede:'компромисс',StandFirm:'дипломатическое противостояние',Mobilize:'мобилизация'}[resolution]));notify(s,other,'Diplomacy','Дипломатический кризис завершён');
}
export function joinCoalition(s:GameState,owner:string,id:string):void{
 const q=s.coalitions?.find(q=>q.id===id);if(!q||q.targetId===owner||q.members.includes(owner)||warBetween(s,owner,q.targetId)||s.countries[owner]?.overlordId||!s.countries[owner]?.provinceIds?.length)throw Error('Коалиция недоступна');
 const link=s.diplomacy?.[pairKey(owner,q.targetId)];if(link?.treaties.some(t=>['Alliance','PoliticalUnion'].includes(t)))throw Error('Союзник не может вступить в коалицию против партнёра');if((s.countries[owner]!.politicalPower??0)<10)throw Error('Нужно 10 политической власти');s.countries[owner]!.politicalPower!-=10;q.members.push(owner);
}
/** Monthly diplomacy work only; neighbour lists are reused from strategic AI. */
export function monthlyGeopolitics(s:GameState):void{
 for(const c of Object.values(s.countries))c.internationalThreat=Math.max(0,internationalThreat(c)-.4);
 s.coalitions=s.coalitions?.filter(q=>q.untilTick>s.tick&&internationalThreat(s.countries[q.targetId]!)>=25);
 for(const c of Object.values(s.countries)){
  if(internationalThreat(c)<45||s.coalitions?.some(q=>q.targetId===c.id)||!c.provinceIds?.length)continue;
  const members=Object.values(s.countries).filter(other=>other.id!==c.id&&other.regionalInterests?.neighbours.includes(c.id)&&!s.players.some(p=>p.countryId===other.id&&!p.aiControlled)&&other.provinceIds?.length&&!other.overlordId&&!warBetween(s,other.id,c.id)&&(other.politicalPower??0)>=10&&!s.diplomacy?.[pairKey(other.id,c.id)]?.treaties.some(t=>['Alliance','PoliticalUnion'].includes(t))).sort((a,b)=>b.army-a.army).slice(0,8);
  if(members.length<3)continue;for(const member of members)member.politicalPower!-=10;s.coalitions??=[];s.coalitions.push({id:militaryEntity(s,'coalition'),targetId:c.id,members:members.map(m=>m.id),startedTick:s.tick,untilTick:s.tick+24});logDiplomacy(s,members.map(m=>m.id),'Coalition','Оборонительная коалиция сдерживает '+c.name);worldNotice(s,members.map(m=>m.id),'Сформирована коалиция против '+c.name);break;
 }
 for(const x of s.diplomaticCrises??[])if(x.status==='Open'&&x.deadlineTick<=s.tick){const actor=!s.players.some(p=>p.countryId===x.from&&!p.aiControlled)?x.from:!s.players.some(p=>p.countryId===x.to&&!p.aiControlled)?x.to:null;if(actor){try{resolveCrisis(s,actor,x.id,s.countries[actor]!.treasury>=25?'Negotiate':'StandFirm');}catch{x.status='Resolved';x.resolvedTick=s.tick;x.resolution='StandFirm';}}}
}
export function collectGeopolitics(before:GameState,after:GameState):void{
 if(!after.dataset)return;
 const oldWars=new Set(before.wars?.map(w=>w.id));for(const w of after.wars??[])if(!oldWars.has(w.id)){const c=after.countries[w.attackers[0]!]!;c.internationalThreat=Math.min(100,internationalThreat(c)+10);c.lastAggressionTick=after.tick;worldNotice(after,[...w.attackers,...w.defenders],`${c.name} объявляет войну ${after.countries[w.defenders[0]!]!.name}`);}
 const history=new Set(before.diplomaticHistory?.map(e=>e.id));for(const e of after.diplomaticHistory??[])if(e.kind==='TreatyTerminated'&&!history.has(e.id)){const c=after.countries[e.countries[0]!]!;c.internationalThreat=Math.min(100,internationalThreat(c)+3);}
 const oldPeace=new Set(before.warHistory?.map(w=>w.id));for(const w of after.warHistory??[])if(!oldPeace.has(w.id))for(const id of [...w.attackers,...w.defenders])after.countries[id]!.lastWarEndedTick=after.tick;
 const gains=new Map<string,number>();for(let n=0;n<after.provinces.length;n++){const p=after.provinces[n]!,old=before.provinces[n];if(old&&old.ownerId!==p.ownerId)gains.set(p.ownerId,(gains.get(p.ownerId)??0)+1);}
 for(const [id,n] of gains){const c=after.countries[id]!;c.internationalThreat=Math.min(100,internationalThreat(c)+Math.min(30,n*3)+(after.tick-(c.lastAggressionTick??-100)<6?4:0));c.lastAggressionTick=after.tick;}
}
export function initializeGeopolitics(s:GameState):void{
 s.coalitions??=[];s.diplomaticCrises??=[];if(!Array.isArray(s.coalitions)||s.coalitions.length>100||!Array.isArray(s.diplomaticCrises)||s.diplomaticCrises.length>80)throw Error('Invalid geopolitical ledger');
 for(const c of Object.values(s.countries)){c.internationalThreat??=Math.min(100,c.aggressiveExpansion??0);if(!Number.isFinite(c.internationalThreat)||c.internationalThreat<0||c.internationalThreat>100)throw Error('Invalid international threat');for(const n of [c.lastWarEndedTick,c.lastAggressionTick,c.crisisCooldownUntilTick])if(n!==undefined&&(!Number.isSafeInteger(n)||n<0))throw Error('Invalid diplomatic memory');const r=c.regionalInterests;if(r&&(!Array.isArray(r.neighbours)||r.neighbours.length>300||[...r.neighbours,...r.rivals,...r.partners].some(id=>!s.countries[id])||r.claimedProvinceIds.some(id=>!s.provinces.some(p=>p.id===id))||!Number.isSafeInteger(r.reviewTick)||r.reviewTick<0))throw Error('Invalid regional interests');}
 for(const q of s.coalitions)if(!s.countries[q.targetId]||q.members.length<1||q.members.length>300||new Set(q.members).size!==q.members.length||q.members.some(id=>!s.countries[id]||id===q.targetId)||!Number.isSafeInteger(q.startedTick)||q.startedTick>s.tick||!Number.isSafeInteger(q.untilTick)||q.untilTick<=q.startedTick)throw Error('Invalid coalition');
 for(const x of s.diplomaticCrises)if(!s.countries[x.from]||!s.countries[x.to]||x.from===x.to||!s.provinces.some(p=>p.id===x.provinceId)||!['Open','Resolved'].includes(x.status)||!['Border','Ultimatum','Mobilization','TradeRoutes','Intervention'].includes(x.kind)||!Number.isSafeInteger(x.startedTick)||x.startedTick>s.tick||!Number.isSafeInteger(x.deadlineTick)||x.deadlineTick<x.startedTick||typeof x.reason!=='string'||x.reason.length>240)throw Error('Invalid diplomatic crisis');
}
