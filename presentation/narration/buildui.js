// Собирает ролик по разделам интерфейса: кадр на каждый раздел, медленный наезд,
// перекрёстные переходы, озвучка по месту и музыкальная подложка с приглушением.
// node buildui.js <ffmpeg> <out.mp4> [битрейт-видео]
var fs=require('fs'),path=require('path'),cp=require('child_process');
var ff=process.argv[2], out=process.argv[3], vb=process.argv[4]||'2600k';
var dir=__dirname, V=path.join(dir,'voice'), U=path.join(dir,'ui');
var lines=JSON.parse(fs.readFileSync(path.join(V,'ui-lines.json'),'utf8'));

var FPS=30, X=0.7, LEAD=0.55, TAIL=1.15, W=1280, H=720;
var seg=lines.map(function(l,i){
  var w=path.join(V,'ui'+String(i+1).padStart(2,'0')+'.wav');
  var len=(fs.statSync(w).size-44)/(48000*4);
  return { img:path.join(U,l.img), wav:w, len:len, dur:len+LEAD+TAIL };
});
var starts=[], acc=0;
seg.forEach(function(s,i){ starts.push(acc); acc+=s.dur-(i<seg.length-1?X:0); });
var total=acc;
console.log('итого '+Math.floor(total/60)+' мин '+(total%60).toFixed(0)+' с');

// подложка нужной длины
var bed=path.join(V,'uibed.wav');
cp.spawnSync('node',[path.join(V,'bed.js'),ff,total.toFixed(2),bed],{stdio:'inherit'});

var args=['-y','-v','error'];
seg.forEach(function(s){ args.push('-loop','1','-framerate',String(FPS),'-t',s.dur.toFixed(3),'-i',s.img); });
seg.forEach(function(s){ args.push('-i',s.wav); });
args.push('-i',bed);

var f=[];
seg.forEach(function(s,i){
  var frames=Math.round(s.dur*FPS);
  var motion = process.env.NOZOOM
    ? 'scale=' + W + ':' + H + ':flags=lanczos,fps=' + FPS
    : 'scale=2400:-1:flags=lanczos,' +
      "zoompan=z='min(1.0+0.00016*on,1.045)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=" + W + 'x' + H + ':fps=' + FPS;
  f.push('[' + i + ':v]' + motion + ',' +
    'trim=end_frame=' + frames + ',setpts=PTS-STARTPTS,format=yuv420p,setsar=1[v' + i + ']');
});
var cur='[v0]';
for(var i=1;i<seg.length;i++){
  var off=starts[i]-0 ;
  var tag=(i===seg.length-1)?'[vfin]':'[x'+i+']';
  f.push(cur+'[v'+i+']xfade=transition=fade:duration='+X+':offset='+(off).toFixed(3)+tag);
  cur=tag;
}
f.push('[vfin]fade=t=in:st=0:d=0.8,fade=t=out:st='+(total-1.0).toFixed(2)+':d=1.0[vout]');

var tags=[];
seg.forEach(function(s,i){
  var ms=Math.round((starts[i]+LEAD)*1000);
  f.push('['+(seg.length+i)+':a]aformat=channel_layouts=stereo:sample_rates=48000,adelay='+ms+'|'+ms+'[s'+i+']');
  tags.push('[s'+i+']');
});
f.push(tags.join('')+'amix=inputs='+seg.length+':normalize=0,alimiter=limit=0.95,apad[voice]');
f.push('[voice]asplit=2[v1][vkey]');
f.push('['+(seg.length*2)+':a][vkey]sidechaincompress=threshold=0.02:ratio=14:attack=20:release=700:makeup=1[duck]');
f.push('[v1][duck]amix=inputs=2:normalize=0:duration=first,'+
  'highpass=f=45,equalizer=f=250:t=q:w=1.2:g=-2,equalizer=f=3800:t=q:w=1.5:g=2.5,'+
  'acompressor=threshold=-20dB:ratio=3:attack=12:release=180,loudnorm=I=-14:TP=-1.2:LRA=5[aout]');

var fp=path.join(dir,'uifilter.txt');
fs.writeFileSync(fp,f.join(';\n'));
args.push('-filter_complex_script',fp,'-map','[vout]','-map','[aout]',
  '-t',total.toFixed(2),
  '-c:v','libx264','-preset','slow','-crf',(process.env.CRF||'21'),'-maxrate','3000k','-bufsize','6000k','-pix_fmt','yuv420p','-r',String(FPS),
  '-c:a','aac','-b:a','128k','-movflags','+faststart',out);

var r=cp.spawnSync(ff,args,{encoding:'utf8'});
if(r.stderr)process.stderr.write(r.stderr);
if(r.status!==0){console.log('FFMPEG FAIL '+r.status);process.exit(1)}
console.log('OK -> '+out+'  '+(fs.statSync(out).size/1048576).toFixed(2)+' MB');
