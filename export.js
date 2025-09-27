import { App } from './viewer.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const exporter = new GLTFExporter();

document.getElementById('cancel-export-btn').addEventListener('click', ()=>{
  document.getElementById('export-modal').classList.add('hidden');
});

document.getElementById('confirm-export-btn').addEventListener('click', ()=>{
  const id = document.getElementById('export-model-select').value;
  const m = App.models[id];
  let filename = document.getElementById('export-filename-input').value.trim();
  if (!m) return alert('Select a model.');
  if (!filename) return alert('Provide a filename.');
  if (!/\.glb$/i.test(filename)) filename += '.glb';

  const options = { binary:true, animations: m.animation ? [m.animation.clip] : m.gltf.animations };
  exporter.parse(m.gltf.scene, (buffer)=>{
    const blob = new Blob([buffer], { type:'model/gltf-binary' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
  }, (err)=> alert('Export failed: '+(err?.message||err)), options);

  document.getElementById('export-modal').classList.add('hidden');
});