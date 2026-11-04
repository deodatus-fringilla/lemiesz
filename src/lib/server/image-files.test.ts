import { describe, expect, it } from 'vitest';
import zlib from 'node:zlib';
import { MAX_UPLOAD_BYTES, detectType, dimensions, inspectUpload, readUpload, storeUpload, stripMetadata } from './image-files';

function png(w: number, h: number, extra: Buffer[] = []): Buffer {
	const chunk = (name: string, data: Buffer) => {
		const len = Buffer.alloc(4);
		len.writeUInt32BE(data.length);
		const crc = Buffer.alloc(4); // CRC is not checked by the parser
		return Buffer.concat([len, Buffer.from(name, 'ascii'), data, crc]);
	};
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(w, 0);
	ihdr.writeUInt32BE(h, 4);
	ihdr[8] = 8;
	ihdr[9] = 2;
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		...extra.map((e) => chunk('tEXt', e)),
		chunk('IDAT', zlib.deflateSync(Buffer.alloc(w * h * 3 + h))),
		chunk('IEND', Buffer.alloc(0))
	]);
}

function jpeg(w: number, h: number, withExif = true): Buffer {
	const seg = (marker: number, data: Buffer) => {
		const len = Buffer.alloc(2);
		len.writeUInt16BE(data.length + 2);
		return Buffer.concat([Buffer.from([0xff, marker]), len, data]);
	};
	const sof = Buffer.alloc(15);
	sof[0] = 8;
	sof.writeUInt16BE(h, 1);
	sof.writeUInt16BE(w, 3);
	return Buffer.concat([
		Buffer.from([0xff, 0xd8]),
		seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'binary')),
		...(withExif ? [seg(0xe1, Buffer.from('Exif\0\0GPS 52.2297N 21.0122E', 'binary'))] : []),
		seg(0xfe, Buffer.from('comment: camera XYZ')),
		seg(0xc0, sof),
		Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9])
	]);
}

function webp(w: number, h: number, exif = true): Buffer {
	const chunk = (name: string, data: Buffer) => {
		const len = Buffer.alloc(4);
		len.writeUInt32LE(data.length);
		return Buffer.concat([Buffer.from(name, 'ascii'), len, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
	};
	const vp8x = Buffer.alloc(10);
	vp8x[0] = exif ? 0x08 : 0;
	vp8x.writeUIntLE(w - 1, 4, 3);
	vp8x.writeUIntLE(h - 1, 7, 3);
	const body = Buffer.concat([chunk('VP8X', vp8x), chunk('VP8L', Buffer.from([0x2f, 0, 0, 0, 0])), ...(exif ? [chunk('EXIF', Buffer.from('GPS 52.2N'))] : [])]);
	const head = Buffer.alloc(12);
	head.write('RIFF', 0, 'ascii');
	head.writeUInt32LE(body.length + 4, 4);
	head.write('WEBP', 8, 'ascii');
	return Buffer.concat([head, body]);
}

describe('uploaded images', () => {
	it('recognises the real type and size, whatever the file is called', () => {
		expect([detectType(png(10, 20)), dimensions(png(10, 20), 'png')]).toEqual(['png', { width: 10, height: 20 }]);
		expect([detectType(jpeg(640, 480)), dimensions(jpeg(640, 480), 'jpeg')]).toEqual(['jpeg', { width: 640, height: 480 }]);
		expect([detectType(webp(1600, 900)), dimensions(webp(1600, 900), 'webp')]).toEqual(['webp', { width: 1600, height: 900 }]);
		expect(detectType(Buffer.from('<svg onload="alert(1)"></svg>'))).toBeNull();
		expect(detectType(Buffer.from('GIF89a......'))).toBeNull();
	});

	it('removes hidden data (EXIF/GPS, XMP, comments, text chunks) and keeps the picture', () => {
		const j = stripMetadata(jpeg(64, 48), 'jpeg');
		expect(j.toString('binary')).not.toMatch(/GPS|camera XYZ/);
		expect(j.toString('binary')).toContain('JFIF');
		expect(dimensions(j, 'jpeg')).toEqual({ width: 64, height: 48 });
		const p = stripMetadata(png(4, 4, [Buffer.from('Author\0Jan Kowalski GPS')]), 'png');
		expect(p.toString('binary')).not.toContain('GPS');
		expect(dimensions(p, 'png')).toEqual({ width: 4, height: 4 });
		const w = stripMetadata(webp(100, 50), 'webp');
		expect(w.toString('binary')).not.toContain('GPS');
		expect(w[20] & 0x08).toBe(0); // EXIF flag cleared
		expect(w.readUInt32LE(4)).toBe(w.length - 8); // RIFF size rewritten
		expect(dimensions(w, 'webp')).toEqual({ width: 100, height: 50 });
	});

	it('refuses empty, oversized, unknown, unreadable and gigantic images with a reason', () => {
		expect(() => inspectUpload(Buffer.alloc(0))).toThrow(/empty/);
		expect(() => inspectUpload(Buffer.concat([png(10, 10), Buffer.alloc(MAX_UPLOAD_BYTES)]))).toThrow(/kB/);
		expect(() => inspectUpload(Buffer.from('<svg/>'))).toThrow(/JPEG, PNG and WebP/);
		expect(() => inspectUpload(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toThrow(/could not be read/);
		expect(() => inspectUpload(png(5000, 10))).toThrow(/4000/);
		expect(inspectUpload(webp(800, 600))).toMatchObject({ type: 'webp', width: 800, height: 600 });
	});

	it('stores a picture once under its content fingerprint and reads back only valid names', () => {
		const { bytes, type } = inspectUpload(webp(10, 10, false));
		const p1 = storeUpload(bytes, type);
		expect(p1).toMatch(/^\/images\/uploads\/[a-f0-9]{24}\.webp$/);
		expect(storeUpload(bytes, type)).toBe(p1);
		expect(readUpload(p1.split('/').pop()!)?.equals(bytes)).toBe(true);
		expect(readUpload('../../etc/passwd')).toBeNull();
		expect(readUpload('a.webp')).toBeNull();
	});
});
