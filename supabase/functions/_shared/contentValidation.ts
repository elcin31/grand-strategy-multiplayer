import type {ScenarioPack} from './scenarioTypes.ts';
import type {EventDefinition} from './eventTypes.ts';
import {countryDefinitions,provinceDefinitions} from './worldDefinitions.ts';
import {FOCUS_NODES} from './focusCatalogue.ts';
import {DOMINION_EVENTS} from './eventCatalogue.ts';
import {GOVERNMENT_TYPES} from './governmentSystem.ts';
import {RESOURCES} from './resourceCatalogue.ts';
import {UNITS} from './unitCatalogue.ts';
import {TECHNOLOGY_IDS,technologyNode} from './technologyTree.ts';
import {POLITICAL_DECISIONS} from './politicalDecisions.ts';
import {TREATIES,pairKey} from './diplomacySystem.ts';
import {BUILDING_TYPES} from './buildingSystem.ts';

const countries=new Set(countryDefinitions.map(c=>c.id)),provinces=new Set(provinceDefinitions.map(p=>p.id));
const ID=/^[a-z][a-z0-9-]{0,63}$/;
function object(value:unknown,allowed:readonly string[],required:readonly string[]=allowed):asserts value is Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(value,k)))throw Error('Invalid content object/fields');
}
function id(value:unknown):asserts value is string{if(typeof value!=='string'||!ID.test(value))throw Error('Invalid content ID');}
function number(value:unknown,min:number,max:number,integer=false):asserts value is number{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||integer&&!Number.isSafeInteger(value))throw Error('Invalid content number');}
function text(value:unknown,max=1000):void{if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f]/.test(value))throw Error('Invalid content text');}
function list<T>(value:readonly T[],max:number):void;
function list(value:unknown,max:number):asserts value is unknown[];
function list(value:unknown,max:number):void{if(!Array.isArray(value)||value.length>max)throw Error('Invalid content list');}
function reference(value:unknown,set:ReadonlySet<string>):void{if(typeof value!=='string'||!set.has(value))throw Error('Unknown content reference: '+String(value));}
function unique<T>(rows:readonly T[],key:(row:T)=>string):void{if(new Set(rows.map(key)).size!==rows.length)throw Error('Duplicate content ID');}
function resources(value:unknown):void{object(value,Object.keys(RESOURCES),[]);for(const n of Object.values(value))number(n,0,1000000);}
const metrics=new Set(['stability','unrest','treasury','debt','budgetBalance','warExhaustion','reputation','politicalPower']);
const comparisons=new Set(['lt','lte','eq','gte','gt']);
interface References {events:Map<string,EventDefinition>;focuses:Set<string>}
function condition(value:unknown,refs:References,depth=0):void{
 if(depth>6)throw Error('Content condition too deep');object(value,['kind','conditions','condition','metric','op','value','fromYear','toYear','active','resource','amount','target','provinceId','owner','id','eventId','choiceId','months','minimum'],['kind']);
 switch(value.kind){
  case 'all':case 'any':object(value,['kind','conditions']);list(value.conditions,32);if(!value.conditions.length)throw Error('Empty condition');for(const child of value.conditions)condition(child,refs,depth+1);break;
  case 'not':object(value,['kind','condition']);condition(value.condition,refs,depth+1);break;
  case 'metric':object(value,['kind','metric','op','value']);reference(value.metric,metrics);reference(value.op,comparisons);number(value.value,-1000000,1000000);break;
  case 'date':object(value,['kind','fromYear','toYear']);number(value.fromYear,1,9999,true);number(value.toYear,Number(value.fromYear),9999,true);break;
  case 'government':object(value,['kind','value']);reference(value.value,new Set(GOVERNMENT_TYPES));break;
  case 'war':object(value,['kind','active']);if(typeof value.active!=='boolean')throw Error('Invalid war condition');break;
  case 'resource':object(value,['kind','resource','amount']);reference(value.resource,new Set(Object.keys(RESOURCES)));number(value.amount,0,1000000);break;
  case 'relation':object(value,['kind','target','op','value']);reference(value.target,new Set([...countries,'counterpart']));reference(value.op,comparisons);number(value.value,-100,100);break;
  case 'province':object(value,['kind','provinceId','owner']);reference(value.provinceId,provinces);reference(value.owner,new Set([...countries,'self']));break;
  case 'technology':object(value,['kind','id']);reference(value.id,new Set(TECHNOLOGY_IDS));break;
  case 'focus':object(value,['kind','id']);reference(value.id,refs.focuses);break;
  case 'result':object(value,['kind','eventId','choiceId'],['kind','eventId']);reference(value.eventId,new Set(refs.events.keys()));if(value.choiceId!==undefined&&!refs.events.get(String(value.eventId))!.options.some(o=>o.id===value.choiceId))throw Error('Unknown event result');break;
  case 'after':object(value,['kind','eventId','months']);reference(value.eventId,new Set(refs.events.keys()));number(value.months,1,120,true);break;
  case 'recentPeace':object(value,['kind','months']);number(value.months,1,120,true);break;
  case 'damaged':object(value,['kind','minimum']);number(value.minimum,1,10000,true);break;
  default:throw Error('Unregistered event condition');
 }
}
function effect(value:unknown,refs:References):void{
 object(value,['kind','metric','amount','resource','focusId','decisionId','eventId','months'],['kind']);
 switch(value.kind){
  case 'metric':object(value,['kind','metric','amount']);reference(value.metric,new Set([...metrics].filter(m=>m!=='budgetBalance'&&m!=='debt')));number(value.amount,value.metric==='treasury'?-1000000:-100,value.metric==='treasury'?1000000:100);break;
  case 'resource':object(value,['kind','resource','amount']);reference(value.resource,new Set(Object.keys(RESOURCES)));number(value.amount,-100000,100000);break;
  case 'relation':object(value,['kind','amount']);number(value.amount,-100,100);break;
  case 'unlockFocus':object(value,['kind','focusId']);reference(value.focusId,refs.focuses);break;
  case 'decision':object(value,['kind','decisionId']);reference(value.decisionId,new Set(Object.keys(POLITICAL_DECISIONS)));break;
  case 'schedule':object(value,['kind','eventId','months']);reference(value.eventId,new Set(refs.events.keys()));number(value.months,1,120,true);break;
  case 'crisis':object(value,['kind']);break;
  default:throw Error('Unregistered event effect');
 }
}
export function validateEventDefinitions(definitions:readonly EventDefinition[],focusIds:ReadonlySet<string>,base:readonly EventDefinition[]=[]):void{
 list(definitions,128);unique(definitions,d=>d.id);if(definitions.some(d=>base.some(b=>b.id===d.id)))throw Error('Conflicting event definition');const refs:References={events:new Map([...base,...definitions].map(d=>[d.id,d])),focuses:new Set(focusIds)};
 for(const d of definitions){
  object(d,['id','scenarioId','title','description','category','illustration','trigger','counterpart','fromYear','toYear','deadlineMonths','options','fallbackChoiceId'],['id','title','description','category','illustration','fromYear','toYear','deadlineMonths','options','fallbackChoiceId']);id(d.id);text(d.title,120);text(d.description,1200);reference(d.category,new Set(['Economy','Diplomacy','Reform','Recovery']));reference(d.illustration,new Set(['Economy','Diplomacy','Reform','Recovery']));
  number(d.fromYear,1,9999,true);number(d.toYear,d.fromYear,9999,true);number(d.deadlineMonths,1,24,true);if(d.counterpart!==undefined)reference(d.counterpart,new Set(['ClaimNeighbour','Ally']));if(d.trigger)condition(d.trigger,refs);
  list(d.options,6);if(d.options.length<2)throw Error('Event needs two choices');unique(d.options,o=>o.id);
  for(const o of d.options){object(o,['id','title','description','cost','condition','effects','aiPriority'],['id','title','description','effects','aiPriority']);id(o.id);text(o.title,120);text(o.description,1000);number(o.aiPriority,0,100,true);if(o.cost){object(o.cost,['treasury','politicalPower','resources'],[]);if(o.cost.treasury!==undefined)number(o.cost.treasury,0,1000000);if(o.cost.politicalPower!==undefined)number(o.cost.politicalPower,0,500);if(o.cost.resources)resources(o.cost.resources);}if(o.condition)condition(o.condition,refs);list(o.effects,16);for(const e of o.effects)effect(e,refs);}
  const fallback=d.options.find(o=>o.id===d.fallbackChoiceId);if(!fallback||fallback.condition||fallback.cost&&Object.values(fallback.cost).some(v=>typeof v==='object'?Object.values(v).some(n=>n!==0):v!==0)||fallback.effects.some(e=>['decision','crisis','resource'].includes(e.kind)||e.kind==='metric'&&e.metric==='treasury'&&e.amount<0||e.kind==='relation'&&e.amount>0))throw Error('Event fallback must remain affordable');
 }
 // Chained events are finite. A receipt is also persisted before every effect.
 const done=new Set<string>(),visiting=new Set<string>();const visit=(key:string)=>{if(visiting.has(key))throw Error('Cyclic event chain');if(done.has(key))return;visiting.add(key);for(const o of refs.events.get(key)?.options??[])for(const e of o.effects)if(e.kind==='schedule')visit(e.eventId);visiting.delete(key);done.add(key);};for(const d of definitions)visit(d.id);
}
export function validateScenarioPack(input:unknown):asserts input is ScenarioPack{
 object(input,['schemaVersion','id','version','name','description','geography','startDate','countries','provinceOwners','armyMode','armies','relations','events','focuses']);if(input.schemaVersion!==1||input.geography!=='modern-world-v2')throw Error('Unsupported content schema/geography');id(input.id);number(input.version,1,10000,true);text(input.name,120);text(input.description,1200);
 object(input.startDate,['year','month','day']);number(input.startDate.year,1,9999,true);number(input.startDate.month,1,12,true);const year=Number(input.startDate.year),month=Number(input.startDate.month),days=month===2?(year%4===0&&(year%100!==0||year%400===0)?29:28):[4,6,9,11].includes(month)?30:31;number(input.startDate.day,1,days,true);
 for(const key of ['countries','provinceOwners','armies','relations','events','focuses'])list(input[key],key==='provinceOwners'?10000:key==='armies'?1000:300);
 const pack=input as unknown as ScenarioPack;
 unique(pack.countries,c=>c.id);for(const c of pack.countries){object(c,['id','treasury','manpower','governmentType','technologies','discoveries','resources'],['id']);reference(c.id,countries);if(c.treasury!==undefined)number(c.treasury,0,1000000);if(c.manpower!==undefined)number(c.manpower,0,1000000000,true);if(c.governmentType!==undefined)reference(c.governmentType,new Set(GOVERNMENT_TYPES));if(c.technologies){object(c.technologies,['Economy','Industry','Military','Administration','Diplomacy'],[]);for(const n of Object.values(c.technologies))number(n,0,5,true);}if(c.discoveries){list(c.discoveries,100);unique(c.discoveries,n=>n);for(const discovery of c.discoveries){reference(discovery,new Set(TECHNOLOGY_IDS));if(technologyNode(discovery)!.legacy)throw Error('Named discoveries only');}}if(c.resources)resources(c.resources);}
 unique(pack.provinceOwners,p=>p.provinceId);for(const p of pack.provinceOwners){object(p,['provinceId','ownerId','originalOwnerId','buildingDamage'],['provinceId','ownerId']);reference(p.provinceId,provinces);reference(p.ownerId,countries);if(p.originalOwnerId!==undefined)reference(p.originalOwnerId,countries);if(p.buildingDamage!==undefined)number(p.buildingDamage,0,1);}
 reference(pack.armyMode,new Set(['inherit','replace']));unique(pack.armies,a=>a.id);for(const a of pack.armies){object(a,['id','ownerId','provinceId','composition']);id(a.id);reference(a.ownerId,countries);reference(a.provinceId,provinces);object(a.composition,Object.keys(UNITS),[]);if(!Object.keys(a.composition).length)throw Error('Empty army');let troops=0;for(const n of Object.values(a.composition)){number(n,1,10000000,true);troops+=n;}number(troops,1,10000000,true);}
 unique(pack.relations,r=>pairKey(r.a,r.b));for(const r of pack.relations){object(r,['a','b','relation','trust','treaties']);reference(r.a,countries);reference(r.b,countries);if(r.a===r.b)throw Error('Self diplomacy');number(r.relation,-100,100);number(r.trust,0,100);list(r.treaties,10);unique(r.treaties,t=>t);for(const t of r.treaties)reference(t,new Set(Object.keys(TREATIES)));}
 unique(pack.focuses,f=>f.id);const focusRows=new Map(Object.entries(FOCUS_NODES).filter(([,n])=>!n.scenarioId));
 for(const f of pack.focuses){object(f,['id','scenarioId','name','description','branch','category','duration','cost','pp','prerequisites','eitherPrerequisites','technologies','exclusiveGroup','rewards','art','eventUnlock'],['id','scenarioId','name','description','branch','category','duration','cost','pp','prerequisites','rewards','art']);id(f.id);if(f.scenarioId!==pack.id||focusRows.has(f.id))throw Error('Conflicting focus definition');text(f.name,120);text(f.description,1200);reference(f.branch,new Set(['Economic','Military','Diplomatic','Political']));if(f.category!=='Generic')throw Error('Custom focus category unsupported');number(f.duration,1,120,true);number(f.cost,0,1000000);number(f.pp,0,500,true);reference(f.art,new Set(BUILDING_TYPES));list(f.prerequisites,12);if(f.eitherPrerequisites)list(f.eitherPrerequisites,12);if(f.technologies)for(const t of f.technologies)reference(t,new Set(TECHNOLOGY_IDS));if(f.eventUnlock!==undefined&&typeof f.eventUnlock!=='boolean')throw Error('Invalid focus unlock');object(f.rewards,['treasury','manpower','stability','unrest','politicalPower','reputation','neighborRelations','armyExperience','bonuses','resources','addSpirits','removeSpirits'],[]);for(const [key,value] of Object.entries(f.rewards)){if(key==='bonuses'){object(value,['tax','production','trade','administration','armyUpkeep','research','construction','supply','combat','manpower','diplomacy'],[]);for(const n of Object.values(value))number(n,-.1,.1);}else if(key==='resources')resources(value);else if(key==='addSpirits'||key==='removeSpirits')throw Error('Custom national spirits unsupported');else number(value,-100000,100000);}focusRows.set(f.id,f);}
 const done=new Set<string>(),active=new Set<string>();const visit=(key:string)=>{if(active.has(key))throw Error('Cyclic focus graph');if(done.has(key))return;const row=focusRows.get(key);if(!row)throw Error('Unknown focus prerequisite');active.add(key);for(const p of [...row.prerequisites,...row.eitherPrerequisites??[]])visit(p);active.delete(key);done.add(key);};for(const f of pack.focuses)visit(f.id);
 if(pack.events.some(e=>e.scenarioId!==pack.id))throw Error('Invalid event scenario scope');
 validateEventDefinitions(pack.events,new Set(focusRows.keys()),DOMINION_EVENTS.filter(e=>!e.scenarioId));
}
