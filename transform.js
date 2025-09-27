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
        <h4>Scale (per-axis)</h4>
        ${sliderRow('scl-x','X', s.scale.x.toFixed(3), 0.01, 10, 0.05, 3)}
        ${sliderRow('scl-y','Y', s.scale.y.toFixed(3), 0.01, 10, 0.05, 3)}
        ${sliderRow('scl-z','Z', s.scale.z.toFixed(3), 0.01, 10, 0.05, 3)}
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

      const clamp = (v)=>Math.min(max,Math.max(min,v));

      const apply = (val, source)=>{
        val = clamp(val);
        const scn = App.models[App.activeModelId]?.gltf.scene; if (!scn) return;
        
        if (source === 'rng') { num.value = val.toFixed(decimals); }
        if (source === 'num') { rng.value = val; }
        
        if (id.startsWith('pos-')){
          if (id==='pos-x') scn.position.x = val; else if (id==='pos-y') scn.position.y = val; else scn.position.z = val;
        } else if (id.startsWith('rot-')){
          const cur = new THREE.Euler().setFromQuaternion(scn.quaternion, 'YXZ');
          const rx = id==='rot-x' ? THREE.MathUtils.degToRad(val) : cur.x;
          const ry = id==='rot-y' ? THREE.MathUtils.degToRad(val) : cur.y;
          const rz = id==='rot-z' ? THREE.MathUtils.degToRad(val) : cur.z;
          scn.quaternion.setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
        } else if (id.startsWith('scl-')){
          if (id==='scl-x') scn.scale.x = val; else if (id==='scl-y') scn.scale.y = val; else scn.scale.z = val;
        }
      };

      rng.addEventListener('input', ()=> apply(parseFloat(rng.value), 'rng'));
      num.addEventListener('input', ()=> { const v = parseFloat(num.value); if (!isNaN(v)) apply(v, 'num'); });
    });
  }
}
