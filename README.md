# Buku Penghubung Digital SD No. 3 Lukluk

Aplikasi web ringan **tanpa npm dan tanpa proses build**. Dapat dicoba dalam mode demo, dan dapat digunakan secara online setelah disambungkan dengan Supabase. Dapat diunggah ke **GitHub + Vercel**.

## Isi dan identitas sekolah

- Sekolah: **SD No. 3 Lukluk**, Mengwi, Badung, Bali.
- Kepala Sekolah: **Putu Ayu Hendra Wini Artati, S.Pd**.
- NIP: **19860102 201903 2 006**.
- Logo: file `logo-sd3-lukluk.png`, dari gambar yang Anda berikan.
- Cetak: ukuran **A4 potret**, cover, halaman petunjuk, tabel berita (Hari/Tanggal; Berita; Tanda Tangan Orang Tua/Wali; Tanda Tangan Guru).

## Fitur

| Guru / Admin | Orang Tua / Wali |
| --- | --- |
| Login akun guru (role harus ditetapkan admin) | Daftar akun wali, verifikasi email, lalu login |
| Tambah data siswa | Melihat hanya siswa yang ditautkan guru |
| Hubungkan wali lewat email terdaftar | Membaca berita tentang anak |
| Menulis berita dan tanda tangan guru lewat canvas | Menandatangani berita menggunakan jari/mouse |
| Edit / hapus berita yang **belum** ditandatangani | Tidak bisa mengedit, menghapus, atau membuat berita |
| Lihat status tanda tangan orang tua | Tidak bisa mengubah tanda tangan yang telah disimpan |
| Filter tanggal, cetak buku A4 / Save as PDF, ekspor CSV | Melihat bukti konfirmasi dan waktu tanda tangan |

Tanda tangan dan waktu penerimaan disimpan di database. **Pesan yang sudah ditandatangani orang tua dikunci pada database dan tidak dapat diedit/dihapus guru**. Hak akses diberlakukan dengan Supabase Auth + PostgreSQL Row Level Security (RLS), tidak hanya menyembunyikan tombol.

## A. Coba aplikasi demo tanpa database

1. Ekstrak ZIP.
2. Buka `index.html` menggunakan Chrome/Edge. Pilih peran **Guru** atau **Orang Tua** pada banner kuning untuk melihat alur.
3. Guru dapat mengisi berita dan menandatangani. Beralih ke peran Orang Tua untuk mencoba membaca dan menandatangani.
4. Data demo hanya disimpan pada **localStorage browser/perangkat itu**, tidak ada keamanan login sebenarnya, tidak tersinkron ke HP orang tua, dan **tidak boleh digunakan sebagai arsip resmi atau untuk data pribadi siswa**.

> Mode demo aktif saat `SUPABASE_URL` dan `SUPABASE_ANON_KEY` di `config.js` belum diisi. Pengujian file lokal tergantung izin browser; jalankan dari hosting jika diblokir.

## B. Aktifkan backend Supabase (untuk akses guru/orang tua secara nyata)

1. Buat project di <https://supabase.com/dashboard>.
2. Buka **SQL Editor → New query**, salin seluruh isi `supabase/schema.sql`, lalu **Run**. Gunakan project database baru agar tidak menimpa tabel milik aplikasi lain.
3. Di **Project Settings → API Keys** / **Connect** (letak menu dapat berubah), salin **Project URL** dan **publishable key** (atau legacy `anon` key). **Jangan gunakan `service_role`/secret key**.
4. Edit `config.js` menjadi:

```js
window.BUKU_CONFIG = {
  SUPABASE_URL: 'https://PROJECT_ID.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_xxx' // atau legacy anon key
};
```

5. Di **Authentication → Providers → Email**, pastikan login email/password diaktifkan. Untuk keamanan disarankan **Confirm email** aktif. Pastikan layanan email Supabase cukup untuk jumlah orang tua; bawaan project mungkin membatasi pengiriman email.
6. Di **Authentication → URL Configuration**, atur **Site URL** ke domain Vercel sekolah (`https://nama-proyek.vercel.app`). Ini penting untuk link verifikasi email.
7. Buka situs Anda, pilih **Daftar orang tua** untuk membuat akun pertama (gunakan email guru/admin sekolah untuk akun pertama ini).
8. Untuk menetapkan akun sekolah menjadi **admin**, jalankan perintah berikut di SQL Editor, **setelah** pendaftaran akun berhasil:

```sql
update public.profiles
set role = 'admin'
where email = 'email-admin-sekolah@contoh.id';
```

Untuk menjadikan akun tertentu sebagai **guru**:

```sql
update public.profiles
set role = 'teacher'
where email = 'email-guru-kelas@contoh.id';
```

9. **Logout → login ulang**, atau muat ulang, agar dashboard menampilkan peran guru/admin.
10. Guru mengisi siswa. Orang tua mendaftar sendiri menggunakan email masing-masing. Di **Data Siswa → Hubungkan Orang Tua**, guru memasukkan email akun yang sudah didaftarkan oleh orang tua. Setelah ditautkan, orang tua dapat masuk dan melihat berita anaknya.

