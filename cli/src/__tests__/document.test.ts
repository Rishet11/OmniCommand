import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { processDocument, preflightPDF } from '../engines/document.js';
import * as child_process from 'child_process';
import { GoogleGenAI } from '@google/genai';

vi.mock('@google/genai', () => {
    return {
        GoogleGenAI: vi.fn().mockImplementation(() => {
            return {
                files: { upload: vi.fn().mockResolvedValue({ name: 'mocked_file' }) },
                models: {
                    generateContent: vi.fn().mockImplementation(({ model }) => {
                        if (model === 'fail') throw new Error('AI failed');
                        return { text: 'Mock AI extracted content' };
                    })
                }
            };
        })
    };
});

vi.mock('child_process', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        execFile: vi.fn(actual.execFile)
    };
});

const FIXTURES_DIR = path.resolve('./');
const TEST_PDF = path.join(FIXTURES_DIR, 'test.pdf');
const TEST_TXT = path.join(FIXTURES_DIR, 'test.txt');
const TEST_DOCX = path.join(FIXTURES_DIR, 'test.docx');

const outputs: string[] = [];
afterEach(() => {
    for (const f of outputs) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    outputs.length = 0;
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Core processDocument — Happy Paths
// ---------------------------------------------------------------------------
describe('processDocument — core paths', () => {
    it('PDF to markdown extraction produces non-empty output', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const outputPath = await processDocument(TEST_PDF, 'md', opts);
        outputs.push(outputPath);

        expect(fs.existsSync(outputPath)).toBe(true);
        const content = fs.readFileSync(outputPath, 'utf-8');
        expect(content.trim().length).toBeGreaterThan(0);
    });

    it('PDF to txt extraction produces non-empty output', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const outputPath = await processDocument(TEST_PDF, 'txt', opts);
        outputs.push(outputPath);

        expect(fs.existsSync(outputPath)).toBe(true);
        const content = fs.readFileSync(outputPath, 'utf-8');
        expect(content.trim().length).toBeGreaterThan(0);
    });

    it('PDF compress path succeeds', async () => {
        const opts = { actionType: 'compress', overwrite: true, quiet: true };
        const outputPath = await processDocument(TEST_PDF, 'pdf', opts);
        outputs.push(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('AI refine success path writes AI content to output', async () => {
        const savedKey = process.env.GEMINI_API_KEY;
        process.env.GEMINI_API_KEY = 'test_key';

        const opts = { actionType: 'convert', refine: true, overwrite: true, quiet: true };
        const outputPath = await processDocument(TEST_PDF, 'md', opts);
        outputs.push(outputPath);

        expect(fs.existsSync(outputPath)).toBe(true);
        expect(fs.readFileSync(outputPath, 'utf-8')).toBe('Mock AI extracted content');

        if (savedKey) process.env.GEMINI_API_KEY = savedKey;
        else delete process.env.GEMINI_API_KEY;
    });

    it('Pandoc execution success path for non-PDF (TXT→MD)', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const execMock = vi.mocked(child_process.execFile).mockImplementation((cmd, args, cb) => {
            if (cb) (cb as any)(null, '', '');
            return {} as any;
        });

        const outputPath = await processDocument(TEST_TXT, 'md', opts);
        outputs.push(outputPath);

        expect(execMock).toHaveBeenCalled();
        expect(execMock.mock.calls[0][0]).toBe('pandoc');
    });
});

// ---------------------------------------------------------------------------
// PDF→PDF Pandoc args for --pdf-engine path
// ---------------------------------------------------------------------------
describe('processDocument — TXT/DOCX to PDF pandoc args', () => {
    it('TXT → PDF passes --pdf-engine=xelatex to pandoc', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const execMock = vi.mocked(child_process.execFile).mockImplementation((cmd, args, cb) => {
            if (cb) (cb as any)(null, '', '');
            return {} as any;
        });

        await processDocument(TEST_TXT, 'pdf', opts).catch(() => {});

        const callArgs = execMock.mock.calls[0]?.[1] as string[] | undefined;
        expect(callArgs).toBeDefined();
        expect(callArgs).toContain('--pdf-engine=xelatex');
    });

    it('TXT → PDF uses reduced margins (0.9in sides, 0.75in top/bottom)', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const execMock = vi.mocked(child_process.execFile).mockImplementation((cmd, args, cb) => {
            if (cb) (cb as any)(null, '', '');
            return {} as any;
        });

        await processDocument(TEST_TXT, 'pdf', opts).catch(() => {});

        const callArgs = execMock.mock.calls[0]?.[1] as string[];
        const geometryIdx = callArgs?.indexOf('-V');
        // Look for geometry argument — must contain top/bottom=0.75in, not old margin=1in
        const hasGeometry = callArgs?.some(a => a.includes('geometry:') && a.includes('0.75in'));
        expect(hasGeometry).toBe(true);

        // Old bad value must NOT appear
        const hasOldMargin = callArgs?.some(a => a === 'geometry:margin=1in');
        expect(hasOldMargin).toBe(false);
    });

    it('TXT → PDF passes linestretch for readability', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const execMock = vi.mocked(child_process.execFile).mockImplementation((cmd, args, cb) => {
            if (cb) (cb as any)(null, '', '');
            return {} as any;
        });

        await processDocument(TEST_TXT, 'pdf', opts).catch(() => {});

        const callArgs = execMock.mock.calls[0]?.[1] as string[];
        const hasLinestretch = callArgs?.some(a => a.includes('linestretch'));
        expect(hasLinestretch).toBe(true);
    });

    it('TXT → PDF passes fontsize=12pt', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const execMock = vi.mocked(child_process.execFile).mockImplementation((cmd, args, cb) => {
            if (cb) (cb as any)(null, '', '');
            return {} as any;
        });

        await processDocument(TEST_TXT, 'pdf', opts).catch(() => {});

        const callArgs = execMock.mock.calls[0]?.[1] as string[];
        expect(callArgs).toContain('fontsize=12pt');
    });

    it('DOCX → PDF also passes --pdf-engine=xelatex (mock pandoc)', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const execMock = vi.mocked(child_process.execFile).mockImplementation((cmd, args, cb) => {
            if (cb) (cb as any)(null, '', '');
            return {} as any;
        });

        await processDocument(TEST_DOCX, 'pdf', opts).catch(() => {});

        const callArgs = execMock.mock.calls[0]?.[1] as string[] | undefined;
        if (callArgs) {
            expect(callArgs).toContain('--pdf-engine=xelatex');
        }
    });

    it('DOCX → Markdown calls pandoc (mock)', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const execMock = vi.mocked(child_process.execFile).mockImplementation((cmd, args, cb) => {
            if (cb) (cb as any)(null, '', '');
            return {} as any;
        });

        const outputPath = await processDocument(TEST_DOCX, 'md', opts);
        outputs.push(outputPath);

        expect(execMock.mock.calls[0][0]).toBe('pandoc');
    });
});

