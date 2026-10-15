// NRG Solution | BESS Kieswerk Hardwald | 3D-Anwendung (Three.js r160)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
import * as EN from './engine.js';

const $ = (s) => document.querySelector(s);
const Q = new URLSearchParams(location.search);
const CAPTURE = Q.has('capture');
if (CAPTURE) document.body.classList.add('cap');
if (Q.has('legend')) document.body.classList.add('legend');
const DEG = Math.PI / 180, V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const fmt = (v, d = 0) => { const s = Number(v).toFixed(d); const [i, f] = s.split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, "'") + (f ? '.' + f : ''); };
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const setL = (p, m) => { $('#lbar').style.width = p + '%'; $('#lmsg').textContent = m; };

setL(5, 'Geodaten werden geladen ...');
const [SCENE, SITE, TBUF] = await Promise.all([
  fetch('data/scene.json').then(r => r.json()), fetch('data/site.json').then(r => r.json()), fetch('data/terrain_u16.bin').then(r => r.arrayBuffer())]);
const U16 = new Uint16Array(TBUF);
const heightAt0 = EN.makeHeightAt(SCENE, U16);
const T = SCENE.terrain, W = SCENE.window, TN = T.n, TS = T.step;
const HG = new Float32Array(TN * TN); for (let i = 0; i < HG.length; i++) HG[i] = T.hmin + U16[i] * T.scale;
function groundAt(x, z) { const fx = (x - W.x0) / TS, fz = (z - W.z0) / TS; const i = clamp(Math.floor(fx), 0, TN - 2), j = clamp(Math.floor(fz), 0, TN - 2); const tx = clamp(fx - i, 0, 1), tz = clamp(fz - j, 0, 1);
  const h = (a, b) => HG[b * TN + a]; return h(i, j) * (1 - tx) * (1 - tz) + h(i + 1, j) * tx * (1 - tz) + h(i, j + 1) * (1 - tx) * tz + h(i + 1, j + 1) * tx * tz; }

setL(15, 'Szene wird aufgebaut ...');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, CAPTURE ? 1 : 1.75)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.55; renderer.outputColorSpace = THREE.SRGBColorSpace;
$('#app').appendChild(renderer.domElement);
const labelRenderer = new CSS2DRenderer(); labelRenderer.setSize(innerWidth, innerHeight); Object.assign(labelRenderer.domElement.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: 5 }); document.body.appendChild(labelRenderer.domElement);
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xcfd8e3, 380, 1500);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.3, 6000);
camera.position.set(-360, 300, 380);
const orbit = new OrbitControls(camera, renderer.domElement); orbit.target.set(-70, 0, -10); orbit.enableDamping = true; orbit.maxPolarAngle = 88 * DEG; orbit.minDistance = 4; orbit.maxDistance = 1500; orbit.update();
const plc = new PointerLockControls(camera, document.body);
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.4, 1.6); composer.addPass(bloom); composer.addPass(new OutputPass());
const sky = new Sky(); sky.scale.setScalar(45000); scene.add(sky);
const su = sky.material.uniforms; su.turbidity.value = 4; su.rayleigh.value = 1.2; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.8;
const pmrem = new THREE.PMREMGenerator(renderer); const skyEnvScene = new THREE.Scene(); const skyEnv = new Sky(); skyEnv.scale.setScalar(45000); skyEnvScene.add(skyEnv); let envRT = null;
const sun = new THREE.DirectionalLight(0xfff4e5, 3.2); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); const SC = sun.shadow.camera; SC.left = -230; SC.right = 230; SC.top = 230; SC.bottom = -230; SC.near = 10; SC.far = 1600; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
scene.add(sun); scene.add(sun.target); sun.target.position.set(-80, 0, -20);
const hemi = new THREE.HemisphereLight(0xdfe9ff, 0x6b5f4f, 0.55); scene.add(hemi);

