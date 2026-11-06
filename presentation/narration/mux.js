// Собирает дорожку из реплик по таймкодам и кладёт её в НОВЫЙ файл,
// исходное немое видео не трогается.
// node mux.js <ffmpeg.exe> <video-in.mp4> <video-out.mp4>
var fs = require('fs'), path = require('path'), cp = require('child_process');

var dir = __dirname;
var ffmpeg = process.argv[2];
var vin = process.argv[3];
var vout = process.argv[4];
var lines = JSON.parse(fs.readFileSync(path.join(dir, 'lines.json'), 'utf8'));

var args = ['-y', '-v', 'error', '-i', vin];
var parts = [], tags = [];
lines.forEach(function (l, i) {
  var wav = path.join(dir, 'cue' + String(i + 1).padStart(2, '0') + '.wav');
  if (!fs.existsSync(wav)) throw new Error('нет файла ' + wav + ' — сначала tts.ps1');
  args.push('-i', wav);
  var ms = Math.round(l.at * 1000);
  parts.push('[' + (i + 1) + ':a]aformat=channel_layouts=stereo:sample_rates=48000,adelay=' + ms + '|' + ms + '[a' + i + ']');
  tags.push('[a' + i + ']');
});
parts.push(tags.join('') + 'amix=inputs=' + lines.length + ':normalize=0,alimiter=limit=0.95,apad[aout]');

var fpath = path.join(dir, 'filter.txt');
fs.writeFileSync(fpath, parts.join(';\n'));

args.push('-filter_complex_script', fpath,
  '-map', '0:v', '-map', '[aout]',
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '96k',
  '-movflags', '+faststart', '-shortest', vout);

var r = cp.spawnSync(ffmpeg, args, { encoding: 'utf8' });
if (r.stderr) process.stderr.write(r.stderr);
if (r.status !== 0) { console.log('FFMPEG FAIL', r.status); process.exit(1); }
console.log('OK ->', vout, (fs.statSync(vout).size / 1048576).toFixed(2) + ' MB');
