import {verificationRootFixture} from './lib/verification-root-fixture-adapter.mjs';

// The immutable historical driver declares this scenario time and a delegation
// ending on 10 October. Authorization correctly uses the runtime clock, so this
// isolated unit process must run at the scenario time, rather than age its grant.
// Production authorization and the historical driver are unchanged.
const RuntimeDate = Date;
const fixtureClock = '2026-10-01T06:00:00.000Z';
class ScenarioDate extends RuntimeDate {
  constructor(...args) { super(...(args.length ? args : [fixtureClock])); }
  static now() { return RuntimeDate.parse(fixtureClock); }
}
const sourceTransform = source => {
  const anchor = "  await S.applySignOff(ds, so(), actor('clin-5'), ds.members[1], now);";
  if (source.split(anchor).length !== 2) throw Error('Historical delegation success anchor changed');
  // Six additional refusal groups; every original assertion still executes.
  const refusals = `
  for (const [label, change] of [
    ['expired at runtime now', st => { st.operations.delegations[0].until = new Date().toISOString(); }],
    ['not yet in force', st => { st.operations.delegations[0].from = new Date(Date.now() + 1).toISOString(); }],
    ['revoked', st => { st.operations.delegations[0].revokedAt = now; }],
    ['inactive grantor', st => { st.members[0].status = 'suspended'; }],
    ['inactive delegate', st => { st.members[1].status = 'suspended'; }],
    ['older mutation timestamp cannot revive expiry', st => { st.operations.delegations[0].until = new Date().toISOString(); }],
  ]) {
    const refused = structuredClone(ds); change(refused);
    const beforeRefusal = JSON.stringify(refused);
    const suppliedTime = label.startsWith('older') ? '2026-09-30T06:00:00.000Z' : now;
    await refuses(() => S.applySignOff(refused, so(), actor('clin-5'), refused.members[1], suppliedTime), 403, /current supervision delegate/);
    assert.equal(JSON.stringify(refused), beforeRefusal, label + ': no sign-off, audit or delegation-use mutation');
  }
`;
  return source.replace(anchor, refusals + anchor);
};
try {
  globalThis.Date = ScenarioDate;
  await verificationRootFixture('note-answer-signoff-contract.mjs', {sourceTransform});
} finally {
  globalThis.Date = RuntimeDate;
}
console.log(JSON.stringify({fixtureClock, executedAt: new RuntimeDate().toISOString(), historicalAssertions: 52, additionalRefusalGroups: 6}));
