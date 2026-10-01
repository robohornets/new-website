-- 1. Outreach posts are back, and each can have its own photo album (like a
-- robot): photos uploaded on the post go into it, its main photo is the
-- post's cover, and it shows in the Gallery while the post is published.
ALTER TABLE posts ADD COLUMN album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL;

-- Posts that already have a cover get an album holding it, at the end of
-- the Gallery's order.
INSERT INTO albums (slug, title, description, season_year, published, cover_media_id, sort_order)
SELECT 'post-' || p.id, p.title, '', p.season_year, p.published, p.cover_media_id,
       (SELECT COALESCE(MAX(sort_order), 0) FROM albums) + p.id
FROM posts p
WHERE p.cover_media_id IS NOT NULL AND p.album_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM albums a WHERE a.slug = 'post-' || p.id);

UPDATE posts SET album_id = (SELECT a.id FROM albums a WHERE a.slug = 'post-' || posts.id)
WHERE cover_media_id IS NOT NULL AND album_id IS NULL;

INSERT OR IGNORE INTO album_photos (album_id, media_id, sort_order)
SELECT album_id, cover_media_id, 1 FROM posts WHERE album_id IS NOT NULL AND cover_media_id IS NOT NULL;

-- 2. Seasons now read "26-27" (the season stored as 2027). Robot albums
-- made automatically were titled "2027 robot: Roomba"; retitle the ones
-- nobody renamed to "26-27 robot: Roomba".
UPDATE albums SET title = printf('%02d-%02d', (r.season_year - 1) % 100, r.season_year % 100) || ' robot: ' || r.name
FROM robots r
WHERE r.album_id = albums.id AND albums.title = r.season_year || ' robot: ' || r.name;
