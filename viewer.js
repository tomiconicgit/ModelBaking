// viewer.js
// Core 3D viewer: scene, camera, grid/floor, cursor snapping, and model container/ops.
// Other panels (grid/transform/meshes/textures/exports) call into the API exposed by App.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* -------------------------------------------------------
   Public singleton
------------------------------------------------------- */
export const App = {
  /* Scene */
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  envTex: null,

  /* UI elements */
  hud: document.getElementById('hud'),
  viewerEl: document.getElementById('viewer3d'),

  /* Loaders shared by modules */
  textureLoader: new THREE.TextureLoader(),

  /* Grid (matches your game) */
  GRID: { tile: 1, chunk: 50, snapMode: 'centers' },

  /* Visual grid/floor objects */
  gridHelper: null,
  majorLines: null,
  cursorCross: null,
  floorMesh: null,

  /* Models registry */
  models: {},            // id -> { gltf, anchor, mixer, animation, skeletonHelper, fileInfo }
  activeModelId: null,
  _modelIdCounter: 0,

  /* Events for panels to react (e.g., transform sliders) */
  events: new EventTarget(),

  /* Temporary UI state shared with textures.js */
  ui: { textureTarget: { mesh:null, type:null } },

  /* API (exported at bottom) will be filled in here */
};

/* -------------------------------------------------------
   Init
------------------------------------------------------- */
(function init() {
  const { viewerEl } = App;

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(viewerEl.clientWidth || window.innerWidth, viewerEl.clientHeight || Math.round(window.innerHeight * 0.55));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x101318, 1);
  viewerEl.appendChild(renderer.domElement);

  // Scene, env, camera
  const scene = new THREE.Scene();
  const pmremGen = new THREE.PMREMGenerator(renderer);
  const envTex = pmremGen.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.background = new THREE.Color(0x101318);

  const camera = new THREE.PerspectiveCamera(
    50,
    renderer.domElement.clientWidth / renderer.domElement.clientHeight,
    0.1,
    5000
  );
  camera.position.set(0, 8, 12);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0.5, 0, 0.5);           // aim between central 4 tiles (game feel)
  controls.enableDamping = true;
  controls.minDistance = 1;
  controls.maxDistance = 200;
  controls.maxPolarAngle = Math.PI * 0.499;

  // Lights
  scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.1));
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(-6, 10, 6);
  scene.add(dir);

  // Tiny axes at origin
  const axes = new THREE.AxesHelper(1.2);
  axes.position.set(0, 0.001, 0);
  scene.add(axes);

  // Persist
  Object.assign(App, { scene, camera, renderer, controls, envTex });

  // Grid + floor
  buildFloorAndGrid();

  // Pointer snap + HUD
  installCursorSnapping();

  // Resize
  const onResize = ()=>{
    const w = viewerEl.clientWidth || window.innerWidth;
    const h = viewerEl.clientHeight || Math.round(window.innerHeight * 0.55);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  new ResizeObserver(onResize).observe(viewerEl);
  window.addEventListener('resize', onResize);

  // Render loop
  const clock = new THREE.Clock();
  (function animate(){
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    Object.values(App.models).forEach(m => m.mixer && m.mixer.update(dt));
    controls.update();
    renderer.render(scene, camera);
  })();
})();

/* -------------------------------------------------------
   Grid / floor (solid color + tile lines) — matches game
------------------------------------------------------- */
function clearGrid(){
  const { scene } = App;
  [App.gridHelper, App.majorLines, App.cursorCross, App.floorMesh].forEach(o => o && scene.remove(o));
  App.gridHelper = App.majorLines = App.cursorCross = App.floorMesh = null;
}

