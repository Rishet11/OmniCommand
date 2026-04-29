import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { formatProgressLine, parseFfmpegProgress, processVideo } from '../engines/video.js';
import * as child_process from 'child_process';

vi.mock('child_process', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        execFile: vi.fn((cmd, args, cb) => {
            if (args.some((a: string) => a.includes('fail_test.mp4'))) {
                const err = new Error('FFmpeg failed');
                if (cb) cb(err, '', '');
                return { kill: vi.fn(), on: vi.fn() };
            }
            if (args.some((a: string) => a.includes('hang_test.mp4'))) {
                // Simulate a hanging process that never callbacks natively, used for SIGTERM testing
                return {
                    kill: vi.fn(),
                    on: vi.fn()
                };
            }
            // Success
            if (cb) cb(null, '', '');
            return { kill: vi.fn(), on: vi.fn() };
        })
    };
});

const FIXTURES_DIR = path.resolve('./');
const TEST_AUDIO = path.join(FIXTURES_DIR, 'test_audio.mp3');
const TEST_VIDEO = path.join(FIXTURES_DIR, 'test_video.mp4');
const TEST_FLAC = path.join(FIXTURES_DIR, 'test_audio.flac');

// Ensure dummy files exist for existsSync checks
import { beforeAll } from 'vitest';
beforeAll(() => {
    if (!fs.existsSync(TEST_AUDIO)) fs.writeFileSync(TEST_AUDIO, 'dummy audio');
    if (!fs.existsSync(TEST_VIDEO)) fs.writeFileSync(TEST_VIDEO, 'dummy video');
    if (!fs.existsSync(TEST_FLAC)) fs.writeFileSync(TEST_FLAC, 'dummy flac');
});

const outputs: string[] = [];
afterEach(() => {
    for (const f of outputs) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    outputs.length = 0;
    vi.clearAllMocks();
});

// Helper to get the args passed to the mocked execFile
function getLastFfmpegArgs(): string[] {
    const execFileMock = vi.mocked(child_process.execFile);
    if (execFileMock.mock.calls.length === 0) return [];
    return execFileMock.mock.calls[execFileMock.mock.calls.length - 1][1] as string[];
}

