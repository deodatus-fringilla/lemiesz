import { db } from '$lib/server/db';
import { system } from '$lib/server/review';
import { createPoster, linkPosterToArgument, type PosterInput } from '$lib/server/posters';

interface SeriesPosterSeedDef extends PosterInput {
	linkPrinciples?: string[];
}

export const HEDGEHOG_SERIES_SEEDS: SeriesPosterSeedDef[] = [
	// 0. Planeta / Hero I: Doktryna Jeża
	{
		title: 'Doktryna Jeża — Oaza Pokoju i Niestrawność Terytorialna',
		artist_or_author: 'Przymierze Lemiesza Studio (malarstwo olejne, styl Józefa Chełmońskiego)',
		image_path: '/images/doktryna-jeza/hedgehog_planet_hero.jpg',
		theme: 'sovereignty_peace',
		series_slug: 'doktryna-jeza',
		series_order: 0,
		is_planet: true,
		layer: 'standalone',
		pair_key: null,
		caption_pl: 'Doktryna Jeża (Canon 04): Odstraszanie asymetryczne, zbrojna neutralność i suwerenność Rzeczypospolitej.',
		caption_en: 'The Hedgehog Doctrine (Canon 04): Asymmetric deterrence, armed neutrality, and Polish sovereignty.',
		symbolism_notes: 'Nadrzędny obraz-planeta: najeżony jeż pod prastarym dębem w polskim lesie; z lewej (Zachód) czyha wilk, z prawej (Wschód) w gęstwinie czai się niedźwiedź. Styl polskiego realizmu XIX w.',
		moral_quote_pl: 'Nie jesteśmy drapieżnikiem, by napadać innych; jesteśmy jeżem, którego nikt nie zdoła połknąć.',
		moral_quote_en: 'We are not a predator to attack others; we are a hedgehog that no one can swallow.',
		ai_assisted: true,
		production_credits: 'Koncept: Bogdan Zięba (Przymierze Lemiesza); obraz olejny w stylu polskiego realizmu XIX w. (Józef Chełmoński) wspomagany AI (static/images/doktryna-jeza/hedgehog_planet_hero.jpg).',
		linkPrinciples: [
			'Doktryna Jeża i Teoria Gier: Neutralność Zbrojna to asymetryczny koszt inwazji przewyższający zysk agresora',
			'Distinguo Tomistyczne: Oaza Pokoju (Zbrojna Neutralność Terytorialna) to nie Oaza Bezbronności'
		]
	},

	// 0b. Planeta / Hero II: Geopolityczne Imadło
	{
		title: 'Geopolityczne Imadło — Z Kleszczy Imperializmów w Suwerenny Pomost',
		artist_or_author: 'Przymierze Lemiesza Studio (malarstwo olejne, styl Józefa Chełmońskiego & Jacka Malczewskiego)',
		image_path: '/images/imadlo_geopolityczne_hero.jpg',
		theme: 'history_warning',
		series_slug: 'doktryna-jeza',
		series_order: 0,
		is_planet: true,
		layer: 'standalone',
		pair_key: null,
		caption_pl: 'Polska w geopolitycznym imadle: dwie imperialne szczęki zaciskające się ze Wschodu i Zachodu nie zdołają zmiażdżyć hartowanego lemiesza suwerennej pracy narodowej.',
		caption_en: 'Poland in the geopolitical vice: two imperial jaws tightening from East and West cannot crush the tempered plowshare of sovereign national labor.',
		symbolism_notes: 'Metafora Imadła i Kleszczy (Canon 01 §2 Filar IV; Canon 04): Odrzucenie Rapallo i wojny zastępczej poprzez Podwójny Dystans i niezłomny opór lemiesza.',
		moral_quote_pl: 'Równy dystans strategiczny zapobiega zmiażdżeniu w obcym imadle i przekształca kleszcze w niezbędny dla świata pomost.',
		moral_quote_en: 'Equal strategic distance prevents being crushed in a foreign vice and turns geopolitical pincers into an indispensable bridge.',
		ai_assisted: true,
		production_credits: 'Koncept: Bogdan Zięba (Przymierze Lemiesza); obraz olejny w stylu polskiego realizmu XIX w. (Józef Chełmoński) wspomagany AI (static/images/imadlo_geopolityczne_hero.jpg).',
		linkPrinciples: [
			'Suwerenność Pokoju ponad Suwerennością Garnizonu (Wzór, nie Kopia)',
			'Doktryna Jeża i Teoria Gier: Neutralność Zbrojna to asymetryczny koszt inwazji przewyższający zysk agresora',
			'Distinguo Tomistyczne: Oaza Pokoju (Zbrojna Neutralność Terytorialna) to nie Oaza Bezbronności'
		]
	},

	// Krok 1: Tożsamość i Praca Organiczna
	{
		title: 'Jeż Gospodarz pod Dębem (Krok 1: Alegoria)',
		artist_or_author: 'Przymierze Lemiesza Studio',
		image_path: '/images/doktryna-jeza/hedgehog_allegory_01.svg',
		theme: 'agrarian_ethos',
		series_slug: 'doktryna-jeza',
		series_order: 1,
		is_planet: false,
		layer: 'allegory',
		pair_key: 'step_1_work',
		caption_pl: 'Jeż gospodarz dbający o swoje gniazdo i gromadzący zapasy przed zimą pod korzeniami dębu.',
		caption_en: 'The hedgehog steward tending to its nest and gathering supplies beneath the roots of the oak.',
		symbolism_notes: 'Alegoria pracy organicznej: dbałość o własne obejście zamiast szukania zwady z obcymi bestiami.',
		moral_quote_pl: 'Zanim zaczniesz machać szabelką, upewnij się, że masz co do garnka włożyć i czym dom ogrzać.',
		moral_quote_en: 'Before you draw your saber, ensure you have food in your pot and warmth in your home.',
		ai_assisted: true,
		production_credits: 'Przymierze Lemiesza Studio · SVG Design Canon 04',
		linkPrinciples: ['Płodność Lemiesza ponad Jałowością Miecza (Eisenhower 1953 / 1 Sm 8)']
	},
	{
		title: 'Praca Organiczna i Płodność Lemiesza (Krok 1: Realia)',
		artist_or_author: 'Przymierze Lemiesza Studio',
		image_path: '/images/doktryna-jeza/hedgehog_realism_01.svg',
		theme: 'agrarian_ethos',
		series_slug: 'doktryna-jeza',
		series_order: 1,
		is_planet: false,
		layer: 'realism',
		pair_key: 'step_1_work',
		caption_pl: 'Polskie fabryki, rolnictwo i technologia: bogactwo rodzi się z suwerennej pracy, nie z długu zbrojeniowego.',
		caption_en: 'Polish industry, agriculture, and innovation: wealth arises from sovereign labor, not debt-financed arms.',
		symbolism_notes: 'Realistyczne przełożenie: lemiesz i spichlerze tworzą realną potęgę cywilizacyjną.',
		moral_quote_pl: 'Płodny lemiesz tworzy bogactwo narodu; bezpłodny miecz trawi jego zasoby.',
		moral_quote_en: 'The fertile plowshare creates national wealth; the sterile sword consumes its resources.',
		ai_assisted: true,
		production_credits: 'Przymierze Lemiesza Studio · SVG Design Canon 04',
		linkPrinciples: ['Płodność Lemiesza ponad Jałowością Miecza (Eisenhower 1953 / 1 Sm 8)']
	},

	// Krok 2: Rozpoznanie Zagrożeń (Dwa Drapieżniki / Kleszcze)
	{
		title: 'Pinceta Dwóch Drapieżników (Krok 2: Alegoria)',
		artist_or_author: 'Przymierze Lemiesza Studio',
		image_path: '/images/doktryna-jeza/hedgehog_allegory_02.svg',
		theme: 'sovereignty_peace',
		series_slug: 'doktryna-jeza',
		series_order: 2,
		is_planet: false,
		layer: 'allegory',
		pair_key: 'step_2_pincers',
		caption_pl: 'Jeż w puszczy między Niedźwiedziem ze Wschodu a Wilkiem w uprzęży z Zachodu.',
		caption_en: 'The hedgehog in the forest between the Bear from the East and the harnessed Wolf from the West.',
		symbolism_notes: 'Zasada podwójnego dystansu: żaden drapieżnik nie jest obrońcą jeża.',
		moral_quote_pl: 'Gdy dwa wilki dzielą las, naiwny jeż nie wstępuje do żadnej watahy, bo dla obu jest tylko mięsem.',
		moral_quote_en: 'When two predators divide the forest, the wise hedgehog joins neither pack, for to both he is only prey.',
		ai_assisted: true,
		production_credits: 'Przymierze Lemiesza Studio · SVG Design Canon 04',
		linkPrinciples: ['Doktryna Jeża i Teoria Gier: Neutralność Zbrojna to asymetryczny koszt inwazji przewyższający zysk agresora']
	},
	{
		title: 'Kleszcze Imperializmów i Podwójny Dystans (Krok 2: Realia)',
		artist_or_author: 'Przymierze Lemiesza Studio',
		image_path: '/images/doktryna-jeza/hedgehog_realism_02.svg',
		theme: 'sovereignty_peace',
		series_slug: 'doktryna-jeza',
		series_order: 2,
		is_planet: false,
		layer: 'realism',
		pair_key: 'step_2_pincers',
		caption_pl: 'Geopolityczne kleszcze: odrzucenie roli frontowego zderzaka na rzecz suwerennego podwójnego dystansu.',
		caption_en: 'Geopolitical pincers: refusing the role of a forward buffer in favor of sovereign double distance.',
		symbolism_notes: 'Realia geopolityki: unikanie porozumień ponad naszymi głowami poprzez status neutralnego pomostu.',
		moral_quote_pl: 'Równy dystans strategiczny zapobiega nowym rozbiorom i cudzym dyktatom.',
		moral_quote_en: 'Equal strategic distance prevents partition and foreign subjugation.',
		ai_assisted: true,
		production_credits: 'Przymierze Lemiesza Studio · SVG Design Canon 04',
		linkPrinciples: ['Suwerenność Pokoju ponad Suwerennością Garnizonu (Wzór, nie Kopia)']
	},

	// Krok 3: Bariera Bólu (Kolce / Nasycenie Terenu)
	{
		title: 'Bariera Bólu i Niestrawność Kolców (Krok 3: Alegoria)',
		artist_or_author: 'Przymierze Lemiesza Studio',
		image_path: '/images/doktryna-jeza/hedgehog_allegory_03.svg',
		theme: 'history_warning',
		series_slug: 'doktryna-jeza',
		series_order: 3,
		is_planet: false,
		layer: 'allegory',
		pair_key: 'step_3_defense',
		caption_pl: 'Zwinięcie w kulę: stalowe kolce ranią łapy drapieżnika. Koszt ataku przekracza zysk.',
		caption_en: 'Coiling into a ball: steel spines injure the predator’s paws. The cost of attack exceeds the gain.',
		symbolism_notes: 'Niestrawność: drapieżnik odskakuje w bólu, wiedząc że zjedzenie jeża to pewna śmierć.',
		moral_quote_pl: 'Nie musisz pokonać imperium w polu – musisz sprawić, by dotknięcie twojej ziemi bolało je bardziej niż zysk.',
		moral_quote_en: 'You do not need to defeat an empire in open field; you only must ensure touching your soil inflicts unbearable pain.',
		ai_assisted: true,
		production_credits: 'Przymierze Lemiesza Studio · SVG Design Canon 04',
		linkPrinciples: ['Doktryna Jeża i Teoria Gier: Neutralność Zbrojna to asymetryczny koszt inwazji przewyższający zysk agresora']
	},
	{
		title: 'Asymetryczne Nasycenie Terenu i Obrona Cywilna (Krok 3: Realia)',
		artist_or_author: 'Przymierze Lemiesza Studio',
		image_path: '/images/doktryna-jeza/hedgehog_realism_03.svg',
		theme: 'history_warning',
		series_slug: 'doktryna-jeza',
		series_order: 3,
		is_planet: false,
		layer: 'realism',
		pair_key: 'step_3_defense',
		caption_pl: 'Tanie drony rozpoznawczo-uderzeniowe, miny inżynieryjne i schrony dla 100% ludności cywilnej.',
		caption_en: 'Low-cost reconnaissance and strike drones, defensive saturation, and shelters for 100% of the civilian population.',
		symbolism_notes: 'Asymetria kosztów: nowoczesna obrona terytorialna uniemożliwia okupację.',
		moral_quote_pl: 'Nie potrzebujemy Sparty – koszt agresji na Polskę musi być dla każdego militarnym samobójstwem.',
		moral_quote_en: 'We do not need Sparta; the cost of attacking Poland must be military suicide for any aggressor.',
		ai_assisted: true,
		production_credits: 'Przymierze Lemiesza Studio · SVG Design Canon 04',
		linkPrinciples: ['Distinguo Tomistyczne: Oaza Pokoju (Zbrojna Neutralność Terytorialna) to nie Oaza Bezbronności']
	},

	// Krok 4: Oaza i Szlak Tranzytowy
	{
		title: 'Spokojny Dukt i Oaza Pokoju (Krok 4: Alegoria)',
		artist_or_author: 'Przymierze Lemiesza Studio',
		image_path: '/images/doktryna-jeza/hedgehog_allegory_04.svg',
		theme: 'sovereignty_peace',
		series_slug: 'doktryna-jeza',
		series_order: 4,
		is_planet: false,
		layer: 'allegory',
		pair_key: 'step_4_peace',
		caption_pl: 'Drapieżniki omijają polanę jeża szerokim łukiem; jeż bezpiecznie wyprowadza młode.',
		caption_en: 'Predators bypass the hedgehog glade at a wide distance; the hedgehog safely leads its young.',
		symbolism_notes: 'Triumf mądrości natury: zachowanie życia i przyszłości kolejnych pokoleń.',
		moral_quote_pl: 'Najwyższą sztuką wojny jest zachowanie pokoju dzięki sile własnych kolców i mądrości rozumu.',
		moral_quote_en: 'The supreme art of war is preserving peace through the strength of your own quills and wisdom.',
		ai_assisted: true,
		production_credits: 'Przymierze Lemiesza Studio · SVG Design Canon 04',
		linkPrinciples: ['Suwerenność Pokoju ponad Suwerennością Garnizonu (Wzór, nie Kopia)']
	},
	{
		title: 'Zbrojna Neutralność i Most Tranzytowy (Krok 4: Realia)',
		artist_or_author: 'Przymierze Lemiesza Studio',
		image_path: '/images/doktryna-jeza/hedgehog_realism_04.svg',
		theme: 'sovereignty_peace',
		series_slug: 'doktryna-jeza',
		series_order: 4,
		is_planet: false,
		layer: 'realism',
		pair_key: 'step_4_peace',
		caption_pl: 'Polska jako nietykalna Oaza Pokoju na wzór Austrii 1955 i Szwajcarii, most handlowy Wschód-Zachód.',
		caption_en: 'Poland as an inviolable Oasis of Peace modelled after Austria 1955 and Switzerland, a thriving trade bridge.',
		symbolism_notes: 'Geopolityczny zysk: suwerenny hub handlowy w sercu Europy.',
		moral_quote_pl: 'Neutralność przekształca geopolityczne kleszcze w niezbędny dla świata pomost.',
		moral_quote_en: 'Armed neutrality turns geopolitical pincers into an indispensable continental bridge.',
		ai_assisted: true,
		production_credits: 'Przymierze Lemiesza Studio · SVG Design Canon 04',
		linkPrinciples: ['Suwerenność Pokoju ponad Suwerennością Garnizonu (Wzór, nie Kopia)']
	}
];

