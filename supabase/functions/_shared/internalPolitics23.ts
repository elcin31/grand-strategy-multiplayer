import type {Country,GameState} from './gameTypes.ts';
export const POLITICAL_GROUPS={Military:'Военные',Industrialists:'Промышленники',Regional:'Региональные элиты',Civic:'Гражданские движения',Administration:'Государственная администрация'} as const;
export type PoliticalGroup=keyof typeof POLITICAL_GROUPS;
export interface PoliticalGroupState {support:number;influence:number}
const clamp=(n:number)=>Math.max(0,Math.min(100,n));
export function initializePoliticalGroups(s:GameState,migrate:boolean):void{
 if(!s.dataset)return;
 for(const c of Object.values(s.countries)){
  if(migrate)c.politicalGroups??=Object.fromEntries(Object.keys(POLITICAL_GROUPS).map(id=>[id,{support:60,influence:c.governmentType==='Military Junta'?(id==='Military'?40:15):20}])) as Record<PoliticalGroup,PoliticalGroupState>;
  const groups=c.politicalGroups;
  if(!groups||Object.keys(groups).length!==5||Object.keys(POLITICAL_GROUPS).some(key=>{const g=groups[key as PoliticalGroup];return !g||!Number.isFinite(g.support)||g.support<0||g.support>100||!Number.isFinite(g.influence)||g.influence<0||g.influence>100;})||Math.abs(Object.values(groups).reduce((n,g)=>n+g.influence,0)-100)>1e-6||c.politicalGroupTick!==undefined&&(!Number.isSafeInteger(c.politicalGroupTick)||c.politicalGroupTick<0||c.politicalGroupTick>s.tick)||c.politicalGroupReason!==undefined&&(typeof c.politicalGroupReason!=='string'||c.politicalGroupReason.length>300))throw Error('Invalid political groups');
 }
}
export function politicalResponse(c:Country,changes:Partial<Record<PoliticalGroup,number>>,reason:string):void{
 if(!c.politicalGroups)return;
 for(const [id,amount] of Object.entries(changes))c.politicalGroups[id as PoliticalGroup].support=clamp(c.politicalGroups[id as PoliticalGroup].support+amount!);
 c.politicalGroupReason=reason.slice(0,300);
}
/** Five bounded groups, once per accounting period. Their pressure feeds the
 * existing stability/unrest values rather than adding a parallel revolt model. */
export function monthlyPoliticalGroups(s:GameState,c:Country):void{
 if(!c.politicalGroups||c.politicalGroupTick===s.tick)return;c.politicalGroupTick=s.tick;
 const tax=c.taxRate??30,exhaustion=c.warExhaustion??0,balance=c.economy?.monthlyBalance??0;
 const mobilized=c.mobilization==='General'?1:c.mobilization==='Partial'?.5:0;
 const targets:Record<PoliticalGroup,number>={
  Military:clamp(60+(c.militaryFunding==='High'?10:c.militaryFunding==='Low'?-15:0)-exhaustion*.5),
  Industrialists:clamp(65-(tax-30)*.7+(balance>=0?3:-8)-mobilized*8-exhaustion*.2),
  Regional:clamp(60-(c.unrest??0)*.4-exhaustion*.2+(c.nationalSpirits?.includes('CohesiveService')?8:0)),
  Civic:clamp(65-(tax-30)*.9-mobilized*15-exhaustion*.6+(c.nationalSpirits?.includes('SocialCompact')?10:0)),
  Administration:clamp(60+(balance>=0?4:-8)+(c.nationalSpirits?.includes('CohesiveService')?10:0)-(c.unrest??0)*.2)
 };
 let weighted=0;
 for(const id of Object.keys(POLITICAL_GROUPS) as PoliticalGroup[]){const g=c.politicalGroups[id];g.support=Math.round(clamp(g.support+(targets[id]-g.support)*.15)*1000)/1000;weighted+=g.support*g.influence/100;}
 const pressure=weighted<40?-(40-weighted)/100:weighted>75?(weighted-75)/200:0;
 if(pressure){c.stability=clamp(c.stability+pressure);c.unrest=clamp((c.unrest??0)-pressure);c.politicalGroupReason=pressure<0?'Снижение поддержки групп: налоги, мобилизация, длительная война и бюджетная нагрузка':'Широкая поддержка групп укрепляет государственную стабильность';}
}
