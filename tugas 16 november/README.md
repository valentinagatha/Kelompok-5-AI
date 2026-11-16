# Tugas 16 November — Riset Game & Aplikasi Desain Interior

**Penyusun:** Shalina Fakhira
**Tanggal:** 16 November 2026

## Isi folder

| File | Isi |
|---|---|
| `Riset Game Desain Interior - Shalina Fakhira.xlsx` | 5 sheet: Ringkasan, 35 Sumber, Kekurangan & Perbaikan, Pola Masalah, Peluang Fitur |
| `Riset Game Desain Interior - Shalina Fakhira.pptx` | 12 slide: latar belakang, metode, lanskap produk, 5 temuan, rekap skor, peluang, kesimpulan |
| `Riset Game Desain Interior - Shalina Fakhira.docx` | Laporan naratif lengkap + daftar 35 sumber |
| `data/sumber-riset.json` | Data mentah semua sumber (dipakai untuk generate 3 dokumen di atas) |

## Ringkas temuan

Dari 35 sumber (media review, skor pengguna, toko aplikasi, Trustpilot/G2, ulasan individu), keluhan yang paling sering muncul bukan soal grafis, tapi soal **kontrol pemain**:

1. **Monetisasi mengganggu** — iklan tiap 3–5 menit (Decor Life), harga item meledak di level tinggi (Home Design Makeover), langganan auto-renew (Planner 5D, Trustpilot 2.5/5).
2. **Kebebasan desain dikunci** — quest menentukan barang & pola, tidak ada undo (House Flipper 2), grid kaku (Animal Crossing), desain hanya lewat challenge/match-3 (Design Home, Redecor, Interior Story).
3. **Bug & performa** — desain hilang saat klaim hadiah (Redecor), crash saat mengukur (Planner 5D), AR lambat (IKEA Place).
4. **Katalog sempit & pencarian buruk** — 4 item per layar tanpa sortir harga (Design Home), tak bisa cari nomor artikel (IKEA Place), furnitur lebih sedikit dari versi lama (House Flipper 2).
5. **Grind & output gratis mentok** — leveling sengaja diperlambat (Dream House Days), render HD dikunci di versi gratis (Planner 5D, Homestyler, Sweet Home 3D).

## Rekomendasi prioritas

1. Undo/redo + auto-save server-side
2. Dua mode: Template Cepat + Free Build, dengan free placement
3. Katalog besar + filter (harga/gaya/ukuran/warna) + cari SKU
4. Render HD gratis berwatermark + preset pencahayaan
5. Monetisasi adil: tanpa iklan mid-play, kosmetik/season pass opsional, langganan transparan

## Regenerate dokumen

```bash
export OUT_DIR="$PWD"
python3 /path/to/build_docs.py   # butuh openpyxl, python-pptx, python-docx
```
