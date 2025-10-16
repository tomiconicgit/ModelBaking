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
  viewerEl: document.getElementById('viewer3d'),
  floorMesh: null,
  models: {},
  activeModelId: null,
  modelIdCounter: 0,
  events: new EventTarget(),
  ui: { textureTarget: { mesh:null, type:null } },
};

let __initialized = false;
let _exporter = null;

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
  camera.position.set(0, 5, 10);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, 0);
  controls.enableDamping = true;
  controls.minDistance = 1;
  controls.maxDistance = 1000;
  controls.maxPolarAngle = Math.PI * 0.9;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.1));
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(-6, 10, 6);
  scene.add(dir);
  
  Object.assign(App, { scene, camera, renderer, controls, envTex });

  buildFloor();

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

function buildFloor() {
  const floorGeo = new THREE.PlaneGeometry(1000, 1000);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 1.0, metalness: 0.0 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI * 0.5;
  App.scene.add(floor); // <-- THIS LINE WAS FIXED
  App.floorMesh = floor;
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
  gltf.scene.updateMatrixWorld(true);
  const finalBox = new THREE.Box3().setFromObject(gltf.scene);
  gltf.scene.position.y -= finalBox.min.y;
  
  anchor.position.set(0, 0, 0);

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
  
  App.setActiveModel(id);
  App.frameObject(anchor);

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

  if (!isFinite(size.x) || size.length() === 0) return;

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = App.camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
  cameraZ *= 1.7;

  const newCamPos = new THREE.Vector3(center.x, center.y, center.z + cameraZ);

  App.controls.target.copy(center);
  App.camera.position.copy(newCamPos);
  App.camera.lookAt(center);
  
  App.controls.update();
};

App.centerCamera = function() {
    const activeModel = App.getActive();
    if (activeModel) {
        App.frameObject(activeModel.anchor);
    } else {
        App.controls.target.set(0, 1, 0);
        App.camera.position.set(0, 5, 10);
        App.controls.update();
    }
};

App.zeroActiveModelPosition = function() {
  const model = App.getActive();
  if (!model) return;
  model.anchor.position.set(0, 0, 0);
  App.events.dispatchEvent(new Event('transform:refresh'));
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
