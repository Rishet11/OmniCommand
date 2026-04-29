#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { processDocument } from "./engines/document.js";
import { processImage } from "./engines/image.js";
import { processVideo } from "./engines/video.js";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

// Initialize the OmniCommand MCP Server
const server = new McpServer({
  name: "omnicommand",
  version: pkg.version,
});

// Helper to determine which engine to use based on extension
async function routeToEngine(inputFile: string, actionType: string, targetValue: string, options: any = {}) {
  const ext = path.extname(inputFile).toLowerCase();
  const sourceFormat = path.extname(inputFile).replace('.', '');
  
  const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.tiff', '.bmp', '.ico'];
  const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.3gp', '.mp3', '.wav', '.aac', '.flac', '.m4a', '.ogg', '.opus'];
  const documentExts = ['.pdf', '.docx', '.doc', '.pptx', '.xlsx', '.rtf', '.txt', '.md', '.markdown'];

  const engineOptions = { 
    ...options, 
    actionType,
    quiet: true,
    json: true 
  };

  if (documentExts.includes(ext)) {
    if (actionType === 'compress') {
      engineOptions.compressTarget = targetValue;
      return await processDocument(inputFile, sourceFormat, engineOptions);
    }
    if (actionType === 'convert') {
      return await processDocument(inputFile, targetValue, engineOptions);
    }
    throw new Error(`Unsupported document action: ${actionType}`);
  } else if (imageExts.includes(ext)) {
    if (actionType === 'compress') {
        engineOptions.compressTarget = targetValue;
        return await processImage(inputFile, sourceFormat, engineOptions);
    }
    if (actionType === 'convert') {
        return await processImage(inputFile, targetValue, engineOptions);
    }
    throw new Error(`Unsupported image action: ${actionType}`);
  } else if (videoExts.includes(ext)) {
    if (actionType === 'compress') {
        engineOptions.compressTarget = targetValue;
        return await processVideo(inputFile, sourceFormat, engineOptions);
    }
    if (actionType === 'trim') {
        const [start, end] = targetValue.split('|');
        engineOptions.trimStart = start;
        engineOptions.trimEnd = end;
        return await processVideo(inputFile, sourceFormat, engineOptions);
    }
    if (actionType === 'convert') {
        return await processVideo(inputFile, targetValue, engineOptions);
    }
    throw new Error(`Unsupported video action: ${actionType}`);
  } else {
    throw new Error(`Unsupported file extension: ${ext}`);
  }
}

// 1. Convert Tool
server.tool(
  "convert",
  "Convert a document, image, or video to a different format",
  {
    inputFile: z.string().describe("Absolute path to the input file"),
    targetFormat: z.string().describe("The desired output format (e.g., 'webp', 'mp4', 'markdown')"),
    refine: z.boolean().optional().describe("Use AI Vision OCR for complex PDF layouts"),
  },
  async ({ inputFile, targetFormat, refine }) => {
    try {
      const outputPath = await routeToEngine(inputFile, "convert", targetFormat, { refine });
      return {
        content: [{ type: "text", text: `Successfully converted to: ${outputPath}` }],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: "text", text: error.message }],
      };
    }
  }
);

// 2. Compress Tool
server.tool(
  "compress",
  "Compress a media file (image, video, or PDF) to a target size or percentage",
  {
    inputFile: z.string().describe("Absolute path to the input file"),
    targetAmount: z.string().describe("Target size or percentage (e.g., '50%', '2MB', '800px')"),
  },
  async ({ inputFile, targetAmount }) => {
    try {
      const outputPath = await routeToEngine(inputFile, "compress", targetAmount);
      return {
        content: [{ type: "text", text: `Successfully compressed to: ${outputPath}` }],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: "text", text: error.message }],
      };
    }
  }
);

// 3. Trim Tool
server.tool(
  "trim",
  "Trim a video or audio file between two timestamps",
  {
    inputFile: z.string().describe("Absolute path to the input file"),
    startTime: z.string().describe("Start timestamp (e.g., '0:30' or '00:00:30')"),
    endTime: z.string().describe("End timestamp (e.g., '1:45' or '00:01:45')"),
  },
  async ({ inputFile, startTime, endTime }) => {
    try {
      const outputPath = await routeToEngine(inputFile, "trim", `${startTime}|${endTime}`);
      return {
        content: [{ type: "text", text: `Successfully trimmed to: ${outputPath}` }],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: "text", text: error.message }],
      };
    }
  }
);

// Main Entry Point
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("OmniCommand MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error starting MCP server:", error);
  process.exit(1);
});
