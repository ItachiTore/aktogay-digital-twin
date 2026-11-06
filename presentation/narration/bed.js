// Синтезирует музыкальную подложку: пары слегка расстроенных тонов дают медленное биение.
// node bed.js <ffmpeg> <секунды> <out.wav>
var cp=require('child_process');
var ff=process.argv[2], dur=process.argv[3], out=process.argv[4];
var F=[55,55.13, 110,110.27, 164.81,165.04, 220,220.41, 261.63,261.95, 329.63,330.12];
var G=[0.55,0.55, 0.70,0.70, 0.40,0.40, 0.34,0.34, 0.22,0.22, 0.14,0.14];
var args=['-y','-v','error'], f=[], tags=[];
F.forEach(function(hz,i){
  args.push('-f','lavfi','-i','sine=frequency='+hz+':duration='+dur+':sample_rate=48000');
  f.push('['+i+':a]volume='+G[i]+'[o'+i+']'); tags.push('[o'+i+']');
});
f.push(tags.join('')+'amix=inputs='+F.length+':normalize=0[mix]');
f.push('[mix]lowpass=f=1500,highpass=f=45,aecho=0.8:0.85:320|610:0.28|0.18,'+
       'aformat=channel_layouts=stereo:sample_rates=48000,'+
       'afade=t=in:st=0:d=4,afade=t=out:st='+(dur-6)+':d=6,'+
       'volume=0.42,alimiter=limit=0.9[out]');
args.push('-filter_complex',f.join(';'),'-map','[out]','-c:a','pcm_s16le',out);
var r=cp.spawnSync(ff,args,{encoding:'utf8'});
if(r.stderr)process.stderr.write(r.stderr);
process.exit(r.status);
