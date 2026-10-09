const cache=new Map<string,string>();
/** Preserve geographic hue identity; soften saturation toward a printed historical atlas. */
export function politicalColor(hex:string):string {
 const saved=cache.get(hex);if(saved)return saved;
 const match=/^#([\da-f]{6})$/i.exec(hex);if(!match)return hex;
 const value=parseInt(match[1]!,16),rgb=[value>>16,(value>>8)&255,value&255];
 const mean=rgb.reduce((s,v)=>s+v,0)/3;
 const out='#'+rgb.map(v=>Math.round(Math.min(205,Math.max(76,mean*.24+v*.64+23))).toString(16).padStart(2,'0')).join('');
 cache.set(hex,out);return out;
}
