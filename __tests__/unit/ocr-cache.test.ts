import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OCRCache } from '../../src/core/ocr-cache';

describe('OCRCache', () => {
  let cache: OCRCache;

  beforeEach(() => {
    // Default TTL 10s
    cache = new OCRCache(10000);
  });

  it('should set and get values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return null for non-existent keys', () => {
    expect(cache.get('missing')).toBeNull();
  });

  it('should respect TTL and expire items', () => {
    vi.useFakeTimers();
    cache.set('key1', 'value1');
    
    // Fast forward 11 seconds
    vi.advanceTimersByTime(11000);
    
    expect(cache.get('key1')).toBeNull();
    vi.useRealTimers();
  });

  it('should clear all entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBeNull();
  });

  it('should provide stats and exclude expired keys from stats', () => {
    vi.useFakeTimers();
    cache.set('fresh', 'data');
    cache.set('stale', 'data');
    
    vi.advanceTimersByTime(11000); // Wait for expiration
    
    cache.set('very-fresh', 'data');
    
    const stats = cache.getStats();
    expect(stats.size).toBe(1);
    expect(stats.keys).toContain('very-fresh');
    expect(stats.keys).not.toContain('stale');
    vi.useRealTimers();
  });
});
