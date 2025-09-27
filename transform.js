import * as THREE from 'three';
import { App } from './viewer.js';

export function mountTransform(refreshOnly=false){
  const host = document.getElementById('transform-panel');
  if (!refreshOnly){
    host.innerHTML = `<div id="transform-controls-wrapper"><div style="opacity:.7">Select an active model to see transform controls.</div></div>`;
    App.events.addEventListener('transform:refresh', build);
    App.events.addEventListener('panels:refresh-all', build);
  }
  build();

  function build(){
    const m = App.models[App.activeModelId];
    const wrap = document.getElementById('transform-controls-wrapper');
    if (!m){ wrap.innerHTML = '<div style="opacity:.7">Select an active model to see transform controls.</div>'; return; }

    const s = m.gltf.scene;
    const euler = new THREE.Euler().setFromQuaternion(s.quaternion, 'YXZ');

    const sliderRow = (id, label, val, min, max, step, decimals=2)=>`
      <div class="slider-row" data-row="${id}" data-step="${step}" data-min="${min}" data-max="${max}" data-decimals="${decimals}">
        <label>${label}</label>
        <button class="nudge" data-dir="-1">−</button>
        <input type="range" class="rng" value="${val}" min="${min}" max="${max}" step="${step}">
        <input type="number" class="num" value="${val}" step="${step}">
        <button class="nudge" data-dir="1">+</button>
      </div>`;

    wrap.innerHTML = `
      <div>
        <h4>Position</h4>
        ${sliderRow('pos-x','X', s.position.x.toFixed(2), -250, 250, 0.10, 2)}
        ${sliderRow('pos-y','Y', s.position.y.toFixed(2), -50,  50,  0.10, 2)}
        ${sliderRow('pos-z','Z', s.position.z.toFixed(2), -250, 250, 0.10, 2)}
      </div>
      <div style="margin-top:8px">
        <h4>Rotation (deg)</h4>
        ${sliderRow('rot-x','X', THREE.MathUtils.radToDeg(euler.x).toFixed(1), -180, 180, 10.0, 1)}
        ${sliderRow('rot-y','Y', THREE.MathUtils.radToDeg(euler.y).toFixed(1), -180, 180, 10.0, 1)}
        ${sliderRow('rot-z','Z', THREE.MathUtils.radToDeg(euler.z).toFixed(1), -180, 180, 10.0, 1)}
      </div>
      <div style="margin-top:8px">
        <h4>Scale (per-axis)</h4>
        ${sliderRow('scl-x','X', s.scale.x.toFixed(3), 0.01, 50, 1.000, 3)}
        ${sliderRow('scl-y','Y', s.scale.y.toFixed(3), 0.01, 50, 1.000, 3)}
        ${sliderRow('scl-z','Z', s.scale.z.toFixed(3), 0.01, 50, 1.000, 3)}
      </div>
      <div style="margin-top:8px">
        <h4>Uniform Scale</h4>
        ${sliderRow('uni','U', '1.00', 0.01, 50, 1.00, 2)}
      </div>
    `;

    // Bind rows
    wrap.querySelectorAll('.slider-row').forEach(row=>{
      const rng = row.querySelector('.rng');
      const num = row.querySelector('.num');
      const id  = row.dataset.row;
      const step = parseFloat(row.dataset.step);
      const min = parseFloat(row.dataset.min);
      const max = parseFloat(row.dataset.max);
      const decimals = parseInt(row.dataset.decimals||2);

      const clamp = (v)=>Math.min(max,Math.max(min,v));
      const setNum = (el,v,dec)=>{ el.value = Number(v).toFixed(dec); };

      const apply = (val)=>{
        val = clamp(val);
        rng.value = val; setNum(num, val, decimals);
        const scn = App.models[App.activeModelId]?.gltf.scene; if (!scn) return;

        if (id.startsWith('pos-')){
          const p = scn.position.clone();
          if (id==='pos-x') p.x = val; else if (id==='pos-y') p.y = val; else p.z = val;
          scn.position.copy(p);
        } else if (id.startsWith('rot-')){
          const cur = new THREE.Euler().setFromQuaternion(scn.quaternion, 'YXZ');
          const rx = id==='rot-x' ? THREE.MathUtils.degToRad(val) : cur.x;
          const ry = id==='rot-y' ? THREE.MathUtils.degToRad(val) : cur.y;
          const rz = id==='rot-z' ? THREE.MathUtils.degToRad(val) : cur.z;
          scn.quaternion.setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
        } else if (id.startsWith('scl-')){
          const sc = scn.scale.clone();
          if (id==='scl-x') sc.x = val; else if (id==='scl-y') sc.y = val; else sc.z = val;
          scn.scale.copy(sc);
        } else if (id==='uni'){
          const f = val;
          scn.scale.multiplyScalar(f); // multiply from current — coarse uniform steps
          // reflect into per-axis fields
          ['x','y','z'].forEach(axis=>{
            const r = wrap.querySelector(`[data-row="scl-${axis}"]`);
            r.querySelector('.rng').value = scn.scale[axis];
            r.querySelector('.num').value = scn.scale[axis].toFixed(3);
          });
        }
      };

      rng.addEventListener('input', ()=> apply(parseFloat(rng.value)));
      num.addEventListener('input', ()=> { const v = parseFloat(num.value); if (!isNaN(v)) apply(v); });

      row.querySelectorAll('.nudge').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const dir = parseFloat(btn.dataset.dir);
          const cur = parseFloat(rng.value);
          apply(cur + dir*step);
        });
      });
    });
  }
}