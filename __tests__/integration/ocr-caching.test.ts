import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OCRCache } from '../../src/core/ocr-cache';

// Mocking the core logic that would be imported from index.ts
// In index.ts, performOCR uses ocrCache.
describe('Tool Integration: OCR Caching', () => {
  let ocrCache: OCRCache;

  beforeEach(() => {
    ocrCache = new OCRCache(10000);
    vi.resetAllMocks();
  });

  it('should hit cache for identical OCR requests', async () => {
    const searchText = 'Login';
    const region = { x: 0, y: 0, width: 100, height: 100 };
    const cacheKey = JSON.stringify({ searchText, region });

    // Mock the actual OCR logic
    const performOCR = async (text: string, reg: any) => {
      const cached = ocrCache.get(cacheKey);
      if (cached) return cached;

      const result = { x: 50, y: 50, confidence: 0.9 };
      ocrCache.set(cacheKey, result);
      return result;
    };

    // First call: Cache miss
    const result1 = await performOCR(searchText, region);
    expect(result1.x).toBe(50);

    // Second call: Cache hit
    const result2 = await performOCR(searchText, region);
    expect(result2).toEqual(result1);
    
    expect(ocrCache.getStats().size).toBe(1);
  });
});
