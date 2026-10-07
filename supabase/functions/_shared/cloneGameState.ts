import type {GameState} from './gameTypes.ts';
/** Campaigns are JSON trees. Copy every mutable leaf, without structuredClone's
 * host serialization round-trip. No sharing, transfer, mutation, or validation bypass.
 * This helper is only for typed campaign data, never arbitrary external objects. */
function copy<T>(value:T):T {
  if(value===null||typeof value!=='object')return value;
  if(Array.isArray(value)){
    const result=new Array(value.length);
    for(let i=0;i<value.length;i++)result[i]=copy(value[i]);
    return result as T;
  }
  const result={} as T;
  for(const key of Object.keys(value) as (keyof T)[]){
    const item=copy(value[key]);
    if(key==='__proto__')Object.defineProperty(result,key,{value:item,enumerable:true,writable:true,configurable:true});
    else result[key]=item;
  }
  return result;
}
export function cloneGameState(state:GameState):GameState {return copy(state);}
