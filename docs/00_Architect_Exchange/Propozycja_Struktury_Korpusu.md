# Propozycja Architektoniczna · Nowa Struktura Korpusu Tekstowego, Symbioza z SQLite oraz „Spichlerz Lemiesza” (Svelte 5 UI)
*(Architectural Proposal: New Text Corpus Structure, SQLite Symbiosis & "The Lemiesz Granary" Svelte 5 UI)*

> **Doc type: CONSULTATION & ARCHITECTURAL PROPOSAL (point-in-time).**  
> **STATUS: OPEN FOR STAKEHOLDER CONSULTATION.**  
> **Data:** 2026-10-18  
> **Autorzy:** Antigravity AI & Lead Architect  
> **Adresaci / Interesariusze:** Zespół Przymierza Lemiesza, Developerzy, Kuratorzy Treści, Claude (Reviewer)  
> **Cel dokumentu:** Kompleksowe uporządkowanie rozrastającego się repozytorium tekstów na wczesnym etapie projektu (Część I) oraz zaprojektowanie dedykowanego komponentu Svelte 5 typu Evernote – **„Spichlerz Lemiesza”** (Część II) – który uczyni z bazy wiedzy płynne, błyskawiczne środowisko pracy badawczo-redakcyjnej i oręża retorycznego.

---

# CZĘŚĆ I · ARCHITEKTURA DANYCH I STRUKTURA PLIKÓW

---

## 1. Kontekst i Diagnoza Stanu Obecnego

Przymierze Lemiesza wchodzi w fazę intensywnego rozwoju bazy wiedzy. W projekcie gromadzone są zróżnicowane materiały tekstowe:
- Nienaruszalne Kanony doktrynalne (dotychczas Canons 01–08),
- Korespondencja epistolarna (8 listów polemicznych z Konfederacją Korony Polskiej, wystąpienia dyplomatyczne, np. prezydenckie z ONZ),
- Źródła autorytatywne (Pismo Święte, encykliki papieskie, traktaty międzynarodowe jak V Konwencja Haska czy Traktat Austriacki z 1955 r.),
- Materiały robocze, wycinki prasowe i transkrypcje w toku obróbki (np. `Braun GRzegorz.md`).

### Aktualne Problemy Architektoniczne:

1. **Pomieszanie dwóch różnych dziedzin w katalogu `docs/`:**
   - W jednym katalogu `docs/` przemieszane są **dokumenty inżynieryjne kodu** (`docs/17_Robots/`, `docs/10_Harness/`, `docs/01_Architecture/`, manifesty techniczne `02_Architecture_Manifesto.md`, `03_Rules_of_Engagement.md`) oraz **korpus intelektualny i geopolityczny Ruchu** (doktryna, teologia, listy, publicystyka).
2. **Naruszenie zasady *„One Fact, One Home”* (Canon 03 D2):**
   - Treści listów Korony leżą w plikach `.txt` w `docs/99_Raw_Repo/letters/Korona/`, lecz ich metadane (daty, nadawcy, odbiorcy, streszczenia PL/EN) są zduplikowane w 60-kilobajtowym pliku kodu TypeScript (`src/lib/server/seed/koronaSeed.ts`).
   - Poprawienie literówki lub dodanie nowego listu wymaga dziś żmudnego, ręcznego kodowania obiektów w TypeScript.
3. **Katalog `99_Raw_Repo` jako nieskategoryzowany „zsyp”:**
   - Brak wyraźnego podziału na to, co jest oficjalną, zatwierdzoną korespondencją, a co surowym materiałem wejściowym oczekującym na obróbkę redakcyjną.

---

## 2. Proponowana Struktura Katalogów Korpusu

Proponuje się wydzielenie całego korpusu treściowego do dedykowanego, czystego drzewa (zalecana ścieżka główna: `corpus/` w korzeniu projektu lub podkatalog `docs/corpus/`):

