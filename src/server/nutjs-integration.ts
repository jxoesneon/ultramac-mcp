/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';
import { auditLogger } from '../core/audit-logger';

let nutjs: any = null;
let nutjsAvailable = false;

/**
 * Initialize nutjs integration
 */
export function initNutjs(): boolean {
    try {
        // Path relative to src/server/
        const nutjsPath = path.resolve(__dirname, '../../nutjs/nut.js/core/nut.js/dist/index.js');
        nutjs = require(nutjsPath);
        nutjsAvailable = true;
        auditLogger.info("nutjs loaded successfully");
        return true;
    } catch (error: any) {
        auditLogger.warn("nutjs not fully available", { error: error.message });
        return false;
    }
}

/**
 * Check if nutjs is available
 */
export function isNutjsAvailable(): boolean {
    return nutjsAvailable;
}

/**
 * Get nutjs instances
 */
export function getNutjs() {
    if (!nutjsAvailable) {
        throw new Error("nutjs functionality not available. Please ensure all dependencies are properly installed.");
    }
    return nutjs;
}

/**
 * Helper function to check nutjs availability
 */
export const requireNutjs = () => {
    if (!nutjsAvailable) {
        throw new Error("nutjs functionality not available. Please ensure all dependencies are properly installed.");
    }
};
