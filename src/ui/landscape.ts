export const SECTIONS=['Country','Economy','Construction','Military','Diplomacy','Technology','Focus','Intelligence','Statistics','Government','Religion'] as const;
export type Section=typeof SECTIONS[number]|'Context'|'Notifications';
export const SECTION_LABELS:Record<Section,string>={Country:'Страна',Economy:'Экономика',Military:'Армия',Diplomacy:'Дипломатия',Technology:'Технологии',Government:'Правительство',Religion:'Религия',Focus:'Нац. курс',Context:'Провинция',Construction:'Строительство',Intelligence:'Разведка',Statistics:'Статистика',Notifications:'Донесения'};
export function panelWidth(width:number){return Math.min(420,Math.max(280,width*.34),width*.6);}
export function backAction(input:{army?:boolean;keyboard:boolean;modal:boolean;context:boolean;panel:boolean;campaign:boolean}):'keyboard'|'modal'|'army'|'context'|'panel'|'confirm'|'system'{return input.keyboard?'keyboard':input.modal?'modal':input.army?'army':input.context?'context':input.panel?'panel':input.campaign?'confirm':'system';}

export const SECTION_ICONS:Record<Section,string>={Country:'⚑',Economy:'¤',Construction:'⌂',Military:'⚔',Diplomacy:'⚖',Technology:'⚙',Focus:'★',Intelligence:'◉',Statistics:'▥',Government:'♜',Religion:'✧',Context:'◇',Notifications:'♧'};
