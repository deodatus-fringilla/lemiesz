# Propozycja Architektoniczna v3.1 · SQLite jako Jedyny Dom Danych, `data/baseline.sql` i Emerytura Seedów `.ts`
*(Architectural Specification v3.1: SQLite as Single Owner of Structured Data, `data/baseline.sql`, and Full Retirement of `.ts` Seeds)*

> **Doc type: CONSULTATION & ARCHITECTURAL PROPOSAL (point-in-time).**  
> **STATUS: APPROVED FOR EXECUTION (Konsensus Architekt + Antigravity AI + Claude).**  
> **Wersja:** v3.1 · 2026-10-19 (jednolita specyfikacja wykonawcza łącząca architekturę v3 z poprawkami P1–P6 z recenzji krzyżowej Claude; zastępuje v1 `542c603`/`9585458` oraz v2 `ecdf245`)  
> **Autorzy:** Lead Architect, Antigravity AI, Claude  
> **Zakres:** docelowa struktura `corpus/`, całkowita likwidacja plików seedujących `.ts`, deterministyczny zrzut `data/baseline.sql`, izolacja testów, korekta licencji i atrybucji przekładów oraz 3-fazowy plan wdrożenia. Rozwój czytnika UI opisuje osobny dokument: [Propozycja_Spichlerz_UI.md](Propozycja_Spichlerz_UI.md).

---

## 1. Podsumowanie Wykonawcze (Uzgodniona Architektura)

Po audycie wersji v1 i v2 oraz recenzji krzyżowej wersji v3 przyjęto następującą architekturę docelową:

1. **Jeden dom dla każdego typu treści ([Canon 03 D2](../00_Canon/03_Rules_of_Engagement.md) — *One Fact, One Home*):**
   - **Długie traktaty doktrynalne** (Kanony `01`, `04`–`09` z zachowaniem dotychczasowej numeracji i nazw plików) mieszkają w `corpus/canon/*.md`, a materiały robocze w `corpus/intake/`.
   - **Wszystkie dane ustrukturyzowane** (źródła `sources` + `source_texts`, karty argumentów `arguments` + `argument_texts`, wątki i listy `correspondence_threads` + `correspondence_letters`, media `media_assets`, plakaty `campaign_posters`, stany recenzji `review` i historia `review_events`) mieszkają **wyłącznie w bazie SQLite**. Nie tworzymy równoległego drzewa 60 plików `.yaml`/`.md` ani silnika synchronizacji `ingest.ts`.
   - **Dokumentacja techniczna** zostaje w `docs/` (w `docs/00_Canon/` zostają wyłącznie [02_Architecture_Manifesto.md](../00_Canon/02_Architecture_Manifesto.md) i [03_Rules_of_Engagement.md](../00_Canon/03_Rules_of_Engagement.md)).
2. **100% emerytura plików seedujących `.ts`:**
   - Usuwamy wszystkie pięć plików danych startowych z kodu aplikacji (`seed.ts`, `seedData.ts`, `koronaSeed.ts`, `mediaSeed.ts`, `seriesSeed.ts` — łącznie ~88 kB kodu TypeScript) oraz ich wywołania z `src/hooks.server.ts`.
   - W `src/lib/server/seed/checklist.ts` zostaje wyłącznie walidator granic `validateIngestionChecklist` (chroniony przez [ROBOT-07](../17_Robots/ROBOT-07-license-and-storage-gate.md)).
3. **Deterministyczny zrzut tekstowy `data/baseline.sql` w Git:**
   - Zamiast trzymać dane w literałach `.ts` albo w binarnym pliku `.db`, w Git przechowujemy deterministyczny tekstowy zrzut `INSERT`-ów dla jawnej białej listy tabel treściowych: `data/baseline.sql`.
   - Każda zmiana cytatu, licencji, argumentu czy listu jest w pełni czytelna w `git diff` i PR (zgodnie z [Canon 03 D5](../00_Canon/03_Rules_of_Engagement.md)), bez rozdymania historii Git binarnymi kopiami bazy.
4. **Pełna edytowalność w UI:**
   - Widoki `/repository`, `/arguments`, `/media` oraz korespondencja pozostają w pełni edytowalne w przeglądarce (brak blokady read-only z v2). Jedyną bazą główną (*master*), z której wykonywana jest migawka `pnpm db:snapshot`, jest lokalna baza deweloperska Architekta (`./data/lemiesz.db`).

