import { App, formatBytes } from './viewer.js';

export function mountTabs(refreshOnly=false){
  const el = document.getElementById('tabs-panel');
  if (!refreshOnly){ el.innerHTML = `<div id="tabs-list"></div>`; }
  refresh();

  function refresh(){
    const list = document.getElementById('tabs-list');
    const ids = Object.keys(App.models);
    if (!ids.length){ list.innerHTML = '<div style="opacity:.7">No models loaded.</div>'; return; }

    list.innerHTML = ids.map(id=>{
      const m = App.models[id]; const isActive = id===App.activeModelId;
      return `
        <div style="border:1px solid #2a2f36;border-radius:10px;padding:12px;background:#1e222a;${isActive?'box-shadow:0 0 10px #099':''}">
          <div style="display:flex;justify-content:space-between;gap:12px">
            <h3 style="margin:0;font-size:1rem">${m.fileInfo.name}</h3>
          </div>
          <div style="font-size:.85rem;opacity:.8;margin-top:6px;display:grid;grid-template-columns:auto 1fr;gap:4px 10px">
            <strong>Size:</strong><span>${formatBytes(m.fileInfo.size)}</span>
            <strong>Polygons:</strong><span>${m.fileInfo.polygons.toLocaleString()}</span>
            <strong>Vertices:</strong><span>${m.fileInfo.vertices.toLocaleString()}</span>
          </div>
          <div class="button-group" style="margin-top:10px">
            <button class="button btn-activate" ${isActive?'disabled':''} data-id="${id}">Activate</button>
            <button class="button accent btn-close" data-id="${id}">Close</button>
          </div>
        </div>`;
    }).join('');

    list.querySelectorAll('.btn-activate').forEach(b=> b.onclick = ()=>{ App.activeModelId = b.dataset.id; App.events.dispatchEvent(new Event('panels:refresh-all')); });
    list.querySelectorAll('.btn-close').forEach(b=> b.onclick = ()=> removeModel(b.dataset.id));
  }

  function removeModel(id){
    const m = App.models[id]; if (!m) return;
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