// ---------------------------------------------------------------------------
// Format Conversion Matrix
// ---------------------------------------------------------------------------
describe('processVideo — format conversion', () => {
    it('MP4 → MKV', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const out = await processVideo(TEST_VIDEO, 'mkv', opts);
        outputs.push(out);
        const args = getLastFfmpegArgs();
        expect(args).toContain('-c:v');
        expect(args).toContain('libx264');
        expect(args).toContain(out);
        expect(out.endsWith('.mkv')).toBe(true);
    });

    it('MP3 → WAV', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const out = await processVideo(TEST_AUDIO, 'wav', opts);
        outputs.push(out);
        const args = getLastFfmpegArgs();
        // audio conversion should trigger the extract/audio block logic implicitly by format
        expect(args).toContain('pcm_s16le');
        expect(out.endsWith('.wav')).toBe(true);
    });

    it('FLAC → MP3', async () => {
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const out = await processVideo(TEST_FLAC, 'mp3', opts);
        outputs.push(out);
        const args = getLastFfmpegArgs();
        expect(args).toContain('libmp3lame');
        expect(out.endsWith('.mp3')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Trim Edge Cases
// ---------------------------------------------------------------------------
describe('processVideo — trim', () => {
    it('audio trim produces output file with -ss and -to', async () => {
        const opts = { actionType: 'trim', trimStart: '0:01', trimEnd: '0:05', overwrite: true, quiet: true };
        const outputPath = await processVideo(TEST_AUDIO, 'mp3', opts);
        outputs.push(outputPath);

        const args = getLastFfmpegArgs();
        expect(args).toContain('-ss');
        expect(args).toContain('0:01');
        expect(args).toContain('-to');
        expect(args).toContain('0:05');
        expect(args).toContain('-c');
        expect(args).toContain('copy');
    });

    it('trim with HH:MM:SS format', async () => {
        const opts = { actionType: 'trim', trimStart: '01:00:00', trimEnd: '01:30:00', overwrite: true, quiet: true };
        const outputPath = await processVideo(TEST_AUDIO, 'mp3', opts);
        outputs.push(outputPath);

        const args = getLastFfmpegArgs();
        expect(args).toContain('01:00:00');
        expect(args).toContain('01:30:00');
    });

    // We don't implement deep timestamp validation before calling ffmpeg in this tool,
    // we let ffmpeg handle/error out on invalid things like "abc" to "xyz".
});

// ---------------------------------------------------------------------------
// Compression Edge Cases
// ---------------------------------------------------------------------------
describe('processVideo — compress', () => {
    it('video compress with percentage target', async () => {
        const opts = { actionType: 'compress', compressTarget: '50%', overwrite: true, quiet: true };
        const outputPath = await processVideo(TEST_VIDEO, 'mp4', opts);
        outputs.push(outputPath);

        const args = getLastFfmpegArgs();
        expect(args).toContain('-c:v');
        expect(args).toContain('libx264');
        expect(args).toContain('-crf');
        expect(args).toContain('28');
    });

    it('video compress with mb target', async () => {
        const opts = { actionType: 'compress', compressTarget: '10mb', overwrite: true, quiet: true };
        const outputPath = await processVideo(TEST_VIDEO, 'mp4', opts);
        outputs.push(outputPath);

        const args = getLastFfmpegArgs();
        expect(args).toContain('-b:v');
        expect(args).toContain('4M'); // 10 * 0.4
    });
    
    // Test the newly fixed bug: compressing audio-only uses -b:a, not -c:v libx264
    it('audio compress with percentage target uses -b:a, not libx264', async () => {
        const opts = { actionType: 'compress', compressTarget: '50%', overwrite: true, quiet: true };
        const outputPath = await processVideo(TEST_AUDIO, 'mp3', opts);
        outputs.push(outputPath);

        const args = getLastFfmpegArgs();
        expect(args).toContain('-vn');
        expect(args).toContain('-b:a');
        expect(args).toContain('96k'); // 192 * 0.5
        expect(args).not.toContain('libx264'); // video codec should be absent
    });

    it('audio compress with kb target uses -b:a', async () => {
        const opts = { actionType: 'compress', compressTarget: '128kb', overwrite: true, quiet: true };
        const outputPath = await processVideo(TEST_AUDIO, 'mp3', opts);
        outputs.push(outputPath);

        const args = getLastFfmpegArgs();
        expect(args).toContain('-b:a');
        expect(args).toContain('32k'); // 128 * 0.096 rounded up to max(32, ...)
    });

    it('audio compress with mb target uses -b:a', async () => {
        const opts = { actionType: 'compress', compressTarget: '2mb', overwrite: true, quiet: true };
        const outputPath = await processVideo(TEST_AUDIO, 'mp3', opts);
        outputs.push(outputPath);

        const args = getLastFfmpegArgs();
        expect(args).toContain('-b:a');
        expect(args).toContain('260k'); // 2 * 130
    });
});

// ---------------------------------------------------------------------------
// Extract Audio Edge Cases
// ---------------------------------------------------------------------------
describe('processVideo — extract audio', () => {
    it('extract MP3', async () => {
        const opts = { actionType: 'extract', overwrite: true, quiet: true };
        const out = await processVideo(TEST_VIDEO, 'mp3', opts);
        outputs.push(out);
        
        const args = getLastFfmpegArgs();
        expect(args).toContain('-vn');
        expect(args).toContain('libmp3lame');
    });

    it('extract AAC', async () => {
        const opts = { actionType: 'extract', overwrite: true, quiet: true };
        const out = await processVideo(TEST_VIDEO, 'aac', opts);
        outputs.push(out);
        
        const args = getLastFfmpegArgs();
        expect(args).toContain('-vn');
        expect(args).toContain('aac');
    });

    it('extract WAV', async () => {
        const opts = { actionType: 'extract', overwrite: true, quiet: true };
        const out = await processVideo(TEST_VIDEO, 'wav', opts);
        outputs.push(out);
        
        const args = getLastFfmpegArgs();
        expect(args).toContain('-vn');
        expect(args).toContain('pcm_s16le');
    });
});

// ---------------------------------------------------------------------------
// Error Handling & Recovery
// ---------------------------------------------------------------------------
describe('processVideo — error handling', () => {
    it('missing input file throws descriptive error', async () => {
        const opts = { actionType: 'trim', trimStart: '0:01', trimEnd: '0:05', overwrite: true, quiet: true };
        await expect(processVideo('/tmp/nonexistent_omx_test.mp3', 'mp3', opts))
            .rejects.toThrow('File not found');
    });

    it('cleans up partial output and rejects on FFmpeg error', async () => {
        // Create a fake file to pass the initial file check
        const failTestFile = path.join(FIXTURES_DIR, 'fail_test.mp4');
        fs.writeFileSync(failTestFile, 'fake');
        outputs.push(failTestFile);

        // Pre-create the output path to test cleanup
        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        const outputPath = path.join(FIXTURES_DIR, 'fail_test_convert.mp4');
        fs.writeFileSync(outputPath, 'partial');
        outputs.push(outputPath);

        await expect(processVideo(failTestFile, 'mp4', opts))
            .rejects.toThrow('FFmpeg processing failed: FFmpeg failed');
        
        // Assert output was unlinked
        expect(fs.existsSync(outputPath)).toBe(false);
    });

    it('uses -n when overwrite is false', async () => {
        const opts = { actionType: 'convert', overwrite: false, quiet: true };
        const outputPath = await processVideo(TEST_AUDIO, 'mp4', opts);
        outputs.push(outputPath);
        
        const args = getLastFfmpegArgs();
        expect(args[0]).toBe('-n');
    });

    it('SIGTERM cleans up and exits process', async () => {
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
        const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

        const hangTestFile = path.join(FIXTURES_DIR, 'hang_test.mp4');
        fs.writeFileSync(hangTestFile, 'fake');
        outputs.push(hangTestFile);

        const opts = { actionType: 'convert', overwrite: true, quiet: true };
        
        const promise = processVideo(hangTestFile, 'mp4', opts);
        
        // Yield to event loop to allow execFile to be called and event listeners registered
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Pre-create output to test cleanup
        const outputPath = path.join(FIXTURES_DIR, 'hang_test_convert.mp4');
        fs.writeFileSync(outputPath, 'partial');
        outputs.push(outputPath);

        // Emit SIGTERM
        process.emit('SIGTERM' as any);

        expect(fs.existsSync(outputPath)).toBe(false);
        expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Cancelled'));
        expect(exitSpy).toHaveBeenCalledWith(1);

        exitSpy.mockRestore();
        writeSpy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// Dry Run
// ---------------------------------------------------------------------------
describe('processVideo — dry run', () => {
    it('dry-run does NOT create an output file on disk', async () => {
        const opts = { actionType: 'trim', trimStart: '0:01', trimEnd: '0:05', overwrite: true, quiet: true, dryRun: true };
        const outputPath = await processVideo(TEST_AUDIO, 'mp3', opts);
        expect(fs.existsSync(outputPath)).toBe(false);
    });

    it('dry-run with --json emits no human text to stdout', async () => {
        const captured: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        process.stdout.write = (chunk: any) => { captured.push(String(chunk)); return true; };

        try {
            await processVideo(TEST_AUDIO, 'mp3', { actionType: 'convert', dryRun: true, json: true });
        } finally {
            process.stdout.write = orig;
        }

        expect(captured.join('')).not.toContain('Dry run:');
    });
});

describe('processVideo — progress parsing', () => {
    it('parses ffmpeg progress chunks with percent and ETA', () => {
        const progress = parseFfmpegProgress('frame=1 size=    256kB time=00:00:05.00 bitrate=419.4kbits/s', 10, Date.now() - 5000);
        expect(progress?.time).toBe('00:00:05.00');
        expect(progress?.size).toBe('256kB');
        expect(progress?.percent).toBeCloseTo(50);
        expect(progress?.etaSeconds).toBeGreaterThanOrEqual(0);
    });

    it('formats progress lines for terminal display', () => {
        const line = formatProgressLine('video.mp4', { percent: 50, etaSeconds: 5, size: '256kB' });
        expect(line).toContain('video.mp4');
        expect(line).toContain('50%');
        expect(line).toContain('ETA 5s');
        expect(line).toContain('256kB');
    });
});
