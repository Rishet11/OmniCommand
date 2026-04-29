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
import type { ActionType, BatchResult, BatchSummary, ProcessOptions } from './types.js';

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
export function formatAction(verb: string): string {
    const lower = verb.toLowerCase();
    if (lower === 'trim') return 'Trimming';
    if (lower === 'resize') return 'Resizing';
    if (lower === 'compress') return 'Compressing';
    if (lower === 'convert') return 'Converting';
    if (lower === 'extract') return 'Extracting';
    return capitalize(lower) + 'ing';
}

export function suggestFormat(typo: string): string | null {
    const known = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'mp4', 'mov', 'avi', 'mkv',
                   'webm', 'mp3', 'wav', 'aac', 'flac', 'm4a', 'pdf', 'docx', 'md', 'markdown', 'txt', 'html'];
    const lower = typo.toLowerCase();
    
    // First pass: exact matches
    if (known.includes(lower)) return null;

    // Second pass: substring matches
    for (const fmt of known) {
        if (fmt.includes(lower) || lower.includes(fmt)) return fmt;
    }

    // Third pass: typo distance
    for (const fmt of known) {
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

export function summarizeResults(results: BatchResult[]): BatchSummary {
    return {
        total: results.length,
        succeeded: results.filter((result) => result.success && !result.skipped).length,
        failed: results.filter((result) => !result.success).length,
        skipped: results.filter((result) => result.skipped).length,
    };
}

function normalizeGlobalOptions(command: any) {
    const opts = command.parent.opts();
    return {
        ...opts,
        overwrite: opts.overwrite || opts.yes,
    };
}

function splitNaturalArgs(args: string[], separator: string) {
    const index = args.findIndex((arg) => arg.toLowerCase() === separator);
    if (index <= 0 || index === args.length - 1) {
        return null;
    }
    return {
        inputFiles: args.slice(0, index),
        rest: args.slice(index + 1),
    };
}

async function executeEngine(inputFile: string, actionType: ActionType, options: ProcessOptions): Promise<BatchResult> {
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
                return { inputFile, success: true, skipped: true };
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
                return { inputFile, outputPath, success: true };
            }
            return { inputFile, outputPath, success: true };
        }

        if (options.json) {
            spinner.stop(); // silent stop — no human text on stdout
        } else {
            spinner.succeed(chalk.green(`Output saved to: ${outputPath}`));
            // --verbose: show sizes and ratio
            if (options.verbose && fs.existsSync(inputFile) && outputPath && fs.existsSync(outputPath)) {
                const inSize = fs.statSync(inputFile).size;
                const outSize = fs.statSync(outputPath).size;
                console.log(chalk.gray(`  Input:  ${(inSize / 1024).toFixed(1)}KB  →  Output: ${(outSize / 1024).toFixed(1)}KB  (${(outSize / inSize * 100).toFixed(1)}%)`));
            }
        }
        return { inputFile, outputPath, success: true };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        spinner.fail(chalk.red(`${formatAction(actionType)} failed`));
        if (options.json) {
            return { inputFile, success: false, error: message };
        } else {
            console.error(chalk.red(`\n${message}\n`));
        }
        return { inputFile, success: false, error: message };
    }
}

async function runBatch(inputFiles: string[], actionType: ActionType, optionsForFile: (inputFile: string) => ProcessOptions) {
    const json = optionsForFile(inputFiles[0]).json;
    const quiet = optionsForFile(inputFiles[0]).quiet;
    const results: BatchResult[] = [];

    for (const inputFile of inputFiles) {
        results.push(await executeEngine(inputFile, actionType, optionsForFile(inputFile)));
    }

    const summary = summarizeResults(results);
    const success = summary.failed === 0;

    if (json) {
        if (inputFiles.length === 1) {
            const [result] = results;
            console.log(JSON.stringify({
                success: result.success,
                ...(optionsForFile(inputFiles[0]).dryRun ? { dryRun: true } : {}),
                inputFile: result.inputFile,
                ...(result.outputPath ? { outputPath: result.outputPath } : {}),
                action: actionType,
                ...(result.error ? { error: result.error } : {}),
            }, null, 2));
        } else {
            console.log(JSON.stringify({
                success,
                ...(optionsForFile(inputFiles[0]).dryRun ? { dryRun: true } : {}),
                action: actionType,
                results,
                summary,
            }, null, 2));
        }
    } else if (!quiet && inputFiles.length > 1) {
        console.log(chalk.bold(`\nBatch summary: ${summary.succeeded} succeeded, ${summary.failed} failed, ${summary.skipped} skipped (${summary.total} total).`));
    }

    if (!success) process.exit(1);
}