function canvasTex(w, h, draw, rep = [1, 1], srgb = true) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function speckle(g, w, h, base, n, cols, size = 1.5, seed = 7) { g.fillStyle = base; g.fillRect(0, 0, w, h); const r = mulberry32(seed); for (let i = 0; i < n; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.globalAlpha = 0.25 + r() * 0.5; const s = r() * size + 0.5; g.fillRect(r() * w, r() * h, s, s); } g.globalAlpha = 1; }
const TX = {
  concrete: canvasTex(512, 512, (g, w, h) => { speckle(g, w, h, '#b8b8b2', 9000, ['#a5a59f', '#c9c9c3', '#9a9a94'], 1.2, 5); g.strokeStyle = 'rgba(80,80,80,.25)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2); }),
  shotcrete: canvasTex(512, 512, (g, w, h) => { speckle(g, w, h, '#9d9a92', 30000, ['#86837b', '#b5b2aa', '#77746c'], 2.5, 9); g.fillStyle = 'rgba(60,60,60,.5)'; for (let y = 40; y < h; y += 96) for (let x = 40; x < w; x += 96) { g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); } }),
  metal: canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#c9ccd0'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, '#b4b8bd'); gr.addColorStop(.5, '#e2e5e8'); gr.addColorStop(1, '#aeb2b7'); g.fillStyle = gr; g.fillRect(x, 0, 16, h); } }),
  louver: canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#d7dadd'; g.fillRect(0, 0, w, h); for (let y = 8; y < h; y += 14) { g.fillStyle = '#5b6168'; g.fillRect(12, y, w - 24, 6); g.fillStyle = '#eef0f2'; g.fillRect(12, y + 6, w - 24, 2); } }),
  fence: canvasTex(256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = '#4b5156'; g.lineWidth = 5; for (let x = 0; x <= w; x += 25.6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } g.lineWidth = 7; for (let y = 0; y <= h; y += 128) { g.beginPath(); g.moveTo(0, y + 3); g.lineTo(w, y + 3); g.stroke(); } }),
  water: canvasTex(512, 512, (g, w, h) => { const r = mulberry32(4); g.fillStyle = '#7f9fb1'; g.fillRect(0, 0, w, h); for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${200 + r() * 55},${220 + r() * 35},255,${r() * .08})`; g.fillRect(r() * w, r() * h, 10 + r() * 30, 1); } }, [6, 6]),
  bark: canvasTex(64, 256, (g, w, h) => speckle(g, w, h, '#5a4a3a', 2500, ['#3e3328', '#6e5c49', '#4a3d31'], 2, 2)),
};
let needsRender = true;
const orthoTex = new THREE.TextureLoader().load(Q.has('lowres') ? 'data/ortho_2048.jpg' : 'data/ortho_4096.jpg', () => { needsRender = true; });
orthoTex.colorSpace = THREE.SRGBColorSpace; orthoTex.anisotropy = 16;
const ouv = (x, z) => [(x - W.x0) / (W.x1 - W.x0), 1 - (z - W.z0) / (W.z1 - W.z0)];
function signTex(lines, bg = '#ffd400', fg = '#111', w = 512, h = 256, border = '#111') { return canvasTex(w, h, (g) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = border; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; const n = lines.length; lines.forEach((l, i) => { g.font = `${i === 0 ? 'bold ' : ''}${i === 0 ? 44 : 30}px Arial`; g.fillText(l, w / 2, h * (i + 1) / (n + 1)); }); }); }
const M = {
  white: new THREE.MeshStandardMaterial({ color: 0xf2f3f1, roughness: 0.42, metalness: 0.05 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2b3036, roughness: 0.6, metalness: 0.3 }),
  grey: new THREE.MeshStandardMaterial({ color: 0xc9ccc9, roughness: 0.55, metalness: 0.2 }),
  ral7035: new THREE.MeshStandardMaterial({ color: 0xcfd2cd, roughness: 0.5, metalness: 0.15 }),
  louver: new THREE.MeshStandardMaterial({ map: TX.louver, roughness: 0.6, metalness: 0.3 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.45, metalness: 0.75 }),
  galv: new THREE.MeshStandardMaterial({ color: 0xaeb4b8, roughness: 0.4, metalness: 0.8 }),
  concrete: new THREE.MeshStandardMaterial({ map: TX.concrete, color: 0xd0d0cb, roughness: 0.9 }),
  fence: new THREE.MeshStandardMaterial({ map: TX.fence, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6, color: 0x9aa1a6 }),
  trafo: new THREE.MeshStandardMaterial({ color: 0x5f6d78, roughness: 0.5, metalness: 0.5 }),
  porcelain: new THREE.MeshStandardMaterial({ color: 0x7a3b2e, roughness: 0.3 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.5 }),
  black: new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.7 }),
  led: new THREE.MeshStandardMaterial({ color: 0x00bb22, emissive: 0x18ff66, emissiveIntensity: 2.2 }),
  ledBlue: new THREE.MeshStandardMaterial({ color: 0x111133, emissive: 0x3da5ff, emissiveIntensity: 2.0 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.1, metalness: 0.6 }),
  wallMetal: new THREE.MeshStandardMaterial({ map: TX.metal, color: 0xdfe2e4, roughness: 0.55, metalness: 0.35 }),
  wallMetalDark: new THREE.MeshStandardMaterial({ map: TX.metal, color: 0x8f969b, roughness: 0.55, metalness: 0.35 }),
  membrane: new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.6, side: THREE.DoubleSide }),
  rust: new THREE.MeshStandardMaterial({ color: 0x8b5a3c, roughness: 0.8, metalness: 0.3 }),
  belt: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 }),
  agir: new THREE.MeshStandardMaterial({ color: 0x2f8f3a, roughness: 0.45, metalness: 0.2 }),
};
for (const k in M) M[k].envMapIntensity = 0.45;
const roofMat = new THREE.MeshStandardMaterial({ map: orthoTex, roughness: 0.8, metalness: 0.05, envMapIntensity: 0.3 });
const _o = new THREE.Object3D();
function mtx(x, y, z, ry = 0, s = [1, 1, 1]) { _o.position.set(x, y, z); _o.rotation.set(0, ry, 0); _o.scale.set(s[0], s[1], s[2]); _o.updateMatrix(); return _o.matrix.clone(); }
function boxG(w, h, d, x = 0, y = 0, z = 0) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; }
function merged(geoms, mat, cast = true, recv = true) { const g = BGU.mergeGeometries(geoms.map(x => x.index ? x.toNonIndexed() : x), false); const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = recv; return m; }
function instanced(geo, mat, mats, cast = true, recv = true) { const im = new THREE.InstancedMesh(geo, mat, Math.max(1, mats.length)); mats.forEach((m, i) => im.setMatrixAt(i, m)); im.count = mats.length; im.castShadow = cast; im.receiveShadow = recv; im.instanceMatrix.needsUpdate = true; return im; }
const yawOf = (ang) => -ang;
function extrudePoly(poly, y0, h, mat) {
  const shape = new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], -p[1])));
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); g.computeVertexNormals();
  const pos = g.attributes.position, uv = g.attributes.uv, nr = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) { if (nr.getY(i) > 0.9) { const [u, v] = ouv(pos.getX(i), pos.getZ(i)); uv.setXY(i, u, v); } else uv.setXY(i, (pos.getX(i) + pos.getZ(i)) * 0.25, pos.getY(i) * 0.25); }
  const m = new THREE.Mesh(g, [roofMat, mat]); m.castShadow = true; m.receiveShadow = true; return m;
}
function ribbonOnGround(pts, width, yOff, mat, step = 1) {
  const P = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.ceil(L / step)); for (let k = 0; k < n; k++) P.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]); } P.push(pts[pts.length - 1]);
  const pos = [], uv = [], idx = []; let acc = 0;
  for (let i = 0; i < P.length; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)]; let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; const nx = -tz, nz = tx;
    if (i > 0) acc += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    for (const s of [-1, 1]) { const x = P[i][0] + nx * s * width / 2, z = P[i][1] + nz * s * width / 2; pos.push(x, groundAt(x, z) + yOff, z); uv.push(s < 0 ? 0 : 1, acc / width); } if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
}
// ------------------------------------------------------------------ Gelände
const terrGeo = new THREE.BufferGeometry();
{ const pos = new Float32Array(TN * TN * 3), uv = new Float32Array(TN * TN * 2);
  for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) { const k = j * TN + i; pos[k * 3] = W.x0 + i * TS; pos[k * 3 + 1] = HG[k]; pos[k * 3 + 2] = W.z0 + j * TS; uv[k * 2] = i / (TN - 1); uv[k * 2 + 1] = 1 - j / (TN - 1); }
  const idx = new Uint32Array((TN - 1) * (TN - 1) * 6); let p = 0; for (let j = 0; j < TN - 1; j++) for (let i = 0; i < TN - 1; i++) { const a = j * TN + i, b = a + 1, c = a + TN, d = c + 1; idx.set([a, c, b, b, c, d], p); p += 6; }
  terrGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); terrGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); terrGeo.setIndex(new THREE.BufferAttribute(idx, 1)); terrGeo.computeVertexNormals(); }
const terrMat = new THREE.MeshStandardMaterial({ map: orthoTex, roughness: 0.96, metalness: 0, envMapIntensity: 0.35 });
const terrain = new THREE.Mesh(terrGeo, terrMat); terrain.receiveShadow = true; scene.add(terrain);
{ const g2 = new THREE.PlaneGeometry(9000, 9000); g2.rotateX(-Math.PI / 2); const m2 = new THREE.Mesh(g2, new THREE.MeshStandardMaterial({ color: 0x55633f, roughness: 1 })); m2.position.set((W.x0 + W.x1) / 2, -7, (W.z0 + W.z1) / 2); scene.add(m2); }
const HG_ORIG = HG.slice();
function setTerrainPads(pads) {
  HG.set(HG_ORIG);
  for (const pd of pads) { const xs = pd.poly.map(p => p[0]), zs = pd.poly.map(p => p[1]); const buf = 2.0;
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - buf - W.x0) / TS)), i1 = Math.min(TN - 1, Math.ceil((Math.max(...xs) + buf - W.x0) / TS));
    const j0 = Math.max(0, Math.floor((Math.min(...zs) - buf - W.z0) / TS)), j1 = Math.min(TN - 1, Math.ceil((Math.max(...zs) + buf - W.z0) / TS));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = W.x0 + i * TS, z = W.z0 + j * TS; const k = j * TN + i; if (EN.pip([x, z], pd.poly)) { HG[k] = pd.y; continue; }
      const d = EN.minDist([[x, z], [x + 0.01, z], [x, z + 0.01]], pd.poly)[0]; if (d < buf && HG[k] < pd.y) HG[k] = lerp(pd.y, HG[k], d / buf); } }
  const pos = terrGeo.attributes.position; for (let k = 0; k < TN * TN; k++) pos.setY(k, HG[k]); pos.needsUpdate = true; terrGeo.computeVertexNormals();
}
// Wasser (Limmat, Teich)
{ const img = new Image(); img.src = 'data/water_mask.png'; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data;
  const geos = []; const n = c.width; const cell = (W.x1 - W.x0) / (n - 1);
  for (let j = 0; j < n; j++) { let run = -1; for (let i = 0; i <= n; i++) { const on = i < n && d[(j * n + i) * 4] > 128; if (on && run < 0) run = i; if (!on && run >= 0) { const w = (i - run) * cell; const gg = new THREE.PlaneGeometry(w + cell * 0.1, cell * 1.05); gg.rotateX(-Math.PI / 2); gg.translate(W.x0 + (run + i - 1) / 2 * cell, 0, W.z0 + j * cell); geos.push(gg); run = -1; } } }
  if (geos.length) { const wm = new THREE.MeshStandardMaterial({ color: 0x55758a, roughness: 0.08, metalness: 0.3, map: TX.water, envMapIntensity: 1.0 });
    const m = new THREE.Mesh(BGU.mergeGeometries(geos), wm); m.position.y = SCENE.water.level + 0.3; m.receiveShadow = true; scene.add(m); window.__water = m; } }

setL(35, 'Gebäude und Anlagen ...');
const world = new THREE.Group(); scene.add(world);
const pickables = []; const addPick = (o, info) => { o.userData.info = info; pickables.push(o); };
function barrelHall(poly, y0, h, name) {
  const e = [0, 1, 2, 3].map(i => Math.hypot(poly[(i + 1) % 4][0] - poly[i][0], poly[(i + 1) % 4][1] - poly[i][1]));
  const i0 = e[0] >= e[1] ? 0 : 1; const A = poly[i0], B = poly[(i0 + 1) % 4], C = poly[(i0 + 2) % 4];
  const ax = [B[0] - A[0], B[1] - A[1]], L = Math.hypot(...ax); const u = [ax[0] / L, ax[1] / L]; const span = Math.hypot(C[0] - B[0], C[1] - B[1]); const v = [(C[0] - B[0]) / span, (C[1] - B[1]) / span];
  const wallH = Math.max(2.5, h * 0.32), rise = h - wallH; const seg = 18, segL = Math.max(2, Math.round(L / 3)); const pos = [], uv = [], idx = [];
  for (let k = 0; k <= segL; k++) { const t = k / segL; for (let s = 0; s <= seg; s++) { const q = s / seg; const yy = wallH + rise * Math.sin(Math.PI * q); const x = A[0] + u[0] * L * t + v[0] * span * q, z = A[1] + u[1] * L * t + v[1] * span * q; pos.push(x, y0 + yy, z); const [uu, vv] = ouv(x, z); uv.push(uu, vv); } }
  for (let k = 0; k < segL; k++) for (let s = 0; s < seg; s++) { const a = k * (seg + 1) + s, b = a + 1, c = a + seg + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const grp = new THREE.Group(); const roof = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: orthoTex, roughness: 0.55, side: THREE.DoubleSide, envMapIntensity: 0.4, color: 0xffffff })); roof.castShadow = roof.receiveShadow = true; grp.add(roof);
  const wallG = []; for (const off of [0, span]) { const p0 = [A[0] + v[0] * off, A[1] + v[1] * off]; const gw = new THREE.PlaneGeometry(L, wallH); gw.translate(L / 2, wallH / 2, 0); gw.rotateY(-Math.atan2(u[1], u[0])); gw.translate(p0[0], y0, p0[1]); wallG.push(gw); }
  for (const end of [0, 1]) { const p0 = end ? [A[0] + u[0] * L, A[1] + u[1] * L] : A; const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0, wallH); for (let s = 0; s <= seg; s++) { const q = s / seg; sh.lineTo(span * q, wallH + rise * Math.sin(Math.PI * q)); } sh.lineTo(span, 0); sh.lineTo(0, 0);
    const gg = new THREE.ShapeGeometry(sh); gg.rotateY(-Math.atan2(v[1], v[0])); gg.translate(p0[0], y0, p0[1]); wallG.push(gg); }
  const walls = merged(wallG, M.membrane); grp.add(walls); addPick(walls, { t: name, b: `Zelt- bzw. Membranhalle, Höhe ca. ${h.toFixed(1)} m, Spannweite ${span.toFixed(1)} m` });
  return grp;
}
for (const b of SCENE.buildings) {
  const y0 = b.y0 - 0.5; const h = Math.max(2.5, b.h + 0.5);
  if (SITE.halls.some(hh => EN.pip(b.c, hh.poly))) continue;
  const m = (b.roof === 'barrel' && b.poly.length === 4) ? barrelHall(b.poly, y0, h, 'Halle') : extrudePoly(b.poly, y0, h, b.h > 9 ? M.wallMetal : M.wallMetalDark);
  world.add(m); if (m.isMesh) addPick(m, { t: 'Gebäude (aus swissSURFACE3D)', b: `Höhe ca. ${b.h.toFixed(1)} m über Terrain` });
}
for (const h of SITE.halls) {
  const y0 = Math.min(...h.poly.map(p => groundAt(p[0], p[1]))) - 0.3;
  if (h.roof === 'barrel') world.add(barrelHall(h.poly, y0, h.h, h.name)); else { const m = extrudePoly(h.poly, y0, h.h, h.id === 'H2' ? M.steel : M.wallMetal); addPick(m, { t: h.name, b: `Höhe ca. ${h.h} m, ${h.brennbar ? 'brennbare Hülle' : 'Hülle nicht brennbar'}` }); world.add(m); }
}
const PLANT_NAMES = [[[-71, -96], 'Kieswasch- und Sortieranlage', 'Waschtrommel, Schwertwäsche, Entwässerungssiebe, Pumpen ca. 320 kW'], [[-155, -91], 'Vorbrecher mit Aufgabebunker', 'Backenbrecher ca. 315 kW, Vibrorinne, Aufgabebunker'], [[-171, -69], 'Nachbrecher (Kegelbrecher)', 'Kegelbrecher ca. 250 kW, Direktanlauf mit Anlaufspitzen'], [[-141, -40], 'Siebanlage (Siebturm)', 'Mehrdecksiebe, Becherwerk, Bandabzüge'], [[-106, 44], 'Asphaltmischwerk Asfatop: Mischturm', 'Mischturm ca. 33 m, Trockentrommel, Heissgutelevator, Filter, Abgasventilator ca. 250 kW'], [[-173, 8], 'Siloanlage (Bitumen, Füller, Bindemittel)', 'Hochsilos ca. 30 m (vgl. Strassenansicht Überlandstrasse)']];
function plantName(c) { let best = null, bd = 1e9; for (const [p, n, d] of PLANT_NAMES) { const dd = Math.hypot(p[0] - c[0], p[1] - c[1]); if (dd < bd) { bd = dd; best = [n, d]; } } return bd < 15 ? best : ['Industrieanlage', '']; }
function towerModel(p) {
  const grp = new THREE.Group(); const poly = p.poly; const y0 = p.y0 - 0.4; const h = p.h + 0.4;
  const e0 = [poly[1][0] - poly[0][0], poly[1][1] - poly[0][1]], e1 = [poly[2][0] - poly[1][0], poly[2][1] - poly[1][1]]; const w = Math.hypot(...e0), d = Math.hypot(...e1); const ang = Math.atan2(e0[1], e0[0]);
  const cx = (poly[0][0] + poly[2][0]) / 2, cz = (poly[0][1] + poly[2][1]) / 2; const [nm, ds] = plantName([cx, cz]);
  if (p.silo) {
    const L = Math.max(w, d), Bw = Math.min(w, d); const n = Math.max(3, Math.round(L / 7)); const ua = w >= d ? ang : ang + Math.PI / 2; const u = [Math.cos(ua), Math.sin(ua)];
    const geos = [], steel = [];
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n - 0.5; const x = cx + u[0] * L * t * 0.8, z = cz + u[1] * L * t * 0.8; const r = Math.min(2.8, Bw / 2.6);
      const c = new THREE.CylinderGeometry(r, r, h * 0.6, 28); c.translate(x, y0 + h * 0.38 + h * 0.3, z); geos.push(c); const cone = new THREE.ConeGeometry(r, 3.2, 28); cone.rotateX(Math.PI); cone.translate(x, y0 + h * 0.38 - 1.6, z); geos.push(cone);
      const rc = new THREE.ConeGeometry(r * 1.02, 1.2, 28); rc.translate(x, y0 + h * 0.98 + 0.6, z); geos.push(rc);
      for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) steel.push(boxG(0.35, h * 0.38, 0.35, x + dx * r * 0.7, y0 + h * 0.19, z + dz * r * 0.7)); }
    const s = merged(geos, M.white); grp.add(s); grp.add(merged(steel, M.steel)); addPick(s, { t: nm, b: ds });
    const tw = boxG(Bw * 0.55, h * 0.75, Bw * 0.55); tw.rotateY(-ua); tw.translate(cx - u[0] * L * 0.5, y0 + h * 0.375, cz - u[1] * L * 0.5); grp.add(merged([tw], M.wallMetal));
    return grp;
  }
  if (p.round && Math.abs(w - d) < 4 && h < 20) { const r = Math.min(w, d) / 2; const c = new THREE.CylinderGeometry(r * 0.8, r * 0.8, h * 0.5, 24); c.translate(cx, y0 + h * 0.65, cz); const legs = []; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; legs.push(boxG(0.4, h * 0.42, 0.4, cx + Math.cos(a) * r * 0.7, y0 + h * 0.21, cz + Math.sin(a) * r * 0.7)); }
    const m = merged([c], M.steel); grp.add(m); grp.add(merged(legs, M.rust)); addPick(m, { t: nm, b: ds }); return grp; }
  const geos = [], frame = []; const hb = h * 0.45; const top = boxG(w * 0.92, h - hb, d * 0.92); top.rotateY(-ang); top.translate(cx, y0 + hb + (h - hb) / 2, cz); geos.push(top);
  const nx = Math.max(2, Math.round(w / 4)), nz = Math.max(2, Math.round(d / 4)); const u = [Math.cos(ang), Math.sin(ang)], v = [-u[1], u[0]];
  for (let i = 0; i <= nx; i++) for (let k = 0; k <= nz; k++) { const px = cx + u[0] * (i / nx - 0.5) * w * 0.9 + v[0] * (k / nz - 0.5) * d * 0.9, pz = cz + u[1] * (i / nx - 0.5) * w * 0.9 + v[1] * (k / nz - 0.5) * d * 0.9; frame.push(boxG(0.3, hb, 0.3, px, y0 + hb / 2, pz)); }
  for (let l = 1; l <= 2; l++) { const pl = boxG(w * 0.9, 0.25, d * 0.9); pl.rotateY(-ang); pl.translate(cx, y0 + hb * l / 2.2, cz); frame.push(pl); }
  const m = merged(geos, M.wallMetal); grp.add(m); grp.add(merged(frame, M.steel)); addPick(m, { t: nm, b: ds });
  const bk = new THREE.CylinderGeometry(Math.min(w, d) * 0.3, 0.6, hb * 0.5, 4, 1); bk.rotateY(Math.PI / 4 - ang); bk.translate(cx, y0 + hb * 0.55, cz); grp.add(merged([bk], M.rust));
  return grp;
}
for (const p of SCENE.plants) world.add(towerModel(p));
const CONVEYORS = [[[-155, -95], [-118, -150], 2.5, 15], [[-150, -88], [-96, -118], 2.5, 13], [[-165, -78], [-196, -122], 2.5, 12], [[-71, -100], [-34, -134], 3, 11], [[-140, -48], [-150, -86], 12, 4], [[-141, -36], [-112, -6], 4, 12], [[-128, 6], [-108, 36], 2, 18], [[-92, 2], [-104, 36], 1.5, 14]];
function conveyor(a, b, ha, hb) { const ya = groundAt(a[0], a[1]) + ha, yb = groundAt(b[0], b[1]) + hb; const A = V3(a[0], ya, a[1]), B = V3(b[0], yb, b[1]); const dir = B.clone().sub(A); const L = dir.length();
  const grp = new THREE.Group(); const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), dir.clone().normalize()); const mid = A.clone().add(B).multiplyScalar(0.5);
  const parts = [[boxG(1.3, 0.55, L), M.steel], [boxG(1.0, 0.08, L, 0, 0.32, 0), M.belt]]; const cov = new THREE.CylinderGeometry(0.75, 0.75, L, 12, 1, true, -Math.PI / 2, Math.PI); cov.rotateX(Math.PI / 2); cov.translate(0, 0.3, 0); parts.push([cov, M.galv]);
  let first = null; for (const [g, mt] of parts) { const m = new THREE.Mesh(g, mt); m.quaternion.copy(q); m.position.copy(mid); m.castShadow = true; grp.add(m); first = first || m; }
  const legs = []; const n = Math.floor(L / 9); for (let i = 1; i <= n; i++) { const p = A.clone().lerp(B, i / (n + 1)); const g0 = groundAt(p.x, p.z); if (p.y - g0 > 0.5) legs.push(boxG(0.25, p.y - g0, 0.25, p.x, (p.y + g0) / 2, p.z)); }
  if (legs.length) grp.add(merged(legs, M.steel)); addPick(first, { t: 'Förderband (schematisch)', b: `Länge ${L.toFixed(0)} m, Antrieb 15 bis 30 kW` }); return grp; }
for (const [a, b, ha, hb] of CONVEYORS) world.add(conveyor(a, b, ha, hb));

setL(50, 'Wald und Fahrzeuge ...');
const treeGeoC = (() => { const r = mulberry32(5); const g = []; const N = 6; for (let i = 0; i < N; i++) { const t = i / (N - 1); const rad = 0.46 * (1 - t * 0.8); const h = 0.34 - t * 0.09; let c = new THREE.ConeGeometry(rad, h, 14, 1, true); c.deleteAttribute('normal'); c.deleteAttribute('uv'); c = BGU.mergeVertices(c); const p = c.attributes.position; for (let k = 0; k < p.count; k++) { const y = p.getY(k); if (y < 0) { const sc = 0.82 + r() * 0.34; p.setXYZ(k, p.getX(k) * sc, y - r() * 0.05, p.getZ(k) * sc); } } c.translate(0, 0.2 + t * 0.64 + h / 2, 0); g.push(c); }
  const m = BGU.mergeGeometries(g); m.computeVertexNormals(); const p = m.attributes.position; const col = new Float32Array(p.count * 3); for (let k = 0; k < p.count; k++) { const v = 0.62 + 0.42 * Math.min(1, p.getY(k)) + (r() - 0.5) * 0.16; col[k * 3] = v; col[k * 3 + 1] = v; col[k * 3 + 2] = v; } m.setAttribute('color', new THREE.BufferAttribute(col, 3)); return m; })();
const treeGeoD = (() => { const r = mulberry32(3); const parts = []; const blobs = [[0, 0.6, 0, 0.36], [0.21, 0.5, 0.08, 0.27], [-0.2, 0.52, -0.06, 0.28], [0.05, 0.48, -0.21, 0.26], [-0.07, 0.47, 0.21, 0.26], [0.02, 0.82, 0.03, 0.26], [0.15, 0.72, -0.12, 0.2], [-0.14, 0.74, 0.11, 0.2]];
  for (const [bx, by, bz, br] of blobs) { let g = new THREE.IcosahedronGeometry(br, 1); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = BGU.mergeVertices(g); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const sc = 0.84 + r() * 0.32; p.setXYZ(i, p.getX(i) * sc + bx, p.getY(i) * sc * 0.9 + by, p.getZ(i) * sc + bz); } parts.push(g); }
  const g = BGU.mergeGeometries(parts); g.computeVertexNormals(); const p = g.attributes.position; const col = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const t = Math.min(1, Math.max(0, (p.getY(i) - 0.25) / 0.8)); const v = 0.5 + 0.55 * t + (r() - 0.5) * 0.14; col[i * 3] = v; col[i * 3 + 1] = v; col[i * 3 + 2] = v; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; })();
const trunkGeo = (() => { const c = new THREE.CylinderGeometry(0.035, 0.06, 0.5, 6); c.translate(0, 0.25, 0); return c; })();
const matC = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95, envMapIntensity: 0.3 }), matD = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95, envMapIntensity: 0.3 }), matTr = new THREE.MeshStandardMaterial({ map: TX.bark, roughness: 1 });
let treeD = null; const treeColsSummer = [], treeColsWinter = [];
{ const r = mulberry32(17); const mc = [], md = [], mt = []; const cD = new THREE.Color();
  for (const t of SCENE.trees) { const [x, y, z, h, con] = t; const g = groundAt(x, z); const hh = Math.max(4, h); const yaw = r() * 6.28;
    if (con) { const cw = hh * (0.28 + r() * 0.08); mc.push(mtx(x, g, z, yaw, [cw * 2.1, hh, cw * 2.1])); mt.push(mtx(x, g, z, yaw, [hh * 0.5, hh * 0.6, hh * 0.5])); }
    else { const cw = hh * (0.36 + r() * 0.12); md.push(mtx(x, g + hh * 0.25, z, yaw, [cw, hh * 0.78, cw])); mt.push(mtx(x, g, z, yaw, [hh * 0.6, hh * 0.65, hh * 0.6])); treeColsSummer.push(cD.setHSL(0.2 + r() * 0.07, 0.38 + r() * 0.2, 0.25 + r() * 0.1).clone()); treeColsWinter.push(cD.setHSL(0.07 + r() * 0.04, 0.18 + r() * 0.1, 0.27 + r() * 0.08).clone()); } }
  { const tc = instanced(treeGeoC, matC, mc); const rc = mulberry32(23); const cc = new THREE.Color(); for (let i = 0; i < mc.length; i++) tc.setColorAt(i, cc.setHSL(0.31 + rc() * 0.06, 0.28 + rc() * 0.12, 0.17 + rc() * 0.06)); world.add(tc); } treeD = instanced(treeGeoD, matD, md); treeColsSummer.forEach((c, i) => treeD.setColorAt(i, c)); world.add(treeD); world.add(instanced(trunkGeo, matTr, mt, true, false)); }
const carGeo = (() => BGU.mergeGeometries([boxG(4.4, 0.75, 1.8, 0, 0.62, 0), boxG(2.4, 0.6, 1.62, -0.2, 1.25, 0)].map(g => g.toNonIndexed())))();
const wheelGeo = (() => { const g = []; for (const [x, z] of [[1.35, 0.82], [-1.35, 0.82], [1.35, -0.82], [-1.35, -0.82]]) { const c = new THREE.CylinderGeometry(0.33, 0.33, 0.22, 12); c.rotateX(Math.PI / 2); c.translate(x, 0.33, z); g.push(c.toNonIndexed()); } return BGU.mergeGeometries(g); })();
const glassGeo = boxG(2.28, 0.48, 1.66, -0.2, 1.26, 0);
{ const ms = [], cols = []; const col = new THREE.Color();
  for (const c of SCENE.cars) { const [x, y, z, a, rgb] = c; ms.push(mtx(x, groundAt(x, z), z, -a)); cols.push(col.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace).clone()); }
  const carMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.55, envMapIntensity: 0.7 }); const im = instanced(carGeo, carMat, ms); cols.forEach((c, i) => im.setColorAt(i, c)); world.add(im);
  world.add(instanced(wheelGeo, M.black, ms)); world.add(instanced(glassGeo, M.glass, ms)); addPick(im, { t: 'Autohandel (Abstellplatz)', b: `${SCENE.cars.length} Fahrzeuge, Positionen und Farben aus dem Luftbild abgeleitet` }); }
const truckGeo = (() => BGU.mergeGeometries([boxG(2.3, 2.6, 2.45, 3.0, 1.75, 0), boxG(5.2, 1.6, 2.5, -0.9, 2.0, 0), boxG(7.6, 0.4, 1.0, 0.2, 0.75, 0)].map(g => g.toNonIndexed())))();
const truckWheels = (() => { const g = []; for (const x of [3.1, -0.8, -2.2]) for (const z of [1.05, -1.05]) { const c = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 14); c.rotateX(Math.PI / 2); c.translate(x, 0.5, z); g.push(c.toNonIndexed()); } return BGU.mergeGeometries(g); })();
{ const ms = SCENE.trucks.map(t => { const [x, y, z, a, L] = t; return mtx(x, groundAt(x, z), z, -a, [L / 7.6, 1, 1]); }); const im = instanced(truckGeo, M.agir, ms); world.add(im); world.add(instanced(truckWheels, M.black, ms)); addPick(im, { t: 'Werkfahrzeuge und Mulden', b: 'Positionen aus dem Luftbild (grüne Fahrzeuge)' }); }
// Verkehr
const traffic = []; const ROAD_PATHS = [];
{ const segs = SCENE.roads.map(r => ({ kind: r.kind, pts: r.pts.map(p => [p[0], p[2], p[1]]) }));
  function chain(kind) { const S = segs.filter(s => s.kind === kind).map(s => s.pts.slice()); const paths = []; const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]); while (S.length) { let p = S.pop(); let grow = true; while (grow) { grow = false; for (let i = 0; i < S.length; i++) { const q = S[i];
        if (d(p[p.length - 1], q[0]) < 1) { p = p.concat(q.slice(1)); S.splice(i, 1); grow = true; break; } if (d(p[p.length - 1], q[q.length - 1]) < 1) { p = p.concat(q.slice().reverse().slice(1)); S.splice(i, 1); grow = true; break; }
        if (d(p[0], q[q.length - 1]) < 1) { p = q.concat(p.slice(1)); S.splice(i, 1); grow = true; break; } if (d(p[0], q[0]) < 1) { p = q.slice().reverse().concat(p.slice(1)); S.splice(i, 1); grow = true; break; } } } paths.push(p); } return paths.sort((a, b) => b.length - a.length); }
  const ul = chain('UL')[0], a1 = chain('A1');
  if (ul && ul.length > 2) ROAD_PATHS.push({ kind: 'UL', pts: ul, lanes: [-1.75, 1.75], v: 13.9, n: 16 });
  for (const p of a1.slice(0, 2)) if (p.length > 3) ROAD_PATHS.push({ kind: 'A1', pts: p, lanes: [-1.9, 1.9], v: 27, n: 14, deck: true });
  const r = mulberry32(5); const palette = [0xffffff, 0x1d1f22, 0x8d939a, 0x2a4b7c, 0x9b1c1c, 0xc4c7cc, 0x3c3f44];
  for (const rp of ROAD_PATHS) { const pts = rp.pts.map(p => V3(p[0], rp.deck && p[2] ? p[2] : groundAt(p[0], p[1]), p[1])); const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); rp.curve = curve; rp.L = curve.getLength();
    for (let i = 0; i < rp.n; i++) { const isT = r() < 0.15; const m = new THREE.Mesh(isT ? truckGeo : carGeo, isT ? M.agir : new THREE.MeshStandardMaterial({ color: palette[Math.floor(r() * palette.length)], roughness: 0.35, metalness: 0.55 })); m.castShadow = true; world.add(m); traffic.push({ m, rp, s: r() * rp.L, dir: r() < 0.5 ? 1 : -1, v: rp.v * (0.8 + r() * 0.3) }); } } }
function updateTraffic(dt) { for (const t of traffic) { t.s = (t.s + t.dir * t.v * dt + t.rp.L) % t.rp.L; const u = t.s / t.rp.L; const p = t.rp.curve.getPointAt(u); const tg = t.rp.curve.getTangentAt(u); const lane = t.dir > 0 ? t.rp.lanes[1] : t.rp.lanes[0]; const x = p.x - tg.z * lane, z = p.z + tg.x * lane; t.m.position.set(x, t.rp.deck ? p.y : groundAt(x, z), z); t.m.rotation.y = Math.atan2(-tg.z * t.dir, tg.x * t.dir); } }
const loaderGeo = (() => BGU.mergeGeometries([boxG(3.2, 1.6, 2.4, 0, 1.6, 0), boxG(1.4, 1.6, 1.6, -0.6, 3.0, 0), boxG(0.5, 1.1, 2.9, 2.4, 0.9, 0)].map(x => x.toNonIndexed())))();
const machines = [];
for (const [path, sp] of [[[[-120, -140], [-150, -100], [-130, -70], [-100, -110]], 4.5], [[[-20, -45], [-60, -60], [-140, -90], [-60, -62]], 5.5]]) { const m = new THREE.Group(); const body = new THREE.Mesh(loaderGeo, M.yellow); body.castShadow = true; m.add(body); const wh = new THREE.Mesh(truckWheels, M.black); wh.scale.set(0.8, 1.6, 1); m.add(wh); world.add(m); const c = new THREE.CatmullRomCurve3(path.map(p => V3(p[0], 0, p[1])), true); machines.push({ m, c, L: c.getLength(), s: Math.random() * 100, v: sp }); addPick(body, { t: 'Radlader (Werkverkehr)', b: 'Schematische Pendelfahrt zwischen Halden und Aufgabebunker' }); }
function updateMachines(dt) { for (const k of machines) { k.s = (k.s + k.v * dt) % k.L; const u = k.s / k.L; const p = k.c.getPointAt(u), t = k.c.getTangentAt(u); k.m.position.set(p.x, groundAt(p.x, p.z), p.z); k.m.rotation.y = Math.atan2(-t.z, t.x); } }
// ------------------------------------------------------------------ BESS-Aufbau aus dem Rechenkern
setL(65, 'Batteriespeicher wird dimensioniert ...');
let RES = null, CUR = null, curVar = Q.get('variant') || 'A';
const bessGroup = new THREE.Group(); scene.add(bessGroup);
const ovlGroup = new THREE.Group(); scene.add(ovlGroup);
const labelGroup = new THREE.Group(); scene.add(labelGroup);
const LAYERS = { dims: true, zones: true, nisv: false, noise: false, flows: true, labels: true, cables: true };
for (const l of (Q.get('layers') || '').split(',').filter(Boolean)) { const [k, v] = l.split(':'); LAYERS[k] = v !== '0'; }
const PARAMS = { layout: {}, ops: {} };
const cabTexFront = canvasTex(256, 512, (g, w, h) => { g.fillStyle = '#f1f2f0'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b9bdbf'; g.lineWidth = 3; g.strokeRect(10, 10, w - 20, h - 20); g.beginPath(); g.moveTo(w / 2, 12); g.lineTo(w / 2, h - 12); g.stroke();
  g.fillStyle = '#c3c7c9'; for (let y = 330; y < 470; y += 10) { g.fillRect(24, y, w / 2 - 36, 5); g.fillRect(w / 2 + 12, y, w / 2 - 36, 5); }
  g.fillStyle = '#ffd400'; g.beginPath(); g.moveTo(w / 2 - 50, 62); g.lineTo(w / 2 - 28, 100); g.lineTo(w / 2 - 72, 100); g.closePath(); g.fill(); g.fillStyle = '#111'; g.font = 'bold 26px Arial'; g.fillText('!', w / 2 - 54, 96); g.fillStyle = '#0A2463'; g.font = 'bold 26px Arial'; g.fillText('NRG', w / 2 + 14, 92);
  g.fillStyle = '#6c7378'; g.fillRect(w / 2 - 22, 220, 8, 50); g.fillRect(w / 2 + 14, 220, 8, 50); });
const cabMatFront = new THREE.MeshStandardMaterial({ map: cabTexFront, roughness: 0.4, metalness: 0.05, envMapIntensity: 0.45 });
const signHV = signTex(['Achtung Hochspannung', 'Batteriespeicher bis 1500 V DC', 'Zutritt nur für Berechtigte'], '#ffd400');
const signPS = signTex(['Mittelspannung 16 kV', 'Lebensgefahr', 'Power Station'], '#ffd400');
let flows = []; let dimObjs = [];
function clearGroup(g) { while (g.children.length) { const c = g.children.pop(); c.traverse(o => { if (o.geometry && o.geometry !== flowGeo) o.geometry.dispose(); if (o.isCSS2DObject && o.element) o.element.remove(); }); } }
function convexHull(P) { const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = []; for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); } for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); } return lo.slice(0, -1).concat(up.slice(0, -1)); }
function setVis(g, v) { g.visible = v; g.traverse(o => { if (o.isCSS2DObject) o.visible = v; }); }
function fieldY(earth, id, fallback) { const e = earth.find(x => x.field === id); return e ? e.planum : fallback; }
function buildBESS(V) {
  clearGroup(bessGroup); for (let i = pickables.length - 1; i >= 0; i--) if (pickables[i].userData.bess) pickables.splice(i, 1);
  const L = V.layout; const earth = V.earth;
  const tagB = (o) => { o.userData.bess = 1; return o; };
  // Planum: gemeinsame Aushubfläche (konvexe Hülle der Felder) und Stützmauer zur Waldseite
  const allPts = []; for (const f of L.fields) for (const p of EN.inset(f.poly, -1.2)) allPts.push(p);
  const hull = convexHull(allPts); const planum = Math.min(...L.fields.map(f => fieldY(earth, f.id, groundAt(...EN.centroid(f.poly)))));
  setTerrainPads([{ poly: EN.inset(hull, -2.0), y: planum }]);
  { const sh = new THREE.Shape(EN.inset(hull, -0.2).map(p => new THREE.Vector2(p[0], -p[1]))); const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv, ps = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, ps.getX(i) / 8, ps.getZ(i) / 8); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: TX.concrete, color: 0xbdbbb3, roughness: 0.95 })); m.position.y = planum + 0.03; m.receiveShadow = true; bessGroup.add(m); }
  for (const f of L.fields) { const y = fieldY(earth, f.id, planum) + 0.06; const sh = new THREE.Shape(EN.inset(f.poly, -0.6).map(p => new THREE.Vector2(p[0], -p[1]))); const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv, ps = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, ps.getX(i) / 6, ps.getZ(i) / 6); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: TX.concrete, color: 0xd6d5cf, roughness: 0.9 })); m.position.y = y; m.receiveShadow = true; bessGroup.add(m); }
  const wallH = Math.max(...earth.map(e => e.wallH));
  for (let ei = 0; ei < hull.length; ei++) { const a = hull[ei], b = hull[(ei + 1) % hull.length]; const t = [b[0] - a[0], b[1] - a[1]]; const l = Math.hypot(...t); const nrm = [t[1] / l, -t[0] / l]; // nach aussen (Hülle im Uhrzeigersinn? prüfen)
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; const out = EN.pip([mid[0] + nrm[0] * 0.5, mid[1] + nrm[1] * 0.5], hull) ? [-nrm[0], -nrm[1]] : nrm;
    let hs = 0; for (let k = 0; k <= 4; k++) { const x = lerp(a[0], b[0], k / 4) + out[0] * 2.5, z = lerp(a[1], b[1], k / 4) + out[1] * 2.5; hs = Math.max(hs, heightAt0(x, z) - planum); } if (hs < 0.8) continue;
    const n = Math.max(2, Math.ceil(l / 1.2)); const pos = [], uv = [], idx = [];
    for (let k = 0; k <= n; k++) { const x = lerp(a[0], b[0], k / n), z = lerp(a[1], b[1], k / n); const xw = x + out[0] * 0.3, zw = z + out[1] * 0.3; let top = planum + 0.4; for (const dd of [2.0, 3.0, 4.0]) top = Math.max(top, heightAt0(x + out[0] * dd, z + out[1] * dd) + 0.25); top = Math.min(top, planum + wallH + 0.6); pos.push(xw, planum, zw, xw, top, zw); uv.push(k * l / n / 2, 0, k * l / n / 2, (top - planum) / 2); if (k) { const q = k * 2; idx.push(q - 2, q - 1, q, q - 1, q + 1, q); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); const m = tagB(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: TX.shotcrete, color: 0x9a978f, roughness: 0.95, side: THREE.DoubleSide }))); m.castShadow = m.receiveShadow = true; bessGroup.add(m);
    // Kopfbalken
    const cap = []; for (let k = 0; k < n; k++) { const x0 = pos[k * 6], y0 = pos[k * 6 + 4], z0 = pos[k * 6 + 2], x1 = pos[k * 6 + 6], y1 = pos[k * 6 + 10], z1 = pos[k * 6 + 8]; const bx = boxG(Math.hypot(x1 - x0, z1 - z0) + 0.05, 0.25, 0.4); bx.rotateY(-Math.atan2(z1 - z0, x1 - x0)); bx.translate((x0 + x1) / 2 + out[0] * 0.2, (y0 + y1) / 2, (z0 + z1) / 2 + out[1] * 0.2); cap.push(bx); } bessGroup.add(merged(cap, M.concrete));
    addPick(m, { t: 'Stützbauwerk zur Waldterrasse (Nagelwand)', b: `Planum ${(planum + 390).toFixed(1)} m ü. M., Stützhöhe bis ca. ${hs.toFixed(1)} m. ${earth.map(e => `${e.field}: Abtrag ${fmt(e.cut_m3)} m3`).join(', ')} (inkl. Haldenmaterial, verwertbar).` }); }
  // Schränke
  const cabs = L.objects.filter(o => o.type === 'battery_cabinet'); const cab = V.P.cab;
  // Box: lokal x = Breite (entlang Reihe), z = Tiefe; Tür auf +z. Rotation so, dass lokal +x = Reihenrichtung, +z = Blickrichtung (facing)
  const bodyM2 = cabs.map(c => { const y = fieldY(earth, c.field, groundAt(c.c[0], c.c[1])) + 0.35; return mtx(c.c[0], y, c.c[1], -c.ang); });
  const bodyG = boxG(cab.w, cab.h, cab.d, 0, cab.h / 2, 0);
  const imBody = instanced(bodyG, [M.white, M.white, M.white, M.white, cabMatFront, M.white], bodyM2); tagB(imBody); imBody.userData.cabs = cabs; bessGroup.add(imBody); addPick(imBody, { cab: true });
  const capG = boxG(cab.w + 0.08, 0.06, cab.d + 0.08, 0, cab.h + 0.03, 0), plG = boxG(cab.w - 0.04, 0.12, cab.d - 0.04, 0, 0.06, 0), ledG = boxG(cab.w * 0.6, 0.03, 0.01, 0, cab.h - 0.18, cab.d / 2 + 0.006), chG = boxG(cab.w * 0.86, 0.3, cab.d * 0.7, 0, cab.h + 0.21, -0.1);
  const fanG = (() => { const g = []; for (const dx of [-0.3, 0.3]) { const c = new THREE.CylinderGeometry(0.22, 0.22, 0.02, 20); c.translate(dx, cab.h + 0.37, -0.1); g.push(c.toNonIndexed()); } return BGU.mergeGeometries(g); })();
  bessGroup.add(instanced(capG, M.grey, bodyM2), instanced(plG, M.dark, bodyM2), instanced(ledG, M.led, bodyM2, false, false), instanced(chG, M.ral7035, bodyM2), instanced(fanG, M.dark, bodyM2, false));
  // Fundamente
  bessGroup.add(instanced(new THREE.BoxGeometry(1, 1, 1), M.concrete, L.found.map(f => mtx(f.c[0], fieldY(earth, f.field, 0) + f.h / 2 - 0.05, f.c[1], yawOf(f.ang), [f.w, f.h + 0.1, f.d]))));
  if (L.ps) buildPS(L.ps, fieldY(earth, L.ps.field, groundAt(L.ps.c[0], L.ps.c[1])));
  // Zaun
  for (const z of L.fences) { const y = fieldY(earth, z.field, 0); const p = z.poly; const panels = [], posts = [];
    for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); const t = [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; const gate = i === z.gateEdge;
      const n = Math.ceil(l / 2.5); for (let k = 0; k < n; k++) { const s0 = k * l / n, s1 = (k + 1) * l / n; const mid = (s0 + s1) / 2; if (gate && Math.abs(mid - l / 2) < 2.0) continue; const pg = new THREE.PlaneGeometry(s1 - s0, z.h); pg.translate(0, z.h / 2, 0); const uv = pg.attributes.uv; for (let q = 0; q < uv.count; q++) uv.setXY(q, uv.getX(q) * (s1 - s0) / 2.5, uv.getY(q)); pg.rotateY(-Math.atan2(t[1], t[0])); pg.translate(a[0] + t[0] * mid, y, a[1] + t[1] * mid); panels.push(pg); }
      for (let k = 0; k <= n; k++) { const s = k * l / n; posts.push(boxG(0.08, z.h + 0.1, 0.08, a[0] + t[0] * s, y + (z.h + 0.1) / 2, a[1] + t[1] * s)); }
      if (gate) for (const sg of [-1, 1]) { const s = l / 2 + sg * 1.0; const g = new THREE.PlaneGeometry(1.95, z.h - 0.1); g.translate(0, (z.h - 0.1) / 2 + 0.05, 0); g.rotateY(-Math.atan2(t[1], t[0])); g.translate(a[0] + t[0] * s, y, a[1] + t[1] * s); panels.push(g); } }
    bessGroup.add(merged(panels, M.fence, false, false), merged(posts, M.galv));
    const a = p[z.gateEdge], b = p[(z.gateEdge + 1) % p.length]; const t = [b[0] - a[0], b[1] - a[1]]; const l = Math.hypot(...t); const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), new THREE.MeshStandardMaterial({ map: signHV, side: THREE.DoubleSide })); sg.position.set(a[0] + t[0] / l * (l / 2 - 2.6), y + 1.4, a[1] + t[1] / l * (l / 2 - 2.6)); sg.rotation.y = -Math.atan2(t[1], t[0]); bessGroup.add(sg); }
  // Anprallschutz
  const blockGeo = (() => { const g = [boxG(1, 1, 1)]; for (const dx of [-0.25, 0.25]) { const c = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12); c.scale(1 / 1.6, 1, 1 / 0.8); c.translate(dx, 0.54, 0); g.push(c); } return BGU.mergeGeometries(g.map(x => x.toNonIndexed())); })();
  bessGroup.add(instanced(blockGeo, M.concrete, L.blocks.map(b => mtx(b.c[0], groundAt(b.c[0], b.c[1]) + 0.4, b.c[1], yawOf(b.ang), [b.w, b.h, b.d]))));
  const polG = new THREE.CylinderGeometry(0.135, 0.135, 1.2, 16); polG.translate(0, 0.6, 0);
  const polTex = canvasTex(64, 256, (g, w, h) => { for (let y = 0; y < h; y += 40) { g.fillStyle = (y / 40) % 2 ? '#111' : '#f2c200'; g.fillRect(0, y, w, 40); } }); bessGroup.add(instanced(polG, new THREE.MeshStandardMaterial({ map: polTex, roughness: 0.5 }), L.bollards.map(b => mtx(b.c[0], groundAt(b.c[0], b.c[1]), b.c[1]))));
  for (const t of L.trays) { const r = tagB(ribbonOnGround(t.pts, t.w, 0.12, new THREE.MeshStandardMaterial({ map: TX.concrete, color: 0xa9aaa5, roughness: 0.9 }), 0.8)); bessGroup.add(r); const len = t.pts.reduce((s, p, i) => i ? s + Math.hypot(p[0] - t.pts[i - 1][0], p[1] - t.pts[i - 1][1]) : 0, 0); addPick(r, { t: t.name, b: `Länge ca. ${fmt(len)} m, Betonkanal 50 x 40 cm mit Deckel, DC-Hauptkabel je Reihe` }); }
  if (L.mv) { const r = tagB(ribbonOnGround(L.mv.pts, 0.6, 0.07, new THREE.MeshStandardMaterial({ color: 0xf36c21, roughness: 0.7, transparent: true, opacity: 0.85, emissive: 0x6a2200, emissiveIntensity: 0.4 }), 0.8)); r.visible = LAYERS.cables; r.name = 'mvRibbon'; bessGroup.add(r); addPick(r, { t: 'MS-Kabelweg 16 kV zum Netzanschlusspunkt', b: `${L.mv.name}<br>Trassenlänge ca. ${fmt(L.mv.len)} m, Kabelschutzrohre 2 x DN 160 plus Reserve, Kabelzugschächte max. 60 m` }); }
  buildNAP();
  for (const f of L.fields) { const y0 = fieldY(earth, f.id, 0); const p = f.poly; const c = EN.centroid(p); for (const k of [0, 2]) { const q = p[k]; const x = lerp(q[0], c[0], 0.1), z = lerp(q[1], c[1], 0.1); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 6, 8), M.galv); pole.position.set(x, y0 + 3, z); pole.castShadow = true; const head = new THREE.Mesh(boxG(0.5, 0.12, 0.3), M.dark); head.position.set(x, y0 + 6, z); const lamp = new THREE.SpotLight(0xfff2dd, 0, 45, 0.9, 0.6, 1.2); lamp.position.set(x, y0 + 5.9, z); lamp.target.position.set(c[0], y0, c[1]); lamp.userData.night = true; bessGroup.add(pole, head, lamp, lamp.target); } }
  CUR = V; buildOverlays(V); buildFlows(V); buildLabels(V); renderPanels();
}
function buildPS(ps, y0) {
  const y = y0 + 0.3; const grp = new THREE.Group(); const L = ps.l, Wd = ps.w, H = ps.h;
  const skid = [boxG(L, 0.25, 0.22, 0, 0.125, Wd / 2 - 0.11), boxG(L, 0.25, 0.22, 0, 0.125, -Wd / 2 + 0.11)]; for (let i = 0; i <= 6; i++) skid.push(boxG(0.18, 0.2, Wd, -L / 2 + i * L / 6, 0.12, 0)); grp.add(merged(skid, M.steel));
  const inv = new THREE.Mesh(boxG(2.5, H - 0.25, Wd, -L / 2 + 1.25, 0.25 + (H - 0.25) / 2, 0), [M.louver, M.ral7035, M.ral7035, M.ral7035, M.louver, M.louver]); grp.add(inv);
  const sw = new THREE.Mesh(boxG(1.6, H - 0.25, Wd, L / 2 - 0.8, 0.25 + (H - 0.25) / 2, 0), M.ral7035); grp.add(sw);
  const dr = []; for (const s of [-1, 1]) { dr.push(boxG(0.7, 1.9, 0.02, L / 2 - 1.2, 1.3, s * (Wd / 2 + 0.01)), boxG(0.7, 1.9, 0.02, L / 2 - 0.42, 1.3, s * (Wd / 2 + 0.01))); } grp.add(merged(dr, M.grey));
  const tr = [boxG(1.5, 1.6, 1.3, 0.35, 1.15, 0)]; for (let i = 0; i < 9; i++) { tr.push(boxG(0.05, 1.3, 0.4, -0.2 + i * 0.14, 1.1, 0.85), boxG(0.05, 1.3, 0.4, -0.2 + i * 0.14, 1.1, -0.85)); } grp.add(merged(tr, M.trafo));
  const bush = []; for (let i = 0; i < 3; i++) { const c = new THREE.CylinderGeometry(0.07, 0.09, 0.45, 10); c.translate(i * 0.35, 2.15, 0.25); bush.push(c); const c2 = new THREE.CylinderGeometry(0.05, 0.06, 0.25, 10); c2.translate(i * 0.35, 2.05, -0.35); bush.push(c2); } grp.add(merged(bush, M.porcelain));
  grp.add(merged([boxG(2.0, 0.3, Wd - 0.1, 0.35, 0.35, 0)], M.dark)); for (const s of [1, -1]) { const gr = new THREE.Mesh(new THREE.PlaneGeometry(2.0, H - 0.6), M.fence); gr.position.set(0.35, 0.3 + (H - 0.6) / 2, s * Wd / 2); grp.add(gr); }
  grp.add(merged([boxG(2.1, 0.08, Wd + 0.1, 0.35, H, 0)], M.ral7035), merged([boxG(1.1, 0.5, 0.8, -L / 2 + 1.0, H + 0.25, 0.4), boxG(1.1, 0.5, 0.8, -L / 2 + 1.0, H + 0.25, -0.5)], M.grey));
  const sgn = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshStandardMaterial({ map: signPS })); sgn.position.set(L / 2 - 0.8, 2.2, Wd / 2 + 0.03); grp.add(sgn);
  grp.add(new THREE.Mesh(boxG(1.2, 0.04, 0.01, -L / 2 + 1.25, H - 0.35, Wd / 2 + 0.01), M.ledBlue));
  const slab = new THREE.Mesh(boxG(L + 0.6, 0.3, Wd + 0.6, 0, -0.15, 0), M.concrete); grp.add(slab);
  grp.position.set(ps.c[0], y, ps.c[1]); grp.rotation.y = -ps.ang; grp.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); bessGroup.add(grp);
  for (const m of [inv, sw]) { m.userData.bess = 1; addPick(m, { ps: true }); }
}
function buildNAP() { const n = SITE.nap; const y = groundAt(n.x, n.z); const g = new THREE.Group(); const kiosk = new THREE.Mesh(boxG(3.6, 2.6, 2.6, 0, 1.3, 0), M.concrete); kiosk.castShadow = kiosk.receiveShadow = true; g.add(kiosk); g.add(merged([boxG(3.8, 0.12, 2.8, 0, 2.66, 0)], M.grey)); const doors = []; for (const dx of [-1.1, 0, 1.1]) doors.push(boxG(0.95, 2.0, 0.03, dx, 1.05, 1.31)); g.add(merged(doors, M.galv));
  const s = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5), new THREE.MeshStandardMaterial({ map: signTex(['Übergabestation 16 kV', 'Netzanschlusspunkt', 'Messung VNB'], '#ffffff', '#0A2463', 512, 256, '#0A2463') })); s.position.set(0, 2.2, 1.34); g.add(s);
  g.position.set(n.x, y, n.z); g.rotation.y = -0.6; bessGroup.add(g); kiosk.userData.bess = 1; addPick(kiosk, { t: n.name, b: 'Fertigteilstation mit MS-Schaltanlage (Einspeisung VNB, Abgang Kieswerk, Abgang BESS), Abrechnungsmessung mit Wandlern, Netzschutz nach NA/RR. Standort angenommen, mit VNB festzulegen.' }); }

// ------------------------------------------------------------------ Overlays
function lineOnGround(pts, color, yOff = 0.25, dashed = false, width = 0) {
  if (width) { const r = ribbonOnGround(pts, width, yOff, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }), 1); r.renderOrder = 3; return r; }
  const P = []; for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (i) { const q = pts[i - 1]; const n = Math.ceil(Math.hypot(p[0] - q[0], p[1] - q[1]) / 2); for (let k = 1; k < n; k++) { const x = lerp(q[0], p[0], k / n), z = lerp(q[1], p[1], k / n); P.push(V3(x, groundAt(x, z) + yOff, z)); } } P.push(V3(p[0], groundAt(p[0], p[1]) + yOff, p[1])); }
  const g = new THREE.BufferGeometry().setFromPoints(P); const l = new THREE.Line(g, dashed ? new THREE.LineDashedMaterial({ color, dashSize: 2, gapSize: 1.2 }) : new THREE.LineBasicMaterial({ color })); if (dashed) l.computeLineDistances(); return l;
}
function areaOnGround(poly, color, opacity = 0.25, yOff = 0.2, cell = 2) { const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]); const pos = [], idx = []; let n = 0; const vm = new Map();
  for (let x = Math.floor(Math.min(...xs) / cell) * cell; x < Math.max(...xs); x += cell) for (let z = Math.floor(Math.min(...zs) / cell) * cell; z < Math.max(...zs); z += cell) { if (!EN.pip([x + cell / 2, z + cell / 2], poly)) continue;
    const q = [[x, z], [x + cell, z], [x + cell, z + cell], [x, z + cell]].map(([a, b]) => { const k = a + ',' + b; if (!vm.has(k)) { vm.set(k, n++); pos.push(a, groundAt(a, b) + yOff, b); } return vm.get(k); }); idx.push(q[0], q[3], q[1], q[1], q[3], q[2]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide })); m.renderOrder = 2; return m; }
function drapeTexture(tex, x0, z0, size, n = 80, yOff = 0.15, opacity = 0.8) { const g = new THREE.PlaneGeometry(size, size, n, n); g.rotateX(-Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + x0 + size / 2, z = p.getZ(i) + z0 + size / 2; p.setXYZ(i, x, groundAt(x, z) + yOff, z); } g.computeVertexNormals(); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false })); m.renderOrder = 4; return m; }
function gridTexture(grid, colorFn) { const n = grid.n; const c = document.createElement('canvas'); c.width = n; c.height = n; const g = c.getContext('2d'); const img = g.createImageData(n, n); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const [r, gg, b, a] = colorFn(grid.vals[j * n + i]); const k = (j * n + i) * 4; img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = a; } g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function contour(grid, level) { const n = grid.n, s = grid.step, segs = []; const v = (i, j) => grid.vals[j * n + i];
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1); const pts = []; const e = (p, q, x1, z1, x2, z2) => { if ((p - level) * (q - level) < 0) { const t = (level - p) / (q - p); pts.push([grid.x0 + (x1 + (x2 - x1) * t) * s, grid.z0 + (z1 + (z2 - z1) * t) * s]); } };
    e(a, b, i, j, i + 1, j); e(b, c, i + 1, j, i + 1, j + 1); e(c, d, i + 1, j + 1, i, j + 1); e(d, a, i, j + 1, i, j); if (pts.length >= 2) segs.push([pts[0], pts[1]]); if (pts.length === 4) segs.push([pts[2], pts[3]]); } return segs; }
function segsToLines(segs, color, yOff = 0.3) { const P = []; for (const [a, b] of segs) P.push(V3(a[0], groundAt(a[0], a[1]) + yOff, a[1]), V3(b[0], groundAt(b[0], b[1]) + yOff, b[1])); return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(P), new THREE.LineBasicMaterial({ color })); }
const STC = { ok: 0x16a34a, warn: 0xd97706, fail: 0xdc2626, info: 0x0a2463 };
const LANG_EN = new URLSearchParams(location.search).get('lang') === 'en';
const TR_EN = [['1-µT-Linie (Anlagegrenzwert NISV)', '1 µT line (installation limit ONIR)'], ['ab Power Station, keine OMEN innerhalb', 'from power station, no sensitive use (OMEN) inside'], ['Weisse Zelthalle Nord', 'White tent hall north'], ['Weisse Zelthalle Süd', 'White tent hall south'], ['Lagerhalle grau Süd', 'Grey storage hall south'], ['Lagerhalle grau', 'Grey storage hall'], ['Lagerunterstand', 'Storage shelter'], ['Materialboxen mit Dach', 'Covered material bays'], ['Kieshalde Süd / Boxen', 'Gravel stockpile south / bays'], ['Kieshalde Nord', 'Gravel stockpile north'], ['Kieshalde', 'Gravel stockpile'], ['Statische Waldgrenze', 'Static forest boundary'], ['statische Waldgrenze', 'static forest boundary'], ['Waldabstandslinie', 'Forest distance line'], ['Waldgrenze', 'Forest boundary'], ['Werkstrasse (Achse)', 'Works road (axis)'], ['Grundstücksgrenze', 'Property boundary'], ['Betriebsgebäude', 'Operations building'], ['Wartungsgasse', 'Maintenance aisle'], ['Rückabstand', 'Rear clearance'], ['Schrank - Power Station', 'Cabinet - power station'], ['Brandabstand', 'Fire separation'], ['Soll', 'req.'], ['Schränke', 'cabinets'], ['Batteriespeicher NRG Solution', 'Battery storage NRG Solution'], ['Netzanschlusspunkt 16 kV', 'Grid connection point 16 kV'], ['Brech- und Siebanlage', 'Crushing and screening plant'], ['Asphaltmischwerk Asfatop', 'Asphalt mixing plant Asfatop'], ['Kieswäsche', 'Gravel washing'], ['Wald Unterer Tannwalding', 'Forest Unterer Tannwalding'], ['Autohandel', 'Car dealer'], ['Büroraum Autohandel (Betriebsraum)', 'Car dealer office (work room)'], ['Golfclub Unterengstringen, Clubhaus', 'Golf club Unterengstringen, clubhouse'], ['Golfclub Unterengstringen', 'Golf club Unterengstringen'], ['Gewerbe Werkhof / Loxam (Betriebsraum)', 'Commercial yard / Loxam (work room)'], ['Nächste Wohnnutzung Unterengstringen', 'Nearest residential use Unterengstringen'], ['Steuerkabine Asphaltmischwerk (eigener Betrieb)', 'Asphalt plant control cabin (own operation)'], ['Lr Tag', 'Lr day'], ['/ Nacht', '/ night'], ['Magnetfeld 50 Hz, 1 m über Boden', 'Magnetic field 50 Hz, 1 m above ground'], ['rote Linie: 1 µT (Anlagegrenzwert)', 'red line: 1 µT (installation limit)'], ['Beurteilungspegel Lr Nacht (inkl. K1, K2)', 'Rating level Lr night (incl. K1, K2)'], ['Bereich zwischen Waldabstandslinie und Wald', 'Area between forest distance line and forest'], ['Parzelle 2301', 'Parcel 2301'], ['nicht erfüllt', 'not met'], ['erfüllt', 'met'], ['kritisch', 'critical'], ['Überlandstrasse', 'Überlandstrasse'], ['Ladung', 'charging'], ['Laden', 'Charging'], ['Entladen', 'Discharging'], ['Bezug', 'Import'], ['Kabelweg zum Netzanschlusspunkt', 'Cable route to grid connection point']];
TR_EN.sort((a, b) => b[0].length - a[0].length);
function tr(h) { if (!LANG_EN || typeof h !== 'string') return h; let o = h; for (const [a, b] of TR_EN) o = o.split(a).join(b); return o; }
function makeLabel(html, cls, x, y, z, parent = labelGroup) { const d = document.createElement('div'); d.className = cls; d.innerHTML = tr(html); const o = new CSS2DObject(d); o.position.set(x, y, z); parent.add(o); return o; }
function buildOverlays(V) {
  clearGroup(ovlGroup); dimObjs = [];
  const zones = new THREE.Group(); zones.name = 'zones'; ovlGroup.add(zones); const lg = SCENE.legal;
  for (const l of lg.waldgrenze || []) zones.add(lineOnGround(l, 0x16a34a, 0.4, false, 0.6));
  for (const l of lg.wal || []) zones.add(lineOnGround(l, 0x00b7d0, 0.4, false, 0.6));
  for (const l of lg.parcel || []) zones.add(lineOnGround(l.concat([l[0]]), 0xf2c200, 0.3, true));
  if (lg.wal && lg.waldgrenze) { const wal = lg.wal[0].filter(p => p[1] > -90 && p[1] < 115), wg = lg.waldgrenze[0].filter(p => p[1] > -90 && p[1] < 115); if (wal.length > 1 && wg.length > 1) { const sortZ = (a) => a.slice().sort((p, q) => p[1] - q[1]); zones.add(areaOnGround(sortZ(wal).concat(sortZ(wg).reverse()), 0xdc2626, 0.09, 0.25, 2)); } }
  makeLabel('Waldabstandslinie', 'dim info', -24, groundAt(-24, -45) + 2, -45, zones).element.style.background = 'rgba(0,150,175,.92)';
  makeLabel('Statische Waldgrenze', 'dim ok', 33, groundAt(33, -35) + 2, -35, zones);
  const dimsG = new THREE.Group(); dimsG.name = 'dims'; ovlGroup.add(dimsG); const Lp = V.layout;
  const addDim = (a, b, text, status, yy = null) => { const ya = yy ?? Math.max(groundAt(a[0], a[1]), groundAt(b[0], b[1])) + 1.2; const A = V3(a[0], ya, a[1]), B = V3(b[0], ya, b[1]); const col = STC[status] || STC.info; const d = B.clone().sub(A); const L = d.length(); if (L < 0.05) return; const dn = d.clone().normalize();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, L, 6), new THREE.MeshBasicMaterial({ color: col, depthTest: false })); cyl.position.copy(A.clone().add(B).multiplyScalar(0.5)); cyl.quaternion.setFromUnitVectors(V3(0, 1, 0), dn); cyl.renderOrder = 10; dimsG.add(cyl);
    for (const [P0, s] of [[A, -1], [B, 1]]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 10), new THREE.MeshBasicMaterial({ color: col, depthTest: false })); c.position.copy(P0.clone().add(dn.clone().multiplyScalar(-s * 0.27))); c.quaternion.setFromUnitVectors(V3(0, 1, 0), dn.clone().multiplyScalar(s)); c.renderOrder = 10; dimsG.add(c);
      const tick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 4), new THREE.MeshBasicMaterial({ color: col })); tick.position.set(P0.x, P0.y - 0.6, P0.z); dimsG.add(tick); }
    dimObjs.push(makeLabel(text, 'dim ' + (status || 'info'), (A.x + B.x) / 2, ya + 0.6, (A.z + B.z) / 2, dimsG)); };
  for (const d of V.dims) { if (!isFinite(d.d) || !d.a || d.d > 90) continue; addDim(d.a, d.b, `${d.label}: ${d.d.toFixed(1)} m${d.limit ? ` (Soll ${d.limit} m)` : ''}`, d.status); }
  for (const r of Lp.rows) { const other = Lp.rows.filter(q => q.field === r.field && q !== r && q.v0 > r.v1).sort((a, b) => a.v0 - b.v0)[0]; if (!other) continue; const u = (Math.max(r.uA, other.uA) + Math.min(r.uB, other.uB)) / 2; const f = r.frame, o = r.origin; const P = (uu, vv) => [o[0] + f.u[0] * uu + f.v[0] * vv, o[1] + f.u[1] * uu + f.v[1] * vv];
    const gap = other.v0 - r.v1; const need = r.facing === 1 ? V.P.layout.frontAisle : V.P.layout.backGap; addDim(P(u, r.v1), P(u, other.v0), `${r.facing === 1 ? 'Wartungsgasse' : 'Rückabstand'} ${gap.toFixed(2)} m`, gap >= need - 0.01 ? 'ok' : 'fail', fieldY(V.earth, r.field, 0) + 2.9); }
  if (Lp.ps) { let best = null, bd = 1e9; for (const o of Lp.objects) if (o.type === 'battery_cabinet') { const r = EN.minDist(o.poly, Lp.ps.poly); if (r[0] < bd) { bd = r[0]; best = r; } } if (best) addDim(best[1], best[2], `Schrank - Power Station ${bd.toFixed(2)} m`, bd >= V.P.layout.psClear - 0.01 ? 'ok' : 'fail', fieldY(V.earth, Lp.ps.field, 0) + 3.4); }
  for (const r of Lp.rows) for (let g = 1; g < r.groups.length; g++) { const a = Lp.objects.find(o => o.id === r.groups[g - 1].slice(-1)[0]), b = Lp.objects.find(o => o.id === r.groups[g][0]); const t = [b.c[0] - a.c[0], b.c[1] - a.c[1]]; const l = Math.hypot(...t); const u = [t[0] / l, t[1] / l]; const gap = l - V.P.cab.w; addDim([a.c[0] + u[0] * V.P.cab.w / 2, a.c[1] + u[1] * V.P.cab.w / 2], [b.c[0] - u[0] * V.P.cab.w / 2, b.c[1] - u[1] * V.P.cab.w / 2], `Brandabstand ${gap.toFixed(1)} m`, gap >= V.P.layout.fireGap - 0.01 ? 'ok' : 'fail', fieldY(V.earth, r.field, 0) + 2.75); break; }
  setVis(dimsG, LAYERS.dims); setVis(zones, LAYERS.zones);
  if (V.nisv && V.layout.ps) { const g = V.nisv; const tex = gridTexture(g, (b) => { if (b < 0.1) return [0, 0, 0, 0]; const t = clamp(Math.log10(b / 0.1) / 2.5, 0, 1); const c = new THREE.Color().setHSL(0.66 - 0.66 * t, 0.9, 0.5); return [c.r * 255, c.g * 255, c.b * 255, 90 + 120 * t]; }); const size = (g.n - 1) * g.step;
    const grp = new THREE.Group(); grp.name = 'nisvG'; grp.add(drapeTexture(tex, g.x0 - g.step / 2, g.z0 - g.step / 2, size + g.step, 60, 0.25, 0.85)); grp.add(segsToLines(contour(g, 1.0), 0xff0040, 0.4));
    const ps = V.layout.ps; makeLabel(`1-µT-Linie (Anlagegrenzwert NISV)<small>max. ${g.r1.toFixed(1)} m ab Power Station, keine OMEN innerhalb</small>`, 'lbl', ps.c[0] + g.r1 * 0.7, groundAt(ps.c[0], ps.c[1]) + 3, ps.c[1] + g.r1 * 0.7, grp); setVis(grp, LAYERS.nisv); ovlGroup.add(grp); }
  { const ng = EN.noiseGrid(V.layout, V.P, 'night', { R: 200, step: 4 }); const bands = [[30, [120, 200, 120]], [35, [80, 180, 80]], [40, [200, 220, 60]], [45, [250, 190, 40]], [50, [245, 120, 30]], [55, [220, 40, 40]], [60, [150, 20, 90]]];
    const tex = gridTexture(ng, (L) => { if (L < 30) return [0, 0, 0, 0]; let c = bands[0][1]; for (const [v, col] of bands) if (L >= v) c = col; return [...c, 150]; }); const size = (ng.n - 1) * ng.step;
    const grp = new THREE.Group(); grp.name = 'noiseG'; grp.add(drapeTexture(tex, ng.x0 - ng.step / 2, ng.z0 - ng.step / 2, size + ng.step, 100, 0.3, 0.7)); for (const lv of [40, 45, 50, 55]) grp.add(segsToLines(contour(ng, lv), lv >= 50 ? 0xb91c1c : 0x7c4a03, 0.45));
    for (const r of SITE.receptors) { const n = V.noise.find(x => x.r.id === r.id)?.n; if (!n) continue; const ok = n.night.lr <= n.pw[1] && n.day.lr <= n.pw[0]; makeLabel(`${r.name}<small>Lr Tag ${n.day.lr.toFixed(0)} / Nacht ${n.night.lr.toFixed(0)} dB(A) | PW ${n.pw[0]} / ${n.pw[1]} (ES ${r.es})</small>`, 'lbl', r.x, groundAt(r.x, r.z) + 6, r.z, grp).element.style.background = ok ? 'rgba(4,120,87,.9)' : 'rgba(220,38,38,.92)'; }
    setVis(grp, LAYERS.noise); ovlGroup.add(grp); }
}
function setLayer(k, v) { LAYERS[k] = v; const map = { dims: 'dims', zones: 'zones', nisv: 'nisvG', noise: 'noiseG' }; if (map[k]) { const o = ovlGroup.getObjectByName(map[k]); if (o) setVis(o, v); } if (k === 'labels') setVis(labelGroup, v); if (k === 'flows') for (const f of flows) f.mesh.visible = v; if (k === 'cables') { const r = bessGroup.getObjectByName('mvRibbon'); if (r) r.visible = v; } renderLayerButtons(); updateLegend(); }
// ------------------------------------------------------------------ Energieflüsse
const flowGeo = new THREE.SphereGeometry(0.22, 8, 6);
function makeFlow(key, pts3, color, lift = 0.9) { const curve = new THREE.CatmullRomCurve3(pts3.map(p => V3(p[0], p[1] + lift, p[2])), false, 'centripetal'); const L = curve.getLength(); const n = Math.max(6, Math.round(L / 3)); const mesh = new THREE.InstancedMesh(flowGeo, new THREE.MeshBasicMaterial({ color, toneMapped: false }), n); mesh.frustumCulled = false; mesh.visible = LAYERS.flows; scene.add(mesh); const f = { key, curve, L, n, mesh, off: 0 }; flows.push(f); return f; }
const poly3 = (pl) => pl.map(p => [p[0], groundAt(p[0], p[1]), p[1]]);
function buildFlows(V) { for (const f of flows) { scene.remove(f.mesh); f.mesh.dispose(); } flows = [];
  const L = V.layout; if (!L.ps) return; const nap = [SITE.nap.x, SITE.nap.z];
  makeFlow('mv', poly3(L.mv.pts), 0x7dd3fc, 0.6); for (const t of L.trays) makeFlow('dc', poly3(t.pts), 0x34d399, 0.7);
  const ul = ROAD_PATHS.find(r => r.kind === 'UL'); if (ul) { const pts = ul.pts.map(p => [p[0], p[1]]); let best = 0, bd = 1e9; pts.forEach((p, i) => { const d = Math.hypot(p[0] - nap[0], p[1] - nap[1]); if (d < bd) { bd = d; best = i; } }); const seg = pts.slice(best, Math.min(pts.length, best + 30)).map(p => [p[0] + 5, p[1] + 5]); seg.unshift(nap); if (seg.length > 2) makeFlow('grid', poly3(seg), 0x60a5fa, 1.0); }
  for (const [k, p] of [['brech', [-155, -91]], ['wasch', [-71, -96]], ['asph', [-106, 44]]]) makeFlow('load_' + k, poly3([nap, [nap[0] - 22, nap[1] - 6], [lerp(nap[0], p[0], 0.55) - 8, lerp(nap[1], p[1], 0.55)], p]), 0xfbbf24, 0.8); }
const _m4 = new THREE.Matrix4(), _p = new THREE.Vector3();
function updateFlows(dt, P) { for (const f of flows) { const pw = P[f.key] ?? 0; const a = Math.abs(pw); f.mesh.visible = LAYERS.flows && a > 5; if (!f.mesh.visible) continue; const sp = clamp(a / 400, 0.4, 6) * 4 * Math.sign(pw || 1); f.off = ((f.off + sp * dt / f.L) % 1 + 1) % 1; const sc = clamp(0.55 + a / 2500, 0.55, 1.7);
  for (let i = 0; i < f.n; i++) { const u = (i / f.n + f.off) % 1; f.curve.getPointAt(u, _p); _m4.makeScale(sc, sc, sc).setPosition(_p); f.mesh.setMatrixAt(i, _m4); } f.mesh.instanceMatrix.needsUpdate = true;
  if (f.key === 'mv' || f.key === 'dc') f.mesh.material.color.setHex(pw >= 0 ? 0x34d399 : 0x7dd3fc); } }
function buildLabels(V) { clearGroup(labelGroup); const L = V.layout; const lab = (html, x, z, dy = 6) => makeLabel(html, 'lbl', x, groundAt(x, z) + dy, z);
  const AGG = new URLSearchParams(location.search).has('agg');
  if (AGG) { const cs = L.fields.map(f => EN.centroid(f.poly)); const cx = cs.reduce((a, c) => a + c[0], 0) / cs.length, cz = cs.reduce((a, c) => a + c[1], 0) / cs.length; lab(`Batteriespeicher NRG Solution<small>${L.nCab} Schränke | ${fmt(L.E_kWh / 1000, 1)} MWh | ${fmt(L.P_kW / 1000, 2)} MW</small><small id="lpPS"></small>`, cx, cz, 9); }
  else for (const f of L.fields) { const c = EN.centroid(f.poly); const n = L.objects.filter(o => o.field === f.id && o.type === 'battery_cabinet').length; lab(`${f.id}<small>${fmt(f.area)} m² | ${n} Schränke | ${fmt(n * V.P.cab.kWh / 1000, 2)} MWh</small>`, c[0], c[1], 7.5); }
  if (L.ps && !AGG) lab(`Power Station ${L.psSpec.id}<small>${L.psSpec.sMVA} MVA | 16 kV / ${L.psSpec.ulv} V</small><small id="lpPS"></small>`, L.ps.c[0], L.ps.c[1], 7);
  lab(`Netzanschlusspunkt 16 kV<small id="lpNAP"></small>`, SITE.nap.x, SITE.nap.z, 6);
  lab('Brech- und Siebanlage<small id="lpB"></small>', -150, -70, 24); lab('Asphaltmischwerk Asfatop<small id="lpA"></small>', -106, 44, 37); lab('Kieswäsche<small id="lpW"></small>', -71, -96, 19);
  lab('Wald Unterer Tannwalding', 70, -10, 28); lab('Golfclub Unterengstringen', -262, 42, 10); lab('Autohandel', 30, 140, 6); lab('Überlandstrasse', -150, 150, 4); lab('Limmat', -260, 405, 3);
  setVis(labelGroup, LAYERS.labels); }

// ------------------------------------------------------------------ Panels
function variantList() { const v = [{ id: 'A', name: 'Variante A: 3 Baufelder (wie eingezeichnet)', V: RES }]; for (const x of RES.variants) v.push({ id: x.id, name: x.name, V: { ...x, P: RES.P } }); return v; }
function currentV() { return variantList().find(v => v.id === curVar)?.V || RES; }
function selectVariant(id) { curVar = id; renderVariantSeg(); buildBESS(currentV()); recalcSim(); }
function renderVariantSeg() { const s = $('#varSeg'); s.innerHTML = ''; for (const v of variantList()) { const b = document.createElement('button'); b.textContent = v.id === 'A' ? 'Variante A' : v.id === 'A2' ? 'A2 Hangfuss' : 'Variante B'; b.title = v.name; if (v.id === curVar) b.classList.add('on'); b.onclick = () => { selectVariant(v.id); focusOn(v.id === 'B' ? [-88, 67] : [0, 0], 95); }; s.appendChild(b); } }
let SIM = null;
function recalcSim() { SIM = EN.simulate(currentV().layout, RES.P, PARAMS.ops); drawChart(); updateSimTable(); }
function slider(k, label, a, b, s, u) { const v = PARAMS.layout[k] ?? RES.P.layout[k]; return `<div class="row"><label>${label}</label><span><input data-p="${k}" data-u="${u ? ' ' + u : ''}" type="range" min="${a}" max="${b}" step="${s}" value="${v}"> <span class="mono">${v}${u ? ' ' + u : ''}</span></span></div>`; }
function renderPanels() { const V = currentV(); if (!V) return; const L = V.layout; const P = RES.P;
  const totA = L.fields.reduce((s, f) => s + f.area, 0); const cnt = { ok: 0, warn: 0, fail: 0 }; V.checks.forEach(c => cnt[c.status] = (cnt[c.status] || 0) + 1);
  $('#leftBody').innerHTML = `
  <div class="sec">Dimensionierung aus Fläche</div>
  <div class="kpis"><div class="kpi"><b>${fmt(L.P_kW / 1000, 2)} MW</b><span>Leistung (Power Station ${L.psSpec.id})</span></div><div class="kpi"><b>${fmt(L.E_kWh / 1000, 1)} MWh</b><span>Energie brutto (${fmt(L.Euse_kWh / 1000, 1)} nutzbar)</span></div>
  <div class="kpi"><b>${L.nCab}</b><span>Batterieschränke a ${fmt(P.cab.kWh)} kWh</span></div><div class="kpi"><b>${fmt(L.E_kWh / Math.max(1, L.P_kW), 1)} h</b><span>Speicherdauer bei Nennleistung</span></div></div>
  <table class="t"><tr><td>Feldfläche total (aus Luftbild)</td><td>${fmt(totA)} m2</td></tr>${L.fields.map(f => `<tr><td>${f.id}</td><td>${fmt(f.area)} m2</td></tr>`).join('')}
  <tr><td>Energiedichte bezogen auf Feld</td><td>${fmt(L.E_kWh / totA, 1)} kWh/m2</td></tr><tr><td>MS-Kabel zum NAP</td><td>${L.mv ? fmt(L.mv.len) : '-'} m</td></tr>${V.earth.map(e => `<tr><td>${e.field}: Planum / Stützhöhe</td><td>${e.planumAbs.toFixed(1)} / ${e.wallH.toFixed(1)} m</td></tr>`).join('')}</table>
  <div class="sec">Layoutregeln (live neu berechnet)</div>
  ${slider('frontAisle', 'Wartungsgasse', 1.2, 3.0, 0.1, 'm')}${slider('fireGap', 'Brandabstand Gruppen', 1.0, 6.0, 0.25, 'm')}${slider('groupMax', 'Schränke je Gruppe', 2, 10, 1, '')}${slider('psClear', 'Abstand zur Power Station', 1.5, 6, 0.25, 'm')}${slider('fenceClear', 'Abstand zum Zaun', 0.6, 3, 0.1, 'm')}
  <div class="sec">Peak Shaving und netzdienlicher Betrieb</div>
  <canvas id="chart" width="600" height="300"></canvas>
  <div class="row"><label>Peak-Shaving-Grenze am NAP</label><span><input id="thr" type="range" min="600" max="2400" step="50" value="${PARAMS.ops.target_kW ?? P.ops.target_kW}"> <span class="mono" id="thrV">${fmt(PARAMS.ops.target_kW ?? P.ops.target_kW)} kW</span></span></div>
  <div class="row"><label>Netzdienlich nach Signal VNB</label><input id="gridMode" type="checkbox" ${(PARAMS.ops.grid_mode ?? true) ? 'checked' : ''}></div>
  <table class="t" id="simT"></table>
  <div class="sec">Live</div><table class="t" id="liveT"></table>
  <p class="hint">Projekt fiktiv. Geodaten: SWISSIMAGE 2025, swissALTI3D, swissSURFACE3D (swisstopo), OEREB-Kataster und Gewässerschutzkarte Kanton Zürich. Lastgang Kieswerk und Netzsignal sind modelliert (Annahmen).</p>`;
  const alt = RES.variants.length && curVar === 'A' ? `<div class="chk warn" id="altHint"><div class="h"><span class="dot warn"></span>Automatischer Alternativvorschlag (anklicken)</div><div class="m">${RES.variants.map(v => `${v.name}: ${fmt(v.layout.P_kW / 1000, 2)} MW / ${fmt(v.layout.E_kWh / 1000, 1)} MWh, ${v.checks.filter(c => c.status === 'fail').length} nicht erfüllt`).join('<br>')}</div></div>` : '';
  $('#rightBody').innerHTML = `<div class="sum"><div class="ok"><b>${cnt.ok}</b>erfüllt</div><div class="warn"><b>${cnt.warn}</b>kritisch</div><div class="fail"><b>${cnt.fail}</b>nicht erfüllt</div></div>
   <p class="hint"><b>${V.name || 'Variante A: drei Baufelder gemäss Luftbild des Kunden'}</b>${V.hinweis ? '<br>' + V.hinweis : ''}</p>${alt}
   ${V.checks.map((c, i) => `<div class="chk ${c.status}" data-i="${i}"><div class="h"><span class="dot ${c.status}"></span>${c.title}</div><div class="m">${c.measured}</div><div class="d"><p><b>Grundlage:</b> ${c.norm}</p><p><b>Anforderung:</b> ${c.limit}</p><p><b>Begründung:</b> ${c.reason}</p><p><b>Massnahme / Alternative:</b> ${c.measure}</p></div></div>`).join('')}`;
  document.querySelectorAll('#rightBody .chk[data-i]').forEach(el => el.onclick = () => { el.classList.toggle('open'); focusCheck(V.checks[+el.dataset.i]); });
  const ah = $('#altHint'); if (ah) ah.onclick = () => { selectVariant(RES.variants.find(v => v.id === 'B') ? 'B' : RES.variants[0].id); focusOn([-88, 67], 95); };
  document.querySelectorAll('#leftBody input[data-p]').forEach(inp => inp.oninput = () => { PARAMS.layout[inp.dataset.p] = +inp.value; inp.nextElementSibling.textContent = inp.value + inp.dataset.u; clearTimeout(window.__rt); window.__rt = setTimeout(recompute, 300); });
  $('#thr').oninput = (e) => { PARAMS.ops.target_kW = +e.target.value; PARAMS.ops.targetSet = true; $('#thrV').textContent = fmt(+e.target.value) + ' kW'; clearTimeout(window.__st); window.__st = setTimeout(recalcSim, 120); };
  $('#gridMode').onchange = (e) => { PARAMS.ops.grid_mode = e.target.checked; recalcSim(); };
  drawChart(); updateSimTable(); }
function recompute() { RES = EN.computeAll(SCENE, SITE, { layout: PARAMS.layout, ops: PARAMS.ops }, heightAt0, { treeH: TREE_H }); if (curVar !== 'A' && !RES.variants.find(v => v.id === curVar)) curVar = 'A'; renderVariantSeg(); buildBESS(currentV()); recalcSim(); }
function updateSimTable() { const t = $('#simT'); if (!SIM || !t) return; const lp = RES.P.ops.lp_chf || 8.95;
  t.innerHTML = `<tr><td>Höchste 15-min-Leistung ohne BESS</td><td>${fmt(SIM.peakNo)} kW</td></tr><tr><td>mit BESS am NAP</td><td>${fmt(SIM.peakWith)} kW</td></tr><tr><td>Spitzenreduktion</td><td>${fmt(SIM.peakNo - SIM.peakWith)} kW</td></tr>
  <tr><td>Entladen / Laden pro Tag</td><td>${fmt(SIM.eDis / 1000, 1)} / ${fmt(SIM.eCh / 1000, 1)} MWh</td></tr><tr><td>Vollzyklen pro Tag</td><td>${fmt(SIM.cycles, 2)}</td></tr><tr><td>Leistungstarif-Effekt (EKZ Netz 16L, 8.95 CHF/kW Mt)</td><td>${fmt((SIM.peakNo - SIM.peakWith) * lp)} CHF/Mt</td></tr>`; }
function drawChart(tMin = null) { const cv = $('#chart'); if (!cv || !SIM) return; const g = cv.getContext('2d'); const w = cv.width, h = cv.height; g.clearRect(0, 0, w, h); const pad = 40; const N = 1440;
  let mx = 500, mn = 0; for (const a of [SIM.napNo, SIM.nap, SIM.pb]) for (let i = 0; i < N; i++) { if (a[i] > mx) mx = a[i]; if (a[i] < mn) mn = a[i]; } mx *= 1.1; mn *= 1.1; const X = (m) => pad + (w - pad - 8) * m / N, Y = (v) => h - 24 - (h - 36) * (v - mn) / (mx - mn);
  for (let m = 0; m < N; m++) { const s = SIM.prof.sig[m]; if (!s) continue; g.fillStyle = s > 0 ? 'rgba(220,38,38,.08)' : 'rgba(37,99,235,.08)'; g.fillRect(X(m), 8, X(m + 1) - X(m) + 0.5, h - 32); }
  g.strokeStyle = '#E6E9F0'; g.lineWidth = 1; g.font = '18px IBM Plex Mono, monospace'; g.fillStyle = '#7C879E';
  for (let v = Math.ceil(mn / 1000) * 1000; v <= mx; v += 1000) { g.beginPath(); g.moveTo(pad, Y(v)); g.lineTo(w - 8, Y(v)); g.stroke(); g.fillText((v / 1000).toFixed(0) + ' MW', 0, Y(v) + 5); }
  for (let hh = 0; hh <= 24; hh += 6) g.fillText(String(hh).padStart(2, '0') + ':00', X(hh * 60) - 22, h - 4);
  const line = (arr, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); for (let m = 0; m < N; m += 2) { const x = X(m), y = Y(arr[m]); m ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); };
  line(SIM.napNo, '#9aa3b2', 2); line(SIM.pb, '#047857', 2.4); line(SIM.nap, '#0A2463', 3.4);
  const thr = ((PARAMS.ops.season || 'sommer') === 'winter' && !PARAMS.ops.targetSet) ? RES.P.ops.target_winter_kW : (PARAMS.ops.target_kW ?? RES.P.ops.target_kW); g.strokeStyle = '#dc2626'; g.setLineDash([8, 6]); g.lineWidth = 2; g.beginPath(); g.moveTo(pad, Y(thr)); g.lineTo(w - 8, Y(thr)); g.stroke();
  g.strokeStyle = '#1E56A0'; g.lineWidth = 2; g.setLineDash([3, 4]); g.beginPath(); for (let m = 0; m < N; m += 4) { const y = 8 + (h - 32) * (1 - SIM.soc[m]); m ? g.lineTo(X(m), y) : g.moveTo(X(m), y); } g.stroke(); g.setLineDash([]);
  if (tMin != null) { g.strokeStyle = '#0B1526'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(tMin), 8); g.lineTo(X(tMin), h - 24); g.stroke(); }
  g.font = 'bold 17px Instrument Sans, sans-serif'; [['NAP mit BESS', '#0A2463'], ['ohne BESS', '#9aa3b2'], ['BESS (+ entladen)', '#047857'], ['SOC', '#1E56A0'], ['Grenze', '#dc2626']].reduce((x, [t, c]) => { g.fillStyle = c; g.fillText(t, x, 24); return x + g.measureText(t).width + 16; }, pad + 4); }
let lastDt = 0.016;
function updateLive(m) { if (!SIM) return; const pr = SIM.prof; const pb = SIM.pb[m], nap = SIM.nap[m], soc = SIM.soc[m];
  const t = $('#liveT'); if (t && (m % 2 === 0 || !t.innerHTML)) t.innerHTML = `<tr><td>Kieswerk gesamt</td><td>${fmt(pr.load[m])} kW</td></tr><tr><td>Brech- und Siebanlage</td><td>${fmt(pr.brech[m])} kW</td></tr><tr><td>Kieswäsche</td><td>${fmt(pr.wasch[m])} kW</td></tr><tr><td>Asphaltmischwerk</td><td>${fmt(pr.asph[m])} kW</td></tr>
   <tr><td>Batterie ${pb >= 0 ? 'entlädt' : 'lädt'}</td><td>${fmt(Math.abs(pb))} kW</td></tr><tr><td>Ladezustand</td><td>${fmt(soc * 100)} %</td></tr><tr><td>Bezug am NAP</td><td>${fmt(nap)} kW</td></tr><tr><td>Netzsignal VNB</td><td>${pr.sig[m] > 0 ? 'Hochlast: entladen' : pr.sig[m] < 0 ? 'Schwachlast: laden' : 'neutral'}</td></tr>`;
  const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = tr(v); };
  s('lpPS', `${pb >= 0 ? 'Entladen' : 'Laden'} ${fmt(Math.abs(pb))} kW | SOC ${fmt(soc * 100)} %`); s('lpNAP', `Bezug ${fmt(nap)} kW`); s('lpB', `${fmt(pr.brech[m])} kW`); s('lpA', `${fmt(pr.asph[m])} kW`); s('lpW', `${fmt(pr.wasch[m])} kW`);
  updateFlows(lastDt, { mv: pb, dc: pb, grid: nap, load_brech: pr.brech[m], load_wasch: pr.wasch[m], load_asph: pr.asph[m] });
  M.led.emissive.setHex(Math.abs(pb) < 20 ? 0x18ff66 : pb > 0 ? 0xffb020 : 0x3da5ff); }
const LAYER_DEF = [['dims', 'Bemassung'], ['zones', 'Wald- und Rechtslinien'], ['nisv', 'NISV-Magnetfeld'], ['noise', 'Lärmkarte Nacht'], ['flows', 'Energiefluss'], ['cables', 'MS-Kabelweg'], ['labels', 'Beschriftung']];
function renderLayerButtons() { const c = $('#layers'); c.innerHTML = ''; for (const [k, n] of LAYER_DEF) { const b = document.createElement('button'); b.textContent = n; if (LAYERS[k]) b.classList.add('on'); b.onclick = () => setLayer(k, !LAYERS[k]); c.appendChild(b); } }
function updateLegend() { const lg = $('#legend'); let h = '';
  if (LAYERS.nisv) h += `<b>Magnetfeld 50 Hz, 1 m über Boden</b><div class="bar" style="background:linear-gradient(90deg,#3050ff,#30ffd0,#e8ff30,#ff8030,#ff2040)"></div><span>0.1 µT</span><span style="float:right">30 µT</span><br><span style="color:#ff0040">rote Linie: 1 µT (Anlagegrenzwert)</span><br>`;
  if (LAYERS.noise) h += `<b>Beurteilungspegel Lr Nacht (inkl. K1, K2)</b><div class="bar" style="background:linear-gradient(90deg,#78c878,#c8dc3c,#fabe28,#f5781e,#dc2828,#961459)"></div><span>30</span><span style="float:right">60 dB(A)</span><br>`;
  if (LAYERS.zones) h += `<span style="color:#16a34a">&#9632;</span> statische Waldgrenze &nbsp;<span style="color:#00b7d0">&#9632;</span> Waldabstandslinie<br><span style="color:#dc2626">&#9632;</span> Bereich zwischen Waldabstandslinie und Wald<br><span style="color:#c9a000">- -</span> Parzelle 2301<br>`;
  if (LAYERS.dims) h += `<span style="color:#16a34a">&#9632;</span> erfüllt &nbsp;<span style="color:#d97706">&#9632;</span> kritisch &nbsp;<span style="color:#dc2626">&#9632;</span> nicht erfüllt`;
  lg.innerHTML = tr(h); lg.style.display = h ? 'block' : 'none'; }

// ------------------------------------------------------------------ Kamera, Modi, Tour
let mode = 'orbit'; const camAnim = { active: false };
function flyTo(pos, target, dur = 1.6) { Object.assign(camAnim, { active: true, t: 0, dur, p0: camera.position.clone(), t0: orbit.target.clone(), p1: pos.clone(), t1: target.clone() }); }
function camFor(c, dist = 70, el = 38, az = -35) { const y = groundAt(c[0], c[1]); return [V3(c[0] + dist * Math.cos(el * DEG) * Math.sin(az * DEG), y + dist * Math.sin(el * DEG), c[1] + dist * Math.cos(el * DEG) * Math.cos(az * DEG)), V3(c[0], y, c[1])]; }
function focusOn(c, dist, el, az) { const [p, t] = camFor(c, dist, el, az); flyTo(p, t); }
function focusCheck(c) { const L = currentV().layout; const ctr = L.ps ? L.ps.c : [0, 0];
  const map = { NISV: () => { setLayer('nisv', true); focusOn(ctr, 55, 60); }, LSV: () => { setLayer('noise', true); focusOn([-120, 40], 430, 62, -10); }, WAL: () => { setLayer('zones', true); setLayer('dims', true); focusOn([8, 0], 85, 45, 215); }, WALDBRAND: () => { setLayer('zones', true); focusOn([20, 0], 70, 22, 250); }, BOESCHUNG: () => focusOn([5, 0], 60, 22, 240), 'BRAND-GEB': () => { setLayer('dims', true); focusOn([-25, 0], 60, 50); }, STRASSE: () => focusOn([-18, 5], 40, 30, -60), LOESCHWASSER: () => focusOn([-60, 60], 170, 55), RUECKHALT: () => focusOn(ctr, 40, 45), ALTLAST: () => focusOn([-100, -50], 320, 65), GRENZE: () => focusOn([40, 0], 120, 60) };
  (map[c.id] || (() => focusOn(ctr, 60, 38, -35)))(); }
function setMode(m) { mode = m; document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === m)); if (m !== 'tour') { tour.active = false; $('#caption').style.display = 'none'; }
  orbit.maxPolarAngle = m === 'plan' ? 0.001 : 88 * DEG;
  if (m === 'plan') { const c = currentV().layout.ps?.c || [0, 0]; flyTo(V3(c[0] - 10, 260, c[1] + 10.5), V3(c[0] - 10, 0, c[1] + 10), 1.2); }
  if (m === 'walk') { camera.position.set(-24, groundAt(-24, 12) + 1.7, 12); camera.lookAt(10, groundAt(10, 0) + 1.5, 0); plc.lock(); }
  if (m === 'tour') startTour(); }
