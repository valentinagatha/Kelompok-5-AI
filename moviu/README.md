# Moviu — Ganti HP, Data Penting Tetap Ikut

Web application *local-first* untuk memindahkan data penting saat berganti HP lintas merek dan sistem operasi (**Android ↔ iPhone / iOS**). 

Moviu mengatasi permasalahan umum *cloud lock-in*, format file yang tidak kompatibel, kekhawatiran privasi data di server pihak ketiga, dan ketergantungan kuota internet saat bermigrasi perangkat.

---

## 🌟 Masalah yang Diselesaikan

Berdasarkan analisis masalah penyimpanan cloud pada proyek Kelompok 5 AI:
1. **Beda Sistem Operasi (Masalah #8):** Pengguna bingung cara memindahkan foto, kontak, dan kalender saat berganti HP dari Android ke iPhone atau sebaliknya karena ekosistem cloud terpisah (Google Drive vs iCloud).
2. **Privasi & Keamanan (Masalah #18 & #35):** Banyak pengguna khawatir mengunggah dokumen pribadi atau sensitif ke server cloud. Moviu memproses 100% berkas di dalam browser perangkat tanpa perantara server.
3. **Kompatibilitas Format (Masalah #5):** Format kontak (vCard `.vcf`), kalender (`.ics`), dan media dirapikan ke dalam folder terstruktur sehingga langsung dapat diimpor di HP baru.
4. **Biaya & Langganan Berulang (Masalah #6 & #30):** Menghilangkan keharusan membeli langganan kapasitas cloud hanya untuk sekali pindah data HP.

---

## 🚀 Fitur Utama

- **Dual-Mode Fleksibel:**
  - **Mode File Sendiri (Nyata):** Pengguna dapat memilih atau melakukan *drag-and-drop* file foto, video, kontak (`.vcf`), kalender (`.ics`), dan dokumen. Engine *in-memory* Moviu menyusunnya menjadi file ZIP standar yang valid beserta `PETUNJUK.txt` dan `manifest.json`.
  - **Fitur Data Contoh (1-Click Sample):** Pengguna yang sedang mengecek demo tanpa file ekspor di perangkat dapat langsung mengklik *✨ Gunakan Data Contoh* untuk menguji pengemasan ZIP nyata dalam 1 detik.
  - **Mode Simulasi Cepat:** Simulasi alur deteksi cloud antar model HP (Samsung, iPhone, Xiaomi, Pixel, OPPO/vivo) dengan jeda koneksi putus di 60% dan pemulihan progres tanpa mengulang dari nol.
- **Panduan Ekspor Langkah-demi-Langkah:**
  - Instruksi visual cepat cara ekspor kontak `.vcf` di Google Contacts (Android).
  - Instruksi ekspor vCard di aplikasi Kontak iPhone (iOS).
  - Tips cadangan chat WhatsApp dan persiapan kartu SIM / m-banking.
- **Model Bisnis & Penetapan Harga Transparan:**
  - **Paket Dasar (Gratis / Rp0):** Pengemasan berkas lokal mandiri tanpa batas.
  - **Paket Lengkap (Pro / Rp49.000):** Pemeriksaan duplikasi kontak dan konversi format.
  - **Paket Toko / Konter HP (Rp199.000/bulan):** Lisensi komersial untuk teknisi konter handphone.
- **Local-First & Privasi Penuh:**
  - Berkas tidak pernah diunggah ke internet (*zero network transmission*).
  - Dapat beroperasi 100% offline setelah halaman dimuat.
- **Responsif & PWA-Ready:**
  - Tampilan modern, mobile-friendly (Android & iOS).
  - Dilengkapi `manifest.webmanifest` dan inline SVG favicon (bebas galat 404).

---

## 📁 Struktur File

```
moviu/
├── index.html                  # Halaman web utama & antarmuka alur wizard
├── style.css                   # Gaya modern, responsif, dan ramah aksesibilitas
├── script.js                   # Logika interaktif antarmuka, wizard, dan event
├── transfer-core.js            # Engine kemas ZIP lokal (CRC32, binary header, state machine)
├── manifest.webmanifest        # Konfigurasi PWA untuk instalasi di layar utama HP
├── tests/
│   ├── transfer-core.test.cjs  # Pengujian unit klasifikasi, ringkasan, dan integritas ZIP
│   ├── simulation.test.cjs     # Pengujian mesin status simulasi & pemulihan 60%
│   └── validate-dom.cjs        # Pengujian konsistensi elemen DOM index.html vs script.js
└── README.md                   # Dokumentasi lengkap proyek Moviu
```

---

## 🛠️ Cara Menjalankan Secara Lokal

Moviu dibuat murni menggunakan HTML5, CSS3, dan Vanilla JavaScript tanpa dependensi eksternal yang berat.

1. Buka folder `moviu/` di file explorer.
2. Klik ganda file `index.html` untuk langsung membukanya di peramban favoritmu (Chrome, Safari, Edge, Firefox).
3. Atau jalankan *local server* sederhana (opsional):
   ```bash
   # Menggunakan Python
   python -m http.server 8000
   # Buka http://localhost:8000/moviu/ di browser
   ```

---

## 🧪 Menjalankan Pengujian (Unit Tests)

Proyek dilengkapi dengan *test suite* otomatis berbasis *native Node.js test runner*:

```bash
# Menjalankan seluruh pengujian unit
node --test moviu/tests/transfer-core.test.cjs moviu/tests/simulation.test.cjs

# Menjalankan validasi elemen DOM
node moviu/tests/validate-dom.cjs
```

Semua pengujian berjalan 100% sukses tanpa dependensi eksternal.

---

## 🌐 Panduan Deployment ke Publik (GitHub Pages)

Karena Moviu menggunakan path aset relatif (`./style.css`, `./script.js`, dll.), Moviu langsung siap di-deploy ke:

1. **GitHub Pages:**
   - Masuk ke tab **Settings** di repositori GitHub ➔ **Pages**.
   - Pilih *Source*: `Deploy from a branch` (misalnya `main` branch, folder `/ (root)`).
   - Akses publik langsung tersedia di:
     `https://<username>.github.io/Kelompok-5-AI/moviu/`
2. **Vercel / Netlify / Cloudflare Pages:**
   - Hubungkan repositori GitHub dan tentukan folder publik `moviu` atau root repositori.

---

## 👥 Pengembang

Dibuat sebagai bagian dari proyek inovasi digital **Kelompok 5 AI**.
Lisensi: MIT.
