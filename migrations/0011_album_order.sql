-- Albums get an order an admin can drag around (photos inside an album
-- already have album_photos.sort_order). Starts as the order the site
-- already used: newest season first, then newest album first.
ALTER TABLE albums ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

UPDATE albums SET sort_order = (
  SELECT r.n FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY season_year IS NULL, season_year DESC, created_at DESC, id DESC) AS n FROM albums
  ) r WHERE r.id = albums.id
);
