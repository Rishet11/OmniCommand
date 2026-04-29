export type ActionType = 'convert' | 'compress' | 'trim' | 'extract' | 'resize';

export interface EngineOptions {
    actionType?: ActionType;
    quiet?: boolean;
    json?: boolean;
    dryRun?: boolean;
    overwrite?: boolean;
    verbose?: boolean;
    targetFormat?: string;
}

export interface ConvertOptions extends EngineOptions {
    actionType: 'convert';
    targetFormat: string;
    refine?: boolean;
}

export interface CompressOptions extends EngineOptions {
    actionType: 'compress';
    compressTarget: string;
}

export interface TrimOptions extends EngineOptions {
    actionType: 'trim';
    trimStart: string;
    trimEnd: string;
}

export interface ExtractOptions extends EngineOptions {
    actionType: 'extract';
    targetFormat: string;
}

export interface ResizeOptions extends EngineOptions {
    actionType: 'resize';
    targetSize: string;
    width?: number;
    height?: number;
}

export type ProcessOptions = ConvertOptions | CompressOptions | TrimOptions | ExtractOptions | ResizeOptions;

export interface BatchResult {
    inputFile: string;
    outputPath?: string;
    success: boolean;
    error?: string;
    skipped?: boolean;
}

export interface BatchSummary {
    total: number;
    succeeded: number;
    failed: number;
    skipped: number;
}
