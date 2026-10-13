import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Loomi pod from LUM-9000-WIP-260930.STEP, finished per the Loomi Visualization Guide (10/02/2026).
// The CAD carries no UVs, so textiles are projected triplanar in world space at their real swatch sizes.
const $ = s => document.querySelector(s), viewport = $('#viewport');
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, .01, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
let pixelRatio = Math.min(devicePixelRatio, 1.5); renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false; // the pod is static, so shadows are baked once after load
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.appendChild(renderer.domElement);
renderer.domElement.setAttribute('aria-label', 'Loomi pod. Drag to orbit, scroll to zoom.');

const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
scene.environment = pmrem.fromScene(room, .04).texture; scene.environmentIntensity = .55; room.dispose(); pmrem.dispose();

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = .07; controls.minDistance = .5; controls.maxDistance = 8;
controls.maxPolarAngle = Math.PI * .52;

const key = new THREE.DirectionalLight('#fff8ee', 1.5); key.position.set(3, 6, 4.5); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2.5, bottom: -1 });
key.shadow.normalBias = .03; key.shadow.bias = -.0005; key.shadow.radius = 4; scene.add(key);
const hemi = new THREE.HemisphereLight('#ffffff', '#e4e0d8', .7); scene.add(hemi);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: .1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

// Stage colour follows the page theme.
let lightingReady = false;
function applyTheme() { if (lightingReady) applyLighting(true); else scene.background = new THREE.Color(getComputedStyle($('.stage')).getPropertyValue('--stage').trim() || '#eeece8'); }
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// ---------- Materials ----------
const loader = new THREE.TextureLoader(), aniso = renderer.capabilities.getMaxAnisotropy();
function tex(path, srgb) { const t = loader.load(path, () => { needsRender = true; }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }
function canvasTex(draw, size) {
  const c = document.createElement('canvas'); c.width = c.height = 512; draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return { d: t, size, url: c.toDataURL('image/jpeg', .8) };
}
const rng = seed => () => (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296;
const maple = canvasTex(x => { const r = rng(3); x.fillStyle = '#e8cfa6'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) { const y = r() * 512; x.strokeStyle = `rgba(${r() > .5 ? '150,110,70' : '255,245,225'},${.04 + r() * .07})`; x.lineWidth = .5 + r() * 1.4; x.beginPath();
    for (let k = 0; k <= 512; k += 8) { const yy = y + 4 * Math.sin(k * .012 + y * .03); k ? x.lineTo(k, yy) : x.moveTo(k, yy); } x.stroke(); } }, [.6, .6]);
const cork = canvasTex(x => { const r = rng(9); x.fillStyle = '#b48a5e'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${r() > .5 ? '90,58,32' : '222,186,140'},${.15 + r() * .35})`; x.beginPath(); x.arc(r() * 512, r() * 512, .6 + r() * 2.2, 0, 7); x.fill(); } }, [.25, .25]);
// Updated textile scans (mirrored repeat hides tile seams on scans that are not tileable).
// Normal maps for these scans are baked from their luminance offline (tex/*_normal.jpg).
function scan(path, size, tint) { const mirror = t => { t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; return t; };
  return { d: mirror(tex(path + '.jpg', 1)), n: mirror(tex(path + '_normal.jpg')), size, url: path + '.jpg', tint }; }
const T = {
  ochre: scan('tex/ochre_linen', [.2, .2], '#c8c2b8'),
  grey: scan('tex/grey_linen', [.14, .14], '#cfcfcf'),
  remix: { d: tex('tex/remix_diffuse.jpg', 1), n: tex('tex/remix_normal.jpg'), r: tex('tex/remix_roughness.jpg'), size: [.3923, .4263], url: 'tex/remix_diffuse.jpg' },
  divina173: { d: tex('tex/divina173.jpg', 1), size: [.18, .254], url: 'tex/divina173.jpg' },
  maple, cork,
};

function textile(t, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color: t.tint || '#ffffff', roughness: 1, metalness: 0, side: THREE.DoubleSide, envMapIntensity: o.env ?? .6, emissive: '#000000' });
  const u = { tD: { value: t.d }, tN: { value: t.n || null }, tR: { value: t.r || null }, uSize: { value: new THREE.Vector2(...t.size) },
    uNormal: { value: o.normal ?? 1 }, uPleat: { value: o.pleat ? 1 : 0 }, uOut: { value: o.outward ? 1 : 0 }, uRough: { value: o.rough ?? 1 } };
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, u);
    s.vertexShader = 'varying vec3 vTriP; varying vec3 vTriN;\n' + s.vertexShader.replace('#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nvTriP=(modelMatrix*vec4(transformed,1.0)).xyz; vTriN=normalize(mat3(modelMatrix)*objectNormal);');
    s.fragmentShader = `varying vec3 vTriP; varying vec3 vTriN;
uniform sampler2D tD; uniform sampler2D tN; uniform sampler2D tR; uniform vec2 uSize; uniform float uNormal, uPleat, uOut, uRough;
vec3 triW(vec3 n){ vec3 w=pow(abs(n),vec3(4.)); return w/(w.x+w.y+w.z); }
vec4 tri(sampler2D t, vec3 p, vec3 w){ vec4 r=vec4(0.); if(w.x>.02) r+=texture2D(t,p.zy/uSize)*w.x; if(w.y>.02) r+=texture2D(t,p.xz/uSize)*w.y; if(w.z>.02) r+=texture2D(t,p.xy/uSize)*w.z; return r/max(w.x*step(.02,w.x)+w.y*step(.02,w.y)+w.z*step(.02,w.z),1e-4); }
// Exterior pleats: 18 soft vertical grooves around the shell.
float pleat(vec3 p){ float f=abs(fract(atan(p.z,p.x)*18./6.2832)-.5)*2.; return smoothstep(.0,.05,f); }
` + s.fragmentShader
      .replace('#include <map_fragment>', `vec3 Nw=normalize(vTriN); vec3 W=triW(Nw);
diffuseColor.rgb*=tri(tD,vTriP,W).rgb;
if(uPleat>.5) diffuseColor.rgb*=mix(.82,1.,pleat(vTriP));`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness * uRough;
#ifdef USE_TRI_R
roughnessFactor = clamp(roughnessFactor * (.86 + .14 * tri(tR,vTriP,W).g), 0., 1.);
#endif`)
      .replace('#include <normal_fragment_maps>', `#ifdef USE_TRI_N
{ vec3 Ns=Nw*faceDirection;
  if(uOut>.5&&dot(Ns.xz,vTriP.xz)<0.) Ns=-Ns; // shell skins always face out, whatever the CAD winding
  vec3 a=texture2D(tN,vTriP.zy/uSize).xyz*2.-1., b=texture2D(tN,vTriP.xz/uSize).xyz*2.-1., c=texture2D(tN,vTriP.xy/uSize).xyz*2.-1.;
  a.xy*=uNormal; b.xy*=uNormal; c.xy*=uNormal;
  vec3 nx=vec3(a.xy+Ns.zy,abs(a.z)*Ns.x).zyx, ny=vec3(b.xy+Ns.xz,abs(b.z)*Ns.y).xzy, nz=vec3(c.xy+Ns.xy,abs(c.z)*Ns.z);
  normal=normalize((viewMatrix*vec4(normalize(nx*W.x+ny*W.y+nz*W.z),0.)).xyz); }
#endif`);
    if (t.r) s.defines = { ...s.defines, USE_TRI_R: '' };
    if (t.n) s.defines = { ...s.defines, USE_TRI_N: '' };
  };
  return m;
}
const satin = c => new THREE.MeshPhysicalMaterial({ color: c, roughness: .45, clearcoat: .25, clearcoatRoughness: .5, side: THREE.DoubleSide });

