# Propozycja Architektoniczna v2 · Korpus Tekstowy w Git i Podział Władzy Plik ↔ SQLite
*(Architectural Proposal v2: Git-Hosted Text Corpus and the File ↔ SQLite Authority Split)*

> **Doc type: CONSULTATION & ARCHITECTURAL PROPOSAL (point-in-time).**  
> **STATUS: OPEN FOR STAKEHOLDER CONSULTATION.**  
> **Wersja:** v2 · 2026-10-19 (zastępuje v1 z 2026-10-18; v1 pozostaje w historii Git, commity `542c603` i `9585458`)  
> **Właściciel dokumentu:** Claude (przejęcie od Antigravity AI, audyt v1 w §0)  
> **Adresaci / Interesariusze:** Lead Architect, Zespół Przymierza Lemiesza, Developerzy, Kuratorzy Treści  
> **Zakres:** wyłącznie struktura korpusu, ingest do SQLite i plan migracji. Interfejs „Spichlerz Lemiesza” wydzielono do osobnej propozycji: [Propozycja_Spichlerz_UI.md](Propozycja_Spichlerz_UI.md) — odłożonej do zakończenia Fazy 2 niniejszego planu.

---

## 0. Audyt v1 — co poprawiono

Kierunek v1 jest słuszny: treść korpusu powinna żyć w plikach Markdown w Git, a nie w literałach TypeScript, a `docs/` powinno wrócić do roli dokumentacji technicznej. Jednak v1 opierała się na kilku błędnych faktach i pomijała najtrudniejszą kwestię — kto jest właścicielem stanu recenzji.

| # | Twierdzenie v1 | Stan faktyczny (zmierzony 2026-10-19) | Konsekwencja w v2 |
|---|---|---|---|
| A1 | Treści listów są w `.txt`, metadane zduplikowane w `koronaSeed.ts` | Prawda, ale `koronaSeed.ts` (60 kB) to głównie **źródła** (`KORONA_SOURCES`), **tłumaczenia** i **9 kart argumentów**; metadane 8 listów to ok. 120 linii | Migracja obejmuje źródła, nie tylko listy (§6, Faza 3) |
| A2 | `docs/01_Architecture/` istnieje i zostaje w `docs/` | Katalog nie istnieje. `docs/README.md` wymienia też nieistniejące `01_Testing_Strategy.md` i 4 z 5 plików `02_Platform_Modules/` | Faza 0 porządkuje mapę `docs/README.md` |
| A3 | Kanony doktrynalne to 01, 04–08 | Istnieje już Canon 09 (`09_Kowadlo_Pokoju_…`, jeszcze nie zacommitowany) | Canon 09 wchodzi do migracji |
| A4 | Przenumerowanie kanonów (04→02, 05→03 …) | W `docs/`, `src/`, `scripts/` i `tests/` jest 76 odwołań typu „Canon 0N” / `00_Canon/`; „Canon 03 D2” to stały identyfikator reguły | **Numery kanonów zostają bez zmian**; luki w numeracji są dopuszczalne |
| A5 | Baza SQLite jako „ephemeral cache”, `npm run db:rebuild` odtwarza 100% bazy | Baza przechowuje stan, którego nie ma w plikach: `review` (w tym `human_approved`), `review_events`, `audit_json`, embeddingi, użytkowników, sesje, rozmowy, szkice, media, plakaty. Odbudowa z plików zgubiłaby każdą ludzką akceptację (Canon 02 §1.2, ROBOT-02) | Jawny podział władzy plik ↔ baza (§3). Kopie zapasowe (`backup.ts`, `restore-drill.mjs`) pozostają mechanizmem DR |
| A6 | Nowy plik „natychmiast zasila” `fts_pl`/`fts_en` bez restartu | FTS indeksuje tylko `source` i `argument`; listy i kanony nie są indeksowane. `owner_type` w `embeddings` i `review_events` ma `CHECK IN ('source','argument')` | Indeksowanie listów to osobna decyzja z migracją schematu (D6) |
| A7 | ROBOT-01 i ROBOT-07 „mogą walidować pliki `.md`” | ROBOT-01 sprawdza cytaty modeli względem zapisanych tekstów; ROBOT-07 działa przez `validateIngestionChecklist`. Żaden robot nie czyta plików korpusu. ROBOT-08 sprawdza linki tylko w `docs/` | Nowy ROBOT-11 oraz rozszerzenie ROBOT-08 na `corpus/` (§4) |
| A8 | `npm run ingest`, `npm run robots` | Projekt używa `pnpm` (`pnpm robots`, `pnpm check`, `pnpm test`) | Poprawione polecenia |
| A9 | Czasy „< 5 ms”, „2 sekundy”, „100%” | Nigdy nie zmierzone — narusza zasadę *Measured Claims Carry Dates* | Usunięte |
| A10 | Przykład A: `license: "Public domain: Biblia Gdańska / Nova Vulgata"` | Tekst PL Łk 14,31–32 w seedzie wygląda na **Biblię Tysiąclecia** (© Pallottinum), a tekst EN na **ESV** (© Crossway) — nie na Biblię Gdańską ani WEB, które deklaruje pole `license` | Blokuje migrację źródeł 1:1 — kurator musi zweryfikować (§5, Faza 0) |

