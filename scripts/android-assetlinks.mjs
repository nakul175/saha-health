// Input must be a real DER/PEM X.509 certificate exported from the APK signing key.
// No private key, keystore password or invented fingerprint enters this output.
import { X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function assetLinks(certificate) {
  const cert = new X509Certificate(certificate);
  return [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'org.sahahealth.frontline',
      sha256_cert_fingerprints: [cert.fingerprint256]
    }
  }];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [path, ...extra] = process.argv.slice(2);
  if (!path || extra.length) {
    console.error('Usage: node scripts/android-assetlinks.mjs <public-signing-certificate.cer>');
    process.exitCode = 1;
  } else {
    try { process.stdout.write(JSON.stringify(assetLinks(readFileSync(path)), null, 2) + '\n'); }
    catch { console.error('A readable, valid public X.509 signing certificate is required.'); process.exitCode = 1; }
  }
}
