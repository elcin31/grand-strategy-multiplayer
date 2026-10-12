import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TECHNOLOGY_IDS,technologyNode,hasTechnology} from '../supabase/functions/_shared/technologyTree';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {startTechnology,monthlyResearch} from '../supabase/functions/_shared/technologySystem';
import {buildingRequirementReason} from '../supabase/functions/_shared/buildingSystem';
import {decodeCampaign,encodeCampaign} from '../src/persistence/campaignCodec';
test('100 technologies form a valid acyclic graph; modern baseline survives save and prerequisite checks',()=>{
 assert.equal(TECHNOLOGY_IDS.length,100);const done=new Set<string>(),visiting=new Set<string>();const visit=(id:string)=>{assert.ok(technologyNode(id),id);if(done.has(id))return;assert.ok(!visiting.has(id),'cycle '+id);visiting.add(id);for(const p of technologyNode(id)!.prerequisites)visit(p);visiting.delete(id);done.add(id);};for(const id of TECHNOLOGY_IDS)visit(id);
 const s=createWorldState('science','SCI001','host','QA',21);s.phase='running';const c=s.countries.germany!;assert.ok(hasTechnology(c,'eco-production'));assert.ok(hasTechnology(c,'ind-steel'));decodeCampaign(encodeCampaign(s,1));assert.throws(()=>startTechnology(s,c,'ind-semiconductors'));
});
test('research grants an actual building capability once and retains paid progress',()=>{
 const s=createWorldState('lab','LAB001','host','QA',21);s.phase='running';const c=s.countries.germany!,p=s.provinces.find(p=>p.ownerId===c.id)!;assert.match(buildingRequirementReason(s,p,'ResearchCenter')!,/исследование/);startTechnology(s,c,'science-institutes');let paused=decodeCampaign(encodeCampaign(s,1)).state;assert.equal(paused.countries.germany!.research!.nodeId,'science-institutes');for(let i=0;i<15&&c.research;i++){s.tick++;monthlyResearch(s);}assert.ok(hasTechnology(c,'science-institutes'));assert.equal(buildingRequirementReason(s,p,'ResearchCenter'),null);assert.throws(()=>startTechnology(s,c,'science-institutes'));paused=decodeCampaign(encodeCampaign(s,2)).state;assert.ok(hasTechnology(paused.countries.germany!,'science-institutes'));
});
