const resource=(name:string,price:number,group:'Food'|'Raw'|'Industrial'|'Advanced'|'Military',color:string)=>({name,price,group,color});
export const RESOURCES={
 food:resource('Продовольствие',.08,'Food','#87a66b'),iron:resource('Железо',.12,'Raw','#a37d70'),coal:resource('Уголь',.10,'Raw','#657080'),oil:resource('Нефть',.20,'Raw','#9a7da8'),gas:resource('Газ',.16,'Raw','#70afc0'),gold:resource('Золото',.35,'Raw','#d1af59'),copper:resource('Медь',.14,'Raw','#cb9062'),uranium:resource('Уран',.25,'Raw','#add16d'),timber:resource('Древесина',.09,'Raw','#5f9987'),rare_materials:resource('Редкие материалы',.28,'Raw','#b995c2'),
 grain:resource('Зерно',.06,'Food','#c2b366'),rice:resource('Рис',.07,'Food','#c5c48c'),fish:resource('Рыба',.09,'Food','#6babb4'),livestock:resource('Скот',.11,'Food','#ad8c72'),sugar:resource('Сахар',.10,'Food','#cfbf9f'),
 bauxite:resource('Бокситы',.12,'Raw','#b58568'),limestone:resource('Известняк',.05,'Raw','#b7b6a0'),rubber:resource('Каучук',.14,'Raw','#687a66'),silicon:resource('Кремний',.12,'Raw','#9babb5'),lithium:resource('Литий',.20,'Raw','#aca6c8'),chromium:resource('Хром',.18,'Raw','#8c9b9b'),tungsten:resource('Вольфрам',.22,'Raw','#849c9b'),
 steel:resource('Сталь',.28,'Industrial','#b6bdc1'),aluminium:resource('Алюминий',.25,'Industrial','#c2d0d4'),cement:resource('Цемент',.12,'Industrial','#aeac9c'),chemicals:resource('Химикаты',.20,'Industrial','#aaad75'),plastics:resource('Пластмассы',.18,'Industrial','#b39cb5'),textile:resource('Текстиль',.15,'Industrial','#8da1b5'),
 electronics:resource('Электроника',.45,'Advanced','#68a89e'),semiconductors:resource('Полупроводники',.60,'Advanced','#759bba'),batteries:resource('Аккумуляторы',.35,'Advanced','#83ac7b'),medicine:resource('Медикаменты',.30,'Advanced','#a67d84'),
 fuel:resource('Топливо',.24,'Military','#c3ab5e'),weapons:resource('Вооружение',.50,'Military','#af9688'),ammunition:resource('Боеприпасы',.30,'Military','#c7a67a'),
} as const;
export type ResourceType=keyof typeof RESOURCES;
export const RESOURCE_TYPES=Object.keys(RESOURCES) as ResourceType[];
export const FOOD_RESOURCES=RESOURCE_TYPES.filter(t=>RESOURCES[t].group==='Food');
