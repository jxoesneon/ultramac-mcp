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
import { findElement, type UITarget } from "../services/ui-service";

/**
 * Shared target-selector parameters (process / pid / window) used by the
 * composed element tools to scope queries to a specific app or window.
 */
const targetParams = {
  process: z
    .string()
    .optional()
    .describe("Target application name or bundle identifier substring (case-insensitive, e.g. 'Safari' or 'com.apple.Safari')."),
  pid: z
    .number()
    .optional()
    .describe("Target process ID. Takes precedence over 'process'."),
  window: z
    .union([z.string(), z.number()])
    .optional()
    .describe("Target window: number = window index, string = case-insensitive title substring."),
};

const buttonParam = z
  .enum(["left", "right", "middle"])
  .default("left")
  .describe("Mouse button to click (default left)");

/**
 * Map a button name to the nutjs Button enum value.
 */
function resolveButton(button: string, Button: any): any {
  return button === "left"
    ? Button.LEFT
    : button === "right"
    ? Button.RIGHT
    : Button.MIDDLE;
}

/**
 * Build a UITarget from tool args. Returns undefined when no selector was
 * provided so queries fall back to the frontmost application.
 */
function buildTarget(
  process?: string,
  pid?: number,
  window?: string | number
): UITarget | undefined {
  if (process === undefined && pid === undefined && window === undefined) {
    return undefined;
  }
  const target: UITarget = {};
  if (process !== undefined) target.process = process;
  if (pid !== undefined) target.pid = pid;
  if (window !== undefined) target.window = window;
  return target;
}

/**
 * Register composed element find→act tools. These combine the semantic
 * element query (findElement / window discovery) with the input action so
 * agents can act on elements without screenshot→coordinate guessing.
 */
export function registerElementTools(server: MCPServer) {
  server.addTool({
    name: "click_element",
    description:
      "Composed find→act tool: locate a UI element by name/role (optionally scoped to a process/window) and click its center. Prefer this over screenshot-based coordinate guessing.",
    parameters: z.object({
      criteria: z
        .string()
        .describe("Text to match against the element's name, title, or description (case-insensitive)."),
      role: z
        .string()
        .optional()
        .describe("Optional accessibility role to match (e.g. 'AXButton', 'AXTextField')."),
      ...targetParams,
      button: buttonParam,
    }),
    execute: async ({ criteria, role, process, pid, window, button = "left" }: {
      criteria: string;
      role?: string;
      process?: string;
      pid?: number;
      window?: string | number;
      button: string;
    }) => {
      const data = await findElement(criteria, role, buildTarget(process, pid, window));
      if (!data.found) {
        return `Element not found: ${criteria}${data.error ? ` (${data.error})` : ""}`;
      }
      const cx = data.position[0] + data.size[0] / 2;
      const cy = data.position[1] + data.size[1] / 2;
      requireNutjs();
      const { mouse, Button, Point } = getNutjs();
      await mouse.setPosition(new Point(cx, cy));
      await mouse.click(resolveButton(button, Button));
      return `Clicked '${data.name}' (${data.role}) at (${cx}, ${cy}).`;
    },
  });

  server.addTool({
    name: "type_into_element",
    description:
      "Composed find→act tool: locate a UI element by name/role (optionally scoped to a process/window), click it to focus, then type text into it. Prefer this over clicking coordinates then typing.",
    parameters: z.object({
      criteria: z
        .string()
        .describe("Text to match against the element's name, title, or description (case-insensitive)."),
      role: z
        .string()
        .optional()
        .describe("Optional accessibility role to match (e.g. 'AXTextField')."),
      text: z.string().describe("Literal text to type into the element."),
      ...targetParams,
    }),
    execute: async ({ criteria, role, text, process, pid, window }: {
      criteria: string;
      role?: string;
      text: string;
      process?: string;
      pid?: number;
      window?: string | number;
    }) => {
      const data = await findElement(criteria, role, buildTarget(process, pid, window));
      if (!data.found) {
        return `Element not found: ${criteria}${data.error ? ` (${data.error})` : ""}`;
      }
      const cx = data.position[0] + data.size[0] / 2;
      const cy = data.position[1] + data.size[1] / 2;
      requireNutjs();
      const { mouse, keyboard, Button, Point } = getNutjs();
      await mouse.setPosition(new Point(cx, cy));
      await mouse.click(Button.LEFT);
      // Brief pause so the click-to-focus lands before typing begins.
      await new Promise((r) => setTimeout(r, 80));
      await keyboard.type(text);
      return `Typed ${text.length} chars into '${data.name}'.`;
    },
  });

  server.addTool({
    name: "click_in_window",
    description:
      "Composed window→act tool: resolve a window by title substring or index (optionally scoped to a process/pid) and click at window-relative coordinates, translated to absolute screen coordinates.",
    parameters: z.object({
      x: z
        .number()
        .describe("Horizontal offset in pixels from the window's top-left corner."),
      y: z
        .number()
        .describe("Vertical offset in pixels from the window's top-left corner."),
      window: z
        .union([z.string(), z.number()])
        .describe("Target window: number = index among matching windows (front-to-back), string = case-insensitive title substring."),
      process: targetParams.process,
      pid: targetParams.pid,
      button: buttonParam,
    }),
    execute: async ({ x, y, window, process, pid, button = "left" }: {
      x: number;
      y: number;
      window: string | number;
      process?: string;
      pid?: number;
      button: string;
    }) => {
      const wins: any[] = await openWindows();

      // Narrow by owner first: exact PID match wins over name/bundleId substring.
      let candidates = wins;
      if (pid !== undefined) {
        candidates = wins.filter((w) => w.owner?.processId === pid);
      } else if (process !== undefined) {
        const q = process.toLowerCase();
        candidates = wins.filter(
          (w) =>
            (w.owner?.name && w.owner.name.toLowerCase().includes(q)) ||
            (w.owner?.bundleId && w.owner.bundleId.toLowerCase().includes(q))
        );
      }

      // Then select the window: numeric index into the candidate list
      // (Nth of the owner's windows, or Nth overall without a process
      // filter), or case-insensitive title substring.
      let target: any;
      if (typeof window === "number") {
        target = candidates[window];
      } else {
        const q = window.toLowerCase();
        target = candidates.find(
          (w) => w.title && w.title.toLowerCase().includes(q)
        );
      }

      if (!target) {
        const scope = pid !== undefined
          ? ` (pid ${pid})`
          : process !== undefined
          ? ` in process '${process}'`
          : "";
        return `Window not found: ${JSON.stringify(window)}${scope}`;
      }

      if (x < 0 || y < 0 || x > target.bounds.width || y > target.bounds.height) {
        return `Coordinates (${x}, ${y}) outside window bounds ${target.bounds.width}x${target.bounds.height} for '${target.title}'.`;
      }

      const ax = target.bounds.x + x;
      const ay = target.bounds.y + y;
      requireNutjs();
      const { mouse, Button, Point } = getNutjs();
      await mouse.setPosition(new Point(ax, ay));
      await mouse.click(resolveButton(button, Button));
      return `Clicked at window-relative (${x}, ${y}) → screen (${ax}, ${ay}) in '${target.title}'.`;
    },
  });
}
