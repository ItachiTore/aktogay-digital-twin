// Диорама карьера Актогай: та же геометрия и та же палитра, что в 3D проекта.
import * as THREE from 'three';

var host = document.getElementById('stage3d');
var note = document.getElementById('no3d');
if (!host) throw new Error('no host');

var renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
} catch (e) {
  renderer = null;
}
if (!renderer || !renderer.getContext()) {
  host.style.display = 'none';
  if (note) note.hidden = false;
  document.body.classList.add('no3d');
  throw new Error('no webgl');
}

var W = host.clientWidth || 800, H = Math.round((host.clientWidth || 800) * 0.62);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = 'auto';
renderer.domElement.style.display = 'block';

var scene = new THREE.Scene();
var HAZE = new THREE.Color('#aab9c3');
scene.background = HAZE;
scene.fog = new THREE.Fog(HAZE, 1600, 4600);

var camera = new THREE.PerspectiveCamera(42, W / H, 1, 6000);

scene.add(new THREE.HemisphereLight(0xcfe0ea, 0x8a7152, 1.05));
var sun = new THREE.DirectionalLight(0xfff1dc, 1.45);
sun.position.set(420, 680, 240);
scene.add(sun);
var fill = new THREE.DirectionalLight(0xbcd2e0, 0.35);
fill.position.set(-500, 300, -400);
scene.add(fill);

// ── палитра из render3d/models.ts и render3d/terrain.ts проекта ───────────────
function std(c, r, m) {
  return new THREE.MeshStandardMaterial({ color: c, roughness: r === undefined ? 0.7 : r, metalness: m === undefined ? 0.12 : m });
}
var M = {
  sand: std('#d7b77f', 0.95, 0),
  rockTop: std('#b8956a', 0.9, 0),
  rockDeep: std('#6d5a4a', 0.92, 0),
  bench: std('#cdb88f', 0.9, 0),
  ramp: std('#e3d0a6', 0.9, 0),
  road: std('#ddc79c', 0.9, 0),
  truck: std('#c4442c', 0.5),
  truckDark: std('#93321f', 0.55),
  cab: std('#e9edf0', 0.45),
  tyre: std('#121315', 1, 0),
  exBody: std('#2c6f8e', 0.5),
  exBoom: std('#e3e8ec', 0.45),
  yellow: std('#f2b630', 0.5),
  steel: std('#9aa1a9', 0.4, 0.6),
  wall: std('#d4d6d8', 0.6, 0.25),
  roof: std('#46586a', 0.7),
  concrete: std('#b9b8b2', 0.95, 0),
  dark: std('#2b2c30', 0.85),
  ore: std('#a07c55', 0.95, 0),
  rock: std('#8a6a4a', 0.95, 0),
  water: std('#2d6f7d', 0.12, 0.35),
  pls: std('#3f8f6e', 0.2, 0.3),
  cu: std('#b0693a', 0.5, 0.4)
};

function box(w, h, d, mat, x, y, z) {
  var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x || 0, y || 0, z || 0);
  return m;
}
function cyl(rt, rb, h, mat, x, y, z, seg) {
  var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 20), mat);
  m.position.set(x || 0, y || 0, z || 0);
  return m;
}

// ── карьеры ──────────────────────────────────────────────────────────────────
var PITS = [
  { cx: -300, cz: 60, rx: 232, rz: 152, lv: 7, bh: 13, name: 'главный' },
  { cx: -455, cz: -235, rx: 118, rz: 74, lv: 5, bh: 11, name: 'северо-западный' },
  { cx: -480, cz: 300, rx: 128, rz: 72, lv: 5, bh: 10, name: 'юго-западный' }
];

