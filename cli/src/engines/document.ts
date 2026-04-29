import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { GoogleGenAI } from '@google/genai';
import { getConfig } from '../utils/config.js';
import { execFile } from 'child_process';
import util from 'util';

const execFileAsync = util.promisify(execFile);

function normalizeDocumentFormat(targetFormat: string) {
    const format = targetFormat.toLowerCase().replace(/^\./, '');
    switch (format) {
        case 'markdown':
            return 'md';
        case 'jpeg':
            return 'jpg';
        case 'text':
            return 'txt';
        default:
            return format;
    }
}

function isLocalPdfTargetSupported(targetFormat: string) {
    return ['md', 'txt'].includes(targetFormat);
}

export async function processDocument(inputFile: string, targetFormat: string, options: any) {
    const ext = path.extname(inputFile).toLowerCase();
    const normalizedTarget = normalizeDocumentFormat(targetFormat);
    const outputPath = inputFile.replace(/\.[^/.]+$/, '') + `_${options.actionType || 'conv'}.` + normalizedTarget;

    if (options.dryRun) {
        if (!options.quiet && !options.json) {
            if (options.actionType === 'compress' && ext !== '.pdf') {
                console.log(chalk.cyan(`Dry run: document compression only supports PDF files right now.`));
            } else if (ext === '.pdf' && options.actionType === 'convert') {
                if (options.refine) {
                    console.log(chalk.cyan(`Dry run: would upload ${inputFile} to Gemini and write ${outputPath}`));
                } else if (isLocalPdfTargetSupported(normalizedTarget)) {
                    console.log(chalk.cyan(`Dry run: would extract text from ${inputFile} and write ${outputPath}`));
                } else {
                    console.log(chalk.cyan(`Dry run: local PDF conversion to ${normalizedTarget} is not supported. Use --refine or choose md/txt.`));
                }
            } else if (ext === '.pdf' && options.actionType === 'compress') {
                console.log(chalk.cyan(`Dry run: would compress PDF structure and write ${outputPath}`));
            } else {
                console.log(chalk.cyan(`Dry run: would execute pandoc ${inputFile} -o ${outputPath}`));
            }
        }
        return outputPath;
    }

    if (!fs.existsSync(inputFile)) {
        throw new Error(`File not found: ${inputFile}`);
    }

    if (options.actionType === 'compress' && ext !== '.pdf') {
        throw new Error(`Document compression is only supported for PDF files right now.`);
    }

    if (ext === '.pdf' && options.actionType === 'convert' && !options.refine && !isLocalPdfTargetSupported(normalizedTarget)) {
        throw new Error(`Local PDF conversion only supports markdown/txt output. Use --refine for richer formatting, or choose md/txt.`);
    }

    if (ext === '.pdf' && options.actionType === 'convert' && isLocalPdfTargetSupported(normalizedTarget)) {
        await preflightPDF(inputFile, options);
    }

    if (fs.existsSync(outputPath) && !options.overwrite) {
        throw new Error(`Output file ${outputPath} already exists. Use --overwrite to bypass.`);
    }
    
    if (ext === '.pdf' && options.actionType === 'compress') {
        return await compressPdf(inputFile, outputPath, options);
    }

    if (ext === '.pdf' && options.actionType === 'convert' && options.refine) {
        // AI Vision Layout Extraction
        const apiKey = process.env.GEMINI_API_KEY || getConfig('GEMINI_API_KEY');
        if (!apiKey) {
            throw new Error(
                "AI refinement requires a Gemini API key.\n" + 
                "Run: omx config set GEMINI_API_KEY your_api_key_here\n" + 
                "Get one free at: https://aistudio.google.com/"
            );
        }

        const stats = fs.statSync(inputFile);
        const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
        if (!options.quiet && !options.json) {
            console.log(chalk.cyan(`\nℹ️ Uploading ${fileSizeMB}MB to Gemini for AI extraction.`));
            console.log(chalk.gray(`   Actual cost depends on your API plan: https://ai.google.dev/pricing`));
        }

        const ai = new GoogleGenAI({ apiKey });
        
        try {
            const uploadResult = await ai.files.upload({
                file: inputFile,
            });

            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: [
                    uploadResult,
                    { text: `Convert this PDF into clean, raw ${targetFormat}. Preserve all tables, headers, and text structures with utmost precision. DO NOT include markdown codeblock wrappings in your final output, just return the raw text.` }
                ]
            });

            fs.writeFileSync(outputPath, response.text || "");
        } catch (error: any) {
             throw new Error(`AI Refinement failed: ${error.message}`);
        }
    } else if (ext === '.pdf') {
        // Local PDF Text Extraction Fallback (Since Pandoc can't read PDF)
        try {
            if (!isLocalPdfTargetSupported(normalizedTarget)) {
                throw new Error(`Local PDF conversion to ${normalizedTarget} is not supported. Use --refine or choose md/txt.`);
            }
            const text = await extractTextFromPdf(inputFile);
            fs.writeFileSync(outputPath, text);
        } catch (error: any) {
            throw new Error(`Local PDF Extraction failed: ${error.message}`);
        }
    } else {
        // Standard Local Pandoc Execution for Word, PPT, etc.
        try {
            await execFileAsync('pandoc', [inputFile, '-o', outputPath]);
        } catch (e: any) {
            if (e.code === 'ENOENT') {
                throw new Error(
                    "Pandoc is not installed on your system.\n" + 
                    "Please install it (brew install pandoc / apt install pandoc),\n" + 
                    "OR run with --refine to let AI convert it without Pandoc."
                );
            }
            throw new Error(`Pandoc error: ${e.message}`);
        }
    }
    
    return outputPath;
}

