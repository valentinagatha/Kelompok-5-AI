# SortSnap — Arsitektur Aplikasi

> Web app penyortir foto & berkas lokal berbasis browser. 100% client-side. Tanpa backend, tanpa server, tanpa upload.

---

## 1. Ringkasan Produk

**Nama:** SortSnap  
**Tipe:** Single-page web app (SPA) statis  
**Lokasi proyek:** `C:\Users\ASUS\Documents\sortsnap-app`  
**Stack teknologi:**
- HTML5 (File API, Drag-and-Drop API, Canvas API)
- Tailwind CSS via CDN
- Vanilla JavaScript ES Modules
- `exifr` — membaca metadata EXIF/GPS dari foto
- `tesseract.js` — OCR teks pada dokumen/struk
- `jszip` — membuat dan mengunduh file ZIP hasil sortir

---

## 2. Filosofi Privasi

Seluruh pemrosesan berkas terjadi di memori browser pengguna:
- Tidak ada request ke server eksternal untuk memproses berkas.
- CDN hanya mengambil library JavaScript/CSS; berkas pribadi tidak ikut terkirim.
- Metadata, thumbnail, hasil OCR, dan file ZIP dibuat lokal.
- Setelah tab ditutup, data di memory dilepas oleh browser.

---

## 3. Struktur Folder

```
sortsnap-app/
├── index.html          # Entry point UI
├── css/
│   └── app.css         # Custom CSS tambahan
├── js/
│   ├── app.js          # Entry point & orchestrator utama
│   ├── config.js       # Konstanta & default pengaturan
│   ├── state.js        # State management
│   ├── fileScanner.js  # Membaca file input / folder / drag-drop
│   ├── exifParser.js   # Wrapper pembacaan EXIF via exifr
│   ├── ocrEngine.js    # Wrapper Tesseract.js
│   ├── classifier.js   # Logika klasifikasi ke 4 kategori utama
│   ├── grouper.js      # Pengelompokan hasil klasifikasi
│   ├── previewer.js    # Render thumbnail & preview modal
│   ├── zipExporter.js  # Membuat ZIP via JSZip
│   └── uiUtils.js      # Helper DOM, toast, progress bar
├── PLAN.md             # Dokumen ini
└── README.md           # Petunjuk penggunaan & deploy Vercel
```

---

## 4. Mode Grouping Utama: Auto-Kategori Jenis Foto

Mode default dan utama. Setiap file gambar diklasifikasikan ke dalam **salah satu** dari 4 folder berikut (prioritas dari atas ke bawah):

### 4.1 `Dokumen_&_Struk`
Kriteria (salah satu):
- Hasil OCR memiliki ≥ 15 karakter valid (huruf/angka/spasi).
- Rasio aspek mendekati dokumen/kertas (A4, letter, kartu), biasanya antara `0.60–0.85` (portrait) atau `1.18–1.70` (landscape).

### 4.2 `Screenshot`
Kriteria (salah satu):
- Nama file mengandung `Screenshot`, `screenshot`, `IMG_E`, atau pola serupa.
- Rasio aspek mendekati rasio layar (9:16, 16:9, 18:9, 19.5:9, 4:3, 16:10, 21:9) **dan** tidak memiliki metadata lensa/kamera.

### 4.3 `Foto_Kamera`
Kriteria (salah satu):
- Memiliki metadata EXIF kamera: `Make`, `Model`, `LensModel`, `FNumber`, `ExposureTime`, `ISO`, `GPSLatitude`, dll.

### 4.4 `Lainnya`
Fallback untuk gambar yang tidak masuk kategori di atas.

---

## 5. Alur Pengguna

1. **Import** — pilih file/folder atau drag-and-drop ke drop zone.
2. **Scan & Filter** — app menyaring hanya gambar/dokumen gambar.
3. **Klasifikasi Otomatis** — tiap file dinilai berdasarkan nama, EXIF, rasio aspek, dan OCR.
4. **Review** — tampilkan thumbnail per kategori dengan tab filter `Semua | Dokumen_&_Struk | Screenshot | Foto_Kamera | Lainnya`.
5. **Koreksi Manual** — setiap thumbnail punya dropdown untuk pindah kategori jika klasifikasi salah.
6. **Download ZIP Rapi** — export semua file ke ZIP dengan struktur 4 folder utama.

