/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { runJXA } from './applescript-service';
import { getSpatialFocus } from './spatial-context';

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
 * Get the UI tree of the frontmost window
 */
export async function getUITree(depth: number = 2): Promise<UIElement> {
    const script = `
        var system = Application('System Events');
        var process = system.processes.whose({frontmost: true})[0];
        
        function getProps(element, currentDepth, maxDepth) {
            if (currentDepth > maxDepth) return null;
            
            var result = {
                role: element.role(),
                name: element.name(),
                description: element.description(),
                position: element.position(),
                size: element.size()
            };
            
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
        
        var window = process.windows[0]; 
        var root = window ? window : process;
        
        JSON.stringify(getProps(root, 0, ${depth}));
    `;
    return JSON.parse(runJXA(script));
}

/**
 * Find an element by criteria
 */
export async function findElement(criteria: string, role?: string): Promise<any> {
    const script = `
        var system = Application('System Events');
        var process = system.processes.whose({frontmost: true})[0];
        var foundElement = null;
        
        function search(element) {
            if (foundElement) return;
            
            var name = element.name() || "";
            var desc = element.description() || "";
            var elRole = element.role() || "";
            
            if (name.toLowerCase().includes("${criteria.toLowerCase()}") || desc.toLowerCase().includes("${criteria.toLowerCase()}")) {
                if (!"${role || ''}" || elRole === "${role}") {
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
        
        var window = process.windows[0];
        if (window) search(window);
        if (!foundElement) search(process);
        
        if (foundElement) {
            JSON.stringify({
                found: true,
                position: foundElement.position(),
                size: foundElement.size(),
                name: foundElement.name(),
                role: foundElement.role()
            });
        } else {
            JSON.stringify({ found: false });
        }
    `;
    return JSON.parse(runJXA(script));
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
    const script = `
        var targetApp = Application('System Events').processes.whose({frontmost: true})[0];
        if ("${appName || ''}") {
            targetApp = Application('System Events').processes["${appName}"];
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
    const script = `
        var targetApp = Application('System Events').processes.whose({frontmost: true})[0];
        if ("${appName || ''}") {
            targetApp = Application('System Events').processes["${appName}"];
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
