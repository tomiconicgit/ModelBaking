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

function handleExport(options) {
    const inputs = getExportInputs();
    if (!inputs) return;

    const overlay = document.getElementById('loading-overlay');
    document.getElementById('export-modal').classList.add('hidden');
    overlay.classList.remove('hidden');

    // Use a timeout to allow the UI to update before the heavy export task begins
    setTimeout(() => {
        App.exportModel(inputs.id, inputs.filename, {
            ...options,
            onComplete: () => overlay.classList.add('hidden'),
            onError: () => overlay.classList.add('hidden'),
        });
    }, 50);
}

document.getElementById('cancel-export-btn').addEventListener('click', () => {
  document.getElementById('export-modal').classList.add('hidden');
});

// Standard GLB export
document.getElementById('confirm-export-btn').addEventListener('click', () => {
  handleExport({ withDraco: false });
});

// Draco GLB export
document.getElementById('confirm-export-draco-btn').addEventListener('click', () => {
  handleExport({ withDraco: true });
});
