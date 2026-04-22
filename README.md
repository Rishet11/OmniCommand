# OmniCommand (`omx`) — Monorepo

Welcome to the OmniCommand repository. This project contains both the **OmniCommand Command Line Interface** and its **Official Web Landing Page**.

## 📂 Repository Structure

Because this project contains two separate applications, it is structured as a "monorepo":

* **`/cli`** — This folder contains the actual Node.js CLI tool (`omx-cmd`). This is what gets published to NPM.
* **`/` (Root)** — The root folder contains the React/Vite landing page (the website).

---

## 💻 1. The CLI Tool (`/cli`)

The OmniCommand CLI uses natural language syntax to convert, compress, and trim files using FFmpeg, Sharp, and Pandoc under the hood (plus AI Vision OCR for scanned layout extraction).

**To build and test the CLI locally:**
```bash
cd cli
npm install
npm run build

# Test the local build:
node dist/index.js convert test.pdf to markdown
```

**To publish to npm:**
```bash
cd cli
npm publish
```
*(Note: NPM uses the `README.md` located inside the `/cli` folder to generate the npmjs.com page).*

---

## 🌐 2. The Landing Page (Root)

The landing page is a React/Vite application styled with Tailwind CSS, featuring a fully interactive mock terminal that demonstrates exactly how the CLI functions.

**To run the website locally:**
```bash
npm install
npm run dev
```

**To build the website for production deployment (e.g., Vercel, Netlify):**
```bash
npm run build
```
