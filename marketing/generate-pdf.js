import puppeteer from "puppeteer-core";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const HTML_PATH = path.join(__dirname, "pitch-deck.html");
const PDF_PATH = path.join(__dirname, "pitch-deck.pdf");

async function generatePdf() {
  console.log("Launching Chrome...");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // Read the HTML file and set it as page content
    const html = fs.readFileSync(HTML_PATH, "utf-8");
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);

    console.log("Generating PDF...");

    await page.pdf({
      path: PDF_PATH,
      format: "A4",
      landscape: true,       // 16:9 slides look best in landscape
      printBackground: true, // Include gradients and backgrounds
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
    });

    console.log(`✅ PDF generated: ${PDF_PATH}`);
  } finally {
    await browser.close();
  }
}

generatePdf().catch((err) => {
  console.error("Failed to generate PDF:", err);
  process.exit(1);
});
