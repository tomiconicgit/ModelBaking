// dashboard.js
import { App, formatBytes } from './viewer.js';
import './export.js'; // registers modal handlers
import * as THREE from 'three'; // Import THREE to use its utils

export function mountDashboard(refreshOnly=false){
  const el = document.getElementById('dashboard-panel');
  if (!refreshOnly) {
    el.innerHTML = `
      <div id="dash-status" style="color: var(--fg-light); margin-bottom: 20px; text-align: center;">Load a model to begin.</div>
      
      <div class="button-group" style="flex-direction: column;">
        <label class="button" for="model-input">Load Model(s)</label>
        <button id="export-glb-btn" class="button ghost" disabled>Export Active</button>
        <button id="center-camera-btn" class="button ghost">Reset View</button>
      </div>

      <div id="anim-ui" class="hidden" style="margin-top:20px; padding-top:20px; border-top: 1px solid var(--border);">
        <h4 class="panel-title" style="margin-bottom:16px; text-align:center;">Animation Controls</h4>
        <div class="button-group" style="justify-content:center;">
            <button id="rewind-btn" class="button ghost">« 0.5s</button>
            <button id="play-pause-btn" class="button">▶ Play</button>
            <button id="forward-btn" class="button ghost">+0.5s »</button>
        </div>
        <div class="button-group" style="margin-top: 12px;">
            <button id="remove-anim-btn" class="button accent" style="width:100%" disabled>Remove Animation</button>
        </div>
      </div>

      <div style="margin-top:20px; padding-top:20px; border-top: 1px solid var(--border);">
        <div class="button-group" style="flex-direction: column;">
            <button id="load-anim-btn" class="button ghost">Load Animation</button>
            <button id="toggle-rig-btn" class="button ghost" disabled>Show Rig</button>
            <button id="copy-data-btn" class="button ghost" disabled>Copy Data</button>
        </div>
      </div>
    `;

    // --- BEGIN MODIFICATION: Add event listener for the new button ---
    document.getElementById('center-camera-btn').addEventListener('click', () => {
      App.centerCamera();
    });
    // --- END MODIFICATION ---

    document.getElementById('export-glb-btn').addEventListener('click', ()=> {
      const modal = document.getElementById('export-modal');
      if (!Object.keys(App.models).length) return alert('No models to export.');
      const sel = document.getElementById('export-model-select');
      sel.innerHTML = Object.entries(App.models).map(([id,m])=>`<option value="${id}">${m.fileInfo.name}</option>`).join('');
      sel.value = App.activeModelId || sel.options[0].value;
      const currentName = App.models[sel.value].fileInfo.name.replace(/\.glb$/i,'');
      document.getElementById('export-filename-input').value = `${currentName}_edited`;
      modal.classList.remove('hidden');
    });

    // --- MODIFIED CODE START ---
    document.getElementById('copy-data-btn').addEventListener('click', () => {
      const m = App.models[App.activeModelId];
      if (!m) return;

      const s = m.anchor;
      const euler = new THREE.Euler().setFromQuaternion(s.quaternion, 'YXZ');
      
      const rotationInDegrees = [
        parseFloat(THREE.MathUtils.radToDeg(euler.x).toFixed(2)),
        parseFloat(THREE.MathUtils.radToDeg(euler.y).toFixed(2)),
        parseFloat(THREE.MathUtils.radToDeg(euler.z).toFixed(2))
      ];

      const data = {
        position: s.position.toArray().map(v => parseFloat(v.toFixed(4))),
        scale: s.scale.toArray().map(v => parseFloat(v.toFixed(4))),
        rotation: rotationInDegrees,
        rotationOrder: 'YXZ'
      };
      
      const dataString = JSON.stringify(data, null, 2);

      // --- Robust Clipboard Logic ---
      if (navigator.clipboard && window.isSecureContext) {
        // Modern async method (requires HTTPS or localhost)
        navigator.clipboard.writeText(dataString)
          .then(() => alert('✅ Transform data copied to clipboard!'))
          .catch(err => {
            console.error('Failed to copy with modern API:', err);
            fallbackCopyTextToClipboard(dataString);
          });
      } else {
        // Fallback for insecure contexts (like file://) or older browsers
        fallbackCopyTextToClipboard(dataString);
      }
    });

    function fallbackCopyTextToClipboard(text) {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      
      // Avoid scrolling to bottom
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
    
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
    
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          alert('✅ Transform data copied (using fallback method)!');
        } else {
          alert('❌ Copying failed. Please copy from the browser console.');
          console.log('Fallback copy failed. Data to copy manually:', text);
        }
      } catch (err) {
        alert('❌ An error occurred during copy. Please copy from the browser console.');
        console.error('Fallback copy error', err);
        console.log('Data to copy manually:', text);
      }
    
      document.body.removeChild(textArea);
    }
    // --- MODIFIED CODE END ---


    document.getElementById('toggle-rig-btn').addEventListener('click', ()=>{
      const m = App.models[App.activeModelId]; if (m?.skeletonHelper){ m.skeletonHelper.visible = !m.skeletonHelper.visible; refresh(); }
    });

    document.getElementById('load-anim-btn').addEventListener('click', ()=> document.getElementById('animation-input').click());
    document.getElementById('remove-anim-btn').addEventListener('click', ()=>{
      const m = App.models[App.activeModelId]; if (m?.animation){ m.mixer.stopAllAction(); m.mixer.uncacheClip(m.animation.clip); m.animation=null; refresh(); }
    });

    document.getElementById('play-pause-btn').addEventListener('click', ()=>{
      const m = App.models[App.activeModelId]; if (!m?.animation) return;
      const a = m.animation.action; a.paused = !a.paused; if (!a.isRunning()) a.play(); refresh();
    });
    document.getElementById('rewind-btn').addEventListener('click', ()=>{ const m=App.models[App.activeModelId]; if (m?.animation){ m.animation.action.time=Math.max(0,m.animation.action.time-0.5); m.mixer.update(0); }});
    document.getElementById('forward-btn').addEventListener('click', ()=>{ const m=App.models[App.activeModelId]; if (m?.animation){ m.animation.action.time+=0.5; m.mixer.update(0); }});

    App.events.addEventListener('dashboard:refresh', refresh);
  }

  refresh();

  function refresh(){
    const m = App.models[App.activeModelId];
    const hasModel = !!m;

    document.getElementById('export-glb-btn').disabled = !hasModel;
    document.getElementById('copy-data-btn').disabled = !hasModel;
    const rigBtn = document.getElementById('toggle-rig-btn');
    if (m?.skeletonHelper){ rigBtn.disabled=false; rigBtn.textContent = m.skeletonHelper.visible ? 'Hide Rig' : 'Show Rig'; }
    else { rigBtn.disabled=true; rigBtn.textContent = 'Show Rig'; }

    const animUI = document.getElementById('anim-ui');
    if (m?.animation){
      animUI.classList.remove('hidden');
      const playBtn = document.getElementById('play-pause-btn');
      const isPlaying = m.animation.action.isRunning() && !m.animation.action.paused;
      playBtn.textContent = isPlaying ? '⏸ Pause' : '▶ Play';
      document.getElementById('remove-anim-btn').disabled = false;
    } else {
      animUI.classList.add('hidden');
    }

    document.getElementById('dash-status').innerHTML = m
      ? `<strong>${m.fileInfo.name}</strong><br><span style="font-size:0.85em;">${formatBytes(m.fileInfo.size)} | P:${m.fileInfo.polygons.toLocaleString()} V:${m.fileInfo.vertices.toLocaleString()}</span>`
      : 'Load a model to begin.';
  }
}
