import type { Core } from '@strapi/strapi';

let uploadSeq = 0;

/**
 * Creates a `plugin::upload.file` record directly in the database and returns
 * its numeric id, suitable for assigning to a media field (e.g. `book.cover`).
 *
 * `book.cover` is required, so integration tests that create a book need a
 * media id to satisfy the schema. The sequence keeps `hash`/`url` unique across
 * calls without callers having to coordinate.
 */
export async function createUploadFile(
  strapi: Core.Strapi,
  overrides: Record<string, unknown> = {}
): Promise<number> {
  uploadSeq += 1;
  const file = await strapi.db.query('plugin::upload.file').create({
    data: {
      name: 'cover.jpg',
      hash: `cover_hash_${uploadSeq}`,
      ext: '.jpg',
      mime: 'image/jpeg',
      size: 10,
      url: `/uploads/cover_hash_${uploadSeq}.jpg`,
      provider: 'local',
      ...overrides,
    },
  });

  return file.id;
}
