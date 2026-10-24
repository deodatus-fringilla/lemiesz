import { describe, expect, it } from 'vitest';
import { classifyMethodology } from './correspondence';
import { runChecks } from './content/checks';

describe('Korona Epistolary Corpus & Classical Methodologies', () => {

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