export function buildFloorAndGrid(){
  clearGrid();

  const { scene, GRID } = App;

  const size = GRID.chunk * GRID.tile;      // e.g., 50 units
  const divisions = GRID.chunk;             // 50×50 grid
  const half = size * 0.5;

  // Solid floor
  const floorGeo = new THREE.PlaneGeometry(size, size, 1, 1);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x141820,
    roughness: 1.0,
    metalness: 0.0
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  floor.rotation.x = -Math.PI * 0.5;
  floor.position.y = 0;                    // Y=0 plane (game ground)
  scene.add(floor);
  App.floorMesh = floor;

  // Fine grid (every tile)
  const grid = new THREE.GridHelper(size, divisions, 0x3a3f46, 0x2a2f36);
  grid.material.transparent = true;
  grid.material.opacity = 0.95;
  grid.position.y = 0.0001;                // prevent z-fighting with floor
  scene.add(grid);
  App.gridHelper = grid;

  // Major lines every 5 tiles
  const g = new THREE.BufferGeometry();
  const verts = [];
  const step = GRID.tile * 5;
  for (let x = -half; x <= half + 1e-6; x += step) verts.push(x,0.00015,-half, x,0.00015,half);
  for (let z = -half; z <= half + 1e-6; z += step) verts.push(-half,0.00015,z, half,0.00015,z);
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts,3));
  const major = new THREE.LineSegments(
    g,
    new THREE.LineBasicMaterial({ color:0x55606c, transparent:true, opacity:0.9 })
  );
  scene.add(major);
  App.majorLines = major;

  // Cursor cross (tile-sized)
  const L = GRID.tile * 0.8;
  const crossG = new THREE.BufferGeometry();
  crossG.setAttribute('position', new THREE.Float32BufferAttribute([
    -L/2,0.001,0,  L/2,0.001,0,
     0,0.001,-L/2, 0,0.001,L/2
  ],3));
  const cross = new THREE.LineSegments(crossG, new THREE.LineBasicMaterial({ color:0xff4444 }));
  scene.add(cross);
  App.cursorCross = cross;

  // public hook for other modules
  App.events.dispatchEvent(new CustomEvent('grid:rebuilt'));
}

/* -------------------------------------------------------
   Cursor snapping + HUD (game-accurate)
------------------------------------------------------- */
function snapCoord(v){
  const t = App.GRID.tile;
  const offset = App.GRID.snapMode === 'centers' ? (0.5 * t) : 0.0;
  return Math.round((v - offset)/t)*t + offset;
}
function tileIndexFromWorld(v){
  const off = App.GRID.chunk * 0.5 - 0.5; // e.g., 24.5 for 50×50
  return Math.round((v / App.GRID.tile) + off);
}
function updateHud(worldX, worldZ){
  const tx = tileIndexFromWorld(worldX);
  const tz = tileIndexFromWorld(worldZ);
  if (App.hud) App.hud.textContent =
    `tile: (${tx},${tz}) • mode: ${App.GRID.snapMode} • world: (${worldX.toFixed(2)}, ${worldZ.toFixed(2)})`;
}
function installCursorSnapping(){
  const ray = new THREE.Raycaster();
  const planeY0 = new THREE.Plane(new THREE.Vector3(0,1,0), 0);

  App.renderer.domElement.addEventListener('pointermove', (e)=>{
    const ndc = new THREE.Vector2(
      (e.offsetX / App.renderer.domElement.clientWidth) * 2 - 1,
      -(e.offsetY / App.renderer.domElement.clientHeight) * 2 + 1
    );
    ray.setFromCamera(ndc, App.camera);
    const p = new THREE.Vector3();
    if (ray.ray.intersectPlane(planeY0, p)) {
      const sx = snapCoord(p.x), sz = snapCoord(p.z);
      if (App.cursorCross) App.cursorCross.position.set(sx, 0, sz);
      updateHud(p.x, p.z);
    }
  });
}

/* -------------------------------------------------------
   Models: add/remove/select
   NOTE: We wrap every loaded model in an "anchor" group.
         Grid placement moves the anchor; transform sliders
         move the model (root) itself. Export uses only root,
         so position sliders can be 0.00 while the model still
         appears centered on the grid. ✅
------------------------------------------------------- */
function hasSkeleton(object){ let v=false; object.traverse(o=>{ if (o.isSkinnedMesh || o.isBone) v=true; }); return v; }
function calculateModelStats(object){ let polygons=0, vertices=0; object.traverse(o=>{ if (o.isMesh && o.geometry && o.geometry.attributes?.position){ const g=o.geometry; polygons += g.index ? g.index.count/3 : g.attributes.position.count/3; vertices += g.attributes.position.count; } }); return {polygons, vertices}; }

