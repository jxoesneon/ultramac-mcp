/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import sharp from 'sharp';
import { pipeline, RawImage } from '@xenova/transformers';
import { safeExecSync } from '../core/security-utils';
import { getSpatialFocus } from './spatial-context';
import { auditLogger } from '../core/audit-logger';

let objectDetector: any = null;

/**
 * Find an icon or visual element by description using local AI (OWL-ViT)
 */
export async function findIcon(description: string, saveDebugImage: boolean = false): Promise<any> {
    if (!objectDetector) {
        auditLogger.info("Loading Object Detection Model (Xenova/owlvit-base-patch32)...");
        try {
            objectDetector = await pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32');
        } catch (e: any) {
            auditLogger.error("Failed to load AI model", { error: e });
            throw new Error(`Error loading AI model: ${e.message}`);
        }
    }
    
    const screenshotPath = path.join(os.tmpdir(), `icon_search_${Date.now()}.png`);
    const activeRegion = getSpatialFocus();
    
    // Capture screen (respecting activeRegion if set)
    let regionCmd = "";
    let offset = { x: 0, y: 0 };
    
    if (activeRegion) {
        regionCmd = `-R ${activeRegion.x},${activeRegion.y},${activeRegion.w},${activeRegion.h}`;
        offset = { x: activeRegion.x, y: activeRegion.y };
    }
    
    try {
        const screencaptureArgs = regionCmd ? ['-x', regionCmd, screenshotPath] : ['-x', screenshotPath];
        safeExecSync('screencapture', screencaptureArgs);
    } catch(e) {
        throw new Error("Failed to capture screenshot for icon search.");
    }
    
    try {
        // Run Inference
        const imageInfo = await sharp(screenshotPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const image = new RawImage(imageInfo.data, imageInfo.info.width, imageInfo.info.height, 4);
        
        const output = await objectDetector(image, [description]);
        
        if (!output || output.length === 0) {
            return { found: false, message: `Icon "${description}" not found.` };
        }
        
        // Filter by confidence (e.g. > 0.1)
        const topMatch = output.reduce((prev: any, current: any) => (prev.score > current.score) ? prev : current);
        
        if (topMatch.score < 0.1) {
             return { found: false, message: `Icon "${description}" found but with low confidence (${Math.round(topMatch.score*100)}%).` };
        }
        
        const box = topMatch.box;
        const globalX = box.xmin + offset.x;
        const globalY = box.ymin + offset.y;
        const w = box.xmax - box.xmin;
        const h = box.ymax - box.ymin;
        
        const centerX = Math.round(globalX + w / 2);
        const centerY = Math.round(globalY + h / 2);
        
        return {
            found: true,
            description: description,
            confidence: topMatch.score,
            x: centerX,
            y: centerY,
            w: Math.round(w),
            h: Math.round(h),
            region: { x: Math.round(globalX), y: Math.round(globalY), w: Math.round(w), h: Math.round(h) }
        };
    } catch (e: any) {
        auditLogger.error("AI Inference failed", { error: e, description });
        throw new Error(`AI Inference failed: ${e.message}`);
    } finally {
        if (fs.existsSync(screenshotPath)) fs.unlinkSync(screenshotPath);
    }
}
