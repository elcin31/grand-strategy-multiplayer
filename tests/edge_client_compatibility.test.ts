import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {CURRENT_STATE_VERSION} from '../supabase/functions/_shared/stateMigrations';

test('both actual edge handlers reject incompatible clients before any session, room or receipt DB access',async()=>{
  type Runtime={Deno?:{env:{get:(key:string)=>string};serve:(handler:(req:Request)=>Promise<Response>)=>void};__dominionEdgeTestDb?:unknown};
  const runtime=globalThis as unknown as Runtime,previousDeno=runtime.Deno,previousDb=runtime.__dominionEdgeTestDb;
  const directory=await mkdtemp(join(tmpdir(),'dominion-edge-contract-'));
  let accesses=0,handler!:(req:Request)=>Promise<Response>;
  runtime.__dominionEdgeTestDb={from:()=>{accesses++;throw new Error('No fixture player session');}};
  runtime.Deno={env:{get:key=>key==='SUPABASE_URL'?'https://fixture.invalid':'fixture-only'},serve:h=>{handler=h;}};
  try{
    for(const name of ['game-room','game-command']){
      const bundle=await build({entryPoints:[`supabase/functions/${name}/index.ts`],write:false,bundle:true,platform:'node',format:'esm',target:'es2022',plugins:[{
        name:'isolated-edge-sdk',setup(build){
          build.onResolve({filter:/^(npm:|jsr:)/},args=>({path:args.path,namespace:'fixture-sdk'}));
          build.onLoad({filter:/.*/,namespace:'fixture-sdk'},args=>({contents:args.path.startsWith('npm:')
            ?'export const createClient=()=>globalThis.__dominionEdgeTestDb;':'export {};',loader:'js'}));
        },
      }]});
      const modulePath=join(directory,name+'.mjs');
      await writeFile(modulePath,bundle.outputFiles[0]!.contents);
      await import(pathToFileURL(modulePath).href);
      const auth={gameId:'11111111-1111-4111-8111-111111111111',playerId:'22222222-2222-4222-8222-222222222222',token:'a'.repeat(43)};
      const body=name==='game-room'?{action:'state',...auth}:{...auth,commandId:'edge-compatibility-intent',expectedVersion:0,command:{type:'SET_READY',playerId:auth.playerId,ready:true}};
      for(const version of [undefined,12,CURRENT_STATE_VERSION-1,CURRENT_STATE_VERSION+1]){
        accesses=0;const response=await handler(new Request('https://fixture.invalid/'+name,{method:'POST',body:JSON.stringify({...body,clientStateVersion:version})}));
        assert.equal(response.status,426,name+' must report an upgrade boundary');assert.equal(accesses,0,name+' touched DB before compatibility');
        assert.match((await response.json()).error,/обновите Dominion|Сервер ещё не поддерживает/);
      }
      accesses=0;
      const compatible=await handler(new Request('https://fixture.invalid/'+name,{method:'POST',body:JSON.stringify({...body,clientStateVersion:CURRENT_STATE_VERSION})}));
      assert.equal(compatible.status,401);assert.equal(accesses,1,'a current client must still pass through real session authentication');
      accesses=0;
      const injected=await handler(new Request('https://fixture.invalid/'+name,{method:'POST',body:JSON.stringify({...body,clientStateVersion:CURRENT_STATE_VERSION,treasury:1e9})}));
      assert.equal(injected.status,400);assert.equal(accesses,0,'strict shape rejection must precede DB work');
    }
  }finally{if(previousDeno)runtime.Deno=previousDeno;else delete runtime.Deno;if(previousDb!==undefined)runtime.__dominionEdgeTestDb=previousDb;else delete runtime.__dominionEdgeTestDb;await rm(directory,{recursive:true,force:true});}
});
