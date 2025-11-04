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

    // --- Get current material properties ---
    let currentUVScale = 1.0;
    let currentRoughness = 0.5;
    let currentMetalness = 0.5;
    let currentEmissive = 0.0;
    let currentColor = '#ffffff';
    let currentEmissiveColor = '#000000';

    let firstMat = null;
    if (isMesh) {
        firstMat = Array.isArray(activeObject.material) ? activeObject.material[0] : activeObject.material;
    } else {
        activeObject.traverse(o => {
            if (!firstMat && o.isMesh) {
                firstMat = Array.isArray(o.material) ? o.material[0] : o.material;
            }
        });
    }

    if (firstMat && firstMat.isMeshStandardMaterial) {
        if (firstMat.map && firstMat.map.repeat) {
            currentUVScale = firstMat.map.repeat.x;
        }
        currentRoughness = firstMat.roughness;
        currentMetalness = firstMat.metalness;
        currentEmissive = firstMat.emissiveIntensity;
        currentColor = '#' + firstMat.color.getHexString();
        currentEmissiveColor = '#' + firstMat.emissive.getHexString();
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

      <div id="material-props-wrapper" style="margin-top:24px; padding-top: 24px; border-top:1px solid var(--border);">
        <h3 class="panel-title">Material Properties</h3>
        <p style="color:var(--fg-light); margin:-12px 0 16px; font-size:0.9rem;">Adjust PBR material values and colors.</p>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
          <div class="form-group" style="margin:0;">
            <label for="mat-color-picker" style="margin-bottom: 8px;">Base Color</label>
            <input type="color" id="mat-color-picker" class="mat-prop-input" data-id="mat-color" value="${currentColor}" style="width:100%; height:44px; padding: 4px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface-bg); cursor: pointer;">
          </div>
          <div class="form-group" style="margin:0;">
            <label for="mat-emissive-picker" style="margin-bottom: 8px;">Glow Color</label>
            <input type="color" id="mat-emissive-picker" class="mat-prop-input" data-id="mat-emissive-color" value="${currentEmissiveColor}" style="width:100%; height:44px; padding: 4px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface-bg); cursor: pointer;">
          </div>
        </div>
        
        <div class="transform-group">
            ${sliderRow('mat-roughness','Roughness', currentRoughness, 0.0, 1.0, 0.01, 2)}
            ${sliderRow('mat-metalness','Metalness', currentMetalness, 0.0, 1.0, 0.01, 2)}
            ${sliderRow('mat-emissive','Glow Intensity', currentEmissive, 0.0, 5.0, 0.01, 2)}
        </div>
      </div>
    `;
    
    container.querySelectorAll('.texture-load-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const object = App.activeObject;
        if (!object) return alert('Select a valid object first.');
        App.ui.textureTarget = { object: object, type: e.target.dataset.map };
        document.getElementById('texture-input').click();
      });
    });

    // --- Helper function for applying material properties ---
    const applyToMaterial = (mat, prop, value) => {
        if (!mat || !mat.isMeshStandardMaterial) return;
        
        if (prop === 'uv-scale') {
            const mapTypes = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'];
            mapTypes.forEach(mapType => {
                const tex = mat[mapType];
                if (tex && tex.isTexture) {
                    tex.wrapS = THREE.RepeatWrapping;
                    tex.wrapT = THREE.RepeatWrapping;
                    tex.repeat.set(value, value);
                    tex.needsUpdate = true;
                }
            });
        }
        else if (prop === 'mat-roughness') {
            mat.roughness = value;
        }
        else if (prop === 'mat-metalness') {
            mat.metalness = value;
        }
        else if (prop === 'mat-emissive') { // This is Glow Intensity
            mat.emissiveIntensity = value;
        }
        else if (prop === 'mat-color') {
            mat.color.set(value); // 'value' will be a hex string, e.g., #ff0000
        }
        else if (prop === 'mat-emissive-color') {
            mat.emissive.set(value); // 'value' will be a hex string
        }
        mat.needsUpdate = true;
    };

    // --- Combined Slider Handler ---
    container.querySelectorAll('.slider-row').forEach(row => {
        const rng = row.querySelector('.rng');
        const num = row.querySelector('.num');
        const id = row.dataset.id;
        const decimals = parseInt(row.dataset.decimals);

        const syncAndApply = (source) => {
            const value = parseFloat(source.value);
            if (isNaN(value)) return;

            if (source.type === 'range') {
                num.value = value.toFixed(decimals);
            } else {
                rng.value = value;
            }

            const targetObject = App.activeObject;
            if (!targetObject) return;

            if (targetObject.isMesh) {
                const materials = Array.isArray(targetObject.material) ? targetObject.material : [targetObject.material];
                materials.forEach(mat => applyToMaterial(mat, id, value));
            
            } else if (targetObject.isGroup) {
                targetObject.traverse(o => {
                    if (o.isMesh) {
                        const materials = Array.isArray(o.material) ? o.material : [o.material];
                        materials.forEach(mat => applyToMaterial(mat, id, value));
                    }
                });
            }
        };

        rng.addEventListener('input', () => syncAndApply(rng));
        num.addEventListener('input', () => syncAndApply(num));
    });

    // --- NEW: Color Picker Handler ---
    container.querySelectorAll('.mat-prop-input').forEach(picker => {
        const id = picker.dataset.id;
        
        picker.addEventListener('input', () => {
            const value = picker.value; // This will be a hex string, e.g. #ff0000
            const targetObject = App.activeObject;
            if (!targetObject) return;

            const applyFunc = (mat) => applyToMaterial(mat, id, value);

            if (targetObject.isMesh) {
                const materials = Array.isArray(targetObject.material) ? targetObject.material : [targetObject.material];
                materials.forEach(applyFunc);
            } else if (targetObject.isGroup) {
                targetObject.traverse(o => {
                    if (o.isMesh) {
                        const materials = Array.isArray(o.material) ? o.material : [o.material];
                        materials.forEach(applyFunc);
                    }
                });
            }
        });
    });
  }
}
