/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FastMCP } from "fastmcp";
import * as Sentry from "@sentry/node";
import { auditLogger, logToolInvocation, logError } from '../core/audit-logger';
import { handleToolError, sanitizeErrorForClient } from '../core/errors';
import { recordToolInvocation, recordError } from '../core/metrics';
import { authMiddleware } from '../core/auth';
import { registerHealthEndpoints } from '../core/health';

/**
 * Enterprise MCPServer class wrapping FastMCP with enterprise features
 */
export class MCPServer {
    private server: FastMCP<any>;
    private toolRegistry: Map<string, any> = new Map();
    private name: string;
    private version: string;

    constructor(name: string = "UltraMac MCP", version: string = "1.0.0", private categoriesEnabled?: string[]) {
        this.name = name;
        this.version = version;
        
        const disableAuth = process.env.ULTRAMAC_MCP_DISABLE_AUTH === 'true';
        const useStdio = process.argv.slice(2).includes("--stdio");

        this.server = new FastMCP({
            name: this.name,
            version: this.version as `${number}.${number}.${number}`,
            authenticate: (useStdio || disableAuth) ? undefined : async (req: any) => {
                return authMiddleware(req) ? {} : undefined;
            }
        });

        // Register health endpoints
        registerHealthEndpoints(this.server as any);

        // Intercept addTool to add logging and error handling
        const originalAddTool = this.server.addTool.bind(this.server);
        this.server.addTool = (tool: any) => {
            // Token-efficiency filter: skip registering tools outside the
            // allowed category set, so only the requested tool surface is
            // exposed to the model (cuts context-window overhead).
            if (this.categoriesEnabled && this.categoriesEnabled.length > 0) {
                const toolCategory = this.categorizeTool(tool.name);
                if (!this.categoriesEnabled.includes(toolCategory)) {
                    return; // skip registering this tool
                }
            }
            this.toolRegistry.set(tool.name, tool);
            const originalExecute = tool.execute;
            
            tool.execute = async (args: any, context: any) => {
                const startTime = Date.now();
                try {
                    const result = await originalExecute(args, context);
                    const duration = Date.now() - startTime;
                    logToolInvocation(tool.name, args, result, duration, true);
                    recordToolInvocation(tool.name, duration / 1000, true);
                    return result;
                } catch (error: any) {
                    const duration = Date.now() - startTime;
                    
                    // Sentry Error Tracking
                    if (process.env.SENTRY_DSN) {
                        Sentry.withScope((scope) => {
                            scope.setTags({ tool: tool.name, success: 'false' });
                            scope.setExtra('args', args);
                            Sentry.captureException(error);
                        });
                    }

                    logError(`Tool:${tool.name}`, error, { args, duration });
                    logToolInvocation(tool.name, args, error.message, duration, false);
                    recordToolInvocation(tool.name, duration / 1000, false);
                    recordError('tool_failure', tool.name);
                    
                    const sanitized = sanitizeErrorForClient(error);
                    return JSON.stringify(sanitized, null, 2);
                }
            };
            return originalAddTool(tool);
        };
    }

    /**
     * Add a tool to the server
     */
    public addTool(tool: any) {
        return this.server.addTool(tool);
    }

    /**
     * Start the server
     */
    public async start() {
        const useStdio = process.argv.slice(2).includes("--stdio") || process.argv.slice(2).includes("--stdio");
        if (useStdio) {
            // @ts-ignore
            return this.server.start({ transportType: "stdio" });
        } else {
            const port = parseInt(process.env.PORT || "3010");
            // @ts-ignore
            return this.server.start({
                transportType: "httpStream",
                httpStream: { port }
            });
        }
    }

    /**
     * Get the tool registry
     */
    public getRegistry() {
        return this.toolRegistry;
    }

    /**
     * Infer the tool category from its name so the token-efficiency filter can
     * select which tools to expose. Tools are grouped by their semantic prefix.
     */
    public categorizeTool(name: string): string {
        if (name.startsWith('mouse')) return 'mouse';
        if (name.startsWith('key') || name === 'type' || name.startsWith('type')) return 'keyboard';
        if (name === 'screenshot' || name.startsWith('screen') || name.startsWith('color')
            || name.startsWith('get_ui') || name.startsWith('find_') || name.startsWith('wait_')) return 'vision';
        if (name.startsWith('system') || name.startsWith('sleep') || name.startsWith('get_windows')
            || name.startsWith('window') || name.startsWith('get_action')) return 'admin';
        return 'automation';
    }
}