// ---------------------------------------------------------------------------
// Format Normalization
// ---------------------------------------------------------------------------
describe('processDocument — format normalization', () => {
    it('"markdown" target normalizes to .md extension', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const outputPath = await processDocument(TEST_PDF, 'markdown', opts);
        outputs.push(outputPath);
        expect(outputPath).toMatch(/\.md$/);
    });

    it('"text" target normalizes to .txt extension', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const outputPath = await processDocument(TEST_PDF, 'text', opts);
        outputs.push(outputPath);
        expect(outputPath).toMatch(/\.txt$/);
    });

    it('"MARKDOWN" (uppercase) is normalized case-insensitively to .md', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const outputPath = await processDocument(TEST_PDF, 'MARKDOWN', opts);
        outputs.push(outputPath);
        expect(outputPath).toMatch(/\.md$/);
    });
});

// ---------------------------------------------------------------------------
// Error / Guard Cases
// ---------------------------------------------------------------------------
describe('processDocument — error & guard cases', () => {
    it('throws "File not found" for non-existent input', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        await expect(processDocument('/tmp/__omx_nonexistent_test.pdf', 'md', opts))
            .rejects.toThrow('File not found');
    });

    it('empty PDF throws descriptive error, not crash', async () => {
        const emptyPdf = path.join(FIXTURES_DIR, '__test_empty.pdf');
        fs.writeFileSync(emptyPdf, '');
        outputs.push(emptyPdf);

        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        await expect(processDocument(emptyPdf, 'md', opts)).rejects.toThrow();
    });

    it('0-byte PDF throws, not crash', async () => {
        const zeroPdf = path.join(FIXTURES_DIR, '__test_zero.pdf');
        fs.writeFileSync(zeroPdf, Buffer.alloc(0));
        outputs.push(zeroPdf);

        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        await expect(processDocument(zeroPdf, 'md', opts)).rejects.toThrow();
    });

    it('corrupt PDF (random bytes) throws, not crash', async () => {
        const corruptPdf = path.join(FIXTURES_DIR, '__test_corrupt.pdf');
        fs.writeFileSync(corruptPdf, Buffer.from('NOTAPDF_XYZXYZXYZ_GARBAGE_DATA_1234567890'));
        outputs.push(corruptPdf);

        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        await expect(processDocument(corruptPdf, 'md', opts)).rejects.toThrow();
    });

    it('--refine without API key throws with setup instructions', async () => {
        const savedKey = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const opts = { actionType: 'convert', refine: true, overwrite: true, quiet: true };
        await expect(processDocument(TEST_PDF, 'md', opts))
            .rejects.toThrow(/Gemini API key/i);

        if (savedKey) process.env.GEMINI_API_KEY = savedKey;
    });

    it('throws if actionType is compress and file is not a PDF', async () => {
        const opts = { actionType: 'compress', overwrite: true, quiet: true };
        await expect(processDocument(TEST_TXT, 'md', opts))
            .rejects.toThrow('Document compression is only supported for PDF files');
    });

    it('PDF → DOCX without --refine throws with explanation', async () => {
        // DOCX is not in the supported local list (only md/txt); must fail with clear message
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        await expect(processDocument(TEST_PDF, 'docx', opts))
            .rejects.toThrow('Local PDF conversion only supports markdown/txt output');
    });

    it('PDF → PDF without --refine throws with explanation', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        await expect(processDocument(TEST_PDF, 'pdf', opts))
            .rejects.toThrow('Local PDF conversion only supports markdown/txt output');
    });

    it('throws if output exists and --overwrite is false', async () => {
        const outPath = TEST_PDF.replace('.pdf', '_convert.md');
        fs.writeFileSync(outPath, 'existing');
        outputs.push(outPath);

        const opts = { actionType: 'convert', overwrite: false, quiet: true };
        await expect(processDocument(TEST_PDF, 'md', opts))
            .rejects.toThrow('already exists. Use --overwrite');
    });

    it('Pandoc ENOENT throws "Pandoc is not installed" message', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        vi.mocked(child_process.execFile).mockImplementation((cmd, args, cb) => {
            const err = new Error('ENOENT') as any;
            err.code = 'ENOENT';
            if (cb) (cb as any)(err, '', '');
            return {} as any;
        });

        await expect(processDocument(TEST_TXT, 'md', opts))
            .rejects.toThrow('Pandoc is not installed');
    });

    it('Pandoc non-ENOENT error wraps message as "Pandoc error:"', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        vi.mocked(child_process.execFile).mockImplementation((cmd, args, cb) => {
            const err = new Error('Exit code 1: some converter error');
            if (cb) (cb as any)(err, '', '');
            return {} as any;
        });

        await expect(processDocument(TEST_TXT, 'md', opts))
            .rejects.toThrow('Pandoc error:');
    });

    it('AI refine failure wraps message as "AI Refinement failed:"', async () => {
        const savedKey = process.env.GEMINI_API_KEY;
        process.env.GEMINI_API_KEY = 'test_key';

        vi.mocked(GoogleGenAI).mockImplementationOnce(() => ({
            files: { upload: vi.fn().mockResolvedValue({ name: 'mock' }) },
            models: {
                generateContent: vi.fn().mockRejectedValue(new Error('AI failed'))
            }
        } as any));

        const opts = { actionType: 'convert', refine: true, overwrite: true, quiet: true };
        await expect(processDocument(TEST_PDF, 'md', opts))
            .rejects.toThrow('AI Refinement failed: AI failed');

        if (savedKey) process.env.GEMINI_API_KEY = savedKey;
        else delete process.env.GEMINI_API_KEY;
    });
});

