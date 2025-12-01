# Contacts Domain

**Status**: Planning  
**Migration Date**: TBD (Phase 3)

This domain handles all contact management functionality.

## Structure

```
domains/contacts/
├── entities/
│   └── Contact.js              # Contact entity (domain model)
├── services/
│   ├── ContactService.js        # Business logic
│   ├── ContactExportService.js  # Export functionality
│   └── ContactSearchService.js  # Search functionality
└── repositories/
    └── ContactRepository.js     # Data access (example implementation)
```

## Current Services to Migrate

- `src/services/contacts.service.js` → `domains/contacts/services/ContactService.js`
- `src/services/export.service.js` → `domains/contacts/services/ContactExportService.js`

## Example Repository

See `repositories/ContactRepository.js` for example implementation using BaseRepository pattern.

## Migration Notes

- ContactRepository example is already implemented in Phase 1
- Full domain migration will happen in Phase 3
- Old services will remain until migration is complete

