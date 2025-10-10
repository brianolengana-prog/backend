/**
 * Component Contact Extractor - Test Suite
 * 
 * Comprehensive tests for enterprise-grade extraction
 */

const ComponentContactExtractor = require('../ComponentContactExtractor');

describe('ComponentContactExtractor - Enterprise Tests', () => {
  
  describe('Basic Extraction', () => {
    test('should extract structured contact with role, name, and phone', async () => {
      const text = 'PHOTOGRAPHER: John Doe / 917-555-1234';
      
      const result = await ComponentContactExtractor.extract(text);
      
      expect(result.success).toBe(true);
      expect(result.contacts).toHaveLength(1);
      expect(result.contacts[0]).toMatchObject({
        role: 'PHOTOGRAPHER',
        name: 'John Doe',
        phone: '+19175551234'
      });
    });

    test('should extract contact with email', async () => {
      const text = 'STYLIST: Jane Smith / jane@example.com / 646-555-9876';
      
      const result = await ComponentContactExtractor.extract(text);
      
      expect(result.success).toBe(true);
      expect(result.contacts).toHaveLength(1);
      expect(result.contacts[0]).toMatchObject({
        role: 'STYLIST',
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '+16465559876'
      });
    });

    test('should extract multiple contacts', async () => {
      const text = `
        PHOTOGRAPHER: John Doe / 917-555-1234
        STYLIST: Jane Smith / jane@example.com
        MUA: Alice Brown / 646-555-7777
      `;
      
      const result = await ComponentContactExtractor.extract(text);
      
      expect(result.success).toBe(true);
      expect(result.contacts.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Text Normalization', () => {
    test('should fix spacing in role names', async () => {
      const text = 'p hotog ra phe r: John Doe / 917-555-1234';
      
      const result = await ComponentContactExtractor.extract(text);
      
      expect(result.success).toBe(true);
      expect(result.contacts[0].role).toMatch(/PHOTOGRAPHER/i);
    });

    test('should handle various separators', async () => {
      const tests = [
        'PHOTOGRAPHER: John Doe / 917-555-1234',
        'PHOTOGRAPHER: John Doe - 917-555-1234',
        'PHOTOGRAPHER | John Doe | 917-555-1234'
      ];
      
      for (const text of tests) {
        const result = await ComponentContactExtractor.extract(text);
        expect(result.success).toBe(true);
        expect(result.contacts.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('Phone Number Handling', () => {
    test('should normalize various phone formats', async () => {
      const formats = [
        '9175551234',
        '917-555-1234',
        '(917) 555-1234',
        '+1 917 555 1234',
        '917.555.1234'
      ];
      
      for (const phone of formats) {
        const text = `PHOTOGRAPHER: John Doe / ${phone}`;
        const result = await ComponentContactExtractor.extract(text);
        
        expect(result.success).toBe(true);
        expect(result.contacts[0].phone).toMatch(/^\+1917555/);
      }
    });

    test('should handle international numbers', async () => {
      const text = 'PHOTOGRAPHER: John Doe / +44 20 7946 0958';
      
      const result = await ComponentContactExtractor.extract(text);
      
      expect(result.success).toBe(true);
      expect(result.contacts[0].phone).toContain('+44');
    });
  });

  describe('Email Validation', () => {
    test('should accept valid emails', async () => {
      const validEmails = [
        'john@example.com',
        'john.doe@example.com',
        'john+tag@example.co.uk'
      ];
      
      for (const email of validEmails) {
        const text = `PHOTOGRAPHER: John Doe / ${email}`;
        const result = await ComponentContactExtractor.extract(text);
        
        expect(result.success).toBe(true);
        expect(result.contacts[0].email).toBe(email.toLowerCase());
      }
    });

    test('should reject invalid emails', async () => {
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'john@',
        'john@.com'
      ];
      
      for (const email of invalidEmails) {
        const text = `PHOTOGRAPHER: John Doe / ${email}`;
        const result = await ComponentContactExtractor.extract(text);
        
        // Should either reject the contact or have empty email
        if (result.contacts.length > 0) {
          expect(result.contacts[0].email).toBe('');
        }
      }
    });
  });

  describe('Validation Rules', () => {
    test('should reject contacts without name', async () => {
      const text = 'PHOTOGRAPHER: / 917-555-1234';
      
      const result = await ComponentContactExtractor.extract(text);
      
      // Should not extract contact without name
      expect(result.contacts.length).toBe(0);
    });

    test('should reject contacts without contact info', async () => {
      const text = 'PHOTOGRAPHER: John Doe';
      
      const result = await ComponentContactExtractor.extract(text);
      
      // Should not extract contact without phone or email
      expect(result.contacts.length).toBe(0);
    });

    test('should reject single-word names without email', async () => {
      const text = 'PHOTOGRAPHER: John / 917-555-1234';
      
      const result = await ComponentContactExtractor.extract(text);
      
      // Single word names are low confidence
      // May be rejected depending on validation rules
      if (result.contacts.length > 0) {
        expect(result.contacts[0].confidence).toBeLessThan(0.8);
      }
    });

    test('should reject roles that look like addresses', async () => {
      const text = '72 Greene Ave, Brooklyn NY: John Doe / 917-555-1234';
      
      const result = await ComponentContactExtractor.extract(text);
      
      // Should reject or have low confidence
      if (result.contacts.length > 0) {
        expect(result.contacts[0].role).not.toMatch(/brooklyn|greene/i);
      }
    });
  });

  describe('Confidence Scoring', () => {
    test('should assign high confidence to complete contacts', async () => {
      const text = 'PHOTOGRAPHER: John Doe / john@example.com / 917-555-1234';
      
      const result = await ComponentContactExtractor.extract(text);
      
      expect(result.success).toBe(true);
      expect(result.contacts[0].confidence).toBeGreaterThan(0.7);
    });

    test('should assign lower confidence to incomplete contacts', async () => {
      const text = 'John Doe / 917-555-1234'; // No role
      
      const result = await ComponentContactExtractor.extract(text);
      
      if (result.contacts.length > 0) {
        expect(result.contacts[0].confidence).toBeLessThan(0.8);
      }
    });
  });

  describe('Real-World Call Sheet', () => {
    test('should extract from actual call sheet format', async () => {
      const callSheet = `
        Call Sheet: SS26 Editorial 9.19
        Date: 09.19.2025
        Call Time: 7:55 AM
        Location: 72 Greene Ave, Brooklyn NY
        
        Crew
        Photographer: Coni Tarallo / 929.250.6798
        1st Photo Assistant: Asa Lory / 573.823.9705
        2nd Photo Assistant: Kevin Mathien / 312.519.0901
        Digitech: William Manchuck / 860.888.2173
        
        Talent
        Model: BIANCA FELICIANO / Ford - Brett Pougnet / 917.783.8966
        
        Hair & Makeup
        MUA: Yuko Kawashima / 646.578.2704
        HUA: Juli Akaneya / 201.647.7724
        HMUA: Mariolga Pantazopoulos / 617.590.9160
        
        Styling
        Stylist: Francesca Tonelli / 774.571.9338
        Stylist: Danielle Dinten / 347.420.8522
      `;
      
      const result = await ComponentContactExtractor.extract(callSheet);
      
      expect(result.success).toBe(true);
      expect(result.contacts.length).toBeGreaterThanOrEqual(10);
      
      // Check for specific contacts
      const yuko = result.contacts.find(c => c.name.includes('Yuko'));
      expect(yuko).toBeDefined();
      expect(yuko.role).toMatch(/MUA/i);
      
      const coni = result.contacts.find(c => c.name.includes('Coni'));
      expect(coni).toBeDefined();
      expect(coni.role).toMatch(/PHOTOGRAPHER/i);
    });
  });

  describe('Performance', () => {
    test('should process large text efficiently', async () => {
      // Generate large text with many contacts
      let largeText = '';
      for (let i = 0; i < 100; i++) {
        largeText += `ROLE ${i}: Person ${i} / ${i}@example.com / 917-555-${String(i).padStart(4, '0')}\n`;
      }
      
      const startTime = Date.now();
      const result = await ComponentContactExtractor.extract(largeText);
      const processingTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(1000); // Should be under 1 second
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty input', async () => {
      const result = await ComponentContactExtractor.extract('');
      
      expect(result.success).toBe(true);
      expect(result.contacts).toHaveLength(0);
    });

    test('should handle text with no contacts', async () => {
      const text = 'This is just some random text without any contacts.';
      
      const result = await ComponentContactExtractor.extract(text);
      
      expect(result.success).toBe(true);
      expect(result.contacts).toHaveLength(0);
    });

    test('should handle special characters in names', async () => {
      const text = "PHOTOGRAPHER: O'Brien-Smith / 917-555-1234";
      
      const result = await ComponentContactExtractor.extract(text);
      
      expect(result.success).toBe(true);
      expect(result.contacts[0].name).toContain('Brien');
    });
  });

  describe('Metadata', () => {
    test('should include extraction metadata', async () => {
      const text = 'PHOTOGRAPHER: John Doe / 917-555-1234';
      
      const result = await ComponentContactExtractor.extract(text);
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata.extractionId).toBeDefined();
      expect(result.metadata.strategy).toBe('component-first-enterprise');
      expect(result.metadata.processingTime).toBeDefined();
    });

    test('should include component statistics', async () => {
      const text = 'PHOTOGRAPHER: John Doe / john@example.com / 917-555-1234';
      
      const result = await ComponentContactExtractor.extract(text);
      
      expect(result.metadata.components).toBeDefined();
      expect(result.metadata.components.rolesFound).toBeGreaterThan(0);
      expect(result.metadata.components.namesFound).toBeGreaterThan(0);
    });
  });
});

