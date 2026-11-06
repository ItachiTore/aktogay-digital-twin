// Озвучка реплик через ElevenLabs. Ключ берётся из файла или переменной окружения
// и никуда не печатается.
//   node eleven.js list                 — показать доступные голоса
//   node eleven.js say <voice_id>       — озвучить lines.json в cueNN.wav
var fs = require('fs'), path = require('path'), https = require('https'), cp = require('child_process');
var FFMPEG = process.env.FFMPEG || 'ffmpeg';

var dir = __dirname;
var KEY = process.env.ELEVENLABS_API_KEY ||
  (function () {
    var p = path.join(process.env.USERPROFILE || process.env.HOME || '', '.elevenlabs_key');
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : '';
  })();
if (!KEY) { console.log('НЕТ КЛЮЧА: положите его в %USERPROFILE%\\.elevenlabs_key или в ELEVENLABS_API_KEY'); process.exit(2); }

function req(opts, body) {
  return new Promise(function (res, rej) {
    var r = https.request(opts, function (resp) {
      var chunks = [];
      resp.on('data', function (c) { chunks.push(c); });
      resp.on('end', function () { res({ status: resp.statusCode, buf: Buffer.concat(chunks) }); });
    });
    r.on('error', rej);
    if (body) r.write(body);
    r.end();
  });
}

function wav(pcm, rate) {
  var h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function main() {
  var cmd = process.argv[2] || 'list';
  if (cmd === 'list') {
    var r = await req({ host: 'api.elevenlabs.io', path: '/v1/voices', method: 'GET', headers: { 'xi-api-key': KEY } });
    if (r.status !== 200) { console.log('HTTP ' + r.status); process.exit(1); }
    JSON.parse(r.buf.toString()).voices.forEach(function (v) {
      console.log(v.voice_id + '  ' + v.name + '  ' + (v.labels ? JSON.stringify(v.labels) : ''));
    });
    return;
  }

  var voice = process.argv[3];
  if (!voice) { console.log('укажите voice_id'); process.exit(2); }
  var lines = JSON.parse(fs.readFileSync(path.join(dir, 'lines.json'), 'utf8'));
  var rate = 44100;

  for (var i = 0; i < lines.length; i++) {
    var body = JSON.stringify({
      text: lines[i].text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true }
    });
    var r2 = await req({
      host: 'api.elevenlabs.io',
      path: '/v1/text-to-speech/' + voice + '?output_format=mp3_44100_128',
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }
    }, body);
    if (r2.status !== 200) { console.log('cue ' + (i + 1) + ': HTTP ' + r2.status + ' ' + r2.buf.toString().slice(0, 200)); process.exit(1); }
    var out = path.join(dir, 'cue' + String(i + 1).padStart(2, '0') + '.wav');
    var tmp = out.replace(/\.wav$/, '.mp3');
    fs.writeFileSync(tmp, r2.buf);
    var c = cp.spawnSync(FFMPEG, ['-y', '-v', 'error', '-i', tmp, '-ar', String(rate), '-ac', '1', '-c:a', 'pcm_s16le', out]);
    if (c.status !== 0) { console.log('ffmpeg fail cue ' + (i + 1) + ' ' + (c.stderr || '').toString().slice(-200)); process.exit(1); }
    fs.unlinkSync(tmp);
    var len = (fs.statSync(out).size - 44) / (rate * 2);
    var slot = i < lines.length - 1 ? lines[i + 1].at - lines[i].at : 14.7;
    console.log(String(i + 1).padStart(2, '0') + '  len ' + len.toFixed(1) + 's  slot ' + slot + 's' + (len > slot ? '  ПЕРЕБОР' : ''));
  }
  console.log('готово, дальше mux.js');
}
main().catch(function (e) { console.log('ОШИБКА: ' + e.message); process.exit(1); });
