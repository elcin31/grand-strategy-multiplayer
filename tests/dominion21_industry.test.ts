import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {monthlyProduction} from '../supabase/functions/_shared/productionSystem';
import {stock,extractResources,processResourceTrade,offerResourceTrade} from '../supabase/functions/_shared/stockpileSystem';
import {applyCommand} from '../supabase/functions/_shared/gameEngine';
import {BUILDING_TYPES} from '../supabase/functions/_shared/buildingSystem';
import {RESOURCE_TYPES} from '../supabase/functions/_shared/resourceCatalogue';
import {pairKey} from '../supabase/functions/_shared/diplomacySystem';
import {encodeCampaign,decodeCampaign} from '../src/persistence/campaignCodec';
test('35 resources and 40 buildings; factories cannot create steel without coal; output consumes inputs once',()=>{
 const s=createWorldState('factory','FAC001','host','QA',21),c=s.countries.germany!,p=s.provinces.find(p=>p.ownerId===c.id)!;assert.equal(RESOURCE_TYPES.length,35);assert.equal(BUILDING_TYPES.length,40);c.technologies!.Industry=3;p.buildings={Steelworks:1};c.stockpile!.amounts.iron=100;c.stockpile!.amounts.coal=0;const steel=stock(c,'steel');s.tick++;monthlyProduction(s);assert.equal(stock(c,'steel'),steel);assert.equal(p.productionResults![0]!.output,0);
 c.stockpile!.amounts.coal=50;s.tick++;const iron=stock(c,'iron');monthlyProduction(s);assert.ok(stock(c,'steel')>steel);assert.ok(stock(c,'iron')<iron);const once=stock(c,'steel');monthlyProduction(s);assert.equal(stock(c,'steel'),once);decodeCampaign(encodeCampaign(s,1));
});
test('contract partial fulfillment respects supply, money and once-only import/export accounting',()=>{
 const s=createWorldState('trade','TRD001','host','QA',21);s.phase='running';const a=s.countries.germany!,b=s.countries.poland!;s.diplomacy![pairKey(a.id,b.id)]={a:a.id,b:b.id,relation:50,treaties:['TradeAgreement'],rivals:[],guarantors:[],truceUntilTick:0};a.stockpile!.amounts.iron=10;b.stockpile!.amounts.iron=0;a.stockpile!.autoTrade=false;b.stockpile!.autoTrade=false;offerResourceTrade(s,a.id,b.id,'iron',25,'Export');const contract=s.tradeContracts![0]!;contract.accepted=true;s.tick++;processResourceTrade(s);assert.equal(contract.fulfilled,10);assert.equal(stock(a,'iron'),0);assert.equal(stock(b,'iron'),10);assert.equal(a.stockpile!.tradeRevenue,b.stockpile!.importExpense);const paid=b.stockpile!.importExpense;processResourceTrade(s);assert.equal(b.stockpile!.importExpense,paid);
});
test('material costs paid on order, cancellation cannot duplicate refunds; extraction capped and replay-safe',()=>{
 let s=createWorldState('build','BLD001','host','QA',21);s.phase='running';s.players[0]!.countryId='germany';const p=s.provinces.find(p=>p.ownerId==='germany')!,before=stock(s.countries.germany!,'timber');s=applyCommand(s,{type:'QUEUE_BUILD',playerId:'host',provinceId:p.id,buildingType:'Farm'},true);assert.ok(stock(s.countries.germany!,'timber')<before);const id=s.constructions![0]!.id;s=applyCommand(s,{type:'CANCEL_CONSTRUCTION',playerId:'host',constructionId:id},true);assert.throws(()=>applyCommand(s,{type:'CANCEL_CONSTRUCTION',playerId:'host',constructionId:id},true));s.tick++;extractResources(s);const amounts={...s.countries.germany!.stockpile!.amounts};extractResources(s);assert.deepEqual(s.countries.germany!.stockpile!.amounts,amounts);
});
