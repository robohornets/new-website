-- Fingerprints for spotting duplicate uploads, worked out by the browser:
-- sha256 is the exact file the person picked (for videos, before converting
-- to MP4); phash is a 64-bit "difference hash" of what a photo looks like
-- (16 hex digits), the same for resized or re-saved copies, followed by its
-- average colour (6 hex digits). '' means the browser couldn't read the
-- photo (HEIC outside Safari, or one flat colour); NULL means not worked
-- out yet (the Duplicates page fills those in).
ALTER TABLE media ADD COLUMN sha256 TEXT;
ALTER TABLE media ADD COLUMN phash TEXT;
CREATE INDEX media_sha256 ON media(sha256) WHERE sha256 IS NOT NULL;
-- Near copies differ in a few bits, so at least one of the four quarters of
-- the pattern usually matches exactly: these find the candidates to compare.
CREATE INDEX media_phash_1 ON media(substr(phash, 1, 4)) WHERE phash != '';
CREATE INDEX media_phash_2 ON media(substr(phash, 5, 4)) WHERE phash != '';
CREATE INDEX media_phash_3 ON media(substr(phash, 9, 4)) WHERE phash != '';
CREATE INDEX media_phash_4 ON media(substr(phash, 13, 4)) WHERE phash != '';

-- Pairs someone said aren't duplicates (on the Duplicates page), so they
-- aren't suggested again. a < b.
CREATE TABLE media_distinct (
  a INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  b INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  PRIMARY KEY (a, b)
);
