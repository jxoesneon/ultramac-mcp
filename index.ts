/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Sentry from "@sentry/node";
import { MCPServer } from "./src/server/mcp-server";
import { initNutjs } from "./src/server/nutjs-integration";
import { auditLogger, logError } from "./src/core/audit-logger";
import { actionLogger } from "./src/core/action-logger";

// Register Tool Modules
import { registerMouseTools } from "./src/tools/mouse-tools";
import { registerKeyboardTools } from "./src/tools/keyboard-tools";
import { registerScreenTools } from "./src/tools/screen-tools";
import { registerAutomationTools } from "./src/tools/automation-tools";
import { registerAdminTools } from "./src/tools/admin-tools";

// REDIRECT CONSOLE OUTPUT TO STDERR
// Prevents contamination of stdout used for JSON-RPC
const redirectConsole = () => {
  const writeStderr = (prefix: string, args: any[]) => {
    process.stderr.write(`${prefix}${args.join(' ')}\n`);
  };
  console.log = (...args: any[]) => writeStderr('', args);
  console.error = (...args: any[]) => writeStderr('[ERROR] ', args);
  console.warn = (...args: any[]) => writeStderr('[WARN] ', args);
};

// macOS Permissions check (simplified for entry point)
const checkPermissions = () => {
    try {
        const macPermissions = require("node-mac-permissions");
        if (macPermissions.getAuthStatus("accessibility") !== "authorized") {
            macPermissions.askForAccessibilityAccess();
            console.log('⚠️ Accessibility access required.');
        }
        if (macPermissions.getAuthStatus("screen") !== "authorized") {
            macPermissions.askForScreenCaptureAccess();
            console.log('⚠️ Screen Recording access required.');
        }
    } catch (e) {
        console.warn('macOS permissions module not available.');
    }
};

async function bootstrap() {
    redirectConsole();
    console.log('[Startup] Initializing UltraMac MCP Enterprise Server...');

    // Initialize Sentry
    if (process.env.SENTRY_DSN) {
        Sentry.init({
            dsn: process.env.SENTRY_DSN,
            tracesSampleRate: 1.0,
            environment: process.env.NODE_ENV || 'development'
        });
    }

    // Initialize nutjs
    initNutjs();
    
    // Check Permissions
    checkPermissions();

    // Create Server Instance
    const categoryArg = process.argv.find((a: string) => a.startsWith('--category='));
    const categoriesEnabled = categoryArg && categoryArg.split('=')[1]
        ? categoryArg.split('=')[1]!.split(',').map((s: string) => s.trim()).filter(Boolean)
        : undefined;
    const server = new MCPServer("Local UltraMac MCP", "2.0.0-enterprise", categoriesEnabled);

    // Register Tools
    registerMouseTools(server);
    registerKeyboardTools(server);
    registerScreenTools(server);
    registerAutomationTools(server);
    registerAdminTools(server);

    // Shutdown Handlers
    const gracefulShutdown = async (signal: string) => {
        console.log(`\n[Shutdown] Received ${signal}, cleaning up...`);
        try {
            await actionLogger.persistHistory();
            auditLogger.info('Server shutdown', { signal });
            auditLogger.end();
            process.exit(0);
        } catch (e) {
            process.exit(1);
        }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('uncaughtException', (err) => {
        logError('uncaught_exception', err);
        gracefulShutdown('FATAL_EXCEPTION');
    });

    // Start Server
    await server.start();
    console.log('[Server] Enterprise Refactoring Complete. Server active.');
    auditLogger.info('Enterprise Server started');
}

bootstrap().catch(err => {
    process.stderr.write(`[FATAL] Bootstrap failed: ${err.message}\n`);
    process.exit(1);
});
