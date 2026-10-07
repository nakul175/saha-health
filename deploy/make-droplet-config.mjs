// Writes dist/server/wrangler.droplet.json from the built dist/server/wrangler.json for the DigitalOcean droplet.
// Mirrors the hosted staging settings of scripts/cloudflare-staging.mjs (synthetic environment, external APIs off,
// no MIS or EHR connections, the five-minute scheduled job) except identity: the droplet's Caddy gateway supplies the
// identity headers, so the default `sites-chatgpt` provider is used and Cloudflare Access is not.
import fs from 'node:fs';

const built = JSON.parse(fs.readFileSync('dist/server/wrangler.json', 'utf8'));
delete built.legacy_env; // wrangler 4.148 refuses the field; 4.92 wrote it as a default
built.triggers = { crons: ['*/5 * * * *'] };
built.vars = {
  SAHA_ENVIRONMENT: 'synthetic',
  SAHA_IDENTITY_PROVIDER: 'sites-chatgpt',
  SAHA_EXTERNAL_APIS_ENABLED: 'false',
  SAHA_MIS_CONNECTIONS: '[]',
  SAHA_EHR_CONNECTIONS: '[]',
};
fs.writeFileSync('dist/server/wrangler.droplet.json', JSON.stringify(built));
console.log('wrote dist/server/wrangler.droplet.json');
