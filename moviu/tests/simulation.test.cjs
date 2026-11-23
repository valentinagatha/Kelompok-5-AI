const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../transfer-core.js');

test('transfer-core exports all expected methods', () => {
  assert.equal(typeof core.classifyFile, 'function');
  assert.equal(typeof core.summarizeFiles, 'function');
  assert.equal(typeof core.createTransferZip, 'function');
  assert.equal(typeof core.createSampleFiles, 'function');
  assert.equal(typeof core.clampProgress, 'function');
  assert.equal(typeof core.createTransferState, 'function');
  assert.equal(typeof core.advanceTransfer, 'function');
  assert.equal(typeof core.disconnectTransfer, 'function');
  assert.equal(typeof core.resumeTransfer, 'function');
});

test('simulation flow: advance, disconnect at 60%, resume without resetting', () => {
  let state = core.createTransferState(0);
  assert.equal(state.progress, 0);

  // simulate advancing by 5% steps
  while (state.progress < 60) {
    state = core.advanceTransfer(state, 5);
  }
  assert.equal(state.progress, 60);

  // disconnect simulation
  state = core.disconnectTransfer(state);
  assert.equal(state.connected, false);
  assert.equal(state.interrupted, true);

  // resume simulation
  state = core.resumeTransfer(state);
  assert.equal(state.connected, true);
  assert.equal(state.interrupted, false);
  assert.equal(state.resumed, true);
  assert.equal(state.progress, 60); // Must keep 60%

  // advance to completion
  while (state.progress < 100) {
    state = core.advanceTransfer(state, 5);
  }
  assert.equal(state.progress, 100);
});

test('sample files generate a valid, complete ZIP package', async () => {
  const samples = core.createSampleFiles();
  assert.equal(samples.length, 5);

  let progressCalled = false;
  const zip = await core.createTransferZip(samples, (p) => {
    progressCalled = true;
    assert.ok(p.total > 0);
  });

  assert.ok(progressCalled);
  assert.equal(zip.type, 'application/zip');
  assert.ok(zip.size > 500);

  const buffer = new Uint8Array(await zip.arrayBuffer());
  const decoded = new TextDecoder().decode(buffer);

  assert.ok(decoded.includes('Moviu/Kontak/Kontak-Keluarga-dan-Rekan.vcf'));
  assert.ok(decoded.includes('Moviu/Kalender/Jadwal-Penting.ics'));
  assert.ok(decoded.includes('Moviu/Dokumen/Inventaris-Data-Pribadi.csv'));
  assert.ok(decoded.includes('Moviu/Dokumen/Catatan-Migrasi-HP.txt'));
  assert.ok(decoded.includes('Moviu/PETUNJUK.txt'));
  assert.ok(decoded.includes('Moviu/manifest.json'));
});
