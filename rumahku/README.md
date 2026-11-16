# Rumahku — studio desain ruangan 3D (gratis, tanpa koin)

Game/web app desain interior yang bisa langsung dimainkan di browser.

**Live:** https://shalinakhr.github.io/rumahku/ — buka di HP atau laptop, tanpa install. Dibuat sebagai jawaban atas riset 35 sumber di folder [`../tugas 16 november`](../tugas%2016%20november): keluhan pemain hampir selalu soal **monetisasi dan kebebasan yang dikunci**, bukan grafis.

## Cara main

Buka `index.html` di browser (double-click juga bisa), atau jalankan server lokal:

```bash
cd rumahku
python3 -m http.server 8000
# buka http://localhost:8000
```

Tidak butuh install, akun, atau koneksi internet — Three.js sudah di-vendor di `js/three.min.js`.

## Kontrol

| Aksi | Mouse / trackpad | Sentuh |
|---|---|---|
| Pilih & geser furnitur | klik lalu drag | sentuh lalu drag |
| Putar kamera | drag di area kosong | satu jari di area kosong |
| Geser kamera (pan) | klik kanan / Shift + drag | dua jari |
| Zoom | scroll | pinch |
| Putar item 45° | double-click item, atau tombol `R` | slider Rotasi |
| Hapus item | `Delete` / `Backspace` | tombol Hapus |
| Duplikat item | `D` | tombol Duplikat |
| Undo / redo | `Ctrl/Cmd + Z` / `Ctrl/Cmd + Shift + Z` | tombol ↶ ↷ |
| Simpan | `Ctrl/Cmd + S` (juga auto-save) | tombol Simpan |

## Fitur

- **47 aset prosedural**: tempat tidur single/queen/king, nakas, lemari, meja rias, meja belajar, kursi, rak buku, sofa 3 dan 2 dudukan, kursi malas, meja kopi, meja samping, TV + konsol, rak TV, lampu lantai/meja/dinding, karpet, lukisan, jam dinding, cermin, tanaman pot, pohon besar/kecil, semak, bangku taman, planter, lampu taman, batu setapak, plus perabot dapur dan kamar mandi (island, kabinet atas/bawah, kompor, wastafel, kulkas, meja makan, bathtub, shower kaca, wastafel kamar mandi, toilet, rak handuk).
- **Katalog + pencarian + filter kategori** — tidak ada katalog sempit atau item yang dikunci level.
- **Dua mode**: Template Cepat (5 ruangan siap pakai, tetap bisa diubah semua) dan Desain Bebas (mulai dari kosong). Template **tidak** mengunci item.
- **Tantangan** dengan target yang dinilai otomatis, tanpa timer dan tanpa hadiah berbayar.
- **Undo/redo 80 langkah + auto-save** ke `localStorage`.
- **Kustomisasi**: warna/finishing per item, rotasi, skala 60–150%, tinggi, warna dinding, 6 jenis lantai, ukuran ruangan 3–10 m, mode taman (outdoor).
- **Foto HD 1920×1080 gratis**, tanpa watermark dan tanpa ikon "render berbayar".
- **Responsif**: panel katalog + panel properti di desktop, bottom sheet + tab bar di ponsel.
- **Tema gelap & terang** — tombol ☾/☀ di topbar atau tombol `T`. Tema mengubah chrome UI *dan* pencahayaan scene 3D (langit-langit malam, lampu ruangan hangat, vignette), tersimpan di `localStorage` dan ikut preferensi OS saat pertama buka.
- **Nol monetisasi**: tanpa iklan, koin, gems, energi, timer, langganan, atau paywall.

## Tema

| | Gelap (default) | Terang |
|---|---|---|
| Aksen | `#2dd4bf` di atas `#0a0f0e` | `#0f766e` di atas `#fcfaf5` |
| Kontras teks utama | 17.9:1 | 16.8:1 |
| Kontras teks sekunder | 10.6:1 | 6.3:1 |
| Scene 3D | sun 1.2, hemi 0.42, lampu hangat 1.35, exposure 0.93 | sun 2.1, hemi 0.85, exposure 1.02 |

Semua pasangan teks lolos WCAG AA (≥ 4.5:1); garis/tepi kontrol ≥ 3:1.

## Publikasi ke web

Aplikasi ini statis (tanpa build, tanpa server) — cukup unggah folder `rumahku/`.

1. **GitHub Pages** (paling permanen, butuh akses admin repo): Settings → Pages → Source: *Deploy from a branch* → branch `main`, folder `/` (root) → buka `https://<user>.github.io/<repo>/rumahku/`.
2. **Netlify Drop** (paling cepat, tanpa Git): buka [app.netlify.com/drop](https://app.netlify.com/drop), tarik folder `rumahku` ke halaman itu → dapat URL `https://<nama>.netlify.app`.
3. **tiiny.host** — unggah zip folder, dapat link dalam hitungan detik.
4. **CDN dari repo publik** (tanpa deploy): `https://raw.githack.com/<user>/<repo>/main/rumahku/index.html` — jalan karena Three.js di-vendor lokal.


## Peta ke temuan riset

| Temuan riset | Perbaikan di Rumahku |
|---|---|
| Iklan tiap 3–5 menit (Decor Life) | Tidak ada iklan sama sekali |
| Harga item naik per level (Home Design Makeover) | Semua aset gratis, tidak ada harga |
| Auto-renew langganan (Planner 5D, Trustpilot 2.5/5) | Tidak ada langganan |
| Tanpa undo, progres hilang (House Flipper 2) | Undo/redo 80 langkah + auto-save |
| Kebebasan dikunci quest / match-3 | Mode Desain Bebas, template tidak mengunci item |
| Katalog sempit, tak bisa sortir | 47 aset, pencarian + 6 kategori |
| Render HD dikunci versi gratis | Foto HD 1920×1080 gratis |
| Bug hapus progres | Riwayat lokal + snapshot JSON |

## Struktur

```
rumahku/
├── index.html          # shell UI: topbar, kanvas, katalog, panel properti, modal
├── css/style.css       # tema gelap, layout desktop + bottom sheet mobile
└── js/
    ├── three.min.js    # Three.js r149 (UMD, lokal)
    ├── catalog.js      # 47 aset prosedural + cache material
    └── app.js          # scene, kamera, drag, undo/redo, template, tantangan, foto, simpan
```

Aset dibuat dari geometri Three.js, bukan file model eksternal: aplikasi tetap ringan, jalan offline, dan tiap item bisa ganti warna tanpa mengunduh apa pun.
