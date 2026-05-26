import instagramSchema from '../../../src/api/instagram/content-types/instagram/schema.json';

describe('Instagram schema', () => {
  it('should be a singleType with draftAndPublish enabled', () => {
    expect(instagramSchema.kind).toBe('singleType');
    expect(instagramSchema.options.draftAndPublish).toBe(true);
  });

  it('should require exactly 3 Postagem components of type midia.url', () => {
    const postagem = instagramSchema.attributes.Postagem;
    expect(postagem.type).toBe('component');
    expect(postagem.component).toBe('midia.url');
    expect(postagem.repeatable).toBe(true);
    expect(postagem.required).toBe(true);
    expect(postagem.min).toBe(3);
    expect(postagem.max).toBe(3);
  });
});
