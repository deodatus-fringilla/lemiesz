import { afterEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { human, system } from './review';
import {
	approveText,
	listApprovals,
	twinCandidates,
	updateArticleMeta,
	createArticle,
	deleteArticle,
	flagText,
	getArticle,
	getPublishedArticle,
	getText,
	listForEditors,
	listPublished,
	publishText,
	requiredApprovals,
	saveText,
	setTwin,
	unpublishText,
	unflagText,
	countedApprovalsOf
} from './journal';
import { describeCitations, findCitationProblems } from './journal-citations';

const ania = human('ania');
const bartek = human('bartek');
let n = 0;
const article = (caliber: 'light' | 'heavy' = 'light', body = 'Treść rozprawy o neutralności.') =>
	createArticle({ caliber, locale: 'pl', title: `Rozprawa ${++n}`, lead: 'Lead', body, tags: 'Szwajcaria, retencja' }, ania);
const approveAndPublish = (id: number, ...people: ReturnType<typeof human>[]) => {
	for (const p of people) approveText(id, 'pl', p);
	publishText(id, 'pl', people[0]);
};

function approvedSource(review = 'human_approved'): number {
	const id = Number(
		db.prepare("INSERT INTO sources (work, section_ref, category, license, original_locale) VALUES ('Konwencja haska', 'Art. 1', 'law', 'public domain', 'pl')").run()
			.lastInsertRowid
	);
	db.prepare("INSERT INTO source_texts (source_id, locale, text, origin, review) VALUES (?, 'pl', 'Terytorium mocarstw neutralnych jest nietykalne.', 'original', ?)").run(id, review);
	return id;
}

afterEach(() => {
	delete process.env.JOURNAL_HEAVY_REVIEWERS;
});

describe('journal articles', () => {
	it('keeps foreign keys on after the table-rebuild migration', () => {
		expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
	});

	it('creates a draft with a clean unique slug; a pipeline author means AI-assisted', () => {
		const a = createArticle({ caliber: 'light', locale: 'pl', title: 'Czy neutralność jest możliwa?', body: 'x' }, ania);
		const b = createArticle({ caliber: 'heavy', locale: 'pl', title: 'Czy neutralność jest możliwa?', body: 'x' }, system('pipeline'));
		expect(getArticle(a)!.slug).toBe('czy-neutralnosc-jest-mozliwa');
		expect(getArticle(b)!.slug).toBe('czy-neutralnosc-jest-mozliwa-2');
		expect(getText(a, 'pl')).toMatchObject({ status: 'draft', revision: 1, ai_assisted: false, published_body: null });
		expect(getText(b, 'pl')!.ai_assisted).toBe(true);
		expect(() => createArticle({ caliber: 'medium' as never, locale: 'pl', title: 't', body: 'x' }, ania)).toThrow();
	});

	it('needs one approval for light and two different people for heavy (configurable)', () => {
		expect(requiredApprovals('light')).toBe(1);
		expect(requiredApprovals('heavy')).toBe(2);
		const heavy = article('heavy');
		expect(approveText(heavy, 'pl', ania)).toEqual({ approvals: 1, required: 2, approved: false });
		expect(approveText(heavy, 'pl', ania).approvals).toBe(1); // the same person twice still counts once
		expect(() => publishText(heavy, 'pl', ania)).toThrow(/not approved/);
		expect(approveText(heavy, 'pl', bartek).approved).toBe(true);
		publishText(heavy, 'pl', bartek);
		expect(getPublishedArticle(getArticle(heavy)!.slug, 'pl')).not.toBeNull();
		process.env.JOURNAL_HEAVY_REVIEWERS = '1';
		expect(requiredApprovals('heavy')).toBe(1);
	});

	it('only humans approve, flag or publish', () => {
		const id = article();
		expect(() => approveText(id, 'pl', system('pipeline'))).toThrow();
		expect(() => publishText(id, 'pl', system('pipeline'))).toThrow();
		expect(() => flagText(id, 'pl', system('pipeline'))).toThrow();
	});

	it('an edit resets the working copy to draft but keeps the published version online until the fix is approved', () => {
		const id = article();
		approveAndPublish(id, ania);
		const slug = getArticle(id)!.slug;
		saveText(id, 'pl', { title: 'Poprawiony tytuł', body: 'Nowa treść.' }, ania);
		expect(getText(id, 'pl')).toMatchObject({ status: 'draft', revision: 2 });
		expect(getPublishedArticle(slug, 'pl')!.body).toBe('Treść rozprawy o neutralności.');
		expect(() => publishText(id, 'pl', ania)).toThrow(/not approved/); // the old approval was for revision 1
		approveAndPublish(id, ania);
		expect(getPublishedArticle(slug, 'pl')).toMatchObject({ title: 'Poprawiony tytuł', body: 'Nowa treść.' });
	});

	it('saving identical text changes nothing', () => {
		const id = article();
		const t = getText(id, 'pl')!;
		expect(saveText(id, 'pl', { title: t.title, lead: t.lead, body: t.body }, ania)).toEqual({ changed: false, revision: 1 });
	});

	it('a flagged text must be edited before approval', () => {
		const id = article();
		flagText(id, 'pl', ania);
		expect(() => approveText(id, 'pl', ania)).toThrow(/flagged/);
		saveText(id, 'pl', { title: 'Nowy', body: 'Poprawione.' }, ania);
		expect(approveText(id, 'pl', ania).approved).toBe(true);
	});

	it('refuses to approve or publish citations that do not resolve to approved stored text', () => {
		const ok = approvedSource();
		const notYet = approvedSource('draft');
		expect(findCitationProblems(`[[src:${ok}]] [[quote:${ok}]]`, 'pl')).toEqual([]);
		expect(findCitationProblems(`[[src:${notYet}]] [[src:999999]] [[quote:${ok}]]`, 'en').map((p) => p.reason)).toEqual([
			'not_approved',
			'unknown_source',
			'no_approved_text_in_locale'
		]);
		const id = article('light', `Teza [[src:${notYet}]].`);
		expect(() => approveText(id, 'pl', ania)).toThrow(/src:/);
		// Approved, then the source loses its approval: publishing re-checks.
		const id2 = article('light', `Teza [[quote:${ok}]].`);
		approveText(id2, 'pl', ania);
		db.prepare("UPDATE source_texts SET review = 'flagged' WHERE source_id = ?").run(ok);
		expect(() => publishText(id2, 'pl', ania)).toThrow(/no longer/);
	});

	it('links twins of different calibres both ways and shows the published twin', () => {
		const light = article('light');
		const heavy = article('heavy');
		const other = article('light');
		expect(() => setTwin(light, other, ania)).toThrow(/different calibres/);
		setTwin(light, heavy, ania);
		expect(getArticle(heavy)!.twin_id).toBe(light);
		approveAndPublish(light, ania);
		expect(getPublishedArticle(getArticle(light)!.slug, 'pl')!.twin).toBeNull(); // twin not published yet
		approveAndPublish(heavy, ania, bartek);
		expect(getPublishedArticle(getArticle(light)!.slug, 'pl')!.twin).toMatchObject({ caliber: 'heavy', slug: getArticle(heavy)!.slug });
		setTwin(light, null, ania);
		expect(getArticle(heavy)!.twin_id).toBeNull();
	});

	it('lists and searches only published versions, by calibre and tag', () => {
		const id = article('light', 'Retencja i zagrody jako kolce jeża.');
		approveAndPublish(id, ania);
		saveText(id, 'pl', { title: 'Szkic roboczy', body: 'Tajna wersja robocza o meandrach.' }, ania);
		const found = listPublished({ locale: 'pl', q: 'kolce jeża' });
		expect(found.some((a) => a.id === id)).toBe(true);
		expect(listPublished({ locale: 'pl', q: 'meandrach' }).some((a) => a.id === id)).toBe(false);
		expect(listPublished({ locale: 'pl', caliber: 'heavy' }).some((a) => a.id === id)).toBe(false);
		expect(listPublished({ locale: 'pl', tag: 'retencja' }).some((a) => a.id === id)).toBe(true);
		expect(listPublished({ locale: 'pl', tag: '%' }).some((a) => a.id === id)).toBe(false);
		expect(listPublished({ locale: 'en' }).some((a) => a.id === id)).toBe(false);
	});

	it('will not delete a live article; unpublish first', () => {
		const id = article();
		approveAndPublish(id, ania);
		expect(() => deleteArticle(id)).toThrow(/Unpublish/);
		unpublishText(id, 'pl', ania);
		expect(getPublishedArticle(getArticle(id)!.slug, 'pl')).toBeNull();
		expect(deleteArticle(id)).toBe(true);
	});

	it('a baseline replay may insert an article before the twin it points at (deferred reference)', () => {
		expect(() =>
			db.transaction(() => {
				const next = (db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS n FROM journal_articles").get() as { n: number }).n;
				db.prepare("INSERT INTO journal_articles (id, slug, caliber, twin_id, created_by) VALUES (?, ?, 'light', ?, 't')").run(next, `replay-${next}`, next + 1);
				db.prepare("INSERT INTO journal_articles (id, slug, caliber, twin_id, created_by) VALUES (?, ?, 'heavy', ?, 't')").run(next + 1, `replay-${next + 1}`, next);
			})()
		).not.toThrow();
		expect(() =>
			db.transaction(() => {
				db.prepare("INSERT INTO journal_articles (slug, caliber, twin_id, created_by) VALUES ('dangling', 'light', 987654, 't')").run();
			})()
		).toThrow(/FOREIGN KEY/);
	});

	it("shows editors each language's state and approvals", () => {
		const id = article('heavy');
		approveText(id, 'pl', ania);
		expect(listForEditors().find((r) => r.id === id)).toMatchObject({ status: 'draft', approvals: 1, required: 2, published_revision: null });
	});

	it('a calibre change starts a new revision (old approvals stop counting) and drops a twin of the same calibre', () => {
		const light = article('light');
		const heavy = article('heavy');
		setTwin(light, heavy, ania);
		approveText(light, 'pl', ania);
		expect(listApprovals(light, 'pl').map((a) => a.approved_by)).toEqual(['ania']);
		updateArticleMeta(light, { caliber: 'heavy', author: ' Bogdan Zięba ', tags: 'neutralność' }, ania);
		expect(getArticle(light)).toMatchObject({ caliber: 'heavy', author: 'Bogdan Zięba', tags: 'neutralność', twin_id: null });
		expect(getArticle(heavy)!.twin_id).toBeNull();
		expect(getText(light, 'pl')).toMatchObject({ status: 'draft', revision: 2 });
		expect(listApprovals(light, 'pl')).toEqual([]);
		expect(() => updateArticleMeta(light, { author: 'x' }, system('pipeline'))).toThrow();
	});

	it('offers twins of the other calibre only, and labels citations for the editor', () => {
		const light = article('light');
		const heavy = article('heavy');
		const candidates = twinCandidates(light, 'pl').map((c) => c.id);
		expect(candidates).toContain(heavy);
		expect(candidates).not.toContain(light);
		const src = approvedSource();
		const info = describeCitations(`A [[src:${src}]] B [[src:${src}]] C [[quote:424242]]`, 'pl');
		expect(info).toEqual([
			{ token: `[[src:${src}]]`, kind: 'src', id: src, label: 'Konwencja haska — Art. 1', problem: null },
			{ token: '[[quote:424242]]', kind: 'quote', id: 424242, label: null, problem: 'unknown_source' }
		]);
	});

	it('with real accounts on, a development-mode "dev" approval is not a person and does not count', () => {
		const id = article('heavy');
		approveText(id, 'pl', human('dev')); // made while AUTH_DISABLED=true (as in these tests)
		expect(countedApprovalsOf(id, 'pl')).toBe(1);
		process.env.AUTH_DISABLED = 'false';
		try {
			expect(countedApprovalsOf(id, 'pl')).toBe(0);
			expect(approveText(id, 'pl', ania)).toMatchObject({ approvals: 1, required: 2, approved: false });
			expect(() => publishText(id, 'pl', ania)).toThrow(/not approved/);
			expect(approveText(id, 'pl', bartek).approved).toBe(true);
			publishText(id, 'pl', bartek);
			expect(listForEditors().find((r) => r.id === id)!.approvals).toBe(2);
		} finally {
			process.env.AUTH_DISABLED = 'true';
		}
	});

	it('does not get stuck when the required number of approvals is lowered after approving (the reported dead end)', () => {
		const id = article('heavy');
		expect(approveText(id, 'pl', ania).approved).toBe(false); // 1 of 2: stored status stays draft
		process.env.JOURNAL_HEAVY_REVIEWERS = '1';
		publishText(id, 'pl', ania); // 1 of 1 now: publishable without approving again
		expect(getPublishedArticle(getArticle(id)!.slug, 'pl')).not.toBeNull();
		expect(getText(id, 'pl')!.status).toBe('human_approved');
	});

	it('"needs changes" can be undone without editing, and the approvals still count', () => {
		const id = article();
		approveText(id, 'pl', ania);
		flagText(id, 'pl', ania);
		expect(() => publishText(id, 'pl', ania)).toThrow(/not approved/);
		unflagText(id, 'pl', ania);
		expect(getText(id, 'pl')!.status).toBe('draft');
		publishText(id, 'pl', ania);
		expect(getPublishedArticle(getArticle(id)!.slug, 'pl')).not.toBeNull();
		expect(() => unflagText(id, 'pl', ania)).toThrow(/not flagged/);
		expect(() => unflagText(id, 'pl', system('pipeline'))).toThrow();
	});
});
