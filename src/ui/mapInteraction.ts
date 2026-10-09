export interface ArmyHit {id:string;ownerId:string;provinceId:string}
export interface MapHit {countryId?:string;army?:ArmyHit;provinceId?:string;provinceOwnerId?:string;cityId?:string}
export type MapIntent =
  | {type:'country';countryId:string}
  | {type:'diplomacy';countryId:string;provinceId?:string}
  | {type:'selectArmy';armyId:string;provinceId:string}
  | {type:'deselect'}
  | {type:'order';armyId:string;provinceId:string}
  | {type:'province';provinceId:string;cityId?:string};
/** UI controls sit outside the Canvas detector. Explicit flags/labels precede
 * armies, and armies precede province orders. Deselect never emits a command. */
export function mapTapIntent(selectedArmyId:string|null,ownCountryId:string|null,hit:MapHit):MapIntent {
  if(hit.countryId)return {type:hit.countryId===ownCountryId?'country':'diplomacy',countryId:hit.countryId};
  if(hit.army){
    if(hit.army.ownerId!==ownCountryId)return {type:'diplomacy',countryId:hit.army.ownerId,provinceId:hit.army.provinceId};
    return hit.army.id===selectedArmyId?{type:'deselect'}:{type:'selectArmy',armyId:hit.army.id,provinceId:hit.army.provinceId};
  }
  if(!hit.provinceId)return {type:'deselect'};
  if(selectedArmyId)return {type:'order',armyId:selectedArmyId,provinceId:hit.provinceId};
  if(hit.provinceOwnerId&&hit.provinceOwnerId!==ownCountryId)return {type:'diplomacy',countryId:hit.provinceOwnerId,provinceId:hit.provinceId};
  return {type:'province',provinceId:hit.provinceId,cityId:hit.cityId};
}
