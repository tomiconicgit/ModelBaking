// viewer.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export const App = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  envTex: null,
  hud: document.getElementById('hud'),
  viewerEl: document.getElementById('viewer3d'),
  GRID: { tile: 1, chunk: 50, snapMode: 'centers' },
  gridHelper: null,
  majorLines: null,
  cursorCross: null,
  floorMesh: null,
  models: {},
  activeModelId: null,
  modelIdCounter: 0,
  events: new EventTarget(),
  ui: { textureTarget: { mesh:null, type:null } },
};

let __initialized = false;
let _exporter = null; // Lazy-loaded exporter

(async function() {
  if (document.readyState === 'loading') {
    await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
  }
  await initViewer();
})();

export async function initViewer() {
  if (__initialized) return;

  const { viewerEl } = App;
  if (!viewerEl) throw new Error('#viewer3d not found in DOM');

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(viewerEl.clientWidth, viewerEl.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x101318, 1);
  viewerEl.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmremGen = new THREE.PMREMGenerator(renderer);
  const envTex = pmremGen.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.background = new THREE.Color(0x101318);

  const camera = new THREE.PerspectiveCamera(50, viewerEl.clientWidth / viewerEl.clientHeight, 0.1, 5000);
  camera.position.set(0, 8, 12);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0.5, 0, 0.5);
  controls.enableDamping = true;
  controls.minDistance = 1;
  controls.maxDistance = 200;
  controls.maxPolarAngle = Math.PI * 0.499;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.1));
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(-6, 10, 6);
  scene.add(dir);

  const axes = new THREE.AxesHelper(1.2);
  axes.position.set(0, 0.001, 0);
  scene.add(axes);
  
  Object.assign(App, { scene, camera, renderer, controls, envTex });

  buildFloorAndGrid();
  installCursorSnapping();

  new ResizeObserver(() => {
    const w = viewerEl.clientWidth;
    const h = viewerEl.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }).observe(viewerEl);

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

function buildFloorAndGrid(){
  const { scene, GRID } = App;
  const size = GRID.chunk * GRID.tile;
  const divisions = GRID.chunk;

  const floorGeo = new THREE.PlaneGeometry(size, size);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 1.0, metalness: 0.0 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI * 0.5;
  scene.add(floor);
  App.floorMesh = floor;

  const grid = new THREE.GridHelper(size, divisions, 0x3a3f46, 0x444B52);
  grid.position.y = 0.001;
  scene.add(grid);
  App.gridHelper = grid;
}

function installCursorSnapping(){
  const ray = new THREE.Raycaster();
  const planeY0 = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
  const p = new THREE.Vector3();

  App.renderer.domElement.addEventListener('pointermove', (e)=>{
    const ndc = new THREE.Vector2(
      (e.offsetX / App.renderer.domElement.clientWidth) * 2 - 1,
      -(e.offsetY / App.renderer.domElement.clientHeight) * 2 + 1
    );
    ray.setFromCamera(ndc, App.camera);
    if (ray.ray.intersectPlane(planeY0, p)) {
        if (App.hud) App.hud.textContent = `world: (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`;
    }
  });
}

function calculateModelStats(object){
    let polygons=0, vertices=0;
    object.traverse(o=>{
        if (o.isMesh && o.geometry) {
            const geom = o.geometry;
            vertices += geom.attributes.position.count;
            polygons += geom.index ? geom.index.count / 3 : geom.attributes.position.count / 3;
        }
    });
    return {polygons, vertices};
}
App.calculateModelStats = calculateModelStats;

App.addModel = function(gltf, fileInfo = { name:'model.glb', size:0 }) {
  const anchor = new THREE.Group();
  anchor.name = '__anchor__';
  anchor.add(gltf.scene);
  App.scene.add(anchor);

  const box = new THREE.Box3().setFromObject(gltf.scene);
  const center = box.getCenter(new THREE.Vector3());
  gltf.scene.position.sub(center);

  const size = box.getSize(new THREE.Vector3());
  if (isFinite(size.x) && size.length() > 0) {
    const maxDim = Math.max(size.x, size.y, size.z);
    gltf.scene.scale.multiplyScalar(App.GRID.tile / maxDim);
  }

  gltf.scene.updateMatrixWorld(true);
  const finalBox = new THREE.Box3().setFromObject(gltf.scene);
  gltf.scene.position.y -= finalBox.min.y;
  
  const centerTilePos = 0.5 * App.GRID.tile;
  anchor.position.set(centerTilePos, 0, centerTilePos);

  let skeletonHelper = null;
  const hasSkel = !!gltf.scene.getObjectByProperty('isSkinnedMesh', true);
  if(hasSkel) {
      skeletonHelper = new THREE.SkeletonHelper(gltf.scene);
      skeletonHelper.visible = false;
      anchor.add(skeletonHelper);
  }

  const id = `model-${App.modelIdCounter++}`;
  const stats = calculateModelStats(gltf.scene);

  App.models[id] = {
    gltf,
    anchor,
    mixer: hasSkel ? new THREE.AnimationMixer(gltf.scene) : null,
    animation: null,
    skeletonHelper,
    fileInfo: { ...fileInfo, ...stats }
  };

  if (!App.activeModelId) {
    App.setActiveModel(id);
    App.frameObject(anchor);
  }

  App.events.dispatchEvent(new CustomEvent('panels:refresh-all'));
};

App.setActiveModel = function(id){
  App.activeModelId = id;
  App.events.dispatchEvent(new CustomEvent('panels:refresh-all'));
};

App.getActive = () => App.models[App.activeModelId] || null;

App.frameObject = function(object){
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  if (!isFinite(size.x)) return;

  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = Math.max(4, maxDim * 2);

  App.controls.target.copy(center);
  App.camera.position.set(center.x, center.y + dist * 0.5, center.z + dist);
  App.controls.update();
};

App.centerCamera = function() {
  const centerPos = new THREE.Vector3(0.5 * App.GRID.tile, 0, 0.5 * App.GRID.tile);
  App.controls.target.copy(centerPos);
  App.camera.position.set(centerPos.x, 8, centerPos.z + 12);
  App.controls.update();
};

App.snapActiveToCenterTile = function() {
  const model = App.getActive(); if (!model) return;
  const c = 0.5 * App.GRID.tile;
  model.anchor.position.set(c, model.anchor.position.y, c);
};

App.attachObjectToBone = function(object3D, targetBone, { mode = 'snap' } = {}) {
  if (!object3D || !targetBone) return;
  targetBone.add(object3D);
  if (mode === 'snap') {
    object3D.position.set(0, 0, 0);
    object3D.quaternion.identity();
    object3D.scale.set(1, 1, 1);
  }
  object3D.updateMatrix();
  App.events.dispatchEvent(new Event('panels:refresh-all'));
};

App.exportModel = function(modelId, filename) {
    const m = App.models[modelId];
    if (!m) return alert('Model not found for export.');
    if (!_exporter) _exporter = new GLTFExporter();
    
    const options = {
        binary: true,
        animations: m.animation ? [m.animation.clip] : m.gltf.animations,
    };

    _exporter.parse(m.anchor, (buffer) => {
        const blob = new Blob([buffer], { type: 'model/gltf-binary' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    }, (err) => alert(`Export failed: ${err.message || err}`), options);
};

export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024, dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
