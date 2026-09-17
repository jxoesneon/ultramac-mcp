/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z } from "zod";
import { MCPServer } from "../server/mcp-server";
import { getNutjs, requireNutjs } from "../server/nutjs-integration";
import { getHighlightPreview } from "../services/image-service";

/**
 * Register mouse interaction tools
 */
export function registerMouseTools(server: MCPServer) {
  const { mouse, Button, Point } = getNutjs();

  const clickParameters = z.object({
    x: z.number().describe("Horizontal screen coordinate (pixels)"),
    y: z.number().describe("Vertical screen coordinate (pixels)"),
    button: z
      .enum(["left", "right", "middle"])
      .default("left")
      .describe("Mouse button to click (default left)"),
    preview: z.boolean().optional().describe("If true, returns a screenshot with the target highlighted instead of clicking."),
  });

  const clickExecute = async ({ x, y, button, preview }: {x: number, y: number, button: string, preview?: boolean}) => {
    requireNutjs();

    if (preview) {
        const previewBuf = await getHighlightPreview(x, y);
        return {
            content: [
                { type: "text", text: `Preview: Target at (${x}, ${y})` },
                { type: "image", data: previewBuf.toString("base64"), mimeType: "image/png" }
            ]
        };
    }

    await mouse.setPosition(new Point(x, y));
    const btn =
      button === "left"
        ? Button.LEFT
        : button === "right"
        ? Button.RIGHT
        : Button.MIDDLE;
    await mouse.click(btn);
    return `Mouse ${button}-click at (${x}, ${y}) completed.`;
  };

  server.addTool({
    name: "mouseClick",
    description: "Simulate a mouse click at the given screen coordinates.",
    parameters: clickParameters,
    execute: clickExecute,
  });

  server.addTool({
    name: "click",
    description: "Alias for mouseClick — simulate a mouse click at screen coordinates.",
    parameters: clickParameters,
    execute: clickExecute,
  });

  server.addTool({
    name: "mouseDoubleClick",
    description: "Simulate a mouse double-click at the given screen coordinates.",
    parameters: z.object({
      x: z.number().describe("Horizontal screen coordinate (pixels)"),
      y: z.number().describe("Vertical screen coordinate (pixels)"),
      button: z
        .enum(["left", "right", "middle"])
        .default("left")
        .describe("Mouse button to double-click (default left)"),
    }),
    execute: async ({ x, y, button }: {x: number, y: number, button: string}) => {
      requireNutjs();
      await mouse.setPosition(new Point(x, y));
      const btn =
        button === "left"
          ? Button.LEFT
          : button === "right"
          ? Button.RIGHT
          : Button.MIDDLE;
      await mouse.doubleClick(btn);
      return `Mouse double-${button}-click at (${x}, ${y}) completed.`;
    },
  });

  server.addTool({
    name: "mouseMove",
    description: "Move the mouse to specific coordinates.",
    parameters: z.object({
      x: z.number().describe("Horizontal screen coordinate (pixels)"),
      y: z.number().describe("Vertical screen coordinate (pixels)"),
    }),
    execute: async ({ x, y }: {x: number, y: number}) => {
      requireNutjs();
      await mouse.setPosition(new Point(x, y));
      return `Mouse moved to (${x}, ${y}).`;
    },
  });

  server.addTool({
    name: "mouseGetPosition",
    description: "Get the current mouse cursor position.",
    parameters: z.object({}),
    execute: async () => {
      requireNutjs();
      const position = await mouse.getPosition();
      return `Current mouse position: (${position.x}, ${position.y})`;
    },
  });

  server.addTool({
    name: "mouseScroll",
    description: "Scroll the mouse wheel in a specified direction.",
    parameters: z.object({
      direction: z
        .enum(["up", "down", "left", "right"])
        .describe("Direction to scroll"),
      amount: z
        .number()
        .default(3)
        .describe("Number of scroll steps (default 3)"),
    }),
    execute: async ({ direction, amount }: {direction: string, amount: number}) => {
      requireNutjs();
      switch (direction) {
        case "up":
          await mouse.scrollUp(amount);
          break;
        case "down":
          await mouse.scrollDown(amount);
          break;
        case "left":
          await mouse.scrollLeft(amount);
          break;
        case "right":
          await mouse.scrollRight(amount);
          break;
      }
      return `Scrolled ${direction} ${amount} steps.`;
    },
  });

  server.addTool({
    name: "mouseDrag",
    description: "Drag the mouse from current position to target coordinates.",
    parameters: z.object({
      x: z.number().describe("Target horizontal coordinate (pixels)"),
      y: z.number().describe("Target vertical coordinate (pixels)"),
    }),
    execute: async ({ x, y }: {x: number, y: number}) => {
      requireNutjs();
      const currentPos = await mouse.getPosition();
      await mouse.drag([new Point(x, y)]);
      return `Dragged mouse from (${currentPos.x}, ${currentPos.y}) to (${x}, ${y}).`;
    },
  });

  server.addTool({
    name: "mouseButtonControl",
    description: "Press or release a mouse button without clicking.",
    parameters: z.object({
      action: z.enum(["press", "release"]).describe("Action to perform"),
      button: z
        .enum(["left", "right", "middle"])
        .default("left")
        .describe("Mouse button to control (default left)"),
    }),
    execute: async ({ action, button }: {action: string, button: string}) => {
      requireNutjs();
      const btn =
        button === "left"
          ? Button.LEFT
          : button === "right"
          ? Button.RIGHT
          : Button.MIDDLE;

      if (action === "press") {
        await mouse.pressButton(btn);
        return `${button} mouse button pressed.`;
      } else {
        await mouse.releaseButton(btn);
        return `${button} mouse button released.`;
      }
    },
  });
}
