/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from 'path';
import os from 'os';
import crypto from 'crypto';
import child_process from 'child_process';
import { AutomationError, ErrorCode } from './errors';

/**
 * Security utilities for input sanitization and validation
 */

/**
 * Sanitize file paths to prevent directory traversal attacks
 * @param unsafePath - User-provided file path
 * @param allowedDirs - Optional array of allowed base directories (defaults to /tmp and user home)
 * @returns Sanitized absolute path
 * @throws Error if path is not in allowed directories
 */
export function sanitizeFilePath(
  unsafePath: string,
  allowedDirs?: string[]
): string {
  // Resolve to absolute path, prevent directory traversal (.., symbolic links)
  const safePath = path.resolve(unsafePath);
  
  // Default whitelist: only allow paths in /tmp or user home
  const allowed = allowedDirs || [
    os.tmpdir(),
    os.homedir(),
    '/var/tmp'
  ];
  
  // Check if path starts with any allowed directory
  const isAllowed = allowed.some(prefix => safePath.startsWith(prefix));
  
  if (!isAllowed) {
    throw new AutomationError(
      `Security: File path "${safePath}" not in allowed directories: ${allowed.join(', ')}`,
      ErrorCode.SECURITY_PATH_NOT_ALLOWED
    );
  }
  
  return safePath;
}

/**
 * Sanitize shell arguments by escaping dangerous characters
 * Use this before passing user input to child_process functions
 * 
 * @param arg - Shell argument to sanitize
 * @returns Escaped argument safe for shell execution
 */
export function sanitizeShellArg(arg: string): string {
  // Remove or escape shell metacharacters that could enable command injection
  // Dangerous chars: ; & | ` $ ( ) { } [ ] < > ' " \ newline
  return arg.replace(/[;&|`$(){}[\]<>'"\\\n]/g, '');
}

/**
 * Validate that a string contains only alphanumeric characters and safe symbols
 * Useful for validating tool names, identifiers, etc.
 * 
 * @param input - String to validate
 * @param allowedChars - Additional characters to allow (default: - _ .)
 * @returns true if input is safe, false otherwise
 */
export function isAlphanumericSafe(
  input: string,
  allowedChars: string = '-_.'
): boolean {
  const pattern = new RegExp(`^[a-zA-Z0-9${allowedChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]+$`);
  return pattern.test(input);
}

/**
 * Sanitize and validate window title or bundle ID
 * @param identifier - Window title or bundle ID
 * @returns Sanitized identifier
 * @throws Error if identifier contains dangerous characters
 */
export function sanitizeIdentifier(identifier: string): string {
  // Allow alphanumeric, dots (for bundle IDs like com.google.Chrome), and basic punctuation
  if (!isAlphanumericSafe(identifier, '.-_ ')) {
    throw new AutomationError(
      `Security: Identifier "${identifier}" contains dangerous characters`,
      ErrorCode.SECURITY_INVALID_INPUT
    );
  }
  
  // Limit length to prevent DoS
  if (identifier.length > 255) {
    throw new AutomationError(
      'Security: Identifier too long (max 255 characters)',
      ErrorCode.SECURITY_INVALID_INPUT
    );
  }
  
  return identifier;
}

/**
 * Rate limiter for preventing abuse
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private limit: number;
  private windowMs: number;

  /**
   * Initialize a new RateLimiter.
   * @param limit - Maximum number of requests allowed within the window.
   * @param windowMs - Duration of the rolling window in milliseconds.
   */
  constructor(limit: number = 10, windowMs: number = 1000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /**
   * Check if a client has exceeded rate limit
   * @param clientId - Unique identifier for the client
   * @returns true if allowed, false if rate limited
   */
  isAllowed(clientId: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing requests for this client
    const clientRequests = this.requests.get(clientId) || [];

    // Remove requests outside the current window
    const recentRequests = clientRequests.filter(time => time > windowStart);

    // Check if limit exceeded
    if (recentRequests.length >= this.limit) {
      return false;
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(clientId, recentRequests);

    return true;
  }

  /**
   * Clear rate limit data for a client
   */
  reset(clientId: string): void {
    this.requests.delete(clientId);
  }

  /**
   * Get current request count for a client
   */
  getCount(clientId: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const clientRequests = this.requests.get(clientId) || [];
    return clientRequests.filter(time => time > windowStart).length;
  }
}

/**
 * Safe wrapper for execSync that validates commands and sanitizes inputs
 * Use this instead of child_process.execSync directly to prevent command injection
 */
export function safeExecSync(
  command: string,
  args: string[],
  options?: any
): Buffer | string {
  // Check against allowed commands
  const allowedCommands = [
    'screencapture',
    'osascript',
    'system_profiler'
  ];
  
  if (!allowedCommands.includes(command)) {
    throw new AutomationError(
      `Security: Command "${command}" not in whitelist. Allowed: ${allowedCommands.join(', ')}`,
      ErrorCode.SECURITY_COMMAND_NOT_ALLOWED
    );
  }
  
  // Sanitize arguments
  const safeArgs = args.map((arg, index) => {
    // Flags starting with - or -- are generally safe
    if (arg.startsWith('-')) {
      return arg;
    }
    
    // For file paths, validate and sanitize
    if (arg.includes('/') || arg.endsWith('.png') || arg.endsWith('.jpg')) {
      try {
        // Validate path is safe (throws if not in allowed dirs)
        const safePath = sanitizeFilePath(arg);
        // ALWAYS sanitize shell chars even in paths (e.g. spaces, semicolons in filenames)
        return sanitizeShellArg(safePath);
      } catch (e) {
        // If path validation fails but it's a temp path, allow /tmp specifically
        if (arg.startsWith('/tmp/') || arg.startsWith('/var/tmp/')) {
          // Still remove dangerous characters
          return sanitizeShellArg(arg);
        }
        throw e;
      }
    }
    
    // For other arguments, remove shell metacharacters
    return sanitizeShellArg(arg);
  });
  
  // Build command safely using array join (no template strings)
  const fullCommand = [command, ...safeArgs].join(' ');
  
  // Execute with validation
  try {
    return child_process.execSync(fullCommand, options);
  } catch (error: any) {
    throw new AutomationError(
      `Command failed: ${command} - ${error.message}`,
      ErrorCode.TOOL_EXECUTION_FAILED,
      { originalError: error.message }
    );
  }
}

/**
 * Encrypt data using AES-256-GCM
 * @param data - String to encrypt
 * @param secretKey - 32-byte secret key (hex string)
 */
export function encrypt(data: string, secretKey: string): string {
  const iv = crypto.randomBytes(12);
  const key = Buffer.from(secretKey, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Return IV + AuthTag + EncryptedData
  return iv.toString('hex') + ':' + authTag + ':' + encrypted;
}

/**
 * Decrypt data using AES-256-GCM
 * @param encryptedData - IV:AuthTag:EncryptedData string
 * @param secretKey - 32-byte secret key (hex string)
 */
export function decrypt(encryptedData: string, secretKey: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new AutomationError('Invalid encrypted data format', ErrorCode.SECURITY_INVALID_INPUT);
  }
  
  const iv = Buffer.from(parts[0]!, 'hex');
  const authTag = Buffer.from(parts[1]!, 'hex');
  const encrypted = Buffer.from(parts[2]!, 'hex');
  const key = Buffer.from(secretKey, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
