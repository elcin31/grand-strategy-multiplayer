import {countryFor,type GameState,type Country,type Province} from './gameTypes.ts';
import {diplomaticLink,pairKey,warBetween,type DiplomacyLink} from './diplomacySystem.ts';
import {money} from './economySystem.ts';
import {techLevel,TECHNOLOGIES,type TechnologyBranch} from './technologySystem.ts';
import {DIPLOMACY_RULES as RULES,DIPLOMATIC_TREATIES,type DiplomaticTerms,type DiplomaticOffer,type RelationMissionKind,type TreatyTerm} from './diplomacyTypes.ts';

const bound=(n:number,min=-100,max=100)=>Math.max(min,Math.min(max,n));
export function diplomaticTermsLabel(t:DiplomaticTerms):string {
  if(t.kind==='Treaty')return DIPLOMATIC_TREATIES[t.treaty];
  if(t.kind==='TechnologyExchange')return `Обмен: ${TECHNOLOGIES[t.give].name} ↔ ${TECHNOLOGIES[t.receive].name}`;
  if(t.kind==='ProvinceTransfer')return `Передача провинции · ${t.price} млн`;
  if(t.kind==='Ultimatum')return t.demand==='Payment'?`Ультиматум · ${t.amount} млн`:'Ультиматум: территориальная претензия';
  if(t.kind==='PoliticalUnion')return DIPLOMATIC_TREATIES.PoliticalUnion;
  return `Саммит · ${t.agenda==='Relations'?'отношения':DIPLOMATIC_TREATIES[t.agenda]}`;
}
function nextId(s:GameState,kind:string):string {
  const n=s.nextEntityId!;
  if(!Number.isSafeInteger(n)||n<1||n>=Number.MAX_SAFE_INTEGER)throw Error('Entity sequence exhausted');
  const prefix=({'diplomacy-event':'ev','relation-mission':'rm','diplomatic-offer':'of','treaty':'tr','legacy-treaty':'tr','union':'un'} as Record<string,string>)[kind]??kind;
  s.nextEntityId=n+1;return `${prefix}-${s.id}-${n}`;
}
function futureTick(s:GameState,months:number):number {const n=s.tick+months;if(!Number.isSafeInteger(n))throw Error('Diplomatic date overflow');return n;}
function living(s:GameState,id:string):Country {
  const c=countryFor(s,id);if(!c.provinceIds?.length)throw Error('Страна без территории');return c;
}
function peaceful(s:GameState,from:string,to:string):void {
  if(from===to)throw Error('Нужна другая страна');living(s,from);living(s,to);
  if(warBetween(s,from,to))throw Error('Действие недоступно во время войны');
}
function isHuman(s:GameState,id:string):boolean{return s.players.some(p=>p.countryId===id&&!p.aiControlled);}
function cooldown(l:DiplomacyLink,actor:string,action:string,tick:number):void {
  if(tick<(l.cooldowns?.[actor+':'+action]??0))throw Error('Дипломатическое действие на cooldown');
}
function pay(c:Country,amount:number,pp:number):void {
  if(c.treasury<amount||(c.politicalPower??0)<pp)throw Error('Недостаточно средств или политической силы');
  c.treasury=money(c.treasury-amount);c.politicalPower!-=pp;
}
export function logDiplomacy(s:GameState,countries:string[],kind:string,message:string):void {
  s.diplomaticHistory!.unshift({id:nextId(s,'diplomacy-event'),tick:s.tick,countries:[...new Set(countries)],kind,message});
  s.diplomaticHistory!.length=Math.min(s.diplomaticHistory!.length,RULES.historyLimit);
}
export function relationChange(s:GameState,a:string,b:string,key:string,label:string,delta:number):void {
  const l=diplomaticLink(s,a,b);l.baselineRelation??=l.relation;l.reasons??=[];l.trust??=50;
  const previous=l.reasons.find(r=>r.key===key),value=bound((previous?.value??0)+delta);
  if(previous){previous.value=value;previous.changedTick=s.tick;previous.label=label;}
  else {if(l.reasons.length>=32){const removed=l.reasons.shift()!;l.baselineRelation=bound(l.baselineRelation+removed.value);}l.reasons.push({key,label,value,changedTick:s.tick});}
  l.relation=bound(l.baselineRelation+l.reasons.reduce((n,r)=>n+r.value,0));
}
/** Replace contextual reasons, while action reasons keep their accumulated
 * history. Evaluate sparse diplomatic links every six months, not all pairs. */
