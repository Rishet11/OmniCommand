import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
import { formatAction, getCompletionScript, suggestFormat, summarizeResults, validateNodeVersion } from '../index.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

describe('index helpers', () => {
    describe('formatAction', () => {
        it('formats known verbs correctly', () => {
            expect(formatAction('trim')).toBe('Trimming');
            expect(formatAction('resize')).toBe('Resizing');
            expect(formatAction('compress')).toBe('Compressing');
            expect(formatAction('convert')).toBe('Converting');
            expect(formatAction('extract')).toBe('Extracting');
        });

        it('capitalizes and appends "ing" to unknown verbs', () => {
            expect(formatAction('build')).toBe('Building');
            expect(formatAction('TEST')).toBe('Testing');
        });
    });

    describe('batch helpers', () => {
        it('summarizes batch results', () => {
            expect(summarizeResults([
                { inputFile: 'a.png', success: true },
                { inputFile: 'b.png', success: false, error: 'bad' },
                { inputFile: 'c.mp3', success: true, skipped: true },
            ])).toEqual({ total: 3, succeeded: 1, failed: 1, skipped: 1 });
        });
    });

    describe('completion scripts', () => {
        it('returns completions for supported shells', () => {
            expect(getCompletionScript('bash')).toContain('complete -F _omx_completion omx');
            expect(getCompletionScript('zsh')).toContain('#compdef omx');
            expect(getCompletionScript('fish')).toContain('complete -c omx');
        });

        it('returns null for unsupported shells', () => {
            expect(getCompletionScript('powershell')).toBeNull();
        });
    });

    describe('package metadata', () => {
        it('keeps Gemini and MCP SDK optional', () => {
            expect(pkg.dependencies['@google/genai']).toBeUndefined();
            expect(pkg.dependencies['@modelcontextprotocol/sdk']).toBeUndefined();
            expect(pkg.optionalDependencies['@google/genai']).toBeTruthy();
            expect(pkg.optionalDependencies['@modelcontextprotocol/sdk']).toBeTruthy();
        });
    });

    describe('suggestFormat', () => {
        it('returns null for exact matches', () => {
            expect(suggestFormat('webp')).toBeNull();
            expect(suggestFormat('mp4')).toBeNull();
        });

        it('returns exact match for substrings', () => {
            expect(suggestFormat('web')).toBe('webp');
            expect(suggestFormat('jpe')).toBe('jpeg');
            expect(suggestFormat('mark')).toBe('markdown');
        });

        it('returns suggestion for minor typos (diff <= 2)', () => {
            expect(suggestFormat('mkvv')).toBe('mkv');
            expect(suggestFormat('pngg')).toBe('png');
            expect(suggestFormat('jpgg')).toBe('jpg');
        });

        it('returns null if no suggestion matches well', () => {
            expect(suggestFormat('completelywrong')).toBeNull();
            expect(suggestFormat('zzz')).toBeNull();
        });
    });

    describe('validateNodeVersion', () => {
        it('does not throw or exit if node version is >= 20.3.0', () => {
            // Vitest runs in Node 20+, so this should naturally pass
            // We can also spy on console.log if logSuccess is true
            const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            expect(() => validateNodeVersion(true)).not.toThrow();
            expect(logSpy).toHaveBeenCalled();
            logSpy.mockRestore();
        });

        it('exits if node version is unsupported', () => {
            const originalVersion = process.version;
            // Mock property
            Object.defineProperty(process, 'version', {
                value: 'v18.15.0',
                writable: true
            });

            const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
                throw new Error('process.exit called');
            }) as any);
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            expect(() => validateNodeVersion()).toThrow('process.exit called');
            expect(errSpy).toHaveBeenCalled();
            expect(exitSpy).toHaveBeenCalledWith(1);

            // Restore
            Object.defineProperty(process, 'version', {
                value: originalVersion,
                writable: true
            });
            exitSpy.mockRestore();
            errSpy.mockRestore();
        });
    });
});
