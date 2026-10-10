import {countryFor,type GameState} from './gameTypes.ts';
import {money} from './economySystem.ts';
import {pairKey} from './diplomacySystem.ts';
import {logDiplomacy,relationChange} from './diplomacy2System.ts';
import {techLevel} from './technologySystem.ts';

export const ESPIONAGE_MISSIONS={
  IntelligenceGathering:{name:'Сбор разведданных',cost:80,pp:8,months:3,cooldown:12,success:75,detection:20,effectMonths:12,description:'Снимок армии, бюджета и устойчивости; +8% силы при атаке этой страны на 12 месяцев.'},
  Sabotage:{name:'Саботаж',cost:120,pp:12,months:4,cooldown:18,success:60,detection:40,effectMonths:6,description:'Производство и ресурсный доход −20%, снабжение −15% на 6 месяцев.'},
  PoliticalIntrigue:{name:'Политическая интрига',cost:100,pp:10,months:6,cooldown:18,success:55,detection:45,effectMonths:0,description:'Стабильность −7, национальное недовольство +10, до трёх провинций: недовольство +12.'},
  Counterintelligence:{name:'Контрразведка',cost:70,pp:8,months:2,cooldown:12,success:100,detection:0,effectMonths:12,description:'На 12 месяцев: шанс вражеской операции −30 п.п., обнаружение +25 п.п.'},
} as const;
export type EspionageKind=keyof typeof ESPIONAGE_MISSIONS;
export const ESPIONAGE_KINDS=Object.keys(ESPIONAGE_MISSIONS) as EspionageKind[];
export interface SpyMission {id:string;ownerId:string;targetId:string;kind:EspionageKind;startedTick:number;completeTick:number}
export interface IntelligenceSnapshot {army:number;treasury:number;debt:number;stability:number;technology:number;provinceCount:number;counterintelligence:boolean}
export interface SpyReport {id:string;missionId:string;ownerId:string;targetId:string;kind:EspionageKind;tick:number;outcome:'Success'|'Failure'|'Cancelled'|'Aborted';detected:boolean;message:string;intelligence?:IntelligenceSnapshot}
export interface SpyEffect {id:string;missionId:string;ownerId:string;targetId:string;kind:'Intel'|'Sabotage'|'Counterintelligence';startedTick:number;untilTick:number}
const clamp=(n:number,min=0,max=100)=>Math.max(min,Math.min(max,n));
const validId=(n:unknown)=>typeof n==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(n);
function entity(s:GameState,prefix:string):string {const n=s.nextEntityId!;if(!Number.isSafeInteger(n)||n<1||n>=Number.MAX_SAFE_INTEGER)throw Error('Espionage entity overflow');s.nextEntityId=n+1;return prefix+'-'+s.id+'-'+n;}
function future(s:GameState,months:number):number {const n=s.tick+months;if(!Number.isSafeInteger(n))throw Error('Espionage date overflow');return n;}
function roll(seed:number,text:string):number {let h=(2166136261^seed)>>>0;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;h=Math.imul(h^(h>>>16),0x7feb352d)>>>0;h=Math.imul(h^(h>>>15),0x846ca68b)>>>0;return ((h^(h>>>16))>>>0)/4294967296*100;}
export function espionageCapacity(s:GameState,id:string):number {return 2+Math.floor(techLevel(countryFor(s,id),'Diplomacy')/2);}
interface SpyModifiers {productionMultiplier:number;supplyPenalty:number;counterintelligence:boolean;intelTargets:Set<string>}
const modifierCache=new WeakMap<GameState,{effects:SpyEffect[]|undefined;length:number;tick:number;byCountry:Map<string,SpyModifiers>}>();
/** Bounded effects indexed once per state/tick; no army × mission scan. */
export function espionageModifiers(s:GameState,id:string):SpyModifiers {
  let cached=modifierCache.get(s);
  if(!cached||cached.effects!==s.spyEffects||cached.length!==s.spyEffects?.length||cached.tick!==s.tick){
    const byCountry=new Map<string,SpyModifiers>();
    const get=(id:string)=>{let m=byCountry.get(id);if(!m){m={productionMultiplier:1,supplyPenalty:0,counterintelligence:false,intelTargets:new Set()};byCountry.set(id,m);}return m;};
    for(const e of s.spyEffects??[])if(e.untilTick>s.tick){
      if(e.kind==='Sabotage'){const m=get(e.targetId);m.productionMultiplier=Math.max(.65,m.productionMultiplier-.2);m.supplyPenalty=Math.min(30,m.supplyPenalty+15);}
      else if(e.kind==='Counterintelligence')get(e.ownerId).counterintelligence=true;
      else get(e.ownerId).intelTargets.add(e.targetId);
    }
    cached={effects:s.spyEffects,length:s.spyEffects?.length??0,tick:s.tick,byCountry};modifierCache.set(s,cached);
  }
  return cached.byCountry.get(id)??{productionMultiplier:1,supplyPenalty:0,counterintelligence:false,intelTargets:new Set()};
}
export function espionageQuote(s:GameState,ownerId:string,targetId:string,kind:EspionageKind):{cost:number;pp:number;months:number;successChance:number;detectionChance:number;reason:string|null} {
  const rule=ESPIONAGE_MISSIONS[kind];let reason:string|null=null;
  const c=s.countries[ownerId],target=s.countries[targetId];
  const counter=espionageModifiers(s,targetId).counterintelligence;
  const skill=c?techLevel(c,'Diplomacy')*4+(s.leaders?.[c.rulerId??'']?.diplomaticSkill??0)/20:0;
  const defense=target?techLevel(target,'Diplomacy')*3:0;
  const successChance=kind==='Counterintelligence'?100:clamp(Math.round(rule.success+skill-defense-(counter?30:0)),5,95);
  const detectionChance=kind==='Counterintelligence'?0:clamp(Math.round(rule.detection-skill/2+defense/2+(counter?25:0)),5,95);
  if(!s.dataset||!c?.provinceIds?.length||!target?.provinceIds?.length)reason='Нужна действующая страна';
  else if(kind==='Counterintelligence'?ownerId!==targetId:ownerId===targetId)reason='Неверная цель операции';
  else if(!['running','paused'].includes(s.phase))reason='Сначала начните кампанию';
  else if(s.tick<(c.bankruptcyUntilTick??0))reason='Контрразведка и операции требуют платёжеспособного бюджета';
  else if(c.treasury<rule.cost||(c.politicalPower??0)<rule.pp)reason='Недостаточно средств или политической силы';
  else if(s.tick<(c.spyCooldowns?.[targetId+':'+kind]??0))reason='Операция на cooldown';
  else if((s.spyMissions?.filter(m=>m.ownerId===ownerId).length??0)>=espionageCapacity(s,ownerId))reason='Нет свободных разведывательных групп';
  else if(s.spyMissions?.some(m=>m.ownerId===ownerId&&m.targetId===targetId&&m.kind===kind))reason='Эта операция уже идёт';
  else if((s.spyMissions?.length??0)+(s.spyEffects?.length??0)>=900)reason='Достигнут предел операций';
  else if(kind==='Counterintelligence'&&espionageModifiers(s,ownerId).counterintelligence)reason='Контрразведка уже действует';
  else if(kind!=='IntelligenceGathering'&&kind!=='Counterintelligence'&&s.diplomacy?.[pairKey(ownerId,targetId)]?.terms?.some(t=>['Alliance','PoliticalUnion'].includes(t.type)&&t.untilTick>s.tick))reason='Союзные обязательства запрещают подрывную операцию';
  return{cost:rule.cost,pp:rule.pp,months:rule.months,successChance,detectionChance,reason};
}
export function startEspionage(s:GameState,ownerId:string,targetId:string,kind:EspionageKind):void {
  const q=espionageQuote(s,ownerId,targetId,kind);if(q.reason)throw Error(q.reason);
  const c=countryFor(s,ownerId),completeTick=future(s,q.months),cooldown=future(s,ESPIONAGE_MISSIONS[kind].cooldown);
  c.treasury=money(c.treasury-q.cost);c.politicalPower!-=q.pp;c.spyCooldowns![targetId+':'+kind]=cooldown;
  s.spyMissions!.push({id:entity(s,'spy'),ownerId,targetId,kind,startedTick:s.tick,completeTick});
}
function report(s:GameState,m:SpyMission,outcome:SpyReport['outcome'],detected:boolean,message:string,intelligence?:IntelligenceSnapshot):void {
  s.spyReports!.unshift({id:entity(s,'sr'),missionId:m.id,ownerId:m.ownerId,targetId:m.targetId,kind:m.kind,tick:s.tick,outcome,detected,message,...(intelligence?{intelligence}:{})});
  const humans=new Set(s.players.filter(p=>!p.aiControlled&&p.countryId).map(p=>p.countryId)),reserved=new Set(s.spyReports!.filter(r=>humans.has(r.ownerId)||r.detected&&humans.has(r.targetId)).slice(0,96).map(r=>r.id));
  let other=192-reserved.size;s.spyReports=s.spyReports!.filter(r=>reserved.has(r.id)||other-->0);
}
export function cancelEspionage(s:GameState,ownerId:string,id:string):void {
  const m=s.spyMissions!.find(m=>m.id===id&&m.ownerId===ownerId);if(!m)throw Error('Операция не найдена');
  s.spyMissions=s.spyMissions!.filter(x=>x.id!==id);report(s,m,'Cancelled',false,'Группа отозвана. Стоимость и cooldown сохраняются.');
}
export function monthlyEspionage(s:GameState):void {
  if(!s.dataset)return;
  s.spyEffects=s.spyEffects!.filter(e=>e.untilTick>s.tick);
  // Counterintelligence finishing this month protects against all offensive
  // completions in the same month, independent of insertion/network order.
  const due=s.spyMissions!.filter(m=>m.completeTick<=s.tick||!s.countries[m.ownerId]!.provinceIds?.length||!s.countries[m.targetId]!.provinceIds?.length).sort((a,b)=>Number(b.kind==='Counterintelligence')-Number(a.kind==='Counterintelligence')||a.id.localeCompare(b.id));
  const done=new Set(due.map(m=>m.id));s.spyMissions=s.spyMissions!.filter(m=>!done.has(m.id));
  for(const m of due){
    const c=countryFor(s,m.ownerId),target=countryFor(s,m.targetId),rule=ESPIONAGE_MISSIONS[m.kind];
    if(!c.provinceIds?.length||!target.provinceIds?.length){report(s,m,'Aborted',false,'Операция прекращена: государство потеряло территорию.');continue;}
    if(['Sabotage','PoliticalIntrigue'].includes(m.kind)&&s.diplomacy?.[pairKey(m.ownerId,m.targetId)]?.terms?.some(t=>['Alliance','PoliticalUnion'].includes(t.type)&&t.untilTick>s.tick)){report(s,m,'Aborted',false,'Операция прекращена после заключения союзного договора.');continue;}
    const q=espionageQuote(s,m.ownerId,m.targetId,m.kind),success=roll(s.campaignSeed??0,m.id+':success')<q.successChance,detected=roll(s.campaignSeed??0,m.id+':detection')<q.detectionChance;
    let intelligence:IntelligenceSnapshot|undefined,message=success?'Операция выполнена.':'Операция провалилась. Расходы потеряны.';
    if(success){
      if(m.kind==='PoliticalIntrigue'){
        target.stability=clamp(target.stability-7);target.unrest=clamp((target.unrest??0)+10);
        const provinces=s.provinces.filter(p=>p.ownerId===m.targetId&&(p.controllerId??p.ownerId)===m.targetId).sort((a,b)=>(b.unrest??0)-(a.unrest??0)||a.id.localeCompare(b.id)).slice(0,3);
        for(const p of provinces)p.unrest=clamp((p.unrest??0)+12);message='Интрига: стабильность −7, недовольство +10; усилено напряжение в '+provinces.length+' провинциях.';
      }else{
        const kind=m.kind==='IntelligenceGathering'?'Intel':m.kind;
        s.spyEffects!.push({id:entity(s,'se'),missionId:m.id,ownerId:m.ownerId,targetId:m.targetId,kind,startedTick:s.tick,untilTick:future(s,rule.effectMonths)});
        message=m.kind==='IntelligenceGathering'?'Разведданные получены; преимущество при атаке +8% на 12 месяцев.':m.kind==='Sabotage'?'Саботаж: производство и ресурсы −20%, снабжение −15% на 6 месяцев.':'Контрразведка действует 12 месяцев.';
        if(m.kind==='IntelligenceGathering')intelligence={army:target.army,treasury:target.treasury,debt:target.debt??0,stability:target.stability,technology:target.technology,provinceCount:target.provinceIds!.length,counterintelligence:espionageModifiers(s,m.targetId).counterintelligence};
      }
    }
    if(detected){
      const l=s.diplomacy?.[pairKey(m.ownerId,m.targetId)];
      relationChange(s,m.ownerId,m.targetId,'espionage:'+m.ownerId,'Обнаруженная разведка',success?-15:-20);
      const changed=s.diplomacy![pairKey(m.ownerId,m.targetId)]!;changed.trust=clamp((l?.trust??50)-(success?10:12));
      c.diplomaticReputation=clamp((c.diplomaticReputation??50)-(success?3:5));c.aggressiveExpansion=clamp((c.aggressiveExpansion??0)+(success?3:4));
      logDiplomacy(s,[m.ownerId,m.targetId],'EspionageDetected',`${c.name}: обнаружена операция «${rule.name}» в ${target.name}. ${success?'Операция успела достичь цели.':'Операция провалилась.'}`);
      message+=' Группа обнаружена: отношения и репутация ухудшились.';
    }
    report(s,m,success?'Success':'Failure',detected,message,intelligence);
  }
}
export function initializeEspionage(s:GameState,migrate:boolean):void {
  if(!s.dataset)return;
  if(migrate){s.spyMissions??=[];s.spyReports??=[];s.spyEffects??=[];for(const c of Object.values(s.countries))c.spyCooldowns??={};}
  if(!Array.isArray(s.spyMissions)||s.spyMissions.length>900||!Array.isArray(s.spyEffects)||s.spyEffects.length>900||!Array.isArray(s.spyReports)||s.spyReports.length>192)throw Error('Invalid espionage arrays');
  const date=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0,ids=new Set<string>(),missions=new Set<string>(),results=new Set<string>(),effects=new Set<string>();
  const id=(n:string)=>{if(!validId(n)||ids.has(n))throw Error('Invalid espionage id');const match=/^(spy|sr|se)-/.test(n)&&n.startsWith(n.split('-')[0]+'-'+s.id+'-');if(match){const seq=Number(n.split('-').at(-1));if(!Number.isSafeInteger(seq)||seq<1||seq>=s.nextEntityId!)throw Error('Invalid espionage sequence');}ids.add(n);};
  const parties=(owner:string,target:string,kind:EspionageKind)=>{countryFor(s,owner);countryFor(s,target);if(!Object.hasOwn(ESPIONAGE_MISSIONS,kind)||(kind==='Counterintelligence'?owner!==target:owner===target))throw Error('Invalid espionage parties');};
  for(const c of Object.values(s.countries)){
    if(!c.spyCooldowns||typeof c.spyCooldowns!=='object'||Array.isArray(c.spyCooldowns)||Object.keys(c.spyCooldowns).length>Object.keys(s.countries).length*4)throw Error('Invalid espionage cooldowns');
    for(const [key,value]of Object.entries(c.spyCooldowns)){const [target,kind,...rest]=key.split(':');if(rest.length||!s.countries[target!]||!Object.hasOwn(ESPIONAGE_MISSIONS,kind!)||!date(value))throw Error('Invalid espionage cooldown');}
  }
  for(const m of s.spyMissions){id(m.id);parties(m.ownerId,m.targetId,m.kind);const key=m.ownerId+':'+m.targetId+':'+m.kind;if(missions.has(key)||!date(m.startedTick)||m.startedTick>s.tick||!date(m.completeTick)||m.completeTick!==m.startedTick+ESPIONAGE_MISSIONS[m.kind].months||(s.countries[m.ownerId]!.spyCooldowns![m.targetId+':'+m.kind]??0)<m.startedTick+ESPIONAGE_MISSIONS[m.kind].cooldown)throw Error('Invalid espionage mission');missions.add(key);}
  for(const e of s.spyEffects){id(e.id);if(!['Intel','Sabotage','Counterintelligence'].includes(e.kind))throw Error('Invalid espionage effect kind');parties(e.ownerId,e.targetId,e.kind==='Intel'?'IntelligenceGathering':e.kind);const duration=e.kind==='Sabotage'?6:12;if(!validId(e.missionId)||effects.has(e.missionId)||!date(e.startedTick)||e.startedTick>s.tick||!date(e.untilTick)||e.untilTick!==e.startedTick+duration)throw Error('Invalid espionage effect');effects.add(e.missionId);}
  for(const r of s.spyReports){id(r.id);parties(r.ownerId,r.targetId,r.kind);if(!validId(r.missionId)||results.has(r.missionId)||!date(r.tick)||r.tick>s.tick||!['Success','Failure','Cancelled','Aborted'].includes(r.outcome)||typeof r.detected!=='boolean'||r.kind==='Counterintelligence'&&r.detected||typeof r.message!=='string'||r.message.length>250)throw Error('Invalid espionage report');results.add(r.missionId);
    if(r.intelligence){const i=r.intelligence;if(r.kind!=='IntelligenceGathering'||r.outcome!=='Success'||Object.keys(i).length!==7||![i.army,i.treasury,i.debt,i.stability,i.technology,i.provinceCount].every(n=>Number.isFinite(n)&&n>=0)||i.stability>100||i.technology>100||!Number.isSafeInteger(i.army)||!Number.isSafeInteger(i.provinceCount)||i.provinceCount>s.provinces.length||typeof i.counterintelligence!=='boolean'||money(i.treasury)!==i.treasury||money(i.debt)!==i.debt)throw Error('Invalid intelligence snapshot');}
  }
  for(const m of s.spyMissions)if(results.has(m.id)||effects.has(m.id))throw Error('Completed espionage still active');
  const reports=new Map(s.spyReports.map(r=>[r.missionId,r]));
  for(const e of s.spyEffects){const r=reports.get(e.missionId);if(r&&(r.outcome!=='Success'||r.ownerId!==e.ownerId||r.targetId!==e.targetId||r.tick!==e.startedTick||(e.kind==='Intel'?'IntelligenceGathering':e.kind)!==r.kind))throw Error('Inconsistent espionage result');}
}
