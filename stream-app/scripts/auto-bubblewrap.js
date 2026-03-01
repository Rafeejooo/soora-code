/**
 * Automated Bubblewrap TWA Builder
 * Spawns bubblewrap and feeds it answers automatically.
 */
import { spawn } from 'child_process';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TWA_DIR = join(ROOT, 'twa-build', 'soora-twa');
const OUT_DIR = join(ROOT, 'public', 'download');
const KS_PATH = join(ROOT, 'soora-keystore.jks');

// Answers for bubblewrap interactive prompts
const ANSWERS = {
  'Domain:': 'soora.fun',
  'Domain being opened in the browser:': '',
  'Name:': 'Soora',
  'Launcher name:': 'Soora',
  'Display mode:': '',  // default (standalone)
  'Theme color:': '#6c5ce7',
  'Theme color dark:': '#06060e',
  'Background color:': '#06060e',
  'Navigation color:': '#06060e',
  'Navigation color dark:': '#06060e',
  'Navigation divider color:': '#06060e',
  'Navigation divider color dark:': '#06060e',
  'Start URL:': '/',
  'Icon URL:': '',  // accept default from manifest
  'Maskable icon URL:': '',  // accept default
  'Notification delegation:': '', // default (no)
  'Monochrome icon URL:': '',
  'Shortcut name:': '',
  'Shortcut URL:': '',
  'Signing key information:': '',
  'Key store location:': KS_PATH,
  'Key name:': 'soora',
  'Key store password:': 'soora-pwa-2025',
  'Key password:': 'soora-pwa-2025',
  'Package ID:': 'fun.soora.app',
  'App version name:': '1.0.0',
  'App version code:': '1',
  'Fallback type:': '', // default
  'Status bar color:': '',
  'Splash screen color:': '',
  // Location delegation
  'enable the location delegation:': 'n',
  'enable notifications:': 'n',
  'service:': '',
  'Do you want': '', // accept defaults for yes/no prompts
};

function log(msg) { console.log(`  ${msg}`); }

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

async function runBubblewrap(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const bbCmd = process.platform === 'win32' ? `${cmd}.cmd` : cmd;
    log(`Running: ${bbCmd} ${args.join(' ')}`);
    
    const proc = spawn(bbCmd, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      env: process.env,
    });

    let output = '';
    let lastLine = '';
    let answerTimeout = null;

    function tryAnswer(text) {
      // Check if the text contains a prompt we know the answer to
      for (const [key, value] of Object.entries(ANSWERS)) {
        if (text.includes(key)) {
          clearTimeout(answerTimeout);
          answerTimeout = setTimeout(() => {
            const answer = value + '\n';
            proc.stdin.write(answer);
          }, 200);
          return true;
        }
      }
      
      // Default: press Enter for any prompt ending with ) or :
      if (text.match(/\?\s*[^)]*\)\s*$/) || text.match(/\([^)]+\)\s*$/)) {
        clearTimeout(answerTimeout);
        answerTimeout = setTimeout(() => {
          proc.stdin.write('\n');
        }, 300);
        return true;
      }
      
      return false;
    }

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
      
      // Get last meaningful line
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length) lastLine = lines[lines.length - 1];
      
      tryAnswer(lastLine);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stderr.write(text);
      
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length) lastLine = lines[lines.length - 1];
      
      tryAnswer(lastLine);
    });

    proc.on('close', (code) => {
      clearTimeout(answerTimeout);
      resolve({ code, output });
    });

    proc.on('error', (err) => {
      clearTimeout(answerTimeout);
      reject(err);
    });
  });
}

async function main() {
  console.log('\n  ╔═══════════════════════════════════╗');
  console.log('  ║   Soora APK Builder (Bubblewrap)  ║');
  console.log('  ╚═══════════════════════════════════╝\n');

  // Clean and create TWA dir
  mkdirSync(TWA_DIR, { recursive: true });

  // Step 1: Init
  log('Step 1: Initializing TWA project...\n');
  const initResult = await runBubblewrap(
    'bubblewrap',
    ['init', '--manifest=http://localhost:5173/manifest.json'],
    TWA_DIR,
  );
  
  if (initResult.code !== 0) {
    log(`\nInit exited with code ${initResult.code}`);
    log('Trying to continue with build anyway...\n');
  }

  // Step 2: Build
  log('\nStep 2: Building APK...\n');
  const buildResult = await runBubblewrap(
    'bubblewrap',
    ['build'],
    TWA_DIR,
  );

  // Step 3: Collect APK
  log('\nStep 3: Collecting APK...\n');
  const apks = findApks(TWA_DIR);
  
  if (apks.length > 0) {
    const best = apks.find(f => /release|signed/i.test(f)) || apks[0];
    mkdirSync(OUT_DIR, { recursive: true });
    const dest = join(OUT_DIR, 'soora.apk');
    copyFileSync(best, dest);
    const mb = (statSync(dest).size / 1048576).toFixed(1);

    console.log('\n  ╔═══════════════════════════════════════╗');
    console.log('  ║   ✓ APK BUILD SUCCESS                  ║');
    console.log('  ╠═══════════════════════════════════════╣');
    console.log(`  ║  public/download/soora.apk (${mb} MB)    ║`);
    console.log('  ╚═══════════════════════════════════════╝\n');
    process.exit(0);
  } else {
    log('No APK files found in build output.');
    log('Check twa-build/soora-twa/ for details.');
    process.exit(1);
  }
}

main().catch(e => {
  console.error('  Fatal:', e.message);
  process.exit(1);
});