Dwa dodatkowe ustalenia z kodu, istotne dla migracji:

- **Obraz produkcyjny nie zawiera listów.** `Dockerfile` kopiuje do etapu runtime tylko `build/`, `node_modules/`, `package.json` i `restore-drill.mjs`. `seedKoronaCorpus()` czyta `docs/99_Raw_Repo/letters/Korona/*.txt` w czasie działania — w kontenerze plików nie ma, więc zapisują się jednozdaniowe `fallbackBody`.
- **Nowe listy są niewidoczne.** `lemiesz_to_korona_05.txt` i `odpna4.txt` leżą w katalogu, ale seed ma zakodowaną listę 8 plików, więc ich nie wczytuje.

**Moment jest najtańszy z możliwych.** Stan bazy na 2026-10-19 (`data/lemiesz.db`): 19 źródeł, 35 tekstów źródeł — wszystkie `draft`, 9 argumentów, 8 listów, 53 zdarzenia recenzji — wszystkie od `system:seed`. Nie istnieje jeszcze żadna ludzka akceptacja, którą migracja mogłaby zgubić.

---

## 1. Diagnoza

1. **`docs/` miesza dwie dziedziny:** dokumentację inżynieryjną (Canon 02, 03, `10_Harness/`, `17_Robots/`) i korpus Ruchu (Canon 01, 04–09, listy, materiały surowe).
2. **Treść korpusu żyje w kodzie:** źródła, tłumaczenia, karty argumentów i metadane listów są literałami TypeScript w `src/lib/server/seed/koronaSeed.ts` i `seedData.ts`. Poprawka literówki w cytacie wymaga zmiany kodu i nie przechodzi przez recenzję treści.
3. **`docs/99_Raw_Repo/` nie odróżnia materiału zatwierdzonego od surowego:** oficjalna korespondencja leży obok `For_Processing/` (np. `Braun Grzegorz.md`, `Gadowski Witold.md`).
4. **Ścieżka produkcyjna jest zepsuta** (obraz bez plików listów, patrz §0).

---

## 2. Struktura katalogów

Korpus wydziela się do `corpus/` w korzeniu repozytorium. Nazwy katalogów są angielskie i ASCII (to klucze czytane przez kod); nazwy plików kanonów i treść pozostają polskie.

