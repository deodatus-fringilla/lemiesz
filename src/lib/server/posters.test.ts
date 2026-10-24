import { describe, expect, it } from 'vitest';
import { db } from './db';
import { human } from './review';
import {
	createPoster,
	getPoster,
	getSeries,
	listPosters,
	listSeriesSummary,
	validatePoster,
	setPosterStatus,
	deletePoster
} from './posters';

const operator = human('tester');

describe('Campaign Posters & Series Architecture (Canon 04)', () => {
	it('validates and creates posters with series attributes, layers, and moral quotes', () => {
		const planetId = createPoster(
			{
				title: 'Doktryna Jeża (Planeta)',
				artist_or_author: 'Józef Chełmoński Styl',
				image_path: '/images/test_hedgehog_planet.jpg',
				theme: 'sovereignty_peace',
				caption_pl: 'Planeta serii Doktryna Jeża',
				caption_en: 'Planet of the Hedgehog Doctrine series',
				series_slug: 'test-hedgehog',
				series_order: 0,
				is_planet: true,
				layer: 'standalone',
				moral_quote_pl: 'Nie jesteśmy drapieżnikiem, lecz jeżem nie do połknięcia.'
			},
			operator
		);
		expect(planetId).toBeGreaterThan(0);

		const planet = getPoster(planetId);
		expect(planet).not.toBeNull();
		expect(planet?.is_planet).toBe(true);
		expect(planet?.series_slug).toBe('test-hedgehog');
		expect(planet?.series_order).toBe(0);
		expect(planet?.moral_quote_pl).toContain('nie do połknięcia');

		// Create satellite step 1 - allegory
		const sat1Id = createPoster(
			{
				title: 'Jeż Gospodarz (Krok 1 - Alegoria)',
				artist_or_author: 'Przymierze Lemiesza Studio',
				image_path: '/images/test_hedgehog_allegory_1.jpg',
				theme: 'agrarian_ethos',
				series_slug: 'test-hedgehog',
				series_order: 1,
				is_planet: false,
				layer: 'allegory',
				pair_key: 'step_1_work',
				caption_pl: 'Spokojny jeż zbierający zapasy',
				moral_quote_pl: 'Prawdziwa siła narodu bierze się z płodności lemiesza.'
			},
			operator
		);

		// Create satellite step 1 - realism
		const sat1RealId = createPoster(
			{
				title: 'Praca Organiczna (Krok 1 - Realia)',
				artist_or_author: 'Przymierze Lemiesza Studio',
				image_path: '/images/test_hedgehog_realism_1.jpg',
				theme: 'agrarian_ethos',
				series_slug: 'test-hedgehog',
				series_order: 1,
				is_planet: false,
				layer: 'realism',
				pair_key: 'step_1_work',
				caption_pl: 'Płodność lemiesza w fabrykach i na roli',
				moral_quote_pl: 'Prawdziwa siła narodu bierze się z płodności lemiesza.'
			},
			operator
		);

		const series = getSeries('test-hedgehog', true);
		expect(series.series_slug).toBe('test-hedgehog');
		expect(series.planet?.id).toBe(planetId);
		expect(series.satellites).toHaveLength(2);
		expect(series.pairs).toHaveLength(1);
		expect(series.pairs[0].pair_key).toBe('step_1_work');
		expect(series.pairs[0].allegory?.id).toBe(sat1Id);
		expect(series.pairs[0].realism?.id).toBe(sat1RealId);
		expect(series.pairs[0].moral_quote_pl).toContain('płodności lemiesza');

		const summaries = listSeriesSummary();
		const s = summaries.find((x) => x.series_slug === 'test-hedgehog');
		expect(s).toBeDefined();
		expect(s?.planet?.id).toBe(planetId);
		expect(s?.count).toBe(2);

		// Clean up test posters
		deletePoster(planetId);
		deletePoster(sat1Id);
		deletePoster(sat1RealId);
	});

	it('rejects invalid layers in validation', () => {
		const errors = validatePoster({
			title: 'Test',
			artist_or_author: 'Author',
			image_path: '/images/valid.png',
			// @ts-expect-error invalid layer
			layer: 'unknown_layer'
		});
		expect(errors.some((e) => e.includes('Layer must be one of'))).toBe(true);
	});
});
