"""Original procedural score and cues. No third-party melodies or audio samples."""
from pathlib import Path
import json,math,hashlib,subprocess,wave
import numpy as np
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/audio/dominion-2.1.1';OUT.mkdir(parents=True,exist_ok=True)
SR=44100;manifest=[]
def wavefile(path,signal,rate=SR):
    values=np.clip(signal,-.95,.95)
    with wave.open(str(path),'wb') as f:
        f.setnchannels(1 if values.ndim==1 else 2);f.setsampwidth(2);f.setframerate(rate);f.writeframes((values*32767).astype('<i2').tobytes())
def voice(midi,duration,kind='strings'):
    t=np.arange(int(duration*SR))/SR;freq=440*2**((midi-69)/12)
    if kind=='lute':
        tone=sum(np.sin(2*np.pi*freq*k*t)*math.exp(-k*.22)/k for k in range(1,8));envelope=np.minimum(1,t/.018)*np.exp(-t*1.35)*np.minimum(1,(duration-t)/.06)
    elif kind=='flute':
        tone=np.sin(2*np.pi*freq*t+.01*np.sin(2*np.pi*4*t))+.16*np.sin(2*np.pi*freq*2*t);envelope=np.minimum(1,t/.16)*np.minimum(1,(duration-t)/.25)
    else:
        tone=sum(np.sin(2*np.pi*freq*k*t+(.002*k)*np.sin(2*np.pi*3*t))/k**1.8 for k in range(1,7));envelope=np.minimum(1,t/.8)*np.minimum(1,(duration-t)/.8)
    return tone*envelope
tracks=[('atlas','Атлас держав',57,60,[(0,3,7),(-5,-1,2),(-2,2,5),(-7,-3,0)], [7,10,7,5,3,5,7,2,0,3,5,7,10,7,5,3]),('council','Военный совет',52,54,[(0,3,7),(-2,2,5),(-5,-1,2),(-7,-3,0)],[0,7,10,12,10,7,5,3,2,5,7,10,7,5,3,2]),('peace','Письма мира',57,66,[(0,3,7),(-5,-1,2),(-9,-5,-2),(-7,-3,0)],[12,10,7,5,7,3,5,7,10,12,10,7,5,3,2,0])]
for index,(slug,title,root,tempo,chords,motif) in enumerate(tracks):
    beat=60/tempo;duration=96*beat;signal=np.zeros((int(duration*SR),2),dtype=np.float64)
    def add(at,midi,length,gain,kind,pan=0):
        note=voice(midi,length,kind)*gain;start=int(at*SR);count=min(len(note),len(signal)-start)
        if count<=0:return
        signal[start:start+count,0]+=note[:count]*(1-pan*.35);signal[start:start+count,1]+=note[:count]*(1+pan*.35)
    for bar in range(24):
        chord=chords[(bar//2)%len(chords)];at=bar*4*beat
        for j,note in enumerate(chord):add(at,root+note,4.6*beat,.036,'strings',(j-1)*.4)
        add(at,root+chord[0]-12,3.8*beat,.028,'strings')
        for b in range(4):add(at+b*beat,root+12+chord[(b+bar)%3],1.65*beat,.032,'lute',(-1 if b%2 else 1)*.4)
        if bar%2==1:
            for b in range(2):add(at+b*2*beat,root+12+motif[(bar+b+index*3)%len(motif)],1.7*beat,.044,'flute',.1)
    # Small original stereo room reflections, no sampled reverb.
    for delay,gain in [(int(SR*.13),.12),(int(SR*.31),.07)]:signal[delay:]+=signal[:-delay,::-1].copy()*gain
    fade=np.minimum(1,np.arange(len(signal))/(SR*2))*np.minimum(1,(len(signal)-np.arange(len(signal)))/(SR*2));signal*=fade[:,None];signal*=.48/max(.48,np.max(np.abs(signal)))
    tmp=Path('/workspace/scratch')/(slug+'.wav');wavefile(tmp,signal)
    target=OUT/(slug+'.ogg');subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(tmp),'-c:a','libvorbis','-q:a','3',str(target)],check=True);tmp.unlink()
    manifest.append({'id':slug,'titleRu':title,'kind':'Music','filename':target.name,'seconds':round(duration,2),'origin':'Original procedural composition created for Dominion; additive synthesis, no third-party samples or melodies','rights':'Project use permitted','sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
notes={'ui_click':([76],.10),'window_open':([60,67,72],.27),'window_close':([67,60],.18),'province':([72,76],.17),'confirm':([64,67,72],.30),'army':([48,55],.20),'march':([48,55,60],.28),'battle':([36,39,43],.65),'victory':([60,64,67,72],.70),'defeat':([55,51,48],.70),'siege_start':([36,43,48],.50),'siege_complete':([48,55,60,67],.60),'war':([36,37,43],.70),'alliance':([60,64,69],.50),'peace_offer':([62,65,69],.42),'peace_signed':([60,64,67,76],.65),'diplomatic':([67,71],.32),'construction':([55,60,64],.45),'technology':([67,72,79],.50),'focus':([62,69,74],.50),'notice':([72,69],.28)}
for name,(midi,duration) in notes.items():
    signal=np.zeros(int(duration*SR));step=duration/(len(midi)+1)
    for i,n in enumerate(midi):
        note=voice(n,duration-i*step,'lute')*.13;start=int(i*step*SR);signal[start:start+len(note)]+=note[:len(signal)-start]
    if name in ['battle','war','siege_start']:
        t=np.arange(len(signal))/SR;rng=np.random.default_rng(211+len(name));signal+=.08*np.sin(2*np.pi*(80*t-20*t*t))*np.exp(-t*8)+.04*rng.standard_normal(len(t))*np.exp(-t*22)
    target=OUT/(name+'.wav');wavefile(target,signal);manifest.append({'id':name,'kind':'Effect','filename':target.name,'seconds':duration,'origin':'Original synthesized Dominion cue, no third-party samples','rights':'Project use permitted','sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
(OUT/'audio-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Created',len(tracks),'original synthesized scores and',len(notes),'local cues;',sum((OUT/r['filename']).stat().st_size for r in manifest),'bytes')
