import { App } from './viewer.js';

export function mountMeshes(refreshOnly=false){
  const el = document.getElementById('mesh-panel');
  if (!refreshOnly){
    el.innerHTML = `
      <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 class="panel-title" style="margin:0;">Meshes</h3>
        <button id="multi-delete-mesh-btn" class="button accent">Remove Selected</button>
      </div>
      <div id="mesh-list" style="display:flex; flex-direction:column; gap:12px;"></div>
    `;
    document.getElementById('multi-delete-mesh-btn').addEventListener('click', ()=>{
      const checked = el.querySelectorAll('.mesh-select:checked');
      if (!checked.length) return alert('No meshes selected.');
      if (!confirm(`Delete ${checked.length} mesh(es)? This cannot be undone.`)) return;
      checked.forEach(box=> deleteMesh(box.closest('.mesh-card').dataset.uuid));
      refresh();
    });
  }
  refresh();

  function refresh(){
    const m = App.models[App.activeModelId];
    const list = document.getElementById('mesh-list');
    if (!m){ list.innerHTML = '<div style="color:var(--fg-light); text-align:center; padding: 20px 0;">Select an active model from Tabs.</div>'; return; }

    const meshes=[]; m.gltf.scene.traverse(o=>{ if (o.isMesh) meshes.push(o); });
    list.innerHTML = meshes.map(ms=>`
      <div class="mesh-card" data-uuid="${ms.uuid}" style="background:var(--surface-bg); border-radius:var(--radius-md); border:1px solid var(--border); padding:12px;">
        <div style="display:flex; gap:12px; align-items:center;">
          <input type="checkbox" class="mesh-select" style="width:20px; height:20px;">
          <div style="flex:1; font-weight:500;">${ms.name || '(unnamed mesh)'}</div>
          <button class="button ghost btn-vis" style="min-height:40px; padding: 0 12px;">${ms.visible?'Hide':'Show'}</button>
        </div>
        <div class="button-group" style="margin-top:12px; border-top:1px solid var(--border); padding-top:12px;">
          <button class="button ghost btn-rename" style="flex:1;">Rename</button>
          <button class="button ghost btn-connect" style="flex:1;">Connect&nbsp;to&nbsp;Bone</button>
          <button class="button accent btn-del" style="flex:0;">Delete</button>
        </div>
      </div>`).join('');

    list.querySelectorAll('.btn-vis').forEach(b=> b.addEventListener('click', e=>{
      const mesh = find(e); mesh.visible = !mesh.visible; refresh();
    }));
    list.querySelectorAll('.btn-rename').forEach(b=> b.addEventListener('click', e=>{
      const mesh = find(e); const nn = prompt('Enter new name:', mesh.name); if (nn !== null && nn.trim()){ mesh.name = nn.trim(); refresh(); }
    }));
    list.querySelectorAll('.btn-del').forEach(b=> b.addEventListener('click', e=>{
        if (confirm('Delete this mesh? This cannot be undone.')) {
            deleteMesh(e.target.closest('.mesh-card').dataset.uuid); refresh();
        }
    }));
    list.querySelectorAll('.btn-connect').forEach(b=> b.addEventListener('click', ()=>{
      const modal = document.getElementById('bone-connect-modal');
      const meshRow = b.closest('.mesh-card'); const meshName = find({target:b}).name || '(unnamed)';
      document.getElementById('bone-connect-mesh-name').textContent = `"${meshName}"`;
      // build model + bone selects
      const other = Object.entries(App.models).filter(([id])=> id!==App.activeModelId);
      if (!other.length) return alert('No other models with skeletons are available to connect to.');
      const targetModelSel = document.getElementById('bone-connect-target-model');
      targetModelSel.innerHTML = other.map(([id,mm])=> `<option value="${id}">${mm.fileInfo.name}</option>`).join('');
      const fillBones=()=>{
        const mdl = App.models[targetModelSel.value];
        const bones=[]; mdl.gltf.scene.traverse(o=>{ if (o.isBone) bones.push(o); });
        const boneSel = document.getElementById('bone-connect-target-bone');
        boneSel.innerHTML = bones.map(b=> `<option value="${b.uuid}">${b.name || b.uuid}</option>`).join('');
      };
      targetModelSel.onchange = fillBones; fillBones();
      modal.classList.remove('hidden');

      document.getElementById('confirm-bone-connect-btn').onclick = ()=>{
        const targetModelId = document.getElementById('bone-connect-target-model').value;
        const boneUUID = document.getElementById('bone-connect-target-bone').value;
        const bone = mdlScene(targetModelId).getObjectByProperty('uuid', boneUUID);
        const mesh = find({target:b});
        if (bone && mesh){ bone.attach(mesh); alert(`Connected "${meshName}" to bone "${bone.name || bone.uuid}"`); }
        modal.classList.add('hidden');
      };
      document.getElementById('cancel-bone-connect-btn').onclick = ()=> modal.classList.add('hidden');

      function mdlScene(id){ return App.models[id].gltf.scene; }
    }));

    function find(e){ const uuid = e.target.closest('.mesh-card').dataset.uuid; return m.gltf.scene.getObjectByProperty('uuid', uuid); }
  }

  function deleteMesh(uuid){
    const m = App.models[App.activeModelId]; const mesh = m?.gltf.scene.getObjectByProperty('uuid', uuid);
    if (!mesh) return;
    mesh.parent.remove(mesh); mesh.geometry?.dispose?.();
    if (Array.isArray(mesh.material)) mesh.material.forEach(mm=>mm?.dispose?.()); else mesh.material?.dispose?.();
  }
}