```text
corpus/                                 # [KORPUS WIEDZY I TREŚCI PRZYMIERZA LEMIESZA]
│
├── 00_Kanon/                           # RULINGS: Nienaruszalna doktryna ideowa, teologiczna i geopolityczna
│   ├── 01_Doktryna_Ideowa.md           # Dawny Canon 01 (Filary I-V, Oaza Pokoju)
│   ├── 02_Doktryna_Jeza_Wizualna.md    # Dawny Canon 04 (Alegoria, Edukacja, Satelity)
│   ├── 03_Metodologia_Obronnosci.md    # Dawny Canon 05 (Organiczna Tarcza, Imadło)
│   ├── 04_Dekonstrukcja_Suwerennosci.md# Dawny Canon 06 (Mit Niepodległości a Zbrojna Neutralność)
│   ├── 05_Dominus_Pacis_Pan_Pokoju.md  # Dawny Canon 07 (Prymat Ius ad Pacem nad Wegecjuszem)
│   └── 06_Przelamanie_Augustyna.md     # Dawny Canon 08 (Fałsz „Wojny o Pokój”, Realizm Lemiesza)
│
├── 01_Zrodla_Kanonu/                   # SOURCES: Teksty autorytatywne (odwzorowanie 1:1 z tabelą sources)
│   ├── 01_Pismo_Swiete/                # Łk 14 (Rachunek Królewski), Iz 2 (Lemiesze), J 10 (Pasterz i Najemnik)
│   ├── 02_Magisterium/                 # Pacem in Terris, Gaudium et Spes
│   ├── 03_Prawo_Miedzynarodowe/        # V Konwencja Haska 1907, Traktat Austriacki 1955, Konstytucja RP
│   └── 04_Historia_Mysli/              # Eisenhower 1953, Dmowski, Witos, Bobrzyński
│
├── 02_Korespondencja/                  # EPISTOLARY: Archiwum listów i polemik dyplomatycznych
│   ├── korona/                         # Wątek: Konfederacja Korony Polskiej
│   │   ├── _thread.yaml                # Metadane wątku (interlocutor, slug, methodology)
│   │   ├── 01_out_lemiesz_do_korony.md # Kolejne tury z YAML frontmatter
│   │   ├── 02_in_korona_odpowiedz.md
│   │   └── ...
│   └── prezydent/                      # Wątek: Kancelaria Prezydenta RP
│       └── nawrocki/
│           ├── _thread.yaml
│           └── 2026-09-23_ONZ_81_sesja.md
│
├── 03_Publicystyka/                    # ARTICLES: Opracowania, artykuły programowe, oświadczenia
│   ├── analizy/                        # Pogłębione analizy geopolityczne (tranzyt, energetyka, imadło)
│   ├── oswiadczenia/                   # Oficjalne komunikaty prasowe Przymierza Lemiesza
│   └── glosy_w_debacie/                # Felietony i polemiki bieżące
│
├── 04_Kultura_i_Edukacja/              # ALEGORIE I MEDIA: Teksty bajek, scenariusze, pieśni
│   ├── bajki_filozoficzne/             # Przypowieści o jeżu, niedźwiedziu i wilku
│   └── teksty_piesni/                  # Słowa utworów (indeksowane w tabeli media_assets dla FTS5)
│
└── 99_Spichlerz_Surowy/                # INTAKE / BUFFER: Dawne 99_Raw_Repo
    ├── do_przetworzenia/               # Surowe wloty (np. Braun GRzegorz.md, wycinki, transkrypcje)
    └── archiwum_zewnetrzne/            # Skanowane dokumenty, materiały pomocnicze
```

