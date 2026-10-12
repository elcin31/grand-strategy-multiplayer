export interface FlagFrame {x:number;y:number;width:number;height:number}

/** Keep nearby/overlapping frames in the same winding union. Dispersed flags
 * must not form one viewport-sized path mask which is uploaded on every pan.
 * The padding retains shared AA edges under the prepared camera transform. */
export function flagFrameGroups(frames:readonly FlagFrame[]):FlagFrame[][] {
  const remaining=[...frames],groups:FlagFrame[][]=[];
  const near=(a:FlagFrame,b:FlagFrame)=>a.x<=b.x+b.width+2&&b.x<=a.x+a.width+2&&a.y<=b.y+b.height+2&&b.y<=a.y+a.height+2;
  while(remaining.length){
    const group=[remaining.shift()!];
    for(let at=0;at<group.length;at++)for(let i=remaining.length-1;i>=0;i--){
      if(near(group[at]!,remaining[i]!))group.push(remaining.splice(i,1)[0]!);
    }
    groups.push(group);
  }
  return groups;
}
