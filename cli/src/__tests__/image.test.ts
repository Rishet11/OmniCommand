import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { processImage } from '../engines/image.js';

const FIXTURES_DIR = path.resolve('./');
const TEST_IMAGE = path.join(FIXTURES_DIR, 'test_image.png');

// Clean up test outputs after each test
const outputs: string[] = [];
afterEach(() => {
    for (const f of outputs) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    outputs.length = 0;
});

describe('processImage', () => {
    it('compress PNG produces output SMALLER than input (regression: was +17%)', async () => {
        const opts = { actionType: 'compress', compressTarget: '50%', overwrite: true, quiet: true };
        const outputPath = await processImage(TEST_IMAGE, 'png', opts);
        outputs.push(outputPath);

        const inputSize = fs.statSync(TEST_IMAGE).size;
        const outputSize = fs.statSync(outputPath).size;
        // PNG → WebP auto-routing means output should be dramatically smaller
        expect(outputSize).toBeLessThan(inputSize);
    });

    it('convert PNG to WebP produces a .webp output file', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const outputPath = await processImage(TEST_IMAGE, 'webp', opts);
        outputs.push(outputPath);

        expect(fs.existsSync(outputPath)).toBe(true);
        expect(outputPath.endsWith('.webp')).toBe(true);
    });

    it('unsupported format throws with "Supported formats" in message', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        await expect(processImage(TEST_IMAGE, 'bmp', opts))
            .rejects.toThrow('Supported formats');
    });

    it('missing input file throws with "File not found"', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        await expect(processImage('/tmp/nonexistent_omx_test.png', 'webp', opts))
            .rejects.toThrow('File not found');
    });

    it('overwrite protection throws when output exists and --overwrite not set', async () => {
        // First create the output
        const opts1 = { actionType: 'convert', overwrite: true, quiet: true };
        const outputPath = await processImage(TEST_IMAGE, 'webp', opts1);
        outputs.push(outputPath);

        // Then try again without overwrite
        const opts2 = { actionType: 'convert', overwrite: false, quiet: true };
        await expect(processImage(TEST_IMAGE, 'webp', opts2))
            .rejects.toThrow('already exists');
    });
});
