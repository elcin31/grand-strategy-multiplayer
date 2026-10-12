import {addStock} from './stockpileSystem.ts';
import {applySpirits,resolveFocusChoice} from './politicalDecisions.ts';
import {countryFor,type Country,type GameState} from './gameTypes.ts';
import {money} from './economySystem.ts';
import {hasTechnology} from './technologyTree.ts';
import {relationChange} from './diplomacy2System.ts';
import {warBetween} from './diplomacySystem.ts';
import {FOCUS_IDS,focusNode,focusBelongsTo,hasFocus,focusRewardLines,type FocusId,type FocusNode} from './focusCatalogue.ts';
export interface FocusEvent {id:string;countryId:string;focusId:FocusId;tick:number;kind:'Started'|'Completed'|'Cancelled'|'Aborted';message:string}
const bound=(n:number,max=100)=>Math.max(0,Math.min(max,n));
function prerequisites(c:Country,n:FocusNode):string|null{
 if(n.prerequisites.some(id=>!hasFocus(c,id)))return 'Сначала завершите предшествующий курс';
 if(n.eitherPrerequisites&&!n.eitherPrerequisites.some(id=>hasFocus(c,id)))return 'Нужно завершить одну из альтернативных программ';
 if(n.technologies?.some(id=>!hasTechnology(c,id)))return 'Нужны указанные научные открытия';
 if(n.exclusiveGroup&&c.completedFocuses?.some(f=>focusNode(f.focusId)!.exclusiveGroup===n.exclusiveGroup))return 'Уже выбрана взаимоисключающая программа';
 return null;
}
export function focusAvailability(s:GameState,id:string,focusId:string):string|null{
 const c=s.countries[id],n=focusNode(focusId);if(!c||!n||!focusBelongsTo(c,n))return 'Курс не доступен этой стране';
 if(!s.dataset||!['running','paused'].includes(s.phase)||!c.provinceIds?.length)return 'Нужна начатая действующая кампания';
 if(hasFocus(c,focusId))return 'Курс уже завершён';if(c.nationalFocus)return 'Национальный курс уже выполняется';
 const reason=prerequisites(c,n);if(reason)return reason;if(s.tick<(c.bankruptcyUntilTick??0))return 'Курс приостановлен после банкротства';
 if(c.treasury<n.cost||(c.politicalPower??0)<n.pp)return 'Недостаточно средств или политической силы';
 if(!Number.isSafeInteger(s.tick+n.duration))return 'National course date overflow';return null;
}
function event(s:GameState,countryId:string,focusId:FocusId,kind:FocusEvent['kind'],message:string):void{
 const seq=s.nextEntityId!;if(!Number.isSafeInteger(seq)||seq<1||seq>=Number.MAX_SAFE_INTEGER)throw Error('National course entity overflow');s.nextEntityId=seq+1;
 s.focusEvents!.unshift({id:'nf-'+s.id+'-'+seq,countryId,focusId,tick:s.tick,kind,message:message.slice(0,500)});
 // Reserve the player's actual events while bounding total AI history.
 const humans=new Set(s.players.filter(p=>!p.aiControlled&&p.countryId).map(p=>p.countryId)),reserve=new Set(s.focusEvents!.filter(e=>humans.has(e.countryId)).slice(0,128).map(e=>e.id));
 for(const e of s.focusEvents!)if(reserve.size<256)reserve.add(e.id);s.focusEvents=s.focusEvents!.filter(e=>reserve.has(e.id));
}
export function startFocus(s:GameState,countryId:string,id:FocusId):void{
 const reason=focusAvailability(s,countryId,id);if(reason)throw Error(reason);const c=countryFor(s,countryId),n=focusNode(id)!;
 c.treasury=money(c.treasury-n.cost);c.politicalPower!-=n.pp;c.nationalFocus={focusId:id,startedTick:s.tick,lastTick:s.tick,progress:0};event(s,countryId,id,'Started',`Начат национальный курс: ${n.name}`);
}
export function cancelFocus(s:GameState,countryId:string):void{
 const c=countryFor(s,countryId),p=c.nationalFocus;if(!p)throw Error('Нет действующего национального курса');delete c.nationalFocus;event(s,countryId,p.focusId,'Cancelled','Курс прерван. Оплаченные средства и выполненная работа не возвращаются.');
}
/** One monthly country pass. Completion ledger is appended before any rewards;
 * repeated calls, receipt retries or restored saves cannot pay twice. */
