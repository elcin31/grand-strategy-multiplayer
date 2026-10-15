import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {economicForecast,monthlyConstructionAutomation} from '../supabase/functions/_shared/economicForecast';
import {processResourceTrade,stock} from '../supabase/functions/_shared/stockpileSystem';
import {diplomaticLink,declareWar} from '../supabase/functions/_shared/diplomacySystem';
import {monthlyPoliticalGroups} from '../supabase/functions/_shared/internalPolitics23';
import {recalcEconomy,money} from '../supabase/functions/_shared/economySystem';
import {validateCampaign,encodeCampaign,decodeCampaign} from '../src/persistence/campaignCodec';

function world(){const s=createWorldState('economy-politics23','ECO231','host','QA',91);s.phase='paused';s.players[0]!.countryId='germany';return s;}
test('economic forecast uses the actual budget and recorded import dependency without changing state',()=>{
 const s=world(),c=s.countries.germany!;c.economy!.monthlyBalance=-20;c.stockpile!.amounts.fuel=120;c.stockpile!.produced.fuel=40;c.stockpile!.consumed.fuel=100;c.stockpile!.imported!.fuel=60;
 const before=structuredClone(s),forecast=economicForecast(s,c.id),fuel=forecast.resources.find(r=>r.resource==='fuel')!;
 assert.deepEqual(s,before);assert.equal(forecast.estimated,true);assert.equal(forecast.timeline[0]!.treasury,money(c.treasury-20));assert.equal(fuel.net,0);assert.equal(fuel.importDependency,.6);assert.equal(fuel.monthsWithoutImports,2);assert.equal(fuel.monthsRemaining,null);
 c.stockpile!.imported!.fuel=0;assert.equal(economicForecast(s,c.id).resources.find(r=>r.resource==='fuel')!.monthsRemaining,2);
});
test('actual trade conserves resources and cash ledgers, records imports/exports and stops during war',()=>{
 const s=world(),seller=s.countries.france!,buyer=s.countries.germany!;for(const c of Object.values(s.countries))c.stockpile!.autoTrade=false;
 diplomaticLink(s,'france','germany').treaties=['TradeAgreement'];seller.stockpile!.amounts.iron=100;buyer.stockpile!.amounts.iron=0;
 const contract={id:'trade-test',exporterId:'france',importerId:'germany',offeredBy:'germany',resource:'iron' as const,quantity:10,price:2,months:3,accepted:true,lastTick:0,fulfilled:0,efficiency:0};s.tradeContracts=[contract];s.tick=1;
 processResourceTrade(s);assert.ok(contract.fulfilled>0);assert.equal(stock(seller,'iron')+stock(buyer,'iron'),100);assert.equal(buyer.stockpile!.imported!.iron,contract.fulfilled);assert.equal(seller.stockpile!.exported!.iron,contract.fulfilled);assert.equal(buyer.stockpile!.importExpense,seller.stockpile!.tradeRevenue);
 const once=structuredClone(s);processResourceTrade(s);assert.deepEqual(s,once);
 const link=diplomaticLink(s,'france','germany');link.treaties=[];link.terms=[];declareWar(s,'germany','france');s.tick=2;processResourceTrade(s);assert.equal(contract.fulfilled,0);assert.equal(stock(seller,'iron')+stock(buyer,'iron'),100);
});
test('opt-in construction pays the ordinary price/materials once and obeys reserve, disabling and authority',()=>{
 let s=world();assert.equal(s.countries.germany!.stockpile!.autoBuild,false);
 s.countries.germany!.treasury=10000;s=applyServerCommand(s,{type:'SET_CONSTRUCTION_AUTOMATION',playerId:'host',enabled:true},'host');s.phase='running';s.tick=1;
 const before=s.countries.germany!.treasury;monthlyConstructionAutomation(s);assert.equal(s.constructions!.length,1);assert.equal(s.countries.germany!.treasury,money(before-s.constructions![0]!.cost));
 const once=structuredClone(s);monthlyConstructionAutomation(s);assert.deepEqual(s,once);
 s=applyServerCommand(s,{type:'SET_CONSTRUCTION_AUTOMATION',playerId:'host',enabled:false},'host');s.constructions=[];s.tick=2;monthlyConstructionAutomation(s);assert.equal(s.constructions.length,0);
 assert.throws(()=>applyServerCommand(s,{type:'SET_CONSTRUCTION_AUTOMATION',playerId:'intruder',enabled:true},'host'));
 assert.throws(()=>applyServerCommand(s,{type:'SET_CONSTRUCTION_AUTOMATION',playerId:'host',enabled:true,budget:-1} as never,'host'));
});
test('taxes and mobilisation affect real group support; sustained opposition feeds bounded stability once per month',()=>{
 let s=world(),initial=s.countries.germany!.politicalGroups!.Civic.support;
 s=applyServerCommand(s,{type:'SET_TAX_RATE',playerId:'host',taxRate:60},'host');assert.ok(s.countries.germany!.politicalGroups!.Civic.support<initial);
 initial=s.countries.germany!.politicalGroups!.Civic.support;s=applyServerCommand(s,{type:'SET_MOBILIZATION',playerId:'host',level:'General'},'host');const c=s.countries.germany!;assert.ok(c.politicalGroups!.Civic.support<initial);c.warExhaustion=80;
 const stability=c.stability;for(let i=0;i<24;i++){s.tick++;monthlyPoliticalGroups(s,c);}assert.ok(c.stability<stability);assert.ok(Object.values(c.politicalGroups!).every(g=>g.support>=0&&g.support<=100));
 const once=structuredClone(s);monthlyPoliticalGroups(s,c);assert.deepEqual(s,once);recalcEconomy(s);assert.deepEqual(decodeCampaign(encodeCampaign(s,1)).state,s);
 const invalid=structuredClone(s);invalid.countries.germany!.politicalGroups!.Military.influence=101;assert.throws(()=>validateCampaign(invalid));
});

