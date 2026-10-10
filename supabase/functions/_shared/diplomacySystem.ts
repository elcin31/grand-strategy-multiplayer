import type { PeaceOffer } from './warSystem.ts';
import { countryFor, type GameState } from './gameTypes.ts';
import { techLevel } from './technologySystem.ts';
import {DIPLOMATIC_TREATIES} from './diplomacyTypes.ts';
import {startRelationMission,offerDiplomacy,respondDiplomacy,terminateTreaty,relationChange,logDiplomacy} from './diplomacy2System.ts';
import {DIPLOMACY_RULES} from './diplomacyTypes.ts';
export const TREATIES = DIPLOMATIC_TREATIES;
export type TreatyType = keyof typeof TREATIES;
export interface DiplomacyLink {
  baselineRelation?:number;trust?:number;reasons?:import('./diplomacyTypes.ts').RelationReason[];
  terms?:import('./diplomacyTypes.ts').TreatyTerm[];
  cooldowns?:Record<string,number>;guaranteeUntil?:Record<string,number>;
  withdrawals?:import('./diplomacyTypes.ts').AccessWithdrawal[];
  a:string; b:string; relation:number; treaties:TreatyType[]; rivals:string[]; guarantors:string[]; truceUntilTick:number;
  improveAfter?:number; proposal?:{from:string;type:TreatyType;expiresTick:number};
}
export interface War { warScore?:number; occupiedProvinceIds?:string[]; casualties?:Record<string,number>; peaceOffer?:PeaceOffer; id:string; attackers:string[]; defenders:string[]; startedTick:number }
export function pairKey(a:string,b:string):string{return [a,b].sort().join('|');}
export function diplomaticLink(state:GameState,a:string,b:string):DiplomacyLink {
  if(a===b)throw new Error('Нужна другая страна');countryFor(state,a);countryFor(state,b);
  const key=pairKey(a,b);
  return state.diplomacy![key]??=( {a:[a,b].sort()[0]!,b:[a,b].sort()[1]!,relation:0,treaties:[],rivals:[],guarantors:[],truceUntilTick:0,baselineRelation:0,trust:50,reasons:[],terms:[],cooldowns:{},guaranteeUntil:{},withdrawals:[]} );
}
export function warBetween(state:GameState,a:string,b:string):War|undefined{return state.wars?.find(w=>(w.attackers.includes(a)&&w.defenders.includes(b))||(w.attackers.includes(b)&&w.defenders.includes(a)));}
export function initializeDiplomacy(state:GameState):void {
  if(!state.dataset)return;
  state.diplomacy??={};state.wars??=[];
  for(const c of Object.values(state.countries)){c.aggressiveExpansion??=0;if(!Number.isFinite(c.aggressiveExpansion)||c.aggressiveExpansion<0||c.aggressiveExpansion>100)throw new Error('Invalid aggressive expansion');}
  for(const [key,l] of Object.entries(state.diplomacy)) {
    if(!l || key!==pairKey(l.a,l.b)||l.a===l.b||!Object.hasOwn(state.countries,l.a)||!Object.hasOwn(state.countries,l.b)||!Number.isFinite(l.relation)||Math.abs(l.relation)>100||!Number.isSafeInteger(l.truceUntilTick)||l.truceUntilTick<0)throw new Error('Invalid diplomatic relation');
    if(!Array.isArray(l.treaties)||new Set(l.treaties).size!==l.treaties.length||l.treaties.some(t=>!Object.hasOwn(TREATIES,t)))throw new Error('Invalid treaty');
    for(const members of [l.rivals,l.guarantors])if(!Array.isArray(members)||new Set(members).size!==members.length||members.some(c=>c!==l.a&&c!==l.b))throw new Error('Invalid diplomatic members');
    if(l.improveAfter!==undefined&&(!Number.isSafeInteger(l.improveAfter)||l.improveAfter<0))throw new Error('Invalid diplomacy cooldown');
    if(l.proposal && (![l.a,l.b].includes(l.proposal.from)||!Object.hasOwn(TREATIES,l.proposal.type)||!Number.isSafeInteger(l.proposal.expiresTick)||l.proposal.expiresTick<0))throw new Error('Invalid treaty proposal');
  }
  const ids=new Set<string>(),participants=new Set<string>();
  for(const w of state.wars){
    if(!w||ids.has(w.id)||!Array.isArray(w.attackers)||!Array.isArray(w.defenders)||!w.attackers.length||!w.defenders.length||!Number.isSafeInteger(w.startedTick)||w.startedTick<0||w.startedTick>state.tick)throw new Error('Invalid war');
    ids.add(w.id);
    for(const id of [...w.attackers,...w.defenders]){countryFor(state,id);if(participants.has(id))throw new Error('Country participates in conflicting wars');participants.add(id);}
  }
}
export function treatyAcceptance(state:GameState,from:string,to:string):number {
  const c=countryFor(state,from),l=state.diplomacy?.[pairKey(from,to)];
  return (l?.relation??0)+techLevel(c,'Diplomacy')*4+(c.diplomaticReputation??50)/10-c.aggressiveExpansion!-(l?.rivals.length?100:0);
}
export function offerTreaty(state:GameState,from:string,to:string,type:TreatyType):void {
  offerDiplomacy(state,from,to,type==='PoliticalUnion'?{kind:'PoliticalUnion'}:{kind:'Treaty',treaty:type});
  const pending=state.diplomaticOffers!.find(o=>o.from===from&&o.to===to);
  if(pending)diplomaticLink(state,from,to).proposal={from,type,expiresTick:pending.expiresTick};
}
export function respondTreaty(state:GameState,actor:string,from:string,accept:boolean):void {
  const pending=state.diplomaticOffers!.find(o=>o.from===from&&o.to===actor&&(o.terms.kind==='Treaty'||o.terms.kind==='PoliticalUnion'));
  if(!pending)throw new Error('Предложение больше недоступно');
  respondDiplomacy(state,actor,pending.id,accept);
}
export function diplomaticAction(state:GameState,actor:string,target:string,action:'Improve'|'Rival'|'Guarantee'|'Cancel'):void {
  const l=diplomaticLink(state,actor,target),c=countryFor(state,actor);
  if(!c.provinceIds?.length||!countryFor(state,target).provinceIds?.length)throw new Error('Страна без территории');
  if(action==='Improve'){
    startRelationMission(state,actor,target,'Improve');l.improveAfter=state.tick+15;
  } else if(action==='Rival') {
    if(l.treaties.length||l.rivals.includes(actor))throw new Error('Сначала отмените договоры');
    l.rivals.push(actor);relationChange(state,actor,target,'rival:'+actor,'Соперничество',-30);
    state.diplomaticOffers=state.diplomaticOffers!.filter(o=>!(o.from===actor&&o.to===target));if(l.proposal?.from===actor)delete l.proposal;
    logDiplomacy(state,[actor,target],'Rival','Объявлено соперничество');
  } else if(action==='Guarantee') {
    if(warBetween(state,actor,target)||countryFor(state,target).overlordId||l.rivals.length||l.guarantors.includes(actor)||c.politicalPower!<20)throw new Error('Гарантия недоступна');
    c.politicalPower!-=20;l.guarantors.push(actor);l.guaranteeUntil![actor]=state.tick+DIPLOMACY_RULES.guaranteeMonths;
    logDiplomacy(state,[actor,target],'Guarantee','Гарантия независимости на 60 месяцев');
  } else {
    if(!l.treaties.length&&!l.rivals.includes(actor)&&!l.guarantors.includes(actor)&&!state.diplomaticOffers!.some(o=>o.from===actor&&o.to===target))throw new Error('Нет договоров или обязательств для отмены');
    if(c.politicalPower!<l.terms!.length*5)throw new Error('Нужно 5 PP за каждый расторгаемый договор');
    for(const term of [...l.terms!])terminateTreaty(state,actor,target,term.id);
    l.rivals=l.rivals.filter(x=>x!==actor);l.guarantors=l.guarantors.filter(x=>x!==actor);delete l.guaranteeUntil![actor];if(l.proposal?.from===actor)delete l.proposal;
    state.diplomaticOffers=state.diplomaticOffers!.filter(o=>!(o.from===actor&&o.to===target));
    logDiplomacy(state,[actor,target],'ObligationsCancelled','Дипломатические обязательства отменены');
  }
}
export function declareWar(state:GameState,actor:string,target:string):War {
  const l=diplomaticLink(state,actor,target),c=countryFor(state,actor),enemy=countryFor(state,target);
  if(l.guarantors.includes(actor))throw new Error('Сначала отмените свою гарантию');
  if(c.overlordId||enemy.overlordId)throw new Error('Война с вассалом ведётся через сюзерена');
  if(!c.provinceIds?.length||!enemy.provinceIds?.length||l.treaties.length||state.tick<l.truceUntilTick)throw new Error('Договор или перемирие запрещает войну');
  if(c.politicalPower!<25)throw new Error('Нужно 25 PP для объявления войны');
  const busy=new Set(state.wars!.flatMap(w=>[...w.attackers,...w.defenders]));
  if(busy.has(actor)||busy.has(target))throw new Error('Страна уже участвует в войне');
  const defenders=[target];
  for(const link of Object.values(state.diplomacy!)){
    if(link.a!==target&&link.b!==target)continue;const ally=link.a===target?link.b:link.a;
    if(ally!==actor&&!busy.has(ally)&&countryFor(state,ally).provinceIds?.length&&(link.treaties.includes('Alliance')||link.treaties.includes('DefensivePact')||link.treaties.includes('PoliticalUnion')||link.guarantors.includes(ally)))defenders.push(ally);
  }
  for(const v of Object.values(state.countries))if(v.overlordId===target&&!defenders.includes(v.id))defenders.push(v.id);
  for(const d of defenders){const pair=diplomaticLink(state,actor,d);if(state.tick<pair.truceUntilTick||pair.treaties.length)throw new Error('Защитник связан с вами договором или перемирием');}
  if(!Number.isSafeInteger(state.nextEntityId)||state.nextEntityId!<1||state.nextEntityId!>=Number.MAX_SAFE_INTEGER)throw new Error('Entity sequence exhausted');
  const attackers=[actor,...Object.values(state.countries).filter(v=>v.overlordId===actor).map(v=>v.id)];
  for(const link of Object.values(state.diplomacy!)){
    if(link.a!==actor&&link.b!==actor||!link.treaties.some(t=>t==='Alliance'||t==='PoliticalUnion'))continue;
    const ally=link.a===actor?link.b:link.a;
    if(busy.has(ally)||defenders.includes(ally)||attackers.includes(ally)||!countryFor(state,ally).provinceIds?.length||countryFor(state,ally).overlordId)continue;
    if(defenders.some(d=>{const pair=state.diplomacy![pairKey(ally,d)];return pair?.treaties.length||state.tick<(pair?.truceUntilTick??0);}))continue;
    attackers.push(ally);
    for(const v of Object.values(state.countries))if(v.overlordId===ally&&!attackers.includes(v.id)&&!defenders.includes(v.id))attackers.push(v.id);
  }
  if([...attackers,...defenders].some(id=>busy.has(id)))throw new Error('Вассал уже участвует в войне');
  if(new Set([...attackers,...defenders]).size!==attackers.length+defenders.length)throw new Error('Конфликт сторон войны');
  for(const a of attackers)for(const d of defenders){const pair=diplomaticLink(state,a,d);if(state.tick<pair.truceUntilTick||pair.treaties.length)throw new Error('Договор участника коалиции запрещает войну');}
  const war={id:`war-${state.id}-${state.nextEntityId!++}`,attackers,defenders,startedTick:state.tick,warScore:0,occupiedProvinceIds:[],casualties:{}};
  state.wars!.push(war);c.politicalPower!-=25;c.aggressiveExpansion=Math.min(100,c.aggressiveExpansion!+5);
  for(const a of attackers)for(const d of defenders){const pair=diplomaticLink(state,a,d);pair.relation=-100;pair.baselineRelation=-100;pair.reasons=[];pair.trust=0;pair.treaties=[];pair.terms=[];delete pair.proposal;}
  logDiplomacy(state,[actor,target],'WarDeclared',`${c.name} объявляет войну ${enemy.name}`);
  return war;
}
export function monthlyDiplomacy(state:GameState):void {
  if(!state.dataset)return;
  for(const l of Object.values(state.diplomacy!))if(l.proposal&&l.proposal.expiresTick<=state.tick)delete l.proposal;
  for(const c of Object.values(state.countries))c.aggressiveExpansion=Math.max(0,c.aggressiveExpansion!-.1);
}
