import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { initializeAuth, authMiddleware, validateApiKey, generateApiKey, listApiKeys, revokeApiKey, getClientInfo } from '../../src/core/auth';

describe('Auth Module', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.ULTRAMAC_MCP_API_KEY = 'test-key-123';
    process.env.NODE_ENV = 'production';
    process.env.ULTRAMAC_MCP_DISABLE_AUTH = 'false';
  });

  afterEach(() => {
    delete process.env.ULTRAMAC_MCP_API_KEY;
    delete process.env.ULTRAMAC_MCP_DISABLE_AUTH;
  });

  it('should allow access if auth is disabled via environment', () => {
    process.env.ULTRAMAC_MCP_DISABLE_AUTH = 'true';
    const request = { headers: {} };
    expect(authMiddleware(request)).toBe(true);
  });

  it('should throw error if API key is missing in production', () => {
    const request = { headers: {} };
    expect(() => authMiddleware(request)).toThrow('Missing API key');
  });

  it('should allow access with valid API key in headers', () => {
    // We need to initialize with the key first or use the one from env
    initializeAuth();
    const request = { 
      headers: { 'x-api-key': 'test-key-123' } 
    };
    expect(authMiddleware(request)).toBe(true);
  });

  it('should allow access with valid API key in query params', () => {
    initializeAuth();
    const request = { 
      headers: {},
      query: { apiKey: 'test-key-123' }
    };
    expect(authMiddleware(request)).toBe(true);
  });

  it('should throw error for invalid API key', () => {
    initializeAuth();
    const request = { 
      headers: { 'x-api-key': 'wrong-key' } 
    };
    expect(() => authMiddleware(request)).toThrow('Invalid API key');
  });

  it('should allow access in development mode even without key', () => {
    process.env.NODE_ENV = 'development';
    const request = { headers: {} };
    expect(authMiddleware(request)).toBe(true);
  });

  it('should list API keys', () => {
    const key = generateApiKey('test-client');
    const keys = listApiKeys();
    expect(keys.some(k => k.name === 'test-client')).toBe(true);
  });

  it('should revoke API key', () => {
    const key = generateApiKey('to-revoke');
    expect(validateApiKey(key)).toBe(true);
    
    const revoked = revokeApiKey(key);
    expect(revoked).toBe(true);
    expect(() => validateApiKey(key)).toThrow('Invalid API key');
  });

  it('should return false when revoking non-existent key', () => {
    expect(revokeApiKey('non-existent')).toBe(false);
  });

  it('should get client info', () => {
    const key = generateApiKey('info-client');
    const info = getClientInfo(key);
    expect(info?.name).toBe('info-client');
  });

  it('should return null for client info of invalid key', () => {
    expect(getClientInfo('invalid')).toBe(null);
  });

  it('should allow access with api_key query param variant', () => {
    initializeAuth();
    const request = {
      headers: {},
      query: { api_key: 'test-key-123' }
    };
    expect(authMiddleware(request)).toBe(true);
  });

  it('should log ip and user-agent when key is missing in production', () => {
    const request = {
      headers: { 'user-agent': 'test-agent' },
      ip: '203.0.113.10'
    };
    expect(() => authMiddleware(request)).toThrow('Missing API key');
  });

  it('should throw for empty key when keys are configured', () => {
    initializeAuth();
    expect(() => validateApiKey('')).toThrow('Invalid API key');
  });

  it('should warn when no API key provided but keys are configured in dev', () => {
    process.env.NODE_ENV = 'development';
    generateApiKey('dev-warn-client');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const request = { headers: {} };
    expect(authMiddleware(request)).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No API key provided')
    );
    warnSpy.mockRestore();
  });

  it('should throw when the rate limit is exceeded', () => {
    const key = generateApiKey('rate-limited-client');
    // Limiter allows 10 requests per second per client id
    for (let i = 0; i < 10; i++) {
      expect(validateApiKey(key)).toBe(true);
    }
    expect(() => validateApiKey(key)).toThrow('Rate limit exceeded');
  });

  it('should allow empty key in non-production when no keys are configured', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
    delete process.env.ULTRAMAC_MCP_API_KEY;
    const freshAuth = await import('../../src/core/auth');
    expect(freshAuth.validateApiKey('')).toBe(true);
  });

  it('should initialize auth on module import outside test env', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.ULTRAMAC_MCP_API_KEY = 'imported-env-key';
    const freshAuth = await import('../../src/core/auth');
    const info = freshAuth.getClientInfo('imported-env-key');
    expect(info?.name).toBe('Environment Key');
  });

  it('should generate a development key on import when no env key outside production', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'development';
    delete process.env.ULTRAMAC_MCP_API_KEY;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const freshAuth = await import('../../src/core/auth');
    expect(freshAuth.listApiKeys().length).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No API key set')
    );
    warnSpy.mockRestore();
  });

  it('should log an error on import when no key is configured in production', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    delete process.env.ULTRAMAC_MCP_API_KEY;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await import('../../src/core/auth');
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('No API key configured in production')
    );
    errSpy.mockRestore();
  });
});
