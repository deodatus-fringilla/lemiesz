import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Uploaded journal images: what the server accepts, how it measures them and how it removes hidden data.
 * The browser already shrinks and re-encodes photos (canvas drops EXIF/GPS); the server never trusts that and checks
 * the real file content again. No image library: JPEG, PNG and WebP headers are parsed directly.
 */
export const MAX_UPLOAD_BYTES = 400 * 1024;
export const MAX_DIMENSION = 4000;
export type ImageType = 'jpeg' | 'png' | 'webp';
const EXT: Record<ImageType, string> = { jpeg: 'jpg', png: 'png', webp: 'webp' };
export const CONTENT_TYPE: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml' };

/** The real type from the first bytes (the file name and the browser's claim are ignored). */
export function detectType(b: Buffer): ImageType | null {
	if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
	if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
	if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
	return null;
}

export function dimensions(b: Buffer, type: ImageType): { width: number; height: number } | null {
	try {
		if (type === 'png') return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
		if (type === 'webp') {
			const chunk = b.toString('ascii', 12, 16);
			if (chunk === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
			if (chunk === 'VP8L') {
				const bits = b.readUInt32LE(21);
				return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
			}
			if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
			return null;
		}
		// JPEG: walk the segments to the first start-of-frame marker.
		let i = 2;
		while (i + 9 < b.length) {
			if (b[i] !== 0xff) return null;
			const marker = b[i + 1];
			const len = b.readUInt16BE(i + 2);
			if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
			i += 2 + len;
		}
	} catch {
		// truncated or corrupt header
	}
	return null;
}

/** Removes EXIF/XMP/comments (camera, GPS, software) while keeping the picture and its colour profile. */
export function stripMetadata(b: Buffer, type: ImageType): Buffer {
	if (type === 'jpeg') {
		const out: Buffer[] = [b.subarray(0, 2)];
		let i = 2;
		while (i + 4 <= b.length && b[i] === 0xff) {
			const marker = b[i + 1];
			if (marker === 0xda) return Buffer.concat([...out, b.subarray(i)]); // image data follows: copy the rest
			const len = b.readUInt16BE(i + 2);
			const seg = b.subarray(i, i + 2 + len);
			// Drop APP1..APP15 (EXIF, XMP, camera data…) and comments. Keep APP0 (JFIF), APP2 (ICC colour profile) and
			// APP14 (Adobe colour transform: without it CMYK/Adobe JPEGs show wrong colours).
			const drop = ((marker >= 0xe1 && marker <= 0xef) || marker === 0xfe) && marker !== 0xe2 && marker !== 0xee;
			if (!drop) out.push(seg);
			i += 2 + len;
		}
		return Buffer.concat([...out, b.subarray(i)]);
	}
	if (type === 'png') {
		const out: Buffer[] = [b.subarray(0, 8)];
		for (let i = 8; i + 12 <= b.length; ) {
			const len = b.readUInt32BE(i);
			const name = b.toString('ascii', i + 4, i + 8);
			const whole = b.subarray(i, i + 12 + len);
			if (!['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME'].includes(name)) out.push(whole);
			i += 12 + len;
		}
		return Buffer.concat(out);
	}
	// WebP: keep image chunks, drop EXIF and XMP, rewrite the RIFF size (and the VP8X flags).
	const chunks: Buffer[] = [];
	for (let i = 12; i + 8 <= b.length; ) {
		const name = b.toString('ascii', i, i + 4);
		const len = b.readUInt32LE(i + 4);
		const whole = b.subarray(i, i + 8 + len + (len % 2));
		if (name !== 'EXIF' && name !== 'XMP ') {
			if (name === 'VP8X') {
				const copy = Buffer.from(whole);
				copy[8] &= ~(0x08 | 0x04); // clear the EXIF and XMP flags
				chunks.push(copy);
			} else chunks.push(whole);
		}
		i += 8 + len + (len % 2);
	}
	const body = Buffer.concat(chunks);
	const head = Buffer.alloc(12);
	head.write('RIFF', 0, 'ascii');
	head.writeUInt32LE(body.length + 4, 4);
	head.write('WEBP', 8, 'ascii');
	return Buffer.concat([head, body]);
}

export class ImageUploadError extends Error {}

/** Checks an upload completely; returns the cleaned bytes, its type and size, or throws with a readable reason. */
export function inspectUpload(b: Buffer): { bytes: Buffer; type: ImageType; width: number; height: number } {
	if (b.length === 0) throw new ImageUploadError('The file is empty');
	if (b.length > MAX_UPLOAD_BYTES) throw new ImageUploadError(`The image is larger than ${MAX_UPLOAD_BYTES / 1024} kB`);
	const type = detectType(b);
	if (!type) throw new ImageUploadError('Only JPEG, PNG and WebP images are accepted');
	const dim = dimensions(b, type);
	if (!dim || dim.width < 1 || dim.height < 1) throw new ImageUploadError('The image could not be read');
	if (dim.width > MAX_DIMENSION || dim.height > MAX_DIMENSION) throw new ImageUploadError(`Images may be at most ${MAX_DIMENSION} px on each side`);
	return { bytes: stripMetadata(b, type), type, ...dim };
}

/** data/uploads/journal next to the database (so backups and the Docker /data volume carry it). */
export function uploadsDir(): string {
	const dbPath = process.env.DATABASE_PATH || './data/lemiesz.db';
	return path.resolve(path.dirname(dbPath), 'uploads', 'journal');
}

/** Stores cleaned bytes under their content fingerprint; returns the public path. The same picture is stored once. */
export function storeUpload(bytes: Buffer, type: ImageType): string {
	const name = `${crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 24)}.${EXT[type]}`;
	const dir = uploadsDir();
	fs.mkdirSync(dir, { recursive: true });
	const file = path.join(dir, name);
	if (!fs.existsSync(file)) fs.writeFileSync(file, bytes);
	return `/images/uploads/${name}`;
}

export const UPLOAD_NAME = /^[a-f0-9]{24}\.(jpg|png|webp)$/;

export function readUpload(name: string): Buffer | null {
	if (!UPLOAD_NAME.test(name)) return null;
	const file = path.join(uploadsDir(), name);
	return fs.existsSync(file) ? fs.readFileSync(file) : null;
}
