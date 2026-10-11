import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {packRoomState,unpackRoomState} from '../supabase/functions/_shared/stateStorage';
import {stateChecksum} from '../supabase/functions/_shared/sessionState';
import {sha256} from '../supabase/functions/_shared/security';
import {CURRENT_STATE_VERSION} from '../supabase/functions/_shared/stateMigrations';

type Handler=(request:Request)=>Promise<Response>;
type Runtime={Deno?:{env:{get:(key:string)=>string};serve:(handler:Handler)=>void};__dominionPersistenceDb?:unknown};
async function withHandler(name:string,db:unknown,exercise:(handler:Handler)=>Promise<void>){
  const runtime=globalThis as unknown as Runtime,previousDeno=runtime.Deno,previousDb=runtime.__dominionPersistenceDb;
  const directory=await mkdtemp(join(tmpdir(),'dominion-edge-persistence-'));let handler!:Handler;
  runtime.__dominionPersistenceDb=db;
  runtime.Deno={env:{get:key=>key==='SUPABASE_URL'?'https://fixture.invalid':'fixture-only'},serve:h=>{handler=h;}};
  try{
    const bundle=await build({entryPoints:[`supabase/functions/${name}/index.ts`],write:false,bundle:true,platform:'node',format:'esm',target:'es2022',plugins:[{
      name:'isolated-persistence-sdk',setup(build){
        build.onResolve({filter:/^(npm:|jsr:)/},args=>({path:args.path,namespace:'fixture-sdk'}));
        build.onLoad({filter:/.*/,namespace:'fixture-sdk'},args=>({contents:args.path.startsWith('npm:')
          ?'export const createClient=()=>globalThis.__dominionPersistenceDb;':'export {};',loader:'js'}));
      },
    }]});
    const modulePath=join(directory,name+'.mjs');await writeFile(modulePath,bundle.outputFiles[0]!.contents);
    await import(pathToFileURL(modulePath).href);await exercise(handler);
  }finally{
    if(previousDeno)runtime.Deno=previousDeno;else delete runtime.Deno;
    if(previousDb!==undefined)runtime.__dominionPersistenceDb=previousDb;else delete runtime.__dominionPersistenceDb;
    await rm(directory,{recursive:true,force:true});
  }
}
const post=(handler:Handler,name:string,body:unknown)=>handler(new Request('https://fixture.invalid/'+name,{method:'POST',body:JSON.stringify(body)}));

test('compiled room entrypoint creates and stores the entire original world through the real gzip codec',async()=>{
  const inserts=new Map<string,Record<string,unknown>>();
  const db={from:(table:string)=>({insert:async(value:Record<string,unknown>)=>{inserts.set(table,value);return {error:null};}})};
  await withHandler('game-room',db,async handler=>{
    const response=await post(handler,'game-room',{action:'create',displayName:'  Bundled QA  ',clientStateVersion:CURRENT_STATE_VERSION});
    assert.equal(response.status,200);const result=await response.json();
    const stored=inserts.get('game_rooms')!;assert.equal(stored.state,null);assert.ok(String(stored.state_compressed).startsWith('gz1:'));
    const restored=await unpackRoomState({state:null,state_compressed:String(stored.state_compressed)});
    assert.equal(Object.keys(restored.countries).length,195);assert.equal(restored.provinces.length,2924);assert.equal(restored.cities!.length,5411);
    assert.equal(restored.stateVersion,CURRENT_STATE_VERSION);assert.equal(stateChecksum(restored),stateChecksum(result.state));
    const expected=createWorldState(result.state.id,result.state.roomCode,result.playerId,'Bundled QA');
    expected.players[0]!.lastSeen=result.state.players[0].lastSeen;
    assert.equal(stateChecksum(result.state),stateChecksum(expected),'Compiled initialization changed the canonical world');
    const player=inserts.get('game_players')!;assert.equal(player.id,result.playerId);assert.equal(player.room_id,result.state.id);
    assert.equal(player.token_hash,await sha256(result.token));assert.equal(player.is_host,true);
    assert.equal(result.version,0);assert.equal(result.state.players[0].displayName,'Bundled QA');
  });
});

test('compiled command entrypoint persists a paid course once and reuses its immutable transactional receipt',async()=>{
  const gameId='11111111-1111-4111-8111-111111111111',playerId='22222222-2222-4222-8222-222222222222',token='a'.repeat(43);
  const initial=createWorldState(gameId,'EDGEQA',playerId,'Bundled QA');initial.players[0]!.countryId='germany';initial.players[0]!.ready=true;
  initial.phase='paused';initial.speed=0;
  let packed=await packRoomState(initial),version=7,commits=0,receipt:{payload_hash:string;version:number}|null=null;
  const tokenHash=await sha256(token);
  const db={from:(table:string)=>{
    const filters:Record<string,unknown>={};let updating=false;
    const query={update:(_value:unknown)=>{updating=true;return query;},select:(_fields:string)=>query,
      eq:(key:string,value:unknown)=>{filters[key]=value;return query;},gt:(_key:string,_value:unknown)=>query,
      maybeSingle:async()=>({data:table==='game_command_receipts'?receipt:table==='game_players'&&updating&&filters.id===playerId&&filters.room_id===gameId&&filters.token_hash===tokenHash?{id:playerId}:null,error:null}),
      single:async()=>({data:table==='game_rooms'?{state:null,state_compressed:packed,version}:{rate_started:new Date(0).toISOString(),rate_count:0},error:null})};
    return query;
  },rpc:async(name:string,args:Record<string,unknown>)=>{
    assert.equal(name,'commit_game_command');assert.equal(args.p_room,gameId);assert.equal(args.p_player,playerId);assert.equal(args.p_expected,version);
    assert.equal(args.p_command,'paid-course-receipt');assert.equal(receipt,null);
    packed=String(args.p_state);version++;commits++;receipt={payload_hash:String(args.p_hash),version};
    return {data:{status:200,version},error:null};
  }};
  await withHandler('game-command',db,async handler=>{
    const command={type:'START_NATIONAL_FOCUS',playerId,focusId:'eco-audit'};
    const body={gameId,playerId,token,commandId:'paid-course-receipt',expectedVersion:7,command,clientStateVersion:CURRENT_STATE_VERSION};
    const first=await post(handler,'game-command',body);assert.equal(first.status,200);
    const committed=await unpackRoomState({state:null,state_compressed:packed});const country=committed.countries.germany!;
    assert.equal(country.treasury,initial.countries.germany!.treasury-220);assert.equal(country.politicalPower,initial.countries.germany!.politicalPower!-16);
    assert.equal(country.nationalFocus!.focusId,'eco-audit');assert.equal(country.nationalFocus!.progress,0);
    assert.equal(committed.focusEvents!.filter(e=>e.countryId==='germany'&&e.kind==='Started').length,1);
    const checksum=stateChecksum(committed),duplicate=await post(handler,'game-command',body);
    assert.equal(duplicate.status,200);assert.equal((await duplicate.json()).duplicate,true);
    assert.equal(commits,1);assert.equal(stateChecksum(await unpackRoomState({state:null,state_compressed:packed})),checksum);
    const changed=await post(handler,'game-command',{...body,command:{...command,focusId:'eco-corridors'}});
    assert.equal(changed.status,409);assert.equal(commits,1);
    const foreign=await post(handler,'game-command',{...body,token:'b'.repeat(43)});assert.equal(foreign.status,401);assert.equal(commits,1);
  });
});
