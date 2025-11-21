# Cybeat CDN Backend

Backend CDN untuk aplikasi streaming musik Cybeat menggunakan Backblaze B2 dan Cloudflare R2.

## 📋 Deskripsi

Sistem penyimpanan dan distribusi file audio dengan arsitektur multi-tier:

- **Backblaze B2**: Storage utama
- **Cloudflare R2**: Edge cache dengan zero egress fee
- **Cloudflare CDN**: Distribusi global dengan latensi rendah

## 🔒 Keamanan

- Autentikasi JWT
- Signed URL dengan expiry time
- HTTPS only
- Rate limiting

## 💰 Estimasi Biaya

- Backblaze B2: $0.005/GB/bulan
- Cloudflare R2: $0.015/GB/bulan + **gratis bandwidth**

## 📞 Kontak

- By: Sibeux (Nasrul Wahabi)
- Email: <wahabinasrul@gmail.com>
