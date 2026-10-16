import fs from 'node:fs';
import path from 'node:path';
import { db } from '$lib/server/db';
import { validateIngestionChecklist, type IngestionChecklistItem } from './checklist';
import { createSource, upsertSourceText } from '$lib/server/sources';
import { createArgument, upsertArgumentText } from '$lib/server/arguments';
import { createPoster, linkPosterToArgument } from '$lib/server/posters';
import { extractClaimsFromLetter } from '$lib/server/correspondence';
import { system } from '$lib/server/review';

const PUBLIC_DOMAIN_SCRIPTURE =
	'Public domain: classical biblical text (Biblia Gdańska / World English Bible, release verified by age of publication and explicit public domain dedication)';
const PUBLIC_DOMAIN_SPEECH =
	'Public domain: U.S. Presidential speech by Dwight D. Eisenhower (April 16, 1953), release verified via National Archives';
const PUBLIC_DOMAIN_LAW =
	'Public domain: official constitutional / statutory legal text (release verified as exempt official state enactment)';
const MOVEMENT_LICENSE =
	'Original doctrinal text of Przymierze Lemiesza (Ruch Suwerennego Pokoju), cleared for storage and publication';

interface BilingualSeedSource {
	item: IngestionChecklistItem;
	enText: string;
	enKeywords: string;
}