export function refreshRelationFactors(s:GameState):void {
  const borders=new Map<string,Set<string>>(),claims=new Map<string,number>();
  const provinces=new Map(s.provinces.map(p=>[p.id,p]));
  for(const p of s.provinces){
    if(p.originalOwnerId&&p.originalOwnerId!==p.ownerId){const key=pairKey(p.originalOwnerId,p.ownerId);claims.set(key,(claims.get(key)??0)+1);}
    const adjacent=borders.get(p.ownerId)??new Set<string>();
    for(const id of p.neighbors){const q=provinces.get(id);if(q&&q.ownerId!==p.ownerId)adjacent.add(q.ownerId);}
    borders.set(p.ownerId,adjacent);
  }
  for(const l of Object.values(s.diplomacy!)){
    const a=s.countries[l.a]!,b=s.countries[l.b]!,factors=[
      ['government','Политические связи',a.governmentType===b.governmentType?3:0],
      ['religion','Культурные связи',a.religion===b.religion?5:0],
      ['claims','Территориальные претензии',-Math.min(30,(claims.get(pairKey(l.a,l.b))??0)*5)],
      ['trade','Экономическое сотрудничество',l.treaties.includes('TradeAgreement')?5:0],
      ['threat','Военная угроза',borders.get(l.a)?.has(l.b)&&Math.max(a.army,b.army)>2*Math.max(1000,Math.min(a.army,b.army))?-8:0],
      ['expansion','Репутация экспансии',-Math.min(20,Math.round(((a.aggressiveExpansion??0)+(b.aggressiveExpansion??0))/10))],
    ] as const;
    for(const [key,label,value]of factors){const previous=l.reasons!.find(r=>r.key==='context:'+key)?.value??0;if(previous!==value)relationChange(s,l.a,l.b,'context:'+key,label,value-previous);}
  }
}
export function diplomaticCapacity(c:Country):number{return 2+Math.floor(techLevel(c,'Diplomacy')/2);}
export function missionAvailability(s:GameState,from:string,to:string,kind:RelationMissionKind):string|null {
  const c=s.countries[from],l=s.diplomacy?.[pairKey(from,to)];
  if(!c||!s.countries[to]||from===to||!c.provinceIds?.length||!s.countries[to]!.provinceIds?.length)return 'Нужны две действующие страны';
  if(warBetween(s,from,to))return 'Во время войны миссия недоступна';
  if(s.relationMissions?.some(m=>m.from===from&&m.to===to&&m.untilTick>=s.tick))return 'Миссия в этой стране уже идёт';
  if((s.relationMissions?.filter(m=>m.from===from&&m.untilTick>=s.tick).length??0)>=diplomaticCapacity(c))return 'Нет свободных дипломатов';
  if(s.tick<(l?.cooldowns?.[from+':'+kind]??0))return 'Миссия на cooldown';
  if(c.treasury<RULES.missionSetupCost+RULES.missionMonthlyCost*3||(c.politicalPower??0)<RULES.missionPoliticalCost||s.tick<(c.bankruptcyUntilTick??0))return 'Нужен резерв бюджета и 10 PP';
  return null;
}
export function startRelationMission(s:GameState,from:string,to:string,kind:RelationMissionKind):void {
  const unavailable=missionAvailability(s,from,to,kind);if(unavailable)throw Error(unavailable);
  const c=living(s,from),l=diplomaticLink(s,from,to);
  pay(c,RULES.missionSetupCost,RULES.missionPoliticalCost);
  s.relationMissions!.push({id:nextId(s,'relation-mission'),from,to,kind,startedTick:s.tick,untilTick:futureTick(s,RULES.missionMonths),lastTick:s.tick,monthlyCost:RULES.missionMonthlyCost});
  l.cooldowns![from+':'+kind]=futureTick(s,RULES.missionMonths+3);
  logDiplomacy(s,[from,to],'MissionStarted',`${kind==='Improve'?'Улучшение':'Ухудшение'} отношений: 12 месяцев, 3 млн в месяц`);
}
export function cancelRelationMission(s:GameState,actor:string,id:string):void {
  const m=s.relationMissions!.find(m=>m.id===id&&m.from===actor);if(!m)throw Error('Миссия не найдена');
  s.relationMissions=s.relationMissions!.filter(x=>x.id!==id);logDiplomacy(s,[actor,m.to],'MissionCancelled','Дипломатическая миссия отозвана');
}
export function sendGift(s:GameState,from:string,to:string,amount:number):void {
  peaceful(s,from,to);assertDiplomaticAmount(amount,false);
  const l=diplomaticLink(s,from,to),a=living(s,from),b=living(s,to);cooldown(l,from,'Gift',s.tick);
  const recipient=money(b.treasury+amount);pay(a,amount,RULES.giftPoliticalCost);b.treasury=recipient;
  l.cooldowns![from+':Gift']=futureTick(s,3);l.trust=bound((l.trust??50)+3,0,100);
  relationChange(s,from,to,'gift:'+from,'Дары',Math.min(20,Math.floor(Math.log2(1+amount/50)*4)));
  logDiplomacy(s,[from,to],'Gift',`${a.name} передаёт ${b.name} ${amount} млн`);
}
export function sendInsult(s:GameState,from:string,to:string):void {
  peaceful(s,from,to);const l=diplomaticLink(s,from,to),c=living(s,from);cooldown(l,from,'Insult',s.tick);
  pay(c,0,RULES.insultPoliticalCost);l.cooldowns![from+':Insult']=futureTick(s,6);l.trust=bound((l.trust??50)-10,0,100);
  relationChange(s,from,to,'insult:'+from,'Оскорбления',-20);
  logDiplomacy(s,[from,to],'Insult','Дипломатический протест: доверие снизилось, отношения ухудшились');
  if(!isHuman(s,to)){relationChange(s,from,to,'response:'+to,'Ответный протест',-5);logDiplomacy(s,[from,to],'InsultResponse','Правительство адресата предъявило ответный протест');}
}
export function assertDiplomaticAmount(value:unknown,zero:boolean):asserts value is number {
  if(typeof value!=='number'||!Number.isFinite(value)||value<(zero?0:.001)||value>1_000_000||money(value)!==value)throw Error('Некорректная дипломатическая сумма');
}
const identifier=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9_+?-]{1,128}$/.test(v);
export function assertDiplomaticTerms(value:unknown,countries:readonly string[]):asserts value is DiplomaticTerms {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Некорректные условия предложения');
  const t=value as Record<string,unknown>;let keys:string[];
  switch(t.kind){
    case 'Treaty':keys=['kind','treaty'];if(typeof t.treaty!=='string'||t.treaty==='PoliticalUnion'||!Object.hasOwn(DIPLOMATIC_TREATIES,t.treaty))throw Error('Некорректный договор');break;
    case 'TechnologyExchange':keys=['kind','give','receive'];for(const k of ['give','receive'])if(typeof t[k]!=='string'||!Object.hasOwn(TECHNOLOGIES,t[k] as string))throw Error('Некорректная технология');if(t.give===t.receive)throw Error('Нужны разные технологии');break;
    case 'ProvinceTransfer':keys=['kind','provinceId','price'];if(!identifier(t.provinceId))throw Error('Некорректная провинция');assertDiplomaticAmount(t.price,true);break;
    case 'Ultimatum':if(t.demand==='Payment'){keys=['kind','demand','amount'];assertDiplomaticAmount(t.amount,false);}else if(t.demand==='Province'){keys=['kind','demand','provinceId'];if(!identifier(t.provinceId))throw Error('Некорректная провинция');}else throw Error('Некорректный ультиматум');break;
    case 'PoliticalUnion':keys=['kind'];break;
    case 'Summit':keys=['kind','participants','agenda'];if(!Array.isArray(t.participants)||t.participants.length<3||t.participants.length>6||new Set(t.participants).size!==t.participants.length||t.participants.some(id=>typeof id!=='string'||!countries.includes(id)))throw Error('Саммит требует 3–6 разных стран');if(!['Relations','TradeAgreement','NonAggression'].includes(t.agenda as string))throw Error('Неизвестная повестка');break;
    default:throw Error('Неизвестное дипломатическое предложение');
  }
  if(keys.some(k=>!Object.hasOwn(t,k))||Object.keys(t).some(k=>!keys.includes(k)))throw Error('Некорректные поля дипломатических условий');
}
function unionOf(s:GameState,id:string){return s.politicalUnions?.find(u=>u.members.includes(id));}
function provinceTransfer(s:GameState,from:string,to:string,id:string,price:number):Province {
  peaceful(s,from,to);const p=s.provinces.find(p=>p.id===id);if(!p||p.ownerId!==from||(p.controllerId??p.ownerId)!==from||p.rebellion)throw Error('Нет права передать провинцию');
  if((s.cities??[]).some(c=>c.provinceId===id&&c.isCapital)||s.countries[from]!.provinceIds!.length<=1)throw Error('Столицу или последнюю провинцию передать нельзя');
  if(s.wars!.some(w=>[...w.attackers,...w.defenders].includes(from)||[...w.attackers,...w.defenders].includes(to))||s.armies.some(a=>a.provinceId===id)||s.constructions!.some(q=>q.provinceId===id)||s.constructionQueue?.some(q=>q.provinceId===id))throw Error('Война, армия или строительство блокируют передачу');
  if(s.countries[to]!.treasury<price)throw Error('Покупатель не может оплатить провинцию');
  money(s.countries[from]!.treasury+price);return p;
}
function exchangeEligible(source:Country,recipient:Country,branch:TechnologyBranch):void {
  const target=techLevel(recipient,branch)+1;
  if(target>5||techLevel(source,branch)<target||recipient.research?.branch===branch)throw Error('Нельзя пропустить уровень или дублировать активное исследование');
}
function offerMembers(from:string,to:string,terms:DiplomaticTerms):string[]{return terms.kind==='Summit'?[...terms.participants]:[from,to];}
function validateOffer(s:GameState,from:string,to:string,t:DiplomaticTerms):void {
  assertDiplomaticTerms(t,Object.keys(s.countries));peaceful(s,from,to);
  const a=living(s,from),b=living(s,to),l=s.diplomacy?.[pairKey(from,to)];
  if(t.kind==='Treaty'){
    if(l?.rivals.length)throw Error('Соперничество блокирует договор');
    if(t.treaty==='MilitaryAccess'){
      if(l?.terms?.some(x=>x.type==='MilitaryAccess'&&x.from===to&&x.to===from&&x.untilTick>s.tick))throw Error('Право прохода уже действует');
    }else if(l?.treaties.includes(t.treaty))throw Error('Договор уже действует');
  }else if(t.kind==='ProvinceTransfer')provinceTransfer(s,from,to,t.provinceId,t.price);
  else if(t.kind==='TechnologyExchange'){exchangeEligible(a,b,t.give);exchangeEligible(b,a,t.receive);}
  else if(t.kind==='Ultimatum'){
    if(a.army<Math.max(1000,b.army)*1.25||(l?.treaties.length??0)>0)throw Error('Недостаточная военная сила или действующий договор');
    if(t.demand==='Payment'){if(b.treasury<t.amount)throw Error('Требование превышает доступные средства');money(a.treasury+t.amount);}
    else {const p=provinceTransfer(s,to,from,t.provinceId,0);if(p.originalOwnerId!==from||!p.neighbors.some(n=>s.provinces.find(q=>q.id===n)?.ownerId===from))throw Error('Требуется обоснованная приграничная претензия');}
  }else if(t.kind==='PoliticalUnion'){
    const alliance=l?.terms?.find(x=>x.type==='Alliance'&&x.untilTick>s.tick),trade=l?.terms?.find(x=>x.type==='TradeAgreement'&&x.untilTick>s.tick);
    if(a.overlordId||b.overlordId||unionOf(s,from)||unionOf(s,to)||s.wars!.some(w=>[...w.attackers,...w.defenders].some(id=>id===from||id===to))||!alliance||!trade||(l?.relation??0)<75||(l?.trust??50)<70||s.tick-Math.max(alliance.startedTick,trade.startedTick)<RULES.unionMinimumMonths)throw Error('Объединение требует 24 месяцев союза и торговли, отношений 75 и доверия 70');
  }else if(t.kind==='Summit'){
    if(!t.participants.includes(from)||!t.participants.includes(to))throw Error('Организатор и адресат должны участвовать');
    for(const id of t.participants)living(s,id);
    for(let i=0;i<t.participants.length;i++)for(const other of t.participants.slice(i+1)){
      if(warBetween(s,t.participants[i]!,other))throw Error('Участники саммита воюют друг с другом');
      if(t.agenda!=='Relations'&&s.diplomacy?.[pairKey(t.participants[i]!,other)]?.rivals.length)throw Error('Соперничество участников блокирует договор саммита');
    }
  }
}
/** Read-only strategic evaluation; rejected NPC offers still commit their
 * sending cost, cooldown and journal instead of providing free rerolls. */