function pitMesh(p) {
  var g = new THREE.Group();
  var k = p.rz / p.rx;
  var step = 0.11;
  for (var i = 0; i < p.lv; i++) {
    var outer = p.rx * (1 - i * step);
    var inner = p.rx * (1 - (i + 1) * step);
    var y = -i * p.bh;
    var rg = new THREE.RingGeometry(inner, outer, 56);
    rg.rotateX(-Math.PI / 2);
    var floor = new THREE.Mesh(rg, M.bench);
    floor.position.y = y;
    floor.scale.z = k;
    g.add(floor);

    var t = i / Math.max(1, p.lv - 1);
    var wm = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#b8956a').lerp(new THREE.Color('#6d5a4a'), t),
      roughness: 0.92
    });
    var wall = new THREE.Mesh(new THREE.CylinderGeometry(inner, inner * 0.985, p.bh, 56, 1, true), wm);
    wall.position.y = y - p.bh / 2;
    wall.scale.z = k;
    wall.material.side = THREE.DoubleSide;
    g.add(wall);
  }
  var bot = p.rx * (1 - p.lv * step);
  var cg = new THREE.CircleGeometry(bot, 48);
  cg.rotateX(-Math.PI / 2);
  var bottom = new THREE.Mesh(cg, M.rockDeep);
  bottom.position.y = -p.lv * p.bh;
  bottom.scale.z = k;
  g.add(bottom);

  g.position.set(p.cx, 0, p.cz);
  return g;
}
PITS.forEach(function (p) { scene.add(pitMesh(p)); });

// ── поверхность с вырезами под выработки ─────────────────────────────────────
var shp = new THREE.Shape();
shp.moveTo(-2600, -2200); shp.lineTo(2600, -2200); shp.lineTo(2600, 2200); shp.lineTo(-2600, 2200); shp.closePath();
PITS.forEach(function (p) {
  var h = new THREE.Path();
  h.absellipse(p.cx, -p.cz, p.rx, p.rz, 0, Math.PI * 2, true, 0);
  shp.holes.push(h);
});
var gg = new THREE.ShapeGeometry(shp, 24);
gg.rotateX(-Math.PI / 2);
var ground = new THREE.Mesh(gg, M.sand);
ground.position.y = 0.05;
scene.add(ground);

// ── спиральный съезд + маршруты ──────────────────────────────────────────────
function spiral(p, turns) {
  var pts = [], n = 90, k = p.rz / p.rx;
  for (var i = 0; i <= n; i++) {
    var t = i / n;
    var a = -turns * Math.PI * 2 * (1 - t);
    var r = 58 + (p.rx * 0.93 - 58) * t;
    var y = -p.lv * p.bh + 2 + (p.lv * p.bh + 1) * t;
    pts.push(new THREE.Vector3(p.cx + r * Math.cos(a), y, p.cz + k * r * Math.sin(a)));
  }
  return pts;
}
function V(x, y, z) { return new THREE.Vector3(x, y, z); }

var ROUTES = [
  { pts: spiral(PITS[0], 1.75).concat([V(-40, 1.2, 74), V(10, 1.2, 86), V(40, 1.2, 92)]), n: 5, load: 'ore', dur: 38 },
  { pts: [V(-345, 1.2, -228), V(-250, 1.2, -248), V(-80, 1.2, -236), V(90, 1.2, -212), V(170, 1.2, -200)], n: 2, load: 'ore', dur: 26 },
  { pts: [V(-520, 1.2, 96), V(-580, 1.2, 140), V(-628, 1.2, 176)], n: 2, load: 'rock', dur: 18 },
  { pts: [V(-300, 1.2, -88), V(-240, 1.2, -200), V(-150, 1.2, -300), V(-84, 1.2, -324)], n: 2, load: 'rock', dur: 22 },
  { pts: [V(-150, 1.2, 150), V(-168, 1.2, 280), V(-176, 1.2, 372)], n: 1, load: 'none', dur: 20 }
];

ROUTES.forEach(function (r) {
  r.curve = new THREE.CatmullRomCurve3(r.pts, false, 'catmullrom', 0.2);
  var tube = new THREE.TubeGeometry(r.curve, 110, 7.5, 4, false);
  var road = new THREE.Mesh(tube, M.road);
  road.scale.y = 0.16;
  road.position.y = 0.4;
  scene.add(road);
});

