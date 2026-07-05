import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { getConfig } from '../utils/config.js';
import { execFile } from 'child_process';
import type { ProcessOptions } from '../types.js';

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

export async function processDocument(inputFile: string, targetFormat: string, options: ProcessOptions) {
    const ext = path.extname(inputFile).toLowerCase();
    const normalizedTarget = normalizeDocumentFormat(targetFormat);
    const parsed = path.parse(inputFile);
    const outputPath = path.join(parsed.dir, parsed.name) + `_${options.actionType || 'conv'}.` + normalizedTarget;

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

        let GoogleGenAI: typeof import('@google/genai').GoogleGenAI;
        try {
            ({ GoogleGenAI } = await import('@google/genai'));
        } catch {
            throw new Error(
                "AI refinement requires the optional @google/genai package.\n" +
                "Install optional dependencies with: npm install -g omx-cmd --include=optional\n" +
                "Then set GEMINI_API_KEY and retry."
            );
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
            const text = await extractTextFromPdf(inputFile, options);
            fs.writeFileSync(outputPath, text);
        } catch (error: any) {
            throw new Error(`Local PDF Extraction failed: ${error.message}`);
        }
    } else {
        // Standard Local Pandoc Execution for Word, PPT, etc.
        try {
            const pandocArgs = [inputFile, '-o', outputPath];
            if (normalizedTarget === 'md' && (ext === '.docx' || ext === '.doc')) {
                // Without --extract-media, pandoc's docx->md conversion still
                // writes an image reference (e.g. media/rId9.png) into the
                // markdown, but never actually extracts the embedded media -
                // producing a dead link. Extract alongside the output file.
                const mediaDir = path.join(parsed.dir, parsed.name) + '_media';
                pandocArgs.push('--extract-media', mediaDir);
            }
            if (normalizedTarget === 'pdf') {
                pandocArgs.push(
                    '--pdf-engine=xelatex',
                    // 0.75in margins give ~7in text width on letter paper → much better
                    // page coverage than the old 1in default (6.5in text width).
                    '-V', 'geometry:top=0.75in,bottom=0.75in,left=0.9in,right=0.9in',
                    '-V', 'fontsize=12pt',
                    // Slightly open line-spacing improves readability on dense text files.
                    '-V', 'linestretch=1.15'
                );
            }
            await new Promise<void>((resolve, reject) => {
                execFile('pandoc', pandocArgs, (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
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

async function compressPdf(inputFile: string, outputPath: string, options: ProcessOptions) {
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

// Presentation-form ligatures that some PDF fonts embed as single glyphs.
// pdf.js extracts these as their own codepoint, which downstream tools
// (spellcheck, search, markdown renderers) don't expect - expand them back
// to their constituent letters.
const LIGATURE_MAP: Record<string, string> = {
    'ﬀ': 'ff',
    'ﬁ': 'fi',
    'ﬂ': 'fl',
    'ﬃ': 'ffi',
    'ﬄ': 'ffl',
};

function expandLigatures(text: string): string {
    return text.replace(/[ﬀ-ﬄ]/g, (ch) => LIGATURE_MAP[ch] ?? ch);
}

async function extractTextFromPdf(filepath: string, options?: Pick<ProcessOptions, 'quiet' | 'json'>): Promise<string> {
    const data = new Uint8Array(fs.readFileSync(filepath));
    const doc = await getDocument({ data, useSystemFonts: true }).promise;
    let fullText = "";

    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();

        let pageText = "";
        let prevEndX: number | null = null;
        let prevEndY: number | null = null;

        for (const item of content.items) {
            if (!('str' in item)) continue;
            const str = item.str;
            const transform = 'transform' in item ? item.transform : null;
            const x = transform ? transform[4] : null;
            const y = transform ? transform[5] : null;
            const width = 'width' in item ? item.width : 0;

            if (prevEndX !== null && x !== null && y !== null) {
                if (prevEndY !== null && Math.abs(y - prevEndY) > 2) {
                    // New line: pdf.js emits explicit "" hasEOL markers too,
                    // but this catches line breaks within the same item run.
                    pageText += "\n";
                } else if (x - prevEndX > 1) {
                    // A real horizontal gap between glyph runs: treat as a
                    // word/space boundary. Chrome-printed PDFs split words
                    // into many small text items that abut exactly (no gap),
                    // so joining unconditionally with " " previously inserted
                    // a space between every glyph run, mangling words like
                    // "café" and "São Paulo" into single letters.
                    if (!pageText.endsWith(" ") && !str.startsWith(" ")) {
                        pageText += " ";
                    }
                }
            }

            pageText += str;

            if (str.length > 0 && x !== null && width) {
                prevEndX = x + width;
                prevEndY = y;
            }

            if ('hasEOL' in item && item.hasEOL) {
                pageText += "\n";
                prevEndX = null;
                prevEndY = null;
            }
        }

        fullText += pageText + "\n\n";
    }

    // NUL bytes mean the PDF font had no ToUnicode mapping for some glyphs
    // (common with Hindi conjuncts / CJK / Arabic in printed PDFs). Detect
    // before stripping so we can warn.
    const hasLostGlyphs = fullText.includes(' ') || fullText.includes('�');
    fullText = fullText.replace(/[ �]/g, '');

    // Map Arabic contextual presentation forms back to base characters,
    // then normalize to NFC and expand Latin ligatures.
    fullText = fullText.replace(/[ﭐ-﷿ﹰ-﻿]/g, (ch) => ch.normalize('NFKC'));
    fullText = expandLigatures(fullText.normalize('NFC'));

    const charsPerPage = fullText.length / doc.numPages;
    if ((hasLostGlyphs || charsPerPage < 20) && !options?.quiet && !options?.json) {
        console.warn(chalk.yellow(
            "\n⚠️ Warning: Some characters could not be extracted from this PDF\n" +
            "  (missing font-to-unicode mappings, common with Hindi/Chinese/Arabic text).\n" +
            "  Consider using --refine to let AI reconstruct the full content."
        ));
    }

    return fullText;
}

export async function preflightPDF(filepath: string, options: Pick<ProcessOptions, 'quiet' | 'json' | 'targetFormat'> & { refine?: boolean }): Promise<boolean> {
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
        
        content.items.forEach((item) => {
            if ('str' in item && item.str) totalChars += item.str.length;
            if ('transform' in item && item.transform) {
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
