/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { runJXA } from './applescript-service';
import {
    buildTargetPreamble,
    DEFAULT_MAX_DEPTH,
    DEFAULT_NODE_BUDGET,
    type SearchLimits,
    type UITarget,
} from './ui-service';

/**
 * Result of an element_contains_text tree assertion.
 * - found:true  → `matched` holds the element attribute text that contained `text`.
 * - found:false → `searched` holds how many elements were visited in the subtree.
 * - `error` is set when the target process (or parent element) could not be found.
 */
export interface ElementContainsTextResult {
    found: boolean;
    matched?: string;
    searched?: number;
    error?: string;
}

/**
 * Assert that the subtree rooted at the element matching `criteria` contains
 * `text` in some element's name, description, or value (case-insensitive).
 *
 * The JXA first resolves the process/window using the same UITarget semantics
 * as ui-service, finds the parent element by name/description substring (and
 * optional exact role), then depth-first scans that element's uiElements()
 * subtree. Each attribute read is wrapped in try/catch because AX attribute
 * access throws on some elements.
 */
export async function elementContainsText(
    criteria: string,
    text: string,
    role?: string,
    target?: UITarget,
    limits?: SearchLimits
): Promise<ElementContainsTextResult> {
    const maxDepth = limits?.maxDepth ?? DEFAULT_MAX_DEPTH;
    const budget = limits?.budget ?? DEFAULT_NODE_BUDGET;
    const criteriaLit = JSON.stringify(criteria.toLowerCase());
    const textLit = JSON.stringify(text.toLowerCase());
    const roleLit = JSON.stringify(role || '');
    const script = `
        var system = Application('System Events');
        ${buildTargetPreamble(target)}
        var process = resolveProcess(system);
        if (!process) {
            JSON.stringify({error: "target_not_found", detail: "No process matched target " + JSON.stringify({process: __targetProc, pid: __targetPid})});
        } else {
        var parentElement = null;
        var __visited = 0;
        var __budget = ${JSON.stringify(budget)};
        var __maxDepth = ${JSON.stringify(maxDepth)};
        var __budgetExceeded = false;

        function findParent(element, depth) {
            if (parentElement || __budgetExceeded) return;
            if (depth > __maxDepth) return;
            __visited += 1;
            if (__visited > __budget) { __budgetExceeded = true; return; }

            var elRole = "";
            try { elRole = element.role() || ""; } catch(e) {}
            var roleOk = (${roleLit} === "" || elRole === ${roleLit});
            var name = "", desc = "", elTitle = "";
            if (roleOk) {
                try { name = element.name() || ""; } catch(e) {}
                try { desc = element.description() || ""; } catch(e) {}
                try { elTitle = String(element.title() || ""); } catch(e) {}
            }

            if (roleOk && (name.toLowerCase().includes(${criteriaLit}) || desc.toLowerCase().includes(${criteriaLit}) || elTitle.toLowerCase().includes(${criteriaLit}))) {
                parentElement = element;
                return;
            }

            try {
                var children = element.uiElements();
                for (var i = 0; i < children.length; i++) {
                    findParent(children[i], depth + 1);
                    if (parentElement || __budgetExceeded) return;
                }
            } catch(e) {}
        }

        var root = resolveWindow(process);
        if (!root && __targetWin !== null) {
            JSON.stringify({error: "window_not_found", detail: "No window matched selector " + JSON.stringify(__targetWin)});
        } else {
        if (!root) root = process;
        if (root) findParent(root, 0);
        if (!parentElement && !__budgetExceeded && root !== process && __targetWin === null) findParent(process, 0);

        if (__budgetExceeded && !parentElement) {
            JSON.stringify({found: false, error: "node budget exceeded", searched: __visited});
        } else if (!parentElement) {
            JSON.stringify({found: false, error: "element_not_found", searched: 0});
        } else {
            var searched = 0;
            var matched = null;

            function scan(element, depth) {
                if (matched !== null || __budgetExceeded) return;
                if (depth > __maxDepth) return;
                searched += 1;
                __visited += 1;
                if (__visited > __budget) { __budgetExceeded = true; return; }

                var attrs = [];
                var v;
                try { v = element.name();        if (v !== null && v !== undefined) attrs.push(String(v)); } catch(e) {}
                try { v = element.description(); if (v !== null && v !== undefined) attrs.push(String(v)); } catch(e) {}
                try { v = element.value();       if (v !== null && v !== undefined) attrs.push(String(v)); } catch(e) {}

                for (var i = 0; i < attrs.length; i++) {
                    if (attrs[i].toLowerCase().includes(${textLit})) {
                        matched = attrs[i];
                        return;
                    }
                }

                var children = [];
                try { children = element.uiElements() || []; } catch(e) { children = []; }
                for (var i = 0; i < children.length; i++) {
                    scan(children[i], depth + 1);
                    if (matched !== null || __budgetExceeded) return;
                }
            }

            scan(parentElement, 0);

            if (matched !== null) {
                JSON.stringify({found: true, matched: matched});
            } else {
                JSON.stringify({found: false, searched: searched});
            }
        }
        }
        }
    `;
    let parsed: any;
    try {
        parsed = JSON.parse(await runJXA(script, { timeoutMs: limits?.timeoutMs }));
    } catch (err: any) {
        return { found: false, error: err?.message ?? String(err) };
    }
    if (parsed && parsed.error) {
        return { found: false, error: parsed.detail || parsed.error };
    }
    return parsed;
}
