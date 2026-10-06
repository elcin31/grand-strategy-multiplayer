import type {GameState} from '../types/game';
import {applyCommand} from '../../supabase/functions/_shared/gameEngine';
/** Detached measurement fixture: never mutate or submit commands to the active campaign. */
export function prepareBenchmarkState(state:GameState):GameState{const copy=structuredClone(state);copy.phase='running';copy.speed=1;return copy;}
export function advanceBenchmark(state:GameState):GameState{const next=applyCommand(state,{type:'ADVANCE_TICK'});if(next.tick!==state.tick+1)throw new Error('Benchmark simulation did not advance');return next;}