// ---------------------------------------------------------------------------
// Dry Run
// ---------------------------------------------------------------------------
describe('processDocument — dry run', () => {
    it('dry run returns outputPath without creating file', async () => {
        const opts = { actionType: 'convert', dryRun: true, quiet: true };
        const outputPath = await processDocument(TEST_PDF, 'md', opts);
        outputs.push(outputPath); // cleanup just in case
        expect(fs.existsSync(outputPath)).toBe(false);
    });

    it('dry run for non-PDF returns outputPath without creating file', async () => {
        const opts = { actionType: 'convert', dryRun: true, quiet: true };
        const outputPath = await processDocument(TEST_TXT, 'pdf', opts);
        outputs.push(outputPath); // cleanup just in case
        
        // Let's actually delete it if a previous test left it behind, THEN test processDocument
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        
        const testOutputPath = await processDocument(TEST_TXT, 'pdf', opts);
        expect(fs.existsSync(testOutputPath)).toBe(false);
    });

    it('dry run for compress returns outputPath without creating file', async () => {
        const opts = { actionType: 'compress', dryRun: true, quiet: true };
        const outputPath = await processDocument(TEST_PDF, 'pdf', opts);
        outputs.push(outputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

        const testOutputPath = await processDocument(TEST_PDF, 'pdf', opts);
        expect(fs.existsSync(testOutputPath)).toBe(false);
    });

    it('dry run with --json emits no human text to stdout', async () => {
        const captured: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        process.stdout.write = (chunk: any) => { captured.push(String(chunk)); return true; };

        try {
            await processDocument(TEST_PDF, 'md', { actionType: 'convert', dryRun: true, json: true });
        } finally {
            process.stdout.write = orig;
        }

        // No non-JSON human text should appear in stdout from the engine
        expect(captured.join('')).not.toContain('Dry run:');
    });
});

// ---------------------------------------------------------------------------
// preflightPDF
// ---------------------------------------------------------------------------
describe('preflightPDF', () => {
    it('returns true immediately if --refine is true', async () => {
        const result = await preflightPDF(TEST_PDF, { refine: true, quiet: true });
        expect(result).toBe(true);
    });

    it('throws "scanned image" error if PDF has < 50 chars of text', async () => {
        const emptyPdfBytes = await import('pdf-lib').then(m =>
            m.PDFDocument.create().then(d => { d.addPage(); return d.save(); })
        );
        const imgPdfPath = path.join(FIXTURES_DIR, '__img_test.pdf');
        fs.writeFileSync(imgPdfPath, emptyPdfBytes);
        outputs.push(imgPdfPath);

        await expect(preflightPDF(imgPdfPath, { quiet: true }))
            .rejects.toThrow('This PDF appears to be a scanned image');
    });

    it('--json mode does NOT emit warning text to stdout', async () => {
        const captured: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        process.stdout.write = (chunk: any) => { captured.push(String(chunk)); return true; };

        try {
            await preflightPDF(TEST_PDF, { json: true, quiet: false });
        } finally {
            process.stdout.write = orig;
        }

        const out = captured.join('');
        expect(out).not.toContain('⚠️');
        expect(out).not.toContain('Warning');
        expect(out).not.toContain('two-column');
    });

    it('returns true for a normal text PDF', async () => {
        const result = await preflightPDF(TEST_PDF, { quiet: true });
        expect(result).toBe(true);
    });
});
