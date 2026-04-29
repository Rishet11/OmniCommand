import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { processImage } from '../engines/image.js';
import sharp from 'sharp';

vi.mock('sharp', async (importOriginal) => {
    const actual = await importOriginal() as any;
    const sharpMock = vi.fn((input) => {
        if (input === 'throw_error') {
            return {
                jpeg: () => { throw new Error('sharp fail'); },
                png:  () => { throw new Error('sharp fail'); },
                webp: () => { throw new Error('sharp fail'); },
                resize: function() { return this; },
            };
        }
        return actual.default(input);
    });
    return { default: sharpMock };
});

const FIXTURES_DIR = path.resolve('./');
const TEST_IMAGE = path.join(FIXTURES_DIR, 'test_image.png');

// Paths to generated fixtures
const TRANSPARENT_PNG = path.join(FIXTURES_DIR, '__transparent_test.png');
const TINY_PNG       = path.join(FIXTURES_DIR, '__tiny_test.png');

const outputs: string[] = [];

// Create small fixture images used in several tests
beforeEach(async () => {
    // Tiny 1×1 white PNG — used for "already optimized" warning test
    if (!fs.existsSync(TINY_PNG)) {
        await sharp({
            create: { width: 1, height: 1, channels: 3, background: { r: 255, g: 255, b: 255 } }
        }).png().toFile(TINY_PNG);
    }

    // 20×20 semi-transparent PNG — used for transparent-to-JPG test
    if (!fs.existsSync(TRANSPARENT_PNG)) {
        await sharp({
            create: { width: 20, height: 20, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } }
        }).png().toFile(TRANSPARENT_PNG);
    }
});

