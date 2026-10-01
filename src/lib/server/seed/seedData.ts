import type { IngestionChecklistItem } from './checklist';

/**
 * Seed corpus. Every row is created as `draft`: a human must read it and approve it in the
 * repository before it is used for anything (plan §7.4, §9).
 *
 * Rows marked VERBATIM were extracted programmatically from the URL given and copied unchanged
 * (footnote markers removed). Rows marked PLACEHOLDER are AI-written scaffolding and are NOT
 * movement or source text; they exist only so the app has something to show and must be replaced.
 *
 * No Polish official translations are seeded: the Holy See site does not publish them for these
 * documents, and the reproduction terms of opoka.org.pl / other publishers are not yet checked.
 * The repository's translation-coverage view shows this gap as an editorial to-do.
 */
const HOLY_SEE_TERMS =
	'Holy See (vatican.va) content: reproduction with attribution; confirm current terms of use before republishing';
const HAGUE_TERMS =
	'Public domain (1907 treaty; contemporaneous official English text, release verified by age of publication; transcription from the Yale Avalon Project)';

const verbatim = 'seed:verbatim-from-url';

export const SEED_SOURCES: IngestionChecklistItem[] = [
	// ---- VERBATIM ------------------------------------------------------------
	{
		work: 'Pacem in Terris (John XXIII, 1963)',
		section_ref: '§112',
		category: 'magisterium',
		url: 'https://www.vatican.va/content/john-xxiii/en/encyclicals/documents/hf_j-xxiii_enc_11041963_pacem.html',
		license: HOLY_SEE_TERMS,
		original_locale: 'la',
		cleared_to_store: true,
		reviewer: verbatim,
		locale: 'en',
		origin: 'official_translation',
		keywords: 'disarmament, arms race, nuclear weapons, mutual control, justice, peace',
		text: "Hence justice, right reason, and the recognition of man's dignity cry out insistently for a cessation to the arms race. The stock-piles of armaments which have been built up in various countries must be reduced all round and simultaneously by the parties concerned. Nuclear weapons must be banned. A general agreement must be reached on a suitable disarmament program, with an effective system of mutual control. In the words of Pope Pius XII: \"The calamity of a world war, with the economic and social ruin and the moral excesses and dissolution that accompany it, must not on any account be permitted to engulf the human race for a third time.\""
	},
	{
		work: 'Pacem in Terris (John XXIII, 1963)',
		section_ref: '§127',
		category: 'magisterium',
		url: 'https://www.vatican.va/content/john-xxiii/en/encyclicals/documents/hf_j-xxiii_enc_11041963_pacem.html',
		license: HOLY_SEE_TERMS,
		original_locale: 'la',
		cleared_to_store: true,
		reviewer: verbatim,
		locale: 'en',
		origin: 'official_translation',
		keywords: 'war, justice, atomic power, negotiation, deterrence, fear',
		text: 'We acknowledge that this conviction owes its origin chiefly to the terrifying destructive force of modern weapons. It arises from fear of the ghastly and catastrophic consequences of their use. Thus, in this age which boasts of its atomic power, it no longer makes sense to maintain that war is a fit instrument with which to repair the violation of justice.'
	},
	{
		work: 'Gaudium et Spes (Vatican II, 1965)',
		section_ref: '§78',
		category: 'magisterium',
		url: 'https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651207_gaudium-et-spes_en.html',
		license: HOLY_SEE_TERMS,
		original_locale: 'la',
		cleared_to_store: true,
		reviewer: verbatim,
		locale: 'en',
		origin: 'official_translation',
		keywords: 'peace, justice, balance of power, common good, dictatorship',
		text: 'Peace is not merely the absence of war; nor can it be reduced solely to the maintenance of a balance of power between enemies; nor is it brought about by dictatorship. Instead, it is rightly and appropriately called an enterprise of justice. Peace results from that order structured into human society by its divine Founder, and actualized by men as they thirst after ever greater justice. The common good of humanity finds its ultimate meaning in the eternal law. But since the concrete demands of this common good are constantly changing as time goes on, peace is never attained once and for all, but must be built up ceaselessly. Moreover, since the human will is unsteady and wounded by sin, the achievement of peace requires a constant mastering of passions and the vigilance of lawful authority.'
	},
	{
		work: 'Gaudium et Spes (Vatican II, 1965)',
		section_ref: '§79 (para. 4)',
		category: 'magisterium',
		url: 'https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651207_gaudium-et-spes_en.html',
		license: HOLY_SEE_TERMS,
		original_locale: 'la',
		cleared_to_store: true,
		reviewer: verbatim,
		locale: 'en',
		origin: 'official_translation',
		keywords: 'legitimate defense, just defense, war, subjugation, sovereignty',
		text: 'Certainly, war has not been rooted out of human affairs. As long as the danger of war remains and there is no competent and sufficiently powerful authority at the international level, governments cannot be denied the right to legitimate defense once every means of peaceful settlement has been exhausted. State authorities and others who share public responsibility have the duty to conduct such grave matters soberly and to protect the welfare of the people entrusted to their care. But it is one thing to undertake military action for the just defense of the people, and something else again to seek the subjugation of other nations. Nor, by the same token, does the mere fact that war has unhappily begun mean that all is fair between the warring parties.'
	},
	{
		work: 'Hague Convention (V) respecting the Rights and Duties of Neutral Powers (1907)',
		section_ref: 'Art. 1',
		category: 'geopolitics',
		url: 'https://avalon.law.yale.edu/20th_century/hague05.asp',
		license: HAGUE_TERMS,
		original_locale: 'fr',
		cleared_to_store: true,
		reviewer: verbatim,
		locale: 'en',
		origin: 'official_translation',
		keywords: 'neutrality, neutral powers, inviolable territory, Hague',
		text: 'The territory of neutral Powers is inviolable.'
	},
	{
		work: 'Hague Convention (V) respecting the Rights and Duties of Neutral Powers (1907)',
		section_ref: 'Art. 2',
		category: 'geopolitics',
		url: 'https://avalon.law.yale.edu/20th_century/hague05.asp',
		license: HAGUE_TERMS,
		original_locale: 'fr',
		cleared_to_store: true,
		reviewer: verbatim,
		locale: 'en',
		origin: 'official_translation',
		keywords: 'neutrality, belligerents, troops, convoys, transit',
		text: 'Belligerents are forbidden to move troops or convoys of either munitions of war or supplies across the territory of a neutral Power.'
	},
	{
		work: 'Hague Convention (V) respecting the Rights and Duties of Neutral Powers (1907)',
		section_ref: 'Art. 5',
		category: 'geopolitics',
		url: 'https://avalon.law.yale.edu/20th_century/hague05.asp',
		license: HAGUE_TERMS,
		original_locale: 'fr',
		cleared_to_store: true,
		reviewer: verbatim,
		locale: 'en',
		origin: 'official_translation',
		keywords: 'neutrality, duties of neutral powers, territory',
		text: 'A neutral Power must not allow any of the acts referred to in Articles 2 to 4 to occur on its territory.'
	},

	// ---- PLACEHOLDERS (AI-written scaffolding; replace with the movement's own text) ------------
	{
		work: 'Manifest Paktu Lemiesza [PLACEHOLDER]',
		section_ref: 'Rozdział I',
		category: 'movement',
		license:
			'PLACEHOLDER written by an AI assistant. NOT movement text. Replace with the movement-authored original.',
		original_locale: 'pl',
		cleared_to_store: true,
		reviewer: 'seed:placeholder',
		locale: 'pl',
		origin: 'ai_drafted',
		keywords: 'lemiesz, suwerenność, pokój, obrona terytorialna',
		text: '[PLACEHOLDER — robocza treść AI, do zastąpienia tekstem ruchu] Bezpieczeństwo Rzeczypospolitej opiera się na dobrobycie obywateli, solidarności społecznej i odrzuceniu awanturnictwa geopolitycznego. Przekucie mieczy na lemiesze oznacza priorytet obrony terytorialnej i zdolności wytwórczych nad ekspedycyjnym uwikłaniem w cudze wojny.'
	},
	{
		work: 'Strategia Podwójnego Dystansu [PLACEHOLDER]',
		section_ref: '§3',
		category: 'geopolitics',
		license:
			'PLACEHOLDER written by an AI assistant. NOT movement text. Replace with the movement-authored original.',
		original_locale: 'pl',
		cleared_to_store: true,
		reviewer: 'seed:placeholder',
		locale: 'pl',
		origin: 'ai_drafted',
		keywords: 'podwójny dystans, neutralność czynna, bloki, niezależność',
		text: '[PLACEHOLDER — robocza treść AI, do zastąpienia tekstem ruchu] Strategia Podwójnego Dystansu zakłada równy, strategiczny dystans wobec rywalizujących bloków oraz zdolność do handlu i dyplomacji ze wszystkimi stronami przy zachowaniu nienaruszalności własnych granic.'
	},
	{
		work: 'Frédéric Bastiat — La Loi [PLACEHOLDER PARAPHRASE]',
		section_ref: 'Część I',
		category: 'economics',
		license:
			'Original (French, 1850) is in the public domain; modern Polish editions are copyrighted and are NOT stored. This row is a working AI paraphrase, not Bastiat text.',
		original_locale: 'fr',
		cleared_to_store: false,
		reviewer: 'seed:placeholder',
		locale: 'pl',
		origin: 'ai_drafted',
		keywords: 'bastiat, prawo, legalna grabież, własność, wolność',
		text: '[PARAFRAZA ROBOCZA AI — do zastąpienia parafrazą autorstwa ruchu] Prawo jest zorganizowanym prawem jednostki do obrony; gdy staje się narzędziem legalnej grabieży, traci swój moralny autorytet.'
	}
];
