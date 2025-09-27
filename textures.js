import { App } from './viewer.js';
import * as THREE from 'three';

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

    // --- HTML Structure ---
    container.innerHTML = `
      <div class="form-group">
        <label for="texture-mesh-select">Target Mesh</label>
        <select id="texture-mesh-select" ${!meshes.length ? 'disabled' : ''}>
          ${meshes.length ? meshes.map(ms => `<option value="${ms.uuid}">${ms.name || ms.uuid}</option>`).join('') : '<option>No meshes found in model</option>'}
        </select>
      </div>
      
      <div id="material-controls-wrapper" style="display: grid; gap: 8px;">
        <h3 class="panel-title">Material Properties</h3>
        
        <div style="display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px;">
          <label for="mat-color" style="margin:0;">Base Color</label>
          <input type="color" id="mat-color" style="height:44px; padding:4px; border: 1px solid var(--border); border-radius:var(--radius-sm); background:transparent;">
        </div>
        
        <div class="slider-row" style="margin:0;"><label>Metalness</label><span id="mat-metalness-val" class="slider-value"></span><input type="range" id="mat-metalness" min="0" max="1" step="0.01"></div>
        <div class="slider-row" style="margin:0;"><label>Roughness</label><span id="mat-roughness-val" class="slider-value"></span><input type="range" id="mat-roughness" min="0" max="1" step="0.01"></div>
        <div class="slider-row" style="margin:0;"><label>Reflectivity</label><span id="mat-envmap-val" class="slider-value"></span><input type="range" id="mat-envmap-intensity" min="0" max="2" step="0.01"></div>
      </div>
      
      <div id="emissive-controls-wrapper" style="margin-top:24px; padding-top: 24px; border-top:1px solid var(--border); display:grid; gap:8px;">
        <h3 class="panel-title">Light Emission</h3>
        <div style="display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px;">
          <label for="mat-emissive" style="margin:0;">Emissive Color</label>
          <input type="color" id="mat-emissive" style="height:44px; padding:4px; border: 1px solid var(--border); border-radius:var(--radius-sm); background:transparent;">
        </div>
        <div class="slider-row" style="margin:0;"><label>Intensity</label><span id="mat-emissive-intensity-val" class="slider-value"></span><input type="range" id="mat-emissive-intensity" min="0" max="10" step="0.05"></div>
      </div>

      <div id="procedural-controls-wrapper" style="margin-top:24px; padding-top: 24px; border-top:1px solid var(--border);">
        <h3 class="panel-title">Procedural Maps & Effects</h3>
        <p style="color:var(--fg-light); margin:-12px 0 16px; font-size:0.9rem;">Load textures to add procedural detail like bumps, noise, and custom color gradients.</p>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom: 24px;">
            <button class="button ghost texture-load-btn" data-map="bumpMap">Load Bump</button>
            <button class="button ghost texture-load-btn" data-map="normalMap">Load Normal</button>
            <button class="button ghost texture-load-btn" data-map="roughnessMap">Load Noise</button>
            <button class="button ghost texture-load-btn" data-map="gradientMap">Load Gradient</button>
        </div>
        
        <div style="display: grid; gap: 8px;">
            <div class="slider-row" style="margin:0;"><label>Bump Strength</label><span id="mat-bumpscale-val" class="slider-value"></span><input type="range" id="mat-bumpscale" min="0" max="2" step="0.01"></div>
            <div class="slider-row" style="margin:0;"><label>Normal X</label><span id="mat-normalx-val" class="slider-value"></span><input type="range" id="mat-normalx" min="0" max="2" step="0.01"></div>
            <div class="slider-row" style="margin:0;"><label>Normal Y</label><span id="mat-normaly-val" class="slider-value"></span><input type="range" id="mat-normaly" min="0" max="2" step="0.01"></div>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `.slider-value { justify-self: end; color: var(--fg-light); font-variant-numeric: tabular-nums; }`;
    container.append(style);

    const meshSel = document.getElementById('texture-mesh-select');
    const getSelectedMesh = () => m.gltf.scene.getObjectByProperty('uuid', meshSel.value);

    // --- Main Update Function ---
    // This function reads the material state and updates all sliders.
    function updateUI() {
      const mesh = getSelectedMesh();
      if (!mesh || !mesh.material || !mesh.material.isMeshStandardMaterial) {
        // Hide controls if material is not compatible
        container.querySelectorAll('.slider-row, .form-group, .button-group, h3, h4, p, input[type=color]').forEach(el => el.style.display = 'none');
        return;
      }

      const mat = mesh.material;

      // Update color pickers
      document.getElementById('mat-color').value = '#' + mat.color.getHexString();
      document.getElementById('mat-emissive').value = '#' + mat.emissive.getHexString();

      // Update sliders and their text values
      const controls = {
        'mat-metalness': mat.metalness,
        'mat-roughness': mat.roughness,
        'mat-envmap-intensity': mat.envMapIntensity,
        'mat-emissive-intensity': mat.emissiveIntensity,
        'mat-bumpscale': mat.bumpScale,
        'mat-normalx': mat.normalScale.x,
        'mat-normaly': mat.normalScale.y
      };

      for (const [id, value] of Object.entries(controls)) {
        const slider = document.getElementById(id);
        const label = document.getElementById(id + '-val');
        if (slider) slider.value = value;
        if (label) label.textContent = Number(value).toFixed(2);
      }
    }
    
    // --- Event Listeners ---
    function attachListeners() {
      // Listener for the entire panel using event delegation
      container.oninput = (e) => {
        const mesh = getSelectedMesh();
        if (!mesh || !mesh.material || !mesh.material.isMeshStandardMaterial) return;
        
        const mat = mesh.material;
        const target = e.target;
        const value = target.type === 'range' ? parseFloat(target.value) : target.value;
        const label = document.getElementById(target.id + '-val');

        if (label) label.textContent = Number(value).toFixed(2);

        switch (target.id) {
          case 'mat-color': mat.color.set(value); break;
          case 'mat-emissive': mat.emissive.set(value); break;
          case 'mat-metalness': mat.metalness = value; break;
          case 'mat-roughness': mat.roughness = value; break;
          case 'mat-envmap-intensity': mat.envMapIntensity = value; break;
          case 'mat-emissive-intensity': mat.emissiveIntensity = value; break;
          case 'mat-bumpscale': mat.bumpScale = value; break;
          case 'mat-normalx': mat.normalScale.x = value; break;
          case 'mat-normaly': mat.normalScale.y = value; break;
        }
      };

      // Listen for mesh selection changes
      meshSel.onchange = updateUI;

      // Texture loading buttons
      container.querySelectorAll('.texture-load-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          const mesh = getSelectedMesh();
          if (!mesh) return alert('Select a valid mesh first.');
          // Tell the loader which map type we're loading
          App.ui.textureTarget = { mesh, type: e.target.dataset.map };
          document.getElementById('texture-input').click();
        });
      });
      
      // The global file loader in loader.js will handle the rest
      App.events.addEventListener('texture:loaded', updateUI);
    }
    
    // Initial setup
    if (meshes.length) {
      updateUI();
      attachListeners();
    }
  }
}
