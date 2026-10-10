import {useMemo,useState} from 'react';
import {Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {colors} from '../ui/tokens';
import {TREATIES,pairKey,warBetween,type TreatyType} from '../../supabase/functions/_shared/diplomacySystem';
import {assertDiplomaticAmount,diplomacyQuote,diplomacyAcceptance,diplomaticTermsLabel,missionAvailability} from '../../supabase/functions/_shared/diplomacy2System';
import type {DiplomaticTerms} from '../../supabase/functions/_shared/diplomacyTypes';
import {TECHNOLOGIES,TECHNOLOGY_BRANCHES,type TechnologyBranch} from '../../supabase/functions/_shared/technologySystem';
import {styles,type StrategyProps} from './StrategyPanel';

export function DiplomacyButton({label,disabled=false,onPress}:{label:string;disabled?:boolean;onPress:()=>void}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} style={[styles.button,disabled&&styles.disabled]} onPress={onPress}><Text style={styles.title}>{label}</Text></Pressable>;
}
function amountValue(text:string,zero=false):number|null {try{const n=Number(text.replace(',','.'));if(!text.trim())return null;assertDiplomaticAmount(n,zero);return n;}catch{return null;}}
function OfferControl({state,playerId,onCommand,from,to,terms}:StrategyProps&{from:string;to:string;terms:DiplomaticTerms}) {
  const quote=diplomacyQuote(state,from,to,terms),rating=diplomacyAcceptance(state,from,to,terms);
  const enabled=['running','paused'].includes(state.phase)&&!quote.reason;
  const human=state.players.some(p=>p.countryId===to&&!p.aiControlled);
  return <View style={styles.card}>
    <Text style={styles.title}>{diplomaticTermsLabel(terms)}</Text>
    <Text style={styles.text}>{quote.cost} млн · {quote.pp} PP · ответ в течение 12 мес. · cooldown 3 мес.</Text>
    <Text style={styles.text}>{human?'Решение принимает другой игрок':`Оценка NPC: ${rating.score.toFixed(1)} / ${rating.required}`}. Расходы сохраняются при отказе.</Text>
    {!human&&rating.reasons.filter(r=>r.value!==0).map(r=><Text key={r.label} style={styles.text}>{r.label}: {r.value>0?'+':''}{r.value.toFixed(1)}</Text>)}
    {quote.reason&&<Text accessibilityLiveRegion="polite" style={styles.text}>{quote.reason}</Text>}
    <DiplomacyButton label={'Предложить: '+diplomaticTermsLabel(terms)} disabled={!enabled} onPress={()=>onCommand({type:'OFFER_DIPLOMACY',playerId,targetId:to,terms})}/>
  </View>;
}
const ADVANCED={Technology:'Обмен технологиями',Province:'Продажа / передача провинции',Ultimatum:'Ультиматум',Summit:'Дипломатический саммит',Union:'Политическое объединение'} as const;
export function DiplomacyActions(props:StrategyProps&{from:string;to:string}) {
  const {state,playerId,onCommand,from,to}=props;
  const [gift,setGift]=useState('100'),[advanced,setAdvanced]=useState<keyof typeof ADVANCED|null>(null),[give,setGive]=useState<TechnologyBranch>('Economy'),[receive,setReceive]=useState<TechnologyBranch>('Military');
  const [price,setPrice]=useState('0'),[provinceId,setProvinceId]=useState(''),[provinceQuery,setProvinceQuery]=useState(''),[demand,setDemand]=useState<'Payment'|'Province'>('Payment'),[payment,setPayment]=useState('100');
  const [guests,setGuests]=useState<string[]>([]),[guestQuery,setGuestQuery]=useState(''),[agenda,setAgenda]=useState<'Relations'|'TradeAgreement'|'NonAggression'>('Relations');
  const nations=useMemo(()=>Object.values(state.countries).filter(c=>c.provinceIds?.length),[state.countries]);
  const provinceIndex=useMemo(()=>new Map(state.provinces.map(p=>[p.id,p])),[state.provinces]);
  const link=state.diplomacy?.[pairKey(from,to)],c=state.countries[from]!,war=warBetween(state,from,to),enabled=['running','paused'].includes(state.phase),pp=c.politicalPower??0;
  const giftAmount=amountValue(gift),priceAmount=amountValue(price,true),paymentAmount=amountValue(payment);
  const missions=state.relationMissions?.filter(m=>m.from===from&&m.to===to)??[];
  const participants=[from,to,...guests.filter(id=>id!==from&&id!==to)].slice(0,6);
  const provinceCandidates=(advanced==='Province'||advanced==='Ultimatum'&&demand==='Province'?state.provinces:[]).filter(p=>advanced==='Ultimatum'?p.ownerId===to&&p.originalOwnerId===from&&p.neighbors.some(id=>provinceIndex.get(id)?.ownerId===from):p.ownerId===from).filter(p=>`${p.id} ${p.name}`.toLowerCase().includes(provinceQuery.toLowerCase()));
  let terms:DiplomaticTerms|null=null;
  if(advanced==='Technology')terms={kind:'TechnologyExchange',give,receive};
  if(advanced==='Province'&&provinceId&&priceAmount!==null)terms={kind:'ProvinceTransfer',provinceId,price:priceAmount};
  if(advanced==='Ultimatum')terms=demand==='Payment'&&paymentAmount!==null?{kind:'Ultimatum',demand,amount:paymentAmount}:demand==='Province'&&provinceId?{kind:'Ultimatum',demand,provinceId}:null;
  if(advanced==='Summit')terms={kind:'Summit',participants,agenda};
  if(advanced==='Union')terms={kind:'PoliticalUnion'};
  const warBlocked=!!war||!enabled||pp<25||!!link?.treaties.length||!!link?.guarantors.includes(from)||state.tick<(link?.truceUntilTick??0)||!!c.overlordId||!!state.countries[to]!.overlordId||!!state.wars?.some(w=>[...w.attackers,...w.defenders].some(id=>id===from||id===to));
  return <View style={styles.wrap}>
    <Text style={styles.title}>Дипломатические миссии</Text>
    {(['Improve','Damage'] as const).map(kind=>{const reason=missionAvailability(state,from,to,kind);return <View key={kind} style={styles.card}>
      <Text style={styles.text}>{kind==='Improve'?'+3':'−3'} к отношениям в месяц · 12 мес. · запуск 20 млн / 10 PP · содержание 3 млн в месяц</Text>
      {reason&&<Text style={styles.text}>{reason}</Text>}
      <DiplomacyButton label={kind==='Improve'?'Улучшить отношения · 10 PP':'Ухудшить отношения · 10 PP'} disabled={!enabled||!!reason} onPress={()=>onCommand({type:'START_RELATION_MISSION',playerId,targetId:to,kind})}/>
    </View>;})}
    {missions.map(m=><View key={m.id} style={styles.card}><Text style={styles.text}>{m.kind==='Improve'?'Улучшение':'Ухудшение'} отношений: {m.lastTick-m.startedTick}/12 мес. · 3 млн / мес.</Text><DiplomacyButton label="Отозвать дипломатическую миссию" disabled={!enabled} onPress={()=>onCommand({type:'CANCEL_RELATION_MISSION',playerId,missionId:m.id})}/></View>)}
    <View style={styles.card}>
      <Text style={styles.title}>Дар государству · 5 PP</Text><TextInput accessibilityLabel="Сумма подарка в миллионах" keyboardType="decimal-pad" value={gift} onChangeText={setGift} style={[styles.button,styles.text]}/>
      <Text style={styles.text}>Сумма списывается с вашей казны и передаётся адресату. Доверие +3; эффект отношений зависит от суммы. Cooldown 3 мес.</Text>
      <DiplomacyButton label="Отправить подарок" disabled={!enabled||!!war||giftAmount===null||c.treasury<(giftAmount??0)||pp<5||state.tick<(link?.cooldowns?.[from+':Gift']??0)} onPress={()=>{if(giftAmount!==null)onCommand({type:'SEND_GIFT',playerId,targetId:to,amount:giftAmount});}}/>
      <DiplomacyButton label="Отправить оскорбление · 5 PP" disabled={!enabled||!!war||pp<5||state.tick<(link?.cooldowns?.[from+':Insult']??0)} onPress={()=>onCommand({type:'SEND_INSULT',playerId,targetId:to})}/>
      <Text style={styles.text}>Оскорбление: отношения −20, доверие −10; возможен ответный протест NPC. Cooldown 6 мес.</Text>
    </View>
    {(Object.keys(TREATIES) as TreatyType[]).filter(t=>t!=='PoliticalUnion').map(treaty=><OfferControl key={treaty} {...props} terms={{kind:'Treaty',treaty: treaty as Exclude<TreatyType,'PoliticalUnion'>}}/>)}
    <DiplomacyButton label="Гарантировать · 20 PP" disabled={!enabled||!!war||pp<20||!!link?.rivals.length||!!link?.guarantors.includes(from)||!!state.countries[to]!.overlordId} onPress={()=>onCommand({type:'DIPLOMATIC_ACTION',playerId,targetId:to,action:'Guarantee'})}/>
    <Text style={styles.text}>Гарантия на 60 месяцев призывает вас на защиту адресата. Союз участвует в наступательных и оборонительных войнах, оборонительный пакт — в обороне.</Text>
    {link?.terms?.map(t=><View key={t.id} style={styles.card}><Text style={styles.text}>{TREATIES[t.type]} · {t.type==='PoliticalUnion'?'бессрочно':`${Math.max(0,t.untilTick-state.tick)} мес.`}{t.type==='MilitaryAccess'?` · ${state.countries[t.from]!.name} разрешает проход ${state.countries[t.to]!.name}`:''}</Text><DiplomacyButton label={'Расторгнуть: '+TREATIES[t.type]+' · 5 PP'} disabled={!enabled||pp<5} onPress={()=>onCommand({type:'TERMINATE_TREATY',playerId,targetId:to,treatyId:t.id})}/></View>)}
    <DiplomacyButton label="Объявить соперником" disabled={!enabled||!!link?.treaties.length||!!link?.rivals.includes(from)} onPress={()=>onCommand({type:'DIPLOMATIC_ACTION',playerId,targetId:to,action:'Rival'})}/>
    <DiplomacyButton label="Отменить договоры" disabled={!enabled||pp<(link?.terms?.length??0)*5||!link?.treaties.length&&!link?.rivals.includes(from)&&!link?.guarantors.includes(from)&&!state.diplomaticOffers?.some(o=>o.from===from&&o.to===to)} onPress={()=>onCommand({type:'DIPLOMATIC_ACTION',playerId,targetId:to,action:'Cancel'})}/>
    <Text style={styles.text}>Отмена всех обязательств: 5 PP за каждый договор. Союз, ненападение, оборонительный пакт и объединение оставляют перемирие на 6 мес. Торговля и проход такого перемирия не создают.</Text>
    <ScrollView horizontal contentContainerStyle={styles.row}>{(Object.keys(ADVANCED) as (keyof typeof ADVANCED)[]).map(key=><Pressable accessibilityRole="button" accessibilityState={{selected:advanced===key}} key={key} style={styles.option} onPress={()=>{setAdvanced(advanced===key?null:key);setProvinceId('');}}><Text style={styles.title}>{ADVANCED[key]}{advanced===key?' ✓':''}</Text></Pressable>)}</ScrollView>
    {advanced==='Technology'&&<View style={styles.card}>{(['give','receive'] as const).map(side=><View key={side}><Text style={styles.text}>{side==='give'?'Передать адресату':'Получить от адресата'} один следующий уровень</Text><ScrollView horizontal contentContainerStyle={styles.row}>{TECHNOLOGY_BRANCHES.map(branch=><Pressable accessibilityRole="button" accessibilityState={{selected:(side==='give'?give:receive)===branch}} key={branch} style={styles.option} onPress={()=>side==='give'?setGive(branch):setReceive(branch)}><Text style={styles.title}>{TECHNOLOGIES[branch].name}</Text><Text style={styles.text}>Вы: {c.technologies?.[branch]??0} · адресат: {state.countries[to]!.technologies?.[branch]??0}</Text></Pressable>)}</ScrollView></View>)}</View>}
    {advanced==='Ultimatum'&&<View style={styles.card}><ScrollView horizontal contentContainerStyle={styles.row}>{(['Payment','Province'] as const).map(k=><DiplomacyButton key={k} label={k==='Payment'?'Потребовать выплату':'Потребовать территорию'} onPress={()=>{setDemand(k);setProvinceId('');}}/>)}</ScrollView>{demand==='Payment'&&<TextInput accessibilityLabel="Сумма ультиматума в миллионах" keyboardType="decimal-pad" value={payment} onChangeText={setPayment} style={[styles.button,styles.text]}/>}<Text style={styles.text}>Требуется превосходство армии 1,25×. Отказ вызывает дипломатический кризис; войну вы объявляете отдельно.</Text></View>}
    {(advanced==='Province'||advanced==='Ultimatum'&&demand==='Province')&&<View style={styles.card}>
      <TextInput accessibilityLabel="Поиск провинции для передачи" placeholder="Название провинции" placeholderTextColor={colors.muted} value={provinceQuery} onChangeText={setProvinceQuery} style={[styles.button,styles.text]}/>
      <ScrollView horizontal contentContainerStyle={styles.row}>{provinceCandidates.slice(0,25).map(p=><Pressable accessibilityRole="button" accessibilityState={{selected:provinceId===p.id}} key={p.id} style={styles.option} onPress={()=>setProvinceId(p.id)}><Text style={styles.title}>{p.name}{provinceId===p.id?' ✓':''}</Text></Pressable>)}</ScrollView>
      {!provinceCandidates.length&&<Text style={styles.text}>Нет подходящих провинций по этому запросу.</Text>}
      {advanced==='Province'&&<><TextInput accessibilityLabel="Цена провинции в миллионах" keyboardType="decimal-pad" value={price} onChangeText={setPrice} style={[styles.button,styles.text]}/><Text style={styles.text}>0 — безвозмездная передача. Столица, последняя провинция, армии, строительство и война запрещают передачу.</Text></>}
    </View>}
    {advanced==='Summit'&&<View style={styles.card}><Text style={styles.text}>Участники: {participants.map(id=>state.countries[id]!.name).join(', ')}. Нужны 3–6 стран и согласие каждого игрока.</Text><TextInput accessibilityLabel="Поиск участника саммита" placeholder="Добавить участника" placeholderTextColor={colors.muted} value={guestQuery} onChangeText={setGuestQuery} style={[styles.button,styles.text]}/><ScrollView horizontal contentContainerStyle={styles.row}>{nations.filter(c=>c.id!==from&&c.id!==to&&`${c.name} ${c.id}`.toLowerCase().includes(guestQuery.toLowerCase())).slice(0,20).map(c=><Pressable accessibilityRole="button" accessibilityState={{selected:guests.includes(c.id)}} key={c.id} style={styles.option} onPress={()=>setGuests(previous=>previous.includes(c.id)?previous.filter(id=>id!==c.id):previous.length<4?[...previous,c.id]:previous)}><Text style={styles.title}>{c.name}{guests.includes(c.id)?' ✓':''}</Text></Pressable>)}</ScrollView><ScrollView horizontal contentContainerStyle={styles.row}>{(['Relations','TradeAgreement','NonAggression'] as const).map(k=><DiplomacyButton key={k} label={k==='Relations'?'Повестка: отношения':TREATIES[k]} onPress={()=>setAgenda(k)}/>)}</ScrollView></View>}
    {advanced==='Union'&&<Text style={styles.text}>Добровольная федерация требует союза и торговли длительностью 24 месяца, отношений 75 и доверия 70. Общий рынок, проход и оборона; обе страны сохраняют собственные города, армии и игроков.</Text>}
    {terms&&<OfferControl {...props} terms={terms}/>}
    <DiplomacyButton label={war?'Война идёт':'Объявить войну · 25 PP'} disabled={warBlocked} onPress={()=>onCommand({type:'DECLARE_WAR',playerId,targetId:to})}/>
    {war&&<Text style={styles.text}>Предложение и условия мира доступны выше в панели «Войны и мир».</Text>}
  </View>;
}
