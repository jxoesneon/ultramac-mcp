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
});
