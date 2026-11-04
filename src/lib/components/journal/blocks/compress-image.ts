/**
 * Shrinks a photo in the browser before upload: at most 1600 px on the longer side and 400 kB, WebP where the browser
 * can encode it, JPEG otherwise. Re-drawing on a canvas also drops hidden data (EXIF: camera, GPS position).
 * No library: this is what the ready-made "image compressor" packages do internally.
 */
export const MAX_BYTES = 400 * 1024;
export const MAX_SIDE = 1600;

export async function compressImage(file: Blob): Promise<{ blob: Blob; width: number; height: number }> {
	const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	try {
		let scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
		for (let round = 0; round < 6; round++) {
			const width = Math.max(1, Math.round(bitmap.width * scale));
			const height = Math.max(1, Math.round(bitmap.height * scale));
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d')!;
			for (const type of ['image/webp', 'image/jpeg']) {
				if (type === 'image/jpeg') {
					ctx.fillStyle = '#fff'; // JPEG has no transparency: put transparent areas on white, not black
					ctx.fillRect(0, 0, width, height);
				}
				ctx.drawImage(bitmap, 0, 0, width, height);
				for (const quality of [0.82, 0.72, 0.62]) {
					const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
					// A browser that cannot encode WebP silently returns PNG: only accept the type we asked for.
					if (blob && blob.type === type && blob.size <= MAX_BYTES) return { blob, width, height };
				}
			}
			scale *= 0.8;
		}
	} finally {
		bitmap.close();
	}
	throw new Error('too-big');
}