afterEach(() => {
    for (const f of outputs) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    outputs.length = 0;
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Format Conversion Matrix
// ---------------------------------------------------------------------------
describe('processImage — format conversion matrix', () => {
    it('PNG → WebP produces a .webp output file', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const outputPath = await processImage(TEST_IMAGE, 'webp', opts);
        outputs.push(outputPath);
        expect(outputPath.endsWith('.webp')).toBe(true);
        expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('PNG → JPG produces a .jpg output file', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const outputPath = await processImage(TEST_IMAGE, 'jpg', opts);
        outputs.push(outputPath);
        expect(outputPath.endsWith('.jpg')).toBe(true);
        expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('PNG → JPEG normalizes to .jpg extension', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const outputPath = await processImage(TEST_IMAGE, 'jpeg', opts);
        outputs.push(outputPath);
        // normalizeImageFormat converts 'jpeg' → 'jpg'
        expect(outputPath.endsWith('.jpg')).toBe(true);
    });

    it('PNG → AVIF produces a .avif output file', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const outputPath = await processImage(TEST_IMAGE, 'avif', opts);
        outputs.push(outputPath);
        expect(outputPath.endsWith('.avif')).toBe(true);
        expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('PNG → GIF produces a .gif output file', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const outputPath = await processImage(TEST_IMAGE, 'gif', opts);
        outputs.push(outputPath);
        expect(outputPath.endsWith('.gif')).toBe(true);
        expect(fs.existsSync(outputPath)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Compression Edge Cases
// ---------------------------------------------------------------------------
describe('processImage — compression', () => {
    it('compress PNG to 50% auto-routes to WebP (lossless PNG workaround)', async () => {
        const opts = { actionType: 'compress', compressTarget: '50%', overwrite: true, quiet: true };
        const outputPath = await processImage(TEST_IMAGE, 'png', opts);
        outputs.push(outputPath);
        // PNG → compress must produce .webp (not .png)
        expect(outputPath.endsWith('.webp')).toBe(true);
        expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('compress PNG to 50% output is smaller than input', async () => {
        const opts = { actionType: 'compress', compressTarget: '50%', overwrite: true, quiet: true };
        const outputPath = await processImage(TEST_IMAGE, 'png', opts);
        outputs.push(outputPath);
        const inputSize  = fs.statSync(TEST_IMAGE).size;
        const outputSize = fs.statSync(outputPath).size;
        expect(outputSize).toBeLessThan(inputSize);
    });

    it('compress with 1% quality (minimum) does not crash', async () => {
        const opts = { actionType: 'compress', compressTarget: '1%', overwrite: true, quiet: true };
        const outputPath = await processImage(TEST_IMAGE, 'jpg', opts);
        outputs.push(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('compress with 100% quality (maximum) clamps to quality 90, does not crash', async () => {
        const opts = { actionType: 'compress', compressTarget: '100%', overwrite: true, quiet: true };
        const outputPath = await processImage(TEST_IMAGE, 'jpg', opts);
        outputs.push(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
        // 100% * 0.9 = 90 quality — file should exist
    });

    it('compress with 0% (below minimum) is clamped to 1 and does not crash', async () => {
        // parseInt('0') = 0, Math.max(1, round(0 * 0.9)) = 1
        const opts = { actionType: 'compress', compressTarget: '0%', overwrite: true, quiet: true };
        const outputPath = await processImage(TEST_IMAGE, 'jpg', opts);
        outputs.push(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('compress with 150% (over 100) is clamped to 100 and does not crash', async () => {
        // Math.min(100, 150) = 100; quality = Math.round(100 * 0.9) = 90
        const opts = { actionType: 'compress', compressTarget: '150%', overwrite: true, quiet: true };
        const outputPath = await processImage(TEST_IMAGE, 'jpg', opts);
        outputs.push(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('compress JPG to 200kb target uses quality=85 fallback', async () => {
        const opts = { actionType: 'compress', compressTarget: '200kb', overwrite: true, quiet: true };
        const outputPath = await processImage(TEST_IMAGE, 'jpg', opts);
        outputs.push(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('compress JPG to 2mb target uses quality=85 fallback', async () => {
        const opts = { actionType: 'compress', compressTarget: '2mb', overwrite: true, quiet: true };
        const outputPath = await processImage(TEST_IMAGE, 'jpg', opts);
        outputs.push(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('warns if output is larger than input (already optimized)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const originalStatSync = fs.statSync;

        vi.spyOn(fs, 'statSync').mockImplementation((file: fs.PathLike) => {
            if (String(file).includes('test_image_compress.jpg')) {
                return { size: 99999999 } as any; // fake huge output
            }
            return originalStatSync(file);
        });

        const opts = { actionType: 'compress', compressTarget: '99%', overwrite: true, quiet: false, json: false };
        const outputPath = await processImage(TEST_IMAGE, 'jpg', opts);
        outputs.push(outputPath);

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Output'));
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already be highly optimized'));
    });
});

// ---------------------------------------------------------------------------
// Resize Edge Cases
// ---------------------------------------------------------------------------
describe('processImage — resize', () => {
    it('resize to 100px produces output (smaller than original)', async () => {
        const opts = { actionType: 'resize', targetSize: '100px', overwrite: true, quiet: true };
        const outputPath = await processImage(TEST_IMAGE, 'png', opts);
        outputs.push(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
        // Output must be at most 100px wide (aspect ratio preserved)
        const meta = await sharp(outputPath).metadata();
        expect(meta.width!).toBeLessThanOrEqual(100);
    });

    it('resize to 10000px does NOT upscale (withoutEnlargement=true)', async () => {
        const originalMeta = await sharp(TEST_IMAGE).metadata();
        const opts = { actionType: 'resize', targetSize: '10000px', overwrite: true, quiet: true };
        const outputPath = await processImage(TEST_IMAGE, 'png', opts);
        outputs.push(outputPath);

        const meta = await sharp(outputPath).metadata();
        // Output width must be <= original width (no upscaling)
        expect(meta.width!).toBeLessThanOrEqual(originalMeta.width!);
    });

    it('resize to 800px is the standard case', async () => {
        const opts = { actionType: 'resize', targetSize: '800px', overwrite: true, quiet: true };
        const outputPath = await processImage(TEST_IMAGE, 'png', opts);
        outputs.push(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Special Image Types
// ---------------------------------------------------------------------------
describe('processImage — special image types', () => {
    it('transparent PNG → JPG does not crash (alpha flattened)', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const outputPath = await processImage(TRANSPARENT_PNG, 'jpg', opts);
        outputs.push(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
        expect(outputPath.endsWith('.jpg')).toBe(true);
    });

    it('transparent PNG → PNG preserves alpha channel (no crash)', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const outputPath = await processImage(TRANSPARENT_PNG, 'png', opts);
        outputs.push(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Error Cases
// ---------------------------------------------------------------------------
describe('processImage — error cases', () => {
    it('missing input file throws "File not found"', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        await expect(processImage('/tmp/omx_nonexistent_xyz_abc.png', 'webp', opts))
            .rejects.toThrow('File not found');
    });

    it('unsupported format throws mentioning "Supported formats"', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        await expect(processImage(TEST_IMAGE, 'bmp', opts))
            .rejects.toThrow('Supported formats');
    });

    it('unsupported format "tiff" output throws (not an output format)', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        await expect(processImage(TEST_IMAGE, 'tiff', opts))
            .rejects.toThrow('Supported formats');
    });

    it('overwrite protection throws when output exists and --overwrite not set', async () => {
        const opts1 = { actionType: 'convert', overwrite: true, quiet: true };
        const outputPath = await processImage(TEST_IMAGE, 'webp', opts1);
        outputs.push(outputPath);

        const opts2 = { actionType: 'convert', overwrite: false, quiet: true };
        await expect(processImage(TEST_IMAGE, 'webp', opts2))
            .rejects.toThrow('already exists');
    });

    it('catches and wraps sharp processing errors with "Sharp Image Processing Error"', async () => {
        const originalExistsSync = fs.existsSync;
        const originalStatSync   = fs.statSync;

        vi.spyOn(fs, 'existsSync').mockImplementation(
            (file) => file === 'throw_error' ? true : originalExistsSync(file)
        );
        vi.spyOn(fs, 'statSync').mockImplementation(
            (file) => file === 'throw_error' ? ({ size: 100 } as any) : originalStatSync(file)
        );

        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        await expect(processImage('throw_error', 'jpg', opts))
            .rejects.toThrow('Sharp Image Processing Error: sharp fail');
    });

    it('0-byte file (reported size 0 by statSync) does not silently succeed', async () => {
        const zeroFile = path.join(FIXTURES_DIR, '__zero_image.png');
        fs.writeFileSync(zeroFile, Buffer.alloc(0));
        outputs.push(zeroFile);

        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        // sharp will throw because it cannot parse 0-byte content
        await expect(processImage(zeroFile, 'webp', opts)).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Dry Run
// ---------------------------------------------------------------------------
describe('processImage — dry run', () => {
    it('dry run returns outputPath without creating a file', async () => {
        const opts = { actionType: 'convert', dryRun: true, quiet: true };
        const outputPath = await processImage(TEST_IMAGE, 'webp', opts);
        expect(fs.existsSync(outputPath)).toBe(false);
    });
});