> **Czystość katalogu `docs/`:**  
> Po tej operacji katalog `docs/` staje się w 100% domeną dokumentacji technicznej oprogramowania:
> - `docs/01_Architecture/` — architektura systemu, schematy bazy, RAG,
> - `docs/02_Platform_Modules/` — specyfikacje żywych modułów aplikacji,
> - `docs/10_Harness/` — ledger testów, raporty weryfikacji,
> - `docs/17_Robots/` — flota automatycznych robotów strażniczych,
> - `docs/00_Canon/` — **wyłącznie zasady inżynieryjne** (`02_Architecture_Manifesto.md`, `03_Rules_of_Engagement.md`).

---

## 3. Architektura Symbiozy z Bazą SQLite (`lemiesz.db`)

Pliki Markdown w repozytorium Git oraz baza SQLite nie powinny ze sobą konkurować. Tworzą one uzupełniający się tandem:

```
┌─────────────────────────────────────────────────────────────┐
│              SYSTEM PLIKÓW / GIT (Markdown + YAML)          │
│                „Jedyne Źródło Prawdy” (Truth)               │
│   • Czytelne dla człowieka i AI                             │
│   • Pełna historia i audytowalność (git log, diff, PR)      │
│   • Niezależność od awarii oprogramowania                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
               [ Automatyczny Ingestion Pipeline: ]
               [ npm run ingest / build / watch   ]
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     SQLITE (lemiesz.db)                     │
│             „Silnik Operacyjny i Wyszukiwawczy”             │
│   • Relacje i klucze obce (threads ↔ letters ↔ arguments)   │
│   • Pełnotekstowy FTS5 (błyskawiczne szukanie w PL i EN)    │
│   • Baza wektorowa pod RAG dla Tarczy Ideologicznej         │
│   • Zerowy czas odpowiedzi dla interfejsu SvelteKit         │
└─────────────────────────────────────────────────────────────┘
```

### 3.1. Standard Plików: Markdown z nagłówkiem YAML Frontmatter
Każdy plik w korpusie staje się samowystarczalnym rekordem bazodanowym.

#### Przykład A: Źródło Kanoniczne (`corpus/01_Zrodla_Kanonu/01_Pismo_Swiete/lk-14-rachunek-krolewski.md`)
```yaml
---
slug: lk-14-rachunek-krolewski
category: magisterium
work: "Ewangelia wg św. Łukasza — Rachunek Królewski"
section_ref: "Łk 14, 31–32"
license: "Public domain: Biblia Gdańska / Nova Vulgata"
cleared_to_store: true
locales:
  pl:
    text: "Albo który król, mając wyruszyć, aby stoczyć bitwę z drugim królem, nie usiądzie wpierw i nie rozważy, czy w dziesięć tysięcy może stawić czoło temu, który z dwudziestoma tysiącami nadciąga przeciw niemu? Jeśli nie, wyprawia poselstwo, gdy tamten jest jeszcze daleko, i prosi o warunki pokoju."
    keywords: "rachunek królewski, król, dziesięć tysięcy, dwadzieścia tysięcy, poselstwo, warunki pokoju, roztropność"
  en:
    text: "Or what king, going to encounter another king in war, will not sit down first and deliberate whether he is able with ten thousand to meet him who comes against him with twenty thousand? And if not, while the other is yet a great way off, he sends a delegation and asks for terms of peace."
    keywords: "royal reckoning, king, ten thousand, twenty thousand, delegation, terms of peace, prudence"
---

# Rachunek Królewski — Podstawa Chrześcijańskiego Realizmu Geopolitycznego
[Komentarz teologiczno-polityczny do użytku Tarczy Ideologicznej i formacji działaczy]
```

