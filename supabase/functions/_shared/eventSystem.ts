import type {Country,GameState} from './gameTypes.ts';
import type {EventCondition,EventDefinition,EventEffect,EventHistory,EventInstance,EventMetric,EventOption} from './eventTypes.ts';
import {DOMINION_EVENTS,eventDefinition} from './eventCatalogue.ts';
import {hasTechnology} from './technologyTree.ts';
import {focusNode,hasFocus} from './focusCatalogue.ts';
import {money} from './economySystem.ts';
import {stock,addStock,materialReason,payMaterials} from './stockpileSystem.ts';
import {pairKey,warBetween} from './diplomacySystem.ts';
import {relationChange} from './diplomacy2System.ts';
import {POLITICAL_DECISIONS,decisionReason,startDecision} from './politicalDecisions.ts';
import {RESOURCES} from './resourceCatalogue.ts';
import {openCrisis} from './geopoliticsSystem.ts';
import {notify} from './notificationSystem.ts';

type Context=Pick<EventInstance,'countryId'|'counterpartId'|'provinceId'>;
const bounded=(n:number,max=100)=>Math.max(0,Math.min(max,n));
const compare=(a:number,op:string,b:number)=>op==='lt'?a<b:op==='lte'?a<=b:op==='eq'?a===b:op==='gte'?a>=b:a>b;
function metric(c:Country,key:EventMetric):number {
 switch(key){case 'budgetBalance':return c.economy?.monthlyBalance??0;case 'reputation':return c.diplomaticReputation??50;default:return c[key]??0;}
}
/** Read-only evaluation on a game step; never installed as a render/gesture callback. */
export function eventCondition(s:GameState,context:Context,condition:EventCondition):boolean {
 const c=s.countries[context.countryId];if(!c)return false;
 switch(condition.kind){
  case 'all':return condition.conditions.every(x=>eventCondition(s,context,x));
  case 'any':return condition.conditions.some(x=>eventCondition(s,context,x));
  case 'not':return !eventCondition(s,context,condition.condition);
  case 'metric':return compare(metric(c,condition.metric),condition.op,condition.value);
  case 'date':return s.year>=condition.fromYear&&s.year<=condition.toYear;
  case 'government':return c.governmentType===condition.value;
  case 'war':return !!s.wars?.some(w=>w.attackers.includes(c.id)||w.defenders.includes(c.id))===condition.active;
  case 'resource':return stock(c,condition.resource)>=condition.amount;
  case 'relation':{const target=condition.target==='counterpart'?context.counterpartId:condition.target;return !!target&&compare(s.diplomacy?.[pairKey(c.id,target)]?.relation??0,condition.op,condition.value);}
  case 'province':return s.provinces.some(p=>p.id===condition.provinceId&&p.ownerId===(condition.owner==='self'?c.id:condition.owner));
  case 'technology':return hasTechnology(c,condition.id);
  case 'focus':return hasFocus(c,condition.id);
  case 'result':{const receipt=c.eventReceipts?.[condition.eventId];return receipt?.resolvedTick!==undefined&&(!condition.choiceId||receipt.choiceId===condition.choiceId);}
  case 'after':{const receipt=c.eventReceipts?.[condition.eventId];return receipt?.resolvedTick!==undefined&&s.tick-receipt.resolvedTick>=condition.months;}
  case 'recentPeace':return c.lastWarEndedTick!==undefined&&s.tick>=c.lastWarEndedTick&&s.tick-c.lastWarEndedTick<=condition.months;
  case 'damaged':{let count=0;for(const p of s.provinces)if(p.ownerId===c.id&&(p.buildingDamage??0)>.05&&++count>=condition.minimum)return true;return false;}
 }
}
function crisisReason(s:GameState,c:Country,x:Context):string|null{
 const target=x.counterpartId,p=s.provinces.find(p=>p.id===x.provinceId);
 if(!target||!s.countries[target]||!p||p.ownerId!==target||warBetween(s,c.id,target)||s.tick<(c.crisisCooldownUntilTick??0)||(c.politicalPower??0)<10||s.diplomaticCrises?.some(q=>q.status==='Open'&&[q.from,q.to].includes(c.id)))return 'Пограничный кризис сейчас недоступен';
 const link=s.diplomacy?.[pairKey(c.id,target)];return link?.treaties.includes('Alliance')||s.tick<(link?.truceUntilTick??0)?'Сначала соблюдите действующие дипломатические обязательства':null;
}
function preview(s:GameState,x:Context,option:EventOption):Country {
 const current=s.countries[x.countryId];if(!current)throw Error('Страна события не найдена');
 if(option.condition&&!eventCondition(s,x,option.condition))throw Error('Не выполнены условия этого решения');
 // Only the participating country is copied. No world/geometry clone per NPC event.
 const c=structuredClone(current),cost=option.cost;
 if(c.treasury<(cost?.treasury??0)||(c.politicalPower??0)<(cost?.politicalPower??0))throw Error('Недостаточно средств или политической власти');
 const missing=materialReason(c,cost?.resources??{});if(missing)throw Error(missing);
 c.treasury=money(c.treasury-(cost?.treasury??0));c.politicalPower=(c.politicalPower??0)-(cost?.politicalPower??0);payMaterials(c,cost?.resources??{});
 for(const effect of option.effects){
  switch(effect.kind){
   case 'metric':{const key=effect.metric==='reputation'?'diplomaticReputation':effect.metric;
    if(key==='treasury'){if(c.treasury+effect.amount<0)throw Error('Недостаточно средств');c.treasury=money(c.treasury+effect.amount);}
    else c[key]=bounded((c[key]??0)+effect.amount,key==='politicalPower'?500:100);break;}
   case 'resource':if(effect.amount<0){if(stock(c,effect.resource)<-effect.amount)throw Error('Недостаточно ресурсов');payMaterials(c,{[effect.resource]:-effect.amount});}else addStock(c,effect.resource,effect.amount);break;
   case 'unlockFocus':if(!focusNode(effect.focusId))throw Error('Неизвестный национальный курс');c.eventUnlockedFocuses??=[];if(!c.eventUnlockedFocuses.includes(effect.focusId))c.eventUnlockedFocuses.push(effect.focusId);break;
   case 'decision':{const reason=decisionReason(s,c,effect.decisionId);if(reason)throw Error(reason);startDecision(s,c,effect.decisionId);break;}
   case 'relation':if(!x.counterpartId||!s.countries[x.counterpartId])throw Error('Участник переговоров недоступен');if(effect.amount>0&&warBetween(s,c.id,x.counterpartId))throw Error('Сначала завершите войну');break;
   case 'schedule':if(!eventDefinition(effect.eventId)||!Number.isSafeInteger(s.tick+effect.months))throw Error('Недопустимое продолжение события');break;
   case 'crisis':{const reason=crisisReason(s,c,x);if(reason)throw Error(reason);c.politicalPower!-=10;break;}
  }
 }
 return c;
}
export function eventOptionReason(s:GameState,x:EventInstance,optionId:string):string|null{
 const option=eventDefinition(x.eventId)?.options.find(o=>o.id===optionId);
 if(!option)return 'Неизвестное решение';
 if(!s.events?.pending.some(e=>e.id===x.id))return 'Событие уже завершено';
 try{preview(s,x,option);return null;}catch(error){return error instanceof Error?error.message:'Решение недоступно';}
}
function retainHistory(s:GameState,history:EventHistory):void{
 const rows=s.events!.history;rows.unshift(history);
 if(rows.length<=256)return;
 const humans=new Set(s.players.filter(p=>p.countryId&&!p.aiControlled).map(p=>p.countryId));
 const reserve=new Set(rows.filter(e=>humans.has(e.countryId)).slice(0,128).map(e=>e.id));
 for(const row of rows)if(reserve.size<256)reserve.add(row.id);s.events!.history=rows.filter(row=>reserve.has(row.id));
}
export function resolveGameEvent(s:GameState,countryId:string,instanceId:string,choiceId:string,automatic=false):void{
 const x=s.events?.pending.find(e=>e.id===instanceId&&e.countryId===countryId),definition=x&&eventDefinition(x.eventId),option=definition?.options.find(o=>o.id===choiceId);
 if(!x||!definition||!option||s.countries[countryId]?.eventReceipts?.[definition.id]?.resolvedTick!==undefined)throw Error('Событие уже завершено или не принадлежит стране');
 if(!automatic&&x.deadlineTick<=s.tick)throw Error('Время решения истекло');
 const updated=preview(s,x,option),c=s.countries[countryId]!;
 const receipt=updated.eventReceipts![definition.id]!;receipt.resolvedTick=s.tick;receipt.choiceId=option.id;
 // No operation that can fail follows the preflight. The authoritative reducer
 // still commits the whole command through the existing room version CAS.
 Object.assign(c,updated);s.events!.pending=s.events!.pending.filter(e=>e.id!==x.id);
 for(const effect of option.effects){
  if(effect.kind==='relation')relationChange(s,c.id,x.counterpartId!,'event:'+x.id,definition.title,effect.amount);
  if(effect.kind==='crisis'){c.politicalPower!+=10;openCrisis(s,c.id,x.counterpartId!,x.provinceId!,'Border',definition.title);}
  if(effect.kind==='schedule'&&!c.eventReceipts![effect.eventId]&&!s.events!.scheduled.some(q=>q.countryId===c.id&&q.eventId===effect.eventId))s.events!.scheduled.push({eventId:effect.eventId,countryId:c.id,dueTick:s.tick+effect.months,...x.counterpartId?{counterpartId:x.counterpartId}:{},...x.provinceId?{provinceId:x.provinceId}:{}});
 }
 retainHistory(s,{id:x.id,eventId:x.eventId,countryId:c.id,choiceId:option.id,tick:s.tick,automatic,...x.counterpartId?{counterpartId:x.counterpartId}:{},...x.provinceId?{provinceId:x.provinceId}:{}});
 notify(s,c.id,definition.category==='Diplomacy'?'Diplomacy':'Focus',definition.title+': '+option.title);
}
function startEvent(s:GameState,definition:EventDefinition,context:Context):void{
 const c=s.countries[context.countryId]!;if(c.eventReceipts![definition.id]||s.events!.pending.some(e=>e.countryId===c.id))return;
 if(!Number.isSafeInteger(s.nextEntityId)||s.nextEntityId!<1||s.nextEntityId!>=Number.MAX_SAFE_INTEGER||!Number.isSafeInteger(s.tick+definition.deadlineMonths))throw Error('Event sequence overflow');
 c.eventReceipts![definition.id]={startedTick:s.tick};
 s.events!.pending.push({id:'ev-'+s.nextEntityId!++,eventId:definition.id,createdTick:s.tick,deadlineTick:s.tick+definition.deadlineMonths,...context});
 if(s.players.some(p=>p.countryId===c.id&&!p.aiControlled))notify(s,c.id,definition.category==='Diplomacy'?'Diplomacy':'Focus','Требуется решение: '+definition.title,context.provinceId);
}
function automaticChoice(s:GameState,x:EventInstance):string{
 const definition=eventDefinition(x.eventId)!;
 return [...definition.options].sort((a,b)=>b.aiPriority-a.aiPriority||a.id.localeCompare(b.id)).find(o=>!eventOptionReason(s,x,o.id))?.id??definition.fallbackChoiceId;
}
/** One monthly pass, one pending choice per country, bounded histories and chains. */
export function monthlyGameEvents(s:GameState):void{
 if(!s.dataset||!s.events||s.events.lastTick===s.tick)return;
 if(s.events.lastTick>s.tick)throw Error('Event clock reversed');s.events.lastTick=s.tick;
 const humans=new Set(s.players.filter(p=>p.countryId&&!p.aiControlled).map(p=>p.countryId));
 for(const x of [...s.events.pending])if(x.deadlineTick<=s.tick||!humans.has(x.countryId))resolveGameEvent(s,x.countryId,x.id,x.deadlineTick<=s.tick?eventDefinition(x.eventId)!.fallbackChoiceId:automaticChoice(s,x),true);
 for(const scheduled of [...s.events.scheduled]){
  if(scheduled.dueTick>s.tick||s.events.pending.some(e=>e.countryId===scheduled.countryId))continue;
  s.events.scheduled=s.events.scheduled.filter(e=>e!==scheduled);const definition=eventDefinition(scheduled.eventId)!;
  if(s.countries[scheduled.countryId]?.provinceIds?.length)startEvent(s,definition,scheduled);
 }
 const claims=new Map<string,{counterpartId:string;provinceId:string}[]>();
 for(const p of s.provinces)if(p.originalOwnerId&&p.ownerId!==p.originalOwnerId){const rows=claims.get(p.originalOwnerId)??[];rows.push({counterpartId:p.ownerId,provinceId:p.id});claims.set(p.originalOwnerId,rows);}
 for(const c of Object.values(s.countries)){
  if(!c.provinceIds?.length||s.events.pending.some(e=>e.countryId===c.id)||s.events.scheduled.some(e=>e.countryId===c.id))continue;
  for(const definition of DOMINION_EVENTS){
   if(!definition.trigger||c.eventReceipts![definition.id]||s.year<definition.fromYear||s.year>definition.toYear)continue;
   let context:Context={countryId:c.id};
   if(definition.counterpart==='ClaimNeighbour'){
    const claim=claims.get(c.id)?.filter(x=>s.countries[x.counterpartId]?.provinceIds?.length).sort((a,b)=>a.provinceId.localeCompare(b.provinceId))[0];if(!claim)continue;context={...context,...claim};
   }
   if(definition.counterpart==='Ally'){
    const target=Object.values(s.diplomacy??{}).filter(l=>[l.a,l.b].includes(c.id)&&l.treaties.includes('Alliance')).map(l=>l.a===c.id?l.b:l.a).sort()[0];if(!target)continue;context.counterpartId=target;
   }
   if(eventCondition(s,context,definition.trigger)){startEvent(s,definition,context);break;}
  }
 }
 // NPC decisions can complete in this accounting phase. Human choices remain
 // explicit until their deterministic deadline, regardless of connection status.
 for(const x of [...s.events.pending])if(!humans.has(x.countryId))resolveGameEvent(s,x.countryId,x.id,automaticChoice(s,x),true);
}
export function initializeGameEvents(s:GameState,migrate:boolean):void{
 if(!s.dataset)return;
 if(migrate){s.events??={lastTick:s.tick,pending:[],scheduled:[],history:[]};for(const c of Object.values(s.countries)){c.eventReceipts??={};c.eventUnlockedFocuses??=[];}}
 const events=s.events;
 if(!events||!Number.isSafeInteger(events.lastTick)||events.lastTick<0||events.lastTick>s.tick||!Array.isArray(events.pending)||events.pending.length>300||!Array.isArray(events.scheduled)||events.scheduled.length>4096||!Array.isArray(events.history)||events.history.length>256)throw Error('Invalid campaign events');
 const ids=new Set<string>(),pendingCountries=new Set<string>();
 for(const x of events.pending){const d=eventDefinition(x.eventId),receipt=s.countries[x.countryId]?.eventReceipts?.[x.eventId];if(!d||!/^ev-\d+$/.test(x.id)||ids.has(x.id)||pendingCountries.has(x.countryId)||!receipt||receipt.startedTick!==x.createdTick||receipt.resolvedTick!==undefined||!Number.isSafeInteger(x.createdTick)||x.createdTick<0||x.createdTick>s.tick||x.deadlineTick!==x.createdTick+d.deadlineMonths||x.counterpartId&&!s.countries[x.counterpartId]||x.provinceId&&!s.provinces.some(p=>p.id===x.provinceId))throw Error('Invalid pending event');ids.add(x.id);pendingCountries.add(x.countryId);}
 const scheduled=new Set<string>();for(const x of events.scheduled){const key=x.countryId+':'+x.eventId;if(!eventDefinition(x.eventId)||!s.countries[x.countryId]||scheduled.has(key)||!Number.isSafeInteger(x.dueTick)||x.dueTick<0||x.counterpartId&&!s.countries[x.counterpartId]||x.provinceId&&!s.provinces.some(p=>p.id===x.provinceId))throw Error('Invalid scheduled event');scheduled.add(key);}
 for(const c of Object.values(s.countries)){
  if(!c.eventReceipts||typeof c.eventReceipts!=='object'||Array.isArray(c.eventReceipts)||Object.keys(c.eventReceipts).length>DOMINION_EVENTS.length||!Array.isArray(c.eventUnlockedFocuses)||new Set(c.eventUnlockedFocuses).size!==c.eventUnlockedFocuses.length||c.eventUnlockedFocuses.some(id=>!focusNode(id)))throw Error('Invalid country event state');
  for(const [id,r] of Object.entries(c.eventReceipts)){const d=eventDefinition(id);if(!d||!Number.isSafeInteger(r.startedTick)||r.startedTick<0||r.startedTick>s.tick||r.resolvedTick!==undefined&&(!Number.isSafeInteger(r.resolvedTick)||r.resolvedTick<r.startedTick||r.resolvedTick>s.tick||!d.options.some(o=>o.id===r.choiceId))||r.resolvedTick===undefined&&!events.pending.some(x=>x.countryId===c.id&&x.eventId===id))throw Error('Invalid event receipt');}
 }
 for(const h of events.history){const r=s.countries[h.countryId]?.eventReceipts?.[h.eventId];if(ids.has(h.id)||!r||r.resolvedTick!==h.tick||r.choiceId!==h.choiceId||typeof h.automatic!=='boolean')throw Error('Invalid event history');ids.add(h.id);}
}
export function eventEffectDescription(effect:EventEffect):string{
 switch(effect.kind){
  case 'metric':return ({stability:'Стабильность',unrest:'Недовольство',treasury:'Казна',warExhaustion:'Усталость от войны',reputation:'Репутация',politicalPower:'Политическая власть'})[effect.metric]+` ${effect.amount>=0?'+':''}${effect.amount}`;
  case 'resource':return `${RESOURCES[effect.resource].name}: ${effect.amount>=0?'+':''}${effect.amount}`;
  case 'unlockFocus':return 'Открывается курс: '+(focusNode(effect.focusId)?.name??effect.focusId);
  case 'decision':return 'Оплачиваемая государственная программа: '+POLITICAL_DECISIONS[effect.decisionId].name;
  case 'relation':return `Отношения ${effect.amount>=0?'+':''}${effect.amount}`;
  case 'schedule':return `Продолжение через ${effect.months} мес.`;
  case 'crisis':return 'Пограничный кризис по действующим дипломатическим правилам';
 }
}
