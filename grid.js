// grid.js
// Grid utilities panel (fits, snap, place-at-cursor, stick-to-ground, origin bake)

import { App } from './viewer.js';

export function mountGrid(refreshOnly = false) {
  const el = document.getElementById('grid-panel');

  if (!refreshOnly) {
    el.innerHTML = `
      <h3 class="panel-title">Positioning</h3>
      <div class="button-group" style="flex-direction: column;">
        <button id="fit-tiles-btn" class="button">Fit Active to Tile (1×1)</button>
        <button id="snap-center-btn" class="button">Snap Active to Center</button>
        <button id="place-cursor-btn" class="button ghost">Place Active at Cursor</button>
        <button id="stick-ground-btn" class="button ghost">Stick Active to Ground</button>
      </div>

      <div style="margin-top:24px; padding-top:24px; border-top: 1px solid var(--border)">
        <h3 class="panel-title">Pivot / Origin (Bake)</h3>
        <p style="color:var(--fg-light); margin:-12px 0 16px; font-size:0.9rem;">Changes the model's internal pivot point. This action is destructive and permanent for the session.</p>
        <div class="button-group" style="flex-direction: column;">
          <button id="origin-center-bake-btn" class="button ghost">Origin to Bounding Box Center</button>
          <button id="origin-bottom-bake-btn" class="button ghost">Origin to Bottom Center</button>
        </div>
      </div>
    `;

    // Fit 1x1 tiles, which corresponds to the game's TILE_SIZE of 1 world unit.
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
