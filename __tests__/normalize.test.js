const { normalizePhone, normalizeEmail, normalizeName, mergeContacts, aggregateParts } = require('../src/utils/normalize');

test('normalize phone', () => {
  expect(normalizePhone('(123) 456-7890')).toBe('1234567890');
});

test('normalize email', () => {
  expect(normalizeEmail('  Foo@Bar.com ')).toBe('foo@bar.com');
  expect(normalizeEmail('not-an-email')).toBe(null);
});

test('merge contacts dedupes by email/phone/name+company', () => {
  const list = mergeContacts([[{ name: 'A', email: 'a@b.com' }], [{ name: 'A', email: 'A@B.COM' }]]);
  expect(list.length).toBe(1);
});

test('aggregateParts merges contacts and production', () => {
  const parts = [
    JSON.stringify({ contacts: [{ name: 'X' }], production: { title: 'Call 1' } }),
    JSON.stringify({ contacts: [{ name: 'Y' }] })
  ];
  const result = aggregateParts(parts);
  expect(result.contacts.length).toBe(2);
  expect(result.production.title).toBe('Call 1');
});