export function diplomacyAcceptance(s:GameState,from:string,to:string,terms:DiplomaticTerms):{score:number;required:number;reasons:{label:string;value:number}[]} {
  const a=countryFor(s,from),b=countryFor(s,to),l=s.diplomacy?.[pairKey(from,to)];
  const enemies=(id:string)=>new Set(s.wars?.flatMap(w=>w.attackers.includes(id)?w.defenders:w.defenders.includes(id)?w.attackers:[])??[]);
  const ae=enemies(from),be=enemies(to),common=[...ae].filter(id=>be.has(id)).length;
  const reasons=[{label:'Отношения',value:l?.relation??0},{label:'Доверие',value:((l?.trust??50)-50)*.5},
    {label:'Репутация отправителя',value:(a.diplomaticReputation??50)/10},{label:'Дипломатические технологии',value:techLevel(a,'Diplomacy')*4},
    {label:'Общие враги',value:Math.min(30,common*15)},{label:'Агрессивная экспансия',value:-(a.aggressiveExpansion??0)},
    {label:'Соперничество',value:l?.rivals.length?-100:0},{label:'Военное сотрудничество',value:terms.kind==='Treaty'&&terms.treaty==='Alliance'?Math.min(15,Math.round(5*a.army/Math.max(1000,b.army))):0}];
  let required=20;
  if(terms.kind==='Treaty'&&terms.treaty==='TradeAgreement')reasons.push({label:'Доход от торговли',value:15});
  if(terms.kind==='TechnologyExchange')reasons.push({label:'Взаимная новая технология',value:25});
  if(terms.kind==='ProvinceTransfer'){
    const p=s.provinces.find(p=>p.id===terms.provinceId);required=15;
    reasons.push({label:'Цена и ценность провинции',value:terms.price<=Math.max(50,(p?.income??0)*36)?20:-80});
  }
  if(terms.kind==='Ultimatum'){required=25;reasons.push({label:'Военная угроза',value:Math.min(100,Math.round((a.army/Math.max(1000,b.army)-1)*35))});}
  if(terms.kind==='PoliticalUnion')required=85;
  if(terms.kind==='Summit'){
    reasons.push({label:'Многостороннее сотрудничество',value:10});
    const others=terms.participants.filter(id=>id!==from&&id!==to);
    for(const id of others){
      const link=s.diplomacy?.[pairKey(id,to)];
      reasons.push({label:'Отношения с участником: '+s.countries[id]!.name,value:Math.round((link?.relation??0)/others.length*.5)});
      if(link?.rivals.length)reasons.push({label:'Соперничество с участником: '+s.countries[id]!.name,value:-50});
      if(warBetween(s,id,to))reasons.push({label:'Война с участником',value:-100});
    }
  }
  return{score:reasons.reduce((n,r)=>n+r.value,0),required,reasons};
}
function addTreaty(s:GameState,from:string,to:string,type:TreatyTerm['type'],untilTick=s.tick+RULES.treatyMonths):void {
  const l=diplomaticLink(s,from,to);
  if(type==='MilitaryAccess'){
    if(l.terms!.some(t=>t.type===type&&t.from===from&&t.to===to&&t.untilTick>s.tick))return;
  }else if(l.treaties.includes(type))return;
  const term={id:nextId(s,'treaty'),type,from,to,startedTick:s.tick,untilTick};l.terms!.push(term);
  if(!l.treaties.includes(type))l.treaties.push(type);
  l.trust=bound((l.trust??50)+5,0,100);logDiplomacy(s,[from,to],'TreatyAccepted',`Вступает в силу: ${DIPLOMATIC_TREATIES[type]}`);
}
function transferProvince(s:GameState,from:string,to:string,id:string,price:number):void {
  const p=provinceTransfer(s,from,to,id,price),a=countryFor(s,from),b=countryFor(s,to);
  a.treasury=money(a.treasury+price);b.treasury=money(b.treasury-price);
  p.ownerId=to;p.controllerId=to;p.countryId=to;
  for(const c of s.cities??[])if(c.provinceId===p.id)c.countryId=to;
  a.provinceIds=a.provinceIds!.filter(id=>id!==p.id);b.provinceIds!.push(p.id);
  logDiplomacy(s,[from,to],'ProvinceTransferred',`${p.name}: передача территории за ${price} млн`);
}
function settleOffer(s:GameState,o:DiplomaticOffer):void {
  validateOffer(s,o.from,o.to,o.terms);const t=o.terms;
  if(t.kind==='Treaty')addTreaty(s,t.treaty==='MilitaryAccess'?o.to:o.from,t.treaty==='MilitaryAccess'?o.from:o.to,t.treaty);
  else if(t.kind==='TechnologyExchange'){
    const a=countryFor(s,o.from),b=countryFor(s,o.to);b.technologies![t.give]++;a.technologies![t.receive]++;
    logDiplomacy(s,[o.from,o.to],'TechnologyExchange','Согласован обмен одним следующим уровнем каждой технологии');
  }else if(t.kind==='ProvinceTransfer')transferProvince(s,o.from,o.to,t.provinceId,t.price);
  else if(t.kind==='Ultimatum'){
    if(t.demand==='Province')transferProvince(s,o.to,o.from,t.provinceId,0);
    else {const a=countryFor(s,o.from),b=countryFor(s,o.to);a.treasury=money(a.treasury+t.amount);b.treasury=money(b.treasury-t.amount);logDiplomacy(s,[o.from,o.to],'UltimatumAccepted',`Ультиматум принят: ${t.amount} млн`);}
    relationChange(s,o.from,o.to,'ultimatum','Ультиматумы',-15);
  }else if(t.kind==='PoliticalUnion'){
    const id=nextId(s,'union');s.politicalUnions!.push({id,members:[o.from,o.to],leaderId:o.from,startedTick:s.tick});
    addTreaty(s,o.from,o.to,'PoliticalUnion',Number.MAX_SAFE_INTEGER);
    logDiplomacy(s,[o.from,o.to],'PoliticalUnion','Добровольная федерация: общий рынок, проход и взаимная оборона; страны и города сохранены');
  }else if(t.kind==='Summit'){
    for(let i=0;i<t.participants.length;i++)for(const b of t.participants.slice(i+1)){
      const a=t.participants[i]!;if(t.agenda!=='Relations')addTreaty(s,a,b,t.agenda);
      relationChange(s,a,b,'summit','Дипломатические саммиты',10);
    }
    logDiplomacy(s,t.participants,'SummitAccepted','Все участники согласовали повестку саммита');
  }
  s.diplomaticOffers=s.diplomaticOffers!.filter(x=>x.id!==o.id);
  delete s.diplomacy?.[pairKey(o.from,o.to)]?.proposal;
}
function refuseOffer(s:GameState,o:DiplomaticOffer,actor:string,reason:string):void {
  s.diplomaticOffers=s.diplomaticOffers!.filter(x=>x.id!==o.id);
  delete s.diplomacy?.[pairKey(o.from,o.to)]?.proposal;
  if(o.terms.kind==='Ultimatum'){relationChange(s,o.from,o.to,'crisis','Дипломатический кризис',-20);const c=countryFor(s,o.from);c.aggressiveExpansion=bound((c.aggressiveExpansion??0)+2,0,100);}
  logDiplomacy(s,offerMembers(o.from,o.to,o.terms),'OfferRejected',`${s.countries[actor]!.name}: ${reason}`);
}
export function diplomacyQuote(s:GameState,from:string,to:string,terms:DiplomaticTerms):{cost:number;pp:number;reason:string|null} {
  const cost=terms.kind==='Summit'?100:terms.kind==='PoliticalUnion'?200:RULES.proposalCost,pp=terms.kind==='Ultimatum'?20:RULES.proposalPoliticalCost;
  let reason:string|null=null;
  try{
    validateOffer(s,from,to,terms);const l=s.diplomacy?.[pairKey(from,to)],c=living(s,from);
    if(l)cooldown(l,from,'Offer',s.tick);
    if((s.diplomaticOffers?.length??0)>=RULES.offerLimit||s.diplomaticOffers?.some(o=>o.from===from&&o.to===to)||(s.diplomaticOffers?.filter(o=>o.from===from).length??0)>=diplomaticCapacity(c)*2)throw Error('Лимит открытых предложений');
    if(c.treasury<cost||(c.politicalPower??0)<pp)throw Error('Недостаточно средств или политической силы');
    futureTick(s,RULES.proposalMonths);
  }catch(error){reason=error instanceof Error?error.message:'Предложение недоступно';}
  return{cost,pp,reason};
}
export function offerDiplomacy(s:GameState,from:string,to:string,terms:DiplomaticTerms):void {
  const {cost,pp,reason}=diplomacyQuote(s,from,to,terms);if(reason)throw Error(reason);
  const l=diplomaticLink(s,from,to),c=living(s,from);
  pay(c,cost,pp);l.cooldowns![from+':Offer']=futureTick(s,3);
  const o:DiplomaticOffer={id:nextId(s,'diplomatic-offer'),from,to,terms:structuredClone(terms),startedTick:s.tick,expiresTick:futureTick(s,RULES.proposalMonths),acceptedBy:[from]};
  s.diplomaticOffers!.push(o);logDiplomacy(s,offerMembers(from,to,terms),'OfferSent',`Отправлено предложение: ${diplomaticTermsLabel(terms)}`);
  for(const id of offerMembers(from,to,terms).filter(id=>id!==from))if(!isHuman(s,id)){
    const a=diplomacyAcceptance(s,from,id,terms);
    if(a.score<a.required){refuseOffer(s,o,id,'Предложение не отвечает стратегическим интересам');return;}
    o.acceptedBy.push(id);
  }
  if(offerMembers(from,to,terms).every(id=>o.acceptedBy.includes(id)))settleOffer(s,o);
}
export function respondDiplomacy(s:GameState,actor:string,id:string,accept:boolean):void {
  const o=s.diplomaticOffers!.find(o=>o.id===id);if(!o||o.expiresTick<=s.tick||o.from===actor||!offerMembers(o.from,o.to,o.terms).includes(actor)||o.acceptedBy.includes(actor))throw Error('Предложение больше недоступно');
  if(!accept){refuseOffer(s,o,actor,'Предложение отклонено');return;}
  validateOffer(s,o.from,o.to,o.terms);o.acceptedBy.push(actor);
  logDiplomacy(s,offerMembers(o.from,o.to,o.terms),'OfferConsent',`${s.countries[actor]!.name} подтверждает условия`);
  if(offerMembers(o.from,o.to,o.terms).every(id=>o.acceptedBy.includes(id)))settleOffer(s,o);
}
export function diplomacyResponseAvailability(s:GameState,actor:string,o:DiplomaticOffer):string|null {
  try{if(o.expiresTick<=s.tick||o.from===actor||!offerMembers(o.from,o.to,o.terms).includes(actor)||o.acceptedBy.includes(actor))throw Error('Ответ недоступен');validateOffer(s,o.from,o.to,o.terms);return null;}
  catch(error){return error instanceof Error?error.message:'Условия больше недоступны';}
}
export function canEnterTerritory(s:GameState,owner:string,controller:string,armyId?:string,targetProvinceId?:string):boolean {
  if(!s.dataset||owner===controller||warBetween(s,owner,controller))return true;
  const l=s.diplomacy?.[pairKey(owner,controller)];
  if(l?.terms?.some(t=>['Alliance','PoliticalUnion'].includes(t.type)&&t.untilTick>s.tick))return true;
  if(l?.terms?.some(t=>t.type==='MilitaryAccess'&&t.from===controller&&t.to===owner&&t.untilTick>s.tick))return true;
  if(!armyId||!targetProvinceId)return false;
  const army=s.armies.find(a=>a.id===armyId),order=army?.order;
  return !!order&&!!l?.withdrawals?.some(w=>{
    const route=w.routes[armyId],step=route?.indexOf(targetProvinceId)??-1;
    return w.countryId===owner&&w.untilTick>s.tick&&step>=0&&order.route[0]===targetProvinceId&&order.route.length===route!.length-step&&order.route.every((id,i)=>id===route![step+i])&&(step===0?!route!.includes(army!.provinceId):route![step-1]===army!.provinceId);
  });
}
function revokeAccess(s:GameState,term:TreatyTerm):void {
  const by=new Map(s.provinces.map(p=>[p.id,p])),routes:Record<string,string[]>={};
  for(const army of s.armies.filter(a=>a.ownerId===term.to&&(by.get(a.provinceId)?.controllerId??by.get(a.provinceId)?.ownerId)===term.from)){
    const queue=[army.provinceId],parent=new Map<string,string|null>([[army.provinceId,null]]);let found:string|undefined;
    for(let i=0;i<queue.length&&!found;i++)for(const id of by.get(queue[i]!)?.neighbors??[]){
      if(parent.has(id))continue;const p=by.get(id);if(!p)continue;const c=p.controllerId??p.ownerId;
      if(c!==term.from&&c!==term.to)continue;parent.set(id,queue[i]!);
      if(c===term.to){found=id;break;}queue.push(id);
    }
    if(found){const route=[found];for(let id=parent.get(found);id&&id!==army.provinceId;id=parent.get(id))route.push(id);route.reverse();routes[army.id]=route;army.order={type:'MOVE',targetProvinceId:found,route:[...route],issuedTick:s.tick};}
    else delete army.order;
  }
  if(Object.keys(routes).length)diplomaticLink(s,term.from,term.to).withdrawals!.push({countryId:term.to,untilTick:s.tick+RULES.withdrawalMonths,routes});
}
function removeTreaty(s:GameState,l:DiplomacyLink,term:TreatyTerm):void {
  l.terms=l.terms!.filter(t=>t.id!==term.id);
  if(!l.terms.some(t=>t.type===term.type))l.treaties=l.treaties.filter(t=>t!==term.type);
  if(term.type==='MilitaryAccess')revokeAccess(s,term);
  if(term.type==='PoliticalUnion')s.politicalUnions=s.politicalUnions!.filter(u=>!u.members.includes(l.a)||!u.members.includes(l.b));
}
/** Remove corridors for destroyed armies or armies that already left the
 * granting country. Call after simulation/command mutations, never in render. */
