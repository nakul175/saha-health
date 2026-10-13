// SAHA-012 / ENG-BR-ID-03: locally signed credentials; no real identity provider.
export const team = 'synthetic-numeric-dates.cloudflareaccess.com';
export const audience = 'c'.repeat(64);
export const bindings = { SAHA_IDENTITY_PROVIDER: 'cloudflare-access', SAHA_ACCESS_TEAM_DOMAIN: team, SAHA_ACCESS_AUD: audience };
const encode = value => Buffer.from(value).toString('base64url');

export async function credentialFixture(nowSeconds) {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'numeric-dates-local' };
  const claims = { iss: `https://${team}`, aud: [audience], sub: 'numeric-date-positive', email: 'numeric-date@example.invalid', exp: nowSeconds + 600 };
  const sign = async (changes = {}, rawDates = {}) => {
    const value = { ...claims, ...changes };
    for (const field of Object.keys(rawDates)) delete value[field];
    const tail = Object.entries(rawDates).map(([field, literal]) => `${JSON.stringify(field)}:${literal}`).join(',');
    const raw = JSON.stringify(value).slice(0, -1) + (tail ? ',' + tail : '') + '}';
    const header = encode(JSON.stringify({ alg: 'RS256', kid: jwk.kid })), payload = encode(raw);
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(header + '.' + payload));
    return `${header}.${payload}.${encode(new Uint8Array(signature))}`;
  };
  const refused = [
    ['overflow expiry', {}, { exp: '1e309' }],
    ['negative overflow expiry', {}, { exp: '-1e309' }],
    ['missing expiry', { exp: undefined }],
    ['string expiry', { exp: String(nowSeconds + 600) }],
    ['null expiry', { exp: null }],
    ['expiry outside allowance', { exp: nowSeconds - 60.001 }],
    ['future activation outside allowance', { nbf: nowSeconds + 60.001 }],
    ['overflow activation', {}, { nbf: '1e309' }],
    ['negative overflow activation', {}, { nbf: '-1e309' }],
    ['string activation', { nbf: String(nowSeconds + 600) }],
    ['null activation', { nbf: null }],
    ['boolean activation', { nbf: true }],
    ['array activation', { nbf: [nowSeconds + 600] }],
    ['object activation', { nbf: { at: nowSeconds + 600 } }],
  ];
  const permitted = [
    ['finite future expiry and absent activation', {}],
    ['finite past activation', { nbf: nowSeconds - 10 }],
    ['fractional finite expiry and activation', { exp: nowSeconds + 600.25, nbf: nowSeconds - 10.25 }],
    ['exact expiry allowance boundary', { exp: nowSeconds - 60 }],
    ['exact activation allowance boundary', { nbf: nowSeconds + 60 }],
  ];
  return { jwk, sign, refused, permitted };
}
