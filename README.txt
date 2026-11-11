ALL TOOLS MAS FERNZZ V4.1 - DOWNLOADER UPDATE
=======================

V4 adalah paket backend + frontend yang dapat dipasang pada hosting Node.js publik.
Ini bukan website yang otomatis online: pemilik tetap perlu membuat akun hosting,
mengunggah project, mengisi rahasia environment, dan menekan Deploy.

FITUR YANG SUDAH TERSEDIA DI KODE
- Registrasi/login multi-user; password di-hash bcrypt; sesi cookie HttpOnly.
- Akun owner otomatis dibuat dari environment OWNER_USERNAME/OWNER_PASSWORD.
  Owner FernzzX mendapat admin + premium; user lain tidak otomatis premium.
- Admin: statistik, daftar user, atur status premium, daftar order, verifikasi manual.
- Akun: kuota, histori penggunaan, histori order, notifikasi, saldo kredit internal.
- Jadwal sholat melalui Aladhan; cuaca saat ini melalui Open-Meteo.
- QR, kalkulator, generator teks, QC/IQC/IGN, IP lookup, tes koneksi, SOS SMS
  dan simulator tersedia sesuai antarmuka frontend.
- Endpoint health check: /api/health
- Deploy manifest Render, Dockerfile, dan Procfile disertakan.

FITUR YANG BUTUH SETUP TAMBAHAN / TIDAK BOLEH DIKLAIM SUDAH OTOMATIS
1. Downloader TikTok/Instagram/CapCut:
   harus punya API provider yang sah. Isi *_API_URL dan *_API_KEY di Environment
   hosting. Tanpa itu endpoint akan memberi status API belum dikonfigurasi.
   Gunakan hanya untuk konten milik sendiri atau yang diizinkan.
2. Premium berbayar:
   belum ada payment gateway/webhook. Order masih pending sampai admin memeriksa
   pembayaran asli lalu verifikasi manual. Jangan mengubah order menjadi paid hanya
   berdasarkan bukti dari browser.
3. Fake DANA / fake lobby ML / FF:
   hanya simulator/mockup untuk desain atau demonstrasi, bukan transaksi atau lobby asli.
4. IP lookup:
   perkiraan lokasi jaringan, bukan GPS atau pelacakan seseorang.
5. Kredit internal:
   bukan uang tunai dan tidak dapat dicairkan.
6. SOS:
   membuka aplikasi SMS di perangkat pengguna; bukan sistem darurat yang menjamin SMS terkirim.

DEPLOY PUBLIK DENGAN ANDROID (RENDER + GITHUB)
Catatan: Render dengan persistent disk biasanya berbayar. Jangan gunakan penyimpanan
sementara untuk SQLite produksi karena data bisa hilang saat instance diganti.

A. Siapkan file
1. Download ZIP V4 dan ekstrak menggunakan aplikasi pengelola file Android.
2. Buat akun GitHub jika belum ada.
3. Di GitHub, buat repository baru bernama all-tools-mas-fernzz.
4. Upload seluruh ISI folder all_tools_mas_fernzz_v4 ke repository (bukan file ZIP-nya).
   Pastikan server.js, package.json, folder public, dan render.yaml ada di root repo.
5. Jangan pernah upload file .env atau password ke GitHub.

B. Deploy di Render
1. Buka https://render.com lalu daftar/login.
2. Pilih New + > Blueprint (atau New Web Service jika Blueprint tidak tersedia).
3. Hubungkan akun GitHub dan pilih repository all-tools-mas-fernzz.
4. Jika memakai Blueprint, Render membaca render.yaml. Periksa service dan persistent disk.
5. Isi OWNER_PASSWORD dengan password kuat minimal 12 karakter di Environment.
6. Pastikan JWT_SECRET dibuat otomatis oleh Render; jangan bagikan nilainya.
7. Deploy. Tunggu status Live dan buka URL *.onrender.com yang diberikan.
8. Tes URL /api/health; hasil yang sehat memuat ok:true dan version 4.1.
9. Login menggunakan username FernzzX dan password owner yang tadi kamu atur.

C. Jika deploy manual
- Runtime Node, Node 20 atau lebih baru.
- Build command: npm install
- Start command: npm start
- Environment: NODE_ENV=production, JWT_SECRET (acak minimal 32 karakter),
  OWNER_USERNAME=FernzzX, OWNER_PASSWORD (min 12 karakter), DB_FILE pada persistent disk.
- PORT disediakan otomatis oleh hosting.
- Tambahkan disk persisten dan arahkan DB_FILE ke file pada disk itu, misalnya /var/data/data.sqlite. Untuk downloader TikTok/Instagram, tambahkan COBALT_API_URL dan optional COBALT_API_KEY. Untuk CapCut, tambahkan CAPCUT_API_URL dan optional CAPCUT_API_KEY.

PENTING SEBELUM DIBUKA KE PUBLIK
- Ganti harga paket contoh di UI dan tulis syarat layanan/kebijakan privasi yang sesuai.
- Sambungkan payment gateway resmi (mis. Midtrans/Xendit) sebelum menerima pembayaran otomatis.
- Konfigurasikan API downloader resmi; jangan gunakan API yang melanggar hak cipta/ketentuan platform.
- Uji registrasi, login, logout, admin, kuota, dan pemulihan data.
- Buat backup database berkala dan aktifkan HTTPS.
- Jangan mengirimkan password owner, JWT_SECRET, atau API key ke siapa pun.

PENGUJIAN LOKAL (KOMPUTER)
1. Install Node.js 20+.
2. Salin .env.example menjadi .env lalu isi nilai rahasia.
3. Jalankan npm install lalu npm start.
4. Buka http://localhost:3000

KETERBATASAN
Paket ini merupakan fondasi deploy publik, bukan audit keamanan atau jaminan siap skala besar.
Lakukan pengujian dan hardening sebelum menerima banyak pengguna atau pembayaran.


DOWNLOADER V4.1 - CATATAN PENTING
- Dokumentasi API Cobalt: https://github.com/imputnet/cobalt/blob/main/docs/api.md
- Daftar layanan Cobalt: https://github.com/imputnet/cobalt
- Cobalt perlu di-host sendiri atau mendapat izin penggunaan dari pemilik instance.
- Cobalt bukan provider CapCut; jangan mengisi CAPCUT_API_URL dengan Cobalt.
- Jika provider membalas status error, format tidak dikenal, atau timeout, situs
  menampilkan pesan error dan tidak membuat link unduhan palsu.
