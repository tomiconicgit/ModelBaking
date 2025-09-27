// tabs.js
import { App, formatBytes } from './viewer.js';

export function mountTabs(refreshOnly=false){
  const el = document.getElementById('tabs-panel');
  if (!refreshOnly){ 
    el.innerHTML = `<div id="tabs-list" style="display:flex; flex-direction:column; gap:12px;"></div>`; 
    // ** THE FIX **: Make the Tabs panel listen for the global refresh event.
    App.events.addEventListener('panels:refresh-all', refresh);
  }
  refresh();

  function refresh(){
    const list = document.getElementById('tabs-list');
    const ids = Object.keys(App.models);
    if (!ids.length){ list.innerHTML = '<div style="color:var(--fg-light); text-align:center; padding: 20px 0;">No models loaded.</div>'; return; }

    list.innerHTML = ids.map(id=>{
      const m = App.models[id]; const isActive = id===App.activeModelId;
      return `
        <div style="background:var(--surface-bg); border:1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}; border-radius:var(--radius-md); padding:16px; box-shadow:${isActive ? '0 0 10px rgba(0,122,255,0.3)' : 'none'}; transition: border .2s, box-shadow .2s;">
          <h3 style="margin:0 0 12px; font-size:1.1rem; word-break:break-all;">${m.fileInfo.name}</h3>
          
          <div style="font-size:0.85rem; color:var(--fg-light); display:grid; grid-template-columns:auto 1fr; gap:4px 12px; margin-bottom: 16px;">
            <strong>Size:</strong><span>${formatBytes(m.fileInfo.size)}</span>
            <strong>Polygons:</strong><span>${m.fileInfo.polygons.toLocaleString()}</span>
            <strong>Vertices:</strong><span>${m.fileInfo.vertices.toLocaleString()}</span>
          </div>

          <div class="button-group">
            <button class="button btn-activate" ${isActive ? 'disabled' : ''} data-id="${id}" style="flex:1;">Activate</button>
            <button class="button accent btn-close" data-id="${id}" style="flex:1;">Close</button>
          </div>
        </div>`;
    }).join('');

    list.querySelectorAll('.btn-activate').forEach(b=> b.onclick = ()=>{ App.setActiveModel(b.dataset.id); App.events.dispatchEvent(new Event('panels:refresh-all')); });
    list.querySelectorAll('.btn-close').forEach(b=> b.onclick = ()=> removeModel(b.dataset.id));
  }

  function removeModel(id){
    const m = App.models[id]; if (!m) return;
    if (!confirm(`Are you sure you want to close "${m.fileInfo.name}"? All unsaved changes will be lost.`)) return;
    
    const sc = m.gltf.scene;
    sc.traverse(o=>{
      if (o.isMesh){ o.geometry?.dispose?.(); if (Array.isArray(o.material)) o.material.forEach(mm=>mm?.dispose?.()); else o.material?.dispose?.(); }
    });
    sc.parent && sc.parent.remove(sc);
    if (m.skeletonHelper) sc.parent && sc.parent.remove(m.skeletonHelper);
    delete App.models[id];
    if (App.activeModelId===id){ const ids = Object.keys(App.models); App.activeModelId = ids[0] || null; }
    App.events.dispatchEvent(new Event('panels:refresh-all'));
  }
}
