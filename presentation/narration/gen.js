// Озвучивает реплики из lines.json моделью Piper и сообщает, какие не влезли в свой отрезок.
// node gen.js <piper.exe> <model.onnx> [length_scale]
var fs = require('fs'), path = require('path'), cp = require('child_process');

var dir = __dirname;
var piper = process.argv[2];
var model = process.argv[3];
var ls = process.argv[4] || '1.0';
var lines = JSON.parse(fs.readFileSync(path.join(dir, 'lines.json'), 'utf8'));

function wavSeconds(f) {
  var b = fs.readFileSync(f);
  var rate = b.readUInt32LE(24), bits = b.readUInt16LE(34), ch = b.readUInt16LE(22);
  return (b.length - 44) / (rate * ch * (bits / 8));
}

var over = [];
lines.forEach(function (l, i) {
  var out = path.join(dir, 'cue' + String(i + 1).padStart(2, '0') + '.wav');
  var r = cp.spawnSync(piper, ['--model', model, '--config', model + '.json', '--output_file', out, '--length_scale', ls], { input: Buffer.from(l.text, 'utf8') });
  if (r.status !== 0) { console.log('FAIL cue', i + 1, r.stderr && r.stderr.toString().slice(-300)); process.exit(1); }
  var len = wavSeconds(out);
  var slot = i < lines.length - 1 ? lines[i + 1].at - l.at : 14.7;
  var mark = len > slot ? '  ПЕРЕБОР +' + (len - slot).toFixed(1) : '';
  if (len > slot) over.push(i + 1);
  console.log(String(i + 1).padStart(2, '0') + '  at ' + String(l.at).padStart(3) + 's  len ' + len.toFixed(1) + 's  slot ' + slot + 's' + mark);
});
console.log(over.length ? 'переборов: ' + over.join(', ') : 'всё влезает');