async function compressPdf(inputFile: string, outputPath: string, options: any) {
    const existingPdfBytes = fs.readFileSync(inputFile);
    
    // Load the PDF
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    // Strip metadata to save space
    pdfDoc.setCreator('OmniCommand');
    pdfDoc.setProducer('OmniCommand');
    
    // pdf-lib's 'useObjectStreams' is the primary way to compress the internal structure
    // It groups objects into streams, which is much more efficient than the default flat structure
    const pdfBytes = await pdfDoc.save({ 
        useObjectStreams: true,
        addDefaultPage: false
    });
    
    fs.writeFileSync(outputPath, pdfBytes);
    
    // Log the reduction for the user if not in JSON mode
    if (!options.quiet && !options.json) {
        const oldSize = existingPdfBytes.length;
        const newSize = pdfBytes.length;
        const reduction = ((oldSize - newSize) / oldSize * 100).toFixed(1);
        if (oldSize > newSize) {
            console.log(chalk.dim(`  Optimized structure. Reduced size by ${reduction}% (${(oldSize/1024).toFixed(0)}KB → ${(newSize/1024).toFixed(0)}KB)`));
        } else {
            console.log(chalk.dim(`  File is already highly optimized.`));
        }
    }

    return outputPath;
}

async function extractTextFromPdf(filepath: string): Promise<string> {
    const data = new Uint8Array(fs.readFileSync(filepath));
    const doc = await getDocument({ data, useSystemFonts: true }).promise;
    let fullText = "";

    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((item: any) => item.str);
        fullText += strings.join(" ") + "\n\n";
    }

    return fullText;
}

export async function preflightPDF(filepath: string, options: any): Promise<boolean> {
    if (options.refine) {
        if (!options.quiet && !options.json) {
            console.log(chalk.cyan(`\nℹ️ --refine flag detected. Bypassing Pandoc and routing to AI Vision OCR...`));
        }
        return true; 
    }

    const data = new Uint8Array(fs.readFileSync(filepath));
    const doc = await getDocument({ data, useSystemFonts: true }).promise;
    
    let totalChars = 0;
    const xPositions: number[] = [];
    const pagesToCheck = Math.min(doc.numPages, 3);
    
    for (let i = 1; i <= pagesToCheck; i++) { 
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        
        content.items.forEach((item: any) => {
            if (item.str) totalChars += item.str.length;
            if (item.transform) {
                xPositions.push(Math.round(item.transform[4])); 
            }
        });
    }

    if (totalChars < 50) {
        throw new Error(
            "✗ This PDF appears to be a scanned image (no selectable text).\n" +
            "  Local conversion cannot read images.\n\n" +
            "  Fix: Run with --refine to use AI Vision OCR.\n" +
            `  $ omx convert ${filepath} to ${options.targetFormat || 'markdown'} --refine`
        );
    }

    let isTwoColumn = false;
    if (xPositions.length > 50) {
        let buckets = new Set<number>();
        xPositions.forEach(x => buckets.add(Math.floor(x / 50) * 50));
        
        const uniqueX = [...buckets].sort((a, b) => a - b);
        for (let i = 1; i < uniqueX.length; i++) {
            if (uniqueX[i] - uniqueX[i-1] >= 200) {
                isTwoColumn = true;
                break;
            }
        }
    }

    if (isTwoColumn && !options.quiet && !options.json) {
        console.warn(chalk.yellow(
            "\n⚠️ Warning: This PDF appears to use a two-column layout.\n" +
            "  Local text extraction may disrupt the layout.\n" +
            "  Consider using --refine to let AI reconstruct the document structure."
        ));
    }

    return true;
}
