// Compile the two existing Dominion functions without deploying or changing DBs.
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const output=process.argv[2];
if(!output)throw new Error('Usage: node scripts/bundle-backend.mjs <output-directory>');
const sourceHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const workingTreeClean=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()==='';
const root=resolve(output),functions=[];
for(const name of ['game-room','game-command']){
  const outfile=resolve(root,name,'index.js');
  await mkdir(resolve(root,name),{recursive:true});
  await build({entryPoints:[`supabase/functions/${name}/index.ts`],outfile,bundle:true,
    platform:'neutral',format:'esm',target:'es2022',external:['npm:*','jsr:*'],metafile:true});
  const bytes=await readFile(outfile);
  functions.push({name,entrypoint:'index.js',verifyJwt:false,bytes:bytes.length,
    sha256:createHash('sha256').update(bytes).digest('hex')});
}
const manifest={projectId:'dfjsnjxnyjspwugjguhq',sourceHead,workingTreeClean,
  note:'Build only. Existing custom player-session authentication, CAS and receipts retained. No deployment performed.',functions};
await writeFile(resolve(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
