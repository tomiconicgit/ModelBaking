import { App } from './viewer.js';

export function mountGrid(refreshOnly=false){
  const el = document.getElementById('grid-panel');
  if (!refreshOnly){
    el.innerHTML = `
      <div class="button-group">
        <button id="fit-tiles-btn" class="button">Fit Active to Tiles (1×1)</button>
        <button id="snap-center-btn" class="button">Snap Active to Center Tile</button>
        <button id="place-cursor-btn" class="button ghost">Place Active at Cursor</button>
        <button id="stick-ground-btn" class="button ghost">Stick Active to Ground</button>
      </div>
      <div style="margin-top:10px">
        <div class="button-group">
          <button id="origin-center-bake-btn" class="button ghost">Origin = BBox Center (Bake)</button>
          <button id="origin-bottom-bake-btn" class="button ghost">Origin = Bottom Center (Bake)</button>
        </div>
        <div style="opacity:.7;margin-top:4px">Origin tools change pivot without visual shift and bake it so GLB remembers it.</div>
      </div>
    `;

    document.getElementById('fit-tiles-btn').addEventListener('click', ()=> App.fitActiveToTiles(1,1));
    document.getElementById('snap-center-btn').addEventListener('click', ()=> App.snapToCenterAndZero());
    document.getElementById('stick-ground-btn').addEventListener('click', ()=> App.stickActiveToGround());
    document.getElementById('place-cursor-btn').addEventListener('click', ()=>{
      // Move to current red cursor cross, but then zero translation so sliders show 0.
      const root = App.getActiveRoot(); if (!root) return;
      const p = window.__cursorCross?.position || {x:0.5*App.GRID.tile, y:0, z:0.5*App.GRID.tile}; // fallback
      root.position.set(p.x, root.position.y, p.z);
      // zero so sliders show 0
      root.children.forEach(ch=> ch.position.add(root.position));
      root.position.set(0,0,0);
      App.events.dispatchEvent(new Event('transform:refresh'));
    });

    // pivot bake
    document.getElementById('origin-center-bake-btn').addEventListener('click', ()=> bakeOrigin('center'));
    document.getElementById('origin-bottom-bake-btn').addEventListener('click', ()=> bakeOrigin('bottom'));
  }
}

/** Same bake function you had, kept here for the Grid panel */
function bakeOrigin(mode='center'){
  const root = App.getActiveRoot(); if (!root) return alert('No active model.');
  // compute bbox target
  root.updateWorldMatrix(true,true);
  const box = new THREE.Box3().setFromObject(root);
  const centerW = box.getCenter(new THREE.Vector3());
  const targetW = (mode==='bottom') ? new THREE.Vector3(centerW.x, box.min.y, centerW.z) : centerW;
  const targetL = root.worldToLocal(targetW.clone());

  // shift children by -targetL, then move root by +targetL
  root.children.forEach(ch=> ch.position.sub(targetL));
  root.position.add(targetL);

  // bake local transforms into geometry for non-skinned meshes
  root.updateWorldMatrix(true,true);
  const invRootWorld = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const meshes=[]; root.traverse(o=>{ if (o.isMesh && !o.isSkinnedMesh && o.geometry) meshes.push(o); });
  meshes.forEach(mesh=>{
    mesh.updateWorldMatrix(true,false);
    const mWorld = mesh.matrixWorld.clone();
    const mLocalToRoot = new THREE.Matrix4().multiplyMatrices(invRootWorld, mWorld);
    mesh.geometry.applyMatrix4(mLocalToRoot);
    mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
    mesh.position.set(0,0,0); mesh.quaternion.identity(); mesh.scale.set(1,1,1); mesh.updateMatrix();
    if (mesh.parent !== root){ mesh.parent.remove(mesh); root.add(mesh); }
  });

  alert('Origin baked.');
}