**Penting:** menu pendaftaran di aplikasi hanya dapat membuat akun orang tua. Tidak ada tombol untuk memilih peran guru/admin, supaya orang tua tidak dapat menaikkan hak akses sendiri.

## C. Unggah ke GitHub dan Vercel (tanpa npm)

1. Ekstrak ZIP, kemudian buat repository **private** baru di GitHub.
2. Pilih **Add file → Upload files**, lalu unggah **isi folder** proyek (bukan file ZIP saja). Pastikan `index.html`, `src`, `config.js`, `logo-sd3-lukluk.png`, dan `vercel.json` berada pada root repository.
3. Buka <https://vercel.com/new>, pilih **Import Git Repository**, dan hubungkan repository tersebut.
4. Pilih framework **Other**. **Build command dikosongkan** (Override Build Command nonaktif); **Output Directory** default / root repo (`.`) bila diminta; ini proyek HTML statis, bukan Vite/Next.js.
5. Deploy. Setelah muncul alamat `https://...vercel.app`, sesuaikan Supabase Authentication Site URL dengan alamat tersebut.
6. Uji dengan dua akun berbeda menggunakan dua browser / jendela privat: akun **teacher** menulis berita; akun **parent** menandatangani; guru memeriksa status.

Supabase JS versi 2 dimuat dari CDN resmi yang didokumentasikan Supabase, sehingga pengguna membutuhkan koneksi internet. Supabase sendiri merupakan backend eksternal; tanpa konfigurasi, publikasi di Vercel tetap menjalankan **mode demo**, bukan database sungguhan.

## D. Mencetak untuk akreditasi

1. Login sebagai guru atau admin.
2. Pilih **Buku & Cetak**.
3. Pilih **satu siswa**, dan opsional isi filter tanggal. Tinjau status tanda tangan.
4. Tekan **Cetak A4 / PDF**.
5. Di dialog cetak Chrome/Edge: pilih **Destination: Save as PDF** untuk arsip digital, atau pilih printer sekolah. Gunakan **Paper size A4**, **Scale 100% / Default**, nonaktifkan **Headers and footers** bawaan browser, aktifkan **Background graphics** apabila ingin warna seperti tampilan.
6. Output otomatis memuat **cover dengan logo**, identitas siswa, **petunjuk penggunaan beserta nama/NIP kepala sekolah**, dan lembar-lembar tabel berita lengkap dengan tanda tangan.
7. Gunakan **Rekap CSV** untuk pengawasan status berita dan lampiran administrasi bila diperlukan.

**Penggunaan tanda tangan:** gambar tanda tangan di aplikasi ini adalah bentuk tanda tangan elektronik sederhana/pengakuan telah membaca, bukan sertifikat elektronik tersertifikasi. Untuk penggunaan sebagai dokumen administrasi atau akreditasi, pastikan sekolah menyetujui prosedur, mengatur otorisasi, arsip, akses, dan retensi dokumen sesuai kebijakan/kebutuhan penilaian yang berlaku.

## E. Privasi dan keamanan

- Hanya orang tua yang dihubungkan dengan siswa oleh guru dapat melihat data siswa tersebut.
- Orang tua hanya dapat `SELECT` berita dan `INSERT` tanda tangan satu kali; kebijakan database menolak operasi edit berita, edit tanda tangan dan menulis berita dari akun wali.
- Guru melihat berita siswa yang ditugaskan padanya, admin melihat semua siswa.
- Setelah tanda tangan wali tersimpan, trigger database mencegah perubahan/penghapusan berita terkait.
- Jangan memakai password yang sama untuk akun guru dan orang tua. Jangan mengirim password melalui grup WA.
- Project ini disediakan sebagai awal aplikasi sekolah. Sebelum produksi, uji kebijakan RLS dengan akun berbeda, tetapkan SOP retensi dan backup, serta tinjau kebutuhan perlindungan data pribadi siswa.
- Data demo di localStorage bukan keamanan produksi. Tombol pilih role hanya muncul dalam demo tanpa Supabase.
- Untuk perlindungan dokumen cetak, simpan PDF di folder sekolah berizin terbatas.
- Batas panjang berita: 800 karakter; gambar tanda tangan disimpan sebagai PNG data URL (maksimal 200 KB per tanda tangan). 

## Struktur file

```text
buku-penghubung-sd3lukluk/
├── index.html
├── config.js              # URL + publishable/anon key Supabase
├── logo-sd3-lukluk.png
├── vercel.json
├── Template_Buku_Penghubung_A4.pdf  # Template kosong siap print
├── src/
│   ├── app.js             # Logika aplikasi + template cetak
│   └── styles.css         # Tampilan + CSS @media print A4
├── supabase/
│   └── schema.sql         # Tabel, auth trigger, RLS, penguncian tanda tangan
└── README.md
```

## Catatan pengujian

- Berkas HTML/CSS/JS dan SQL telah dibuat; sintaks JavaScript diperiksa dengan `node --check`.
- **Belum terhubung ke project Supabase Anda dan belum dideploy ke Vercel.** Verifikasi fungsional end-to-end online memerlukan akses ke project milik sekolah dan dua akun pengguna sungguhan.
- Template PDF kosong A4 disediakan terpisah bila sekolah perlu langsung mencetak buku sebelum aplikasi online aktif.
