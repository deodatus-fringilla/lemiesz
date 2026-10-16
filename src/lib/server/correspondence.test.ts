import { describe, expect, it } from 'vitest';
import { runSeed } from './seed/seed';
import { seedMedia } from './seed/mediaSeed';
import { seedKoronaCorpus } from './seed/koronaSeed';
import {
	classifyMethodology,
	deconstructOpponentLetter,
	extractClaimsFromLetter,
	getCorrespondenceThread
} from './correspondence';
import { listPosters } from './posters';
import { runChecks } from './content/checks';

describe('Korona Epistolary Corpus & Classical Methodologies', () => {
	it('idempotently seeds the Korona correspondence, bilingual cards, sources, and campaign posters', () => {
		runSeed();
		seedMedia();
		const first = seedKoronaCorpus();
		expect(first.sourcesAdded).toBeGreaterThanOrEqual(8);
		expect(first.argumentsAdded).toBeGreaterThanOrEqual(8);
		expect(first.postersAdded).toBe(2);
		expect(first.lettersAdded).toBe(8);

		// Second run must be a no-op
		const second = seedKoronaCorpus();
		expect(second.sourcesAdded).toBe(0);
		expect(second.argumentsAdded).toBe(0);
		expect(second.postersAdded).toBe(0);
		expect(second.lettersAdded).toBe(0);

		const { thread, letters } = getCorrespondenceThread('korona');
		expect(thread).not.toBeNull();
		expect(letters).toHaveLength(8);
		expect(letters[0].filename).toBe('lemiesz_to_korona_01.txt');
		expect(letters[7].filename).toBe('korona_odp_04.txt');

		const posters = listPosters();
		expect(posters.map((p) => p.image_path)).toEqual(
			expect.arrayContaining(['/images/two_crowns_hero.jpg', '/images/kaszanka_sacred_life.jpg'])
		);
	});

	it('classifies opponent claims into the 5 non-Hegelian Classical Methodologies', () => {
		expect(classifyMethodology('Zasada Si vis pacem, para bellum i lekcja 1939 roku.')).toBe('thomistic_disputation');
		expect(classifyMethodology('Polska może być albo mocarstwem militarnym, albo zależna — nie potrzebujemy neutralności.')).toBe(
			'classical_refutation'
		);
		expect(classifyMethodology('Przy dzietności i budżecie gospodarki musimy liczyć koszty zbrojeń na kredyt.')).toBe(
			'sovereign_disputation'
		);
		expect(classifyMethodology('Zgadzam się z Panem i szanuję wspólny cel, jakim jest niebycie pionkiem.')).toBe(
			'chivalrous_polemics'
		);
	});

	it('extracts polemical claims from korona_odp_04.txt and deconstructs them with retrieved cards', async () => {
		const { letters } = getCorrespondenceThread('korona');
		const odp4 = letters.find((l) => l.filename === 'korona_odp_04.txt')!;
		const claims = extractClaimsFromLetter(odp4.body, 5);
		expect(claims.length).toBeGreaterThanOrEqual(3);

		const deconstructed = await deconstructOpponentLetter({
			text: odp4.body,
			locale: 'pl',
			includeDrafts: true,
			maxClaims: 4
		});
		expect(deconstructed.length).toBeGreaterThanOrEqual(3);
		expect(deconstructed.some((c) => c.arguments.length > 0 || c.sources.length > 0)).toBe(true);
	});

	it('validates epistolary letter structure in Content Engine checks', () => {
		const validLetter = [
			'Szanowna Pani Tereso, Szczęść Boże!',
			'W odpowiedzi na Pani pismo z 14 października 2026 roku pragnę zastosować klasyczne rozróżnienie tomistyczne (Distinguo) wobec tezy o Oazie Pokoju oraz Płodności Lemiesza. Państwo polskie potrzebuje suwerenności pokoju zakorzenionej w Rachunku Królewskim z Ewangelii według św. Łukasza, a nie zadłużonego garnizonu kupowanego na kredyt bez kodów źródłowych.',
			'Zestawienie doświadczenia Austrii z 1955 roku oraz Konstytucji Malty dowodzi jednoznacznie, że neutralność terytorialna nie jest kapitulacją, lecz suwerenną architekturą bezpieczeństwa.',
			'Z wyrazami szacunku, Bogdan Zięba (Przymierze Lemiesza)'
		].join('\n\n');

		const checks = runChecks({ platform: 'letter', body: validLetter, sourceTexts: [], brief: validLetter });
		const structCheck = checks.find((c) => c.id === 'letter_structure');
		expect(structCheck?.ok).toBe(true);
	});
});