```text
corpus/
├── README.md                      # Mapa korpusu, konwencje frontmatter, polecenia
│
├── canon/                         # Doktryna Ruchu — przeniesiona z docs/00_Canon/, numery i nazwy BEZ ZMIAN
│   ├── 01_Ideological_Doctrine.md
│   ├── 04_Hedgehog_Doctrine_Educational_Visual_Canon.md
│   ├── 05_Metodologia_Obronnosci_Polski.md
│   ├── 06_Dekonstrukcja_Mitu_Niepodleglosci_i_Prawdziwa_Suwerennosc.md
│   ├── 07_Pan_Pokoju_i_Dekonstrukcja_Maksymy_Wegecjusza.md
│   ├── 08_Przelamanie_Augustynskiej_Iluzji.md
│   └── 09_Kowadlo_Pokoju_i_Symbolika_Narzedzi_Rolniczych.md
│
├── sources/                       # Teksty autorytatywne → tabele sources + source_texts
│   └── lk-14-rachunek-krolewski/
│       ├── source.yaml            # Metadane niezależne od języka (jedno miejsce)
│       ├── la.md                  # Oryginał (dosłowny tekst, nic poza nim)
│       ├── pl.md                  # Tłumaczenie PL (dosłowny tekst)
│       └── en.md                  # Tłumaczenie EN (dosłowny tekst)
│
├── correspondence/                # Wątki listów → correspondence_threads + correspondence_letters
│   ├── korona/
│   │   ├── _thread.yaml
│   │   ├── 01_out.md              # Tura 1, list wychodzący
│   │   ├── 01_in.md               # Tura 1, odpowiedź
│   │   └── …
│   └── prezydent-nawrocki/
│       ├── _thread.yaml
│       └── 2026-09-23_ONZ_81_sesja.md
│
└── intake/                        # Materiał surowy — NIGDY nie jest wczytywany do bazy
    ├── for_processing/            # Dawne docs/99_Raw_Repo/For_Processing/
    └── external_archive/          # Skany, materiały pomocnicze
```

Zasady:

- **Kategoria źródła żyje w `source.yaml`, nie w ścieżce.** Taksonomia folderów v1 (Pismo Święte / Magisterium / Prawo / Historia) nie pokrywa się z `CATEGORIES` w kodzie (`magisterium`, `geopolitics`, `economics`, `movement`); dwie taksonomie to złamanie Canon 03 D2. Jeśli kuratorzy potrzebują drobniejszego podziału, rozszerza się `CATEGORIES` (osobna decyzja).
- **Jeden język = jeden plik.** Każdy wiersz `source_texts` ma własny stan recenzji i własny `source_hash`; osobny plik daje osobny diff w Git i osobny reset recenzji. Ułatwia też ROBOT-05 (parzystość języków).
- **Plik tekstu źródła zawiera wyłącznie dosłowny tekst.** Komentarz teologiczny nie może leżeć w tym samym pliku: ROBOT-01 dopasowuje cytaty do zapisanego tekstu, więc komentarz w ciele pliku stałby się „cytowalny”. Komentarze należą do `canon/` lub do przyszłej publicystyki.
- **`intake/` jest poza ingestem.** Przejście z `intake/` do `sources/` lub `correspondence/` to zwykły PR — recenzja w Git jest bramą (D5).
- `corpus/articles/` i `corpus/culture/` (publicystyka, bajki, teksty pieśni) **nie są tworzone teraz.** Teksty pieśni mają już dom w `media_assets` pod ROBOT-10; nie przenosimy ich bez potrzeby.

Po migracji `docs/00_Canon/` zawiera wyłącznie Canon 02 i Canon 03 — reguły inżynieryjne.

---

## 3. Podział władzy: plik ↔ SQLite

To jest rdzeń propozycji. Pliki i baza nie konkurują, bo **każda informacja ma dokładnie jednego właściciela.**

| Właściciel | Co posiada | Gdzie się to edytuje |
|---|---|---|
| **Plik w `corpus/`** | Treść (tekst źródła, tłumaczenia, treść listu) i metadane statyczne: `slug`, `work`, `section_ref`, `category`, `url`, `license`, `cleared_to_store`, `original_locale`, `origin`, `translator`; nadawca, odbiorca, data, streszczenia listu | Git → PR → merge → ingest |
| **SQLite** | Tożsamość wierszy (`id`), stan recenzji (`review`), historia recenzji (`review_events`), wyniki audytu (`audit_json`, `audit_notes`, modele), embeddingi, wyekstrahowane `key_claims_json`, użytkownicy, sesje, rozmowy, szkice treści, media, plakaty | UI (`/review`, `/repository`, `/media`) |

### 3.1. Tożsamość

- Każde źródło dostaje stabilny `slug` (nazwa katalogu). Migracja `008` dodaje `sources.slug TEXT UNIQUE` i uzupełnia go dla 19 istniejących wierszy mapą `(work, section_ref) → slug`, aby istniejące `id` — a więc odwołania `[[src:ID]]`, `argument_sources` i historia recenzji — przetrwały.
- Listy mają już klucz `correspondence_letters.filename UNIQUE`. Migracja przepisuje go na ścieżkę względną w `corpus/` (`korona/01_out.md`) w tym samym kroku co zmiana plików.

