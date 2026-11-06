// Снимает разделы интерфейса через Chrome DevTools Protocol.
// node shoot.js <порт-отладки> <база> <выходная-папка>
var http=require('http'),fs=require('fs'),path=require('path');
var PORT=process.argv[2]||'9222', BASE=process.argv[3], OUT=process.argv[4];

var SHOTS=[
 {hash:'#/',            file:'01-mine.png',      wait:22000},
 {hash:'#/map',         file:'02-sitemap.png',   wait:12000},
 {hash:'#/fleet',       file:'03-fleet.png',     wait:8000},
 {hash:'#/drivers',     file:'04-drivers.png',   wait:8000},
 {hash:'#/geology',     file:'05-geology.png',   wait:12000},
 {hash:'#/twins',       file:'06-twins.png',     wait:9000},
 {hash:'#/dispatch',    file:'07-dispatch.png',  wait:8000},
 {hash:'#/terminal',      file:'08-terminal.png',  wait:8000},
 {hash:'#/scenarios',   file:'09-scenarios.png', wait:7000},
 {hash:'#/timeline',    file:'10-timeline.png',  wait:10000},
 {hash:'#/effect',      file:'11-effect.png',    wait:14000},
 {hash:'#/report',      file:'12-report.png',    wait:10000}
];

function get(p){return new Promise(function(ok,no){
  http.get({host:'127.0.0.1',port:PORT,path:p},function(r){var b='';r.on('data',function(c){b+=c});r.on('end',function(){ok(b)})}).on('error',no);});}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)});}

function Session(url){
  var ws=new WebSocket(url), id=0, waiting={}, ready;
  var open=new Promise(function(r){ready=r});
  ws.onopen=function(){ready()};
  ws.onmessage=function(e){var m=JSON.parse(e.data); if(m.id&&waiting[m.id]){waiting[m.id](m); delete waiting[m.id];}};
  this.ready=open;
  this.send=function(method,params){return open.then(function(){
    return new Promise(function(ok,no){
      var n=++id; waiting[n]=function(m){ m.error?no(new Error(method+': '+m.error.message)):ok(m.result); };
      ws.send(JSON.stringify({id:n,method:method,params:params||{}}));
    });});};
  this.close=function(){ws.close()};
}

(async function(){
  var list=JSON.parse(await get('/json/list'));
  var page=list.filter(function(t){return t.type==='page'})[0];
  if(!page){console.log('нет открытой вкладки');process.exit(1)}
  var s=new Session(page.webSocketDebuggerUrl);
  await s.ready;
  await s.send('Page.enable');
  await s.send('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false});

  for(var i=0;i<SHOTS.length;i++){
    var sh=SHOTS[i];
    await s.send('Page.navigate',{url:BASE+sh.hash});
    await sleep(sh.wait);
    var r=await s.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    fs.writeFileSync(path.join(OUT,sh.file),Buffer.from(r.data,'base64'));
    console.log(sh.file+'  '+(Buffer.from(r.data,'base64').length/1024).toFixed(0)+' KB');
  }
  s.close();
})().catch(function(e){console.log('ОШИБКА: '+e.message);process.exit(1)});
