import { execFile } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import type { ProcessOptions } from '../types.js';

export interface FfmpegProgress {
    percent?: number;
    time?: string;
    elapsedSeconds?: number;
    etaSeconds?: number;
    size?: string;
}

function timestampToSeconds(value: string): number {
    const parts = value.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return Number(value) || 0;
}

export function parseFfmpegProgress(stderrChunk: string, durationSeconds?: number, startedAt = Date.now()): FfmpegProgress | null {
    const timeMatch = stderrChunk.match(/time=(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/);
    if (!timeMatch) return null;

    const elapsedSeconds = timestampToSeconds(timeMatch[1]);
    const sizeMatch = stderrChunk.match(/size=\s*([^\s]+)/);
    const progress: FfmpegProgress = {
        time: timeMatch[1],
        elapsedSeconds,
        size: sizeMatch?.[1],
    };

    if (durationSeconds && durationSeconds > 0) {
        const percent = Math.min(100, Math.max(0, (elapsedSeconds / durationSeconds) * 100));
        const wallElapsed = Math.max(1, (Date.now() - startedAt) / 1000);
        const remainingRatio = percent > 0 ? (100 - percent) / percent : 0;
        progress.percent = percent;
        progress.etaSeconds = Math.max(0, Math.round(wallElapsed * remainingRatio));
    }

    return progress;
}

export function formatProgressLine(inputFile: string, progress: FfmpegProgress): string {
    const percent = progress.percent === undefined ? '--' : `${progress.percent.toFixed(0)}%`;
    const eta = progress.etaSeconds === undefined ? 'ETA --' : `ETA ${progress.etaSeconds}s`;
    const size = progress.size ? ` size ${progress.size}` : '';
    return `Processing ${inputFile}: ${percent} ${eta}${size}`;
}

function durationFromOptions(options: ProcessOptions): number | undefined {
    if (options.actionType === 'trim' && options.trimStart && options.trimEnd) {
        return Math.max(0, timestampToSeconds(options.trimEnd) - timestampToSeconds(options.trimStart));
    }
    return undefined;
}

export async function processVideo(inputFile: string, targetFormat: string, options: ProcessOptions): Promise<string> {
    const { dir, name } = path.parse(inputFile);
    const format = targetFormat.toLowerCase().replace('.', '');
    const outputPath = path.join(dir, `${name}_${options.actionType || 'conv'}.${format}`);

    const args: string[] = [];

    // If doing a lossless trim, we place the seek times BEFORE the input
    if (options.actionType === 'trim') {
        args.push('-ss', options.trimStart);
        args.push('-to', options.trimEnd);
    }

    args.push('-i', inputFile);

    if (options.actionType === 'trim') {
        // Fast trim with stream copy if formats are the same
        args.push('-c', 'copy');
    } else if (options.actionType === 'compress') {
        const target = options.actionType === 'compress' ? options.compressTarget.toLowerCase() : '';

        // Audio-only extensions — libx264 would error on files with no video stream.
        const audioOnlyExts = ['.mp3', '.wav', '.aac', '.flac', '.m4a', '.ogg', '.opus'];
        const isAudioOnly = audioOnlyExts.includes(path.extname(inputFile).toLowerCase());

        if (isAudioOnly) {
            // Audio compression: reduce bitrate instead of re-encoding with a video codec.
            args.push('-vn'); // strip any (non-existent) video track
            if (target.endsWith('%')) {
                // 192 kbps baseline — scale proportionally, floor at 32 kbps
                const pct = Math.min(100, Math.max(1, parseInt(target.replace('%', ''))));
                const bitrate = Math.max(32, Math.round(192 * pct / 100));
                args.push('-b:a', `${bitrate}k`);
            } else if (target.endsWith('kb')) {
                const kb = parseFloat(target.replace('kb', ''));
                args.push('-b:a', `${Math.max(32, Math.round(kb * 0.096))}k`);
            } else if (target.endsWith('mb')) {
                const mb = parseFloat(target.replace('mb', ''));
                // Rough heuristic: 1 MB target ≈ 130 kbps
                args.push('-b:a', `${Math.max(32, Math.round(mb * 130))}k`);
            }
        } else {
            // Video compression: re-encode with libx264
            args.push('-c:v', 'libx264');
            args.push('-preset', 'fast');

            if (target.endsWith('%')) {
                // Bump CRF from default ~23 to 28 → significant size reduction
                args.push('-crf', '28');
            } else if (target.endsWith('mb')) {
                const mb = parseInt(target.replace('mb', ''));
                args.push('-b:v', `${mb * 0.4}M`);
                args.push('-maxrate', `${mb * 0.5}M`);
                args.push('-bufsize', `${mb}M`);
            }
        }
    } else if (options.actionType === 'extract' || ['mp3', 'wav', 'aac'].includes(format)) {
        // Handle "extract audio" logically
        args.push('-vn'); // no video
        args.push('-acodec', format === 'mp3' ? 'libmp3lame' : format === 'aac' ? 'aac' : 'pcm_s16le');
    } else {
        // Assume standard video conversion
        args.push('-c:v', 'libx264', '-preset', 'fast');
    }

    // Overwrite flag
    if (options.overwrite) {
        args.unshift('-y'); 
    } else {
        args.unshift('-n'); // never overwrite by default
    }

    args.push(outputPath);

    // Dry run
    if (options.dryRun) {
        if (!options.quiet && !options.json) {
            console.log(`Dry run: would execute: ffmpeg ${args.join(' ')}`);
        }
        return outputPath;
    }

    if (!fs.existsSync(inputFile)) {
        throw new Error(`File not found: ${inputFile}`);
    }

    // Typecast to string to fix TS inference error for the default export
    const binaryPath = ffmpegPath as unknown as string;

    if (!binaryPath) {
        throw new Error(`ffmpeg binary not found in ffmpeg-static.`);
    }

    return new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const durationSeconds = durationFromOptions(options);
        const showProgress = !options.quiet && !options.json && process.stderr.isTTY && !options.dryRun;
        const childProcess = execFile(binaryPath, args, (error: any) => {
            if (error) {
                // Clean up partial output on failure
                if (fs.existsSync(outputPath)) {
                    try { fs.unlinkSync(outputPath); } catch {}
                }
                return reject(new Error(`FFmpeg processing failed: ${error.message}`));
            }
            if (showProgress) process.stderr.write('\n');
            resolve(outputPath);
        });

        childProcess.stderr?.on('data', (chunk: Buffer | string) => {
            if (!showProgress) return;
            const progress = parseFfmpegProgress(String(chunk), durationSeconds, startedAt);
            if (progress) {
                process.stderr.write(`\r${formatProgressLine(inputFile, progress)}`);
            }
        });

        // Ctrl+C / SIGTERM cleanup — delete partial file and exit cleanly
        const cleanup = () => {
            childProcess.kill('SIGTERM');
            if (fs.existsSync(outputPath)) {
                try { fs.unlinkSync(outputPath); } catch {}
            }
            process.stderr.write('\nCancelled. Partial output removed.\n');
            process.exit(1);
        };

        process.once('SIGINT', cleanup);
        process.once('SIGTERM', cleanup);

        childProcess.on('close', () => {
            process.removeListener('SIGINT', cleanup);
            process.removeListener('SIGTERM', cleanup);
        });
    });
}
