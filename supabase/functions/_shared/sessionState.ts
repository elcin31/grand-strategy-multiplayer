import type { GameState } from './gameTypes.ts';
import { applyCommand } from './gameEngine.ts';
export const DISCONNECTED_MS=20000, AI_TIMEOUT_MS=60000;
export interface Presence {id:string;last_seen:string}
export function applyPresence(state:GameState,members:Presence[],now:number):boolean {
 let changed=false;const byId=new Map(members.map(m=>[m.id,Date.parse(m.last_seen)]));
 for(const p of state.players){const last=byId.get(p.id)??0,connected=now-last<DISCONNECTED_MS,aiControlled=now-last>=AI_TIMEOUT_MS;
 if(p.connected!==connected||p.aiControlled!==aiControlled){changed=true;p.connected=connected;p.aiControlled=aiControlled;p.lastSeen=last;}
 }
 const host=state.players.find(p=>p.isHost);if(!host||host.aiControlled){const successor=state.players.filter(p=>p.connected).sort((a,b)=>a.id.localeCompare(b.id))[0];if(successor&&successor.id!==host?.id){for(const p of state.players)p.isHost=p.id===successor.id;changed=true;}}
 return changed;
}
/** Any authenticated member can drive the server clock. No caller can select tick count or speed. Long offline gaps are bounded. */
export function pumpClock(state:GameState,clockAt:number,now:number):{state:GameState;clockAt:number;ticks:number} {
 const delay=Math.max(650,2600/Math.max(1,state.speed));
 if(state.phase!=='running'||!state.speed||!state.players.some(p=>p.connected))return{state,clockAt:now,ticks:0};
 const count=Math.max(0,Math.min(3,Math.floor((now-clockAt)/delay)));let next=state;
 for(let i=0;i<count;i++)next=applyCommand(next,{type:'ADVANCE_TICK'});
 return{state:next,clockAt:count?now:clockAt,ticks:count};
}
export function stateChecksum(state:GameState):string {const text=JSON.stringify(state);let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return(h>>>0).toString(16).padStart(8,'0');}
export function assertEnvelope(body:Record<string,unknown>):void {
 if(typeof body.commandId!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(body.commandId)||!Number.isSafeInteger(body.expectedVersion)||Number(body.expectedVersion)<0)throw new Error('commandId and expectedVersion required');
}
