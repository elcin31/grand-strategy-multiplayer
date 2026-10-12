import type {KeyStore} from '../multiplayer/sessionStore';
export interface AudioPreferences{master:number;music:number;sfx:number;mute:boolean;track:number}
export const DEFAULT_AUDIO:AudioPreferences={master:.7,music:.3,sfx:.65,mute:false,track:0};
export const AUDIO_KEY='dominion.audio.v1';
export interface Player{volume:number;loop:boolean;play():void;pause():void;seekTo(seconds:number):Promise<void>;remove():void}
export interface AudioDriver{create(source:number):Player;onFinish?:(player:Player,callback:()=>void)=>()=>void}
export function parseAudioPreferences(raw:string|null):AudioPreferences{
 try{const p=JSON.parse(raw??'null');if(p&&[p.master,p.music,p.sfx].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1)&&typeof p.mute==='boolean')return {master:p.master,music:p.music,sfx:p.sfx,mute:p.mute,track:Number.isInteger(p.track)&&p.track>=0&&p.track<3?p.track:0};}catch{}return {...DEFAULT_AUDIO};
}
/** One music player, at most eight lazily-created effects. No GameState subscription. */
export class AudioController{
 private settings:AudioPreferences={...DEFAULT_AUDIO};private driver?:AudioDriver;private music?:Player;private effects=new Map<string,Player>();private last=new Map<string,number>();private lastEffect=-Infinity;private musicPlaying=false;private active=true;private starting?:Promise<void>;private saves=Promise.resolve();private finish?:()=>void;private listeners=new Set<()=>void>();
 constructor(private store:KeyStore,private sources:Record<string,number>,private tracks:readonly string[]=['atlas','council','peace'],private now=()=>Date.now()){}
 getSnapshot=()=>this.settings;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private emit(){for(const listener of this.listeners)listener();}
 start(driver:AudioDriver):Promise<void>{return this.starting??=(async()=>{this.settings=parseAudioPreferences(await this.store.get(AUDIO_KEY).catch(()=>null));this.driver=driver;this.replaceMusic();this.emit();})();}
 private replaceMusic(){if(!this.driver)return;this.finish?.();this.music?.remove();this.music=this.driver.create(this.sources[this.tracks[this.settings.track]!]!);this.music.loop=false;this.musicPlaying=false;this.finish=this.driver.onFinish?.(this.music,()=>this.nextTrack());this.applyVolumes();}
 private applyVolumes(){const musicVolume=this.settings.master*this.settings.music,sfxVolume=this.settings.master*this.settings.sfx;
  for(const player of this.effects.values()){player.volume=this.settings.mute?0:sfxVolume;if(!this.active||this.settings.mute)player.pause();}
  if(!this.music)return;this.music.volume=this.settings.mute?0:musicVolume;
  if(!this.active||this.settings.mute||musicVolume===0){this.music.pause();this.musicPlaying=false;}else if(!this.musicPlaying){this.music.play();this.musicPlaying=true;}
 }
 update(patch:Partial<AudioPreferences>){const track=this.settings.track;this.settings=parseAudioPreferences(JSON.stringify({...this.settings,...patch}));if(track!==this.settings.track)this.replaceMusic();else this.applyVolumes();const saved=JSON.stringify(this.settings);this.saves=this.saves.then(()=>this.store.set(AUDIO_KEY,saved)).catch(()=>{});this.emit();}
 nextTrack(){this.update({track:(this.settings.track+1)%this.tracks.length});}
 foreground(active:boolean){this.active=active;this.applyVolumes();}
 play(name:string){if(!this.driver||!this.active||this.settings.mute||this.settings.master*this.settings.sfx===0||this.sources[name]===undefined)return;
  const now=this.now();if(now-(this.last.get(name)??-Infinity)<160||name==='ui_click'&&now-this.lastEffect<55)return;this.last.set(name,now);this.lastEffect=now;
  let player=this.effects.get(name);const fresh=!player;if(!player){if(this.effects.size>=8){const id=this.effects.keys().next().value!;this.effects.get(id)!.remove();this.effects.delete(id);}player=this.driver.create(this.sources[name]!);this.effects.set(name,player);}else{this.effects.delete(name);this.effects.set(name,player);}
  player.loop=false;player.volume=this.settings.master*this.settings.sfx;if(fresh){player.play();return;}player.pause();const current=player;
  void current.seekTo(0).then(()=>{if(this.active&&!this.settings.mute&&this.effects.get(name)===current)current.play();}).catch(()=>{});
 }
 flushed(){return this.saves;}
 dispose(){this.finish?.();this.music?.remove();for(const p of this.effects.values())p.remove();this.effects.clear();this.music=undefined;this.driver=undefined;this.starting=undefined;this.musicPlaying=false;}
}
