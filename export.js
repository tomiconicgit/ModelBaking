import { App } from './viewer.js';

document.getElementById('cancel-export-btn').addEventListener('click', ()=>{
  document.getElementById('export-modal').classList.add('hidden');
});

document.getElementById('confirm-export-btn').addEventListener('click', ()=>{
  const id = document.getElementById('export-model-select').value;
  let filename = document.getElementById('export-filename-input').value.trim();
  const model = App.models[id];

  if (!model) return alert('Select a model.');
  if (!filename) return alert('Provide a filename.');
  if (!/\.glb$/i.test(filename)) filename += '.glb';

  App.exportModel(id, filename);
  document.getElementById('export-modal').classList.add('hidden');
});
