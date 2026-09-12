import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encrypt, decrypt, sanitizeShellArg, isAlphanumericSafe, RateLimiter, sanitizeFilePath, sanitizeIdentifier, safeExecSync } from '../../src/core/security-utils';
import { execSync } from 'child_process';

describe('Security Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Encryption', () => {
    it('should encrypt and decrypt a string', () => {
      const secret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 64 hex chars = 32 bytes
      const originalText = 'Sensitive UI Data';
      
      const encrypted = encrypt(originalText, secret);
      expect(encrypted).not.toBe(originalText);
      expect(encrypted).toContain(':'); // IV:Tag:Data format
      
      const decrypted = decrypt(encrypted, secret);
      expect(decrypted).toBe(originalText);
    });

    it('should throw error on invalid format during decryption', () => {
      const secret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      expect(() => decrypt('invalid-format', secret)).toThrow();
    });
  });

  describe('Input Sanitization', () => {
    it('should remove shell control characters', () => {
      const input = 'command; rm -rf /';
      const sanitized = sanitizeShellArg(input);
      expect(sanitized).not.toContain(';');
      expect(sanitized).toBe('command rm -rf /');
    });

    it('should allow alphanumeric and specific symbols', () => {
      const input = 'User_123-Input.txt';
      expect(isAlphanumericSafe(input)).toBe(true);
    });
  });

  describe('File Path Sanitization', () => {
    const allowedDirs = ['/tmp', '/var/tmp', '/Users/test'];
    
    it('should allow valid paths in whitelist', () => {
      expect(sanitizeFilePath('/tmp/test.png', allowedDirs)).toBe('/tmp/test.png');
    });

    it('should reject paths outside whitelist', () => {
      expect(() => sanitizeFilePath('/etc/passwd', allowedDirs)).toThrow(/not in allowed directories/);
    });

    it('should resolve relative paths', () => {
      // Mock path.resolve if needed, but here we can just test behaviour
      // If CWD is not in whitelist, this might fail in real env, so strictly test absolute
      expect(sanitizeFilePath('/tmp/../tmp/file', allowedDirs)).toBe('/tmp/file');
    });

    it('should detect directory traversal attempts', () => {
      // /tmp/../../etc/passwd resolves to /etc/passwd which is not allowed
      expect(() => sanitizeFilePath('/tmp/../../etc/passwd', allowedDirs)).toThrow();
    });
  });

  describe('Identifier Sanitization', () => {
    it('should allow valid identifiers', () => {
      expect(sanitizeIdentifier('com.app.Test')).toBe('com.app.Test');
    });

    it('should reject identifiers with special chars', () => {
      expect(() => sanitizeIdentifier('App$Name')).toThrow();
    });

    it('should reject identifiers strictly too long', () => {
      const longId = 'a'.repeat(256);
      expect(() => sanitizeIdentifier(longId)).toThrow(/too long/);
    });
  });

// Mock child_process at top level
vi.mock('child_process', () => {
    const execSync = vi.fn();
    return {
        default: { execSync },
        execSync,
    };
});

describe('Safe Command Execution (safeExecSync)', () => {
    it('should execute allowed commands', () => {
        (execSync as any).mockReturnValue(Buffer.from("success"));
        
        const result = safeExecSync('osascript', ['-e', 'return 1']);
        expect(result).toEqual(Buffer.from("success"));
        // Check if called correctly 
        // Note: safeExecSync joins with space
        expect(execSync).toHaveBeenCalledWith('osascript -e return 1', undefined);
    });

    it('should throw on non-whitelisted commands', () => {
        expect(() => safeExecSync('rm', ['-rf', '/'])).toThrow(/not in whitelist/);
    });

    it('should sanitize arguments', () => {
        (execSync as any).mockReturnValue(Buffer.from("ok"));

        // Use a /tmp/ path: safeExecSync's path branch explicitly allowlists
        // /tmp/-prefixed paths, so this is deterministic regardless of the
        // repo's location relative to os.homedir(). The input contains a
        // shell metacharacter (;) that must be stripped before execution.
        safeExecSync('osascript', ['/tmp/test; rm -rf /']);

        // Expect sanitized args: the ";" shell metachar must be removed.
        // Do not assert the exact resolved path (path.resolve() normalization
        // differs across OSes/runners); just verify the metachar is gone and
        // the tokens survive.
        expect(execSync).toHaveBeenCalled();
        const callArgs = (execSync as any).mock.calls.find((call: any[]) => call[0].startsWith('osascript'));
        expect(callArgs[0]).toContain('test');
        expect(callArgs[0]).toContain('rm -rf');
        expect(callArgs[0]).not.toContain(';');
    });
    
    it('should allow valid temp file paths', () => {
        (execSync as any).mockReturnValue(Buffer.from("ok"));
        safeExecSync('osascript', ['/tmp/screenshot.png']);
        
        expect(execSync).toHaveBeenCalledWith('osascript /tmp/screenshot.png', undefined);
    });

    it('should escape dangerous file paths', () => {
        // /etc/passwd is not in allowed dirs, so it throws Security Error
        expect(() => safeExecSync('osascript', ['/etc/passwd'])).toThrow(/not in allowed directories/);
    });
  });

  describe('RateLimiter', () => {
    it('should allow requests within limit', () => {
      const limiter = new RateLimiter(2, 1000); // 2 per second
      expect(limiter.isAllowed('user1')).toBe(true);
      expect(limiter.isAllowed('user1')).toBe(true);
      expect(limiter.isAllowed('user2')).toBe(true);
    });

    it('should block requests exceeding limit', () => {
      const limiter = new RateLimiter(1, 1000);
      expect(limiter.isAllowed('user1')).toBe(true);
      expect(limiter.isAllowed('user1')).toBe(false);
    });
    
    it('should reset limit', () => {
        const limiter = new RateLimiter(1, 1000);
        limiter.isAllowed('user1');
        expect(limiter.isAllowed('user1')).toBe(false);
        limiter.reset('user1');
        expect(limiter.isAllowed('user1')).toBe(true);
    });

    it('should get count', () => {
        const limiter = new RateLimiter(5, 1000);
        limiter.isAllowed('user1');
        limiter.isAllowed('user1');
        expect(limiter.getCount('user1')).toBe(2);
    });
  });
});
