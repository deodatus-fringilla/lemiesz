-- 008 · Corpus baseline (docs/00_Architect_Exchange/Propozycja_Struktury_Korpusu.md v3.1, §3.2 and §4).
-- Every data statement is a no-op on an EMPTY database: a fresh database runs all migrations first and then loads
-- data/baseline.sql, which already holds the result of this migration. On an existing database it brings the
-- content up to the baseline. Generated from files (Bible text: getBible Biblia Gdańska 1881 and ebible.org WEB;
-- letters: corpus/intake/letters_archive/Korona); edit the data in the app, not here.

-- 1. Sources whose quotation was checked verbatim against the page at their url (read by seed/verify.eval.ts).
ALTER TABLE sources ADD COLUMN verbatim_url_check INTEGER NOT NULL DEFAULT 0;

UPDATE sources SET verbatim_url_check = 1 WHERE url IS NOT NULL AND (work, section_ref) IN (VALUES
  ('Pacem in Terris (John XXIII, 1963)', '§112'),
  ('Pacem in Terris (John XXIII, 1963)', '§127'),
  ('Gaudium et Spes (Vatican II, 1965)', '§78'),
  ('Gaudium et Spes (Vatican II, 1965)', '§79 (para. 4)'),
  ('Hague Convention (V) respecting the Rights and Duties of Neutral Powers (1907)', 'Art. 1'),
  ('Hague Convention (V) respecting the Rights and Duties of Neutral Powers (1907)', 'Art. 2'),
  ('Hague Convention (V) respecting the Rights and Duties of Neutral Powers (1907)', 'Art. 5')
);

-- 2. The doctrine text exists twice (the movement was renamed "Pakt" -> "Przymierze" Lemiesza): keep the
--    Przymierze row, move every link of the Pakt row onto it, then delete the Pakt row.
CREATE TEMP TABLE m008_merge AS
  SELECT (SELECT id FROM sources WHERE work = 'Doktryna Oazy Pokoju Europy Środkowej i Karta Metodologiczna Paktu Lemiesza' AND section_ref = 'Kanon I–V') AS old_id,
         (SELECT id FROM sources WHERE work = 'Doktryna Oazy Pokoju Europy Środkowej i Karta Metodologiczna Przymierza Lemiesza' AND section_ref = 'Kanon I–V') AS new_id;
INSERT OR IGNORE INTO argument_sources (argument_id, source_id)
  SELECT a.argument_id, m.new_id FROM argument_sources a, m008_merge m
  WHERE a.source_id = m.old_id AND m.new_id IS NOT NULL;
UPDATE argument_texts SET supporting_spans_json = (
    SELECT json_group_array(json_object('source_id',
             CASE WHEN json_extract(j.value, '$.source_id') = m.old_id THEN m.new_id ELSE json_extract(j.value, '$.source_id') END,
             'span', json_extract(j.value, '$.span')))
    FROM json_each(argument_texts.supporting_spans_json) j, m008_merge m)
  WHERE supporting_spans_json IS NOT NULL AND supporting_spans_json <> '[]'
    AND (SELECT new_id FROM m008_merge) IS NOT NULL
    AND EXISTS (SELECT 1 FROM json_each(argument_texts.supporting_spans_json) j, m008_merge m
                WHERE json_extract(j.value, '$.source_id') = m.old_id);
DELETE FROM embeddings WHERE owner_type = 'source' AND owner_id = (SELECT old_id FROM m008_merge)
  AND (SELECT new_id FROM m008_merge) IS NOT NULL;
DELETE FROM sources WHERE id = (SELECT old_id FROM m008_merge) AND (SELECT new_id FROM m008_merge) IS NOT NULL;
DROP TABLE m008_merge;

-- The placeholder manifesto still carries the old name in older databases.
UPDATE sources SET work = 'Manifest Przymierza Lemiesza [PLACEHOLDER]' WHERE work = 'Manifest Paktu Lemiesza [PLACEHOLDER]';

-- 3. Spans must cite the source that actually contains them (an older seed pinned every span of a card to the card's
--    first source). A span found verbatim in another text of the same language is repointed there; a span found
--    nowhere is left as it is, for a human to fix.
UPDATE argument_texts SET supporting_spans_json = (
    SELECT json_group_array(json_object('source_id', COALESCE(
             (SELECT st.source_id FROM source_texts st
              WHERE st.locale = argument_texts.locale AND instr(st.text, json_extract(j.value, '$.span')) > 0
              ORDER BY (st.source_id = json_extract(j.value, '$.source_id')) DESC, st.source_id LIMIT 1),
             json_extract(j.value, '$.source_id')),
           'span', json_extract(j.value, '$.span')))
    FROM json_each(argument_texts.supporting_spans_json) j)
  WHERE supporting_spans_json IS NOT NULL AND supporting_spans_json <> '[]';
INSERT OR IGNORE INTO argument_sources (argument_id, source_id)
  SELECT at.argument_id, json_extract(j.value, '$.source_id')
  FROM argument_texts at, json_each(at.supporting_spans_json) j
  WHERE EXISTS (SELECT 1 FROM sources s WHERE s.id = json_extract(j.value, '$.source_id'));

-- 4. Bible quotations: one named public-domain translation per language (Biblia Gdańska 1881 / World English
--    Bible), full verses, the translation in source_texts.translator. A changed text goes back to draft.
-- Łk 14, 31–32
UPDATE sources SET license = 'Domena publiczna / Public domain, release verified: Biblia Gdańska, wyd. 1881 (przekład z 1632 r., domena publiczna z racji wieku) oraz World English Bible (jawna dedykacja do domeny publicznej: ebible.org/eng-web/copyright.htm); przekład wskazany w polu translator' WHERE section_ref = 'Łk 14, 31–32';
INSERT INTO review_events (owner_type, owner_id, locale, from_review, to_review, actor, reason)
  SELECT 'source', st.source_id, st.locale, st.review, 'draft', 'system:migration-008', 'text replaced by Biblia Gdańska (verbatim, public domain)'
  FROM source_texts st JOIN sources s ON s.id = st.source_id
  WHERE s.section_ref = 'Łk 14, 31–32' AND st.locale = 'pl' AND st.text <> 'Albo który król jadąc na wojnę, potykać się z drugim królem, pierwej usiadłszy, nie radzi się, mógłliby się w dziesięć tysięcy spotkać z onym, który we dwadzieścia tysięcy jedzie przeciwko niemu? A jeźli nie, gdy on jeszcze jest daleko od niego, posły wyprawiwszy do niego, prosi o to, co należy do pokoju.';
UPDATE source_texts SET text = 'Albo który król jadąc na wojnę, potykać się z drugim królem, pierwej usiadłszy, nie radzi się, mógłliby się w dziesięć tysięcy spotkać z onym, który we dwadzieścia tysięcy jedzie przeciwko niemu? A jeźli nie, gdy on jeszcze jest daleko od niego, posły wyprawiwszy do niego, prosi o to, co należy do pokoju.', translator = 'Biblia Gdańska (wyd. 1881, domena publiczna)', source_hash = 'ef9ef106a3505cc0', review = 'draft'
  WHERE locale = 'pl' AND source_id IN (SELECT id FROM sources WHERE section_ref = 'Łk 14, 31–32');
DELETE FROM embeddings WHERE owner_type = 'source' AND locale = 'pl' AND owner_id IN (SELECT id FROM sources WHERE section_ref = 'Łk 14, 31–32');
INSERT INTO review_events (owner_type, owner_id, locale, from_review, to_review, actor, reason)
  SELECT 'source', st.source_id, st.locale, st.review, 'draft', 'system:migration-008', 'text replaced by World English Bible (verbatim, public domain)'
  FROM source_texts st JOIN sources s ON s.id = st.source_id
  WHERE s.section_ref = 'Łk 14, 31–32' AND st.locale = 'en' AND st.text <> 'Or what king, as he goes to encounter another king in war, will not sit down first and consider whether he is able with ten thousand to meet him who comes against him with twenty thousand? Or else, while the other is yet a great way off, he sends an envoy and asks for conditions of peace.';
UPDATE source_texts SET text = 'Or what king, as he goes to encounter another king in war, will not sit down first and consider whether he is able with ten thousand to meet him who comes against him with twenty thousand? Or else, while the other is yet a great way off, he sends an envoy and asks for conditions of peace.', translator = 'World English Bible (WEB, public domain)', source_hash = '9a3e68b20c3a67f3', review = 'draft'
  WHERE locale = 'en' AND source_id IN (SELECT id FROM sources WHERE section_ref = 'Łk 14, 31–32');
DELETE FROM embeddings WHERE owner_type = 'source' AND locale = 'en' AND owner_id IN (SELECT id FROM sources WHERE section_ref = 'Łk 14, 31–32');
UPDATE sources SET version = version + 1, source_hash = 'ef9ef106a3505cc0', updated_by = 'system:migration-008', updated_at = datetime('now') WHERE section_ref = 'Łk 14, 31–32';

-- J 10, 11–13
UPDATE sources SET license = 'Domena publiczna / Public domain, release verified: Biblia Gdańska, wyd. 1881 (przekład z 1632 r., domena publiczna z racji wieku) oraz World English Bible (jawna dedykacja do domeny publicznej: ebible.org/eng-web/copyright.htm); przekład wskazany w polu translator' WHERE section_ref = 'J 10, 11–13';
INSERT INTO review_events (owner_type, owner_id, locale, from_review, to_review, actor, reason)
  SELECT 'source', st.source_id, st.locale, st.review, 'draft', 'system:migration-008', 'text replaced by Biblia Gdańska (verbatim, public domain)'
  FROM source_texts st JOIN sources s ON s.id = st.source_id
  WHERE s.section_ref = 'J 10, 11–13' AND st.locale = 'pl' AND st.text <> 'Jam jest on dobry pasterz; dobry pasterz duszę swoję kładzie za owce. Lecz najemnik i ten, który nie jest pasterzem, którego nie są owce własne, widząc wilka przychodzącego, opuszcza owce i ucieka, a wilk porywa i rozprasza owce. A najemnik ucieka, iż jest najemnik i nie ma pieczy o owcach.';
UPDATE source_texts SET text = 'Jam jest on dobry pasterz; dobry pasterz duszę swoję kładzie za owce. Lecz najemnik i ten, który nie jest pasterzem, którego nie są owce własne, widząc wilka przychodzącego, opuszcza owce i ucieka, a wilk porywa i rozprasza owce. A najemnik ucieka, iż jest najemnik i nie ma pieczy o owcach.', translator = 'Biblia Gdańska (wyd. 1881, domena publiczna)', source_hash = '525c9793aeb0b655', review = 'draft'
  WHERE locale = 'pl' AND source_id IN (SELECT id FROM sources WHERE section_ref = 'J 10, 11–13');
DELETE FROM embeddings WHERE owner_type = 'source' AND locale = 'pl' AND owner_id IN (SELECT id FROM sources WHERE section_ref = 'J 10, 11–13');
INSERT INTO review_events (owner_type, owner_id, locale, from_review, to_review, actor, reason)
  SELECT 'source', st.source_id, st.locale, st.review, 'draft', 'system:migration-008', 'text replaced by World English Bible (verbatim, public domain)'
  FROM source_texts st JOIN sources s ON s.id = st.source_id
  WHERE s.section_ref = 'J 10, 11–13' AND st.locale = 'en' AND st.text <> '“I am the good shepherd. The good shepherd lays down his life for the sheep. He who is a hired hand, and not a shepherd, who doesn’t own the sheep, sees the wolf coming, leaves the sheep, and flees. The wolf snatches the sheep and scatters them. The hired hand flees because he is a hired hand and doesn’t care for the sheep.';
UPDATE source_texts SET text = '“I am the good shepherd. The good shepherd lays down his life for the sheep. He who is a hired hand, and not a shepherd, who doesn’t own the sheep, sees the wolf coming, leaves the sheep, and flees. The wolf snatches the sheep and scatters them. The hired hand flees because he is a hired hand and doesn’t care for the sheep.', translator = 'World English Bible (WEB, public domain)', source_hash = 'ebe9f57ada632430', review = 'draft'
  WHERE locale = 'en' AND source_id IN (SELECT id FROM sources WHERE section_ref = 'J 10, 11–13');