const keys = {}; let walkFly = false; addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'KeyF' && mode === 'walk') walkFly = !walkFly; }); addEventListener('keyup', e => keys[e.code] = false);
plc.addEventListener('unlock', () => { if (mode === 'walk') setMode('orbit'); });
function updateWalk(dt) { const sp = (keys.ShiftLeft ? 9 : 3.5) * dt; const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize(); const r = V3(-f.z, 0, f.x); if (keys.KeyW) camera.position.addScaledVector(f, sp); if (keys.KeyS) camera.position.addScaledVector(f, -sp); if (keys.KeyA) camera.position.addScaledVector(r, -sp); if (keys.KeyD) camera.position.addScaledVector(r, sp); const g = groundAt(camera.position.x, camera.position.z) + 1.7; camera.position.y = walkFly ? Math.max(g, camera.position.y + ((keys.Space ? 1 : 0) - (keys.KeyC ? 1 : 0)) * sp * 2) : g; }
const tour = { active: false, i: 0, t: 0 };
const TOUR = [
  { c: [-120, -40], d: 540, el: 40, az: -30, h: 'Kieswerk Hardwald im Limmattal', b: 'Gesamtes Areal aus SWISSIMAGE 2025, swissALTI3D und swissSURFACE3D: Halden, Brech- und Siebanlage, Asphaltmischwerk, Hallen, Überlandstrasse, Golfclub und Limmat.' },
  { c: [0, 0], d: 95, el: 42, az: -40, h: 'Drei Baufelder am östlichen Rand', b: 'Die rot markierten Felder aus dem Kundenluftbild sind auf SWISSIMAGE georeferenziert. Flächen und Belegung berechnet der Rechenkern automatisch.' },
  { c: [2, -2], d: 32, el: 30, az: -60, h: 'Schrankreihen auf Streifenfundamenten', b: 'Gruppen mit max. 6 Schränken, Brandabstand 3 m, Wartungsgasse 2 m, DC-Kabelkanal zur Power Station.' },
  { k: 'ps', d: 18, el: 25, az: 40, h: 'Mittelspannungs-Power-Station auf Stahlskid', b: 'Zentralwechselrichter, 16-kV-Transformator mit Esteröl und Auffangwanne, MS-Schaltanlage.' },
  { c: [-50, 60], d: 140, el: 55, az: -20, h: 'Kabelweg zum Netzanschlusspunkt', b: 'MS-Kabel 16 kV im Rohrblock entlang der Werkstrasse bis zur neuen Übergabestation an der Überlandstrasse.' },
  { c: [15, 0], d: 80, el: 40, az: 220, h: 'Kernkonflikt Waldabstand', b: 'Die Felder liegen zwischen Waldabstandslinie (türkis) und Waldgrenze (grün). Ohne Ausnahmebewilligung nicht bewilligungsfähig.', layer: 'zones' },
  { c: [10, -5], d: 55, el: 16, az: 250, h: 'Böschung zur Waldterrasse', b: 'Planum auf Werkstrassenniveau verlangt Abtrag von Haldenmaterial und eine Stützkonstruktion am Waldrand.' },
  { k: 'ps', d: 60, el: 60, az: 0, h: 'NISV: 1-µT-Bereich', b: 'Biot-Savart-Berechnung der NS-Sammelschienen und MS-Kabel. Keine Orte mit empfindlicher Nutzung innerhalb der 1-µT-Linie.', layer: 'nisv' },
  { c: [-120, 40], d: 460, el: 62, az: -10, h: 'Lärmkarte Nacht', b: 'Beurteilungspegel inkl. Zuschläge K1 und K2 an Autohandel, Golfclub, Gewerbe und Wohnzone.', layer: 'noise' },
  { c: [-88, 67], d: 120, el: 45, az: -40, h: 'Automatische Alternative', b: 'Variante B auf dem Werkplatz westlich der Waldabstandslinie: gleiche Grössenordnung, ohne rote Punkte.', varB: true },
];
function startTour() { tour.active = true; tour.i = -1; nextTour(); }
function nextTour() { tour.i++; if (tour.i >= TOUR.length) { tour.active = false; setMode('orbit'); return; } const s = TOUR[tour.i]; tour.t = 0;
  if (s.varB && RES.variants.find(v => v.id === 'B')) selectVariant('B'); else if (tour.i === 0 && curVar !== 'A') selectVariant('A');
  setLayer('nisv', s.layer === 'nisv'); setLayer('noise', s.layer === 'noise'); if (s.layer === 'zones') setLayer('zones', true);
  focusOn(s.k === 'ps' ? currentV().layout.ps.c : s.c, s.d, s.el, s.az); const cap = $('#caption'); cap.innerHTML = `<b>${tour.i + 1}/${TOUR.length} | ${s.h}</b>${s.b}`; cap.style.display = 'block'; }
