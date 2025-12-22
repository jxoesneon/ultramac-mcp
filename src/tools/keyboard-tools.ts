/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z } from "zod";
import { MCPServer } from "../server/mcp-server";
import { getNutjs, requireNutjs } from "../server/nutjs-integration";
import { getActiveWindowInfo } from "../services/ui-service";

/**
 * Register keyboard interaction tools
 */
export function registerKeyboardTools(server: MCPServer) {
  const { keyboard, Key } = getNutjs();

  server.addTool({
    name: "type",
    description: "Simulate typing text or pressing key combinations. Provide either 'text' to type literal text, or 'keys' as comma-separated key names for key combinations.",
    parameters: z.object({
      text: z.string().optional().describe("Literal text to type (optional)"),
      keys: z
        .string()
        .optional()
        .describe("Comma-separated key names to press simultaneously (optional, e.g. 'LeftControl,C')"),
    }),
    execute: async ({ text, keys }: {text?: string, keys?: string}) => {
      requireNutjs();
      
      const initialWindow = getActiveWindowInfo();
      if (!initialWindow) {
          return "Safety: Could not verify active window. Typing aborted.";
      }
      
      if (keys && keys.length > 0) {
        const currentWindow = getActiveWindowInfo();
        if (!currentWindow || currentWindow.bundleId !== initialWindow.bundleId || currentWindow.title !== initialWindow.title) {
            return `Safety: Active window changed (was "${initialWindow.title}", now "${currentWindow?.title || 'unknown'}"). Key press aborted.`;
        }
        
        const keyNames = keys.split(",").map((k) => k.trim());
        const keyConsts: any[] = keyNames.map((name) => {
          const keyName = name === "Command" ? "LeftSuper" : name;
          const keyConst = (Key as any)[keyName];
          if (!keyConst) throw new Error(`Unknown key: ${name}`);
          return keyConst;
        });
        
        await keyboard.pressKey(...keyConsts);
        await keyboard.releaseKey(...keyConsts);
        return `Pressed key combination [${keyNames.join(" + ")}].`;
      }
      
      if (text !== undefined) {
        const currentWindow = getActiveWindowInfo();
        if (!currentWindow || currentWindow.bundleId !== initialWindow.bundleId || currentWindow.title !== initialWindow.title) {
            return `Safety: Active window changed (was "${initialWindow.title}", now "${currentWindow?.title || 'unknown'}"). Typing aborted.`;
        }
        
        await keyboard.type(text);
        return `Typed text: "${text}"`;
      }
      
      throw new Error("Provide either 'text' to type or 'keys' for key combination.");
    },
  });

  server.addTool({
    name: "keyControl",
    description: "Press or release specific keys for advanced key combinations.",
    parameters: z.object({
      action: z.enum(["press", "release"]).describe("Action to perform"),
      keys: z
        .string()
        .describe("Comma-separated key names to control (e.g. 'LeftControl,LeftShift')"),
    }),
    execute: async ({ action, keys }: {action: string, keys: string}) => {
      requireNutjs();
      const keyNames = keys.split(",").map((k) => k.trim());
      const keyConsts: any[] = keyNames.map((name) => {
        const keyName = name === "Command" ? "LeftSuper" : name;
        const keyConst = (Key as any)[keyName];
        if (!keyConst) throw new Error(`Unknown key: ${name}`);
        return keyConst;
      });

      if (action === "press") {
        await keyboard.pressKey(...keyConsts);
        return `Pressed keys: [${keyNames.join(", ")}]`;
      } else {
        await keyboard.releaseKey(...keyConsts);
        return `Released keys: [${keyNames.join(", ")}]`;
      }
    },
  });
}
