/**
 * Soora TWA APK Builder
 * ─────────────────────
 * Builds a real Android APK wrapping soora.fun as a Trusted Web Activity.
 * 
 * Requirements: JDK 11+ (keytool, jarsigner in PATH)
 * Everything else is downloaded automatically.
 *
 * Usage:  node scripts/build-twa-apk.js
 */

import { execSync } from 'child_process';
import {
  existsSync, mkdirSync, writeFileSync, readFileSync,
  copyFileSync, createWriteStream, statSync, rmSync,
  readdirSync,
} from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';
import { createUnzip } from 'zlib';
import { pipeline } from 'stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BUILD_DIR = join(ROOT, 'twa-build');
const OUT_DIR = join(ROOT, 'public', 'download');
const KS_PATH = join(ROOT, 'soora-keystore.jks');
const KS_ALIAS = 'soora';
const KS_PASS = 'soora-pwa-2025';

// ── App config ──
const APP = {
  packageName: 'fun.soora.app',
  appName: 'Soora',
  hostUrl: 'https://soora.fun',
  startUrl: '/',
  themeColor: '#6c5ce7',
  bgColor: '#06060e',
  navColor: '#06060e',
  iconUrl: 'https://soora.fun/soranime.svg',
  versionCode: 1,
  versionName: '1.0.0',
};

// ── Android SDK config ──
const SDK_DIR = join(BUILD_DIR, 'android-sdk');
const CMDLINE_TOOLS_URL = 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip';
const BUILD_TOOLS_VER = '34.0.0';
const PLATFORM_VER = 'android-34';
const MIN_SDK = 19;
const TARGET_SDK = 34;

function log(msg) { console.log(`  ${msg}`); }
function logHeader(msg) {
  console.log(`\n  ── ${msg} ──`);
}

function exec(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', cwd: opts.cwd || BUILD_DIR, ...opts });
}

function execOut(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf-8', cwd: opts.cwd || BUILD_DIR, ...opts }).trim();
}

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total > 0) {
          const pct = ((downloaded / total) * 100).toFixed(0);
          process.stdout.write(`\r  Downloading... ${pct}% (${(downloaded / 1048576).toFixed(1)} MB)`);
        }
      });
      res.pipe(file);
      file.on('finish', () => { file.close(); console.log(); resolve(); });
      file.on('error', reject);
    }).on('error', reject);
  });
}

async function extractZip(zipPath, destDir) {
  log('Extracting...');
  // Use PowerShell to extract (Windows)
  execSync(
    `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`,
    { stdio: 'inherit' },
  );
}

// ═══════════════════════════════════════════
//  MAIN BUILD FLOW
// ═══════════════════════════════════════════

