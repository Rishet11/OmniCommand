import { describe, it, expect, vi } from 'vitest';
import { routeToEngine } from '../mcp.js';
import * as docEngine from '../engines/document.js';
import * as imgEngine from '../engines/image.js';
import * as vidEngine from '../engines/video.js';

describe('mcp router', () => {
    // Mock the engines
    vi.spyOn(docEngine, 'processDocument').mockResolvedValue('/mock/doc.md');
    vi.spyOn(imgEngine, 'processImage').mockResolvedValue('/mock/img.webp');
    vi.spyOn(vidEngine, 'processVideo').mockResolvedValue('/mock/vid.mp4');

    describe('routeToEngine', () => {
        it('routes document compress correctly', async () => {
            await routeToEngine('test.pdf', 'compress', '50%');
            expect(docEngine.processDocument).toHaveBeenCalledWith(
                'test.pdf', 'pdf', expect.objectContaining({ actionType: 'compress', compressTarget: '50%', json: true, quiet: true })
            );
        });

        it('routes document convert correctly with refine', async () => {
            await routeToEngine('test.pdf', 'convert', 'markdown', { refine: true });
            expect(docEngine.processDocument).toHaveBeenCalledWith(
                'test.pdf', 'markdown', expect.objectContaining({ actionType: 'convert', refine: true })
            );
        });

        it('throws on unsupported document action', async () => {
            await expect(routeToEngine('test.pdf', 'trim', '0:01|0:05'))
                .rejects.toThrow('Unsupported document action: trim');
        });

        it('routes image compress correctly', async () => {
            await routeToEngine('test.png', 'compress', '50%');
            expect(imgEngine.processImage).toHaveBeenCalledWith(
                'test.png', 'png', expect.objectContaining({ actionType: 'compress', compressTarget: '50%' })
            );
        });

        it('routes image convert correctly', async () => {
            await routeToEngine('test.png', 'convert', 'webp');
            expect(imgEngine.processImage).toHaveBeenCalledWith(
                'test.png', 'webp', expect.objectContaining({ actionType: 'convert' })
            );
        });

        it('throws on unsupported image action', async () => {
            await expect(routeToEngine('test.png', 'trim', '0:01|0:05'))
                .rejects.toThrow('Unsupported image action: trim');
        });

        it('routes video compress correctly', async () => {
            await routeToEngine('test.mp4', 'compress', '50%');
            expect(vidEngine.processVideo).toHaveBeenCalledWith(
                'test.mp4', 'mp4', expect.objectContaining({ actionType: 'compress', compressTarget: '50%' })
            );
        });

        it('routes video trim correctly', async () => {
            await routeToEngine('test.mp4', 'trim', '0:30|1:45');
            expect(vidEngine.processVideo).toHaveBeenCalledWith(
                'test.mp4', 'mp4', expect.objectContaining({ actionType: 'trim', trimStart: '0:30', trimEnd: '1:45' })
            );
        });

        it('routes video convert correctly', async () => {
            await routeToEngine('test.mp4', 'convert', 'gif');
            expect(vidEngine.processVideo).toHaveBeenCalledWith(
                'test.mp4', 'gif', expect.objectContaining({ actionType: 'convert' })
            );
        });

        it('throws on unsupported video action', async () => {
            await expect(routeToEngine('test.mp4', 'resize', '800px'))
                .rejects.toThrow('Unsupported video action: resize');
        });

        it('throws on unsupported file extension', async () => {
            await expect(routeToEngine('test.xyz', 'convert', 'abc'))
                .rejects.toThrow('Unsupported file extension: .xyz');
        });

        it('propagates inner engine errors correctly', async () => {
            vi.mocked(imgEngine.processImage).mockRejectedValueOnce(new Error('Inner sharp error'));
            await expect(routeToEngine('test.png', 'convert', 'webp'))
                .rejects.toThrow('Inner sharp error');
        });
    });
});
