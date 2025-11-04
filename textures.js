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

    // Find current UV scale from the first mesh's map, default to 1
    let currentUVScale = 1.0;
    if (meshes.length && meshes[0].material && meshes[0].material.map) {
        currentUVScale = meshes[0].material.map.repeat.x;
    }

    // Slider template (borrowed from transform.js)
    const sliderRow = (id, label, val, min, max, step, decimals=2)=>`
      <div class="slider-row" data-id="${id}" data-step="${step}" data-decimals="${decimals}">
        <label>${label}</label>
        <input type="range" class="rng" value="${val}" min="${min}" max="${max}" step="${step / 10}">
        <input type="number" class="num" value="${val.toFixed(decimals)}" step="${step}">
      </div>`;

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

      <div id="texture-uv-controls-wrapper" style="margin-top:24px; padding-top: 24px; border-top:1px solid var(--border); ${!meshes.length ? 'display:none' : ''}">
        <h3 class="panel-title">UV Scaling</h3>
        <p style="color:var(--fg-light); margin:-12px 0 16px; font-size:0.9rem;">Adjust uniform texture tiling (repeat).</p>
        <div class="transform-group">
            ${sliderRow('uv-scale','S', currentUVScale, 0.1, 1.0, 0.01, 2)}
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

    // --- NEW: Handle Outline Selection ---
    function updateOutlineSelection() {
        if (!App.outlinePass) return;
        const mesh = getSelectedMesh();
        App.outlinePass.selectedObjects = mesh ? [mesh] : [];
        
        // Also update the UV slider to reflect the new selection's value
        let scale = 1.0;
        if (mesh && mesh.material && mesh.material.map && mesh.material.map.repeat) {
            scale = mesh.material.map.repeat.x;
        }
        const uvRow = document.querySelector('.slider-row[data-id="uv-scale"]');
        if (uvRow) {
            uvRow.querySelector('.rng').value = scale;
            uvRow.querySelector('.num').value = scale.toFixed(2);
        }
    }
    meshSel.addEventListener('change', updateOutlineSelection);
    updateOutlineSelection(); // Run on init

    // --- NEW: Handle UV Slider ---
    const uvSliderRow = container.querySelector('.slider-row[data-id="uv-scale"]');
    if (uvSliderRow) {
        const rng = uvSliderRow.querySelector('.rng');
        const num = uvSliderRow.querySelector('.num');
        const decimals = parseInt(uvSliderRow.dataset.decimals);
        const mapTypes = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'];

        const syncAndApplyUV = (source) => {
            const scale = parseFloat(source.value);
            if (isNaN(scale)) return;

            // Sync inputs
            if (source.type === 'range') {
                num.value = scale.toFixed(decimals);
            } else {
                rng.value = scale;
            }

            // Apply to mesh
            const mesh = getSelectedMesh();
            if (!mesh || !mesh.material) return;
            
            mapTypes.forEach(mapType => {
                const tex = mesh.material[mapType];
                if (tex && tex.isTexture) {
                    tex.wrapS = THREE.RepeatWrapping;
                    tex.wrapT = THREE.RepeatWrapping;
                    tex.repeat.set(scale, scale);
                    tex.needsUpdate = true;
                }
            });
        };
        
        rng.addEventListener('input', () => syncAndApplyUV(rng));
        num.addEventListener('input', () => syncAndApplyUV(num));
    }
  }
}