export function seedPosterSeries(): { postersAdded: number } {
	const actor = system('seed:series-corpus');
	let postersAdded = 0;

	// Upgrade existing SVG planet hero to the authentic Polish realism oil painting
	db.prepare(
		`UPDATE campaign_posters
		 SET image_path = '/images/doktryna-jeza/hedgehog_planet_hero.jpg',
		     artist_or_author = 'Przymierze Lemiesza Studio (malarstwo olejne, styl Józefa Chełmońskiego)',
		     production_credits = 'Koncept: Bogdan Zięba (Przymierze Lemiesza); obraz olejny w stylu polskiego realizmu XIX w. (Józef Chełmoński) wspomagany AI (static/images/doktryna-jeza/hedgehog_planet_hero.jpg).'
		 WHERE image_path = '/images/doktryna-jeza/hedgehog_planet_hero.svg'`
	).run();

	for (const p of HEDGEHOG_SERIES_SEEDS) {
		const existing = db.prepare('SELECT id FROM campaign_posters WHERE image_path = ?').get(p.image_path) as { id: number } | undefined;
		let posterId = existing?.id;
		if (!posterId) {
			posterId = createPoster(p, actor);
			postersAdded++;
		}
		if (p.linkPrinciples) {
			for (const principle of p.linkPrinciples) {
				const arg = db.prepare('SELECT id FROM arguments WHERE core_principle = ?').get(principle) as { id: number } | undefined;
				if (arg) linkPosterToArgument(arg.id, posterId, actor);
			}
		}
	}

	return { postersAdded };
}
