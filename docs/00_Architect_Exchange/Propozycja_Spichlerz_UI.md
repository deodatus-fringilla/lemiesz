# Propozycja · „Spichlerz Lemiesza” — Czytnik Korpusu w Svelte 5
*(Proposal: "The Lemiesz Granary" — Svelte 5 Corpus Reader)*

> **Doc type: CONSULTATION & ARCHITECTURAL PROPOSAL (point-in-time).**  
> **STATUS: DEFERRED — wraca do konsultacji po zakończeniu Fazy 2 z [Propozycja_Struktury_Korpusu.md](Propozycja_Struktury_Korpusu.md).**  
> **Wersja:** v2 · 2026-10-19 (wydzielona z Części II wersji v1 z 2026-10-18)  
> **Właściciel dokumentu:** Claude  
> **Zależności:** model danych z [Propozycja_Struktury_Korpusu.md](Propozycja_Struktury_Korpusu.md) §3 (podział władzy plik ↔ SQLite) oraz decyzje D6 i D7 tamtego dokumentu.

---

## 1. Dlaczego odłożone

UI czyta model danych, który dopiero powstaje: `sources.slug`, ścieżki listów w `corpus/`, decyzja, czy listy trafiają do FTS (D6), i czy treść korpusu jest edytowalna w UI (D7). Projektowanie komponentów przed tymi decyzjami utrwaliłoby założenia, które mogą się zmienić. Pomysł pozostaje wartościowy: jedno miejsce do czytania kanonu, źródeł i korespondencji z wyszukiwaniem i przejściem do Tarczy.

---

## 2. Czego nie budować od zera

Platforma ma już większość części Spichlerza. v1 je pomijała:

| Potrzeba | Co już istnieje |
|---|---|
| Przeglądanie i wyszukiwanie źródeł | `/repository` — wyszukiwanie FTS, filtry kategorii, statusu recenzji i języka, pokrycie tłumaczeń |
| Akceptacja treści | `/review` — kolejka recenzji, granica ROBOT-02 |
| Przeglądanie listów | Zakładka dossier w `/shield` (`/correspondence` przekierowuje do `/shield?tab=dossier`) |
| Karty argumentów | `/arguments` |
| Plakaty i media | `/media` |

**Rekomendacja:** Spichlerz powstaje jako rozwinięcie `/repository` (układ trzypanelowy, nowe typy dokumentów: kanon, list), a nie jako nowa trasa `/corpus` obok istniejących. Jedna trasa do czytania korpusu = jeden dom.

---

## 3. Zakres (zawężony względem v1)

Zostaje:

1. **Układ trzypanelowy:** nawigacja (typ dokumentu, kategoria, wątek) · lista wyników · czytnik.
2. **Czytnik** z paskiem metadanych (licencja, `origin`, stan recenzji) i widokiem dwujęzycznym obok siebie dla źródeł z wieloma `source_texts`.
3. **Kopiuj cytat** z tokenem `[[src:ID]]` — token jest już kontraktem Canon 02 §1.1.
4. **Przekaż do Tarczy** — otwiera `/shield` z wybranym źródłem jako kontekstem.
5. **Stan w URL** (`?id=…&lang=…`) dla linków między współpracownikami.

Usunięte z v1:

- **`QuickIngestModal`** — zapis plików z kontenera produkcyjnego nie trafia do Git i łamie podział władzy (D7). Nowy materiał trafia do `corpus/intake/` przez PR.
- **Tabela „sześciu supermocy”** — „Offline-first” i „Prawda cytatu” to istniejące właściwości platformy (Canon 02, ROBOT-01), nie funkcje nowego komponentu.
- **Chmura tagów** — w schemacie nie ma tagów dla źródeł ani listów (`arguments.tags` istnieje tylko dla kart). Wymaga osobnej decyzji o modelu danych.
- **Eksport do PDF** — brak uzasadnienia potrzebą; do ponownego rozważenia.
- **Deklaracje „< 5 ms”** — niezmierzone. Jeśli wydajność wyszukiwania stanie się wymaganiem, dostaje pomiar z datą w Harness Ledger.

---

## 4. Pytania na konsultację (po Fazie 2)

1. Czy kanony mają być widoczne w czytniku jako wyrenderowany Markdown z plików, czy też indeksowane w bazie (wtedy potrzebny nowy `owner_type`)?
2. Kto jest użytkownikiem: tylko zalogowani członkowie (`member`/`admin`), czy też publiczny odczyt zatwierdzonych (`human_approved`) treści?
3. Czy widok dwujęzyczny ma obejmować łacinę (`original_locale: la`) — zgodnie z rejestrem języków w `src/lib/i18n/locales`?
