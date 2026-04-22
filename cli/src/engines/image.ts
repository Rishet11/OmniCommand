import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export async function processImage(inputFile: string, targetFormat: string, options: any) {
    if (!fs.existsSync(inputFile)) {
        throw new Error(`File not found: ${inputFile}`);
    }

    const { dir, name } = path.parse(inputFile);
    // Sanitize format
    const format = targetFormat.toLowerCase().replace('.', '');
    const outputPath = path.join(dir, `${name}_${options.actionType || 'conv'}.${format}`);

    const image = sharp(inputFile);

    if (options.actionType === 'compress') {
        const target = options.compressTarget.toLowerCase();
        if (target.endsWith('%')) {
           options.quality = 50; // Simple simulation of generic 50% compress
        } else if (target.endsWith('mb') || target.endsWith('kb')) {
           options.quality = 60; // Simulation of absolute target size
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
                await image.png().toFile(outputPath);
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
