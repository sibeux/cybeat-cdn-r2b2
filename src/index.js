import { AwsClient } from 'aws4fetch';

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// 1. TENTUKAN CACHE KEY (Force GET)
		// Trik: Kita paksa kuncinya selalu dianggap GET.
		// Jadi mau user curl -I (HEAD) atau download (GET), lacinya SAMA.
		const cacheKey = new Request(url.toString(), {
			method: 'GET',
			headers: request.headers,
		});

		const cache = caches.default;
		let response = await cache.match(cacheKey);

		if (response) {
			// --- JIKA HIT ---
			const newHeaders = new Headers(response.headers);
			newHeaders.set('CF-Cache-Status', 'HIT-MANUAL');

			// Jika user aslinya minta HEAD, kita buang body-nya biar irit bandwidth user
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

		const pathSegments = url.pathname.split('/').map((segment) => {
			return encodeURIComponent(decodeURIComponent(segment));
		});
		const b2Path = pathSegments.join('/');
		const b2Url = new URL(`https://${env.B2_ENDPOINT}/${env.B2_BUCKET_NAME}${b2Path}`);

		// 2. REKAYASA REQUEST KE B2 (Force GET)
		// Kita selalu minta file UTUH (GET) ke Backblaze supaya bisa disimpan di cache.
		// Jangan pakai request.method (karena kalau HEAD, nanti gak ada isinya buat dicache)
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

		// Buat response object yang siap disimpan (harus ada body-nya)
		const finalResponse = new Response(b2Response.body, {
			status: b2Response.status,
			headers: newHeaders,
		});

		// 3. SIMPAN KE CACHE
		// Kita simpan clone-nya. Karena ini GET, body-nya lengkap. Cache pasti senang.
		if (b2Response.status === 200) {
			ctx.waitUntil(cache.put(cacheKey, finalResponse.clone()));
		}

		// 4. KEMBALIKAN KE USER
		// Jika user tadi minta HEAD, kita potong body-nya sekarang
		if (request.method === 'HEAD') {
			return new Response(null, {
				status: finalResponse.status,
				headers: finalResponse.headers,
			});
		}

		return finalResponse;
	},
};