test('schema27 migration preserves campaign progress and keeps an exact pre-upgrade backup',async()=>{
 const {CampaignStore}=await import('../src/persistence/campaignStore');const {stateChecksum}=await import('../supabase/functions/_shared/sessionState');
 const old=world();old.stateVersion=27;
 for(const c of Object.values(old.countries)){delete c.politicalGroups;delete c.politicalGroupTick;delete c.politicalGroupReason;delete c.stockpile!.imported;delete c.stockpile!.exported;delete c.stockpile!.autoBuild;delete c.stockpile!.autoBuildTick;}
 const raw=JSON.stringify({format:1,metadata:{id:old.id,name:'Existing campaign',generation:1},checksum:stateChecksum(old),state:old}),files=new Map([[old.id+'.1.json',raw]]);
 const store=new CampaignStore({list:async()=>[...files.keys()],read:async n=>files.get(n)!,write:async(n,t)=>{files.set(n,t);},move:async(a,b)=>{files.set(b,files.get(a)!);files.delete(a);},remove:async n=>{files.delete(n);}});
 const loaded=await store.load(old.id),protectedCopy=structuredClone(loaded);protectedCopy.stateVersion=27;
 for(const c of Object.values(protectedCopy.countries)){delete c.politicalGroups;delete c.politicalGroupTick;delete c.politicalGroupReason;delete c.stockpile!.imported;delete c.stockpile!.exported;delete c.stockpile!.autoBuild;delete c.stockpile!.autoBuildTick;}
 assert.deepEqual(protectedCopy,old);assert.ok(Object.values(loaded.countries).every(c=>c.stockpile!.autoBuild===false));
 await store.save(loaded);assert.equal(files.get(old.id+'.before-dominion23-v28.backup'),raw);assert.deepEqual(await store.load(old.id),loaded);
});
