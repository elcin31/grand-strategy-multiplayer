import type {BuildingType,GovernmentType} from '../types/game';
export const EXPANSION_SCENES={
 'diplomacy-embassy':{category:'Diplomacy',title:'Прибытие посольства'},
 'diplomacy-treaty':{category:'Diplomacy',title:'Подписание договора'},
 'diplomacy-peace':{category:'Diplomacy',title:'Мирные переговоры'},
 'diplomacy-trade':{category:'Diplomacy',title:'Торговое соглашение'},
 'diplomacy-summit':{category:'Diplomacy',title:'Международный саммит'},
 'military-staff':{category:'Military',title:'Работа генерального штаба'},
 'military-supply':{category:'Military',title:'Обоз снабжения'},
 'military-training':{category:'Military',title:'Подготовка армии'},
 'military-fortress':{category:'Military',title:'Оборона крепости'},
 'construction-farm':{category:'Construction',title:'Развитие земледелия'},
 'construction-mine':{category:'Construction',title:'Разработка рудника'},
 'construction-factory':{category:'Construction',title:'Строительство фабрики'},
 'construction-infrastructure':{category:'Construction',title:'Строительство железнодорожного моста'},
 'government-council':{category:'Government',title:'Государственный совет'},
 'government-assembly':{category:'Government',title:'Гражданское собрание'},
 'government-administration':{category:'Government',title:'Государственная канцелярия'},
 'religion-cathedral':{category:'Religion',title:'Соборная архитектура'},
 'religion-courtyard':{category:'Religion',title:'Двор мечети'},
 'religion-temple':{category:'Religion',title:'Буддийский храм'},
 'theme-espionage':{category:'Theme',title:'Разведывательное донесение'},
 'theme-economy':{category:'Theme',title:'Национальный бюджет'},
 'theme-ruler':{category:'Theme',title:'Правитель за работой'},
 'theme-general':{category:'Theme',title:'Полководец'},
 'theme-technology':{category:'Theme',title:'Исследовательская лаборатория'},
 'theme-focus':{category:'Theme',title:'Национальный курс'},
 'theme-event':{category:'Theme',title:'Историческая хроника'},
 'theme-loading':{category:'Theme',title:'Атлас держав'},
} as const;
export type ExpansionSceneName=keyof typeof EXPANSION_SCENES;
export const EXPANSION_SCENE_NAMES=Object.keys(EXPANSION_SCENES) as ExpansionSceneName[];
export function governmentScene(type:GovernmentType):ExpansionSceneName{
 if(type==='Absolute Monarchy'||type==='Constitutional Monarchy')return 'government-council';
 if(['Military Junta','One-Party State','Theocracy'].includes(type))return 'government-administration';
 return 'government-assembly';
}
export function religionScene(id:string):ExpansionSceneName|null{
 if(id.startsWith('christian-'))return 'religion-cathedral';
 if(id.startsWith('islam-'))return 'religion-courtyard';
 return id==='buddhism'?'religion-temple':null;
}
export function constructionScene(type:BuildingType):ExpansionSceneName|null{
 const scenes:Partial<Record<BuildingType,ExpansionSceneName>>={Farm:'construction-farm',Mine:'construction-mine',Factory:'construction-factory',Infrastructure:'construction-infrastructure'};
 return scenes[type]??null;
}
