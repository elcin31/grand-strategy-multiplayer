export const SECTIONS=['Country','Economy','Military','Diplomacy','Technology','Government','Religion'] as const;
export type Section=typeof SECTIONS[number]|'Context';
export const SECTION_LABELS:Record<Section,string>={Country:'Страна',Economy:'Экономика',Military:'Армия',Diplomacy:'Дипломатия',Technology:'Технологии',Government:'Правительство',Religion:'Религия',Context:'Провинция'};
export function panelWidth(width:number){return Math.min(420,Math.max(280,width*.34),width*.6);}
export function backAction(input:{army?:boolean;keyboard:boolean;modal:boolean;context:boolean;panel:boolean;campaign:boolean}):'keyboard'|'modal'|'army'|'context'|'panel'|'confirm'|'system'{return input.keyboard?'keyboard':input.modal?'modal':input.army?'army':input.context?'context':input.panel?'panel':input.campaign?'confirm':'system';}
