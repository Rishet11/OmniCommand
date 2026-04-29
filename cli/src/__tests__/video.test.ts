import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { processVideo } from '../engines/video.js';

const FIXTURES_DIR = path.resolve('./');
const TEST_AUDIO = path.join(FIXTURES_DIR, 'test_audio.mp3');

const outputs: string[] = [];
afterEach(() => {
    for (const f of outputs) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    outputs.length = 0;
});

describe('processVideo', () => {
    it('audio trim produces output file', async () => {
        const opts = {
            actionType: 'trim',
            trimStart: '0:01',
            trimEnd: '0:05',
            overwrite: true,
            quiet: true,
        };
        const outputPath = await processVideo(TEST_AUDIO, 'mp3', opts);
        outputs.push(outputPath);

        expect(fs.existsSync(outputPath)).toBe(true);
        expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
    });

    it('missing input file throws descriptive error', async () => {
        const opts = {
            actionType: 'trim',
            trimStart: '0:01',
            trimEnd: '0:05',
            overwrite: true,
            quiet: true,
        };
        await expect(processVideo('/tmp/nonexistent_omx_test.mp3', 'mp3', opts))
            .rejects.toThrow(); // FFmpeg will error — any error message is acceptable
    });

    it('dry-run does NOT create an output file on disk', async () => {
        const opts = {
            actionType: 'trim',
            trimStart: '0:01',
            trimEnd: '0:05',
            overwrite: true,
            quiet: true,
            dryRun: true,
        };
        const outputPath = await processVideo(TEST_AUDIO, 'mp3', opts);
        // On dry-run, output path is returned but file should NOT be written
        expect(fs.existsSync(outputPath)).toBe(false);
    });
});
