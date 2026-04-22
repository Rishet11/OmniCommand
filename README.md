# OmniCommand (`omx`)

The terminal tool for every format. **OmniCommand** uses natural language terminal syntax to flawlessly convert, compress, and trim documents, images, and videos.

No more memorizing complex FFmpeg flags, ImageMagick syntax, or Pandoc configurations. Just tell it what you want.

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
omx compress photo.png to 800px
```

### 3. Trim Audio & Video
Lossless, lightning-fast media trimming without re-encoding overhead.
```bash
omx trim podcast.mp3 from 0:30 to 1:45
omx trim gameplay.mp4 from 10:00 to 12:30
```

## ⚙️ Features & Engines

OmniCommand routes your files natively based on their format:

* **Video & Audio (`ffmpeg-static`)**: We bundle a statically linked, pinned version of FFmpeg (v6.1.1/5.2.0) directly into the dependency tree. You don't need to install FFmpeg globally on your machine.
* **Images (`sharp`)**: Blazing fast image processing utilizing pre-built Rust/C++ binaries. Fully supports modern formats like `.avif` and `.webp`.
* **Documents (`pdfjs-dist` + `pandoc`)**: Converts PDFs, Docx, and other documents into Markdown or HTML natively. *(Note: Requires a system-level Pandoc installation).*

## 🧠 Scanned PDFs & AI OCR (`--refine`)

Local document conversion tools fail on scanned PDFs out-of-the-box. OmniCommand ships with a Preflight Scanner that detects images or complex two-column layouts inside PDFs before conversion. 

If it detects a scanned document, you can bypass local failures using the `--refine` flag. This securely uploads the document to the Google Gemini 2.5 Flash Vision API to perfectly extract layout, tables, and text natively.

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

## 🛠️ Additional Flags

* `--dry-run`: View the exact FFmpeg or underlying commands that would be executed without touching your files.
* `--quiet`: Suppress CLI output and spinners.
* `--overwrite` or `-y`: Automatically overwrite existing output files.

---

## 📂 Repository Developer Guide

If you are downloading this source code to edit the project, note that it contains two parts:

1. **The CLI tool** is located in the `/cli` folder. To build it locally, run `cd cli && npm install && npm run build`.
2. **The Landing Page (Website)** is located in the root folder. To run the website locally, run `npm install && npm run dev`.