export function monthlyFocus(s:GameState):void{
 if(!s.dataset)return;let borders:Map<string,Set<string>>|undefined;
 function neighbours(id:string):Set<string>{if(!borders){borders=new Map();const provinces=new Map(s.provinces.map(p=>[p.id,p]));for(const p of s.provinces)for(const pid of p.neighbors){const to=provinces.get(pid)?.ownerId;if(to&&to!==p.ownerId){const row=borders.get(p.ownerId)??new Set<string>();row.add(to);borders.set(p.ownerId,row);}}}return borders.get(id)??new Set();}
 for(const c of Object.values(s.countries)){
  const p=c.nationalFocus;if(!p||p.lastTick===s.tick)continue;if(p.lastTick>s.tick)throw Error('National course clock reversed');
  if(!c.provinceIds?.length){delete c.nationalFocus;event(s,c.id,p.focusId,'Aborted','Программа прекращена после утраты территории.');continue;}
  const elapsed=s.tick-p.lastTick;p.lastTick=s.tick;if(s.tick<(c.bankruptcyUntilTick??0))continue;p.progress+=elapsed;
  const n=focusNode(p.focusId)!;if(p.progress<n.duration)continue;if(hasFocus(c,p.focusId))throw Error('Repeated national course reward');
  const r=n.rewards,cash=money(c.treasury+(r.treasury??0)),reserve=c.manpower+(r.manpower??0);if(!Number.isSafeInteger(reserve)||reserve<0)throw Error('National course manpower overflow');
  c.completedFocuses!.push({focusId:p.focusId,tick:s.tick});delete c.nationalFocus;
  c.treasury=cash;c.manpower=reserve;c.stability=bound(c.stability+(r.stability??0));c.unrest=bound((c.unrest??0)+(r.unrest??0));c.politicalPower=bound((c.politicalPower??0)+(r.politicalPower??0),500);c.diplomaticReputation=bound((c.diplomaticReputation??50)+(r.reputation??0));
  if(r.armyExperience)for(const a of s.armies)if(a.ownerId===c.id)a.experience=bound((a.experience??0)+r.armyExperience);
  if(r.neighborRelations)for(const target of neighbours(c.id))if(s.countries[target]?.provinceIds?.length&&!warBetween(s,c.id,target))relationChange(s,c.id,target,'focus:'+c.id+':'+p.focusId,n.name,r.neighborRelations);
  if(r.resources)for(const [resource,amount] of Object.entries(r.resources))addStock(c,resource as keyof typeof r.resources,amount!);applySpirits(c,r.addSpirits,r.removeSpirits);
  if(n.choiceEvent){s.focusChoices??=[];const id='choice-'+s.nextEntityId!;s.nextEntityId!++;s.focusChoices.unshift({id,countryId:c.id,focusId:p.focusId,createdTick:s.tick});s.focusChoices=s.focusChoices.slice(0,256);if(!s.players.some(p=>p.countryId===c.id&&!p.aiControlled))resolveFocusChoice(s,c,id,'Consensus');}
  event(s,c.id,p.focusId,'Completed',`${n.name}: ${focusRewardLines(p.focusId).join('; ')}.`);
 }
}
function minimumStart(c:Country,n:FocusNode):number{
 const tick=(id:string)=>c.completedFocuses!.find(f=>f.focusId===id)?.tick??0;
 return Math.max(0,...n.prerequisites.map(tick),...(n.eitherPrerequisites?[Math.min(...n.eitherPrerequisites.filter(id=>hasFocus(c,id)).map(tick))]:[]));
}
export function initializeFocuses(s:GameState,migrate:boolean):void{
 if(!s.dataset)return;if(migrate)s.focusEvents??=[];
 if(!Array.isArray(s.focusEvents)||s.focusEvents.length>256)throw Error('Invalid national course events');
 for(const c of Object.values(s.countries)){
  if(migrate)c.completedFocuses??=[];
  if(!Array.isArray(c.completedFocuses)||c.completedFocuses.length>FOCUS_IDS.length)throw Error('Invalid national course completions');
  const complete=new Set<string>(),groups=new Set<string>();let previous=-1;
  for(const f of c.completedFocuses){
   const n=f&&typeof f.focusId==='string'?focusNode(f.focusId):undefined;
   if(!n||Object.keys(f).some(k=>!['focusId','tick'].includes(k))||!focusBelongsTo(c,n)||complete.has(f.focusId)||!Number.isSafeInteger(f.tick)||f.tick<n.duration||f.tick>s.tick||f.tick<=previous||n.prerequisites.some(id=>!complete.has(id))||n.eitherPrerequisites&&!n.eitherPrerequisites.some(id=>complete.has(id))||n.technologies?.some(id=>!hasTechnology(c,id))||n.exclusiveGroup&&groups.has(n.exclusiveGroup))throw Error('Invalid national course completion');
   if(f.tick-n.duration<minimumStart(c,n))throw Error('Invalid national course completion timing');
   previous=f.tick;complete.add(f.focusId);if(n.exclusiveGroup)groups.add(n.exclusiveGroup);
  }
  const p=c.nationalFocus;if(p){
   const n=typeof p.focusId==='string'?focusNode(p.focusId):undefined;
   if(!n||Object.keys(p).some(k=>!['focusId','startedTick','lastTick','progress'].includes(k))||!focusBelongsTo(c,n)||complete.has(p.focusId)||prerequisites(c,n)||!Number.isSafeInteger(p.startedTick)||!Number.isSafeInteger(p.startedTick+n.duration)||p.startedTick<0||p.startedTick<previous||p.startedTick<minimumStart(c,n)||!Number.isSafeInteger(p.lastTick)||p.lastTick<p.startedTick||p.lastTick>s.tick||!Number.isSafeInteger(p.progress)||p.progress<0||p.progress>=n.duration||p.progress>p.lastTick-p.startedTick)throw Error('Invalid national course progress');
  }
 }
 const ids=new Set<string>(),completed=new Set<string>();let previous=s.tick;
 for(const e of s.focusEvents){
  const c=e&&s.countries[e.countryId],n=e&&typeof e.focusId==='string'?focusNode(e.focusId):undefined;
  if(!c||!n||!focusBelongsTo(c,n)||typeof e.id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(e.id)||ids.has(e.id)||!Number.isSafeInteger(e.tick)||e.tick<0||e.tick>previous||!['Started','Completed','Cancelled','Aborted'].includes(e.kind)||typeof e.message!=='string'||!e.message.length||e.message.length>500)throw Error('Invalid national course event');
  ids.add(e.id);previous=e.tick;
  if(e.kind==='Completed'){const key=c.id+':'+e.focusId;if(completed.has(key)||!c.completedFocuses!.some(f=>f.focusId===e.focusId&&f.tick===e.tick))throw Error('Repeated or orphaned national course event');completed.add(key);}
 }
}
