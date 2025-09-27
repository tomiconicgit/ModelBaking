import { App, formatBytes } from './viewer.js';
import './export.js'; // registers modal handlers

export function mountDashboard(refreshOnly=false){
  const el = document.getElementById('dashboard-panel');
  if (!refreshOnly) {
    el.innerHTML = `
      <div class="button-group">
        <label class="button" for="model-input">Load Model(s)</label>
        <button id="export-glb-btn" class="button" disabled>Export Active</button>
        <button id="copy-data-btn" class="button ghost" disabled>Copy Data</button>
        <button id="toggle-rig-btn" class="button ghost" disabled>Show Rig</button>
        <button id="load-anim-btn" class="button ghost">Load Animation</button>
        <button id="remove-anim-btn" class="button accent" disabled>Remove Animation</button>
      </div>
      <div id="anim-ui" class="hidden" style="margin-top:10px">
        <div class="button-group">
          <button id="play-pause-btn" class="button">▶ Play</button>
          <button id="rewind-btn" class="button ghost">−0.5s</button>
          <button id="forward-btn" class="button ghost">+0.5s</button>
        </div>
      </div>
      <div id="dash-status" style="opacity:.7;margin-top:8px">Load a model to begin.</div>
    `;

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

    document.getElementById('copy-data-btn').addEventListener('click', ()=>{
      const m = App.models[App.activeModelId]; if (!m) return;
      const s = m.gltf.scene; const data = { position: s.position.toArray(), scale: s.scale.toArray() };
      navigator.clipboard.writeText(JSON.stringify(data,null,2)).then(()=>alert('Model data copied.'));
    });

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
    document.getElementById('export-glb-btn').disabled = !m;
    document.getElementById('copy-data-btn').disabled = !m;
    const rigBtn = document.getElementById('toggle-rig-btn');
    if (m?.skeletonHelper){ rigBtn.disabled=false; rigBtn.textContent = m.skeletonHelper.visible ? 'Hide Rig' : 'Show Rig'; }
    else { rigBtn.disabled=true; }

    const animUI = document.getElementById('anim-ui');
    if (m?.animation){
      animUI.classList.remove('hidden');
      const playBtn = document.getElementById('play-pause-btn');
      playBtn.textContent = m.animation.action.isRunning() ? '❚❚ Pause' : '▶ Play';
    } else {
      animUI.classList.add('hidden');
    }

    document.getElementById('dash-status').textContent = m
      ? `${m.fileInfo.name} — ${formatBytes(m.fileInfo.size)} — P:${m.fileInfo.polygons.toLocaleString()} V:${m.fileInfo.vertices.toLocaleString()}`
      : 'Load a model to begin.';
  }
}