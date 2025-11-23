import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);

const tauriArgs = process.argv.slice(2);
const helperProfile =
  process.env.VINSLY_BUILD_HELPER_PROFILE ??
  (tauriArgs.includes('dev') || tauriArgs.includes('--debug') ? 'debug' : 'release');

const runHelperBuild = () =>
  new Promise((resolve, reject) => {
    const helperEnv = { ...process.env, VINSLY_BUILD_HELPER_PROFILE: helperProfile };
    const child = spawn('node', [path.join(scriptsDir, 'build-scan-helper.mjs')], {
      stdio: 'inherit',
      env: helperEnv
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`scan-helper build exited with code ${code ?? 1}`));
      }
    });
  });

const runTauri = () =>
  new Promise((resolve, reject) => {
    const tauri = spawn('tauri', tauriArgs, {
      stdio: 'inherit',
      env: process.env
    });
    tauri.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`tauri exited with code ${code ?? 1}`));
      }
    });
  });

try {
  await runHelperBuild();
  await runTauri();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
