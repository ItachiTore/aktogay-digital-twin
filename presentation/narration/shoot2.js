// Переснимает пульт диспетчера и терминал водителя после демо-входа.
// Логин и пароль — демонстрационные, они напечатаны на самой странице входа.
// node shoot2.js <порт> <база> <папка>
var http=require('http'),fs=require('fs'),path=require('path');
var PORT=process.argv[2], BASE=process.argv[3], OUT=process.argv[4];
function get(p){return new Promise(function(ok,no){http.get({host:'127.0.0.1',port:PORT,path:p},function(r){var b='';r.on('data',function(c){b+=c});r.on('end',function(){ok(b)})}).on('error',no)})}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
function Session(url){var ws=new WebSocket(url),id=0,w={},ready,open=new Promise(function(r){ready=r});
 ws.onopen=function(){ready()};ws.onmessage=function(e){var m=JSON.parse(e.data);if(m.id&&w[m.id]){w[m.id](m);delete w[m.id]}};
 this.ready=open;this.send=function(m,p){return open.then(function(){return new Promise(function(ok,no){var n=++id;w[n]=function(x){x.error?no(new Error(m+': '+x.error.message)):ok(x.result)};ws.send(JSON.stringify({id:n,method:m,params:p||{}}))})})};
 this.close=function(){ws.close()};}

var FILL = function (user, pass) {
  var set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  var ins = document.querySelectorAll('form input');
  if (ins.length < 2) return 'нет полей: ' + ins.length;
  set.call(ins[0], user); ins[0].dispatchEvent(new Event('input', { bubbles: true }));
  set.call(ins[1], pass); ins[1].dispatchEvent(new Event('input', { bubbles: true }));
  var b = document.querySelector('form button[type=submit]');
  if (!b) return 'нет кнопки';
  b.click();
  return 'ok';
};
var PICK = function (role) {
  var b = [].slice.call(document.querySelectorAll('button')).find(function (e) { return (e.textContent || '').indexOf(role) === 0; });
  if (b) { b.click(); return 'ok'; }
  return 'роль не найдена';
};

(async function(){
 var page=JSON.parse(await get('/json/list')).filter(function(t){return t.type==='page'})[0];
 var s=new Session(page.webSocketDebuggerUrl); await s.ready;
 await s.send('Runtime.enable'); await s.send('Page.enable');
 await s.send('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false});
 async function run(fn,arg){
   var r=await s.send('Runtime.evaluate',{expression:'('+fn.toString()+')('+JSON.stringify(arg).slice(1,-1)+')',returnByValue:true});
   return r.result.value;
 }
 async function evalRaw(expr){var r=await s.send('Runtime.evaluate',{expression:expr,returnByValue:true});return r.result.value}
 async function shot(file){var r=await s.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,file),Buffer.from(r.data,'base64'));console.log('снято '+file)}

 // Диспетчер
 await s.send('Page.navigate',{url:BASE+'#/dispatch'}); await sleep(7000);
 console.log('вход диспетчера: '+await evalRaw('('+FILL.toString()+')("dispatcher","demo")'));
 await sleep(9000); await shot('07-dispatch.png');

 // Водитель: выйти, выбрать роль, войти заново
 await s.send('Page.navigate',{url:BASE+'#/terminal'}); await sleep(5000);
 var out=await evalRaw('(function(){var b=[].slice.call(document.querySelectorAll("button")).find(function(e){return /Выйти|Выход/.test(e.textContent||"")});if(b){b.click();return "вышли"}return "кнопки выхода нет"})()');
 console.log(out); await sleep(3000);
 await s.send('Page.navigate',{url:BASE+'#/terminal'}); await sleep(5000);
 console.log('выбор роли: '+await evalRaw('('+PICK.toString()+')("Водитель")'));
 await sleep(1500);
 console.log('вход водителя: '+await evalRaw('('+FILL.toString()+')("driver-105","demo")'));
 await sleep(9000); await shot('08-terminal.png');
 s.close();
})().catch(function(e){console.log('ОШИБКА: '+e.message);process.exit(1)});
