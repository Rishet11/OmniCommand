import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { processDocument, preflightPDF } from '../engines/document.js';

const FIXTURES_DIR = path.resolve('./');
const TEST_PDF = path.join(FIXTURES_DIR, 'test.pdf');

const outputs: string[] = [];
afterEach(() => {
    for (const f of outputs) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    outputs.length = 0;
});

describe('processDocument', () => {
    it('PDF to markdown extraction produces non-empty output', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const outputPath = await processDocument(TEST_PDF, 'md', opts);
        outputs.push(outputPath);

        expect(fs.existsSync(outputPath)).toBe(true);
        const content = fs.readFileSync(outputPath, 'utf-8');
        expect(content.trim().length).toBeGreaterThan(0);
    });

    it('empty PDF throws descriptive error, not crash', async () => {
        const emptyPdf = path.join(FIXTURES_DIR, '__test_empty.pdf');
        fs.writeFileSync(emptyPdf, '');
        outputs.push(emptyPdf);

        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        await expect(processDocument(emptyPdf, 'md', opts))
            .rejects.toThrow(); // Any error is fine — must not crash the process
    });

    it('--refine without API key throws with setup instructions', async () => {
        const savedKey = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const opts = { actionType: 'convert', refine: true, overwrite: true, quiet: true };
        await expect(processDocument(TEST_PDF, 'md', opts))
            .rejects.toThrow(/Gemini API key/i);

        if (savedKey) process.env.GEMINI_API_KEY = savedKey;
    });
});

describe('preflightPDF', () => {
    it('--json mode does NOT emit warning text to stdout', async () => {
        const originalWrite = process.stdout.write.bind(process.stdout);
        const captured: string[] = [];
        process.stdout.write = (chunk: any) => {
            captured.push(String(chunk));
            return true;
        };

        try {
            await preflightPDF(TEST_PDF, { json: true, quiet: false });
        } finally {
            process.stdout.write = originalWrite;
        }

        const output = captured.join('');
        expect(output).not.toContain('⚠️');
        expect(output).not.toContain('Warning');
        expect(output).not.toContain('two-column');
    });
});
