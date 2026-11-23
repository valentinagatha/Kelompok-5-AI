(function () {
  'use strict';

  const core = window.MoviuTransfer;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const CATEGORY_ICONS = {
    photos: '▧',
    videos: '▣',
    contacts: '◉',
    calendar: '▦',
    documents: '▤',
    other: '⋯'
  };

  const SIMULATION_DATA = [
    { id: 'photos', name: 'Foto', icon: '▧', count: 1284, size: 3.2 * 1024 * 1024 * 1024, failed: 0, reason: '' },
    { id: 'videos', name: 'Video', icon: '▣', count: 86, size: 4.6 * 1024 * 1024 * 1024, failed: 3, reason: '3 video contoh (format lama) perlu konversi ke MP4 di HP baru.' },
    { id: 'contacts', name: 'Kontak', icon: '◉', count: 342, size: 22 * 1024 * 1024, failed: 0, reason: '' },
    { id: 'calendar', name: 'Kalender', icon: '▦', count: 18, size: 10 * 1024 * 1024, failed: 0, reason: '' },
    { id: 'documents', name: 'Dokumen', icon: '▤', count: 56, size: 1.1 * 1024 * 1024 * 1024, failed: 1, reason: '1 berkas teks berkarakter khusus dilewati.' }
  ];

  let currentMode = 'files'; // 'files' or 'sim'
  let selectedFiles = [];
  let selectedCategories = new Set();
  let packagedFiles = [];
  let transferZip = null;
  let packageBusy = false;
  let downloadUrl = null;
  let toastTimer = null;

  // Simulation mode states
  let simCloudConnected = false;
  let simSelectedCategories = new Set(SIMULATION_DATA.map((d) => d.id));
  let simTransferState = core ? core.createTransferState(0) : { progress: 0, connected: true, interrupted: false, resumed: false };
  let simTimer = null;

  function showToast(message) {
    const toast = $('#toast');
    const toastText = $('#toast-text');
    if (!toast || !toastText) return;
    toastText.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toLocaleString('id-ID', { maximumFractionDigits: 1 })} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`;
    return `${(value / (1024 * 1024 * 1024)).toLocaleString('id-ID', { maximumFractionDigits: 2 })} GB`;
  }

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function setMode(mode) {
    currentMode = mode;
    const isFiles = mode === 'files';
    $('#tab-mode-files').classList.toggle('active', isFiles);
    $('#tab-mode-files').setAttribute('aria-selected', isFiles ? 'true' : 'false');
    $('#tab-mode-sim').classList.toggle('active', !isFiles);
    $('#tab-mode-sim').setAttribute('aria-selected', !isFiles ? 'true' : 'false');

    $('#mode-files-content').hidden = !isFiles;
    $('#mode-sim-content').hidden = isFiles;

    if (isFiles) {
      $('#to-review').disabled = selectedFiles.length === 0;
    } else {
      $('#to-review').disabled = !simCloudConnected;
    }
  }

  function goToStep(step) {
    $$('[data-step]').forEach((section) => {
      section.hidden = Number(section.dataset.step) !== step;
    });

    $$('[data-step-indicator]').forEach((indicator) => {
      const number = Number(indicator.dataset.stepIndicator);
      indicator.classList.toggle('active', number === step);
      indicator.classList.toggle('done', number < step);
      indicator.querySelector('span').textContent = number < step ? '✓' : String(number);
    });

    const src = $('#source-device') ? $('#source-device').value : 'HP Lama';
    const tgt = $('#target-device') ? $('#target-device').value : 'HP Baru';
    const badge = $('#scan-device-badge');
    if (badge) badge.textContent = `${src} ➔ ${tgt}`;

    if (step === 2) renderReview();
    if (step === 3) renderSelection();
    if (step === 4) handleStep4Enter();
    if (step === 5) renderStep5Results();
  }

  function createFileRow(file, index, removable) {
    const row = makeElement('div', removable ? 'picked-file-row' : 'review-file-row');
    const category = core.classifyFile(file);
    row.append(makeElement('span', 'file-row-icon', CATEGORY_ICONS[category] || '⋯'));
    const copy = makeElement('span', 'file-row-copy');
    copy.append(makeElement('strong', '', file.name || 'File tanpa nama'));
    copy.append(makeElement('small', '', `${core.CATEGORY_LABELS[category] || 'Lainnya'} · ${file.type || 'format berkas'}`));
    row.append(copy, makeElement('span', 'file-row-size', formatBytes(file.size)));

    if (removable) {
      const remove = makeElement('button', 'remove-file', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Hapus ${file.name || 'file'} dari pilihan`);
      remove.dataset.removeFile = String(index);
      row.append(remove);
    }
    return row;
  }

  function renderPickedFiles() {
    const list = $('#picked-file-list');
    list.replaceChildren();
    selectedFiles.forEach((file, index) => list.append(createFileRow(file, index, true)));
    $('#clear-files').hidden = selectedFiles.length === 0;
    if (currentMode === 'files') {
      $('#to-review').disabled = selectedFiles.length === 0;
    }
    const totalBytes = selectedFiles.reduce((total, file) => total + (Number(file.size) || 0), 0);
    $('#file-selection-status').textContent = selectedFiles.length
      ? `${selectedFiles.length.toLocaleString('id-ID')} file dipilih · ${formatBytes(totalBytes)}`
      : 'Belum ada file yang dipilih.';
  }

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    const seen = new Set(selectedFiles.map((f) => `${f.name}\u0000${f.size}\u0000${f.lastModified || 0}`));
    let addedCount = 0;
    for (const file of incoming) {
      const key = `${file.name}\u0000${file.size}\u0000${file.lastModified || 0}`;
      if (!seen.has(key)) {
        selectedFiles.push(file);
        seen.add(key);
        addedCount += 1;
      }
    }
    renderPickedFiles();
    $('#file-input').value = '';
    if (addedCount > 0) {
      showToast(`${addedCount} file ditambahkan ke daftar.`);
    }
  }

  function loadSampleData() {
    if (!core || typeof core.createSampleFiles !== 'function') return;
    const samples = core.createSampleFiles();
    addFiles(samples);
    showToast('✨ 5 file contoh (kontak, kalender, csv, catatan, foto) dimuat!');
  }

  function renderReview() {
    const grid = $('#scan-grid');
    grid.replaceChildren();
    const list = $('#review-file-list');
    list.replaceChildren();

    if (currentMode === 'files') {
      const summary = core.summarizeFiles(selectedFiles);
      for (const id of core.CATEGORY_ORDER) {
        const item = summary[id];
        const card = makeElement('div', 'scan-card');
        card.append(makeElement('span', 'scan-icon', CATEGORY_ICONS[id]));
        card.append(makeElement('strong', '', item.count.toLocaleString('id-ID')));
        card.append(makeElement('span', '', core.CATEGORY_LABELS[id]));
        card.append(makeElement('small', '', formatBytes(item.bytes)));
        grid.append(card);
      }
      selectedFiles.forEach((file, index) => list.append(createFileRow(file, index, false)));
    } else {
      // Simulation mode
      for (const item of SIMULATION_DATA) {
        const card = makeElement('div', 'scan-card');
        card.append(makeElement('span', 'scan-icon', item.icon));
        card.append(makeElement('strong', '', item.count.toLocaleString('id-ID')));
        card.append(makeElement('span', '', item.name));
        card.append(makeElement('small', '', formatBytes(item.size)));
        grid.append(card);
      }
      const simNotice = makeElement('div', 'review-file-row');
      simNotice.append(
        makeElement('span', 'file-row-icon', '✦'),
        makeElement('span', 'file-row-copy', makeElement('strong', '', 'Data simulasi cloud Google / iCloud terhubung lengkap.'))
      );
      list.append(simNotice);
    }
  }

  function selectedFileSet() {
    return selectedFiles.filter((file) => selectedCategories.has(core.classifyFile(file)));
  }

  function updateSelectionSummary() {
    if (currentMode === 'files') {
      const files = selectedFileSet();
      const total = files.reduce((sum, file) => sum + (Number(file.size) || 0), 0);
      $('#selected-size').textContent = `${formatBytes(total)} · ${files.length.toLocaleString('id-ID')} file terpilih`;
      $('#prepare-transfer').disabled = files.length === 0 || packageBusy;
    } else {
      const active = SIMULATION_DATA.filter((d) => simSelectedCategories.has(d.id));
      const total = active.reduce((sum, d) => sum + d.size, 0);
      const totalCount = active.reduce((sum, d) => sum + d.count, 0);
      $('#selected-size').textContent = `${formatBytes(total)} · ${totalCount.toLocaleString('id-ID')} item terpilih`;
      $('#prepare-transfer').disabled = active.length === 0;
    }
  }

  function renderSelection() {
    const list = $('#selection-list');
    list.replaceChildren();

    if (currentMode === 'files') {
      const summary = core.summarizeFiles(selectedFiles);
      selectedCategories = new Set(core.CATEGORY_ORDER.filter((id) => summary[id].count > 0));

      for (const id of core.CATEGORY_ORDER) {
        const item = summary[id];
        if (!item.count) continue;
        const label = makeElement('label', 'selection-row');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = id;
        checkbox.checked = true;
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) selectedCategories.add(id);
          else selectedCategories.delete(id);
          updateSelectionSummary();
        });

        const icon = makeElement('span', 'selection-icon', CATEGORY_ICONS[id]);
        icon.setAttribute('aria-hidden', 'true');
        const copy = makeElement('span', 'selection-name');
        copy.append(
          makeElement('strong', '', core.CATEGORY_LABELS[id]),
          makeElement('small', '', `${item.count.toLocaleString('id-ID')} file · ${formatBytes(item.bytes)}`)
        );
        label.append(checkbox, icon, copy, makeElement('span', 'selection-count', formatBytes(item.bytes)));
        list.append(label);
      }
    } else {
      // Simulation mode
      simSelectedCategories = new Set(SIMULATION_DATA.map((d) => d.id));
      for (const item of SIMULATION_DATA) {
        const label = makeElement('label', 'selection-row');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = item.id;
        checkbox.checked = true;
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) simSelectedCategories.add(item.id);
          else simSelectedCategories.delete(item.id);
          updateSelectionSummary();
        });

        const icon = makeElement('span', 'selection-icon', item.icon);
        icon.setAttribute('aria-hidden', 'true');
        const copy = makeElement('span', 'selection-name');
        copy.append(
          makeElement('strong', '', item.name),
          makeElement('small', '', `${item.count.toLocaleString('id-ID')} item · ${formatBytes(item.size)}`)
        );
        label.append(checkbox, icon, copy, makeElement('span', 'selection-count', formatBytes(item.size)));
        list.append(label);
      }
    }
    updateSelectionSummary();
  }

  function handleStep4Enter() {
    $('#category-progress-wrap').hidden = currentMode !== 'sim';
    if (currentMode === 'files') {
      executeRealFilePackaging();
    } else {
      executeSimulatedTransfer();
    }
  }

  function showRealProgress(loaded, total, complete, currentName) {
    const percent = complete ? 100 : (total > 0 ? Math.min(99, Math.floor((loaded / total) * 100)) : 0);
    $('#progress-number').textContent = `${percent}%`;
    $('#overall-bar').style.width = `${percent}%`;
    $('#package-current').textContent = complete
      ? 'Paket ZIP sudah selesai dibuat dan diverifikasi.'
      : `Menyusun dan menghitung CRC32: ${currentName || 'memproses berkas…'} (${formatBytes(loaded)} dari ${formatBytes(total)})`;
  }

  function packageFilename() {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return `Moviu-paket-${date}.zip`;
  }

  async function executeRealFilePackaging() {
    if (packageBusy) return;
    packagedFiles = selectedFileSet();
    if (!packagedFiles.length) return;

    packageBusy = true;
    transferZip = null;
    $('#to-download').disabled = true;
    $('#back-selection').disabled = true;
    $('#package-error').hidden = true;
    $('#package-error').textContent = '';
    $('#connection-lost').hidden = true;

    $('#transfer-heading').textContent = 'Menyiapkan Paket ZIP Moviu';
    $('#transfer-caption').textContent = `Memproses ${packagedFiles.length.toLocaleString('id-ID')} file pilihanmu langsung di browser.`;
    $('#progress-number').textContent = '0%';
    $('#overall-bar').style.width = '0%';
    $('#package-current').textContent = 'Menyiapkan struktur paket…';

    try {
      transferZip = await core.createTransferZip(packagedFiles, (progress) => {
        showRealProgress(progress.loaded, progress.total, progress.complete, progress.name);
      });
      $('#transfer-heading').textContent = 'Paket ZIP Siap!';
      $('#transfer-caption').textContent = `${packagedFiles.length.toLocaleString('id-ID')} file telah terbungkus dalam format standar Moviu.`;
      $('#to-download').disabled = false;
      $('#back-selection').disabled = false;
      showToast('✓ Paket Moviu berhasil dikemas!');
    } catch (error) {
      $('#transfer-heading').textContent = 'Pengemasan Belum Berhasil';
      $('#package-error').textContent = error && error.message ? error.message : 'Ada kendala saat memproses file. Silakan coba kembali.';
      $('#package-error').hidden = false;
      $('#back-selection').disabled = false;
    } finally {
      packageBusy = false;
    }
  }

  function updateSimUI() {
    const progress = Math.round(simTransferState.progress);
    $('#progress-number').textContent = `${progress}%`;
    $('#overall-bar').style.width = `${progress}%`;
    $('#package-current').textContent = simTransferState.resumed
      ? `Melanjutkan penyalinan data simulasi (${progress}%)…`
      : `Menyalin data antar perangkat (${progress}%)…`;

    const categoryBox = $('#category-progress');
    if (categoryBox) {
      const active = SIMULATION_DATA.filter((d) => simSelectedCategories.has(d.id));
      categoryBox.innerHTML = active.map((d) => `
        <div class="category-line">
          <span>${d.name}</span>
          <div class="category-track"><span style="width: ${progress}%;"></span></div>
          <em>${progress}%</em>
        </div>
      `).join('');
    }
  }

  function interruptSimTransfer() {
    clearInterval(simTimer);
    simTransferState = core.disconnectTransfer(simTransferState);
    $('#transfer-heading').textContent = 'Koneksi Simulasi Terhenti di 60%';
    $('#transfer-caption').textContent = 'Simulasi koneksi putus terpicu. Progresmu tetap tersimpan aman di 60%.';
    $('#connection-lost').hidden = false;
    $('#to-download').disabled = true;
    $('#back-selection').disabled = false;
    showToast('⚠ Koneksi terputus di 60% (Simulasi)');
  }

  function executeSimulatedTransfer() {
    clearInterval(simTimer);
    $('#connection-lost').hidden = true;
    $('#package-error').hidden = true;
    $('#to-download').disabled = true;
    $('#back-selection').disabled = true;

    $('#transfer-heading').textContent = 'Memindahkan Data Antar Perangkat';
    $('#transfer-caption').textContent = 'Simulasi alur pemindahan data sedang berjalan.';

    simTimer = setInterval(() => {
      const next = Math.min(100, simTransferState.progress + 5);
      simTransferState = core.advanceTransfer(simTransferState, next - simTransferState.progress);
      updateSimUI();

      // Trigger intentional 60% pause on first pass as per requirements
      if (simTransferState.progress >= 60 && !simTransferState.resumed) {
        interruptSimTransfer();
      } else if (simTransferState.progress >= 100) {
        clearInterval(simTimer);
        $('#transfer-heading').textContent = 'Pemindahan Demo Selesai!';
        $('#transfer-caption').textContent = 'Seluruh data simulasi berhasil disalin ke format tujuan.';
        $('#to-download').disabled = false;
        $('#back-selection').disabled = false;
        showToast('✓ Pemindahan demo selesai 100%!');
      }
    }, 120);
  }

  function renderStep5Results() {
    const summary = $('#package-summary');
    summary.replaceChildren();

    const src = $('#source-device') ? $('#source-device').value : 'HP Asal';
    const tgt = $('#target-device') ? $('#target-device').value : 'HP Tujuan';

    if (currentMode === 'files') {
      const totalBytes = packagedFiles.reduce((sum, file) => sum + (Number(file.size) || 0), 0);
      const rows = [
        ['Perangkat Asal & Tujuan', `${src} ➔ ${tgt}`],
        ['Total Berkas Asli', `${packagedFiles.length.toLocaleString('id-ID')} file`],
        ['Ukuran Data Asli', formatBytes(totalBytes)],
        ['Ukuran Berkas ZIP', transferZip ? formatBytes(transferZip.size) : 'Dihitung saat unduh'],
        ['Nama Paket Unduhan', packageFilename()]
      ];

      for (const [label, value] of rows) {
        const row = makeElement('div', 'package-summary-row');
        row.append(makeElement('span', '', label), makeElement('strong', '', value));
        summary.append(row);
      }

      // Render category audit rows
      const fileSummary = core.summarizeFiles(packagedFiles);
      const resultList = $('#result-summary');
      resultList.replaceChildren();

      const headerRow = makeElement('div', 'result-row');
      headerRow.append(
        makeElement('div', '', makeElement('strong', '', 'Audit Kelayakan Format File')),
        makeElement('span', 'result-status success', 'Semua Siap Dipindah')
      );
      resultList.append(headerRow);

      for (const id of core.CATEGORY_ORDER) {
        const item = fileSummary[id];
        if (!item.count) continue;
        const row = makeElement('div', 'result-row');
        const desc = makeElement('div');
        desc.append(
          makeElement('strong', '', `${core.CATEGORY_LABELS[id]} (${item.count.toLocaleString('id-ID')} file)`),
          makeElement('small', '', `Disusun rapi ke folder Moviu/${core.CATEGORY_LABELS[id]}/`)
        );
        row.append(desc, makeElement('span', 'result-status success', `${item.count} Berhasil`));
        resultList.append(row);
      }
    } else {
      // Simulation mode results
      const active = SIMULATION_DATA.filter((d) => simSelectedCategories.has(d.id));
      const totalCount = active.reduce((sum, d) => sum + d.count, 0);
      const totalSize = active.reduce((sum, d) => sum + d.size, 0);
      const totalFailed = active.reduce((sum, d) => sum + d.failed, 0);

      const rows = [
        ['Perangkat Asal & Tujuan', `${src} ➔ ${tgt}`],
        ['Total Item Simulasi', `${totalCount.toLocaleString('id-ID')} item`],
        ['Estimasi Ukuran Data', formatBytes(totalSize)],
        ['Status Migrasi', totalFailed ? `${(totalCount - totalFailed).toLocaleString('id-ID')} berhasil, ${totalFailed} perlu konversi` : '100% Berhasil'],
        ['Format Paket', 'ZIP Terstruktur + PETUNJUK.txt']
      ];

      for (const [label, value] of rows) {
        const row = makeElement('div', 'package-summary-row');
        row.append(makeElement('span', '', label), makeElement('strong', '', value));
        summary.append(row);
      }

      const resultList = $('#result-summary');
      resultList.replaceChildren();

      for (const item of active) {
        const row = makeElement('div', 'result-row');
        const desc = makeElement('div');
        const succeeded = item.count - item.failed;
        desc.append(
          makeElement('strong', '', item.name),
          makeElement('small', '', item.failed ? item.reason : 'Semua berkas kompatibel dan berhasil dipaketkan.')
        );
        const statusBadge = makeElement(
          'span',
          item.failed ? 'result-status partial' : 'result-status success',
          item.failed ? `${succeeded.toLocaleString('id-ID')} berhasil · ${item.failed} dicatat` : `${succeeded.toLocaleString('id-ID')} berhasil`
        );
        row.append(desc, statusBadge);
        resultList.append(row);
      }
    }
  }

  async function startDownload() {
    let zipToDownload = transferZip;

    if (!zipToDownload) {
      // If in simulation mode or zip not yet compiled, build sample package zip on the fly
      $('#download-status').textContent = 'Membuat paket ZIP contoh…';
      try {
        const samples = core.createSampleFiles();
        zipToDownload = await core.createTransferZip(samples);
      } catch (err) {
        $('#download-status').textContent = 'Gagal membuat file ZIP: ' + (err.message || err);
        return;
      }
    }

    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(zipToDownload);

    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = packageFilename();
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();

    $('#download-status').textContent = '✓ Unduhan dimulai! Cek folder Unduhan / File di perangkatmu.';
    showToast('✓ Berkas ZIP Moviu berhasil diunduh!');

    window.setTimeout(() => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        downloadUrl = null;
      }
    }, 60_000);
  }

  function resetApplication() {
    clearInterval(simTimer);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = null;

    selectedFiles = [];
    selectedCategories = new Set();
    packagedFiles = [];
    transferZip = null;
    packageBusy = false;

    simCloudConnected = false;
    simTransferState = core.createTransferState(0);

    $('#file-input').value = '';
    $('#download-status').textContent = '';
    $('#package-error').hidden = true;
    $('#connection-lost').hidden = true;

    $('#connect-cloud').textContent = 'Hubungkan Akun';
    $('#connect-cloud').disabled = false;
    $('#connection-status').textContent = 'Belum terhubung ke akun simulasi.';
    $('#connection-status').classList.remove('connected');

    renderPickedFiles();
    setMode('files');
    goToStep(1);
    showToast('Formulir direset.');
  }

  function startFlow(demoMode) {
    $('#flow').hidden = false;
    if (demoMode) {
      setMode('sim');
      // Simulate connecting cloud automatically for fast one-click demo
      simCloudConnected = true;
      $('#connect-cloud').textContent = 'Terhubung ✓';
      $('#connect-cloud').disabled = true;
      const src = $('#source-device') ? $('#source-device').value : 'Android';
      $('#connection-status').textContent = `Akun cloud simulasi terhubung · ${src}`;
      $('#to-review').disabled = false;
    } else {
      setMode('files');
    }
    goToStep(1);
    $('#flow').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const AUTH_STORAGE_KEY = 'moviu_auth_user';
  const USERS_STORAGE_KEY = 'moviu_registered_users';

  function getStoredUser() {
    try {
      const data = localStorage.getItem(AUTH_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  function getRegisteredUsers() {
    try {
      const data = localStorage.getItem(USERS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function setStoredUser(user) {
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } catch (e) {}
  }

  function clearStoredUser() {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {}
  }

  function checkAuthState() {
    const user = getStoredUser();
    const authGate = $('#auth-gate-section');
    const flowSection = $('#flow');
    const profileWidget = $('#user-profile-widget');
    const userAvatar = $('#user-avatar');
    const userDisplayName = $('#user-display-name');

    if (user && user.agreedToTerms) {
      if (authGate) authGate.hidden = true;
      if (flowSection) flowSection.hidden = false;
      if (profileWidget) {
        profileWidget.hidden = false;
        if (userAvatar) userAvatar.textContent = (user.name || 'U').charAt(0).toUpperCase();
        if (userDisplayName) userDisplayName.textContent = user.name || 'Pengguna';
      }
      return true;
    } else {
      if (authGate) authGate.hidden = false;
      if (flowSection) flowSection.hidden = true;
      if (profileWidget) profileWidget.hidden = true;
      return false;
    }
  }

  function setupAuthHandlers() {
    const tabRegister = $('#tab-auth-register');
    const tabLogin = $('#tab-auth-login');
    const formRegister = $('#form-register');
    const formLogin = $('#form-login');
    const errorBox = $('#auth-error');
    const successBox = $('#auth-success');
    const btnLogout = $('#btn-logout');

    function showError(msg) {
      if (!errorBox) return;
      errorBox.textContent = msg;
      errorBox.style.display = 'block';
      if (successBox) successBox.style.display = 'none';
    }

    function showSuccess(msg) {
      if (!successBox) return;
      successBox.textContent = msg;
      successBox.style.display = 'block';
      if (errorBox) errorBox.style.display = 'none';
    }

    function clearAlerts() {
      if (errorBox) errorBox.style.display = 'none';
      if (successBox) successBox.style.display = 'none';
    }

    if (tabRegister && tabLogin) {
      tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        if (formRegister) formRegister.hidden = false;
        if (formLogin) formLogin.hidden = true;
        clearAlerts();
      });

      tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        if (formLogin) formLogin.hidden = false;
        if (formRegister) formRegister.hidden = true;
        clearAlerts();
      });
    }

    if (formRegister) {
      formRegister.addEventListener('submit', (e) => {
        e.preventDefault();
        clearAlerts();

        const nameInput = $('#auth-name');
        const emailInput = $('#auth-email');
        const passwordInput = $('#auth-password');
        const phoneInput = $('#auth-phone');
        const termsCheck = $('#auth-terms-agree');

        if (!termsCheck || !termsCheck.checked) {
          showError('Anda wajib menyetujui Syarat & Ketentuan serta Kebijakan Privasi sesuai UU PDP No. 27/2022.');
          return;
        }

        const name = nameInput ? nameInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
        const password = passwordInput ? passwordInput.value : '';
        const phone = phoneInput ? phoneInput.value.trim() : '';

        if (!name || !email || !password) {
          showError('Mohon isi nama lengkap, email, dan kata sandi.');
          return;
        }

        if (password.length < 6) {
          showError('Kata sandi minimal 6 karakter.');
          return;
        }

        const users = getRegisteredUsers();
        if (users.some((u) => u.email === email)) {
          showError('Alamat email ini sudah terdaftar. Silakan pindah ke tab "Sudah Punya Akun (Masuk)".');
          return;
        }

        const newUser = {
          name,
          email,
          password,
          phone,
          agreedToTerms: true,
          agreedAt: new Date().toISOString()
        };

        users.push(newUser);
        try {
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
        } catch (err) {}

        setStoredUser({
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          agreedToTerms: true,
          agreedAt: newUser.agreedAt
        });

        showSuccess('Akun berhasil dibuat! Mengalihkan ke aplikasi pemindahan data…');
        showToast('Pendaftaran akun berhasil!');

        setTimeout(() => {
          checkAuthState();
          showToast(`Selamat datang, ${newUser.name}!`);
        }, 500);
      });
    }

    if (formLogin) {
      formLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        clearAlerts();

        const emailInput = $('#auth-login-email');
        const passwordInput = $('#auth-login-password');
        const termsCheck = $('#auth-login-terms-agree');

        if (!termsCheck || !termsCheck.checked) {
          showError('Anda wajib mencentang persetujuan Syarat & Ketentuan serta Kebijakan Privasi.');
          return;
        }

        const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
        const password = passwordInput ? passwordInput.value : '';

        const users = getRegisteredUsers();
        const found = users.find((u) => u.email === email);

        if (!found || found.password !== password) {
          if (users.length === 0) {
            showError('Belum ada akun yang terdaftar. Silakan buat akun baru di tab "Daftar Akun Baru".');
          } else {
            showError('Email atau kata sandi tidak cocok.');
          }
          return;
        }

        setStoredUser({
          name: found.name,
          email: found.email,
          phone: found.phone,
          agreedToTerms: true,
          agreedAt: new Date().toISOString()
        });

        showSuccess('Berhasil masuk! Membuka aplikasi…');
        showToast(`Selamat datang kembali, ${found.name}!`);

        setTimeout(() => {
          checkAuthState();
        }, 400);
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        clearStoredUser();
        checkAuthState();
        showToast('Anda telah keluar dari akun Moviu.');
      });
    }
  }

  function init() {
    setupAuthHandlers();
    checkAuthState();

    if (!core) {
      if ($('#file-selection-status')) {
        $('#file-selection-status').textContent = 'Modul pemrosesan transfer belum termuat. Silakan muat ulang halaman.';
      }
      return;
    }

    if ($('#picked-file-list')) {
      renderPickedFiles();
    }

    // Mode tabs
    if ($('#tab-mode-files')) {
      $('#tab-mode-files').addEventListener('click', () => setMode('files'));
    }
    if ($('#tab-mode-sim')) {
      $('#tab-mode-sim').addEventListener('click', () => setMode('sim'));
    }

    // CTAs for in-page flow triggers
    $$('[data-start]').forEach((link) => {
      link.addEventListener('click', (event) => {
        if ($('#flow') && $('#flow').hidden) {
          event.preventDefault();
          startFlow(false);
        }
      });
    });

    $$('[data-start-demo]').forEach((link) => {
      link.addEventListener('click', (event) => {
        if ($('#flow') && $('#flow').hidden) {
          event.preventDefault();
          startFlow(true);
        }
      });
    });

    // File input & Drag/Drop
    if ($('#pick-files') && $('#file-input')) {
      $('#pick-files').addEventListener('click', () => $('#file-input').click());
      $('#file-input').addEventListener('change', (event) => addFiles(event.target.files));
    }

    if ($('#drop-zone') && $('#file-input')) {
      $('#drop-zone').addEventListener('keydown', (event) => {
        if (event.target === $('#drop-zone') && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          $('#file-input').click();
        }
      });

      $('#drop-zone').addEventListener('dragover', (event) => {
        event.preventDefault();
        $('#drop-zone').classList.add('drag-over');
      });

      $('#drop-zone').addEventListener('dragleave', () => {
        $('#drop-zone').classList.remove('drag-over');
      });

      $('#drop-zone').addEventListener('drop', (event) => {
        event.preventDefault();
        $('#drop-zone').classList.remove('drag-over');
        addFiles(event.dataTransfer.files);
      });
    }

    // Quick sample loader button
    if ($('#load-sample-files')) {
      $('#load-sample-files').addEventListener('click', loadSampleData);
    }

    // Picked files list management
    if ($('#picked-file-list')) {
      $('#picked-file-list').addEventListener('click', (event) => {
        const button = event.target.closest('[data-remove-file]');
        if (!button) return;
        const index = Number(button.dataset.removeFile);
        selectedFiles.splice(index, 1);
        renderPickedFiles();
        showToast('File dihapus dari daftar.');
      });
    }

    if ($('#clear-files')) {
      $('#clear-files').addEventListener('click', () => {
        selectedFiles = [];
        renderPickedFiles();
        showToast('Semua file dikosongkan.');
      });
    }

    // Cloud connect simulation
    if ($('#connect-cloud')) {
      $('#connect-cloud').addEventListener('click', () => {
        simCloudConnected = true;
        $('#connect-cloud').textContent = 'Terhubung ✓';
        $('#connect-cloud').disabled = true;
        const src = $('#source-device') ? $('#source-device').value : 'Android';
        if ($('#connection-status')) {
          $('#connection-status').textContent = `Akun cloud simulasi terhubung · ${src}`;
        }
        if ($('#to-review')) {
          $('#to-review').disabled = false;
        }
        showToast('Akun cloud simulasi berhasil dihubungkan!');
      });
    }

    // Wizard navigation
    if ($('#to-review')) {
      $('#to-review').addEventListener('click', () => goToStep(2));
    }
    $$('[data-next]').forEach((button) => {
      button.addEventListener('click', () => goToStep(Number(button.dataset.next)));
    });
    $$('[data-back]').forEach((button) => {
      button.addEventListener('click', () => goToStep(Number(button.dataset.back)));
    });

    if ($('#prepare-transfer')) {
      $('#prepare-transfer').addEventListener('click', () => goToStep(4));
    }
    if ($('#back-selection')) {
      $('#back-selection').addEventListener('click', () => {
        if (!packageBusy) goToStep(3);
      });
    }
    if ($('#to-download')) {
      $('#to-download').addEventListener('click', () => goToStep(5));
    }

    // Simulation resume button (at 60%)
    if ($('#resume-transfer')) {
      $('#resume-transfer').addEventListener('click', () => {
        simTransferState = core.resumeTransfer(simTransferState);
        showToast('Melanjutkan transfer dari 60%…');
        executeSimulatedTransfer();
      });
    }

    // Step 5 Actions
    if ($('#download-package')) {
      $('#download-package').addEventListener('click', startDownload);
    }
    if ($('#start-over')) {
      $('#start-over').addEventListener('click', resetApplication);
    }
    if ($('#back-home')) {
      $('#back-home').addEventListener('click', () => {
        window.location.href = './index.html';
      });
    }

    // Check URL parameters for direct mode launch (e.g., app.html?mode=demo)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const modeParam = urlParams.get('mode');
      if (modeParam === 'demo') {
        setTimeout(() => loadSampleData(), 200);
      } else if (modeParam === 'sim') {
        setTimeout(() => setMode('sim'), 200);
      }
    } catch (e) {
      // Ignore URL parsing errors on older environments
    }
  }

  document.addEventListener('DOMContentLoaded', init, { once: true });
})();
