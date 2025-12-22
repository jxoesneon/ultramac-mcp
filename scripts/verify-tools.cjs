const { execSync } = require('child_process');

function runJXA(script) {
    try {
        return execSync('osascript -l JavaScript', { 
            input: script, 
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'ignore'] // ignore stderr to keep output clean
        }).trim();
    } catch (e) {
        return "false";
    }
}

async function waitForWindow(title) {
    process.stdout.write(`Waiting for window "${title}"... `);
    const startTime = Date.now();
    // specific check for Notes to ensure we find it even if partial match
    // Notes usually has window title "Notes" or "Notas"
    while (Date.now() - startTime < 10000) {
        const result = runJXA(`
            var system = Application('System Events');
            var found = false;
            // Iterate all processes to find one with the window
            for (var i=0; i<system.processes.length; i++) {
                var proc = system.processes[i];
                if (proc.visible()) {
                    try {
                        for (var j=0; j<proc.windows.length; j++) {
                            if (proc.windows[j].name().toLowerCase().includes("${title.toLowerCase()}")) {
                                found = true;
                                break;
                            }
                        }
                    } catch(e) {}
                }
                if (found) break;
            }
            found;
        `);
        
        if (result === 'true') {
            console.log("Found!");
            return true;
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    console.log("Timeout.");
    return false;
}

function clickElement(label) {
    process.stdout.write(`Clicking element "${label}"... `);
    
    // JXA Search Logic (Same as in index.ts)
    const jxaScript = `
        var system = Application('System Events');
        var process = system.processes.whose({frontmost: true})[0];
        var foundElement = null;
        
        function search(element) {
            if (foundElement) return;
            var val = (element.value() || "").toString();
            var name = (element.name() || "").toString();
            var desc = (element.description() || "").toString();
            var txt = "${label.replace(/"/g, '\\"')}".toLowerCase();
            
            if (val.toLowerCase().indexOf(txt) !== -1 || 
                name.toLowerCase().indexOf(txt) !== -1 || 
                desc.toLowerCase().indexOf(txt) !== -1) {
                foundElement = element;
                return;
            }
            try {
                var children = element.uiElements();
                if (children) {
                    for (var i = 0; i < children.length; i++) {
                        search(children[i]);
                        if (foundElement) return;
                    }
                }
            } catch(e) {}
        }
        
        // Ensure we search the frontmost app's windows
        if (process && process.windows.length > 0) search(process.windows[0]);
        if (!foundElement && process) search(process); 
        
        if (foundElement) {
            JSON.stringify({
                found: true,
                x: foundElement.position()[0],
                y: foundElement.position()[1],
                w: foundElement.size()[0],
                h: foundElement.size()[1],
                name: foundElement.name()
            });
        } else {
            JSON.stringify({ found: false });
        }
    `;
    
    try {
        const res = runJXA(jxaScript);
        let data;
        try { data = JSON.parse(res); } catch(e) {}
        
        if (!data || !data.found) {
            console.log("Not found.");
            return false;
        }
        
        const x = Math.round(data.x + (data.w / 2));
        const y = Math.round(data.y + (data.h / 2));
        
        // Execute Click
        execSync(`osascript -e 'tell application "System Events" to click at {${x}, ${y}}'`);
        console.log(`Clicked at (${x}, ${y})`);
        return true;
    } catch (e) {
        console.log("Error: " + e.message);
        return false;
    }
}

async function main() {
    console.log("=== Smart Tools Logic Test ===");
    
    // 1. Launch Notes
    console.log("Launching Notes...");
    execSync('open -a Notes');
    
    // 2. Wait for Window (Robustness test)
    // Try "Notas" for Spanish or "Notes" for English
    // We check valid window presence
    let ready = await waitForWindow("Notas");
    if (!ready) ready = await waitForWindow("Notes");
    
    if (!ready) {
        console.error("FAIL: Could not verify Notes window is open.");
        return;
    }
    
    // 3. Click 'Nueva nota' (Composite Tool Logic)
    // We try "Nueva nota" first (Spanish), then "New Note" (English)
    let clicked = clickElement("Nueva nota");
    if (!clicked) clicked = clickElement("New Note");
    
    if (clicked) {
        console.log("\n✅ SUCCESS: Smart interaction logic verified.");
    } else {
        console.log("\n❌ FAIL: Could not find/click 'New Note' button.");
    }
    
    console.log("==============================");
}

main();
