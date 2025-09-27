import { App } from './viewer.js';

export function mountTextures(refreshOnly=false){
  const el = document.getElementById('texture-panel');
  if (!refreshOnly){
    el.innerHTML = `<div id="texture-panel-content"></div>`;
  }
  refresh();

  function refresh(){
    const container = document.getElementById('texture-panel-content');
    const m = App.models[App.activeModelId];
    if (!m){ container.innerHTML = '<div style="opacity:.7">Select an active model from Tabs.</div>'; return; }

    const meshes=[]; m.gltf.scene.traverse(o=>{ if (o.isMesh) meshes.push(o); });
    const textureTypes = [
      {key:'map', name:'Albedo'}, {key:'normalMap', name:'Normal'},
      {key:'metalnessMap', name:'Metalness'}, {key:'roughnessMap', name:'Roughness'},
      {key:'aoMap', name:'AO'}, {key:'emissiveMap', name:'Emissive'}
    ];

    container.innerHTML = `
      <label>Target Mesh
        <select id="texture-mesh-select" style="width:100%;height:44px;border-radius:10px;border:1px solid #2a2f36;background:#232933;color:#fff;padding:0 10px">
          ${meshes.map(ms=> `<option value="${ms.uuid}">${ms.name || ms.uuid}</option>`).join('')}
        </select>
      </label>
      <div class="button-group" style="margin-top:10px">
        ${textureTypes.map(t=> `<button class="button ghost upload-texture-btn" data-type="${t.key}">${t.name}</button>`).join('')}
      </div>
    `;

    container.querySelectorAll('.upload-texture-btn').forEach(btn=>{
      btn.addEventListener('click', e=>{
        const meshUUID = document.getElementById('texture-mesh-select').value;
        const mesh = m.gltf.scene.getObjectByProperty('uuid', meshUUID);
        App.ui.textureTarget = { mesh, type:e.target.dataset.type };
        document.getElementById('texture-input').click();
      });
    });
  }
}