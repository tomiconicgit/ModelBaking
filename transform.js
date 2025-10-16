// transform.js
import * as THREE from 'three';
import { App } from './viewer.js';

export function mountTransform(refreshOnly=false){
  const host = document.getElementById('transform-panel');
  if (!refreshOnly){
    host.innerHTML = `<div id="transform-controls-wrapper"></div>`;
    App.events.addEventListener('transform:refresh', build);
    App.events.addEventListener('panels:refresh-all', build);
  }
  build();

  function build(){
    const m = App.models[App.activeModelId];
    const wrap = document.getElementById('transform-controls-wrapper');
    if (!m){ wrap.innerHTML = '<div style="color:var(--fg-light); text-align:center; padding: 20px 0;">Select an active model to see transform controls.</div>'; return; }

    const s = m.anchor;
    const euler = new THREE.Euler().setFromQuaternion(s.quaternion, 'YXZ');

    const sliderRow = (id, label, val, min, max, step, decimals=2)=>`
      <div class="slider-row" data-id="${id}" data-step="${step}" data-decimals="${decimals}">
        <label>${label}</label>
        <input type="range" class="rng" value="${val}" min="${min}" max="${max}" step="${step / 10}">
        <input type="number" class="num" value="${val.toFixed(decimals)}" step="${step}">
      </div>`;

    wrap.innerHTML = `
      <div class="button-group" style="margin-bottom: 24px;">
        <button id="snap-center-btn" class="button ghost">Snap to Center</button>
      </div>

      <div class="transform-group">
        <h4>Position</h4>
        ${sliderRow('pos-x','X', s.position.x, -300, 300, 0.1, 2)}
        ${sliderRow('pos-y','Y', s.position.y, -300, 300, 0.1, 2)}
        ${sliderRow('pos-z','Z', s.position.z, -300, 300, 0.1, 2)}
      </div>
      <div class="transform-group">
        <h4>Rotation (deg)</h4>
        ${sliderRow('rot-x','X', THREE.MathUtils.radToDeg(euler.x), -180, 180, 1, 1)}
        ${sliderRow('rot-y','Y', THREE.MathUtils.radToDeg(euler.y), -180, 180, 1, 1)}
        ${sliderRow('rot-z','Z', THREE.MathUtils.radToDeg(euler.z), -180, 180, 1, 1)}
      </div>
      <div class="transform-group">
        <h4>Scale</h4>
        ${sliderRow('scl-x','X', s.scale.x, 0.01, 10, 0.01, 3)}
        ${sliderRow('scl-y','Y', s.scale.y, 0.01, 10, 0.01, 3)}
        ${sliderRow('scl-z','Z', s.scale.z, 0.01, 10, 0.01, 3)}
      </div>
    `;

    document.getElementById('snap-center-btn').addEventListener('click', () => {
        App.snapActiveToCenterTile();
        App.events.dispatchEvent(new Event('transform:refresh'));
    });

    wrap.querySelectorAll('.slider-row').forEach(row => {
      const rng = row.querySelector('.rng');
      const num = row.querySelector('.num');
      const id  = row.dataset.id;
      const step = parseFloat(row.dataset.step);
      const decimals = parseInt(row.dataset.decimals);

      const syncInputs = (source) => {
          const val = parseFloat(source.value);
          if (isNaN(val)) return;
          if (source.type === 'range') {
              num.value = val.toFixed(decimals);
          } else {
              rng.value = val;
          }
          applyTransform(val);
      };

      const applyTransform = (val) => {
          const model = App.getActive();
          if (!model) return;
          const target = model.anchor;

          if (id.startsWith('pos-')) {
              target.position[id.slice(-1)] = val;
          } else if (id.startsWith('scl-')) {
              target.scale[id.slice(-1)] = val;
          } else if (id.startsWith('rot-')) {
              const euler = new THREE.Euler().setFromQuaternion(target.quaternion, 'YXZ');
              euler[id.slice(-1)] = THREE.MathUtils.degToRad(val);
              target.quaternion.setFromEuler(euler);
          }
      };

      rng.addEventListener('input', () => syncInputs(rng));
      num.addEventListener('input', () => syncInputs(num));
    });
  }
}
