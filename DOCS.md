# OmniCommand Documentation

This document provides a detailed reference for the OmniCommand (`omx`) CLI, its Model Context Protocol (MCP) server, and the programmatic TypeScript API.

---

## 1. CLI Reference

The primary way to use OmniCommand is via the terminal.

### Global Flags
| Flag | Short | Description |
|---|---|---|
| `--json` | | Returns output in JSON format only. Suppresses all human-readable text and spinners. |
| `--quiet` | | Suppresses all progress output and spinners. |
| `--overwrite` | `-y` | Automatically overwrites existing output files without asking. |
| `--dry-run` | | Previews the output paths and underlying commands without executing them. |
| `--verbose` | | Displays input/output file sizes and compression ratios upon completion. |
| `--no-color` | | Disables ANSI color output. Also respects the `NO_COLOR` environment variable. |
| `--refine` | | Enables AI Vision OCR for PDF conversions. Requires a Gemini API Key. |

### Configuration
OmniCommand stores persistent settings in `~/.config/omx/config.json`.

- **Set a value**: `omx config set <KEY> <VALUE>`
- **Get a value**: `omx config get <KEY>`

**Supported Keys:**
- `GEMINI_API_KEY`: Required for the `--refine` flag.

---

## 2. MCP Server

OmniCommand includes an MCP server to allow AI agents (like Claude or ChatGPT) to perform file operations.

### Starting the Server
```bash
npx omx-cmd mcp
# OR
node path/to/dist/mcp.js
```

### Exposed Tools
- **`convert`**: Converts documents, images, or media.
- **`compress`**: Reduces file size via percentage or target size.
- **`trim`**: Trims audio or video between two timestamps.

The server uses `stdio` transport and requires optional dependencies for the SDK. Install with `npm install -g omx-cmd --include=optional`.

---

## 3. Programmatic API (TypeScript)

You can import OmniCommand engines directly into your TypeScript project.

### Installation
```bash
npm install omx-cmd
```

### Usage Example
```typescript
import { processImage, processDocument } from 'omx-cmd';

// Convert an image
const outputPath = await processImage('photo.png', 'webp', {
    actionType: 'convert',
    overwrite: true
});

// Convert a PDF to Markdown using AI
const mdPath = await processDocument('report.pdf', 'md', {
    actionType: 'convert',
    refine: true,
    overwrite: true
});
```

### Exported Functions
- **`processDocument(inputFile, targetFormat, options)`**: Handles PDF extraction and Pandoc conversions.
- **`processImage(inputFile, targetFormat, options)`**: Handles Sharp-based image processing.
- **`processVideo(inputFile, targetFormat, options)`**: Handles FFmpeg-based media processing.
- **`preflightPDF(inputFile, options)`**: Analyzes a PDF to check if it requires `--refine`.

---

## 4. Exit Codes

| Code | Meaning |
|---|---|
| `0` | Success or graceful no-op (e.g., extracting audio from an audio file). |
| `1` | Runtime error (FFmpeg failure, corrupt file, missing dependency). |
| `2` | User input error (invalid syntax, missing arguments). |
