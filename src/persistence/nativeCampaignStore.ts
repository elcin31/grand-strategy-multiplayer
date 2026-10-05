import {CampaignStore,type CampaignFiles} from './campaignStore';
async function directory(){const fs=await import('expo-file-system');const dir=new fs.Directory(fs.Paths.document,'dominion-campaigns');dir.create({idempotent:true,intermediates:true});return{fs,dir};}
const files:CampaignFiles={
 async list(){const{dir}=await directory();return dir.list().map(f=>f.name);},
 async read(name){const{fs,dir}=await directory();return new fs.File(dir,name).text();},
 async write(name,text){const{fs,dir}=await directory();const f=new fs.File(dir,name);f.create({overwrite:true});f.write(text);},
 async move(from,to){const{fs,dir}=await directory();new fs.File(dir,from).move(new fs.File(dir,to));},
 async remove(name){const{fs,dir}=await directory();const f=new fs.File(dir,name);if(f.exists)f.delete();},
};
export const campaignStore=new CampaignStore(files);
