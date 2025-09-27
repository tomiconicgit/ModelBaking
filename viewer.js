// viewer.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';

// ... (rest of the file is unchanged until App.simplifyMesh) ...
// ...

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
  
  // Recalculate the model's stats
  const newStats = calculateModelStats(m.gltf.scene);
  m.fileInfo.polygons = newStats.polygons;
  m.fileInfo.vertices = newStats.vertices;

  // ** THE FIX **: Fire the single global event to refresh all panels at once.
  App.events.dispatchEvent(new Event('panels:refresh-all'));
};

/* -------------------------------------------------------
   Small helpers (exported + on App)
------------------------------------------------------- */
// ... (rest of the file is unchanged) ...
