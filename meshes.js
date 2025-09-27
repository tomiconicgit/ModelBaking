// meshes.js
import { App } from './viewer.js';

export function mountMeshes(refreshOnly=false){
  const el = document.getElementById('mesh-panel');
  if (!refreshOnly){
    el.innerHTML = `
      <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 class="panel-title" style="margin:0;">Meshes</h3>
        <button id="multi-delete-mesh-btn" class="button accent">Remove Selected</button>
      </div>
      <div id="mesh-list" style="display:flex; flex-direction:column; gap:8px;"></div>
    `;
    document.getElementById('multi-delete-mesh-btn').addEventListener('click', ()=>{
      const checked = el.querySelectorAll('.mesh-select:checked');
      if (!checked.length) return alert('No meshes selected.');
      if (!confirm(`Delete ${checked.length} mesh(es)? This cannot be undone.`)) return;
      checked.forEach(box=> {
        const m = App.getActive();
        const mesh = m?.gltf.scene.getObjectByProperty('uuid', box.closest('.mesh-card').dataset.uuid);
        if (mesh) deleteSingleMesh(mesh);
      });
      // ** THE FIX **: After batch deleting, recalculate stats and refresh all panels
      const m = App.getActive();
      if (m) {
        const newStats = App.calculateModelStats(m.gltf.scene);
        m.fileInfo.polygons = newStats.polygons;
        m.fileInfo.vertices = newStats.vertices;
        App.events.dispatchEvent(new Event('panels:refresh-all'));
      }
    });

    App.events.addEventListener('panels:refresh-all', refresh);
  }
  refresh();

  function refresh(){
    // ... (rest of refresh function is unchanged) ...
  }

  // Helper for deleting a single mesh object and its assets
  function deleteSingleMesh(mesh) {
    if (!mesh) return;
    if (mesh.userData.originalGeometry) {
        mesh.userData.originalGeometry.dispose();
    }
    mesh.parent?.remove(mesh);
    mesh.geometry?.dispose?.();
    if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat?.dispose?.());
    } else {
        mesh.material?.dispose?.();
    }
  }

  // Main function called by UI buttons
  function deleteMesh(uuid){
    const m = App.getActive();
    if (!m) return;
    const mesh = m.gltf.scene.getObjectByProperty('uuid', uuid);
    if (!mesh) return;
    
    deleteSingleMesh(mesh);

    // ** THE FIX **: After deleting, recalculate stats and refresh all panels
    const newStats = App.calculateModelStats(m.gltf.scene);
    m.fileInfo.polygons = newStats.polygons;
    m.fileInfo.vertices = newStats.vertices;
    App.events.dispatchEvent(new Event('panels:refresh-all'));
  }
}
