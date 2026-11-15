"""Build a narrated, English-captioned 30 s H5 film from the built FIRST FIRE interface.

On macOS install ffmpeg, Pillow, Playwright/Chromium, and a local English say voice.
Run python scripts/build.py, then python scripts/build_master_film.py.
Optional --capture-dir reuses previous screenshots. No synthesis service receives project data.
"""
import argparse
import hashlib
from pathlib import Path
import json
import math
import os
import subprocess as sp
import tempfile
import urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT=Path(__file__).resolve().parents[1]
SOURCE='https://science.nasa.gov/wp-content/uploads/2023/09/candle-flames.gif'
PHOTO_SHA='b143eecdf5e301e43b1e4f95d576bc4454f18e2dc80c83e21149e036afff9836'
FPS=24
# Frame boundaries preserve the 0/6/13/22/30-second chapters in H5. Spoken and caption text are identical.
SHOTS=[
 (0,73,'candle','Earth / 1 g','Flame on Earth','NASA candle photograph','For decades, NASA has screened spacecraft materials'),
 (73,144,'rule','Material screening','The upward test','NASA Test 1','with an upward flame test on Earth.'),
 (144,233,'material','Lunar gravity','A lower limit','Short reduced-gravity tests','In lunar-gravity tests, some materials burned in less oxygen.'),
 (233,312,'atlas','Archive coverage','0 lunar burns','Orbital flight archive','Yet our flight archive contains no lunar burns.'),
 (312,398,'compass','Habitat compass','1,622 rows','15 NASA investigations','FIRST FIRE maps 1,622 NASA source rows,'),
 (398,460,'referee','The Referee','Quote rejected','A missing word reverses the claim','checks quotations against their sources,'),
 (460,528,'rover','Pressurized rover','Cabin trial','Prescribed fire and atmosphere','and lets you test a rover cabin.'),
 (528,623,'forecast','Lunar experiment','Four burns','FM² · Synergy Pro Navy fabric','NASA plans four fabric burns on the Moon.'),
 (623,720,'seal','Forecast sealed','14 NOV 2026','12:57:06 UTC','We signed our forecast. The results will show how it scored.')]
W,H=1280,720
ink='#eff6f2';orange='#ff8b54';muted='#b5c6c0';bg='#132520'
fontdir=ROOT/'site/fonts'
def font(key,size):
    return ImageFont.truetype(str(fontdir/({'display':'barlow-bold.ttf','body':'dm-regular.ttf','bold':'dm-bold.ttf'}[key])),size)

def run(args,**kw):return sp.run([str(arg) for arg in args],check=True,**kw)

def duration(file):
    return float(sp.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(file)],text=True).strip())

def wrap(draw,text,f,maxw):
    lines=[]
    for w in text.split():
        if lines and draw.textlength(lines[-1]+' '+w,font=f)<=maxw:lines[-1]+=' '+w
        else:lines.append(w)
    return lines

def clock(n):
    ms=round(n*1000/FPS)
    return f'00:00:{ms//1000:02d}.{ms%1000:03d}'

def backdrop(shot):
    _,_,key,section,title,support,cue=shot
    image=Image.new('RGB',(W,H),bg);d=ImageDraw.Draw(image)
    d.rectangle((0,0,W,74),fill='#0d1916');d.rectangle((0,568,W,H),fill='#091410')
    d.line((44,566,W-44,566),fill='#486053',width=2)
    for j in range(3):
        x=46+j*12;y=44-j*6
        d.polygon([(x,y),(x+6,y),(x+10,26-j*2),(x+4,26-j*2)],fill=orange)
    d.text((96,15),'FIRST FIRE',font=font('display',38),fill=ink)
    credit='SI-generated narration'
    cf=font('bold',34)
    d.text((W-45-d.textlength(credit,font=cf),22),credit,font=cf,fill='#f1ccad')
    d.text((45,125),section.upper(),font=font('bold',23),fill=orange)
    titlefont=font('display',77)
    titlelines=wrap(d,title,titlefont,345)
    for j,line in enumerate(titlelines):d.text((42,178+j*79),line,font=titlefont,fill=ink)
    y=202+len(titlelines)*79
    for j,line in enumerate(wrap(d,support,font('body',30),315)):d.text((46,y+j*40),line,font=font('body',30),fill=muted)
    capfont=font('bold',48)
    lines=wrap(d,cue,capfont,1190)
    if len(lines)>2:raise ValueError('Caption exceeds mobile-safe area: '+cue)
    top=596 if len(lines)==2 else 614
    for j,line in enumerate(lines):
        x=round((W-d.textlength(line,font=capfont))/2);d.text((x,top+j*51),line,font=capfont,fill='#ffffff',stroke_width=0)
    return image

