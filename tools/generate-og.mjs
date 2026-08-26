// generate-og.mjs
// Renderiza tools/og-template.html como PNG 1200x630 para meta og:image
//   Uso: node tools/generate-og.mjs
// Requiere: playwright (instalado en career-ops/node_modules)

import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.resolve(__dirname, "og-template.html");
const outputPath   = path.resolve(__dirname, "..", "assets", "img", "og-image.png");

console.log("Rendering OG image...");
console.log("  template:", templatePath);
console.log("  output:  ", outputPath);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1.5,  // a bit of retina for sharp text
});
const page = await context.newPage();

await page.goto("file://" + templatePath.replace(/\\/g, "/"), { waitUntil: "networkidle" });
// give Google Fonts a beat to settle
await page.waitForTimeout(800);
await page.screenshot({ path: outputPath, fullPage: false, omitBackground: false });

await browser.close();
console.log("Done.");
