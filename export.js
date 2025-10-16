import { App } from './viewer.js';

function getExportInputs() {
  const id = document.getElementById('export-model-select').value;
  let filename = document.getElementById('export-filename-input').value.trim();
  const model = App.models[id];

  if (!model) {
    alert('Select a model.');
    return null;
  }
  if (!filename) {
    alert('Provide a filename.');
    return null;
  }
  if (!/\.glb$/i.test(filename)) {
    filename += '.glb';
  }
  return { id, filename };
}

document.getElementById('cancel-export-btn').addEventListener('click', () => {
  document.getElementById('export-modal').classList.add('hidden');
});

// Standard GLB export
document.getElementById('confirm-export-btn').addEventListener('click', () => {
  const inputs = getExportInputs();
  if (inputs) {
    App.exportModel(inputs.id, inputs.filename, { withDraco: false });
    document.getElementById('export-modal').classList.add('hidden');
  }
});

// Draco GLB export
document.getElementById('confirm-export-draco-btn').addEventListener('click', () => {
  const inputs = getExportInputs();
  if (inputs) {
    App.exportModel(inputs.id, inputs.filename, { withDraco: true });
    document.getElementById('export-modal').classList.add('hidden');
  }
});
