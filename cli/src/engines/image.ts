import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

function normalizeImageFormat(targetFormat: string) {
    const format = targetFormat.toLowerCase().replace(/^\./, '');
    return format === 'jpeg' ? 'jpg' : format;
}

export async function processImage(inputFile: string, targetFormat: string, options: any) {
    const { dir, name } = path.parse(inputFile);
    const format = normalizeImageFormat(targetFormat);
    const outputPath = path.join(dir, `${name}_${options.actionType || 'conv'}.${format}`);

    if (options.dryRun) {
        const target = String(options.compressTarget || options.targetSize || '').trim();
        const sizeSuffix = target ? ` [target: ${target}]` : '';
        if (!options.quiet && !options.json) {
            const inputKB = fs.existsSync(inputFile) ? (fs.statSync(inputFile).size / 1024).toFixed(0) : '?';
            console.log(`Dry run: would execute sharp(${inputFile}).toFile(${outputPath})${sizeSuffix} [current: ${inputKB}KB]`);
        }
        return outputPath;
    }

    if (!fs.existsSync(inputFile)) {
        throw new Error(`File not found: ${inputFile}`);
    }

    if (options.actionType === 'compress' || options.actionType === 'resize') {
        const target = String(options.compressTarget || options.targetSize || '').toLowerCase();
        if (target.endsWith('%')) {
            const pct = Math.min(100, Math.max(1, parseInt(target.replace('%', ''))));
            // Scale quality proportionally: 100% → quality 90, 50% → quality 45, 10% → quality 9
            options.quality = Math.max(1, Math.round(pct * 0.9));
        } else if (target.endsWith('mb') || target.endsWith('kb')) {
            options.quality = 85; // start high for lossy formats
        } else if (target.endsWith('px')) {
            options.width = parseInt(target.replace('px', ''));
        }
    }

    // PNG is lossless — PNG→PNG "compression" via zlib level can actually inflate files.
    // For compress actions on PNG, automatically route to WebP (typically 90%+ smaller).
    let effectiveFormat = format;
    let effectiveOutputPath = outputPath;
    if (options.actionType === 'compress' && format === 'png') {
        effectiveFormat = 'webp';
        effectiveOutputPath = outputPath.replace(/\.png$/, '.webp');
        if (!options.quiet && !options.json) {
            console.log(chalk.cyan(`ℹ️  PNG is lossless — compressing as WebP instead (much smaller output).`));
        }
    }

    if (fs.existsSync(effectiveOutputPath) && !options.overwrite) {
        throw new Error(`Output file ${effectiveOutputPath} already exists. Use --overwrite to bypass.`);
    }

    const image = sharp(inputFile);

    // Resize if width/height requested
    if (options.width || options.height) {
        image.resize({
            width: options.width ? parseInt(options.width) : undefined,
            height: options.height ? parseInt(options.height) : undefined,
            fit: 'inside',
            withoutEnlargement: true
        });
    }

    const inputSize = fs.statSync(inputFile).size;

    try {
        switch (effectiveFormat) {
            case 'jpeg':
            case 'jpg':
                await image.jpeg({ quality: options.quality ?? 80 }).toFile(effectiveOutputPath);
                break;
            case 'png':
                // No palette:true — it inflates many PNGs
                await image.png({ compressionLevel: 9 }).toFile(effectiveOutputPath);
                break;
            case 'webp':
                await image.webp({ quality: options.quality ?? 80 }).toFile(effectiveOutputPath);
                break;
            case 'avif':
                await image.avif({ quality: options.quality ?? 50 }).toFile(effectiveOutputPath);
                break;
            case 'gif':
                await image.gif().toFile(effectiveOutputPath);
                break;
            default:
                throw new Error(`Unsupported image format: ${effectiveFormat}. Supported formats: jpg, png, webp, avif, gif`);
        }

        // Post-write size comparison for compress operations
        if (options.actionType === 'compress') {
            const outputSize = fs.statSync(effectiveOutputPath).size;
            if (outputSize >= inputSize && !options.quiet && !options.json) {
                console.warn(`\n⚠️  Output (${(outputSize / 1024).toFixed(0)}KB) is not smaller than input (${(inputSize / 1024).toFixed(0)}KB).`);
                console.warn(`   File may already be highly optimized.`);
            }
        }

        return effectiveOutputPath;
    } catch (err: any) {
        throw new Error(`Sharp Image Processing Error: ${err.message}`);
    }
}
