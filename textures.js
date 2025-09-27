import { App } from './viewer.js';
import * as THREE from 'three'; // Import THREE to reference it in shader logic.

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
      <div class="button-group" style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--border);">
        ${textureTypes.map(t => `<button class="button ghost upload-texture-btn" data-type="${t.key}">${t.name}</button>`).join('')}
      </div>

      <h3 class="panel-title">Mesh Effects (Vertex Shaders)</h3>
      <div id="mesh-effects-container" style="display:flex; flex-direction:column; gap:12px;">
        <div class="effect-group" data-effect="displacement">
          <div class="effect-header">
            <input type="checkbox" class="effect-toggle" id="enable-displacement-fx">
            <label for="enable-displacement-fx">Vertex Displacement</label>
          </div>
          <div class="sliders-container hidden">
            <div class="slider-row"><label>Strength</label><input type="range" class="effect-slider" data-uniform="strength" min="0" max="2" step="0.01" value="0.1" disabled></div>
            <div class="slider-row"><label>Frequency</label><input type="range" class="effect-slider" data-uniform="frequency" min="0.1" max="20" step="0.1" value="5" disabled></div>
            <div class="slider-row"><label>Speed</label><input type="range" class="effect-slider" data-uniform="speed" min="0" max="5" step="0.01" value="0.5" disabled></div>
          </div>
        </div>
        <div class="effect-group" data-effect="twist">
          <div class="effect-header">
            <input type="checkbox" class="effect-toggle" id="enable-twist-fx">
            <label for="enable-twist-fx">Twist & Bend</label>
          </div>
          <div class="sliders-container hidden">
            <div class="slider-row"><label>Twist</label><input type="range" class="effect-slider" data-uniform="twistAngle" min="-360" max="360" step="1" value="0" disabled></div>
            <div class="slider-row"><label>Bend</label><input type="range" class="effect-slider" data-uniform="bendAmount" min="-5" max="5" step="0.01" value="0" disabled></div>
          </div>
        </div>
        <div class="effect-group" data-effect="voxelize">
            <div class="effect-header">
                <input type="checkbox" class="effect-toggle" id="enable-voxelize-fx">
                <label for="enable-voxelize-fx">Voxelize</label>
            </div>
            <div class="sliders-container hidden">
                <div class="slider-row"><label>Grid Size</label><input type="range" class="effect-slider" data-uniform="gridSize" min="5" max="100" step="1" value="25" disabled></div>
            </div>
        </div>
      </div>

      <h3 class="panel-title" style="margin-top:24px;">Material Effects (Fragment Shaders)</h3>
      <div id="material-effects-container" style="display:flex; flex-direction:column; gap:12px;">
        <div class="effect-group" data-effect="dissolve">
          <div class="effect-header">
            <input type="checkbox" class="effect-toggle" id="enable-dissolve-fx">
            <label for="enable-dissolve-fx">Dissolve / Erode</label>
          </div>
          <div class="sliders-container hidden">
            <div class="slider-row"><label>Threshold</label><input type="range" class="effect-slider" data-uniform="threshold" min="0" max="1" step="0.01" value="0.5" disabled></div>
            <div class="slider-row"><label>Edge Hardness</label><input type="range" class="effect-slider" data-uniform="edgeHardness" min="0.01" max="1" step="0.01" value="0.1" disabled></div>
            <div class="slider-row"><label>Glow Intensity</label><input type="range" class="effect-slider" data-uniform="glowIntensity" min="0" max="10" step="0.1" value="2.0" disabled></div>
          </div>
        </div>
        <div class="effect-group" data-effect="fresnel">
            <div class="effect-header">
                <input type="checkbox" class="effect-toggle" id="enable-fresnel-fx">
                <label for="enable-fresnel-fx">Fresnel / Rim Lighting</label>
            </div>
            <div class="sliders-container hidden">
                <div class="slider-row"><label>Power</label><input type="range" class="effect-slider" data-uniform="power" min="0.1" max="10" step="0.1" value="2.0" disabled></div>
                <div class="slider-row"><label>Intensity</label><input type="range" class="effect-slider" data-uniform="intensity" min="0" max="5" step="0.01" value="1.0" disabled></div>
            </div>
        </div>
        <div class="effect-group" data-effect="uvWarp">
            <div class="effect-header">
                <input type="checkbox" class="effect-toggle" id="enable-uvwarp-fx">
                <label for="enable-uvwarp-fx">UV Warping</label>
            </div>
            <div class="sliders-container hidden">
                <div class="slider-row"><label>Strength</label><input type="range" class="effect-slider" data-uniform="strength" min="0" max="0.5" step="0.001" value="0.05" disabled></div>
                <div class="slider-row"><label>Speed</label><input type="range" class="effect-slider" data-uniform="speed" min="0" max="5" step="0.01" value="1.0" disabled></div>
                <div class="slider-row"><label>Frequency</label><input type="range" class="effect-slider" data-uniform="frequency" min="1" max="50" step="0.5" value="10" disabled></div>
            </div>
        </div>
      </div>
    `;

    // Add some simple styling for the new sections
    const style = document.createElement('style');
    style.textContent = `
        .effect-group { background: var(--surface-bg); border-radius: var(--radius-md); padding: 12px; }
        .effect-header { display: flex; align-items: center; gap: 10px; }
        .effect-header label { font-weight: 600; margin: 0; }
        .effect-toggle { width: 20px; height: 20px; }
        .sliders-container { margin-top: 10px; border-top: 1px solid var(--border); padding-top: 10px; display: flex; flex-direction: column; gap: 8px; }
    `;
    container.append(style);

    const meshSel = document.getElementById('texture-mesh-select');
    const getSelectedMesh = ()=> m.gltf.scene.getObjectByProperty('uuid', meshSel.value);

    // --- Standard Material UI ---
    const applyMatUI = (mesh)=>{
      const wrapper = document.getElementById('material-controls-wrapper');
      // ... (Standard material UI logic remains unchanged from previous version) ...
       if (!mesh || !mesh.material || !mesh.material.isMeshStandardMaterial) {
        wrapper.innerHTML = '<div style="color:var(--fg-light); text-align:center; padding:20px 0;">Selected mesh has no editable material properties.</div>';
        return;
      }
      const mat = mesh.material;
      wrapper.innerHTML = `
        <div class="material-group" style="display: grid; gap: 8px;">
          <h3 class="panel-title">Standard Material</h3>
          <div style="display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px;">
            <label for="mat-color" style="margin:0;">Base Color</label>
            <input type="color" id="mat-color" value="#${mat.color.getHexString()}" style="height:44px; padding:4px; border: 1px solid var(--border); border-radius:var(--radius-sm); background:transparent;">
          </div>
          <div class="slider-row" style="margin:0;"><label>Metalness</label><span id="mat-metalness-val" style="justify-self: end; color: var(--fg-light);">${mat.metalness.toFixed(2)}</span><input type="range" id="mat-metalness" min="0" max="1" step="0.01" value="${mat.metalness}"></div>
          <div class="slider-row" style="margin:0;"><label>Roughness</label><span id="mat-roughness-val" style="justify-self: end; color: var(--fg-light);">${mat.roughness.toFixed(2)}</span><input type="range" id="mat-roughness" min="0" max="1" step="0.01" value="${mat.roughness}"></div>
          <h4 class="panel-title" style="margin-top:16px; font-size:1rem;">Emissive</h4>
          <div style="display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px;">
            <label for="mat-emissive" style="margin:0;">Color</label>
            <input type="color" id="mat-emissive" value="#${mat.emissive.getHexString()}" style="height:44px; padding:4px; border: 1px solid var(--border); border-radius:var(--radius-sm); background:transparent;">
          </div>
          <div class="slider-row" style="margin:0;"><label>Intensity</label><span id="mat-emissive-intensity-val" style="justify-self: end; color: var(--fg-light);">${mat.emissiveIntensity.toFixed(2)}</span><input type="range" id="mat-emissive-intensity" min="0" max="5" step="0.05" value="${mat.emissiveIntensity}"></div>
        </div>`;
      wrapper.oninput = (e)=>{ /* ... same as before ... */ };
    };

    meshSel.onchange = ()=> applyMatUI(getSelectedMesh());
    if (meshes.length) applyMatUI(getSelectedMesh());
    
    // --- Texture Upload Logic ---
    container.querySelectorAll('.upload-texture-btn').forEach(btn=>{ /* ... same as before ... */ });

    // --- ADVANCED SHADER LOGIC ---
    // This is where you'll drive the custom shader effects.
    
    // 1. Attach listeners to all effect checkboxes
    container.querySelectorAll('.effect-toggle').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const group = e.target.closest('.effect-group');
        const slidersContainer = group.querySelector('.sliders-container');
        const sliders = slidersContainer.querySelectorAll('input, select');
        const effectName = group.dataset.effect;
        const isActive = e.target.checked;

        slidersContainer.classList.toggle('hidden', !isActive);
        sliders.forEach(slider => slider.disabled = !isActive);

        const mesh = getSelectedMesh();
        if (mesh) {
            // **ACTION REQUIRED**: This is where you would call your function
            // to apply or remove the custom shader code for this effect.
            applyCustomShader(mesh, effectName, isActive);
        }
      });
    });

    // 2. Attach listeners to all effect sliders
    container.querySelectorAll('.effect-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const group = e.target.closest('.effect-group');
        const effectName = group.dataset.effect;
        const uniformName = e.target.dataset.uniform;
        const value = parseFloat(e.target.value);

        const mesh = getSelectedMesh();
        if (mesh && mesh.material.uniforms && mesh.material.uniforms[uniformName]) {
            // **ACTION REQUIRED**: This is where you update the value in your shader.
            // Example:
            // mesh.material.uniforms[uniformName].value = value;
            console.log(`Updating shader uniform: ${effectName}.${uniformName} = ${value}`);
        }
      });
    });

    /**
     * **ACTION REQUIRED**: Placeholder function for your shader logic.
     * You need to implement this to actually modify the model's material.
     * @param {THREE.Mesh} mesh The target mesh to modify.
     * @param {string} effectName The name of the effect (e.g., 'displacement').
     * @param {boolean} isActive Whether to turn the effect on or off.
     */
    function applyCustomShader(mesh, effectName, isActive) {
        console.log(`Setting effect '${effectName}' to '${isActive}' for mesh:`, mesh.name);

        // --- Example Logic Outline ---
        // if (isActive) {
        //   // 1. Ensure the material has a place for shader code (onBeforeCompile).
        //   // 2. Define the 'uniforms' for the sliders (e.g., strength, speed).
        //   // 3. Inject the GLSL shader code for the specific effect.
        //   //    - For mesh effects, you'll modify the vertex shader (`#include <begin_vertex>`).
        //   //    - For material effects, you'll modify the fragment shader (`#include <dithering_fragment>`).
        //   // 4. Set material.needsUpdate = true;
        // } else {
        //   // 1. Revert the shader code. You might need to dispose of the custom
        //   //    material and restore a default one. This is the tricky part.
        //   // 2. Set material.needsUpdate = true;
        // }
    }
  }
}