DELETE FROM embeddings WHERE owner_type = 'source' AND locale = 'en' AND owner_id IN (SELECT id FROM sources WHERE section_ref = 'J 10, 11–13');
UPDATE sources SET version = version + 1, source_hash = '525c9793aeb0b655', updated_by = 'system:migration-008', updated_at = datetime('now') WHERE section_ref = 'J 10, 11–13';

-- Iz 2, 4; Mt 5, 9
UPDATE sources SET license = 'Domena publiczna / Public domain, release verified: Biblia Gdańska, wyd. 1881 (przekład z 1632 r., domena publiczna z racji wieku) oraz World English Bible (jawna dedykacja do domeny publicznej: ebible.org/eng-web/copyright.htm); przekład wskazany w polu translator' WHERE section_ref = 'Iz 2, 4; Mt 5, 9';
INSERT INTO review_events (owner_type, owner_id, locale, from_review, to_review, actor, reason)
  SELECT 'source', st.source_id, st.locale, st.review, 'draft', 'system:migration-008', 'text replaced by Biblia Gdańska (verbatim, public domain)'
  FROM source_texts st JOIN sources s ON s.id = st.source_id
  WHERE s.section_ref = 'Iz 2, 4; Mt 5, 9' AND st.locale = 'pl' AND st.text <> 'I będzie sądził między narodami, a będzie karał wiele ludzi. I przekują miecze swe na lemiesze, a włócznie swe na sierpy; nie podniesie naród przeciw narodowi miecza, ani się będą ćwiczyć do bitwy. (Iz 2, 4) Błogosławieni pokój czyniący; albowiem oni synami Bożymi nazwani będą. (Mt 5, 9)';
UPDATE source_texts SET text = 'I będzie sądził między narodami, a będzie karał wiele ludzi. I przekują miecze swe na lemiesze, a włócznie swe na sierpy; nie podniesie naród przeciw narodowi miecza, ani się będą ćwiczyć do bitwy. (Iz 2, 4) Błogosławieni pokój czyniący; albowiem oni synami Bożymi nazwani będą. (Mt 5, 9)', translator = 'Biblia Gdańska (wyd. 1881, domena publiczna)', source_hash = 'e43c79a1210b3d95', review = 'draft'
  WHERE locale = 'pl' AND source_id IN (SELECT id FROM sources WHERE section_ref = 'Iz 2, 4; Mt 5, 9');
DELETE FROM embeddings WHERE owner_type = 'source' AND locale = 'pl' AND owner_id IN (SELECT id FROM sources WHERE section_ref = 'Iz 2, 4; Mt 5, 9');
INSERT INTO review_events (owner_type, owner_id, locale, from_review, to_review, actor, reason)
  SELECT 'source', st.source_id, st.locale, st.review, 'draft', 'system:migration-008', 'text replaced by World English Bible (verbatim, public domain)'
  FROM source_texts st JOIN sources s ON s.id = st.source_id
  WHERE s.section_ref = 'Iz 2, 4; Mt 5, 9' AND st.locale = 'en' AND st.text <> 'He will judge between the nations, and will decide concerning many peoples. They shall beat their swords into plowshares, and their spears into pruning hooks. Nation shall not lift up sword against nation, neither shall they learn war any more. (Isaiah 2:4) Blessed are the peacemakers, for they shall be called children of God. (Matthew 5:9)';
UPDATE source_texts SET text = 'He will judge between the nations, and will decide concerning many peoples. They shall beat their swords into plowshares, and their spears into pruning hooks. Nation shall not lift up sword against nation, neither shall they learn war any more. (Isaiah 2:4) Blessed are the peacemakers, for they shall be called children of God. (Matthew 5:9)', translator = 'World English Bible (WEB, public domain)', source_hash = '1af1b401f551d6c8', review = 'draft'
  WHERE locale = 'en' AND source_id IN (SELECT id FROM sources WHERE section_ref = 'Iz 2, 4; Mt 5, 9');
DELETE FROM embeddings WHERE owner_type = 'source' AND locale = 'en' AND owner_id IN (SELECT id FROM sources WHERE section_ref = 'Iz 2, 4; Mt 5, 9');
UPDATE sources SET version = version + 1, source_hash = 'e43c79a1210b3d95', updated_by = 'system:migration-008', updated_at = datetime('now') WHERE section_ref = 'Iz 2, 4; Mt 5, 9';

-- 1 Sm 8, 11–17
UPDATE sources SET license = 'Domena publiczna / Public domain, release verified: Biblia Gdańska, wyd. 1881 (przekład z 1632 r., domena publiczna z racji wieku) oraz World English Bible (jawna dedykacja do domeny publicznej: ebible.org/eng-web/copyright.htm); przekład wskazany w polu translator' WHERE section_ref = '1 Sm 8, 11–17';
INSERT INTO review_events (owner_type, owner_id, locale, from_review, to_review, actor, reason)
  SELECT 'source', st.source_id, st.locale, st.review, 'draft', 'system:migration-008', 'text replaced by Biblia Gdańska (verbatim, public domain)'
  FROM source_texts st JOIN sources s ON s.id = st.source_id
  WHERE s.section_ref = '1 Sm 8, 11–17' AND st.locale = 'pl' AND st.text <> 'I mówił: Toć będzie prawo króla, który królować ma nad wami: Syny wasze brać będzie a osadzi nimi wozy swoje, i poczyni je jezdnymi, a będą biegać przed wozem jego; Poczyni też sobie z nich pułkowniki nad tysiącami, i rotmistrze nad pięćdziesięcioma; poczyni z nich oracze ról swoich, i żeńce żniwa swego, i te, którzyby robili rynsztunki wojenne, i potrzeby do wozów jego. Córki też wasze pobierze, by gotowały rzeczy wonne, i były kucharkami i piekarkami. Pola też wasze, i winnice wasze, i oliwnice wasze co najlepsze pobierze, a rozda sługom swoim. Przytem z zasiewków waszych, i z winnic waszych będzie brał dziesięciny, i rozda je komornikom swoim, i sługom swoim. Także sługi wasze, i dziewki wasze, i młodzieńce wasze co najgrzeczniejsze będzie brał, i osły wasze pobierze, i obróci do roboty swojej. Z bydła waszego dziesięcinę będzie brał, a wy będziecie niewolnikami jego.';
UPDATE source_texts SET text = 'I mówił: Toć będzie prawo króla, który królować ma nad wami: Syny wasze brać będzie a osadzi nimi wozy swoje, i poczyni je jezdnymi, a będą biegać przed wozem jego; Poczyni też sobie z nich pułkowniki nad tysiącami, i rotmistrze nad pięćdziesięcioma; poczyni z nich oracze ról swoich, i żeńce żniwa swego, i te, którzyby robili rynsztunki wojenne, i potrzeby do wozów jego. Córki też wasze pobierze, by gotowały rzeczy wonne, i były kucharkami i piekarkami. Pola też wasze, i winnice wasze, i oliwnice wasze co najlepsze pobierze, a rozda sługom swoim. Przytem z zasiewków waszych, i z winnic waszych będzie brał dziesięciny, i rozda je komornikom swoim, i sługom swoim. Także sługi wasze, i dziewki wasze, i młodzieńce wasze co najgrzeczniejsze będzie brał, i osły wasze pobierze, i obróci do roboty swojej. Z bydła waszego dziesięcinę będzie brał, a wy będziecie niewolnikami jego.', translator = 'Biblia Gdańska (wyd. 1881, domena publiczna)', source_hash = 'e2c393a7445ef2a2', review = 'draft'
  WHERE locale = 'pl' AND source_id IN (SELECT id FROM sources WHERE section_ref = '1 Sm 8, 11–17');
DELETE FROM embeddings WHERE owner_type = 'source' AND locale = 'pl' AND owner_id IN (SELECT id FROM sources WHERE section_ref = '1 Sm 8, 11–17');
INSERT INTO review_events (owner_type, owner_id, locale, from_review, to_review, actor, reason)
  SELECT 'source', st.source_id, st.locale, st.review, 'draft', 'system:migration-008', 'text replaced by World English Bible (verbatim, public domain)'
  FROM source_texts st JOIN sources s ON s.id = st.source_id
  WHERE s.section_ref = '1 Sm 8, 11–17' AND st.locale = 'en' AND st.text <> 'He said, “This will be the way of the king who shall reign over you: he will take your sons and appoint them as his servants, for his chariots and to be his horsemen; and they will run before his chariots. He will appoint them to him for captains of thousands and captains of fifties; and he will assign some to plow his ground and to reap his harvest; and to make his instruments of war and the instruments of his chariots. He will take your daughters to be perfumers, to be cooks, and to be bakers. He will take your fields, your vineyards, and your olive groves, even your best, and give them to his servants. He will take one tenth of your seed and of your vineyards, and give it to his officers and to his servants. He will take your male servants, your female servants, your best young men, and your donkeys, and assign them to his own work. He will take one tenth of your flocks; and you will be his servants.';
UPDATE source_texts SET text = 'He said, “This will be the way of the king who shall reign over you: he will take your sons and appoint them as his servants, for his chariots and to be his horsemen; and they will run before his chariots. He will appoint them to him for captains of thousands and captains of fifties; and he will assign some to plow his ground and to reap his harvest; and to make his instruments of war and the instruments of his chariots. He will take your daughters to be perfumers, to be cooks, and to be bakers. He will take your fields, your vineyards, and your olive groves, even your best, and give them to his servants. He will take one tenth of your seed and of your vineyards, and give it to his officers and to his servants. He will take your male servants, your female servants, your best young men, and your donkeys, and assign them to his own work. He will take one tenth of your flocks; and you will be his servants.', translator = 'World English Bible (WEB, public domain)', source_hash = '75cc07955d8937b8', review = 'draft'
  WHERE locale = 'en' AND source_id IN (SELECT id FROM sources WHERE section_ref = '1 Sm 8, 11–17');
DELETE FROM embeddings WHERE owner_type = 'source' AND locale = 'en' AND owner_id IN (SELECT id FROM sources WHERE section_ref = '1 Sm 8, 11–17');
UPDATE sources SET version = version + 1, source_hash = 'e2c393a7445ef2a2', updated_by = 'system:migration-008', updated_at = datetime('now') WHERE section_ref = '1 Sm 8, 11–17';

-- 5. Korona letters. Databases built in Docker never saw the letter files and hold short fallback bodies: restore the
--    full text of letters 1–8 where the body is a fallback (under 300 characters), then add letter 9 (lemiesz_to_korona_05).
UPDATE correspondence_letters SET body = '17 Sept 2026
Szcześć Boże Szanowny Panie Pośle - Grzegorz Braun,

Zwracam się do Pana z propozycją polityczną, która w mojej ocenie odpowiada na najgłębsze wyzwania geopolityczne i moralne, przed jakimi stoi dziś nasza Ojczyzna. Postuluję podjęcie szerokiej debaty oraz działań dyplomatycznych na rzecz uczynienia z Polski państwa neutralnego, na wzór Szwajcarii.

Jako naród o silnych korzeniach chrześcijańskich powinniśmy budować naszą strategię państwową na fundamencie pokoju. Inspiracją dla takiego kierunku są słowa Chrystusa z Kazania na Górze: „Błogosławieni pokój czyniący, albowiem oni synami Bożymi będą nazwani”, a także staropolskie mądrości przypominające, że „pokój czyniącym szczęści Bóg”. Aktywne budowanie pokoju, poprzez symboliczne przekucie mieczy na lemiesze (por. Iz 2, 4), zamiast opowiadania się po jednej ze stron globalnych konfliktów, jest realizacją tych chrześcijańskich wskazań w praktyce politycznej.

Historia wielokrotnie pokazała, że ślepe poleganie na egzotycznych sojuszach bywa dla Polski tragiczne w skutkach. Warto w tym miejscu przywołać słynną przestrogę amerykańskiego stratega i dyplomaty Henry’ego Kissingera, który zauważył, że „bycie wrogiem Ameryki może być niebezpieczne, ale bycie jej przyjacielem jest fatalne”. Status państwa neutralnego pozwoliłby Polsce wyjść z roli frontowego pionka w globalnej rozgrywce mocarstw, chroniąc nasz naród przed ryzykiem wciągnięcia w nie naszą wojnę.

Wierzę, że Konfederacja Korony Polskiej oraz Pan osobiście, jako polityk dbający o suwerenność i podmiotowość Polski, dostrzega potrzebę poszukiwania alternatywnych dróg bezpieczeństwa dla Rzeczypospolitej. Status „Oazy Pokoju Europy Środkowej” mógłby stać się nową, silną doktryną polskiej polityki zagranicznej.

