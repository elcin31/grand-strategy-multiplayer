import type {MapFeature} from './geometry';
import {countryLabels,type CountryLabel} from './scene';
/** One current ownership generation per scene; camera/tick/treasury never retrace coastlines. */
const cache=new WeakMap<readonly MapFeature[],{signature:string;labels:CountryLabel[]}>();
export function preparedCountryLabels(features:readonly MapFeature[],owners:ReadonlyMap<string,string>):CountryLabel[]{
 const signature=features.map(f=>f.provinceId?owners.get(f.provinceId)??'':'').join('|');
 const previous=cache.get(features);if(previous?.signature===signature)return previous.labels;
 const labels=countryLabels(features,owners);cache.set(features,{signature,labels});return labels;
}
