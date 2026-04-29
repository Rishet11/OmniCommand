#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import util from 'util';
import ffmpegPath from 'ffmpeg-static';
import { processDocument } from './engines/document.js';
import { processImage } from './engines/image.js';
import { processVideo } from './engines/video.js';
import { getConfig } from './utils/config.js';

// Use createRequire to read our own package.json for versioning
const require = createRequire(import.meta.url);
const pkg = require('../package.json');
const execFileAsync = util.promisify(execFile);

// Respect NO_COLOR standard (https://no-color.org/) and --no-color flag early,
// before any chalk calls. Commander hasn't parsed yet so we check argv directly.
if (process.env.NO_COLOR !== undefined || process.argv.includes('--no-color')) {
    chalk.level = 0;
}

const program = new Command();

program
  .name('omx')
  .description('OmniCommand — The terminal tool for every format.')
  .version(pkg.version);

// --- GLOBAL OPTIONS ---
program
  .option('--quiet', 'suppress progress output', false)
  .option('--json', 'structured JSON output', false)
  .option('-y, --yes', 'skip confirmations', false)
  .option('--overwrite', 'allow overwriting existing output files', false)
  .option('--dry-run', 'show what would happen without doing it', false)
  .option('--no-color', 'disable ANSI color codes')
  .option('--verbose', 'show input/output sizes and compression ratio');

// Helper for cleaner output
function capitalize(str: string) { return str.charAt(0).toUpperCase() + str.slice(1); }

// Grammatically correct action verb for spinner display
function formatAction(verb: string): string {
    const lower = verb.toLowerCase();
    if (lower === 'trim') return 'Trimming';
    if (lower === 'resize') return 'Resizing';
    if (lower === 'compress') return 'Compressing';
    if (lower === 'convert') return 'Converting';
    if (lower === 'extract') return 'Extracting';
    return capitalize(lower) + 'ing';
}

// Format typo suggestions — helps users with minor format misspellings
function suggestFormat(typo: string): string | null {
    const known = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'mp4', 'mov', 'avi', 'mkv',
                   'webm', 'mp3', 'wav', 'aac', 'flac', 'm4a', 'pdf', 'docx', 'md', 'markdown', 'txt', 'html'];
    const lower = typo.toLowerCase();
    for (const fmt of known) {
        if (fmt === lower) return null; // exact match, no suggestion needed
        if (fmt.includes(lower) || lower.includes(fmt)) return fmt;
        if (Math.abs(fmt.length - lower.length) <= 2) {
            let diff = 0;
            const maxLen = Math.max(fmt.length, lower.length);
            for (let i = 0; i < maxLen; i++) {
                if (fmt[i] !== lower[i]) diff++;
            }
            if (diff <= 2) return fmt;
        }
    }
    return null;
}