Będę wdzięczny za odniesienie się do powyższej propozycji i przedstawienie stanowiska Pana Posła w tej sprawie.
Z wyrazami szacunku,
Bogdan Zięba,',
  key_claims_json = '["Zwracam się do Pana z propozycją polityczną, która w mojej ocenie odpowiada na najgłębsze wyzwania geopolityczne i moralne, przed jakimi stoi dziś nasza Ojczyzna. Postuluję podjęcie szerokiej debaty oraz działań dyplomatycznych na rzecz uczynienia z Polski państwa neutralnego, na wzór Szwajcarii.","Jako naród o silnych korzeniach chrześcijańskich powinniśmy budować naszą strategię państwową na fundamencie pokoju. Inspiracją dla takiego kierunku są słowa Chrystusa z Kazania na Górze: „Błogosławieni pokój czyniący, albowiem oni synami Bożymi będą nazwani”, a także staropolskie mądrości przypominające, że „pokój czyniącym szczęści Bóg”. Aktywne budowanie pokoju, poprzez symboliczne przekucie mieczy na lemiesze (por. Iz 2, 4), zamiast opowiadania się po jednej ze stron globalnych konfliktów, jest realizacją tych chrześcijańskich wskazań w praktyce politycznej.","Historia wielokrotnie pokazała, że ślepe poleganie na egzotycznych sojuszach bywa dla Polski tragiczne w skutkach. Warto w tym miejscu przywołać słynną przestrogę amerykańskiego stratega i dyplomaty Henry’ego Kissingera, który zauważył, że „bycie wrogiem Ameryki może być niebezpieczne, ale bycie jej przyjacielem jest fatalne”. Status państwa neutralnego pozwoliłby Polsce wyjść z roli frontowego pionka w globalnej rozgrywce mocarstw, chroniąc nasz naród przed ryzykiem wciągnięcia w nie naszą wojnę.","Wierzę, że Konfederacja Korony Polskiej oraz Pan osobiście, jako polityk dbający o suwerenność i podmiotowość Polski, dostrzega potrzebę poszukiwania alternatywnych dróg bezpieczeństwa dla Rzeczypospolitej. Status „Oazy Pokoju Europy Środkowej” mógłby stać się nową, silną doktryną polskiej polityki zagranicznej.","Będę wdzięczny za odniesienie się do powyższej propozycji i przedstawienie stanowiska Pana Posła w tej sprawie. Z wyrazami szacunku, Bogdan Zięba,"]'
  WHERE filename = 'lemiesz_to_korona_01.txt' AND length(body) < 300;
UPDATE correspondence_letters SET body = 'Szanowny Panie Bogdanie,

Szczęść Boże!
Biuro Polskiego Posła do Parlamentu Europejskiego to instytucja gdzie w
Jego imieniu działają  asystenci, którzy uzgadniają z Panem Posłem
realizowane zadania. Na podstawie takich uzgodnień pozwalam sobie do
Pana odpisać .

Pańska propozycja uczynienia Polski państwem neutralnym zasługuje na
poważną refleksję. Zgadzam się z zasadniczą diagnozą: Polska nie może
być cudzym pionkiem ani zapleczem dla wojen, których cele nie wynikają z
polskiej racji stanu.

Mam jednak wątpliwość, czy właściwą odpowiedzią jest neutralność na wzór
Szwajcarii. Szwajcaria jest Szwajcarią, a Polska - Rzecząpospolitą
położoną w zupełnie innym miejscu Europy, między wielkimi ośrodkami
siły.

Nie potrzebujemy Polski neutralnej. Potrzebujemy Polski suwerennej.

Państwo polskie powinno być zdolne do prowadzenia polityki wobec
wszystkich kierunków - bez sojuszy traktowanych jako dogmat i bez
podporządkowania Warszawy jakiemukolwiek zagranicznemu centrum
decyzyjnemu. Jeżeli dane porozumienie służy polskiej racji stanu ,
korzystajmy z niego. Jeżeli jej szkodzi , renegocjujmy je lub
wypowiedzmy.

Pokój jest wartością katolicką, ale pokój nie oznacza bezbronności.
„Przekuwanie mieczy na lemiesze” wymaga najpierw, aby miecze te były w
polskich rękach i służyły obronie własnego domu.

Dlatego zamiast „neutralnej Polski” proponuję doktrynę Polski
suwerennej, niezaangażowanej w cudze wojny, lecz zdolnej do obrony
własnych granic i interesów.

Nie musimy być ani amerykańskim przedmurzem, ani europejską Szwajcarią.

Możemy być po prostu Rzecząpospolitą , państwem, które samo decyduje,
kiedy, gdzie i za co polski żołnierz ma przelewać krew.

Nic o Polsce bez Polski. Żadnej wojny bez polskiej racji stanu.
Z wyrazami szacunku.

--
Teresa Pracownik

Asystent Krajowy Grzegorza Brauna - polskiego Posła do Parlamentu
Europejskiego

Tel: 605 959 400

Email: pracownik@gbraun.pl',
  key_claims_json = '["Pańska propozycja uczynienia Polski państwem neutralnym zasługuje na poważną refleksję. Zgadzam się z zasadniczą diagnozą: Polska nie może być cudzym pionkiem ani zapleczem dla wojen, których cele nie wynikają z polskiej racji stanu.","Mam jednak wątpliwość, czy właściwą odpowiedzią jest neutralność na wzór Szwajcarii. Szwajcaria jest Szwajcarią, a Polska - Rzecząpospolitą położoną w zupełnie innym miejscu Europy, między wielkimi ośrodkami siły.","Nie potrzebujemy Polski neutralnej. Potrzebujemy Polski suwerennej.","Pokój jest wartością katolicką, ale pokój nie oznacza bezbronności. „Przekuwanie mieczy na lemiesze” wymaga najpierw, aby miecze te były w polskich rękach i służyły obronie własnego domu.","Dlatego zamiast „neutralnej Polski” proponuję doktrynę Polski suwerennej, niezaangażowanej w cudze wojny, lecz zdolnej do obrony własnych granic i interesów."]'
  WHERE filename = 'korona_odp_01.txt' AND length(body) < 300;
UPDATE correspondence_letters SET body = '26 Sept 2026

Szczęść Boże!
Szanowny Panie Pośle,
Szanowna Pani Asystentko,

Pragnę serdecznie podziękować za odpowiedź na mój list. W dzisiejszej praktyce parlamentarnej rzadkością jest otrzymanie ze strony biura poselskiego głosu tak merytorycznego, pogłębionego i podejmującego autentyczny dialog ideowy, zamiast bezdusznego urzędniczego szablonu. Doceniam fakt, że moja propozycja nie pozostała bez echa i została potraktowana z powagą, na jaką zasługuje debata o losach Rzeczypospolitej.

Pozwolę sobie jednak na podjęcie życzliwej, lecz pryncypialnej polemiki z tezami zawartymi w Państwa odpowiedzi.

1. Filologia i retoryka: „Wzór” a „Kopia”

W odpowiedzi padło stwierdzenie: „Szwajcaria jest Szwajcarią, a Polska – Rzecząpospolitą położoną w zupełnie innym miejscu Europy”. Odczytuję ten argument jako klasyczny w sztuce retoryki zabieg z „chochoła” (ang. straw man fallacy) – polegający na uproszczeniu myśli oponenta, by łatwiej ją obalić.

Jako poloniście, Panu Posłowi z pewnością bliska jest etymologia słów. W moim liście postulowałem neutralność „na wzór”, a nie „na kopię” Szwajcarii.

Słowo „wzór” (podobnie jak „wzrok” czy staropolskie wzrzeć/weźrzeć – spojrzeć) wywodzi się bezpośrednio z patrzenia. Wzór to pierwotnie matryca, ideał, punkt odniesienia, na który się spogląda, by poddać go twórczej adaptacji do własnych, specyficznych warunków.
Czym innym jest „kopia” – czyli bezrefleksyjne kalkowanie 1:1.
Gdybym proponował „kopię”, Państwa argument o nizinnej geografii Polski i braku alpejskich masywów byłby zasadny. Ja jednak proponowałem wzorzec prawno-dyplomatyczny: wypracowanie unikalnego, polskiego statusu neutralności, który nazwałem „Oazą Pokoju Europy Środkowej” – co w odpowiedzi biura zostało, niestety, całkowicie pominięte.

2. Kto decyduje? Dekonstrukcja zwrotu „Nie potrzebujemy”

W Państwa liście pada kategoryczna teza: „Nie potrzebujemy Polski neutralnej. Potrzebujemy Polski suwerennej”.

W języku filozofii politycznej sformułowanie „nie potrzebujemy” to klasyczny zabieg pluralis majestatis, za którym nierzadko kryje się uzurpacja. Warto postawić pytanie: kto w istocie definiuje to „MY”? Czy decyduje o tym klasa polityczna, czy może polski podatnik i obywatel, który w razie geopolitycznej pożogi płaci za ambicje mocarstwowe własnym majątkiem, krwią i życiem swoich dzieci? Czy polskie rodziny nie potrzebują dziś nade wszystko pokoju, stabilności i ochrony przed wciągnięciem w obcy konflikt?

3. Płodność Lemiesza a Bezpłodność Miecza (Eisenhower, Bastiat i Pismo Święte)

Biuro posła kładzie nacisk na konieczność posiadania „miecza we własnych rękach”. Warto jednak skonfrontować tę doktrynę z najlepszymi tradycjami myśli wolnościowej i ewangelicznej:

Miecz jest ekonomicznie bezpłodny: Lemiesz pługa tworzy bogactwo, karmi naród i buduje cywilizację. Miecz (czołg, amunicja, systemy rakietowe) nie generuje żadnej wartości dodanej – pożera kapitał, rdzewieje w magazynach, a po kilkunastu latach wymaga kosztownej utylizacji na koszt podatnika. Jak genialnie ujął to gen. Dwight Eisenhower: „Każde wyprodukowane działo, każdy zwodowany okręt wojenny, każda wystrzelona rakieta to w ostatecznym rozrachunku kradzież zrobiona tym, którzy głodują i nie mają co jeść, tym, którzy marzną i nie mają w co się ubrać”. Z kolei Frédéric Bastiat przypominał w swojej lekcji o „tym, co widać, i tym, czego nie widać”, że transfer bogactwa w zbrojenia zubaża całe społeczeństwo, tworząc iluzję siły kosztem realnego dobrobytu.
Niewolnictwo zbrojeniowe i przestroga Pisma Świętego: Permanentne zbrojenia to forma ekonomicznego zniewolenia narodu przez aparat państwowy. Dokładnie przed tym ostrzegał Bóg w 1 Księdze Samuela (1 Sm 8), gdy Izraelici domagali się ziemskiego wodza, by bronił ich „jak u innych narodów”. Prorok Samuel przestrzegał wówczas z boskiego natchnienia: Król ten „synów waszych weźmie do swych rydwanów [...] nakaże im sporządzać broń wojenną... Nałoży na was podatki i dziesięciny... i będziecie jego niewolnikami”.
4. „Suwerenność” jako polityczny fetysz

Obawiam się, że w ustach wielu polityków hasło „suwerenności” staje się swoistym chochołem i nietykalnym fetyszem. Pod hasłem obrony suwerenności narzuca się Polakom permanentny stan zagrożenia, gigantyczne podatki, dług publiczny i widmo przymusowego poboru do wojska.

Mechanizm ten niepokojąco przypomina psychozę strachu znaną nam z operacji COVID-19: tam również pod hasłem „walki o najwyższe dobro i bezpieczeństwo” odbierano obywatelom wolność, drenowano ich kieszenie i zmuszano do bezwzględnego posłuszeństwa. Dziś wirusa zastąpiono zewnętrznym zagrożeniem militarnym, lecz metoda sterowania strachem pozostała uderzająco podobna.

Zaproszenie do dialogu

Prawdziwa suwerenność Rzeczypospolitej nie musi oznaczać roli zbrojnej twierdzy na permanentnej linii frontu, utrzymywanej z potu i krwi zubożałego podatnika. Szczytem chrześcijańskiej polityki i geopolitycznego kunsztu może być status neutralnej Oazy Pokoju – państwa podmiotowego, bezpiecznego, handlującego ze wszystkimi, a zarazem niebędącego niczyim mięsem armatnim.

