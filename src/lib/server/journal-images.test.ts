import { describe, expect, it } from 'vitest';
import { human, system } from './review';
import { createPoster, deletePoster, getPoster, setPosterStatus } from './posters';
import fs from 'node:fs';
import path from 'node:path';
import { storeUpload, uploadsDir } from './image-files';
import { assertUploadFields, findImageProblems, getJournalImage, registerUpload, renderImage, setImageMeta, webVersion } from './journal-images';
import { approveText, createArticle, publishText } from './journal';
import { db } from './db';

const ania = human('ania');
let n = 0;
const image = (status: 'draft' | 'human_approved' = 'human_approved', alt: string | null = 'Jeż pod dębem') => {
	const id = createPoster({ title: `Obraz ${++n}`, artist_or_author: 'Studio', image_path: `/images/test/obraz-${n}-${Date.now()}.jpg` }, ania);
	if (alt) setImageMeta(id, { alt_pl: alt, license: 'własna' }, ania);
	if (status === 'human_approved') setPosterStatus(id, 'human_approved', ania);
	return id;
};

describe('journal images', () => {
	it('uses the light web copy of an existing heavy image, with its real size', () => {
		const v = webVersion('/images/two_crowns_hero.jpg');
		expect(v.src).toBe('/images/web/two_crowns_hero.webp');
		expect(v.width).toBeGreaterThan(0);
		expect(v.height).toBeGreaterThan(0);
		expect(webVersion('/images/doktryna-jeza/hedgehog_allegory_01.svg').src).toBe('/images/doktryna-jeza/hedgehog_allegory_01.svg');
	});

	it('shows readers only approved images that have alternative text in the article language', () => {
		const ok = image();
		const draft = image('draft');
		const noAlt = image('human_approved', null);
		expect(renderImage({ imageId: ok, size: 'wide' }, 'pl')).toMatchObject({ type: 'image', alt: 'Jeż pod dębem', size: 'wide', credit: 'Studio', license: 'własna' });
		expect(renderImage({ imageId: draft, size: 'column' }, 'pl')).toBeNull();
		expect(renderImage({ imageId: noAlt, size: 'column' }, 'pl')).toBeNull();
		expect(renderImage({ imageId: ok, size: 'column' }, 'en')).toBeNull(); // no English alt yet
		expect(findImageProblems([{ type: 'image', imageId: draft, size: 'column' }, { type: 'image', imageId: 999999, size: 'column' }], 'pl')).toEqual([
			expect.stringMatching(/not approved/),
			expect.stringMatching(/no longer exists/)
		]);
	});

	it('changing the alternative text or licence of an approved image sends it back to draft', () => {
		const id = image();
		setImageMeta(id, { alt_pl: 'Jeż pod dębem' }, ania); // unchanged: stays approved
		expect(getPoster(id)!.status).toBe('human_approved');
		setImageMeta(id, { alt_pl: 'Inny opis' }, ania);
		expect(getPoster(id)!.status).toBe('draft');
		expect(() => setImageMeta(id, { alt_pl: 'x' }, system('pipeline'))).toThrow();
	});

	it('an article with an image that is not ready cannot be approved, and publishing re-checks', () => {
		const draft = image('draft');
		const a = createArticle({ caliber: 'light', locale: 'pl', title: 'Z obrazem', blocks: [{ type: 'text', md: 'Tekst.' }, { type: 'image', imageId: draft, size: 'column' }] }, ania);
		expect(() => approveText(a, 'pl', ania)).toThrow(/not approved/);
		setPosterStatus(draft, 'human_approved', ania);
		approveText(a, 'pl', ania);
		setImageMeta(draft, { alt_pl: 'zmieniony' }, ania); // back to draft after approval
		expect(() => publishText(a, 'pl', ania)).toThrow(/Images or media not ready/);
	});

	it('registers an upload as a draft with credit, licence and alt text required; the same file twice is one entry', () => {
		const base = { path: `/images/uploads/${'a'.repeat(23)}${n}.webp`, width: 800, height: 600, title: 'Pole', artist: 'Jan', license: 'CC BY 4.0', alt: 'Pole w słońcu', locale: 'pl' };
		expect(() => registerUpload({ ...base, license: ' ' }, ania)).toThrow(/licence/);
		expect(() => registerUpload({ ...base, alt: '' }, ania)).toThrow(/alternative/);
		expect(() => registerUpload(base, system('pipeline'))).toThrow();
		const id = registerUpload(base, ania);
		expect(getJournalImage(id)).toMatchObject({ origin: 'upload', status: 'draft', width: 800, height: 600, license: 'CC BY 4.0', alt_pl: 'Pole w słońcu' });
		expect(registerUpload(base, ania)).toBe(id);
	});

	it('refuses an incomplete upload description before any file is written', () => {
		expect(() => assertUploadFields({ title: 'x', artist: 'y', license: '', alt: 'z', locale: 'pl' }, ania)).toThrow(/licence/);
		expect(() => assertUploadFields({ title: 'x', artist: 'y', license: 'own', alt: 'z', locale: 'pl' }, ania)).not.toThrow();
	});

	it('deleting an uploaded image removes its file too', () => {
		const p = storeUpload(Buffer.from(`RIFF\x1a\0\0\0WEBPVP8L\x05\0\0\0\x2f\0\0\0\0${Date.now()}`, 'binary'), 'webp');
		const id = registerUpload({ path: p, width: 10, height: 10, title: 'Do usunięcia', artist: 'x', license: 'own', alt: 'opis', locale: 'pl' }, ania);
		const file = path.join(uploadsDir(), path.basename(p));
		expect(fs.existsSync(file)).toBe(true);
		expect(deletePoster(id)).toBe(true);
		expect(fs.existsSync(file)).toBe(false);
	});
});

