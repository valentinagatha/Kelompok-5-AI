import { ACCEPTED_EXTENSIONS } from './config.js';

function isAcceptedFile(file) {
  const name = file.name || '';
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const mime = (file.type || '').toLowerCase();
  return ACCEPTED_EXTENSIONS.has(ext) || mime.startsWith('image/');
}

function makeFileId(file, index) {
  return `${index}-${file.name}-${file.size}-${file.lastModified}`;
}

export async function scanFiles(fileList) {
  const files = [];
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    if (!isAcceptedFile(file)) continue;
    files.push({
      id: makeFileId(file, i),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });
  }
  return files;
}
