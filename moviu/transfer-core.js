(function (root) {
  'use strict';

  const CATEGORY_ORDER = ['photos', 'videos', 'contacts', 'calendar', 'documents', 'other'];
  const CATEGORY_LABELS = {
    photos: 'Foto',
    videos: 'Video',
    contacts: 'Kontak',
    calendar: 'Kalender',
    documents: 'Dokumen',
    other: 'Lainnya'
  };
  const EXTENSIONS = {
    photos: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.bmp', '.tif', '.tiff', '.avif', '.svg'],
    videos: ['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.3gp', '.mts', '.m2ts'],
    contacts: ['.vcf', '.vcard'],
    calendar: ['.ics', '.ical'],
    documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.odt', '.ods', '.odp', '.csv', '.md']
  };

  const UTF8 = new TextEncoder();
  const CRC_TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    CRC_TABLE[n] = value >>> 0;
  }

  function classifyFile(file) {
    const name = String(file && file.name || '').toLowerCase();
    const type = String(file && file.type || '').toLowerCase();
    if (type.startsWith('image/') || EXTENSIONS.photos.some((ext) => name.endsWith(ext))) return 'photos';
    if (type.startsWith('video/') || EXTENSIONS.videos.some((ext) => name.endsWith(ext))) return 'videos';
    if (type === 'text/vcard' || type === 'text/x-vcard' || EXTENSIONS.contacts.some((ext) => name.endsWith(ext))) return 'contacts';
    if (type === 'text/calendar' || EXTENSIONS.calendar.some((ext) => name.endsWith(ext))) return 'calendar';
    if (type.startsWith('application/pdf') || type.startsWith('text/') || type.includes('document') || type.includes('spreadsheet') || type.includes('presentation') || EXTENSIONS.documents.some((ext) => name.endsWith(ext))) return 'documents';
    return 'other';
  }

  function summarizeFiles(files) {
    const summary = Object.fromEntries(CATEGORY_ORDER.map((id) => [id, { id, label: CATEGORY_LABELS[id], count: 0, bytes: 0 }]));
    for (const file of files) {
      const category = classifyFile(file);
      summary[category].count += 1;
      summary[category].bytes += Number(file.size) || 0;
    }
    return summary;
  }

  function crc32Update(crc, bytes) {
    let value = crc;
    for (let index = 0; index < bytes.length; index += 1) value = CRC_TABLE[(value ^ bytes[index]) & 0xff] ^ (value >>> 8);
    return value >>> 0;
  }

  function u16(value) { return [value & 0xff, (value >>> 8) & 0xff]; }
  function u32(value) { return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]; }
  function concatBytes(...arrays) {
    const size = arrays.reduce((total, array) => total + array.length, 0);
    const joined = new Uint8Array(size);
    let offset = 0;
    for (const array of arrays) { joined.set(array, offset); offset += array.length; }
    return joined;
  }

  function dosTimestamp(date) {
    const year = Math.max(1980, date.getFullYear());
    const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
    const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return { time, day };
  }

  function safeName(name) {
    const cleaned = String(name || 'file').replace(/[\\/\u0000-\u001f<>:"|?*]/g, '_').replace(/^\.+/, '').trim();
    return cleaned || 'file';
  }

  function uniqueArchiveEntries(files) {
    const used = new Map();
    return files.map((file) => {
      const category = classifyFile(file);
      const folder = CATEGORY_LABELS[category];
      const originalName = safeName(file.name);
      const key = `${folder}/${originalName}`.toLocaleLowerCase('en-US');
      const occurrences = (used.get(key) || 0) + 1;
      used.set(key, occurrences);
      let archiveName = originalName;
      if (occurrences > 1) {
        const dot = originalName.lastIndexOf('.');
        const stem = dot > 0 ? originalName.slice(0, dot) : originalName;
        const extension = dot > 0 ? originalName.slice(dot) : '';
        archiveName = `${stem} (${occurrences})${extension}`;
      }
      return { file, category, path: `Moviu/${folder}/${archiveName}` };
    });
  }

  function makeFileBlob(text, type, name) {
    const blob = new Blob([text], { type });
    Object.defineProperty(blob, 'name', { value: name });
    return blob;
  }

  function createSampleFiles() {
    const vcfContent = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Pratama;Budi;;;',
      'FN:Budi Pratama',
      'TEL;TYPE=CELL:+6281234567890',
      'EMAIL:budi.pratama@example.com',
      'NOTE:Kontak dipindahkan melalui Moviu',
      'END:VCARD',
      '',
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Sari;Dewi;;;',
      'FN:Dewi Sari',
      'TEL;TYPE=CELL:+6285678901234',
      'EMAIL:dewi.sari@example.com',
      'NOTE:Keluarga - Kontak dipindahkan melalui Moviu',
      'END:VCARD'
    ].join('\r\n');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Moviu//ID',
      'BEGIN:VEVENT',
      'UID:moviu-sample-event-1@example.com',
      'SUMMARY:Jadwal Migrasi HP Baru',
      'DTSTART:20261201T090000Z',
      'DTEND:20261201T103000Z',
      'DESCRIPTION:Periksa semua data di HP baru setelah impor paket Moviu.',
      'LOCATION:Rumah / Kantor',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const csvContent = [
      'Kategori,Nama Item,Jumlah,Keterangan',
      'Foto,Dokumentasi Pribadi,1284,Format JPG & PNG',
      'Video,Rekaman Acara,86,Format MP4',
      'Kontak,Buku Telepon,342,Format vCard (.vcf)',
      'Kalender,Agenda Tahunan,18,Format iCal (.ics)',
      'Dokumen,KTP & Berkas Kerja,56,Format PDF & Office'
    ].join('\n');

    const txtContent = [
      'CATATAN PERSIAPAN GANTI HP DENGAN MOVIU',
      '=======================================',
      '',
      '1. WhatsApp / Pesan:',
      '   - Lakukan chat backup lokal atau Google Drive/iCloud sebelum melepas kartu SIM.',
      '',
      '2. Aplikasi Perbankan & E-Wallet:',
      '   - Pastikan nomor HP aktif dapat menerima SMS OTP.',
      '   - Simpan user ID atau lakukan logout dari HP lama bila diwajibkan bank.',
      '',
      '3. Akun Sosial & Email:',
      '   - Catat kata sandi akun Google / Apple ID / email pentingmu.',
      '',
      'Data ini siap dipindahkan dengan aman dan privat!'
    ].join('\n');

    const svgPhoto = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6255e7"/><stop offset="100%" stop-color="#8b7ff9"/></linearGradient></defs><rect width="600" height="400" fill="url(#g)"/><circle cx="300" cy="180" r="70" fill="#ffffff" opacity="0.2"/><path d="M150 320 L250 210 L330 270 L410 180 L490 320 Z" fill="#ffffff" opacity="0.35"/><text x="50%" y="85%" fill="#ffffff" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle">Foto Contoh - Kenangan Liburan (Moviu)</text></svg>';

    return [
      makeFileBlob(vcfContent, 'text/vcard', 'Kontak-Keluarga-dan-Rekan.vcf'),
      makeFileBlob(icsContent, 'text/calendar', 'Jadwal-Penting.ics'),
      makeFileBlob(csvContent, 'text/csv', 'Inventaris-Data-Pribadi.csv'),
      makeFileBlob(txtContent, 'text/plain;charset=utf-8', 'Catatan-Migrasi-HP.txt'),
      makeFileBlob(svgPhoto, 'image/svg+xml', 'Foto-Sampel-Liburan.svg')
    ];
  }

  function clampProgress(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(100, number));
  }

  function createTransferState(progress) {
    return {
      progress: clampProgress(progress === undefined ? 0 : progress),
      connected: true,
      interrupted: false,
      resumed: false
    };
  }

  function advanceTransfer(state, amount) {
    const current = state || createTransferState(0);
    return {
      ...current,
      progress: clampProgress(current.progress + Math.max(0, Number(amount) || 0))
    };
  }

  function disconnectTransfer(state) {
    const current = state || createTransferState(0);
    return {
      ...current,
      connected: false,
      interrupted: true
    };
  }

  function resumeTransfer(state) {
    const current = state || createTransferState(0);
    return {
      ...current,
      connected: true,
      interrupted: false,
      resumed: true
    };
  }

  async function createTransferZip(files, onProgress) {
    if (!Array.isArray(files) || files.length === 0) throw new Error('Pilih setidaknya satu file terlebih dahulu.');
    const entries = uniqueArchiveEntries(files);
    const manifest = {
      product: 'Moviu',
      version: '1.2.0',
      createdAt: new Date().toISOString(),
      note: 'Moviu menyiapkan salinan file ini di perangkat. File tidak diunggah ke server.',
      totalFiles: entries.length,
      files: entries.map(({ file, category, path }) => ({
        name: file.name,
        path,
        category,
        type: file.type || 'unknown',
        bytes: Number(file.size) || 0
      }))
    };

    const readme = [
      '================================================================',
      '                PAKET PINDAH DATA MOVIU (OFFICIAL)              ',
      '================================================================',
      '',
      'Selamat! Paket file cadangan untuk HP barumu telah siap.',
      'Paket ini diproses 100% di browser perangkatmu tanpa server.',
      '',
      'STRUKTUR FOLDER:',
      '- Moviu/Foto/      : Foto dan gambar pilihanmu',
      '- Moviu/Video/     : Video rekaman',
      '- Moviu/Kontak/    : Berkas kontak vCard (.vcf)',
      '- Moviu/Kalender/  : Agenda kalender (.ics)',
      '- Moviu/Dokumen/   : Dokumen PDF, Office, teks, dan catatan',
      '- Moviu/manifest.json : Catatan manifest daftar file',
      '',
      'CARA MEMAKAI DI HP BARU:',
      '1. Salin file ZIP ini ke HP barumu via kabel USB, AirDrop, Quick Share,',
      '   atau flashdisk OTG.',
      '2. Buka aplikasi File / Pengelola Berkas di HP baru, lalu ekstrak ZIP ini.',
      '3. Foto & Video langsung tersimpan dan dapat dibuka di Galeri.',
      '4. Untuk Kontak: Buka file .vcf di folder Kontak, lalu pilih "Impor ke Kontak".',
      '5. Untuk Kalender: Buka file .ics di folder Kalender, lalu pilih "Tambahkan ke Kalender".',
      '',
      'Catatan Privasi: Moviu tidak menyimpan kredensial atau salinan file kamu.',
      'Semua data tetap aman di tanganmu.'
    ].join('\r\n');

    const archiveEntries = [
      ...entries,
      { file: makeFileBlob(readme, 'text/plain;charset=utf-8', 'PETUNJUK.txt'), category: 'other', path: 'Moviu/PETUNJUK.txt' },
      { file: makeFileBlob(JSON.stringify(manifest, null, 2), 'application/json', 'manifest.json'), category: 'other', path: 'Moviu/manifest.json' }
    ];

    if (archiveEntries.length > 0xffff) throw new Error('Terlalu banyak file untuk satu paket ZIP. Pilih lebih sedikit file.');
    const maxSize = 0xffffffff;
    if (archiveEntries.some(({ file }) => Number(file.size) >= maxSize) || archiveEntries.reduce((sum, entry) => sum + Number(entry.file.size), 0) >= maxSize) {
      throw new Error('Ukuran paket terlalu besar untuk satu file ZIP. Pilih file yang lebih sedikit atau lebih kecil.');
    }

    const parts = [];
    const centralRecords = [];
    const totalBytes = entries.reduce((sum, entry) => sum + Number(entry.file.size || 0), 0);
    const timestamp = dosTimestamp(new Date());
    let completedBytes = 0;
    let offset = 0;

    for (const entry of archiveEntries) {
      const nameBytes = UTF8.encode(entry.path);
      const file = entry.file;
      const size = Number(file.size) || 0;
      if (offset + size >= maxSize) throw new Error('Ukuran paket ZIP terlalu besar.');
      const flags = 0x0808;
      const localOffset = offset;
      const localHeader = concatBytes(
        Uint8Array.from(u32(0x04034b50)), Uint8Array.from(u16(20)), Uint8Array.from(u16(flags)),
        Uint8Array.from(u16(0)), Uint8Array.from(u16(timestamp.time)), Uint8Array.from(u16(timestamp.day)),
        Uint8Array.from(u32(0)), Uint8Array.from(u32(0)), Uint8Array.from(u32(0)),
        Uint8Array.from(u16(nameBytes.length)), Uint8Array.from(u16(0)), nameBytes
      );
      parts.push(localHeader);
      offset += localHeader.length;

      let crc = 0xffffffff;
      const chunkSize = 1024 * 1024;
      for (let start = 0; start < size; start += chunkSize) {
        const chunk = new Uint8Array(await file.slice(start, Math.min(size, start + chunkSize)).arrayBuffer());
        crc = crc32Update(crc, chunk);
        if (entry.category !== 'other') {
          completedBytes += chunk.length;
          if (typeof onProgress === 'function') onProgress({ loaded: completedBytes, total: totalBytes, name: file.name });
        }
      }
      crc = (crc ^ 0xffffffff) >>> 0;
      parts.push(file);
      offset += size;
      const descriptor = concatBytes(Uint8Array.from(u32(0x08074b50)), Uint8Array.from(u32(crc)), Uint8Array.from(u32(size)), Uint8Array.from(u32(size)));
      parts.push(descriptor);
      offset += descriptor.length;
      centralRecords.push({ nameBytes, flags, crc, size, offset: localOffset, time: timestamp.time, day: timestamp.day });
    }

    const centralOffset = offset;
    for (const record of centralRecords) {
      const central = concatBytes(
        Uint8Array.from(u32(0x02014b50)), Uint8Array.from(u16(20)), Uint8Array.from(u16(20)),
        Uint8Array.from(u16(record.flags)), Uint8Array.from(u16(0)), Uint8Array.from(u16(record.time)), Uint8Array.from(u16(record.day)),
        Uint8Array.from(u32(record.crc)), Uint8Array.from(u32(record.size)), Uint8Array.from(u32(record.size)),
        Uint8Array.from(u16(record.nameBytes.length)), Uint8Array.from(u16(0)), Uint8Array.from(u16(0)),
        Uint8Array.from(u16(0)), Uint8Array.from(u16(0)), Uint8Array.from(u32(0)), Uint8Array.from(u32(record.offset)), record.nameBytes
      );
      parts.push(central);
      offset += central.length;
    }
    const centralSize = offset - centralOffset;
    parts.push(concatBytes(
      Uint8Array.from(u32(0x06054b50)), Uint8Array.from(u16(0)), Uint8Array.from(u16(0)),
      Uint8Array.from(u16(centralRecords.length)), Uint8Array.from(u16(centralRecords.length)),
      Uint8Array.from(u32(centralSize)), Uint8Array.from(u32(centralOffset)), Uint8Array.from(u16(0))
    ));
    if (typeof onProgress === 'function') onProgress({ loaded: totalBytes, total: totalBytes, complete: true });
    return new Blob(parts, { type: 'application/zip' });
  }

  const api = {
    CATEGORY_ORDER,
    CATEGORY_LABELS,
    classifyFile,
    summarizeFiles,
    createTransferZip,
    createSampleFiles,
    clampProgress,
    createTransferState,
    advanceTransfer,
    disconnectTransfer,
    resumeTransfer
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MoviuTransfer = api;
})(typeof window !== 'undefined' ? window : globalThis);