const KORONA_SOURCES: BilingualSeedSource[] = [
	{
		item: {
			work: 'Ewangelia wg św. Łukasza — Rachunek Królewski (Luke 14)',
			section_ref: 'Łk 14, 31–32',
			category: 'magisterium',
			url: 'https://www.vatican.va/archive/bible/nova_vulgata/documents/nova-vulgata_nt_evang-lucam_lt.html#14',
			license: PUBLIC_DOMAIN_SCRIPTURE,
			original_locale: 'la',
			cleared_to_store: true,
			reviewer: 'seed:korona-corpus',
			locale: 'pl',
			origin: 'official_translation',
			keywords: 'rachunek królewski, Łk 14, król, dziesięć tysięcy, dwadzieścia tysięcy, poselstwo, warunki pokoju, roztropność',
			text: 'Albo który król, mając wyruszyć, aby stoczyć bitwę z drugim królem, nie usiądzie wpierw i nie rozważy, czy w dziesięć tysięcy może stawić czoło temu, który z dwudziestoma tysiącami nadciąga przeciw niemu? Jeśli nie, wyprawia poselstwo, gdy tamten jest jeszcze daleko, i prosi o warunki pokoju.'
		},
		enKeywords: 'royal reckoning, Luke 14, king, ten thousand, twenty thousand, delegation, terms of peace, prudence',
		enText:
			'Or what king, going to encounter another king in war, will not sit down first and deliberate whether he is able with ten thousand to meet him who comes against him with twenty thousand? And if not, while the other is yet a great way off, he sends a delegation and asks for terms of peace.'
	},
	{
		item: {
			work: 'Ewangelia wg św. Jana — Dobry Pasterz a Najemnik (John 10)',
			section_ref: 'J 10, 11–13',
			category: 'magisterium',
			url: 'https://www.vatican.va/archive/bible/nova_vulgata/documents/nova-vulgata_nt_evang-ioannem_lt.html#10',
			license: PUBLIC_DOMAIN_SCRIPTURE,
			original_locale: 'la',
			cleared_to_store: true,
			reviewer: 'seed:korona-corpus',
			locale: 'pl',
			origin: 'official_translation',
			keywords: 'dobry pasterz, najemnik, wilk, owce, ucieczka, Kuty 1939, odpowiedzialność elit, asymetria ryzyka',
			text: 'Ja jestem dobrym pasterzem. Dobry pasterz daje życie swoje za owce. Najemnik zaś i ten, kto nie jest pasterzem, którego owce nie są własnością, widząc nadchodzącego wilka, opuszcza owce i ucieka, a wilk je porywa i rozprasza; najemnik ucieka dlatego, że jest najemnikiem i nie zależy mu na owcach.'
		},
		enKeywords: 'good shepherd, hireling, wolf, sheep, flight, Kuty bridge 1939, elite accountability, risk asymmetry',
		enText:
			'I am the good shepherd. The good shepherd lays down his life for the sheep. He who is a hired hand and not a shepherd, who does not own the sheep, sees the wolf coming and leaves the sheep and flees, and the wolf snatches them and scatters them. He flees because he is a hired hand and cares nothing for the sheep.'
	},
	{
		item: {
			work: 'Księga Izajasza i Kazanie na Górze — Lemiesze i Pokój (Isaiah 2 / Matthew 5)',
			section_ref: 'Iz 2, 4; Mt 5, 9',
			category: 'magisterium',
			url: 'https://www.vatican.va/archive/bible/nova_vulgata/documents/nova-vulgata_vt_isaiae_lt.html#2',
			license: PUBLIC_DOMAIN_SCRIPTURE,
			original_locale: 'la',
			cleared_to_store: true,
			reviewer: 'seed:korona-corpus',
			locale: 'pl',
			origin: 'official_translation',
			keywords: 'miecze na lemiesze, włócznie na sierpy, błogosławieni pokój czyniący, synowie Boży, Izajasz, Mateusz',
			text: 'I przekują miecze swe na lemiesze, a włócznie swe na sierpy; nie podniesie naród przeciw narodowi miecza, ani się więcej nie będą zaprawiać do wojny. (Iz 2, 4) Błogosławieni pokój czyniący, albowiem oni synami Bożymi nazwani będą. (Mt 5, 9)'
		},
		enKeywords: 'swords into plowshares, spears into pruning hooks, blessed are the peacemakers, sons of God, Isaiah, Matthew',
		enText:
			'They shall beat their swords into plowshares, and their spears into pruning hooks; nation shall not lift up sword against nation, neither shall they learn war any more. (Isaiah 2:4) Blessed are the peacemakers, for they shall be called sons of God. (Matthew 5:9)'
	},
	{
		item: {
			work: '1 Księga Samuela — Przestroga przed Państwem Militarnym (1 Samuel 8)',
			section_ref: '1 Sm 8, 11–17',
			category: 'magisterium',
			url: 'https://www.vatican.va/archive/bible/nova_vulgata/documents/nova-vulgata_vt_i-samuelis_lt.html#8',
			license: PUBLIC_DOMAIN_SCRIPTURE,
			original_locale: 'la',
			cleared_to_store: true,
			reviewer: 'seed:korona-corpus',
			locale: 'pl',
			origin: 'official_translation',
			keywords: 'Samuel, prawo króla, rydwany, pobór, dziesięcina, militaryzm, niewola podatkowa',
			text: 'Takie będzie prawo króla, który ma nad wami panować: synów waszych będzie brał i postawi ich przy swoich rydwanach i swoich koniach, aby biegali przed jego rydwanem. Uczyni ich tysiącznikami i pięćdziesiątnikami, każe im orać swoją rolę i żąć swoje żniwo, i wyrabiać broń wojenną oraz sprzęt do swoich rydwanów. Najlepsze wasze pola, winnice i sady oliwkowe zabierze i odda swoim sługom, a z swoich zasiewów i winnic będzie brał dziesięcinę, i wy sami staniecie się jego niewolnikami.'
		},
		enKeywords: 'Samuel, right of the king, chariots, conscription, tithe, militarism, tax servitude',
		enText:
			'These will be the ways of the king who will reign over you: he will take your sons and appoint them to his chariots and to be his horsemen and to run before his chariots. And he will appoint for himself commanders of thousands and commanders of fifties, and some to plow his ground and to reap his harvest, and to make his implements of war and the equipment of his chariots. He will take the best of your fields and vineyards and olive orchards and give them to his servants, and you shall be his slaves.'
	},
	{
		item: {
			work: 'Dwight D. Eisenhower — Chance for Peace (Cross of Iron Speech, 1953)',
			section_ref: '16 IV 1953',
			category: 'economics',
			url: 'https://www.eisenhowerlibrary.gov/research/online-documents/chance-peace',
			license: PUBLIC_DOMAIN_SPEECH,
			original_locale: 'en',
			cleared_to_store: true,
			reviewer: 'seed:korona-corpus',
			locale: 'pl',
			origin: 'human_translation',
			keywords: 'Eisenhower, każda broń to kradzież, krzyż z żelaza, płodność lemiesza, jałowość miecza, wydatki zbrojeniowe, koszt alternatywny',
			text: 'Każda wyprodukowana broń, każdy zwodowany okręt wojenny, każda wystrzelona rakieta oznacza w ostatecznym rachunku kradzież dokonaną na tych, którzy głodują i nie są nakarmieni, którzy marzną i nie są przyodziani. Świat pod bronią nie wydaje jedynie pieniędzy. Wydaje pot swoich robotników, geniusz swoich naukowców i nadzieje swoich dzieci.'
		},
		enKeywords: 'Eisenhower, every gun is a theft, cross of iron, fertility of the plowshare, sterility of the sword, military spending, opportunity cost',
		enText:
			'Every gun that is made, every warship launched, every rocket fired signifies, in the final sense, a theft from those who hunger and are not fed, those who are cold and are not clothed. This world in arms is not spending money alone. It is spending the sweat of its laborers, the genius of its scientists, the hopes of its children.'
	},
	{
		item: {
			work: 'Federalna Ustawa Konstytucyjna o Neutralności Austrii (BVG Neutralität, 1955)',
			section_ref: 'Art. I ust. 1–2',
			category: 'geopolitics',
			url: 'https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10000267',
			license: PUBLIC_DOMAIN_LAW,
			original_locale: 'de',
			cleared_to_store: true,
			reviewer: 'seed:korona-corpus',
			locale: 'pl',
			origin: 'human_translation',
			keywords: 'Austria 1955, wieczysta neutralność, immerwährende Neutralität, obce bazy, sojusze wojskowe, z kleszczy w most',
			text: 'Art. I (1) W celu trwałego utrzymania swojej niezależności na zewnątrz oraz w celu zachowania nienaruszalności swojego terytorium, Austria oświadcza z własnej wolnej woli swoją wieczystą neutralność. Austria będzie ją utrzymywać i bronić jej wszystkimi dostępnymi środkami. (2) W celu zabezpieczenia tych celów Austria w przyszłości nie przystąpi do żadnych sojuszy wojskowych i nie dopuści do tworzenia na swoim terytorium baz wojskowych obcych państw.'
		},
		enKeywords: 'Austria 1955, perpetual neutrality, immerwährende Neutralität, foreign bases, military alliances, from pincer to bridge',
		enText:
			'Article I (1) For the purpose of the permanent maintenance of its external independence and for the purpose of the inviolability of its territory, Austria of its own free will declares herewith its permanent neutrality which it is resolved to maintain and defend with all the means at its disposal. (2) In order to secure these purposes Austria will never in the future accede to any military alliances nor permit the establishment of military bases of foreign States on its territory.'
	},
	{
		item: {
			work: 'Konstytucje Państw Neutralnych — Malta (1987) i Kostaryka (1949)',
			section_ref: 'Malta Art. 1(3); Kostaryka Art. 12',
			category: 'geopolitics',
			url: 'https://legislation.mt/eli/const/eng',
			license: PUBLIC_DOMAIN_LAW,
			original_locale: 'en',
			cleared_to_store: true,
			reviewer: 'seed:korona-corpus',
			locale: 'pl',
			origin: 'human_translation',
			keywords: 'Malta Art. 1 ust. 3, Kostaryka Art. 12, konstytucyjna neutralność, aktywne dążenie do pokoju, obce bazy',
			text: 'Konstytucja Malty, Art. 1 ust. 3: Malta jest państwem neutralnym, aktywnie dążącym do pokoju, bezpieczeństwa i postępu społecznego wśród wszystkich narodów poprzez politykę niezaangażowania i odmowę udziału w jakimkolwiek sojuszu wojskowym. Konstytucja Kostaryki, Art. 12: Znosi się stałą armię jako instytucję państwową; dla czujności i zachowania porządku publicznego tworzy się niezbędne siły policyjne.'
		},
		enKeywords: 'Malta Art. 1(3), Costa Rica Art. 12, constitutional neutrality, active pursuit of peace, non-alignment',
		enText:
			'Constitution of Malta, Article 1(3): Malta is a neutral state actively pursuing peace, security and social progress among all nations by adhering to a policy of non-alignment and refusing to participate in any military alliance. Constitution of Costa Rica, Article 12: The Army as a permanent institution is abolished; for vigilance and the preservation of the public order, there will be the necessary police forces.'
	},
	{
		item: {
			work: 'Doktryna Oazy Pokoju Europy Środkowej i Karta Metodologiczna Przymierza Lemiesza',
			section_ref: 'Kanon I–V',
			category: 'movement',
			license: MOVEMENT_LICENSE,
			original_locale: 'pl',
			cleared_to_store: true,
			reviewer: 'seed:korona-corpus',
			locale: 'pl',
			origin: 'original',
			keywords: 'Przymierze Lemiesza, Oaza Pokoju, suwerenność pokoju, płodność lemiesza, rachunek królewski, dysputa tomistyczna, rycerska polemika, odrzucenie heglizmu, doktryna jeża, obrona asymetryczna',
			text: 'Przymierze Lemiesza głosi Doktrynę „Oazy Pokoju Europy Środkowej” opartą na pięciu filarach: (1) Suwerenność Pokoju zamiast Suwerenności Garnizonu — suwerenność to środek do ochrony życia i własności Polaków, a nie fetysz polityczny; (2) Płodność Lemiesza ponad Jałowością Miecza — fabryka, rola i rodzina pomnażają siłę narodu, podczas gdy zbrojenia na kredyt (bez kodów źródłowych) rodzą dług; (3) Chrześcijański Rachunek Królewski (Łk 14, 31–32) ponad pogańskim Wegecjuszem (Si vis pacem, para bellum); (4) Koniec Asymetrii Ryzyka (J 10, 11–13) i powtórki z mostu w Kutach 1939 r.; (5) Konstytucyjna Zbrojna Neutralność Terytorialna i Doktryna Jeża (wzór Szwajcarii, Austrii 1955 i Malty Art. 1 ust. 3: asymetryczny koszt inwazji przewyższający zysk agresora, nasycenie terenu obroną cywilną i dronami). W debacie odrzucamy dialektykę heglowską (teza–antyteza–synteza) na rzecz Dysputy Tomistycznej i Rycerskiej, Pryncypialnej Polemiki.'
		},
		enKeywords: 'Plowshare Covenant, Oasis of Peace, sovereignty of peace, fertility of the plowshare, royal reckoning, Thomistic disputation, chivalrous polemics, anti-Hegelian, hedgehog doctrine, asymmetric defense',
		enText:
			'The Plowshare Pact proclaims the "Oasis of Peace of Central Europe" Doctrine built on five pillars: (1) Sovereignty of Peace over Garrison Sovereignty — sovereignty is a means to protect Polish life and property, not a political fetish; (2) Fertility of the Plowshare over Sterility of the Sword — factories, farms, and families multiply national strength while credit-bought weaponry (without source codes) breeds debt; (3) Christian Royal Reckoning (Luke 14:31–32) over pagan Vegetius (Si vis pacem, para bellum); (4) Ending Risk Asymmetry (John 10:11–13) and any repeat of the 1939 Kuty bridge flight; (5) Constitutional Armed Territorial Neutrality and the Hedgehog Doctrine (modeled on Switzerland, Austria 1955, and Malta Art. 1(3): asymmetric cost of invasion exceeding aggressor gains, saturating territory with civil defense and drones). In debate we reject Hegelian dialectics (thesis–antithesis–synthesis) in favor of Thomistic Disputation and Chivalrous, Principled Polemics.'
	}
];

