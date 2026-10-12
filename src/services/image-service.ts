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
import { detectPixelRatio } from './display-scale';

/**
 * Generate a preview image with a highlight at (x, y)
 */
export async function getHighlightPreview(x: number, y: number, w: number = 40, h: number = 40): Promise<Buffer> {
    const screenshotPath = path.join(os.tmpdir(), `preview_${Date.now()}.png`);
    try {
        // Capture screenshot
        const screencaptureArgs = ['-x', screenshotPath];
        safeExecSync('screencapture', screencaptureArgs);

        // (x, y, w, h) are logical screen points like all input coords, but
        // the captured PNG is in device pixels — scale to image space so the
        // marker lands where a click at (x, y) would actually hit.
        const meta = await sharp(screenshotPath).metadata();
        const scale = await detectPixelRatio(meta.width ?? 0);
        const px = x * scale;
        const py = y * scale;
        const pw = Math.max(1, Math.round(w * scale));
        const ph = Math.max(1, Math.round(h * scale));

        // Create an SVG circle/rectangle overlay
        // We use a red circle for points, rectangle for elements with bounds
        const svg = `
            <svg width="${pw + 20}" height="${ph + 20}" viewBox="-10 -10 ${pw + 20} ${ph + 20}">
                <rect x="0" y="0" width="${pw}" height="${ph}" fill="none" stroke="red" stroke-width="3" />
            </svg>
        `;

        // Composite the highlight onto the screenshot
        const previewBuffer = await sharp(screenshotPath)
            .composite([{
                input: Buffer.from(svg),
                top: Math.max(0, Math.round(py - 10)),
                left: Math.max(0, Math.round(px - 10))
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
