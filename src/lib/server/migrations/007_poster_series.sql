-- Phase 8: Poster Series & Planet-Satellite Architecture (Canon 04: Doktryna Jeza).
-- Extends campaign_posters to support series grouping, sequence ordering, planet/satellite hierarchy,
-- and dual-layer educational pairings (allegory vs realism).

ALTER TABLE campaign_posters ADD COLUMN series_slug TEXT DEFAULT NULL;
ALTER TABLE campaign_posters ADD COLUMN series_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campaign_posters ADD COLUMN is_planet INTEGER NOT NULL DEFAULT 0 CHECK(is_planet IN (0, 1));
ALTER TABLE campaign_posters ADD COLUMN layer TEXT NOT NULL DEFAULT 'standalone' CHECK(layer IN ('allegory', 'realism', 'standalone'));
ALTER TABLE campaign_posters ADD COLUMN pair_key TEXT DEFAULT NULL;
ALTER TABLE campaign_posters ADD COLUMN moral_quote_pl TEXT DEFAULT NULL;
ALTER TABLE campaign_posters ADD COLUMN moral_quote_en TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_posters_series ON campaign_posters(series_slug, series_order);
CREATE INDEX IF NOT EXISTS idx_campaign_posters_pair ON campaign_posters(series_slug, pair_key);
