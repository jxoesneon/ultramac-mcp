import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { performOCR } from '../../src/services/ocr-service';
import Tesseract from 'tesseract.js';
import fs from 'fs';
import * as securityUtils from '../../src/core/security-utils';
import { OCRCache } from '../../src/core/ocr-cache';
import * as spatialContext from '../../src/services/spatial-context';

// Mock dependencies
vi.mock('tesseract.js', () => ({
  default: {
    recognize: vi.fn()
  }
}));

vi.mock('../../src/core/security-utils', () => ({
  safeExecSync: vi.fn(),
  sanitizeShellArg: vi.fn(x => x)
}));

vi.mock('../../src/core/ocr-cache', () => {
    const mGet = vi.fn();
    const mSet = vi.fn();
    return {
        OCRCache: vi.fn(() => ({
            get: mGet,
            set: mSet
        }))
    };
});

vi.mock('fs', () => {
    const mockFs = {
        existsSync: vi.fn(),
        statSync: vi.fn(),
        unlinkSync: vi.fn(),
        readFileSync: vi.fn(),
        mkdirSync: vi.fn()
    };
    return {
        default: mockFs,
        ...mockFs
    };
});

vi.mock('../../src/services/spatial-context', () => ({
    getSpatialFocus: vi.fn(),
    Region: {}
}));

describe('OCR Service', () => {
    let mockCacheInstance: any;

    beforeEach(() => {
        vi.resetAllMocks();
        // Default fs behavior
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.statSync).mockReturnValue({ size: 1000 } as any);
        // Ensure safeExecSync doesn't throw by default
        vi.mocked(securityUtils.safeExecSync).mockReturnValue('');
    });

    it('should return cached result if available', async () => {
        const cachedResult = { found: true, x: 10, y: 10, confidence: 0.9 };
        // We need to access the mock instance that the module created globally... 
        // actually performOCR creates its own instance at module level.
        // We might need to mock the module prototype or singleton logic if it wasn't exported.
        // Since ocr-cache exports a class, and ocr-service does `new OCRCache()`, 
        // vi.mock hoisting should handle it if we setup the mock return value correctly.
        // Let's refine the mock above to ensure the module-level instance behaves correctly.
    });
    
    // Limitation: The `const ocrCache = new OCRCache()` line runs at module load time.
    // Changing the mock implementation inside `it` might be too late for the top-level instance.
    // However, `vi.mock` runs before imports, so the initial `new OCRCache` should pick up the mock.
    // But we need to control that specific instance.
});

// Refined test content
// We need to redefine the test content to handle the singleton nature better or just accept we control use prototype.

const { mockGet, mockSet } = vi.hoisted(() => {
    return {
        mockGet: vi.fn(),
        mockSet: vi.fn()
    }
});

vi.mock('../../src/core/ocr-cache', () => {
    return {
        OCRCache: class {
            get = mockGet;
            set = mockSet;
        }
    };
});

describe('OCR Service Implementation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.statSync).mockReturnValue({ size: 1024 } as any);
    });

    it('should return cached result if hit', async () => {
        mockGet.mockReturnValue({ found: true, cached: true });
        const result = await performOCR('test');
        expect(result).toEqual({ found: true, cached: true });
        expect(securityUtils.safeExecSync).not.toHaveBeenCalled();
    });

    it('should perform OCR if cache miss', async () => {
        mockGet.mockReturnValue(null);
        
        // Mock Tesseract response
        const mockData = {
            blocks: [{
                paragraphs: [{
                    lines: [{
                        words: [{
                            text: 'TargetText',
                            bbox: { x0: 10, y0: 10, x1: 30, y1: 20 },
                            confidence: 90
                        }]
                    }]
                }]
            }]
        };
        vi.mocked(Tesseract.recognize).mockResolvedValue({ data: mockData } as any);

        const result = await performOCR('TargetText');

        expect(securityUtils.safeExecSync).toHaveBeenCalledWith('screencapture', expect.arrayContaining(['-x']));
        expect(result.found).toBe(true);
        expect(result.x).toBe(20); // Center of 10-30
        expect(result.y).toBe(15); // Center of 10-20
        expect(mockSet).toHaveBeenCalled();
    });

    it('should handle region offsets correctly', async () => {
        mockGet.mockReturnValue(null);
        const region = { x: 100, y: 100, w: 200, h: 200 };
        
        // Mock Tesseract finding text at relative 10,10 in the screenshot
        const mockData = {
            blocks: [{
                paragraphs: [{
                    lines: [{
                        words: [{
                            text: 'OffsetTarget',
                            bbox: { x0: 10, y0: 10, x1: 30, y1: 20 }, // Relative to screenshot (region)
                            confidence: 90
                        }]
                    }]
                }]
            }]
        };
        vi.mocked(Tesseract.recognize).mockResolvedValue({ data: mockData } as any);

        const result = await performOCR('OffsetTarget', region);

        // Expect bounding box to be shifted by region.x (100) and region.y (100)
        // Original center relative: x=20, y=15
        // Absolute center: x=120, y=115
        expect(result.found).toBe(true);
        expect(result.x).toBe(120);
        expect(result.y).toBe(115);
    });

    it('should cache and return failResult when no words match', async () => {
        mockGet.mockReturnValue(null);

        const mockData = {
            blocks: [{
                paragraphs: [{
                    lines: [{
                        words: [
                            { text: 'Hello', bbox: { x0: 1, y0: 1, x1: 5, y1: 5 }, confidence: 80 },
                            { text: 'World', bbox: { x0: 6, y0: 1, x1: 10, y1: 5 }, confidence: 80 }
                        ]
                    }]
                }]
            }]
        };
        vi.mocked(Tesseract.recognize).mockResolvedValue({ data: mockData } as any);

        const result = await performOCR('MissingText');
        expect(result.found).toBe(false);
        expect(result.debugInfo.wordCount).toBe(2);
        expect(mockSet).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ found: false }));
    });

    it('should handle screenshots failure gracefully', async () => {
        mockGet.mockReturnValue(null);
        vi.mocked(securityUtils.safeExecSync).mockImplementation(() => { throw new Error("Snap"); });

        const result = await performOCR('fail');
        expect(result.found).toBe(false);
        expect(result.debugInfo.error).toContain('Screenshot failed');
    });

    it('should handle empty screenshots', async () => {
        mockGet.mockReturnValue(null);
        vi.mocked(securityUtils.safeExecSync).mockReturnValue('');
        vi.mocked(fs.statSync).mockReturnValue({ size: 0 } as any);

        const result = await performOCR('empty');
        expect(result.found).toBe(false);
        expect(result.debugInfo.error).toBe('Empty screenshot');
    });
});
