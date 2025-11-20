import { AwsClient } from 'aws4fetch';

export default {
	async fetch(request, env, ctx) {
		// 1. Ambil path file yang diminta user (misal: /foto/kucing.jpg)
		const url = new URL(request.url);

		// Jika user akses root domain, tampilkan pesan error atau index
		if (url.pathname === '/' || url.pathname.endsWith('/')) {
			return new Response('File not found (Access Denied)', { status: 404 });
		}

		// 2. Siapkan Client untuk komunikasi ke Backblaze
		const client = new AwsClient({
			accessKeyId: env.B2_KEY_ID, // Kita set nanti di Settings
			secretAccessKey: env.B2_APP_KEY, // Kita set nanti di Settings
			service: 's3',
			// Isi sisanya dengan undefined biar editor senang:
			region: undefined,
			sessionToken: undefined,
			cache: undefined,
			retries: undefined,
			initRetryMs: undefined,
		});

		// 3. Susun URL tujuan ke Backblaze
		// Format: https://endpoint-s3-b2/nama-bucket/nama-file
		const b2Url = new URL(`https://${env.B2_ENDPOINT}/${env.B2_BUCKET_NAME}${url.pathname}`);

		// 4. Tanda tangani (Sign) request agar Backblaze mau menerima (karena private)
		// Kita hanya meneruskan method GET dan HEAD untuk download file
		const signedRequest = await client.sign(b2Url.toString(), {
			method: request.method,
			headers: {
				Range: request.headers.get('Range'), // Penting buat video streaming/seeking
			},
		});

		// 5. Kirim request ke Backblaze
		const response = await fetch(signedRequest);

		// Jika file tidak ada di B2 (404)
		if (response.status === 404) {
			return new Response('File not found.', { status: 404 });
		}

		// 6. Siapkan response untuk Browser
		const newHeaders = new Headers(response.headers);

		// Hapus header internal Backblaze yang tidak perlu dilihat orang
		newHeaders.delete('x-amz-request-id');
		newHeaders.delete('x-amz-id-2');

		// PENTING: Set Cache agar Cloudflare menyimpan file ini dan tidak tanya ke B2 terus menerus
		// "public, max-age=86400" artinya cache selama 1 hari (86400 detik)
		newHeaders.set('Cache-Control', 'public, max-age=86400');

		return new Response(response.body, {
			status: response.status,
			headers: newHeaders,
		});
	},
};
