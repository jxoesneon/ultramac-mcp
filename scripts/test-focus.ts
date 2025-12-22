#!/usr/bin/env node

/**
 * Focus Guard Test
 * 
 * This tests the safety mechanism that prevents accidental clicks/typing
 * when the user switches windows during agent execution.
 * 
 * Usage: Run this script, then quickly switch windows (Cmd+Tab) within 3 seconds.
 * Expected: The click should abort with a safety message.
 */

import { execSync } from "child_process";

console.log("Focus Guard Test\n");
console.log("1. Getting initial window...");

// Simulate what the MCP does
const getActiveWindow = () => {
    try {
        const script = `
            var system = Application('System Events');
            var proc = system.processes.whose({frontmost: true})[0];
            JSON.stringify({
                title: proc.windows.length > 0 ? proc.windows[0].name() : "",
                bundleId: proc.bundleIdentifier()
            });
        `;
        const result = execSync(`osascript -l JavaScript -e '${script.replace(/'/g, "'\"'\"'")}'`).toString();
        return JSON.parse(result);
    } catch(e) {
        console.error("Failed:", e);
        return null;
    }
};

const initialWindow = getActiveWindow();
console.log(`   Initial: "${initialWindow?.title}" (${initialWindow?.bundleId})\n`);

console.log("2. Simulating slow operation (OCR)...");
console.log("   > SWITCH WINDOWS NOW (Cmd+Tab) to test safety! <\n");

// Simulate OCR delay
execSync("sleep 3");

console.log("3. Verifying focus before click...");
const currentWindow = getActiveWindow();
console.log(`   Current: "${currentWindow?.title}" (${currentWindow?.bundleId})\n`);

if (!currentWindow || currentWindow.bundleId !== initialWindow.bundleId || currentWindow.title !== initialWindow.title) {
    console.log(`✅ SAFETY TRIGGERED: Active window changed!`);
    console.log(`   Action would be ABORTED to prevent accidents.\n`);
} else {
    console.log(`✓ Focus unchanged, action would proceed safely.\n`);
}
