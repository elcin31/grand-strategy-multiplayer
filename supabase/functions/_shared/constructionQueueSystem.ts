import {countryFor,type GameState,type Province,type BuildingType} from './gameTypes.ts';
import {BUILDINGS,buildingLevel,buildingQuote,buildingRequirementReason,startConstruction} from './buildingSystem.ts';
import {money} from './economySystem.ts';
export interface QueuedConstruction {id:string;ownerId:string;provinceId:string;buildingType:BuildingType;targetLevel:number;cost:number;buildTime:number;queuedTick:number}
export const MAX_PROVINCE_CONSTRUCTIONS=4;
export const MAX_COUNTRY_QUEUED_CONSTRUCTIONS=32;
export function queuedBuildingQuote(s:GameState,p:Province,type:BuildingType){
  const reserved=Number(s.constructions?.some(c=>c.provinceId===p.id&&c.buildingType===type))+(s.constructionQueue?.filter(c=>c.provinceId===p.id&&c.buildingType===type).length??0);
  return buildingQuote({...p,buildings:{...p.buildings,[type]:buildingLevel(p,type)+reserved}},type);
}
export function constructionQueueAvailability(s:GameState,owner:string,p:Province,type:BuildingType):string|null {
  if(!s.dataset||!['running','paused'].includes(s.phase))return 'Сначала начните кампанию';
  if(p.ownerId!==owner||(p.controllerId??p.ownerId)!==owner||p.rebellion)return 'Нужна своя контролируемая провинция';
  if((s.constructions?.filter(c=>c.provinceId===p.id).length??0)+(s.constructionQueue?.filter(c=>c.provinceId===p.id).length??0)>=MAX_PROVINCE_CONSTRUCTIONS)return 'В провинции допускаются 4 проекта, включая текущий';
  if((s.constructionQueue?.filter(c=>c.ownerId===owner).length??0)>=MAX_COUNTRY_QUEUED_CONSTRUCTIONS)return 'Очередь страны заполнена';
  const c=countryFor(s,owner);if(s.tick<(c.bankruptcyUntilTick??0))return 'Строительство недоступно после банкротства';
  try{const q=queuedBuildingQuote(s,p,type),reason=buildingRequirementReason(s,p,type,q.targetLevel);if(reason)return reason;if(c.treasury<q.cost)return 'Недостаточно средств';if(!Number.isSafeInteger(s.tick+q.buildTime))return 'Construction date overflow';}catch(e){return e instanceof Error?e.message:'Здание недоступно';}return null;
}
export function queueConstruction(s:GameState,owner:string,p:Province,type:BuildingType):void {
  const reason=constructionQueueAvailability(s,owner,p,type);if(reason)throw Error(reason);
  if(!s.constructions!.some(q=>q.provinceId===p.id)&&!s.constructionQueue!.some(q=>q.provinceId===p.id)){startConstruction(s,owner,p,type);return;}
  const q=queuedBuildingQuote(s,p,type),seq=s.nextEntityId!;if(!Number.isSafeInteger(seq)||seq<1||seq>=Number.MAX_SAFE_INTEGER)throw Error('Construction entity overflow');
  countryFor(s,owner).treasury=money(countryFor(s,owner).treasury-q.cost);s.nextEntityId=seq+1;
  s.constructionQueue!.push({id:'cq-'+s.id+'-'+seq,ownerId:owner,provinceId:p.id,buildingType:type,targetLevel:q.targetLevel,cost:q.cost,buildTime:q.buildTime,queuedTick:s.tick});
}
/** Existing active jobs finish first, then one waiting paid job per province
 * starts at this real tick. Occupation/rebellion cancels the contract; default
 * pauses waiting contracts, while already active paid work retains old timing. */
