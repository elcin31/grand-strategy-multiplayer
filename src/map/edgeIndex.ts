import type {Edge} from './scene';
const indexes=new WeakMap<readonly Edge[],ReadonlyMap<string,readonly Edge[]>>();
/** Geometry-only index shared by all modes. Bounded to each live scene. */
export function visibleEdges(edges:readonly Edge[],ids:ReadonlySet<string>):Set<Edge>{
 let index=indexes.get(edges);
 if(!index){const built=new Map<string,Edge[]>();for(const edge of edges)for(const id of edge.provinces){const list=built.get(id)??[];list.push(edge);built.set(id,list);}index=built;indexes.set(edges,index);}
 const result=new Set<Edge>();for(const id of ids)for(const edge of index.get(id)??[])result.add(edge);return result;
}

const lines=new WeakMap<Edge,string>();
export function edgeLine(edge:Edge):string{let line=lines.get(edge);if(line===undefined){line=`M${edge.a.x},${edge.a.y}L${edge.b.x},${edge.b.y}`;lines.set(edge,line);}return line;}
