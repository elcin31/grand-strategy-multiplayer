import type {GameState} from './gameTypes.ts';
export const NOTIFICATION_CATEGORIES={Research:'Исследования',Construction:'Строительство',War:'Войны',Diplomacy:'Дипломатия',Rebellion:'Восстания',Siege:'Осады',Focus:'Национальные фокусы',Shortage:'Дефицит'} as const;
export type NotificationCategory=keyof typeof NOTIFICATION_CATEGORIES;
export interface CampaignNotification {id:number;countryId:string;category:NotificationCategory;tick:number;message:string;provinceId?:string}
export function notify(s:GameState,countryId:string,category:NotificationCategory,message:string,provinceId?:string):void{
 if(!s.countries[countryId])return;
 const id=(s.notificationSequence??0)+1;if(!Number.isSafeInteger(id))throw Error('Notification overflow');s.notificationSequence=id;
 s.notifications??=[];s.notifications.unshift({id,countryId,category,tick:s.tick,message,...(provinceId?{provinceId}:{})});s.notifications.length=Math.min(240,s.notifications.length);
 if(s.countries[countryId]!.autoPause?.includes(category)&&s.players.some(p=>p.countryId===countryId&&!p.aiControlled)){s.speed=0;s.clockNeedsReset=true;if(s.phase==='running')s.phase='paused';}
}
export function collectNotifications(before:GameState,after:GameState):void{
 for(const [id,c] of Object.entries(after.countries)){
  const old=before.countries[id];if(old?.research&&((old.research.nodeId&&c.scientificDiscoveries?.includes(old.research.nodeId)&&!old.scientificDiscoveries?.includes(old.research.nodeId))||old.research.branch!=='Science'&&(c.technologies?.[old.research.branch]??0)>(old.technologies?.[old.research.branch]??0)))notify(after,id,'Research','Исследование завершено: '+(old.research.nodeId??old.research.branch));
 }
 const active=new Set(after.constructions?.map(c=>c.id));for(const c of before.constructions??[])if(!active.has(c.id)&&(after.provinces.find(p=>p.id===c.provinceId)?.buildings?.[c.buildingType]??0)>=c.targetLevel)notify(after,c.ownerId,'Construction','Построено: '+c.buildingType,c.provinceId);
 const focuses=new Set(before.focusEvents?.map(e=>e.id));for(const e of after.focusEvents??[])if(!focuses.has(e.id)&&e.kind==='Completed')notify(after,e.countryId,'Focus',e.message);
 const wars=new Set(before.wars?.map(w=>w.id));for(const w of after.wars??[])if(!wars.has(w.id)){notify(after,w.attackers[0]!,'War','Началась война с '+after.countries[w.defenders[0]!]!.name);notify(after,w.defenders[0]!,'War','Объявлена война: '+after.countries[w.attackers[0]!]!.name);}
 const offers=new Set(before.diplomaticOffers?.map(o=>o.id));for(const o of after.diplomaticOffers??[])if(!offers.has(o.id))notify(after,o.to,'Diplomacy','Новое дипломатическое предложение');
 for(let i=0;i<after.provinces.length;i++){const p=after.provinces[i]!;if(p.rebellion&&!before.provinces[i]?.rebellion)notify(after,p.ownerId,'Rebellion','Восстание: '+p.name,p.id);}
}
