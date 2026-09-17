/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z } from "zod";
import { execFileSync } from "child_process";
import { MCPServer } from "../server/mcp-server";
import { findElement, type UITarget } from "../services/ui-service";
import { elementContainsText } from "../services/verify-service";

const targetFields = {
    process: z.string().optional().describe("Target app by name or bundleId substring, case-insensitive. Default: frontmost."),
    pid: z.number().optional().describe("Target process PID. Takes precedence over process."),
    window: z.union([z.string(), z.number()]).optional().describe("Target window: index number or title substring, case-insensitive. Default: first window."),
};

function toTarget(args: { process?: string; pid?: number; window?: string | number }): UITarget | undefined {
    if (args.process === undefined && args.pid === undefined && args.window === undefined) return undefined;
    return { process: args.process, pid: args.pid, window: args.window };
}

/**
 * Register verification/assertion tools that bridge MCP actions back to
 * observable application state (UI tree contents, unified log output).
 */
export function registerVerifyTools(server: MCPServer) {

    server.addTool({
        name: "element_contains_text",
        description: "Assert that the UI subtree rooted at an element (matched by name/description substring) contains the given text in some descendant's name, description, or value. Case-insensitive.",
        parameters: z.object({
            criteria: z.string().describe("Substring to match the parent element's name or description (case-insensitive)."),
            text: z.string().describe("Text to search for inside the parent element's subtree (case-insensitive)."),
            role: z.string().optional().describe("Optional exact AX role the parent element must have (e.g. AXButton)."),
            ...targetFields,
        }),
        execute: async ({ criteria, text, role, process, pid, window }: { criteria: string; text: string; role?: string; process?: string; pid?: number; window?: string | number }) => {
            const target = toTarget({ process, pid, window });
            const result = await elementContainsText(criteria, text, role, target);
            const json = JSON.stringify(result);
            if (result.error) {
                return `FAIL: element_contains_text could not be evaluated (${result.error})\n${json}`;
            }
            if (result.found) {
                return `PASS: element matching "${criteria}" contains text "${text}" (matched: ${result.matched})\n${json}`;
            }
            return `FAIL: element matching "${criteria}" does not contain text "${text}" (searched ${result.searched ?? 0} elements)\n${json}`;
        },
    });

    server.addTool({
        name: "assert_element_exists",
        description: "Assert that a UI element matching the criteria exists in the target window. Returns structured JSON {pass, element?|error?}.",
        parameters: z.object({
            criteria: z.string().describe("Substring to match the element's name or description (case-insensitive)."),
            role: z.string().optional().describe("Optional exact AX role (e.g. AXButton)."),
            ...targetFields,
        }),
        execute: async ({ criteria, role, process, pid, window }: { criteria: string; role?: string; process?: string; pid?: number; window?: string | number }) => {
            const data = await findElement(criteria, role, toTarget({ process, pid, window }));
            if (data && data.found) {
                return JSON.stringify({
                    pass: true,
                    element: {
                        name: data.name,
                        role: data.role,
                        position: data.position,
                        size: data.size,
                    },
                });
            }
            return JSON.stringify({
                pass: false,
                error: (data && data.error) || `No element matching '${criteria}' found.`,
            });
        },
    });

    server.addTool({
        name: "recent_process_logs",
        description: "Read recent unified-log lines for a process (macOS `log show`), bridging MCP actions to the app's stdout/log state.",
        parameters: z.object({
            process: z.string().describe("Process name, or PID as a string."),
            seconds: z.number().default(30).describe("Look-back window in seconds (clamped to 5..300)."),
            limit: z.number().default(50).describe("Maximum number of trailing lines to return (clamped to 1..500)."),
        }),
        execute: async ({ process, seconds, limit }: { process: string; seconds?: number; limit?: number }) => {
            const secs = Math.min(300, Math.max(5, Math.trunc(seconds ?? 30)));
            const lim = Math.min(500, Math.max(1, Math.trunc(limit ?? 50)));
            const proc = process.trim();
            const isPid = /^\d+$/.test(proc);
            // Strip characters that could break out of the quoted predicate.
            const sanitized = proc.replace(/["\\]/g, "");
            const predicate = isPid
                ? `processIdentifier == ${proc}`
                : `process == "${sanitized}"`;
            try {
                // execFileSync is used directly rather than safeExecSync: the
                // safeExecSync whitelist does not include `log`, and its
                // space-joined command string would split the multi-word
                // --predicate argument.
                const text = execFileSync(
                    "log",
                    ["show", "--last", `${secs}s`, "--predicate", predicate, "--style", "compact"],
                    { encoding: "utf8", maxBuffer: 4 * 1024 * 1024, timeout: 15000 }
                ) as string;
                const lines = text.split("\n").filter((l) => l.length > 0);
                const tail = lines.slice(-lim);
                if (tail.length === 0) {
                    return `No log lines found for process "${proc}" in the last ${secs}s.`;
                }
                return tail.join("\n");
            } catch (error: any) {
                return `Failed to read logs for process "${proc}": ${error?.message ?? error}`;
            }
        },
    });
}