const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
renderer.domElement.addEventListener('click', (e) => { if (mode === 'walk') return; ndc.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(ndc, camera); const hits = ray.intersectObjects(pickables, false); if (!hits.length) { $('#info').style.display = 'none'; return; }
  const h = hits[0]; const inf = h.object.userData.info || {}; const V = currentV(); let t = inf.t, b = inf.b; const m = Math.floor(simT) % 1440;
  if (inf.cab) { const c = h.object.userData.cabs[h.instanceId]; const P = RES.P.cab; t = `Batterieschrank ${c.id} (${c.field}, Reihe ${c.row})`; b = `<table class="t"><tr><td>Typ</td><td>${P.name}</td></tr><tr><td>Energie</td><td>${P.kWh} kWh brutto</td></tr><tr><td>Abmessungen B x T x H</td><td>${P.w} x ${P.d} x ${P.h} m</td></tr><tr><td>Gewicht</td><td>${P.mass_t} t</td></tr><tr><td>Schutzart / Korrosion</td><td>${P.ip} / ${P.korrosion}</td></tr><tr><td>DC-Spannung</td><td>${P.udc}</td></tr><tr><td>Schallleistung Tag / Nacht</td><td>${P.lw_day} / ${P.lw_night} dB(A)</td></tr><tr><td>Ladezustand jetzt</td><td>${fmt(SIM.soc[m] * 100)} %</td></tr><tr><td>Leistung jetzt</td><td>${fmt(SIM.pb[m] / V.layout.nCab, 1)} kW</td></tr></table>`; }
  if (inf.ps) { const s = V.layout.psSpec; t = `Power Station ${s.id}`; b = `<table class="t"><tr><td>Bemessungsleistung</td><td>${s.sMVA} MVA</td></tr><tr><td>Spannung</td><td>16 kV / ${s.ulv} V</td></tr><tr><td>Abmessungen</td><td>${s.l} x ${s.w} x ${s.h} m</td></tr><tr><td>Gewicht</td><td>${s.mass_t} t</td></tr><tr><td>Isolierflüssigkeit Trafo</td><td>${s.oil_l} l Esteröl, Wanne 110 %</td></tr><tr><td>Schallleistung WR / Trafo / HVAC</td><td>${s.lw_inv} / ${s.lw_trafo} / ${s.lw_hvac} dB(A)</td></tr><tr><td>1-µT-Radius</td><td>${V.nisv ? fmt(V.nisv.r1, 1) : '-'} m</td></tr></table>`; }
  $('#infoT').textContent = t || 'Objekt'; $('#infoB').innerHTML = b || ''; $('#info').style.display = 'flex'; });
