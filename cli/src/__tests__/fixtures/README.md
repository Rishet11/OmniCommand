# Test Fixtures

Reproducible test fixtures for OmniCommand CLI testing.

## Quick Start

Regenerate all fixtures at once:

```bash
node generate.mjs
```

## Fixture Overview

### Text & Markup
- `unicode.txt` - Plain text with international characters, currency, emoji, math symbols
- `unicode.md` - Markdown version of unicode.txt
- `empty.txt` - Zero-byte file for null cases
- `*.html` - HTML source documents used for PDF conversion testing

### Documents
- `unicode.docx` - Microsoft Word document generated from markdown
- `docx_with_image.docx` - DOCX with embedded 32x32 PNG image

### PDFs
- `unicode.pdf` - Chrome-printed PDF from unicode.html (175 KB)
- `twocolumn.pdf` - Multi-column CSS layout rendered as PDF (127 KB)
- `table.pdf` - Styled table rendered as PDF (68 KB)
- `corrupt.pdf` - Truncated PDF (500 bytes) for corruption testing

### Assets
- `__tiny.png` - Minimal 32x32 test image

## Unicode Character Coverage

All fixtures include comprehensive unicode test data:

- Accents: café, naïve, São Paulo
- Currencies: ₹ € ¥ $
- Emoji: 😀 🚀 ❤️
- Scripts: Hindi (नमस्ते), Chinese (你好), Arabic (مرحبا)
- Math: ∑ ∫ √ ∞ ≠ ≤
- Typography: Smart quotes, em dashes, ligatures

## Generation Details

| Fixture | Method | Tool | Size |
|---------|--------|------|------|
| unicode.txt | Direct | N/A | 316 B |
| unicode.md | Direct | N/A | 422 B |
| unicode.html | Direct | N/A | 1.9 K |
| twocolumn.html | Direct | N/A | 1.4 K |
| table.html | Direct | N/A | 1.1 K |
| unicode.docx | Conversion | pandoc | 10.6 K |
| docx_with_image.docx | Conversion | pandoc | 11.1 K |
| unicode.pdf | Print | Chrome | 171 K |
| twocolumn.pdf | Print | Chrome | 124.5 K |
| table.pdf | Print | Chrome | 66.4 K |
| corrupt.pdf | Truncation | binary | 500 B |
| __tiny.png | Generation | sharp | 124 B |

**Total: 398 KB (well within limits)**

## Skipped Fixtures

- `encrypted.pdf` - Requires qpdf (not available); `corrupt.pdf` serves as malformed file test

## Design Notes

1. **Reproducibility**: `generate.mjs` re-runs idempotently. All fixtures are regenerated from source.

2. **Small footprint**: Total 398 KB across 13 fixtures. PDFs use Chrome's efficient printing.

3. **Comprehensive coverage**:
   - Multiple document formats (TXT, MD, HTML, DOCX, PDF)
   - Various layouts (tables, multi-column, styled text)
   - Rich unicode spanning Latin, Cyrillic, Devanagari, CJK, Arabic, emoji, symbols
   - Edge cases (empty file, corrupted PDF)

4. **Format diversity**: Tests can exercise different code paths for text extraction, rendering, conversion, and error handling.

5. **Multi-script support**: Chinese (simplified), Hindi (Devanagari), Arabic (RTL) ensure proper font/layout handling in output formats.
