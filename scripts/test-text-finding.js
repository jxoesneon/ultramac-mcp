
ObjC.import('Cocoa');
ObjC.import('SystemConfiguration');

function run(argv) {
    try {
        var system = Application('System Events');
        var app = system.processes['TextEdit'];
        
        if (!app.exists()) {
             return "TextEdit is not running";
        }
        
        app.frontmost = true;
        delay(0.5);
        
        var win = app.windows[0];
        if (!win.exists()) return "No window";
        
        // TextEdit typically has scroll area -> text area
        var textArea = win.scrollAreas[0].textAreas[0];
        if (!textArea.exists()) return "No text area";
        
        var val = textArea.value();
        var target = "cannot";
        var idx = val.indexOf(target);
        
        if (idx === -1) return "Text not found";
        
        return JSON.stringify({
            found: true,
            index: idx,
            textLength: val.length,
            targetLength: target.length,
            textAreaPos: textArea.position(),
            textAreaSize: textArea.size(),
            // Try to access attributes
            attributes: textArea.attributes().map(function(a) { return a.name(); })
        });
    } catch (e) {
        return "Error: " + e.message;
    }
}
