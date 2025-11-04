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

    const activeObject = App.activeObject;
    // *** UPDATED: Only hide if no object is selected ***
    if (!activeObject) {
        container.innerHTML = '<div style="color:var(--fg-light); text-align:center; padding: 20px 0;">Select a mesh or model from the Meshes tab.</div>';
        if (App.outlinePass) App.outlinePass.selectedObjects = [];
        return;
    }

    // Determine target name and type
    let targetName = '(Unnamed)';
    let isMesh = activeObject.isMesh;
    if (isMesh) {
      targetName = activeObject.name || '(unnamed mesh)';
    } else if (activeObject.isGroup) {
      targetName = '(Whole Model)';
    }

    // Find current UV scale from the selected object, default to 1
    let currentUVScale = 1.0;
    if (isMesh && activeObject.material && activeObject.material.map && activeObject.material.map.repeat) {
        currentUVScale = activeObject.material.map.repeat.x;
    } else if (activeObject.isGroup) {
        activeObject.traverse(o => {
            if (o.isMesh && o.material && o.material.map && o.material.map.repeat) {
                currentUVScale = o.material.map.repeat.x; // Grab first one found
            }
        });
    }

    // Slider template
    const sliderRow = (id, label, val, min, max, step, decimals=2)=>`
      <div class="slider-row" data-id="${id}" data-step="${step}" data-decimals="${decimals}">
        <label>${label}</label>
        <input type="range" class="rng" value="${val}" min="${min}" max="${max}" step="${step / 10}">
        <input type="number" class="num" value="${val.toFixed(decimals)}" step="${step}">
      </div>`;

    container.innerHTML = `
      <div id="texture-map-controls-wrapper" style="padding-top: 12px;">
        <h3 class="panel-title">Texture Maps</h3>
        <p style="color:var(--fg-light); margin:-12px 0 16px; font-size:0.9rem;">
          Editing textures for: <strong>${targetName}</strong>
        </p>
        
        <div class="button-group" style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
            <button class="button ghost texture-load-btn" data-map="map">Albedo</button>
            <button class="button ghost texture-load-btn" data-map="normalMap">Normal</button>
            <button class="button ghost texture-load-btn" data-map="roughnessMap">Roughness</button>
            <button class="button ghost texture-load-btn" data-map="metalnessMap">Metalness</button>
            <button class="button ghost texture-load-btn" data-map="aoMap">AO Map</button>
            <button class="button ghost texture-load-btn" data-map="emissiveMap">Emissive</button>
        </div>
      </div>

      <div id="texture-uv-controls-wrapper" style="margin-top:24px; padding-top: 24px; border-top:1px solid var(--border);">
        <h3 class="panel-title">UV Scaling</h3>
        <p style="color:var(--fg-light); margin:-12px 0 16px; font-size:0.9rem;">Adjust uniform texture tiling (repeat).</p>
        <div class="transform-group">
            ${sliderRow('uv-scale','S', currentUVScale, 0.1, 1.0, 0.01, 2)}
        </div>
      </div>
    `;
    
    container.querySelectorAll('.texture-load-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const object = App.activeObject; // Get from global state
        if (!object) return alert('Select a valid object first.');
        // *** UPDATED: Send 'object' (Mesh or Group) instead of 'mesh' ***
        App.ui.textureTarget = { object: object, type: e.target.dataset.map };
        document.getElementById('texture-input').click();
      });
    });

    // --- UV Slider Handler (Updated) ---
    const uvSliderRow = container.querySelector('.slider-row[data-id="uv-scale"]');
    if (uvSliderRow) {
        const rng = uvSliderRow.querySelector('.rng');
        const num = uvSliderRow.querySelector('.num');
        const decimals = parseInt(uvSliderRow.dataset.decimals);
        const mapTypes = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'];

        const applyUVScaleToMaterial = (mat, scale) => {
            mapTypes.forEach(mapType => {
                const tex = mat[mapType];
                if (tex && tex.isTexture) {
                    tex.wrapS = THREE.RepeatWrapping;
                    tex.wrapT = THREE.RepeatWrapping;
                    tex.repeat.set(scale, scale);
                    tex.needsUpdate = true;
                }
            });
        };

        const syncAndApplyUV = (source) => {
            const scale = parseFloat(source.value);
            if (isNaN(scale)) return;

            if (source.type === 'range') {
                num.value = scale.toFixed(decimals);
            } else {
                rng.value = scale;
            }

            const targetObject = App.activeObject; // Get from global state
            if (!targetObject) return;
            
            if (targetObject.isMesh) {
                // --- 1. Apply to a single mesh ---
                const materials = Array.isArray(targetObject.material) ? targetObject.material : [targetObject.material];
                materials.forEach(mat => applyUVScaleToMaterial(mat, scale));
            
            } else if (targetObject.isGroup) {
                // --- 2. Apply to all meshes in group ---
                targetObject.traverse(o => {
                    if (o.isMesh) {
                        const materials = Array.isArray(o.material) ? o.material : [o.material];
                        materials.forEach(mat => applyUVScaleToMaterial(mat, scale));
                    }
                });
            }
        };
        
        rng.addEventListener('input', () => syncAndApplyUV(rng));
        num.addEventListener('input', () => syncAndApplyUV(num));
    }
  }
}
