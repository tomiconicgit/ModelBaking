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
          <button class="button ghost btn-connect" style="flex:1; min-height:38px;">Connect to Bone</button>
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

    list.querySelectorAll('.btn-connect').forEach(b => b.addEventListener('click', e => {
      const mesh = find(e);
      if (!mesh) return;

      const hasSkeleton = (object) => {
        let v = false;
        object.traverse(o => { if (o.isSkinnedMesh || o.isBone) v = true; });
        return v;
      };

      const otherModels = Object.entries(App.models)
        .filter(([id]) => id !== App.activeModelId && hasSkeleton(App.models[id].gltf.scene));
      
      if (!otherModels.length) {
        return alert('No other models with skeletons are loaded to connect to.');
      }

      const modal = document.getElementById('bone-connect-modal');
      const objectNameEl = document.getElementById('bone-connect-object-name');
      const modelSelect = document.getElementById('bone-connect-target-model');
      const boneSelect = document.getElementById('bone-connect-target-bone');
      const confirmBtn = document.getElementById('confirm-bone-connect-btn');
      const cancelBtn = document.getElementById('cancel-bone-connect-btn');

      objectNameEl.textContent = `"${mesh.name || '(unnamed mesh)'}"`;
      modelSelect.innerHTML = otherModels.map(([id, m]) => `<option value="${id}">${m.fileInfo.name}</option>`).join('');

      function populateBones() {
        const selectedModelId = modelSelect.value;
        const targetModel = App.models[selectedModelId];
        if (!targetModel) { boneSelect.innerHTML = ''; return; }
        
        const bones = [];
        targetModel.gltf.scene.traverse(o => { if (o.isBone) bones.push(o); });
        boneSelect.innerHTML = bones.map(bone => `<option value="${bone.uuid}">${bone.name}</option>`).join('');
      }

      modelSelect.onchange = populateBones;
      populateBones();

      confirmBtn.onclick = () => {
        const boneUuid = boneSelect.value;
        const modelId = modelSelect.value;
        if (!boneUuid || !modelId) return alert('Please select a target bone.');

        const targetModel = App.models[modelId];
        const targetBone = targetModel.gltf.scene.getObjectByProperty('uuid', boneUuid);
        if (!targetBone) return alert('Target bone not found.');

        App.attachObjectToBone(mesh, targetBone, { mode: 'snap' });
        modal.classList.add('hidden');
      };
    
      cancelBtn.onclick = () => modal.classList.add('hidden');
      modal.classList.remove('hidden');
    }));

    function find(e) {
      const m = App.getActive();
      const uuid = e.target.closest('.mesh-card')?.dataset.uuid;
      return m ? m.gltf.scene.getObjectByProperty('uuid', uuid) : null;
    }
  }

  function deleteSingleMesh(mesh) {
    if (!mesh) return;
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