#### Przykład B: List Epistolarny (`corpus/02_Korespondencja/korona/01_out_lemiesz_do_korony.md`)
```yaml
---
thread_slug: korona
turn_number: 1
direction: outbound
sender: "Bogdan Zięba (Przymierze Lemiesza)"
recipient: "Grzegorz Braun / Teresa Pracownik (Biuro Poselskie Korony)"
date_label: "11 października 2026"
summary_pl: "Wezwanie do debaty nad Oazą Pokoju a mitem Polski-Sparty"
summary_en: "Call for debate on the Oasis of Peace vs the Poland-Sparta myth"
key_claims:
  - "Polska nie może być kowadłem obcych mocarstw"
  - "Rachunek Królewski nakazuje zbrojną neutralność"
---

Szanowny Panie Pośle,
W odpowiedzi na dotychczasowe deklaracje dotyczące obronności...
[pełna treść listu]
```

### 3.2. Korzyści z Takiej Architektury

1. **Likwidacja monstrualnych seederów w TypeScript:**
   * Zamiast pisać 800 linii w `koronaSeed.ts`, skrypt `scripts/ingest-corpus.mjs` automatycznie skanuje strukturę `corpus/`, czyta frontmatter i wykonuje instrukcje `INSERT OR REPLACE` do tabel `sources`, `source_texts`, `correspondence_threads` i `correspondence_letters`.
2. **Błyskawiczne odtwarzanie bazy (*Disaster Recovery*):**
   * Baza SQLite `lemiesz.db` staje się strukturą całkowicie odtwarzalną (*ephemeral cache*). W razie uszkodzenia pliku bazy polecenie `npm run db:rebuild` rekonstruuje 100% bazy i indeksów FTS5 w 2 sekundy wprost z repozytorium Git.
3. **Automatyczne zasilanie Wyszukiwarki i RAG:**
   * Dodanie nowego pliku Markdown natychmiast zasila tabelę `fts_pl` i `fts_en`. Użytkownik i Tarcza Ideologiczna (`/shield`) mogą od razu cytować nowy dokument bez konieczności restartowania serwera.
4. **Weryfikacja przez Flotę Robotów:**
   * ROBOT-01 (Verbatim Quotation) i ROBOT-07 (License & Cleared-to-Store) mogą walidować bezpośrednio pliki `.md` w `corpus/` przed dopuszczeniem ich do bazy.

---

# CZĘŚĆ II · „SPICHLERZ LEMIESZA” (SVELTE 5 EVERNOTE-LIKE WORKSPACE)

---

## 4. Wizja Interfejsu: Cyfrowe Biurko Przymierza Lemiesza (`/corpus` / `/spichlerz`)

Sama czysta struktura katalogów i baza SQLite potrzebują intuicyjnego, estetycznego interfejsu użytkownika. Zamiast zmuszać autorów, analityków i działaczy do ręcznego przeglądania plików na GitHubie lub w edytorze kodu, tworzymy **„Spichlerz Lemiesza”** — dedykowany moduł platformy inspirowany ergonomią **Evernote**, lecz zaprojektowany specjalnie pod misję i specyfikę Przymierza Lemiesza.

Spichlerz łączy w jednym oknie:
- Archiwum wiedzy i kanonu,
- Warsztat badawczy z natychmiastowym wyszukiwaniem FTS5,
- Most do obrony retorycznej w debacie publicznej (Tarcza Ideologiczna).

---

## 5. Trzypanelowy Układ Przestrzenny (Evernote UX w Svelte 5)

Układ opiera się na klasycznym, sprawdzonym podziale na trzy kolumny, idealnie zbalansowanym na ekranach desktopowych i składającym się responsywnie na urządzeniach mobilnych:

```
┌──────────────────────┬────────────────────────┬────────────────────────────────────────────┐
│ PANEL 1: DRZEWO      │ PANEL 2: LISTA KART    │ PANEL 3: CZYTNIK I INSPEKTOR DOKUMENTU     │
│ (Foldery & Filtry)   │ (Wyszukiwarka FTS5)    │ (Aktywny Kanon / List / Źródło)            │
├──────────────────────┼────────────────────────┼────────────────────────────────────────────┤
│ 🏛️ Kanon (8)         │ [🔍 Szukaj w FTS5...]  │ 📜 List do Korony #02 (15.10.2026)         │
│ 📖 Źródła (15)       │ ────────────────────── │ ────────────────────────────────────────── │
│   • Pismo Święte     │ • List Korona #04      │ Nadawca: Bogdan Zięba  | Odbiorca: G. Braun│
│   • Magisterium      │   „Oaza Pokoju...”     │ Status: human_approved | Metoda: Tomistycz.│
│   • Traktaty         │ • Canon 07             │ ────────────────────────────────────────── │
│ ✉️ Korespondencja (10)│   „Pan Pokoju...”      │ Szanowny Panie Pośle,                      │
│   • Korona (8)       │ • Canon 06             │ Odwołując się do ewangelicznego Rachunku   │
│   • Nawrocki (2)     │   „Mit Niepodległ...”  │ Królewskiego (Łk 14, 31-32)...             │
│ 📰 Publicystyka (4)  │ • Łk 14 (Rachunek)     │                                            │
│ 🌾 Spichlerz Surowy  │   „Który król...”      │ [ 🔗 POWIĄZANE KARTY ARGUMENTÓW I ŹRÓDEŁ ] │
│ ──────────────────── │                        │ • Rachunek Królewski (Łk 14, 31-32)        │
│ TAGI TEMATYCZNE:     │                        │ • V Konwencja Haska (Art. 1, 2, 5)         │
│ #neutralność (12)    │                        │ • Plakat: Dwie Korony                      │
│ #imadło (5)          │                        │ ────────────────────────────────────────── │
│ #rachunek-królewski  │                        │ [ 🛡️ Przekaż do Tarczy ] [ 📋 Kopiuj cytat ]│
└──────────────────────┴────────────────────────┴────────────────────────────────────────────┘
```

1. **Panel 1 (Lewa Kolumna – Nawigacja & Tagi):**
   * Hierarchiczne drzewo notatników odpowiadające strukturze folderów `corpus/`.
   * Dynamiczne liczniki dokumentów przy każdej kategorii.
   * Chmura tagów tematycznych (`#neutralność`, `#doktryna-jeża`, `#imadło`, `#kuty-1939`).
2. **Panel 2 (Środkowa Kolumna – Kartoteka & Szybkie Szukanie):**
   * Pasek wyszukiwania pełnotekstowego FTS5 z czasem odpowiedzi < 5 ms.
   * Karty dokumentów ze zwięzłym podglądem (tytuł, data, fragment dopasowania, badge statusu).
   * Opcje sortowania: chronologicznie, alfabetycznie, wg trafności wyszukiwania.
3. **Panel 3 (Prawa Kolumna – Czytnik, Edytor i Inspektor Relacji):**
   * Wyrenderowana treść Markdown z zachowaniem godnej typografii Przymierza Lemiesza.
   * Pasek metadanych: nadawca/odbiorca, licencja, status weryfikacji.
   * Dolny panel relacji: karty argumentów i powiązane plakaty z albumu medialnego.
   * Przyciski akcji: kopiowanie dosłownego cytatu z tokenem `[[src:ID]]`, eksport do PDF oraz bezpośredni zrzut do Tarczy Ideologicznej.

---

## 6. Sześć Supermocy Spichlerza (Wartość Dodana Ponad Zwykłym Evernote)

