-- Journal layout: one or two columns, a setting of each text (language) and not a block. The text flows from the
-- first column into the second, as in the article editor's two-column preview. It follows the same working-copy /
-- published-copy split as the content, so changing the layout needs approval like any other change.
-- Articles that used the old `columns` block keep their look: their blocks are read as one flat list (see
-- journal-blocks.ts) and they get two columns here.

ALTER TABLE journal_article_texts ADD COLUMN layout_columns INTEGER NOT NULL DEFAULT 1 CHECK(layout_columns IN (1, 2));
ALTER TABLE journal_article_texts ADD COLUMN published_layout_columns INTEGER CHECK(published_layout_columns IS NULL OR published_layout_columns IN (1, 2));

UPDATE journal_article_texts SET layout_columns = 2 WHERE blocks_json LIKE '%"type":"columns"%';
UPDATE journal_article_texts
SET published_layout_columns = CASE WHEN published_blocks_json LIKE '%"type":"columns"%' THEN 2 ELSE 1 END
WHERE published_body IS NOT NULL;
