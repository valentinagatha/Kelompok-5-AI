const JSZip = window.JSZip;
import { state } from './state.js';
import { CATEGORIES, CATEGORY_ORDER } from './config.js';

export async function exportZip(onProgress) {
  const zip = new JSZip();

  // Ensure all 4 folders exist even if empty
  for (const cat of CATEGORY_ORDER) {
    zip.folder(cat);
  }

  let processed = 0;
  const total = state.files.length;

  for (const fileObj of state.files) {
    const cat = state.classifications[fileObj.id] || CATEGORIES.LAINNYA;
    const folder = zip.folder(cat);
    const blob = fileObj.file.slice(0, fileObj.file.size, fileObj.file.type);
    folder.file(fileObj.name, blob);
    processed++;
    if (onProgress) onProgress(processed, total);
  }

  const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }, metadata => {
    if (onProgress) onProgress(metadata.percent / 100 * total + total, total * 2);
  });

  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sortsnap-rapi-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
