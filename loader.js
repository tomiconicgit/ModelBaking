// loader.js
// Loads GLB/GLTF models, animations, and textures into the app.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { App } from './viewer.js';

export async function initLoader() {
  // Set up loaders (shared via App)
  const gltfLoader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://unpkg.com/three@0.168.0/examples/jsm/libs/draco/');
  gltfLoader.setDRACOLoader(draco);
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);

  const textureLoader = new THREE.TextureLoader();
  App.loaders = { gltfLoader, textureLoader };

  // Wire hidden inputs
  document.getElementById('model-input')
    .addEventListener('change', handleModelLoad);
  document.getElementById('animation-input')
    .addEventListener('change', handleAnimationLoad);
  document.getElementById('texture-input')
    .addEventListener('change', handleTextureLoad);
}

/* --------------------------- Handlers --------------------------- */

function handleModelLoad(e) {
  const files = e.target.files;
  if (!files || !files.length) return;

  [...files].forEach((file) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      App.loaders.gltfLoader.parse(
        ev.target.result,
        '',
        (gltf) => {
          App.addModel(gltf, { name: file.name, size: file.size });
          App.events.dispatchEvent(new Event('panels:refresh-all'));
        },
        (err) => alert('GLTF parse error: ' + (err?.message || err))
      );
    };
    reader.readAsArrayBuffer(file);
  });

  e.target.value = '';
}

function handleAnimationLoad(e) {
  const file = e.target.files[0];
  e.target.value = '';
  const m = App.getActive();
  if (!file || !m || !m.mixer) {
    alert('Select an active model with a skeleton first.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    App.loaders.gltfLoader.parse(
      ev.target.result,
      '',
      (gltf) => {
        if (!gltf.animations.length) {
          alert('No animations in this file.');
          return;
        }
        if (m.animation) {
          m.mixer.stopAllAction();
          m.mixer.uncacheClip(m.animation.clip);
        }
        const clip = gltf.animations[0];
        const action = m.mixer.clipAction(clip);
        m.animation = { clip, action };
        App.events.dispatchEvent(new Event('dashboard:refresh'));
      },
      (err) => alert('Animation load failed: ' + (err?.message || err))
    );
  };
  reader.readAsArrayBuffer(file);
}

// *** UPDATED: This function now handles both single meshes and groups ***
function handleTextureLoad(e) {
  const file = e.target.files[0];
  const tgt = App.ui.textureTarget; // set by textures panel
  
  // Check for 'object' (which can be a Mesh or Group) instead of 'mesh'
  if (!file || !tgt?.object) return;

  const url = URL.createObjectURL(file);
  
  // Helper function to apply texture to a material
  const applyTextureToMaterial = (mat, tex, mapType) => {
    if (mat && mat.isMeshStandardMaterial) {
      mat[mapType] = tex;
      mat.needsUpdate = true;
    } else if (mat) {
      // Handle non-standard or multi-materials if needed
    }
  };

  App.loaders.textureLoader.load(
    url,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.needsUpdate = true;
      
      const targetObject = tgt.object;
      const mapType = tgt.type;
      let appliedCount = 0;

      if (targetObject.isMesh) {
        // --- 1. Apply to a single mesh ---
        const materials = Array.isArray(targetObject.material) ? targetObject.material : [targetObject.material];
        materials.forEach(mat => applyTextureToMaterial(mat, tex, mapType));
        appliedCount = 1;

      } else if (targetObject.isGroup) {
        // --- 2. Apply to all meshes in a group ---
        targetObject.traverse(o => {
          if (o.isMesh) {
            const materials = Array.isArray(o.material) ? o.material : [o.material];
            materials.forEach(mat => applyTextureToMaterial(mat, tex, mapType));
            appliedCount++;
          }
        });
      }

      alert(`Applied ${mapType} to ${appliedCount} mesh(es).`);
      URL.revokeObjectURL(url);
    },
    undefined,
    (err) => {
      alert('Texture load failed.');
      URL.revokeObjectURL(url);
    }
  );

  e.target.value = '';
}
