import assert from 'node:assert/strict';
import type {GameState} from '../../supabase/functions/_shared/gameTypes';
import {applyCommand} from '../../supabase/functions/_shared/gameEngine';
import {cloneGameState} from '../../supabase/functions/_shared/cloneGameState';
/** Advance real daily travel/combat instead of expecting MOVE_ARMY to teleport. */
export function completeDailyMarch(input:GameState,armyId:string,maxDays=365):GameState{
 let s=cloneGameState(input);const phase=s.phase,speed=s.speed;s.phase='running';s.speed=1;
 for(let day=0;day<maxDays;day++){
  const a=s.armies.find(a=>a.id===armyId),busy=s.activeBattles?.some(b=>b.attackerArmyIds.includes(armyId)||b.defenderArmyIds.includes(armyId))||s.sieges?.some(x=>x.armyIds.includes(armyId));
  if(!a||!a.order&&!busy){s.phase=phase;s.speed=speed;return s;}
  s=applyCommand(s,{type:'ADVANCE_DAY'},true);
 }
 assert.fail('Daily travel/combat did not finish within the scenario bound');
}
