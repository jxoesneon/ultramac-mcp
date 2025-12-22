/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z } from "zod";
import { MCPServer } from "../server/mcp-server";
import { getNutjs, requireNutjs } from "../server/nutjs-integration";
import { safeExecSync } from "../core/security-utils";

/**
 * Register advanced automation tools
 */
export function registerAutomationTools(server: MCPServer) {
  const { mouse, keyboard, Point, Key } = getNutjs();

  server.addTool({
    name: "sleep",
    description: "Pause execution for a specified amount of time.",
    parameters: z.object({
      ms: z.number().describe("Time to sleep in milliseconds"),
    }),
    execute: async ({ ms }: {ms: number}) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return `Slept for ${ms} milliseconds`;
    },
  });

  server.addTool({
    name: "mouseMovePath",
    description: "Move mouse along a path of coordinates with smooth animation.",
    parameters: z.object({
      path: z.array(z.number()).describe("Array of coordinates [x1,y1,x2,y2,...]"),
    }),
    execute: async ({ path }: {path: number[]}) => {
      requireNutjs();
      if (path.length % 2 !== 0) throw new Error("Path must be even (x,y pairs)");
      const points = [];
      for (let i = 0; i < path.length; i += 2) points.push(new Point(path[i], path[i + 1]));
      await mouse.move(points);
      return `Moved along path with ${points.length} points`;
    },
  });

  server.addTool({
    name: "systemCommand",
    description: "Execute common system key combinations.",
    parameters: z.object({
      command: z.enum(["copy", "paste", "cut", "undo", "redo", "selectAll", "save", "quit", "minimize", "switchApp", "newTab", "closeTab"]),
    }),
    execute: async ({ command }: {command: string}) => {
      const isMac = process.platform === "darwin";
      const cmdKey = isMac ? Key.LeftSuper : Key.LeftControl;
      
      const commands: Record<string, () => Promise<void>> = {
          copy: async () => { await keyboard.pressKey(cmdKey, Key.C); await keyboard.releaseKey(cmdKey, Key.C); },
          paste: async () => { await keyboard.pressKey(cmdKey, Key.V); await keyboard.releaseKey(cmdKey, Key.V); },
          cut: async () => { await keyboard.pressKey(cmdKey, Key.X); await keyboard.releaseKey(cmdKey, Key.X); },
          undo: async () => { await keyboard.pressKey(cmdKey, Key.Z); await keyboard.releaseKey(cmdKey, Key.Z); },
          selectAll: async () => { await keyboard.pressKey(cmdKey, Key.A); await keyboard.releaseKey(cmdKey, Key.A); },
          save: async () => { await keyboard.pressKey(cmdKey, Key.S); await keyboard.releaseKey(cmdKey, Key.S); },
          // ... more commands can be added here
      };

      if (commands[command]) {
          await commands[command]();
          return `Executed ${command}`;
      }
      
      // Fallback to AppleScript for complex macOS commands
      const commandMap: any = {
        redo: 'keystroke "z" using {command down, shift down}',
        quit: 'keystroke "q" using command down',
        minimize: 'keystroke "m" using command down',
        switchApp: "keystroke tab using command down",
        newTab: 'keystroke "t" using command down',
        closeTab: 'keystroke "w" using command down',
      };
      
      const as = commandMap[command];
      if (as && isMac) {
          safeExecSync('osascript', ['-e', `tell application "System Events" to ${as}`]);
          return `Executed ${command} via AppleScript`;
      }
      
      throw new Error(`Command ${command} not supported or failed.`);
    },
  });
}
