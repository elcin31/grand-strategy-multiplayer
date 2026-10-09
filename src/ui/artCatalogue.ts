import type {BuildingType,GovernmentType} from '../types/game';
import type {TechnologyBranch} from '../../supabase/functions/_shared/technologySystem';
export const BUILDING_ART:Record<BuildingType,number>={Farm:0,Mine:1,Factory:2,Barracks:3,Fort:4,University:5,Port:6,Infrastructure:7,Administration:8,Hospital:9};
export const GOVERNMENT_ART:Record<GovernmentType,number>={'Parliamentary Republic':1,'Presidential Republic':1,'Semi-Presidential Republic':1,'Constitutional Monarchy':0,'Absolute Monarchy':0,'Military Junta':3,Theocracy:4,'One-Party State':1,Federation:2,'Tribal Government':5};
export const RELIGION_ART:Record<string,number>={'christian-catholic':0,'christian-orthodox':0,'christian-protestant':0,'islam-sunni':1,'islam-shia':1,hinduism:2,buddhism:3,judaism:4,shinto:5,sikhism:6,folk:7,secular:7,other:7};
export const TECHNOLOGY_ART:Record<TechnologyBranch,number>={Economy:0,Military:3,Administration:8,Diplomacy:8,Industry:2};
/** Visual identity only; no commander fields or save schema are changed. */
export function portraitSeedFor(id:string):number{let seed=2166136261;for(let i=0;i<id.length;i++)seed=Math.imul(seed^id.charCodeAt(i),16777619);return seed>>>0;}
