# Korpus Przymierza Lemiesza

> **Doc type: INDEX.** Where the movement's own texts live. The ownership rules are those of
> [Propozycja_Struktury_Korpusu.md](../docs/00_Architect_Exchange/Propozycja_Struktury_Korpusu.md) §2 (v3.1).

| Home | What it holds | Where it is edited |
|---|---|---|
| `corpus/canon/` | Doctrinal treatises (Canons 01, 04–09) | Code editor / Git |
| `corpus/intake/` | Raw notes and material not yet processed | Code editor / Git |
| SQLite + `data/baseline.sql` | Sources, argument cards, correspondence, media, posters, review history | The app (`/repository`, `/arguments`, `/media`, `/review`), then `pnpm db:snapshot` |

Engineering canon (Canons 02 and 03) stays in [docs/00_Canon/](../docs/00_Canon/02_Architecture_Manifesto.md).

## Canons (`canon/`)

Numbers and file names are unchanged from their old home in `docs/00_Canon/`.

- [Canon 01 · Ideological Doctrine & Disputation Methodology](canon/01_Ideological_Doctrine.md)
- [Canon 04 · Doktryna Jeża: Kanon Edukacyjno-Wizualny](canon/04_Hedgehog_Doctrine_Educational_Visual_Canon.md)
- [Canon 05 · Metodologia Obronności Polski](canon/05_Metodologia_Obronnosci_Polski.md)
- [Canon 06 · Dekonstrukcja „Mitu Niepodległości” a Prawdziwa Suwerenność](canon/06_Dekonstrukcja_Mitu_Niepodleglosci_i_Prawdziwa_Suwerennosc.md)
- [Canon 07 · Być Panem Pokoju (Dominus Pacis)](canon/07_Pan_Pokoju_i_Dekonstrukcja_Maksymy_Wegecjusza.md)
- [Canon 08 · Przełamanie Augustyńskiej Iluzji](canon/08_Przelamanie_Augustynskiej_Iluzji.md)
- [Canon 09 · Kowadło Pokoju](canon/09_Kowadlo_Pokoju_i_Symbolika_Narzedzi_Rolniczych.md)

The app reads this folder: `/repository` shows the canons in its reader (Kanony tab).

## Intake (`intake/`)

- `for_processing/` — notes on public figures and arguments, before they become sources or argument cards.
- `letters_archive/` — the raw letter files. **The database is the authority for correspondence**: a letter in
  `letters_archive/Korona/` is a copy of what was sent, kept for the record; edit letters in the app
  (`/repository`, Korespondencja), not here.
- `letters_archive/Prezydent/` — the President's UN speech transcript (raw material, not a correspondence thread).

## Working with intake

1. Drop raw material in `intake/`.
2. When a text is ready, enter it through the app (source form, argument form, or letter form), which runs the
   ingestion checklist and records review history.
3. Run `pnpm db:snapshot` and commit `data/baseline.sql` with the change.
