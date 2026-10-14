import {notify} from './notificationSystem.ts';
import {takeArmyLosses} from './armyComposition.ts';
import { countryFor, type BattleEvent, type GameState } from './gameTypes.ts';
import { diplomaticLink, warBetween, type War } from './diplomacySystem.ts';
import { money } from './economySystem.ts';
export type PeaceKind = 'WhitePeace'|'Territory'|'ReturnTerritory'|'Money'|'Vassalization'|'Guarantee'|'Disarmament'|'Reparations'|'ReleaseNation';
export interface PeaceClause {kind:PeaceKind;provinceIds:string[];amount:number;targetId?:string}
/** Legacy fields remain for old offers; clauses are the canonical compound form. */
export interface PeaceTerms {kind:PeaceKind;provinceIds:string[];amount:number;clauses?:PeaceClause[]}
export function peaceClauses(t:PeaceTerms):PeaceClause[]{return t.clauses??[{kind:t.kind,provinceIds:t.provinceIds,amount:t.amount}];}
export function makePeaceTerms(clauses:PeaceClause[]):PeaceTerms{const rows=clauses.length?clauses:[{kind:'WhitePeace' as const,provinceIds:[],amount:0}];return {kind:rows[0]!.kind,provinceIds:rows.flatMap(c=>c.provinceIds),amount:money(rows.reduce((n,c)=>n+c.amount,0)),clauses:rows};}
export interface PeaceOffer { from:string; terms:PeaceTerms; expiresTick:number }
export interface WarSummary { id:string; endedTick:number; kind:PeaceKind; attackers:string[]; defenders:string[]; casualties:Record<string,number>;clauses?:PeaceClause[] }
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
    w.casualties??={};w.occupiedProvinceIds??=[];w.warScore??=0;w.battleScore??=0;if(!Number.isFinite(w.battleScore)||Math.abs(w.battleScore)>10)throw Error('Invalid battle score');
    for(const [id,n] of Object.entries(w.casualties))if(![...w.attackers,...w.defenders].includes(id)||!Number.isSafeInteger(n)||n<0)throw new Error('Invalid war casualties');
    if(!Number.isFinite(w.warScore)||Math.abs(w.warScore)>100)throw new Error('Invalid war score');
    if(w.peaceOffer){if(!isWarLeader(w,w.peaceOffer.from)||!Number.isSafeInteger(w.peaceOffer.expiresTick)||w.peaceOffer.expiresTick<0)throw new Error('Invalid peace proposal');assertPeaceTerms(w.peaceOffer.terms);}
  }
  // Normalization validates a committed snapshot. Recomputing derived scores here
  // changes new wars and monthly exhaustion between save and restore. Simulation
  // phases and battles refresh these values explicitly through refreshWars.
}
const capitalCaches=new WeakMap<object,Set<string>>();
function capitalProvinces(state:GameState):Set<string>{if(!state.cities)return new Set();let cache=capitalCaches.get(state.cities);if(!cache){cache=new Set(state.cities.filter(c=>c.isCapital).map(c=>c.provinceId));capitalCaches.set(state.cities,cache);}return cache;}
function strategicWeight(state:GameState,p:GameState['provinces'][number]):number{return 1+Math.sqrt(Math.max(0,p.population)/1e6)*.3+(p.development??40)/100*.6+(capitalProvinces(state).has(p.id)?2.5:0)+(p.resourceDeposit?.25:0);}
export function warMetrics(state:GameState,w:War,id:string){
 const side=warSide(w,id),enemy=opponentSide(w,id),own=state.provinces.filter(p=>side.includes(p.ownerId)),foreign=state.provinces.filter(p=>enemy.includes(p.ownerId));
 const captured=foreign.filter(p=>side.includes(p.controllerId??p.ownerId)),lost=own.filter(p=>enemy.includes(p.controllerId??p.ownerId)),weight=(rows:typeof own)=>rows.reduce((n,p)=>n+strategicWeight(state,p),0);
 const capitals=(rows:typeof own)=>rows.filter(p=>capitalProvinces(state).has(p.id));
 const goalRatio=(actor:string[],controllers:string[])=>{const goals=actor.flatMap(c=>w.goals?.[c]?.provinceIds??[]);return goals.length?goals.filter(id=>controllers.includes(state.provinces.find(p=>p.id===id)?.controllerId??state.provinces.find(p=>p.id===id)?.ownerId??'')).length/goals.length:0;};
 const losses=(rows:string[])=>rows.reduce((n,c)=>n+(w.casualties?.[c]??0),0),ours=losses(side),theirs=losses(enemy),exhaustion=(rows:string[])=>rows.reduce((n,c)=>n+(state.countries[c]?.warExhaustion??0),0)/Math.max(1,rows.length);
 const factors={occupation:65*(weight(captured)/Math.max(1,weight(foreign))-weight(lost)/Math.max(1,weight(own))),capitals:10*(capitals(captured).length/Math.max(1,capitals(foreign).length)-capitals(lost).length/Math.max(1,capitals(own).length)),objectives:10*(goalRatio(side,side)-goalRatio(enemy,enemy)),battles:(w.battleScore??0)*(w.attackers.includes(id)?1:-1),losses:5*(theirs-ours)/Math.max(10000,ours+theirs),exhaustion:5*(exhaustion(enemy)-exhaustion(side))/100};
 const score=foreign.length&&captured.length===foreign.length&&!lost.length?100:own.length&&lost.length===own.length&&!captured.length?-100:Math.max(-100,Math.min(100,Object.values(factors).reduce((n,v)=>n+v,0)));
 return {occupationPercent:100*captured.length/Math.max(1,foreign.length),captured:captured.length,enemyProvinces:foreign.length,score,factors};
}
export function refreshWars(state:GameState):void{if(!state.dataset)return;for(const w of state.wars??[]){w.occupiedProvinceIds=state.provinces.filter(p=>w.attackers.includes(p.ownerId)&&w.defenders.includes(p.controllerId??p.ownerId)||w.defenders.includes(p.ownerId)&&w.attackers.includes(p.controllerId??p.ownerId)).map(p=>p.id);w.warScore=warMetrics(state,w,w.attackers[0]!).score;}}
export function recordWarBattle(state:GameState,event:BattleEvent):void {
  if(!state.dataset)return;const w=warBetween(state,event.attackerId,event.defenderId);if(!w)return;
  w.casualties??={};
  for(const [id,loss] of event.countryLosses?Object.entries(event.countryLosses):[[event.attackerId,event.attackerLosses],[event.defenderId,event.defenderLosses]] as [string,number][]){
    const n=(w.casualties[id]??0)+loss;if(!Number.isSafeInteger(n)||n<0)throw new Error('War casualty overflow');w.casualties[id]=n;
    const c=countryFor(state,id);c.militaryLosses=(c.militaryLosses??0)+loss;c.warExhaustion=Math.min(100,(c.warExhaustion??0)+Math.min(5,loss/10000));
  }
  w.battleScore=Math.max(-10,Math.min(10,(w.battleScore??0)+(w.attackers.includes(event.winnerId)?2:-2)));
  refreshWars(state);
}
const PEACE_KINDS:PeaceKind[]=['WhitePeace','Territory','ReturnTerritory','Money','Vassalization','Guarantee','Disarmament','Reparations','ReleaseNation'];
function assertClause(input:unknown):asserts input is PeaceClause{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid peace clause');const t=input as Record<string,unknown>;
 if(Object.keys(t).some(k=>!['kind','provinceIds','amount','targetId'].includes(k))||!PEACE_KINDS.includes(t.kind as PeaceKind)||!Array.isArray(t.provinceIds)||t.provinceIds.length>50||new Set(t.provinceIds).size!==t.provinceIds.length||t.provinceIds.some(p=>typeof p!=='string'||!/^[A-Za-z0-9_+?-]{1,128}$/.test(p))||typeof t.amount!=='number'||!Number.isFinite(t.amount)||t.amount<0||t.amount>1000000||money(t.amount)!==t.amount)throw Error('Invalid peace terms');
 const territory=['Territory','ReturnTerritory','ReleaseNation'].includes(t.kind as string),payment=t.kind==='Money'||t.kind==='Reparations';
 if(territory?t.provinceIds.length===0||t.amount!==0:t.provinceIds.length!==0)throw Error('Invalid territory demands');
 if(payment?t.amount<=0:t.amount!==0)throw Error('Invalid peace payment');
 if(t.kind==='ReleaseNation'?(typeof t.targetId!=='string'||!/^[a-z0-9_-]{1,64}$/.test(t.targetId)):t.targetId!==undefined)throw Error('Invalid liberation target');
}
export function assertPeaceTerms(input:unknown):asserts input is PeaceTerms{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid peace terms');const t=input as PeaceTerms;
 if(!t.clauses){if(Object.keys(t).length!==3)throw Error('Invalid peace terms');assertClause(t);return;}
 if(Object.keys(t).length!==4||!Array.isArray(t.clauses)||t.clauses.length<1||t.clauses.length>9)throw Error('Invalid compound treaty');
 t.clauses.forEach(assertClause);const canonical=makePeaceTerms(t.clauses);
 if(t.kind!==canonical.kind||t.amount!==canonical.amount||JSON.stringify(t.provinceIds)!==JSON.stringify(canonical.provinceIds)||t.provinceIds.length>50||new Set(t.provinceIds).size!==t.provinceIds.length)throw Error('Invalid compound treaty totals');
 if(new Set(t.clauses.map(c=>c.kind)).size!==t.clauses.length)throw Error('Повторяющиеся условия договора');
 if(t.clauses.some(c=>c.kind==='WhitePeace')&&t.clauses.length!==1)throw Error('Белый мир не сочетается с требованиями');
 if(t.clauses.some(c=>c.kind==='Vassalization')&&t.clauses.some(c=>c.kind==='Guarantee'||c.kind==='ReleaseNation'))throw Error('Вассализация несовместима с независимостью и гарантиями');
}
function peaceContext(state:GameState,actor:string,warId:string){const w=state.wars?.find(w=>w.id===warId);if(!w||!isWarLeader(w,actor))throw new Error('Мир предлагает лидер воюющей стороны');return w;}
export function peaceIncome(state:GameState,countryId:string,excluded:string[]=[]):number{const blocked=new Set(excluded);return state.provinces.filter(p=>p.ownerId===countryId&&!blocked.has(p.id)).reduce((n,p)=>n+p.income,0);}
function clauseCost(state:GameState,w:War,from:string,terms:PeaceClause,excluded:string[]=[]):number {
  assertClause(terms);const enemies=opponentSide(w,from),side=warSide(w,from);const enemy=countryFor(state,enemies[0]!),income=peaceIncome(state,enemy.id,excluded);
  const goal=w.goals?.[from];if(goal?.type==='LimitedWar'&&terms.provinceIds.length>3)throw Error('Ограниченная война допускает до трёх провинций');if(goal?.type==='Liberation'&&terms.kind==='Territory')throw Error('Освободительная война допускает возврат территории');
  if(terms.kind==='WhitePeace')return 0;
  if(terms.kind==='Guarantee')return 25;if(terms.kind==='Disarmament')return 40;if(terms.kind==='Reparations'){if(terms.amount>income*.15)throw Error('Репарации ограничены 15% базового мирного дохода оставленных провинций');return Math.min(70,20+terms.amount/Math.max(1,income)*100);}
  if(terms.kind==='Vassalization'){
    if(countryFor(state,from).overlordId||enemy.overlordId||Object.values(state.countries).some(c=>c.overlordId===enemy.id))throw new Error('Вассализация недоступна');return 80;
  }
  if(terms.kind==='Money'){if((enemy.intelligenceLevel===undefined||enemy.intelligenceLevel==='Detailed')&&terms.amount>enemy.treasury)throw new Error('У противника недостаточно средств');return Math.min(80,5+terms.amount/Math.max(1,(income)*12)*50);}
  const total=state.provinces.filter(p=>enemies.includes(p.ownerId)).reduce((n,p)=>n+strategicWeight(state,p),0);
  if(terms.kind==='ReleaseNation'){const target=state.countries[terms.targetId!];if(!target||target.id===from||state.provinces.some(p=>p.ownerId===target.id))throw Error('Освобождается только существующее государство без собственной территории');}
  for(const id of terms.provinceIds){const p=state.provinces.find(p=>p.id===id);if(!p||!enemies.includes(p.ownerId)||!side.includes(p.controllerId??p.ownerId))throw new Error('Можно требовать только оккупированную вражескую территорию');if(terms.kind==='ReturnTerritory'&&!side.includes(p.originalOwnerId!)&&!(w.goals?.[from]?.type==='Liberation'&&w.goals[from]!.provinceIds.includes(id)))throw new Error('Территория не принадлежала вашей стороне');if(terms.kind==='ReleaseNation'&&p.originalOwnerId!==terms.targetId)throw Error('Провинция не принадлежала освобождаемому государству');}
  return terms.provinceIds.reduce((n,id)=>{const p=state.provinces.find(p=>p.id===id)!;const claim=p.originalOwnerId===from||goal?.provinceIds.includes(id);return n+strategicWeight(state,p)/Math.max(1,total)*55*(terms.kind==='ReturnTerritory'?.75:claim?.85:1);},0);
}
export function provincePeaceCost(state:GameState,w:War,from:string,id:string,kind:'Territory'|'ReturnTerritory'='Territory'):number{return clauseCost(state,w,from,{kind,provinceIds:[id],amount:0});}
export function peaceCost(state:GameState,w:War,from:string,terms:PeaceTerms):number{
 assertPeaceTerms(terms);warSide(w,from);const rows=peaceClauses(terms);
 if(w.goals?.[from]?.type==='LimitedWar'&&terms.provinceIds.length>3)throw Error('Ограниченная война допускает до трёх провинций');
 const enemy=opponentSide(w,from)[0]!;
 if(rows.some(c=>c.kind==='Vassalization')&&state.provinces.filter(p=>p.ownerId===enemy).every(p=>terms.provinceIds.includes(p.id)))throw Error('Нельзя вассализировать полностью аннексированное государство');
 return rows.reduce((n,c)=>n+clauseCost(state,w,from,c,terms.provinceIds),0);
}
export function peaceEvaluation(state:GameState,w:War,from:string,terms:PeaceTerms){
 let cost:number;try{cost=peaceCost(state,w,from,terms);}catch(error){return {accepts:false,cost:0,budget:Math.max(0,scoreFor(w,from)),reason:error instanceof Error?error.message:'Недопустимый договор'};}
 const budget=Math.max(0,scoreFor(w,from)),enemies=opponentSide(w,from),enemy=countryFor(state,enemies[0]!),occupation=warMetrics(state,w,from).occupationPercent;
 const white=peaceClauses(terms).every(c=>c.kind==='WhitePeace'),strength=enemies.reduce((n,c)=>n+(state.countries[c]?.army??0)+(state.countries[c]?.manpower??0)*.25,0),ours=warSide(w,from).reduce((n,c)=>n+(state.countries[c]?.army??0),0);
 const pressure=occupation*.3+(enemy.warExhaustion??0)*.4+(strength<ours*.5?12:0)+((enemy.economy?.monthlyBalance??0)<0?8:0)+Math.min(15,(state.tick-w.startedTick)*2);
 if(cost>budget+1e-6)return {accepts:false,cost,budget,reason:'Стоимость превышает доступный военный счёт'};
 const accepts=white?pressure>=20||state.tick-w.startedTick>=12:occupation>=99||budget>=cost+15||pressure>=15;
 return {accepts,cost,budget,reason:accepts?'Противник готов к миру: положение фронта, истощение и расходы оправдывают уступки':'Противник способен продолжать войну; уменьшите требования или улучшите положение на фронте'};
}
export function proposePeace(state:GameState,actor:string,warId:string,terms:PeaceTerms):void{
 const w=peaceContext(state,actor,warId);if(w.peaceOffer)throw Error('Сначала дождитесь ответа на предложение мира');
 const cost=peaceCost(state,w,actor,terms);if(cost>Math.max(0,scoreFor(w,actor))+1e-6)throw Error('Стоимость превышает доступный военный счёт');
 const enemy=opponentSide(w,actor)[0]!;
 if(!state.players.some(p=>p.countryId===enemy&&!p.aiControlled)){const evaluation=peaceEvaluation(state,w,actor,terms);if(!evaluation.accepts)throw Error(evaluation.reason);settlePeace(state,w,actor,terms);}
 else{w.peaceOffer={from:actor,terms:structuredClone(terms),expiresTick:state.tick+6};notify(state,enemy,'Diplomacy','Предложен мирный договор: '+countryFor(state,actor).name);}
}
export function respondPeace(state:GameState,actor:string,warId:string,accept:boolean):void {
  const w=peaceContext(state,actor,warId),offer=w.peaceOffer;
  if(!offer||offer.expiresTick<=state.tick||!opponentSide(w,offer.from).includes(actor)||offer.from===actor)throw new Error('Предложение мира недоступно');
  if(accept){peaceCost(state,w,offer.from,offer.terms);settlePeace(state,w,offer.from,offer.terms);}else delete w.peaceOffer;
}
function settlePeace(state:GameState,w:War,from:string,terms:PeaceTerms):void {
  const enemies=opponentSide(w,from),enemy=countryFor(state,enemies[0]!),winner=countryFor(state,from);
  peaceCost(state,w,from,terms);
  for(const clause of peaceClauses(terms)){
  if(clause.kind==='Money'){enemy.treasury=money(enemy.treasury-clause.amount);winner.treasury=money(winner.treasury+clause.amount);}
  if(clause.kind==='Vassalization'){enemy.overlordId=from;enemy.vassalAutonomy=65;}
  if(clause.kind==='Guarantee'){const link=diplomaticLink(state,from,enemy.id);if(!link.guarantors.includes(enemy.id))link.guarantors.push(enemy.id);link.guaranteeUntil??={};link.guaranteeUntil[enemy.id]=state.tick+24;}
  if(clause.kind==='Reparations')enemy.reparations={to:from,amount:clause.amount,untilTick:state.tick+24,lastTick:state.tick};
  if(clause.kind==='Disarmament'){const cap=Math.floor(enemy.army*.7);for(const a of state.armies.filter(a=>a.ownerId===enemy.id)){const released=takeArmyLosses(a,Math.floor(a.troops*.3));enemy.manpower+=released;}enemy.militaryCeiling={untilTick:state.tick+24,troops:cap};}
  for(const id of clause.provinceIds){
    const p=state.provinces.find(p=>p.id===id)!;p.ownerId=clause.kind==='ReleaseNation'?clause.targetId!:clause.kind==='ReturnTerritory'?p.originalOwnerId!:from;p.countryId=p.ownerId;p.controllerId=p.ownerId;
    for(const city of state.cities??[])if(city.provinceId===id)city.countryId=p.ownerId;
    state.constructions=state.constructions?.filter(c=>c.provinceId!==id);state.constructionQueue=state.constructionQueue?.filter(c=>c.provinceId!==id);p.productionQueue=[];
    if(clause.kind==='ReleaseNation')delete countryFor(state,p.ownerId).overlordId;
    for(const country of Object.values(state.countries))if(country.nationalProject?.provinceId===id)delete country.nationalProject;
  }
  if(clause.kind==='Territory'||clause.kind==='Vassalization')winner.aggressiveExpansion=Math.min(100,winner.aggressiveExpansion!+(clause.kind==='Vassalization'?20:clause.provinceIds.length*2));
  }
  const participants=new Set([...w.attackers,...w.defenders]);
  for(const p of state.provinces)if(participants.has(p.ownerId)&&participants.has(p.controllerId??p.ownerId))p.controllerId=p.ownerId;
  // Relocate foreign armies to an owned province; defeated landless armies demobilize.
  const provinces=new Map(state.provinces.map(p=>[p.id,p]));
  for(const army of state.armies){if(!participants.has(army.ownerId))continue;delete army.order;const p=provinces.get(army.provinceId)!;if(p.ownerId!==army.ownerId){const home=state.provinces.find(p=>p.ownerId===army.ownerId);if(home)army.provinceId=home.id;else army.troops=0;}}
  state.armies=state.armies.filter(a=>a.troops>0);
  for(const a of w.attackers)for(const d of w.defenders){const link=diplomaticLink(state,a,d);link.truceUntilTick=state.tick+24;delete link.proposal;}
  state.warHistory!.unshift({id:w.id,endedTick:state.tick,kind:terms.kind,clauses:structuredClone(peaceClauses(terms)),attackers:[...w.attackers],defenders:[...w.defenders],casualties:{...w.casualties}});state.warHistory=state.warHistory!.slice(0,20);
  for(const id of participants)notify(state,id,'Diplomacy','Подписан мирный договор');
  state.wars=state.wars!.filter(q=>q.id!==w.id);state.activeBattles=state.activeBattles?.filter(b=>!participants.has(b.attackerId)&&!participants.has(b.defenderId));state.sieges=state.sieges?.filter(b=>!participants.has(b.attackerId)&&!participants.has(b.defenderId));
}
export function monthlyWar(state:GameState):void {
  if(!state.dataset)return;refreshWars(state);
  const active=new Set(state.wars!.flatMap(w=>[...w.attackers,...w.defenders]));
  for(const c of Object.values(state.countries))c.warExhaustion=Math.max(0,Math.min(100,c.warExhaustion!+(active.has(c.id)?.35:-.75)));
  for(const w of state.wars!){if(w.peaceOffer&&w.peaceOffer.expiresTick<=state.tick)delete w.peaceOffer;}
  for(const c of Object.values(state.countries)){const r=c.reparations;if(r&&r.untilTick>state.tick&&r.lastTick!==state.tick){const paid=money(Math.min(c.treasury,r.amount));c.treasury=money(c.treasury-paid);countryFor(state,r.to).treasury=money(countryFor(state,r.to).treasury+paid);r.lastTick=state.tick;}if(r&&r.untilTick<=state.tick)delete c.reparations;}
  // Tribute is bounded by available cash, paid once per authoritative monthly tick.
  for(const c of Object.values(state.countries))if(c.overlordId){const lord=countryFor(state,c.overlordId),tribute=money(Math.min(c.treasury,Math.max(0,c.economy?.monthlyBalance??0)*.1));c.treasury=money(c.treasury-tribute);lord.treasury=money(lord.treasury+tribute);}
}