def screenshot(dir,key):
    if key=='candle':
        p=dir/'nasa-candle.gif'
        if not p.exists():urllib.request.urlretrieve(SOURCE,p)
        if hashlib.sha256(p.read_bytes()).hexdigest()!=PHOTO_SHA:raise ValueError('NASA source fingerprint changed')
        with Image.open(p) as im:return im.convert('RGB').crop((9,7,498,755))
    with Image.open(dir/(key+'.png')) as im:return im.convert('RGB')

def compose(base,shot,src,frame):
    start,end,key,*_=shot
    img=base.copy();d=ImageDraw.Draw(img)
    X,Y,sw,sh=405,100,830,443
    d.rounded_rectangle((X-2,Y-2,X+sw+2,Y+sh+2),radius=16,fill='#607068')
    photo=key=='candle'
    bgc='#090a08' if photo else '#fffef9'
    panel=Image.new('RGB',(sw,sh),bgc)
    # On the opening shot the terrestrial half of NASA's paired photo is shown at its native aspect.
    # Small optical push-ins occur within the screen frame; subtitle size and alignment remain fixed.
    scale=min((sw-26)/src.width,(sh-26)/src.height)
    if photo:scale=sh/src.height
    rel=(frame-start)/max(1,end-start-1)
    zoom=1+.018*(1-math.cos(rel*math.pi))/2
    size=(round(src.width*scale*zoom),round(src.height*scale*zoom))
    item=src.resize(size,Image.Resampling.LANCZOS)
    panel.paste(item,((sw-size[0])//2,(sh-size[1])//2))
    mask=Image.new('L',(sw,sh));ImageDraw.Draw(mask).rounded_rectangle((0,0,sw-1,sh-1),radius=14,fill=255)
    img.paste(panel,(X,Y),mask)
    if photo:d.text((X+18,Y+sh-40),'NASA / 1 g',font=font('bold',23),fill='#ffffff')
    return img

def audio(dir,i,shot,voice):
    start,end,*_,words=shot
    raw=dir/f'narration-{i}.aiff';trimmed=dir/f'trim-{i}.wav';dest=dir/f'voice-{i}.wav'
    run(['say','-v',voice,'-r','171','-o',raw,words])
    run(['ffmpeg','-loglevel','error','-y','-i',raw,'-af','silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.02,areverse','-ar','48000','-ac','1',trimmed])
    available=(end-start)/FPS
    rate=max(.91,duration(trimmed)/(available-.12))
    run(['ffmpeg','-loglevel','error','-y','-i',trimmed,'-af',f'atempo={rate:.6f},adelay=35:all=1,apad,atrim=duration={available:.9f}','-ar','48000','-ac','1',dest])
    return dest

def make(d,capture,voice):
    if capture:
        run([os.environ.get('NODE','node'),ROOT/'scripts/capture_master_film.cjs',d])
    audio_files=[audio(d,i,shot,voice) for i,shot in enumerate(SHOTS)]
    concat=d/'voice-list.txt';concat.write_text(''.join("file '"+str(p)+"'\n" for p in audio_files))
    narration=d/'english.wav'
    run(['ffmpeg','-loglevel','error','-y','-f','concat','-safe','0','-i',concat,'-af','loudnorm=I=-17:TP=-1.5:LRA=7','-ar','48000',narration])
    target=d/'master-film.mp4'
    args=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-i',str(narration),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-ar','48000','-metadata:s:a:0','language=eng','-metadata','title=FIRST FIRE | The lunar fire forecast','-metadata','comment=English SI-generated narration. NASA candle photograph, captured FIRST FIRE dashboard and burned-in English captions.','-t','30','-movflags','+faststart',str(target)]
    proc=sp.Popen(args,stdin=sp.PIPE)
    try:
        for shot in SHOTS:
            bg=backdrop(shot);im=screenshot(d,shot[2])
            for n in range(shot[0],shot[1]):proc.stdin.write(compose(bg,shot,im,n).tobytes())
    finally:proc.stdin.close()
    if proc.wait():raise RuntimeError('ffmpeg failed')
    if abs(duration(target)-30)>.005:raise RuntimeError('Unexpected film duration')
    import shutil
    shutil.copyfile(target,ROOT/'site/master-film.mp4')
    (ROOT/'site/master-film.vtt').write_text('WEBVTT\n\n'+''.join(f'{clock(s[0])} --> {clock(s[1])}\n{s[-1]}\n\n' for s in SHOTS))

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--capture-dir',type=Path);ap.add_argument('--voice',default='Samantha');args=ap.parse_args()
    if args.capture_dir:make(args.capture_dir.resolve(),False,args.voice)
    else:
        with tempfile.TemporaryDirectory() as folder:make(Path(folder),True,args.voice)

if __name__=='__main__':main()
