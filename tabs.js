// tabs.js
import { App, formatBytes } from './viewer.js';

export function mountTabs(refreshOnly=false){
  const el = document.getElementById('tabs-panel');
  if (!refreshOnly){ 
    el.innerHTML = `<div id="tabs-list" style="display:flex; flex-direction:column; gap:12px;"></div>`; 
    App.events.addEventListener('panels:refresh-all', refresh);
  }
  refresh();

  function refresh(){
    const list = document.getElementById('tabs-list');
    const ids = Object.keys(App.models);
    if (!ids.length){ list.innerHTML = '<div style="color:var(--fg-light); text-align:center; padding: 20px 0;">No models loaded.</div>'; return; }
    
    // Helper to check for a skeleton
    const hasSkeleton = (object) => {
      let v = false;
      object.traverse(o => { if (o.isSkinnedMesh || o.isBone) v = true; });
      return v;
    };

    const modelsWithSkeletons = Object.entries(App.models).filter(([, m]) => hasSkeleton(m.gltf.scene));

    list.innerHTML = ids.map(id=>{
      const m = App.models[id]; 
      const isActive = id === App.activeModelId;
      const otherModelsWithSkeletonsExist = modelsWithSkeletons.some(([otherId]) => otherId !== id);

      return `
        <div style="background:var(--surface-bg); border:1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}; border-radius:var(--radius-md); padding:16px; box-shadow:${isActive ? '0 0 10px rgba(0,122,255,0.3)' : 'none'}; transition: border .2s, box-shadow .2s;">
          <h3 style="margin:0 0 12px; font-size:1.1rem; word-break:break-all;">${m.fileInfo.name}</h3>
          
          <div style="font-size:0.85rem; color:var(--fg-light); display:grid; grid-template-columns:auto 1fr; gap:4px 12px; margin-bottom: 16px;">
            <strong>Size:</strong><span>${formatBytes(m.fileInfo.size)}</span>
            <strong>Polygons:</strong><span>${m.fileInfo.polygons.toLocaleString()}</span>
            <strong>Vertices:</strong><span>${m.fileInfo.vertices.toLocaleString()}</span>
          </div>

          <div class="button-group">
            <button class="button btn-activate" ${isActive ? 'disabled' : ''} data-id="${id}" style="flex:1;">Activate</button>
            <button class="button ghost btn-attach" data-id="${id}" style="flex:1;" ${!otherModelsWithSkeletonsExist ? 'disabled' : ''}>Attach to Bone</button>
            <button class="button accent btn-close" data-id="${id}" style="flex:1;">Close</button>
          </div>
        </div>`;
    }).join('');

    list.querySelectorAll('.btn-activate').forEach(b=> b.onclick = ()=>{ App.setActiveModel(b.dataset.id); App.events.dispatchEvent(new Event('panels:refresh-all')); });
    list.querySelectorAll('.btn-close').forEach(b=> b.onclick = ()=> removeModel(b.dataset.id));
    
    list.querySelectorAll('.btn-attach').forEach(b => b.addEventListener('click', e => {
      const modelIdToAttach = e.target.dataset.id;
      const modelToAttach = App.models[modelIdToAttach];
      if (!modelToAttach) return;

      const otherModels = modelsWithSkeletons.filter(([id]) => id !== modelIdToAttach);
      
      if (!otherModels.length) {
        return alert('No other models with skeletons are available to attach to.');
      }

      const modal = document.getElementById('bone-connect-modal');
      const objectNameEl = document.getElementById('bone-connect-object-name');
      const modelSelect = document.getElementById('bone-connect-target-model');
      const boneSelect = document.getElementById('bone-connect-target-bone');
      const confirmBtn = document.getElementById('confirm-bone-connect-btn');
      const cancelBtn = document.getElementById('cancel-bone-connect-btn');

      objectNameEl.textContent = `model "${modelToAttach.fileInfo.name}"`;
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
      
      confirmBtn.onclick = () => {
        const boneUuid = boneSelect.value;
        const modelId = modelSelect.value;
        if (!boneUuid || !modelId) return alert('Please select a target bone.');

        const targetModel = App.models[modelId];
        const targetBone = targetModel.gltf.scene.getObjectByProperty('uuid', boneUuid);

        if (!targetBone) return alert('Target bone not found.');
        
        App.reparentModelToBone(modelIdToAttach, targetBone);
        modal.classList.add('hidden');
      };
    
      cancelBtn.onclick = () => {
        modal.classList.add('hidden');
      };

      populateBones();
      modal.classList.remove('hidden');
    }));
  }

  function removeModel(id){
    const m = App.models[id]; if (!m) return;
    if (!confirm(`Are you sure you want to close "${m.fileInfo.name}"? All unsaved changes will be lost.`)) return;
    
    const sc = m.gltf.scene;
    sc.traverse(o=>{
      if (o.isMesh){ o.geometry?.dispose?.(); if (Array.isArray(o.material)) o.material.forEach(mm=>mm?.dispose?.()); else o.material?.dispose?.(); }
    });
    sc.parent && sc.parent.remove(sc);
    if (m.skeletonHelper) sc.parent && sc.parent.remove(m.skeletonHelper);
    delete App.models[id];
    if (App.activeModelId===id){ const ids = Object.keys(App.models); App.activeModelId = ids[0] || null; }
    App.events.dispatchEvent(new Event('panels:refresh-all'));
  }
}
