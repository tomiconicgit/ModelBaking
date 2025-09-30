import { App } from './viewer.js';
import * as THREE from 'three';

export function mountTextures(refreshOnly=false){
  // --- Procedural Texture Helpers ---

  // Simple pseudo-random number generator for seeding noise
  function mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  }

  // Simple 2D value noise generator
  function createValueNoise2D(seed = 1) {
      const rand = mulberry32(seed);
      const perm = new Uint8Array(512);
      for (let i = 0; i < 256; i++) perm[i] = i;
      for (let i = 255; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [perm[i], perm[j]] = [perm[j], perm[i]];
      }
      for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];

      function surflet(x, y) {
          const ix = Math.floor(x);
          const iy = Math.floor(y);
          return perm[perm[ix & 255] + (iy & 255)] / 255;
      }

      return function noise(x, y) {
          const ix = Math.floor(x);
          const iy = Math.floor(y);
          const fx = x - ix;
          const fy = y - iy;
          const s = surflet(ix, iy);
          const t = surflet(ix + 1, iy);
          const u = surflet(ix, iy + 1);
          const v = surflet(ix + 1, iy + 1);
          const a = s + fx * (t - s);
          const b = u + fx * (v - u);
          return a + fy * (b - a);
      }
  }

  // Generates a bumpy normal map texture for clearcoat glints
  function generateGlintNormalMap(scale = 32, size = 256) {
      const noise = createValueNoise2D(Date.now());
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, size, size);
      const data = imageData.data;
      for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
              const nx = x / size * scale;
              const ny = y / size * scale;
              const n2 = noise(nx + 10.5, ny - 5.3);
              const n3 = noise(nx - 7.2, ny + 8.1);
              const vec = new THREE.Vector3((n2 - 0.5) * 2, (n3 - 0.5) * 2, 1.0).normalize();
              const i = (y * size + x) * 4;
              data[i]     = (vec.x * 0.5 + 0.5) * 255;
              data[i + 1] = (vec.y * 0.5 + 0.5) * 255;
              data[i + 2] = (vec.z * 0.5 + 0.5) * 255;
              data[i + 3] = 255;
          }
      }
      ctx.putImageData(imageData, 0, 0);
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.needsUpdate = true;
      return texture;
  }

  // Generates a texture with procedural veins blended in
  function generateVeinTexture(baseColor, veinColor, scale, mix, size = 512) {
      const noise = createValueNoise2D(Date.now() + 1);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, size, size);
      const data = imageData.data;
      const baseR = baseColor.r * 255, baseG = baseColor.g * 255, baseB = baseColor.b * 255;
      const veinR = veinColor.r * 255, veinG = veinColor.g * 255, veinB = veinColor.b * 255;
      for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
              const nx = x / size * scale;
              const ny = y / size * scale;
              let n = 0, freq = 1, amp = 1;
              for(let i=0; i < 4; i++) {
                  n += noise(nx * freq, ny * freq) * amp;
                  freq *= 2; amp *= 0.5;
              }
              const i = (y * size + x) * 4;
              if (n > (1.0 - mix)) {
                  data[i] = veinR; data[i + 1] = veinG; data[i + 2] = veinB;
              } else {
                  data[i] = baseR; data[i + 1] = baseG; data[i + 2] = baseB;
              }
              data[i + 3] = 255;
          }
      }
      ctx.putImageData(imageData, 0, 0);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.needsUpdate = true;
      return texture;
  }


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

      <div id="gold-ore-controls-wrapper" style="margin-top:24px; padding-top: 24px; border-top:1px solid var(--border);">
        <h3 class="panel-title">Gold Ore Effects ✨</h3>
        <p style="color:var(--fg-light); margin:-12px 0 16px; font-size:0.9rem;">Add veins and glints. Note: Scale/Mix sliders require pressing the button below to apply changes.</p>
        
        <div style="display: grid; gap: 8px;">
            <h4 style="margin: 8px 0 0; font-size: 1rem; color: var(--fg-light);">Metallic Glints</h4>
            <div class="slider-row" style="margin:0;"><label>Glint Intensity</label><span id="mat-glint-intensity-val" class="slider-value"></span><input type="range" id="mat-glint-intensity" min="0" max="1" step="0.01" value="0"></div>
            <div class="slider-row" style="margin:0;"><label>Glint Roughness</label><span id="mat-glint-roughness-val" class="slider-value"></span><input type="range" id="mat-glint-roughness" min="0" max="1" step="0.01" value="0"></div>
            <div class="slider-row" style="margin:0;"><label>Glint Sharpness</label><span id="mat-glint-sharpness-val" class="slider-value"></span><input type="range" id="mat-glint-sharpness" min="0" max="2" step="0.05" value="1"></div>
            <div class="slider-row" style="margin:0;"><label>Glint Scale</label><span id="mat-glint-scale-val" class="slider-value"></span><input type="range" id="mat-glint-scale" min="1" max="128" step="1" value="32"></div>
            <button id="apply-glints-btn" class="button ghost" style="margin-top:8px;">Apply/Update Glint Texture</button>
        </div>

        <div style="display: grid; gap: 8px; margin-top:24px; padding-top:24px; border-top: 1px solid var(--border);">
            <h4 style="margin: 0; font-size: 1rem; color: var(--fg-light);">Gold Veins</h4>
            <div style="display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px;">
              <label for="mat-vein-color" style="margin:0;">Vein Color</label>
              <input type="color" id="mat-vein-color" value="#FFD700" style="height:44px; padding:4px; border: 1px solid var(--border); border-radius:var(--radius-sm); background:transparent;">
            </div>
            <div class="slider-row" style="margin:0;"><label>Vein Mix</label><span id="mat-vein-mix-val" class="slider-value"></span><input type="range" id="mat-vein-mix" min="0" max="1" step="0.01" value="0.5"></div>
            <div class="slider-row" style="margin:0;"><label>Vein Scale</label><span id="mat-vein-scale-val" class="slider-value"></span><input type="range" id="mat-vein-scale" min="1" max="256" step="1" value="48"></div>
            <button id="apply-veins-btn" class="button ghost" style="margin-top:8px;">Generate Veins</button>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `.slider-value { justify-self: end; color: var(--fg-light); font-variant-numeric: tabular-nums; }`;
    container.append(style);

    const meshSel = document.getElementById('texture-mesh-select');
    const getSelectedMesh = () => m.gltf.scene.getObjectByProperty('uuid', meshSel.value);

    // --- Main Update Function ---
    function updateUI() {
      const mesh = getSelectedMesh();
      const wrapper = container.querySelector('#material-controls-wrapper');
      if (!mesh || !mesh.material || !mesh.material.isMeshStandardMaterial) {
        if(wrapper) container.innerHTML = '<div style="color:var(--fg-light); text-align:center; padding: 20px 0;">Select a mesh with a standard material.</div>';
        return;
      }

      const mat = mesh.material;

      document.getElementById('mat-color').value = '#' + mat.color.getHexString();
      document.getElementById('mat-emissive').value = '#' + mat.emissive.getHexString();

      const controls = {
        'mat-metalness': mat.metalness, 'mat-roughness': mat.roughness,
        'mat-envmap-intensity': mat.envMapIntensity, 'mat-emissive-intensity': mat.emissiveIntensity,
        'mat-bumpscale': mat.bumpScale, 'mat-normalx': mat.normalScale.x, 'mat-normaly': mat.normalScale.y,
        'mat-glint-intensity': mat.clearcoat || 0, 'mat-glint-roughness': mat.clearcoatRoughness || 0,
        'mat-glint-sharpness': mat.clearcoatNormalScale?.x || 1.0,
      };

      for (const [id, value] of Object.entries(controls)) {
        const slider = document.getElementById(id);
        const label = document.getElementById(id + '-val');
        if (slider) slider.value = value;
        if (label) label.textContent = Number(value).toFixed(2);
      }
      
      ['mat-glint-scale', 'mat-vein-scale'].forEach(id => {
        const slider = document.getElementById(id), label = document.getElementById(id + '-val');
        if(slider && label) label.textContent = slider.value;
      });
      const mixSlider = document.getElementById('mat-vein-mix'), mixLabel = document.getElementById('mat-vein-mix-val');
      if(mixSlider && mixLabel) mixLabel.textContent = Number(mixSlider.value).toFixed(2);
    }
    
    // --- Event Listeners ---
    function attachListeners() {
      container.oninput = (e) => {
        const mesh = getSelectedMesh();
        if (!mesh || !mesh.material || !mesh.material.isMeshStandardMaterial) return;
        
        const mat = mesh.material;
        const target = e.target;
        const value = target.type === 'range' ? parseFloat(target.value) : target.value;
        const label = document.getElementById(target.id + '-val');

        if (label) {
            if (target.id.includes('scale')) label.textContent = value;
            else label.textContent = Number(value).toFixed(2);
        }

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
          case 'mat-glint-intensity': mat.clearcoat = value; mat.needsUpdate = true; break;
          case 'mat-glint-roughness': mat.clearcoatRoughness = value; mat.needsUpdate = true; break;
          case 'mat-glint-sharpness': mat.clearcoatNormalScale.set(value, value); break;
        }
      };

      meshSel.onchange = updateUI;

      container.querySelectorAll('.texture-load-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          const mesh = getSelectedMesh();
          if (!mesh) return alert('Select a valid mesh first.');
          App.ui.textureTarget = { mesh, type: e.target.dataset.map };
          document.getElementById('texture-input').click();
        });
      });
      
      container.querySelector('#apply-glints-btn').addEventListener('click', () => {
          const mesh = getSelectedMesh();
          if (!mesh || !mesh.material?.isMeshStandardMaterial) return;
          const mat = mesh.material;
          const scale = parseFloat(document.getElementById('mat-glint-scale').value);
          if (mat.clearcoatNormalMap) mat.clearcoatNormalMap.dispose();
          mat.clearcoatNormalMap = generateGlintNormalMap(scale);
          mat.needsUpdate = true;
          alert('Glint texture updated.');
      });

      container.querySelector('#apply-veins-btn').addEventListener('click', () => {
          const mesh = getSelectedMesh();
          if (!mesh || !mesh.material?.isMeshStandardMaterial) return;
          const mat = mesh.material;
          const baseColor = new THREE.Color(document.getElementById('mat-color').value);
          const veinColor = new THREE.Color(document.getElementById('mat-vein-color').value);
          const scale = parseFloat(document.getElementById('mat-vein-scale').value);
          const mix = parseFloat(document.getElementById('mat-vein-mix').value);
          if (mat.map) mat.map.dispose();
          mat.map = generateVeinTexture(baseColor, veinColor, scale, mix);
          mat.color.set(0xffffff); // Set base to white so map is not tinted
          mat.needsUpdate = true;
          alert('Veins generated.');
          updateUI();
      });
      
      App.events.addEventListener('texture:loaded', updateUI);
    }
    
    if (meshes.length) {
      updateUI();
      attachListeners();
    }
  }
}