async function executeEngine(inputFile: string, actionType: string, options: any) {
    if (!options.quiet && !options.json && !options.dryRun) {
        console.log(chalk.gray(`\nAnalyzing ${inputFile}...`));
    }

    // Non-TTY detection: suppress spinner when stdout is piped/redirected
    const isSilent = options.json || options.quiet || !process.stdout.isTTY;

    const spinner = options.dryRun
        ? ora({ isSilent: true })
        : ora({
            text: `${formatAction(actionType)} ${inputFile}...`,
            isSilent,
        }).start();

    try {
        const ext = path.extname(inputFile).toLowerCase();
        let outputPath = '';

        // Supported formats
        const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.tiff', '.bmp', '.ico'];
        const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.3gp', '.mp3', '.wav', '.aac', '.flac', '.m4a', '.ogg', '.opus'];
        const documentExts = ['.pdf', '.docx', '.doc', '.pptx', '.xlsx', '.rtf', '.txt', '.md', '.markdown'];

        options.actionType = actionType;
        const targetFormat = options.targetFormat || ext.replace('.', '');

        if (!documentExts.includes(ext) && !imageExts.includes(ext) && !videoExts.includes(ext)) {
            if (options.dryRun) {
                if (!options.quiet && !options.json) {
                    console.log(chalk.cyan(`Dry run: extension ${ext} is not supported by omx.`));
                }
                return;
            }
            throw new Error(`Extension ${ext} not supported. Try a document, image, or video.`);
        }

        // Format typo check — only when user explicitly typed a target format
        if (options.targetFormat) {
            const suggestion = suggestFormat(targetFormat);
            if (suggestion && suggestion !== targetFormat) {
                if (!options.quiet && !options.json) {
                    console.log(chalk.yellow(`  ℹ️  Did you mean "${suggestion}" instead of "${targetFormat}"?`));
                }
            }
        }

        if (documentExts.includes(ext)) {
            spinner.text = `Processing Document: ${inputFile}...`;
            outputPath = await processDocument(inputFile, targetFormat, options);
        } else if (imageExts.includes(ext)) {
            spinner.text = `Processing Image (Sharp): ${inputFile}...`;
            outputPath = await processImage(inputFile, targetFormat, options);
        } else if (videoExts.includes(ext)) {
            spinner.text = `Processing Media (FFmpeg): ${inputFile}...`;
            outputPath = await processVideo(inputFile, targetFormat, options);
        }

        if (options.dryRun) {
            spinner.stop();
            if (options.json) {
                console.log(JSON.stringify({ success: true, dryRun: true, inputFile, outputPath, action: actionType }, null, 2));
            }
            return;
        }

        if (options.json) {
            spinner.stop(); // silent stop — no human text on stdout
            console.log(JSON.stringify({ success: true, inputFile, outputPath, action: actionType }, null, 2));
        } else {
            spinner.succeed(chalk.green(`Output saved to: ${outputPath}`));
            // --verbose: show sizes and ratio
            if (options.verbose && fs.existsSync(inputFile) && outputPath && fs.existsSync(outputPath)) {
                const inSize = fs.statSync(inputFile).size;
                const outSize = fs.statSync(outputPath).size;
                console.log(chalk.gray(`  Input:  ${(inSize / 1024).toFixed(1)}KB  →  Output: ${(outSize / 1024).toFixed(1)}KB  (${(outSize / inSize * 100).toFixed(1)}%)`));
            }
        }
    } catch (error: any) {
        spinner.fail(chalk.red(`${formatAction(actionType)} failed`));
        if (options.json) {
            console.log(JSON.stringify({ success: false, error: error.message }, null, 2));
        } else {
            console.error(chalk.red(`\n${error.message}\n`));
        }
        process.exit(1);
    }
}

// --- EXTRACT COMMAND ---
program
  .command('extract <trackType> <separator> <inputFile>')
  .description('Extract audio from a video file')
  .action(async (trackType, separator, inputFile, options, command) => {
    if (separator.toLowerCase() !== 'from') {
        console.error(chalk.red(`\n✗ Invalid syntax. Use: omx extract <type> from <file>\n  Example: omx extract audio from video.mp4\n`));
        process.exit(2);
    }
    validateNodeVersion();
    const globalOpts = command.parent.opts();

    if (trackType.toLowerCase() !== 'audio') {
        console.error(chalk.red(`\n✗ Only audio extraction is supported right now.\n  Use: omx extract audio from <file>\n`));
        process.exit(2);
    }

    // Guard: extracting audio from an already-audio file is a no-op copy
    const audioExts = ['.mp3', '.wav', '.aac', '.flac', '.m4a', '.ogg', '.opus'];
    const inputExt = path.extname(inputFile).toLowerCase();
    if (audioExts.includes(inputExt)) {
        console.error(chalk.yellow(`\n⚠️  ${inputFile} is already an audio file.`));
        console.error(chalk.yellow(`   Extract pulls audio from video files.`));
        console.error(chalk.yellow(`   To convert formats: omx convert ${inputFile} to mp3\n`));
        process.exit(0);
    }

    await executeEngine(inputFile, 'extract', { ...globalOpts, ...options, targetFormat: 'mp3' });
  });

