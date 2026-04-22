import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as fs from 'fs';
import chalk from 'chalk';
import { GoogleGenAI } from '@google/genai';
import { getConfig } from '../utils/config.js';
import { execFile } from 'child_process';
import util from 'util';

const execFileAsync = util.promisify(execFile);

export async function processPdf(inputFile: string, targetFormat: string, options: any) {
    if (!fs.existsSync(inputFile)) {
        throw new Error(`File not found: ${inputFile}`);
    }

    if (['markdown', 'md', 'txt', 'html'].includes(targetFormat.toLowerCase())) {
        await preflightPDF(inputFile, options);
    }

    const extRegex = new RegExp(`\\.[^/.]+$`);
    const outputPath = inputFile.replace(extRegex, "") + "_conv." + targetFormat;
    
    if (options.refine) {
        // AI Vision Layout Extraction
        const apiKey = process.env.GEMINI_API_KEY || getConfig('GEMINI_API_KEY');
        if (!apiKey) {
            throw new Error(
                "AI refinement requires a Gemini API key.\n" + 
                "Run: omx config set GEMINI_API_KEY your_api_key_here\n" + 
                "Get one free at: https://aistudio.google.com/"
            );
        }

        const ai = new GoogleGenAI({ apiKey });
        
        try {
            const uploadResult = await ai.files.upload({
                file: inputFile,
            });

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    uploadResult,
                    { text: `Convert this PDF into clean, raw ${targetFormat}. Preserve all tables, headers, and text structures with utmost precision. DO NOT include markdown codeblock wrappings in your final output, just return the raw text.` }
                ]
            });

            fs.writeFileSync(outputPath, response.text || "");
        } catch (error: any) {
             throw new Error(`AI Refinement failed: ${error.message}`);
        }
    } else {
        // Standard Local Pandoc Execution
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

export async function preflightPDF(filepath: string, options: any): Promise<boolean> {
    if (options.refine) {
        if (!options.quiet) {
            console.log(chalk.cyan(`\nℹ️ --refine flag detected. Bypassing Pandoc and routing to AI Vision OCR...`));
        }
        return true; // Bypass restrictions because AI Vision can handle scanned/columns
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
            "  Local conversion (Pandoc) cannot read images.\n\n" +
            "  Fix: Run with --refine to use AI Vision OCR.\n" +
            `  $ omx convert ${filepath} to ${options.targetFormat || 'markdown'} --refine`
        );
    }

    let isTwoColumn = false;
    if (xPositions.length > 50) {
        const uniqueX = [...new Set(xPositions)].sort((a, b) => a - b);
        for (let i = 1; i < uniqueX.length; i++) {
            if (uniqueX[i] - uniqueX[i-1] > 200) {
                isTwoColumn = true;
                break;
            }
        }
    }

    if (isTwoColumn && !options.quiet) {
        console.warn(chalk.yellow(
            "\n⚠️ Warning: This PDF appears to use a two-column layout.\n" +
            "  Layouts may be disrupted during Pandoc conversion.\n" +
            "  Consider using --refine to let AI reconstruct the document structure."
        ));
    }

    return true;
}