Zwykłe aplikacje notatkowe przechowują martwy tekst. **Spichlerz Lemiesza** staje się żywym systemem operacyjnym dla idei ruchu:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 UNIKALNE SUPERMOCE SPICHLERZA LEMIESZA                      │
├──────────────────────┬──────────────────────────────────────────────────────┤
│ 1. BILINGUAL LENS    │ Natychmiastowy podgląd dwujęzyczny (PL / EN side-by- │
│                      │ side), idealny dla źródeł łacińskich i traktatów.    │
├──────────────────────┼──────────────────────────────────────────────────────┤
│ 2. MOST DO TARCZY    │ Jeden klik: „Wyślij do Tarczy Ideologicznej”         │
│    (`/shield`)       │ automatycznie ładuje dany cytat do debaty na żywo.   │
├──────────────────────┼──────────────────────────────────────────────────────┤
│ 3. PRAWDA CYTATU     │ Weryfikacja zgodności z ROBOT-01 (Verbatim Quotation)│
│    (Zero Halucynacji)│ Gwarancja, że cytowany fragment istnieje w bazie.    │
├──────────────────────┼──────────────────────────────────────────────────────┤
│ 4. TRUST-TIER BADGES │ Wizualny wskaźnik wiarygodności: canonical_source,   │
│                      │ human_approved, czy surowy draft do obróbki.         │
├──────────────────────┼──────────────────────────────────────────────────────┤
│ 5. GRAF POWIĄZAŃ     │ Kliknięcie w przypis w liście natychmiast otwiera    │
│                      │ pełny tekst źródła w panelu obok bez utraty kontekstu│
├──────────────────────┼──────────────────────────────────────────────────────┤
│ 6. OFFLINE-FIRST     │ Całość działa lokalnie na bazie SQLite i plikach     │
│                      │ Markdown — bez uzależnienia od chmur korporacyjnych. │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

---

## 7. Architektura Komponentów Svelte 5 (Runes Architecture)

Komponent zostanie zaimplementowany w oparciu o czysty, modułowy paradygmat runów Svelte 5 (`$state`, `$derived`, `$effect`) w dedykowanym katalogu `src/lib/components/corpus/`:

```text
src/lib/components/corpus/
├── SpichlerzWorkspace.svelte  # Główny kontener koordynujący stan (activeDocId, activeFilter, searchQuery)
├── SpichlerzSidebar.svelte    # Panel 1: Drzewo folderów, liczniki, filtr kategorii i tagów
├── DocCardList.svelte         # Panel 2: Wyszukiwarka FTS5, sortowanie i lista kart wynikowych
├── DocReader.svelte           # Panel 3: Czytnik Markdown, nagłówek metadanych, widok dwujęzyczny
├── DocInspector.svelte        # Panel boczny: Powiązane karty argumentów, plakaty, tokeny cytatu
└── QuickIngestModal.svelte    # Okno szybkiego wrzucenia nowego tekstu do Spichlerza Surowego
```

### Koordynacja Stanu w Svelte 5:
* **Synchronizacja z adresem URL:** Wybór dokumentu natychmiast aktualizuje parametr zapytania (np. `/corpus?id=korona-02&lang=pl`), co pozwala dzielić się bezpośrednimi odnośnikami do konkretnych pism między współpracownikami.
* **Błyskawiczne filtrowanie reaktywne:** Wyszukiwanie pełnotekstowe komunikuje się bezpośrednio z endpointem SvelteKit opartym o wirtualną tabelę `fts_pl` / `fts_en` w SQLite, zwracając wyniki w czasie poniżej 5 milisekund.

---

# CZĘŚĆ III · MATRYCA DECYZYJNA I HARMONOGRAM WDROŻENIA

---

## 8. Kwestie Otwarte do Konsultacji z Interesariuszami (*Decision Matrix*)

Przed przystąpieniem do migracji i budowy komponentu prosimy interesariuszy o rozstrzygnięcie poniższych kwestii:

