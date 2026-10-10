import type {Army,GameState} from './gameTypes.ts';
import {UNITS,UNIT_TYPES,type UnitType} from './unitCatalogue.ts';
export type Composition=Partial<Record<UnitType,number>>;
export function compositionTotal(parts:Composition):number{return Object.values(parts).reduce((n,v)=>n+v!,0);}
export function armyParts(a:Army):Composition{return a.composition??{[a.unitType??'Infantry']:a.troops};}
export function weightedTroops(a:Army):number{return UNIT_TYPES.reduce((n,t)=>n+(armyParts(a)[t]??0)*UNITS[t].upkeep,0);}
export function armyBaseUpkeep(a:Army):number{return weightedTroops(a)/1000*1.25;}
export function initializeArmyComposition(a:Army):void {
  a.composition??={[a.unitType??'Infantry']:a.troops};a.template??={...a.composition};a.experience??=0;a.supply??=100;a.lastSupplyTick??=0;a.reinforcementEnabled??=false;a.lastReinforcementTick??=-1;a.lastReinforcementCost??=0;a.retreatUntilTick??=0;
}
/** Proportional integer losses; remainders have deterministic catalogue order. */
export function takeArmyLosses(a:Army,requested:number):number {
  if(!Number.isSafeInteger(requested)||requested<0)throw Error('Invalid casualties');
  const loss=Math.min(a.troops,requested),old=a.troops;
  if(a.composition){let remaining=loss;const hits=UNIT_TYPES.map(t=>{const count=a.composition![t]??0,raw=count*loss/Math.max(1,old),hit=Math.floor(raw);remaining-=hit;return {t,count,hit,remainder:raw-hit};}).sort((a,b)=>b.remainder-a.remainder);
    for(const h of hits){if(remaining&&h.hit<h.count){h.hit++;remaining--;}const count=h.count-h.hit;if(count)a.composition[h.t]=count;else delete a.composition[h.t];}
    if(remaining!==0)throw Error('Casualty composition mismatch');
  }
  a.troops-=loss;return loss;
}
export function addArmyRegiment(a:Army,type:UnitType,troops:number,expandTemplate=true):void {
  if(!Number.isSafeInteger(a.troops+troops)||!Number.isSafeInteger(troops)||troops<1)throw Error('Army strength overflow');
  initializeArmyComposition(a);const old=a.troops;a.composition![type]=(a.composition![type]??0)+troops;
  if(expandTemplate)a.template![type]=(a.template![type]??0)+troops;
  a.troops+=troops;a.experience=(a.experience??0)*old/a.troops;
}
export function validateArmyComposition(s:GameState,migrate:boolean):void {
  if(!s.dataset)return;
  for(const a of s.armies){
    if(migrate)initializeArmyComposition(a);
    for(const parts of [a.composition,a.template]){
      if(!parts||typeof parts!=='object'||Array.isArray(parts)||Object.keys(parts).some(t=>!Object.hasOwn(UNITS,t))||Object.values(parts).some(n=>!Number.isSafeInteger(n)||n!<=0)||!Number.isSafeInteger(compositionTotal(parts)))throw Error('Invalid army composition');
    }
    if(compositionTotal(a.composition!)!==a.troops||UNIT_TYPES.some(t=>(a.composition![t]??0)>(a.template![t]??0))||compositionTotal(a.template!)<a.troops)throw Error('Invalid army template strength');
    if(![a.experience,a.supply].every(n=>Number.isFinite(n)&&n!>=0&&n!<=100)||typeof a.reinforcementEnabled!=='boolean'||!Number.isSafeInteger(a.lastSupplyTick)||a.lastSupplyTick!<0||a.lastSupplyTick!>s.tick||!Number.isSafeInteger(a.lastReinforcementTick)||a.lastReinforcementTick!< -1||a.lastReinforcementTick!>s.tick||!Number.isFinite(a.lastReinforcementCost)||a.lastReinforcementCost!<0||Math.round(a.lastReinforcementCost!*1000)/1000!==a.lastReinforcementCost||!Number.isSafeInteger(a.retreatUntilTick)||a.retreatUntilTick!<0||a.retreatUntilTick!>s.tick+2)throw Error('Invalid army readiness history');
  }
}
