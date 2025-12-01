/**
 * Extraction Service Integration Tests
 * 
 * Tests the new extraction domain architecture
 * Verifies that all components work together
 */

const ExtractionService = require('../../../src/domains/extraction/services/ExtractionService');
const ExtractionStrategyFactory = require('../../../src/domains/extraction/services/ExtractionStrategyFactory');
const PatternExtractionStrategy = require('../../../src/domains/extraction/strategies/pattern/PatternExtractionStrategy');
const Document = require('../../../src/domains/extraction/value-objects/Document');

describe('ExtractionService Integration', () => {
  let extractionService;
  let strategyFactory;

  beforeEach(() => {
    strategyFactory = new ExtractionStrategyFactory();
    extractionService = new ExtractionService({
      strategyFactory
    });
  });

  describe('extractContactsFromText', () => {
    test('should extract contacts from call sheet text', async () => {
      const callSheetText = `
DIRECTOR: John Smith | john@example.com | c. 555-1234
PRODUCER: Jane Doe | jane@example.com | c. 555-5678
CAMERA: Bob Johnson | bob@example.com | c. 555-9012
      `;

      const result = await extractionService.extractContactsFromText(callSheetText, {
        extractionId: 'test_123'
      });

      expect(result.isSuccessful()).toBe(true);
      expect(result.hasContacts()).toBe(true);
      expect(result.getContactCount()).toBeGreaterThan(0);
      expect(result.contacts.length).toBeGreaterThan(0);
      
      // Verify contact structure
      const firstContact = result.contacts[0];
      expect(firstContact).toHaveProperty('name');
      expect(firstContact.name).toBeTruthy();
    });

    test('should handle empty text gracefully', async () => {
      const result = await extractionService.extractContactsFromText('', {
        extractionId: 'test_empty'
      });

      expect(result.isFailed()).toBe(true);
      expect(result.getContactCount()).toBe(0);
    });

    test('should return ExtractionResult value object', async () => {
      const text = 'DIRECTOR: Test User | test@example.com | c. 555-0000';
      const result = await extractionService.extractContactsFromText(text);

      // Verify it's an ExtractionResult
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('contacts');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('isSuccessful');
      expect(result).toHaveProperty('getContactCount');
    });
  });

  describe('Strategy Selection', () => {
    test('should select pattern strategy for call sheets', async () => {
      const document = Document.fromText(
        'DIRECTOR: Test | test@example.com | c. 555-0000',
        'call-sheet.pdf'
      );

      const strategy = await strategyFactory.createStrategyForDocument(document, {
        preferFast: true
      });

      expect(strategy).toBeInstanceOf(PatternExtractionStrategy);
    });

    test('should get available strategies', async () => {
      const strategies = await strategyFactory.getAvailableStrategies({
        type: 'call_sheet'
      });

      expect(Array.isArray(strategies)).toBe(true);
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies[0]).toHaveProperty('strategy');
      expect(strategies[0]).toHaveProperty('confidence');
    });
  });

  describe('Error Handling', () => {
    test('should handle extraction errors gracefully', async () => {
      // This should not throw, but return a failed result
      const result = await extractionService.extractContactsFromText(null);

      expect(result.isFailed()).toBe(true);
      expect(result.error).toBeTruthy();
    });
  });
});

