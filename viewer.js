import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** Shared app state (very small) */
export const App = {
  GRID: { tile:1, chunk:50, snapMode:'centers' },
  models: {}, activeModelId: null, modelIdCounter: 0,
  loaders: {}, // filled by loader.js
  ui: {},      // filled by panel modules
  events: new EventTarget()
};

let renderer, scene, camera, controls, pmremGen, envTex;
let gridHelper, majorLines, cursorCross, floorMesh;
const hud = () => document.getElementById('hud');

/** Expose some getters to other modules */
export const getScene = () => scene;
export const getCamera = () => camera;
export const getRenderer = () => renderer;

/** Utility */
const snapCoord = (v)=>{
  const t = App.GRID.tile;
  const offset = App.GRID.snapMode === 'centers' ? (0.5 * t) : 0.0;
  return Math.round((v - offset)/t)*t + offset;
};
const tileIndexFromWorld = (v)=> Math.round((v / App.GRID.tile) + (App.GRID.chunk * 0.5 - 0.5));
const updateHud = (x,z)=> { hud().textContent = `tile: (${tileIndexFromWorld(x)},${tileIndexFromWorld(z)}) • mode: ${App.GRID.snapMode} • world: (${x.toFixed(2)}, ${z.toFixed(2)})`; };

export async function initViewer(){
  scene = new THREE.Scene();

  renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false, preserveDrawingBuffer:true });
  const viewerEl = document.getElementById('viewer3d');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(viewerEl.clientWidth, viewerEl.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x101318, 1);
  viewerEl.appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(50, viewerEl.clientWidth/viewerEl.clientHeight, 0.1, 5000);
  camera.position.set(0, 8, 12);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0.5, 0, 0.5); // keep same camera feel
  controls.enableDamping = true;
  controls.minDistance = 1;
  controls.maxDistance = 200;
  controls.maxPolarAngle = Math.PI * 0.499;

  pmremGen = new THREE.PMREMGenerator(renderer);
  envTex = pmremGen.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.background = new THREE.Color(0x101318);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x555555, 1.1);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(-6, 10, 6);
  scene.add(dir);

  // Solid floor + grid lines (so you can see when you sink under)
  buildFloorAndGrid();

  // Cursor hover snap to Y=0 plane
  const raycaster = new THREE.Raycaster();
  const planeY0   = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
  renderer.domElement.addEventListener('pointermove', (e)=>{
    const ndc = new THREE.Vector2(
      (e.offsetX / renderer.domElement.clientWidth) * 2 - 1,
      -(e.offsetY / renderer.domElement.clientHeight) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    const p = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(planeY0, p)) {
      const sx = snapCoord(p.x), sz = snapCoord(p.z);
      cursorCross.position.set(sx, 0, sz);
      updateHud(p.x, p.z);
    }
  });

  // Resize
  const onResize = ()=>{
    const w = viewerEl.clientWidth, h = viewerEl.clientHeight;
    camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h);
  };
  new ResizeObserver(onResize).observe(viewerEl);
  window.addEventListener('resize', onResize);

  // RAF
  const clock = new THREE.Clock();
  const tick = ()=>{
    requestAnimationFrame(tick);
    Object.values(App.models).forEach(m => m.mixer && m.mixer.update(clock.getDelta()));
    controls.update(); renderer.render(scene, camera);
  };
  tick();

  // Simple global helpers available to other modules
  App.snapToCenterAndZero = snapToCenterAndZero;
  App.fitActiveToTiles    = fitActiveToTiles;
  App.stickActiveToGround = stickActiveToGround;
  App.rebuildGrid         = buildFloorAndGrid;
  App.getActiveRoot       = ()=> App.models[App.activeModelId]?.gltf?.scene || null;
}

function buildFloorAndGrid(){
  // clear old
  [gridHelper, majorLines, cursorCross, floorMesh].forEach(o => o && scene.remove(o));
  gridHelper = majorLines = cursorCross = floorMesh = null;

  const size = App.GRID.chunk * App.GRID.tile;
  const half = size * 0.5;

  // Solid floor
  const floorGeo = new THREE.PlaneGeometry(size, size, App.GRID.chunk, App.GRID.chunk);
  const floorMat = new THREE.MeshStandardMaterial({ color:0x0e1117, metalness:0, roughness:1 });
  floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI/2;
  floorMesh.position.y = 0;
  scene.add(floorMesh);

  // Fine grid
  gridHelper = new THREE.GridHelper(size, App.GRID.chunk, 0x3a3f46, 0x2a2f36);
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.95;
  gridHelper.position.y = 0.0001;
  scene.add(gridHelper);

  // Major lines every 5 tiles
  const g = new THREE.BufferGeometry();
  const verts = [];
  const step = App.GRID.tile * 5;
  for (let x = -half; x <= half+1e-6; x+=step) verts.push(x,0.00015,-half, x,0.00015,half);
  for (let z = -half; z <= half+1e-6; z+=step) verts.push(-half,0.00015,z, half,0.00015,z);
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts,3));
  majorLines = new THREE.LineSegments(g,new THREE.LineBasicMaterial({ color:0x55606c, transparent:true, opacity:0.9 }));
  scene.add(majorLines);

  // Cursor cross
  const L = App.GRID.tile * 0.8;
  const crossG = new THREE.BufferGeometry();
  crossG.setAttribute('position', new THREE.Float32BufferAttribute([
    -L/2,0.001,0,  L/2,0.001,0, 0,0.001,-L/2, 0,0.001,L/2
  ],3));
  cursorCross = new THREE.LineSegments(crossG, new THREE.LineBasicMaterial({ color:0xff4444 }));
  scene.add(cursorCross);
}

/** === placement utils === */
function stickActiveToGround(){
  const root = App.getActiveRoot(); if (!root) return;
  const box = new THREE.Box3().setFromObject(root);
  root.position.y -= box.min.y; // place base on Y=0
  App.events.dispatchEvent(new Event('transform:refresh'));
}

function fitActiveToTiles(tx=1, tz=1){
  const root = App.getActiveRoot(); if (!root) return;
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const targetX = tx * App.GRID.tile, targetZ = tz * App.GRID.tile;
  const k = Math.min(targetX/Math.max(1e-5,size.x), targetZ/Math.max(1e-5,size.z));
  root.scale.multiplyScalar(k);
  App.events.dispatchEvent(new Event('transform:refresh'));
}

/**
 * Snap model so its visual sits on the center tile AND zero all local translation
 * so the transform sliders read 0.00 and export has zeroed position.
 */
function snapToCenterAndZero(){
  const root = App.getActiveRoot(); if (!root) return;
  const c = 0.5 * App.GRID.tile;

  // 1) move root to center tile
  root.position.set(c, root.position.y, c);

  // 2) zero local translation while keeping world-the-same:
  // shift all direct children by +current local position, then zero the root.
  root.updateWorldMatrix(true,true);
  const delta = root.position.clone(); // (c, y, c)
  root.children.forEach(ch => ch.position.add(delta));
  root.position.set(0,0,0);

  // refresh any transform UIs
  App.events.dispatchEvent(new Event('transform:refresh'));
}

/** helpers used elsewhere */
export function formatBytes(bytes, decimals=2){
  if(bytes===0) return '0 Bytes'; const k=1024; const dm=decimals<0?0:decimals;
  const sizes=['Bytes','KB','MB','GB']; const i=Math.floor(Math.log(bytes)/Math.log(k));
  return parseFloat((bytes/Math.pow(k,i)).toFixed(dm))+' '+sizes[i];
}