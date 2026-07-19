import authorSchema from '../../../src/api/author/content-types/author/schema.json';

describe('Author schema Lattes regex', () => {
  const regex = new RegExp(authorSchema.attributes.lattes.regex);

  it.each(['http://lattes.cnpq.br/1234567890123456', 'https://lattes.cnpq.br/0000000000000000'])(
    'should accept %s as a valid Lattes URL',
    (value) => {
      expect(regex.test(value)).toBe(true);
    }
  );

  it.each([
    '',
    'http://lattes.cnpq.br/1234567890',
    'http://lattes.cnpq.br/12345678901234567',
    'lattes.cnpq.br/1234567890123456',
    'http://evil.com/1234567890123456',
  ])('should reject %s as an invalid Lattes URL', (value) => {
    expect(regex.test(value)).toBe(false);
  });
});

describe('Author schema ORCID regex', () => {
  const regex = new RegExp(authorSchema.attributes.orcid.regex);

  it.each(['https://orcid.org/0000-0002-1825-0097', 'http://orcid.org/0000-0002-1825-009X'])(
    'should accept %s as a valid ORCID URL',
    (value) => {
      expect(regex.test(value)).toBe(true);
    }
  );

  it.each([
    '',
    '0000-0002-1825-0097',
    'https://orcid.org/0000-0002-1825-00970',
    'https://orcid.org/0000-0002-1825-009',
    'https://evil.org/0000-0002-1825-0097',
  ])('should reject %s as an invalid ORCID URL', (value) => {
    expect(regex.test(value)).toBe(false);
  });
});