// --- EXTRACT COMMAND ---
program
  .command('extract <args...>')
  .description('Extract audio from a video file')
  .action(async (args: string[], options, command) => {
    const [trackType, separator, ...inputFiles] = args;
    if (!trackType || !separator || separator.toLowerCase() !== 'from') {
        console.error(chalk.red(`\n✗ Invalid syntax. Use: omx extract <type> from <file>\n  Example: omx extract audio from video.mp4\n`));
        process.exit(2);
    }
    validateNodeVersion();
    const globalOpts = normalizeGlobalOptions(command);

    if (trackType.toLowerCase() !== 'audio') {
        console.error(chalk.red(`\n✗ Only audio extraction is supported right now.\n  Use: omx extract audio from <file>\n`));
        process.exit(2);
    }

    if (inputFiles.length === 0) {
        console.error(chalk.red(`\n✗ Missing input file. Use: omx extract audio from <file>\n`));
        process.exit(2);
    }

    const audioExts = ['.mp3', '.wav', '.aac', '.flac', '.m4a', '.ogg', '.opus'];
    const filtered = inputFiles.filter((inputFile) => {
        const inputExt = path.extname(inputFile).toLowerCase();
        if (!audioExts.includes(inputExt)) return true;
        if (!globalOpts.quiet && !globalOpts.json) {
            console.error(chalk.yellow(`\n⚠️  ${inputFile} is already an audio file.`));
            console.error(chalk.yellow(`   Extract pulls audio from video files.`));
            console.error(chalk.yellow(`   To convert formats: omx convert ${inputFile} to mp3\n`));
        }
        return false;
    });
    if (filtered.length === 0) process.exit(0);
    await runBatch(filtered, 'extract', () => ({ ...globalOpts, ...options, actionType: 'extract', targetFormat: 'mp3' }));
  });

// --- CONVERT COMMAND ---
program
  .command('convert <args...>')
  .description('Convert a document, image, or video to a different format')
  .option('--refine', 'Use AI Vision OCR to preserve complex layouts/scanned text')
  .action(async (args: string[], options, command) => {
    const parsed = splitNaturalArgs(args, 'to');
    if (!parsed || parsed.rest.length !== 1) {
      console.error(chalk.red(`\n✗ Invalid syntax. Use: omx convert <file> to <format>\n  Example: omx convert report.pdf to markdown\n`));
      process.exit(2);
    }
    validateNodeVersion();
    const globalOpts = normalizeGlobalOptions(command);
    const targetFormat = parsed.rest[0];
    await runBatch(parsed.inputFiles, 'convert', () => ({ ...globalOpts, ...options, actionType: 'convert', targetFormat }));
  });

// --- COMPRESS COMMAND ---
program
  .command('compress <args...>')
  .description('Compress a media file to a target size or percentage')
  .action(async (args: string[], options, command) => {
    const parsed = splitNaturalArgs(args, 'to');
    if (!parsed || parsed.rest.length !== 1) {
        console.error(chalk.red(`\n✗ Invalid syntax. Use: omx compress <file> to <target>\n  Example: omx compress photo.png to 50%\n`));
        process.exit(2);
    }
    validateNodeVersion();
    const globalOpts = normalizeGlobalOptions(command);
    const targetAmount = parsed.rest[0];
    await runBatch(parsed.inputFiles, 'compress', () => ({ ...globalOpts, ...options, actionType: 'compress', compressTarget: targetAmount }));
  });

// --- TRIM COMMAND ---
program
  .command('trim <args...>')
  .description('Trim a video or audio file')
  .action(async (args: string[], options, command) => {
    const fromIndex = args.findIndex((arg) => arg.toLowerCase() === 'from');
    const toIndex = args.findIndex((arg) => arg.toLowerCase() === 'to');
    if (fromIndex <= 0 || toIndex !== fromIndex + 2 || toIndex !== args.length - 2) {
        console.error(chalk.red(`\n✗ Invalid syntax. Use: omx trim <file> from <start> to <end>\n  Example: omx trim clip.mp4 from 0:30 to 1:45\n`));
        process.exit(2);
    }
    validateNodeVersion();
    const globalOpts = normalizeGlobalOptions(command);
    const inputFiles = args.slice(0, fromIndex);
    const startTime = args[fromIndex + 1];
    const endTime = args[toIndex + 1];
    await runBatch(inputFiles, 'trim', (inputFile) => ({
        ...globalOpts,
        ...options,
        actionType: 'trim',
        trimStart: startTime,
        trimEnd: endTime,
        targetFormat: path.extname(inputFile).replace('.', ''),
    }));
  });

