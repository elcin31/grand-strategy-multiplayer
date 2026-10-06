import { countryFor, type BattleEvent, type GameState } from './gameTypes.ts';
import { diplomaticLink, warBetween, type War } from './diplomacySystem.ts';
import { money } from './economySystem.ts';
export type PeaceKind = 'WhitePeace'|'Territory'|'ReturnTerritory'|'Money'|'Vassalization';
export interface PeaceTerms { kind:PeaceKind; provinceIds:string[]; amount:number }
export interface PeaceOffer { from:string; terms:PeaceTerms; expiresTick:number }
export interface WarSummary { id:string; endedTick:number; kind:PeaceKind; attackers:string[]; defenders:string[]; casualties:Record<string,number> }
export function warSide(w:War,id:string):string[]{if(w.attackers.includes(id))return w.attackers;if(w.defenders.includes(id))return w.defenders;throw new Error('Страна не участвует в войне');}
export function opponentSide(w:War,id:string):string[]{return w.attackers.includes(id)?w.defenders:w.attackers;}
export function isWarLeader(w:War,id:string):boolean{return w.attackers[0]===id||w.defenders[0]===id;}
export function scoreFor(w:War,id:string):number{return (w.warScore??0)*(w.attackers.includes(id)?1:-1);}
export function initializeWars(state:GameState):void {
  if(!state.dataset)return;
  state.warHistory??=[];
  if(!Array.isArray(state.warHistory)||state.warHistory.length>20)throw new Error('Invalid war history');
  for(const c of Object.values(state.countries)){
    c.warExhaustion??=0;if(!Number.isFinite(c.warExhaustion)||c.warExhaustion<0||c.warExhaustion>100)throw new Error('Invalid war exhaustion');
    if(c.overlordId){const lord=countryFor(state,c.overlordId);if(lord.id===c.id||lord.overlordId)throw new Error('Cyclic vassal relationship');}
  }
  for(const p of state.provinces){p.originalOwnerId??=p.ownerId;countryFor(state,p.originalOwnerId);countryFor(state,p.controllerId??p.ownerId);}
  for(const w of state.wars??[]){
    w.casualties??={};w.occupiedProvinceIds??=[];w.warScore??=0;
    for(const [id,n] of Object.entries(w.casualties))if(![...w.attackers,...w.defenders].includes(id)||!Number.isSafeInteger(n)||n<0)throw new Error('Invalid war casualties');
    if(!Number.isFinite(w.warScore)||Math.abs(w.warScore)>100)throw new Error('Invalid war score');
    if(w.peaceOffer){if(!isWarLeader(w,w.peaceOffer.from)||!Number.isSafeInteger(w.peaceOffer.expiresTick)||w.peaceOffer.expiresTick<0)throw new Error('Invalid peace proposal');assertPeaceTerms(w.peaceOffer.terms);}
  }
  refreshWars(state);
}
export function refreshWars(state:GameState):void {
  if(!state.dataset)return;
  for(const w of state.wars??[]){
    const a=new Set(w.attackers),d=new Set(w.defenders);let aTotal=0,dTotal=0,aOccupied=0,dOccupied=0;
    w.occupiedProvinceIds=[];
    for(const p of state.provinces){
      if(a.has(p.ownerId)){aTotal++;if(d.has(p.controllerId??p.ownerId)){aOccupied++;w.occupiedProvinceIds.push(p.id);}}
      if(d.has(p.ownerId)){dTotal++;if(a.has(p.controllerId??p.ownerId)){dOccupied++;w.occupiedProvinceIds.push(p.id);}}
    }
    const losses=(side:string[])=>side.reduce((n,id)=>n+(w.casualties?.[id]??0),0),al=losses(w.attackers),dl=losses(w.defenders);
    w.warScore=Math.max(-100,Math.min(100,80*(dOccupied/Math.max(1,dTotal)-aOccupied/Math.max(1,aTotal))+20*(dl-al)/Math.max(10000,al+dl)));
  }
}
export function recordWarBattle(state:GameState,event:BattleEvent):void {
  if(!state.dataset)return;const w=warBetween(state,event.attackerId,event.defenderId);if(!w)return;
  w.casualties??={};
  for(const [id,loss] of [[event.attackerId,event.attackerLosses],[event.defenderId,event.defenderLosses]] as const){
    const n=(w.casualties[id]??0)+loss;if(!Number.isSafeInteger(n)||n<0)throw new Error('War casualty overflow');w.casualties[id]=n;
    const c=countryFor(state,id);c.warExhaustion=Math.min(100,(c.warExhaustion??0)+Math.min(5,loss/10000));
  }
  refreshWars(state);
}
export function assertPeaceTerms(input:unknown):asserts input is PeaceTerms {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid peace terms');const t=input as Record<string,unknown>;
  if(Object.keys(t).length!==3||!['WhitePeace','Territory','ReturnTerritory','Money','Vassalization'].includes(t.kind as string)||!Array.isArray(t.provinceIds)||t.provinceIds.length>50||new Set(t.provinceIds).size!==t.provinceIds.length||t.provinceIds.some(p=>typeof p!=='string'||!/^[A-Za-z0-9_+?-]{1,128}$/.test(p))||typeof t.amount!=='number'||!Number.isFinite(t.amount)||t.amount<0||t.amount>1000000||money(t.amount)!==t.amount)throw new Error('Invalid peace terms');
  if((t.kind==='Territory'||t.kind==='ReturnTerritory') ? t.provinceIds.length===0||t.amount!==0 : t.provinceIds.length!==0)throw new Error('Invalid territory demands');
  if(t.kind==='Money' ? t.amount<=0 : t.amount!==0)throw new Error('Invalid peace payment');
}
function peaceContext(state:GameState,actor:string,warId:string){const w=state.wars?.find(w=>w.id===warId);if(!w||!isWarLeader(w,actor))throw new Error('Мир предлагает лидер воюющей стороны');return w;}
export function peaceCost(state:GameState,w:War,from:string,terms:PeaceTerms):number {
  assertPeaceTerms(terms);const enemies=opponentSide(w,from),side=warSide(w,from);const enemy=countryFor(state,enemies[0]!);
  if(terms.kind==='WhitePeace')return 0;
  if(terms.kind==='Vassalization'){
    if(countryFor(state,from).overlordId||enemy.overlordId||Object.values(state.countries).some(c=>c.overlordId===enemy.id))throw new Error('Вассализация недоступна');return 80;
  }
  if(terms.kind==='Money'){if(terms.amount>enemy.treasury)throw new Error('У противника недостаточно средств');return Math.min(80,5+terms.amount/Math.max(1,(enemy.economy?.monthlyIncome??1)*12)*50);}
  const total=state.provinces.filter(p=>enemies.includes(p.ownerId)).length;
  for(const id of terms.provinceIds){const p=state.provinces.find(p=>p.id===id);if(!p||!enemies.includes(p.ownerId)||!side.includes(p.controllerId??p.ownerId))throw new Error('Можно требовать только оккупированную вражескую территорию');if(terms.kind==='ReturnTerritory'&&!side.includes(p.originalOwnerId!))throw new Error('Территория не принадлежала вашей стороне');}
  return Math.min(80,terms.provinceIds.length/Math.max(1,total)*80);
}
export function proposePeace(state:GameState,actor:string,warId:string,terms:PeaceTerms):void {
  const w=peaceContext(state,actor,warId);if(w.peaceOffer)throw new Error('Сначала дождитесь ответа на предложение мира');
  peaceCost(state,w,actor,terms);w.peaceOffer={from:actor,terms:structuredClone(terms),expiresTick:state.tick+6};
  const enemy=opponentSide(w,actor)[0]!;
  if(!state.players.some(p=>p.countryId===enemy&&!p.aiControlled)) {
    const cost=peaceCost(state,w,actor,terms),score=scoreFor(w,actor);
    const accepts=terms.kind==='WhitePeace' ? state.tick-w.startedTick>=12||countryFor(state,enemy).warExhaustion!>=70 : score+1e-6>=cost && (state.tick-w.startedTick>=3||score>=50);
    if(!accepts)throw new Error('Противник отклонил мир: недостаточно военного счёта или длительности войны');
    settlePeace(state,w,actor,terms);
  }
}
export function respondPeace(state:GameState,actor:string,warId:string,accept:boolean):void {
  const w=peaceContext(state,actor,warId),offer=w.peaceOffer;
  if(!offer||offer.expiresTick<=state.tick||!opponentSide(w,offer.from).includes(actor)||offer.from===actor)throw new Error('Предложение мира недоступно');
  if(accept){peaceCost(state,w,offer.from,offer.terms);settlePeace(state,w,offer.from,offer.terms);}else delete w.peaceOffer;
}
function settlePeace(state:GameState,w:War,from:string,terms:PeaceTerms):void {
  const enemies=opponentSide(w,from),enemy=countryFor(state,enemies[0]!),winner=countryFor(state,from);
  if(terms.kind==='Money'){enemy.treasury=money(enemy.treasury-terms.amount);winner.treasury=money(winner.treasury+terms.amount);}
  if(terms.kind==='Vassalization')enemy.overlordId=from;
  for(const id of terms.provinceIds){
    const p=state.provinces.find(p=>p.id===id)!;p.ownerId=terms.kind==='ReturnTerritory'?p.originalOwnerId!:from;p.countryId=p.ownerId;
    for(const city of state.cities??[])if(city.provinceId===id)city.countryId=p.ownerId;
    state.constructions=state.constructions?.filter(c=>c.provinceId!==id);
  }
  if(terms.kind==='Territory'||terms.kind==='Vassalization')winner.aggressiveExpansion=Math.min(100,winner.aggressiveExpansion!+(terms.kind==='Vassalization'?20:terms.provinceIds.length*2));
  const participants=new Set([...w.attackers,...w.defenders]);
  for(const p of state.provinces)if(participants.has(p.ownerId)&&participants.has(p.controllerId??p.ownerId))p.controllerId=p.ownerId;
  // Relocate foreign armies to an owned province; defeated landless armies demobilize.
  const provinces=new Map(state.provinces.map(p=>[p.id,p]));
  for(const army of state.armies){if(!participants.has(army.ownerId))continue;const p=provinces.get(army.provinceId)!;if(p.ownerId!==army.ownerId){const home=state.provinces.find(p=>p.ownerId===army.ownerId);if(home)army.provinceId=home.id;else army.troops=0;}}
  state.armies=state.armies.filter(a=>a.troops>0);
  for(const a of w.attackers)for(const d of w.defenders){const link=diplomaticLink(state,a,d);link.truceUntilTick=state.tick+24;delete link.proposal;}
  state.warHistory!.unshift({id:w.id,endedTick:state.tick,kind:terms.kind,attackers:[...w.attackers],defenders:[...w.defenders],casualties:{...w.casualties}});state.warHistory=state.warHistory!.slice(0,20);
  state.wars=state.wars!.filter(q=>q.id!==w.id);
}
export function monthlyWar(state:GameState):void {
  if(!state.dataset)return;refreshWars(state);
  const active=new Set(state.wars!.flatMap(w=>[...w.attackers,...w.defenders]));
  for(const c of Object.values(state.countries))c.warExhaustion=Math.max(0,Math.min(100,c.warExhaustion!+(active.has(c.id)?.35:-.75)));
  for(const w of state.wars!){if(w.peaceOffer&&w.peaceOffer.expiresTick<=state.tick)delete w.peaceOffer;}
  // Tribute is bounded by available cash, paid once per authoritative monthly tick.
  for(const c of Object.values(state.countries))if(c.overlordId){const lord=countryFor(state,c.overlordId),tribute=money(Math.min(c.treasury,Math.max(0,c.economy?.monthlyBalance??0)*.1));c.treasury=money(c.treasury-tribute);lord.treasury=money(lord.treasury+tribute);}
}
