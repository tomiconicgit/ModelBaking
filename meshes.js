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

      // After batch deleting, recalculate stats and refresh all panels
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

    const meshes = [];
    m.gltf.scene.traverse(o => { if (o.isMesh) meshes.push(o); });

    list.innerHTML = meshes.map(ms => `
      <div class="mesh-card" data-uuid="${ms.uuid}" style="background:var(--surface-bg); border-radius:var(--radius-md); border:1px solid var(--border); padding:10px;">
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">
          <input type="checkbox" class="mesh-select" style="width:20px; height:20px; flex-shrink:0;">
          <div style="flex:1; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ms.name || '(unnamed mesh)'}</div>
          <button class="button ghost btn-vis" style="min-height:38px; padding: 0 12px;">${ms.visible ? 'Hide' : 'Show'}</button>
          <button class="button accent btn-del" style="min-height:38px; padding: 0 12px;">Delete</button>
        </div>
        <div class="button-group">
          <button class="button ghost btn-rename" style="flex:1; min-height:38px;">Rename</button>
          <button class="button ghost btn-connect" style="flex:1; min-height:38px;">Connect&nbsp;to&nbsp;Bone</button>
        </div>
        
        <div class="simplification-controls" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h5 style="margin: 0; font-size: 0.9rem; color: var(--fg-light);">Simplify Mesh (LOD)</h5>
            <span class="simplify-ratio-label" style="font-variant-numeric: tabular-nums;">100%</span>
          </div>
          <input type="range" class="simplify-slider" min="0" max="1" step="0.01" value="1" style="width: 100%;">
          <button class="button ghost btn-simplify" style="width: 100%; min-height: 44px; margin-top: 10px;">Apply Simplification</button>
        </div>
      </div>`).join('');

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

    list.querySelectorAll('.mesh-card').forEach(card => {
        const slider = card.querySelector('.simplify-slider');
        const label = card.querySelector('.simplify-ratio-label');
        const button = card.querySelector('.btn-simplify');
        const uuid = card.dataset.uuid;

        slider.addEventListener('input', () => {
            const ratio = parseFloat(slider.value);
            label.textContent = `${(ratio * 100).toFixed(0)}%`;
        });

        button.addEventListener('click', () => {
            const ratio = parseFloat(slider.value);
            if (!confirm(`This will permanently modify the mesh for this session. Simplify to ${(ratio*100).toFixed(0)}%?`)) {
                return;
            }
            App.simplifyMesh(uuid, ratio);
        });
    });

    function find(e) {
      const m = App.getActive();
      const uuid = e.target.closest('.mesh-card')?.dataset.uuid;
      return m ? m.gltf.scene.getObjectByProperty('uuid', uuid) : null;
    }
  }

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
