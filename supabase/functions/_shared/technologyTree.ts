import type {Country,GameState,BuildingType} from './gameTypes.ts';
import type {TechnologyBranch} from './technologySystem.ts';
export const TECHNOLOGY_DIRECTIONS={Economy:'Экономика',Military:'Военное дело',Infrastructure:'Инфраструктура',Science:'Наука',State:'Государство и связь'} as const;
export type TechnologyDirection=keyof typeof TECHNOLOGY_DIRECTIONS;
export interface TechnologyNode {name:string;direction:TechnologyDirection;legacy?:TechnologyBranch;level:number;year:number;cost:number;months:number;prerequisites:readonly string[];effect:string;art:BuildingType}
function node(name:string,direction:TechnologyDirection,level:number,year:number,prerequisites:readonly string[],effect:string,art:BuildingType,legacy?:TechnologyBranch):TechnologyNode{return {name,direction,level,year,prerequisites,effect,art,...legacy?{legacy}:{},cost:legacy?150*level:180+60*(level-1),months:legacy?6+3*(level-1):6+2*level};}
/** Original Dominion names/graph. Existing paid levels remain authoritative;
 * their projected nodes cannot be granted twice by research or exchange. */
const catalogue={
 'eco-ledger':node('Национальная бухгалтерия','Economy',1,1850,[],'Налоги +4%; открывает научный метод','Administration','Economy'),
 'eco-production':node('Производственные стандарты','Economy',2,1880,['eco-ledger'],'Налоги +4%','Factory','Economy'),
 'eco-market':node('Общий внутренний рынок','Economy',3,1910,['eco-production'],'Налоги +4%','Port','Economy'),
 'eco-credit':node('Системы государственного кредита','Economy',4,1945,['eco-market'],'Налоги +4%','Administration','Economy'),
 'eco-planning':node('Макроэкономическое планирование','Economy',5,1975,['eco-credit'],'Налоги +4%','University','Economy'),
 'mil-staff':node('Штабная подготовка','Military',1,1900,[],'Боевая сила +6%; артиллерия, механизация и ПВО в доступной эпохе','Barracks','Military'),
 'mil-combined':node('Согласованные действия родов войск','Military',2,1920,['mil-staff'],'Боевая сила +6%; бронетехника','Fort','Military'),
 'mil-special':node('Специализированные соединения','Military',3,1940,['mil-combined'],'Боевая сила +6%; спецназ','Barracks','Military'),
 'mil-operational':node('Оперативная координация','Military',4,1965,['mil-special'],'Боевая сила +6%','Fort','Military'),
 'mil-precision':node('Точное управление войсками','Military',5,1985,['mil-operational'],'Боевая сила +6%','University','Military'),
 'infra-rail':node('Стандарты транспортной сети','Infrastructure',1,1850,[],'Ресурсы +5%; ёмкость снабжения +4%; строительство +2%','Infrastructure','Industry'),
 'infra-electric':node('Электрификация производства','Infrastructure',2,1890,['infra-rail'],'Ресурсы +5%; ёмкость снабжения +4%; строительство +2%','Factory','Industry'),
 'infra-roads':node('Моторные транспортные коридоры','Infrastructure',3,1920,['infra-electric'],'Ресурсы +5%; ёмкость снабжения +4%; строительство +2%','Infrastructure','Industry'),
 'infra-freight':node('Унифицированные грузовые системы','Infrastructure',4,1950,['infra-roads'],'Ресурсы +5%; ёмкость снабжения +4%; строительство +2%','Port','Industry'),
 'infra-logistics':node('Связанные логистические центры','Infrastructure',5,1980,['infra-freight'],'Ресурсы +5%; ёмкость снабжения +4%; строительство +2%','Infrastructure','Industry'),
 'science-method':node('Воспроизводимый научный метод','Science',1,1850,['eco-ledger'],'Исследования +5%; строительство +1%; разведка +2 п.п.','University'),
 'science-academies':node('Сеть национальных академий','Science',2,1880,['science-method','state-registry'],'Исследования +5%; строительство +1%; разведка +2 п.п.','University'),
 'science-electronics':node('Прикладная электроника','Science',3,1930,['science-academies','infra-electric'],'Исследования +5%; строительство +1%; разведка +2 п.п.','Factory'),
 'science-computing':node('Вычислительные институты','Science',4,1950,['science-electronics','infra-roads'],'Исследования +5%; строительство +1%; разведка +2 п.п.','University'),
 'science-networks':node('Распределённые научные сети','Science',5,1980,['science-computing','comm-wire'],'Исследования +5%; строительство +1%; разведка +2 п.п.','University'),
 'state-registry':node('Государственные реестры','State',1,1850,[],'Стабильность +0,6 в год','Administration','Administration'),
 'state-service':node('Профессиональная гражданская служба','State',2,1880,['state-registry'],'Стабильность +0,6 в год','Administration','Administration'),
 'state-planning':node('Согласованное управление ведомствами','State',3,1920,['state-service'],'Стабильность +0,6 в год','Administration','Administration'),
 'state-statistics':node('Системы государственной статистики','State',4,1950,['state-planning'],'Стабильность +0,6 в год','University','Administration'),
 'state-digital':node('Единое информационное управление','State',5,1980,['state-statistics'],'Стабильность +0,6 в год','Administration','Administration'),
 'comm-post':node('Постоянные дипломатические каналы','State',1,1850,[],'Оценка договоров +4','Administration','Diplomacy'),
 'comm-wire':node('Защищённая межгосударственная связь','State',2,1880,['comm-post'],'Оценка договоров +4; дополнительная группа разведки','Administration','Diplomacy'),
 'comm-radio':node('Оперативная дипломатическая связь','State',3,1920,['comm-wire'],'Оценка договоров +4','University','Diplomacy'),
 'comm-satellite':node('Глобальные системы переговоров','State',4,1960,['comm-radio'],'Оценка договоров +4; дополнительная группа разведки','University','Diplomacy'),
 'comm-network':node('Объединённые коммуникационные службы','State',5,1990,['comm-satellite'],'Оценка договоров +4','Administration','Diplomacy'),
};
export type TechnologyId=keyof typeof catalogue;
export type TechnologyToken=TechnologyId|TechnologyBranch;
export const TECHNOLOGY_NODES:Readonly<Record<TechnologyId,TechnologyNode>>=catalogue;
export const TECHNOLOGY_IDS=Object.keys(catalogue) as TechnologyId[];
export function technologyNode(id:string):TechnologyNode|undefined{return Object.hasOwn(TECHNOLOGY_NODES,id)?(TECHNOLOGY_NODES as Readonly<Record<string,TechnologyNode>>)[id]:undefined;}
export function legacyTechnologyNode(branch:TechnologyBranch,level:number):TechnologyId|undefined{return TECHNOLOGY_IDS.find(id=>catalogue[id].legacy===branch&&catalogue[id].level===level);}
export function hasTechnology(c:Country,id:string):boolean {const n=technologyNode(id);return !!n&&(n.legacy?(c.technologies?.[n.legacy]??0)>=n.level:(c.scientificDiscoveries??[]).includes(id as TechnologyId));}
export function scienceLevel(c:Country):number{return c.scientificDiscoveries?.length??0;}
export function technologyRequirements(s:GameState,c:Country,id:string):string|null {
 const n=technologyNode(id);if(!n)return 'Неизвестная технология';if(hasTechnology(c,id))return 'Технология уже открыта';if(s.year<n.year)return `Доступно с ${n.year} года`;
 if(n.prerequisites.some(p=>!hasTechnology(c,p)))return 'Сначала откройте обязательные предшественники';if(n.legacy&&(c.technologies?.[n.legacy]??0)+1!==n.level)return 'Нужен следующий уровень направления';return null;
}
export function namedResearchQuote(s:GameState,c:Country,id:string){const n=technologyNode(id);let reason=technologyRequirements(s,c,id);if(!reason&&(!s.dataset||!['running','paused'].includes(s.phase)||!c.provinceIds?.length))reason='Нужна начатая кампания';if(!reason&&c.research)reason='Исследование уже идёт';if(!reason&&s.tick<(c.bankruptcyUntilTick??0))reason='Исследования приостановлены после банкротства';if(!reason&&c.treasury<n!.cost)reason='Недостаточно средств';return {cost:n?.cost??0,months:n?.months??0,reason};}
export function grantTechnology(s:GameState,c:Country,id:string):void {const reason=technologyRequirements(s,c,id);if(reason)throw Error(reason);const n=technologyNode(id)!;if(c.research&&(c.research.branch===n.legacy||c.research.branch==='Science'&&n.direction==='Science'))throw Error('Направление уже исследуется');if(n.legacy)c.technologies![n.legacy]=n.level;else c.scientificDiscoveries!.push(id as TechnologyId);}
export function resolveExchangeNode(source:Country,recipient:Country,token:TechnologyToken):TechnologyId|undefined {const id=technologyNode(token)?token as TechnologyId:legacyTechnologyNode(token as TechnologyBranch,(recipient.technologies?.[token as TechnologyBranch]??0)+1);return id&&hasTechnology(source,id)?id:undefined;}
export function technologyTokenName(token:TechnologyToken):string{return technologyNode(token)?.name??({Economy:'Экономика',Military:'Военное дело',Administration:'Управление',Diplomacy:'Дипломатия',Industry:'Инфраструктура'} as const)[token as TechnologyBranch];}
export function initializeTechnologyTree(s:GameState,migrate:boolean):void {
 if(!s.dataset)return;for(const c of Object.values(s.countries)){
  if(migrate)c.scientificDiscoveries??=[];
  if(!Array.isArray(c.scientificDiscoveries)||new Set(c.scientificDiscoveries).size!==c.scientificDiscoveries.length||c.scientificDiscoveries.length>5||c.scientificDiscoveries.some(id=>typeof id!=='string'||technologyNode(id)?.direction!=='Science'))throw Error('Invalid scientific discoveries');
  for(const id of c.scientificDiscoveries)if(technologyNode(id)!.prerequisites.some(p=>!hasTechnology(c,p)))throw Error('Missing scientific prerequisite');
  const r=c.research;if(r?.nodeId!==undefined){const n=technologyNode(r.nodeId);if(typeof r.nodeId!=='string'||!n||n.level!==r.targetLevel||n.months!==r.required||n.legacy!== (r.branch==='Science'?undefined:r.branch)||hasTechnology(c,r.nodeId)||s.year<n.year||n.prerequisites.some(p=>!hasTechnology(c,p)))throw Error('Invalid named research project');}
  if(r?.branch==='Science'&&!r.nodeId)throw Error('Missing scientific project');
 }
}
