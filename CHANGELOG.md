# Changelog

All notable changes to OmniCommand (`omx-cmd`) will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). This project uses [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- First-class batch operations for convert, compress, trim, extract, and resize commands.
- Shell completion generation for bash, zsh, and fish via `omx completion <shell>`.
- FFmpeg progress parsing for long media jobs with percent, ETA, and output size when available.
- Exported TypeScript interfaces and a stable package library entrypoint.

### Changed
- Gemini OCR and MCP SDK packages are now optional/lazy-loaded so standard offline conversion installs stay lighter.
- Documentation now consistently distinguishes OmniCommand the product, `omx-cmd` the npm package, and `omx` the terminal binary.
- The root website is documented as a landing/demo page, not a hosted converter UI.

---

## [1.0.3] — 2026-04-29

### Fixed
- **Audio-only compression is now handled correctly.** Previously, compressing `.mp3` or `.wav` files would incorrectly apply the `-c:v libx264` video codec, leading to processing failures or corrupted output. Audio files now use dedicated bitrate-targeted compression paths (`-b:a`).
- **Improved TXT → PDF output layout.** Reduced default margins from 1.0in to 0.75in and added a `1.15` line-stretch to ensure generated PDFs fill the page more effectively and are more readable.
- **CLI integration test race conditions resolved.** Fixed a critical testing bug where parallel Vitest workers were intermittently deleting the `dist/` folder during integration tests.
- **`NODE_ENV=test` command bypass fixed.** Integration tests now correctly execute the CLI logic by explicitly clearing the `test` environment flag that was causing index commands to be skipped.
- **`omx compress` now supports `kb` targets** in addition to `mb` and `%` for more granular control over output sizes.
- **Strict clamping for compression percentages.** Percentage targets are now strictly clamped between 1% and 100% to prevent engine crashes on invalid inputs.

### Added
- **Major Test Suite Expansion.** Reached **125 tests** (up from ~60) covering extreme edge cases:
  - Unicode and special character file names (`문서.pdf`, `photo (1).png`).
  - Zero-byte and corrupted file handling.
  - Directory-as-input protection.
  - Transparent PNG → JPEG flattening.
  - Double extension handling (`file.test.image.png`).
- **Comprehensive coverage of global flags** (`--json`, `--dry-run`, `--quiet`, `--verbose`) across all commands to ensure consistent behavior.

---

## [1.0.2] — 2026-04-27

### Fixed
- **Image compression now actually reduces file size.** Previously `omx compress photo.png to 50%` produced a file 17% *larger* due to hardcoded `quality: 50` + `palette: true` settings that inflated PNGs. PNG is a lossless format and cannot be meaningfully re-compressed — compression now routes PNG to WebP automatically, which is typically 90%+ smaller.
- **`--json` output is now clean JSON only.** PDF warning messages (two-column layout detection, refine suggestions) were leaking to stdout before the JSON object, breaking `JSON.parse()` in scripts and CI. All human-readable output is now suppressed when `--json` is active.
- **Running `omx` with no arguments now exits 0.** Previously dumped Commander's internal help and exited with code 1 (treated as an error). Now shows a friendly 4-line example block and exits cleanly.
- **`NO_COLOR` environment variable now works.** Previously only the `--no-color` flag disabled colours. The [NO_COLOR standard](https://no-color.org/) (`NO_COLOR=1 omx ...`) is now respected.
- **MCP server version stays in sync with package version.** Was hardcoded to `1.0.1` regardless of package version.

### Added
- `omx config get <KEY>` — retrieve stored configuration values (only `set` existed before).
- SIGINT/Ctrl+C handler for video operations — cleans up partial output files on cancellation.
- `--verbose` flag is now wired: shows input/output sizes and compression ratio after each operation.
- Non-TTY detection — spinners are silenced when stdout is piped (e.g. in CI).
- Format typo suggestions — `omx convert file.pdf to jpge` now suggests `jpg`.
- Post-compression size warning if output is not smaller than input.

### Changed
- `prepublishOnly` now copies both `README.md` and `LICENSE` from repo root into `cli/` before publishing.
- `files` array in `package.json` now explicitly includes `LICENSE` and `README.md`.
- Keywords expanded from 6 to 18 for better npm discoverability.
- `repository`, `homepage`, and `bugs` fields added to `package.json` — npm sidebar now shows links.
- Landing page GitHub links corrected to `github.com/Rishet11/OmniCommand` (were pointing to a 404 URL).

---

## [1.0.1] — 2026-04-22

### Changed
- Internal engine improvements and document format support expansion.
- Added `.docx`, `.doc`, `.pptx`, `.xlsx` document handling.
- Expanded media format whitelist.

---

## [1.0.0] — 2026-04-22

### Added
- Initial release.
- Five core commands: `convert`, `compress`, `trim`, `extract`, `resize`.
- Multi-format engine: FFmpeg (video/audio) + Sharp (images) + Pandoc/pdfjs-dist (documents).
- PDF text extraction with two-column layout detection.
- AI document refinement via Gemini Vision (`--refine` flag).
- MCP server for agentic integration (convert, compress, trim tools).
- `omx doctor` system health check.
- `omx config set` for storing API keys.
- Global flags: `--json`, `--quiet`, `--overwrite`, `--dry-run`, `--no-color`.
