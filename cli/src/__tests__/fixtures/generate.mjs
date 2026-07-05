#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Canonical unicode text
const UNICODE_TEXT = `accented: café naïve São Paulo | currency: ₹1,500 €20 ¥300 $5 | emoji: 😀 🚀 ❤️ | hindi: नमस्ते दुनिया | chinese: 你好世界 | arabic: مرحبا بالعالم | math: ∑ ∫ √ ∞ ≠ ≤ | ligature words: office floor affluent | quotes: "smart" 'quotes' and – dashes`;

function log(msg) {
  console.log(`[fixtures] ${msg}`);
}

function error(msg) {
  console.error(`[fixtures] ERROR: ${msg}`);
}

// Generate unicode.txt
function generateUnicodeTxt() {
  const content = UNICODE_TEXT;
  fs.writeFileSync(path.join(__dirname, 'unicode.txt'), content, 'utf8');
  log(`Created unicode.txt (${content.length} bytes)`);
}

// Generate unicode.md
function generateUnicodeMd() {
  const content = `# Unicode Test

${UNICODE_TEXT}

This markdown file contains various unicode characters for testing document conversion.
`;
  fs.writeFileSync(path.join(__dirname, 'unicode.md'), content, 'utf8');
  log(`Created unicode.md (${content.length} bytes)`);
}

// Generate unicode.html with two-column section and table
function generateUnicodeHtml() {
  const content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Unicode Test</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 20px;
      line-height: 1.6;
    }
    h1 {
      color: #333;
    }
    .two-column {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin: 20px 0;
      padding: 10px;
      border: 1px solid #ddd;
    }
    .column {
      padding: 10px;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #999;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h1>Unicode Test Document</h1>
  <p>${UNICODE_TEXT}</p>

  <h2>Two-Column Section</h2>
  <div class="two-column">
    <div class="column">
      <h3>Left Column</h3>
      <p>This is the left column with unicode: नमस्ते दुनिया</p>
    </div>
    <div class="column">
      <h3>Right Column</h3>
      <p>This is the right column with unicode: مرحبا بالعالم</p>
    </div>
  </div>

  <h2>Sample Table</h2>
  <table>
    <tr>
      <th>English</th>
      <th>Hindi</th>
      <th>Chinese</th>
    </tr>
    <tr>
      <td>Hello</td>
      <td>नमस्ते</td>
      <td>你好</td>
    </tr>
    <tr>
      <td>World</td>
      <td>दुनिया</td>
      <td>世界</td>
    </tr>
    <tr>
      <td>Thanks</td>
      <td>धन्यवाद</td>
      <td>谢谢</td>
    </tr>
  </table>
</body>
</html>
`;
  fs.writeFileSync(path.join(__dirname, 'unicode.html'), content, 'utf8');
  log(`Created unicode.html (${content.length} bytes)`);
}

// Generate two-column HTML variant
function generateTwocolumnHtml() {
  const content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Two Column Layout</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 40px;
      column-count: 2;
      column-gap: 40px;
      line-height: 1.8;
    }
    h1 {
      column-span: all;
      color: #333;
    }
    p {
      margin: 0 0 15px 0;
    }
  </style>
</head>
<body>
  <h1>Two-Column Text Layout</h1>
  <p>${UNICODE_TEXT}</p>
  <p>This paragraph demonstrates a two-column layout that flows across columns. The text includes accented characters like café and naïve, currency symbols like ₹ € ¥ $, and emoji like 😀 🚀 ❤️.</p>
  <p>Non-Latin scripts include Hindi (नमस्ते दुनिया), Chinese (你好世界), and Arabic (مرحبا بالعالم).</p>
  <p>Mathematical symbols: ∑ ∫ √ ∞ ≠ ≤ are used in scientific documents.</p>
  <p>Ligature words like office, floor, and affluent show advanced typography.</p>
  <p>Smart quotes "like this" and dashes – should render correctly in PDF output.</p>
</body>
</html>
`;
  fs.writeFileSync(path.join(__dirname, 'twocolumn.html'), content, 'utf8');
  log(`Created twocolumn.html (${content.length} bytes)`);
}

