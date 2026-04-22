import fs from 'fs';
import path from 'path';
import os from 'os';

const configDir = path.join(os.homedir(), '.config', 'omx');
const configFile = path.join(configDir, 'config.json');

export function setConfig(key: string, value: string) {
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    let config: Record<string, string> = {};
    if (fs.existsSync(configFile)) {
        config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    }
    config[key] = value;
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
}

export function getConfig(key: string): string | undefined {
    if (fs.existsSync(configFile)) {
        const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        return config[key];
    }
    return undefined;
}
