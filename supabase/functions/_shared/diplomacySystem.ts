import type { PeaceOffer } from './warSystem.ts';
import { countryFor, type GameState } from './gameTypes.ts';
import { techLevel } from './technologySystem.ts';
export const TREATIES = { Alliance:'Союз', NonAggression:'Ненападение', DefensivePact:'Оборонительный пакт' } as const;
export type TreatyType = keyof typeof TREATIES;
export interface DiplomacyLink {
  a:string; b:string; relation:number; treaties:TreatyType[]; rivals:string[]; guarantors:string[]; truceUntilTick:number;
  improveAfter?:number; proposal?:{from:string;type:TreatyType;expiresTick:number};
}
export interface War { warScore?:number; occupiedProvinceIds?:string[]; casualties?:Record<string,number>; peaceOffer?:PeaceOffer; id:string; attackers:string[]; defenders:string[]; startedTick:number }
export function pairKey(a:string,b:string):string{return [a,b].sort().join('|');}
export function diplomaticLink(state:GameState,a:string,b:string):DiplomacyLink {
  if(a===b)throw new Error('Нужна другая страна');countryFor(state,a);countryFor(state,b);
  const key=pairKey(a,b);
  return state.diplomacy![key]??=( {a:[a,b].sort()[0]!,b:[a,b].sort()[1]!,relation:0,treaties:[],rivals:[],guarantors:[],truceUntilTick:0} );
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
  const l=diplomaticLink(state,from,to);
  if(warBetween(state,from,to)||l.treaties.includes(type)||l.proposal||l.rivals.length)throw new Error('Договор недоступен');
  if(!countryFor(state,from).provinceIds?.length||!countryFor(state,to).provinceIds?.length)throw new Error('Страна без территории');
  l.proposal={from,type,expiresTick:state.tick+12};
  if(!state.players.some(p=>p.countryId===to)) {
    if(treatyAcceptance(state,from,to)<20)throw new Error('Страна отклонила договор: улучшите отношения');
    l.treaties.push(type);delete l.proposal;
  }
}
export function respondTreaty(state:GameState,actor:string,from:string,accept:boolean):void {
  const l=diplomaticLink(state,actor,from),p=l.proposal;
  if(!p||p.from!==from||p.expiresTick<=state.tick||warBetween(state,actor,from))throw new Error('Предложение больше недоступно');
  if(accept){if(l.rivals.length)throw new Error('Соперничество блокирует договор');if(!l.treaties.includes(p.type))l.treaties.push(p.type);}
  delete l.proposal;
}
export function diplomaticAction(state:GameState,actor:string,target:string,action:'Improve'|'Rival'|'Guarantee'|'Cancel'):void {
  const l=diplomaticLink(state,actor,target),c=countryFor(state,actor);
  if(action==='Improve'){
    if(warBetween(state,actor,target)||state.tick<(l.improveAfter??0)||c.politicalPower!<10)throw new Error('Улучшение отношений недоступно');
    c.politicalPower!-=10;l.relation=Math.min(100,l.relation+15+techLevel(c,'Diplomacy')*2);l.improveAfter=state.tick+3;
  } else if(action==='Rival') {
    if(l.treaties.length||l.rivals.includes(actor))throw new Error('Сначала отмените договоры');
    l.rivals.push(actor);l.relation=Math.max(-100,l.relation-30);delete l.proposal;
  } else if(action==='Guarantee') {
    if(warBetween(state,actor,target)||l.rivals.length||l.guarantors.includes(actor)||c.politicalPower!<20)throw new Error('Гарантия недоступна');
    c.politicalPower!-=20;l.guarantors.push(actor);
  } else {
    const endedTreaty=l.treaties.length>0;
    if(!endedTreaty&&!l.rivals.includes(actor)&&!l.guarantors.includes(actor)&&!l.proposal)throw new Error('Нет договоров или обязательств для отмены');
    l.treaties=[];l.rivals=l.rivals.filter(x=>x!==actor);l.guarantors=l.guarantors.filter(x=>x!==actor);delete l.proposal;
    if(endedTreaty)l.truceUntilTick=Math.max(l.truceUntilTick,state.tick+6);
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
    if(ally!==actor&&!busy.has(ally)&&countryFor(state,ally).provinceIds?.length&&(link.treaties.includes('Alliance')||link.treaties.includes('DefensivePact')||link.guarantors.includes(ally)))defenders.push(ally);
  }
  for(const v of Object.values(state.countries))if(v.overlordId===target&&!defenders.includes(v.id))defenders.push(v.id);
  for(const d of defenders){const pair=diplomaticLink(state,actor,d);if(state.tick<pair.truceUntilTick||pair.treaties.length)throw new Error('Защитник связан с вами договором или перемирием');}
  if(!Number.isSafeInteger(state.nextEntityId)||state.nextEntityId!<1||state.nextEntityId!>=Number.MAX_SAFE_INTEGER)throw new Error('Entity sequence exhausted');
  const attackers=[actor,...Object.values(state.countries).filter(v=>v.overlordId===actor).map(v=>v.id)];
  if([...attackers,...defenders].some(id=>busy.has(id)))throw new Error('Вассал уже участвует в войне');
  if(new Set([...attackers,...defenders]).size!==attackers.length+defenders.length)throw new Error('Конфликт сторон войны');
  for(const a of attackers)for(const d of defenders){const pair=diplomaticLink(state,a,d);if(state.tick<pair.truceUntilTick||pair.treaties.length)throw new Error('Договор участника коалиции запрещает войну');}
  const war={id:`war-${state.id}-${state.nextEntityId!++}`,attackers,defenders,startedTick:state.tick,warScore:0,occupiedProvinceIds:[],casualties:{}};
  state.wars!.push(war);c.politicalPower!-=25;c.aggressiveExpansion=Math.min(100,c.aggressiveExpansion!+5);
  for(const a of attackers)for(const d of defenders){const pair=diplomaticLink(state,a,d);pair.relation=-100;pair.treaties=[];delete pair.proposal;}
  return war;
}
export function monthlyDiplomacy(state:GameState):void {
  if(!state.dataset)return;
  for(const l of Object.values(state.diplomacy!))if(l.proposal&&l.proposal.expiresTick<=state.tick)delete l.proposal;
  for(const c of Object.values(state.countries))c.aggressiveExpansion=Math.max(0,c.aggressiveExpansion!-.1);
}