### 3.2. Reguły ingestu (idempotentne)

Ingest liczy hash treści każdego pliku i porównuje go z istniejącą kolumną `source_hash`:

1. **Nowy `slug`** → `INSERT` z `review = 'draft'`, zdarzenie w `review_events` od aktora `system:ingest`.
2. **Hash bez zmian** → nic się nie dzieje. Stan recenzji, w tym `human_approved`, zostaje.
3. **Hash zmieniony** → aktualizacja tekstu, `review → 'draft'` przez `setReview` oraz `markDependentsStale` dla zależnych kart argumentów — dokładnie to, czego wymaga Canon 02 §1.2. `canTransition` już pozwala systemowi na przejście do `draft`.
4. **Plik usunięty** → ingest **nie usuwa** wiersza. Zgłasza go w raporcie; usunięcie pozostaje ręczną decyzją w `/repository`.
5. **Błąd walidacji** (`validateIngestionChecklist`) → plik jest pomijany z czytelnym błędem; ingest nie przerywa startu serwera, ale `pnpm corpus:check` kończy się kodem ≠ 0.

### 3.3. Edycja w UI

Wiersze z niepustym `slug` (pochodzące z korpusu) są w `/repository` **tylko do odczytu w zakresie treści** — zmienia się je w Git. UI nadal zmienia ich stan recenzji. Wiersze bez `slug` (dodane ręcznie w UI) zachowują obecne zachowanie. Bez tej reguły edycja w UI i ingest nadpisywałyby się nawzajem.

### 3.4. Gdzie działa ingest

- Moduł serwerowy w TypeScript (`src/lib/server/corpus/ingest.ts`), który używa istniejących `createSource`, `upsertSourceText`, `validateIngestionChecklist` i `extractClaimsFromLetter` — bez osobnego skryptu `.mjs` duplikującego walidację.
- Wywoływany w `hooks.server.ts` w miejscu `seedKoronaCorpus()` oraz przez `pnpm corpus:check` (sama walidacja, bez zapisu; do CI i przed commitem).
- `Dockerfile` kopiuje `corpus/` do etapu runtime. Zmiana treści w produkcji = nowy obraz; przy obecnej skali to akceptowalne i daje audytowalność.

### 3.5. Disaster recovery

Odbudowa z plików odtwarza **treść**, nie stan recenzji. Mechanizmem DR pozostają kopie zapasowe (`src/lib/server/backup.ts`, `scripts/restore-drill.mjs`). Polecenie `db:rebuild` z v1 nie powstaje.

### 3.6. Formaty plików

**`corpus/sources/lk-14-rachunek-krolewski/source.yaml`**
```yaml
slug: lk-14-rachunek-krolewski
work: "Ewangelia wg św. Łukasza — Rachunek Królewski (Luke 14)"
section_ref: "Łk 14, 31–32"
category: magisterium
url: "https://www.vatican.va/archive/bible/nova_vulgata/documents/nova-vulgata_nt_evang-lucam_lt.html#14"
original_locale: la
cleared_to_store: true
license: "DO WERYFIKACJI — patrz §5"
```

**`corpus/sources/lk-14-rachunek-krolewski/pl.md`**
```markdown
---
origin: official_translation
translator: "<wydanie i rok, np. Biblia Tysiąclecia, wyd. V>"
license: "<licencja tego tłumaczenia, jeśli inna niż w source.yaml>"
keywords: "rachunek królewski, Łk 14, król, poselstwo, warunki pokoju, roztropność"
---
<dosłowny tekst wersetów, bez komentarza>
```

**`corpus/correspondence/korona/01_out.md`**
```markdown
---
turn_number: 1
direction: outbound
sender: "Bogdan Zięba (Przymierze Lemiesza)"
recipient: "Konfederacja Korony Polskiej (Biuro Poselskie)"
date_label: "17 IX 2026"
summary_pl: "List I: Propozycja ogłoszenia Polski „Oazą Pokoju i Neutralności w Europie Środkowej”…"
summary_en: "Letter I: Proposal to proclaim Poland an \"Oasis of Peace and Neutrality in Central Europe\"…"
---
<pełna treść listu>
```

