import type {GameState,City} from './gameTypes.ts';
import {removedCityMapping} from './cityReductionMap.ts';
/** Catalogue-only migration: stable provinces, owners, capitals, economy and decisions. */
export function migrateCityCatalogue(state:GameState):void {
 if(state.dataset!=='modern-world-v2')return;
 const cities=state.cities??[],by=new Map(cities.map(c=>[c.id,c])),provinces=new Map(state.provinces.map(p=>[p.id,p]));
 if(by.size!==cities.length)throw Error('Повторяющиеся города в сохранении; исходный файл сохранён');
 const transfers:{from:City;to:City}[]=[];
 for(const city of cities){const id=removedCityMapping[city.id];if(!id)continue;
  const to=by.get(id),province=provinces.get(city.provinceId);
  if(!to||!province||to.provinceId!==city.provinceId||to.countryId!==city.countryId||city.isCapital||city.isRegionalCapital)throw Error('Не удалось перенести город; исходная кампания сохранена');
  for(const c of [city,to])if(!Number.isSafeInteger(c.population)||c.population<0||!Number.isFinite(c.populationGrowthCarry??0)||(c.populationGrowthCarry??0)<0||(c.populationGrowthCarry??0)>=1||!Number.isFinite(c.development))throw Error('Некорректные данные города для переноса');
  transfers.push({from:city,to});
 }
 for(const {from,to}of transfers){const total=to.population+from.population;if(!Number.isSafeInteger(total))throw Error('Переполнение населения города');
  to.development=total?(to.development*to.population+from.development*from.population)/total:to.development;
  to.population=total;
  const carry=(to.populationGrowthCarry??0)+(from.populationGrowthCarry??0);
  to.populationGrowthCarry=carry%1;
  const reserve=(to.populationGrowthCarryReserve??0)+(from.populationGrowthCarryReserve??0)+Math.floor(carry);
  if(reserve)to.populationGrowthCarryReserve=reserve;
 }
 state.cities=cities.filter(c=>!removedCityMapping[c.id]);
 for(const p of state.provinces)if(p.cityIds)p.cityIds=[...new Set(p.cityIds.map(id=>removedCityMapping[id]??id))];
}