const POLISH_TRANSLATIONS_FOR_INITIAL_SEED: { work: string; section_ref: string; text: string; keywords: string }[] = [
	{
		work: 'Pacem in Terris (John XXIII, 1963)',
		section_ref: '§112',
		keywords: 'rozbrojenie, wyścig zbrojeń, broń jądrowa, wzajemna kontrola, sprawiedliwość, pokój',
		text: 'Dlatego sprawiedliwość, prawy rozum i poczucie godności ludzkiej domagają się usilnie zaprzestania wyścigu zbrojeń; trzeba, aby zapasy broni, jakimi rozporządzają poszczególne państwa, zostały równocześnie i proporcjonalnie zmniejszone; aby broń jądrowa została zakazana, a wreszcie, by wszyscy doszli do porozumienia w sprawie odpowiedniego rozbrojenia pod skuteczną wzajemną kontrolą.'
	},
	{
		work: 'Pacem in Terris (John XXIII, 1963)',
		section_ref: '§127',
		keywords: 'wojna, sprawiedliwość, era atomowa, rokowania, odstraszanie',
		text: 'W naszej epoce, która szczyci się potęgą atomową, byłoby rzeczą obcą rozumowi uważać wojnę za odpowiedni środek do przywrócenia naruszonych praw.'
	},
	{
		work: 'Gaudium et Spes (Vatican II, 1965)',
		section_ref: '§78',
		keywords: 'pokój, sprawiedliwość, równowaga sił, dobro wspólne, dyktatura',
		text: 'Pokój nie jest jedynie brakiem wojny i nie daje się sprowadzić wyłącznie do zapewnienia równowagi sił przeciwstawnych, ani też nie rodzi się z despotycznego władztwa, lecz słusznie i właściwie zowie się dziełem sprawiedliwości.'
	},
	{
		work: 'Gaudium et Spes (Vatican II, 1965)',
		section_ref: '§79 (para. 4)',
		keywords: 'uprawniona obrona, sprawiedliwa obrona, wojna, podporządkowanie narodów',
		text: 'Dopóki istnieje niebezpieczeństwo wojny, a równocześnie brakuje międzynarodowej władzy posiadającej niezbędne kompetencje i wyposażonej w odpowiednią siłę, nie można odmawiać rządom prawa do koniecznej obrony, byle wyczerpały wpierw wszystkie środki pokojowych rokowań. Czym innym jest jednak prowadzić działania wojenne dla sprawiedliwej obrony narodów, a czym innym chcieć podporządkować sobie inne narody.'
	},
	{
		work: 'Hague Convention (V) respecting the Rights and Duties of Neutral Powers (1907)',
		section_ref: 'Art. 1',
		keywords: 'neutralność, mocarstwa neutralne, nienaruszalność terytorium, Konwencja Haska',
		text: 'Terytorium mocarstw neutralnych jest nienaruszalne.'
	},
	{
		work: 'Hague Convention (V) respecting the Rights and Duties of Neutral Powers (1907)',
		section_ref: 'Art. 2',
		keywords: 'neutralność, strony wojujące, wojska, konwoje, tranzyt',
		text: 'Stronom wojującym wzbronione jest przeprowadzanie przez terytorium mocarstwa neutralnego wojsk lub konwojów z amunicją bądź zaopatrzeniem wojennym.'
	},
	{
		work: 'Hague Convention (V) respecting the Rights and Duties of Neutral Powers (1907)',
		section_ref: 'Art. 5',
		keywords: 'neutralność, obowiązki mocarstwa neutralnego, terytorium',
		text: 'Mocarstwo neutralne nie może dopuszczać na swoim terytorium do żadnego z czynów określonych w artykułach 2 do 4.'
	}
];

interface BilingualArgumentSeed {
	fallacy_type: string;
	core_principle: string;
	tags: string;
	sourceRefs: { work: string; section_ref: string }[];
	pl: {
		opponent_claim: string;
		counter_punch: string;
		keywords: string;
		span: string;
	};
	en: {
		opponent_claim: string;
		counter_punch: string;
		keywords: string;
		span: string;
	};
}