Względem v1 z frontmatter listu usunięto `thread_slug` (wynika z katalogu) i `key_claims`. Tezy są dziś wyciągane z treści automatycznie (`extractClaimsFromLetter`); ręczna lista w pliku byłaby drugim domem tego samego faktu, a parafrazy w niej nie przeszłyby kontroli dosłowności ROBOT-01.

---

## 4. Roboty

Zgodnie z Canon 03 D1 każda nowa reguła z §2–§3 dostaje strażnika:

- **ROBOT-08 (rozszerzenie):** sprawdzanie linków, kotwic i ścieżek lokalnych obejmuje także `corpus/`. Bez tego przeniesione kanony tracą ochronę przed rozpadem linków.
- **ROBOT-11 · Corpus Schema Gate (nowy):** każdy plik w `corpus/sources/` i `corpus/correspondence/` przechodzi `validateIngestionChecklist` (w tym regułę licencji ROBOT-07); `slug` są unikalne; kody języków są w rejestrze; `turn_number` + `direction` są unikalne w wątku; plik tekstu źródła nie zawiera nagłówków Markdown (pilnuje reguły „tylko dosłowny tekst”). Dowód porażki: fixture z duplikatem `slug`, z pustą licencją i z nagłówkiem w `pl.md`.

---

## 5. Blokada licencyjna

Pole `license` istniejących źródeł biblijnych deklaruje domenę publiczną (Biblia Gdańska / World English Bible), ale zapisane teksty wyglądają na **Biblię Tysiąclecia** (PL, © Pallottinum) i **English Standard Version** (EN, © Crossway). Dotyczy to bazy już dziś, niezależnie od tej propozycji. Migracja przeniosłaby fałszywy zapis licencji do „jedynego źródła prawdy”.

Przed Fazą 3 kurator treści wybiera dla każdego źródła jedno z dwóch:

- **zamienić tekst** na wersję rzeczywiście z domeny publicznej (Biblia Gdańska, Biblia Wujka, WEB, Douay-Rheims) — wtedy zmienia się tekst i stan recenzji wraca do `draft`, co jest poprawne;
- **zachować tekst** i wpisać prawdziwą licencję oraz podstawę prawa cytatu, z `cleared_to_store` ustawionym zgodnie z tą decyzją.

To samo sprawdzenie dotyczy encyklik (teksty © Libreria Editrice Vaticana) i pozostałych 19 źródeł.

---

## 6. Plan migracji

Każda faza to osobny PR, który da się wycofać `git revert`, i każda kończy się zielonym `pnpm check`, `pnpm test`, `pnpm robots` oraz `pnpm smoke`. Ingest nigdy nie usuwa wierszy; przed pierwszym ingestem w produkcji wykonuje się kopię zapasową.

### Faza 0 · Przygotowanie (bez zmian w kodzie)
1. Zacommitować Canon 09 i nowe listy (`lemiesz_to_korona_05.txt`, `odpna4.txt`) — decyzja autorów, czy są gotowe.
2. Poprawić `docs/README.md`: usunąć nieistniejące wpisy (`01_Architecture/`, `01_Testing_Strategy.md`, brakujące moduły) albo oznaczyć je jako planowane.
3. Kurator rozstrzyga §5 dla wszystkich źródeł.

### Faza 1 · Kanony (bez zmian w kodzie)
1. `git mv` kanonów 01, 04–09 do `corpus/canon/` z zachowaniem nazw.
2. Aktualizacja linków w `docs/`, `src/` (komentarze), `scripts/` i `tests/`.
3. Rozszerzenie ROBOT-08 na `corpus/`; `pnpm robots` zielone.

