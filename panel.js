import { App } from './viewer.js';
import { mountDashboard } from './dashboard.js';
import { mountGrid } from './grid.js';
import { mountTransform } from './transform.js';
import { mountMeshes } from './meshes.js';
import { mountTextures } from './textures.js';
import { mountTabs } from './tabs.js';

export async function initPanels(){
  // Nav switching
  const nav = document.getElementById('bottom-navbar');
  nav.addEventListener('click', (e)=>{
    if (!e.target.matches('.nav-btn')) return;
    const id = e.target.dataset.panel;
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b===e.target));
    document.querySelectorAll('#panel-content .panel').forEach(p=>p.classList.toggle('hidden', p.id!==id));
  });

  mountDashboard();
  mountGrid();
  mountTransform();
  mountMeshes();
  mountTextures();
  mountTabs();

  // refresh aggregator
  App.events.addEventListener('panels:refresh-all', ()=>{
    mountDashboard(true); mountTransform(true); mountMeshes(true); mountTextures(true); mountTabs(true);
  });
}