Wierząc w głęboki patriotyzm Pana Posła Grzegorza Brauna oraz formacji Konfederacji Korony Polskiej, traktuję tę wymianę zdań nie jako spór, lecz jako początek ważnej dyskusji. Zapraszam Pana Posła oraz Państwa środowisko do dalszej współpracy i wspólnego definiowania takiego ustroju oraz doktryny zagranicznej Rzeczypospolitej, która przyniesie Polakom nie pasmo lęku i zbrojeń, lecz błogosławieństwo wolności i pokoju.

Z wyrazami szacunku i w miłość Słowa Bożego,
Bogdan Zięba',
  key_claims_json = '["W odpowiedzi padło stwierdzenie: „Szwajcaria jest Szwajcarią, a Polska – Rzecząpospolitą położoną w zupełnie innym miejscu Europy”. Odczytuję ten argument jako klasyczny w sztuce retoryki zabieg z „chochoła” (ang. straw man fallacy) – polegający na uproszczeniu myśli oponenta, by łatwiej ją obalić.","Jako poloniście, Panu Posłowi z pewnością bliska jest etymologia słów. W moim liście postulowałem neutralność „na wzór”, a nie „na kopię” Szwajcarii.","Słowo „wzór” (podobnie jak „wzrok” czy staropolskie wzrzeć/weźrzeć – spojrzeć) wywodzi się bezpośrednio z patrzenia. Wzór to pierwotnie matryca, ideał, punkt odniesienia, na który się spogląda, by poddać go twórczej adaptacji do własnych, specyficznych warunków. Czym innym jest „kopia” – czyli bezrefleksyjne kalkowanie 1:1. Gdybym proponował „kopię”, Państwa argument o nizinnej geografii Polski i braku alpejskich masywów byłby zasadny. Ja jednak proponowałem wzorzec prawno-dyplomatyczny: wypracowanie unikalnego, polskiego statusu neutralności, który nazwałem „Oazą Pokoju Europy Środkowej” – co w odpowiedzi biura zostało, niestety, całkowicie pominięte.","W Państwa liście pada kategoryczna teza: „Nie potrzebujemy Polski neutralnej. Potrzebujemy Polski suwerennej”.","W języku filozofii politycznej sformułowanie „nie potrzebujemy” to klasyczny zabieg pluralis majestatis, za którym nierzadko kryje się uzurpacja. Warto postawić pytanie: kto w istocie definiuje to „MY”? Czy decyduje o tym klasa polityczna, czy może polski podatnik i obywatel, który w razie geopolitycznej pożogi płaci za ambicje mocarstwowe własnym majątkiem, krwią i życiem swoich dzieci? Czy polskie rodziny nie potrzebują dziś nade wszystko pokoju, stabilności i ochrony przed wciągnięciem w obcy konflikt?"]'
  WHERE filename = 'lemiesz_to_korona_02.txt' AND length(body) < 300;
UPDATE correspondence_letters SET body = 'Szanowny Panie Bogdanie,

dziękuję za obszerną odpowiedź i za podjęcie dalszej, merytorycznej
dyskusji. Doceniam, że przedstawia Pan swoje stanowisko w sposób
przemyślany i oparty na określonej wizji państwa i polityki
zagranicznej.

Pozwolę sobie jednak doprecyzować jedną zasadniczą kwestię. Pisząc, że
„Szwajcaria jest Szwajcarią, a Polska - Rzecząpospolitą położoną w
zupełnie innym miejscu Europy”, nie miałam na myśli różnicy między
krajem nizinnym a górzystym. Chodziło przede wszystkim o geopolityczne
położenie Polski.

Szwajcaria i Polska znajdują się w zupełnie innych warunkach
strategicznych. Polska leży pomiędzy Niemcami a Rosją - dwoma wielkimi
państwami, które w historii wielokrotnie porozumiewały się ponad głowami
Polaków, podejmując decyzje dotyczące naszego terytorium i naszej
przyszłości. Historia rozbiorów, a także późniejsze doświadczenia XX
wieku, pokazują, że Polska nie może abstrahować od tego położenia.

I właśnie dlatego nie jestem przekonana, że rozwiązaniem dla Polski może
być neutralność rozumiana jako trwałe wycofanie się z systemu
bezpieczeństwa i oparcie swojej pozycji przede wszystkim na statusie
państwa neutralnego.

Uważam natomiast, że Polska musi być państwem na tyle silnym, aby jej
bezpieczeństwo i decyzje dotyczące wojny i pokoju nie zależały od dobrej
woli innych mocarstw.

Dlatego w mojej ocenie mamy przed sobą bardzo prostą alternatywę: albo
będziemy jednym z najsilniejszych militarnie państw Europy i będziemy
posiadać realną zdolność do obrony własnego terytorium oraz własnych
interesów, albo nasza niezależność będzie zawsze zależna od tego, jakie
decyzje podejmą silniejsi od nas.

Silna armia nie musi oznaczać dążenia do wojny. Wręcz przeciwnie ,
zdolność do skutecznej obrony może być jednym z najważniejszych warunków
zachowania pokoju. Różnimy się więc być może nie w tym, że chcemy
pokoju, lecz w ocenie tego, jak ten pokój można Polsce zapewnić.
1 Pazdz 2026

Odnosząc się natomiast do pytania „kto to jest my?” - w poprzedniej
odpowiedzi nie chodziło o uzurpowanie sobie prawa do wypowiadania się w
imieniu wszystkich Polaków. „My” oznaczało w tym przypadku Konfederację
Korony Polskiej, która jest konkretnym środowiskiem politycznym,
posiadającym określoną wizję Polski oraz własny program polityczny.
Można się z nim zgadzać albo nie, ale trudno wymagać od przedstawiciela
tego środowiska, aby w odpowiedzi na korespondencję prezentował
stanowisko całkowicie oderwane od programu politycznego, który
reprezentuje.

Co do zasady pozostaję jednak przy przekonaniu, że Polska powinna
prowadzić politykę podmiotową, nie być niczyim pionkiem i nie angażować
się w konflikty, które nie służą polskiej racji stanu. W tym punkcie
nasze stanowiska są sobie bliższe, niż mogłoby wynikać z różnicy
pomiędzy hasłami „neutralność” i „suwerenność”.

Dziękuję za tę wymianę argumentów. Dobrze, że o tak fundamentalnych
sprawach można rozmawiać otwarcie, również wtedy, gdy różnimy się w
ocenie drogi prowadzącej do celu.

Z wyrazami szacunku

--
Teresa Pracownik

Asystent Krajowy Grzegorza Brauna - polskiego Posła do Parlamentu
Europejskiego

Tel: 605 959 400',
  key_claims_json = '["Pozwolę sobie jednak doprecyzować jedną zasadniczą kwestię. Pisząc, że „Szwajcaria jest Szwajcarią, a Polska - Rzecząpospolitą położoną w zupełnie innym miejscu Europy”, nie miałam na myśli różnicy między krajem nizinnym a górzystym. Chodziło przede wszystkim o geopolityczne położenie Polski.","I właśnie dlatego nie jestem przekonana, że rozwiązaniem dla Polski może być neutralność rozumiana jako trwałe wycofanie się z systemu bezpieczeństwa i oparcie swojej pozycji przede wszystkim na statusie państwa neutralnego.","Uważam natomiast, że Polska musi być państwem na tyle silnym, aby jej bezpieczeństwo i decyzje dotyczące wojny i pokoju nie zależały od dobrej woli innych mocarstw.","Dlatego w mojej ocenie mamy przed sobą bardzo prostą alternatywę: albo będziemy jednym z najsilniejszych militarnie państw Europy i będziemy posiadać realną zdolność do obrony własnego terytorium oraz własnych interesów, albo nasza niezależność będzie zawsze zależna od tego, jakie decyzje podejmą silniejsi od nas.","Silna armia nie musi oznaczać dążenia do wojny. Wręcz przeciwnie , zdolność do skutecznej obrony może być jednym z najważniejszych warunków zachowania pokoju. Różnimy się więc być może nie w tym, że chcemy pokoju, lecz w ocenie tego, jak ten pokój można Polsce zapewnić. 1 Pazdz 2026"]'
  WHERE filename = 'korona_odp_02.txt' AND length(body) < 300;
UPDATE correspondence_letters SET body = '5 Pazdz 2026

Szczęść Boże!
Szanowna Pani Asystentko,
Szanowny Panie Pośle,

Bardzo dziękuję za kolejny list. Doceniam precyzję, z jaką wyjaśniła Pani stanowisko Konfederacji Korony Polskiej. Przyjęcie do wiadomości, że użyte wcześniej słowo „my” odnosiło się do partii politycznej, a nie do ogółu narodu, porządkuje naszą dyskusję i pozwala skupić się na istocie rzeczy.

Doprecyzowanie przez Panią kwestii geopolitycznego położenia Polski – owego historycznego, rosyjsko-niemieckiego kleszcza (czy „sandwicha”) – dotyka sedna polskiej racji stanu. Zgadzam się w zupełności: Polska leży w jednym z najbardziej newralgicznych miejsc na mapie świata. Właśnie dlatego z całą powagą musimy poddać analizie sformułowaną przez Panią alternatywę:
„...albo będziemy jednym z najsilniejszych militarnie państw Europy i będziemy posiadać realną zdolność do obrony własnego terytorium [...], albo nasza niezależność będzie zawsze zależna...”

Ta teza, choć brzmi dumnie i patriotycznie, w mojej ocenie prowadzi Polskę w ślepą uliczkę. Pozwolę sobie przedstawić trzy fundamentalne powody, dla których doktryna „Polski-Sparty” jest niebezpieczną utopią, a status państwa neutralnego pozostaje naszą jedyną racjonalną szansą.

1) Zderzenie „Polski-Sparty” z demografią i ekonomią

Aby Polska mogła stać się „jednym z najsilniejszych militarnie państw Europy”, zdolnym samodzielnie odstraszyć atomowe imperium na wschodzie i potęgę gospodarczą na zachodzie, musielibyśmy wejść w asymetryczny wyścig zbrojeń, którego matematycznie nie jesteśmy w stanie wygrać:

Demografia: Polska wymiera. Ze współczynnikiem dzietności na poziomie ok. 1,16 zmierzamy ku katastrofie pokoleniowej. Skąd weźmiemy rekrutów do armii mogącej rywalizować z potęgami kontynentu? Zamknięcie dziesiątek tysięcy młodych Polaków w koszarach zamiast w fabrykach, biurach i przy własnych rodzinach to wyrok śmierci na polską demografię.

Ekonomia: Gospodarka Niemiec jest niemal sześciokrotnie większa od polskiej, a Rosja opiera swoją potęgę na gigantycznych zasobach surowcowych i przestawieniu państwa na tory gospodarki wojennej. Próba dorównania im na polu militarnym wymusi na Polakach drakońskie opodatkowanie, inflację i nędzę.

Starożytna Sparta postawiła wszystko na potęgę militarną. W rezultacie stworzyła społeczeństwo oparte na niewolniczej pracy helotów, nie wydała filozofów, kupców ani naukowców, a w zderzeniu z kryzysem demograficznym i gospodarczym po prostu zniknęła z kart historii. Czy taka ma być spuścizna chrześcijańskiej Rzeczypospolitej?

2) Iluzja suwerenności kupowanej na kredyt

Pani list - który zapewne odzwierciedla myśl KKP - zakłada, że wielka armia da nam niezależność od obcych stolic. Dzisiaj jest dokładnie odwrotnie. Polska nie produkuje suwerennie własnych samolotów V generacji, zaawansowanych systemów rakietowych ani czołgów. Kupujemy je na gigantyczny kredyt w USA i Korei Południowej.
To nie jest suwerenność – to najdroższa forma technologicznego i finansowego uzależnienia.
Kody źródłowe, części zamienne, serwis i amunicja pozostają pod kontrolą obcych mocarstw. W razie konfliktu nasza zdolność bojowa bez „dobrej woli” zza oceanu wyczerpie się w ciągu kilku tygodni. Budując armię ponad stan, stajemy się dłużnikiem i zakładnikiem zagranicznych koncernów zbrojeniowych.

3) Lekcja z Austrii (1955): Neutralność na styku mocarstw

