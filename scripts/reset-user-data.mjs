#!/usr/bin/env node

import { rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const APP_IDENTIFIER = 'com.vinsly.desktop';

const resolver = {
  darwin: () => path.join(os.homedir(), 'Library', 'Application Support', APP_IDENTIFIER),
  win32: () => path.join(
    process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
    APP_IDENTIFIER,
  ),
};

const resolveDataDir = () => {
  const resolverFn = resolver[process.platform];
  if (typeof resolverFn === 'function') {
    return resolverFn();
  }
  return path.join(os.homedir(), '.config', APP_IDENTIFIER);
};

const targetDir = resolveDataDir();

try {
  await rm(targetDir, { recursive: true, force: true });
  console.log(`Removed persisted Vinsly data at: ${targetDir}`);
} catch (error) {
  console.error(`Unable to remove ${targetDir}:`, error);
  process.exitCode = 1;
}
