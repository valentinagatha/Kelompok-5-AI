const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyFile,
  summarizeFiles,
  createTransferZip,
  createSampleFiles,
  clampProgress,
  createTransferState,
  advanceTransfer,
  disconnectTransfer,
  resumeTransfer
} = require('../transfer-core.js');

function makeFile(name, type, contents) {
  const blob = new Blob([contents], { type });
  Object.defineProperties(blob, { name: { value: name }, lastModified: { value: 0 } });
  return blob;
}

test('classifies real file-picker types, including vCard and calendar exports', () => {
  assert.equal(classifyFile({ name: 'liburan.jpg', type: 'image/jpeg' }), 'photos');
  assert.equal(classifyFile({ name: 'rekaman.mp4', type: 'video/mp4' }), 'videos');
  assert.equal(classifyFile({ name: 'kontak.vcf', type: '' }), 'contacts');
  assert.equal(classifyFile({ name: 'jadwal.ics', type: 'text/calendar' }), 'calendar');
  assert.equal(classifyFile({ name: 'panduan.pdf', type: 'application/pdf' }), 'documents');
  assert.equal(classifyFile({ name: 'arsip.bin', type: 'application/octet-stream' }), 'other');
});

test('summarizes item counts and byte sizes from selected files', () => {
  const files = [
    makeFile('satu.jpg', 'image/jpeg', '1234'),
    makeFile('dua.png', 'image/png', '123456'),
    makeFile('kontak.vcf', '', 'abc')
  ];
  const summary = summarizeFiles(files);
  assert.equal(summary.photos.count, 2);
  assert.equal(summary.photos.bytes, 10);
  assert.equal(summary.contacts.count, 1);
  assert.equal(summary.contacts.bytes, 3);
});

test('builds a valid ZIP archive with original files and an import guide', async () => {
  const files = [makeFile('liburan.jpg', 'image/jpeg', 'foto'), makeFile('kontak.vcf', 'text/vcard', 'BEGIN:VCARD')];
  const archive = await createTransferZip(files);
  const bytes = new Uint8Array(await archive.arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  assert.equal(archive.type, 'application/zip');
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.ok(text.includes('Moviu/Foto/liburan.jpg'));
  assert.ok(text.includes('Moviu/Kontak/kontak.vcf'));
  assert.ok(text.includes('Moviu/PETUNJUK.txt'));
  assert.ok(text.includes('Moviu/manifest.json'));
  assert.ok(text.includes('BEGIN:VCARD'));
});

test('generates realistic sample files for instant testing and demo', () => {
  const samples = createSampleFiles();
  assert.ok(Array.isArray(samples));
  assert.ok(samples.length >= 4);
  const names = samples.map((file) => file.name);
  assert.ok(names.some((name) => name.endsWith('.vcf')));
  assert.ok(names.some((name) => name.endsWith('.ics')));
  assert.ok(names.some((name) => name.endsWith('.csv')));
  assert.ok(names.some((name) => name.endsWith('.txt')));
});

test('manages transfer state correctly (advance, disconnect at 60%, resume)', () => {
  let state = createTransferState(0);
  assert.equal(state.progress, 0);
  assert.equal(state.connected, true);
  assert.equal(state.interrupted, false);

  state = advanceTransfer(state, 55);
  assert.equal(state.progress, 55);

  state = advanceTransfer(state, 10);
  assert.equal(state.progress, 65);

  state = disconnectTransfer(state);
  assert.equal(state.connected, false);
  assert.equal(state.interrupted, true);

  state = resumeTransfer(state);
  assert.equal(state.connected, true);
  assert.equal(state.interrupted, false);
  assert.equal(state.resumed, true);
  assert.equal(state.progress, 65); // retained progress, does not reset to 0!

  state = advanceTransfer(state, 35);
  assert.equal(state.progress, 100);
  assert.equal(clampProgress(120), 100);
  assert.equal(clampProgress(-10), 0);
});
