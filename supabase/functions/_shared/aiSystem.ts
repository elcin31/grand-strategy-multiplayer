import type { Army, BuildingType, GameState, Province } from './gameTypes.ts';
import { BUILDINGS, buildingQuote, provinceBuildingModifiers, startConstruction } from './buildingSystem.ts';
import { combatMultiplier } from './militarySystem.ts';
import { researchQuote, startResearch, techLevel, type TechnologyBranch } from './technologySystem.ts';
import { declareWar, diplomaticAction, pairKey, offerTreaty, warBetween,type DiplomacyLink } from './diplomacySystem.ts';
import {missionAvailability,diplomacyAcceptance,diplomacyQuote,respondDiplomacy,terminateTreaty,offerDiplomacy} from './diplomacy2System.ts';
import {espionageQuote,startEspionage,type EspionageKind} from './espionageSystem.ts';
import { isWarLeader, opponentSide, peaceCost, proposePeace, respondPeace, scoreFor, type PeaceTerms } from './warSystem.ts';
import { pacifyProvince } from './stabilitySystem.ts';

export const AI_PERSONALITIES = ['Defensive','Diplomatic','Expansionist','Economic','Militarist'] as const;
export type AIPersonality = typeof AI_PERSONALITIES[number];
export function initializeAI(s:GameState):void {
  if(!s.dataset)return;
  for(const leader of Object.values(s.leaders??{})){
    leader.aiPersonality ??= AI_PERSONALITIES[leader.portraitSeed%5]!;
    if(!AI_PERSONALITIES.includes(leader.aiPersonality))throw new Error('Invalid AI personality');
  }
}
export function personality(s:GameState,id:string):AIPersonality {
  return s.leaders?.[s.countries[id]!.rulerId??'']?.aiPersonality??'Defensive';
}
export function aiControls(s:GameState,id:string):boolean {return !s.players.some(p=>p.countryId===id&&!p.aiControlled);}
export interface AIStrategicContext {
  militaryStrength:number; enemyStrength:number; neighbourThreat:number; treasuryReserve:number;
  incomeBalance:number; stability:number; warExhaustion:number; allianceStrength:number; diplomaticIsolation:number;
}
export function strategicContext(s:GameState,id:string,neighbours:string[],ownLinks?:DiplomacyLink[]):AIStrategicContext {
  const c=s.countries[id]!,w=s.wars?.find(w=>[...w.attackers,...w.defenders].includes(id));
  const allies=(ownLinks??Object.values(s.diplomacy??{}).filter(l=>l.a===id||l.b===id)).filter(l=>l.treaties.some(t=>t==='Alliance'||t==='PoliticalUnion')).map(l=>l.a===id?l.b:l.a);
  return {militaryStrength:c.army,enemyStrength:w?opponentSide(w,id).reduce((n,i)=>n+s.countries[i]!.army,0):0,
    neighbourThreat:Math.max(0,...neighbours.map(i=>s.countries[i]!.army)),treasuryReserve:Math.max(150,((c.economy?.armyMaintenance??0)+(c.economy?.buildingMaintenance??0)+(c.economy?.interest??0)+20)*6),
    incomeBalance:c.economy?.monthlyBalance??0,stability:c.stability,warExhaustion:c.warExhaustion??0,
    allianceStrength:allies.reduce((n,i)=>n+s.countries[i]!.army,0),diplomaticIsolation:allies.length?0:1};
}
export function warDecisionScore(s:GameState,id:string,target:string,context:AIStrategicContext,claimCount?:number):number {
  const c=s.countries[id]!,e=s.countries[target]!,l=s.diplomacy?.[pairKey(id,target)];
  if(c.overlordId||e.overlordId||!e.provinceIds?.length||s.wars?.some(w=>[...w.attackers,...w.defenders].some(i=>i===id||i===target))||l?.treaties.length||l?.guarantors.includes(id)||s.tick<(l?.truceUntilTick??0)||c.politicalPower!<25||c.stability<55||c.warExhaustion!>30||c.treasury<context.treasuryReserve+100)return -Infinity;
  const defenders=new Set([target,...Object.values(s.diplomacy??{}).filter(x=>(x.a===target||x.b===target)&&(x.treaties.some(t=>t==='Alliance'||t==='DefensivePact'||t==='PoliticalUnion')||x.guarantors.includes(x.a===target?x.b:x.a))).map(x=>x.a===target?x.b:x.a),...Object.values(s.countries).filter(x=>x.overlordId===target).map(x=>x.id)]);
  if([...defenders].some(d=>{const link=s.diplomacy?.[pairKey(id,d)];return link?.treaties.length||s.tick<(link?.truceUntilTick??0);}))return -Infinity;
  const power=[...defenders].reduce((n,i)=>n+s.countries[i]!.army,0);
  const ratio=context.militaryStrength/Math.max(10000,power);
  if(ratio<1.6)return -Infinity;
  const bias={Defensive:-55,Diplomatic:-45,Economic:-30,Expansionist:25,Militarist:10}[personality(s,id)];
  const claims=Math.min(20,(claimCount??s.provinces.filter(p=>p.ownerId===target&&p.originalOwnerId===id).length)*5);
  return 30*(ratio-1)+bias+claims-(l?.relation??0)*.5-c.aggressiveExpansion!*.8-context.warExhaustion;
}
/** Uses the same combat factors as the authoritative resolver, including fortifications and readiness. */
export function attackRatio(s:GameState,a:Army,p:Province,byProvince?:ReadonlyMap<string,readonly Army[]>):number {
  const enemy=p.controllerId??p.ownerId,c=s.countries[a.ownerId]!,d=s.countries[enemy]!;
  const defenders=(byProvince?.get(p.id)??(byProvince?[]:s.armies)).filter(x=>x.provinceId===p.id&&x.ownerId===enemy),troops=defenders.reduce((n,x)=>n+x.troops,0);
  const readiness=troops?defenders.reduce((n,x)=>n+x.troops*combatMultiplier(s,x,p,true),0)/troops:1;
  return a.troops*(1+c.technology/200)*(.75+c.stability/200)*combatMultiplier(s,a,p,false)/Math.max(1,(troops+2500)*(1+d.technology/180)*(.85+d.stability/250)*1.12*(1+provinceBuildingModifiers(p).defensePercent/100)*readiness);
}
interface Actions {recruit:(s:GameState,id:string,p:Province,n:number)=>void;move:(s:GameState,id:string,army:string,to:string)=>void}
/** One shared province index per tick; strategic decisions staggered over six ticks. Tactical reactions are bounded to three stacks/country. */
export function runStrategicAI(s:GameState,actions:Actions):void {
  const provinces=new Map(s.provinces.map(p=>[p.id,p])),owned=new Map<string,Province[]>(),neighbours=new Map<string,Set<string>>(),claims=new Map<string,number>();
  for(const p of s.provinces){const list=owned.get(p.ownerId)??[];list.push(p);owned.set(p.ownerId,list);const border=neighbours.get(p.ownerId)??new Set<string>();for(const n of p.neighbors){const q=provinces.get(n);if(q&&q.ownerId!==p.ownerId)border.add(q.ownerId);}neighbours.set(p.ownerId,border);if(p.originalOwnerId&&p.originalOwnerId!==p.ownerId){const key=p.originalOwnerId+'>'+p.ownerId;claims.set(key,(claims.get(key)??0)+1);}}
  const linksByCountry=new Map<string,DiplomacyLink[]>(),detectedThreats=new Set<string>();
  for(const l of Object.values(s.diplomacy??{}))for(const id of [l.a,l.b]){const links=linksByCountry.get(id)??[];links.push(l);linksByCountry.set(id,links);}
  for(const r of s.spyReports??[])if(r.detected&&r.ownerId!==r.targetId&&s.tick-r.tick<=12)detectedThreats.add(r.targetId);
  const capitals=new Map((s.cities??[]).map(city=>[city.id,city.provinceId]));
  let armySource:Army[]|undefined,armyCount=-1;
  let byProvince=new Map<string,Army[]>(),byOwner=new Map<string,Army[]>();
  const indexArmies=()=>{if(armySource===s.armies&&armyCount===s.armies.length)return;armySource=s.armies;armyCount=s.armies.length;byProvince=new Map();byOwner=new Map();for(const a of s.armies){const at=byProvince.get(a.provinceId)??[];at.push(a);byProvince.set(a.provinceId,at);const own=byOwner.get(a.ownerId)??[];own.push(a);byOwner.set(a.ownerId,own);}};
  const moveIndexed:Actions['move']=(state,owner,army,to)=>{actions.move(state,owner,army,to);armySource=undefined;};
  const assignedCommanders=new Set(s.armies.map(a=>a.commanderId).filter(Boolean));
  const freeCommanders=new Map<string,string[]>();
  for(const g of Object.values(s.commanders??{}))if(!assignedCommanders.has(g.id)){const list=freeCommanders.get(g.countryId)??[];list.push(g.id);freeCommanders.set(g.countryId,list);}
  const ids=Object.keys(s.countries).sort();
  for(let index=0;index<ids.length;index++){
    const id=ids[index]!,c=s.countries[id]!;if(!aiControls(s,id))continue;
    const home=(owned.get(id)??[]).filter(p=>(p.controllerId??p.ownerId)===id);
    const adjacent=[...(neighbours.get(id)??[])].sort(),style=personality(s,id);
    let cachedContext:AIStrategicContext|undefined;
    const context=()=>cachedContext??=strategicContext(s,id,adjacent,linksByCountry.get(id)??[]);
    const w=s.wars?.find(w=>[...w.attackers,...w.defenders].includes(id));
    // Event-driven responses do not wait for the country's strategic slot.
    for(const offer of [...s.diplomaticOffers??[]]){
      const members=offer.terms.kind==='Summit'?offer.terms.participants:[offer.from,offer.to];
      if(offer.from===id||!members.includes(id)||offer.acceptedBy.includes(id)||offer.expiresTick<=s.tick)continue;
      const rating=diplomacyAcceptance(s,offer.from,id,offer.terms);
      try{respondDiplomacy(s,id,offer.id,rating.score>=rating.required);}catch{respondDiplomacy(s,id,offer.id,false);}
    }
    if(w&&isWarLeader(w,id)&&w.peaceOffer&&w.peaceOffer.from!==id){
      const offer=w.peaceOffer;let accept=false;
      // A pending human offer can become unaffordable or lose its occupied provinces
      // before timeout hands control to AI. Reject it; never abort the world tick.
      try {accept=offer.terms.kind==='WhitePeace'?(s.tick-w.startedTick>=12||context().warExhaustion>50||context().incomeBalance<0):scoreFor(w,offer.from)>=peaceCost(s,w,offer.from,offer.terms);} catch {accept=false;}
      respondPeace(s,id,w.id,accept);
    }
    // Occupation cannot suppress consent or peace responses. Productive and
    // tactical work requires a controlled home province after those responses.
    if(!home.length)continue;
    const capital=capitals.get(c.capitalCityId??'')??home[0]!.id;
    if(s.tick%6===index%6){
      const affordable=(cost:number)=>c.treasury-cost>=context().treasuryReserve&&s.tick>=c.bankruptcyUntilTick!;
      const enemyIds=activeEnemies(s,id),suspected=detectedThreats.has(id);
      const spy=(target:string,kind:EspionageKind)=>{const quote=espionageQuote(s,id,target,kind);if(!quote.reason&&affordable(quote.cost)){startEspionage(s,id,target,kind);return true;}return false;};
      const threatened=enemyIds.length>0||context().neighbourThreat>c.army*1.5;
      const defended=(suspected||threatened&&(style==='Defensive'||style==='Militarist'))&&spy(id,'Counterintelligence');
      if(!defended){
        const spyTarget=[...new Set([...enemyIds,...adjacent.filter(t=>s.diplomacy?.[pairKey(id,t)]?.rivals.length)])].filter(t=>s.countries[t]!.provinceIds?.length).sort((a,b)=>(s.countries[a]!.stability-s.countries[b]!.stability)||a.localeCompare(b))[0];
        if(spyTarget)spy(spyTarget,style==='Expansionist'?'Sabotage':style==='Militarist'&&s.countries[spyTarget]!.stability<60?'PoliticalIntrigue':'IntelligenceGathering');
      }
      // Reconsider older commitments when a partner becomes a hostile rival.
      // Cancellation uses the same PP, trust and truce rules as player commands.
      const obsolete=linksByCountry.get(id)?.find(l=>l.relation<=-50&&l.terms?.some(t=>s.tick-t.startedTick>=6));
      if(obsolete&&c.politicalPower!>=5){const term=obsolete.terms!.find(t=>s.tick-t.startedTick>=6)!;terminateTreaty(s,id,obsolete.a===id?obsolete.b:obsolete.a,term.id);}
      const unrest=[...home].sort((a,b)=>(b.unrest??0)-(a.unrest??0))[0]!;
      if(!unrest.rebellion&&unrest.unrest!>=65&&c.politicalPower!>=10&&affordable(50))pacifyProvince(s,id,unrest);
      const active=s.wars?.find(w=>[...w.attackers,...w.defenders].includes(id));
      if(active&&isWarLeader(active,id)&&!active.peaceOffer){
        const score=scoreFor(active,id),age=s.tick-active.startedTick;
        if(age>=12||context().warExhaustion>65||score>=50){
          const occupied=s.provinces.filter(p=>opponentSide(active,id).includes(p.ownerId)&&(p.controllerId??p.ownerId)===id).map(p=>p.id).slice(0,3);
          let terms:PeaceTerms={kind:'WhitePeace',provinceIds:[],amount:0};
          if(score>=80&&!c.overlordId&&!s.countries[opponentSide(active,id)[0]!]!.overlordId&&!Object.values(s.countries).some(x=>x.overlordId===opponentSide(active,id)[0])&&style==='Expansionist')terms={kind:'Vassalization',provinceIds:[],amount:0};
          else if(score>0&&occupied.length){const candidate:PeaceTerms={kind:'Territory',provinceIds:occupied,amount:0};if(peaceCost(s,active,id,candidate)<=score)terms=candidate;}
          if(terms.kind!=='WhitePeace'||age>=12||s.countries[opponentSide(active,id)[0]!]!.warExhaustion!>=70)proposePeace(s,id,active.id,terms);
        }
      }
      if(!c.research){const branches:TechnologyBranch[]=style==='Economic'?['Economy','Industry','Administration','Military','Diplomacy']:style==='Diplomatic'?['Diplomacy','Economy','Administration','Military','Industry']:['Military','Economy','Administration','Industry','Diplomacy'];const branch=branches.filter(b=>techLevel(c,b)<5).sort((a,b)=>techLevel(c,a)-techLevel(c,b))[0];if(branch&&affordable(researchQuote(c,branch).cost))startResearch(s,c,branch);}
      if(!s.constructions?.some(q=>q.ownerId===id)&&context().incomeBalance>15){
        const site=[...home].filter(p=>!p.rebellion).sort((a,b)=>b.income-a.income)[0];
        if(site){const kinds:BuildingType[]=style==='Defensive'?['Fort','Administration','Farm']:site.resourceDeposit?['Mine','Factory','University','Infrastructure']:['Factory','University','Farm'];const kind=kinds.find(k=>(site.buildings?.[k]??0)<BUILDINGS[k].maxLevel);if(kind){const q=buildingQuote(site,kind);if(affordable(q.cost)&&context().incomeBalance>BUILDINGS[kind].maintenance*3)startConstruction(s,id,site,kind);}}
      }
      const cap=home.find(p=>p.id===capital)??home[0]!;
      indexArmies();
      const capitalTroops=(byProvince.get(capital)??[]).filter(a=>a.ownerId===id).reduce((n,a)=>n+a.troops,0);
      const recruitSite=capitalTroops>=12000?home.filter(p=>!p.rebellion&&p.id!==capital).sort((a,b)=>b.income-a.income)[0]??cap:cap;
      const targetStrength=Math.max(8000,Math.min(context().neighbourThreat*(style==='Militarist'?1.5:1),Math.max(0,(c.economy?.monthlyIncome??0)*.25/1.25*1000)));
      if(!recruitSite.rebellion&&c.army<targetStrength&&context().incomeBalance>15&&affordable(80)&&c.manpower>=4000)actions.recruit(s,id,recruitSite,4000);
      if(!s.wars?.some(w=>[...w.attackers,...w.defenders].includes(id))){
        const enemy=adjacent.map(target=>({target,score:warDecisionScore(s,id,target,context(),claims.get(id+'>'+target)??0)})).sort((a,b)=>b.score-a.score)[0];
        if(enemy&&enemy.score>=65){try{declareWar(s,id,enemy.target);}catch{/* Coalition may have changed earlier in this scheduled tick; authoritative guard wins. */}}
        else {const friend=adjacent.filter(t=>!warBetween(s,id,t)).sort((a,b)=>(s.diplomacy?.[pairKey(id,b)]?.relation??0)-(s.diplomacy?.[pairKey(id,a)]?.relation??0))[0];if(friend){const l=s.diplomacy?.[pairKey(id,friend)];if(!l?.rivals.length&&c.politicalPower!>=35&&affordable(29)&&!missionAvailability(s,id,friend,'Improve'))diplomaticAction(s,id,friend,'Improve');const treaty=style==='Diplomatic'?'Alliance':style==='Economic'?'TradeAgreement':context().neighbourThreat>c.army*1.5?'DefensivePact':'NonAggression',terms={kind:'Treaty',treaty} as const,rating=diplomacyAcceptance(s,id,friend,terms);if(affordable(25)&&rating.score>=rating.required&&!diplomacyQuote(s,id,friend,terms).reason)offerTreaty(s,id,friend,treaty);
          if(style==='Diplomatic'&&affordable(200)&&!diplomacyQuote(s,id,friend,{kind:'PoliticalUnion'}).reason)offerDiplomacy(s,id,friend,{kind:'PoliticalUnion'});
          if((l?.relation??0)>=40&&!l?.rivals.length&&!l?.guarantors.includes(id)&&!s.countries[friend]!.overlordId&&c.politicalPower!>=80&&context().neighbourThreat>s.countries[friend]!.army*2)diplomaticAction(s,id,friend,'Guarantee');}
          if((style==='Expansionist'||style==='Militarist')&&enemy&&s.countries[enemy.target]!.army>c.army){const l=s.diplomacy?.[pairKey(id,enemy.target)];if(!l?.treaties.length&&!l?.rivals.includes(id))diplomaticAction(s,id,enemy.target,'Rival');}}
      }
    }
    // Deterministic work budget: at most ceil(countryCount/4)*3 tactical stacks.
    // Every country gets a slot within four ticks; treaty/peace responses above stay immediate.
    if((index+s.tick)%4!==0)continue;
    // Retain capital garrison; spread spare stacks toward valuable threatened borders.
    indexArmies();
    const armies=[...(byOwner.get(id)??[])].sort((a,b)=>b.troops-a.troops).slice(0,3);
    for(const army of armies){if(army.order)continue;indexArmies();const origin=provinces.get(army.provinceId);if(!origin)continue;
      if(!army.commanderId){const general=freeCommanders.get(id)?.shift();if(general)army.commanderId=general;}
      const targets=origin.neighbors.map(n=>provinces.get(n)!).filter(Boolean);
      const attack=targets.filter(p=>warBetween(s,id,p.controllerId??p.ownerId)&&attackRatio(s,army,p,byProvince)>=(style==='Defensive'?1.65:1.25)).sort((a,b)=>b.income-a.income)[0];
      if(attack&&(origin.id!==capital||home.length===1||(byProvince.get(capital)??[]).some(a=>a.id!==army.id&&a.ownerId===id))&&army.organization!>=55&&army.morale!>=55){moveIndexed(s,id,army.id,attack.id);continue;}
      if(origin.id===capital&&(byProvince.get(capital)??[]).filter(a=>a.ownerId===id).length<=1)continue;
      const urgency=(p:Province)=> (p.id===capital?100:0)+p.income+ p.neighbors.reduce((n,q)=>n+(warBetween(s,id,provinces.get(q)?.controllerId??provinces.get(q)?.ownerId??id)?50:0),0)-(byProvince.get(p.id)??[]).filter(a=>a.ownerId===id).reduce((n,a)=>n+a.troops/1000,0);
      const destination=targets.filter(p=>(p.controllerId??p.ownerId)===id&&!p.rebellion).sort((a,b)=>urgency(b)-urgency(a))[0];
      if(destination&&urgency(destination)>urgency(origin)+5)moveIndexed(s,id,army.id,destination.id);
    }
  }
}
function activeEnemies(s:GameState,id:string):string[]{return [...new Set((s.wars??[]).flatMap(w=>w.attackers.includes(id)?w.defenders:w.defenders.includes(id)?w.attackers:[]))];}
