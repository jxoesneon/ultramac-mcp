import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getHighlightPreview } from '../../src/services/image-service';
import fs from 'fs';
import * as securityUtils from '../../src/core/security-utils';

// Mock sharp
const mockToBuffer = vi.fn().mockResolvedValue(Buffer.from('processed-image'));
const mockPng = vi.fn().mockReturnThis();
const mockComposite = vi.fn().mockReturnThis();
const mockSharpInstance = {
  composite: mockComposite,
  png: mockPng,
  toBuffer: mockToBuffer
};

// We need to mock the default export of sharp
vi.mock('sharp', () => {
  return {
    default: vi.fn(() => mockSharpInstance)
  };
});

// Mock fs
vi.mock('fs', () => {
  const mockFs = {
    existsSync: vi.fn(),
    unlinkSync: vi.fn(),
    readFileSync: vi.fn(),
    statSync: vi.fn(),
    mkdirSync: vi.fn()
  };
  return {
    default: mockFs,
    ...mockFs
  };
});

// Mock security utils
vi.mock('../../src/core/security-utils', () => ({
  safeExecSync: vi.fn(),
  sanitizeFilePath: vi.fn((p) => p),
  sanitizeShellArg: vi.fn((a) => a)
}));

describe('Image Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  it('should generate a highlighted preview successfully', async () => {
    const result = await getHighlightPreview(100, 200);
    
    expect(securityUtils.safeExecSync).toHaveBeenCalledWith(
        'screencapture', 
        expect.arrayContaining(['-x'])
    );
    expect(mockComposite).toHaveBeenCalled();
    expect(result).toEqual(Buffer.from('processed-image'));
    expect(fs.unlinkSync).toHaveBeenCalled();
  });

  it('should custom dimensions', async () => {
    await getHighlightPreview(10, 10, 50, 60);
    expect(mockComposite).toHaveBeenCalled();
  });

  it('should fallback to raw screenshot if sharp processing fails', async () => {
    // Make sharp fail
    mockToBuffer.mockRejectedValueOnce(new Error('Sharp Error'));
    // Return raw buffer from readFileSync
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('raw-image'));

    const result = await getHighlightPreview(100, 100);

    expect(result).toEqual(Buffer.from('raw-image'));
    // Should clean up file
    expect(fs.unlinkSync).toHaveBeenCalled(); 
  });

  it('should throw if both processing and fallback fail', async () => {
    // Make sharp fail
    mockToBuffer.mockRejectedValueOnce(new Error('Sharp Error'));
    // Make fs fail
    vi.mocked(fs.existsSync).mockReturnValue(false); // file gone for some reason

    await expect(getHighlightPreview(100, 100)).rejects.toThrow('Sharp Error');
  });
});
