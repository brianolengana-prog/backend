/**
 * Auth Result Value Object Tests
 */
const AuthResult = require('../../value-objects/AuthResult');

describe('Auth Result Value Object', () => {
  const mockUser = { id: '123', email: 'test@example.com', name: 'Test User' };
  const mockSession = { id: 'session123', accessToken: 'token', refreshToken: 'refresh' };

  describe('Success Result', () => {
    test('should create success result', () => {
      const result = AuthResult.success({
        user: mockUser,
        accessToken: 'token123',
        refreshToken: 'refresh123',
        session: mockSession
      });

      expect(result.isSuccess()).toBe(true);
      expect(result.isFailure()).toBe(false);
      expect(result.getUser()).toEqual(mockUser);
      expect(result.getAccessToken()).toBe('token123');
      expect(result.getRefreshToken()).toBe('refresh123');
      expect(result.getSession()).toEqual(mockSession);
    });

    test('should throw error if success without user', () => {
      expect(() => {
        AuthResult.success({
          accessToken: 'token123'
        });
      }).toThrow('Successful auth result requires a user');
    });
  });

  describe('Failure Result', () => {
    test('should create failure result', () => {
      const result = AuthResult.failure({
        error: 'Invalid credentials'
      });

      expect(result.isSuccess()).toBe(false);
      expect(result.isFailure()).toBe(true);
      expect(result.getError()).toBe('Invalid credentials');
      expect(result.getUser()).toBeNull();
    });

    test('should throw error if failure without error', () => {
      expect(() => {
        AuthResult.failure({});
      }).toThrow('Failed auth result requires an error');
    });
  });

  describe('Conversion', () => {
    test('toObject should return correct structure for success', () => {
      const result = AuthResult.success({
        user: mockUser,
        accessToken: 'token123',
        refreshToken: 'refresh123',
        session: mockSession,
        message: 'Success'
      });

      const obj = result.toObject();
      expect(obj).toEqual({
        success: true,
        user: mockUser,
        token: 'token123',
        refreshToken: 'refresh123',
        session: mockSession,
        message: 'Success'
      });
    });

    test('toObject should return correct structure for failure', () => {
      const result = AuthResult.failure({
        error: 'Invalid credentials',
        message: 'Failed'
      });

      const obj = result.toObject();
      expect(obj).toEqual({
        success: false,
        error: 'Invalid credentials',
        message: 'Failed'
      });
    });

    test('toJSON should return same as toObject', () => {
      const result = AuthResult.success({
        user: mockUser,
        accessToken: 'token123',
        refreshToken: 'refresh123',
        session: mockSession
      });

      expect(result.toJSON()).toEqual(result.toObject());
    });
  });

  describe('Immutability', () => {
    test('should be immutable', () => {
      const result = AuthResult.success({
        user: mockUser,
        accessToken: 'token123',
        refreshToken: 'refresh123',
        session: mockSession
      });

      expect(() => {
        result._success = false;
      }).not.toThrow();
      expect(result.isSuccess()).toBe(true);
    });
  });
});

