import { AwsClient } from 'aws4fetch';

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// 1. Blokir akses ke root domain (opsional)
		if (url.pathname === '/' || url.pathname.endsWith('/')) {
			return new Response('Access Denied', { status: 403 });
		}

		// 2. Setup Client Backblaze
		const client = new AwsClient({
			accessKeyId: env.B2_KEY_ID,
			secretAccessKey: env.B2_APP_KEY,
			service: 's3',
			region: 'us-east-1', // Default dummy region
		});

		// 3. FIX ENCODING (Jepang & Simbol)
		// Kita pecah path, decode dulu (jaga-jaga), lalu encode ulang satu per satu
		// Ini solusi ampuh untuk mengatasi masalah 403 Signature Does Not Match
		const pathSegments = url.pathname.split('/').map((segment) => {
			return encodeURIComponent(decodeURIComponent(segment));
		});
		const b2Path = pathSegments.join('/');

		// 4. Susun URL Backblaze
		const b2Url = new URL(`https://${env.B2_ENDPOINT}/${env.B2_BUCKET_NAME}${b2Path}`);

		// 5. Sign Request
		const signedRequest = await client.sign(b2Url.toString(), {
			method: request.method,
			headers: {
				Range: request.headers.get('Range'), // Support seek video/audio
			},
		});

		// 6. Fetch ke Backblaze
		const response = await fetch(signedRequest);

		// 7. Handle Error (404)
		if (response.status === 404) {
			return new Response('File not found', { status: 404 });
		}

		// 8. Bersihkan Header & Set Cache
		const newHeaders = new Headers(response.headers);
		newHeaders.delete('x-amz-request-id');
		newHeaders.delete('x-amz-id-2');
		newHeaders.set('Cache-Control', 'public, max-age=86400'); // Cache 1 hari

		// 9. Kirim File ke User
		return new Response(response.body, {
			status: response.status,
			headers: newHeaders,
		});
	},
};
