# Propozycja Architektoniczna · Nowa Struktura Korpusu Tekstowego i Symbioza z Bazą SQLite
*(Architectural Proposal: New Text Corpus Structure & Symbiosis with SQLite Database)*

> **Doc type: CONSULTATION & ARCHITECTURAL PROPOSAL (point-in-time).**  
> **STATUS: OPEN FOR STAKEHOLDER CONSULTATION.**  
> **Data:** 2026-10-18  
> **Autorzy:** Antigravity AI & Lead Architect  
> **Adresaci / Interesariusze:** Zespół Przymierza Lemiesza, Developerzy, Kuratorzy Treści, Claude (Reviewer)  
> **Cel dokumentu:** Uporządkowanie rozrastającego się repozytorium tekstów, listów epistolarnych, źródeł kanonicznych i artykułów na wczesnym etapie projektu oraz zdefiniowanie automatycznego mechanizmu zasilania bazy SQLite (`lemiesz.db`) wprost z plików Markdown śledzonych w systemie Git.

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
├── 01_Zrodla_Kanonu/                   # SOURCES: Teksty autorytatywne (odwzorowanie 1:1 z tabelą `sources`)
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
│   └── teksty_piesni/                  # Słowa utworów (indeksowane w tabeli `media_assets` dla FTS5)
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

## 4. Kwestie Otwarte do Konsultacji z Interesariuszami (*Decision Matrix*)

Przed przystąpieniem do migracji plików prosimy interesariuszy o rozstrzygnięcie następujących kwestii:

| # | Zagadnienie | Opcja A (Rekomendowana) | Opcja B (Alternatywa) | Uwagi |
|---|---|---|---|---|
| **D1** | **Główna lokalizacja korpusu** | `corpus/` w głównym katalogu projektu | `docs/corpus/` wewnątrz drzewa docs | Opcja A daje czysty podział: `src/` (kod), `docs/` (inżynieria), `corpus/` (wiedza). |
| **D2** | **Konwencja językowa folderów** | Hybryda z przewagą polskiego (`00_Kanon`, `01_Zrodla_Kanonu`, `02_Korespondencja`) | Czysty angielski (`00_canon`, `01_sources`, `02_correspondence`) | Teksty są w większości polskie, ale klucze w kodzie i bazie są angielskie. |
| **D3** | **Migracja dotychczasowych listów Korony** | Konwersja z `.txt` na `.md` z nagłówkami YAML | Pozostawienie `.txt` i trzymanie metadanych w osobnym pliku JSON/YAML | Format `.md` z YAML frontmatter jest standardem w SSG i CMS. |
| **D4** | **Workflow dla `99_Spichlerz_Surowy`** | Nowe pliki wpadają do `do_przetworzenia/` i wymagają zatwierdzenia w UI `/review` przed włączeniem do bazy | Skrypt automatycznie ładuje je do bazy ze statusem `status='draft'` | Zabezpiecza przed zatruciem bazy niezweryfikowanymi cytatami (ROBOT-02). |

---

## 5. Plan Realizacji po Zakończeniu Konsultacji

Po zatwierdzeniu propozycji przez interesariuszy wdrożenie nastąpi w czterech uporządkowanych krokach:

1. **Krok 1: Struktura katalogów i bezpieczna migracja plików:**
   * Utworzenie docelowych folderów.
   * Przeniesienie kanonów doktrynalnych (01, 04–08) do `corpus/00_Kanon/` przy zachowaniu kanonów inżynieryjnych (02, 03) w `docs/00_Canon/`.
   * Przeniesienie i konwersja listów z `docs/99_Raw_Repo` do `corpus/02_Korespondencja/`.
2. **Krok 2: Opracowanie uniwersalnego Ingestora:**
   * Utworzenie skryptu `scripts/ingest-corpus.mjs` parsującego YAML frontmatter i zasilającego SQLite.
3. **Krok 3: Refaktoryzacja seederów i testów:**
   * Zastąpienie twardo zakodowanych struktur w `src/lib/server/seed/koronaSeed.ts` wywołaniem Ingestora.
   * Aktualizacja ścieżek w testach (`npm run test`) i weryfikacja Floty Robotów (`npm run robots`).
4. **Krok 4: Aktualizacja dokumentacji nadrzędnej:**
   * Aktualizacja `docs/README.md` oraz `docs/OPERATIONS.md`.

---

> **Podsumowanie:**  
> Przejście na model **Git-tracked Markdown z YAML Frontmatter jako Źródło Prawdy + SQLite jako Silnik Wyszukiwawczo-Relacyjny** zapewni platformie Przymierza Lemiesza bezprecedensową przejrzystość, odporność na błędy i łatwość skalowania na kolejne lata.
