// grid.js
// Grid utilities panel (fits, snap, place-at-cursor, stick-to-ground, origin bake)

import { App } from './viewer.js';

export function mountGrid(refreshOnly = false) {
  const el = document.getElementById('grid-panel');

  if (!refreshOnly) {
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
        <div style="opacity:.7;margin-top:4px">
          Origin tools change the internal pivot without visual shift and bake it so the GLB remembers it.
        </div>
      </div>
    `;

    // Fit 1×1 tiles to your game grid size
    document.getElementById('fit-tiles-btn').addEventListener('click', () => {
      App.fitActiveToTiles(1, 1);
      // scale changed -> reflect in transform panel
      App.events.dispatchEvent(new Event('transform:refresh'));
    });

    // Snap to center tile AND zero local X/Z so transform sliders show 0.00
    document.getElementById('snap-center-btn').addEventListener('click', () => {
      App.snapActiveToCenterTile();
      // ensure transform panel reflects 0.00 / 0.00 (X/Z)
      App.events.dispatchEvent(new Event('transform:refresh'));
    });

    // Place at cursor (moves anchor only; local transform stays zero)
    document.getElementById('place-cursor-btn').addEventListener('click', () => {
      App.placeActiveAtCursor();
      // no change to local transform → sliders remain as-is
    });

    // Drop to Y=0 and refresh transform (Y changed)
    document.getElementById('stick-ground-btn').addEventListener('click', () => {
      App.stickActiveToGround();
      App.events.dispatchEvent(new Event('transform:refresh'));
    });

    // Origin bake (use viewer’s implementation)
    document
      .getElementById('origin-center-bake-btn')
      .addEventListener('click', () => App.bakeOrigin('center'));
    document
      .getElementById('origin-bottom-bake-btn')
      .addEventListener('click', () => App.bakeOrigin('bottom'));
  }
}