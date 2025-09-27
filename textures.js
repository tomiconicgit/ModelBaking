import { App } from './viewer.js';

export function mountTextures(refreshOnly=false){
  const root = document.getElementById('texture-panel');
  if (!refreshOnly){
    root.innerHTML = `<div id="texture-panel-content"></div>`;
  }
  render();

  function render(){
    const container = document.getElementById('texture-panel-content');
    const m = App.models[App.activeModelId];
    if (!m){ container.innerHTML = '<div style="color:var(--fg-light); text-align:center; padding: 20px 0;">Select an active model from Tabs.</div>'; return; }

    const meshes=[]; m.gltf.scene.traverse(o=>{ if (o.isMesh) meshes.push(o); });
    const textureTypes = [
      { key: 'map', name: 'Albedo' }, { key: 'normalMap', name: 'Normal' },
      { key: 'metalnessMap', name: 'Metalness' }, { key: 'roughnessMap', name: 'Roughness' },
      { key: 'aoMap', name: 'AO' }, { key: 'emissiveMap', name: 'Emissive' }
    ];

    container.innerHTML = `
      <div class="form-group">
        <label for="texture-mesh-select">Target Mesh</label>
        <select id="texture-mesh-select" ${!meshes.length ? 'disabled' : ''}>
          ${meshes.length ? meshes.map(ms => `<option value="${ms.uuid}">${ms.name || ms.uuid}</option>`).join('') : '<option>No meshes found in model</option>'}
        </select>
      </div>
      <div id="material-controls-wrapper" style="margin-bottom:24px; padding-bottom: 24px; border-bottom:1px solid var(--border)"></div>

      <h3 class="panel-title" style="margin-bottom:16px;">Upload Texture Maps</h3>
      <div class="button-group" style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
        ${textureTypes.map(t => `<button class="button ghost upload-texture-btn" data-type="${t.key}">${t.name}</button>`).join('')}
      </div>
    `;

    const meshSel = document.getElementById('texture-mesh-select');
    const selectedMesh = ()=> m.gltf.scene.getObjectByProperty('uuid', meshSel.value);

    // Material editor
    const applyMatUI = (mesh)=>{
      const wrapper = document.getElementById('material-controls-wrapper');
      if (!mesh || !mesh.material || !mesh.material.isMeshStandardMaterial) {
        wrapper.innerHTML = '<div style="color:var(--fg-light); text-align:center; padding:20px 0;">Selected mesh has no editable material properties.</div>';
        return;
      }
      const mat = mesh.material;
      wrapper.innerHTML = `
        <div class="material-group">
          <h3 class="panel-title">Material Properties</h3>
          
          <div class="slider-row">
            <label for="mat-color">Color</label>
            <input type="color" id="mat-color" value="#${mat.color.getHexString()}" style="height:44px; padding:4px; border-radius:var(--radius-sm); background:transparent;">
          </div>
          <div class="slider-row">
            <label>Metal</label>
            <span id="mat-metalness-val">${mat.metalness.toFixed(2)}</span>
            <input type="range" id="mat-metalness" min="0" max="1" step="0.01" value="${mat.metalness}">
          </div>
          <div class="slider-row">
            <label>Rough</label>
            <span id="mat-roughness-val">${mat.roughness.toFixed(2)}</span>
            <input type="range" id="mat-roughness" min="0" max="1" step="0.01" value="${mat.roughness}">
          </div>

          <h3 class="panel-title" style="margin-top:24px;">Emissive</h3>
          <div class="slider-row">
            <label for="mat-emissive">Color</label>
            <input type="color" id="mat-emissive" value="#${mat.emissive.getHexString()}" style="height:44px; padding:4px; border-radius:var(--radius-sm); background:transparent;">
          </div>
          <div class="slider-row">
            <label>Intensity</label>
            <span id="mat-emissive-intensity-val">${mat.emissiveIntensity.toFixed(2)}</span>
            <input type="range" id="mat-emissive-intensity" min="0" max="5" step="0.05" value="${mat.emissiveIntensity}">
          </div>
        </div>
      `;

      wrapper.oninput = (e)=>{
        const meshNow = selectedMesh();
        if (!meshNow?.material) return;
        const matNow = meshNow.material;
        switch (e.target.id) {
          case 'mat-color': matNow.color.set(e.target.value); break;
          case 'mat-metalness':
            matNow.metalness = parseFloat(e.target.value);
            wrapper.querySelector('#mat-metalness-val').textContent = matNow.metalness.toFixed(2);
            break;
          case 'mat-roughness':
            matNow.roughness = parseFloat(e.target.value);
            wrapper.querySelector('#mat-roughness-val').textContent = matNow.roughness.toFixed(2);
            break;
          case 'mat-emissive': matNow.emissive.set(e.target.value); break;
          case 'mat-emissive-intensity':
            matNow.emissiveIntensity = parseFloat(e.target.value);
            wrapper.querySelector('#mat-emissive-intensity-val').textContent = matNow.emissiveIntensity.toFixed(2);
            break;
        }
      };
    };

    meshSel.onchange = ()=> applyMatUI(selectedMesh());
    if (meshes.length) applyMatUI(selectedMesh());

    // Texture uploads
    container.querySelectorAll('.upload-texture-btn').forEach(btn=>{
      btn.addEventListener('click', e=>{
        const mesh = selectedMesh();
        if (!mesh) return alert('Select a valid mesh first.');
        App.ui.textureTarget = { mesh, type: e.target.dataset.type };
        document.getElementById('texture-input').click();
      });
    });
  }
}