---

## 2. Struktura Katalogów i Podział Własności

```text
corpus/
├── README.md          # Spis kanonów doktrynalnych i zasady pracy z intake/
├── canon/             # Kanony 01, 04–09 (numery i nazwy plików BEZ ZMIAN — ochrona 76 referencji)
│   ├── 01_Ideological_Doctrine.md
│   ├── 04_Hedgehog_Doctrine_Educational_Visual_Canon.md
│   ├── 05_Metodologia_Obronnosci_Polski.md
│   ├── 06_Dekonstrukcja_Mitu_Niepodleglosci_i_Prawdziwa_Suwerennosc.md
│   ├── 07_Pan_Pokoju_i_Dekonstrukcja_Maksymy_Wegecjusza.md
│   ├── 08_Przelamanie_Augustynskiej_Iluzji.md
│   └── 09_Kowadlo_Pokoju_i_Symbolika_Narzedzi_Rolniczych.md
└── intake/            # Materiał warsztatowy (dawne docs/99_Raw_Repo/For_Processing/ i surowe .txt)
```

| Właściciel | Co przechowuje | Gdzie się edytuje |
|---|---|---|
| **`corpus/canon/`** | Traktaty doktrynalne (`01`, `04`–`09`) | Edytor kodu / Git |
| **`corpus/intake/`** | Surowe notatki, materiały przed obróbką | Edytor kodu / Git |
| **SQLite + `data/baseline.sql`** | `sources`, `source_texts`, `arguments`, `argument_texts`, `argument_sources`, `correspondence_threads`, `correspondence_letters`, `media_assets`, `campaign_posters`, `argument_poster_links`, `argument_media_links`, `review_events` | UI (`/repository`, `/arguments`, `/media`, `/review`, korespondencja) + migracje SQL → `pnpm db:snapshot` |
| **SQLite (tylko runtime, poza Git)** | `users`, `sessions`, `conversations`, `messages`, `content_drafts`, `card_usage`, `pipeline_runs`, `embeddings` | Wyłącznie w czasie działania aplikacji (nigdy nie trafia do `baseline.sql`) |

---

## 3. Mechanizm `data/baseline.sql`, Start Bazy i Izolacja Testów

### 3.1. Biała lista tabel i `pnpm db:snapshot`
Skrypt `pnpm db:snapshot` (ok. 60 linii w oparciu o `better-sqlite3`, bez zależności od zewnętrznego CLI `sqlite3`) czyta lokalną bazę główną `./data/lemiesz.db` i zapisuje do `data/baseline.sql` deterministyczny zrzut `INSERT INTO ...` wyłącznie dla **białej listy tabel dozwolonych** (*allowlist*), posortowany po tabeli i kluczu głównym:

1. `sources`
2. `source_texts`
3. `arguments`
4. `argument_texts`
5. `argument_sources`
6. `correspondence_threads`
7. `correspondence_letters`
8. `media_assets`
9. `campaign_posters`
10. `argument_poster_links`
11. `argument_media_links`
12. `review_events`

**Zasady bezpieczeństwa zrzutu:**
- Nagłówek `data/baseline.sql` zapisuje nazwę najnowszej migracji w momencie zrzutu (np. `-- baseline-migration: 008_corpus_baseline.sql`). Test niezmienników (`baseline.test.ts`) kończy się błędem, jeśli ten wpis jest starszy niż najnowszy plik w `src/lib/server/migrations/`.
- Tabele wirtualne FTS5 (`fts_pl`, `fts_en`, `fts_media`) **nie są zrzucane** — `fts_media` wypełnia się przez własne triggery `AFTER INSERT`, a `fts_pl` i `fts_en` odbudowuje wywołanie `rebuildFts()` po załadowaniu `baseline.sql`.
- Tabela `_migrations` **nie jest zrzucana**, ponieważ przy inicjalizacji nowej bazy `runMigrations()` wykonuje się przed załadowaniem `data/baseline.sql`.
- Wszystkie tabele spoza białej listy (`users`, `sessions`, `conversations`, `messages`, `content_drafts`, `card_usage`, `pipeline_runs`, `embeddings`) są z definicji pomijane.
- W kolumnach audytowych (`updated_by`, `reviewed_by`, `review_events.actor`) akceptujemy zapisywanie identyfikatorów kuratorów (obecnie `seed` / `system:seed`).

