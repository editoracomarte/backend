import instagramSchema from '../../../src/api/instagram/content-types/instagram/schema.json';

describe('Instagram schema', () => {
  it('should be a singleType with draftAndPublish enabled', () => {
    expect(instagramSchema.kind).toBe('singleType');
    expect(instagramSchema.options.draftAndPublish).toBe(true);
  });

  it('should require exactly 3 posts components of type midia.url', () => {
    const posts = instagramSchema.attributes.posts;
    expect(posts.type).toBe('component');
    expect(posts.component).toBe('midia.url');
    expect(posts.repeatable).toBe(true);
    expect(posts.required).toBe(true);
    expect(posts.min).toBe(3);
    expect(posts.max).toBe(3);
  });
});
