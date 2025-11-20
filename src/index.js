import { AwsClient } from 'aws4fetch';

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// 1. Tentukan Cache Key (Gunakan URL asli user sebagai kunci)
		// Kita gunakan cache standard Cloudflare
		const cache = caches.default;
		const cacheKey = new Request(url.toString(), request);

		// 2. CEK CACHE DULU (Manual Check)
		// Sebelum capek-capek minta ke Backblaze, cek apakah kita sudah punya filenya?
		let response = await cache.match(cacheKey);

		if (response) {
			// --- JIKA HIT (Ada di Cache) ---
			// Kita return langsung. Gak perlu jalanin logic B2 sama sekali.
			// Hemat biaya request B2 & Super Cepat.
			const newHeaders = new Headers(response.headers);
			newHeaders.set('CF-Cache-Status', 'HIT-MANUAL'); // Penanda kalau ini dari script kita
			return new Response(response.body, {
				status: response.status,
				headers: newHeaders,
			});
		}

		// --- JIKA MISS (Gak ada di Cache) ---
		// Lanjut ke proses normal ambil dari Backblaze

		if (url.pathname === '/' || url.pathname.endsWith('/')) {
			return new Response('Access Denied', { status: 403 });
		}

		const client = new AwsClient({
			accessKeyId: env.B2_KEY_ID,
			secretAccessKey: env.B2_APP_KEY,
			service: 's3',
			region: 'us-east-1',
		});

		const pathSegments = url.pathname.split('/').map((segment) => {
			return encodeURIComponent(decodeURIComponent(segment));
		});
		const b2Path = pathSegments.join('/');
		const b2Url = new URL(`https://${env.B2_ENDPOINT}/${env.B2_BUCKET_NAME}${b2Path}`);

		const signedRequest = await client.sign(b2Url.toString(), {
			method: request.method,
			headers: {
				Range: request.headers.get('Range'),
			},
		});

		// Fetch ke Backblaze
		const b2Response = await fetch(signedRequest);

		if (b2Response.status === 404) {
			return new Response('File not found', { status: 404 });
		}

		// Siapkan Response untuk disimpan
		const newHeaders = new Headers(b2Response.headers);
		newHeaders.delete('x-amz-request-id');
		newHeaders.delete('x-amz-id-2');

		// SETTING CACHE SUPER KUAT
		// Browser simpan 1 hari, Cloudflare simpan 1 tahun (biar awet)
		newHeaders.set('Cache-Control', 'public, max-age=86400, s-maxage=31536000');
		newHeaders.set('CF-Cache-Status', 'MISS-FETCHED');

		const finalResponse = new Response(b2Response.body, {
			status: b2Response.status,
			headers: newHeaders,
		});

		// 3. SIMPAN KE CACHE (Manual Put)
		// Kita simpan clone-nya agar request berikutnya langsung dapet HIT
		// Syarat: Hanya simpan jika sukses (200) dan bukan partial content (206) biar aman
		if (b2Response.status === 200) {
			ctx.waitUntil(cache.put(cacheKey, finalResponse.clone()));
		}

		return finalResponse;
	},
};
