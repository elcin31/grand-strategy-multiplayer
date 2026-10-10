import type {Army} from '../../supabase/functions/_shared/gameTypes';
import {initializeArmyComposition} from '../../supabase/functions/_shared/armyComposition';
import type {UnitType} from '../../supabase/functions/_shared/unitCatalogue';
/** Explicit scenario setup only. Production validation never repairs forged strength. */
export function scenarioStrength(a:Army,troops:number,type:UnitType=a.unitType??'Infantry'):void {a.troops=troops;a.unitType=type;a.composition={[type]:troops};a.template={...a.composition};initializeArmyComposition(a);}
export function scenarioArmy(a:Army):Army {initializeArmyComposition(a);return a;}