$('#infoX').onclick = () => $('#info').style.display = 'none';

// ------------------------------------------------------------------ Zeit, Sonne
let simT = +(Q.get('t') ?? 10.5) * 60, playing = !CAPTURE && !Q.has('pause'), speed = 120;
$('#tSlider').oninput = (e) => { simT = +e.target.value; }; $('#play').onclick = () => { playing = !playing; $('#play').textContent = playing ? 'Pause' : 'Start'; }; $('#speed').onchange = (e) => speed = +e.target.value;
$('#season').onchange = (e) => { PARAMS.ops.season = e.target.value; recalcSim(); updateSeason(); }; $('#dayType').onchange = (e) => { PARAMS.ops.day = e.target.value; recalcSim(); };
document.querySelectorAll('#modeSeg button').forEach(b => b.onclick = () => setMode(b.dataset.m));
$('#btnShot').onclick = () => { composer.render(); const a = document.createElement('a'); a.download = `nrg-bess-hardwald-${curVar}.png`; a.href = renderer.domElement.toDataURL('image/png'); a.click(); };
function updateSeason() { const win = (PARAMS.ops.season || 'sommer') === 'winter'; (win ? treeColsWinter : treeColsSummer).forEach((c, i) => treeD.setColorAt(i, c)); treeD.instanceColor.needsUpdate = true; }
let lastSunKey = '';
function updateSun(m) { const h = m / 60; const summer = (PARAMS.ops.season || 'sommer') === 'sommer'; const decl = (summer ? 21 : -15) * DEG, lat = 47.4 * DEG; const ha = (h - 13.0) * 15 * DEG;
  const el = Math.asin(Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha)); const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)); // az ab Süden, positiv nach Westen
  const dir = V3(-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  sun.position.copy(sun.target.position).addScaledVector(dir, 700); su.sunPosition.value.copy(dir); skyEnv.material.uniforms.sunPosition.value.copy(dir);
  const day = clamp((el / DEG + 4) / 14, 0, 1); sun.intensity = 3.0 * day; hemi.intensity = 0.1 + 0.5 * day; renderer.toneMappingExposure = lerp(0.9, 0.5, day); scene.fog.color.setHSL(0.6, 0.25, lerp(0.07, 0.84, day));
  const night = day < 0.25; bessGroup.traverse(o => { if (o.isSpotLight && o.userData.night) o.intensity = night ? 80 : 0; });
  const key = Math.round(m / 20); if (key !== lastSunKey) { lastSunKey = key; if (envRT) envRT.dispose(); envRT = pmrem.fromScene(skyEnvScene); scene.environment = envRT.texture; } }

