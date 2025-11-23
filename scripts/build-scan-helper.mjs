import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, openSync, closeSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const projectRoot = path.resolve(scriptsDir, '..');
const srcTauriDir = path.join(projectRoot, 'src-tauri');
const helperProfile =
  process.env.VINSLY_BUILD_HELPER_PROFILE && process.env.VINSLY_BUILD_HELPER_PROFILE.toLowerCase() === 'debug'
    ? 'debug'
    : 'release';

const detectTargetTriple = () => {
  if (process.env.VINSLY_HELPER_TRIPLE) {
    return process.env.VINSLY_HELPER_TRIPLE;
  }
  const rustc = spawnSync('rustc', ['-vV'], { encoding: 'utf8' });
  if (rustc.status === 0 && typeof rustc.stdout === 'string') {
    const hostLine = rustc.stdout.split('\n').find((line) => line.startsWith('host:'));
    if (hostLine) {
      return hostLine.split(':')[1].trim();
    }
  }
  return null;
};

const cargoArgs = ['build', '--bin', 'scan-helper'];
if (helperProfile === 'release') {
  cargoArgs.push('--release');
}

const extension = process.platform === 'win32' ? '.exe' : '';
const hostTriple = detectTargetTriple();
const binDir = path.join(srcTauriDir, 'bin');
mkdirSync(binDir, { recursive: true });

if (hostTriple) {
  const placeholderPath = path.join(binDir, `scan-helper-${hostTriple}${extension}`);
  if (!existsSync(placeholderPath)) {
    closeSync(openSync(placeholderPath, 'w'));
    if (process.platform !== 'win32') {
      chmodSync(placeholderPath, 0o755);
    }
  }
}

console.log(`[scan-helper] Building helper binary (${helperProfile})…`);
const cargoResult = spawnSync('cargo', cargoArgs, {
  cwd: srcTauriDir,
  stdio: 'inherit'
});

if (cargoResult.status !== 0) {
  console.error('[scan-helper] Cargo build failed.');
  process.exit(cargoResult.status ?? 1);
}

const builtPath = path.join(srcTauriDir, 'target', helperProfile, `scan-helper${extension}`);

if (!existsSync(builtPath)) {
  console.error(`[scan-helper] Expected binary at ${builtPath}, but it was not found.`);
  process.exit(1);
}

const outputs = [path.join(binDir, `scan-helper${extension}`)];
if (hostTriple) {
  outputs.push(path.join(binDir, `scan-helper-${hostTriple}${extension}`));
} else {
  console.warn('[scan-helper] Unable to detect target triple via rustc -vV; only copying generic binary.');
}

for (const destPath of outputs) {
  copyFileSync(builtPath, destPath);
  if (process.platform !== 'win32') {
    chmodSync(destPath, 0o755);
  }
  console.log(`[scan-helper] Helper copied to ${destPath}`);
}
