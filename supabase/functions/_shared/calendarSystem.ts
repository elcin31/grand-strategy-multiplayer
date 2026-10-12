import type {GameState,GameSpeed} from './gameTypes.ts';
export const DAY_DELAYS:Record<Exclude<GameSpeed,0>,number>={1:1200,2:750,3:450,4:280,5:160};
export function dayDelay(speed:GameSpeed):number{return speed?DAY_DELAYS[speed]:DAY_DELAYS[1];}
export function monthDays(year:number,month:number):number{return month===2?(year%4===0&&(year%100!==0||year%400===0)?29:28):[4,6,9,11].includes(month)?30:31;}
export function initializeCalendar(s:GameState,migrate:boolean):void{
 if(migrate){s.day??=1;s.simulationDay??=s.tick*30;s.pauseRequests??=[];s.notifications??=[];s.notificationSequence??=0;}
 if(!Number.isSafeInteger(s.day)||s.day!<1||s.day!>monthDays(s.year,s.month)||!Number.isSafeInteger(s.simulationDay)||s.simulationDay!<0)throw Error('Invalid campaign calendar');
 if(!Array.isArray(s.pauseRequests)||s.pauseRequests.some(id=>!s.players.some(p=>p.id===id))||new Set(s.pauseRequests).size!==s.pauseRequests.length)throw Error('Invalid pause requests');
 if(!Array.isArray(s.notifications)||s.notifications.length>240||!Number.isSafeInteger(s.notificationSequence)||s.notificationSequence!<0)throw Error('Invalid notification ledger');
}
/** Monthly tick remains the 2.0 accounting clock. This only advances the day. */
export function advanceDate(s:GameState):boolean{
 if(!Number.isSafeInteger((s.simulationDay??0)+1))throw Error('Day clock overflow');s.simulationDay=(s.simulationDay??0)+1;s.day=(s.day??1)+1;
 if(s.day>monthDays(s.year,s.month)){s.day=1;return true;}return false;
}
export function dateAfterDays(s:Pick<GameState,'year'|'month'|'day'>,days:number):string{
 let y=s.year,m=s.month,d=s.day??1;for(let n=0;n<Math.max(0,Math.min(36500,Math.ceil(days)));n++){d++;if(d>monthDays(y,m)){d=1;m++;if(m>12){m=1;y++;}}}return `${String(d).padStart(2,'0')}.${String(m).padStart(2,'0')}.${y}`;
}
export function projectEndDate(s:GameState,months:number):string{const total=s.year*12+s.month-1+Math.max(0,Math.ceil(months));return `01.${String(total%12+1).padStart(2,'0')}.${Math.floor(total/12)}`;}
export function requestPause(s:GameState,playerId:string,accept=true):void{
 s.pauseRequests=(s.pauseRequests??[]).filter(id=>id!==playerId);if(accept)s.pauseRequests.push(playerId);
 const voters=s.players.filter(p=>p.connected!==false&&!p.aiControlled);if(s.pauseRequests.filter(id=>voters.some(p=>p.id===id)).length>voters.length/2){s.speed=0;s.phase='paused';s.pauseRequests=[];}
}
