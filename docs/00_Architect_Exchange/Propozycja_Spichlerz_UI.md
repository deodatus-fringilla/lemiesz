# Propozycja · „Spichlerz Lemiesza” — Czytnik Korpusu w Svelte 5
*(Proposal: "The Lemiesz Granary" — Svelte 5 Corpus Reader)*

> **Doc type: CONSULTATION & ARCHITECTURAL PROPOSAL (point-in-time).**  
> **STATUS: DEFERRED — wraca do realizacji w Fazie 3 z [Propozycja_Struktury_Korpusu.md](Propozycja_Struktury_Korpusu.md).**  
> **Wersja:** v3.1 · 2026-10-19 (zaktualizowana pod model SQLite-First i `data/baseline.sql` z v3.1)  
> **Właściciele dokumentu:** Lead Architect, Claude, Antigravity AI  
> **Zależności:** architektura z [Propozycja_Struktury_Korpusu.md](Propozycja_Struktury_Korpusu.md) §2–§3 (SQLite jako jedyny właściciel danych ustrukturyzowanych, `corpus/canon/` dla traktatów doktrynalnych).

---

## 1. Dlaczego w Fazie 3

Zgodnie z [Propozycja_Struktury_Korpusu.md](Propozycja_Struktury_Korpusu.md) (v3.1), najpierw porządkujemy `docs/` → `corpus/canon/` (Faza 1) oraz wycofujemy wszystkie pliki seedujące `.ts` na rzecz `data/baseline.sql` (Faza 2). Gdy dane tabelaryczne mają jeden dom w SQLite, a kanony doktrynalne stałe miejsce w `corpus/canon/`, rozbudowa UI jest prosta i nie wymaga żadnych blokad typu read-only.

---

## 2. Czego nie budować od zera

Platforma ma już większość części Spichlerza:

| Potrzeba | Co już istnieje |
|---|---|
| Przeglądanie, edycja i wyszukiwanie źródeł | `/repository` — wyszukiwanie FTS, filtry kategorii, statusu recenzji i języka, pokrycie tłumaczeń, formularz dodawania i edycji |
| Akceptacja treści | `/review` — kolejka recenzji, granica [ROBOT-02](../17_Robots/ROBOT-02-trust-tier-write-boundary.md) |
| Przeglądanie listów | Zakładka dossier w `/shield` (`/correspondence` przekierowuje do `/shield?tab=dossier`) |
| Karty argumentów | `/arguments` |
| Plakaty i media | `/media` |

**Rekomendacja (wspólna dla v2 i v3):** Spichlerz powstaje jako rozwinięcie `/repository` (układ trzypanelowy obejmujący również podgląd kanonów z `corpus/canon/` i listów z SQLite), a nie jako osobna trasa `/corpus`.

---

## 3. Zakres funkcjonalny

1. **Układ trzypanelowy w `/repository`:** nawigacja (typ dokumentu: Źródła / Kanony / Korespondencja, kategoria, wątek) · lista wyników · czytnik i edytor.
2. **Czytnik i edycja źródeł:** pasek metadanych (licencja, `origin`, stan recenzji), widok dwujęzycznym obok siebie dla źródeł z wieloma `source_texts`, oraz **pełna możliwość edycji i dodawania rekordów w UI** (zgodnie z decyzją D7 w v3).
3. **Dodawanie i edycja listów w UI:** brakujący formularz CRUD dla tabeli `correspondence_letters`, dzięki któremu nowe listy (np. kolejne tury korespondencji z Koroną) dodaje się bezpośrednio w przeglądarce.
4. **Kopiuj cytat** z tokenem `[[src:ID]]` — kontrakt [Canon 02](../00_Canon/02_Architecture_Manifesto.md).
5. **Przekaż do Tarczy** — otwiera `/shield` z wybranym źródłem lub listem jako kontekstem.
6. **Stan w URL** (`?id=…&lang=…`) dla bezpośrednich linków.
