import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setConfig, getConfig } from '../utils/config.js';

describe('Config utility', () => {
    const TEST_KEY = `_omx_test_${Date.now()}`;

    afterEach(() => {
        // Remove the test key from config after each test
        const configFile = path.join(os.homedir(), '.config', 'omx', 'config.json');
        if (fs.existsSync(configFile)) {
            const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
            delete config[TEST_KEY];
            fs.writeFileSync(configFile, JSON.stringify(config, null, 2), { mode: 0o600 });
        }
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
        const configFile = path.join(os.homedir(), '.config', 'omx', 'config.json');
        const mode = fs.statSync(configFile).mode;
        // mode & 0o777 masks off the file type bits — result should be 0o600 (owner read/write only)
        expect(mode & 0o777).toBe(0o600);
    });
});