export function processConstructionQueue(s:GameState):void {
  if(!s.dataset||!s.constructionQueue?.length)return;
  const provinces=new Map(s.provinces.map(p=>[p.id,p])),active=new Set(s.constructions!.map(c=>c.provinceId)),remaining:QueuedConstruction[]=[];
  for(const q of s.constructionQueue){
    const p=provinces.get(q.provinceId);if(!p||p.ownerId!==q.ownerId||(p.controllerId??p.ownerId)!==q.ownerId||p.rebellion)continue;
    if(active.has(p.id)||s.tick<(s.countries[q.ownerId]!.bankruptcyUntilTick??0)||buildingRequirementReason(s,p,q.buildingType,q.targetLevel)){remaining.push(q);continue;}
    if(buildingLevel(p,q.buildingType)+1!==q.targetLevel)throw Error('Construction queue target changed');
    const end=s.tick+q.buildTime;if(!Number.isSafeInteger(end))throw Error('Construction date overflow');
    s.constructions!.push({id:q.id,ownerId:q.ownerId,provinceId:p.id,buildingType:q.buildingType,targetLevel:q.targetLevel,cost:q.cost,startedTick:s.tick,completeTick:end});active.add(p.id);
  }
  s.constructionQueue=remaining;
}
export function cancelConstruction(s:GameState,owner:string,id:string):void {
  const active=s.constructions!.find(c=>c.id===id&&c.ownerId===owner),queued=s.constructionQueue!.find(c=>c.id===id&&c.ownerId===owner),selected=active??queued;
  if(!selected)throw Error('Проект не найден');
  const affected=s.constructionQueue!.filter(q=>q.ownerId===owner&&q.provinceId===selected.provinceId&&q.buildingType===selected.buildingType&&q.targetLevel>=selected.targetLevel),remove=new Set(affected.map(q=>q.id));
  const refund=money(affected.reduce((n,q)=>n+q.cost*.5,0)+(active?active.cost*.5*Math.max(0,Math.min(1,(active.completeTick-s.tick)/(active.completeTick-active.startedTick))):0));
  const c=countryFor(s,owner),cash=money(c.treasury+refund);
  s.constructions=s.constructions!.filter(q=>q.id!==active?.id);s.constructionQueue=s.constructionQueue!.filter(q=>!remove.has(q.id));c.treasury=cash;
  processConstructionQueue(s);
}
export function initializeConstructionQueue(s:GameState,migrate:boolean):void {
  if(!s.dataset)return;if(migrate)s.constructionQueue??=[];
  if(!Array.isArray(s.constructionQueue)||s.constructionQueue.length>9000)throw Error('Invalid construction waiting queue');
  const ids=new Set(s.constructions!.map(c=>c.id)),provinces=new Map(s.provinces.map(p=>[p.id,p])),perProvince=new Map<string,number>(),perCountry=new Map<string,number>(),levels=new Map<string,number>();
  for(const q of s.constructions!){perProvince.set(q.provinceId,1);levels.set(q.provinceId+':'+q.buildingType,q.targetLevel);}
  for(const q of s.constructionQueue){
    if(!q||typeof q!=='object')throw Error('Invalid queued construction');
    const p=provinces.get(q.provinceId);if(!p||p.ownerId!==q.ownerId||!s.countries[q.ownerId]||typeof q.buildingType!=='string'||!Object.hasOwn(BUILDINGS,q.buildingType)||typeof q.id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(q.id)||ids.has(q.id)||!Number.isSafeInteger(q.queuedTick)||q.queuedTick<0||q.queuedTick>s.tick)throw Error('Invalid queued construction');
    ids.add(q.id);const count=(perProvince.get(q.provinceId)??0)+1,owned=(perCountry.get(q.ownerId)??0)+1;if(count>MAX_PROVINCE_CONSTRUCTIONS||owned>MAX_COUNTRY_QUEUED_CONSTRUCTIONS)throw Error('Construction queue capacity exceeded');perProvince.set(q.provinceId,count);perCountry.set(q.ownerId,owned);
    const key=p.id+':'+q.buildingType,current=levels.get(key)??buildingLevel(p,q.buildingType),quote=buildingQuote({...p,buildings:{...p.buildings,[q.buildingType]:current}},q.buildingType);
    if(q.targetLevel!==quote.targetLevel||q.cost!==quote.cost||q.buildTime!==quote.buildTime)throw Error('Invalid queued construction quote');levels.set(key,q.targetLevel);
  }
}