const KORONA_ARGUMENTS: BilingualArgumentSeed[] = [
	{
		fallacy_type: 'false_dichotomy',
		core_principle: 'Suwerenność Pokoju ponad Suwerennością Garnizonu (Wzór, nie Kopia)',
		tags: 'neutralność, suwerenność, Szwajcaria, Austria 1955, kleszcze geopolityczne, Korona',
		sourceRefs: [
			{ work: 'Federalna Ustawa Konstytucyjna o Neutralności Austrii (BVG Neutralität, 1955)', section_ref: 'Art. I ust. 1–2' },
			{ work: 'Hague Convention (V) respecting the Rights and Duties of Neutral Powers (1907)', section_ref: 'Art. 1' }
		],
		pl: {
			opponent_claim:
				'Szwajcaria to Szwajcaria, a Polska leży między mocarstwami w kleszczach geopolitycznych — nie potrzebujemy Polski neutralnej, potrzebujemy Polski suwerennej.',
			counter_punch:
				'Przeciwstawianie suwerenności i neutralności to fałszywa dychotomia, a zarzut „Polska nie ma Alp” bije w chochoła — Szwajcaria jest dla nas wzorem filozofii państwa, nie mechaniczną kopią geografii. Austria w 1955 r. leżała na nizinie w samym epicentrum zimnej wojny i była okupowana przez cztery mocarstwa, a jednak ustawą konstytucyjną wybrała wieczystą neutralność: „Austria oświadcza z własnej wolnej woli swoją wieczystą neutralność”. Właśnie dlatego, że Polska leży między mocarstwami, jedynym sposobem na wyjęcie jej z geopolitycznych kleszczy jest przekształcenie jej w neutralny most chroniony prawem międzynarodowym („Terytorium mocarstw neutralnych jest nienaruszalne”), zamiast skazywania jej na rolę przedmurza i poligonu.',
			keywords: 'Szwajcaria, suwerenność, neutralność, kleszcze geopolityczne, wzór nie kopia, Austria 1955',
			span: 'Austria oświadcza z własnej wolnej woli swoją wieczystą neutralność'
		},
		en: {
			opponent_claim:
				'Switzerland is Switzerland, while Poland lies between great powers in a geopolitical pincer — we do not need a neutral Poland, we need a sovereign Poland.',
			counter_punch:
				'Pitting sovereignty against neutrality is a false dichotomy, and arguing "Poland has no Alps" attacks a strawman — Switzerland is our model of state philosophy, not a mechanical copy of geography. In 1955 Austria lay in the flatlands at the epicenter of the Cold War under four-power occupation, yet by constitutional law it chose perpetual neutrality: "Austria of its own free will declares herewith its permanent neutrality". Precisely because Poland lies between great powers, the only way to escape the geopolitical pincer is to become a neutral bridge protected by international law ("The territory of neutral Powers is inviolable") rather than a frontline garrison.',
			keywords: 'Switzerland, sovereignty, neutrality, geopolitical pincer, model not copy, Austria 1955',
			span: 'Austria of its own free will declares herewith its permanent neutrality'
		}
	},
	{
		fallacy_type: 'utopian_militarism',
		core_principle: 'Rachunek Królewski (Łk 14, 31–32) oraz realizm demograficzno-gospodarczy',
		tags: 'Polska-Sparta, demografia, gospodarka, kredyt, kody źródłowe, Łk 14, Korona',
		sourceRefs: [
			{ work: 'Ewangelia wg św. Łukasza — Rachunek Królewski (Luke 14)', section_ref: 'Łk 14, 31–32' },
			{ work: 'Dwight D. Eisenhower — Chance for Peace (Cross of Iron Speech, 1953)', section_ref: '16 IV 1953' }
		],
		pl: {
			opponent_claim:
				'Polska musi być jednym z najsilniejszych militarnie państw w Europie, albo będzie zależna od innych i stanie się pionkiem.',
			counter_punch:
				'Wizja „Polski-Sparty” rzucającej militarne wyzwanie mocarstwom przy dzietności 1,16 i gospodarce sześciokrotnie mniejszej od niemieckiej ignoruje Chrześcijański Rachunek Królewski z Ewangelii św. Łukasza: król mający dziesięć tysięcy żołnierzy przeciw dwudziestu tysiącom „wyprawia poselstwo, gdy tamten jest jeszcze daleko, i prosi o warunki pokoju”. Co więcej, armia kupowana na gigantyczny kredyt w USA i Korei Południowej bez kodów źródłowych i łańcuchów dostaw nie daje suwerenności — zamienia Polskę w zadłużonego klienta obcych zbrojeniówek.',
			keywords: 'Polska-Sparta, mocarstwo militarne, demografia, rachunek królewski, Łk 14, kody źródłowe, kredyt',
			span: 'wyprawia poselstwo, gdy tamten jest jeszcze daleko, i prosi o warunki pokoju'
		},
		en: {
			opponent_claim:
				'Poland must be one of the strongest military powers in Europe, or else she will be dependent on others and reduced to a pawn.',
			counter_punch:
				'The vision of a "Poland-Sparta" challenging great powers with a 1.16 fertility rate and an economy six times smaller than Germany’s ignores Christ’s Royal Reckoning in Luke 14: a king with ten thousand facing twenty thousand "sends a delegation and asks for terms of peace". Furthermore, an army bought on massive credit from the US and South Korea without source codes or domestic supply chains does not create sovereignty — it turns Poland into an indebted client of foreign defense contractors.',
			keywords: 'Poland-Sparta, military power, demography, royal reckoning, Luke 14, source codes, credit',
			span: 'sends a delegation and asks for terms of peace'
		}
	},
	{
		fallacy_type: 'pagan_maxim_appeal',
		core_principle: 'Chrystus (Łk 14, 31–32) ponad pogańskim Wegecjuszem (Si vis pacem, para bellum)',
		tags: 'Si vis pacem para bellum, Wegecjusz, Łk 14, Pacem in Terris, wyścig zbrojeń, Korona',
		sourceRefs: [
			{ work: 'Ewangelia wg św. Łukasza — Rachunek Królewski (Luke 14)', section_ref: 'Łk 14, 31–32' },
			{ work: 'Pacem in Terris (John XXIII, 1963)', section_ref: '§112' }
		],
		pl: {
			opponent_claim:
				'Zasada „chcesz pokoju, szykuj się do wojny” (Si vis pacem, para bellum) pozostaje aktualna — pokój utrzymuje się wyłącznie odstraszaniem i zbrojeniami.',
			counter_punch:
				'Maksyma „Si vis pacem, para bellum” nie pochodzi z Ewangelii ani z Magisterium Kościoła, lecz od pogańskiego pisarza rzymskiego Wegecjusza z IV wieku — a Rzym, który jej zaufał, zbankrutował pod ciężarem wydatków wojskowych i upadł, podobnie jak Europa w 1914 roku. Katolicki realizm polityczny stawia wyżej słowa Chrystusa z Łk 14, 31–32 („wyprawia poselstwo, gdy tamten jest jeszcze daleko, i prosi o warunki pokoju”) oraz nauczanie św. Jana XXIII w Pacem in Terris §112: „sprawiedliwość, prawy rozum i poczucie godności ludzkiej domagają się usilnie zaprzestania wyścigu zbrojeń”.',
			keywords: 'Si vis pacem para bellum, Wegecjusz, odstraszanie, wyścig zbrojeń, Pacem in Terris, Łk 14',
			span: 'sprawiedliwość, prawy rozum i poczucie godności ludzkiej domagają się usilnie zaprzestania wyścigu zbrojeń'
		},
		en: {
			opponent_claim:
				'The maxim "if you want peace, prepare for war" (Si vis pacem, para bellum) remains valid — peace is preserved solely by deterrence and rearmament.',
			counter_punch:
				'The maxim "Si vis pacem, para bellum" comes neither from the Gospel nor from the Church’s Magisterium, but from the 4th-century pagan Roman writer Vegetius — and the Rome that trusted it bankrupted itself under military outlays and collapsed, just as Europe did in 1914. Catholic political realism places higher Christ’s words in Luke 14:31–32 ("sends a delegation and asks for terms of peace") and St. John XXIII’s teaching in Pacem in Terris §112: "justice, right reason, and the recognition of man\'s dignity cry out insistently for a cessation to the arms race."',
			keywords: 'Si vis pacem para bellum, Vegetius, deterrence, arms race, Pacem in Terris, Luke 14',
			span: "justice, right reason, and the recognition of man's dignity cry out insistently for a cessation to the arms race"
		}
	},
	{
		fallacy_type: 'historical_amnesia',
		core_principle: 'Lekcja Sanacji 1939 i Koniec Asymetrii Ryzyka (J 10, 11–13)',
		tags: 'Sanacja, 1939, most w Kutach, najemnik, dobry pasterz, traktaty, J 10, Korona',
		sourceRefs: [
			{ work: 'Ewangelia wg św. Jana — Dobry Pasterz a Najemnik (John 10)', section_ref: 'J 10, 11–13' },
			{ work: 'Konstytucje Państw Neutralnych — Malta (1987) i Kostaryka (1949)', section_ref: 'Malta Art. 1(3); Kostaryka Art. 12' }
		],
		pl: {
			opponent_claim:
				'W 1939 roku Polska miała traktaty o nieagresji i gwarancje sojusznicze, a mimo to nie uchroniły nas one przed katastrofą — papierowe deklaracje nic nie znaczą.',
			counter_punch:
				'Katastrofa września 1939 r. była bankructwem właśnie sanacyjnego modelu „mocarstwowości na glinianych nogach”: w latach 30. Sanacja wydawała od 35% do 50% budżetu państwa na wojsko kosztem skrajnej nędzy wsi dzielącej zapałkę na czworo, odrzucając neutralność na rzecz egzotycznych sojuszy zaczepnych. Gdy przyszła próba, ten gigantyczny wysiłek zbrojny załamał się w kilkanaście dni, a autorzy haseł o „nieoddawaniu nawet guzika” już 17 września przekraczali most w Kutach, wypełniając ewangeliczny obraz najemnika: „widząc nadchodzącego wilka, opuszcza owce i ucieka” (J 10, 12). Przymierze Lemiesza proponuje nie papierowe sojusze wojenne, lecz konstytucyjną neutralność (jak Malta Art. 1 ust. 3) połączoną z końcem bezkarności polityków.',
			keywords: '1939, Sanacja, most w Kutach, traktaty, gwarancje, najemnik, J 10, asymetria ryzyka',
			span: 'widząc nadchodzącego wilka, opuszcza owce i ucieka'
		},
		en: {
			opponent_claim:
				'In 1939 Poland had non-aggression pacts and allied guarantees, yet they failed to save us from catastrophe — paper declarations mean nothing.',
			counter_punch:
				'The catastrophe of September 1939 was the bankruptcy of the Sanacja model of "great-power posturing on feet of clay": throughout the 1930s Sanacja spent 35% to 50% of the state budget on the military while rural families split matches in four, rejecting neutrality in favor of entanglement in great-power alliances. When tested, that military edifice collapsed in days, and the authors of "not giving up a single button" crossed the bridge at Kuty on September 17, fulfilling the Gospel image of the hireling who "sees the wolf coming and leaves the sheep and flees" (John 10:12). The Plowshare Pact proposes not paper war alliances, but constitutional neutrality (like Malta Art. 1(3)) paired with elite accountability.',
			keywords: '1939, Sanacja, Kuty bridge, treaties, guarantees, hireling, John 10, risk asymmetry',
			span: 'sees the wolf coming and leaves the sheep and flees'
		}
	},
	{
		fallacy_type: 'fatalism',
		core_principle: 'Geopolityka Teorii Gier zamiast Litości Sąsiadów',
		tags: 'Austria 1955, teoria gier, strefa buforowa, Malta, neutralność, Korona',
		sourceRefs: [
			{ work: 'Federalna Ustawa Konstytucyjna o Neutralności Austrii (BVG Neutralität, 1955)', section_ref: 'Art. I ust. 1–2' },
			{ work: 'Konstytucje Państw Neutralnych — Malta (1987) i Kostaryka (1949)', section_ref: 'Malta Art. 1(3); Kostaryka Art. 12' }
		],
		pl: {
			opponent_claim:
				'Austria uzyskała neutralność w 1955 roku tylko dlatego, że zgodziły się na to wielkie mocarstwa — dziś nikt nam neutralności z dobrej woli nie podaruje.',
			counter_punch:
				'Neutralność nigdy nie opiera się na „litości” ani „dobrej woli” mocarstw, lecz na twardej teorii gier i rachunku zysków i strat. W 1955 r. ani USA, ani ZSRR nie kierowały się sentymentem do Wiednia — uznały, że przewidywalny bufor w sercu Europy, w którym „Austria w przyszłości nie przystąpi do żadnych sojuszy wojskowych i nie dopuści do tworzenia na swoim terytorium baz wojskowych obcych państw”, jest dla obu bloków tańszy i bezpieczniejszy niż bezpośrednie zwarcie. Ale mocarstwa nie złożyły tej oferty same z siebie: najpierw rząd Juliusa Raaba i naród austriacki musieli położyć tę ofertę na stole, dokładnie jak Malta w Art. 1 ust. 3 Konstytucji.',
			keywords: 'Austria 1955, zgoda mocarstw, teoria gier, strefa buforowa, Julius Raab, Malta Art. 1',
			span: 'Austria w przyszłości nie przystąpi do żadnych sojuszy wojskowych i nie dopuści do tworzenia na swoim terytorium baz wojskowych obcych państw'
		},
		en: {
			opponent_claim:
				'Austria achieved neutrality in 1955 only because the great powers agreed to it — today no one will gift us neutrality out of goodwill.',
			counter_punch:
				'Neutrality never rests on the "mercy" or "goodwill" of great powers, but on hard game theory and cost-benefit calculation. In 1955 neither the USA nor the USSR acted out of sentiment toward Vienna — both recognized that a predictable buffer in Central Europe where "Austria will never in the future accede to any military alliances nor permit the establishment of military bases of foreign States on its territory" was cheaper and safer for both blocs than direct confrontation. Yet the powers did not invent that offer on their own: Chancellor Julius Raab and the Austrian nation had to put it on the table first, just as Malta enshrined neutrality in Article 1(3) of its Constitution.',
			keywords: 'Austria 1955, great power consensus, game theory, buffer state, Julius Raab, Malta Art. 1',
			span: 'Austria will never in the future accede to any military alliances nor permit the establishment of military bases of foreign States on its territory'
		}
	},
	{
		fallacy_type: 'broken_window_militarism',
		core_principle: 'Płodność Lemiesza ponad Jałowością Miecza (Eisenhower 1953 / 1 Sm 8)',
		tags: 'ekonomia, lemiesz a miecz, Eisenhower, Samuel, Bastiat, budżet, Korona',
		sourceRefs: [
			{ work: 'Dwight D. Eisenhower — Chance for Peace (Cross of Iron Speech, 1953)', section_ref: '16 IV 1953' },
			{ work: '1 Księga Samuela — Przestroga przed Państwem Militarnym (1 Samuel 8)', section_ref: '1 Sm 8, 11–17' }
		],
		pl: {
			opponent_claim:
				'Nowoczesna armia to zaawansowane technologie i impuls dla przemysłu — pokój, silna gospodarka i wielka armia nie wykluczają się, więc nie trzeba wybierać między lemieszem a mieczem.',
			counter_punch:
				'Ekonomia zna twarde prawo rzadkości zasobów: każda złotówka, każdy inżynier i każdy rocznik demograficzny skierowany do zbrojeń na kredyt jest odebrany polskiej rodzinie, infrastrukturze i cywilnej przedsiębiorczości. Jak ostrzegał gen. Dwight D. Eisenhower: „Każda wyprodukowana broń, każdy zwodowany okręt wojenny, każda wystrzelona rakieta oznacza w ostatecznym rachunku kradzież dokonaną na tych, którzy głodują i nie są nakarmieni”. Lemiesz (fabryka, rola, rodzina) jest płodny i sam się finansuje; miecz (importowany sprzęt bojowy rdzewiejący w magazynach) jest ekonomicznie jałowy i spełnia przestrogę proroka Samuela o państwie militarnym (1 Sm 8, 11–17).',
			keywords: 'lemiesz a miecz, Eisenhower, Samuel, koszt alternatywny, płodność lemiesza, jałowość miecza, gospodarka',
			span: 'Każda wyprodukowana broń, każdy zwodowany okręt wojenny, każda wystrzelona rakieta oznacza w ostatecznym rachunku kradzież'
		},
		en: {
			opponent_claim:
				'A modern army drives advanced technology and industry — peace, a strong economy, and a massive army do not exclude one another, so there is no need to choose between the plowshare and the sword.',
			counter_punch:
				'Economics is governed by the hard law of scarcity: every zloty, every engineer, and every demographic cohort diverted into credit-financed armaments is taken from Polish families, infrastructure, and civilian enterprise. As General Dwight D. Eisenhower warned: "Every gun that is made, every warship launched, every rocket fired signifies, in the final sense, a theft from those who hunger and are not fed". The plowshare (factory, farm, family) is fertile and self-financing; the sword (imported combat hardware rusting in depots) is economically sterile and fulfills the Prophet Samuel’s warning against the militarist state (1 Samuel 8:11–17).',
			keywords: 'plowshare vs sword, Eisenhower, Samuel, opportunity cost, fertility of the plowshare, sterility of the sword, economy',
			span: 'Every gun that is made, every warship launched, every rocket fired signifies, in the final sense, a theft'
		}
	},
	{
		fallacy_type: 'strawman',
		core_principle: 'Distinguo Tomistyczne: Oaza Pokoju (Zbrojna Neutralność Terytorialna) to nie Oaza Bezbronności',
		tags: 'Oaza Pokoju, Oaza Bezbronności, obrona terytorialna, Gaudium et Spes, Lubmin, Korona',
		sourceRefs: [
			{ work: 'Doktryna Oazy Pokoju Europy Środkowej i Karta Metodologiczna Przymierza Lemiesza', section_ref: 'Kanon I–V' },
			{ work: 'Gaudium et Spes (Vatican II, 1965)', section_ref: '§79 (para. 4)' }
		],
		pl: {
			opponent_claim:
				'Hasło „Polska Oazą Pokoju” brzmi jak „Oaza Bezbronności” i naiwny pacyfizm — tylko silny kraj z potężną armią może zachować pokój.',
			counter_punch:
				'Zastosujmy klasyczne rozróżnienie tomistyczne (Distinguo): Przymierze Lemiesza nigdy nie głosiło „Oazy Bezbronności”, lecz „Doktrynę Oazy Pokoju Europy Środkowej” opartą na Konstytucyjnej Zbrojnej Neutralności Terytorialnej (wzór Szwajcarii, Austrii 1955 i Malty Art. 1 ust. 3). Zgodnie z Gaudium et Spes §79 „nie można odmawiać rządom prawa do koniecznej obrony, byle wyczerpały wpierw wszystkie środki pokojowych rokowań”. Odrzucamy nie obronę własnego domu, lecz broń dalekiego zasięgu kupowaną na kredyt, obce bazy wojskowe i ekspedycyjne wpychanie Polski w cudze wojny — w pełnej zgodzie ze słowami z Lubmina: „Nie może być dobrobytu bez pokoju. Nie jesteśmy podżegaczami wojennymi”.',
			keywords: 'Oaza Pokoju, Oaza Bezbronności, pacyfizm, obrona terytorialna, Gaudium et Spes, Lubmin, Distinguo',
			span: 'nie można odmawiać rządom prawa do koniecznej obrony, byle wyczerpały wpierw wszystkie środki pokojowych rokowań'
		},
		en: {
			opponent_claim:
				'The slogan "Poland as an Oasis of Peace" sounds like an "Oasis of Defenselessness" and naive pacifism — only a strong country with a mighty army can preserve peace.',
			counter_punch:
				'Applying the classical Thomistic distinction (Distinguo): the Plowshare Pact has never preached an "Oasis of Defenselessness", but the "Oasis of Peace of Central Europe" Doctrine grounded in Constitutional Armed Territorial Neutrality (modeled on Switzerland, Austria 1955, and Malta Art. 1(3)). In line with Gaudium et Spes §79, "governments cannot be denied the right to legitimate defense once every means of peaceful settlement has been exhausted." What we reject is not defending our home, but credit-financed long-range strike weapons, foreign military bases, and pushing Poland into proxy wars — echoing the Lubmin declaration: "There cannot be prosperity without peace. We are not warmongers."',
			keywords: 'Oasis of Peace, Oasis of Defenselessness, pacifism, territorial defense, Gaudium et Spes, Lubmin, Distinguo',
			span: 'governments cannot be denied the right to legitimate defense once every means of peaceful settlement has been exhausted'
		}
	},
	{
		fallacy_type: 'hegelian_relativism',
		core_principle: 'Odrzucenie Dialektyki Heglowskiej na rzecz Dysputy Tomistycznej i Rycerskiej Polemiki',
		tags: 'Hegel, dialektyka, dysputa tomistyczna, rycerska polemika, metodologia, prawda',
		sourceRefs: [
			{ work: 'Doktryna Oazy Pokoju Europy Środkowej i Karta Metodologiczna Przymierza Lemiesza', section_ref: 'Kanon I–V' },
			{ work: 'Gaudium et Spes (Vatican II, 1965)', section_ref: '§78' }
		],
		pl: {
			opponent_claim:
				'W sporze między zwolennikami militaryzacji a zwolennikami neutralności trzeba zastosować dialektyczną syntezę i znaleźć kompromis pośrodku.',
			counter_punch:
				'W debacie odrzucamy dialektykę heglowską (teza–antyteza–synteza) na rzecz Dysputy Tomistycznej i Rycerskiej, Pryncypialnej Polemiki. Heglowska dialektyka rozmywa prawdę obiektywną w relatywistycznym kompromisie, podczas gdy pokój „słusznie i właściwie zowie się dziełem sprawiedliwości” (Gaudium et Spes §78). W duchu św. Tomasza z Akwinu uczciwie przytaczamy najmocniejszą postać argumentu adwersarza (Videtur quod), po czym odpowiadamy nań niezmienną zasadą moralną, prawem naturalnym i weryfikowalnym dowodem historycznym (Respondeo / Ad argumenta).',
			keywords: 'Hegel, dialektyka heglowska, dysputa tomistyczna, rycerska polemika, synteza, prawda obiektywna',
			span: 'W debacie odrzucamy dialektykę heglowską (teza–antyteza–synteza) na rzecz Dysputy Tomistycznej i Rycerskiej, Pryncypialnej Polemiki'
		},
		en: {
			opponent_claim:
				'In the dispute between advocates of militarization and advocates of neutrality, we should apply dialectical synthesis and find a middle-ground compromise.',
			counter_punch:
				'In debate we reject Hegelian dialectics (thesis–antithesis–synthesis) in favor of Thomistic Disputation and Chivalrous, Principled Polemics. Hegelian dialectics dissolves objective truth into relativistic compromise, whereas peace "is rightly and appropriately called an enterprise of justice" (Gaudium et Spes §78). In the spirit of St. Thomas Aquinas, we state the opponent’s strongest argument with complete fairness (Videtur quod) and answer it with unchanging moral principle, natural law, and verifiable historical evidence (Respondeo / Ad argumenta).',
			keywords: 'Hegel, Hegelian dialectics, Thomistic disputation, chivalrous polemics, synthesis, objective truth',
			span: 'In debate we reject Hegelian dialectics (thesis–antithesis–synthesis) in favor of Thomistic Disputation and Chivalrous, Principled Polemics'
		}
	},
	{
		fallacy_type: 'false_dilemma',
		core_principle: 'Doktryna Jeża i Teoria Gier: Neutralność Zbrojna to asymetryczny koszt inwazji przewyższający zysk agresora',
		tags: 'doktryna jeża, teoria gier, Szwajcaria, neutralność zbrojna, obrona terytorialna, asymetria, Hitler, Korona',
		sourceRefs: [
			{ work: 'Doktryna Oazy Pokoju Europy Środkowej i Karta Metodologiczna Przymierza Lemiesza', section_ref: 'Kanon I–V' },
			{ work: 'Konwencja Haska (V) o prawach i obowiązkach mocarstw i osób neutralnych (1907)', section_ref: 'Art. 1, 2, 5' }
		],
		pl: {
			opponent_claim:
				'Neutralność wymaga dobrej woli sąsiadów, a w kleszczach między Rosją a Niemcami to naiwność i zdanie się na łaskę wroga — bez potężnej armii nas rozjadą.',
			counter_punch:
				'Neutralność nie opiera się na altruizmie ani dobrej woli sąsiada, lecz na chłodnej teorii gier i bilansie zysków i strat. Szwajcaria nie przetrwała II wojny światowej dlatego, że Hitler miał wobec niej „dobrą wolę” – Hitler gardził Szwajcarami. Przetrwała, ponieważ jej asymetryczna obrona (doktryna jeża: powszechna obrona terytorialna, nasycenie terenu bronią defensywną i gotowość wysadzenia tuneli alpejskich) oraz status neutralnego węzła finansowego sprawiły, że inwazja była dla Rzeszy po prostu mniej opłacalna niż uszanowanie jej statusu. Połknięcie jeża kosztuje zbyt wiele krwi i kapitału, by agresja miała sens.',
			keywords: 'doktryna jeża, teoria gier, Szwajcaria, neutralność zbrojna, Hitler, obrona terytorialna, zysk i strata, asymetria',
			span: 'asymetryczny koszt inwazji przewyższający zysk agresora, nasycenie terenu obroną cywilną i dronami'
		},
		en: {
			opponent_claim:
				'Neutrality relies on the goodwill of neighbors, and caught between Russia and Germany that is naive and leaves us at the mercy of enemies — without a massive army they will crush us.',
			counter_punch:
				'Neutrality does not depend on a neighbor’s altruism or goodwill, but on cold game theory and cost-benefit reckoning. Switzerland did not survive World War II because Hitler felt "goodwill" toward it — Hitler despised the Swiss. It survived because its asymmetric defense (the hedgehog doctrine: widespread territorial defense, defensive saturation, and readiness to destroy Alpine tunnels) and its role as a neutral trade and financial hub made invasion simply unprofitable compared to respecting its status. Swallowing the hedgehog costs far more blood and treasure than any aggressor could gain.',
			keywords: 'hedgehog doctrine, game theory, Switzerland, armed neutrality, territorial defense, cost-benefit, asymmetry',
			span: 'asymmetric cost of invasion exceeding aggressor gains, saturating territory with civil defense and drones'
		}
	}
];