// ── самосвал 220 т ───────────────────────────────────────────────────────────
function makeTruck(load) {
  var g = new THREE.Group();
  g.add(box(11, 3.4, 20, M.dark, 0, 3.2, 0));
  var bed = box(12.6, 5.4, 15, M.truck, 0, 7.6, -2.2);
  g.add(bed);
  g.add(box(13.2, 1.2, 15.4, M.truckDark, 0, 10.6, -2.2));
  g.add(box(7.4, 5, 5.2, M.cab, 0, 7.4, 8.4));
  g.add(box(6.4, 2.2, 0.6, new THREE.MeshStandardMaterial({ color: '#1c3a52', metalness: 0.7, roughness: 0.15 }), 0, 8.6, 11.1));
  if (load === 'ore' || load === 'rock') {
    var heap = new THREE.Mesh(new THREE.SphereGeometry(5.4, 12, 8), load === 'ore' ? M.ore : M.rock);
    heap.scale.set(1.08, 0.42, 1.25);
    heap.position.set(0, 10.4, -2.2);
    g.add(heap);
  }
  [-1, 1].forEach(function (sx) {
    [-5.4, 4.4].forEach(function (pz) {
      var w = cyl(3.4, 3.4, 2.6, M.tyre, sx * 6.1, 3.3, pz, 12);
      w.rotation.z = Math.PI / 2;
      g.add(w);
    });
  });
  return g;
}

var trucks = [];
ROUTES.forEach(function (r, ri) {
  for (var i = 0; i < r.n; i++) {
    var back = i % 2 === 1;
    var t = makeTruck(back ? 'none' : r.load);
    scene.add(t);
    trucks.push({ o: t, r: r, off: i / r.n, back: back });
  }
});

// ── экскаватор ───────────────────────────────────────────────────────────────
function makeExcavator() {
  var g = new THREE.Group();
  g.add(box(13, 3.2, 20, M.dark, 0, 1.8, 0));
  var house = new THREE.Group();
  house.add(box(11, 7, 13, M.exBody, 0, 7, -1));
  house.add(box(5.2, 4.6, 4.6, M.cab, 4, 8.2, 5));
  var boom = box(3.2, 3.2, 20, M.exBoom, 0, 11, 9);
  boom.rotation.x = -0.5;
  house.add(boom);
  var bucket = box(6.4, 5, 6, M.exBoom, 0, 5.2, 19);
  house.add(bucket);
  house.position.y = 0;
  g.add(house);
  g.userData.house = house;
  return g;
}
var excs = [];
[
  [-408, -5.5 * 13, 10], [-230, -4.2 * 13, 120], [-300, -2.1 * 13, -40],
  [-470, -3.4 * 11, -250], [-500, -3.2 * 10, 310]
].forEach(function (p, i) {
  var e = makeExcavator();
  e.position.set(p[0], p[1], p[2]);
  e.rotation.y = i * 1.1;
  scene.add(e);
  excs.push(e);
});

// ── дробилка, конвейер, склад, фабрика ───────────────────────────────────────
var crusher = new THREE.Group();
crusher.add(box(60, 34, 52, M.wall, 0, 17, 0));
crusher.add(box(64, 4, 56, M.roof, 0, 36, 0));
crusher.add(cyl(22, 13, 20, M.steel, 0, 44, 0, 8));
crusher.add(box(26, 6, 34, M.concrete, 0, 3, 34));
crusher.position.set(40, 0, 92);
scene.add(crusher);

var conv = box(10, 3, 124, M.steel, 0, 0, 0);
conv.position.set(102, 22, 92);
conv.rotation.z = 0;
conv.rotation.y = Math.PI / 2;
scene.add(conv);
for (var ci = 0; ci < 7; ci++) scene.add(box(3, 22, 3, M.steel, 48 + ci * 18, 11, 92));

var stock = new THREE.Mesh(new THREE.ConeGeometry(46, 36, 28), M.ore);
stock.position.set(172, 18, 92);
scene.add(stock);

var plant = new THREE.Group();
plant.add(box(110, 36, 64, M.wall, 0, 18, 0));
plant.add(box(114, 4, 68, M.roof, 0, 38, 0));
var mills = [];
[-26, 2].forEach(function (mx) {
  var m = cyl(13, 13, 34, M.steel, mx, 24, 40, 18);
  m.rotation.z = Math.PI / 2;
  plant.add(m);
  mills.push(m);
});
for (var fi = 0; fi < 5; fi++) plant.add(cyl(7, 7, 16, M.concrete, 28 + fi * 16, 8, 40, 14));
plant.add(cyl(5, 5, 46, M.concrete, -46, 23, -22, 12));
plant.position.set(312, 0, 92);
scene.add(plant);

var conc = new THREE.Group();
conc.add(box(70, 22, 40, M.wall, 0, 11, 0));
conc.add(box(74, 3, 44, M.roof, 0, 23, 0));
for (var wi = 0; wi < 4; wi++) conc.add(box(22, 9, 9, M.steel, -36 + wi * 24, 5, 34));
conc.position.set(468, 0, 6);
scene.add(conc);

