/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import Tesseract from "tesseract.js";
import { safeExecSync } from '../core/security-utils';
import { OCRCache } from '../core/ocr-cache';
import { getSpatialFocus, type Region } from './spatial-context';
import { auditLogger } from '../core/audit-logger';

const ocrCache = new OCRCache();

/**
 * Perform OCR on screen (Full or Region)
 */
export async function performOCR(searchText: string, region: Region | null = null): Promise<{found: boolean, x?: number, y?: number, confidence?: number, debugInfo?: any}> {
    // Spatial Context: Use global activeRegion if no specific region is requested
    if (!region) {
        region = getSpatialFocus();
    }

    // Cache key: searchText + region
    const cacheKey = `${searchText}_${region ? `${region.x},${region.y},${region.w},${region.h}` : 'fullscreen'}`;
    const cached = ocrCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const screenshotPath = path.join(os.tmpdir(), `ocr_screenshot_${Date.now()}.png`);
    let regionOffset = { x: 0, y: 0 };
    
    try {
        if (region) {
             safeExecSync('screencapture', ['-x', `-R${region.x},${region.y},${region.w},${region.h}`, screenshotPath]);
             regionOffset = { x: region.x, y: region.y };
        } else {
             safeExecSync('screencapture', ['-x', screenshotPath]);
        }
    } catch(e) {
        auditLogger.warn("OCR Screenshot failed", { error: e });
        return { found: false, debugInfo: { error: "Screenshot failed" } };
    }

    if (!fs.existsSync(screenshotPath) || fs.statSync(screenshotPath).size === 0) {
        return { found: false, debugInfo: { error: "Empty screenshot" } };
    }

    try {
        const result = await Tesseract.recognize(screenshotPath, 'eng');
        const data = result.data as any;
        
        let allWords: any[] = [];
        const addOffset = (bbox: any) => ({
            x0: bbox.x0 + regionOffset.x,
            y0: bbox.y0 + regionOffset.y,
            x1: bbox.x1 + regionOffset.x,
            y1: bbox.y1 + regionOffset.y,
        });
        
        // Traverse result data
        if (data.blocks) {
            for (const block of data.blocks) {
                if (block.paragraphs) {
                    for (const paragraph of block.paragraphs) {
                        if (paragraph.lines) {
                            for (const line of paragraph.lines) {
                                if (line.words) {
                                    allWords.push(...line.words.map((w: any) => ({ 
                                        text: w.text || '',
                                        bbox: addOffset(w.bbox),
                                        confidence: w.confidence || 0
                                    })));
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Fallback for hocr/tsv if blocks missing (simplified from original)
        // Note: original had more regex/split logic, but recognize() usually provides blocks.
        
        // Find matches
        const matches = allWords.filter((w: any) => w.text.toLowerCase().includes(searchText.toLowerCase()));
        
        if (matches.length > 0) {
            const match = matches[0];
            const x = match.bbox.x0 + (match.bbox.x1 - match.bbox.x0) / 2;
            const y = match.bbox.y0 + (match.bbox.y1 - match.bbox.y0) / 2;
            const confidence = match.confidence ? match.confidence / 100 : 0.7;
            const result = { found: true, x: Math.round(x), y: Math.round(y), confidence };
            ocrCache.set(cacheKey, result);
            return result;
        }
        
        const failResult = { 
            found: false, 
            debugInfo: { wordCount: allWords.length } 
        };
        ocrCache.set(cacheKey, failResult);
        return failResult;
    } finally {
        if (fs.existsSync(screenshotPath)) fs.unlinkSync(screenshotPath);
    }
}