// ------------------------------------------------------------------ Start
setL(80, 'Normenprüfung und Simulation ...');
const TREE_H = (() => { let mx = 0; for (const t of SCENE.trees) if (Math.abs(t[2]) < 60 && t[0] > 20 && t[0] < 60) mx = Math.max(mx, t[3]); return mx || 28; })();
if (Q.get('target')) PARAMS.ops.target_kW = +Q.get('target');
if (Q.get('season')) { PARAMS.ops.season = Q.get('season'); $('#season').value = Q.get('season'); }
RES = EN.computeAll(SCENE, SITE, { layout: PARAMS.layout, ops: PARAMS.ops }, heightAt0, { treeH: TREE_H });
if (curVar !== 'A' && !RES.variants.find(v => v.id === curVar)) curVar = 'A';
renderVariantSeg(); renderLayerButtons(); buildBESS(currentV()); recalcSim(); updateLegend(); updateSeason();
window.APP = { RES: () => RES, cur: () => currentV(), setVariant: selectVariant, setLayer, focusOn, camFor, setMode, setTime: (h) => { simT = h * 60; }, camera, orbit, V3, groundAt, ready: false, frames: 0 };
setL(100, 'bereit'); setTimeout(() => $('#loading').style.display = 'none', 200);
const cam = Q.get('cam'); if (cam) { const [x, y, z, tx, ty, tz] = cam.split(',').map(Number); camera.position.set(x, y, z); orbit.target.set(tx, ty, tz); orbit.update(); }
const fo = Q.get('focus'); if (fo) { const [x, z, d, el, az] = fo.split(',').map(Number); const [p, t] = camFor([x, z], d, el, az); camera.position.copy(p); orbit.target.copy(t); orbit.update(); }
if (Q.get('view') === 'plan') setMode('plan'); if (Q.get('mode') === 'tour') setMode('tour');
const clock = new THREE.Clock();
function frame() { const dt = Math.min(0.05, clock.getDelta()); lastDt = dt;
  if (playing) simT = (simT + dt * speed / 60) % 1440; const m = Math.floor(simT) % 1440; $('#tSlider').value = m; $('#clock').textContent = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  updateSun(simT); updateLive(m); if (m % 5 === 0 || !playing) drawChart(m);
  if (camAnim.active) { camAnim.t += dt / camAnim.dur; const k = camAnim.t >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * camAnim.t); camera.position.lerpVectors(camAnim.p0, camAnim.p1, k); orbit.target.lerpVectors(camAnim.t0, camAnim.t1, k); if (camAnim.t >= 1) camAnim.active = false; }
  if (mode === 'walk') updateWalk(dt); else orbit.update();
  if (tour.active) { tour.t += dt; if (tour.t > 8) nextTour(); }
  updateTraffic(dt); updateMachines(dt);
  if (labelGroup.visible) for (const o of labelGroup.children) { const d = camera.position.distanceTo(o.position); o.element.style.opacity = d > 950 ? 0 : d > 550 ? 0.65 : 1; }
  for (const o of dimObjs) o.visible = LAYERS.dims && camera.position.distanceTo(o.position) < 170;
  composer.render(); labelRenderer.render(scene, camera); window.APP.frames++; window.APP.ready = true; }
renderer.setAnimationLoop(frame);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); labelRenderer.setSize(innerWidth, innerHeight); });
