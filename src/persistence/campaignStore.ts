import {cloneGameState} from '../../supabase/functions/_shared/cloneGameState';
import type {GameState} from '../types/game';
import type {CampaignMetadata} from './campaignCodec';
export interface CampaignFiles {list():Promise<string[]>;read(name:string):Promise<string>;write(name:string,text:string):Promise<void>;move(from:string,to:string):Promise<void>;remove(name:string):Promise<void>}
export interface CampaignEntry {id:string;metadata?:CampaignMetadata;error?:string}
const idPattern=/^[\w-]{1,100}$/;
function filenames(files:string[],id:string){return files.filter(n=>n.startsWith(id+'.')&&/^\d+\.json$/.test(n.slice(id.length+1))).sort((a,b)=>Number(b.slice(id.length+1,-5))-Number(a.slice(id.length+1,-5)));}
export class CampaignStore {
 private queue:Promise<unknown>=Promise.resolve();
 constructor(private files:CampaignFiles){}
 async list():Promise<CampaignEntry[]>{const files=await this.files.list(),ids=new Set(files.filter(n=>/\.\d+\.json$/.test(n)).map(n=>n.replace(/\.\d+\.json$/,'')));const entries=await Promise.all([...ids].map(async id=>{try{const latest=filenames(files,id)[0]!;let saved:{format?:number;metadata?:CampaignMetadata}|null=null;const index=id+'.index.json';if(files.includes(index)){try{const cached=JSON.parse(await this.files.read(index));if(cached.metadata?.generation===Number(latest.slice(id.length+1,-5)))saved=cached;}catch{}}saved??=JSON.parse(await this.files.read(latest));if(!saved||saved.format!==1||saved.metadata?.id!==id||!Number.isFinite(saved.metadata.lastPlayed))throw Error('Некорректные метаданные');return{id,metadata:saved.metadata as CampaignMetadata};}catch(error){return{id,error:error instanceof Error?error.message:'Ошибка сохранения'};}}));return entries.sort((a,b)=>(b.metadata?.lastPlayed??0)-(a.metadata?.lastPlayed??0));}
 async load(id:string){if(!idPattern.test(id))throw Error('Некорректный id');await this.queue.catch(()=>{});const names=filenames(await this.files.list(),id);if(!names[0])throw Error('Сохранение не найдено');const {decodeCampaign}=await import('./campaignCodec');return decodeCampaign(await this.files.read(names[0])).state;}
 save(state:GameState,name?:string):Promise<void>{const snapshot=cloneGameState(state);const work=this.queue.catch(()=>{}).then(async()=>{const {encodeCampaign,decodeCampaign}=await import('./campaignCodec');const id=snapshot.id;if(!idPattern.test(id))throw Error('Некорректный id');const old=filenames(await this.files.list(),id);let generation=1;
 if(old[0]){const original=await this.files.read(old[0]);const parsed=JSON.parse(original);generation=decodeCampaign(original).metadata.generation+1;if(parsed.state?.dataset==='modern-world-v2'&&(parsed.state?.stateVersion??1)<12){const backup=id+'.before-city-v12.backup';if(!(await this.files.list()).includes(backup))await this.files.write(backup,original);}}
 const text=encodeCampaign(snapshot,generation,name),target=`${id}.${generation}.json`,pending=target+'.pending';await this.files.write(pending,text);decodeCampaign(await this.files.read(pending));await this.files.move(pending,target);
 try{const metadata=JSON.parse(text).metadata;const index=id+'.index.json',tmp=index+'.pending';await this.files.write(tmp,JSON.stringify({format:1,metadata}));await this.files.move(tmp,index);}catch{/* Campaign generation is durable even if optional menu metadata could not be cached. */}

 // Preserve last valid generation. A killed partial write never replaces it.
 for(const file of old.slice(1))await this.files.remove(file);
 });this.queue=work;return work;}
 delete(id:string):Promise<void>{if(!idPattern.test(id))return Promise.reject(Error('Некорректный id'));const work=this.queue.catch(()=>{}).then(async()=>{for(const f of await this.files.list())if(f.startsWith(id+'.'))await this.files.remove(f);});this.queue=work;return work;}
}
