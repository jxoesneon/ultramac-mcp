/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface OCRCacheEntry {
    result: any;
    timestamp: number;
}

export class OCRCache {
    private cache: Map<string, OCRCacheEntry> = new Map();
    private ttl: number;
    private maxSize: number;

    constructor(ttl: number = 10000, maxSize: number = 100) {
        this.ttl = ttl;
        this.maxSize = maxSize;
    }

    get(key: string): any | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        
        // Check if expired
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return entry.result;
    }
    
    set(key: string, result: any): void {
        // Enforce max size (evict oldest)
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) {
                this.cache.delete(oldestKey);
            }
        }
        
        this.cache.set(key, {
            result,
            timestamp: Date.now()
        });
    }
    
    clear(): void {
        this.cache.clear();
    }
    
    getStats(): { size: number, keys: string[] } {
        // Clean expired entries first
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.ttl) {
                this.cache.delete(key);
            }
        }
        
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}
