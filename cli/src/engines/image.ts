import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

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
            console.log(`Dry run: would execute sharp(${inputFile}).toFile(${outputPath})${sizeSuffix}`);
        }
        return outputPath;
    }

    if (!fs.existsSync(inputFile)) {
        throw new Error(`File not found: ${inputFile}`);
    }

    if (fs.existsSync(outputPath) && !options.overwrite) {
        throw new Error(`Output file ${outputPath} already exists. Use --overwrite to bypass.`);
    }

    const image = sharp(inputFile);

    if (options.actionType === 'compress' || options.actionType === 'resize') {
        const target = String(options.compressTarget || options.targetSize || '').toLowerCase();
        if (target.endsWith('%')) {
           options.quality = 50; // Simple simulation of generic 50% compress
           options.pngCompression = 9;
        } else if (target.endsWith('mb') || target.endsWith('kb')) {
           options.quality = 60; // Simulation of absolute target size
           options.pngCompression = 8;
        } else if (target.endsWith('px')) {
           options.width = parseInt(target.replace('px', ''));
        }
    }

    // Optional: basic image processing flags
    if (options.width || options.height) {
        image.resize({
            width: options.width ? parseInt(options.width) : undefined,
            height: options.height ? parseInt(options.height) : undefined,
            fit: 'inside',
            withoutEnlargement: true
        });
    }

    try {
        switch (format) {
            case 'jpeg':
            case 'jpg':
                await image.jpeg({ quality: options.quality ? parseInt(options.quality) : 80 }).toFile(outputPath);
                break;
            case 'png':
                const pngOpts: any = {};
                if (options.pngCompression) {
                    pngOpts.compressionLevel = options.pngCompression;
                    pngOpts.palette = true;
                }
                await image.png(pngOpts).toFile(outputPath);
                break;
            case 'webp':
                await image.webp({ quality: options.quality ? parseInt(options.quality) : 80 }).toFile(outputPath);
                break;
            case 'avif':
                await image.avif({ quality: options.quality ? parseInt(options.quality) : 50 }).toFile(outputPath);
                break;
            case 'gif':
                await image.gif().toFile(outputPath);
                break;
            default:
                throw new Error(`Unsupported image format: ${format}. Supported formats: jpg, png, webp, avif, gif`);
        }
        return outputPath;
    } catch (err: any) {
        throw new Error(`Sharp Image Processing Error: ${err.message}`);
    }
}
