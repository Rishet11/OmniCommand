# Contributing to OmniCommand

Thanks for your interest in OmniCommand! This document covers everything you need to contribute.

---

## Development Setup

### Prerequisites
- Node.js ≥ 20.3.0 (use `nvm install 22 && nvm use 22`)
- Git

### Clone and build
```bash
git clone https://github.com/Rishet11/OmniCommand.git
cd OmniCommand/cli
npm install
npm run build
node dist/index.js doctor
```

The `doctor` command will tell you which optional dependencies (Pandoc) are missing.

---

## Running Tests

```bash
cd cli

# Run once
npm test

# Watch mode (re-runs on file change)
npm run test:watch
```

All 20 tests should pass. If any fail before your change, that's a bug — please open an issue.

---

## Project Structure

```
OmniCommand/
├── cli/                   # npm package (omx-cmd)
│   ├── src/
│   │   ├── index.ts       # CLI entry point (Commander.js commands)
│   │   ├── mcp.ts         # MCP server for agentic integration
│   │   ├── engines/
│   │   │   ├── image.ts   # Sharp image processing
│   │   │   ├── video.ts   # FFmpeg video/audio
│   │   │   └── document.ts # PDF + Pandoc + Gemini
│   │   ├── utils/
│   │   │   └── config.ts  # ~/.config/omx/config.json storage
│   │   └── __tests__/     # Vitest test suite
│   └── package.json
└── src/                   # Landing page (React/Vite)
```

---

## Making Changes

1. **Create a branch**: `git checkout -b feat/my-feature`
2. **Make changes** in `cli/src/`
3. **Build**: `npm run build` (runs TypeScript compiler)
4. **Test**: `npm test` (must pass all 20 tests)
5. **Submit a PR** — include a description of what changed and why

---

## Code Style

- **TypeScript strict mode** (`"strict": true`) — no type suppressions without justification
- **ESM** (`"type": "module"`) — use `import`/`export`, not `require()`
- **No `any` without comment** — prefer typed interfaces
- **Error messages must be actionable** — include both "what went wrong" and "what to do next"

```typescript
// Bad
throw new Error('Something went wrong');

// Good
throw new Error(
    `PDF conversion to ${format} requires Pandoc.\n` +
    `Install it: brew install pandoc (macOS) | apt install pandoc (Linux)`
);
```

---

## Exit Codes

The CLI follows a strict exit code contract. Do not break these:

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Runtime error (file corrupt, dependency missing, network failure) |
| `2` | User input error (bad syntax, missing argument, unsupported format) |

---

## Adding a New Engine

1. Create `cli/src/engines/myformat.ts`
2. Export a `processMyFormat(inputFile, targetFormat, options)` function
3. Route it in `executeEngine()` in `cli/src/index.ts`
4. Add file extensions to the relevant ext list (`imageExts`, `videoExts`, `documentExts`)
5. Write at least 3 tests in `cli/src/__tests__/myformat.test.ts`

---

## Reporting Bugs

Open an issue at [github.com/Rishet11/OmniCommand/issues](https://github.com/Rishet11/OmniCommand/issues).

Include:
- OS and Node.js version (`node --version`)
- Exact command that failed
- Full error output (run without `--quiet`)
- Input file format and approximate size
