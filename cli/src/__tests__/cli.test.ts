import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Integration tests: spawns the actual built CLI binary
const CLI = path.resolve('./dist/index.js');
const TEST_IMAGE = path.resolve('./test_image.png');
const TEST_PDF = path.resolve('./test.pdf');

// Helper: run CLI synchronously and return { exitCode, stdout, stderr }
function runCLI(args: string[]): { exitCode: number; stdout: string; stderr: string } {
    const result = spawnSync('node', [CLI, ...args], {
        encoding: 'utf-8',
        timeout: 15000,
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

describe('CLI integration', () => {
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

    it('bad syntax exits 2, not 1', () => {
        const { exitCode } = runCLI(['convert', 'file.png', 'not', 'webp']);
        expect(exitCode).toBe(2);
    });

    it('--json error output is valid parseable JSON', () => {
        const { stdout } = runCLI(['convert', '/tmp/nonexistent_omx.png', 'to', 'webp', '--json']);
        // stdout must be valid JSON — no extra text
        expect(() => JSON.parse(stdout)).not.toThrow();
        const parsed = JSON.parse(stdout);
        expect(parsed.success).toBe(false);
        expect(typeof parsed.error).toBe('string');
    });

    it('--json success output is valid JSON with no extra text before opening brace', async () => {
        const outWebp = TEST_IMAGE.replace('.png', '_cli_test_conv.webp');
        outputs.push(outWebp);

        const { stdout, exitCode } = runCLI(['convert', TEST_IMAGE, 'to', 'webp', '--json', '--overwrite']);
        expect(exitCode).toBe(0);

        // Must start with { — no warning text, no spinner text
        const trimmed = stdout.trim();
        expect(trimmed.startsWith('{')).toBe(true);
        expect(() => JSON.parse(trimmed)).not.toThrow();
        const parsed = JSON.parse(trimmed);
        expect(parsed.success).toBe(true);
    });
});
