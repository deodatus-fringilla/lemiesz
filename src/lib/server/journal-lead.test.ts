import { describe, expect, it } from 'vitest';
import { leadParts } from './journal-lead';

describe('leadParts', () => {
	it('renders the lead as safe HTML and gives one line of plain text', () => {
		const { html, plain } = leadParts('Pierwszy akapit z **pogrubieniem** i [linkiem](https://example.org).\n\nDrugi akapit.');
		expect(html).toContain('<strong>pogrubieniem</strong>');
		expect(html).toContain('<a href="https://example.org"');
		expect(html.match(/<p>/g)).toHaveLength(2);
		expect(plain).toBe('Pierwszy akapit z pogrubieniem i linkiem. Drugi akapit.');
	});

	it('never lets raw HTML or an unsafe link through, and decodes the text of the plain version once', () => {
		const { html, plain } = leadParts('<script>alert(1)</script>\n\n[x](javascript:evil) Tom & Jerry <b>');
		expect(html).not.toMatch(/<script/i);
		expect(html).not.toMatch(/href="javascript/i);
		expect(plain).toBe('<script>alert(1)</script> x Tom & Jerry <b>'); // shown as text, not markup
	});

	it('handles lists, an old plain-text lead and an empty one', () => {
		expect(leadParts('- jeden\n- dwa').plain).toBe('jeden dwa');
		expect(leadParts('Zwykły tekst bez znaczników.').plain).toBe('Zwykły tekst bez znaczników.');
		expect(leadParts('   ')).toEqual({ html: '', plain: '' });
	});
});
