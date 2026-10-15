import {data as scenarioContent} from './scenarioContent.ts';
import {FOCUS_EXPANSION,NATIONAL_SPIRITS} from './focusExpansion.ts';
import type {Country,BuildingType} from './gameTypes.ts';
import type {TechnologyId} from './technologyTree.ts';
export const FOCUS_BRANCHES={Economic:'Экономическое развитие',Military:'Военное развитие',Diplomatic:'Дипломатическое развитие',Political:'Политическое развитие'} as const;
export type FocusBranch=keyof typeof FOCUS_BRANCHES;
export interface FocusBonuses {tax:number;production:number;trade:number;administration:number;armyUpkeep:number;research:number;construction:number;supply:number;combat:number;manpower:number;diplomacy:number}
export interface FocusRewards {resources?:import('./stockpileSystem.ts').ResourceLedger;addSpirits?:import('./focusExpansion.ts').NationalSpiritId[];removeSpirits?:import('./focusExpansion.ts').NationalSpiritId[];treasury?:number;manpower?:number;stability?:number;unrest?:number;politicalPower?:number;reputation?:number;neighborRelations?:number;armyExperience?:number;bonuses?:Partial<FocusBonuses>}
export interface FocusNode {scenarioId?:string;eventUnlock?:boolean;description?:string;choiceEvent?:boolean;name:string;branch:FocusBranch;category:'Generic'|'Regional'|'Unique';duration:number;cost:number;pp:number;prerequisites:readonly string[];eitherPrerequisites?:readonly string[];technologies?:readonly TechnologyId[];exclusiveGroup?:string;region?:string;country?:string;rewards:FocusRewards;art:BuildingType}
function course(name:string,branch:FocusBranch,duration:number,prerequisites:readonly string[],rewards:FocusRewards,art:BuildingType,options:Partial<Omit<FocusNode,'name'|'branch'|'duration'|'prerequisites'|'rewards'|'art'>>={}):FocusNode{return {name,branch,duration,prerequisites,rewards,art,category:'Generic',cost:100+duration*20,pp:10+duration,...options};}
/** All names, choices and graphs are original Dominion content. Permanent
 * capabilities are derived from unique completions, never copied into a second
 * mutable bonus ledger. No political ideology or reference-game focus tree. */
