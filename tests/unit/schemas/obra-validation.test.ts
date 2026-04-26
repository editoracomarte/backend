import obraSchema from '../../../src/api/obra/content-types/obra/schema.json';

describe('Obra schema ISBN regex', () => {
  const regex = new RegExp(obraSchema.attributes.isbn.regex);

  it.each([
    '978-85-254-3296-4',
    '0-306-40615-2',
    'ISBN 978-0-306-40615-7',
    '9780306406157',
    '0306406152',
  ])('should accept %s as a valid ISBN', (value) => {
    expect(regex.test(value)).toBe(true);
  });

  it.each(['', '123', 'abc-def-ghi', '978', '12345'])(
    'should reject %s as an invalid ISBN',
    (value) => {
      expect(regex.test(value)).toBe(false);
    }
  );
});

describe('Obra schema ISSN regex', () => {
  const regex = new RegExp(obraSchema.attributes.issn.regex);

  it.each(['1234-5678', '1234-567X', '0000-0000'])('should accept %s as a valid ISSN', (value) => {
    expect(regex.test(value)).toBe(true);
  });

  it.each(['', '12345678', '1234-56789', '1234-567', 'abcd-efgh'])(
    'should reject %s as an invalid ISSN',
    (value) => {
      expect(regex.test(value)).toBe(false);
    }
  );
});