App.addModel = function addModel(gltf, fileInfo={ name:'model.glb', size:0 }){
  // Create anchor/wrapper (NOT exported)
  const anchor = new THREE.Group();
  anchor.name = '__anchor__';
  anchor.position.set(0,0,0);    // grid placement uses this
  anchor.add(gltf.scene);
  App.scene.add(anchor);

  // Materials + shadows normalization
  gltf.scene.traverse(o=>{
    if (o.isMesh){
      o.castShadow = true;
      o.receiveShadow = true;
      if (!o.material?.isMeshStandardMaterial){
        o.material = new THREE.MeshStandardMaterial({
          color: (o.material?.color?.clone()) || new THREE.Color(0xffffff),
          metalness: 0.1, roughness: 0.85
        });
      }
    }
  });

  const id = `model-${App._modelIdCounter++}`;
  const stats = calculateModelStats(gltf.scene);
  const skeletonPresent = hasSkeleton(gltf.scene);
  let skeletonHelper = null;
  if (skeletonPresent){
    skeletonHelper = new THREE.SkeletonHelper(gltf.scene);
    skeletonHelper.visible = false;
    anchor.add(skeletonHelper); // follows anchor transforms
  }

  App.models[id] = {
    gltf,
    anchor,
    mixer: skeletonPresent ? new THREE.AnimationMixer(gltf.scene) : null,
    animation: null,
    skeletonHelper,
    fileInfo: { ...fileInfo, polygons: stats.polygons, vertices: stats.vertices }
  };

  if (!App.activeModelId) {
    App.setActiveModel(id);
    App.frameObject(anchor);
  }

  // Let panels update
  App.events.dispatchEvent(new CustomEvent('models:changed'));
  return id;
};

App.removeModel = function removeModel(id){
  const m = App.models[id];
  if (!m) return;
  App.scene.remove(m.anchor);
  // dispose meshes
  m.gltf.scene.traverse(obj=>{
    if (obj.isMesh){
      obj.geometry?.dispose?.();
      if (Array.isArray(obj.material)) obj.material.forEach(x=>x?.dispose?.());
      else obj.material?.dispose?.();
    }
  });
  delete App.models[id];
  if (App.activeModelId === id){
    const ids = Object.keys(App.models);
    App.setActiveModel(ids[0] || null);
  }
  App.events.dispatchEvent(new CustomEvent('models:changed'));
};

App.setActiveModel = function setActiveModel(id){
  App.activeModelId = id;
  App.events.dispatchEvent(new CustomEvent('active:changed', { detail:{ id } }));
};

App.getActive = function getActive(){
  const m = App.models[App.activeModelId];
  return m || null;
};
App.getActiveScene = function getActiveScene(){
  const m = App.getActive();
  return m?.gltf?.scene || null;
};

/* -------------------------------------------------------
   Camera framing
------------------------------------------------------- */
App.frameObject = function frameObject(object){
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = Math.max(4, maxDim * 2);

  const cx = isFinite(center.x)?center.x:0.5;
  const cz = isFinite(center.z)?center.z:0.5;

  App.controls.target.set(cx, 0, cz);
  App.camera.position.set(cx + dist*0.35, dist*0.7, cz + dist*0.9);
  App.camera.near = 0.01;
  App.camera.far = 5000;
  App.camera.updateProjectionMatrix();
  App.controls.update();
};

/* -------------------------------------------------------
   Grid utilities for ACTIVE model (anchor-aware)
------------------------------------------------------- */
function emitTransformSync(){
  const s = App.getActiveScene();
  if (!s) return;
  const euler = new THREE.Euler().setFromQuaternion(s.quaternion, 'YXZ');
  App.events.dispatchEvent(new CustomEvent('transform:sync', {
    detail: {
      position: s.position.clone(),
      rotationDeg: {
        x: THREE.MathUtils.radToDeg(euler.x),
        y: THREE.MathUtils.radToDeg(euler.y),
        z: THREE.MathUtils.radToDeg(euler.z)
      },
      scale: s.scale.clone()
    }
  }));
}

App.snapActiveToCenterTile = function snapActiveToCenterTile(){
  const model = App.getActive(); if (!model) return;
  const c = 0.5 * App.GRID.tile;

  // Move ANCHOR to tile center for world placement
  model.anchor.position.set(c, model.anchor.position.y, c);

  // Keep the model's own transform clean for export
  const s = model.gltf.scene;
  s.position.x = 0;
  s.position.z = 0;

  emitTransformSync(); // tell transform panel to show 0.00/0.00
};

