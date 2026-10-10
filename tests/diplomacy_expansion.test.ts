import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {diplomaticLink,pairKey,declareWar,warBetween} from '../supabase/functions/_shared/diplomacySystem';
import {monthlyDiplomacy2,relationChange,canEnterTerritory,diplomacyAcceptance,diplomacyQuote,initializeDiplomacy2,refreshRelationFactors,pruneAccessWithdrawals,diplomacyBudget} from '../supabase/functions/_shared/diplomacy2System';
import {startResearch} from '../supabase/functions/_shared/technologySystem';
import {monthlyEconomy,money,recalcEconomy} from '../supabase/functions/_shared/economySystem';
import {advanceArmyOrders} from '../supabase/functions/_shared/armyOrders';
import {encodeCampaign,decodeCampaign,validateCampaign} from '../src/persistence/campaignCodec';
import {CampaignStore,type CampaignFiles} from '../src/persistence/campaignStore';
import {stateChecksum} from '../supabase/functions/_shared/sessionState';
import {runStrategicAI} from '../supabase/functions/_shared/aiSystem';
import {assertInvariants} from './helpers/invariants';
import type {GameState,GameCommand} from '../supabase/functions/_shared/gameTypes';
import type {DiplomaticTerms} from '../supabase/functions/_shared/diplomacyTypes';
function world(){const s=createWorldState('diplomacy2','DIP002','host','QA',101);s.phase='paused';s.speed=0;s.players[0]!.countryId='germany';s.players.push({id:'guest',displayName:'France',countryId:'france',isHost:false,ready:true});return s;}
function command(s:GameState,c:GameCommand,actor='host'){return applyServerCommand(s,c,actor);}
function accepted(s:GameState,terms:DiplomaticTerms){let n=command(s,{type:'OFFER_DIPLOMACY',playerId:'host',targetId:'france',terms});const offer=n.diplomaticOffers!.find(o=>o.from==='germany'&&o.to==='france')!;return command(n,{type:'RESPOND_DIPLOMACY',playerId:'guest',offerId:offer.id,accept:true},'guest');}
function border(s:GameState){const home=s.provinces.find(p=>p.ownerId==='germany'&&p.neighbors.some(id=>s.provinces.find(q=>q.id===id)?.ownerId==='france'))!,foreign=s.provinces.find(p=>p.ownerId==='france'&&home.neighbors.includes(p.id))!;return{home,foreign,army:s.armies.find(a=>a.ownerId==='germany')!};}
test('gift conserves fixed-precision cash, charges political power once, and rejects spoofing/cooldown/overflow',()=>{
  const s=world(),snapshot=structuredClone(s),before=money(s.countries.germany!.treasury+s.countries.france!.treasury),c={type:'SEND_GIFT',playerId:'host',targetId:'france',amount:123.456} as const,n=command(s,c);
  assert.deepEqual(s,snapshot);assert.equal(money(n.countries.germany!.treasury+n.countries.france!.treasury),before);assert.equal(n.countries.germany!.politicalPower,s.countries.germany!.politicalPower!-5);assert.equal(n.diplomacy![pairKey('germany','france')]!.trust,53);
  assert.throws(()=>command(n,c));assert.throws(()=>command(s,{...c,playerId:'guest'}));
  for(const amount of [NaN,Infinity,-1,0,.0001,1_000_001])assert.throws(()=>command(s,{...c,amount}));
  assert.throws(()=>command(s,{...c,relation:100} as never));s.countries.france!.treasury=Math.floor(Number.MAX_SAFE_INTEGER/1000);assert.throws(()=>command(s,c),/overflow/);assert.deepEqual(n,decodeCampaign(encodeCampaign(n,1)).state);
});
test('relation missions are gradual, charge exactly twelve monthly expenses, and cancel without cancelling movement',()=>{
  let n=world();const {army,home}=border(n);army.provinceId=home.id;const target=home.neighbors.find(id=>n.provinces.find(p=>p.id===id)?.ownerId==='germany')!;
  n=command(n,{type:'ORDER_ARMY',playerId:'host',armyId:army.id,provinceId:target});n=command(n,{type:'START_RELATION_MISSION',playerId:'host',targetId:'france',kind:'Improve'});const start=n.countries.germany!.treasury;
  assert.equal(n.diplomacy![pairKey('germany','france')]!.relation,0);assert.equal(n.countries.germany!.economy!.diplomaticMaintenance,3);
  let expected=start;for(let i=1;i<=12;i++){n.tick=i;monthlyDiplomacy2(n);recalcEconomy(n);expected=money(expected+n.countries.germany!.economy!.monthlyBalance);monthlyEconomy(n);assert.equal(n.countries.germany!.treasury,expected);assert.equal(n.relationMissions![0]!.lastTick,i);}
  assert.equal(n.diplomacy![pairKey('germany','france')]!.reasons!.find(r=>r.key==='Improve:germany')!.value,36);
  const before=structuredClone(n.diplomacy);monthlyDiplomacy2(n);assert.deepEqual(n.diplomacy,before);n.tick=13;monthlyDiplomacy2(n);recalcEconomy(n);assert.equal(n.relationMissions!.length,0);assert.equal(n.countries.germany!.economy!.diplomaticMaintenance,0);
  n.tick=15;n=command(n,{type:'START_RELATION_MISSION',playerId:'host',targetId:'france',kind:'Damage'});const mission=n.relationMissions![0]!;
  assert.throws(()=>command(n,{type:'CANCEL_RELATION_MISSION',playerId:'guest',missionId:mission.id},'guest'));n=command(n,{type:'CANCEL_RELATION_MISSION',playerId:'host',missionId:mission.id});assert.ok(n.armies.find(a=>a.id===army.id)!.order);assert.equal(n.countries.germany!.economy!.diplomaticMaintenance,0);
});
test('insults trigger NPC reactions, mission capacity/reserve and wartime restrictions are authoritative',()=>{
  let s=world();s=command(s,{type:'SEND_INSULT',playerId:'host',targetId:'poland'});assert.equal(s.diplomacy![pairKey('germany','poland')]!.relation,-25);assert.ok(s.diplomaticHistory!.some(e=>e.kind==='InsultResponse'));assert.throws(()=>command(s,{type:'SEND_INSULT',playerId:'host',targetId:'poland'}));
  s=command(s,{type:'START_RELATION_MISSION',playerId:'host',targetId:'france',kind:'Improve'});s=command(s,{type:'START_RELATION_MISSION',playerId:'host',targetId:'spain',kind:'Damage'});assert.throws(()=>command(s,{type:'START_RELATION_MISSION',playerId:'host',targetId:'italy',kind:'Improve'}),/дипломатов/);
  const poor=world();poor.countries.germany!.treasury=28;assert.throws(()=>command(poor,{type:'START_RELATION_MISSION',playerId:'host',targetId:'france',kind:'Improve'}),/резерв/);
  const war=world();declareWar(war,'germany','france');assert.throws(()=>command(war,{type:'SEND_GIFT',playerId:'host',targetId:'france',amount:5}));assert.throws(()=>command(war,{type:'START_RELATION_MISSION',playerId:'host',targetId:'france',kind:'Damage'}));
});
test('NPC rejection commits cost/history/cooldown; previews are read-only and human refusal has no reward',()=>{
  const s=world(),terms={kind:'Treaty',treaty:'NonAggression'} as const,copy=structuredClone(s);diplomacyAcceptance(s,'germany','poland',terms);diplomacyQuote(s,'germany','poland',terms);assert.deepEqual(s,copy);
  const n=command(s,{type:'OFFER_DIPLOMACY',playerId:'host',targetId:'poland',terms});assert.equal(n.countries.germany!.treasury,money(s.countries.germany!.treasury-25));assert.equal(n.countries.germany!.politicalPower,s.countries.germany!.politicalPower!-8);assert.ok(n.diplomaticHistory!.some(e=>e.kind==='OfferRejected'));assert.equal(n.diplomaticOffers!.length,0);assert.throws(()=>command(n,{type:'OFFER_DIPLOMACY',playerId:'host',targetId:'poland',terms}));
  let human=command(s,{type:'OFFER_DIPLOMACY',playerId:'host',targetId:'france',terms});const offer=human.diplomaticOffers![0]!;assert.throws(()=>command(human,{type:'RESPOND_DIPLOMACY',playerId:'host',offerId:offer.id,accept:true}));human=command(human,{type:'RESPOND_DIPLOMACY',playerId:'guest',offerId:offer.id,accept:false},'guest');assert.equal(human.diplomacy![pairKey('germany','france')]!.treaties.length,0);assert.equal(human.diplomaticOffers!.length,0);
});
test('military access is directional and peaceful movement preserves ownership, cities and foreign armies',()=>{
  const s=world(),{army,home,foreign}=border(s);army.provinceId=home.id;let n=accepted(s,{kind:'Treaty',treaty:'MilitaryAccess'});const cities=structuredClone(n.cities),foreignArmy=structuredClone(n.armies.find(a=>a.ownerId==='france'));
  assert.equal(canEnterTerritory(n,'germany','france'),true);assert.equal(canEnterTerritory(n,'france','germany'),false);n=command(n,{type:'ORDER_ARMY',playerId:'host',armyId:army.id,provinceId:foreign.id});assert.equal(n.armies.find(a=>a.id===army.id)!.order!.type,'MOVE');
  n=command(n,{type:'MOVE_ARMY',playerId:'host',armyId:army.id,provinceId:foreign.id});assert.equal(n.provinces.find(p=>p.id===foreign.id)!.ownerId,'france');assert.equal(n.provinces.find(p=>p.id===foreign.id)!.controllerId,'france');assert.deepEqual(n.cities,cities);assert.deepEqual(n.armies.find(a=>a.ownerId==='france'),foreignArmy);assert.equal(n.battleLog.length,0);
  const term=n.diplomacy![pairKey('germany','france')]!.terms![0]!;n=command(n,{type:'TERMINATE_TREATY',playerId:'guest',targetId:'germany',treatyId:term.id},'guest');assert.equal(n.diplomacy![pairKey('germany','france')]!.truceUntilTick,0);const retreat=n.armies.find(a=>a.id===army.id)!;assert.ok(retreat.order);const foreign2=n.provinces.find(p=>p.ownerId==='france'&&p.id!==foreign.id)!;assert.throws(()=>command(n,{type:'ORDER_ARMY',playerId:'host',armyId:army.id,provinceId:foreign2.id}));
  advanceArmyOrders(n,(_s,_owner,_army,target)=>{retreat.provinceId=target;});assert.equal(n.provinces.find(p=>p.id===retreat.provinceId)!.ownerId,'germany');assert.equal(retreat.order,undefined);assert.equal(canEnterTerritory(n,'germany','france',retreat.id,foreign.id),false);assert.deepEqual(n,decodeCampaign(encodeCampaign(n,1)).state);
});
test('trade increases real income and expires; only defensive commitments create cancellation truces',()=>{
  const s=world(),before=s.countries.germany!.economy!.tradeIncome;let n=accepted(s,{kind:'Treaty',treaty:'TradeAgreement'});assert.ok(n.countries.germany!.economy!.tradeIncome>before);n.tick=60;monthlyDiplomacy2(n);recalcEconomy(n);assert.equal(n.diplomacy![pairKey('germany','france')]!.treaties.length,0);assert.equal(n.countries.germany!.economy!.tradeIncome,before);
  for(const treaty of ['TradeAgreement','MilitaryAccess','NonAggression','DefensivePact','Alliance'] as const){let c=accepted(world(),{kind:'Treaty',treaty});c=command(c,{type:'DIPLOMATIC_ACTION',playerId:'host',targetId:'france',action:'Cancel'});assert.equal(c.diplomacy![pairKey('germany','france')]!.truceUntilTick,['TradeAgreement','MilitaryAccess'].includes(treaty)?0:6);}
});
test('alliances join both offensive and defensive coalitions; defensive pacts do not join offensive wars',()=>{
  for(const treaty of ['Alliance','DefensivePact'] as const){let s=accepted(world(),{kind:'Treaty',treaty});let war=declareWar(s,'germany','poland');assert.equal(war.attackers.includes('france'),treaty==='Alliance');s=accepted(world(),{kind:'Treaty',treaty});war=declareWar(s,'poland','germany');assert.ok(war.defenders.includes('france'));}
});
test('technology exchange grants the next eligible levels once, blocks active research, and changes gameplay',()=>{
  const s=world();s.countries.germany!.technologies!.Economy=1;s.countries.france!.technologies!.Military=1;recalcEconomy(s);const income=s.countries.france!.economy!.taxIncome;let n=accepted(s,{kind:'TechnologyExchange',give:'Economy',receive:'Military'});
  assert.equal(n.countries.france!.technologies!.Economy,1);assert.equal(n.countries.germany!.technologies!.Military,1);assert.ok(n.countries.france!.economy!.taxIncome>income);assert.equal(n.diplomaticOffers!.length,0);assert.throws(()=>command(n,{type:'RESPOND_DIPLOMACY',playerId:'guest',offerId:'unknown',accept:true},'guest'));
  const busy=world();busy.countries.germany!.technologies!.Economy=2;busy.countries.france!.technologies!.Military=1;startResearch(busy,busy.countries.france!,'Economy');assert.throws(()=>accepted(busy,{kind:'TechnologyExchange',give:'Economy',receive:'Military'}),/исследование/);
  assert.throws(()=>accepted(world(),{kind:'TechnologyExchange',give:'Economy',receive:'Military'}),/уровень/);assert.deepEqual(n,decodeCampaign(encodeCampaign(n,1)).state);
});
test('province sale transfers consented territory/cities/population for exact payment without touching capitals',()=>{
  const s=world(),p=s.provinces.find(p=>p.ownerId==='germany'&&!s.cities!.some(c=>c.provinceId===p.id&&c.isCapital)&&!s.armies.some(a=>a.provinceId===p.id))!,before=money(s.countries.germany!.treasury+s.countries.france!.treasury),a=s.countries.germany!.population,b=s.countries.france!.population;
  const n=accepted(s,{kind:'ProvinceTransfer',provinceId:p.id,price:50.125});assert.equal(n.provinces.find(x=>x.id===p.id)!.ownerId,'france');assert.equal(n.provinces.find(x=>x.id===p.id)!.controllerId,'france');assert.ok(n.cities!.filter(c=>c.provinceId===p.id).every(c=>c.countryId==='france'));assert.equal(n.countries.germany!.population,a-p.population);assert.equal(n.countries.france!.population,b+p.population);assert.equal(money(n.countries.germany!.treasury+n.countries.france!.treasury),money(before-25));assert.equal(n.countries.germany!.treasury,money(s.countries.germany!.treasury-25+50.125));assertInvariants(n);assert.deepEqual(n,decodeCampaign(encodeCampaign(n,1)).state);
  const capital=s.cities!.find(c=>c.countryId==='germany'&&c.isCapital)!;assert.throws(()=>accepted(s,{kind:'ProvinceTransfer',provinceId:capital.provinceId,price:0}),/Столицу/);assert.throws(()=>accepted(s,{kind:'ProvinceTransfer',provinceId:s.provinces.find(p=>p.ownerId==='poland')!.id,price:0}));
});
test('summits require every human consent and settle all pairs once; malformed participants and forged rewards fail',()=>{
  let s=world();s.players.push({id:'third',displayName:'Poland',countryId:'poland',isHost:false,ready:true});s=command(s,{type:'OFFER_DIPLOMACY',playerId:'host',targetId:'france',terms:{kind:'Summit',participants:['germany','france','poland'],agenda:'TradeAgreement'}});const offer=s.diplomaticOffers![0]!;
  s=command(s,{type:'RESPOND_DIPLOMACY',playerId:'guest',offerId:offer.id,accept:true},'guest');assert.equal(Object.values(s.diplomacy!).some(l=>l.treaties.length),false);s=command(s,{type:'RESPOND_DIPLOMACY',playerId:'third',offerId:offer.id,accept:true},'third');assert.equal(s.diplomaticOffers!.length,0);
  for(const [a,b]of [['germany','france'],['germany','poland'],['france','poland']])assert.ok(s.diplomacy![pairKey(a!,b!)]!.treaties.includes('TradeAgreement'));assert.throws(()=>command(s,{type:'RESPOND_DIPLOMACY',playerId:'third',offerId:offer.id,accept:true},'third'));assert.deepEqual(s,decodeCampaign(encodeCampaign(s,1)).state);
  for(const participants of [['germany','france'],['germany','france','france'],['germany','france','missing']])assert.throws(()=>command(world(),{type:'OFFER_DIPLOMACY',playerId:'host',targetId:'france',terms:{kind:'Summit',participants,agenda:'Relations'}}));
  assert.throws(()=>command(world(),{type:'OFFER_DIPLOMACY',playerId:'host',targetId:'france',terms:{kind:'Summit',participants:['germany','france','poland'],agenda:'Relations',reward:1e6}} as never));
});
test('political union requires mature cooperation, preserves country identities, shares defense and dissolves safely',()=>{
  assert.throws(()=>accepted(world(),{kind:'PoliticalUnion'}),/24 месяцев/);let s=accepted(world(),{kind:'Treaty',treaty:'Alliance'});s.tick=3;s=accepted(s,{kind:'Treaty',treaty:'TradeAgreement'});relationChange(s,'germany','france','fixture','Стратегическое доверие',85);diplomaticLink(s,'germany','france').trust=70;s.tick=26;assert.throws(()=>accepted(s,{kind:'PoliticalUnion'}),/24 месяцев/);s.tick=27;
  const countries=Object.keys(s.countries),cities=s.cities!.length;s=accepted(s,{kind:'PoliticalUnion'});assert.equal(s.politicalUnions!.length,1);assert.deepEqual(Object.keys(s.countries),countries);assert.equal(s.cities!.length,cities);assert.ok(canEnterTerritory(s,'germany','france'));
  const unionTerm=s.diplomacy![pairKey('germany','france')]!.terms!.find(t=>t.type==='PoliticalUnion')!;s=command(s,{type:'TERMINATE_TREATY',playerId:'guest',targetId:'germany',treatyId:unionTerm.id},'guest');assert.equal(s.politicalUnions!.length,0);assert.equal(s.diplomacy![pairKey('germany','france')]!.truceUntilTick,33);assert.deepEqual(s,decodeCampaign(encodeCampaign(s,1)).state);
});
test('ultimatums require credible force and resources; consent transfers cash while refusal creates a crisis',()=>{
  let s=world();assert.throws(()=>accepted(s,{kind:'Ultimatum',demand:'Payment',amount:50}),/военная сила/);const army=s.armies.find(a=>a.ownerId==='germany')!;army.troops=1_000_000;recalcEconomy(s);const before=money(s.countries.germany!.treasury+s.countries.france!.treasury),n=accepted(s,{kind:'Ultimatum',demand:'Payment',amount:50});assert.equal(n.countries.france!.treasury,money(s.countries.france!.treasury-50));assert.equal(money(n.countries.germany!.treasury+n.countries.france!.treasury),money(before-25));assert.ok(!warBetween(n,'germany','france'));
  s=command(s,{type:'OFFER_DIPLOMACY',playerId:'host',targetId:'france',terms:{kind:'Ultimatum',demand:'Payment',amount:50}});s=command(s,{type:'RESPOND_DIPLOMACY',playerId:'guest',offerId:s.diplomaticOffers![0]!.id,accept:false},'guest');assert.equal(s.countries.germany!.aggressiveExpansion,2);assert.ok(s.diplomaticHistory!.some(e=>e.kind==='OfferRejected'));
});
test('contextual relations react to claims, trade and military threats without cumulative drift',()=>{
  let s=accepted(world(),{kind:'Treaty',treaty:'TradeAgreement'});const l=diplomaticLink(s,'germany','france'),p=s.provinces.find(p=>p.ownerId==='france')!;p.originalOwnerId='germany';s.countries.germany!.army=5_000_000;refreshRelationFactors(s);const relation=l.relation;assert.ok(l.reasons!.some(r=>r.key==='context:claims'&&r.value<0));assert.ok(l.reasons!.some(r=>r.key==='context:trade'&&r.value>0));assert.ok(l.reasons!.some(r=>r.key==='context:threat'&&r.value<0));refreshRelationFactors(s);assert.equal(l.relation,relation);
});
test('fully occupied AI still answers a valid peace offer and invalid diplomacy after player timeout cannot abort a tick',()=>{
  const s=world(),w=declareWar(s,'germany','france');s.tick=24;for(const p of s.provinces)if(p.ownerId==='france')p.controllerId='germany';w.peaceOffer={from:'germany',terms:{kind:'WhitePeace',provinceIds:[],amount:0},expiresTick:30};s.players.find(p=>p.id==='guest')!.aiControlled=true;runStrategicAI(s,{recruit:()=>{},move:()=>{}});assert.ok(!s.wars!.some(active=>active.id===w.id));assert.ok(s.provinces.filter(p=>p.ownerId==='france').every(p=>p.controllerId==='france'));
  let changed=world();changed=command(changed,{type:'OFFER_DIPLOMACY',playerId:'host',targetId:'france',terms:{kind:'Treaty',treaty:'Alliance'}});changed.players.find(p=>p.id==='guest')!.aiControlled=true;diplomaticLink(changed,'germany','france').rivals=['france'];assert.doesNotThrow(()=>runStrategicAI(changed,{recruit:()=>{},move:()=>{}}));assert.equal(changed.diplomaticOffers!.length,0);
});
test('legacy schema12 pending diplomacy migrates with deadline/relations intact and gets a byte-exact backup before overwrite',async()=>{
  const s=world();s.stateVersion=12;delete s.relationMissions;delete s.diplomaticOffers;delete s.diplomaticHistory;delete s.politicalUnions;s.diplomacy!['france|germany']={a:'france',b:'germany',relation:42,treaties:['TradeAgreement'],rivals:[],guarantors:['germany'],truceUntilTick:0,proposal:{from:'germany',type:'Alliance',expiresTick:12}};
  const text=JSON.stringify({format:1,metadata:{id:s.id,name:'legacy',generation:1},checksum:stateChecksum(s),state:s}),map=new Map([[s.id+'.1.json',text]]),files:CampaignFiles={list:async()=>[...map.keys()],read:async n=>map.get(n)!,write:async(n,t)=>{map.set(n,t);},move:async(a,b)=>{map.set(b,map.get(a)!);map.delete(a);},remove:async n=>{map.delete(n);}};
  const store=new CampaignStore(files),loaded=await store.load(s.id);assert.equal(loaded.stateVersion,13);assert.equal(loaded.diplomaticOffers![0]!.expiresTick,12);assert.equal(loaded.diplomacy!['france|germany']!.relation,42);assert.equal(loaded.diplomacy!['france|germany']!.terms![0]!.type,'TradeAgreement');await store.save(loaded);assert.equal(map.get(s.id+'.before-expansion-v13.backup'),text);await store.save(loaded);assert.equal(map.get(s.id+'.before-expansion-v13.backup'),text);
  const agreed=command(loaded,{type:'RESPOND_TREATY',playerId:'guest',targetId:'germany',accept:true},'guest');assert.ok(agreed.diplomacy!['france|germany']!.treaties.includes('Alliance'));assert.deepEqual(validateCampaign(agreed),agreed);
});
test('schema13 validation rejects missing arrays, contradictory relations, duplicated treaties and malicious mission references',()=>{
  let s=accepted(world(),{kind:'Treaty',treaty:'NonAggression'});s.diplomacy!['france|germany']!.terms!.push(structuredClone(s.diplomacy!['france|germany']!.terms![0]!));assert.throws(()=>initializeDiplomacy2(s,false));s=world();delete s.diplomaticHistory;assert.throws(()=>validateCampaign(s));s=world();diplomaticLink(s,'germany','france').relation=70;assert.throws(()=>validateCampaign(s),/relation/);
  s=command(world(),{type:'START_RELATION_MISSION',playerId:'host',targetId:'france',kind:'Improve'});s.relationMissions![0]!.to='missing';assert.throws(()=>validateCampaign(s));
});
test('expired alliance/access permissions and trade cannot leak into the next movement or budget tick',()=>{
  for(const treaty of ['Alliance','MilitaryAccess'] as const){const s=accepted(world(),{kind:'Treaty',treaty});assert.ok(canEnterTerritory(s,'germany','france'));s.tick=60;assert.equal(canEnterTerritory(s,'germany','france'),false);}
  let s=accepted(world(),{kind:'Treaty',treaty:'TradeAgreement'});assert.equal(diplomacyBudget(s).tradeBonus.get('germany'),.03);s.tick=60;assert.equal(diplomacyBudget(s).tradeBonus.has('germany'),false);
  s=command(world(),{type:'START_RELATION_MISSION',playerId:'host',targetId:'france',kind:'Improve'});assert.equal(diplomacyBudget(s).costs.get('germany'),3);declareWar(s,'germany','france');assert.equal(diplomacyBudget(s).costs.has('germany'),false);
});
test('summit treaties cannot bypass rivalries and NPC evaluation includes all participants',()=>{
  const s=world(),t={kind:'Summit',participants:['germany','france','poland'],agenda:'TradeAgreement'} as const;
  diplomaticLink(s,'france','poland').rivals=['poland'];assert.throws(()=>command(s,{type:'OFFER_DIPLOMACY',playerId:'host',targetId:'france',terms:{...t,participants:[...t.participants]}}),/Соперничество/);
  const terms:DiplomaticTerms={...t,participants:[...t.participants],agenda:'Relations'},copy=structuredClone(s),rating=diplomacyAcceptance(s,'germany','france',terms);assert.ok(rating.reasons.some(r=>r.value===-50));assert.deepEqual(s,copy);
  assert.equal(diplomacyQuote(s,'germany','france',terms).reason,null);
});
test('withdrawal corridors disappear when the army is destroyed or safely exits; orphaned routes are rejected',()=>{
  const s=world(),{army,foreign}=border(s);let n=accepted(s,{kind:'Treaty',treaty:'MilitaryAccess'});n.armies.find(a=>a.id===army.id)!.provinceId=foreign.id;
  n=command(n,{type:'TERMINATE_TREATY',playerId:'guest',targetId:'germany',treatyId:n.diplomacy!['france|germany']!.terms![0]!.id},'guest');assert.ok(n.diplomacy!['france|germany']!.withdrawals!.length);
  const invalid=structuredClone(n);invalid.armies=invalid.armies.filter(a=>a.id!==army.id);assert.throws(()=>initializeDiplomacy2(invalid,false),/withdrawal/);pruneAccessWithdrawals(invalid);assert.equal(invalid.diplomacy!['france|germany']!.withdrawals!.length,0);initializeDiplomacy2(invalid,false);
  const a=n.armies.find(a=>a.id===army.id)!;a.provinceId=a.order!.targetProvinceId;delete a.order;pruneAccessWithdrawals(n);assert.equal(n.diplomacy!['france|germany']!.withdrawals!.length,0);assert.equal(canEnterTerritory(n,'germany','france',a.id,foreign.id),false);assert.deepEqual(n,decodeCampaign(encodeCampaign(n,1)).state);
});
