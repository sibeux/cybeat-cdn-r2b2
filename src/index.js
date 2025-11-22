import { AwsClient } from 'aws4fetch';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // --- CONFIGURATION ---
        // Ekstensi file musik yang WAJIB divalidasi
        const protectedExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg'];
        const isMusic = protectedExtensions.some(ext => url.pathname.toLowerCase().endsWith(ext));

        // --- 0. VALIDASI TOKEN (Hanya untuk Musik) ---
        if (isMusic) {
            const signature = url.searchParams.get('verify');
            const expires = url.searchParams.get('expires');

            if (!signature || !expires) {
                return new Response('Missing secure token', { status: 403 });
            }

            // Cek apakah waktu sudah expired
            if (Date.now() / 1000 > parseInt(expires)) {
                return new Response('Token expired', { status: 403 });
            }

            // Validasi Signature (HMAC SHA-256)
            const isValid = await verifySignature(url.pathname, expires, signature, env.HMAC_SECRET_KEY);
            if (!isValid) {
                return new Response('Invalid token', { status: 403 });
            }
        }

        // --- 1. TENTUKAN CACHE KEY (Canonical & Force GET) ---
        
        // PENTING: Kita harus membuang query params (?verify=..&expires=..) dari Cache Key.
        // Jika tidak dibuang, setiap user akan mendapat cache miss karena token mereka unik.
        // Kita ingin: User A (token valid) -> Cache Miss -> Save.
        // User B (token valid beda) -> Cache Hit (dari file yang disimpan User A).
        
        const cacheUrl = new URL(url.toString());
        cacheUrl.search = ''; // Hapus query params untuk kunci cache

        const cacheKey = new Request(cacheUrl.toString(), {
            method: 'GET',
            headers: request.headers,
        });

        const cache = caches.default;
        let response = await cache.match(cacheKey);

        if (response) {
            // --- JIKA HIT ---
            const newHeaders = new Headers(response.headers);
            newHeaders.set('CF-Cache-Status', 'HIT-MANUAL');

            if (request.method === 'HEAD') {
                return new Response(null, {
                    status: response.status,
                    headers: newHeaders,
                });
            }

            return new Response(response.body, {
                status: response.status,
                headers: newHeaders,
            });
        }

        // --- JIKA MISS (Ambil ke Backblaze) ---

        if (url.pathname === '/' || url.pathname.endsWith('/')) {
            return new Response('Access Denied', { status: 403 });
        }

        const client = new AwsClient({
            accessKeyId: env.B2_KEY_ID,
            secretAccessKey: env.B2_APP_KEY,
            service: 's3',
            region: 'us-east-1',
        });

        // Decode path
        const pathSegments = url.pathname.split('/').map((segment) => {
            return encodeURIComponent(decodeURIComponent(segment));
        });
        const b2Path = pathSegments.join('/');
        // URL B2 bersih tanpa query params token
        const b2Url = new URL(`https://${env.B2_ENDPOINT}/${env.B2_BUCKET_NAME}${b2Path}`);

        // 2. REKAYASA REQUEST KE B2 (Force GET)
        const signedRequest = await client.sign(b2Url.toString(), {
            method: 'GET',
            headers: {
                Range: request.headers.get('Range'),
            },
        });

        const b2Response = await fetch(signedRequest);

        if (b2Response.status === 404) {
            return new Response('File not found', { status: 404 });
        }

        const newHeaders = new Headers(b2Response.headers);
        newHeaders.delete('x-amz-request-id');
        newHeaders.delete('x-amz-id-2');
        newHeaders.set('Cache-Control', 'public, max-age=86400, s-maxage=31536000');
        newHeaders.set('CF-Cache-Status', 'MISS-FETCHED');

        const finalResponse = new Response(b2Response.body, {
            status: b2Response.status,
            headers: newHeaders,
        });

        // 3. SIMPAN KE CACHE (Menggunakan cacheKey yang sudah dibersihkan tadi)
        if (b2Response.status === 200) {
            ctx.waitUntil(cache.put(cacheKey, finalResponse.clone()));
        }

        // 4. KEMBALIKAN KE USER
        if (request.method === 'HEAD') {
            return new Response(null, {
                status: finalResponse.status,
                headers: finalResponse.headers,
            });
        }

        return finalResponse;
    },
};

// --- HELPER FUNCTION UNTUK VERIFIKASI HMAC ---
async function verifySignature(path, expires, receivedSignature, secretKey) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    
    // Import key agar bisa dipakai crypto.subtle
    const key = await crypto.subtle.importKey(
        'raw', 
        keyData, 
        { name: 'HMAC', hash: 'SHA-256' }, 
        false, 
        ['verify']
    );

    // Buat string yang sama dengan backend: path + expires
    const dataToSign = encoder.encode(path + expires);
    
    // Convert signature dari hex string (PHP) ke Uint8Array
    // PHP hash_hmac outputnya hex string, kita perlu ubah jadi buffer
    const signatureBuffer = hexToBuffer(receivedSignature);

    // Verifikasi
    return await crypto.subtle.verify(
        'HMAC', 
        key, 
        signatureBuffer, 
        dataToSign
    );
}

// Helper: Hex String to ArrayBuffer
function hexToBuffer(hexString) {
    if (hexString.length % 2 !== 0) return new Uint8Array(0); // Invalid hex
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
        bytes[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
    }
    return bytes;
}