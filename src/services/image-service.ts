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
import { safeExecSync } from '../core/security-utils';
import { auditLogger } from '../core/audit-logger';

/**
 * Generate a preview image with a highlight at (x, y)
 */
export async function getHighlightPreview(x: number, y: number, w: number = 40, h: number = 40): Promise<Buffer> {
    const screenshotPath = path.join(os.tmpdir(), `preview_${Date.now()}.png`);
    try {
        // Capture screenshot
        const screencaptureArgs = ['-x', screenshotPath];
        safeExecSync('screencapture', screencaptureArgs);
        
        // Create an SVG circle/rectangle overlay
        // We use a red circle for points, rectangle for elements with bounds
        const svg = `
            <svg width="${w + 20}" height="${h + 20}" viewBox="-10 -10 ${w + 20} ${h + 20}">
                <rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="red" stroke-width="3" />
            </svg>
        `;
        
        // Composite the highlight onto the screenshot
        const previewBuffer = await sharp(screenshotPath)
            .composite([{
                input: Buffer.from(svg),
                top: Math.max(0, Math.round(y - 10)),
                left: Math.max(0, Math.round(x - 10))
            }])
            .png()
            .toBuffer();
            
        // Clean up temp file
        if (fs.existsSync(screenshotPath)) fs.unlinkSync(screenshotPath);
        
        return previewBuffer;
    } catch (e) {
        auditLogger.error("Failed to generate highlight preview", { error: e, x, y, w, h });
        // Fallback to raw screenshot if compositing fails
        if (fs.existsSync(screenshotPath)) {
            const buf = fs.readFileSync(screenshotPath);
            fs.unlinkSync(screenshotPath);
            return buf;
        }
        throw e;
    }
}
