import { App } from './viewer.js';

export function mountMeshes(refreshOnly=false){
  const el = document.getElementById('mesh-panel');
  if (!refreshOnly){
    el.innerHTML = `
      <div class="button-group" style="margin-bottom:10px">
        <button id="multi-delete-mesh-btn" class="button accent">Remove Selected</button>
      </div>
      <div id="mesh-list"></div>
    `;
    document.getElementById('multi-delete-mesh-btn').addEventListener('click', ()=>{
      const checked = el.querySelectorAll('.mesh-select:checked');
      if (!checked.length) return alert('No meshes selected.');
      if (!confirm(`Delete ${checked.length} mesh(es)?`)) return;
      checked.forEach(box=> deleteMesh(box.closest('.row').dataset.uuid));
      refresh();
    });
  }
  refresh();

  function refresh(){
    const m = App.models[App.activeModelId];
    const list = document.getElementById('mesh-list');
    if (!m){ list.innerHTML = '<div style="opacity:.7">Select an active model from Tabs.</div>'; return; }

    const meshes=[]; m.gltf.scene.traverse(o=>{ if (o.isMesh) meshes.push(o); });
    list.innerHTML = meshes.map(ms=>`
      <div class="row" data-uuid="${ms.uuid}" style="display:flex;gap:8px;align-items:center;padding:8px;border-bottom:1px solid #222">
        <input type="checkbox" class="mesh-select">
        <div style="flex:1">${ms.name || '(no name)'}</div>
        <div class="button-group">
          <button class="button ghost btn-vis">${ms.visible?'Hide':'Show'}</button>
          <button class="button ghost btn-rename">Rename</button>
          <button class="button ghost btn-connect">Connect to Bone</button>
          <button class="button accent btn-del">Delete</button>
        </div>
      </div>`).join('');

    list.querySelectorAll('.btn-vis').forEach(b=> b.addEventListener('click', e=>{
      const mesh = find(e); mesh.visible = !mesh.visible; refresh();
    }));
    list.querySelectorAll('.btn-rename').forEach(b=> b.addEventListener('click', e=>{
      const mesh = find(e); const nn = prompt('Enter new name:', mesh.name); if (nn){ mesh.name = nn; refresh(); }
    }));
    list.querySelectorAll('.btn-del').forEach(b=> b.addEventListener('click', e=>{
      deleteMesh(e.target.closest('.row').dataset.uuid); refresh();
    }));
    list.querySelectorAll('.btn-connect').forEach(b=> b.addEventListener('click', ()=>{
      const modal = document.getElementById('bone-connect-modal');
      const meshRow = b.closest('.row'); const meshName = find({target:b}).name || '(unnamed)';
      document.getElementById('bone-connect-mesh-name').textContent = `"${meshName}"`;
      // build model + bone selects
      const other = Object.entries(App.models).filter(([id])=> id!==App.activeModelId);
      if (!other.length) return alert('No other models with skeletons available.');
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
        const boneUUID = document.getElementById('bone-connect-target-bone').value;
        const bone = mdlScene(targetModelSel.value).getObjectByProperty('uuid', boneUUID);
        const mesh = find({target:b});
        if (bone && mesh){ bone.attach(mesh); alert(`Connected "${meshName}" -> "${bone.name || bone.uuid}"`); }
        modal.classList.add('hidden');
      };
      document.getElementById('cancel-bone-connect-btn').onclick = ()=> modal.classList.add('hidden');

      function mdlScene(id){ return App.models[id].gltf.scene; }
    }));

    function find(e){ const uuid = e.target.closest('.row').dataset.uuid; return m.gltf.scene.getObjectByProperty('uuid', uuid); }
  }

  function deleteMesh(uuid){
    const m = App.models[App.activeModelId]; const mesh = m?.gltf.scene.getObjectByProperty('uuid', uuid);
    if (!mesh) return;
    mesh.parent.remove(mesh); mesh.geometry?.dispose?.();
    if (Array.isArray(mesh.material)) mesh.material.forEach(mm=>mm?.dispose?.()); else mesh.material?.dispose?.();
  }
}