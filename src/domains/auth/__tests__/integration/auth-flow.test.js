/**
 * Auth Flow Integration Tests
 * 
 * Tests the complete authentication flow using the new domain structure
 * 
 * NOTE: These tests require a database connection. For now, they're skipped.
 * To run them, set up a test database and uncomment the tests.
 */
const AuthService = require('../../services/AuthService');

describe('Auth Flow Integration', () => {
  // Skip integration tests for now - require database setup
  test.skip('should register new user successfully', async () => {
    const authService = new AuthService();
    const result = await authService.register({
      name: 'Test User',
      email: 'newuser@example.com',
      password: 'password123'
    });

    expect(result.isSuccess()).toBe(true);
    expect(result.getUser()).toBeDefined();
    expect(result.getAccessToken()).toBeDefined();
    expect(result.getRefreshToken()).toBeDefined();
  });

  test.skip('should fail if user already exists', async () => {
    const authService = new AuthService();
    // Register first time
    await authService.register({
      name: 'Test User',
      email: 'existing@example.com',
      password: 'password123'
    });

    // Try to register again
    const result = await authService.register({
      name: 'Test User',
      email: 'existing@example.com',
      password: 'password123'
    });

    expect(result.isFailure()).toBe(true);
    expect(result.getError()).toContain('already exists');
  });

  test.skip('should login with correct credentials', async () => {
    const authService = new AuthService();
    // Register user first
    await authService.register({
      name: 'Test User',
      email: 'login@example.com',
      password: 'password123'
    });

    // Login
    const result = await authService.login({
      email: 'login@example.com',
      password: 'password123'
    });

    expect(result.isSuccess()).toBe(true);
    expect(result.getUser()).toBeDefined();
    expect(result.getAccessToken()).toBeDefined();
  });

  test.skip('should fail with incorrect password', async () => {
    const authService = new AuthService();
    // Register user first
    await authService.register({
      name: 'Test User',
      email: 'wrongpass@example.com',
      password: 'password123'
    });

    // Try to login with wrong password
    const result = await authService.login({
      email: 'wrongpass@example.com',
      password: 'wrongpassword'
    });

    expect(result.isFailure()).toBe(true);
    expect(result.getError()).toContain('Invalid credentials');
  });

  test.skip('should lock account after multiple failed attempts', async () => {
    const authService = new AuthService();
    // Register user first
    await authService.register({
      name: 'Test User',
      email: 'locktest@example.com',
      password: 'password123'
    });

    // Try wrong password multiple times
    for (let i = 0; i < 5; i++) {
      await authService.login({
        email: 'locktest@example.com',
        password: 'wrongpassword'
      });
    }

    // Try to login again - should be locked
    const result = await authService.login({
      email: 'locktest@example.com',
      password: 'password123'
    });

    expect(result.isFailure()).toBe(true);
    expect(result.getError()).toContain('locked');
  });
});
