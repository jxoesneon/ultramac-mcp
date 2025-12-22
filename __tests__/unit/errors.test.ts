import { describe, it, expect } from 'vitest';
import { AutomationError, ErrorCode, handleToolError, withSanitizedError } from '../../src/core/errors';

describe('Errors Module', () => {
  it('should create AutomationError with correct properties', () => {
    const error = new AutomationError('Test message', ErrorCode.AUTH_INVALID_KEY, { foo: 'bar' });
    expect(error.message).toBe('Test message');
    expect(error.code).toBe(ErrorCode.AUTH_INVALID_KEY);
    expect(error.details).toEqual({ foo: 'bar' });
  });

  it('handleToolError should log and return error information', async () => {
    const error = new Error('Original error');
    const result = await handleToolError('test-tool', error, { some: 'context' });
    expect(result).toContain('Error: Original error');
  });

  it('handleToolError should include code for AutomationError', async () => {
    const error = new AutomationError('Auth failed', ErrorCode.AUTH_INVALID_KEY);
    const result = await handleToolError('test-tool', error);
    expect(result).toContain('[AUTH_001]');
  });

  it('withSanitizedError should catch and wrap errors', async () => {
    const dangerousFn = async () => {
      throw new Error('Secret database path: /Users/admin/passwords.txt');
    };
    
    try {
      await withSanitizedError(dangerousFn);
    } catch (e: any) {
      expect(e.message).toBe('An internal error occurred during tool execution');
    }
  });

  it('withSanitizedError should allow AutomationError to pass through', async () => {
    const safeErrorFn = async () => {
      throw new AutomationError('Safe message', ErrorCode.SECURITY_INVALID_INPUT);
    };
    
    try {
      await withSanitizedError(safeErrorFn);
    } catch (e: any) {
      expect(e.message).toBe('Safe message');
    }
  });
});
