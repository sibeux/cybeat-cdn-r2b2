# Documentation

ORIGINAL SOURCE DOCS BY GEMINI: <https://gemini.google.com/share/8b506a75f4ec>

## SET UP BACKBLAZE B2

Buat bucket di Backblaze B2 dan dapatkan `KEY_ID` dan `APPLICATION_KEY`. Contoh key-nya:

```json
Success! Your new application key has been created. It will only appear here once.

keyID: 0044bb329480c123jda20000000003
keyName: r2-cybeat-key
applicationKey: K0040asf8234RoBYE5Lv7M3535r2qPm1k867SDIknH4
```

## UPLOAD FILE DARI WINDOWS KE BACKBLAZE B2 BY CLI

```bash
rclone copy "C:\Users\Nasrul Wahabi\Downloads\Compressed\日本の歌" "b2remote:cybeat-sibeux/日本の歌" -P
```

> Backblaze B2 mirip seperti github, jadi tidak bisa drag-and-drop folder.

## SET UP CLOUDFLARE

Buat akun Cloudflare dan dapatkan `ACCOUNT_ID` dan `API_TOKEN`. Untuk setting index.js/worker.js, disarankan di local biar bisa diinstal via npm. Masukkan ke git dan deploy otomatis ke cloudflare worker.

```bash
Cara add key ke cloudflare worker:

npx wrangler secret put B2_KEY_ID
# (Paste keyID)

npx wrangler secret put B2_APP_KEY
# (Paste applicationKey)
```

## TES KONEKSI

Tes koneksi Cloudflare ke Backblaze. Perlu beberapa settingan agar file bisa dicache ke dalam Cloudflare CDN. Lihat dokumentasi Gemini untuk detailnya. Contoh cara test koneksi:

```bash
curl -I https://cybeat.wahabinasrul.workers.dev/%E6%97%A5%E6%9C%AC%E3%81%AE%E6%AD%8C/Oz.%20%20yama%20-%20Covered%20by%20Kotoha/flac/01.mp3
```

> Pastikan link file sesuai dengan formal URL. Ini mirip banget dengan git repo.

## BUAT SUBDOMAIN CDN.DOMAIN.COM

Setelah cache berhasil, buat subdomain di Cloudflare, misalnya `cdn.domain.com`, dan arahkan ke worker yang sudah dibuat. Perlu mengubah nameserver dari provider domain dan diarahkan ke cloudflare. Ini juga ada cara setting khusus di cloudflare, check dokumentasi Gemini.

```bash
Test lagi setelah buat subdomain, tetapi pakai user-agent Mozilla supaya cache-nya terpakai:

curl -I -A "Mozilla/5.0" "https://cybeat-cdn-r2b2.wahabinasrul.workers.dev/%E6%97%A5%E6%9C%AC%E3%81%AE%E6%AD%8C/Oz.%20%20yama%20-%20Covered%20by%20Kotoha/flac/01.mp3"
```

## CHECK SPEED CDN

```bash
curl -o /dev/null -s -w "Time Connect: %{time_connect}s\nTime Start Transfer: %{time_starttransfer}s\nTotal Time: %{time_total}s\n" "https://cdn.sibeux.my.id/%E6%97%A5%E6%9C%AC%E3%81%AE%E6%AD%8C/Oz.%20%20yama%20-%20Covered%20by%20Kotoha/flac/01.mp3"
```

> Telegram paste command: <https://t.me/c/1924556915/1707>