const catalogue:Record<string,FocusNode>={
 ...FOCUS_EXPANSION,
 ...Object.fromEntries(scenarioContent.focuses.map(node=>[node.id,node as unknown as FocusNode])),
 'eco-audit':course('Хозяйственная ревизия','Economic',6,[],{treasury:120,bonuses:{tax:.02}},'Administration'),
 'eco-corridors':course('Хозяйственные коридоры','Economic',8,['eco-audit'],{bonuses:{construction:.05,supply:.05}},'Infrastructure'),
 'eco-production':course('Национальный производственный заказ','Economic',10,['eco-corridors'],{bonuses:{production:.05}},'Factory',{exclusiveGroup:'economic-path'}),
 'eco-exchange':course('Программа внешнего обмена','Economic',10,['eco-corridors'],{bonuses:{trade:.08},reputation:3},'Port',{exclusiveGroup:'economic-path'}),
 'eco-resilience':course('Резерв хозяйственной устойчивости','Economic',12,['eco-corridors'],{treasury:250,stability:3,bonuses:{administration:.05}},'Administration',{eitherPrerequisites:['eco-production','eco-exchange']}),
 'mil-staff':course('Профессиональные штабные школы','Military',6,[],{armyExperience:2,bonuses:{combat:.02}},'Barracks'),
 'mil-supply':course('Территориальные склады снабжения','Military',8,['mil-staff'],{bonuses:{supply:.08}},'Infrastructure'),
 'mil-reserve':course('Система обученного резерва','Military',10,['mil-supply'],{manpower:20000,bonuses:{manpower:.08}},'Barracks',{exclusiveGroup:'military-path'}),
 'mil-specialists':course('Подготовка специалистов соединений','Military',10,['mil-supply'],{armyExperience:3,bonuses:{combat:.04}},'Fort',{exclusiveGroup:'military-path'}),
 'mil-readiness':course('Единые нормы боевой готовности','Military',12,['mil-supply'],{armyExperience:5,bonuses:{armyUpkeep:.03}},'Barracks',{eitherPrerequisites:['mil-reserve','mil-specialists']}),
 'dip-contacts':course('Постоянные зарубежные представительства','Diplomatic',6,[],{neighborRelations:5,bonuses:{diplomacy:2}},'Administration'),
 'dip-markets':course('Совместные торговые комиссии','Diplomatic',8,['dip-contacts'],{bonuses:{trade:.03}},'Port'),
 'dip-dialogue':course('Программа открытого диалога','Diplomatic',10,['dip-markets'],{neighborRelations:5,bonuses:{diplomacy:5}},'University',{exclusiveGroup:'diplomatic-path'}),
 'dip-guarantees':course('Школа оборонных переговоров','Diplomatic',10,['dip-markets'],{reputation:5,bonuses:{combat:.02,supply:.03}},'Fort',{exclusiveGroup:'diplomatic-path'}),
 'dip-trust':course('Долгосрочные международные обязательства','Diplomatic',12,['dip-markets'],{reputation:5,neighborRelations:3,stability:2},'Administration',{eitherPrerequisites:['dip-dialogue','dip-guarantees']}),
 'pol-records':course('Общие правила государственного учёта','Political',6,[],{bonuses:{administration:.03}},'Administration'),
 'pol-service':course('Корпус гражданских специалистов','Political',8,['pol-records'],{bonuses:{research:.03}},'University'),
 'pol-coordination':course('Общие планы центральных ведомств','Political',10,['pol-service'],{stability:5,unrest:-5,bonuses:{tax:.02}},'Administration',{exclusiveGroup:'political-path'}),
 'pol-local':course('Самостоятельность местных советов','Political',10,['pol-service'],{stability:3,unrest:-7,bonuses:{production:.03}},'Hospital',{exclusiveGroup:'political-path'}),
 'pol-welfare':course('Согласованные социальные службы','Political',12,['pol-service'],{stability:4,unrest:-5,politicalPower:15},'Hospital',{eitherPrerequisites:['pol-coordination','pol-local']}),
 'region-europe':course('Континентальные транспортные соглашения','Economic',10,['eco-audit'],{bonuses:{trade:.03,construction:.03}},'Infrastructure',{category:'Regional',region:'Europe'}),
 'region-africa':course('Связь региональных хозяйственных центров','Economic',10,['eco-audit'],{bonuses:{production:.04,supply:.04}},'Infrastructure',{category:'Regional',region:'Africa'}),
 'region-asia':course('Межрегиональные производственные стандарты','Economic',10,['eco-audit'],{bonuses:{production:.04,research:.02}},'Factory',{category:'Regional',region:'Asia'}),
 'region-americas':course('Общие стандарты внутренних перевозок','Economic',10,['eco-audit'],{bonuses:{supply:.05,trade:.03}},'Infrastructure',{category:'Regional',region:'Americas'}),
 'region-oceania':course('Сотрудничество островных портов','Diplomatic',10,['eco-audit'],{bonuses:{trade:.04,supply:.04}},'Port',{category:'Regional',region:'Oceania'}),
 'usa-commissions':course('Межштатные хозяйственные комиссии','Economic',8,['eco-audit'],{bonuses:{trade:.04}},'Administration',{category:'Unique',country:'usa'}),
 'usa-supply':course('Общенациональные снабженческие стандарты','Military',10,['usa-commissions'],{bonuses:{supply:.08}},'Infrastructure',{category:'Unique',country:'usa'}),
 'usa-research':course('Публичные исследовательские контракты','Political',12,['usa-supply'],{bonuses:{research:.08}},'University',{category:'Unique',country:'usa',technologies:['science-method']}),
 'rus-centres':course('Региональные снабженческие центры','Military',8,['eco-audit'],{bonuses:{supply:.08}},'Infrastructure',{category:'Unique',country:'russia'}),
 'rus-transport':course('Унификация транспортных ведомств','Economic',10,['rus-centres'],{bonuses:{construction:.06}},'Infrastructure',{category:'Unique',country:'russia'}),
 'rus-research':course('Кооперация евразийских институтов','Political',12,['rus-transport'],{bonuses:{research:.08}},'University',{category:'Unique',country:'russia',technologies:['science-method']}),
 'chn-production':course('Советы речных производственных округов','Economic',8,['eco-audit'],{bonuses:{production:.04}},'Factory',{category:'Unique',country:'chn'}),
 'chn-corridors':course('Межрегиональный заказ инфраструктуры','Economic',10,['chn-production'],{bonuses:{construction:.06,supply:.05}},'Infrastructure',{category:'Unique',country:'chn'}),
 'chn-research':course('Связь исследовательских центров','Political',12,['chn-corridors'],{bonuses:{research:.08}},'University',{category:'Unique',country:'chn',technologies:['science-method']}),
 'ger-schools':course('Технические школы Рейна','Political',8,['eco-audit'],{bonuses:{research:.04}},'University',{category:'Unique',country:'germany'}),
 'ger-freight':course('Федеральные грузовые стандарты','Economic',10,['ger-schools'],{bonuses:{supply:.05,construction:.04}},'Infrastructure',{category:'Unique',country:'germany'}),
 'ger-research':course('Сеть исследовательских городов','Political',12,['ger-freight'],{bonuses:{research:.08}},'University',{category:'Unique',country:'germany',technologies:['science-method']}),
 'uk-ports':course('Портовые комитеты торговли','Economic',8,['eco-audit'],{bonuses:{trade:.05}},'Port',{category:'Unique',country:'uk'}),
 'uk-supply':course('Сеть прибрежного снабжения','Military',10,['uk-ports'],{bonuses:{supply:.05}},'Port',{category:'Unique',country:'uk'}),
 'uk-research':course('Содружество университетских лабораторий','Political',12,['uk-supply'],{bonuses:{research:.08}},'University',{category:'Unique',country:'uk',technologies:['science-method']}),
};
export type FocusId=string;
export interface FocusCompletion {focusId:FocusId;tick:number}
export interface FocusProject {focusId:FocusId;startedTick:number;lastTick:number;progress:number}
export const FOCUS_NODES:Readonly<Record<FocusId,FocusNode>>=catalogue;
export const FOCUS_IDS=Object.keys(catalogue) as FocusId[];
export function focusNode(id:string):FocusNode|undefined{return Object.hasOwn(FOCUS_NODES,id)?(FOCUS_NODES as Record<string,FocusNode>)[id]:undefined;}
export function focusBelongsTo(c:Country,n:FocusNode):boolean{return (!n.country||n.country===c.id)&&(!n.region||n.region===c.region);}
export function hasFocus(c:Country,id:string):boolean{return !!c.completedFocuses?.some(f=>f.focusId===id);}
const empty:Readonly<FocusBonuses>=Object.freeze({tax:0,production:0,trade:0,administration:0,armyUpkeep:0,research:0,construction:0,supply:0,combat:0,manpower:0,diplomacy:0});
const bonusCache=new WeakMap<Country,{signature:string;bonus:Readonly<FocusBonuses>}>();
export function focusBonuses(c:Country):Readonly<FocusBonuses>{
 const signature=(c.completedFocuses??[]).map(f=>f.focusId).join('|')+'#'+(c.nationalSpirits??[]).join('|')+'#'+Object.keys(c.advisers??{}).join('|');if(signature==='##')return empty;const cached=bonusCache.get(c);if(cached?.signature===signature)return cached.bonus;const bonus={...empty};if(c.advisers?.Economy)bonus.tax+=.02;if(c.advisers?.Military)bonus.combat+=.02;if(c.advisers?.Diplomacy){bonus.diplomacy+=2;bonus.trade+=.02;}if(c.advisers?.Science)bonus.research+=.04;
 for(const id of c.nationalSpirits??[])for(const [key,value] of Object.entries(NATIONAL_SPIRITS[id].bonuses))bonus[key as keyof FocusBonuses]+=value;
 for(const f of c.completedFocuses??[])for(const [key,value] of Object.entries(focusNode(f.focusId)!.rewards.bonuses??{}))bonus[key as keyof FocusBonuses]+=value;
 for(const key of Object.keys(bonus) as (keyof FocusBonuses)[])bonus[key]=Math.max(key==='diplomacy'?-15:-.25,Math.min(key==='diplomacy'?15:.35,Number(bonus[key].toFixed(3))));const result=Object.freeze(bonus);bonusCache.set(c,{signature,bonus:result});return result;
}
export function focusRewardLines(id:FocusId):string[]{
 const r=catalogue[id]!.rewards,lines:string[]=[];
 if(r.treasury)lines.push(`Казна +${r.treasury} млн`);if(r.manpower)lines.push(`Резерв +${r.manpower}`);if(r.stability)lines.push(`Стабильность +${r.stability}`);if(r.unrest)lines.push(`Недовольство ${r.unrest}`);if(r.politicalPower)lines.push(`Политическая сила +${r.politicalPower}`);if(r.reputation)lines.push(`Репутация +${r.reputation}`);if(r.neighborRelations)lines.push(`Отношения с соседями +${r.neighborRelations} (кроме воюющих)`);if(r.armyExperience)lines.push(`Опыт существующих армий +${r.armyExperience}`);
 if(r.resources)lines.push('Материальный резерв: '+Object.entries(r.resources).map(([t,n])=>t+' +'+n).join(', '));if(r.addSpirits)lines.push('Особенности: '+r.addSpirits.map(id=>NATIONAL_SPIRITS[id].name).join(', '));if(r.removeSpirits)lines.push('Устранить: '+r.removeSpirits.map(id=>NATIONAL_SPIRITS[id].name).join(', '));
 const labels:Record<keyof FocusBonuses,string>={tax:'Налоги',production:'Выпуск и ресурсы',trade:'Торговля',administration:'Расходы управления',armyUpkeep:'Содержание армии',research:'Исследования',construction:'Строительство',supply:'Ёмкость снабжения',combat:'Боевая сила',manpower:'Прирост резерва',diplomacy:'Оценка дипломатических предложений'};
 for(const [key,value] of Object.entries(r.bonuses??{})){const k=key as keyof FocusBonuses;lines.push(`${labels[k]} ${['administration','armyUpkeep'].includes(k)?'−':'+'}${k==='diplomacy'?value:Math.round(value*100)}${k==='diplomacy'?'':'%'}`);}return lines;
}