// The guide's callouts. `key` matches the material slot baked into loomi.glb; `view` is where the camera goes.
const SPEC = [
  { group: 'Shell', items: [
    { key: 'Exterior', name: 'Exterior wall', fabric: 'Divina Melange 3 (120), pleated', code: '1213_C0120 · updated scan', sw: T.grey, mat: textile(T.grey, { pleat: true, normal: 1, outward: true }), view: 'spec' },
    { key: 'Base', name: 'Base', fabric: 'Divina Melange 3 (120)', code: '1213_C0120', sw: T.grey, mat: textile(T.grey, { normal: 1, outward: true }), view: 'rear' },
    { key: 'TopCap', name: 'Top cap', fabric: 'Satin plastic', code: 'Pantone 406 C', color: '#cfc7bf', mat: satin('#cfc7bf'), view: 'top' },
    { key: 'Mesh', name: 'Mesh', fabric: 'White mesh', code: 'Ceiling, lit from above', color: '#f6efe2', mat: new THREE.MeshStandardMaterial({ color: '#f6efe2', roughness: .9, emissive: '#ffe2b0', emissiveIntensity: .35, side: THREE.DoubleSide }), view: 'top' },
    { key: 'DoorFrame', name: 'Door frame', fabric: 'Satin plastic', code: 'Pantone 406 C', color: '#cfc7bf', mat: satin('#cfc7bf'), view: 'door' },
  ] },
  { group: 'Interior', items: [
    { key: 'Interior', name: 'Interior wall', fabric: 'Remix 3 (406)', code: '2968_C0406 · 39.2 × 42.6 cm', sw: T.remix, mat: textile(T.remix, { normal: .8 }), view: 'door' },
    { key: 'SeatBack', name: 'Seat back', fabric: 'Divina MD (433)', code: 'Updated scan', sw: T.ochre, mat: textile(T.ochre, { normal: 1 }), view: 'seat' },
    { key: 'SeatCushion', name: 'Seat cushion', fabric: 'Apparel (0423)', code: '13006_C0423 · updated scan', sw: T.ochre, mat: textile(T.ochre, { normal: 1 }), view: 'seat' },
    { key: 'CushionInsert', name: 'Cushion insert', fabric: 'Divina (173)', code: 'Scan supplied · size est. 18 × 25 cm', sw: T.divina173, mat: textile(T.divina173), view: 'seat' },
    { key: 'Floor', name: 'Floor', fabric: 'Cork', code: 'Natural cork', sw: T.cork, mat: textile(T.cork, { rough: .9 }), view: 'seat' },
  ] },
  { group: 'Workstation', items: [
    { key: 'Backboard', name: 'Backboard', fabric: 'Divina MD (433)', code: 'Updated scan', sw: T.ochre, mat: textile(T.ochre, { normal: 1 }), view: 'display' },
    { key: 'Bezel', name: 'Monitor bezel', fabric: 'Satin plastic, matches backboard', code: 'Camera integrated', color: '#c99550', mat: satin('#c99550'), view: 'display' },
    { key: 'SpeakerCover', name: 'Speaker cover', fabric: 'Soft acoustic fabric, matches exterior', code: '1213_C0120', sw: T.grey, mat: textile(T.grey), view: 'display' },
    { key: 'Desk', name: 'Desk', fabric: 'Maple wood', code: 'Half-round top on pedestal', sw: T.maple, mat: textile(T.maple, { rough: .55, env: 1 }), view: 'display' },
  ] },
];
const ITEMS = SPEC.flatMap(g => g.items), BY_KEY = Object.fromEntries(ITEMS.map(i => [i.key, i]));
ITEMS.forEach(i => { i.mat.name = `${i.name} · ${i.fabric}`; });

