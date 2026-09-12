/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { auditLogger } from '../core/audit-logger';

// @nut-tree-fork/nut-js ships platform-specific native bindings that load
// lazily. We import the package and let initNutjs() verify it's usable without
// hard-crashing the server when the native build is unavailable (degrade to the
// graceful fallback used across the tool layer).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nutjs = require('@nut-tree-fork/nut-js');

let nutjsAvailable = false;

/**
 * Initialize nutjs integration
 */
export function initNutjs(): boolean {
    try {
        // Verify the module actually loaded and exposes the expected runtime
        // surface. The package ships platform-specific native bindings
        // (node-mac-permissions, libnut) that load lazily on first use.
        if (nutjs && typeof nutjs.mouse === 'object' && typeof nutjs.keyboard === 'object' && nutjs.screen) {
            nutjsAvailable = true;
            auditLogger.info('nutjs loaded successfully');
            return true;
        }
        auditLogger.warn('nutjs loaded but did not expose expected automation surface');
        return false;
    } catch (error: any) {
        auditLogger.warn('nutjs not fully available', { error: error.message });
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
        throw new Error('nutjs functionality not available. Please ensure all dependencies are properly installed.');
    }
    return nutjs;
}

/**
 * Helper function to check nutjs availability
 */
export const requireNutjs = () => {
    if (!nutjsAvailable) {
        throw new Error('nutjs functionality not available. Please ensure all dependencies are properly installed.');
    }
};