| # | Zagadnienie | Opcja A (Rekomendowana) | Opcja B (Alternatywa) | Rationale / Uwagi |
|---|---|---|---|---|
| **D1** | **Główna lokalizacja korpusu na dysku** | `corpus/` w głównym katalogu projektu | `docs/corpus/` wewnątrz drzewa docs | Opcja A daje czysty podział: `src/` (kod aplikacji), `docs/` (inżynieria i testy), `corpus/` (wiedza i doktryna). |
| **D2** | **Konwencja językowa folderów** | Hybryda z przewagą polskiego (`00_Kanon`, `01_Zrodla_Kanonu`, `02_Korespondencja`) | Czysty angielski (`00_canon`, `01_sources`, `02_correspondence`) | Teksty są w większości polskie, ale klucze w kodzie i bazie są angielskie. |
| **D3** | **Migracja dotychczasowych listów Korony** | Konwersja z surowych `.txt` na `.md` z nagłówkami YAML | Pozostawienie `.txt` i trzymanie metadanych w osobnym pliku JSON/YAML | Format `.md` z YAML frontmatter jest standardem w SSG i CMS. |
| **D4** | **Routing i nazwa widoku w UI** | Trasa `/corpus` (nazwa w menu: *„Spichlerz Wiedzy”*) | Trasa `/vault` lub `/archive` | `/corpus` i *„Spichlerz”* idealnie harmonizują z metaforyką Lemiesza. |
| **D5** | **Workflow dla `99_Spichlerz_Surowy`** | Nowe pliki wpadają do `do_przetworzenia/` i wymagają zatwierdzenia w UI `/review` przed włączeniem do bazy | Skrypt automatycznie ładuje je do bazy ze statusem `status='draft'` | Zabezpiecza przed zatruciem bazy niezweryfikowanymi cytatami (ROBOT-02). |

---

## 9. Plan Realizacji po Zakończeniu Konsultacji

Po zatwierdzeniu propozycji przez interesariuszy wdrożenie nastąpi w trzech logicznych fazach:

### Faza 1: Restrukturyzacja Plików i Ingestor (Backend)
1. Utworzenie katalogu `corpus/` i podfolderów zgodnie ze schematem z §2.
2. Bezpieczna migracja kanonów doktrynalnych (01, 04–08) z zachowaniem kanonów technicznych (02, 03) w `docs/00_Canon/`.
3. Konwersja 8 listów Korony i wystąpienia ONZ do standardu `.md` z YAML frontmatter.
4. Utworzenie skryptu `scripts/ingest-corpus.mjs` parsującego pliki i wykonującego `UPSERT` w tabelach SQLite (`sources`, `correspondence_letters`, `fts_pl`, `fts_en`).
5. Uproszczenie `koronaSeed.ts` i weryfikacja zgodności z Robotami (`npm run robots`).

### Faza 2: Budowa Komponentu Spichlerza Lemiesza (Frontend)
1. Utworzenie trasy SvelteKit `/corpus/+page.svelte` i loadera serwerowego czytającego z SQLite.
2. Implementacja modularnych komponentów Svelte 5 w `src/lib/components/corpus/` (`SpichlerzWorkspace`, `SpichlerzSidebar`, `DocCardList`, `DocReader`, `DocInspector`).
3. Spięcie wyszukiwarki FTS5 z podświetlaniem fraz w czasie rzeczywistym.
4. Dodanie przycisku szybkiego przekazywania cytatów do Tarczy Ideologicznej (`/shield`).

### Faza 3: Testy i Dokumentacja Końcowa
1. Testy jednostkowe i integracyjne Svelte 5 / Vitest (`npm run test`).
2. Sprawdzenie rygorów dostępności a11y i czystości runów Svelte 5 (`npm run check`).
3. Aktualizacja dokumentacji nadrzędnej (`docs/README.md`, `docs/OPERATIONS.md`).

---

> **Podsumowanie Architektoniczne:**  
> Połączenie **ustrukturyzowanego repozytorium Markdown w Git** jako źródła prawdy, **bazy SQLite z FTS5** jako ultraszybkiego silnika wyszukiwawczo-relacyjnego oraz **„Spichlerza Lemiesza” w Svelte 5** jako eleganckiego, trzypanelowego biurka analityka przeniesie platformę Przymierza Lemiesza na poziom profesjonalnego, nowoczesnego think-tanku cyfrowego.
