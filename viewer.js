// viewer.js
// Core 3D viewer: scene, camera, grid/floor, cursor snapping, and model container/ops.
// Other panels (grid/transform/meshes/textures/exports) call into the API exposed by App.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';

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

  /* Grid (synced with game's worldengine.js) */
  GRID: {
    tile: 1,
    chunk: 50,
    snapMode: 'centers'
  },

  /* Visual grid/floor objects */
  gridHelper: null,
  majorLines: null,
  cursorCross: null,
  floorMesh: null,

  /* Models registry */
  models: {},
  activeModelId: null,
  modelIdCounter: 0,
  _modelIdCounter: 0,

  /* Events for panels to react (e.g., transform sliders) */
  events: new EventTarget(),

  /* Temporary UI state shared with textures.js */
  ui: { textureTarget: { mesh:null, type:null } },
};

let __initialized = false;

/* -------------------------------------------------------
   Init (idempotent)
------------------------------------------------------- */
(async function() {
  if (document.readyState === 'loading') {
    await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
  }
  await initViewer();
})();

/* -------------------------------------------------------
   Init (idempotent)
------------------------------------------------------- */
export async function initViewer() {
  if (__initialized) return;

  const { viewerEl } = App;
  if (!viewerEl) throw new Error('#viewer3d not found in DOM');

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialiias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(
    viewerEl.clientWidth || window.innerWidth,
    viewerEl.clientHeight || Math.round(window.innerHeight * 0.55)
  );
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x101318, 1);
  viewerEl.appendChild(renderer.domElement);

  // Scene + env
  const scene = new THREE.Scene();
  const pmremGen = new THREE.PMREMGenerator(renderer);
  const envTex = pmremGen.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.background = new THREE.Color(0x101318);

  // Camera
  const camera = new THREE.PerspectiveCamera(
    50,
    renderer.domElement.clientWidth / renderer.domElement.clientHeight,
    0.1,
    5000
  );
  camera.position.set(0, 8, 12);

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0.5, 0, 0.5);
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

  Object.assign(App, { scene, camera, renderer, controls, envTex });

  buildFloorAndGrid();
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

  __initialized = true;
}

/* -------------------------------------------------------
   Grid / floor
------------------------------------------------------- */
function clearGrid(){
  const { scene } = App;
  [App.gridHelper, App.majorLines, App.cursorCross, App.floorMesh].forEach(o => o && scene.remove(o));
  App.gridHelper = App.majorLines = App.cursorCross = App.floorMesh = null;
}

export function buildFloorAndGrid(){
  clearGrid();

  const { scene, GRID } = App;
  const size = GRID.chunk * GRID.tile;
  const divisions = GRID.chunk;
  const half = size * 0.5;

  const floorGeo = new THREE.PlaneGeometry(size, size, 1, 1);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 1.0, metalness: 0.0 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  floor.rotation.x = -Math.PI * 0.5;
  floor.position.y = 0;
  scene.add(floor);
  App.floorMesh = floor;

  const grid = new THREE.GridHelper(size, divisions, 0x3a3f46, 0x444B52);
  grid.material.transparent = true;
  grid.material.opacity = 0.95;
  grid.position.y = 0.0001;
  scene.add(grid);
  App.gridHelper = grid;

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

  const L = GRID.tile * 0.8;
  const crossG = new THREE.BufferGeometry();
  crossG.setAttribute('position', new THREE.Float32BufferAttribute([
    -L/2,0.001,0,  L/2,0.001,0,
     0,0.001,-L/2, 0,0.001,L/2
  ],3));
  const cross = new THREE.LineSegments(crossG, new THREE.LineBasicMaterial({ color:0xff4444 }));
  scene.add(cross);
  App.cursorCross = cross;

  App.events.dispatchEvent(new CustomEvent('grid:rebuilt'));
}