Odrzucają Państwo przykład Szwajcarii ze względu na geopolitykę. Przyjrzyjmy się zatem innemu państwu, którego losy są uderzająco bliskie naszej sytuacji: Austrii.
W 1955 roku Austria znajdowała się w o wiele gorszym położeniu geopolitycznym niż dzisiejsza Polska:
- Leżała w samym sercu Zimnej Wojny, bezpośrednio na linii frontu między NATO a Układem Warszawskim.
- Była okupowana przez cztery mocarstwa, w tym przez Armię Czerwoną.
Co uratowało Austrię przed losem NRD czy Polski Ludowej? Nie „stanie się najsilniejszym militarnie krajem Europy”, lecz Traktat Państwowy z 1955 roku i wpisanie wieczystej neutralności (immerwährende Neutralität) do konstytucji.
To właśnie status neutralności sprawił, że Sowieci wycofali swoje wojska bez jednego wystrzału. Austria nie stała się bezbronną pustynią, lecz zamieniła swoje strategiczne położenie w złoto – stała się bezpiecznym, niebywale bogatym państwem, globalną stolicą dyplomacji (siedzibą agend ONZ, OBWE, OPEC) i mostem między Wschodem a Zachodem.

Dlaczego to, co okazało się genialnym sukcesem Wiednia w epicentrum Zimnej Wojny, miałoby być z góry niemożliwe dla Warszawy?

Propozycja - Od kleszczy do pomostu

Położenie między Niemcami a Rosją to fakt. Pytanie brzmi: jak na ten fakt odpowiadamy?
Jeśli Polska ogłosi się militarnym forpocztą i zbrojnym bastionem, sprowokuje odwieczny mechanizm naszych sąsiadów: chęć prewencyjnego zdławienia zagrożenia i porozumienia się ponad naszymi głowami (syndrom traktatu z Rapallo czy paktu Ribbentrop-Mołotow).
Jeśli natomiast Polska przyjmie doktrynę asertywnej, uzbrojonej neutralności – Oazy Pokoju – stajemy się dla obu stron niezbędnym buforem i korytarzem tranzytowym, którego nienaruszalność opłaca się każdemu bardziej niż kosztowna wojna.

Zgadzam się z Panią, że łączy nas sprzeciw wobec bycia cudzym pionkiem. Różnimy się jednak w ocenie narzędzi. Państwo wierzą, że bezpieczeństwo da nam miecz wykuty za pożyczone pieniądze i próba stania się militarnym gigantem. Warto jednak w tym miejscu przypomnieć słowa samego Chrystusa z Ewangelii według św. Łukasza:

„Albo jaki król, mając wyruszyć, aby stoczyć bitwę z drugim królem, nie usiądzie wpierw i nie naradzi się, czy w dziesięć tysięcy może stawić czoło temu, który z dwudziestoma tysiącami nadchodzi przeciw niemu? Jeśli nie, to gdy tamten jest jeszcze daleko, wyprawia poselstwo i prosi o warunki pokoju” (Łk 14, 31–32).

Nasz Wódz i Zbawiciel uczy nas tu elementarnego, politycznego realizmu: gdy zasoby są asymetryczne, prawdziwą mądrością władcy nie jest rzucanie narodu w wyniszczający wyścig zbrojeń, lecz wyprzedzająca dyplomacja i budowanie pokoju. Wierzę, że prawdziwe bezpieczeństwo i Boże błogosławieństwo przyniesie Polsce nie kosztowna iluzja bycia europejską Spartą, lecz mądrość dyplomatyczna, rozwój gospodarczy oparty na pracy (lemiesz) oraz status neutralnej Oazy Pokoju, która z zasady nie bierze udziału w cudzych rzeziach.

Ponownie dziękuję za tę niezwykle stymulującą wymianę myśli i pozostaję z nadzieją, że idea Polski jako Oazy Pokoju znajdzie w przyszłości zrozumienie w Państwa środowisku politycznym. Mając na względzie przyszłość Najjaśniejszej Rzeczypospolitej, serdecznie zapraszam Pana Posła oraz całe środowisko Konfederacji Korony Polskiej do dalszego dialogu i współtworzenia nowej doktryny bezpieczeństwa dla naszej Ojczyzny. Wierzę, że wspólnym wysiłkiem możemy wypracować wizję Polski, która zamiast trwać w ciągłym lęku i jarzmie wyniszczających zbrojeń, stanie się dla swoich obywateli ostoją prawdziwej wolności, pomyślności i Bożego pokoju.

Z wyrazami szacunku i w Miłości Słowa Bożego,
Bogdan Zięba',
  key_claims_json = '["Doprecyzowanie przez Panią kwestii geopolitycznego położenia Polski – owego historycznego, rosyjsko-niemieckiego kleszcza (czy „sandwicha”) – dotyka sedna polskiej racji stanu. Zgadzam się w zupełności: Polska leży w jednym z najbardziej newralgicznych miejsc na mapie świata. Właśnie dlatego z całą powagą musimy poddać analizie sformułowaną przez Panią alternatywę: „...albo będziemy jednym z najsilniejszych militarnie państw Europy i będziemy posiadać realną zdolność do obrony własnego terytorium [...], albo nasza niezależność będzie zawsze zależna...”","Ta teza, choć brzmi dumnie i patriotycznie, w mojej ocenie prowadzi Polskę w ślepą uliczkę. Pozwolę sobie przedstawić trzy fundamentalne powody, dla których doktryna „Polski-Sparty” jest niebezpieczną utopią, a status państwa neutralnego pozostaje naszą jedyną racjonalną szansą.","Aby Polska mogła stać się „jednym z najsilniejszych militarnie państw Europy”, zdolnym samodzielnie odstraszyć atomowe imperium na wschodzie i potęgę gospodarczą na zachodzie, musielibyśmy wejść w asymetryczny wyścig zbrojeń, którego matematycznie nie jesteśmy w stanie wygrać:","Demografia: Polska wymiera. Ze współczynnikiem dzietności na poziomie ok. 1,16 zmierzamy ku katastrofie pokoleniowej. Skąd weźmiemy rekrutów do armii mogącej rywalizować z potęgami kontynentu? Zamknięcie dziesiątek tysięcy młodych Polaków w koszarach zamiast w fabrykach, biurach i przy własnych rodzinach to wyrok śmierci na polską demografię.","Położenie między Niemcami a Rosją to fakt. Pytanie brzmi: jak na ten fakt odpowiadamy? Jeśli Polska ogłosi się militarnym forpocztą i zbrojnym bastionem, sprowokuje odwieczny mechanizm naszych sąsiadów: chęć prewencyjnego zdławienia zagrożenia i porozumienia się ponad naszymi głowami (syndrom traktatu z Rapallo czy paktu Ribbentrop-Mołotow). Jeśli natomiast Polska przyjmie doktrynę asertywnej, uzbrojonej neutralności – Oazy Pokoju – stajemy się dla obu stron niezbędnym buforem i korytarzem tranzytowym, którego nienaruszalność opłaca się każdemu bardziej niż kosztowna wojna."]'
  WHERE filename = 'lemiesz_to_korona_03.txt' AND length(body) < 300;
UPDATE correspondence_letters SET body = '6 Pazdz 2026

Szczęść Boże, Panie Bogdanie,

dziękuję za obszerny i merytoryczny list oraz za podjęcie próby
dalszego, rzeczowego dialogu o sprawach dla Polski fundamentalnych.
Zgadzam się z Panem co do jednego: Polska nie może być niczyim pionkiem,
a jej bezpieczeństwo nie może być przedmiotem cudzej geopolitycznej gry.

Właśnie dlatego nie mogę zgodzić się z wnioskiem, że rozwiązaniem
naszych problemów miałaby być neutralność.

Stara rzymska zasada mówi: „Si vis pacem, para bellum” – chcesz pokoju,
szykuj się do wojny. Nie jest to wezwanie do wojny. Jest dokładnie
odwrotnie. To wezwanie do takiego przygotowania państwa, aby wojna
przestała być dla potencjalnego agresora opłacalnym przedsięwzięciem.

Pokój, który zależy od dobrej woli sąsiada, nie jest trwałym pokojem.
Jest łaską udzieloną na czas, do którego druga strona może w każdej
chwili zmienić warunki.

Neutralność wymaga, aby ktoś tę neutralność respektował

Przykład Austrii jest interesujący, ale właśnie dlatego nie można go
bezpośrednio przenieść na sytuację Polski.

Austria w 1955 roku uzyskała neutralność w określonych warunkach
geopolitycznych i za zgodą mocarstw, które wcześniej podzieliły między
siebie strefy wpływów w Europie. Jej neutralność była elementem
większego porozumienia międzynarodowego.

Polska nie znajduje się jednak w analogicznej sytuacji.

Nie jesteśmy państwem położonym pomiędzy dwoma blokami, które wzajemnie
gwarantują sobie istnienie neutralnej strefy. Polska leży na wschodniej
flance NATO, graniczy z Rosją poprzez obwód królewiecki, graniczy z
Białorusią i znajduje się w bezpośrednim sąsiedztwie obszaru, na którym
toczy się wojna.

Co więcej, historia Polski uczy nas czegoś bardzo prostego: gwarancje
papierowe są warte tyle, ile jest warta siła państwa, które ma ich
dochodzić.

W 1939 roku mieliśmy traktaty, gwarancje i sojusze. Zabrakło natomiast
wystarczającej zdolności do samotnego powstrzymania agresora.

Nie chciałabym, abyśmy po raz kolejny budowali polską strategię
bezpieczeństwa na założeniu, że tym razem wielkie mocarstwa okażą się
bardziej skłonne do respektowania naszej neutralności niż interesów
własnych państw.

Silna armia nie oznacza militaryzacji narodu

Nie twierdzę, że Polska powinna zamienić się w koszary ani że każdy
problem należy rozwiązywać poprzez zwiększanie liczebności armii.

Twierdzę natomiast, że niepodległe państwo musi posiadać zdolność do
obrony własnego terytorium.

To jest zasadnicza różnica.

Nowoczesna armia nie musi oznaczać dziesiątek tysięcy młodych ludzi
„zamkniętych w koszarach”. Obronność XXI wieku to również przemysł,
technologie, drony, rozpoznanie, obrona powietrzna, artyleria, amunicja,
cyberbezpieczeństwo, infrastruktura, rezerwy i zdolność produkowania
podstawowych środków walki na własnym terytorium.

I tutaj dotyka Pan bardzo ważnego problemu: uzależnienie od
zagranicznych dostaw rzeczywiście nie jest pełną suwerennością.

Ale z tego nie wynika, że należy się rozbroić.

Wynika coś zupełnie przeciwnego: należy rozwijać własny przemysł
obronny, własne technologie, własne zdolności produkcyjne i własne
kadry. Jeżeli kupujemy uzbrojenie za granicą, powinno ono służyć również
budowaniu polskiego potencjału przemysłowego, a nie trwałemu
uzależnieniu od zagranicznych dostawców.

Niepodległość kosztuje. Brak niepodległości kosztuje znacznie więcej.

Demografia nie jest argumentem za słabością

Argument demograficzny również wymaga odwrócenia perspektywy.

Owszem, Polska ma problem demograficzny. Ale właśnie dlatego musimy być
państwem bogatym, silnym gospodarczo i bezpiecznym.

Nie widzę jednak żadnego logicznego związku pomiędzy koniecznością
posiadania zdolności obronnych a koniecznością prowadzenia gospodarki na
wzór starożytnej Sparty.

Polska nie musi być Spartą.

--
Teresa Pracownik

Asystent Krajowy Grzegorza Brauna - polskiego Posła do Parlamentu
Europejskiego

Tel: 605 959 400

Email: pracownik@gbraun.pl

deodatus fink <expukpuk@gmail.com>
Fri 9 Oct, 17:42 (2 days ago)
to Teresa',
  key_claims_json = '["Właśnie dlatego nie mogę zgodzić się z wnioskiem, że rozwiązaniem naszych problemów miałaby być neutralność.","Przykład Austrii jest interesujący, ale właśnie dlatego nie można go bezpośrednio przenieść na sytuację Polski.","Nie twierdzę, że Polska powinna zamienić się w koszary ani że każdy problem należy rozwiązywać poprzez zwiększanie liczebności armii.","Twierdzę natomiast, że niepodległe państwo musi posiadać zdolność do obrony własnego terytorium.","Owszem, Polska ma problem demograficzny. Ale właśnie dlatego musimy być państwem bogatym, silnym gospodarczo i bezpiecznym."]'
  WHERE filename = 'korona_odp_03.txt' AND length(body) < 300;
