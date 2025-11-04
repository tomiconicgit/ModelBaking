// viewer.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
// *** NEW IMPORT ***
import { TransformControls } from 'three/addons/controls/TransformControls.js';

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
  composer: null,
  outlinePass: null,
  // *** NEW PROPERTIES ***
  transformGizmo: null, // The gizmo object
  activeObject: null,   // The currently selected object (Mesh or Group)
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
  controls.minDistance = 0.1;
  controls.maxPolarAngle = Math.PI * 0.9;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.1));
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(-6, 10, 6);
  scene.add(dir);
  
  // --- Setup Effect Composer for Outlines ---
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const outlinePass = new OutlinePass(new THREE.Vector2(viewerEl.clientWidth, viewerEl.clientHeight), scene, camera);
  outlinePass.edgeStrength = 4.0;
  outlinePass.edgeGlow = 0.2;
  outlinePass.edgeThickness = 1.0;
  outlinePass.visibleEdgeColor.set('#007aff');
  outlinePass.hiddenEdgeColor.set('#007aff');
  composer.addPass(outlinePass);
  
  const fxaaPass = new ShaderPass(FXAAShader);
  fxaaPass.material.uniforms['resolution'].value.x = 1 / (viewerEl.clientWidth * renderer.getPixelRatio());
  fxaaPass.material.uniforms['resolution'].value.y = 1 / (viewerEl.clientHeight * renderer.getPixelRatio());
  composer.addPass(fxaaPass);

  // --- *** NEW: Setup Transform Gizmo *** ---
  const gizmo = new TransformControls(camera, renderer.domElement);
  gizmo.setMode('translate'); // 'translate', 'rotate', 'scale'
  gizmo.enabled = false;
  gizmo.setTranslationSnap(0.1);
  gizmo.setRotationSnap(THREE.MathUtils.degToRad(15));
  gizmo.setScaleSnap(0.1);
  scene.add(gizmo);

  // Disable orbit controls while dragging gizmo
  gizmo.addEventListener('dragging-changed', (event) => {
    controls.enabled = !event.value;
  });

  // Update Transform panel when gizmo move is finished
  gizmo.addEventListener('objectChange', () => {
    App.events.dispatchEvent(new Event('transform:refresh'));
  });

  Object.assign(App, { scene, camera, renderer, controls, envTex, composer, outlinePass, transformGizmo: gizmo });
  // ------------------------------------------

  buildFloor();

  new ResizeObserver(() => {
    const w = viewerEl.clientWidth;
    const h = viewerEl.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    fxaaPass.material.uniforms['resolution'].value.x = 1 / (w * renderer.getPixelRatio());
    fxaaPass.material.uniforms['resolution'].value.y = 1 / (h * renderer.getPixelRatio());
    outlinePass.resolution.set(w, h);
  }).observe(viewerEl);

  const clock = new THREE.Clock();
  (function animate(){
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    Object.values(App.models).forEach(m => m.mixer && m.mixer.update(dt));
    controls.update();
    composer.render(dt);
  })();

  __initialized = true;
}

function buildFloor() {
  const floorGeo = new THREE.PlaneGeometry(1000, 1000);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 1.0, metalness: 0.0 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI * 0.5;
  App.scene.add(floor);
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
  
  App.setActiveModel(id); // This will now also set the active object
  App.frameObject(anchor);
  // panels:refresh-all is called by setActiveModel
};

// *** NEW: Central function to set the active object ***
App.setActiveObject = function(object) {
  App.activeObject = object;

  // 1. Update Gizmo
  if (App.transformGizmo) {
    if (object) {
      App.transformGizmo.attach(object);
      App.transformGizmo.enabled = true;
    } else {
      App.transformGizmo.detach();
      App.transformGizmo.enabled = false;
    }
  }

  // 2. Update Outline
  if (App.outlinePass) {
    // Only outline meshes, not the main anchor/group
    if (object && object.isMesh) {
      App.outlinePass.selectedObjects = [object];
    } else {
      App.outlinePass.selectedObjects = [];
    }
  }

  // 3. Refresh all panels to reflect the change
  App.events.dispatchEvent(new Event('panels:refresh-all'));
};

App.setActiveModel = function(id){
  App.activeModelId = id;
  const m = App.getActive();
  // When a model is activated, set its main anchor as the active object
  App.setActiveObject(m ? m.anchor : null);
  // Note: setActiveObject already fires 'panels:refresh-all'
};

App.getActive = () => App.models[App.activeModelId] || null;

App.frameObject = function(object){
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  if (!isFinite(size.x) || size.length() === 0) return;

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = App.camera.fov * (Math.PI / 180);
  let cameraDist = Math.abs(maxDim / 2 / Math.tan(fov / 2));
  cameraDist *= 1.7;

  const newCamPos = new THREE.Vector3(center.x, center.y, center.z + cameraDist);
  
  App.camera.near = cameraDist / 100;
  App.camera.far = cameraDist * 2;
  App.camera.updateProjectionMatrix();

  App.controls.target.copy(center);
  App.camera.position.copy(newCamPos);
  App.camera.lookAt(center);
  
  App.controls.update();
};

App.centerCamera = function() {
    // Center on the active *object* if one is selected, otherwise the model
    const target = App.activeObject || App.getActive()?.anchor;
    if (target) {
        App.frameObject(target);
    } else {
        App.controls.target.set(0, 1, 0);
        App.camera.position.set(0, 5, 10);
        App.controls.update();
    }
};

App.zeroActiveModelPosition = function() {
  // Renamed to 'zeroActiveObject' for clarity
  const object = App.activeObject;
  if (!object) return;
  object.position.set(0, 0, 0);
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
