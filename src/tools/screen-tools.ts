/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z } from "zod";
import { openWindows } from "get-windows";
import { MCPServer } from "../server/mcp-server";
import { getNutjs, requireNutjs } from "../server/nutjs-integration";
import { getScreenDimensions, captureScreenshot } from "../services/screen-service";
import { setSpatialFocus } from "../services/spatial-context";
import { getUITree, findElement, type UITarget } from "../services/ui-service";
import { performOCR } from "../services/ocr-service";
import { findIcon } from "../services/vision-service";

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
 * Register screen & UI discovery tools
 */
export function registerScreenTools(server: MCPServer) {
  
  server.addTool({
    name: "screenshot",
    description: "Capture a screenshot (full screen, region, or window).",
    parameters: z.object({
      mode: z.enum(["full", "region", "window"]).default("full"),
      regionX: z.number().optional(),
      regionY: z.number().optional(),
      regionWidth: z.number().optional(),
      regionHeight: z.number().optional(),
      windowName: z.string().optional(),
      windowId: z.number().optional(),
    }),
    execute: async (args: any) => {
        return await captureScreenshot(args.mode, {
            x: args.regionX,
            y: args.regionY,
            w: args.regionWidth,
            h: args.regionHeight,
            windowName: args.windowName,
            windowId: args.windowId
        });
    }
  });

  server.addTool({
    name: "screenInfo",
    description: "Get screen dimensions and information.",
    parameters: z.object({}),
    execute: async () => {
      return await getScreenDimensions();
    },
  });

  server.addTool({
    name: "screenHighlight",
    description: "Highlight a region on the screen for visual feedback.",
    parameters: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    }),
    execute: async ({ x, y, width, height }: {x: number, y: number, width: number, height: number}) => {
      requireNutjs();
      const { screen, Region } = getNutjs();
      const region = new Region(x, y, width, height);
      await screen.highlight(region);
      return `Highlighted region at (${x}, ${y}) with size ${width}x${height}`;
    },
  });

  server.addTool({
    name: "colorAt",
    description: "Get the color of a pixel at specific screen coordinates.",
    parameters: z.object({
      x: z.number(),
      y: z.number(),
    }),
    execute: async ({ x, y }: {x: number, y: number}) => {
      requireNutjs();
      const { screen, Point } = getNutjs();
      const color = await screen.colorAt(new Point(x, y));
      return `Color at (${x}, ${y}): R=${color.R}, G=${color.G}, B=${color.B}, A=${color.A}`;
    },
  });

  server.addTool({
    name: "set_spatial_focus",
    description: "Set a spatial region of interest for subsequent search tools.",
    parameters: z.object({
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    }),
    execute: async ({ x, y, w, h }: {x: number, y: number, w: number, h: number}) => {
       if (w === 0 && h === 0) {
           setSpatialFocus(null);
           return "Spatial focus cleared.";
       }
       setSpatialFocus({ x, y, w, h });
       return `Spatial focus set to Region(${x}, ${y}, ${w}x${h}).`;
    }
  });

  server.addTool({
    name: "get_ui_tree",
    description: "Get a simplified JSON tree of the active window's UI elements. Optionally target another app/window.",
    parameters: z.object({
       depth: z.number().optional().default(2),
       ...targetFields,
    }),
    execute: async (args: {depth: number, process?: string, pid?: number, window?: string | number}) => {
      const result = await getUITree(args.depth, toTarget(args));
      return JSON.stringify(result, null, 2);
    }
  });

  server.addTool({
    name: "find_element",
    description: "Find a UI element by name or role. Optionally target another app/window; returns center coordinates for follow-up clicks.",
    parameters: z.object({
      criteria: z.string(),
      role: z.string().optional(),
      ...targetFields,
    }),
    execute: async (args: {criteria: string, role?: string, process?: string, pid?: number, window?: string | number}) => {
        const data = await findElement(args.criteria, args.role, toTarget(args));
        if (data.found) {
            const centerX = data.position[0] + (data.size[0] / 2);
            const centerY = data.position[1] + (data.size[1] / 2);
            return `Found '${data.name}' (${data.role}) at (${data.position[0]}, ${data.position[1]}). Center: (${centerX}, ${centerY})`;
        }
        return data.error ? `Element not found: ${data.error}` : "Element not found.";
    }
  });

  server.addTool({
    name: "find_text_on_screen",
    description: "Find the coordinates of a specific text on the screen using OCR.",
    parameters: z.object({
      text: z.string(),
    }),
    execute: async ({ text }: {text: string}) => {
        const result = await performOCR(text);
        return JSON.stringify(result, null, 2);
    }
  });

  server.addTool({
    name: "find_icon",
    description: "Find an icon or visual element by description using local AI.",
    parameters: z.object({
        description: z.string(),
    }),
    execute: async ({ description }: {description: string}) => {
        const result = await findIcon(description);
        return JSON.stringify(result, null, 2);
    }
  });

  server.addTool({
    name: "wait_for_ui_element",
    description: "Polls for a UI element to appear by name/role. Optionally target another app/window.",
    parameters: z.object({
      criteria: z.string(),
      role: z.string().optional(),
      timeoutMs: z.number().optional().default(10000),
      ...targetFields,
    }),
    execute: async (args: {criteria: string, role?: string, timeoutMs: number, process?: string, pid?: number, window?: string | number}) => {
        const startTime = Date.now();
        while (Date.now() - startTime < args.timeoutMs!) {
            const data = await findElement(args.criteria, args.role, toTarget(args));
            if (data.found) return `Element "${args.criteria}" found!`;
            if (data.error) return `Element not found: ${data.error}`;
            await new Promise(r => setTimeout(r, 500));
        }
        return `Timeout waiting for element "${args.criteria}"`;
    }
  });

  server.addTool({
    name: "list_windows",
    description: "List all on-screen windows with id, title, owner app, pid, bundleId and bounds. Use to discover targets for window/process-scoped tools.",
    parameters: z.object({
        process: z.string().optional().describe("Filter by owner app name/bundleId substring (case-insensitive)."),
    }),
    execute: async ({ process }: {process?: string}) => {
        let wins = await openWindows();
        if (process) {
            const q = process.toLowerCase();
            wins = wins.filter((w: any) =>
                (w.owner?.name && w.owner.name.toLowerCase().includes(q)) ||
                (w.owner?.bundleId && w.owner.bundleId.toLowerCase().includes(q)) ||
                (w.title && w.title.toLowerCase().includes(q)));
        }
        const out = wins.map((w: any) => ({
            id: w.id, title: w.title,
            owner: w.owner?.name, pid: w.owner?.processId, bundleId: w.owner?.bundleId,
            bounds: w.bounds,
        }));
        return JSON.stringify(out, null, 2);
    }
  });
}