describe('images written into text', () => {
	it('finds a library image by its stored path, and a heavy one by the light copy readers get', async () => {
		const { imageBySrc } = await import('./journal-images');
		const id = image();
		const stored = getJournalImage(id)!.src;
		expect(imageBySrc(stored)?.id).toBe(id);
		const heavy = db.prepare("SELECT id FROM campaign_posters WHERE image_path = '/images/two_crowns_hero.jpg'").get() as { id: number } | undefined;
		if (heavy) expect(imageBySrc('/images/web/two_crowns_hero.webp')?.id).toBe(heavy.id);
		expect(imageBySrc('/images/nie-ma-takiego.webp')).toBeNull();
		expect(imageBySrc('https://tracker.example/p.png')).toBeNull(); // never a picture from another site
		expect(imageBySrc('//evil.example/p.png')).toBeNull();
	});

	it('shows readers only an approved, described library image, and takes everything but the caption from the library', async () => {
		const { renderInlineImage } = await import('./journal-images');
		const ok = image();
		const draft = image('draft');
		const noAlt = image('human_approved', null);
		const src = (id: number) => getJournalImage(id)!.src;
		expect(renderInlineImage({ src: src(ok), caption: 'Mój podpis' }, 'pl')).toMatchObject({ alt: 'Jeż pod dębem', caption: 'Mój podpis', credit: 'Studio', license: 'własna', size: 'column' });
		expect(renderInlineImage({ src: src(draft), caption: '' }, 'pl')).toBeNull();
		expect(renderInlineImage({ src: src(noAlt), caption: '' }, 'pl')).toBeNull();
		expect(renderInlineImage({ src: src(ok), caption: '' }, 'en')).toBeNull(); // no English description yet
		expect(renderInlineImage({ src: '/images/zmyslony.webp', caption: '' }, 'pl')).toBeNull();
	});

	it('names every inline image that keeps an article from readers, each once', async () => {
		const { imageIssues } = await import('./journal-images');
		const draft = image('draft');
		const noAlt = image('human_approved', null);
		const src = (id: number) => getJournalImage(id)!.src;
		const blocks = [
			{ type: 'text' as const, md: `![a](${src(draft)})\n\n![a](${src(draft)} "drugi raz")\n\n![b](${src(noAlt)})\n\n![c](/images/nie-ma.webp)` }
		];
		expect(imageIssues(blocks, 'pl')).toEqual([
			expect.objectContaining({ reason: 'not_approved', id: draft }),
			expect.objectContaining({ reason: 'no_alt', id: noAlt }),
			expect.objectContaining({ reason: 'missing', id: 0, title: '/images/nie-ma.webp' })
		]);
		expect(findImageProblems(blocks, 'pl')).toEqual([expect.stringMatching(/not approved/), expect.stringMatching(/no alternative text/), expect.stringMatching(/not in the image library/)]);
	});

	it('an article with an unapproved inline image cannot be approved, and publishing re-checks', () => {
		const draft = image('draft');
		const a = createArticle({ caliber: 'light', locale: 'pl', title: 'Obraz w tekście', blocks: [{ type: 'text', md: `Tekst.\n\n![x](${getJournalImage(draft)!.src})` }] }, ania);
		expect(() => approveText(a, 'pl', ania)).toThrow(/not approved/);
		setPosterStatus(draft, 'human_approved', ania);
		approveText(a, 'pl', ania);
		setImageMeta(draft, { alt_pl: 'zmieniony' }, ania); // back to draft after approval
		expect(() => publishText(a, 'pl', ania)).toThrow(/Images or media not ready/);
	});
});
