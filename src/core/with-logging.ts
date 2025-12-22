/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ActionLogger, type ActionRecord } from './action-logger';

/**
 * Wrapper to add logging to any tool execution
 */
export function withLogging<T extends any[], R>(
    actionLogger: ActionLogger,
    toolName: string,
    fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
        const startTime = Date.now();
        const toolArgs = args[0]; // First arg is usually the params object
        
        try {
            const result = await fn(...args);
            const duration = Date.now() - startTime;
            actionLogger.log(toolName, toolArgs, result, duration, true);
            return result;
        } catch (e: any) {
            const duration = Date.now() - startTime;
            const errorMsg = e.message || String(e);
            actionLogger.log(toolName, toolArgs, errorMsg, duration, false);
            throw e;
        }
    };
}
