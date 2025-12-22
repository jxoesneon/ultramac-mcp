import { execSync } from "child_process";
import Tesseract from "tesseract.js";

console.log("Testing Screencapture + OCR in Bun...");

try {
  // 1. Capture Screen
  const path = "/tmp/bun_test_screen.png";
  execSync(`screencapture -x "${path}"`);
  console.log("Screenshot taken.");

  // 2. OCR
  const result = await Tesseract.recognize(path, 'eng');
  const data = result.data;
  console.log("Keys:", Object.keys(data));
  console.log("Has blocks?", !!data.blocks);
  if (data.blocks) console.log("Blocks length:", data.blocks.length);
  console.log("Has hocr?", !!data.hocr);
  console.log("Has tsv?", !!data.tsv);
  
} catch(e) {
  console.error("Error:", e);
}
