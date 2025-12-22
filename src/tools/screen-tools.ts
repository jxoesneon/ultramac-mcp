/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z } from "zod";
import { MCPServer } from "../server/mcp-server";
import { getNutjs, requireNutjs, isNutjsAvailable } from "../server/nutjs-integration";
import { getScreenDimensions, captureScreenshot } from "../services/screen-service";
import { setSpatialFocus } from "../services/spatial-context";
import { getUITree, findElement } from "../services/ui-service";
import { performOCR } from "../services/ocr-service";
import { findIcon } from "../services/vision-service";

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
    description: "Get a simplified JSON tree of the active window's UI elements.",
    parameters: z.object({
       depth: z.number().optional().default(2),
    }),
    execute: async ({ depth }: {depth: number}) => {
      const result = await getUITree(depth);
      return JSON.stringify(result, null, 2);
    }
  });

  server.addTool({
    name: "find_element",
    description: "Find a UI element in the active window by its name or role.",
    parameters: z.object({
      criteria: z.string(),
      role: z.string().optional(),
    }),
    execute: async ({ criteria, role }: {criteria: string, role?: string}) => {
        const data = await findElement(criteria, role);
        if (data.found) {
            const centerX = data.position[0] + (data.size[0] / 2);
            const centerY = data.position[1] + (data.size[1] / 2);
            return `Found '${data.name}' (${data.role}) at (${data.position[0]}, ${data.position[1]}). Center: (${centerX}, ${centerY})`;
        }
        return "Element not found.";
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
    description: "Polls for a UI element to appear by name/role.",
    parameters: z.object({
      criteria: z.string(),
      role: z.string().optional(),
      timeoutMs: z.number().optional().default(10000),
    }),
    execute: async ({ criteria, role, timeoutMs }: {criteria: string, role?: string, timeoutMs: number}) => {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs!) {
            const data = await findElement(criteria, role);
            if (data.found) return `Element "${criteria}" found!`;
            await new Promise(r => setTimeout(r, 500));
        }
        return `Timeout waiting for element "${criteria}"`;
    }
  });
}
