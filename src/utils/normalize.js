function normalizePhone(phone) {
  if (!phone) return null;
  const digits = ('' + phone).replace(/[^\d+]/g, '');
  return digits || null;
}

function normalizeEmail(email) {
  if (!email) return null;
  const lower = ('' + email).trim().toLowerCase();
  return /.+@.+\..+/.test(lower) ? lower : null;
}

function normalizeName(name) {
  if (!name) return null;
  return ('' + name).trim().replace(/\s+/g, ' ');
}

function normalizeContact(contact) {
  return {
    name: normalizeName(contact.name),
    role: contact.role ? ('' + contact.role).trim() : null,
    phone: normalizePhone(contact.phone),
    email: normalizeEmail(contact.email),
    company: contact.company ? ('' + contact.company).trim() : null
  };
}

function contactKey(c) {
  return [c.email || '', c.phone || '', (c.name || '') + '|' + (c.company || '')]
    .join('#')
    .toLowerCase();
}

function mergeContacts(contactLists) {
  const map = new Map();
  for (const list of contactLists) {
    for (const raw of list) {
      const c = normalizeContact(raw);
      const key = contactKey(c);
      if (!map.has(key)) map.set(key, c);
    }
  }
  return Array.from(map.values()).filter(c => c.name || c.email || c.phone);
}

function aggregateParts(parts) {
  const contacts = [];
  const productions = [];
  for (const part of parts) {
    try {
      const obj = typeof part === 'string' ? JSON.parse(part) : part;
      if (Array.isArray(obj?.contacts)) contacts.push(obj.contacts);
      if (obj?.production) productions.push(obj.production);
    } catch {}
  }
  const mergedContacts = mergeContacts(contacts);
  const production = productions.find(Boolean) || {};
  return { contacts: mergedContacts, production, meta: { confidence: 0.8 } };
}

module.exports = { normalizePhone, normalizeEmail, normalizeName, normalizeContact, mergeContacts, aggregateParts };


