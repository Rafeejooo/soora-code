/**
 * Soora – Build TWA APK for Android
 * ──────────────────────────────────
 * Generates a Trusted Web Activity APK from the PWA.
 *
 * PREREQUISITES:
 *   - Node.js >= 18
 *   - Java JDK 11+ (keytool in PATH)
 *
 * USAGE:
 *   node scripts/build-apk.js            # Full auto-build
 *   node scripts/build-apk.js --keyonly   # Only generate keystore + fingerprint
 *
 * ALTERNATIVE (easiest — no local tooling needed):
 *   1. Visit https://www.pwabuilder.com
 *   2. Enter: https://soora.fun
 *   3. Package for Android → Download APK
 *   4. Place in public/download/soora.apk
 */

import { execSync, spawnSync } from 'child_process';
import {
  existsSync, mkdirSync, copyFileSync, readdirSync,
  statSync, writeFileSync, readFileSync,
} from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, '..');
const TWA_DIR = join(PROJECT, 'twa-build');
const KS_PATH = join(PROJECT, 'soora-keystore.jks');
const KS_ALIAS = 'soora';
const KS_PASS = 'soora-pwa-2025';
const OUT_DIR = join(PROJECT, 'public', 'download');
const WEB_MANIFEST = 'https://soora.fun/manifest.json';

function exec(cmd, opts = {}) {
  console.log(`  > ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', cwd: opts.cwd || PROJECT, ...opts });
}

function findApks(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...findApks(p));
    else if (e.name.endsWith('.apk')) out.push(p);
  }
  return out;
}

// ═══ Banner ═══
console.log('\n  ╔═══════════════════════════════════╗');
console.log('  ║     Soora APK Builder (TWA)       ║');
console.log('  ╚═══════════════════════════════════╝\n');

// ═══ 1. Verify keytool ═══
const kt = spawnSync('keytool', ['-help'], { stdio: 'pipe' });
if (kt.status !== 0 && kt.error) {
  console.error('  ✗ keytool not found. Install JDK 11+ → https://adoptium.net/');
  process.exit(1);
}
console.log('  ✓ JDK keytool found');

// ═══ 2. Create signing keystore ═══
if (!existsSync(KS_PATH)) {
  console.log('\n  Generating signing keystore...');
  exec([
    'keytool -genkeypair',
    `-alias ${KS_ALIAS}`,
    '-keyalg RSA -keysize 2048 -validity 10000',
    `-keystore "${KS_PATH}"`,
    `-storepass ${KS_PASS} -keypass ${KS_PASS}`,
    '-dname "CN=Soora,OU=Dev,O=Soora,L=Jakarta,ST=DKI,C=ID"',
  ].join(' '));
  console.log('  ✓ Keystore created at soora-keystore.jks\n');
}

// Print SHA-256 fingerprint and auto-patch assetlinks
console.log('  SHA-256 fingerprint:');
try {
  const fpOut = execSync(
    `keytool -list -v -keystore "${KS_PATH}" -alias ${KS_ALIAS} -storepass ${KS_PASS}`,
    { encoding: 'utf-8' },
  );
  const line = fpOut.split('\n').find((l) => /SHA-?256/i.test(l));
  if (line) {
    const fp = line.replace(/.*SHA-?256:\s*/i, '').trim();
    console.log(`  ${fp}\n`);

    // Auto-update assetlinks.json if placeholder exists
    const alFile = join(PROJECT, 'public', '.well-known', 'assetlinks.json');
    if (existsSync(alFile)) {
      const content = readFileSync(alFile, 'utf-8');
      if (content.includes('PLACEHOLDER')) {
        writeFileSync(
          alFile,
          content.replace('PLACEHOLDER:REPLACE_WITH_ACTUAL_SHA256_FINGERPRINT_AFTER_SIGNING', fp),
        );
        console.log('  ✓ assetlinks.json updated with fingerprint\n');
      }
    }
  }
} catch {
  console.log('  (could not extract fingerprint)\n');
}

if (process.argv.includes('--keyonly')) {
  console.log('  Done (keystore-only mode).');
  process.exit(0);
}

// ═══ 3. Bubblewrap build ═══
console.log('  Building APK with Bubblewrap...');
console.log('  (May download Android SDK on first run)\n');

mkdirSync(TWA_DIR, { recursive: true });

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
let ok = false;

try {
  // bubblewrap init from web manifest
  spawnSync(npx, [
    'bubblewrap', 'init',
    `--manifest=${WEB_MANIFEST}`,
    `--directory=${TWA_DIR}`,
  ], { stdio: 'inherit', cwd: PROJECT });

  // bubblewrap build
  spawnSync(npx, ['bubblewrap', 'build'], {
    stdio: 'inherit',
    cwd: TWA_DIR,
  });

  ok = findApks(TWA_DIR).length > 0;
} catch {
  // handled below
}

// ═══ 4. Collect APK ═══
if (ok) {
  const apks = findApks(TWA_DIR);
  const best = apks.find((f) => /release|signed/i.test(f)) || apks[0];
  mkdirSync(OUT_DIR, { recursive: true });
  const dest = join(OUT_DIR, 'soora.apk');
  copyFileSync(best, dest);
  const mb = (statSync(dest).size / 1048576).toFixed(1);

  console.log('\n  ╔═══════════════════════════════════╗');
  console.log('  ║   ✓ APK BUILD SUCCESS              ║');
  console.log('  ╠═══════════════════════════════════╣');
  console.log(`  ║  public/download/soora.apk (${mb} MB) ║`);
  console.log('  ╚═══════════════════════════════════╝\n');
  console.log('  Deploy to Vercel → soora.fun/download/soora.apk');
  process.exit(0);
}

// ═══ Fallback: PWABuilder ═══
console.log('\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Bubblewrap build did not produce an APK.');
console.log('  Use PWABuilder instead (easiest method):');
console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('  1. Open  https://www.pwabuilder.com');
console.log('  2. Enter https://soora.fun');
console.log('  3. Package for stores → Android');
console.log('  4. Settings:');
console.log('       Package ID : fun.soora.app');
console.log('       App name   : Soora');
console.log(`       Keystore   : ${KS_PATH}`);
console.log(`       Alias      : ${KS_ALIAS}`);
console.log(`       Password   : ${KS_PASS}`);
console.log('  5. Download → extract → copy APK to public/download/soora.apk\n');
process.exit(1);
