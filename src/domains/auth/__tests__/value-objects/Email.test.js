/**
 * Email Value Object Tests
 */
const Email = require('../../value-objects/Email');

describe('Email Value Object', () => {
  describe('Creation', () => {
    test('should create email from valid string', () => {
      const email = new Email('test@example.com');
      expect(email.getValue()).toBe('test@example.com');
    });

    test('should normalize email to lowercase', () => {
      const email = new Email('Test@Example.COM');
      expect(email.getValue()).toBe('test@example.com');
    });

    test('should trim whitespace', () => {
      const email = new Email('  test@example.com  ');
      expect(email.getValue()).toBe('test@example.com');
    });

    test('should throw error for invalid email format', () => {
      expect(() => new Email('invalid-email')).toThrow('Invalid email format');
      expect(() => new Email('@example.com')).toThrow('Invalid email format');
      expect(() => new Email('test@')).toThrow('Invalid email format');
    });

    test('should throw error for empty string', () => {
      expect(() => new Email('')).toThrow('Email must be a non-empty string');
    });

    test('should throw error for non-string', () => {
      expect(() => new Email(null)).toThrow('Email must be a non-empty string');
      expect(() => new Email(123)).toThrow('Email must be a non-empty string');
    });

    test('should throw error for email too long', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      expect(() => new Email(longEmail)).toThrow('Email address too long');
    });
  });

  describe('Methods', () => {
    test('getValue should return email string', () => {
      const email = new Email('test@example.com');
      expect(email.getValue()).toBe('test@example.com');
    });

    test('getDomain should return domain part', () => {
      const email = new Email('test@example.com');
      expect(email.getDomain()).toBe('example.com');
    });

    test('getLocalPart should return local part', () => {
      const email = new Email('test@example.com');
      expect(email.getLocalPart()).toBe('test');
    });

    test('equals should compare emails correctly', () => {
      const email1 = new Email('test@example.com');
      const email2 = new Email('test@example.com');
      const email3 = new Email('other@example.com');
      
      expect(email1.equals(email2)).toBe(true);
      expect(email1.equals(email3)).toBe(false);
      expect(email1.equals('test@example.com')).toBe(false);
    });

    test('toString should return email string', () => {
      const email = new Email('test@example.com');
      expect(email.toString()).toBe('test@example.com');
    });

    test('toJSON should return email string', () => {
      const email = new Email('test@example.com');
      expect(email.toJSON()).toBe('test@example.com');
    });
  });

  describe('Static Methods', () => {
    test('fromString should create email', () => {
      const email = Email.fromString('test@example.com');
      expect(email.getValue()).toBe('test@example.com');
    });

    test('isValid should validate email format', () => {
      expect(Email.isValid('test@example.com')).toBe(true);
      expect(Email.isValid('invalid-email')).toBe(false);
      expect(Email.isValid('')).toBe(false);
    });
  });

  describe('Immutability', () => {
    test('should be immutable', () => {
      const email = new Email('test@example.com');
      expect(() => {
        email._value = 'hacked@example.com';
      }).not.toThrow();
      expect(email.getValue()).toBe('test@example.com');
    });
  });
});