UPDATE correspondence_letters SET body = 'deodatus fink <expukpuk@gmail.com>
Fri 9 Oct, 17:42 (2 days ago)
to Teresa





9 Oct 2026, 17:42 (2 days ago)

Szczęść Boże!
Szanowna Pani Asystentko,
Szanowny Panie Pośle,

Bardzo dziękuję za kolejny, niezwykle wnikliwy list. Nasza korespondencja stała się już prawdziwym traktatem o polskiej racji stanu i drogach wyjścia z geopolitycznego klinczu. Cenię fakt, że Biuro Poselskie traktuje ten dialog z tak wielką powagą intelektualną, wznosząc się ponad partyjne slogany ku fundamentalnym zasadom myślenia o państwie.

W zakończeniu swojego listu odwołała się Pani do kategorii logiki. Z całą mocą podzielam Pani szacunek do logiki. Związek logiczny nie zachodzi pomiędzy „zwykłymi zdolnościami obronnymi” a Spartą – i nikt takiego twierdzenia w moim liście nie stawiał.

Związek logiczny zachodzi natomiast nieubłaganie pomiędzy Pani postulatem uczynienia z Polski „jednego z najsilniejszych militarnie państw Europy” w kleszczach między Rosją a Niemcami, a koniecznością drenażu kurczącej się demografii i majątku podatnika. Jeśli kraj o 38-milionowej, starzejącej się ludności chce wygrać wyścig zbrojeń z mocarstwami kontynentu, ekonomia zna tylko jedną drogę: model spartański, w którym koszary zjadają całe bogactwo narodu. Tego prawa ekonomii nie unieważni żadna deklaracja polityczna.

Poddajmy zatem pozostałe tezy Pani listu tej samej, surowej dyscyplinie logicznej.

1. Logika historyczna: Sanacja jako polska próba budowy „Sparty”
Twierdzenie, że militaryzacja państwa nie niszczy gospodarki cywilnej, zostało już raz w polskiej historii brutalnie zweryfikowane. W latach 30. sanacyjne elity wyznawały dokładnie Państwa logikę: uznały, że Polska musi być mocarstwem militarnym, i pompowały w armię od 35% do blisko 50% całego budżetu państwa!
Jaki był logiczny skutek tego eksperymentu? Polska wieś dzieliła zapałki na czworo, brakowało kapitału na edukację, przemysł cywilny i elektryfikację, podczas gdy pieniądze podatników przejadano w koszarach i na owies dla 40 pułków kawalerii. A co najtragiczniejsze: ten gigantyczny drenaż narodu nie uchronił nas we wrześniu 1939 roku przed klęską w zaledwie kilkanaście dni. Okazało się, że armaty zjadły bogactwo narodu, a ostatecznie i tak zabrakło nowoczesnej technologii.

2. Logika moralna i asymetria ryzyka: Ucieczka elit przez most w Kutach
Powołują się Państwo na traumę 1939 roku. Zgoda, spójrzmy na nią do końca pod kątem etyki. Rząd, który latami uczył Polaków piosenek o „wodzu śmigłym, dzielnym” i żądał bezwzględnego poświęcenia dla państwa, w nocy z 17 na 18 września uciekł przez most w Kutach do Rumunii, zostawiając miliony bezbronnych polskich rodzin na pastwę Gestapo i NKWD.
W kategoriach ewangelicznych była to postawa Najemnika (J 10, 11–13), który widząc wilka, porzuca owce i ucieka, bo nie zależy mu na stadzie. Zasłanianie się „ratowaniem ciągłości prawnej państwa” to uniwersalne alibi elit politycznych. Kiedy politycy prą do wyścigu zbrojeń pod hasłem honoru, w razie katastrofy to oni mają samoloty ewakuacyjne i paszporty dyplomatyczne. Zwykły polski podatnik zostaje pod bombami. Ruch na rzecz neutralności stawia na pierwszym miejscu przetrwanie obywatela i jego rodziny, a nie prestiż aparatu państwowego.

3. Logika teologiczna: Wegecjusz kontra Chrystus
Jako fundament swojego wywodu przytoczyła Pani rzymską zasadę „Si vis pacem, para bellum”. Ta maksyma pochodzi od Wegecjusza – pogańskiego pisarza z czasów agonii Cesarstwa Rzymskiego. Rzym żył tą zasadą przez wieki i zbankrutował właśnie przez nią: niewolnictwo podatkowe na rzecz legionów i inflacja zniszczyły cesarstwo od środka. Co więcej, w nauce o stosunkach międzynarodowych zasada ta opisuje tzw. dylemat bezpieczeństwa – to właśnie powszechne „szykowanie się do wojny” przez europejskie mocarstwa podpaliło świat w 1914 roku.
Skonfrontujmy pogańskiego Wegecjusza z logiką samego Zbawiciela:

„Albo jaki król, mając wyruszyć, aby stoczyć bitwę z drugim królem, nie usiądzie wpierw i nie naradzi się, czy w dziesięć tysięcy może stawić czoło temu, który z dwudziestoma tysiącami nadchodzi przeciw niemu? Jeśli nie, to gdy tamten jest jeszcze daleko, wyprawia poselstwo i prosi o warunki pokoju” (Łk 14, 31–32).

Chrystus uczy nas twardej, geopolitycznej kalkulacji: gdy naprzeciwko stoją potęgi o wielokrotnie większym potencjale, chrześcijańską mądrością nie jest pyszny wyścig zbrojeń i udawanie gladiatora, lecz wyprzedzająca dyplomacja i poszukiwanie pokoju.

4. Logika geopolityczna: Chłodny rachunek zysków i strat, a nie „łaska sąsiada”
Napisała Pani, że „pokój zależny od sąsiada jest tylko łaską udzieloną na czas”. To błąd logiczny polegający na utożsamieniu pokoju z altruizmem.
Neutralność nie jest żebraniem o litość. Opiera się na chłodnej teorii gier i rachunku ekonomicznym.
Szwajcaria nie przetrwała II wojny światowej dlatego, że Hitler miał wobec niej „dobrą wolę” – Hitler gardził Szwajcarami. Przetrwała, ponieważ jej asymetryczna obrona (doktryna jeża) oraz status neutralnego węzła finansowego sprawiły, że inwazja była dla Rzeszy po prostu mniej opłacalna niż uszanowanie jej statusu. To nie była łaska – to była kalkulacja zysków i strat.

Pogląd, jakoby neutralność była „anomalią alpejską”, nie wytrzymuje zderzenia z faktami prawnymi:
- Malta – członek Unii Europejskiej, ma zakaz sojuszy i obcych baz zapisany wprost w art. 1 ust. 3 Konstytucji.
- Kostaryka – najbogatszy i najbardziej stabilny kraj Ameryki Środkowej, w art. 12 Konstytucji całkowicie zlikwidowała stałą armię.
- Turkmenistan – państwo z podbrzusza Rosji, wpisało neutralność do art. 2 Konstytucji, uzyskując jednomyślne uznanie Zgromadzenia Ogólnego ONZ.
- Austria (1955) – uzyskała wycofanie Armii Czerwonej ze swojego terytorium bez jednego wystrzału, właśnie dzięki konstytucyjnej neutralności na styku dwóch wrogich bloków.

5. Logika spójności: Głos Pana Posła w Lubminie a stanowisko Biura
W tym kontekście uderza mnie fundamentalna rozbieżność pomiędzy Pani argumentacją a publicznym świadectwem samego Pana Posła Grzegorza Brauna.
Występując niedawno w Lubminie, Pan Poseł z wielką odwagą i jasnością sformułował zasady, pod którymi podpisuję się obiema rękami:
Przypomniał, że „nie ma dobrobytu bez pokoju” („There cannot be prosperity without peace”).
Jasno zadeklarował: „Nie jesteśmy podżegaczami wojennymi” („We are not warmongers”).
Zaapelował o zakończenie wojen surowcowych i energetycznych oraz powrót do pragmatycznego, wielowektorowego handlu z sąsiadami (wymieniając zarówno Niemcy, jak i Rosję) w imię ratowania narodu przed bankructwem.

Zachodzi tu zatem oczywista sprzeczność logiczna: skoro sam Pan Poseł publicznie głosi prymat pokoju nad wojną, odrzuca podżeganie wojenne i domaga się dyplomacji handlowej ponad podziałami blokowymi, to dlaczego w oficjalnej korespondencji Biura odrzucają Państwo status Oazy Pokoju i wracają do pogańskiej doktryny wiecznego szykowania się do wojny? Przecież to, co Pan Poseł postulował w Lubminie, jest w swej istocie praktyczną realizacją założeń państwa neutralnego!

Podsumowanie i zaproszenie
W logice nie ma miejsca na wiarę, że Polska zdoła stać się potęgą militarną zdolną odstraszyć Rosję i Niemcy, kupując zagraniczny sprzęt na lichwiarski kredyt i dysponując kurczącą się populacją. To nie jest realizm – to powtórka z tragicznych złudzeń roku 1939.
Prawdziwy realizm i suwerenność polegają na stworzeniu z Polski asertywnej Oazy Pokoju – państwa, które rozwija własny dobrobyt (lemiesz), posiada powszechną obronę cywilną, a na arenie międzynarodowej nie daje się wciągać w cudze rozgrywki jako mięso armatnie.

Mając na względzie przyszłość Najjaśniejszej Rzeczypospolitej, serdecznie zapraszam Pana Posła Grzegorza Brauna oraz całe środowisko Konfederacji Korony Polskiej do dalszego dialogu i współtworzenia nowej doktryny bezpieczeństwa dla naszej Ojczyzny.

Wierzę głęboko, że jeśli Konfederacja przełamie wreszcie tabu i przestanie bać się słowa „neutralność”, to tym jednym, odważnym i tak unikanym dziś w polskiej polityce pojęciem zmusi miliony Polaków do zbawiennej refleksji i zdrowej kalkulacji. W sytuacji, gdy cały salon polityczny w Warszawie pogrążył się w wojennej gorączce, podniesienie sztandaru Pokoju i Neutralności może stać się dla Państwa formacji potężnym, unikalnym atutem programowym, który w nadchodzących wyborach parlamentarnych 2027 roku zmobilizuje milczącą większość narodu – Polaków, którzy nade wszystko pragną bezpiecznego domu, chrześcijańskiego pokoju i wolności od wojennych danin.

Z wyrazami należnego szacunku oraz w Miłości Słowa Bożego, oczekuję kontynuacji tego jakże owocnego dialogu.
Bogdan Zięba


Powyzszy list to odpowiedz na ponizszy:

6 Pazdz 2026

Szczęść Boże, Panie Bogdanie,

dziękuję za obszerny i merytoryczny list oraz za podjęcie próby
dalszego, rzeczowego dialogu o sprawach dla Polski fundamentalnych.
Zgadzam się z Panem co do jednego: Polska nie może być niczyim pionkiem,
a jej bezpieczeństwo nie może być przedmiotem cudzej geopolitycznej gry.

Właśnie dlatego nie mogę zgodzić się z wnioskiem, że rozwiązaniem
naszych problemów miałaby być neutralność.

Stara rzymska zasada mówi: „Si vis pacem, para bellum” – chcesz pokoju,
szykuj się do wojny. Nie jest to wezwanie do wojny. Jest dokładnie
odwrotnie. To wezwanie do takiego przygotowania państwa, aby wojna
przestała być dla potencjalnego agresora opłacalnym przedsięwzięciem.

Pokój, który zależy od dobrej woli sąsiada, nie jest trwałym pokojem.
Jest łaską udzieloną na czas, do którego druga strona może w każdej
chwili zmienić warunki.

Neutralność wymaga, aby ktoś tę neutralność respektował

Przykład Austrii jest interesujący, ale właśnie dlatego nie można go
bezpośrednio przenieść na sytuację Polski.

Austria w 1955 roku uzyskała neutralność w określonych warunkach
geopolitycznych i za zgodą mocarstw, które wcześniej podzieliły między
siebie strefy wpływów w Europie. Jej neutralność była elementem
większego porozumienia międzynarodowego.

Polska nie znajduje się jednak w analogicznej sytuacji.

Nie jesteśmy państwem położonym pomiędzy dwoma blokami, które wzajemnie
gwarantują sobie istnienie neutralnej strefy. Polska leży na wschodniej
flance NATO, graniczy z Rosją poprzez obwód królewiecki, graniczy z
Białorusią i znajduje się w bezpośrednim sąsiedztwie obszaru, na którym
toczy się wojna.

