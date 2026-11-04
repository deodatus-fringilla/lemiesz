-- Journal images (D-lite step 3). The image library is campaign_posters (local images with authorship and approval);
-- articles reuse it instead of a new table. Added: alternative text per language (required for an image to appear in
-- an article), a licence (required for uploads), where the file comes from, and its pixel size (for layout).
-- Uploads live in data/uploads/journal and are served at /images/uploads/<content-hash>.<ext>.

ALTER TABLE campaign_posters ADD COLUMN alt_pl TEXT;
ALTER TABLE campaign_posters ADD COLUMN alt_en TEXT;
ALTER TABLE campaign_posters ADD COLUMN license TEXT;
ALTER TABLE campaign_posters ADD COLUMN origin TEXT NOT NULL DEFAULT 'static' CHECK(origin IN ('static', 'upload'));
ALTER TABLE campaign_posters ADD COLUMN width INTEGER CHECK(width IS NULL OR width > 0);
ALTER TABLE campaign_posters ADD COLUMN height INTEGER CHECK(height IS NULL OR height > 0);
