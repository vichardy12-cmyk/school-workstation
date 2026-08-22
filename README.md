# 小学语文教师工作台 (Elementary Chinese Teacher Work Station)

Personal full-stack work station for a 小学语文教师 (elementary school Chinese teacher).
Warm pastel-green UI, fully in Mandarin, responsive (PC & phone), data persists in SQLite and
syncs across devices because everyone opens the same server URL.

## Fitur
- 工作台 Dashboard: live clock, mini calendar, weekly 课程表, class stats, today's schedule, homework reminders, 每日一言, quick links.
- Modul: 学生管理, 教案管理, 作业管理, 成绩管理, 家校沟通, 通知公告, 待办事项, 课程表, 教学资料, 日程安排.
- Profil (pojok kiri): avatar bisa upload foto, tersimpan di browser.
- AI 小助手 floating di pojok kanan bawah (proxy ke LLM kalau dikonfigurasi, else heuristik offline).

## Cara menjalankan (lokal)
```bash
npm install        # install express + sql.js (masuk ke server/node_modules)
npm start          # jalanin server/index.js
# buka http://localhost:3000
```
Default login: username `pengyu` / password `Pengyu20001005` (bisa diubah di profil → 账号安全).

## Konfigurasi AI (opsional)
Tanpa API key, AI 小助手 menjawab dengan heuristik offline (tetap berguna untuk draf pesan orang tua,教案, dll).
Untuk mencoba LLM sungguhan, set environment variable lalu jalankan:
```bash
export LLM_API_KEY="sk-..."
export LLM_BASE_URL="https://api.openai.com/v1"   # atau endpoint OpenAI-compatible
export LLM_MODEL="gpt-4o-mini"
npm start
```

## Deploy (link TETAP + data beneran tersimpan, bukan static demo)

App ini butuh **server Node + database SQLite**, jadi TIDAK bisa pakai deploy static (CloudStudio static / GitHub Pages).
Harus pakai host Node beneran agar: link permanen, bisa tambah/ubah data, database awet.

### Cara A — Render (free tier, stabil di China, rekomendasi)
1. Daftar gratis di https://render.com (bisa pakai akun GitHub/Google).
2. Dashboard → **New** → **Web Service**.
3. Pilih **Upload Files** (zip folder project ini) atau connect GitHub repo.
   - Kalau upload zip: pastikan `package.json` ada di root (sudah ada).
4. Isi:
   - **Name**: `school-workstation`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
   - **Region**: pilih `Singapore` (lebih dekat China) atau `Oregon`.
5. Klik **Create Web Service**. Tunggu build selesai (~1-2 menit).
6. Render kasih URL permanen, mis. `https://school-workstation.onrender.com`.
   Kasih URL itu ke teman → berdua buka, lihat **data yang SAMA** (1 database `data/school.db`).
7. Login default: `pengyu` / `Pengyu20001005` (bisa diubah di profil → 账号安全).

> Free tier Render **tidak dibuka otomatis tiap saat**: kalau 15 menit gak ada yang buka, sleep;
> orang pertama buka perlu tunggu ~30 detik "wake up". Data tetap aman (persist di disk).
> Kalau mau SELALU nyala, upgrade ke plan berbayar (~$7/bulan) — tapi free sudah cukup buat 2 guru.

### Cara B — Railway (gampang, kadang lemot di China)
1. https://railway.app → New Project → Deploy from GitHub/zip.
2. Build: `npm install`, Start: `npm start`.
3. Dapat URL publik. Sama seperti Render, 1 DB share berdua.

### Catatan penting
- Data tersimpan di file `data/school.db` di server (auto-create saat pertama jalan).
  Selama server tidak dihapus, data awet walau restart.
- Untuk backup: download file `data/school.db` dari server / atau ekspor via fitur di app.
- Kalau suatu saat butuh login lebih aman (password di server, 2 akun beda), bilang saja — bisa di-upgrade.

## Struktur
```
school-workstation/
  package.json        (root: start script + deps)
  server/  index.js · db.js (schema+seed) · ai.js · node_modules/
  public/  index.html · css/style.css · js/app.js
  data/    school.db (auto-create saat pertama jalan)
```

Data seed otomatis: 35 murid 三(2)班 + 教案/作业/成绩/沟通/通知/待办/资料/日程/课程表 contoh nyata.
