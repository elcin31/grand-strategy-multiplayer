import {useMemo,useState} from 'react';
import {FlatList,Text,View} from 'react-native';
import manifest from '../../assets/art/dominion-2.1.1/art-manifest.json';
import type {IllustrationId} from '../art/library';
import {HistoricalIllustration} from './HistoricalIllustration';
import {PanelTabs} from './PanelTabs';
import {styles} from './strategyStyles';
const labels:Record<string,string>={military:'Армия',economy:'Экономика',technology:'Наука',focuses:'Национальный курс',diplomacy:'Дипломатия',events:'События',government:'Общество'};
export function ArtGallery(){const [category,setCategory]=useState('Армия'),rows=useMemo(()=>manifest.filter(e=>labels[e.category]===category),[category]);return <View style={styles.card}><Text style={styles.title}>Историческая живопись Dominion · 100 картин</Text><PanelTabs tabs={Object.values(labels)} value={category} onChange={setCategory}/><FlatList horizontal data={rows} keyExtractor={e=>e.id} initialNumToRender={3} maxToRenderPerBatch={4} windowSize={3} contentContainerStyle={{gap:8}} renderItem={({item})=><View style={{width:200,gap:4}}><HistoricalIllustration id={item.id as IllustrationId} width={200} height={116} label={item.titleRu}/><Text style={styles.title}>{item.titleRu}</Text><Text style={styles.text}>{item.era}</Text></View>}/><Text style={styles.text}>Коллекция самостоятельных исторических сцен. Иллюстрации открываются по мере просмотра.</Text></View>;}