async function main() {
  console.log('\n  ╔═══════════════════════════════════╗');
  console.log('  ║     Soora APK Builder (TWA)       ║');
  console.log('  ╚═══════════════════════════════════╝\n');

  // ── 1. Verify JDK ──
  logHeader('1. Checking JDK');
  try {
    const jv = execOut('javac -version', { cwd: ROOT });
    log(`✓ ${jv}`);
  } catch {
    log('✗ JDK not found. Install JDK 11+ and ensure javac is in PATH.');
    process.exit(1);
  }

  // ── 2. Create keystore ──
  logHeader('2. Signing Keystore');
  if (!existsSync(KS_PATH)) {
    log('Generating keystore...');
    exec([
      'keytool -genkeypair',
      `-alias ${KS_ALIAS}`,
      '-keyalg RSA -keysize 2048 -validity 10000',
      `-keystore "${KS_PATH}"`,
      `-storepass ${KS_PASS} -keypass ${KS_PASS}`,
      '-dname "CN=Soora,OU=Dev,O=Soora,L=Jakarta,ST=DKI,C=ID"',
    ].join(' '), { cwd: ROOT });
  }
  log('✓ Keystore ready');

  // Get SHA-256 fingerprint
  let fingerprint = '';
  try {
    const fpOut = execOut(
      `keytool -list -v -keystore "${KS_PATH}" -alias ${KS_ALIAS} -storepass ${KS_PASS}`,
      { cwd: ROOT },
    );
    const fpLine = fpOut.split('\n').find(l => /SHA-?256/i.test(l));
    if (fpLine) {
      fingerprint = fpLine.replace(/.*SHA-?256:\s*/i, '').trim();
      log(`SHA-256: ${fingerprint}`);
    }
  } catch { /* */ }

  // ── 3. Setup Android SDK ──
  logHeader('3. Android SDK');
  mkdirSync(SDK_DIR, { recursive: true });

  const sdkmanager = join(SDK_DIR, 'cmdline-tools', 'latest', 'bin',
    process.platform === 'win32' ? 'sdkmanager.bat' : 'sdkmanager');

  if (!existsSync(sdkmanager)) {
    log('Downloading Android command-line tools...');
    const zipPath = join(BUILD_DIR, 'cmdline-tools.zip');
    if (!existsSync(zipPath)) {
      await download(CMDLINE_TOOLS_URL, zipPath);
    }
    await extractZip(zipPath, SDK_DIR);

    // Move to correct directory structure
    const extractedDir = join(SDK_DIR, 'cmdline-tools');
    const latestDir = join(SDK_DIR, 'cmdline-tools', 'latest');
    if (!existsSync(latestDir) && existsSync(extractedDir)) {
      // The zip extracts to cmdline-tools/, we need cmdline-tools/latest/
      const tmpDir = join(SDK_DIR, '_cmdline-tools-tmp');
      if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
      execSync(`move "${extractedDir}" "${tmpDir}"`, { cwd: SDK_DIR, shell: 'cmd.exe' });
      mkdirSync(join(SDK_DIR, 'cmdline-tools'), { recursive: true });
      execSync(`move "${tmpDir}" "${latestDir}"`, { cwd: SDK_DIR, shell: 'cmd.exe' });
    }
    log('✓ Command-line tools installed');
  } else {
    log('✓ Command-line tools already present');
  }

  // Accept licenses and install components
  log('Installing SDK components (build-tools, platform)...');
  const sdkEnv = {
    ...process.env,
    ANDROID_HOME: SDK_DIR,
    ANDROID_SDK_ROOT: SDK_DIR,
    JAVA_HOME: process.env.JAVA_HOME || '',
  };

  try {
    // Accept all licenses
    execSync(`echo y | "${sdkmanager}" --licenses`, {
      cwd: SDK_DIR, env: sdkEnv, stdio: 'pipe', shell: true,
    });
  } catch { /* some license outputs go to stderr */ }

  try {
    execSync(
      `"${sdkmanager}" "build-tools;${BUILD_TOOLS_VER}" "platforms;${PLATFORM_VER}"`,
      { cwd: SDK_DIR, env: sdkEnv, stdio: 'inherit', shell: true },
    );
    log('✓ SDK components installed');
  } catch (e) {
    log(`Warning: SDK install had issues: ${e.message}`);
  }

  // ── 4. Create Android project ──
  logHeader('4. Creating TWA Android project');
  const projDir = join(BUILD_DIR, 'soora-twa');
  if (existsSync(projDir)) rmSync(projDir, { recursive: true });
  mkdirSync(projDir, { recursive: true });

  const packageDir = APP.packageName.replace(/\./g, '/');

  // local.properties
  writeFileSync(join(projDir, 'local.properties'),
    `sdk.dir=${SDK_DIR.replace(/\\/g, '\\\\')}\n`);

  // gradle.properties
  writeFileSync(join(projDir, 'gradle.properties'), [
    'android.useAndroidX=true',
    'org.gradle.jvmargs=-Xmx1536m',
  ].join('\n') + '\n');

  // settings.gradle
  writeFileSync(join(projDir, 'settings.gradle'), [
    "pluginManagement {",
    "    repositories {",
    "        google()",
    "        mavenCentral()",
    "        gradlePluginPortal()",
    "    }",
    "}",
    "dependencyResolutionManagement {",
    "    repositories {",
    "        google()",
    "        mavenCentral()",
    "    }",
    "}",
    "rootProject.name = 'soora-twa'",
    "include ':app'",
  ].join('\n') + '\n');

  // Root build.gradle
  writeFileSync(join(projDir, 'build.gradle'), [
    'plugins {',
    "    id 'com.android.application' version '8.2.2' apply false",
    '}',
  ].join('\n') + '\n');

  // app/build.gradle
  mkdirSync(join(projDir, 'app'), { recursive: true });
  writeFileSync(join(projDir, 'app', 'build.gradle'), `
plugins {
    id 'com.android.application'
}

android {
    namespace '${APP.packageName}'
    compileSdk ${TARGET_SDK}

    defaultConfig {
        applicationId "${APP.packageName}"
        minSdk ${MIN_SDK}
        targetSdk ${TARGET_SDK}
        versionCode ${APP.versionCode}
        versionName "${APP.versionName}"

        // TWA host and default URL
        manifestPlaceholders = [
            hostName: "${new URL(APP.hostUrl).hostname}",
            defaultUrl: "${APP.hostUrl}${APP.startUrl}",
            launcherName: "${APP.appName}",
            assetStatements: '[{"relation": ["delegate_permission/common.handle_all_urls"], "target": {"namespace": "web", "site": "${APP.hostUrl}"}}]'
        ]
    }

    signingConfigs {
        release {
            storeFile file("${KS_PATH.replace(/\\/g, '/')}")
            storePassword "${KS_PASS}"
            keyAlias "${KS_ALIAS}"
            keyPassword "${KS_PASS}"
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt')
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
}

dependencies {
    implementation 'com.google.androidbrowserhelper:androidbrowserhelper:2.5.0'
    implementation 'androidx.browser:browser:1.8.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
}
`.trim() + '\n');

  // AndroidManifest.xml
  const manifestDir = join(projDir, 'app', 'src', 'main');
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, 'AndroidManifest.xml'), `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="\${launcherName}"
        android:theme="@style/Theme.LauncherActivity"
        android:supportsRtl="true">

        <meta-data
            android:name="asset_statements"
            android:value='\${assetStatements}' />

        <activity
            android:name="com.google.androidbrowserhelper.trusted.LauncherActivity"
            android:exported="true"
            android:label="\${launcherName}">

            <meta-data
                android:name="android.support.customtabs.trusted.DEFAULT_URL"
                android:value="\${defaultUrl}" />

            <meta-data
                android:name="android.support.customtabs.trusted.STATUS_BAR_COLOR"
                android:resource="@color/colorPrimary" />

            <meta-data
                android:name="android.support.customtabs.trusted.NAVIGATION_BAR_COLOR"
                android:resource="@color/navigationColor" />

            <meta-data
                android:name="android.support.customtabs.trusted.NAVIGATION_BAR_COLOR_DARK"
                android:resource="@color/navigationColorDark" />

            <meta-data
                android:name="android.support.customtabs.trusted.SPLASH_IMAGE_DRAWABLE"
                android:resource="@drawable/splash" />

            <meta-data
                android:name="android.support.customtabs.trusted.SPLASH_SCREEN_BACKGROUND_COLOR"
                android:resource="@color/backgroundColor" />

            <meta-data
                android:name="android.support.customtabs.trusted.SPLASH_SCREEN_FADE_OUT_DURATION"
                android:value="300" />

            <meta-data
                android:name="android.support.customtabs.trusted.FILE_PROVIDER_AUTHORITY"
                android:value="\${hostName}.fileprovider" />

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="\${hostName}" />
            </intent-filter>
        </activity>

        <activity android:name="com.google.androidbrowserhelper.trusted.FocusActivity" />

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${hostName}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/filepaths" />
        </provider>

        <service
            android:name="com.google.androidbrowserhelper.trusted.DelegationService"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.support.customtabs.trusted.TRUSTED_WEB_ACTIVITY_SERVICE" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
        </service>
    </application>
</manifest>
`);

  // Resources
  const resDir = join(manifestDir, 'res');

  // values/colors.xml
  mkdirSync(join(resDir, 'values'), { recursive: true });
  writeFileSync(join(resDir, 'values', 'colors.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">${APP.themeColor}</color>
    <color name="colorPrimaryDark">${APP.bgColor}</color>
    <color name="backgroundColor">${APP.bgColor}</color>
    <color name="navigationColor">${APP.navColor}</color>
    <color name="navigationColorDark">${APP.navColor}</color>
</resources>
`);

  // values/strings.xml
  writeFileSync(join(resDir, 'values', 'strings.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${APP.appName}</string>
</resources>
`);

  // values/styles.xml
  writeFileSync(join(resDir, 'values', 'styles.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.LauncherActivity" parent="Theme.AppCompat.NoActionBar">
        <item name="android:windowBackground">@color/backgroundColor</item>
        <item name="android:statusBarColor">@color/colorPrimary</item>
        <item name="android:navigationBarColor">@color/navigationColor</item>
    </style>
</resources>
`);

  // xml/filepaths.xml
  mkdirSync(join(resDir, 'xml'), { recursive: true });
  writeFileSync(join(resDir, 'xml', 'filepaths.xml'), `<?xml version="1.0" encoding="utf-8"?>
<paths>
    <files-path name="i" path="." />
</paths>
`);

  // drawable/splash.xml (simple splash with background color)
  mkdirSync(join(resDir, 'drawable'), { recursive: true });
  writeFileSync(join(resDir, 'drawable', 'splash.xml'), `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/backgroundColor" />
</layer-list>
`);

  // Create simple launcher icon (adaptive icon using color)
  for (const size of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    mkdirSync(join(resDir, `mipmap-${size}`), { recursive: true });
  }

  // We need a simple ic_launcher. Create ic_launcher.xml (adaptive icon)
  mkdirSync(join(resDir, 'mipmap-anydpi-v26'), { recursive: true });
  writeFileSync(join(resDir, 'mipmap-anydpi-v26', 'ic_launcher.xml'), `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/colorPrimary"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
`);
  writeFileSync(join(resDir, 'drawable', 'ic_launcher_foreground.xml'), `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
  <group android:translateX="22" android:translateY="22">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M32,8C18.745,8 8,18.745 8,32s10.745,24 24,24s24-10.745 24-24S45.255,8 32,8z M25,44v-24l18,12z"/>
  </group>
</vector>
`);

  // Fallback icon for older devices (pre-API 26) — simple shape drawable
  const pngSizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [density] of Object.entries(pngSizes)) {
    writeFileSync(join(resDir, `mipmap-${density}`, 'ic_launcher.xml'), `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="oval">
    <solid android:color="${APP.themeColor}"/>
    <size android:width="48dp" android:height="48dp"/>
</shape>
`);
  }

  log('✓ Android project created');

  // ── 5. Setup Gradle Wrapper ──
  logHeader('5. Setting up Gradle');

  const GRADLE_VER = '8.5';
  const gradleZip = join(BUILD_DIR, `gradle-${GRADLE_VER}-bin.zip`);
  const gradleHome = join(BUILD_DIR, `gradle-${GRADLE_VER}`);
  const gradleBin = join(gradleHome, 'bin', process.platform === 'win32' ? 'gradle.bat' : 'gradle');

  if (!existsSync(gradleBin)) {
    if (!existsSync(gradleZip) || statSync(gradleZip).size < 50_000_000) {
      log(`Downloading Gradle ${GRADLE_VER} (~126 MB)...`);
      execSync(
        `curl.exe -L -C - --retry 5 --retry-delay 10 -o "${gradleZip}" "https://services.gradle.org/distributions/gradle-${GRADLE_VER}-bin.zip"`,
        { stdio: 'inherit', cwd: BUILD_DIR, timeout: 600_000 },
      );
    }
    log('Extracting Gradle...');
    await extractZip(gradleZip, BUILD_DIR);
  }

  if (!existsSync(gradleBin)) {
    throw new Error(`Gradle binary not found at ${gradleBin}`);
  }

  log(`✓ Gradle ${GRADLE_VER} ready`);

  // ── 6. Build APK ──
  logHeader('6. Building APK');

  const buildEnv = {
    ...process.env,
    ANDROID_HOME: SDK_DIR,
    ANDROID_SDK_ROOT: SDK_DIR,
    GRADLE_USER_HOME: join(BUILD_DIR, '.gradle'),
  };

  try {
    log('Running Gradle assembleRelease...');
    log('(First run downloads dependencies — may take several minutes)');
    execSync(`"${gradleBin}" assembleRelease --no-daemon`, { stdio: 'inherit', cwd: projDir, env: buildEnv, timeout: 600_000 });

    // Find the APK
    const apkDir = join(projDir, 'app', 'build', 'outputs', 'apk', 'release');
    if (existsSync(apkDir)) {
      const apks = readdirSync(apkDir).filter(f => f.endsWith('.apk'));
      if (apks.length > 0) {
        const srcApk = join(apkDir, apks[0]);
        mkdirSync(OUT_DIR, { recursive: true });
        const destApk = join(OUT_DIR, 'soora.apk');
        copyFileSync(srcApk, destApk);
        const mb = (statSync(destApk).size / 1048576).toFixed(1);

        console.log('\n  ╔═══════════════════════════════════════╗');
        console.log('  ║   ✓ APK BUILD SUCCESS                  ║');
        console.log('  ╠═══════════════════════════════════════╣');
        console.log(`  ║  public/download/soora.apk (${mb} MB)    ║`);
        console.log('  ╚═══════════════════════════════════════╝\n');

        if (fingerprint) {
          log(`Don't forget to add Digital Asset Links:`);
          log(`SHA-256: ${fingerprint}`);
        }
        process.exit(0);
      }
    }

    log('Build completed but no APK found in output directory.');
    log('Check twa-build/soora-twa/app/build/ for output files.');
    process.exit(1);

  } catch (e) {
    log(`Build error: ${e.message}`);
    log('');
    log('Make sure ANDROID_HOME is set or Android SDK is at:');
    log(`  ${SDK_DIR}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('  Fatal error:', e.message);
  process.exit(1);
});
