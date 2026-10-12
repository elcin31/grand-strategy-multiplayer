/** Original Dominion regiments. Values are per thousand troops. */
const unit=(name:string,cost:number,attack:number,defense:number,unlock:number,upkeep:number,era:number,speed=1,role:'Front'|'Rear'|'Flank'|'Support'='Front',fuel=0)=>({name,cost,attack,defense,unlock,upkeep,era,speed,role,fuel,range:role==='Rear'?3:role==='Support'?2:1,organization:role==='Support'?90:75,morale:80,supply:upkeep});
export const UNITS={
 Infantry:unit('Пехота',20,1,1,0,1,1000),
 Mechanized:unit('Механизированная пехота',35,1.25,1.15,1,1.3,1940,1.6,'Front',.3),
 Armor:unit('Бронетехника',55,1.7,1.25,2,1.8,1920,1.4,'Flank',.6),
 Artillery:unit('Артиллерия',40,1.4,.9,1,1.4,1500,.8,'Rear'),
 AirDefense:unit('ПВО',35,.8,1.4,1,1.3,1940,1,'Support'),
 SpecialForces:unit('Спецназ',65,1.35,1.25,3,1.5,1940,1.2,'Flank'),
 Militia:unit('Ополчение',12,.65,.85,0,.7,1000,.9),
 Spearmen:unit('Копейные полки',16,.8,1.2,0,.8,1000,.9),
 Cavalry:unit('Кавалерия',30,1.1,.8,0,1.3,1000,1.6,'Flank'),
 Musketeers:unit('Мушкетные полки',24,1.15,.9,1,1.1,1550,.95),
 SiegeTrain:unit('Осадный парк',45,.75,.7,1,1.5,1200,.6,'Rear'),
 Engineers:unit('Инженерные части',30,.65,1.1,1,1.1,1600,1,'Support'),
 Logistics:unit('Части снабжения',25,.4,.8,1,1,1600,1.1,'Support'),
 Motorized:unit('Моторизованная пехота',32,1.1,1,1,1.2,1930,1.8,'Front',.25),
 Mountain:unit('Горнострелковые части',35,1.05,1.3,2,1.2,1800,1.1),
 Marine:unit('Морская пехота',45,1.25,1.1,2,1.3,1700,1.1),
 RocketArtillery:unit('Реактивная артиллерия',60,1.8,.8,4,1.8,1945,1.1,'Rear',.2),
 Drones:unit('Беспилотные подразделения',75,1.6,.85,5,1.6,2000,1.5,'Support',.1),
} as const;
export type UnitType=keyof typeof UNITS;
export const UNIT_TYPES=Object.keys(UNITS) as UnitType[];