export function pruneAccessWithdrawals(s:GameState):void {
  const links=Object.values(s.diplomacy??{}).filter(l=>l.withdrawals?.length);
  if(!links.length)return;
  const armies=new Map(s.armies.map(a=>[a.id,a])),provinces=new Map(s.provinces.map(p=>[p.id,p]));
  for(const l of links){
    for(const w of l.withdrawals!){
      const grantor=w.countryId===l.a?l.b:l.a;
      for(const id of Object.keys(w.routes)){
        const a=armies.get(id),p=a&&provinces.get(a.provinceId);
        if(!a||a.ownerId!==w.countryId||!p||(p.controllerId??p.ownerId)!==grantor)delete w.routes[id];
      }
    }
    l.withdrawals=l.withdrawals!.filter(w=>w.untilTick>s.tick&&Object.keys(w.routes).length);
  }
}
export function terminateTreaty(s:GameState,actor:string,target:string,id:string):void {
  const l=diplomaticLink(s,actor,target),term=l.terms!.find(t=>t.id===id);
  if(!term)throw Error('Договор не найден');
  pay(living(s,actor),0,5);removeTreaty(s,l,term);l.trust=bound((l.trust??50)-15,0,100);
  relationChange(s,actor,target,'breach:'+actor,'Расторжение договоров',-15);
  if(['Alliance','NonAggression','DefensivePact','PoliticalUnion'].includes(term.type))l.truceUntilTick=Math.max(l.truceUntilTick,s.tick+6);
  logDiplomacy(s,[actor,target],'TreatyTerminated',`Расторгнут: ${DIPLOMATIC_TREATIES[term.type]}`);
}
/** One bounded scan of sparse active links/missions/offers on a monthly tick.
 * No country-pair matrix, graph searches or gameplay work in render callbacks. */
