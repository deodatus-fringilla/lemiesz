-- Journal articles as blocks (D-lite, step 1). Each text gets its block list next to it, for the working copy and the
-- published version. body / published_body stay, but are now DERIVED from the blocks (flattened Markdown) for search,
-- RSS and citation checks; editors never edit them directly. Existing texts become one text block: nothing is lost and
-- nothing published has to be published again.

ALTER TABLE journal_article_texts ADD COLUMN blocks_json TEXT CHECK(blocks_json IS NULL OR json_valid(blocks_json));
ALTER TABLE journal_article_texts ADD COLUMN published_blocks_json TEXT CHECK(published_blocks_json IS NULL OR json_valid(published_blocks_json));

UPDATE journal_article_texts SET blocks_json = json_array(json_object('type', 'text', 'md', body));
UPDATE journal_article_texts
SET published_blocks_json = json_array(json_object('type', 'text', 'md', published_body))
WHERE published_body IS NOT NULL;
