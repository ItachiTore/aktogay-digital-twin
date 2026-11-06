// Собирает дорожку: реплики по таймкодам + музыкальная подложка, которая
// автоматически приглушается под голосом. Исходное видео не трогается.
// node mux2.js <ffmpeg> <video-in> <video-out> [bitrate]
var fs=require('fs'),path=require('path'),cp=require('child_process');
var dir=__dirname;
var ff=process.argv[2], vin=process.argv[3], vout=process.argv[4], br=process.argv[5]||'96k';
var lines=JSON.parse(fs.readFileSync(path.join(dir,'lines.json'),'utf8'));

var args=['-y','-v','error','-i',vin];
var f=[], tags=[];
lines.forEach(function(l,i){
  var w=path.join(dir,'cue'+String(i+1).padStart(2,'0')+'.wav');
  if(!fs.existsSync(w))throw new Error('нет '+w);
  args.push('-i',w);
  var ms=Math.round(l.at*1000);
  f.push('['+(i+1)+':a]aformat=channel_layouts=stereo:sample_rates=48000,adelay='+ms+'|'+ms+'[a'+i+']');
  tags.push('[a'+i+']');
});
var bedIdx=lines.length+1;
args.push('-i',path.join(dir,'bed.wav'));

f.push(tags.join('')+'amix=inputs='+lines.length+':normalize=0,alimiter=limit=0.95,apad[voice]');
f.push('[voice]asplit=2[v1][vkey]');
// подложка приглушается, когда звучит голос
f.push('['+bedIdx+':a][vkey]sidechaincompress=threshold=0.02:ratio=14:attack=20:release=700:makeup=1[bedduck]');
f.push('[v1][bedduck]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[aout]');

var fp=path.join(dir,'filter2.txt');
fs.writeFileSync(fp,f.join(';\n'));
args.push('-filter_complex_script',fp,'-map','0:v','-map','[aout]',
  '-c:v','copy','-c:a','aac','-b:a',br,'-movflags','+faststart','-shortest',vout);
var r=cp.spawnSync(ff,args,{encoding:'utf8'});
if(r.stderr)process.stderr.write(r.stderr);
if(r.status!==0){console.log('FFMPEG FAIL');process.exit(1)}
console.log('OK -> '+vout+'  '+(fs.statSync(vout).size/1048576).toFixed(2)+' MB');
