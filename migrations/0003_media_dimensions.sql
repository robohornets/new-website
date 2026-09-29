-- Pixel size of uploaded images, read with the Images binding's .info() at upload.
-- Lets pages reserve the right space and skip resizes larger than the original.
ALTER TABLE media ADD COLUMN width INTEGER;
ALTER TABLE media ADD COLUMN height INTEGER;
