/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { runJXA } from './applescript-service';

/**
 * UI Element properties
 */
export interface UIElement {
    role: string;
    name: string;
    description: string;
    position: [number, number];
    size: [number, number];
    children?: UIElement[];
}

/**
 * Optional targeting for UI queries. When omitted, tools operate on the
 * frontmost application's first window (legacy behavior).
 */
export interface UITarget {
    /** Process name or bundle identifier substring, case-insensitive (e.g. "Martensite" or "com.example.app"). */
    process?: string;
    /** Exact unix PID of the target process. Takes precedence over `process`. */
    pid?: number;
    /** Window selector: number = window index, string = case-insensitive substring of window title. Default: first window. */
    window?: string | number;
}

/**
 * Build the JXA preamble that resolves a UITarget into a process + window.
 * All user-supplied values are embedded via JSON.stringify so they become
 * safe, quoted JS literals (never raw interpolation).
 * Exported so verify-service shares identical targeting semantics.
 */
export function buildTargetPreamble(target?: UITarget): string {
    const pidLit = target && target.pid !== undefined ? JSON.stringify(target.pid) : 'null';
    const procLit = target && target.process !== undefined ? JSON.stringify(target.process) : 'null';
    const winLit = target && target.window !== undefined ? JSON.stringify(target.window) : 'null';
    return `
        var __targetPid = ${pidLit};
        var __targetProc = ${procLit};
        var __targetWin = ${winLit};

        function resolveProcess(system) {
            if (__targetPid !== null) {
                try {
                    var byPid = system.processes.whose({unixId: __targetPid});
                    if (byPid && byPid.length > 0) return byPid[0];
                } catch(e) {}
                return null;
            }
            if (__targetProc !== null) {
                var q = String(__targetProc).toLowerCase();
                var procs = [];
                try { procs = system.processes(); } catch(e) { procs = []; }
                for (var i = 0; i < procs.length; i++) {
                    var nm = "", bid = "";
                    try { nm = String(procs[i].name() || "").toLowerCase(); } catch(e) {}
                    try { bid = String(procs[i].bundleIdentifier() || "").toLowerCase(); } catch(e) {}
                    if (nm.indexOf(q) !== -1 || bid.indexOf(q) !== -1) return procs[i];
                }
                return null;
            }
            return system.processes.whose({frontmost: true})[0];
        }

        function resolveWindow(proc) {
            var wins = [];
            try { wins = proc.windows(); } catch(e) { wins = []; }
            if (__targetWin === null) {
                return (wins && wins.length > 0) ? wins[0] : proc;
            }
            if (typeof __targetWin === 'number') {
                return (wins && __targetWin >= 0 && __targetWin < wins.length) ? wins[__targetWin] : null;
            }
            var wq = String(__targetWin).toLowerCase();
            for (var i = 0; i < wins.length; i++) {
                var t = "";
                try { t = String(wins[i].name() || "").toLowerCase(); } catch(e) {}
                if (t.indexOf(wq) !== -1) return wins[i];
            }
            return null;
        }
    `;
}

/**
 * Get the UI tree of the frontmost window (or of a targeted process/window)
 */
export async function getUITree(depth: number = 2, target?: UITarget): Promise<UIElement> {
    const script = `
        var system = Application('System Events');
        ${buildTargetPreamble(target)}
        var process = resolveProcess(system);
        if (!process) {
            JSON.stringify({error: "target_not_found", detail: "No process matched target " + JSON.stringify({process: __targetProc, pid: __targetPid})});
        } else {

        function getProps(element, currentDepth, maxDepth) {
            if (currentDepth > maxDepth) return null;

            var result = { role: "", name: "", description: "", position: [0, 0], size: [0, 0] };
            try { result.role = element.role(); } catch(e) {}
            try { result.name = element.name(); } catch(e) {}
            try { result.description = element.description(); } catch(e) {}
            try { result.position = element.position(); } catch(e) {}
            try { result.size = element.size(); } catch(e) {}

            if (currentDepth < maxDepth) {
                try {
                    var children = element.uiElements();
                    if (children && children.length > 0) {
                        result.children = [];
                        for (var i = 0; i < children.length; i++) {
                            var childSub = getProps(children[i], currentDepth + 1, maxDepth);
                            if (childSub) result.children.push(childSub);
                        }
                    }
                } catch(e) {}
            }
            return result;
        }

        var root = resolveWindow(process);
        if (!root && __targetWin !== null) {
            JSON.stringify({error: "window_not_found", detail: "No window matched selector " + JSON.stringify(__targetWin)});
        } else {
            if (!root) root = process;
            JSON.stringify(getProps(root, 0, ${JSON.stringify(depth)}));
        }
        }
    `;
    const parsed = JSON.parse(runJXA(script));
    if (parsed && parsed.error) {
        throw new Error(parsed.detail || parsed.error);
    }
    return parsed;
}

/**
 * Find an element by criteria
 */
