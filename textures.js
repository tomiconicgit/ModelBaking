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
    const textureTypes = [
      { key: 'map', name: 'Albedo' }, { key: 'normalMap', name: 'Normal' },
      { key: 'metalnessMap', name: 'Metalness' }, { key: 'roughnessMap', name: 'Roughness' },
      { key: 'aoMap', name: 'AO' }, { key: 'emissiveMap', name: 'Emissive' }
    ];

    // --- HTML Structure ---
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

      <h3 class="panel-title">Advanced Effects</h3>

      <h4 class="panel-title" style="font-size:1rem; color: var(--fg-light);">Mesh Effects (Vertex Shaders)</h4>
      <div id="mesh-effects-container" style="display:flex; flex-direction:column; gap:12px; margin-bottom: 24px;">
        <div class="effect-group" data-effect="displacement">
          <div class="effect-header">
            <input type="checkbox" class="effect-toggle" id="enable-displacement-fx" data-uniform-bool="u_disp_enabled">
            <label for="enable-displacement-fx">Vertex Displacement</label>
          </div>
          <div class="sliders-container hidden">
            <div class="slider-row"><label>Strength</label><input type="range" class="effect-slider" data-uniform="u_disp_strength" min="0" max="2" step="0.01" value="0.1" disabled></div>
            <div class="slider-row"><label>Frequency</label><input type="range" class="effect-slider" data-uniform="u_disp_frequency" min="0.1" max="20" step="0.1" value="5" disabled></div>
            <div class="slider-row"><label>Speed</label><input type="range" class="effect-slider" data-uniform="u_disp_speed" min="0" max="5" step="0.01" value="0.5" disabled></div>
          </div>
        </div>
      </div>

      <h4 class="panel-title" style="font-size:1rem; color: var(--fg-light);">Material Effects (Fragment Shaders)</h4>
      <div id="material-effects-container" style="display:flex; flex-direction:column; gap:12px;">
        <div class="effect-group" data-effect="dissolve">
          <div class="effect-header">
            <input type="checkbox" class="effect-toggle" id="enable-dissolve-fx" data-uniform-bool="u_dissolve_enabled">
            <label for="enable-dissolve-fx">Dissolve / Erode</label>
          </div>
          <div class="sliders-container hidden">
            <div class="slider-row"><label>Threshold</label><input type="range" class="effect-slider" data-uniform="u_dissolve_threshold" min="0" max="1" step="0.01" value="0.5" disabled></div>
            <div class="slider-row"><label>Edge</label><input type="range" class="effect-slider" data-uniform="u_dissolve_edge" min="0.01" max="0.5" step="0.001" value="0.1" disabled></div>
          </div>
        </div>
        <div class="effect-group" data-effect="fresnel">
            <div class="effect-header">
                <input type="checkbox" class="effect-toggle" id="enable-fresnel-fx" data-uniform-bool="u_fresnel_enabled">
                <label for="enable-fresnel-fx">Fresnel / Rim Lighting</label>
            </div>
            <div class="sliders-container hidden">
                <div class="slider-row"><label>Power</label><input type="range" class="effect-slider" data-uniform="u_fresnel_power" min="0.1" max="10" step="0.1" value="2.0" disabled></div>
                <div class="slider-row"><label>Intensity</label><input type="range" class="effect-slider" data-uniform="u_fresnel_intensity" min="0" max="5" step="0.01" value="1.0" disabled></div>
            </div>
        </div>
      </div>
    `;

    // --- UI Styling ---
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
      if (!mesh || !mesh.material || !mesh.material.isMeshStandardMaterial) {
        wrapper.innerHTML = '<div style="color:var(--fg-light); text-align:center; padding:20px 0;">Selected mesh has no editable material properties.</div>';
        return;
      }
      // Use the original material for the UI if a custom shader is active
      const mat = mesh.userData.originalMaterial || mesh.material;
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
      
      wrapper.oninput = (e)=>{
        const meshNow = getSelectedMesh();
        if (!meshNow) return;
        // IMPORTANT: Always edit the original material property
        const matNow = meshNow.userData.originalMaterial || meshNow.material;
        
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

    meshSel.onchange = ()=> {
      applyMatUI(getSelectedMesh());
      updateShaderUI();
    };
    if (meshes.length) applyMatUI(getSelectedMesh());
    
    // --- Texture Upload Logic ---
    container.querySelectorAll('.upload-texture-btn').forEach(btn=>{
      btn.addEventListener('click', e=>{
        const mesh = getSelectedMesh();
        if (!mesh) return alert('Select a valid mesh first.');
        App.ui.textureTarget = { mesh, type: e.target.dataset.type };
        document.getElementById('texture-input').click();
      });
    });

    // ========================================================================
    // =================== SHADER IMPLEMENTATION ==============================
    // ========================================================================

    const clock = new THREE.Clock();
    const customUniforms = {
      u_time: { value: 0 },
      u_disp_enabled: { value: 0 }, u_disp_strength: { value: 0.1 }, u_disp_frequency: { value: 5.0 }, u_disp_speed: { value: 0.5 },
      u_dissolve_enabled: { value: 0 }, u_dissolve_threshold: { value: 0.5 }, u_dissolve_edge: { value: 0.1 },
      u_fresnel_enabled: { value: 0 }, u_fresnel_power: { value: 2.0 }, u_fresnel_intensity: { value: 1.0 },
    };
    
    (function tick(){
      customUniforms.u_time.value = clock.getElapsedTime();
      requestAnimationFrame(tick);
    })();

    const shaderHooks = {
      vertex: `
        uniform float u_time;
        uniform float u_disp_enabled; uniform float u_disp_strength; uniform float u_disp_frequency; uniform float u_disp_speed;
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        float snoise(vec3 v) {
            const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
            vec3 i  = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
            vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
            vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
            i = mod289(i);
            vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
            float n_ = 0.142857142857; vec3 ns = n_ * D.wyz - D.xzx;
            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
            vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
            vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
            vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
            vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
            vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w);
            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
            p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }`,
      fragment: `` // Fragment part is built from vertex shader string
    };
    shaderHooks.fragment = `
        uniform float u_time;
        uniform float u_dissolve_enabled; uniform float u_dissolve_threshold; uniform float u_dissolve_edge;
        uniform float u_fresnel_enabled; uniform float u_fresnel_power; uniform float u_fresnel_intensity;
        ${shaderHooks.vertex.substring(shaderHooks.vertex.indexOf('vec3 mod289'))} 
        varying vec3 vWorldPosition;`;

    function applyCustomShaders(mesh) {
      if (!mesh || !mesh.material || !mesh.material.isMeshStandardMaterial) return;
      
      if (!mesh.userData.originalMaterial) {
        mesh.userData.originalMaterial = mesh.material;
      }
      mesh.material = mesh.userData.originalMaterial.clone();
      mesh.material.onBeforeCompile = (shader) => {
        shader.uniforms = { ...shader.uniforms, ...customUniforms };
        shader.vertexShader = shaderHooks.vertex + shader.vertexShader;
        shader.fragmentShader = shaderHooks.fragment + shader.fragmentShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
          #include <begin_vertex>
          if (u_disp_enabled > 0.5) {
            float noise = snoise(transformed * u_disp_frequency + u_time * u_disp_speed);
            transformed += normal * noise * u_disp_strength;
          }`);
        shader.fragmentShader = shader.fragmentShader.replace('#include <output_fragment>', `
            #include <output_fragment>
            if (u_dissolve_enabled > 0.5) {
                float noise = (snoise(vWorldPosition * 2.0) + 1.0) / 2.0; // range 0-1
                float dissolve_value = smoothstep(u_dissolve_threshold - u_dissolve_edge, u_dissolve_threshold + u_dissolve_edge, noise);
                if (dissolve_value < 0.5) discard;
            }
            if (u_fresnel_enabled > 0.5) {
                vec3 viewDirection = normalize(vViewPosition);
                float fresnel = 1.0 - dot(normalize(vNormal), -viewDirection);
                fresnel = pow(fresnel, u_fresnel_power);
                gl_FragColor.rgb += vec3(0.2, 0.5, 1.0) * fresnel * u_fresnel_intensity;
            }`);
         shader.vertexShader = shader.vertexShader.replace('varying vec3 vViewPosition;', 'varying vec3 vViewPosition; varying vec3 vWorldPosition;');
         shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex> \n vWorldPosition = worldPosition.xyz;');
      };
      mesh.material.needsUpdate = true;
    }

    function revertShaders(mesh) {
        if(mesh && mesh.userData.originalMaterial) {
            mesh.material.dispose();
            mesh.material = mesh.userData.originalMaterial;
            delete mesh.userData.originalMaterial;
        }
    }
    
    function updateShaderUI() {
        const mesh = getSelectedMesh();
        const mat = mesh ? mesh.material : null;
        
        container.querySelectorAll('.effect-toggle').forEach(checkbox => {
            const uniformName = checkbox.dataset.uniformBool;
            const isShaderActive = mesh && mesh.userData.originalMaterial;
            const isActive = isShaderActive && mat.uniforms[uniformName] && mat.uniforms[uniformName].value > 0.5;
            checkbox.checked = isActive;

            const slidersContainer = checkbox.closest('.effect-group').querySelector('.sliders-container');
            slidersContainer.classList.toggle('hidden', !isActive);
            slidersContainer.querySelectorAll('input').forEach(slider => {
                slider.disabled = !isActive;
                const uniformName = slider.dataset.uniform;
                if(isActive && customUniforms[uniformName]) {
                    slider.value = customUniforms[uniformName].value;
                }
            });
        });
    }

    container.querySelectorAll('.effect-toggle').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const mesh = getSelectedMesh();
        if (!mesh) return;

        const uniformName = e.target.dataset.uniformBool;
        const isActive = e.target.checked;
        
        const isAnyEffectActive = Array.from(container.querySelectorAll('.effect-toggle')).some(c => c.checked);

        if (isAnyEffectActive && !mesh.userData.originalMaterial) {
          applyCustomShaders(mesh);
        } else if (!isAnyEffectActive && mesh.userData.originalMaterial) {
          revertShaders(mesh);
        }

        if (mesh.material.uniforms && mesh.material.uniforms[uniformName]) {
            mesh.material.uniforms[uniformName].value = isActive ? 1.0 : 0.0;
        }

        const group = e.target.closest('.effect-group');
        const slidersContainer = group.querySelector('.sliders-container');
        slidersContainer.classList.toggle('hidden', !isActive);
        slidersContainer.querySelectorAll('input').forEach(s => s.disabled = !isActive);
      });
    });

    container.querySelectorAll('.effect-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const uniformName = e.target.dataset.uniform;
        const value = parseFloat(e.target.value);
        if (customUniforms[uniformName]) {
            customUniforms[uniformName].value = value;
        }
      });
    });

    updateShaderUI();
  }
}
