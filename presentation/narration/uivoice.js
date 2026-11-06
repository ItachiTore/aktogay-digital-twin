// Озвучивает ui-lines.json голосом ElevenLabs. Длительность кадра диктует сама реплика.
// node uivoice.js   (ffmpeg через переменную FFMPEG)
var fs=require('fs'),path=require('path'),https=require('https'),cp=require('child_process');
var dir=__dirname, FFMPEG=process.env.FFMPEG||'ffmpeg';
var KEY=process.env.ELEVENLABS_API_KEY||fs.readFileSync(path.join(process.env.USERPROFILE,'.elevenlabs_key'),'utf8').trim();
var V='JBFqnCBsd6RMkjVDRZzb';
var lines=JSON.parse(fs.readFileSync(path.join(dir,'ui-lines.json'),'utf8'));
function tts(text){return new Promise(function(ok,no){
 var body=JSON.stringify({text:text,model_id:'eleven_multilingual_v2',voice_settings:{stability:0.5,similarity_boost:0.75,style:0,use_speaker_boost:true}});
 var r=https.request({host:'api.elevenlabs.io',path:'/v1/text-to-speech/'+V+'?output_format=mp3_44100_128',method:'POST',headers:{'xi-api-key':KEY,'content-type':'application/json','content-length':Buffer.byteLength(body)}},function(res){var c=[];res.on('data',function(x){c.push(x)});res.on('end',function(){var b=Buffer.concat(c);if(res.statusCode!==200)return no(new Error(res.statusCode+' '+b.toString().slice(0,160)));ok(b)})});
 r.on('error',no);r.write(body);r.end();});}
(async function(){
 var total=0;
 for(var i=0;i<lines.length;i++){
  var base=path.join(dir,'ui'+String(i+1).padStart(2,'0'));
  if(fs.existsSync(base+'.wav')){ var l0=(fs.statSync(base+'.wav').size-44)/(48000*4); total+=l0; console.log(String(i+1).padStart(2,'0')+'  уже есть  '+l0.toFixed(1)+'s'); continue; }
  var buf=null;
  for(var a=0;a<8&&!buf;a++){
    try{ buf=await tts(lines[i].text); }
    catch(e){ console.log('  повтор '+(i+1)+': '+e.message); await new Promise(function(r){setTimeout(r,3000*(a+1))}); }
  }
  if(!buf){console.log('не удалось: реплика '+(i+1));process.exit(1)}
  fs.writeFileSync(base+'.mp3',buf);
  var q=cp.spawnSync(FFMPEG,['-y','-v','error','-i',base+'.mp3','-ar','48000','-ac','2','-c:a','pcm_s16le',base+'.wav']);
  if(q.status!==0){console.log('ffmpeg fail '+(i+1));process.exit(1)}
  fs.unlinkSync(base+'.mp3');
  var len=(fs.statSync(base+'.wav').size-44)/(48000*4);
  total+=len;
  console.log(String(i+1).padStart(2,'0')+'  '+lines[i].img+'  '+len.toFixed(1)+'s');
 }
 console.log('суммарно речи '+total.toFixed(0)+' с');
})().catch(function(e){console.log('ОШИБКА: '+e.message);process.exit(1)});