export async function findElement(criteria: string, role?: string, target?: UITarget): Promise<any> {
    const criteriaLit = JSON.stringify(criteria.toLowerCase());
    const roleLit = JSON.stringify(role || '');
    const script = `
        var system = Application('System Events');
        ${buildTargetPreamble(target)}
        var process = resolveProcess(system);
        if (!process) {
            JSON.stringify({error: "target_not_found", detail: "No process matched target " + JSON.stringify({process: __targetProc, pid: __targetPid})});
        } else {
        var foundElement = null;

        function search(element) {
            if (foundElement) return;

            var name = "", desc = "", elRole = "", elTitle = "";
            try { name = element.name() || ""; } catch(e) {}
            try { desc = element.description() || ""; } catch(e) {}
            try { elRole = element.role() || ""; } catch(e) {}
            try { elTitle = String(element.title() || ""); } catch(e) {}

            if (name.toLowerCase().includes(${criteriaLit}) || desc.toLowerCase().includes(${criteriaLit}) || elTitle.toLowerCase().includes(${criteriaLit})) {
                if (${roleLit} === "" || elRole === ${roleLit}) {
                    foundElement = element;
                    return;
                }
            }

            try {
                var children = element.uiElements();
                for (var i = 0; i < children.length; i++) {
                    search(children[i]);
                    if (foundElement) return;
                }
            } catch(e) {}
        }

        var root = resolveWindow(process);
        if (!root && __targetWin !== null) {
            JSON.stringify({error: "window_not_found", detail: "No window matched selector " + JSON.stringify(__targetWin)});
        } else {
        if (!root) root = process;
        if (root) search(root);
        if (!foundElement && root !== process && __targetWin === null) search(process);

        if (foundElement) {
            var elDesc, elValue;
            try { elDesc = foundElement.description(); } catch(e) { elDesc = undefined; }
            try { elValue = foundElement.value(); } catch(e) { elValue = undefined; }
            JSON.stringify({
                found: true,
                position: foundElement.position(),
                size: foundElement.size(),
                name: foundElement.name(),
                role: foundElement.role(),
                description: elDesc,
                value: elValue
            });
        } else {
            JSON.stringify({ found: false });
        }
        }
        }
    `;
    const parsed = JSON.parse(runJXA(script));
    if (parsed && parsed.error) {
        return { found: false, error: parsed.detail || parsed.error };
    }
    return parsed;
}

/**
 * Focus Guard: Captures the active window state to detect interference.
 */
export function getActiveWindowInfo(): { title: string; bundleId: string } | null {
    try {
        const script = `
            var system = Application('System Events');
            var proc = system.processes.whose({frontmost: true})[0];
            JSON.stringify({
                title: proc.windows.length > 0 ? proc.windows[0].name() : "",
                bundleId: proc.bundleIdentifier()
            });
        `;
        return JSON.parse(runJXA(script));
    } catch(e) {
        return null;
    }
}

/**
 * Scan application menus
 */
export async function scanAppMenus(appName?: string): Promise<any> {
    const appNameLit = JSON.stringify(appName || '');
    const script = `
        var targetApp = Application('System Events').processes.whose({frontmost: true})[0];
        if (${appNameLit}) {
            targetApp = Application('System Events').processes[${appNameLit}];
        }
        
        var menuBar = targetApp.menuBars[0];
        var result = {};
        
        function traverse(menuItem, path) {
            try {
                var title = menuItem.title();
                if (!title) return;
                
                var newPath = path ? path + " > " + title : title;
                var submenus = menuItem.menus;
                if (submenus.length > 0) {
                    var subItems = submenus[0].menuItems();
                    for (var i = 0; i < subItems.length; i++) {
                        traverse(subItems[i], newPath);
                    }
                } else {
                    var cmd = "";
                    try { cmd = menuItem.cmdChar(); } catch(e) {}
                    if (title && title.length > 0) {
                        result[title] = { path: newPath, shortcut: cmd };
                    }
                }
            } catch(e) {}
        }
        
        var items = menuBar.menuBarItems();
        for (var i = 0; i < items.length; i++) {
            traverse(items[i], "");
        }
        JSON.stringify(result);
    `;
    return JSON.parse(runJXA(script));
}

/**
 * Trigger a menu command
 */
export async function triggerMenuCommand(menuPath: string, appName?: string): Promise<boolean> {
    const parts = menuPath.split(' > ').map(s => `"${s.trim().replace(/"/g, '\\"')}"`);
    const appNameLit = JSON.stringify(appName || '');
    const script = `
        var targetApp = Application('System Events').processes.whose({frontmost: true})[0];
        if (${appNameLit}) {
            targetApp = Application('System Events').processes[${appNameLit}];
        }
        var menuBar = targetApp.menuBars[0];
        var pathParts = [${parts.join(', ')}];
        
        function clickMenuRecursive(container, remainingPath) {
            if (remainingPath.length === 0) return true;
            var nextName = remainingPath.shift();
            var item;
            if (container.class() === 'menuBar') {
                item = container.menuBarItems[nextName];
            } else {
                item = container.menuItems[nextName];
            }
            if (!item.exists()) return false;
            item.click();
            if (remainingPath.length > 0) {
                return clickMenuRecursive(item.menus[0], remainingPath);
            }
            return true;
        }
        clickMenuRecursive(menuBar, pathParts);
    `;
    runJXA(script);
    return true;
}