### Faza 2 · Korespondencja
1. Migracja `008`: przepisanie `correspondence_letters.filename` na ścieżki w `corpus/`.
2. Konwersja listów Korony (w tym 05 i odpowiedzi na 4) oraz wystąpienia ONZ do `.md` z frontmatter; `_thread.yaml` dla obu wątków.
3. `src/lib/server/corpus/ingest.ts` dla korespondencji; `KORONA_LETTERS_META` i `fallbackBody` znikają z `koronaSeed.ts`.
4. `Dockerfile` kopiuje `corpus/`.
5. Test: ingest do pustej bazy daje te same 8 listów co obecny seed (porównanie `body` i metadanych z eksportem dzisiejszej bazy) plus nowe listy.

### Faza 3 · Źródła
1. Migracja `009`: `sources.slug UNIQUE` z uzupełnieniem dla istniejących wierszy.
2. **Jednorazowy eksport plików z obecnej bazy** (nie ręczne przepisywanie — teksty muszą pozostać dosłowne), następnie ręczne poprawki licencji z Fazy 0.
3. Ingest źródeł z regułami §3.2; `KORONA_SOURCES`, `POLISH_TRANSLATIONS_FOR_INITIAL_SEED` i `SEED_SOURCES` znikają z kodu.
4. ROBOT-11 z dowodem porażki; `pnpm corpus:check` w `package.json`.
5. `/repository`: treść wierszy z `slug` tylko do odczytu (§3.3).

### Faza 4 · Do decyzji później
Karty argumentów (`KORONA_ARGUMENTS`), publicystyka, teksty kultury, indeksowanie listów w FTS (D6). Każde z nich to osobna propozycja, gdy Fazy 1–3 będą w produkcji.

---

## 7. Decyzje do podjęcia

| # | Zagadnienie | Rekomendacja | Alternatywa | Uzasadnienie |
|---|---|---|---|---|
| **D1** | Lokalizacja korpusu | `corpus/` w korzeniu | `docs/corpus/` | Czysty podział `src/` · `docs/` · `corpus/`; Dockerfile kopiuje jeden katalog |
| **D2** | Język nazw katalogów | Angielski ASCII (`canon/`, `sources/`, `correspondence/`, `intake/`); nazwy plików kanonów bez zmian | Polski (`00_Kanon/` …) | Ścieżki są kluczami w kodzie; bez znaków diakrytycznych i spacji w ścieżkach |
| **D3** | Format listów | `.md` z frontmatter, jeden plik na turę | `.txt` + osobny YAML | Metadane i treść w jednym diffie |
| **D4** | Numeracja kanonów | Bez zmian (01, 04–09) | Przenumerowanie od 01 | 76 istniejących odwołań; numer kanonu to identyfikator |
| **D5** | Brama dla `intake/` | PR w Git; `intake/` nigdy nie trafia do bazy; nowe wiersze zawsze jako `draft` | Automatyczny ingest `intake/` jako `draft` | Recenzja treści w PR + recenzja stanu w `/review`; surowe materiały nie trafiają do RAG Tarczy |
| **D6** | Listy w FTS / RAG | Odłożyć do Fazy 4 | Dodać teraz | Wymaga rozszerzenia `owner_type` w `embeddings` i `review_events` oraz decyzji, czy listy podlegają recenzji |
| **D7** | Edycja treści korpusu w UI | Tylko w Git; UI zmienia stan recenzji | Edycja w UI z zapisem do plików | Zapis z kontenera produkcyjnego nie trafia do Git — łamie założenie „plik jest właścicielem treści” |

---

## 8. Co usunięto z v1 i dlaczego

- **Część II („Spichlerz Lemiesza”)** — przeniesiona do [Propozycja_Spichlerz_UI.md](Propozycja_Spichlerz_UI.md). UI zależy od Faz 2–3; projektowanie go teraz zamraża model danych, który dopiero się ustala.
- **„Ephemeral cache” i `db:rebuild`** — sprzeczne z Canon 02 §1.2 (§0, A5).
- **Przenumerowanie kanonów** — (§0, A4).
- **Taksonomia folderów źródeł** — druga taksonomia obok `CATEGORIES` (§2).
- **`key_claims` we frontmatter** — drugi dom faktu (§3.6).
- **`03_Publicystyka/`, `04_Kultura_i_Edukacja/`** — puste katalogi bez treści i bez decyzji o ingeście; wracają w Fazie 4.
- **Niezmierzone liczby wydajności** — (§0, A9).
