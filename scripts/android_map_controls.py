"""Short Dominion 2.2 atlas release smoke: launch, campaign, HUD, army and save/restart.
No soak, no camera matrix and no production room writes.
"""
import json,re,subprocess,sys,time
from pathlib import Path
from PIL import Image
from android_accessibility import dump_hierarchy,find_enabled_control,assert_no_game_fatal
from map_paint_check import assert_map_painted
PACKAGE='com.elcin31.grandstrategymultiplayer';OUT=Path('android-lean-smoke');OUT.mkdir(exist_ok=True)
def adb(*args,timeout=None):return subprocess.check_output(['adb',*map(str,args)],text=True,stderr=subprocess.STDOUT,timeout=timeout)
def root(name):return dump_hierarchy(adb,PACKAGE,OUT,name,'/sdcard/dominion21.xml')
def visible_bounds(tree,target):
    def walk(node,ancestors):
        if node is target:
            box=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
            if len(box)!=4:return None
            for parent in ancestors:
                clip=list(map(int,re.findall(r'\d+',parent.get('bounds',''))))
                if len(clip)==4:box=[max(box[0],clip[0]),max(box[1],clip[1]),min(box[2],clip[2]),min(box[3],clip[3])]
            return box if box[2]>box[0] and box[3]-box[1]>=12 else None
        for child in node:
            result=walk(child,ancestors+[node])
            if result is not None:return result
        return None
    return walk(tree,[])
def tap(node,box=None):
    coords=box if box is not None else list(map(int,re.findall(r'\d+',node.get('bounds',''))));assert len(coords)==4
    x,y=(coords[0]+coords[2])//2,(coords[1]+coords[3])//2;adb('shell','input','swipe',x,y,x,y,100)
def control(label,name,scroll=False,tap_control=True):
    for attempt in range(7 if scroll else 3):
        tree=root(name+'-'+str(attempt));node=find_enabled_control(tree,label)
        if node is not None:
            box=visible_bounds(tree,node)
            if box is not None and (tap_control or box[3]-box[1]>=200):
                if tap_control:tap(node,box)
                return node
        if scroll:
            containers=[]
            for n in tree.iter('node'):
                box=list(map(int,re.findall(r'\d+',n.get('bounds',''))))
                if n.get('scrollable')=='true' and len(box)==4 and box[3]-box[1]>120:containers.append(box)
            assert containers,'Missing scrollable context panel'
            box=max(containers,key=lambda b:(b[2]-b[0])*(b[3]-b[1]));x=(box[0]+box[2])//2;h=box[3]-box[1]
            adb('shell','input','swipe',x,int(box[1]+h*.82),x,int(box[1]+h*.22),350)
        time.sleep(1)
    raise AssertionError('Missing enabled control: '+label)
def horizontal_control(label,name):
    for attempt in range(6):
        tree=root(name+'-'+str(attempt));node=find_enabled_control(tree,label)
        if node is not None:
            box=visible_bounds(tree,node)
            if box is not None and box[2]-box[0]>=25:
                tap(node,box);return
        bars=[]
        for n in tree.iter('node'):
            b=list(map(int,re.findall(r'\d+',n.get('bounds',''))))
            if n.get('scrollable')=='true' and len(b)==4 and b[2]-b[0]>3*(b[3]-b[1]):bars.append(b)
        assert bars,'Missing horizontal filter/tab strip'
        b=max(bars,key=lambda q:q[2]-q[0]);y=(b[1]+b[3])//2
        direction=-1 if attempt<3 else 1
        left=int(b[0]+(b[2]-b[0])*.2);right=int(b[0]+(b[2]-b[0])*.8)
        adb('shell','input','swipe',right if direction<0 else left,y,left if direction<0 else right,y,300);time.sleep(.3)
    raise AssertionError('Missing horizontal control: '+label)
def capture(name):
    with (OUT/(name+'.png')).open('wb') as f:subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
def navigation(label,name,direction='up'):
    # The eleven 44dp targets intentionally scroll on short landscape screens.
    # Scroll the actual left rail, then tap the visible enabled target once.
    for attempt in range(5):
        tree=root(name+'-'+str(attempt));node=find_enabled_control(tree,label)
        if node is not None:
            box=visible_bounds(tree,node)
            if box is not None:
                tap(node,box)
                return node
        rails=[]
        for n in tree.iter('node'):
            box=list(map(int,re.findall(r'\d+',n.get('bounds',''))))
            if n.get('scrollable')=='true' and len(box)==4 and box[3]-box[1]>120:rails.append(box)
        assert rails,'Missing scrollable navigation rail'
        box=min(rails,key=lambda b:b[0]);x=(box[0]+box[2])//2;h=box[3]-box[1]
        low,high=int(box[1]+h*.82),int(box[1]+h*.22)
        adb('shell','input','swipe',x,low if direction=='down' else high,x,high if direction=='down' else low,350)
        time.sleep(.5)
    raise AssertionError('Missing enabled navigation: '+label)
def launch():
    adb('shell','am','force-stop',PACKAGE);adb('shell','am','start','-W','-n',PACKAGE+'/.MainActivity');time.sleep(10)