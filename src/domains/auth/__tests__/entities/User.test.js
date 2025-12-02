/**
 * User Entity Tests
 */
const User = require('../../entities/User');
const Email = require('../../value-objects/Email');

describe('User Entity', () => {
  const validUserData = {
    id: '123',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hashed',
    provider: 'email',
    emailVerified: false
  };

  describe('Creation', () => {
    test('should create user with valid data', () => {
      const user = new User(validUserData);
      expect(user.getId()).toBe('123');
      expect(user.getEmailString()).toBe('test@example.com');
      expect(user.getName()).toBe('Test User');
    });

    test('should throw error without id', () => {
      expect(() => {
        new User({ ...validUserData, id: null });
      }).toThrow('User requires an id');
    });

    test('should throw error without email', () => {
      expect(() => {
        new User({ ...validUserData, email: null });
      }).toThrow('User requires an email');
    });

    test('should throw error without name', () => {
      expect(() => {
        new User({ ...validUserData, name: null });
      }).toThrow('User requires a name');
    });

    test('should accept Email value object', () => {
      const email = new Email('test@example.com');
      const user = new User({ ...validUserData, email });
      expect(user.getEmail()).toBeInstanceOf(Email);
    });
  });

  describe('Methods', () => {
    let user;

    beforeEach(() => {
      user = new User(validUserData);
    });

    test('isEmailVerified should return verification status', () => {
      expect(user.isEmailVerified()).toBe(false);
      const verified = user.withEmailVerified(true);
      expect(verified.isEmailVerified()).toBe(true);
    });

    test('isLocked should check lock status', () => {
      expect(user.isLocked()).toBe(false);
      
      const lockedUntil = new Date(Date.now() + 60000); // 1 minute from now
      const locked = user.withLoginAttempts(5, lockedUntil);
      expect(locked.isLocked()).toBe(true);
    });

    test('isLocked should return false if lock expired', () => {
      const lockedUntil = new Date(Date.now() - 60000); // 1 minute ago
      const user = new User({ ...validUserData, lockedUntil });
      expect(user.isLocked()).toBe(false);
    });

    test('getLoginAttempts should return attempts', () => {
      expect(user.getLoginAttempts()).toBe(0);
      const withAttempts = user.withLoginAttempts(3);
      expect(withAttempts.getLoginAttempts()).toBe(3);
    });
  });

  describe('Immutability', () => {
    test('withEmailVerified should return new instance', () => {
      const user1 = new User(validUserData);
      const user2 = user1.withEmailVerified(true);
      
      expect(user1).not.toBe(user2);
      expect(user1.isEmailVerified()).toBe(false);
      expect(user2.isEmailVerified()).toBe(true);
    });

    test('withLoginAttempts should return new instance', () => {
      const user1 = new User(validUserData);
      const user2 = user1.withLoginAttempts(5);
      
      expect(user1).not.toBe(user2);
      expect(user1.getLoginAttempts()).toBe(0);
      expect(user2.getLoginAttempts()).toBe(5);
    });

    test('withLastLoginAt should return new instance', () => {
      const user1 = new User(validUserData);
      const lastLogin = new Date();
      const user2 = user1.withLastLoginAt(lastLogin);
      
      expect(user1).not.toBe(user2);
      expect(user1.getLastLoginAt()).toBeNull();
      expect(user2.getLastLoginAt()).toEqual(lastLogin);
    });
  });

  describe('Conversion', () => {
    test('toObject should not expose sensitive data', () => {
      const user = new User(validUserData);
      const obj = user.toObject();
      
      expect(obj).not.toHaveProperty('passwordHash');
      expect(obj).not.toHaveProperty('twoFactorSecret');
      expect(obj).toHaveProperty('id');
      expect(obj).toHaveProperty('email');
    });

    test('fromPrisma should create user from Prisma model', () => {
      const prismaUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashed',
        provider: 'email',
        providerId: null,
        emailVerified: false,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const user = User.fromPrisma(prismaUser);
      expect(user.getId()).toBe('123');
      expect(user.getEmailString()).toBe('test@example.com');
    });
  });
});

