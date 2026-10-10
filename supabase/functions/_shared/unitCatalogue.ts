/** Existing six modern-campaign units; original recruitment prices retained. */
export const UNITS = {
  Infantry: {name:'Пехота',cost:20,attack:1,defense:1,unlock:0,upkeep:1,era:1900},
  Mechanized: {name:'Механизированная пехота',cost:35,attack:1.25,defense:1.15,unlock:1,upkeep:1.3,era:1940},
  Armor: {name:'Бронетехника',cost:55,attack:1.7,defense:1.25,unlock:2,upkeep:1.8,era:1920},
  Artillery: {name:'Артиллерия',cost:40,attack:1.4,defense:.9,unlock:1,upkeep:1.4,era:1900},
  AirDefense: {name:'ПВО',cost:35,attack:.8,defense:1.4,unlock:1,upkeep:1.3,era:1940},
  SpecialForces: {name:'Спецназ',cost:65,attack:1.35,defense:1.25,unlock:3,upkeep:1.5,era:1940},
} as const;
export type UnitType=keyof typeof UNITS;
export const UNIT_TYPES=Object.keys(UNITS) as UnitType[];
