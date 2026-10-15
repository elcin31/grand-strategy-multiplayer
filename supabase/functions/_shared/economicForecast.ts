import type {GameState} from './gameTypes.ts';
import {BUILDINGS,buildingRequirementReason,buildingQuote,constructionProgress} from './buildingSystem.ts';
import {queueConstruction,constructionQueueAvailability} from './constructionQueueSystem.ts';
import {assertGameCommand} from './commandValidation.ts';
import {RESOURCE_TYPES} from './resourceCatalogue.ts';
import {money} from './economySystem.ts';
import {notify} from './notificationSystem.ts';

/** Uses the real current budget and recorded resource flows. It is a conditional
 * estimate: no world clone, simulation step, command, cache or renderer hook. */
export function economicForecast(s:GameState,countryId:string,months=6){
 const c=s.countries[countryId];if(!c||!Number.isSafeInteger(months)||months<1||months>24)throw Error('Invalid forecast');
 const budget=c.economy,balance=budget?.monthlyBalance??0,stockpile=c.stockpile;
 const projects=(s.constructions??[]).filter(p=>p.ownerId===countryId).map(p=>({id:p.id,paidCost:p.cost,remainingMonths:constructionProgress(s,p).months,additionalUpkeep:BUILDINGS[p.buildingType].maintenance}));
 let cash=c.treasury;const timeline=[];
 for(let n=1;n<=months;n++){const additionalUpkeep=projects.filter(p=>p.remainingMonths<=n).reduce((sum,p)=>sum+p.additionalUpkeep,0),net=money(balance-additionalUpkeep);cash=money(Math.max(0,cash+net));timeline.push({month:n,balance:net,treasury:cash});}
 const resources=RESOURCE_TYPES.map(resource=>{
  const reserve=stockpile?.amounts[resource]??0,produced=stockpile?.produced[resource]??0,imported=stockpile?.imported?.[resource]??0,exported=stockpile?.exported?.[resource]??0;
  const demand=(stockpile?.consumed[resource]??0)+(stockpile?.deficits[resource]??0),net=money(produced+imported-demand),domesticDemand=Math.max(0,demand-exported);
  const declineWithoutImports=domesticDemand-produced;
  return {resource,reserve,produced,imported,exported,net,importDependency:imported/Math.max(.001,produced+imported),monthsRemaining:net<0?reserve/-net:null,monthsWithoutImports:declineWithoutImports>0?reserve/declineWithoutImports:null};
 }).filter(r=>r.reserve||r.produced||r.imported||r.net);
 return {estimated:true as const,basedOnTick:stockpile?.lastTick??s.tick,monthlyBalance:balance,armyMaintenance:budget?.armyMaintenance??0,prepaidConstruction:projects.reduce((n,p)=>n+p.paidCost,0),projects,timeline,resources,
  assumptions:['Текущая политика, армия, цены и потоки последнего периода сохраняются.','Будущие войны, решения, займы и доход новых зданий не предсказаны.','Оплаченные стройки не списываются повторно; их содержание учтено после ожидаемого завершения.','Расход ресурсов включает разовые строительные и военные закупки периода.']};
}
/** Opt-in automation issues the same validated, server-priced queue operation
 * as a player. At most one construction per human country/accounting period. */
export function monthlyConstructionAutomation(s:GameState):void{
 if(!s.dataset||s.phase!=='running')return;
 for(const player of s.players){
  if(!player.countryId||player.aiControlled)continue;const c=s.countries[player.countryId]!,v=c.stockpile;
  if(!v?.autoBuild||v.autoBuildTick===s.tick)continue;v.autoBuildTick=s.tick;
  if(s.constructions?.some(p=>p.ownerId===c.id)||s.constructionQueue?.some(p=>p.ownerId===c.id)||s.tick<(c.bankruptcyUntilTick??0))continue;
  const reserve=Math.max(200,((c.economy?.armyMaintenance??0)+(c.economy?.buildingMaintenance??0)+(c.economy?.interest??0))*6);
  const candidates=s.provinces.filter(p=>p.ownerId===c.id&&(p.controllerId??p.ownerId)===c.id&&!p.rebellion).sort((a,b)=>b.income-a.income||a.id.localeCompare(b.id));
  const types:('Farm'|'Infrastructure'|'Factory')[]=v.deficits.food?['Farm','Infrastructure','Factory']:['Infrastructure','Factory','Farm'];
  let done=false;
  for(const p of candidates.slice(0,12)){for(const buildingType of types){
   const quote=buildingQuote(p,buildingType);if(c.treasury-quote.cost<reserve||(c.economy?.monthlyBalance??0)<BUILDINGS[buildingType].maintenance*3||buildingRequirementReason(s,p,buildingType)||constructionQueueAvailability(s,c.id,p,buildingType))continue;
   const command={type:'QUEUE_BUILD' as const,playerId:player.id,provinceId:p.id,buildingType};assertGameCommand(command,Object.keys(s.countries));
   queueConstruction(s,c.id,p,buildingType);notify(s,c.id,'Construction','Автоматизация: '+BUILDINGS[buildingType].name,p.id);done=true;break;
  }if(done)break;}
 }
}
