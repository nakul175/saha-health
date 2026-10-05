import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assetLinks } from '../scripts/android-assetlinks.mjs';

let passed = 0;
const check = fn => { fn(); passed++; };
const temp = mkdtempSync(join(tmpdir(), 'saha-android-certificate-test-'));
try {
  const key = join(temp, 'test.key'), pem = join(temp, 'test.pem'), der = join(temp, 'test.cer');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=Saha synthetic test only', '-keyout', key, '-out', pem], { stdio: 'ignore' });
  execFileSync('openssl', ['x509', '-in', pem, '-outform', 'der', '-out', der]);
  const fingerprint = new X509Certificate(readFileSync(pem)).fingerprint256;
  const output = assetLinks(readFileSync(der));
  check(() => assert.equal(output[0].target.sha256_cert_fingerprints[0], fingerprint));
  check(() => assert.deepEqual(assetLinks(readFileSync(pem)), output));
  check(() => assert.match(fingerprint, /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/));
  check(() => assert.equal(output[0].target.package_name, 'org.sahahealth.frontline'));
  check(() => assert.throws(() => assetLinks(Buffer.from('AA:BB:FAKE')), /./));
  check(() => assert.throws(() => execFileSync(process.execPath,
    ['scripts/android-assetlinks.mjs', key], { stdio: 'pipe' }), /./));
  check(() => assert.deepEqual(JSON.parse(execFileSync(process.execPath,
    ['scripts/android-assetlinks.mjs', der], { encoding: 'utf8' })), output));
} finally { rmSync(temp, { recursive: true, force: true }); }

const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
const launcher = readFileSync('android/app/src/main/java/org/sahahealth/frontline/SahaLauncherActivity.java', 'utf8');
check(() => assert.match(manifest, /android:usesCleartextTraffic="false"/));
check(() => assert.match(manifest, /android:allowBackup="false"/));
check(() => assert.match(manifest, /FALLBACK_STRATEGY"\s+android:value="customtabs"/));
check(() => assert.doesNotMatch(manifest, /ADDITIONAL_TRUSTED_ORIGINS|BROWSABLE|debuggable="true"/));
check(() => assert.match(launcher, /getUrlForIntent\(Intent intent\) \{ return null; \}/));
check(() => assert.ok(launcher.indexOf('setIntent(clean)') < launcher.indexOf('super.onCreate(savedInstanceState)')));
check(() => assert.doesNotMatch(manifest, /launchMode="singleTask"/));
check(() => assert.doesNotMatch(launcher, /WebView|oai-authenticated|cf-access-jwt|addJavascriptInterface/));
check(() => assert.match(launcher, /NET_CAPABILITY_VALIDATED/));
check(() => assert.match(launcher, /open\("\/field\/index.html"\)/));
const web = JSON.parse(readFileSync('public/app-manifest.webmanifest', 'utf8'));
check(() => assert.equal(web.start_url, '/app'));
for (const icon of web.icons) {
  const bytes = readFileSync('public' + icon.src), width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  check(() => assert.equal(`${width}x${height}`, icon.sizes));
}
const evidence = {
  passed, completedAt: new Date().toISOString(),
  coverage: 'Actual temporary X.509 PEM/DER generation, exact certificate fingerprint, malformed certificate/private key refusal, CLI output; Android source security configuration and browser manifest/icon dimensions.',
  limits: 'No Android device/emulator execution, real Access login, Digital Asset Links host verification, camera, Android Back or browser vault eviction evidence. Source assertions are not APK or runtime acceptance.'
};
mkdirSync('tests/evidence/android-app', { recursive: true });
writeFileSync('tests/evidence/android-app/contract-result.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`${passed} Android packaging and certificate checks passed`);
