import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { getScene, App } from './viewer.js';

export async function initLoader(){
  const gltfLoader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://unpkg.com/three@0.168.0/examples/jsm/libs/draco/');
  gltfLoader.setDRACOLoader(draco);
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  const textureLoader = new THREE.TextureLoader();

  App.loaders = { gltfLoader, textureLoader };

  // wire file inputs
  document.getElementById('model-input').addEventListener('change', handleModelLoad);
  document.getElementById('animation-input').addEventListener('change', handleAnimationLoad);
  document.getElementById('texture-input').addEventListener('change', handleTextureLoad);
}

function handleModelLoad(e){
  const files = e.target.files;
  if (!files.length) return;
  [...files].forEach(file=>{
    const reader = new FileReader();
    reader.onload = ev=>{
      App.loaders.gltfLoader.parse(
        ev.target.result, '', (gltf)=>{
          const id = `model-${App.modelIdCounter++}`;
          const hasSkel = hasSkeleton(gltf.scene);

          let skeletonHelper = null;
          if (hasSkel){
            skeletonHelper = new THREE.SkeletonHelper(gltf.scene);
            skeletonHelper.visible = false;
            getScene().add(skeletonHelper);
          }

          // normalize materials
          gltf.scene.traverse(o=>{
            if (o.isMesh){
              o.castShadow = o.receiveShadow = true;
              if (!o.material.isMeshStandardMaterial){
                o.material = new THREE.MeshStandardMaterial({
                  color: (o.material?.color?.clone()) || new THREE.Color(0xffffff),
                  metalness: 0.1, roughness: 0.85
                });
              }
            }
          });

          App.models[id] = {
            gltf, mixer: hasSkel ? new THREE.AnimationMixer(gltf.scene) : null,
            animation:null, skeletonHelper,
            fileInfo: collectStats(file, gltf.scene)
          };
          getScene().add(gltf.scene);

          if (!App.activeModelId) {
            App.activeModelId = id;
            App.events.dispatchEvent(new Event('frame:object'));
          }
          App.events.dispatchEvent(new Event('panels:refresh-all'));
        },
        (err)=> alert('GLTF parse error: '+(err?.message||err))
      );
    };
    reader.readAsArrayBuffer(file);
  });
  e.target.value = '';
}

async function handleAnimationLoad(e){
  const file = e.target.files[0];
  e.target.value = '';
  const m = App.models[App.activeModelId];
  if (!file || !m || !m.mixer){ alert('Select an active model with a skeleton.'); return; }
  const reader = new FileReader();
  reader.onload = ev=>{
    App.loaders.gltfLoader.parse(ev.target.result,'',(gltf)=>{
      if (!gltf.animations.length) return alert('No animations found.');
      if (m.animation) { m.mixer.stopAllAction(); m.mixer.uncacheClip(m.animation.clip); }
      const clip = gltf.animations[0];
      const action = m.mixer.clipAction(clip);
      m.animation = { clip, action };
      App.events.dispatchEvent(new Event('dashboard:refresh'));
    }, (err)=> alert('Animation load failed: '+(err?.message||err)));
  };
  reader.readAsArrayBuffer(file);
}

function handleTextureLoad(e){
  const file = e.target.files[0];
  const tgt = App.ui.textureTarget; // set by textures.js
  if (!file || !tgt?.mesh) return;
  const url = URL.createObjectURL(file);
  App.loaders.textureLoader.load(url, (tex)=>{
    tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false;
    if (!tgt.mesh.material || !tgt.mesh.material.isMeshStandardMaterial) { alert('Target mesh has no standard material.'); URL.revokeObjectURL(url); return; }
    tgt.mesh.material[tgt.type] = tex; tgt.mesh.material.needsUpdate = true;
    alert(`Applied ${tgt.type}.`); URL.revokeObjectURL(url);
  });
  e.target.value = '';
}

/** helpers */
function collectStats(file, object){
  let polygons=0, vertices=0; object.traverse(o=>{
    if (o.isMesh && o.geometry && o.geometry.attributes?.position){
      const g=o.geometry; polygons += g.index ? g.index.count/3 : g.attributes.position.count/3; vertices += g.attributes.position.count;
    }
  });
  return { name:file.name, size:file.size, polygons, vertices };
}
function hasSkeleton(object){ let v=false; object.traverse(o=>{ if (o.isSkinnedMesh || o.isBone) v=true; }); return v; }