#!/usr/bin/env node
import { processDocument } from "./engines/document.js";
import { processImage } from "./engines/image.js";
import { processVideo } from "./engines/video.js";
import path from "path";
import { createRequire } from "module";
import { z } from "zod";
import type { ActionType, ProcessOptions } from "./types.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

// Helper to determine which engine to use based on extension
export async function routeToEngine(inputFile: string, actionType: ActionType, targetValue: string, options: Partial<ProcessOptions> = {}) {
  const ext = path.extname(inputFile).toLowerCase();
  const sourceFormat = path.extname(inputFile).replace('.', '');
  
  const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.tiff', '.bmp', '.ico'];
  const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.3gp', '.mp3', '.wav', '.aac', '.flac', '.m4a', '.ogg', '.opus'];
  const documentExts = ['.pdf', '.docx', '.doc', '.pptx', '.xlsx', '.rtf', '.txt', '.md', '.markdown'];

  if (documentExts.includes(ext)) {
    if (actionType === 'compress') {
      const engineOptions = { ...options, actionType, compressTarget: targetValue, quiet: true, json: true } as ProcessOptions;
      return await processDocument(inputFile, sourceFormat, engineOptions);
    }
    if (actionType === 'convert') {
      const engineOptions = { ...options, actionType, targetFormat: targetValue, quiet: true, json: true } as ProcessOptions;
      return await processDocument(inputFile, targetValue, engineOptions);
    }
    throw new Error(`Unsupported document action: ${actionType}`);
  } else if (imageExts.includes(ext)) {
    if (actionType === 'compress') {
        const engineOptions = { ...options, actionType, compressTarget: targetValue, quiet: true, json: true } as ProcessOptions;
        return await processImage(inputFile, sourceFormat, engineOptions);
    }
    if (actionType === 'convert') {
        const engineOptions = { ...options, actionType, targetFormat: targetValue, quiet: true, json: true } as ProcessOptions;
        return await processImage(inputFile, targetValue, engineOptions);
    }
    throw new Error(`Unsupported image action: ${actionType}`);
  } else if (videoExts.includes(ext)) {
    if (actionType === 'compress') {
        const engineOptions = { ...options, actionType, compressTarget: targetValue, quiet: true, json: true } as ProcessOptions;
        return await processVideo(inputFile, sourceFormat, engineOptions);
    }
    if (actionType === 'trim') {
        const [start, end] = targetValue.split('|');
        const engineOptions = { ...options, actionType, trimStart: start, trimEnd: end, quiet: true, json: true } as ProcessOptions;
        return await processVideo(inputFile, sourceFormat, engineOptions);
    }
    if (actionType === 'convert') {
        const engineOptions = { ...options, actionType, targetFormat: targetValue, quiet: true, json: true } as ProcessOptions;
        return await processVideo(inputFile, targetValue, engineOptions);
    }
    throw new Error(`Unsupported video action: ${actionType}`);
  } else {
    throw new Error(`Unsupported file extension: ${ext}`);
  }
}

// Main Entry Point
async function main() {
  let McpServer: typeof import("@modelcontextprotocol/sdk/server/mcp.js").McpServer;
  let StdioServerTransport: typeof import("@modelcontextprotocol/sdk/server/stdio.js").StdioServerTransport;
  try {
    ({ McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js"));
    ({ StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js"));
  } catch {
    throw new Error(
      "MCP support requires the optional @modelcontextprotocol/sdk package.\n" +
      "Install optional dependencies with: npm install -g omx-cmd --include=optional"
    );
  }

  const server = new McpServer({
    name: "omnicommand",
    version: pkg.version,
  });

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
          content: [{ type: "text" as const, text: `Successfully converted to: ${outputPath}` }],
        };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
          content: [{ type: "text" as const, text: message }],
      };
    }
    }
  );

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
          content: [{ type: "text" as const, text: `Successfully compressed to: ${outputPath}` }],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          isError: true,
          content: [{ type: "text" as const, text: message }],
        };
      }
    }
  );

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
          content: [{ type: "text" as const, text: `Successfully trimmed to: ${outputPath}` }],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          isError: true,
          content: [{ type: "text" as const, text: message }],
        };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("OmniCommand MCP Server running on stdio");
}

if (process.env.NODE_ENV !== "test") {
  main().catch((error) => {
    console.error("Fatal error starting MCP server:", error);
    process.exit(1);
  });
}