interface LetterSeedMeta {
	turn_number: number;
	direction: 'outbound' | 'inbound';
	sender: string;
	recipient: string;
	date_label: string;
	filename: string;
	summary_pl: string;
	summary_en: string;
	fallbackBody: string;
}

const KORONA_LETTERS_META: LetterSeedMeta[] = [
	{
		turn_number: 1,
		direction: 'outbound',
		sender: 'Bogdan Zięba (Przymierze Lemiesza)',
		recipient: 'Konfederacja Korony Polskiej (Biuro Poselskie)',
		date_label: '17 IX 2026',
		filename: 'lemiesz_to_korona_01.txt',
		summary_pl:
			'List I: Propozycja ogłoszenia Polski „Oazą Pokoju i Neutralności w Europie Środkowej” na wzór szwajcarski (Mt 5, 9; Iz 2, 4; przestroga Kissingera o losie sojuszników USA).',
		summary_en:
			'Letter I: Proposal to proclaim Poland an "Oasis of Peace and Neutrality in Central Europe" modeled on Swiss prosperity (Mt 5:9; Isa 2:4; Kissinger warning on US allies).',
		fallbackBody:
			'Szczęść Boże! Propozycja przyjęcia przez Konfederację Korony Polskiej śmiałego, historycznego postulatu: ogłoszenia Polski Oazą Pokoju i Neutralności w Europie Środkowej, na wzór szwajcarski.'
	},
	{
		turn_number: 2,
		direction: 'inbound',
		sender: 'Teresa Pracownik (Asystent Biura Poselskiego KKP)',
		recipient: 'Bogdan Zięba (Przymierze Lemiesza)',
		date_label: 'IX 2026',
		filename: 'korona_odp_01.txt',
		summary_pl:
			'Odpowiedź I: „Szwajcaria to Szwajcaria, a Polska leży między mocarstwami. My nie potrzebujemy Polski neutralnej — potrzebujemy Polski suwerennej”.',
		summary_en:
			'Reply I: "Switzerland is Switzerland, while Poland lies between great powers. We do not need a neutral Poland — we need a sovereign Poland."',
		fallbackBody:
			'Szwajcaria to Szwajcaria, a Polska leży między mocarstwami i w kleszczach geopolitycznych. My nie potrzebujemy Polski neutralnej. Potrzebujemy Polski suwerennej.'
	},
	{
		turn_number: 3,
		direction: 'outbound',
		sender: 'Bogdan Zięba (Przymierze Lemiesza)',
		recipient: 'Teresa Pracownik (Biuro Poselskie KKP)',
		date_label: '26 IX 2026',
		filename: 'lemiesz_to_korona_02.txt',
		summary_pl:
			'List II: Cztery pytania — Wzór a Kopia (błąd chochoła), Kto kryje się za „MY”? (pluralis majestatis), Płodność Lemiesza a Jałowość Miecza (Eisenhower, Bastiat, 1 Sm 8) oraz Suwerenność jako środek do pokoju, nie fetysz.',
		summary_en:
			'Letter II: Four inquiries — Model vs. Copy (strawman), Who is "WE"? (pluralis majestatis), Fertility of the Plowshare vs. Sterility of the Sword (Eisenhower, Bastiat, 1 Sam 8), and Sovereignty as a means to peace, not a fetish.',
		fallbackBody:
			'Szwajcaria jest dla nas WZOREM filozofii państwa, a nie mechaniczną KOPIĄ geografii. Płodność Lemiesza ponad Jałowością Miecza.'
	},
	{
		turn_number: 4,
		direction: 'inbound',
		sender: 'Teresa Pracownik (Asystent Biura Poselskiego KKP)',
		recipient: 'Bogdan Zięba (Przymierze Lemiesza)',
		date_label: '1 X 2026',
		filename: 'korona_odp_02.txt',
		summary_pl:
			'Odpowiedź II: Doprecyzowanie „kleszczy” między Niemcami a Rosją — „Polska może być albo jednym z najsilniejszych militarnie państw w Europie, albo będzie zależna od innych”.',
		summary_en:
			'Reply II: Clarification of the Germany–Russia pincer — "Poland can either be one of the strongest military states in Europe, or she will be dependent on others."',
		fallbackBody:
			'Polska może być albo jednym z najsilniejszych militarnie państw w Europie, albo będzie zależna od innych. Innej alternatywy w tym miejscu na mapie po prostu nie ma.'
	},
	{
		turn_number: 5,
		direction: 'outbound',
		sender: 'Bogdan Zięba (Przymierze Lemiesza)',
		recipient: 'Teresa Pracownik (Biuro Poselskie KKP)',
		date_label: '5 X 2026',
		filename: 'lemiesz_to_korona_03.txt',
		summary_pl:
			'List III: Trzy powody, dla których „Polska-Sparta” to utopia — Demografia (1,16) i Gospodarka (1:6 wobec Niemiec), Iluzja suwerenności na kredyt bez kodów źródłowych, Lekcja Austrii 1955 (z kleszczy w most) oraz Rachunek Królewski z Łk 14, 31–32.',
		summary_en:
			'Letter III: Three reasons "Poland-Sparta" is a utopia — Demography (1.16) & Economy (1:6 vs. Germany), Illusion of credit-bought sovereignty without source codes, Lesson of Austria 1955 (from pincers to bridge), and Luke 14:31–32 Royal Reckoning.',
		fallbackBody:
			'Polska jako mocarstwo militarne (Polska-Sparta) to niebezpieczna utopia przy dzietności 1,16. Lekcja Austrii 1955 (immerwährende Neutralität) i Rachunek Królewski (Łk 14, 31–32).'
	},
	{
		turn_number: 6,
		direction: 'inbound',
		sender: 'Teresa Pracownik (Asystent Biura Poselskiego KKP)',
		recipient: 'Bogdan Zięba (Przymierze Lemiesza)',
		date_label: '6 X 2026',
		filename: 'korona_odp_03.txt',
		summary_pl:
			'Odpowiedź III: Powołanie się na „Si vis pacem, para bellum”, teza że Austria 1955 wymagała zgody mocarstw, przywołanie klęski gwarancji 1939 r. oraz obrona nowoczesnej armii technologicznej.',
		summary_en:
			'Reply III: Appeal to "Si vis pacem, para bellum", claim that Austria 1955 required four-power consent, invocation of failed 1939 guarantees, and defense of a high-tech military.',
		fallbackBody:
			'Zasada „chcesz pokoju, szykuj się do wojny” (Si vis pacem, para bellum) nie straciła na aktualności. W 1939 roku mieliśmy gwarancje i traktaty — nie uchroniły nas przed niczym.'
	},
	{
		turn_number: 7,
		direction: 'outbound',
		sender: 'Bogdan Zięba (Przymierze Lemiesza)',
		recipient: 'Teresa Pracownik (Biuro Poselskie KKP)',
		date_label: '9 X 2026',
		filename: 'lemiesz_to_korona_04.txt',
		summary_pl:
			'List IV: Pięć dyscyplin logiki — 1. Logika historyczna (bankructwo Sanacji 1939 i 35–50% budżetu na wojsko), 2. Logika moralna (most w Kutach 17 IX 1939 i J 10, 11–13 o Najemniku), 3. Logika teologiczna (Chrystus Łk 14 ponad pogańskim Wegecjuszem), 4. Logika geopolityczna (teoria gier, Malta Art. 1(3), Kostaryka Art. 12), 5. Logika spójności (przemówienie Grzegorza Brauna w Lubminie).',
		summary_en:
			'Letter IV: Five disciplines of logic — 1. Historical logic (Sanacja 1939 bankruptcy & 35–50% military budget), 2. Moral logic (Kuty bridge flight & John 10:11–13 Hireling), 3. Theological logic (Christ in Luke 14 over pagan Vegetius), 4. Geopolitical logic (game theory, Malta Art. 1(3), Costa Rica Art. 12), 5. Consistency logic (Grzegorz Braun’s Lubmin speech).',
		fallbackBody:
			'Pięć dyscyplin logiki: 1. Logika historyczna (Sanacja 1939), 2. Logika moralna i asymetria ryzyka (most w Kutach, J 10, 11–13), 3. Logika teologiczna (Chrystus Łk 14 ponad Wegecjuszem), 4. Logika geopolityczna (Malta Art. 1 ust. 3), 5. Przemówienie w Lubminie.'
	},
	{
		turn_number: 8,
		direction: 'inbound',
		sender: 'Teresa Pracownik (Asystent Biura Poselskiego KKP)',
		recipient: 'Bogdan Zięba (Przymierze Lemiesza)',
		date_label: '14 X 2026',
		filename: 'korona_odp_04.txt',
		summary_pl:
			'Odpowiedź IV: Obrona Sanacji uwarunkowaniami porozbiorowymi, pytanie „dlaczego Polska nie miałaby być mocarstwem?”, teza że pokój, silna gospodarka i silna armia się nie wykluczają („Oaza Pokoju, nie Oaza Bezbronności; nie trzeba wybierać między lemieszem a mieczem”).',
		summary_en:
			'Reply IV: Defense of Sanacja via post-partition conditions, asking "why shouldn’t Poland be a great power?", arguing that peace, strong economy, and strong army do not exclude each other ("Oasis of Peace, not Oasis of Defenselessness; no need to choose between plowshare and sword").',
		fallbackBody:
			'Pokój, silna gospodarka i silna armia nie wykluczają się wzajemnie — one się wzajemnie warunkują. Polska może i powinna być Oazą Pokoju — ale nie Oazą Bezbronności. Nie ma potrzeby wybierać między lemieszem a mieczem.'
	}
];

