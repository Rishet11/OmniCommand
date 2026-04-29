import fs from 'fs';
import path from 'path';
import os from 'os';

export function getConfigDir() {
    return process.env.OMX_CONFIG_DIR || path.join(os.homedir(), '.config', 'omx');
}

export function getConfigFile() {
    return path.join(getConfigDir(), 'config.json');
}

export function setConfig(key: string, value: string) {
    const configDir = getConfigDir();
    const configFile = getConfigFile();
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
    }
    let config: Record<string, string> = {};
    if (fs.existsSync(configFile)) {
        config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    }
    config[key] = value;
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), { mode: 0o600 });
    // Explicit chmod in case umask overrode the mode above
    fs.chmodSync(configFile, 0o600);
}

export function getConfig(key: string): string | undefined {
    const configFile = getConfigFile();
    if (fs.existsSync(configFile)) {
        const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        return config[key];
    }
    return undefined;
}
