import {useEffect,useRef} from 'react';
import type {GameState} from '../types/game';
import {audioHub} from './hub';
/** Only newly confirmed events emit cues; reconnect never replays the ledger. */
export function useCampaignAudio(state:GameState|null,countryId:string|null){
 const seen=useRef<{id:string;notifications:number;battles:Set<string>;active:Set<string>;sieges:Set<string>;peace:Set<string>}|null>(null);
 useEffect(()=>{if(!state||!countryId)return;const next={id:state.id,notifications:state.notificationSequence??0,battles:new Set(state.battleLog.map(b=>b.id)),active:new Set(state.activeBattles?.map(b=>b.id)),sieges:new Set(state.sieges?.map(s=>s.id)),peace:new Set(state.warHistory?.map(w=>w.id))},old=seen.current;seen.current=next;if(!old||old.id!==state.id)return;
  const peace=state.warHistory?.find(w=>!old.peace.has(w.id)&&[...w.attackers,...w.defenders].includes(countryId));if(peace){audioHub.play('peace_signed');return;}
  const battle=state.battleLog.find(b=>!old.battles.has(b.id)&&(b.attackerId===countryId||b.defenderId===countryId));if(battle){audioHub.play(battle.winnerId===countryId?'victory':'defeat');return;}
  if(state.activeBattles?.some(b=>!old.active.has(b.id)&&(b.attackerId===countryId||b.defenderId===countryId))){audioHub.play('battle');return;}
  const notice=state.notifications?.find(n=>n.id>old.notifications&&n.countryId===countryId);if(notice){const cue=notice.category==='Research'?'technology':notice.category==='Construction'?'construction':notice.category==='Focus'?'focus':notice.category==='Siege'?notice.message.includes('капитулировала')||notice.message.includes('взята')?'siege_complete':'siege_start':notice.category==='War'?'war':notice.category==='Diplomacy'?'diplomatic':'notice';audioHub.play(cue);}
 },[state,countryId]);
}
