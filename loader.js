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
          // Use App.addModel so we get the anchor wrapper + stats + helpers
          App.addModel(gltf, { name: file.name, size: file.size });
          // Panels refresh (tabs, dashboard, etc.)
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
        // Replace existing animation if present
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

function handleTextureLoad(e) {
  const file = e.target.files[0];
  const tgt = App.ui.textureTarget; // set by textures panel
  if (!file || !tgt?.mesh) return;

  const url = URL.createObjectURL(file);
  App.loaders.textureLoader.load(
    url,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false;
      // *** ADDED for UV Scaling ***
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.needsUpdate = true;
      // ***************************

      if (!tgt.mesh.material || !tgt.mesh.material.isMeshStandardMaterial) {
        alert('Target mesh does not use a standard material.');
        URL.revokeObjectURL(url);
        return;
      }
      tgt.mesh.material[tgt.type] = tex;
      tgt.mesh.material.needsUpdate = true;
      alert(`Applied ${tgt.type}.`);
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
