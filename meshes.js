// meshes.js
import { App } from './viewer.js';

export function mountMeshes(refreshOnly = false) {
  const el = document.getElementById('mesh-panel');
  if (!refreshOnly) {
    el.innerHTML = `
      <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 class="panel-title" style="margin:0;">Meshes</h3>
        <button id="multi-delete-mesh-btn" class="button accent">Remove Selected</button>
      </div>
      <p style="color:var(--fg-light); margin:-12px 0 16px; font-size:0.9rem;">Select an object to transform or texturize.</p>
      <div id="mesh-list" style="display:flex; flex-direction:column; gap:8px;"></div>
    `;

    document.getElementById('multi-delete-mesh-btn').addEventListener('click', () => {
      const checked = el.querySelectorAll('.mesh-select:checked');
      if (!checked.length) return alert('No meshes selected.');
      if (!confirm(`Delete ${checked.length} mesh(es)? This cannot be undone.`)) return;

      checked.forEach(box => {
        const m = App.getActive();
        const mesh = m?.gltf.scene.getObjectByProperty('uuid', box.closest('.mesh-card').dataset.uuid);
        if (mesh) deleteSingleMesh(mesh);
      });

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

  function refresh() {
    const m = App.models[App.activeModelId];
    const list = document.getElementById('mesh-list');
    if (!m) {
      list.innerHTML = '<div style="color:var(--fg-light); text-align:center; padding: 20px 0;">Select an active model from Tabs.</div>';
      return;
    }

    const activeObject = App.activeObject;
    let html = '';

    // --- NEW: Add "Whole Model" as a selectable item ---
    const modelActive = (activeObject === m.anchor);
    html += `
      <div class="mesh-card mesh-card-select" 
           data-uuid="${m.anchor.uuid}" 
           data-type="model"
           style="border-width: 2px; border-style: solid; cursor: pointer;
                  border-color: ${modelActive ? 'var(--primary)' : 'var(--border)'};
                  background: ${modelActive ? 'var(--surface-bg)' : 'var(--panel-bg)'};">
        <strong style="font-size: 1.1em; color: ${modelActive ? 'var(--primary)' : 'var(--fg)'};">
          (Whole Model) ${m.fileInfo.name}
        </strong>
      </div>
    `;

    const meshes = [];
    m.gltf.scene.traverse(o => { if (o.isMesh) meshes.push(o); });

    html += meshes.map(ms => {
      const isActive = (activeObject && activeObject.uuid === ms.uuid);
      return `
      <div class="mesh-card" data-uuid="${ms.uuid}" 
           style="background:var(--surface-bg); border-radius:var(--radius-md); 
                  border: 2px solid ${isActive ? 'var(--primary)' : 'var(--border)'};">
        
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">
          <input type="checkbox" class="mesh-select" style="width:20px; height:20px; flex-shrink:0;">
          
          <div class="mesh-card-select" data-type="mesh" data-uuid="${ms.uuid}"
               style="flex:1; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:pointer;">
            ${ms.name || '(unnamed mesh)'}
          </div>

          <button class="button ghost btn-vis" style="min-height:38px; padding: 0 12px;">${ms.visible ? 'Hide' : 'Show'}</button>
          <button class="button accent btn-del" style="min-height:38px; padding: 0 12px;">Delete</button>
        </div>
        <div class="button-group">
          <button class="button ghost btn-rename" style="flex:1; min-height:38px;">Rename</button>
          <button class="button ghost btn-connect" style="flex:1; min-height:38px;">Connect to Bone</button>
        </div>
      </div>`
    }).join('');

    list.innerHTML = html;

    // --- NEW: Global selection handler ---
    list.querySelectorAll('.mesh-card-select').forEach(card => {
      card.addEventListener('click', (e) => {
        // Stop if a button inside the card was clicked
        if (e.target.closest('button')) return;

        const targetCard = e.currentTarget;
        const uuid = targetCard.dataset.uuid;
        const type = targetCard.dataset.type;
        
        const m = App.getActive(); // Get model again
        if (!m) return;

        if (type === 'model') {
          App.setActiveObject(m.anchor);
        } else {
          const mesh = m.gltf.scene.getObjectByProperty('uuid', uuid);
          if (mesh) App.setActiveObject(mesh);
        }
      });
    });

    // --- Existing button handlers ---
    list.querySelectorAll('.btn-vis').forEach(b => b.addEventListener('click', e => {
      const mesh = find(e);
      if (mesh) mesh.visible = !mesh.visible;
      refresh();
    }));
    list.querySelectorAll('.btn-rename').forEach(b => b.addEventListener('click', e => {
      const mesh = find(e);
      if (!mesh) return;
      const newName = prompt('Enter new name:', mesh.name);
      if (newName !== null && newName.trim()) {
        mesh.name = newName.trim();
        refresh();
      }
    }));
    list.querySelectorAll('.btn-del').forEach(b => b.addEventListener('click', e => {
      if (confirm('Delete this mesh? This cannot be undone.')) {
        deleteMesh(e.target.closest('.mesh-card').dataset.uuid);
      }
    }));

    list.querySelectorAll('.btn-connect').forEach(b => b.addEventListener('click', e => {
      const mesh = find(e);
      if (!mesh) return;
      // (Rest of connect logic is unchanged)
      // ...
    }));

    function find(e) {
      const m = App.getActive();
      const uuid = e.target.closest('.mesh-card')?.dataset.uuid;
      return m ? m.gltf.scene.getObjectByProperty('uuid', uuid) : null;
    }
  }

  function deleteSingleMesh(mesh) {
    if (!mesh) return;
    // If we delete the active object, deselect it
    if (App.activeObject === mesh) {
      App.setActiveObject(App.getActive()?.anchor || null);
    }
    mesh.parent?.remove(mesh);
    mesh.geometry?.dispose?.();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(mat => mat?.dispose?.());
    } else {
      mesh.material?.dispose?.();
    }
  }

  function deleteMesh(uuid) {
    const m = App.getActive();
    if (!m) return;
    const mesh = m.gltf.scene.getObjectByProperty('uuid', uuid);
    if (!mesh) return;

    deleteSingleMesh(mesh);

    const newStats = App.calculateModelStats(m.gltf.scene);
    m.fileInfo.polygons = newStats.polygons;
    m.fileInfo.vertices = newStats.vertices;
    App.events.dispatchEvent(new Event('panels:refresh-all'));
  }
}
