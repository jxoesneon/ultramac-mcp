import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ActionLogger } from '../../src/core/action-logger';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { encrypt } from '../../src/core/security-utils';

// Mock fs to avoid actual disk interaction during tests
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
  }
}));

describe('ActionLogger', () => {
  const mockHistoryFile = path.join(os.tmpdir(), 'test-ultramac-history.json');
  let logger: ActionLogger;

  beforeEach(() => {
    vi.resetAllMocks();
    logger = new ActionLogger(mockHistoryFile);
  });

  it('should initialize with empty history if file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    logger = new ActionLogger(mockHistoryFile);
    expect(logger.getHistory()).toEqual([]);
  });

  it('should log a new action record', () => {
    const record = logger.log('test-tool', { arg: 1 }, 'success', 100, true);
    expect(record.tool).toBe('test-tool');
    expect(record.success).toBe(true);
    expect(record.duration).toBe(100);
    expect(logger.getHistory().length).toBe(1);
  });

  it('should find record by ID', () => {
    const record = logger.log('test-tool', {}, 'success', 50, true);
    const found = logger.getById(record.id);
    expect(found).toEqual(record);
  });

  it('should remove a record by ID', () => {
    const record = logger.log('to-delete', {}, 'success', 10, true);
    const success = logger.removeRecord(record.id);
    expect(success).toBe(true);
    expect(logger.getById(record.id)).toBeUndefined();
  });

  it('should clear history', () => {
    logger.log('tool1', {}, 'success', 10, true);
    logger.log('tool2', {}, 'success', 10, true);
    logger.clear();
    expect(logger.getHistory()).toEqual([]);
  });

  it('should respect the max history limit', () => {
    // Fill up to limit + 5
    for (let i = 0; i < 1005; i++) {
      logger.log(`tool${i}`, {}, 'success', 1, true);
    }
    expect(logger.getHistory().length).toBe(1000);
    // Should keep the MOST RECENT 1000
    expect(logger.getHistory()[999]!.tool).toBe('tool1004');
  });

  it('should load history from file on initialization', () => {
    const rawData = [{
      id: 'old-1',
      timestamp: Date.now(),
      tool: 'old-tool',
      args: {},
      result: 'old-result',
      success: true,
      duration: 50
    }];
    
    // We need to use a consistent key for encryption in tests
    const secret = process.env.ULTRAMAC_MCP_HISTORY_SECRET || 'dev_secret_key_change_in_production';
    const encryptionKey = crypto.createHash('sha256').update(secret).digest('hex');
    const encryptedData = encrypt(JSON.stringify(rawData), encryptionKey);
    
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(encryptedData);
    
    const newLogger = new ActionLogger(mockHistoryFile);
    expect(newLogger.getHistory().length).toBe(1);
    expect(newLogger.getHistory()[0]!.id).toBe('old-1');
  });

  it('should return only the most recent records when a limit is provided', () => {
    logger.log('tool-a', {}, 'ok', 1, true);
    logger.log('tool-b', {}, 'ok', 1, true);
    logger.log('tool-c', {}, 'ok', 1, true);

    const limited = logger.getHistory(2);
    expect(limited.length).toBe(2);
    expect(limited[0]!.tool).toBe('tool-b');
    expect(limited[1]!.tool).toBe('tool-c');
  });

  it('should return false when removing a non-existent record', () => {
    expect(logger.removeRecord('does-not-exist')).toBe(false);
  });

  it('should handle persist failures gracefully', async () => {
    vi.mocked(fs.writeFileSync).mockImplementation(() => {
      throw new Error('disk full');
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await logger.persistHistory();

    expect(errSpy).toHaveBeenCalledWith(
      'Failed to persist action history:',
      expect.any(Error)
    );
    errSpy.mockRestore();
  });

  it('should start fresh when the history file cannot be decrypted', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('not-valid-encrypted-data');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const corruptLogger = new ActionLogger(mockHistoryFile);

    expect(corruptLogger.getHistory()).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      '[ActionHistory] Failed to decrypt history, starting fresh:',
      expect.anything()
    );
    warnSpy.mockRestore();
  });

  it('should start fresh when reading the history file throws', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('read failure');
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const failLogger = new ActionLogger(mockHistoryFile);

    expect(failLogger.getHistory()).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to load action history, starting fresh:',
      expect.any(Error)
    );
    warnSpy.mockRestore();
  });

  it('should drop records older than 7 days via the retention policy', () => {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const records = [
      {
        id: 'expired-1',
        timestamp: Date.now() - sevenDaysMs - 1000,
        tool: 'old-tool',
        args: {},
        result: 'old',
        success: true,
        duration: 10
      },
      {
        id: 'fresh-1',
        timestamp: Date.now(),
        tool: 'fresh-tool',
        args: {},
        result: 'fresh',
        success: true,
        duration: 10
      }
    ];

    const secret = process.env.ULTRAMAC_MCP_HISTORY_SECRET || 'dev_secret_key_change_in_production';
    const encryptionKey = crypto.createHash('sha256').update(secret).digest('hex');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(encrypt(JSON.stringify(records), encryptionKey));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const retentionLogger = new ActionLogger(mockHistoryFile);

    // Only the fresh record survives, and the trimmed history is persisted
    expect(retentionLogger.getHistory().length).toBe(1);
    expect(retentionLogger.getHistory()[0]!.id).toBe('fresh-1');
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Removed 1 expired records')
    );
    expect(fs.writeFileSync).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