Co więcej, historia Polski uczy nas czegoś bardzo prostego: gwarancje
papierowe są warte tyle, ile jest warta siła państwa, które ma ich
dochodzić.

W 1939 roku mieliśmy traktaty, gwarancje i sojusze. Zabrakło natomiast
wystarczającej zdolności do samotnego powstrzymania agresora.

Nie chciałabym, abyśmy po raz kolejny budowali polską strategię
bezpieczeństwa na założeniu, że tym razem wielkie mocarstwa okażą się
bardziej skłonne do respektowania naszej neutralności niż interesów
własnych państw.

Silna armia nie oznacza militaryzacji narodu

Nie twierdzę, że Polska powinna zamienić się w koszary ani że każdy
problem należy rozwiązywać poprzez zwiększanie liczebności armii.

Twierdzę natomiast, że niepodległe państwo musi posiadać zdolność do
obrony własnego terytorium.

To jest zasadnicza różnica.

Nowoczesna armia nie musi oznaczać dziesiątek tysięcy młodych ludzi
„zamkniętych w koszarach”. Obronność XXI wieku to również przemysł,
technologie, drony, rozpoznanie, obrona powietrzna, artyleria, amunicja,
cyberbezpieczeństwo, infrastruktura, rezerwy i zdolność produkowania
podstawowych środków walki na własnym terytorium.

I tutaj dotyka Pan bardzo ważnego problemu: uzależnienie od
zagranicznych dostaw rzeczywiście nie jest pełną suwerennością.

Ale z tego nie wynika, że należy się rozbroić.

Wynika coś zupełnie przeciwnego: należy rozwijać własny przemysł
obronny, własne technologie, własne zdolności produkcyjne i własne
kadry. Jeżeli kupujemy uzbrojenie za granicą, powinno ono służyć również
budowaniu polskiego potencjału przemysłowego, a nie trwałemu
uzależnieniu od zagranicznych dostawców.

Niepodległość kosztuje. Brak niepodległości kosztuje znacznie więcej.

Demografia nie jest argumentem za słabością

Argument demograficzny również wymaga odwrócenia perspektywy.

Owszem, Polska ma problem demograficzny. Ale właśnie dlatego musimy być
państwem bogatym, silnym gospodarczo i bezpiecznym.

Nie widzę jednak żadnego logicznego związku pomiędzy koniecznością
posiadania zdolności obronnych a koniecznością prowadzenia gospodarki na
wzór starożytnej Sparty.

Polska nie musi być Spartą.

--
Teresa Pracownik

Asystent Krajowy Grzegorza Brauna - polskiego Posła do Parlamentu
Europejskiego

Tel: 605 959 400

Email: pracownik@gbraun.pl',
  key_claims_json = '["Właśnie dlatego nie mogę zgodzić się z wnioskiem, że rozwiązaniem naszych problemów miałaby być neutralność.","Przykład Austrii jest interesujący, ale właśnie dlatego nie można go bezpośrednio przenieść na sytuację Polski.","Nie twierdzę, że Polska powinna zamienić się w koszary ani że każdy problem należy rozwiązywać poprzez zwiększanie liczebności armii.","Twierdzę natomiast, że niepodległe państwo musi posiadać zdolność do obrony własnego terytorium.","Owszem, Polska ma problem demograficzny. Ale właśnie dlatego musimy być państwem bogatym, silnym gospodarczo i bezpiecznym."]'
  WHERE filename = 'lemiesz_to_korona_04.txt' AND length(body) < 300;
UPDATE correspondence_letters SET body = 'Wed 14 Oct, 01:27 

Szczęść Boże, Panie Bogdanie,

dziękuję za kolejny obszerny list i kontynuację naszej wymiany poglądów.
Doceniam Pańskie zaangażowanie w sprawy polskiej racji stanu, a także
troskę o pokój, dobrobyt i bezpieczeństwo naszych rodaków. Są to cele,
które niewątpliwie powinny łączyć wszystkich, którym leży na sercu
przyszłość Najjaśniejszej Rzeczypospolitej.

Pozwolę sobie jednak odnieść się do kilku kwestii, w których nasze
stanowiska pozostają odmienne.

Sanacja i lekcje historii

Nie uważam, aby okres sanacyjny stanowił właściwy punkt odniesienia dla
współczesnej dyskusji o polskiej obronności. Zgadzam się z Panem co do
krytycznej oceny ówczesnych elit, ich błędów i zaniedbań. Nie możemy
jednak pomijać faktu, że Polska po 123 latach zaborów odzyskała
niepodległość jako państwo wyniszczone, pozbawione spójnej
infrastruktury, zróżnicowane gospodarczo i społecznie oraz zmuszone do
odbudowy niemal wszystkich podstawowych instytucji państwowych.

Nie bez znaczenia pozostaje również polityczna droga Józefa
Piłsudskiego, którego socjalistyczna przeszłość i uwikłanie w rozgrywki
obcych mocarstw stanowią istotny element oceny jego działalności.
Historia II Rzeczypospolitej nie powinna zatem służyć jako prosty
argument za tym, że rozwój potencjału militarnego musi prowadzić do
zubożenia narodu. Należy wyciągać z niej wnioski, ale nie wolno
sprowadzać złożonych przyczyn ówczesnych porażek do jednego czynnika.

Siła państwa jako warunek pokoju

W jednym punkcie nasze stanowiska są zbieżne: pokój jest wartością
nadrzędną, a wojna oznacza tragedię ludzką, zniszczenie majątku
narodowego i zahamowanie rozwoju gospodarczego. Nie oznacza to jednak,
że w dzisiejszej, często amoralnej geopolityce pokój można zabezpieczyć
samymi deklaracjami, dobrą wolą czy statusem prawnym.

Odstraszać potencjalnego agresora może przede wszystkim realna siła
państwa: jego zdolności obronne, potencjał gospodarczy,
samowystarczalność w strategicznych dziedzinach oraz determinacja do
obrony własnych interesów.

Przywołuje Pan rok 1939 i ucieczkę ówczesnych władz do Rumunii. To
bolesna lekcja naszej historii. Nie sposób jednak nie zadać pytania:
skoro nasi ówcześni sojusznicy nie zapewnili Polsce skutecznej pomocy,
dlaczego mielibyśmy dziś zakładać, że inne państwa będą respektować
naszą neutralność, jeśli nie będzie ona odpowiadała ich interesom? Na
jakiej podstawie mielibyśmy przyjąć, że status neutralny zagwarantuje
nam bezpieczeństwo w sytuacji, w której interesy mocarstw okażą się
sprzeczne z naszymi?

Neutralność nie jest przecież magiczną formułą, która unieważnia
geopolitykę. Wymaga zarówno określonych warunków międzynarodowych, jak i
zdolności do obrony własnego terytorium.

Dlaczego Polska nie miałaby być potęgą?

Pyta Pan, czy Polska może stać się jednym z najsilniejszych państw
Europy. Uważam, że nie ma żadnego powodu, by z góry rezygnować z takich
ambicji.

Dlaczego mielibyśmy uznać, że naród polski jest skazany na ograniczoną
suwerenność, zależność gospodarczą i militarną oraz odgrywanie roli
przedmiotu cudzej polityki? Czy mamy przyjąć, że nasze położenie
geograficzne na zawsze determinuje naszą słabość?

Nie zgadzam się z takim podejściem. Polska powinna odzyskać rzeczywistą
niepodległość, a nie tylko formalnie cieszyć się własną państwowością.
Wymaga to odbudowy suwerenności gospodarczej, energetycznej i
politycznej, rozwoju rodzimego przemysłu, uwolnienia potencjału polskich
przedsiębiorców oraz stworzenia nowoczesnego systemu obrony.

Nie twierdzę, że możemy osiągnąć to bez kosztów ani że należy
bezrefleksyjnie wydawać pieniądze podatników na dowolne zakupy
zbrojeniowe. Przeciwnie, każda złotówka wydana na obronność powinna
służyć rzeczywistemu wzmocnieniu Polski. Musimy jednak odróżnić krytykę
niegospodarności od kwestionowania samej potrzeby posiadania silnej
armii.

Nie możemy również analizować obecnej sytuacji tak, jakby Polska była w
pełni suwerennym państwem, które swobodnie decyduje o własnych
interesach. W mojej ocenie znajdujemy się w sytuacji głębokiej
zależności politycznej i gospodarczej, a polskie państwo jest w znacznym
stopniu przechwycone przez układy interesów, które nie zawsze służą
dobru wspólnemu. Tym bardziej potrzebujemy odzyskania sprawczości i
rzeczywistej kontroli nad własnym losem.

Pokój, silna gospodarka i silna armia nie wykluczają się

Nie dostrzegam sprzeczności pomiędzy stanowiskiem wyrażanym przez Pana
Posła Grzegorza Brauna a argumentacją przedstawioną w mojej
wcześniejszej korespondencji.

Jeżeli Pan Poseł mówi, że nie jesteśmy podżegaczami wojennymi, opowiada
się za pokojem, krytykuje wojny surowcowe i energetyczne oraz postuluje
przywrócenie pragmatycznych relacji handlowych, nie oznacza to, że
opowiada się za bezbronnością Polski.

Przeciwnie: można jednocześnie sprzeciwiać się wojnom, dążyć do
pokojowej współpracy z sąsiadami, rozwijać gospodarkę i budować silne
zdolności militarne. Nie ma w tym żadnej sprzeczności. Silna armia nie
musi służyć prowadzeniu wojen napastniczych. Może stanowić instrument
odstraszania, zabezpieczenia granic i ochrony obywateli.

Naszym celem powinna być Polska będąca oazą pokoju, ale nie oazą
bezbronności. Państwo, które nie szuka konfliktów, nie daje się wciągać
w cudze wojny, prowadzi rozsądną politykę zagraniczną i handlową, a
zarazem posiada siłę wystarczającą, by nikt nie mógł bezkarnie naruszać
jego suwerenności.

Chcemy pokoju, ale pokoju opartego na respektowaniu polskich interesów.
Chcemy dobrobytu, ale nie dobrobytu budowanego na zależności od
zagranicznych ośrodków decyzyjnych. Chcemy dobrych relacji z sąsiadami,
ale nie za cenę rezygnacji z własnej podmiotowości.

Nie uważam zatem, aby właściwym rozwiązaniem dla Polski było przyjęcie
neutralności jako nadrzędnej doktryny państwowej, niezależnie od
uwarunkowań geopolitycznych. Uważam natomiast, że powinniśmy dążyć do
takiej pozycji międzynarodowej, w której Polska nie będzie musiała
wybierać pomiędzy uległością wobec jednego mocarstwa a podporządkowaniem
drugiemu.

Naszym celem jest suwerenna, silna i bezpieczna Polska

Panie Bogdanie, zgadzam się, że nie wolno bezkrytycznie przyjmować
narracji politycznych, które każą Polakom ponosić nieograniczone koszty
w imię interesów innych państw. Zgadzam się również, że polska polityka
zagraniczna powinna być pragmatyczna, a nie podporządkowana
ideologicznym schematom.

Różnimy się jednak w ocenie tego, jak najskuteczniej zapewnić Polsce
bezpieczeństwo. W moim przekonaniu nie wystarczy zadeklarować
neutralności. Musimy dysponować potencjałem, który sprawi, że nasze
stanowisko będzie respektowane, a ewentualna agresja okaże się
przedsięwzięciem nieopłacalnym.

Nie musimy wybierać między lemieszem a mieczem. Państwo, które
zaniedbuje gospodarkę, nie będzie miało środków na obronę. Państwo,
które zaniedbuje obronę, może natomiast utracić owoce pracy całych
pokoleń. Sztuką odpowiedzialnej polityki jest zachowanie właściwych
proporcji i podporządkowanie obu tych dziedzin nadrzędnemu celowi, jakim
jest dobro narodu.

Właśnie tak rozumiem postulat Polski będącej oazą pokoju: jako państwa,
które nie dąży do wojny, lecz jest na tyle silne, by nie musieć ulegać
szantażowi; które szanuje innych, ale samo również wymaga szacunku;
które prowadzi politykę pokojową, lecz nie rezygnuje z prawa do obrony
własnych granic i interesów.

Dziękuję Panu za zaproszenie do dalszego dialogu. Wymiana argumentów,
nawet przy istotnych różnicach zdań, ma sens, jeśli służy poszukiwaniu
rozwiązań rzeczywiście korzystnych dla Polski.

