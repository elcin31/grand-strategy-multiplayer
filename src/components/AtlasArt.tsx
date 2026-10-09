import {memo,useState} from 'react';
import {Image,View} from 'react-native';
const atlases={
  rulers:{source:require('../../assets/art/rulers-atlas.webp'),columns:4,rows:3,width:960,height:900},
  buildings:{source:require('../../assets/art/buildings-atlas.webp'),columns:5,rows:2,width:1280,height:512},
  government:{source:require('../../assets/art/government-atlas.webp'),columns:3,rows:2,width:1152,height:512},
  religion:{source:require('../../assets/art/religion-atlas.webp'),columns:4,rows:2,width:1280,height:640},
} as const;
/** Fixed tiny atlases decode only when the corresponding panel is mounted.
 * RN's shared image source reuses one bitmap for all visible miniatures. No
 * image is loaded by the map renderer or by a hidden/collapsed policy section. */
export const AtlasArt=memo(function AtlasArt({atlas,index,width,height,label}:{atlas:keyof typeof atlases;index:number;width?:number;height:number;label:string}){
  const [measured,setMeasured]=useState(0),entry=atlases[atlas],w=width??measured;
  const cellWidth=entry.width/entry.columns,cellHeight=entry.height/entry.rows,scale=Math.max(w/cellWidth,height/cellHeight);
  const tile=Math.abs(Math.trunc(index))%(entry.columns*entry.rows),column=tile%entry.columns,row=Math.floor(tile/entry.columns);
  return <View accessibilityLabel={label} accessible style={{width:width??'100%',height,overflow:'hidden',backgroundColor:'#101821'}} onLayout={e=>{if(width===undefined&&measured!==e.nativeEvent.layout.width)setMeasured(e.nativeEvent.layout.width);}}>{w>0&&<Image source={entry.source} fadeDuration={0} resizeMode="stretch" style={{position:'absolute',width:entry.width*scale,height:entry.height*scale,left:-column*cellWidth*scale+(w-cellWidth*scale)/2,top:-row*cellHeight*scale+(height-cellHeight*scale)/2}}/>}</View>;
});