### 3.2. Inicjalizacja świeżej bazy a istniejące wdrożenia (ochrona przed kolizją migracji danych z `baseline.sql`)
1. **Świeża baza (nowy kontener Docker, nowy klon repozytorium, `pnpm smoke`, testy korpusu):**
   - W `src/lib/server/db.ts` sprawdzamy przed otwarciem połączenia, czy plik docelowy jest nowy: `!fs.existsSync(DB_PATH) && !fs.existsSync(DB_PATH + '-wal')` (lub `DB_PATH === ':memory:'`).
   - Po utworzeniu bazy i wykonaniu `runMigrations()`, jeśli zmienna `DATABASE_BASELINE` nie jest ustawiona na `'off'`, wykonywany jest `db.exec(fs.readFileSync(baselinePath, 'utf8'))` w jednej transakcji oraz `rebuildFts()`.
   - `Dockerfile` kopiuje `data/baseline.sql` (do `/app/data/baseline.sql`) oraz `corpus/` do obrazu runtime, podczas gdy właściwa baza działa na wolumenie `/data/lemiesz.db`. Tym samym **znika produkcyjny błąd `fallbackBody` dla listów**, a `src/hooks.server.ts` nie wywołuje już żadnych funkcji `seed*()`.
2. **Istniejące bazy danych i reguła warunkowych migracji danych:**
   - Ponieważ na świeżej bazie najpierw wykonuje się `runMigrations()`, a zaraz potem ładuje `data/baseline.sql`, **każda migracja SQL modyfikująca lub dopisująca dane (`008_...sql`) musi być bezpieczna na pustej bazie (no-op gdy tabele są puste)**:
     - korekty wykonujemy przez `UPDATE ... WHERE ...`,
     - dopisywanie wierszy (np. brakujących listów w `008`) wykonujemy przez `INSERT INTO ... SELECT ... WHERE EXISTS (SELECT 1 FROM correspondence_threads WHERE slug = 'korona')`. Dzięki temu na istniejącej bazie migracja `008` dopisze brakujące listy, natomiast na świeżej (pustej) bazie nic nie wstawi, pozwalając `data/baseline.sql` załadować kompletny stan bez kolizji klucza `UNIQUE` na `correspondence_letters.filename`.
   - **Każdej migracji danych towarzyszy w tym samym commicie wykonanie `pnpm db:snapshot`**, czego pilnuje test porównujący nagłówek `-- baseline-migration:` w `data/baseline.sql` z listą plików w `src/lib/server/migrations/`.

### 3.3. Izolacja testów (`DATABASE_BASELINE` i projekty Vitest)
Zmienna `SEED_ON_EMPTY` zostaje wycofana razem z seedami i zastąpiona jawną zmienną `DATABASE_BASELINE` (`ścieżka do .sql` | `'off'`, domyślnie `./data/baseline.sql`):