function findSourceId(work: string, sectionRef: string): number | null {
	const r = db
		.prepare('SELECT id FROM sources WHERE work = ? AND section_ref = ?')
		.get(work, sectionRef) as { id: number } | undefined;
	return r?.id ?? null;
}

/**
 * Idempotently expands the corpus with the canonical sources, bilingual argument cards,
 * correspondence thread (`letters/Korona/*.txt`), and visual campaign posters (`static/images/*.jpg`).
 */
export function seedKoronaCorpus(): {
	sourcesAdded: number;
	translationsAdded: number;
	argumentsAdded: number;
	postersAdded: number;
	lettersAdded: number;
} {
	if (process.env.SEED_ON_EMPTY === 'false') {
		return { sourcesAdded: 0, translationsAdded: 0, argumentsAdded: 0, postersAdded: 0, lettersAdded: 0 };
	}

	const actor = system('seed');
	let sourcesAdded = 0;
	let translationsAdded = 0;
	let argumentsAdded = 0;
	let postersAdded = 0;
	let lettersAdded = 0;

	// 1. Add Polish translations for the 7 initial Vatican / Hague sources if missing
	for (const tr of POLISH_TRANSLATIONS_FOR_INITIAL_SEED) {
		const sourceId = findSourceId(tr.work, tr.section_ref);
		if (!sourceId) continue;
		const exists = db.prepare('SELECT 1 FROM source_texts WHERE source_id = ? AND locale = ?').get(sourceId, 'pl');
		if (!exists) {
			upsertSourceText(
				sourceId,
				'pl',
				{ text: tr.text, keywords: tr.keywords, origin: 'human_translation', reason: 'seed Polish translation' },
				actor
			);
			translationsAdded++;
		}
	}

	// 2. Add the 8 new bilingual Korona / Oasis of Peace sources
	for (const entry of KORONA_SOURCES) {
		let sourceId = findSourceId(entry.item.work, entry.item.section_ref);
		if (!sourceId) {
			const validation = validateIngestionChecklist(entry.item);
			if (!validation.valid) {
				console.error(`[koronaSeed] Rejected "${entry.item.work}":`, validation.errors);
				continue;
			}
			sourceId = createSource(entry.item, actor);
			sourcesAdded++;
		}
		const hasEn = db.prepare('SELECT 1 FROM source_texts WHERE source_id = ? AND locale = ?').get(sourceId, 'en');
		if (!hasEn) {
			upsertSourceText(
				sourceId,
				'en',
				{ text: entry.enText, keywords: entry.enKeywords, origin: 'official_translation', reason: 'seed English text' },
				actor
			);
			translationsAdded++;
		}
	}

	// 3. Add the 8 canonical bilingual Argument Cards
	for (const card of KORONA_ARGUMENTS) {
		const existing = db
			.prepare('SELECT id FROM arguments WHERE core_principle = ?')
			.get(card.core_principle) as { id: number } | undefined;
		const sourceIds = card.sourceRefs
			.map((ref) => findSourceId(ref.work, ref.section_ref))
			.filter((id): id is number => id !== null);

		let argId = existing?.id;
		if (!argId) {
			const firstSourceId = sourceIds[0];
			argId = createArgument(
				{
					fallacy_type: card.fallacy_type,
					core_principle: card.core_principle,
					tags: card.tags,
					locale: 'pl',
					source_ids: sourceIds,
					opponent_claim: card.pl.opponent_claim,
					counter_punch: card.pl.counter_punch,
					keywords: card.pl.keywords,
					origin: 'original',
					spans: firstSourceId ? [{ source_id: firstSourceId, span: card.pl.span }] : undefined,
					reason: 'seed Korona polemical argument (PL)'
				},
				actor
			);
			argumentsAdded++;
		}
		const hasEn = db.prepare('SELECT 1 FROM argument_texts WHERE argument_id = ? AND locale = ?').get(argId, 'en');
		if (!hasEn) {
			const firstSourceId = sourceIds[0];
			upsertArgumentText(
				argId,
				'en',
				{
					opponent_claim: card.en.opponent_claim,
					counter_punch: card.en.counter_punch,
					keywords: card.en.keywords,
					origin: 'human_translation',
					spans: firstSourceId ? [{ source_id: firstSourceId, span: card.en.span }] : undefined,
					reason: 'seed Korona polemical argument (EN)'
				},
				actor
			);
		}
	}

	// 4. Seed the 2 local visual campaign posters in static/images/ and link them to arguments
	const posterDefs = [
		{
			title: 'Dwie Korony — Chrystus Król Pokoju ponad Koroną Politycznego Militaryzmu',
			artist_or_author: 'Przymierze Lemiesza Studio',
			image_path: '/images/two_crowns_hero.jpg',
			theme: 'sovereignty_peace' as const,
			caption_pl:
				'Chrystusowy Rachunek Królewski (Łk 14, 31–32) i Korona Pokoju ponad iluzją „Polski-Sparty” oraz pogańską maksymą Wegecjusza.',
			caption_en:
				'Christ’s Royal Reckoning (Luke 14:31–32) and the Crown of Peace above the illusion of "Poland-Sparta" and pagan Vegetian militarism.',
			symbolism_notes:
				'Zestawienie dwóch koron: prawdziwej suwerenności zakorzenionej w Ładzie Bożym i Oazie Pokoju wobec upaństwowionego kultu garnizonu.',
			ai_assisted: true,
			production_credits: 'Koncept: Bogdan Zięba (Przymierze Lemiesza); opracowanie graficzne wspomagane AI (static/images/two_crowns_hero.jpg).',
			linkPrinciples: [
				'Suwerenność Pokoju ponad Suwerennością Garnizonu (Wzór, nie Kopia)',
				'Chrystus (Łk 14, 31–32) ponad pogańskim Wegecjuszem (Si vis pacem, para bellum)',
				'Distinguo Tomistyczne: Oaza Pokoju (Zbrojna Neutralność Terytorialna) to nie Oaza Bezbronności',
				'Doktryna Jeża i Teoria Gier: Neutralność Zbrojna to asymetryczny koszt inwazji przewyższający zysk agresora'
			]
		},
		{
			title: 'Świętość Zwykłego Życia — Płodność Lemiesza ponad Jałowością Miecza',
			artist_or_author: 'Przymierze Lemiesza Studio',
			image_path: '/images/kaszanka_sacred_life.jpg',
			theme: 'sacred_life' as const,
			caption_pl:
				'Polski stół, chleb, praca i rodzina: państwo istnieje po to, by chronić świętość zwykłego życia, a nie spalać owoce pracy narodu w cudzych wojnach.',
			caption_en:
				'The Polish table, bread, labor, and family: the state exists to guard the sanctity of ordinary life, not to burn the fruits of national labor in proxy wars.',
			symbolism_notes:
				'Symbol Płodności Lemiesza (Iz 2, 4; Eisenhower 1953) oraz sprzeciwu wobec Asymetrii Ryzyka (J 10, 11–13), w której elity uciekają przez most w Kutach, a koszt wojny ponosi zwykły człowiek.',
			ai_assisted: true,
			production_credits: 'Koncept: Bogdan Zięba (Przymierze Lemiesza); opracowanie graficzne wspomagane AI (static/images/kaszanka_sacred_life.jpg).',
			linkPrinciples: [
				'Płodność Lemiesza ponad Jałowością Miecza (Eisenhower 1953 / 1 Sm 8)',
				'Lekcja Sanacji 1939 i Koniec Asymetrii Ryzyka (J 10, 11–13)',
				'Rachunek Królewski (Łk 14, 31–32) oraz realizm demograficzno-gospodarczy'
			]
		}
	];

	for (const p of posterDefs) {
		const existingPoster = db
			.prepare('SELECT id FROM campaign_posters WHERE image_path = ?')
			.get(p.image_path) as { id: number } | undefined;
		let posterId = existingPoster?.id;
		if (!posterId) {
			posterId = createPoster(p, actor);
			postersAdded++;
		}
		for (const principle of p.linkPrinciples) {
			const arg = db.prepare('SELECT id FROM arguments WHERE core_principle = ?').get(principle) as { id: number } | undefined;
			if (arg) linkPosterToArgument(arg.id, posterId, actor);
		}
	}

	// Link existing YouTube media assets to relevant arguments so Shield surfaces them too
	const iluzja = db.prepare("SELECT id FROM media_assets WHERE external_id = 'URYM2FITucQ'").get() as { id: number } | undefined;
	const rota = db.prepare("SELECT id FROM media_assets WHERE external_id = 'mvCZ5zhCt5Q'").get() as { id: number } | undefined;
	const argSparta = db
		.prepare('SELECT id FROM arguments WHERE core_principle = ?')
		.get('Rachunek Królewski (Łk 14, 31–32) oraz realizm demograficzno-gospodarczy') as { id: number } | undefined;
	const argSovereignty = db
		.prepare('SELECT id FROM arguments WHERE core_principle = ?')
		.get('Suwerenność Pokoju ponad Suwerennością Garnizonu (Wzór, nie Kopia)') as { id: number } | undefined;
	if (iluzja && argSparta) {
		db.prepare('INSERT OR IGNORE INTO argument_media_links (argument_id, media_id, created_by) VALUES (?, ?, ?)').run(
			argSparta.id,
			iluzja.id,
			actor.name
		);
	}
	if (rota && argSovereignty) {
		db.prepare('INSERT OR IGNORE INTO argument_media_links (argument_id, media_id, created_by) VALUES (?, ?, ?)').run(
			argSovereignty.id,
			rota.id,
			actor.name
		);
	}

	// 5. Seed the Korona correspondence thread & 8 letters from letters/Korona/*.txt
	let thread = db.prepare("SELECT id FROM correspondence_threads WHERE slug = 'korona'").get() as { id: number } | undefined;
	if (!thread) {
		const res = db
			.prepare(
				`INSERT INTO correspondence_threads (slug, title, interlocutor, organization, methodology)
				 VALUES ('korona', ?, ?, ?, 'thomistic_disputation')`
			)
			.run(
				'Polemika Epistolarna: Przymierze Lemiesza ↔ Konfederacja Korony Polskiej (Oaza Pokoju a Polska-Sparta)',
				'Teresa Pracownik (Asystent Biura Poselskiego)',
				'Konfederacja Korony Polskiej (Biuro Poselskie Grzegorza Brauna)'
			);
		thread = { id: Number(res.lastInsertRowid) };
	}

	const lettersDir = path.resolve('letters', 'Korona');
	for (const meta of KORONA_LETTERS_META) {
		const exists = db
			.prepare('SELECT 1 FROM correspondence_letters WHERE thread_id = ? AND filename = ?')
			.get(thread.id, meta.filename);
		if (exists) continue;

		let body = meta.fallbackBody;
		try {
			const filePath = path.join(lettersDir, meta.filename);
			if (fs.existsSync(filePath)) {
				body = fs.readFileSync(filePath, 'utf8').trim();
			}
		} catch {
			// fallback body used
		}

		const claims = extractClaimsFromLetter(body, 5);
		db.prepare(
			`INSERT INTO correspondence_letters (
				thread_id, turn_number, direction, sender, recipient, date_label, filename,
				summary_pl, summary_en, body, key_claims_json
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		).run(
			thread.id,
			meta.turn_number,
			meta.direction,
			meta.sender,
			meta.recipient,
			meta.date_label,
			meta.filename,
			meta.summary_pl,
			meta.summary_en,
			body,
			JSON.stringify(claims)
		);
		lettersAdded++;
	}

	return { sourcesAdded, translationsAdded, argumentsAdded, postersAdded, lettersAdded };
}