/* -------------------------------------------------------
   Cursor snapping + HUD
------------------------------------------------------- */
function snapCoord(v){
  const t = App.GRID.tile;
  const offset = App.GRID.snapMode === 'centers' ? (0.5 * t) : 0.0;
  return Math.round((v - offset)/t)*t + offset;
}
function tileIndexFromWorld(v){
  const off = App.GRID.chunk * 0.5 - 0.5;
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
------------------------------------------------------- */
function hasSkeleton(object){ let v=false; object.traverse(o=>{ if (o.isSkinnedMesh || o.isBone) v=true; }); return v; }
function calculateModelStats(object){ let polygons=0, vertices=0; object.traverse(o=>{ if (o.isMesh && o.geometry && o.geometry.attributes?.position){ const g=o.geometry; polygons += g.index ? g.index.count/3 : g.attributes.position.count/3; vertices += g.attributes.position.count; } }); return {polygons, vertices}; }
App.calculateModelStats = calculateModelStats; // Expose for meshes.js

App.addModel = function addModel(gltf, fileInfo={ name:'model.glb', size:0 }){
  const anchor = new THREE.Group();
  anchor.name = '__anchor__';
  anchor.position.set(0,0,0);
  anchor.add(gltf.scene);
  App.scene.add(anchor);

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

  const idNum = App.modelIdCounter++;
  App._modelIdCounter = App.modelIdCounter;
  const id = `model-${idNum}`;

  const stats = calculateModelStats(gltf.scene);
  const skeletonPresent = hasSkeleton(gltf.scene);
  let skeletonHelper = null;
  if (skeletonPresent){
    skeletonHelper = new THREE.SkeletonHelper(gltf.scene);
    skeletonHelper.visible = false;
    anchor.add(skeletonHelper);
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

  App.events.dispatchEvent(new CustomEvent('models:changed'));
  return id;
};

App.removeModel = function removeModel(id){
  const m = App.models[id];
  if (!m) return;
  App.scene.remove(m.anchor);
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
  return App.models[App.activeModelId] || null;
};
App.getActiveScene = function getActiveScene(){
  return App.getActive()?.gltf?.scene || null;
};
App.getActiveRoot = App.getActiveScene;

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
   Grid utilities for ACTIVE model
------------------------------------------------------- */
App.snapActiveToCenterTile = function snapActiveToCenterTile(){
  const model = App.getActive(); if (!model) return;
  const c = 0.5 * App.GRID.tile;
  model.anchor.position.set(c, model.anchor.position.y, c);
  const s = model.gltf.scene;
  s.position.x = 0;
  s.position.z = 0;
  App.events.dispatchEvent(new Event('transform:refresh'));
};
App.snapToCenterAndZero = App.snapActiveToCenterTile;

App.placeActiveAtCursor = function placeActiveAtCursor(){
  const model = App.getActive(); if (!model || !App.cursorCross) return;
  const p = App.cursorCross.position;
  model.anchor.position.set(p.x, model.anchor.position.y, p.z);
};

App.stickActiveToGround = function stickActiveToGround(){
  const s = App.getActiveScene(); if (!s) return;
  const box = new THREE.Box3().setFromObject(s);
  const minY = box.min.y;
  s.position.y -= minY;
  App.events.dispatchEvent(new Event('transform:refresh'));
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
  App.events.dispatchEvent(new Event('transform:refresh'));
};

/* -------------------------------------------------------
   Pivot tools
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
  App.events.dispatchEvent(new Event('transform:refresh'));
};

App.bakeOrigin = function bakeOrigin(mode='center'){
  const root = App.getActiveScene(); if (!root) return;
  App.recenterPivot(mode);
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
  const toRemove = [];
  root.traverse(o => { if (o !== root && !o.isMesh && (!o.children || o.children.length === 0)) toRemove.push(o); });
  toRemove.forEach(o => o.parent && o.parent.remove(o));
  App.events.dispatchEvent(new Event('transform:refresh'));
};

/* -------------------------------------------------------
   MESH ATTACHMENT LOGIC (existing)
------------------------------------------------------- */
App.reparentMeshToBone = function(meshUuid, targetBone) {
  const m = App.getActive();
  if (!m) return;
  const mesh = m.gltf.scene.getObjectByProperty('uuid', meshUuid);
  if (!mesh) return;
  targetBone.attach(mesh);
  App.events.dispatchEvent(new Event('panels:refresh-all'));
};

App.reparentModelToBone = function(modelIdToAttach, targetBone) {
  const modelToAttach = App.models[modelIdToAttach];
  if (!modelToAttach) return;
  const anchor = modelToAttach.anchor;
  targetBone.attach(anchor);
  App.events.dispatchEvent(new Event('panels:refresh-all'));
};

/* -------------------------------------------------------
   MESH SIMPLIFICATION LOGIC
------------------------------------------------------- */
App.simplifyMesh = function(meshUuid, ratio) {
  const m = App.getActive();
  if (!m) return alert('No active model found.');
  const mesh = m.gltf.scene.getObjectByProperty('uuid', meshUuid);
  if (!mesh || !mesh.isMesh) return alert('Target mesh not found.');
  if (!mesh.geometry.index) {
    return alert('Simplification requires an indexed geometry. This mesh cannot be simplified.');
  }
  if (!mesh.userData.originalGeometry) {
    mesh.userData.originalGeometry = mesh.geometry.clone();
  }
  if (ratio >= 0.99) {
    mesh.geometry.dispose();
    mesh.geometry = mesh.userData.originalGeometry.clone();
  } else {
    const modifier = new SimplifyModifier();
    const originalCount = mesh.userData.originalGeometry.index.count / 3;
    const targetCount = Math.round(originalCount * ratio);
    const simplifiedGeometry = modifier.modify(mesh.userData.originalGeometry.clone(), targetCount);
    mesh.geometry.dispose();
    mesh.geometry = simplifiedGeometry;
  }
  const newStats = App.calculateModelStats(m.gltf.scene);
  m.fileInfo.polygons = newStats.polygons;
  m.fileInfo.vertices = newStats.vertices;
  App.events.dispatchEvent(new Event('panels:refresh-all'));
};

/* -------------------------------------------------------
   Small helpers (exported + on App)
------------------------------------------------------- */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024, dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
App.formatBytes = formatBytes;

export function getScene(){ return App.scene; }
export const rebuildGrid = buildFloorAndGrid; // alias

/* -------------------------------------------------------
   NEW: Bind-pose + TRS utilities (for bone-local export)
------------------------------------------------------- */
App.withBindPoseForModel = async function withBindPoseForModel(modelId, fn) {
  const m = App.models[modelId];
  if (!m) return fn?.();
  const paused = [];
  if (m.mixer && m.animation?.action) {
    const a = m.animation.action;
    if (a.isRunning() && !a.paused) { a.paused = true; paused.push(a); }
  }
  m.gltf.scene.traverse(o => { if (o.isSkinnedMesh) o.skeleton?.pose(); });
  try { return await fn?.(); }
  finally { paused.forEach(a => a.paused = false); }
};

App.computeBoneLocalTRS = function computeBoneLocalTRS(object3D, bone) {
  object3D.updateWorldMatrix(true, false);
  bone.updateWorldMatrix(true, false);
  const worldM = object3D.matrixWorld.clone();
  const invBoneWorld = bone.matrixWorld.clone().invert();
  const localM = invBoneWorld.multiply(worldM);
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  localM.decompose(pos, quat, scl);
  return {
    position: pos.toArray(),
    rotation: [quat.x, quat.y, quat.z, quat.w],
    scale: scl.toArray(),
    boneName: bone.name,
    space: 'bone-local'
  };
};

/* -------------------------------------------------------
   NEW: Attach & SNAP helper (what you asked for)
------------------------------------------------------- */
App.attachObjectToBone = function attachObjectToBone(object3D, targetBone, { mode = 'snap' } = {}) {
  if (!object3D || !targetBone) return;
  if (mode === 'preserve') {
    targetBone.attach(object3D); // keep world transform
  } else {
    // SNAP: zero local TRS so it sits at bone origin/orientation
    targetBone.add(object3D);
    object3D.position.set(0, 0, 0);
    object3D.quaternion.identity();
    object3D.scale.set(1, 1, 1);
    object3D.updateMatrix();
  }
  App.events.dispatchEvent(new Event('panels:refresh-all'));
};