// ---------- Spec sheet ----------
const sheet = $('#sheet');
for (const g of SPEC) {
  const sec = document.createElement('section'); sec.className = 'group';
  sec.innerHTML = `<h3>${g.group}</h3>`;
  for (const i of g.items) {
    const b = document.createElement('button'); b.className = 'part'; b.dataset.key = i.key; b.setAttribute('aria-pressed', 'false');
    const sw = i.sw ? `url(${i.sw.url})` : i.color;
    b.innerHTML = `<i class="sw" style="--sw:${sw}"></i><div><b>${i.name}</b><span>${i.fabric}</span><span class="code">${i.code}</span></div>`;
    b.onclick = () => select(i.key);
    sec.append(b);
  }
  sheet.append(sec);
}

// ---------- Model ----------
const pod = new THREE.Group(); scene.add(pod);
// The pod's own ambient lighting: the glowing ceiling mesh plus a warm wash on the backboard.
const ceil = new THREE.PointLight('#ffd9a0', 1.1, 1.6, 1.6), glow = new THREE.PointLight('#ffcf8a', .5, .55, 1.6);
const meshesByKey = {};
let model = null;
new GLTFLoader().load('assets/loomi.glb', g => {
  model = g.scene;
  pod.position.y = -new THREE.Box3().setFromObject(model).min.y;
  model.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    const swap = m => { const i = BY_KEY[m.name]; if (i) (meshesByKey[i.key] ||= new Set()).add(o); return i ? i.mat : m; };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
  pod.add(model);
  // Loomi display sits in the bezel opening, facing the seat (-x).
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(.405, .238), new THREE.MeshBasicMaterial({ map: screenTexture(), toneMapped: false }));
  scr.rotation.y = -Math.PI / 2; scr.position.set(.3432, .5645, 0); scr.name = 'Loomi screen'; pod.add(scr);
  // Warm light from the ceiling mesh and a glow on the backboard, kept well inside the shell.
  ceil.position.set(0, 1.05, 0); glow.position.set(.22, .9, 0); pod.add(ceil, glow);
  pod.updateMatrixWorld(true); renderer.shadowMap.needsUpdate = true;
  $('#loading').remove(); needsRender = true; window.__podReady = true;
}, undefined, e => { $('#loading').textContent = 'The model could not load. Refresh the page to try again.'; console.error(e); });