---

## 6. Dependensi & CDN

Semua library diambil dari CDN publik via UMD script tags:

| Library | Fungsi | URL CDN |
|---------|--------|---------|
| Tailwind CSS | Styling UI | `https://cdn.tailwindcss.com` |
| exifr | EXIF/GPS parser | `https://cdn.jsdelivr.net/npm/exifr@7/dist/full.umd.js` |
| tesseract.js | OCR | `https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js` |
| jszip | ZIP generator | `https://cdn.jsdelivr.net/npm/jszip@3/dist/jszip.min.js` |

Library diakses sebagai global `window.exifr`, `window.Tesseract`, `window.JSZip`. Download ZIP menggunakan anchor tag `download` blob.

---

## 7. Komponen Kunci

### 7.1 `fileScanner.js`
- Menerima `FileList` dari input file/folder atau drop event.
- Filter ekstensi: `.jpg`, `.jpeg`, `.png`, `.webp`, `.heic`, `.tiff`, `.bmp`, `.gif`.
- Mengembalikan array objek file lokal.

### 7.2 `exifParser.js`
- Gunakan `exifr.parse(file, { gps: true, exif: true })`.
- Ekstrak: `DateTimeOriginal`, `Make`, `Model`, `LensModel`, `GPSLatitude`, `GPSLongitude`, `ImageWidth`, `ImageHeight`, `Orientation`, `FNumber`, `ISO`, `ExposureTime`.

### 7.3 `ocrEngine.js`
- Inisialisasi worker Tesseract dengan bahasa `eng+ind`.
- Proses file secara berurutan dengan progress callback.
- Simpan hasil teks dan confidence ke state.
- Terminate worker saat selesai.

### 7.4 `classifier.js`
- Terima file + metadata + hasil OCR.
- Terapkan kriteria 4 kategori sesuai prioritas.
- Kembalikan string kategori.

### 7.5 `grouper.js`
- Kelompokkan file berdasarkan kategori hasil klasifikasi (atau override manual pengguna).
- Output: `{ Dokumen_&_Struk: [...], Screenshot: [...], Foto_Kamera: [...], Lainnya: [...] }`.

### 7.6 `previewer.js`
- Buat thumbnail via `URL.createObjectURL(file)` dan resize Canvas.
- Render grid thumbnail per kategori.
- Dropdown koreksi kategori pada setiap kartu.
- Modal preview gambar penuh + metadata + OCR.
- Revoke object URL untuk mencegah memory leak.

### 7.7 `zipExporter.js`
- Iterasi grup; buat folder di JSZip sesuai nama kategori.
- Tambahkan file asli ke folder masing-masing.
- Generate ZIP dan trigger download.

---

## 8. State Management

```js
{
  files: [],              // array file objek
  metadata: {},           // { fileId: { exif, width, height, ratio } }
  ocr: {},                // { fileId: { text, confidence } }
  classifications: {},    // { fileId: category }
  groups: {},             // hasil grouping
  activeTab: 'all',       // tab filter aktif
  isProcessing: false,
  progress: { current: 0, total: 0, stage: '' }
}
```

---

## 9. UI/UX

- Header + drop zone besar di tengah.
- Progress bar saat scan EXIF dan OCR.
- Tab filter kategori horizontal di atas galeri.
- Grid thumbnail responsif.
- Tombol "Download ZIP Rapi" di header/bawah galeri.
- Toast status & error ringan.

---

## 10. Performa & Batasan

- Proses berurutan agar tab tetap responsif.
- Thumbnail di-resize via Canvas.
- OCR berat; jalankan untuk semua file tetapi bisa dibatalkan/dilewati di versi mendatang.
- Rekomendasi batch maksimal ~500 file.
- File HEIC diproses metadata-nya jika didukung; preview mungkin terbatas.

---

## 11. Keamanan

- Tidak ada upload.
- CDN library menggunakan import map; SRI dapat ditambahkan jika diinginkan.
- Service worker tidak digunakan agar tidak ada cache berkas pribadi.

---

*Dibuat untuk SortSnap — 100% client-side, privasi pertama.*
