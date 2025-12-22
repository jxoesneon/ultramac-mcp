
use framework "Cocoa"
use scripting additions

tell application "System Events"
    if not (exists process "TextEdit") then return "TextEdit not running"
    
    tell process "TextEdit"
        set frontmost to true
        delay 0.5
        
        if not (exists window 1) then return "No window"
        
        try
            set ta to text area 1 of scroll area 1 of window 1
            
            -- Method 1: Direct "value of attribute" with parameter (rarely works in vanilla AS)
            -- set boundsVal to value of attribute "AXBoundsForRange" of ta given parameter {10, 6}
            
            -- Method 2: System Events might expose it if we are lucky?
            -- Usually requires ASObjC
            
            return "Found text area, but raw AS cannot call parameterized attributes easily without a scripting addition (which we avoid)."
        on error e
            return "Error: " & e
        end try
    end tell
end tell