| Grupa testów | Pliki | Konfiguracja `DATABASE_BASELINE` |
|---|---|---|
| **1. Testy jednostkowe i izolowane roboty** (budują własne fixture'y i sprawdzają kolejność wyników, np. `r.sources[0]`) | `rag/retrieve.test.ts`, `shield/shield.test.ts`, `content/content.test.ts`, `pipeline/pipeline.test.ts`, `backup.test.ts`, `health.test.ts`, `db.test.ts`, `auth.test.ts`, `llm/llm.test.ts`, `eval/harness.test.ts`, `sources.test.ts` (część CRUD), `media.test.ts` (część CRUD), `posters.test.ts` (część CRUD); roboty `01`, `02`, `03`, `06`, `09`, `10` | **`DATABASE_BASELINE = 'off'`** w domyślnym `vitest.setup.ts` → startują na **pustej** bazie po migracjach |
| **2. Testy usuniętych funkcji `seed*()`** | `correspondence.test.ts` (test idempotencji `seedKoronaCorpus`), `sources.test.ts:39–67`, `media.test.ts:233`, `posters.test.ts:113` | **Usuwane** razem z plikami `*Seed*.ts` (zastąpione testem niezmienników `baseline.test.ts`) |
| **3. Testy wymagające pełnego korpusu startowego** | `tests/robots/robot-04-golden-set.robot.ts`, `tests/robots/robot-07-license-storage.robot.ts` (w `vitest.robots.config.ts`), `src/lib/server/seed/verify.eval.ts` (w `vitest.eval.config.ts`), `baseline.test.ts` (w `vite.config.ts`), `scripts/smoke.mjs`, przyszłe testy E2E Playwright | **`DATABASE_BASELINE = './data/baseline.sql'`** (osobny projekt Vitest z `vitest.baseline.setup.ts` w `vitest.robots.config.ts` i `vite.config.ts`, oraz w `vitest.eval.config.ts`) |

**Zasada asercji na bazie startowej:** Testy z Grupy 3 sprawdzają **niezmienniki**, a nie sztywne liczby wierszy (aby dodanie nowego listu czy źródła przez `pnpm db:snapshot` nie psuło testów):
- nagłówek `-- baseline-migration:` w `data/baseline.sql` zgadza się z najnowszą migracją w `src/lib/server/migrations/`,
- każde źródło i tekst w bazie przechodzi `validateIngestionChecklist`,
- każdy list w `correspondence_letters` ma `length(body) > 300` (wykrywa regresję typu `fallbackBody`),
- każdy `image_path` w `campaign_posters` istnieje na dysku w `static/`,
- wszystkie tabele spoza białej listy są w świeżo zainicjowanej bazie puste (`COUNT(*) = 0`).

---

## 4. Licencje, Atrybucja Przekładów (`translator`) i Weryfikacja Dosłowności Cytatów Biblijnych

Krótkie przytoczenia biblijne (2–6 wersetów) w repozytorium ideowym i polemicznym korzystają z ustawowego **prawa cytatu** (art. 29 ust. 1 ustawy o prawie autorskim i prawach pokrewnych) oraz anglosaskiego *Fair Use*. Nie stanowią one blokady prawnej, wymagają jednak rzetelnej atrybucji (art. 34 pr. aut.) oraz dosłowności względem wskazanego wydania ([Canon 03 D5](../00_Canon/03_Rules_of_Engagement.md), [ROBOT-01](../17_Robots/ROBOT-01-verbatim-quotation-gate.md)).

W ramach migracji SQL (`008_corpus_baseline.sql`) wprowadzamy następujące uporządkowanie:

1. **Rozdział licencji od nazwy przekładu:**
   - W tabeli `sources` pole `license` dla 4 źródeł biblijnych otrzymuje wartość:
     ```text
     Prawo cytatu (art. 29 ust. 1 pr. aut.) / Fair Use — krótkie przytoczenie w celach polemicznych i edukacyjnych; przekład wskazany w polu translator
     ```
   - Nazwa konkretnego przekładu trafia do istniejącej kolumny zależnej od języka `source_texts.translator` (np. `"Biblia Tysiąclecia, wyd. V (© Pallottinum)"`, `"Biblia Gdańska (1632, domena publiczna)"`, `"English Standard Version (ESV, © Crossway)"`, `"King James Version (KJV, public domain)"`).
2. **Weryfikacja dosłowności 4 tekstów biblijnych przed zrzutem `baseline.sql`:**
   - **Łk 14, 31–32 (PL i EN):** weryfikacja dosłowności względem *Biblii Tysiąclecia (wyd. V)* oraz *ESV* i wpisanie tych wydań w `source_texts.translator`.
   - **J 10, 11–13 (PL i EN):** weryfikacja dosłowności względem *Biblii Tysiąclecia (wyd. V)* oraz *ESV*.
   - **Iz 2, 4; Mt 5, 9 (PL i EN):** ujednolicenie tekstu polskiego i angielskiego do jednego jawnie wskazanego przekładu w `translator` (usunięcie hybrydy łączącej sformułowania *Biblii Gdańskiej* z *Biblią Tysiąclecia* w Iz 2, 4 PL oraz KJV z ESV w EN).
   - **1 Sm 8, 11–17 (PL i EN):** uzupełnienie pełnego brzmienia wersetów 11–17 zgodnie z wydaniem w `translator` (lub jawne oznaczenie opuszczonych wersetów symbolem `[…]` i uaktualnienie powiązanego `span` w karcie argumentu).
3. **Widoczność atrybucji w UI i Tarczy:**
   - Widok `/repository` oraz odpowiedzi `/shield` wyświetlają obok cytatu nie tylko tytuł dzieła (`work`, `section_ref`), lecz także `translator` (jeśli występuje) oraz `license`, spełniając wymóg art. 34 pr. aut. oraz warunki cytowania ESV.

---

## 5. Dostosowanie Floty Robotów i Ewaluacji

Nie tworzymy `ROBOT-11`. Aktualizujemy istniejące bramki pod architekturę `baseline.sql`:

1. **[ROBOT-04](../17_Robots/ROBOT-04-golden-set-retrieval.md) (`src/lib/server/eval/harness.ts`):**
   - `prepareEvalCorpus()` działa na bazie zainicjowanej z `data/baseline.sql` (zamiast `runSeed()`).
   - Zbiór wzorcowy `GOLDEN` identyfikuje źródła po stabilnym kluczu głównym `id` z `baseline.sql` (z pomocniczą asercją nazwy dzieła), dzięki czemu drobna korekta redakcyjna tytułu w UI nie psuje po cichu ewaluacji.
2. **[ROBOT-07](../17_Robots/ROBOT-07-license-and-storage-gate.md) (`tests/robots/robot-07-license-storage.robot.ts`):**
   - Uruchamiany w projekcie baseline w `vitest.robots.config.ts` z załadowanym `data/baseline.sql`.
   - Zamiast iterować po usuniętym `SEED_SOURCES` (7 wierszy), odpytuje wszystkie wiersze `sources` JOIN `source_texts` z bazy i weryfikuje, że **każdy z 35 tekstów źródeł** przechodzi `validateIngestionChecklist` (mapując `reviewer: row.updated_by`).
   - Reguła statyczna w linii 82 sprawdza, że każdy produkcyjny wywołujący `createSource` importuje `validateIngestionChecklist` (usuwamy z regexu martwą alternatywę `|runSeed`).
3. **[ROBOT-08](../17_Robots/ROBOT-08-doc-rot-and-census-gate.md) (`scripts/robots/census-gate.mjs`):**
   - Rozszerzamy listę skanowanych plików Markdown z `docs/` na `docs/` + `corpus/`, chroniąc przeniesione kanony przed martwymi linkami i zepsutymi kotwicami.
4. **Kontrola pochodzenia URL (`src/lib/server/seed/verify.eval.ts`):**
   - W migracji `008` dodajemy kolumnę `sources.verbatim_url_check INTEGER NOT NULL DEFAULT 0` (ustawioną na `1` dla 7 źródeł weryfikowanych względem strony źródłowej `url`). `verify.eval.ts` (uruchamiany przez `vitest.eval.config.ts` z `DATABASE_BASELINE='./data/baseline.sql'`) pobiera te wiersze bezpośrednio z bazy zamiast z usuniętego `seedData.ts`.

---

## 6. Plan Wdrożenia (3 Fazy)

Każda faza to osobny, odwracalny krok kończący się zielonym `pnpm check`, `pnpm test`, `pnpm robots` i `pnpm smoke`.

### Faza 1 · Porządek w `docs/` i Utworzenie `corpus/canon/` (bez zmian w kodzie aplikacji)
1. Zacommitowanie `docs/00_Canon/09_Kowadlo_Pokoju_i_Symbolika_Narzedzi_Rolniczych.md` oraz nowych plików listów (`lemiesz_to_korona_05.txt`, `odpna4.txt`).
2. `git mv` kanonów doktrynalnych `01`, `04`–`09` z `docs/00_Canon/` do `corpus/canon/` (numery i nazwy bez zmian). W `docs/00_Canon/` zostają wyłącznie `02` i `03`.
3. `git mv` materiałów z `docs/99_Raw_Repo/For_Processing/` do `corpus/intake/for_processing/`, utworzenie `corpus/README.md` oraz uporządkowanie `docs/README.md`.
4. Aktualizacja linków względnych w `docs/`, `src/`, `scripts/` i `tests/` oraz rozszerzenie `ROBOT-08` (`scripts/robots/census-gate.mjs`) na `corpus/`.

### Faza 2 · Migracja `008`, `data/baseline.sql` i Całkowita Emerytura Seedów `.ts`
1. **Warunkowa migracja `008_corpus_baseline.sql` (§3.2 pkt 2):**
   - dodanie `sources.verbatim_url_check`,
   - aktualizacja `sources.license` oraz `source_texts.translator` i ujednolicenie brzmienia 4 tekstów biblijnych (§4),
   - warunkowe (`WHERE EXISTS (SELECT 1 FROM correspondence_threads WHERE slug = 'korona')`) wczytanie pełnych treści listów Korony (1–8 oraz nowych `odpna4.txt` i `lemiesz_to_korona_05.txt`) oraz wątku ONZ do istniejącej bazy, a następnie przeniesienie surowych plików `.txt` z `docs/99_Raw_Repo/letters/` do `corpus/intake/letters_archive/` i usunięcie pustego `docs/99_Raw_Repo/`.
2. **Skrypt `pnpm db:snapshot` (`scripts/db-snapshot.mjs`) i wygenerowanie `data/baseline.sql`:**
   - eksport białej listy 12 tabel treściowych (§3.1) z nagłówkiem `-- baseline-migration: 008_corpus_baseline.sql` do `data/baseline.sql`,
   - zamiana `/data` na `/data/*` oraz dodanie `!/data/baseline.sql` w `.gitignore`,
   - dodanie `COPY data/baseline.sql ./data/baseline.sql` w `Dockerfile`.
3. **Inicjalizacja z `data/baseline.sql` w `src/lib/server/db.ts`:**
   - ładowanie `data/baseline.sql` + `rebuildFts()` przy tworzeniu nowej bazy, gdy `DATABASE_BASELINE !== 'off'`.
4. **Usunięcie 5 plików seedujących i martwego kodu:**
   - `git rm` dla `seed.ts`, `seedData.ts`, `koronaSeed.ts`, `mediaSeed.ts`, `seriesSeed.ts`,
   - usunięcie ich wywołań z `src/hooks.server.ts`.
5. **Aktualizacja testów i robotów (§3.3, §5):**
   - `vitest.setup.ts` ustawia `DATABASE_BASELINE = 'off'`,
   - wydzielenie projektu baseline (`vitest.baseline.setup.ts`) w `vitest.robots.config.ts` (dla `ROBOT-04` i `ROBOT-07`), w `vite.config.ts` (dla testu niezmienników `baseline.test.ts`) oraz w `vitest.eval.config.ts` (dla `verify.eval.ts`),
   - usunięcie testów testujących wycofane funkcje `seed*()`,
   - wyświetlenie `translator` i `license` w UI `/repository` i `/shield`.

### Faza 3 · Formularz CRUD dla Korespondencji i Rozwój Czytnika w `/repository`
1. Dodanie w UI możliwości dodawania i edycji listów w `correspondence_letters` (aby kolejne tury korespondencji dodawać z poziomu przeglądarki, a następnie utrwalać przez `pnpm db:snapshot`).
2. Rozbudowa `/repository` zgodnie z [Propozycja_Spichlerz_UI.md](Propozycja_Spichlerz_UI.md).

---

## 7. Tabela Zatwierdzonych Decyzji (D1–D7)

| # | Zagadnienie | Zatwierdzona decyzja (v3.1) |
|---|---|---|
| **D1** | Lokalizacja korpusu doktrynalnego | `corpus/canon/` (Kanony `01, 04–09`) oraz `corpus/intake/` w korzeniu repozytorium |
| **D2** | Dom dla źródeł, argumentów, listów, mediów i plakatów | **Wyłącznie SQLite**; bazą główną (*master*) do edycji i zrzutów jest lokalne `./data/lemiesz.db` Architekta |
| **D3** | Reprezentacja bazy startowej w Git | **Deterministyczny zrzut tekstowy `data/baseline.sql`** z białej listy 12 tabel treściowych (`pnpm db:snapshot`) |
| **D4** | Los plików `src/lib/server/seed/*Seed*.ts` | **100% usunięcie** w Fazie 2; zostaje wyłącznie `checklist.ts` i `verify.eval.ts` |
| **D5** | Licencje i przekłady cytatów biblijnych | `sources.license` = prawo cytatu (art. 29 ust. 1 pr. aut. / Fair Use); konkretne wydanie w `source_texts.translator`; weryfikacja dosłowności tekstów; widoczna atrybucja w UI |
| **D6** | Izolacja testów (`DATABASE_BASELINE`) | Testy jednostkowe domyślnie na pustej bazie (`DATABASE_BASELINE=off`); `ROBOT-04`, `ROBOT-07`, `eval`, `smoke` i Playwright na `data/baseline.sql` |
| **D7** | Edycja treści w UI | **W pełni dozwolona w UI** (`/repository`, `/arguments`, `/media`, korespondencja); zmiany dla istniejących baz przez migracje SQL, a stan startowy utrwalany przez `pnpm db:snapshot` |
