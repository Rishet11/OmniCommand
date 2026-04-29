import { execFile } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';

export async function processVideo(inputFile: string, targetFormat: string, options: any): Promise<string> {
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
        const target = options.compressTarget.toLowerCase();
        
        // Re-encode required for compression
        args.push('-c:v', 'libx264');
        args.push('-preset', 'fast');

        if (target.endsWith('%')) {
            // General representation of percentage reduction:
            // Assuming default CRF is ~23. A bump to 28 significantly reduces output.
            args.push('-crf', '28'); 
        } else if (target.endsWith('mb')) {
            // Absolute MB targeting using bitrate capping
            const mb = parseInt(target.replace('mb', ''));
            // Very rough approx: Just set a max bitrate cap based on target
            args.push('-b:v', `${mb * 0.4}M`);
            args.push('-maxrate', `${mb * 0.5}M`);
            args.push('-bufsize', `${mb}M`);
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
        const childProcess = execFile(binaryPath, args, (error: any, stdout: string, stderr: string) => {
            if (error) {
                // Clean up partial output on failure
                if (fs.existsSync(outputPath)) {
                    try { fs.unlinkSync(outputPath); } catch {}
                }
                return reject(new Error(`FFmpeg processing failed: ${error.message}`));
            }
            resolve(outputPath);
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
