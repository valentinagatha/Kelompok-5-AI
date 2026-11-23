(function (root) {
  'use strict';

  function clampProgress(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(100, number));
  }

  function createTransferState(progress) {
    return { progress: clampProgress(progress === undefined ? 0 : progress), connected: true, interrupted: false, resumed: false };
  }

  function advanceTransfer(state, amount) {
    return { ...state, progress: clampProgress(state.progress + Math.max(0, Number(amount) || 0)) };
  }

  function disconnectTransfer(state) {
    return { ...state, connected: false, interrupted: true };
  }

  function resumeTransfer(state) {
    return { ...state, connected: true, interrupted: false, resumed: true };
  }

  const api = { createTransferState, advanceTransfer, disconnectTransfer, resumeTransfer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (!root || !root.document) return;

  const dataTypes = [
    { id: 'photos', name: 'Foto', icon: '▧', count: 1284, size: 3.2, failed: 0, reason: '' },
    { id: 'videos', name: 'Video', icon: '▣', count: 86, size: 4.6, failed: 3, reason: '3 video contoh tidak cocok dengan format HP tujuan.' },
    { id: 'contacts', name: 'Kontak', icon: '◉', count: 342, size: 0.02, failed: 0, reason: '' },
    { id: 'calendar', name: 'Kalender', icon: '▦', count: 18, size: 0.01, failed: 0, reason: '' },
    { id: 'documents', name: 'Dokumen', icon: '▤', count: 56, size: 1.1, failed: 2, reason: '2 dokumen contoh rusak pada data simulasi.' }
  ];
  const $ = (selector) => root.document.querySelector(selector);
  const $$ = (selector) => Array.from(root.document.querySelectorAll(selector));
  let currentStep = 1;
  let cloudConnected = false;
  let selectedTypes = dataTypes.map((item) => item.id);
  let transferState = createTransferState();
  let transferTimer = null;

  function formatSize(size) {
    if (size < 0.1) return `${Math.max(1, Math.round(size * 1000))} MB`;
    return `${size.toFixed(1).replace('.', ',')} GB`;
  }

  function selectedData() {
    return dataTypes.filter((item) => selectedTypes.includes(item.id));
  }

  function goToStep(step) {
    currentStep = step;
    $$('[data-step]').forEach((section) => { section.hidden = Number(section.dataset.step) !== step; });
    $$('[data-step-indicator]').forEach((indicator) => {
      const number = Number(indicator.dataset.stepIndicator);
      indicator.classList.toggle('active', number === step);
      indicator.classList.toggle('done', number < step);
      if (number < step) indicator.querySelector('span').textContent = '✓';
      else indicator.querySelector('span').textContent = String(number);
    });
    if (step === 2) $('#scan-source').textContent = $('#source-device').value;
    if (step === 3) renderSelection();
    if (step === 4) renderTransferCategories();
    if (step === 5) renderResults();
  }

  function renderScan() {
    $('#scan-grid').innerHTML = dataTypes.map((item) => `<div class="scan-card"><span class="scan-icon" aria-hidden="true">${item.icon}</span><strong>${item.count.toLocaleString('id-ID')}</strong><span>${item.name}</span></div>`).join('');
  }

  function renderSelection() {
    $('#selection-list').innerHTML = dataTypes.map((item) => `<label class="selection-row"><input type="checkbox" value="${item.id}" ${selectedTypes.includes(item.id) ? 'checked' : ''}><span class="selection-icon" aria-hidden="true">${item.icon}</span><span class="selection-name"><strong>${item.name}</strong><small>${item.count.toLocaleString('id-ID')} item</small></span><span class="selection-count">${formatSize(item.size)}</span></label>`).join('');
    $$('#selection-list input').forEach((checkbox) => checkbox.addEventListener('change', updateSelection));
    updateSelection();
  }

  function updateSelection() {
    selectedTypes = $$('#selection-list input:checked').map((input) => input.value);
    const amount = selectedData().reduce((total, item) => total + item.size, 0);
    $('#selected-size').textContent = formatSize(amount);
    $('#start-transfer').disabled = selectedTypes.length === 0;
  }

  function renderTransferCategories() {
    const categories = selectedData();
    $('#category-progress').innerHTML = categories.map((item) => `<div class="category-line"><span>${item.name}</span><div class="category-track"><span data-progress-category="${item.id}"></span></div><em data-progress-label="${item.id}">0%</em></div>`).join('');
    updateProgressUI();
  }

  function updateProgressUI() {
    const progress = Math.round(transferState.progress);
    $('#progress-number').textContent = `${progress}%`;
    $('#overall-bar').style.width = `${progress}%`;
    $$('[data-progress-category]').forEach((bar) => { bar.style.width = `${progress}%`; });
    $$('[data-progress-label]').forEach((label) => { label.textContent = `${progress}%`; });
  }

  function interruptTransfer() {
    clearInterval(transferTimer);
    transferState = disconnectTransfer(transferState);
    $('#transfer-heading').textContent = 'Proses berhenti sementara';
    $('#transfer-caption').textContent = 'Koneksi simulasi terputus, tapi progresmu aman.';
    $('#transfer-status').textContent = 'Koneksi terputus · progres tersimpan';
    $('#connection-lost').hidden = false;
  }

  function runTransfer() {
    clearInterval(transferTimer);
    $('#connection-lost').hidden = true;
    $('#transfer-heading').textContent = 'Data sedang dipindahkan';
    $('#transfer-caption').textContent = 'Tetap di halaman ini selama proses demo.';
    $('#transfer-status').textContent = transferState.resumed ? 'Melanjutkan dari progres terakhir…' : 'Menyalin data demo…';
    transferTimer = setInterval(() => {
      const next = Math.min(100, transferState.progress + 5);
      transferState = advanceTransfer(transferState, next - transferState.progress);
      updateProgressUI();
      if (transferState.progress >= 60 && !transferState.resumed) interruptTransfer();
      else if (transferState.progress >= 100) {
        clearInterval(transferTimer);
        $('#transfer-status').textContent = 'Pemindahan demo selesai.';
        window.setTimeout(() => goToStep(5), 500);
      }
    }, 150);
  }

  function renderResults() {
    const rows = selectedData().map((item) => {
      const failed = Math.min(item.count, item.failed);
      const succeeded = item.count - failed;
      const status = failed ? `${succeeded.toLocaleString('id-ID')} berhasil · ${failed} gagal` : `${succeeded.toLocaleString('id-ID')} berhasil`;
      return `<div class="result-row"><div><strong>${item.name}</strong><small>${failed ? item.reason : 'Semua item contoh berhasil dipindahkan.'}</small></div><span class="result-status ${failed ? 'partial' : 'success'}">${status}</span></div>`;
    }).join('');
    const totalItems = selectedData().reduce((total, item) => total + item.count, 0);
    const failedItems = selectedData().reduce((total, item) => total + Math.min(item.count, item.failed), 0);
    $('#result-summary').innerHTML = `<div class="result-row"><div><strong>Ringkasan</strong><small>${selectedData().length} kategori dipilih · ${totalItems.toLocaleString('id-ID')} item contoh</small></div><span class="result-status ${failedItems ? 'partial' : 'success'}">${(totalItems - failedItems).toLocaleString('id-ID')} berhasil · ${failedItems} gagal</span></div>${rows}`;
  }

  function resetDemo() {
    clearInterval(transferTimer);
    currentStep = 1;
    cloudConnected = false;
    selectedTypes = dataTypes.map((item) => item.id);
    transferState = createTransferState();
    $('#connect-cloud').textContent = 'Hubungkan akun';
    $('#connect-cloud').disabled = false;
    $('#connection-status').textContent = 'Belum terhubung';
    $('#connection-status').classList.remove('connected');
    $('#to-scan').disabled = true;
    $('#transfer-status').textContent = 'Menyalin data demo…';
    $('#connection-lost').hidden = true;
    updateProgressUI();
    goToStep(1);
  }

  function startDemo() {
    $('#flow').hidden = false;
    goToStep(1);
    $('#flow').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function init() {
    renderScan();
    $$('[data-start]').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); startDemo(); }));
    $('#connect-cloud').addEventListener('click', () => {
      if (cloudConnected) return;
      cloudConnected = true;
      $('#connect-cloud').textContent = 'Terhubung ✓';
      $('#connect-cloud').disabled = true;
      $('#connection-status').textContent = `Akun cloud demo terhubung · ${$('#source-device').value}`;
      $('#connection-status').classList.add('connected');
      $('#to-scan').disabled = false;
    });
    $('#to-scan').addEventListener('click', () => goToStep(2));
    $$('[data-next]').forEach((button) => button.addEventListener('click', () => goToStep(Number(button.dataset.next))));
    $$('[data-back]').forEach((button) => button.addEventListener('click', () => goToStep(Number(button.dataset.back))));
    $('#start-transfer').addEventListener('click', () => {
      if (!selectedTypes.length) return;
      transferState = createTransferState();
      goToStep(4);
      runTransfer();
    });
    $('#resume-transfer').addEventListener('click', () => { transferState = resumeTransfer(transferState); runTransfer(); });
    $('#transfer-again').addEventListener('click', resetDemo);
    $('#back-home').addEventListener('click', () => { $('#flow').hidden = true; window.location.hash = 'beranda'; });
  }

  root.document.addEventListener('DOMContentLoaded', init, { once: true });
})(typeof window !== 'undefined' ? window : null);