function screenTexture() {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 1000; const x = c.getContext('2d');
  const g = x.createRadialGradient(800, 560, 40, 800, 560, 900); g.addColorStop(0, '#f6e48e'); g.addColorStop(1, '#ecd36f');
  x.fillStyle = g; x.fillRect(0, 0, 1600, 1000); x.fillStyle = '#fffdf4';
  x.font = '600 150px "Hanken Grotesk", Arial, sans-serif'; x.textBaseline = 'middle'; x.fillText('loomi', 690, 505);
  for (const [cx, cy] of [[600, 480], [640, 480], [600, 525], [640, 525]]) { x.beginPath(); x.arc(cx, cy, 25, 0, 7); x.fill(); }
  x.beginPath(); x.arc(668, 448, 13, 0, 7); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t;
}

// ---------- Views & selection ----------
const VIEWS = {
  three: { pos: [2.3, 1.6, 3.6], target: [0, .72, 0] },
  straight: { pos: [0, .95, 4.3], target: [0, .72, 0] },
  interior: { pos: [-.42, .86, 1.25], target: [.34, .62, -.02] },
  spec: { pos: [2.3, 1.6, 3.6], target: [0, .72, 0] },
  door: { pos: [-.42, .86, 1.25], target: [.34, .62, -.02] },
  display: { pos: [-.12, .9, .7], target: [.36, .68, 0] },
  seat: { pos: [.3, 1.45, 1.5], target: [-.28, .28, -.02] },
  rear: { pos: [-2.4, 1.5, -3.4], target: [0, .7, 0] },
  top: { pos: [1.2, 3.2, 2.2], target: [0, 1.1, 0] },
};
let tween = null, current = 'three', needsRender = true;
function fitFov() { camera.fov = camera.aspect < .75 ? 50 : 30; camera.updateProjectionMatrix(); }
function goTo(name, instant) {
  current = name; const v = VIEWS[name];
  const from = { p: camera.position.clone(), t: controls.target.clone() }, to = { p: new THREE.Vector3(...v.pos), t: new THREE.Vector3(...v.target) };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  tween = instant || reduce ? null : { from, to, t0: performance.now(), dur: 900 };
  if (!tween) { camera.position.copy(to.p); controls.target.copy(to.t); controls.update(); }
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === name));
}
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { select(null); goTo(b.dataset.view); });

// ---------- Lighting & ambient mode ----------
const meshMat = BY_KEY.Mesh.mat;
const LIGHT = {
  day: { key: ['#fff8ee', 1.5], hemi: .7, env: .55, exposure: 1.05, shadow: .1, interior: 1 },
  night: { key: ['#9fb2d6', .18], hemi: .07, env: .07, exposure: 1.15, shadow: .04, interior: 1.7 },
};
let lighting = 'day', ambient = true;
// Lighting changes blend over ~0.5 s: every light, the exposure and the stage colour ease from where they are to the new state.
const stateNow = () => ({ keyColor: key.color.clone(), key: key.intensity, hemi: hemi.intensity, env: scene.environmentIntensity, exposure: renderer.toneMappingExposure,
  shadow: ground.material.opacity, ceil: ceil.intensity, glow: glow.intensity, mesh: meshMat.emissiveIntensity, bg: (scene.background || new THREE.Color()).clone() });
