import { state, rebuildGroups } from './state.js';
import { CATEGORIES, CATEGORY_ORDER, THUMB_SIZE } from './config.js';

const gallery = document.getElementById('gallery');
const emptyState = document.getElementById('emptyState');
const previewModal = document.getElementById('previewModal');
const previewImage = document.getElementById('previewImage');
const previewName = document.getElementById('previewName');
const previewMeta = document.getElementById('previewMeta');
const previewCategory = document.getElementById('previewCategory');
const previewOcr = document.getElementById('previewOcr');
const closeModal = document.getElementById('closeModal');

let objectUrls = [];

function revokeAllUrls() {
  objectUrls.forEach(url => URL.revokeObjectURL(url));
  objectUrls = [];
}

export function createThumbnail(fileObj) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(fileObj.file);
    objectUrls.push(url);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = THUMB_SIZE;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, size, size);

      const ratio = img.naturalWidth / img.naturalHeight;
      let dw = size;
      let dh = size;
      if (ratio > 1) {
        dh = size / ratio;
      } else {
        dw = size * ratio;
      }
      const dx = (size - dw) / 2;
      const dy = (size - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
      URL.revokeObjectURL(url);
      const idx = objectUrls.indexOf(url);
      if (idx > -1) objectUrls.splice(idx, 1);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      const idx = objectUrls.indexOf(url);
      if (idx > -1) objectUrls.splice(idx, 1);
      resolve(null);
    };
    img.src = url;
  });
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

function categoryLabel(cat) {
  return cat.replace(/_/g, ' ');
}

function categoryColorClass(cat) {
  switch (cat) {
    case CATEGORIES.DOKUMEN: return 'bg-amber-100 text-amber-800';
    case CATEGORIES.SCREENSHOT: return 'bg-purple-100 text-purple-800';
    case CATEGORIES.FOTO_KAMERA: return 'bg-blue-100 text-blue-800';
    default: return 'bg-slate-100 text-slate-700';
  }
}

export function renderGallery() {
  gallery.innerHTML = '';

  const visibleFiles = state.activeTab === 'all'
    ? state.files
    : state.groups[state.activeTab] || [];

  if (visibleFiles.length === 0) {
    gallery.appendChild(emptyState || makeEmptyState());
    emptyState.style.display = 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  for (const fileObj of visibleFiles) {
    const card = document.createElement('div');
    card.className = 'thumbnail-card bg-white rounded-lg shadow overflow-hidden border border-slate-200 flex flex-col';
    card.dataset.id = fileObj.id;

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'aspect-square bg-slate-100 flex items-center justify-center cursor-pointer overflow-hidden';
    thumbWrap.onclick = () => openPreview(fileObj.id);

    const thumbImg = document.createElement('img');
    thumbImg.className = 'thumb-img';
    thumbImg.alt = fileObj.name;
    thumbImg.src = fileObj.thumbUrl || '';
    thumbWrap.appendChild(thumbImg);

    if (!fileObj.thumbUrl) {
      createThumbnail(fileObj).then(dataUrl => {
        fileObj.thumbUrl = dataUrl;
        thumbImg.src = dataUrl || '';
      });
    }

    const body = document.createElement('div');
    body.className = 'p-2 flex flex-col gap-1';

    const name = document.createElement('p');
    name.className = 'text-xs text-slate-700 truncate';
    name.title = fileObj.name;
    name.textContent = fileObj.name;

    const size = document.createElement('p');
    size.className = 'text-[10px] text-slate-500';
    size.textContent = formatBytes(fileObj.size);

    const badge = document.createElement('span');
    const cat = state.classifications[fileObj.id] || CATEGORIES.LAINNYA;
    badge.className = `category-badge inline-block px-2 py-1 rounded-full font-semibold ${categoryColorClass(cat)}`;
    badge.textContent = categoryLabel(cat);

    const select = document.createElement('select');
    select.className = 'mt-1 text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500';
    for (const c of CATEGORY_ORDER) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = categoryLabel(c);
      if (c === cat) opt.selected = true;
      select.appendChild(opt);
    }
    select.onchange = (e) => {
      setClassification(fileObj.id, e.target.value);
      renderGallery();
      updateStats();
    };

    body.appendChild(name);
    body.appendChild(size);
    body.appendChild(badge);
    body.appendChild(select);

    card.appendChild(thumbWrap);
    card.appendChild(body);
    gallery.appendChild(card);
  }
}

function makeEmptyState() {
  const div = document.createElement('div');
  div.id = 'emptyState';
  div.className = 'col-span-full text-center py-16 text-slate-400';
  div.innerHTML = '<p>Belum ada file. Pilih file atau folder untuk mulai menyortir.</p>';
  return div;
}

function updateStats() {
  const total = state.files.length;
  document.getElementById('totalCount').textContent = total;
}

function formatMeta(meta) {
  const parts = [];
  if (meta?.width && meta?.height) parts.push(`${meta.width} x ${meta.height}`);
  if (meta?.exif?.Make || meta?.exif?.Model) {
    parts.push(`${meta.exif.Make || ''} ${meta.exif.Model || ''}`.trim());
  }
  if (meta?.exif?.FNumber) parts.push(`f/${meta.exif.FNumber}`);
  if (meta?.exif?.ISO) parts.push(`ISO ${meta.exif.ISO}`);
  if (meta?.dateTaken) parts.push(new Date(meta.dateTaken).toLocaleString('id-ID'));
  return parts.length ? parts.join(' • ') : 'Tidak ada metadata';
}

export function openPreview(fileId) {
  const fileObj = state.files.find(f => f.id === fileId);
  if (!fileObj) return;
  state.previewFileId = fileId;

  const url = URL.createObjectURL(fileObj.file);
  objectUrls.push(url);
  previewImage.src = url;
  previewName.textContent = fileObj.name;

  const meta = state.metadata[fileId];
  previewMeta.textContent = formatMeta(meta);

  const ocr = state.ocr[fileId];
  previewOcr.value = ocr?.text ? `${ocr.text}\n\n(confidence: ${Math.round(ocr.confidence || 0)}%)` : '(OCR belum tersedia atau tidak ada teks)';

  previewCategory.value = state.classifications[fileId] || CATEGORIES.LAINNYA;
  previewCategory.onchange = (e) => {
    setClassification(fileId, e.target.value);
    renderGallery();
    updateStats();
  };

  previewModal.classList.remove('hidden');
  previewModal.classList.add('flex');
}

function closePreview() {
  previewModal.classList.add('hidden');
  previewModal.classList.remove('flex');
  previewImage.src = '';
  state.previewFileId = null;
  revokeAllUrls();
}

closeModal.onclick = closePreview;
previewModal.onclick = (e) => {
  if (e.target === previewModal) closePreview();
};
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !previewModal.classList.contains('hidden')) {
    closePreview();
  }
});

export { updateStats };
