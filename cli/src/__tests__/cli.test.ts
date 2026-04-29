import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Integration tests: spawns the actual built CLI binary
const CLI = path.resolve('./dist/index.js');
const TEST_IMAGE = path.resolve('./test_image.png');
const TEST_AUDIO = path.resolve('./test_audio.mp3');

// Helper: run CLI synchronously and return { exitCode, stdout, stderr }
function runCLI(args: string[]): { exitCode: number; stdout: string; stderr: string } {
    const env = { ...process.env };
    delete env.NODE_ENV; // ensure the CLI actually runs (index.js skips execution if NODE_ENV=test)
    const result = spawnSync('node', [CLI, ...args], {
        encoding: 'utf-8',
        timeout: 15000,
        env,
    });
    return {
        exitCode: result.status ?? 1,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
    };
}

const outputs: string[] = [];
afterEach(() => {
    for (const f of outputs) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    outputs.length = 0;
});

// ---------------------------------------------------------------------------
// Basic Command Syntax & Help
// ---------------------------------------------------------------------------
describe('CLI integration — syntax and basics', () => {
    it('no-args exits 0 and shows example commands', () => {
        const { exitCode, stdout } = runCLI([]);
        expect(exitCode).toBe(0);
        expect(stdout).toContain('omx');
        expect(stdout).toContain('convert');
    });

    it('--version outputs a valid semver string', () => {
        const { exitCode, stdout } = runCLI(['--version']);
        expect(exitCode).toBe(0);
        expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('--help shows available commands', () => {
        const { exitCode, stdout } = runCLI(['--help']);
        expect(exitCode).toBe(0);
        expect(stdout).toContain('convert');
        expect(stdout).toContain('compress');
        expect(stdout).toContain('trim');
        expect(stdout).toContain('extract');
        expect(stdout).toContain('resize');
        expect(stdout).toContain('doctor');
        expect(stdout).toContain('config');
    });

    it('unknown command fails via commander', () => {
        const { exitCode, stderr } = runCLI(['unknowncmd']);
        expect(exitCode).toBeGreaterThan(0);
        expect(stderr).toContain('error: unknown command');
    });
});

// ---------------------------------------------------------------------------
// Syntax Error Checks (Exit Code 2)
// ---------------------------------------------------------------------------
describe('CLI integration — syntax validation', () => {
    it('bad convert syntax exits 2', () => {
        const { exitCode, stderr } = runCLI(['convert', 'file.png', 'not', 'webp']);
        expect(exitCode).toBe(2);
        expect(stderr).toContain('Invalid syntax');
    });

    it('bad compress syntax exits 2', () => {
        const { exitCode, stderr } = runCLI(['compress', 'file.png', 'not', '50%']);
        expect(exitCode).toBe(2);
        expect(stderr).toContain('Invalid syntax');
    });

    it('bad resize syntax exits 2', () => {
        const { exitCode, stderr } = runCLI(['resize', 'file.png', 'not', '800px']);
        expect(exitCode).toBe(2);
        expect(stderr).toContain('Invalid syntax');
    });

    it('bad trim syntax exits 2', () => {
        const { exitCode, stderr } = runCLI(['trim', 'file.mp4', 'at', '0:30', 'until', '1:00']);
        expect(exitCode).toBe(2);
        expect(stderr).toContain('Invalid syntax');
    });

    it('bad extract syntax exits 2', () => {
        const { exitCode, stderr } = runCLI(['extract', 'audio', 'at', 'file.mp4']);
        expect(exitCode).toBe(2);
        expect(stderr).toContain('Invalid syntax');
    });

    it('extracting non-audio throws error', () => {
        const { exitCode, stderr } = runCLI(['extract', 'video', 'from', 'file.mp4']);
        expect(exitCode).toBe(2);
        expect(stderr).toContain('Only audio extraction is supported');
    });
});

// ---------------------------------------------------------------------------
// JSON output mode validation
// ---------------------------------------------------------------------------
describe('CLI integration — JSON output', () => {
    it('--json error output is valid parseable JSON', () => {
        const { stdout, exitCode } = runCLI(['convert', '/tmp/nonexistent_omx.png', 'to', 'webp', '--json']);
        expect(exitCode).toBe(1);
        expect(() => JSON.parse(stdout)).not.toThrow();
        const parsed = JSON.parse(stdout);
        expect(parsed.success).toBe(false);
        expect(typeof parsed.error).toBe('string');
    });

    it('--json success output is valid JSON with no extra text before opening brace', () => {
        const outWebp = TEST_IMAGE.replace('.png', '_convert.webp');
        outputs.push(outWebp);

        const { stdout, exitCode, stderr } = runCLI(['convert', TEST_IMAGE, 'to', 'webp', '--json', '--overwrite']);
        expect(exitCode).toBe(0);

        // Must start with { — no warning text, no spinner text leaking into stdout
        const trimmed = stdout.trim();
        expect(trimmed.startsWith('{')).toBe(true);
        expect(() => JSON.parse(trimmed)).not.toThrow();
        const parsed = JSON.parse(trimmed);
        expect(parsed.success).toBe(true);
        expect(parsed.outputPath).toBeTruthy();
    });

    it('--dry-run combined with --json produces dryRun flag', () => {
        const { stdout, exitCode } = runCLI(['convert', TEST_IMAGE, 'to', 'webp', '--json', '--dry-run']);
        expect(exitCode).toBe(0);
        const parsed = JSON.parse(stdout);
        expect(parsed.success).toBe(true);
        expect(parsed.dryRun).toBe(true);
    });
});

describe('CLI integration — batch operations', () => {
    it('batch dry-run with multiple images reports a human summary', () => {
        const { stdout, exitCode } = runCLI(['compress', TEST_IMAGE, TEST_IMAGE, 'to', '80%', '--dry-run']);
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Dry run:');
        expect(stdout).toContain('Batch summary: 2 succeeded, 0 failed, 0 skipped');
    });

    it('batch JSON output is a single parseable object with results and summary', () => {
        const { stdout, exitCode } = runCLI(['convert', TEST_IMAGE, TEST_IMAGE, 'to', 'webp', '--json', '--dry-run']);
        expect(exitCode).toBe(0);
        const parsed = JSON.parse(stdout);
        expect(parsed.success).toBe(true);
        expect(parsed.action).toBe('convert');
        expect(parsed.results).toHaveLength(2);
        expect(parsed.summary).toEqual({ total: 2, succeeded: 2, failed: 0, skipped: 0 });
    });

    it('batch partial failure continues and exits 1', () => {
        const { stdout, exitCode } = runCLI(['convert', TEST_IMAGE, '/tmp/nonexistent_omx_batch.png', 'to', 'webp', '--json', '--dry-run']);
        expect(exitCode).toBe(0);
        const parsed = JSON.parse(stdout);
        expect(parsed.summary.succeeded).toBe(2);

        const failing = runCLI(['convert', TEST_IMAGE, '/tmp/nonexistent_omx_batch.png', 'to', 'webp', '--json', '--overwrite']);
        expect(failing.exitCode).toBe(1);
        const failedParsed = JSON.parse(failing.stdout);
        expect(failedParsed.summary.succeeded).toBe(1);
        expect(failedParsed.summary.failed).toBe(1);
    });

    it('completion command prints shell scripts', () => {
        const { stdout, exitCode } = runCLI(['completion', 'bash']);
        expect(exitCode).toBe(0);
        expect(stdout).toContain('complete -F _omx_completion omx');
    });
});

// ---------------------------------------------------------------------------
// Config and Doctor commands
// ---------------------------------------------------------------------------
describe('CLI integration — utility commands', () => {
    it('doctor command runs and returns 0', () => {
        const { exitCode, stdout } = runCLI(['doctor']);
        expect(exitCode).toBe(0);
        expect(stdout).toContain('System Health Check');
        expect(stdout).toContain('node');
        expect(stdout).toContain('ffmpeg');
        expect(stdout).toContain('sharp');
    });

    it('config action syntax errors', () => {
        const res1 = runCLI(['config', 'delete', 'KEY']);
        expect(res1.exitCode).toBe(2);
        expect(res1.stderr).toContain('Unknown action');

        const res2 = runCLI(['config', 'set', 'KEY']); // missing val
        expect(res2.exitCode).toBe(2);
        expect(res2.stderr).toContain('Missing value');
    });
});
