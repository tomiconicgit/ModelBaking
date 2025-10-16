// textures.js
import { App } from './viewer.js';
import * as THREE from 'three';

export function mountTextures(refreshOnly=false){
  const root = document.getElementById('texture-panel');
  if (!refreshOnly){
    root.innerHTML = `<div id="texture-panel-content"></div>`;
    App.events.addEventListener('panels:refresh-all', render);
  }
  render();

  function render(){
    const container = document.getElementById('texture-panel-content');
    const m = App.models[App.activeModelId];
    if (!m){
        container.innerHTML = '<div style="color:var(--fg-light); text-align:center; padding: 20px 0;">Select an active model from Tabs.</div>';
        return;
    }

    const meshes=[];
    m.gltf.scene.traverse(o=>{ if (o.isMesh) meshes.push(o); });

    container.innerHTML = `
      <div class="form-group">
        <label for="texture-mesh-select">Target Mesh</label>
        <select id="texture-mesh-select" ${!meshes.length ? 'disabled' : ''}>
          ${meshes.length ? meshes.map(ms => `<option value="${ms.uuid}">${ms.name || '(unnamed mesh)'}</option>`).join('') : '<option>No meshes found</option>'}
        </select>
      </div>
      
      <div id="texture-map-controls-wrapper" style="margin-top:24px; padding-top: 24px; border-top:1px solid var(--border);">
        <h3 class="panel-title">Texture Maps</h3>
        <p style="color:var(--fg-light); margin:-12px 0 16px; font-size:0.9rem;">Load PBR texture maps to control material properties.</p>
        
        <div class="button-group" style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
            <button class="button ghost texture-load-btn" data-map="map">Albedo</button>
            <button class="button ghost texture-load-btn" data-map="normalMap">Normal</button>
            <button class="button ghost texture-load-btn" data-map="roughnessMap">Roughness</button>
            <button class="button ghost texture-load-btn" data-map="metalnessMap">Metalness</button>
            <button class="button ghost texture-load-btn" data-map="aoMap">AO Map</button>
            <button class="button ghost texture-load-btn" data-map="emissiveMap">Emissive</button>
        </div>
      </div>
    `;

    const meshSel = document.getElementById('texture-mesh-select');
    const getSelectedMesh = () => m.gltf.scene.getObjectByProperty('uuid', meshSel.value);
    
    container.querySelectorAll('.texture-load-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const mesh = getSelectedMesh();
        if (!mesh) return alert('Select a valid mesh first.');
        App.ui.textureTarget = { mesh, type: e.target.dataset.map };
        document.getElementById('texture-input').click();
      });
    });
  }
}
