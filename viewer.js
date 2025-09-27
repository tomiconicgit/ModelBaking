// viewer.js
// ... (imports at the top)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js'; // <-- ADD THIS IMPORT

/* -------------------------------------------------------
   Public singleton
------------------------------------------------------- */
export const App = {
  // ... (rest of the App object is unchanged)
  // ...
};

// ... (rest of the file until after the 'bakeOrigin' function)

/* -------------------------------------------------------
   NEW MESH SIMPLIFICATION LOGIC
------------------------------------------------------- */
App.simplifyMesh = function(meshUuid, ratio) {
  const m = App.getActive();
  if (!m) return alert('No active model found.');

  const mesh = m.gltf.scene.getObjectByProperty('uuid', meshUuid);
  if (!mesh || !mesh.isMesh) return alert('Target mesh not found.');
  
  // The modifier requires an indexed BufferGeometry.
  if (!mesh.geometry.index) {
    return alert('Simplification requires an indexed geometry. This mesh cannot be simplified.');
  }
  
  // Clone the original geometry so we can restore it if needed (future feature)
  if (!mesh.userData.originalGeometry) {
      mesh.userData.originalGeometry = mesh.geometry.clone();
  }
  
  // If the user slides back to 100%, restore the original high-poly mesh
  if (ratio >= 0.99) {
      mesh.geometry.dispose(); // Dispose the current (possibly simplified) geometry
      mesh.geometry = mesh.userData.originalGeometry.clone();
  } else {
    const modifier = new SimplifyModifier();
    const originalCount = mesh.userData.originalGeometry.index.count / 3;
    const targetCount = Math.round(originalCount * ratio);
    
    // Create a new simplified geometry from the original
    const simplifiedGeometry = modifier.modify(mesh.userData.originalGeometry.clone(), targetCount);
    
    mesh.geometry.dispose(); // Clean up the old one
    mesh.geometry = simplifiedGeometry;
  }
  
  // After simplifying, we need to recalculate the model's stats and refresh the UI
  const newStats = calculateModelStats(m.gltf.scene);
  m.fileInfo.polygons = newStats.polygons;
  m.fileInfo.vertices = newStats.vertices;
  App.events.dispatchEvent(new Event('dashboard:refresh')); // Update dashboard stats
  App.events.dispatchEvent(new Event('meshes:refresh')); // Re-render the meshes panel
};

/* -------------------------------------------------------
   Small helpers (exported + on App)
------------------------------------------------------- */
export function formatBytes(bytes, decimals = 2) {
// ... (rest of the file is unchanged)
