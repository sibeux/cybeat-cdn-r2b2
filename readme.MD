# Cybeat CDN Backend

Backend CDN (Bandwidth Alliance) untuk aplikasi streaming musik Cybeat menggunakan Backblaze B2 dan Cloudflare.

## 📋 Deskripsi

Sistem penyimpanan dan distribusi file audio dengan arsitektur multi-tier:

- **Backblaze B2**: Storage utama
- **Cloudflare**: Edge cache dengan zero egress fee
- **Cloudflare CDN**: Distribusi global dengan latensi rendah

## 🔒 Keamanan

- Autentikasi JWT
- Signed URL dengan expiry time
- HTTPS only
- Rate limiting

## 💰 Estimasi Biaya

- Backblaze B2: $0.005/GB/bulan

## 📞 Kontak

- By: Sibeux (Nasrul Wahabi)
- Email: <wahabinasrul@gmail.com>