// --- CONVERT COMMAND ---
program
  .command('convert <inputFile> <separator> <targetFormat>')
  .description('Convert a document, image, or video to a different format')
  .option('--refine', 'Use AI Vision OCR to preserve complex layouts/scanned text')
  .action(async (inputFile, separator, targetFormat, options, command) => {
    if (separator.toLowerCase() !== 'to') {
      console.error(chalk.red(`\n✗ Invalid syntax. Use: omx convert <file> to <format>\n  Example: omx convert report.pdf to markdown\n`));
      process.exit(2);
    }
    validateNodeVersion();
    const globalOpts = command.parent.opts();
    await executeEngine(inputFile, 'convert', { ...globalOpts, ...options, targetFormat });
  });

// --- COMPRESS COMMAND ---
program
  .command('compress <inputFile> <separator> <targetAmount>')
  .description('Compress a media file to a target size or percentage')
  .action(async (inputFile, separator, targetAmount, options, command) => {
    if (separator.toLowerCase() !== 'to') {
        console.error(chalk.red(`\n✗ Invalid syntax. Use: omx compress <file> to <target>\n  Example: omx compress photo.png to 50%\n`));
        process.exit(2);
    }
    validateNodeVersion();
    const globalOpts = command.parent.opts();
    await executeEngine(inputFile, 'compress', { ...globalOpts, ...options, compressTarget: targetAmount });
  });

// --- TRIM COMMAND ---
program
  .command('trim <inputFile> <fromWord> <startTime> <toWord> <endTime>')
  .description('Trim a video or audio file')
  .action(async (inputFile, fromWord, startTime, toWord, endTime, options, command) => {
    if (fromWord.toLowerCase() !== 'from' || toWord.toLowerCase() !== 'to') {
        console.error(chalk.red(`\n✗ Invalid syntax. Use: omx trim <file> from <start> to <end>\n  Example: omx trim clip.mp4 from 0:30 to 1:45\n`));
        process.exit(2);
    }
    validateNodeVersion();
    const globalOpts = command.parent.opts();
    await executeEngine(inputFile, 'trim', { ...globalOpts, ...options, trimStart: startTime, trimEnd: endTime });
  });

// --- RESIZE COMMAND ---
program
  .command('resize <inputFile> <separator> <targetSize>')
  .description('Resize an image')
  .action(async (inputFile, separator, targetSize, options, command) => {
    if (separator.toLowerCase() !== 'to') {
        console.error(chalk.red(`\n✗ Invalid syntax. Use: omx resize <file> to <targetSize>\n  Example: omx resize photo.png to 800px\n`));
        process.exit(2);
    }
    validateNodeVersion();
    const globalOpts = command.parent.opts();
    await executeEngine(inputFile, 'resize', { ...globalOpts, ...options, targetSize, targetFormat: path.extname(inputFile).replace('.', '') });
  });

