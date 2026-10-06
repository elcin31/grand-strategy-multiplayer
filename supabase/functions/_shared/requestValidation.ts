/** Bounded JSON decoding happens before authentication/DB access, including chunked bodies. */
export const MAX_REQUEST_BYTES=32768;
export class RequestError extends Error {constructor(message:string,public status=400){super(message);}}
export async function readRequest(req:Request):Promise<Record<string,unknown>> {
 const length=req.headers.get('content-length');if(length&&Number(length)>MAX_REQUEST_BYTES)throw new RequestError('Request too large',413);
 if(!req.body)throw new RequestError('JSON object required');
 const reader=req.body.getReader(),chunks:Uint8Array[]=[];let total=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_REQUEST_BYTES){await reader.cancel();throw new RequestError('Request too large',413);}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 let value:unknown;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new RequestError('Malformed JSON');}
 if(!value||typeof value!=='object'||Array.isArray(value))throw new RequestError('JSON object required');return value as Record<string,unknown>;
}
export function assertSessionFields(body:Record<string,unknown>):void {
 for(const key of ['gameId','playerId'])if(typeof body[key]!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body[key] as string))throw new RequestError('Invalid session identifier');
 if(typeof body.token!=='string'||!/^[A-Za-z0-9_-]{32,128}$/.test(body.token))throw new RequestError('Invalid session token');
}
export function assertRoomRequest(body:Record<string,unknown>):void {
 if(body.wireVersion!==undefined&&body.wireVersion!==1)throw new RequestError('Invalid wire version');
 const action=body.action;if(typeof action!=='string')throw new RequestError('Invalid action');
 const fields:Record<string,string[]>={create:['action','displayName'],join:['action','displayName','roomCode'],state:['action','gameId','playerId','token','version','checksum'],reconnect:['action','gameId','playerId','token'],heartbeat:['action','gameId','playerId','token']};
 if(!Object.hasOwn(fields,action)||Object.keys(body).some(k=>!fields[action]!.includes(k)&&k!=='wireVersion'))throw new RequestError('Invalid request fields');
 if(action==='create'||action==='join'){if(typeof body.displayName!=='string'||body.displayName.length>64)throw new RequestError('Invalid display name');if(action==='join'&&(typeof body.roomCode!=='string'||!/^[a-z0-9]{6}$/i.test(body.roomCode)))throw new RequestError('Invalid room code');}
 else {assertSessionFields(body);if(body.version!==undefined&&(!Number.isSafeInteger(body.version)||Number(body.version)<0))throw new RequestError('Invalid version');if(body.checksum!==undefined&&(typeof body.checksum!=='string'||!/^[0-9a-f]{8}$/.test(body.checksum)))throw new RequestError('Invalid checksum');}
}
