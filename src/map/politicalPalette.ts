const cache=new Map<string,string>();
/** Preserve geographic hue identity; soften saturation toward a printed historical atlas. */
export function politicalColor(hex:string):string {
 const saved=cache.get(hex);if(saved)return saved;
 const match=/^#([\da-f]{6})$/i.exec(hex);if(!match)return hex;
 const value=parseInt(match[1]!,16),rgb=[value>>16,(value>>8)&255,value&255];
 const mean=rgb.reduce((s,v)=>s+v,0)/3;
 const out='#'+rgb.map(v=>Math.round(Math.min(235,Math.max(88,mean*.13+v*.73+39))).toString(16).padStart(2,'0')).join('');
 cache.set(hex,out);return out;
}
