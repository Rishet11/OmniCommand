# OmniCommand (`omx`)

[![npm version](https://img.shields.io/npm/v/omx-cmd.svg?style=flat-square)](https://www.npmjs.com/package/omx-cmd)
[![license](https://img.shields.io/npm/l/omx-cmd.svg?style=flat-square)](https://github.com/Rishet11/OmniCommand/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/omx-cmd.svg?style=flat-square)](https://nodejs.org)
[![downloads](https://img.shields.io/npm/dw/omx-cmd.svg?style=flat-square)](https://www.npmjs.com/package/omx-cmd)

The terminal tool for every format. **OmniCommand** uses natural language terminal syntax to convert, compress, trim, and extract common document, image, and media workflows — **offline by default**.

No more memorizing complex FFmpeg flags, ImageMagick syntax, or Pandoc configurations. Use plain commands and let the CLI route them.

---

## Why OmniCommand?

| Tool | Scope | Offline | CLI | Natural Language |
|---|---|---|---|---|
| `fluent-ffmpeg` | Video only | ✅ | ❌ (library) | ❌ |
| `sharp` | Images only | ✅ | ❌ (library) | ❌ |
| `pandoc` | Documents only | ✅ | ✅ | ❌ |
| `ai-ffmpeg-cli` | Video only | ❌ | ✅ | ✅ |
| **`omx`** | **All three** | **✅** | **✅** | **✅** |

`fluent-ffmpeg` was archived in May 2025. No npm package unifies document, image, and media conversion under one CLI with plain-language commands, offline. OmniCommand fills that gap.

---

## 🚀 Installation

OmniCommand is published as `omx-cmd` to avoid namespace conflicts, but the executable binds globally as `omx`.

```bash
npm install -g omx-cmd
```

*Requires Node.js >= 20.3.0*

Check that your installation was successful and that all engines are ready:
```bash
omx doctor
```

---

## 💻 Usage

OmniCommand enforces strict "Natural Language" separators (`to`, `from`).

### 1. Convert Anything
Seamlessly convert document formats, video codecs, or image extensions.
```bash
omx convert report.pdf to markdown
omx convert photo.png to webp
omx convert footage.mov to mp4
```

### 2. Compress Media
Intelligently shrinks file sizes using target percentages or fixed sizes.
```bash
omx compress video.mp4 to 50%
omx compress photo.png to 50%    # Auto-converts PNG → WebP for real compression
```

### 3. Trim Audio & Video
Lossless, lightning-fast media trimming without re-encoding overhead.
```bash
omx trim podcast.mp3 from 0:30 to 1:45
omx trim gameplay.mp4 from 10:00 to 12:30
```

### 4. Extract Audio
Pull audio out of a video file as an MP3.
```bash
omx extract audio from video.mp4
```

### 5. Resize Images
Resize an image while preserving its aspect ratio.
```bash
omx resize photo.png to 800px
```

---

## ⚙️ Features & Engines

OmniCommand routes your files natively based on their format:

* **Video & Audio (`ffmpeg-static`)**: FFmpeg ships with the CLI through `ffmpeg-static`, so you do not need a separate global FFmpeg install for the default workflows.
* **Images (`sharp`)**: Blazing fast image processing utilizing pre-built Rust/C++ binaries. Fully supports modern formats like `.avif` and `.webp`.
* **Documents (`pdfjs-dist` + `pandoc`)**: PDFs use local text extraction by default, and non-PDF documents use Pandoc when it is installed locally.

---

## 🧠 Scanned PDFs & AI OCR (`--refine`)

Local document conversion tools struggle on scanned PDFs out-of-the-box. OmniCommand ships with a preflight scanner that detects image-only or complex two-column layouts before conversion.

If it detects a scanned document, you can bypass local limitations using the `--refine` flag. This uploads the document to Gemini for richer extraction when you want that networked path.

**Setup AI Refinement:**
1. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/)
2. Set it in your global config:
```bash
omx config set GEMINI_API_KEY your-api-key-here
```
3. Run the conversion:
```bash
omx convert scanned-report.pdf to markdown --refine
```

---

## 🛠️ Additional Flags

| Flag | Description |
|---|---|
| `--json` | Structured JSON output (no spinners, for scripts/CI) |
| `--dry-run` | Preview what would run without writing files |
| `--quiet` | Suppress CLI output and spinners |
| `--verbose` | Show input/output sizes and compression ratio |
| `--overwrite` | Automatically overwrite existing output files |
| `--no-color` | Disable ANSI colour (also respects `NO_COLOR` env var) |

---

## 📂 Repository Developer Guide

If you are downloading this source code to edit the project, note that it contains two parts:

1. **The CLI tool** is located in the `/cli` folder. To build it locally, run `cd cli && npm install && npm run build`.
2. **The Landing Page (Website)** is located in the root folder. To run the website locally, run `npm install && npm run dev`.

See [CONTRIBUTING.md](./CONTRIBUTING.md) to get started contributing.
