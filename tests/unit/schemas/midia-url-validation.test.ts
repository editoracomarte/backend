import urlComponent from '../../../src/components/midia/url.json';

describe('midia.url component schema', () => {
  it('should declare url as a required, unique string', () => {
    expect(urlComponent.attributes.url.type).toBe('string');
    expect(urlComponent.attributes.url.required).toBe(true);
    expect(urlComponent.attributes.url.unique).toBe(true);
  });

  it('should declare rotulo as an optional string', () => {
    expect(urlComponent.attributes.rotulo.type).toBe('string');
    expect((urlComponent.attributes.rotulo as { required?: boolean }).required).toBeUndefined();
  });
});