let fade = null;
function targetState() {
  const L = LIGHT[lighting], on = ambient ? L.interior : 0;
  $('.stage').classList.toggle('night', lighting === 'night');
  return { keyColor: new THREE.Color(L.key[0]), key: L.key[1], hemi: L.hemi, env: L.env, exposure: L.exposure, shadow: L.shadow, ceil: 1.1 * on, glow: .5 * on,
    mesh: ambient ? (lighting === 'night' ? 1.1 : .35) : 0, bg: new THREE.Color(getComputedStyle($('.stage')).getPropertyValue('--stage').trim() || '#eeece8') };
}
function setState(a, b, e) {
  key.color.copy(a.keyColor).lerp(b.keyColor, e); scene.background = a.bg.clone().lerp(b.bg, e);
  const m = (x, y) => x + (y - x) * e;
  key.intensity = m(a.key, b.key); hemi.intensity = m(a.hemi, b.hemi); scene.environmentIntensity = m(a.env, b.env);
  renderer.toneMappingExposure = m(a.exposure, b.exposure); ground.material.opacity = m(a.shadow, b.shadow);
  ceil.intensity = m(a.ceil, b.ceil); glow.intensity = m(a.glow, b.glow); meshMat.emissiveIntensity = m(a.mesh, b.mesh);
}
function applyLighting(instant) {
  const to = targetState();
  needsRender = true;
  if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches) { fade = null; setState(to, to, 1); }
  else fade = { from: stateNow(), to, t0: performance.now(), dur: 500 };
  document.querySelectorAll('[data-light]').forEach(b => b.setAttribute('aria-pressed', b.dataset.light === lighting));
  $('#ambient-state').textContent = ambient ? 'On' : 'Off';
}
document.querySelectorAll('[data-light]').forEach(b => b.onclick = () => { lighting = b.dataset.light; applyLighting(); });
$('#ambient').onchange = e => { ambient = e.target.checked; applyLighting(); };
lightingReady = true; applyLighting(true);

const accent = new THREE.Color();
let selected = null, pulseStart = 0;
function select(key) {
  if (selected) BY_KEY[selected].mat.emissive?.set(selected === 'Mesh' ? '#ffe2b0' : '#000000');
  selected = key && key !== selected ? key : null;
  document.querySelectorAll('.part').forEach(b => b.setAttribute('aria-pressed', b.dataset.key === selected));
  needsRender = true;
  if (selected) { pulseStart = performance.now(); goTo(BY_KEY[selected].view); }
}

function resize() { const w = viewport.clientWidth, h = viewport.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; fitFov(); needsRender = true; }
new ResizeObserver(resize).observe(viewport); resize(); goTo('three', true);

$('#guide-open').onclick = () => $('#guide').showModal();
$('#guide-close').onclick = () => $('#guide').close();
$('#guide').onclick = e => { if (e.target === $('#guide')) $('#guide').close(); };

const ease = t => 1 - Math.pow(1 - t, 3);
renderer.setAnimationLoop(now => {
  if (tween) {
    const k = Math.min(1, (now - tween.t0) / tween.dur), e = ease(k);
    camera.position.lerpVectors(tween.from.p, tween.to.p, e); controls.target.lerpVectors(tween.from.t, tween.to.t, e);
    if (k === 1) tween = null;
  }
  if (fade) { const k = Math.min(1, (now - fade.t0) / fade.dur); setState(fade.from, fade.to, k * k * (3 - 2 * k)); if (k === 1) fade = null; }
  if (selected) { // a slow warm pulse marks every surface that uses the selected material
    const m = BY_KEY[selected].mat, s = .5 - .5 * Math.cos((now - pulseStart) / 420);
    accent.set(css('--accent') || '#a8722f').multiplyScalar(.45 * s); m.emissive?.copy(accent);
  }
  const moved = controls.update();
  // Draw only when something changed; a still pod costs nothing.
  if (moved || tween || fade || selected || needsRender) { renderer.render(scene, camera); needsRender = false; watchFrame(now); }
  else lastFrame = 0;
});
// If frames run slow, drop to 1× pixel ratio once; most of the cost is per-pixel shading.
let lastFrame = 0, slow = 0;
function watchFrame(now) {
  if (lastFrame && pixelRatio > 1) { slow = now - lastFrame > 24 ? slow + 1 : Math.max(0, slow - 1);
    if (slow > 20) { pixelRatio = 1; renderer.setPixelRatio(1); resize(); } }
  lastFrame = now;
}
window.__studio = { scene, camera, controls, renderer, select, goTo, setLighting: l => { lighting = l; applyLighting(); }, setAmbient: a => { ambient = a; $('#ambient').checked = a; applyLighting(); } };