App.placeActiveAtCursor = function placeActiveAtCursor(){
  const model = App.getActive(); if (!model || !App.cursorCross) return;
  const p = App.cursorCross.position;
  model.anchor.position.set(p.x, model.anchor.position.y, p.z);
  // No change to model local transform → no transform event
};

App.stickActiveToGround = function stickActiveToGround(){
  const s = App.getActiveScene(); if (!s) return;
  const box = new THREE.Box3().setFromObject(s);
  const minY = box.min.y;
  s.position.y -= minY;   // base to Y=0
  emitTransformSync();
};

App.fitActiveToTiles = function fitActiveToTiles(tilesX=1, tilesZ=1){
  const s = App.getActiveScene(); if (!s) return;
  const box = new THREE.Box3().setFromObject(s);
  const size = box.getSize(new THREE.Vector3());
  const targetX = tilesX * App.GRID.tile;
  const targetZ = tilesZ * App.GRID.tile;
  const scaleX = targetX / Math.max(1e-5, size.x);
  const scaleZ = targetZ / Math.max(1e-5, size.z);
  const k = Math.min(scaleX, scaleZ);
  s.scale.multiplyScalar(k);
  emitTransformSync();
};

/* -------------------------------------------------------
   Pivot tools (no visual shift)
------------------------------------------------------- */
App.recenterPivot = function recenterPivot(mode='center'){
  const root = App.getActiveScene(); if (!root) return;
  root.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(root);
  if (!isFinite(box.min.x)) return;

  const centerW = box.getCenter(new THREE.Vector3());
  const targetW = (mode === 'bottom')
    ? new THREE.Vector3(centerW.x, box.min.y, centerW.z)
    : centerW;

  const targetL = root.worldToLocal(targetW.clone());

  root.children.forEach(child => { child.position.sub(targetL); });
  root.position.add(targetL);

  const model = App.getActive();
  if (model?.skeletonHelper) model.skeletonHelper.update();

  emitTransformSync();
};

App.bakeOrigin = function bakeOrigin(mode='center'){
  const root = App.getActiveScene(); if (!root) return;

  // 1) move pivot (no visual shift)
  App.recenterPivot(mode);

  // 2) bake transforms to geometry (static meshes only)
  root.updateWorldMatrix(true, true);
  const invRootWorld = new THREE.Matrix4().copy(root.matrixWorld).invert();

  const meshes = [];
  root.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && o.geometry) meshes.push(o); });

  meshes.forEach(mesh => {
    mesh.updateWorldMatrix(true, false);
    const mWorld = mesh.matrixWorld.clone();
    const mLocalToRoot = new THREE.Matrix4().multiplyMatrices(invRootWorld, mWorld);

    mesh.geometry.applyMatrix4(mLocalToRoot);
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();

    mesh.position.set(0,0,0);
    mesh.quaternion.identity();
    mesh.scale.set(1,1,1);
    mesh.updateMatrix();

    if (mesh.parent !== root) {
      mesh.parent.remove(mesh);
      root.add(mesh);
    }
  });

  // prune empty groups
  const toRemove = [];
  root.traverse(o => { if (o !== root && !o.isMesh && (!o.children || o.children.length === 0)) toRemove.push(o); });
  toRemove.forEach(o => o.parent && o.parent.remove(o));

  emitTransformSync();
};

/* -------------------------------------------------------
   Small helpers exposed for other modules
------------------------------------------------------- */
App.formatBytes = (bytes, decimals=2)=>{
  if(bytes===0) return '0 Bytes';
  const k=1024, dm=decimals<0?0:decimals, sizes=['Bytes','KB','MB','GB','TB'];
  const i=Math.floor(Math.log(bytes)/Math.log(k));
  return parseFloat((bytes/Math.pow(k,i)).toFixed(dm))+' '+sizes[i];
};

/* -------------------------------------------------------
   Expose a couple of funcs for grid module to rebuild
------------------------------------------------------- */
App.rebuildGrid = buildFloorAndGrid;

/* Debug hook (optional) */
window.App = App;