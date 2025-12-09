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

const detectHostTriple = () => {
  const rustc = spawnSync('rustc', ['-vV'], { encoding: 'utf8' });
  if (rustc.status === 0 && typeof rustc.stdout === 'string') {
    const hostLine = rustc.stdout.split('\n').find((line) => line.startsWith('host:'));
    if (hostLine) {
      return hostLine.split(':')[1].trim();
    }
  }
  return null;
};

// Check for explicit target override (for cross-compilation)
const targetTriple = process.env.VINSLY_HELPER_TRIPLE || process.env.TAURI_CLI_TARGET_TRIPLE || null;
const hostTriple = detectHostTriple();
const effectiveTriple = targetTriple || hostTriple;

const cargoArgs = ['build', '--bin', 'scan-helper'];
if (helperProfile === 'release') {
  cargoArgs.push('--release');
}
// If cross-compiling, pass the target to cargo
if (targetTriple) {
  cargoArgs.push('--target', targetTriple);
}

const extension = process.platform === 'win32' ? '.exe' : '';
const binDir = path.join(srcTauriDir, 'bin');
mkdirSync(binDir, { recursive: true });

if (effectiveTriple) {
  const placeholderPath = path.join(binDir, `scan-helper-${effectiveTriple}${extension}`);
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

// When cross-compiling, binary is in target/<triple>/<profile>/, otherwise target/<profile>/
const builtPath = targetTriple
  ? path.join(srcTauriDir, 'target', targetTriple, helperProfile, `scan-helper${extension}`)
  : path.join(srcTauriDir, 'target', helperProfile, `scan-helper${extension}`);

if (!existsSync(builtPath)) {
  console.error(`[scan-helper] Expected binary at ${builtPath}, but it was not found.`);
  process.exit(1);
}

const outputs = [path.join(binDir, `scan-helper${extension}`)];
if (effectiveTriple) {
  outputs.push(path.join(binDir, `scan-helper-${effectiveTriple}${extension}`));
} else {
  console.warn('[scan-helper] Unable to detect target triple; only copying generic binary.');
}

for (const destPath of outputs) {
  copyFileSync(builtPath, destPath);
  if (process.platform !== 'win32') {
    chmodSync(destPath, 0o755);
  }
  console.log(`[scan-helper] Helper copied to ${destPath}`);
}

// Verify the target-triple suffixed binary exists (required by Tauri's externalBin)
if (effectiveTriple) {
  const tauriExpectedPath = path.join(binDir, `scan-helper-${effectiveTriple}${extension}`);
  if (!existsSync(tauriExpectedPath)) {
    console.error(`[scan-helper] ERROR: Tauri expects ${tauriExpectedPath} but it was not created!`);
    process.exit(1);
  }
  console.log(`[scan-helper] Verified Tauri sidecar: ${tauriExpectedPath}`);
}
