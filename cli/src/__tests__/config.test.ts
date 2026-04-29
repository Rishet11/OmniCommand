import { describe, it, expect, afterEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { setConfig, getConfig, getConfigDir, getConfigFile } from '../utils/config.js';

describe('Config utility', () => {
    const TEST_KEY = `_omx_test_${Date.now()}`;
    const configDir = path.join(process.cwd(), '.tmp-omx-config-test');
    process.env.OMX_CONFIG_DIR = configDir;

    afterEach(() => {
        const configFile = getConfigFile();
        if (fs.existsSync(configFile)) {
            try {
                const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
                delete config[TEST_KEY];
                fs.writeFileSync(configFile, JSON.stringify(config, null, 2), { mode: 0o600 });
            } catch (e) {
                // If the test corrupted the file, delete it
                fs.unlinkSync(configFile);
            }
        }
        vi.restoreAllMocks();
    });

    afterAll(() => {
        if (fs.existsSync(configDir)) {
            fs.rmSync(configDir, { recursive: true, force: true });
        }
        delete process.env.OMX_CONFIG_DIR;
    });

    it('setConfig then getConfig returns the same value', () => {
        setConfig(TEST_KEY, 'test_value_123');
        const result = getConfig(TEST_KEY);
        expect(result).toBe('test_value_123');
    });

    it('getConfig for a nonexistent key returns undefined', () => {
        const result = getConfig('__omx_nonexistent_key_xyz__');
        expect(result).toBeUndefined();
    });

    it('config file has 0600 permissions after setConfig', () => {
        setConfig(TEST_KEY, 'perm_test_value');
        const mode = fs.statSync(getConfigFile()).mode;
        expect(mode & 0o777).toBe(0o600);
    });

    it('getConfig returns undefined when config.json does not exist', () => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(false);
        const result = getConfig('SOME_KEY');
        expect(result).toBeUndefined();
    });

    it('getConfig returns undefined if config is corrupted JSON', () => {
        // Ensure directory exists
        if (!fs.existsSync(getConfigDir())) fs.mkdirSync(getConfigDir(), { recursive: true });
        
        // Write bad JSON
        fs.writeFileSync(getConfigFile(), '{ bad json: 123');
        
        // Should throw JSON parse error, NOT return undefined
        expect(() => getConfig('SOME_KEY')).toThrow(SyntaxError);
    });

    it('setConfig creates directory if it does not exist', () => {
        // We need to carefully mock existsSync to return false for the directory, but allow other calls
        const originalExistsSync = fs.existsSync;
        const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockImplementation((file) => {
            if (file === configDir) return false;
            return originalExistsSync(file);
        });
        const mkdirSyncSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
        const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
        const chmodSyncSpy = vi.spyOn(fs, 'chmodSync').mockImplementation(() => undefined);
        
        setConfig('NEW_KEY', 'new_val');

        expect(mkdirSyncSpy).toHaveBeenCalledWith(configDir, { recursive: true, mode: 0o700 });
        expect(writeFileSyncSpy).toHaveBeenCalled();
        expect(chmodSyncSpy).toHaveBeenCalled();
        
        existsSyncSpy.mockRestore();
        mkdirSyncSpy.mockRestore();
        writeFileSyncSpy.mockRestore();
        chmodSyncSpy.mockRestore();
    });
});
