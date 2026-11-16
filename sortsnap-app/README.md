# SortSnap

> Penyortir foto & dokumen lokal berbasis browser. 100% client-side, tanpa backend, tanpa upload.

SortSnap membantu kamu mengelompokkan foto dan gambar dari perangkat lokal ke dalam 4 kategori otomatis:

- **Dokumen_&_Struk** — dokumen, struk, kertas, kartu.
- **Screenshot** — tangkapan layar HP atau desktop.
- **Foto_Kamera** — foto dari kamera sungguhan (bermetadata EXIF).
- **Lainnya** — gambar lain yang tidak masuk tiga kategori di atas.

Semua pemrosesan terjadi di browser kamu. File tidak pernah diunggah ke server mana pun.

---

## Fitur

- Import file atau folder penuh.
- Drag & drop ke area yang disediakan.
- Deteksi otomatis berdasarkan:
  - Nama file (`Screenshot`, `IMG_E`, dll.)
  - Metadata EXIF kamera & GPS
  - Rasio aspek gambar
  - OCR teks menggunakan Tesseract.js
- Tab filter per kategori.
- Koreksi manual kategori pada setiap thumbnail atau di modal preview.
- Download hasil sebagai ZIP rapi dengan struktur 4 folder.

---

## Cara Pakai Lokal

1. Buka folder proyek:
   ```bash
   cd sortsnap-app
   ```

2. Jalankan server lokal:
   ```bash
   python -m http.server 8080
   ```

3. Buka browser dan akses:
   ```
   http://localhost:8080
   ```

4. Pilih file/folder foto atau seret ke drop zone.
5. Tunggu proses metadata & OCR selesai.
6. Periksa hasil klasifikasi, koreksi jika perlu.
7. Klik **Download ZIP Rapi**.

---

## Deploy ke Vercel

Karena SortSnap adalah web app statis murni, deploy ke Vercel sangat mudah:

### Opsi 1: Vercel CLI

1. Install Vercel CLI (butuh Node.js):
   ```bash
   npm i -g vercel
   ```

2. Login dan deploy:
   ```bash
   cd sortsnap-app
   vercel
   ```

3. Ikuti wizard. Vercel akan mendeteksi static site dan deploy.

### Opsi 2: Vercel Dashboard

1. Push folder `sortsnap-app` ke repository GitHub/GitLab/Bitbucket.
2. Buka [vercel.com/new](https://vercel.com/new).
3. Import repository tersebut.
4. Biarkan framework preset sebagai **Other** atau **Vite** (tidak ada build).
5. Root directory: `sortsnap-app`.
6. Klik **Deploy**.

Setelah deploy, SortSnap bisa diakses dari URL Vercel yang diberikan.

---

## Catatan Privasi

- Semua file diproses di memori browser.
- Library di-load dari CDN (Tailwind, exifr, Tesseract.js, JSZip), tetapi file pribadi tidak dikirim ke CDN.
- Tidak ada analytics, tracking, atau service worker.
- Data hilang saat tab/browser ditutup.

---

## Keterbatasan

- OCR memerlukan waktu, terutama untuk banyak file.
- File HEIC mungkin tidak bisa di-preview jika browser tidak mendukung.
- Direkomendasikan memproses maksimal ~500 file sekaligus untuk menjaga responsivitas.

---

## Lisensi

MIT — bebas digunakan, dimodifikasi, dan didistribusikan.