export function monthlyDiplomacy2(s:GameState):void {
  if(!s.dataset)return;
  const available=new Map(Object.values(s.countries).map(c=>[c.id,money(c.treasury+(c.economy?.monthlyBalance??0)+(c.economy?.diplomaticMaintenance??0))]));
  for(const m of [...s.relationMissions!]){
    if(m.untilTick<s.tick){s.relationMissions=s.relationMissions!.filter(x=>x.id!==m.id);continue;}
    if(warBetween(s,m.from,m.to)||!s.countries[m.from]!.provinceIds?.length||!s.countries[m.to]!.provinceIds?.length||(available.get(m.from)??0)<m.monthlyCost){cancelRelationMission(s,m.from,m.id);continue;}
    available.set(m.from,money(available.get(m.from)!-m.monthlyCost));
    if(m.lastTick<s.tick){relationChange(s,m.from,m.to,m.kind+':'+m.from,m.kind==='Improve'?'Дипломатическое сотрудничество':'Дипломатическое давление',m.kind==='Improve'?3:-3);const link=diplomaticLink(s,m.from,m.to);link.trust=bound(link.trust!+(m.kind==='Improve'?.5:-.5),0,100);m.lastTick=s.tick;if(m.untilTick===s.tick)logDiplomacy(s,[m.from,m.to],'MissionComplete','Дипломатическая миссия завершена');}
  }
  for(const o of [...s.diplomaticOffers!])if(o.expiresTick<=s.tick){s.diplomaticOffers=s.diplomaticOffers!.filter(x=>x.id!==o.id);delete s.diplomacy?.[pairKey(o.from,o.to)]?.proposal;logDiplomacy(s,offerMembers(o.from,o.to,o.terms),'OfferExpired','Срок ответа истёк');}
  for(const l of Object.values(s.diplomacy!)){
    for(const term of [...l.terms!])if(term.untilTick<=s.tick){removeTreaty(s,l,term);logDiplomacy(s,[l.a,l.b],'TreatyExpired',`Истёк срок: ${DIPLOMATIC_TREATIES[term.type]}`);}
    for(const id of [...l.guarantors])if((l.guaranteeUntil?.[id]??Number.MAX_SAFE_INTEGER)<=s.tick){l.guarantors=l.guarantors.filter(x=>x!==id);delete l.guaranteeUntil![id];logDiplomacy(s,[l.a,l.b],'GuaranteeExpired','Истёк срок гарантии независимости');}
    if(l.treaties.includes('TradeAgreement')&&warBetween(s,l.a,l.b))for(const term of l.terms!.filter(t=>t.type==='TradeAgreement'))removeTreaty(s,l,term);
  }
  pruneAccessWithdrawals(s);
  if(s.tick%6===0)refreshRelationFactors(s);
}
export function diplomacyBudget(s:GameState):{costs:Map<string,number>;tradeBonus:Map<string,number>} {
  const costs=new Map<string,number>(),tradeBonus=new Map<string,number>();
  for(const m of s.relationMissions??[])if(m.untilTick>=s.tick&&!warBetween(s,m.from,m.to)&&s.countries[m.from]?.provinceIds?.length&&s.countries[m.to]?.provinceIds?.length)costs.set(m.from,money((costs.get(m.from)??0)+m.monthlyCost));
  for(const l of Object.values(s.diplomacy??{}))if(!warBetween(s,l.a,l.b)){
    const active=(type:TreatyTerm['type'])=>l.terms?.some(t=>t.type===type&&t.untilTick>s.tick);
    const bonus=(active('TradeAgreement') ? .03 : 0)+(active('PoliticalUnion') ? .04 : 0);
    if(bonus)for(const id of [l.a,l.b])tradeBonus.set(id,Math.min(.2,(tradeBonus.get(id)??0)+bonus));
  }
  return{costs,tradeBonus};
}
export function initializeDiplomacy2(s:GameState,migrate:boolean):void {
  if(!s.dataset)return;
  if(migrate){s.relationMissions??=[];s.diplomaticOffers??=[];s.diplomaticHistory??=[];s.politicalUnions??=[];}
  if(!Array.isArray(s.relationMissions)||!Array.isArray(s.diplomaticOffers)||!Array.isArray(s.diplomaticHistory)||!Array.isArray(s.politicalUnions)||s.relationMissions.length>900||s.diplomaticOffers.length>RULES.offerLimit||s.diplomaticHistory.length>RULES.historyLimit||s.politicalUnions.length>150)throw Error('Invalid expansion diplomacy state');
  const tick=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0;
  const ids=new Set<string>();
  const id=(n:string)=>{if(!identifier(n)||ids.has(n))throw Error('Invalid diplomatic entity');const suffix=n.split('-').at(-1);if(['ev','rm','of','tr','un'].some(prefix=>n.startsWith(prefix+'-'+s.id+'-'))&&(!/^\d+$/.test(suffix!)||!Number.isSafeInteger(Number(suffix))||Number(suffix)<1||Number(suffix)>=s.nextEntityId!))throw Error('Invalid diplomatic sequence');ids.add(n);};
  const nation=(n:string)=>{countryFor(s,n);};
  const missions=new Set<string>();
  for(const m of s.relationMissions){id(m.id);nation(m.from);nation(m.to);const key=m.from+'|'+m.to;if(m.from===m.to||missions.has(key)||!['Improve','Damage'].includes(m.kind)||!tick(m.startedTick)||!tick(m.untilTick)||m.untilTick!==m.startedTick+RULES.missionMonths||!tick(m.lastTick)||m.lastTick<m.startedTick||m.lastTick>s.tick||m.lastTick>m.untilTick||m.startedTick>s.tick||m.monthlyCost!==RULES.missionMonthlyCost)throw Error('Invalid relation mission');missions.add(key);}
  const pendingPairs=new Set<string>();
  for(const o of s.diplomaticOffers){id(o.id);nation(o.from);nation(o.to);assertDiplomaticTerms(o.terms,Object.keys(s.countries));const members=offerMembers(o.from,o.to,o.terms),key=o.from+'|'+o.to;if(o.from===o.to||pendingPairs.has(key)||o.terms.kind==='Summit'&&(!members.includes(o.from)||!members.includes(o.to))||!tick(o.startedTick)||o.startedTick>s.tick||!tick(o.expiresTick)||o.expiresTick<=o.startedTick||o.expiresTick-o.startedTick>RULES.proposalMonths||!Array.isArray(o.acceptedBy)||new Set(o.acceptedBy).size!==o.acceptedBy.length||!o.acceptedBy.includes(o.from)||o.acceptedBy.some(a=>!members.includes(a))||members.every(m=>o.acceptedBy.includes(m)))throw Error('Invalid diplomatic offer');pendingPairs.add(key);}
  const unionMembers=new Set<string>();
  for(const u of s.politicalUnions){id(u.id);if(!Array.isArray(u.members)||u.members.length<2||u.members.length>6||new Set(u.members).size!==u.members.length||!u.members.includes(u.leaderId)||!tick(u.startedTick)||u.startedTick>s.tick)throw Error('Invalid political union');for(const n of u.members){nation(n);if(unionMembers.has(n))throw Error('Conflicting political unions');unionMembers.add(n);}}
  for(const e of s.diplomaticHistory){id(e.id);if(!tick(e.tick)||e.tick>s.tick||!Array.isArray(e.countries)||!e.countries.length||e.countries.length>6||new Set(e.countries).size!==e.countries.length||typeof e.kind!=='string'||e.kind.length>40||typeof e.message!=='string'||e.message.length>300)throw Error('Invalid diplomatic event');for(const n of e.countries)nation(n);}
  for(const l of Object.values(s.diplomacy!)){
    if(migrate){l.baselineRelation??=l.relation;l.trust??=50;l.reasons??=[];l.cooldowns??={};l.guaranteeUntil??={};l.withdrawals??=[];
      l.terms??=[];for(const type of l.treaties)if(!l.terms.some(t=>t.type===type))l.terms.push({id:nextId(s,'legacy-treaty'),type,from:l.a,to:l.b,startedTick:s.tick,untilTick:futureTick(s,RULES.treatyMonths)});
      for(const g of l.guarantors)l.guaranteeUntil[g]??=s.tick+RULES.guaranteeMonths;
      const p=l.proposal;
      if(p&&p.expiresTick>s.tick&&!s.diplomaticOffers.some(o=>o.from===p.from&&o.to===(p.from===l.a?l.b:l.a))){
        const offer:DiplomaticOffer={id:nextId(s,'diplomatic-offer'),from:p.from,to:p.from===l.a?l.b:l.a,terms:p.type==='PoliticalUnion'?{kind:'PoliticalUnion'}:{kind:'Treaty',treaty:p.type},startedTick:Math.max(0,p.expiresTick-RULES.proposalMonths),expiresTick:p.expiresTick,acceptedBy:[p.from]};
        if(offer.startedTick>s.tick||s.diplomaticOffers.length>=RULES.offerLimit)throw Error('Invalid legacy diplomatic offer');s.diplomaticOffers.push(offer);id(offer.id);
      }else if(p&&p.expiresTick<=s.tick)delete l.proposal;
    }
    if(!Number.isFinite(l.baselineRelation)||Math.abs(l.baselineRelation!)>100||!Number.isFinite(l.trust)||l.trust!<0||l.trust!>100||!Array.isArray(l.reasons)||l.reasons.length>32||!Array.isArray(l.terms)||l.terms.length>10||!l.cooldowns||!l.guaranteeUntil||!Array.isArray(l.withdrawals)||l.withdrawals.length>4)throw Error('Invalid diplomacy details');
    const reasonKeys=new Set<string>();for(const r of l.reasons){if(typeof r.key!=='string'||r.key.length>100||reasonKeys.has(r.key)||typeof r.label!=='string'||r.label.length>100||!Number.isFinite(r.value)||Math.abs(r.value)>100||!tick(r.changedTick)||r.changedTick>s.tick)throw Error('Invalid relation reason');reasonKeys.add(r.key);}
    if(l.relation!==bound(l.baselineRelation!+l.reasons.reduce((n,r)=>n+r.value,0)))throw Error('Inconsistent relation reasons');
    const terms=new Set<string>();for(const t of l.terms){id(t.id);const key=t.type==='MilitaryAccess'?t.type+t.from+t.to:t.type;if(!Object.hasOwn(DIPLOMATIC_TREATIES,t.type)||terms.has(key)||!l.treaties.includes(t.type)||![l.a,l.b].includes(t.from)||![l.a,l.b].includes(t.to)||t.from===t.to||!tick(t.startedTick)||t.startedTick>s.tick||!tick(t.untilTick)||t.untilTick<=t.startedTick)throw Error('Invalid treaty terms');terms.add(key);}
    if(l.treaties.some(type=>!l.terms!.some(t=>t.type===type)))throw Error('Treaty has no terms');
    if(typeof l.cooldowns!=='object'||Array.isArray(l.cooldowns)||Object.keys(l.cooldowns).length>24||typeof l.guaranteeUntil!=='object'||Array.isArray(l.guaranteeUntil)||Object.keys(l.guaranteeUntil).length>2||l.guarantors.some(g=>!tick(l.guaranteeUntil![g])))throw Error('Invalid diplomatic ledgers');
    for(const [key,value]of Object.entries(l.cooldowns))if(!key.startsWith(l.a+':')&&!key.startsWith(l.b+':')||!tick(value))throw Error('Invalid diplomacy cooldown');
    for(const [key,value]of Object.entries(l.guaranteeUntil))if(!l.guarantors.includes(key)||!tick(value))throw Error('Invalid independence guarantee');
    for(const w of l.withdrawals){if(![l.a,l.b].includes(w.countryId)||!tick(w.untilTick)||!w.routes||typeof w.routes!=='object')throw Error('Invalid access withdrawal');for(const [armyId,route]of Object.entries(w.routes)){const army=s.armies.find(a=>a.id===armyId);if(!army||!Array.isArray(route)||!route.length||route.length>s.provinces.length||new Set(route).size!==route.length||route.some(id=>!s.provinces.some(p=>p.id===id))||army.ownerId!==w.countryId)throw Error('Invalid withdrawal route');}}
    if(l.treaties.includes('PoliticalUnion')&&(!unionOf(s,l.a)||unionOf(s,l.a)!==unionOf(s,l.b)))throw Error('Union treaty has no federation');
  }
  for(const u of s.politicalUnions)for(let i=0;i<u.members.length;i++)for(const other of u.members.slice(i+1))if(!s.diplomacy![pairKey(u.members[i]!,other)]?.treaties.includes('PoliticalUnion'))throw Error('Federation has no union treaty');
}
