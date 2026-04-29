import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { spawnSync, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const CLI = path.resolve('./dist/index.js');
const FIXTURES_DIR = path.resolve('./');
const outputs: string[] = [];

afterEach(() => {
    for (const f of outputs) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    outputs.length = 0;
});

function runCLI(args: string[]): { exitCode: number; stdout: string; stderr: string } {
    const env = { ...process.env };
    delete env.NODE_ENV;
    const result = spawnSync('node', [CLI, ...args], { encoding: 'utf-8', timeout: 15000, env });
    return { exitCode: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

describe('File path & naming edge cases', () => {
    it('handles files with spaces in the name', () => {
        const spaceFile = path.join(FIXTURES_DIR, 'my photo file.png');
        // create a dummy image by copying test_image
        fs.copyFileSync(path.join(FIXTURES_DIR, 'test_image.png'), spaceFile);
        outputs.push(spaceFile);

        const outWebp = spaceFile.replace('.png', '_convert.webp');
        outputs.push(outWebp);

        const { exitCode } = runCLI(['convert', spaceFile, 'to', 'webp', '--quiet']);
        expect(exitCode).toBe(0);
        expect(fs.existsSync(outWebp)).toBe(true);
    });

    it('handles files with Unicode characters in the name', () => {
        const unicodeFile = path.join(FIXTURES_DIR, '문서_öñ.png');
        fs.copyFileSync(path.join(FIXTURES_DIR, 'test_image.png'), unicodeFile);
        outputs.push(unicodeFile);

        const outWebp = unicodeFile.replace('.png', '_convert.webp');
        outputs.push(outWebp);

        const { exitCode } = runCLI(['convert', unicodeFile, 'to', 'webp', '--quiet']);
        expect(exitCode).toBe(0);
        expect(fs.existsSync(outWebp)).toBe(true);
    });

    it('rejects files with no extension', () => {
        const noExtFile = path.join(FIXTURES_DIR, 'no_extension_file');
        fs.writeFileSync(noExtFile, 'dummy data');
        outputs.push(noExtFile);

        const { exitCode, stderr } = runCLI(['convert', noExtFile, 'to', 'webp', '--quiet']);
        expect(exitCode).toBeGreaterThan(0);
        expect(stderr).toContain('not supported');
    });

    it('treats double extensions correctly (ignores inner dots)', () => {
        const doubleExtFile = path.join(FIXTURES_DIR, 'my.test.image.png');
        fs.copyFileSync(path.join(FIXTURES_DIR, 'test_image.png'), doubleExtFile);
        outputs.push(doubleExtFile);

        const outWebp = doubleExtFile.replace('.png', '_convert.webp');
        outputs.push(outWebp);

        const { exitCode } = runCLI(['convert', doubleExtFile, 'to', 'webp', '--quiet']);
        expect(exitCode).toBe(0);
        expect(fs.existsSync(outWebp)).toBe(true);
    });

    it('fails gracefully when a directory is passed instead of a file', () => {
        const { exitCode, stderr } = runCLI(['convert', FIXTURES_DIR, 'to', 'webp', '--quiet']);
        // The exact error depends on the engine, but it should exit with an error code
        expect(exitCode).toBeGreaterThan(0);
        expect(stderr.length).toBeGreaterThan(0);
    });
});
