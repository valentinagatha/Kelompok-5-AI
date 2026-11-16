import { scanFiles } from './fileScanner.js';
import { parseExif } from './exifParser.js';
import { recognizeText, terminateOcr } from './ocrEngine.js';
import { classify } from './classifier.js';
import { state, resetState, setClassification } from './state.js';
import { renderGallery, openPreview, updateStats } from './previewer.js';
import { exportZip } from './zipExporter.js';
import { showToast, setProgress, setDownloadEnabled, setTabsVisible } from './uiUtils.js';
import { CATEGORIES, CATEGORY_ORDER } from './config.js';

const fileInput = document.getElementById('fileInput');
const folderInput = document.getElementById('folderInput');
const dropZone = document.getElementById('dropZone');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const categoryTabs = document.getElementById('categoryTabs');

function init() {
  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
  folderInput.addEventListener('change', (e) => handleFiles(e.target.files));

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });

  downloadZipBtn.addEventListener('click', handleDownload);

  categoryTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    state.activeTab = btn.dataset.tab;
    updateTabStyles();
    renderGallery();
  });

  window.addEventListener('beforeunload', () => {
    terminateOcr();
  });
}

function updateTabStyles() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const isActive = btn.dataset.tab === state.activeTab;
    btn.classList.toggle('active', isActive);
    btn.classList.toggle('bg-indigo-600', isActive);
    btn.classList.toggle('text-white', isActive);
    btn.classList.toggle('bg-white', !isActive);
    btn.classList.toggle('text-slate-700', !isActive);
    btn.classList.toggle('border', !isActive);
    btn.classList.toggle('border-slate-200', !isActive);
  });
}

async function handleFiles(fileList) {
  if (!fileList || fileList.length === 0) return;

  resetState();
  setDownloadEnabled(false);
  setTabsVisible(false);
  showToast('Memindai file...', 'info');

  state.files = await scanFiles(fileList);
  if (state.files.length === 0) {
    showToast('Tidak ada file gambar yang ditemukan.', 'error');
    return;
  }

  state.isProcessing = true;

  // Phase 1: EXIF + dimensions
  setProgress(true, 'Membaca metadata & dimensi...', 0, state.files.length);
  for (let i = 0; i < state.files.length; i++) {
    const fileObj = state.files[i];
    try {
      const meta = await parseExif(fileObj.file);
      state.metadata[fileObj.id] = meta;
    } catch (err) {
      console.warn('EXIF error', fileObj.name, err);
      state.metadata[fileObj.id] = { exif: null, width: null, height: null, ratio: null, hasCameraMeta: false, dateTaken: null };
    }
    setProgress(true, 'Membaca metadata & dimensi...', i + 1, state.files.length);
  }

  // Phase 2: OCR (sequential)
  setProgress(true, 'Mendeteksi teks (OCR)...', 0, state.files.length);
  for (let i = 0; i < state.files.length; i++) {
    const fileObj = state.files[i];
    try {
      const ocr = await recognizeText(fileObj.file);
      state.ocr[fileObj.id] = ocr;
    } catch (err) {
      console.warn('OCR error', fileObj.name, err);
      state.ocr[fileObj.id] = { text: '', confidence: 0 };
    }
    setProgress(true, 'Mendeteksi teks (OCR)...', i + 1, state.files.length);
  }

  // Phase 3: classify
  for (const fileObj of state.files) {
    const meta = state.metadata[fileObj.id];
    const ocr = state.ocr[fileObj.id];
    const category = classify(fileObj, meta, ocr);
    setClassification(fileObj.id, category);
  }

  state.isProcessing = false;
  setProgress(false);
  setDownloadEnabled(true);
  setTabsVisible(true);
  updateStats();
  updateTabStyles();
  renderGallery();
  showToast(`Berhasil mengklasifikasikan ${state.files.length} file.`, 'success');
}

async function handleDownload() {
  if (state.files.length === 0) return;
  setDownloadEnabled(false);
  setProgress(true, 'Membuat ZIP...', 0, state.files.length * 2);
  try {
    await exportZip((current, total) => {
      setProgress(true, 'Membuat ZIP...', Math.min(current, total), total);
    });
    showToast('ZIP berhasil diunduh.', 'success');
  } catch (err) {
    console.error('Export ZIP error', err);
    showToast('Gagal membuat ZIP.', 'error');
  } finally {
    setProgress(false);
    setDownloadEnabled(true);
  }
}

init();
