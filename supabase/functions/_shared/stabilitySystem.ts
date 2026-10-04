import type { GameState, Province } from './gameTypes.ts';
import { governmentModifiers } from './governmentSystem.ts';
import { combatMultiplier } from './militarySystem.ts';
import { money } from './economySystem.ts';
export interface Rebellion { strength:number; startedTick:number; lastBattleTick:number }
export interface RebellionEvent { provinceId:string; tick:number; kind:'Uprising'|'Suppressed'; armyLosses:number; rebelLosses:number }
const bounded=(n:number)=>Math.max(0,Math.min(100,n));
export function initializeStability(state:GameState):void {
  if(!state.dataset)return;
  state.rebellionLog??=[];
  if(!Array.isArray(state.rebellionLog)||state.rebellionLog.length>20)throw new Error('Invalid rebellion history');
  for(const p of state.provinces){
    p.rebellionCooldownUntilTick??=0;
    if(!Number.isSafeInteger(p.rebellionCooldownUntilTick)||p.rebellionCooldownUntilTick<0)throw new Error('Invalid rebellion cooldown');
    if(p.rebellion){const r=p.rebellion;if(!Number.isSafeInteger(r.strength)||r.strength<1||r.strength>50000||!Number.isSafeInteger(r.startedTick)||r.startedTick<0||r.startedTick>state.tick||!Number.isSafeInteger(r.lastBattleTick)||r.lastBattleTick< -1||r.lastBattleTick>state.tick)throw new Error('Invalid rebellion');}
  }
}
export function unrestPressure(state:GameState,p:Province):number {
  const c=state.countries[p.ownerId]!;
  const war=state.wars?.some(w=>w.attackers.includes(c.id)||w.defenders.includes(c.id));
  // Taxes and religion already contribute in their monthly systems. Here those
  // persistent national pressures combine with government, occupation and war.
  return (war?.08:0)+(c.warExhaustion??0)*.005+((p.controllerId??p.ownerId)!==p.ownerId?.35:0)+(state.tick<(c.bankruptcyUntilTick??0)?.25:0)+(c.unrest??0)*.002+Math.max(0,50-c.stability)*.008+governmentModifiers(c.governmentType).unrestPerYear/12-.15;
}
function log(state:GameState,e:RebellionEvent){state.rebellionLog!.unshift(e);state.rebellionLog=state.rebellionLog!.slice(0,20);}
export function suppressRebellion(state:GameState,countryId:string,province:Province):void {
  const r=province.rebellion;
  if(!r||(province.controllerId??province.ownerId)!==countryId||r.lastBattleTick===state.tick)throw new Error('Подавление сейчас недоступно');
  const armies=state.armies.filter(a=>a.ownerId===countryId&&a.provinceId===province.id);
  if(!armies.length)throw new Error('В провинции нужен гарнизон');
  const troops=armies.reduce((n,a)=>n+a.troops,0),power=armies.reduce((n,a)=>n+a.troops*combatMultiplier(state,a,province,true),0);
  const strength=r.strength,rebelLosses=Math.min(strength,Math.max(1,Math.floor(power*.55))),armyLosses=Math.min(troops,Math.max(1,Math.floor(strength*.3)));
  let remaining=armyLosses;
  for(const a of armies){const loss=Math.min(a.troops,remaining);a.troops-=loss;remaining-=loss;a.morale=Math.max(0,(a.morale??80)-5);a.organization=Math.max(0,(a.organization??80)-10);}
  state.armies=state.armies.filter(a=>a.troops>0);r.strength-=rebelLosses;r.lastBattleTick=state.tick;
  if(r.strength<=0){delete province.rebellion;province.unrest=Math.min(40,province.unrest!);province.rebellionCooldownUntilTick=state.tick+24;log(state,{provinceId:province.id,tick:state.tick,kind:'Suppressed',armyLosses,rebelLosses});}
}
export function pacifyProvince(state:GameState,countryId:string,p:Province):void {
  const c=state.countries[countryId]!;
  if(p.ownerId!==countryId||(p.controllerId??p.ownerId)!==countryId||p.rebellion)throw new Error('Сначала восстановите контроль и подавите восстание');
  if(c.treasury<50||c.politicalPower!<10||p.unrest!<1)throw new Error('Нужно 50M и 10 PP, провинция должна иметь unrest');
  c.treasury=money(c.treasury-50);c.politicalPower!-=10;p.unrest=Math.max(0,p.unrest!-15);
}
export function monthlyStability(state:GameState):void {
  if(!state.dataset)return;
  for(const c of Object.values(state.countries)){
    c.stability=bounded(c.stability-(c.warExhaustion??0)*.003);
    c.unrest=bounded(c.unrest!+(c.warExhaustion??0)*.002-.03);
  }
  for(const p of state.provinces){
    p.unrest=bounded(p.unrest!+unrestPressure(state,p));
    if(!p.rebellion && p.unrest>=85 && p.population>=2000 && state.tick>=p.rebellionCooldownUntilTick!){
      const strength=Math.min(50000,Math.max(500,Math.floor(p.population*.004)));
      p.rebellion={strength,startedTick:state.tick,lastBattleTick:-1};
      state.constructions=state.constructions?.filter(c=>c.provinceId!==p.id);
      state.countries[p.ownerId]!.stability=bounded(state.countries[p.ownerId]!.stability-2);
      log(state,{provinceId:p.id,tick:state.tick,kind:'Uprising',armyLosses:0,rebelLosses:0});
    }
    if(p.rebellion){
      p.rebellion.strength=Math.min(50000,Math.max(1,Math.floor(p.rebellion.strength*1.02)));
      const controller=p.controllerId??p.ownerId;
      if(p.rebellion.lastBattleTick!==state.tick&&state.armies.some(a=>a.provinceId===p.id&&a.ownerId===controller))suppressRebellion(state,controller,p);
    }
  }
}
