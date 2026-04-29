# OmniCommand Agent Reference

This file is machine-readable documentation for LLMs, AI agents, and MCP clients consuming `omx-cmd`.

---

## Binary

```
omx
```

Installed globally via:
```bash
npm install -g omx-cmd
```

Requires Node.js ≥ 20.3.0.

---

## Commands

### `omx convert <file...> to <format>`
Convert a file between formats.

```bash
omx convert report.pdf to markdown
omx convert photo.png to webp
omx convert footage.mov to mp4
```

Supported input → output format pairs by engine:

| Engine | Input Formats | Output Formats |
|---|---|---|
| Sharp (images) | jpg, jpeg, png, webp, avif, gif, tiff, bmp, ico | jpg, png, webp, avif, gif |
| FFmpeg (video/audio) | mp4, mov, avi, mkv, webm, flv, 3gp, mp3, wav, aac, flac, m4a, ogg, opus | Any FFmpeg-supported format |
| pdfjs-dist (documents) | pdf | md, txt |
| Pandoc (documents) | docx, doc, pptx, xlsx, rtf, txt, md | Any Pandoc-supported format |

Additional option: `--refine` uploads to Gemini Vision OCR for scanned PDFs.

---

### `omx compress <file...> to <target>`
Reduce file size.

```bash
omx compress video.mp4 to 50%
omx compress photo.png to 50%
omx compress archive.pdf to 200kb
```

Target formats:
- `50%` — percentage (quality scaled proportionally)
- `200kb` / `1.5mb` — absolute target size (best-effort)

> **Note:** PNG compression automatically routes to WebP output, which can reduce size by 90%+. PNG is a lossless format and cannot be meaningfully re-compressed as PNG.

---

### `omx trim <file...> from <start> to <end>`
Trim video or audio between timestamps.

```bash
omx trim podcast.mp3 from 0:30 to 1:45
omx trim gameplay.mp4 from 10:00 to 12:30
```

Timestamp format: `HH:MM:SS` or `M:SS`. Uses FFmpeg seek (lossless where possible).

---

### `omx extract audio from <file...>`
Extract audio track from a video file as MP3.

```bash
omx extract audio from recording.mp4
```

> Does not work on audio-only inputs (will warn and exit 0).

---

### `omx resize <file...> to <size>`
Resize an image while preserving aspect ratio.

```bash
omx resize photo.png to 800px
omx resize banner.jpg to 1920px
```

Uses `fit: 'inside'` — never upscales, never distorts.

---

## Batch Operations

Commands accept multiple files before `to` or `from`.

```bash
omx compress *.png to 80% --dry-run
omx convert ./docs/*.pdf to markdown --json
omx resize image-1.jpg image-2.jpg to 1200px
```

Batch jobs continue after per-file failures. Human output ends with a summary. JSON batch output is one object with `results` and `summary`.

---

### `omx doctor`
Verify system dependencies and engine availability.

```bash
omx doctor
```

Checks: Node.js version, ffmpeg-static binary, sharp module, pandoc on PATH, Gemini API key.

Exit code `0` if all critical checks pass (Pandoc and Gemini are optional).

---

### `omx config get <KEY>`
Retrieve a stored configuration value.

```bash
omx config get GEMINI_API_KEY
```

Exits `0` and prints the value to stdout. Exits `1` if the key is not set.

---

### `omx config set <KEY> <VALUE>`
Store a configuration value persistently.

```bash
omx config set GEMINI_API_KEY your-api-key-here
```

Config is stored at `~/.config/omx/config.json` with `0600` permissions.

---

### `omx completion <shell>`
Print shell completions for `bash`, `zsh`, or `fish`.

```bash
omx completion bash
omx completion zsh
omx completion fish
```

---

## Global Flags

All flags work with every command.

| Flag | Short | Effect |
|---|---|---|
| `--json` | | JSON-only stdout. No spinners, no warnings, no extra text. Errors also emit JSON. |
| `--quiet` | | Suppress all progress output (spinner, analysis messages). |
| `--overwrite` | `-y` | Allow overwriting existing output files (default: errors if output exists). |
| `--dry-run` | | Show what would run without executing. With `--json`, outputs JSON preview. |
| `--verbose` | | Show input/output sizes and compression ratio after completion. |
| `--no-color` | | Disable ANSI color codes. Also respects `NO_COLOR` environment variable. |
| `--refine` | | (convert only) Use Gemini Vision OCR for AI-enhanced extraction. |

---

## JSON Output Schema

When `--json` is set, stdout is **only** the JSON object — no prefix, no suffix.

### Success
```json
{
  "success": true,
  "inputFile": "/path/to/input.png",
  "outputPath": "/path/to/input_compress.webp",
  "action": "compress"
}
```

### Error
```json
{
  "success": false,
  "error": "File not found: /path/to/input.png"
}
```

### Dry-run
```json
{
  "success": true,
  "dryRun": true,
  "inputFile": "/path/to/input.png",
  "outputPath": "/path/to/input_compress.webp",
  "action": "compress"
}
```

### Batch
```json
{
  "success": false,
  "action": "compress",
  "results": [
    {
      "inputFile": "/path/to/a.png",
      "outputPath": "/path/to/a_compress.webp",
      "success": true
    },
    {
      "inputFile": "/path/to/missing.png",
      "success": false,
      "error": "File not found: /path/to/missing.png"
    }
  ],
  "summary": {
    "total": 2,
    "succeeded": 1,
    "failed": 1,
    "skipped": 0
  }
}
```

---

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | Success (or graceful no-op: audio-from-audio, no-args) |
| `1` | Runtime error (file corrupt, FFmpeg failure, API error, dependency missing) |
| `2` | User input error (wrong separator syntax, unsupported format, missing argument) |

---

## Output File Naming Convention

Output files are written next to the input file with a suffix indicating the action:

| Action | Suffix |
|---|---|
| convert | `_convert` |
| compress | `_compress` |
| trim | `_trim` |
| extract | `_extract` |
| resize | `_resize` |

Example: `photo.png` → `omx compress photo.png to 50%` → `photo_compress.webp`

---

## MCP Server

OmniCommand ships an MCP (Model Context Protocol) server for agentic tool integration.

**Start server:**
```bash
node /path/to/omx-cmd/dist/mcp.js
```

**Transport:** stdio

Gemini OCR and the MCP SDK are optional/lazy-loaded. Standard CLI conversion does not require them. If optional dependencies were omitted, install with `npm install -g omx-cmd --include=optional`.

**Tools exposed:**
- `convert` — convert between formats
- `compress` — reduce file size
- `trim` — trim video/audio by timestamp

Each tool accepts `inputFile`, `targetFormat` (or `targetAmount`/`startTime`+`endTime`), and optional `refine` flag.

---

## Configuration

| Key | Description | Required |
|---|---|---|
| `GEMINI_API_KEY` | Gemini API key for `--refine` (AI OCR) | Optional |

Set with: `omx config set GEMINI_API_KEY sk-...`
Or via environment variable: `GEMINI_API_KEY=sk-... omx convert doc.pdf to md --refine`
