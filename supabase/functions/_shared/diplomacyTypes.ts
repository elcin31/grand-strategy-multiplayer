import type {TechnologyBranch} from './technologySystem.ts';
export const DIPLOMATIC_TREATIES={Alliance:'Союз',NonAggression:'Ненападение',DefensivePact:'Оборонительный пакт',MilitaryAccess:'Военный проход',TradeAgreement:'Торговое соглашение',PoliticalUnion:'Политическое объединение'} as const;
export type DiplomaticTreaty=keyof typeof DIPLOMATIC_TREATIES;
export type RelationMissionKind='Improve'|'Damage';
export interface RelationMission {id:string;from:string;to:string;kind:RelationMissionKind;startedTick:number;untilTick:number;lastTick:number;monthlyCost:number}
export interface RelationReason {key:string;label:string;value:number;changedTick:number}
export interface TreatyTerm {id:string;type:DiplomaticTreaty;from:string;to:string;startedTick:number;untilTick:number}
export interface AccessWithdrawal {countryId:string;untilTick:number;routes:Record<string,string[]>}
export interface DiplomaticEvent {id:string;tick:number;countries:string[];kind:string;message:string}
export type DiplomaticTerms=
 | {kind:'Treaty';treaty:Exclude<DiplomaticTreaty,'PoliticalUnion'>}
 | {kind:'TechnologyExchange';give:TechnologyBranch;receive:TechnologyBranch}
 | {kind:'ProvinceTransfer';provinceId:string;price:number}
 | {kind:'Ultimatum';demand:'Payment';amount:number}
 | {kind:'Ultimatum';demand:'Province';provinceId:string}
 | {kind:'PoliticalUnion'}
 | {kind:'Summit';participants:string[];agenda:'Relations'|'TradeAgreement'|'NonAggression'};
export interface DiplomaticOffer {id:string;from:string;to:string;terms:DiplomaticTerms;startedTick:number;expiresTick:number;acceptedBy:string[]}
export interface PoliticalUnion {id:string;members:string[];leaderId:string;startedTick:number}
export const DIPLOMACY_RULES={missionMonths:12,missionMonthlyCost:3,missionSetupCost:20,missionPoliticalCost:10,insultPoliticalCost:5,giftPoliticalCost:5,proposalPoliticalCost:8,proposalCost:25,proposalMonths:12,treatyMonths:60,guaranteeMonths:60,withdrawalMonths:6,historyLimit:256,offerLimit:512,unionMinimumMonths:24} as const;