// --- RESIZE COMMAND ---
program
  .command('resize <args...>')
  .description('Resize an image')
  .action(async (args: string[], options, command) => {
    const parsed = splitNaturalArgs(args, 'to');
    if (!parsed || parsed.rest.length !== 1) {
        console.error(chalk.red(`\n✗ Invalid syntax. Use: omx resize <file> to <targetSize>\n  Example: omx resize photo.png to 800px\n`));
        process.exit(2);
    }
    validateNodeVersion();
    const globalOpts = normalizeGlobalOptions(command);
    const targetSize = parsed.rest[0];
    await runBatch(parsed.inputFiles, 'resize', (inputFile) => ({ ...globalOpts, ...options, actionType: 'resize', targetSize, targetFormat: path.extname(inputFile).replace('.', '') }));
  });

const completionScripts: Record<string, string> = {
    bash: `# omx bash completion
_omx_completion() {
  local cur prev commands shells
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  commands="convert compress trim extract resize doctor config completion"
  shells="bash zsh fish"
  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
  elif [[ "\${COMP_WORDS[1]}" == "completion" ]]; then
    COMPREPLY=( $(compgen -W "\${shells}" -- "\${cur}") )
  elif [[ "\${prev}" == "to" ]]; then
    COMPREPLY=( $(compgen -W "markdown md txt jpg jpeg png webp avif gif mp4 mov mkv webm mp3 wav aac flac" -- "\${cur}") )
  fi
}
complete -F _omx_completion omx
`,
    zsh: `#compdef omx
_omx() {
  local -a commands formats shells
  commands=(
    'convert:convert a document, image, or video'
    'compress:reduce file size'
    'trim:trim audio or video'
    'extract:extract audio from video'
    'resize:resize an image'
    'doctor:verify dependencies'
    'config:get or set configuration'
    'completion:print shell completion script'
  )
  formats=(markdown md txt jpg jpeg png webp avif gif mp4 mov mkv webm mp3 wav aac flac)
  shells=(bash zsh fish)
  _arguments \
    '1:command:->command' \
    '*::arg:->args'
  case $state in
    command) _describe 'commands' commands ;;
    args)
      if [[ $words[2] == completion ]]; then
        _describe 'shells' shells
      else
        _files
        compadd -- to from $formats
      fi
      ;;
  esac
}
_omx "$@"
`,
    fish: `# omx fish completion
complete -c omx -f -n '__fish_use_subcommand' -a 'convert' -d 'Convert a document, image, or video'
complete -c omx -f -n '__fish_use_subcommand' -a 'compress' -d 'Reduce file size'
complete -c omx -f -n '__fish_use_subcommand' -a 'trim' -d 'Trim audio or video'
complete -c omx -f -n '__fish_use_subcommand' -a 'extract' -d 'Extract audio from video'
complete -c omx -f -n '__fish_use_subcommand' -a 'resize' -d 'Resize an image'
complete -c omx -f -n '__fish_use_subcommand' -a 'doctor' -d 'Verify dependencies'
complete -c omx -f -n '__fish_use_subcommand' -a 'config' -d 'Get or set configuration'
complete -c omx -f -n '__fish_use_subcommand' -a 'completion' -d 'Print shell completion script'
complete -c omx -f -n '__fish_seen_subcommand_from completion' -a 'bash zsh fish'
complete -c omx -f -a 'to from markdown md txt jpg jpeg png webp avif gif mp4 mov mkv webm mp3 wav aac flac'
`,
};

export function getCompletionScript(shell: string): string | null {
    return completionScripts[shell] ?? null;
}

// --- COMPLETION COMMAND ---
program
  .command('completion <shell>')
  .description('Print shell completion script for bash, zsh, or fish')
  .action((shell) => {
    const script = getCompletionScript(shell.toLowerCase());
    if (!script) {
        console.error(chalk.red(`\n✗ Unsupported shell "${shell}". Use: omx completion bash|zsh|fish\n`));
        process.exit(2);
    }
    process.stdout.write(script);
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
export function validateNodeVersion(logSuccess = false) {
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

if (process.env.NODE_ENV !== 'test') {
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
}