// ── хвостохранилище ──────────────────────────────────────────────────────────
var tails = new THREE.Group();
var dam = new THREE.Mesh(new THREE.BoxGeometry(300, 16, 180), M.rock);
dam.position.y = 8;
tails.add(dam);
var pond = box(264, 2, 146, M.water, 0, 15.5, 0);
tails.add(pond);
tails.position.set(512, 0, 236);
scene.add(tails);

// ── кучное выщелачивание и SX-EW ─────────────────────────────────────────────
var leach = new THREE.Group();
[-70, 0, 70].forEach(function (lx) {
  var pad = box(62, 10, 92, M.ore, lx, 5, 0);
  leach.add(pad);
  var drip = box(58, 0.8, 88, M.pls, lx, 10.6, 0);
  leach.add(drip);
});
leach.add(box(70, 3, 44, M.pls, 0, 2, 92));
leach.position.set(180, 0, -206);
scene.add(leach);

var sx = new THREE.Group();
sx.add(box(84, 28, 50, M.wall, 0, 14, 0));
sx.add(box(88, 3, 54, M.roof, 0, 29, 0));
for (var si = 0; si < 4; si++) sx.add(box(16, 6, 36, M.cu, -30 + si * 20, 32, 0));
sx.position.set(392, 0, -222);
scene.add(sx);

// ── отвалы ───────────────────────────────────────────────────────────────────
[[-650, 182, 96, 34], [-92, -336, 84, 30], [-120, 420, 70, 24]].forEach(function (d) {
  var c = new THREE.Mesh(new THREE.ConeGeometry(d[2], d[3], 7), M.rock);
  c.position.set(d[0], d[3] / 2, d[1]);
  scene.add(c);
});

// ── гараж, РМЦ, АЗС ──────────────────────────────────────────────────────────
var garage = new THREE.Group();
garage.add(box(96, 26, 52, M.wall, 0, 13, 0));
garage.add(box(100, 3, 56, M.roof, 0, 27, 0));
for (var bi = 0; bi < 3; bi++) garage.add(box(22, 18, 2, M.dark, -30 + bi * 30, 9, 27));
garage.add(box(34, 8, 16, M.concrete, 70, 4, 10));
garage.add(cyl(5, 5, 14, M.yellow, 62, 7, 10, 10));
garage.position.set(-180, 0, 400);
scene.add(garage);

// ── подстанция и ЛЭП ─────────────────────────────────────────────────────────
var sub = new THREE.Group();
sub.add(box(62, 4, 46, M.concrete, 0, 2, 0));
[-18, 0, 18].forEach(function (tx) {
  sub.add(box(12, 16, 12, M.steel, tx, 10, 0));
  sub.add(cyl(1.4, 1.4, 10, M.steel, tx, 23, 0, 8));
});
sub.position.set(336, 0, 396);
scene.add(sub);
for (var pi = 0; pi < 5; pi++) {
  var pyl = new THREE.Group();
  pyl.add(box(3, 46, 3, M.steel, 0, 23, 0));
  pyl.add(box(26, 2.4, 2.4, M.steel, 0, 42, 0));
  pyl.add(box(20, 2.4, 2.4, M.steel, 0, 34, 0));
  pyl.position.set(300 - pi * 86, 0, 300 - pi * 6);
  scene.add(pyl);
}

// ── КПП ──────────────────────────────────────────────────────────────────────
var kpp = new THREE.Group();
kpp.add(box(22, 16, 18, M.wall, 0, 8, 0));
kpp.add(box(24, 2, 20, M.roof, 0, 17, 0));
var arm = box(44, 1.6, 1.6, M.yellow, 24, 9, 14);
kpp.add(arm);
kpp.position.set(646, 0, 396);
scene.add(kpp);

// ── метеостанция ─────────────────────────────────────────────────────────────
var wx = new THREE.Group();
wx.add(cyl(1.2, 1.6, 40, M.steel, 0, 20, 0, 8));
var vane = box(12, 1, 1, M.cab, 5, 40, 0);
wx.add(vane);
wx.add(box(5, 5, 5, M.wall, 0, 10, 6));
wx.position.set(-60, 0, 312);
scene.add(wx);

