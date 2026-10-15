import {dayDelay} from '../../supabase/functions/_shared/calendarSystem';
import {decodeSnapshot,type WireResponse} from '../../supabase/functions/_shared/stateWire';
import {recordMetrics} from '../performance/telemetry';
import { GameCommand, GameState } from '../types/game';
import { MultiplayerTransport, TransportSession, Unsubscribe } from './transport';
import {secureSessionStore,type KeyStore} from './sessionStore';
import {stateChecksum} from '../../supabase/functions/_shared/sessionState';
import {CURRENT_STATE_VERSION} from '../../supabase/functions/_shared/stateMigrations';
export interface RemoteSession {protocolVersion?:number;gameId:string;playerId:string;token:string;version:number;countryId?:string|null;roomCode:string;lastPlayed:number;pending?:{command:GameCommand;commandId:string;expectedVersion:number}}
interface RoomResponse extends WireResponse {state:GameState;playerId:string;token?:string;version:number;checksum?:string;unchanged?:boolean}
export class RemoteError extends Error {constructor(message:string,public status:number){super(message);}}
const indexKey='dominion.sessions.v1',key=(id:string)=>'dominion.session.'+id;
export class HttpTransport implements MultiplayerTransport {
 private pollingDelay=new Map<string,number>();private legacyRooms=new Set<string>();
 private sessions=new Map<string,RemoteSession>();private checksums=new Map<string,string>();private queues=new Map<string,Promise<void>>();private listeners=new Map<string,(s:GameState)=>void>();private delivering=new Set<string>();
 constructor(private baseUrl:string,private store:KeyStore=secureSessionStore,private endpointSuffix=''){this.baseUrl=baseUrl.replace(/\/+$/,'');}
 private async request<T>(path:string,body:unknown,forceLegacy=false):Promise<T>{
  const gameId=(body as {gameId?:string}).gameId,legacy=this.endpointSuffix==='-v23'&&(forceLegacy||!!gameId&&this.legacyRooms.has(gameId));
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Сервер не ответил за 15 секунд. Повторите синхронизацию этой комнаты.'));},15000);});
  try{return await Promise.race([timeout,(async()=>{const started=performance.now();const response=await fetch(`${this.baseUrl}/${path}${legacy?'-v211':this.endpointSuffix}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body as object,clientStateVersion:legacy?25:CURRENT_STATE_VERSION,...path==='game-room'?{wireVersion:1}:{}}),signal:controller.signal});const text=await response.text();let result;try{result=JSON.parse(text);}catch{throw new Error('Некорректный ответ сервера. Повторите синхронизацию.');}recordMetrics({networkMs:performance.now()-started,networkBytes:new TextEncoder().encode(text).byteLength});if(!response.ok)throw new RemoteError(result.error??`Server ${response.status}`,response.status);if(legacy&&result.state?.id)this.legacyRooms.add(result.state.id);return result.stateEncoding?decodeSnapshot(result):result;})()]);}catch(error){if(!legacy&&this.endpointSuffix==='-v23'&&error instanceof RemoteError&&error.status===426&&error.message.startsWith('Эта комната использует другую версию Dominion.')){clearTimeout(timer);const result=await this.request<T>(path,body,true);if(gameId)this.legacyRooms.add(gameId);return result;}throw error;}finally{clearTimeout(timer);}
 }
 async savedSessions():Promise<RemoteSession[]>{const ids=JSON.parse(await this.store.get(indexKey)??'[]') as string[];const rows=await Promise.all(ids.map(id=>this.store.get(key(id))));return rows.filter((r):r is string=>r!==null).map(r=>JSON.parse(r) as RemoteSession).sort((a,b)=>b.lastPlayed-a.lastPlayed);}
 private async persist(s:RemoteSession){s.protocolVersion=this.legacyRooms.has(s.gameId)?25:CURRENT_STATE_VERSION;await this.store.set(key(s.gameId),JSON.stringify(s));const ids=JSON.parse(await this.store.get(indexKey)??'[]') as string[];if(!ids.includes(s.gameId))await this.store.set(indexKey,JSON.stringify([...ids,s.gameId]));}
 async forget(gameId:string){this.sessions.delete(gameId);await this.store.remove(key(gameId));const ids=JSON.parse(await this.store.get(indexKey)??'[]') as string[];await this.store.set(indexKey,JSON.stringify(ids.filter(id=>id!==gameId)));}
 private adopt(s:RemoteSession,r:RoomResponse){if(r.version<s.version)return;if(!r.state||r.state.id!==s.gameId||!r.state.players.some(p=>p.id===s.playerId))throw new Error('Некорректный снимок кампании');const checksum=r.stateEncoding==='dynamic-v1'?r.checksum!:stateChecksum(r.state);if(!checksum||r.checksum&&checksum!==r.checksum)throw new Error('Ошибка целостности снимка; повторите синхронизацию');this.pollingDelay.set(s.gameId,r.state.phase==='running'&&r.state.speed?Math.max(350,Math.min(1000,dayDelay(r.state.speed))):1200);s.version=r.version;s.countryId=r.state.players.find(p=>p.id===s.playerId)?.countryId;this.checksums.set(s.gameId,checksum);this.listeners.get(s.gameId)?.(r.state);}
 private async establish(body:unknown):Promise<TransportSession>{const r=await this.request<RoomResponse>('game-room',body);if(!r.token)throw new Error('Сервер не вернул токен');const s:RemoteSession={gameId:r.state.id,playerId:r.playerId,token:r.token,version:r.version,roomCode:r.state.roomCode,lastPlayed:Date.now()};this.adopt(s,r);await this.persist(s);this.sessions.set(s.gameId,s);return{state:r.state,playerId:r.playerId};}
 createRoom(displayName:string){return this.establish({action:'create',displayName});}
 joinRoom(roomCode:string,displayName:string){return this.establish({action:'join',roomCode,displayName});}
 async reconnect(gameId:string):Promise<TransportSession>{const raw=await this.store.get(key(gameId));if(!raw)throw new Error('Сессия не найдена');const s=JSON.parse(raw) as RemoteSession;if(s.protocolVersion===25)this.legacyRooms.add(gameId);const r=await this.request<RoomResponse>('game-room',{action:'reconnect',gameId,playerId:s.playerId,token:s.token});this.adopt(s,r);this.sessions.set(gameId,s);s.lastPlayed=Date.now();await this.persist(s);if(s.pending){try{await this.deliver(s);}catch(error){if(!(error instanceof RemoteError&&error.status===409))throw error;}}const fresh=await this.refresh(s);return{state:fresh.state,playerId:s.playerId};}
 private async refresh(s:RemoteSession){const r=await this.request<RoomResponse>('game-room',{action:'state',gameId:s.gameId,playerId:s.playerId,token:s.token});this.adopt(s,r);return r;}
 private async deliver(s:RemoteSession){
  if(!s.pending)return;
  const pending=s.pending;
  // Only absolute, unpaid controls can be rebased after an explicit CAS refusal.
  // Paid/relative intents retain the existing visible rejection behavior.
  const rebasable=['SELECT_COUNTRY','SET_READY','START_GAME','SET_SPEED','SET_AI_DIFFICULTY'].includes(pending.command.type);
  this.delivering.add(s.gameId);
  try{
  for(let attempt=0;;attempt++){
   try{
    await this.request('game-command',{gameId:s.gameId,playerId:s.playerId,token:s.token,...pending});
    delete s.pending;await this.persist(s);await this.refresh(s);return;
   }catch(error){
    const stale=error instanceof RemoteError&&error.status===409&&[
     'Stale campaign version','Состояние обновилось. Повторите действие после синхронизации'
    ].includes(error.message);
    if(stale&&rebasable&&attempt<2){
     const fresh=await this.refresh(s);
     if(pending.command.type==='START_GAME'&&fresh.state.phase!=='lobby'){delete s.pending;await this.persist(s);return;}
     pending.expectedVersion=s.version;await this.persist(s);continue;
    }
    if(error instanceof RemoteError&&[400,401,409,429].includes(error.status)){
     delete s.pending;await this.persist(s);if(error.status!==401)await this.refresh(s);
    }
    if(pending.command.type==='START_GAME'&&!(error instanceof RemoteError)){
     try{const fresh=await this.refresh(s);if(fresh.state.phase!=='lobby'){delete s.pending;await this.persist(s);return;}}catch{/* Durable command id is retained for retry/reconnect. */}
    }
    throw error;
   }
  }
  }finally{this.delivering.delete(s.gameId);}
 }
 async synchronize(gameId:string):Promise<GameState>{const s=this.sessions.get(gameId);if(!s)throw new Error('Сессия потеряна');return(await this.refresh(s)).state;}
 async sendCommand(gameId:string,command:GameCommand):Promise<void>{if(command.type==='ADVANCE_TICK')return;const previous=this.queues.get(gameId)??Promise.resolve();const next=previous.catch(()=>{}).then(async()=>{const s=this.sessions.get(gameId);if(!s)throw new Error('Сессия потеряна');if(s.pending){const recoveringStart=s.pending.command.type==='START_GAME'&&command.type==='START_GAME';await this.deliver(s);if(recoveringStart)return;}s.pending={command,commandId:`cmd-${Date.now()}-${Math.random().toString(36).slice(2,14)}`,expectedVersion:s.version};await this.persist(s);await this.deliver(s);});this.queues.set(gameId,next);return next;}
 subscribe(gameId:string,onState:(s:GameState)=>void,onStatus?:(status:string)=>void):Unsubscribe{
  let stopped=false;this.listeners.set(gameId,onState);let timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{const s=this.sessions.get(gameId);if(stopped||!s)return;const started=performance.now();
   try{if(this.delivering.has(gameId)){await this.request('game-room',{action:'heartbeat',gameId,playerId:s.playerId,token:s.token});if(!stopped)onStatus?.('');}
    else{const r=await this.request<RoomResponse>('game-room',{action:'state',gameId,playerId:s.playerId,token:s.token,version:s.version,checksum:this.checksums.get(gameId)});if(!stopped){if(!r.unchanged)this.adopt(s,r);onStatus?.('');}}}
   catch(error){if(!stopped){if(error instanceof RemoteError&&error.status===426){stopped=true;onStatus?.(error.message);}else onStatus?.(error instanceof RemoteError&&error.status===401?'Сессия истекла. Вернитесь к списку кампаний.':'Связь потеряна — восстанавливаем…');}}
   finally{if(!stopped)timer=setTimeout(()=>void poll(),Math.max(100,(this.pollingDelay.get(gameId)??1200)-(performance.now()-started)));}
  };
  timer=setTimeout(()=>void poll(),0);return()=>{stopped=true;clearTimeout(timer);this.listeners.delete(gameId);};
 }
 async leave(gameId:string){const s=this.sessions.get(gameId);if(s){s.lastPlayed=Date.now();await this.persist(s);}this.sessions.delete(gameId);}
}