Z wyrazami szacunku,

--
Teresa Pracownik

Asystent Krajowy Grzegorza Brauna - polskiego Posła do Parlamentu
Europejskiego

Tel: 605 959 400

Email: pracownik@gbraun.pl',
  key_claims_json = '["Nie uważam, aby okres sanacyjny stanowił właściwy punkt odniesienia dla współczesnej dyskusji o polskiej obronności. Zgadzam się z Panem co do krytycznej oceny ówczesnych elit, ich błędów i zaniedbań. Nie możemy jednak pomijać faktu, że Polska po 123 latach zaborów odzyskała niepodległość jako państwo wyniszczone, pozbawione spójnej infrastruktury, zróżnicowane gospodarczo i społecznie oraz zmuszone do odbudowy niemal wszystkich podstawowych instytucji państwowych.","W jednym punkcie nasze stanowiska są zbieżne: pokój jest wartością nadrzędną, a wojna oznacza tragedię ludzką, zniszczenie majątku narodowego i zahamowanie rozwoju gospodarczego. Nie oznacza to jednak, że w dzisiejszej, często amoralnej geopolityce pokój można zabezpieczyć samymi deklaracjami, dobrą wolą czy statusem prawnym.","Nie twierdzę, że możemy osiągnąć to bez kosztów ani że należy bezrefleksyjnie wydawać pieniądze podatników na dowolne zakupy zbrojeniowe. Przeciwnie, każda złotówka wydana na obronność powinna służyć rzeczywistemu wzmocnieniu Polski. Musimy jednak odróżnić krytykę niegospodarności od kwestionowania samej potrzeby posiadania silnej armii.","Nie uważam zatem, aby właściwym rozwiązaniem dla Polski było przyjęcie neutralności jako nadrzędnej doktryny państwowej, niezależnie od uwarunkowań geopolitycznych. Uważam natomiast, że powinniśmy dążyć do takiej pozycji międzynarodowej, w której Polska nie będzie musiała wybierać pomiędzy uległością wobec jednego mocarstwa a podporządkowaniem drugiemu.","Różnimy się jednak w ocenie tego, jak najskuteczniej zapewnić Polsce bezpieczeństwo. W moim przekonaniu nie wystarczy zadeklarować neutralności. Musimy dysponować potencjałem, który sprawi, że nasze stanowisko będzie respektowane, a ewentualna agresja okaże się przedsięwzięciem nieopłacalnym."]'
  WHERE filename = 'korona_odp_04.txt' AND length(body) < 300;
INSERT INTO correspondence_letters (thread_id, turn_number, direction, sender, recipient, date_label, filename,
    summary_pl, summary_en, body, key_claims_json)
  SELECT t.id, 9, 'outbound', 'Bogdan Zięba (Przymierze Lemiesza)', 'Teresa Pracownik (Biuro Poselskie KKP)', '18 X 2026', 'lemiesz_to_korona_05.txt',
    'List V: Odpowiedź na „między lemieszem a mieczem” — żadne „między” nie istnieje, bo lemiesz to ta sama stal o innym powołaniu (Iz 2, 4); Polska jako Neutralne Mocarstwo, w którym każda zagroda jest kolcem jeża (mała retencja, schrony dla 100% ludności, V Konwencja Haska 1907); dziejowa szansa Grzegorza Brauna na rok 2027 (Lubmin: „We are not warmongers”).',
    'Letter V: Reply to "between the plowshare and the sword" — there is no "between", since the plowshare is the same steel with another calling (Isa 2:4); Poland as a Neutral Power in which every homestead is a hedgehog spine (small retention, shelters for 100% of the population, Hague Convention V 1907); Grzegorz Braun’s historic chance for 2027 (Lubmin: "We are not warmongers").',
    'Szczęść Boże!
Szanowna Pani Asystentko,
Szanowny Panie Pośle,

Bardzo dziękuję za czwarty list i kontynuację naszej dysputy. Z wielką uwagą odnotowuję, że pojawiły się w nim sformułowania o znaczeniu przełomowym: pisze Pani o celu, jakim ma być „Polska będąca oazą pokoju”, oraz o relacji „między lemieszem a mieczem”.

Pozwolę sobie odnieść się bezpośrednio do tych dwóch fundamentalnych kwestii.

1. Dlaczego żadne „między” nie istnieje?

Pisze Pani: „Nie musimy wybierać między lemieszem a mieczem (...) Sztuką odpowiedzialnej polityki jest zachowanie właściwych proporcji”.
Ma Pani rację, pisząc, że nie musimy wybierać między lemieszem a mieczem – ale w sensie znacznie głębszym, niż Pani sądzi: nie musimy wybierać, bo żadne „między” nie istnieje!

Prorok Izajasz nie mówi o kupowaniu dwóch zabawek i ważeniu ich na aptekarskiej szali. Mówi o przekuciu tej samej materii:
* Lemiesz to jest dokładnie ta sama stal, z której zrobiony był miecz.
* Różnica polega na powołaniu tego ostrza: miecz tnie ludzkie ciało, a lemiesz tnie ziemię.
* Gdy kowal przekuwa miecz na lemiesz, stal nie staje się woskiem ani plasteliną. Lemiesz to najtwardsza, hartowana stal, która kruszy kamienie i korzenie.
Naród, którego stal tnie ziemię i buduje twardy grunt pod własnymi stopami, jest niezwyciężony, bo staje się Sługą Życia. Naród, który trzyma stal w formie miecza, by ciąć ciała w cudzych awanturach pod dyktando zamorskich sztabów – sam od miecza ginie.

2. Polska jako Neutralne Mocarstwo: Każda zagroda zahartowanym kolcem jeża

Pisze Pani: „Naszym celem powinna być Polska będąca oazą pokoju, ale nie oazą bezbronności (...) dlaczego mielibyśmy dziś zakładać, że inne państwa będą respektować naszą neutralność?” oraz pyta: „Dlaczego Polska nie miałaby być potęgą?”.

Odpowiadam: Polska nie tylko może, ale musi być potęgą! Musi stać się Neutralnym Mocarstwem Europy Środkowej.

Walczą Państwo z chochołem, utożsamiając neutralność z bezbronnością, pacyfizmem czy liczeniem na „dobrą wolę sąsiada”. Wilk czy niedźwiedź nie omija jeża z litości ani z miłości – omija go dlatego, że próba połknięcia jeża oznacza "połamane zęby", krwotok i śmierć z głodu.
Neutralne Mocarstwo w mojej myśli to mocarstwo, w którym każdy Polak i Polka, każda gmina, wieś i zagroda stają się zahartowanym kolcem jeża:
* Kolce w ziemi i krajobrazie: Mała retencja, meandry i zlewiska rzek, które w pokoju rodzą plony, a w godzinie próby w 48 godzin topią obce zagony pancerne w polskim błocie.
* Lemiesze w każdej rodzinie: Wentylowane, podziemne schrony dla 100% ludności (wzorem neutralnej Szwajcarii), rozproszona łączność radiowa, zapasy żywności i powszechna obrona terytorialna pod każdym dachem.
* Twarde prawo międzynarodowe: V Konwencja Haska z 1907 r., która czyni terytorium neutralne nietykalnym i zamyka nasze niebo oraz szlaki przed obcymi wojskami.

Pytam w duchu chrześcijańskiego realizmu: Kto w Polsce proponuje dziś „oazę bezbronności”?
Czy Neutralne Mocarstwo ze schronami dla każdego dziecka i najeżoną każdą gminą?
Czy obecny salon polityczny (wspierany Państwa narracją), który kupuje na lichwiarski kredyt czołgi bez kodów źródłowych, z zamorskim kluczem wyłączenia, zostawiając 38 milionów Polaków w blokach bez ani jednego schronu i bez obrony cywilnej?

3. Dziejowa szansa Pana Posła Grzegorza Brauna na rok 2027

Występując w Lubminie, Pan Poseł Grzegorz Braun z wielką odwagą zadeklarował: „We are not warmongers”, „Nie ma dobrobytu bez pokoju” oraz wezwał do handlu surowcowego z sąsiadami.

Zadajmy sobie pytanie: w jakiej formule międzynarodowej te słowa stają się ciałem?
W formule „wschodniej flanki obcego sojuszu”? Nigdy! W tym układzie Polska jest wyłącznie zderzakiem atomowym. Jedyną formułą, która daje prawo do handlu ze wszystkimi i zdejmuje z naszych domów celownik wrogich rakiet, jest uzbrojona w lemiesze i kolce neutralna Polska.

Jeśli Konfederacja Korony Polskiej będzie powtarzać slogany MON-u o „budowie najsilniejszej armii”, zginie w tłumie wojennych krzykaczy z PiS i PO.
Dziejową szansą Pana Posła jest podniesienie sztandaru, którego boi się cały okrągłostołowy salon: Uzbrojona w Lemiesze i Kolce Neutralna Najjaśniejsza Rzeczpospolita – Mocarstwo i Oaza Pokoju. Mocarstwo wolnych gospodarzy, bezpiecznych rodzin i nienaruszalnego polskiego domu.


4. Ku dalszej rozmowie o Rzeczypospolitej

Zdaję sobie w pełni sprawę z wielowątkowego bogactwa Pani czwartego listu oraz wagi poruszonych w nim szczegółowych zagadnień historycznych, ustrojowych i geopolitycznych. Jeśli w tej odpowiedzi nie odniosłem się do każdego z nich w sposób wyczerpujący, to wyłącznie po to, aby nie rozmywać sedna sprawy i utrzymać twardy, jasny kurs naszej dysputy wokół spraw najbardziej kardynalnych.

Wierzę głęboko, że wszystkie te cenne myśli i wątki zostaną przez nas podjęte w dalszym toku dialogu, na którego owocną i życzliwą kontynuację z nadzieją oczekuję.

Z wyrazami szacunku i miłości Słowa Bożego
Bogdan Zięba',
    '["Bardzo dziękuję za czwarty list i kontynuację naszej dysputy. Z wielką uwagą odnotowuję, że pojawiły się w nim sformułowania o znaczeniu przełomowym: pisze Pani o celu, jakim ma być „Polska będąca oazą pokoju”, oraz o relacji „między lemieszem a mieczem”.","Pisze Pani: „Naszym celem powinna być Polska będąca oazą pokoju, ale nie oazą bezbronności (...) dlaczego mielibyśmy dziś zakładać, że inne państwa będą respektować naszą neutralność?” oraz pyta: „Dlaczego Polska nie miałaby być potęgą?”.","Odpowiadam: Polska nie tylko może, ale musi być potęgą! Musi stać się Neutralnym Mocarstwem Europy Środkowej.","Walczą Państwo z chochołem, utożsamiając neutralność z bezbronnością, pacyfizmem czy liczeniem na „dobrą wolę sąsiada”. Wilk czy niedźwiedź nie omija jeża z litości ani z miłości – omija go dlatego, że próba połknięcia jeża oznacza \"połamane zęby\", krwotok i śmierć z głodu. Neutralne Mocarstwo w mojej myśli to mocarstwo, w którym każdy Polak i Polka, każda gmina, wieś i zagroda stają się zahartowanym kolcem jeża: * Kolce w ziemi i krajobrazie: Mała retencja, meandry i zlewiska rzek, które w pokoju rodzą plony, a w godzinie próby w 48 godzin topią obce zagony pancerne w polskim błocie. * Lemiesze w każdej rodzinie: Wentylowane, podziemne schrony dla 100% ludności (wzorem neutralnej Szwajcarii), rozproszona łączność radiowa, zapasy żywności i powszechna obrona terytorialna pod każdym dachem. * Twarde prawo międzynarodowe: V Konwencja Haska z 1907 r., która czyni terytorium neutralne nietykalnym i zamyka nasze niebo oraz szlaki przed obcymi wojskami.","Zadajmy sobie pytanie: w jakiej formule międzynarodowej te słowa stają się ciałem? W formule „wschodniej flanki obcego sojuszu”? Nigdy! W tym układzie Polska jest wyłącznie zderzakiem atomowym. Jedyną formułą, która daje prawo do handlu ze wszystkimi i zdejmuje z naszych domów celownik wrogich rakiet, jest uzbrojona w lemiesze i kolce neutralna Polska."]'
  FROM correspondence_threads t
  WHERE t.slug = 'korona' AND NOT EXISTS (SELECT 1 FROM correspondence_letters WHERE filename = 'lemiesz_to_korona_05.txt');