// Generate table HTML variant
function generateTableHtml() {
  const content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Table Test</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 40px;
    }
    h1 {
      color: #333;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin-top: 20px;
    }
    th {
      background-color: #333;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: bold;
    }
    td {
      border: 1px solid #ddd;
      padding: 10px;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
  </style>
</head>
<body>
  <h1>3x3 Table Test</h1>
  <table>
    <thead>
      <tr>
        <th>English</th>
        <th>Hindi</th>
        <th>Chinese</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Hello</td>
        <td>नमस्ते</td>
        <td>你好</td>
      </tr>
      <tr>
        <td>World</td>
        <td>दुनिया</td>
        <td>世界</td>
      </tr>
      <tr>
        <td>Thanks</td>
        <td>धन्यवाद</td>
        <td>谢谢</td>
      </tr>
    </tbody>
  </table>
</body>
</html>
`;
  fs.writeFileSync(path.join(__dirname, 'table.html'), content, 'utf8');
  log(`Created table.html (${content.length} bytes)`);
}

// Generate a tiny PNG for embedding in docx
async function generateTinyPng() {
  try {
    const sharp = (await import('sharp')).default;
    const pngPath = path.join(__dirname, '__tiny.png');

    // Create a 32x32 red square with a gradient
    await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: { r: 200, g: 50, b: 50 }
      }
    })
      .png()
      .toFile(pngPath);

    const stats = fs.statSync(pngPath);
    log(`Created __tiny.png (${stats.size} bytes)`);
    return pngPath;
  } catch (err) {
    error(`Could not generate PNG with sharp: ${err.message}`);
    return null;
  }
}

// Generate unicode.docx via pandoc
function generateUnicodeDocx() {
  const mdPath = path.join(__dirname, 'unicode.md');
  const docxPath = path.join(__dirname, 'unicode.docx');

  try {
    execSync(`pandoc "${mdPath}" -o "${docxPath}"`, { stdio: 'pipe' });
    const stats = fs.statSync(docxPath);
    log(`Created unicode.docx (${stats.size} bytes) via pandoc`);
    return true;
  } catch (err) {
    error(`Could not generate unicode.docx: ${err.message}`);
    return false;
  }
}

// Generate docx_with_image.docx
function generateDocxWithImage(pngPath) {
  if (!pngPath) {
    log(`Skipped docx_with_image.docx (no PNG available)`);
    return false;
  }

  const mdPath = path.join(__dirname, 'image_embed.md');
  const docxPath = path.join(__dirname, 'docx_with_image.docx');

  // Create markdown with embedded image
  const mdContent = `# Image Test

Here is a tiny test image:

![test](__tiny.png)

With unicode: ${UNICODE_TEXT}
`;

  try {
    fs.writeFileSync(mdPath, mdContent, 'utf8');
    execSync(`pandoc "${mdPath}" -o "${docxPath}"`, {
      cwd: __dirname,
      stdio: 'pipe'
    });
    const stats = fs.statSync(docxPath);
    log(`Created docx_with_image.docx (${stats.size} bytes) via pandoc`);
    fs.unlinkSync(mdPath); // clean up temp md
    return true;
  } catch (err) {
    error(`Could not generate docx_with_image.docx: ${err.message}`);
    if (fs.existsSync(mdPath)) fs.unlinkSync(mdPath);
    return false;
  }
}

// Generate unicode.pdf via Chrome headless
function generatePdfViaChrome() {
  const htmlPath = path.join(__dirname, 'unicode.html');
  const pdfPath = path.join(__dirname, 'unicode.pdf');

  // Try Chrome first
  const chromeApp = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

  if (fs.existsSync(chromeApp)) {
    try {
      execSync(
        `"${chromeApp}" --headless --disable-gpu --print-to-pdf="${pdfPath}" "${htmlPath}"`,
        { stdio: 'pipe', timeout: 30000 }
      );
      const stats = fs.statSync(pdfPath);
      log(`Created unicode.pdf (${stats.size} bytes) via Chrome headless`);
      return true;
    } catch (err) {
      error(`Chrome PDF generation failed: ${err.message}`);
    }
  } else {
    log(`Chrome not found at ${chromeApp}`);
  }

  // Fallback to pandoc with xelatex
  try {
    execSync(`pandoc "${htmlPath}" -o "${pdfPath}" -t pdf`, { stdio: 'pipe' });
    const stats = fs.statSync(pdfPath);
    log(`Created unicode.pdf (${stats.size} bytes) via pandoc (xelatex)`);
    return true;
  } catch (err) {
    error(`Pandoc PDF generation failed: ${err.message}`);
  }

  return false;
}

// Generate twocolumn.pdf
function generateTwocolumnPdf() {
  const htmlPath = path.join(__dirname, 'twocolumn.html');
  const pdfPath = path.join(__dirname, 'twocolumn.pdf');

  const chromeApp = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

  if (fs.existsSync(chromeApp)) {
    try {
      execSync(
        `"${chromeApp}" --headless --disable-gpu --print-to-pdf="${pdfPath}" "${htmlPath}"`,
        { stdio: 'pipe', timeout: 30000 }
      );
      const stats = fs.statSync(pdfPath);
      log(`Created twocolumn.pdf (${stats.size} bytes) via Chrome headless`);
      return true;
    } catch (err) {
      error(`Chrome twocolumn PDF failed: ${err.message}`);
    }
  }

  try {
    execSync(`pandoc "${htmlPath}" -o "${pdfPath}" -t pdf`, { stdio: 'pipe' });
    const stats = fs.statSync(pdfPath);
    log(`Created twocolumn.pdf (${stats.size} bytes) via pandoc`);
    return true;
  } catch (err) {
    error(`Could not generate twocolumn.pdf: ${err.message}`);
  }

  return false;
}

// Generate table.pdf
function generateTablePdf() {
  const htmlPath = path.join(__dirname, 'table.html');
  const pdfPath = path.join(__dirname, 'table.pdf');

  const chromeApp = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

  if (fs.existsSync(chromeApp)) {
    try {
      execSync(
        `"${chromeApp}" --headless --disable-gpu --print-to-pdf="${pdfPath}" "${htmlPath}"`,
        { stdio: 'pipe', timeout: 30000 }
      );
      const stats = fs.statSync(pdfPath);
      log(`Created table.pdf (${stats.size} bytes) via Chrome headless`);
      return true;
    } catch (err) {
      error(`Chrome table PDF failed: ${err.message}`);
    }
  }

  try {
    execSync(`pandoc "${htmlPath}" -o "${pdfPath}" -t pdf`, { stdio: 'pipe' });
    const stats = fs.statSync(pdfPath);
    log(`Created table.pdf (${stats.size} bytes) via pandoc`);
    return true;
  } catch (err) {
    error(`Could not generate table.pdf: ${err.message}`);
  }

  return false;
}

// Create corrupt.pdf by truncating unicode.pdf
function createCorruptPdf() {
  const sourcePath = path.join(__dirname, 'unicode.pdf');
  const destPath = path.join(__dirname, 'corrupt.pdf');

  if (!fs.existsSync(sourcePath)) {
    log(`Skipped corrupt.pdf (unicode.pdf not available)`);
    return false;
  }

  try {
    const buffer = fs.readFileSync(sourcePath);
    const truncated = buffer.subarray(0, Math.min(500, buffer.length));
    fs.writeFileSync(destPath, truncated);
    log(`Created corrupt.pdf (${truncated.length} bytes, truncated from ${buffer.length})`);
    return true;
  } catch (err) {
    error(`Could not create corrupt.pdf: ${err.message}`);
    return false;
  }
}

// Create empty.txt
function createEmptyTxt() {
  const path1 = path.join(__dirname, 'empty.txt');
  fs.writeFileSync(path1, '');
  log(`Created empty.txt (0 bytes)`);
}

// Create encrypted.pdf if qpdf is available
function createEncryptedPdf() {
  const sourcePath = path.join(__dirname, 'unicode.pdf');
  const destPath = path.join(__dirname, 'encrypted.pdf');

  if (!fs.existsSync(sourcePath)) {
    log(`Skipped encrypted.pdf (unicode.pdf not available)`);
    return false;
  }

  try {
    // Check if qpdf is available
    execSync('which qpdf', { stdio: 'pipe' });
  } catch (err) {
    log(`Skipped encrypted.pdf (qpdf not available)`);
    return false;
  }

  try {
    execSync(
      `qpdf --encrypt "" "test123" 256 -- "${sourcePath}" "${destPath}"`,
      { stdio: 'pipe' }
    );
    const stats = fs.statSync(destPath);
    log(`Created encrypted.pdf (${stats.size} bytes, password: "test123")`);
    return true;
  } catch (err) {
    error(`Could not create encrypted.pdf: ${err.message}`);
    return false;
  }
}

// Verify fixtures
function verifyFixtures() {
  const fixtures = [
    'unicode.txt',
    'unicode.md',
    'unicode.html',
    'twocolumn.html',
    'table.html',
    'unicode.docx',
    'docx_with_image.docx',
    'unicode.pdf',
    'twocolumn.pdf',
    'table.pdf',
    'corrupt.pdf',
    'empty.txt',
    'encrypted.pdf'
  ];

  log('\n=== Fixture Verification ===');
  let totalSize = 0;

  for (const fixture of fixtures) {
    const filePath = path.join(__dirname, fixture);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      totalSize += stats.size;

      // Extra checks for PDFs
      if (fixture.endsWith('.pdf')) {
        const content = fs.readFileSync(filePath);
        const hasPdfHeader = content.toString('utf8', 0, 4) === '%PDF';
        const status = hasPdfHeader && content.length > 500 ? '✓' : '✗';
        log(`${status} ${fixture}: ${stats.size} bytes`);
      }
      // Extra checks for docx
      else if (fixture.endsWith('.docx')) {
        const valid = stats.size > 1000;
        const status = valid ? '✓' : '✗';
        log(`${status} ${fixture}: ${stats.size} bytes`);
      }
      // Text files
      else if (fixture.endsWith('.txt') || fixture.endsWith('.md') || fixture.endsWith('.html')) {
        log(`✓ ${fixture}: ${stats.size} bytes`);
      }
    } else {
      log(`✗ ${fixture}: NOT CREATED`);
    }
  }

  log(`\nTotal size: ${totalSize} bytes (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
}

// Main
async function main() {
  log('Starting fixture generation...\n');

  try {
    generateUnicodeTxt();
    generateUnicodeMd();
    generateUnicodeHtml();
    generateTwocolumnHtml();
    generateTableHtml();

    const pngPath = await generateTinyPng();

    generateUnicodeDocx();
    generateDocxWithImage(pngPath);

    generatePdfViaChrome();
    generateTwocolumnPdf();
    generateTablePdf();

    createCorruptPdf();
    createEmptyTxt();
    createEncryptedPdf();

    verifyFixtures();

    log('\nFixture generation complete!');
  } catch (err) {
    error(`Fatal error: ${err.message}`);
    process.exit(1);
  }
}

main();
