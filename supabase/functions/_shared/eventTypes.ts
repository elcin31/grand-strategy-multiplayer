import type {GovernmentType} from './gameTypes.ts';
import type {ResourceType} from './resourceCatalogue.ts';
import type {DecisionId} from './politicalDecisions.ts';

export type EventMetric='stability'|'unrest'|'treasury'|'debt'|'budgetBalance'|'warExhaustion'|'reputation'|'politicalPower';
export type Comparison='lt'|'lte'|'eq'|'gte'|'gt';
export type EventCondition=
 | {kind:'all'|'any';conditions:readonly EventCondition[]}
 | {kind:'not';condition:EventCondition}
 | {kind:'metric';metric:EventMetric;op:Comparison;value:number}
 | {kind:'date';fromYear:number;toYear:number}
 | {kind:'government';value:GovernmentType}
 | {kind:'war';active:boolean}
 | {kind:'resource';resource:ResourceType;amount:number}
 | {kind:'relation';target:string;op:Comparison;value:number}
 | {kind:'province';provinceId:string;owner:'self'|string}
 | {kind:'technology';id:string}
 | {kind:'focus';id:string}
 | {kind:'result';eventId:string;choiceId?:string}
 | {kind:'after';eventId:string;months:number}
 | {kind:'recentPeace';months:number}
 | {kind:'damaged';minimum:number};
export type EventEffect=
 | {kind:'metric';metric:Exclude<EventMetric,'budgetBalance'|'debt'>;amount:number}
 | {kind:'resource';resource:ResourceType;amount:number}
 | {kind:'relation';amount:number}
 | {kind:'unlockFocus';focusId:string}
 | {kind:'decision';decisionId:DecisionId}
 | {kind:'schedule';eventId:string;months:number}
 | {kind:'crisis'};
export interface EventOption {
 id:string;title:string;description:string;
 cost?:{treasury?:number;politicalPower?:number;resources?:Partial<Record<ResourceType,number>>};
 condition?:EventCondition;effects:readonly EventEffect[];
 aiPriority:number;
}
export interface EventDefinition {
 id:string;title:string;description:string;category:'Economy'|'Diplomacy'|'Reform'|'Recovery';
 illustration:'Economy'|'Diplomacy'|'Reform'|'Recovery';
 trigger?:EventCondition;counterpart?:'ClaimNeighbour'|'Ally';
 fromYear:number;toYear:number;deadlineMonths:number;
 options:readonly EventOption[];fallbackChoiceId:string;
}
export interface EventReceipt {startedTick:number;resolvedTick?:number;choiceId?:string}
export interface EventInstance {id:string;eventId:string;countryId:string;createdTick:number;deadlineTick:number;counterpartId?:string;provinceId?:string}
export interface ScheduledEvent {eventId:string;countryId:string;dueTick:number;counterpartId?:string;provinceId?:string}
export interface EventHistory {id:string;eventId:string;countryId:string;choiceId:string;tick:number;automatic:boolean;counterpartId?:string;provinceId?:string}
export interface CampaignEvents {lastTick:number;pending:EventInstance[];scheduled:ScheduledEvent[];history:EventHistory[]}
