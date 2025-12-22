import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logToolInvocation, logSecurityEvent, logError, getAuditLogPath, auditLogger } from '../../src/core/audit-logger';

// Mock winston to avoid actual file I/O and verify calls
vi.mock('winston', () => {
  const mLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    add: vi.fn(),
  };
  return {
    default: {
      createLogger: vi.fn(() => mLogger),
      format: {
        combine: vi.fn(),
        timestamp: vi.fn(),
        errors: vi.fn(),
        json: vi.fn(),
        colorize: vi.fn(),
        simple: vi.fn(),
      },
      transports: {
        File: vi.fn(),
        Console: vi.fn(),
      },
    }
  };
});

describe('Audit Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log tool invocation with sanitized args', () => {
    const args = { username: 'test', password: 'secretpassword123' };
    logToolInvocation('test-tool', args, 'success-result', 150, true);
    
    expect(auditLogger.info).toHaveBeenCalledWith(
      'Tool invocation',
      expect.objectContaining({
        tool: 'test-tool',
        args: expect.objectContaining({
          username: 'test',
          password: '[REDACTED]'
        }),
        success: true,
        duration_ms: 150
      })
    );
  });

  it('should log security events', () => {
    logSecurityEvent('login_failed', { user: 'admin' }, 'high');
    
    expect(auditLogger.warn).toHaveBeenCalledWith(
      'Security event',
      expect.objectContaining({
        event: 'security',
        type: 'login_failed',
        severity: 'high',
        user: 'admin'
      })
    );
  });

  it('should log errors with stack trace if error object is provided', () => {
    const error = new Error('Test error');
    logError('test-context', error, { extra: 'info' });
    
    expect(auditLogger.error).toHaveBeenCalledWith(
      'Error occurred',
      expect.objectContaining({
        context: 'test-context',
        error: expect.objectContaining({
          message: 'Test error'
        }),
        extra: 'info'
      })
    );
  });

  it('should log errors as string if non-error object is provided', () => {
    logError('test-context', 'simple error message');
    
    expect(auditLogger.error).toHaveBeenCalledWith(
      'Error occurred',
      expect.objectContaining({
        context: 'test-context',
        error: 'simple error message'
      })
    );
  });

  it('should return correct audit log path', () => {
    const logPath = getAuditLogPath();
    expect(logPath).toContain('audit.log');
  });
});
