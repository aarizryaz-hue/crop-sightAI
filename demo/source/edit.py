"""Assemble the real browser recording with narration, captions and an end card.

Requires ffmpeg (FFMPEG env), macOS say, and the recording timeline.
No result text or app pixels are replaced. Only request waits are shortened.
"""
import json, os, pathlib, subprocess, re

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORK = pathlib.Path(os.environ.get('DEMO_WORK_DIR', '/tmp/cropsight-recording'))
FF = os.environ.get('FFMPEG', '/tmp/cropsight-video-tools/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1')
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
SCENES = [
 ('01-intro',5, 'CropSight helps farmworkers turn unfamiliar crop symptoms into a clearer conversation.', 'CropSight · See the signs. Know what to check.'),
 ('02-photo',6, 'Choose Seeds or Harvest, then add a crop photo. A close-up can provide another view.', '01 / Choose a focus and add a photo'),
 ('03-consent',5, 'Photos go to OpenAI only after consent. The API key stays on the server.', '02 / Give consent before sending the photo'),
 ('04-wait',2, '', 'Live AI request · Waiting time shortened'),
 ('05-evidence',7, 'This is a real model response. Numbered observations separate visible evidence from possible explanations.', '03 / Review what the model can actually see'),
 ('06-causes',7, 'Possible causes point back to those observations, with checks that can help tell similar problems apart.', '04 / Compare explanations and what to check'),
 ('07-question',5, 'One follow-up gathers useful context. When you do not know, say so.', '05 / Answer one useful follow-up'),
 ('08-refined',4, 'The next analysis includes your answer as reported context.', 'Fresh analysis · Waiting time shortened'),
 ('09-summary',7, 'Copy a concise summary for your supervisor. The result states its limits and asks for human review.', '06 / Share a clearer summary with your supervisor'),
 ('10-settings',6, 'English comes first. Spanish and installation options live in Settings. AI analysis needs internet.', 'English first · Language and installation in Settings'),
]

def run(args):
 subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

def duration(file):
 p = subprocess.run([FF,'-hide_banner','-i',str(file)],capture_output=True,text=True)
 m = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)',p.stderr)
 if not m: raise RuntimeError('Cannot determine duration of '+str(file))
 return int(m[1])*3600+int(m[2])*60+float(m[3])

timeline = json.loads((WORK/'timeline.json').read_text())
segments = {s['id']:s for s in timeline['segments']}
results = json.loads((WORK/'live-results.json').read_text())
if not results[-1]['data']['result']['possible_problems']:
 # Match narration to the actual result. Never narrate features absent from this run.
 # This recorded run mislabeled a visibly damaged tomato as healthy.
 SCENES = [(id,seconds,speech,caption) if id!='06-causes' else (
  id,seconds+9,
  'This test also exposes a limitation. The model calls the fruit healthy despite noticing a dark patch. That inconsistency needs human review. Its suggested next steps are not permission to harvest. We have not measured accuracy yet.',
  'Known limitation in this test: the AI gives an overly reassuring verdict'
 ) for id,seconds,speech,caption in SCENES]
clips=[]; subtitles=[]; transcript=[]; clock=0
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'

for id,seconds,speech,caption in SCENES:
 if id not in segments: continue
 segment=segments[id]
 wav=WORK/(id+'.wav'); txt=WORK/(id+'.txt'); cap=WORK/(id+'-caption.txt')
 txt.write_text(speech);cap.write_text(caption)
 if speech:
  aiff=WORK/(id+'.aiff')
  run(['/usr/bin/say','-v','Samantha','-r','178','-o',str(aiff),'-f',str(txt)])
  speed=max(1,duration(aiff)/(seconds-.4))
  run([FF,'-y','-i',str(aiff),'-af',f'atempo={speed},loudnorm=I=-16:TP=-1.5:LRA=11,apad','-t',str(seconds),'-ar','48000','-ac','2',str(wav)])
 else:
  run([FF,'-y','-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t',str(seconds),str(wav)])
 output=WORK/(id+'.mp4')
 available=segment['end']-segment['start']
 vf=f"fps=30,tpad=stop_mode=clone:stop_duration={seconds},trim=duration={seconds},pad=1440:1080:0:0:color=0x0c1711,drawbox=x=0:y=960:w=iw:h=2:color=0x89bd91:t=fill,drawtext=fontfile='{FONT}':textfile='{cap}':fontsize=30:fontcolor=0xebf3e2:x=(w-tw)/2:y=1000"
 run([FF,'-y','-ss',str(segment['start']),'-t',str(available),'-i',str(WORK/'raw.webm'),'-i',str(wav),'-vf',vf,'-t',str(seconds),'-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k',str(output)])
 clips.append(output)
 subtitles.append(f'{len(subtitles)+1}\n{stamp(clock)} --> {stamp(clock+seconds)}\n{speech or caption}\n')
 transcript.append({'start':clock,'duration':seconds,'narration':speech,'caption':caption})
 clock+=seconds
 print('Edited '+id,flush=True)

end=WORK/'end.mp4'
end_text=WORK/'end.txt'
end_text.write_text('AI observations, not a diagnosis. Human review required.\n\nPrototype — accuracy not yet measured.\n\nPhoto: Fructibus / Wikimedia Commons / CC0\nLive responses. Waits shortened. Google Play release pending.')
end_filters=f"drawtext=fontfile='{FONT}':text='CropSight':fontsize=110:fontcolor=0x9bcc9c:x=(w-tw)/2:y=235,drawtext=fontfile='{FONT}':text='See the signs. Know what to check.':fontsize=40:fontcolor=0xe6efdc:x=(w-tw)/2:y=390,drawtext=fontfile='{FONT}':textfile='{end_text}':fontsize=26:fontcolor=0xb9caba:line_spacing=18:x=(w-tw)/2:y=580"
run([FF,'-y','-f','lavfi','-i','color=c=0x102019:s=1440x1080:r=30','-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-vf',end_filters,'-t','6','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k',str(end)])
clips.append(end);clock+=6
listing=WORK/'concat.txt';listing.write_text(''.join("file '"+str(c)+"'\n" for c in clips))
run([FF,'-y','-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(ROOT/'CropSight-demo.mp4')])
(ROOT/'CropSight-demo.srt').write_text('\n'.join(subtitles))
(ROOT/'source'/'narration.json').write_text(json.dumps(transcript,indent=2)+'\n')
print(f'Created {ROOT / "CropSight-demo.mp4"} ({clock}s)',flush=True)
