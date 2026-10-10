import {countryFor,type Country,type GameState} from './gameTypes.ts';
import {money} from './economySystem.ts';
export const ECONOMIC_POLICIES={
  Balanced:{name:'Сбалансированный бюджет',tax:1,production:1,trade:1,army:1,administration:1,research:1,manpower:1,stability:0,unrest:0,description:'Обычные налоги, расходы и темпы развития.'},
  Investment:{name:'Программа инвестиций',tax:.92,production:1.15,trade:1.05,army:1,administration:1.1,research:1.15,manpower:1,stability:.05,unrest:0,description:'Налоги −8%, производство +15%, торговля +5%, исследования +15%; управление дороже на 10%.'},
  Mobilization:{name:'Военная мобилизация',tax:1.05,production:1.05,trade:.9,army:1.15,administration:1,research:.9,manpower:1.3,stability:-.15,unrest:.12,description:'Резерв +30%, налоги и производство +5%; торговля −10%, армия дороже на 15%, стабильность снижается.'},
  Austerity:{name:'Сокращение расходов',tax:1.08,production:.95,trade:.92,army:.85,administration:.85,research:.9,manpower:.95,stability:-.1,unrest:.2,description:'Налоги +8%, управление и армия дешевле на 15%; выпуск −5%, торговля −8%, растёт недовольство.'},
  OpenMarkets:{name:'Открытые рынки',tax:.96,production:1.05,trade:1.3,army:1,administration:1,research:1,manpower:1,stability:0,unrest:0,description:'Торговля +30%, выпуск +5%, налоги −4%; выгодны договоры торговли и порты.'},
} as const;
export type EconomicPolicy=keyof typeof ECONOMIC_POLICIES;
export const FUNDING_LEVELS={Low:{name:'Ограниченное',research:.5,militaryCost:.75,militaryReadiness:.85},Standard:{name:'Стандартное',research:1,militaryCost:1,militaryReadiness:1},High:{name:'Приоритетное',research:1.5,militaryCost:1.25,militaryReadiness:1.08}} as const;
export type FundingLevel=keyof typeof FUNDING_LEVELS;
export function economicPolicy(c:Country){return ECONOMIC_POLICIES[c.economicPolicy??'Balanced'];}
export function researchFunding(c:Country):number{return FUNDING_LEVELS[c.researchFunding??'Standard'].research;}
export function militaryFundingCost(c:Country):number{return FUNDING_LEVELS[c.militaryFunding??'Standard'].militaryCost*economicPolicy(c).army;}
export function militaryReadiness(c:Country):number{return FUNDING_LEVELS[c.militaryFunding??'Standard'].militaryReadiness*(c.economicPolicy==='Austerity'?.95:1);}
export function researchMonthlyCost(c:Country):number{return c.research?money(10*c.research.targetLevel*researchFunding(c)):0;}
export function policyAvailability(s:GameState,id:string,policy:EconomicPolicy):string|null {
  const c=countryFor(s,id);if(!s.dataset||!c.provinceIds?.length||!['running','paused'].includes(s.phase))return 'Нужна начатая кампания';
  if(c.economicPolicy===policy)return 'Эта политика уже действует';if(s.tick<(c.policyCooldownUntilTick??0))return 'Политика на cooldown';
  if(s.tick<(c.bankruptcyUntilTick??0)&&policy!=='Austerity')return 'После банкротства доступно сокращение расходов';
  if(c.treasury<50||(c.politicalPower??0)<15)return 'Требуются 50 млн и 15 PP';
  return null;
}
export function setEconomicPolicy(s:GameState,id:string,policy:EconomicPolicy):void {
  const reason=policyAvailability(s,id,policy);if(reason)throw Error(reason);if(!Number.isSafeInteger(s.tick+6))throw Error('Policy date overflow');
  const c=countryFor(s,id);c.treasury=money(c.treasury-50);c.politicalPower!-=15;c.economicPolicy=policy;c.policyCooldownUntilTick=s.tick+6;
}
export function fundingAvailability(s:GameState,id:string,domain:'Research'|'Military',level:FundingLevel):string|null {
  const c=countryFor(s,id);if(!s.dataset||!c.provinceIds?.length||!['running','paused'].includes(s.phase))return 'Нужна начатая кампания';
  if((domain==='Research'?c.researchFunding:c.militaryFunding)===level)return 'Этот бюджет уже принят';if(s.tick<(c.budgetCooldownUntilTick??0))return 'Бюджет на cooldown';if((c.politicalPower??0)<5)return 'Требуются 5 PP';return null;
}
export function setFunding(s:GameState,id:string,domain:'Research'|'Military',level:FundingLevel):void {
  const reason=fundingAvailability(s,id,domain,level);if(reason)throw Error(reason);if(!Number.isSafeInteger(s.tick+3))throw Error('Budget date overflow');
  const c=countryFor(s,id);if(domain==='Research')c.researchFunding=level;else c.militaryFunding=level;c.politicalPower!-=5;c.budgetCooldownUntilTick=s.tick+3;
}
export function initializeEconomy2(s:GameState,migrate:boolean):void {
  if(!s.dataset)return;
  for(const c of Object.values(s.countries)){
    if(migrate){c.economicPolicy??='Balanced';c.researchFunding??='Standard';c.militaryFunding??='Standard';c.policyCooldownUntilTick??=0;c.budgetCooldownUntilTick??=0;}
    if(typeof c.economicPolicy!=='string'||!Object.hasOwn(ECONOMIC_POLICIES,c.economicPolicy)||typeof c.researchFunding!=='string'||!Object.hasOwn(FUNDING_LEVELS,c.researchFunding)||typeof c.militaryFunding!=='string'||!Object.hasOwn(FUNDING_LEVELS,c.militaryFunding)||![c.policyCooldownUntilTick,c.budgetCooldownUntilTick].every(n=>Number.isSafeInteger(n)&&n!>=0))throw Error('Invalid economic policy/funding');
  }
}