// --- DOCTOR COMMAND ---
program
  .command('doctor')
  .description('Verify system dependencies (ffmpeg, sharp, pandoc)')
  .action(async () => {
    console.log(chalk.bold.underline('\nOmniCommand System Health Check\n'));
    
    // 1. Node.js Check
    validateNodeVersion(true);

    // 2. FFmpeg Check
    if (ffmpegPath) {
        try {
            const binaryPath = ffmpegPath as unknown as string;
            const ffmpegVersion = await new Promise<string>((resolve, reject) => {
                execFile(binaryPath, ['-version'], (error: any, stdout: string) => {
                    if (error) return reject(error);
                    resolve(stdout.split('\n')[0] || 'ffmpeg available');
                });
            });
            console.log(`✅ ${chalk.bold('ffmpeg')}   (${ffmpegVersion})`);
        } catch {
            console.log(`⚠️ ${chalk.bold('ffmpeg')}   bundled binary could not be executed`);
        }
    } else {
        console.log(`✗ ${chalk.bold('ffmpeg')}   bundled binary not found`);
    }

    // 3. Sharp Check
    try {
        const sharpModule = await import('sharp');
        const sharpVersion = sharpModule.default?.versions?.sharp || 'installed';
        console.log(`✅ ${chalk.bold('sharp')}    (version ${sharpVersion})`);
    } catch (error) {
        console.log(`✗ ${chalk.bold('sharp')}    unavailable: ${(error as Error).message}`);
    }

    // 4. Pandoc Check
    try {
        const pandocVersion = await new Promise<string>((resolve, reject) => {
            execFile('pandoc', ['--version'], (error, stdout) => {
                if (error) return reject(error);
                resolve(stdout.split('\n')[0] || 'pandoc available');
            });
        });
        console.log(`✅ ${chalk.bold('pandoc')}   (${pandocVersion})`);
    } catch {
        console.log(`ℹ️ ${chalk.bold('pandoc')}   not installed on PATH; PDF text extraction still works, but non-PDF document conversion needs Pandoc.`);
    }

    const geminiConfigured = !!(process.env.GEMINI_API_KEY || getConfig('GEMINI_API_KEY'));
    console.log(geminiConfigured
        ? chalk.green('\nGemini API key is configured for --refine.\n')
        : chalk.yellow('\nGemini API key is not configured. --refine will fail until you set GEMINI_API_KEY.\n'));
  });

// Helper to strictly enforce the >=20.3.0 Node rule programmatically
function validateNodeVersion(logSuccess = false) {
    const [major, minor] = process.version.replace('v', '').split('.').map(Number);
    const isValid = major > 20 || (major === 20 && minor >= 3);
    
    if (!isValid) {
        console.error(chalk.red(`\n✗ Node.js ${process.version} is not supported.`));
        console.error(chalk.red(`  omx requires Node.js >= 20.3.0 to support sharp and standard schemas.`));
        console.error(chalk.yellow(`  Update using nvm: "nvm install 22 && nvm use 22"\n`));
        process.exit(1);
    }

    if (logSuccess) {
        console.log(`✅ ${chalk.bold('node')}     (v${major}.${minor}, >=20.3.0 requirement met)`);
    }
}

// --- CONFIG COMMAND ---
program
  .command('config <action> <key> [value]')
  .description('Get or set a global configuration value (e.g. omx config set GEMINI_API_KEY value)')
  .action(async (action, key, value) => {
    const { setConfig, getConfig: getConfigValue } = await import('./utils/config.js');

    if (action === 'get') {
        const val = getConfigValue(key);
        if (val !== undefined) {
            console.log(val);
        } else {
            console.error(chalk.yellow(`\n⚠️  No value set for "${key}". Set it with: omx config set ${key} <value>\n`));
            process.exit(1);
        }
        return;
    }

    if (action === 'set') {
        if (!value) {
            console.error(chalk.red(`\n✗ Missing value. Use: omx config set <KEY> <VALUE>\n`));
            process.exit(2);
        }
        setConfig(key, value);
        console.log(chalk.green(`\n✅ Saved ${key} to OmniCommand configuration.\n`));
        return;
    }

    console.error(chalk.red(`\n✗ Unknown action "${action}". Use: omx config get <KEY> | omx config set <KEY> <VALUE>\n`));
    process.exit(2);
  });

// No-args: show friendly examples instead of Commander's error dump
if (process.argv.length <= 2) {
    console.log(`
  omx — natural language file converter

    omx convert report.pdf to markdown
    omx compress photo.png to 50%
    omx trim clip.mp4 from 0:30 to 1:45
    omx extract audio from video.mp4

  Run omx --help for all commands and flags.
`);
    process.exit(0);
}

await program.parseAsync(process.argv);
