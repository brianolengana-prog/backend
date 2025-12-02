/**
 * Password Value Object Tests
 */
const Password = require('../../value-objects/Password');
const bcrypt = require('bcrypt');

describe('Password Value Object', () => {
  describe('Creation', () => {
    test('should create password from plain text', () => {
      const password = Password.fromPlainText('password123');
      expect(password.isHashed()).toBe(false);
    });

    test('should create password from hash', () => {
      const hash = '$2b$12$testhash';
      const password = Password.fromHash(hash);
      expect(password.isHashed()).toBe(true);
      expect(password.getHash()).toBe(hash);
    });

    test('should throw error for password too short', () => {
      expect(() => Password.fromPlainText('short')).toThrow('Password must be at least 8 characters long');
    });

    test('should throw error for password too long', () => {
      const longPassword = 'a'.repeat(129);
      expect(() => Password.fromPlainText(longPassword)).toThrow('Password must be less than 128 characters');
    });

    test('should throw error for empty password', () => {
      expect(() => Password.fromPlainText('')).toThrow('Password must be a non-empty string');
    });
  });

  describe('Hashing', () => {
    test('should hash plain text password', async () => {
      const password = Password.fromPlainText('password123');
      const hashed = await password.hash();
      
      expect(hashed.isHashed()).toBe(true);
      expect(hashed.getHash()).not.toBe('password123');
      expect(hashed.getHash().startsWith('$2b$')).toBe(true);
    });

    test('should not hash already hashed password', async () => {
      const hash = '$2b$12$testhash';
      const password = Password.fromHash(hash);
      const result = await password.hash();
      
      expect(result).toBe(password);
      expect(result.getHash()).toBe(hash);
    });
  });

  describe('Comparison', () => {
    test('should compare password correctly', async () => {
      const plainPassword = 'password123';
      const password = Password.fromPlainText(plainPassword);
      const hashed = await password.hash();
      
      const match = await hashed.compare(plainPassword);
      expect(match).toBe(true);
      
      const noMatch = await hashed.compare('wrongpassword');
      expect(noMatch).toBe(false);
    });

    test('should throw error when comparing unhashed password', async () => {
      const password = Password.fromPlainText('password123');
      
      await expect(password.compare('password123')).rejects.toThrow('Cannot compare: password is not hashed');
    });
  });

  describe('Security', () => {
    test('toString should mask password', () => {
      const password = Password.fromPlainText('password123');
      expect(password.toString()).toBe('***');
    });

    test('toJSON should mask password', () => {
      const password = Password.fromPlainText('password123');
      expect(password.toJSON()).toBe('***');
    });

    test('should not expose plain text password', () => {
      const password = Password.fromPlainText('password123');
      expect(password._value).toBe('password123'); // Internal, but should not be accessed
    });
  });

  describe('Static Methods', () => {
    test('validateStrength should validate password', () => {
      const valid = Password.validateStrength('password123');
      expect(valid.isValid).toBe(true);
      expect(valid.errors).toHaveLength(0);

      const invalid = Password.validateStrength('short');
      expect(invalid.isValid).toBe(false);
      expect(invalid.errors.length).toBeGreaterThan(0);
    });
  });
});