// ── кольцо подсветки выбранной точки ─────────────────────────────────────────
var ringMat = new THREE.MeshBasicMaterial({ color: '#f5a524', transparent: true, opacity: 0.85, side: THREE.DoubleSide });
var rg2 = new THREE.RingGeometry(44, 52, 48);
rg2.rotateX(-Math.PI / 2);
var ring = new THREE.Mesh(rg2, ringMat);
ring.visible = false;
scene.add(ring);

// ── камера: орбита + перелёты ────────────────────────────────────────────────
var cam = { az: 0.9, pol: 0.62, dist: 1680, tx: -10, ty: -40, tz: 150 };
var goal = Object.assign({}, cam);
var flying = false, auto = true;

var VIEWS = [
  { az: 0.5, pol: 0.78, dist: 640, tx: -300, ty: -40, tz: 60 },
  { az: 1.1, pol: 0.82, dist: 300, tx: 60, ty: 10, tz: 92 },
  { az: 1.25, pol: 0.84, dist: 330, tx: 312, ty: 12, tz: 92 },
  { az: 0.9, pol: 0.8, dist: 260, tx: 172, ty: 8, tz: 92 },
  { az: 0.6, pol: 0.86, dist: 460, tx: -180, ty: 0, tz: 260 },
  { az: 1.35, pol: 0.8, dist: 300, tx: 336, ty: 6, tz: 396 },
  { az: 1.5, pol: 0.74, dist: 480, tx: 512, ty: 6, tz: 236 },
  { az: 0.95, pol: 0.8, dist: 700, tx: 180, ty: 0, tz: 400 },
  { az: 0.7, pol: 0.9, dist: 420, tx: -60, ty: 10, tz: 312 },
  { az: 0.9, pol: 0.62, dist: 1680, tx: -10, ty: -40, tz: 150 }
];
var RINGS = [
  [-300, -60, 60], [40, 2, 92], [312, 2, 92], [172, 2, 92], [-180, 2, 300],
  [336, 2, 396], [512, 18, 236], [-180, 2, 400], [-60, 2, 312], null
];

window.AKT3D = {
  focus: function (k) {
    if (k == null || k < 0 || k >= VIEWS.length) return;
    goal = Object.assign({}, VIEWS[k]);
    flying = true;
    auto = k === VIEWS.length - 1;
    var r = RINGS[k];
    if (r) {
      ring.position.set(r[0], r[1] + 2, r[2]);
      var s = k === 0 ? 2.6 : 1;
      ring.scale.set(s, 1, s);
      ring.visible = true;
    } else {
      ring.visible = false;
    }
  },
  reset: function () {
    goal = Object.assign({}, VIEWS[VIEWS.length - 1]);
    flying = true;
    auto = true;
    ring.visible = false;
  },
  resize: function () { onResize(); }
};

var dragging = false, lastX = 0, lastY = 0;
var el = renderer.domElement;
el.style.touchAction = 'pan-y';
el.addEventListener('pointerdown', function (e) {
  dragging = true; lastX = e.clientX; lastY = e.clientY; auto = false; flying = false;
  el.setPointerCapture(e.pointerId);
});
el.addEventListener('pointermove', function (e) {
  if (!dragging) return;
  cam.az -= (e.clientX - lastX) * 0.005;
  cam.pol = Math.max(0.22, Math.min(1.32, cam.pol - (e.clientY - lastY) * 0.004));
  lastX = e.clientX; lastY = e.clientY;
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
  el.addEventListener(ev, function () { dragging = false; });
});
el.addEventListener('wheel', function (e) {
  e.preventDefault();
  flying = false;
  cam.dist = Math.max(180, Math.min(2200, cam.dist * (1 + Math.sign(e.deltaY) * 0.12)));
}, { passive: false });

function onResize() {
  var w = host.clientWidth;
  if (!w) return;
  var h = Math.round(w * (w < 640 ? 0.78 : 0.62));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

var reduce = false;
try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e2) {}


