# OmniCommand (`omx`)

Published on npm as `omx-cmd`; installed binary is `omx`.

```bash
npm install -g omx-cmd
omx doctor
```

## Usage

```bash
omx convert report.pdf to markdown
omx convert photo.png to webp
omx compress video.mp4 to 50%
omx compress photo.png to 50%
omx trim podcast.mp3 from 0:30 to 1:45
omx extract audio from recording.mp4
omx resize photo.png to 800px
```

## Batch

```bash
omx compress *.png to 80% --dry-run
omx convert ./docs/*.pdf to markdown --json
omx resize image-1.jpg image-2.jpg to 1200px
```

Batch jobs continue after individual failures and summarize the result. With `--json`, stdout is one parseable JSON object with `results` and `summary`.

## Optional Features

Standard conversions are local-first and free. Gemini OCR and MCP support are lazy-loaded optional dependencies:

```bash
npm install -g omx-cmd --include=optional
omx config set GEMINI_API_KEY your-api-key-here
omx convert scanned.pdf to markdown --refine
```

## Completions

```bash
omx completion bash
omx completion zsh
omx completion fish
```

## Development

```bash
npm install
npm run build
npm test
```

The repository root contains the landing/demo website. It is not a hosted converter UI.
