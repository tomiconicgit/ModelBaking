import * as THREE from 'three';
import { App } from './viewer.js';

export function mountTransform(refreshOnly=false){
  const host = document.getElementById('transform-panel');
  if (!refreshOnly){
    host.innerHTML = `<div id="transform-controls-wrapper"><div style="color:var(--fg-light); text-align:center; padding: 20px 0;">Select an active model to see transform controls.</div></div>`;
    App.events.addEventListener('transform:refresh', build);
    App.events.addEventListener('panels:refresh-all', build);
  }
  build();

  function build(){
    const m = App.models[App.activeModelId];
    const wrap = document.getElementById('transform-controls-wrapper');
    if (!m){ wrap.innerHTML = '<div style="color:var(--fg-light); text-align:center; padding: 20px 0;">Select an active model to see transform controls.</div>'; return; }

    const s = m.gltf.scene;
    const euler = new THREE.Euler().setFromQuaternion(s.quaternion, 'YXZ');

    const sliderRow = (id, label, val, min, max, step, decimals=2)=>`
      <div class="slider-row" data-row="${id}" data-step="${step}" data-min="${min}" data-max="${max}" data-decimals="${decimals}">
        <label>${label}</label>
        <input type="number" class="num" value="${val}" step="${step}">
        <button class="nudge" data-dir="-1">−</button>
        <button class="nudge" data-dir="1">+</button>
        <input type="range" class="rng" value="${val}" min="${min}" max="${max}" step="${step/10}">
      </div>`;

    wrap.innerHTML = `
      <div class="transform-group">
        <h4>Position</h4>
        ${sliderRow('pos-x','X', s.position.x.toFixed(2), -25, 25, 0.1, 2)}
        ${sliderRow('pos-y','Y', s.position.y.toFixed(2), -25, 25, 0.1, 2)}
        ${sliderRow('pos-z','Z', s.position.z.toFixed(2), -25, 25, 0.1, 2)}
      </div>
      <div class="transform-group">
        <h4>Rotation (deg)</h4>
        ${sliderRow('rot-x','X', THREE.MathUtils.radToDeg(euler.x).toFixed(1), -180, 180, 5, 1)}
        ${sliderRow('rot-y','Y', THREE.MathUtils.radToDeg(euler.y).toFixed(1), -180, 180, 5, 1)}
        ${sliderRow('rot-z','Z', THREE.MathUtils.radToDeg(euler.z).toFixed(1), -180, 180, 5, 1)}
      </div>
      <div class="transform-group">
        <h4>Scale (Per-Axis)</h4>
        ${sliderRow('scl-x','X', s.scale.x.toFixed(3), 0.01, 10, 0.05, 3)}
        ${sliderRow('scl-y','Y', s.scale.y.toFixed(3), 0.01, 10, 0.05, 3)}
        ${sliderRow('scl-z','Z', s.scale.z.toFixed(3), 0.01, 10, 0.05, 3)}
      </div>
      <div class="transform-group">
        <h4>Scale (Uniform)</h4>
        ${sliderRow('uni','U', '1.00', 0.5, 2.0, 0.05, 2)}
      </div>
    `;

    wrap.querySelectorAll('.slider-row').forEach(row=>{
      const rng = row.querySelector('.rng');
      const num = row.querySelector('.num');
      const id  = row.dataset.row;
      const step = parseFloat(row.dataset.step);
      const min = parseFloat(row.dataset.min);
      const max = parseFloat(row.dataset.max);
      const decimals = parseInt(row.dataset.decimals || 2);

      const clamp = (v, targetId)=> {
        const r = wrap.querySelector(`[data-row="${targetId}"]`);
        const rMin = parseFloat(r.dataset.min);
        const rMax = parseFloat(r.dataset.max);
        return Math.min(rMax, Math.max(rMin, v));
      }

      const apply = (val, source)=>{
        const scn = App.models[App.activeModelId]?.gltf.scene; if (!scn) return;
        let clampedVal = clamp(val, id);
        
        if (source !== 'num') { num.value = clampedVal.toFixed(decimals); }
        if (source !== 'rng') { rng.value = clampedVal; }
        
        if (id.startsWith('pos-')){
          if (id==='pos-x') scn.position.x = clampedVal; else if (id==='pos-y') scn.position.y = clampedVal; else scn.position.z = clampedVal;
        } else if (id.startsWith('rot-')){
          const cur = new THREE.Euler().setFromQuaternion(scn.quaternion, 'YXZ');
          const rx = id==='rot-x' ? THREE.MathUtils.degToRad(clampedVal) : cur.x;
          const ry = id==='rot-y' ? THREE.MathUtils.degToRad(clampedVal) : cur.y;
          const rz = id==='rot-z' ? THREE.MathUtils.degToRad(clampedVal) : cur.z;
          scn.quaternion.setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
        } else if (id.startsWith('scl-')){
          if (id==='scl-x') scn.scale.x = clampedVal; else if (id==='scl-y') scn.scale.y = clampedVal; else scn.scale.z = clampedVal;
        } else if (id==='uni'){
          // Uniform scale is multiplicative, so we reset its own slider after applying
          scn.scale.multiplyScalar(clampedVal);
          rng.value = 1.0; num.value = (1.0).toFixed(decimals);
          // reflect into per-axis fields
          ['x','y','z'].forEach(axis=>{
            const r = wrap.querySelector(`[data-row="scl-${axis}"]`);
            const newV = clamp(scn.scale[axis], `scl-${axis}`);
            r.querySelector('.rng').value = newV;
            r.querySelector('.num').value = newV.toFixed(3);
          });
        }
      };

      rng.addEventListener('input', ()=> apply(parseFloat(rng.value), 'rng'));
      num.addEventListener('input', ()=> { const v = parseFloat(num.value); if (!isNaN(v)) apply(v, 'num'); });
      row.querySelectorAll('.nudge').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const dir = parseFloat(btn.dataset.dir);
          const cur = (id.startsWith('scl-') || id.startsWith('pos-')) 
              ? parseFloat(num.value) 
              : parseFloat(rng.value);
          apply(cur + dir*step, 'nudge');
        });
      });
    });
  }
}