// ── подписи объектов поверх сцены ────────────────────────────────────────────
var layer = document.createElement('div');
layer.className = 'lbl3d';
host.appendChild(layer);
var LABELS = [
  { p: V(-300, 10, -110), t: 'Главный карьер' },
  { p: V(-455, 6, -312), t: 'Северо-западный', s: 1 },
  { p: V(-480, 6, 376), t: 'Юго-западный', s: 1 },
  { p: V(40, 56, 92), t: 'Дробилка' },
  { p: V(172, 40, 92), t: 'Склад руды', s: 1 },
  { p: V(312, 46, 92), t: 'Фабрика' },
  { p: V(468, 28, 6), t: 'Концентрат', s: 1 },
  { p: V(512, 22, 236), t: 'Хвостохранилище' },
  { p: V(180, 16, -206), t: 'Выщелачивание' },
  { p: V(392, 36, -222), t: 'SX-EW', s: 1 },
  { p: V(-650, 40, 182), t: 'Отвал', s: 1 },
  { p: V(-92, 36, -336), t: 'Отвалы вскрыши' },
  { p: V(-180, 32, 400), t: 'Гараж · АЗС · РМЦ', s: 1 },
  { p: V(336, 28, 396), t: 'Подстанция', s: 1 },
  { p: V(646, 22, 396), t: 'КПП', s: 1 }
];
LABELS.forEach(function (l) {
  var d = document.createElement('span');
  d.textContent = l.t;
  layer.appendChild(d);
  l.el = d;
});
var pv = new THREE.Vector3();
function drawLabels() {
  var w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
  for (var i2 = 0; i2 < LABELS.length; i2++) {
    var l = LABELS[i2];
    pv.copy(l.p);
    var dist = pv.distanceTo(camera.position);
    pv.project(camera);
    if (pv.z > 1 || (l.s && cam.dist > 1150) || dist > 3200 || pv.x < -1.05 || pv.x > 1.05 || pv.y < -1.05 || pv.y > 1.05) {
      l.el.style.opacity = '0';
      continue;
    }
    l.el.style.opacity = dist > 2400 ? '0.4' : '1';
    l.el.style.transform = 'translate(-50%,-100%) translate(' + ((pv.x * 0.5 + 0.5) * w) + 'px,' + ((-pv.y * 0.5 + 0.5) * h) + 'px)';
  }
}

var clock = new THREE.Clock();
var tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

function frame() {
  var dt = Math.min(clock.getDelta(), 0.05);
  var el2 = clock.elapsedTime;

  if (flying) {
    var k = 1 - Math.pow(0.001, dt);
    var da = ((goal.az - cam.az + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    cam.az += da * k;
    cam.pol += (goal.pol - cam.pol) * k;
    cam.dist += (goal.dist - cam.dist) * k;
    cam.tx += (goal.tx - cam.tx) * k;
    cam.ty += (goal.ty - cam.ty) * k;
    cam.tz += (goal.tz - cam.tz) * k;
    if (Math.abs(goal.dist - cam.dist) < 2 && Math.abs(da) < 0.01) flying = false;
  } else if (auto && !reduce && !dragging) {
    cam.az += dt * 0.022;
  }

  camera.position.set(
    cam.tx + cam.dist * Math.sin(cam.pol) * Math.cos(cam.az),
    cam.ty + cam.dist * Math.cos(cam.pol),
    cam.tz + cam.dist * Math.sin(cam.pol) * Math.sin(cam.az)
  );
  camera.lookAt(cam.tx, cam.ty, cam.tz);

  if (!reduce) {
    trucks.forEach(function (t) {
      var s = (el2 / t.r.dur + t.off) % 1;
      var u = t.back ? 1 - s : s;
      t.r.curve.getPointAt(u, tmp);
      t.o.position.copy(tmp);
      t.r.curve.getPointAt(Math.min(0.999, Math.max(0.001, u + (t.back ? -0.004 : 0.004))), tmp2);
      t.o.lookAt(tmp2);
    });
    excs.forEach(function (e, i) {
      e.userData.house.rotation.y = Math.sin(el2 * 0.5 + i) * 0.9;
    });
    mills.forEach(function (m, i) { m.rotation.y += dt * (1.4 + i * 0.2); });
    arm.rotation.z = Math.max(0, Math.sin(el2 * 0.35)) * 1.2;
    vane.parent.rotation.y = Math.sin(el2 * 0.6) * 0.5;
    if (ring.visible) {
      var pulse = 1 + Math.sin(el2 * 2.4) * 0.05;
      ring.scale.x = (ring.scale.z) * 1;
      ringMat.opacity = 0.55 + Math.sin(el2 * 2.4) * 0.3;
      ring.rotation.y = el2 * 0.3;
      void pulse;
    }
  }

  drawLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
onResize();
frame();
