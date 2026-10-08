/** Bounded developer trace. Monotonic timestamps; no identity or campaign contents. */
const events:{stage:string;atMs:number}[]=[];
export function traceStartup(stage:string){events.push({stage,atMs:performance.now()});if(events.length>32)events.shift();}
export function startupTrace(){const start=events.findLastIndex(e=>e.stage==='tap');const trace=events.slice(Math.max(0,start));return trace.map(e=>`${e.stage}: ${(e.atMs-(trace[0]?.atMs??0)).toFixed(1)}ms`).join('\n');}
