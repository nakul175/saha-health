// Slice 11a: the suite catalogue. Classifies every runnable test file under tests/ into exactly one layer by explicit
// rules, and fails (checkCatalogue) when a file is unclassified or when the HTTP/D1 entry and its component modules
// disagree. scripts/test.mjs uses it to decide what to run; nothing here runs a test.
//
// Layers (see docs/current/SLICE-11A-TEST-RUNNER.md):
//   static       type check, documentation and requirement checks (commands, not files; defined in scripts/test.mjs)
//   unit         tests/*-contract.mjs, tests/*-client.mjs and three named suites: transpile lib/saha/*.ts and check with node:assert
//   integration  tests/run-api-smoke.mjs (HTTP + D1 against the built Worker) and tests/scheduled-local-check.mjs;
//                tests/api-smoke.mjs and tests/*-smoke.mjs are its entry and component modules, never run on their own
//   resilience   tests/recovery-drill.mjs (encrypted backup and restore)
//   smoke        tests/smoke/*.mjs        ui   tests/ui/        nfr   tests/nfr/*.mjs        uat   tests/uat/*.mjs
//   manual       run on purpose, never by default: tests/a11y-audit.mjs, tests/load-envelope.mjs, tests/adapter-overhead-bench.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

export const LAYERS = ['static', 'unit', 'integration', 'resilience', 'smoke', 'ui', 'nfr', 'uat', 'manual'];
/** Layers whose suites are files found by scanning tests/ (static is a list of commands). */
export const FILE_LAYERS = LAYERS.filter(l => l !== 'static');
/** Layers a regression baseline can cover (manual suites are run on purpose and are not guarded). */
export const GUARDED_LAYERS = ['unit', 'integration', 'resilience', 'smoke', 'ui', 'nfr', 'uat'];

const SOURCE_EXT = /\.(mjs|cjs|js|mts|cts|ts|tsx)$/;
const SKIPPED_DIRS = new Set(['fixtures', 'evidence', 'reports', 'node_modules', 'playwright-report', 'test-results', '.git']);
// The anaemia-provider demonstration (pull request #126) added an adapter suite that runs the real consumer code in workerd (Miniflare)
// against a deterministic local peer; it needs no build or network, so it is a unit suite.
const UNIT_NAMED = new Set(['tests/field-shell.mjs', 'tests/ehr-execution.mjs', 'tests/mis-delivery.mjs', 'tests/anaemia-worker-transport.mjs', 'tests/app-first-ui.cjs', 'tests/work-burden-policy-checkpoint.mjs', 'tests/provider-ehr-execution-review.mjs', 'tests/provider-mis-execution-review.mjs']);
/** Slice 11f: arguments a suite needs when the runner starts it. Generators run in their drift-check mode so a test run never rewrites
 * tracked documents; the hosted smoke runs its local self-test (the real hosted check runs after each deploy in deploy-staging.yml). */
export const SUITE_ARGS = {
  'tests/uat/generate-uat-pack.mjs': ['--check'],
  'tests/uat/coverage-map.mjs': ['--check'],
  'tests/smoke/hosted-smoke.mjs': ['--self-test'],
};
/** Slice 11f: the result file to read when a suite writes several. The hosted smoke's self-test also writes the nested reports of the
 * scenarios it expects to fail; only its own verdict counts. */
export const SUITE_RESULTS = {
  'tests/test-runner-current-fixture-contract.mjs': ['tests/evidence/programme-own-read-repair/runner-current.json'],
  'tests/imported-media-independent-probe.mjs': ['tests/evidence/imported-media-independent/probe/http.json'],
  'tests/integration-composite-authority-time-http.mjs': ['tests/evidence/integration-fixture-adapters/composite-time/http.json'],
  'tests/integration-household-completion-browser.mjs': ['tests/evidence/integration-fixture-adapters/household/browser.json'],
  'tests/integration-report-portability-schema-http.mjs': ['tests/evidence/integration-fixture-adapters/portability/http.json'],
  'tests/smoke/app-back-guided-browser.mjs': ['tests/evidence/integration-fixture-adapters/app-back/browser-result.json'],
  'tests/asha-guided-capture-browser.mjs': ['tests/evidence/asha-guided-capture/phone/browser-result.json'],
  'tests/asha-guided-capture-conditional.mjs': ['tests/evidence/asha-guided-capture/conditional-fact/result.json'],
  'tests/asha-guided-capture-uncertainty.mjs': ['tests/evidence/asha-guided-capture/uncertainty/lost-ack.json'],
  'tests/asha-guided-capture-legacy-range.mjs': ['tests/evidence/asha-guided-capture/legacy-range/first-activation-regression.json'],
  'tests/guided-home-capture-browser.mjs': ['tests/evidence/asha-guided-capture/home-regression/browser-result.json'],
  'tests/guided-programme-reset-original-probe.mjs': ['tests/evidence/guided-programme-reset/programme-current-read/original-probe-result.json'],
  'tests/guided-programme-reset-variants.mjs': ['tests/evidence/guided-programme-reset/variants/result.json'],
  'tests/guided-repair-independent-probe.mjs': ['tests/evidence/guided-repair-independent/probe/result.json'],
  'tests/figure-impact-contract.mjs': ['tests/evidence/figure-impact/contract.json'],
  'tests/figure-impact-http.mjs': ['tests/evidence/figure-impact/http/http.json'],
  'tests/figure-impact-browser.mjs': ['tests/evidence/figure-impact/phone/browser.json'],
  'tests/figure-impact-independent-extra-http.mjs': ['tests/evidence/figure-impact-independent/extra-http/http.json'],
  'tests/object-media-contract.mjs': ['tests/evidence/object-media/contract.json'],
  'tests/object-media-http.mjs': ['tests/evidence/object-media/http.json'],
  'tests/object-media-browser.mjs': ['tests/evidence/object-media/browser.json'],
  'tests/object-media-budget-http.mjs': ['tests/evidence/object-media/budget-http.json'],
  'tests/object-media-native-boundary.mjs': ['tests/evidence/object-media/native-boundary.json'],
  'tests/object-media-migration.mjs': ['tests/evidence/object-media/migration.json'],
  'tests/object-media-legacy-regression.mjs': ['tests/evidence/object-media/legacy-regression.json'],
  'tests/object-media-independent-extra-http.mjs': ['tests/evidence/object-media-independent/extra-http.json'],
  'tests/object-media-independent-storage-boundary.mjs': ['tests/evidence/object-media-independent/storage-boundary.json'],
  'tests/object-media-independent-discard-contract.mjs': ['tests/evidence/object-media-independent/discard-contract.json'],
  'tests/integration-media-report-portability-after-http.mjs': ['tests/evidence/object-media-integration/compatibility/http.json'],
  'tests/composite-authority-independent-extra-http.mjs': ['tests/evidence/composite-authority-independent/extra-http/http.json'],
  'tests/composite-measures-contract.mjs': ['tests/evidence/composite-measures/contract.json'],
  'tests/composite-measures-http.mjs': ['tests/evidence/composite-measures/http.json'],
  'tests/composite-measures-browser.mjs': ['tests/evidence/composite-measures/browser.json'],
  'tests/composite-authority-repair-http.mjs': ['tests/evidence/composite-authority-repair/http.json'],
  'tests/inbound-retrieval-service-independent-http.mjs': ['tests/evidence/inbound-retrieval-service-independent/service-http.json'],
  'tests/inbound-retrieval-original-race-after.mjs': ['tests/evidence/inbound-retrieval-service-independent/original-race-after/result.json'],
  'tests/inbound-retrieval-after-browser.mjs': ['tests/evidence/inbound-retrieval-service-independent/browser.json'],
  'tests/inbound-retrieval-after-http.mjs': ['tests/evidence/inbound-retrieval-service-independent/http.json'],
  'tests/inbound-retrieval-service-repair-http.mjs': ['tests/evidence/inbound-retrieval-service-repair/service-http.json'],
  'tests/inbound-retrieval-browser.mjs': ['tests/evidence/inbound-retrieval-service-repair/browser.json'],
  'tests/inbound-retrieval-http.mjs': ['tests/evidence/inbound-retrieval-service-repair/http.json'],
  'tests/inbound-retrieval-contract.mjs': ['tests/evidence/inbound-retrieval-service-repair/combined-contract-result.json'],
  'tests/guided-home-browser.mjs': ['tests/evidence/guided-home/browser-result.json'],
  'tests/household-completion-contract.mjs': ['tests/evidence/household-completion/contract.json'],
  'tests/household-completion-http.mjs': ['tests/evidence/household-completion/http.json'],
  'tests/household-completion-browser.mjs': ['tests/evidence/household-completion/browser.json'],
  'tests/household-completion-independent-http.mjs': ['tests/evidence/household-completion-independent/http.json'],
  'tests/household-completion-authority-review.mjs': ['tests/evidence/household-completion-independent/authority.json'],
  'tests/report-portability-after-http.mjs': ['tests/evidence/report-portability-independent-after/http.json','tests/evidence/report-portability-independent-after/adversarial-after.json'],
  'tests/indicator-household-counting-contract.mjs': ['tests/evidence/report-household-counting-repair/contract.json'],
  'tests/indicator-figures-submission-independent.mjs': ['tests/evidence/report-household-counting-independent/submission-freshness-http.json'],
  'tests/report-portability-http.mjs': ['tests/evidence/report-portability/http.json'],
  'tests/inbound-conflicts-contract.mjs': ['tests/evidence/inbound-conflicts-assignment-repair/contracts.json'],
  'tests/inbound-conflicts-http.mjs': ['tests/evidence/inbound-conflicts-assignment-repair/http.json'],
  'tests/inbound-conflicts-browser.mjs': ['tests/evidence/inbound-conflicts-assignment-repair/browser.json'],
  'tests/inbound-conflicts-pressure-repair.mjs': ['tests/evidence/inbound-conflicts-assignment-repair/http.json'],
  'tests/inbound-conflicts-transport-http.mjs': ['tests/evidence/app-first-frozen-figures-integration/inbound-transport.json'],
  'tests/inbound-conflicts-independent-authority.mjs': ['tests/evidence/app-first-frozen-figures-integration/inbound-authority/http.json'],
  'tests/inbound-conflicts-independent-handoff.mjs': ['tests/evidence/app-first-frozen-figures-integration/inbound-handoff/http.json'],
  'tests/indicator-figure-material-contract.mjs': ['tests/evidence/indicator-figures-freshness-repair/material-contract.json'],
  'tests/indicator-figures-http.mjs': ['tests/evidence/indicator-figures/http.json'],
  'tests/indicator-figures-edition-http.mjs': ['tests/evidence/indicator-figures/cross-edition-http.json'],
  'tests/indicator-figures-browser.mjs': ['tests/evidence/indicator-figures/browser.json'],
  'tests/indicator-figures-submission-http.mjs': ['tests/evidence/indicator-figures-freshness-repair/submission-freshness-http.json'],
  'tests/indicator-figures-review-authority.mjs': ['tests/evidence/indicator-figures-review/authority-http.json'],
  'tests/indicator-figures-review-submission.mjs': ['tests/evidence/indicator-figures-review/submission-freshness-after.json'],
  'tests/work-burden-transport-http.mjs': ['tests/evidence/ci-transport-review/burden-after.json'],
  'tests/app-offline-browser.mjs': ['tests/evidence/app-offline/result.json'],
  'tests/mapping-conformance-contract.mjs': ['tests/evidence/mapping-conformance/contract.json'],
  'tests/mapping-conformance-http.mjs': ['tests/evidence/mapping-conformance/http.json'],
  'tests/mapping-conformance-browser.mjs': ['tests/evidence/mapping-conformance/browser.json'],
  'tests/mapping-conformance-independent-http.mjs': ['tests/evidence/mapping-conformance-independent-review/http.json'],
  'tests/imported-evidence-contract.mjs': ['tests/evidence/imported-evidence/contract.json'],
  'tests/imported-evidence-http.mjs': ['tests/evidence/imported-evidence/http.json'],
  'tests/imported-evidence-browser.mjs': ['tests/evidence/imported-evidence/browser.json'],
  'tests/imported-evidence-independent-http.mjs': ['tests/evidence/imported-evidence-independent-review/http.json'],
  'tests/imported-evidence-independent-browser.mjs': ['tests/evidence/imported-evidence-independent-review/browser.json'],
  'tests/contact-import-independent-review.mjs': ['tests/evidence/contact-import-independent-review/adversarial.json'],
  'tests/mapping-lifecycle-contract.mjs': ['tests/evidence/mapping-lifecycle/contract.json'],
  'tests/mapping-lifecycle-review-contract.mjs': ['tests/evidence/mapping-lifecycle-review/contract.json'],
  'tests/mapping-lifecycle-http.mjs': ['tests/evidence/mapping-lifecycle/http.json'],
  'tests/mapping-lifecycle-review-http.mjs': ['tests/evidence/mapping-lifecycle-review/http.json'],
  'tests/mapping-lifecycle-browser.mjs': ['tests/evidence/mapping-lifecycle/browser.json'],
  'tests/mapping-lifecycle-review-browser.mjs': ['tests/evidence/mapping-lifecycle-review/browser.json'],
  'tests/smoke/hosted-smoke.mjs': ['tests/reports/smoke-hosted-selftest-result.json'],
  'tests/provider-ehr-execution-review.mjs': ['tests/evidence/provider-destination-independent/ehr-execution/result.json'],
};
const MANUAL = {
  'tests/composite-authority-independent-author-http.mjs': { needsEnv: [], directOnly: true, note: 'Retained cold repeat against exact7c716b97 with separate evidence; original current primary and extra authority driver remain guarded, avoiding duplicate acceptance counts.' },
  'tests/composite-authority-independent-browser.mjs': { needsEnv: [], directOnly: true, note: 'Retained cold repeat against exact7c716b97 with separate evidence; original current primary and extra authority driver remain guarded, avoiding duplicate acceptance counts.' },
  'tests/composite-authority-independent-compat.mjs': { needsEnv: [], directOnly: true, note: 'Retained cold repeat against exact7c716b97 with separate evidence; original current primary and extra authority driver remain guarded, avoiding duplicate acceptance counts.' },
  'tests/composite-authority-independent-contract.mjs': { needsEnv: [], directOnly: true, note: 'Retained cold repeat against exact7c716b97 with separate evidence; original current primary and extra authority driver remain guarded, avoiding duplicate acceptance counts.' },
  'tests/composite-authority-independent-csv-race.mjs': { needsEnv: [], directOnly: true, note: 'Retained cold repeat against exact7c716b97 with separate evidence; original current primary and extra authority driver remain guarded, avoiding duplicate acceptance counts.' },
  'tests/composite-authority-independent-http.mjs': { needsEnv: [], directOnly: true, note: 'Retained cold repeat against exact7c716b97 with separate evidence; original current primary and extra authority driver remain guarded, avoiding duplicate acceptance counts.' },
  'tests/composite-authority-independent-legacy-http.mjs': { needsEnv: [], directOnly: true, note: 'Retained cold repeat against exact7c716b97 with separate evidence; original current primary and extra authority driver remain guarded, avoiding duplicate acceptance counts.' },
  'tests/composite-authority-independent-live-race.mjs': { needsEnv: [], directOnly: true, note: 'Retained cold repeat against exact7c716b97 with separate evidence; original current primary and extra authority driver remain guarded, avoiding duplicate acceptance counts.' },

  'tests/composite-measures-before-http.mjs': { needsEnv: [], directOnly: true, note: 'Historical original bounded-expression schema gap witness; not a current positive gate.' },
  'tests/composite-privacy-before-http.mjs': { needsEnv: [], directOnly: true, note: 'Historical primitive-only Boolean and zero-contributor complement disclosure witness with retained preimages; not a current positive gate.' },
  'tests/composite-measures-compat.mjs': { needsEnv: [], directOnly: true, note: 'Duplicate runner of six existing registered legacy unit suites; preserved author evidence, current originals remain guarded.' },
  'tests/composite-independent-contract.mjs': { needsEnv: [], directOnly: true, note: 'Independently repeated author contract with separate retained evidence; counted current primary is composite-measures-contract.' },
  'tests/composite-independent-http.mjs': { needsEnv: [], directOnly: true, note: 'Independently repeated primary composite HTTP baseline; retained original evidence, current primary remains guarded.' },
  'tests/composite-independent-browser.mjs': { needsEnv: [], directOnly: true, note: 'Independently repeated primary composite phone baseline; retained original evidence, current primary remains guarded.' },
  'tests/composite-independent-compat.mjs': { needsEnv: [], directOnly: true, note: 'Independent duplicate of six existing legacy unit suites; originals remain guarded.' },
  'tests/composite-independent-legacy-http.mjs': { needsEnv: [], directOnly: true, note: 'Preserved scoped duplicate legacy HTTP suite; current full API gate runs original assertions.' },
  'tests/composite-independent-live-race.mjs': { needsEnv: [], directOnly: true, note: 'Historical original after-audit membership disclosure witness with immutable failed evidence; current positive is composite-authority-repair-http.' },
  'tests/composite-independent-csv-race.mjs': { needsEnv: [], directOnly: true, note: 'Historical original after-audit CSV membership disclosure witness with immutable failed evidence; current positive is composite-authority-repair-http.' },

  'tests/inbound-retrieval-independent-browser.mjs': { needsEnv: [], directOnly: true, note: 'Retained original retrieval diagnostic or duplicate pre-repair review driver; current positive service and actual handoff suites are registered separately.' },
  'tests/inbound-retrieval-independent-http.mjs': { needsEnv: [], directOnly: true, note: 'Retained original retrieval diagnostic or duplicate pre-repair review driver; current positive service and actual handoff suites are registered separately.' },
  'tests/inbound-retrieval-purpose-review.mjs': { needsEnv: [], directOnly: true, note: 'Retained original retrieval diagnostic or duplicate pre-repair review driver; current positive service and actual handoff suites are registered separately.' },
  'tests/inbound-retrieval-service-review.mjs': { needsEnv: [], directOnly: true, note: 'Retained original retrieval diagnostic or duplicate pre-repair review driver; current positive service and actual handoff suites are registered separately.' },
  'tests/inbound-retrieval-before.mjs': { needsEnv: [], directOnly: true, note: 'Retained original retrieval diagnostic or duplicate pre-repair review driver; current positive service and actual handoff suites are registered separately.' },
  'tests/household-completion-before.mjs': { needsEnv: [], directOnly: true, note: 'Historical actual a408 missing-contract witness; retains15 diagnostic assertions with zero positive acceptance and must not run against implemented current household commands.' },
  'tests/report-portability-independent-http.mjs': { needsEnv: [], directOnly: true, note: 'Historical original473 verifier failure diagnostic; asserts unsafe archive acceptance and must never run as positive current regression.' },
  'tests/report-portability-expanded-http.mjs': { needsEnv: [], directOnly: true, note: 'Historical expanded original473 verifier diagnostic with retained purpose probes; current repaired positive is report-portability-after-http.mjs.' },
  'tests/household-completion-independent-browser.mjs': { needsEnv: [], directOnly: true, note: 'Retained independently repeated39-check phone driver; active same counted production journey is household-completion-browser.mjs.' },
  'tests/indicator-household-coverage-upgrade.mjs': { needsEnv: [], directOnly: true, note: 'Actual retained-V2-D1 upgrade requires public fixture creation by separately built V2 source; never synthesize legacy coverage under current V3 Worker. Retained independent before/after evidence is dependency-bound.' },
  'tests/indicator-household-coverage-independent.mjs': { needsEnv: [], directOnly: true, note: 'Independent actual retained-V2-D1 upgrade requires its separately built old V2 fixture; documented manual dependency, not fresh CI fixture creation.' },
  'tests/inbound-conflicts-independent-http.mjs': { needsEnv: [], directOnly: true, note: 'Retained original independent handoff review driver; active counted canonical positive is inbound-conflicts-independent-handoff.mjs with separate evidence output.' },
  'tests/inbound-conflicts-authority-review.mjs': { needsEnv: [], directOnly: true, note: 'Retained original independent authority driver; active counted canonical positive is inbound-conflicts-independent-authority.mjs with separate evidence output.' },
  'tests/inbound-conflicts-pressure-review.mjs': { needsEnv: [], directOnly: true, note: 'Historical mixed-component blood pressure provenance defect diagnostic against original2158; current positive is inbound-conflicts-pressure-repair.mjs.' },
  'tests/indicator-household-completion-audit.mjs': { needsEnv: [], directOnly: true, note: 'Historical combined production-function diagnostic imports exact stable B13 modules from its sibling checkout and asserts the pre-repair derived-open counting mismatch; diagnostic only, never a positive feature gate.' },
  'tests/indicator-figures-review-upgrade.mjs': { needsEnv: [], directOnly: true, note: 'Actual old-D1 upgrade requires the retained pre-repair Worker fixture and .wrangler/figure-review-upgrade.json created against that exact source. Never run against a newly invented legacy fixture; current positive cancellation regression is indicator-figures-review-submission.mjs.' },
  'tests/mapping-remaining-contract-http.mjs': { needsEnv: [], directOnly: true, note: 'Historical mapping contract gap witness; current positive tests are mapping-conformance suites.' },
  'tests/imported-evidence-before.mjs': { needsEnv: [], directOnly: true, note: 'Historical imported evidence gap witness; current positive tests are imported-evidence suites.' },
  'tests/contact-import-before.mjs': { needsEnv: [], directOnly: true, note: 'Historical contacts/reversal schema witness before B08. Positive contacts checks are contract, HTTP/phone and independent review suites.' },
  'tests/household-reschedule-before-driver.mjs': { needsEnv: [], directOnly: true, note: 'Historical schema/dispatcher witness at fb585412; current positive checks are household-reschedule-contract.mjs and household-reschedule-http.mjs.' },
  'tests/offline-lifecycle-auth-transport-review.mjs': { needsEnv: [], directOnly: true, note: 'Bounded normal-fetch stress diagnostic retains unresolved cross-site transport failures; positive identity regression is offline-opens-auth-first-http.mjs. Not a passing stress gate.' },
  'tests/provider-ehr-header-review.mjs': { needsEnv: [], directOnly: true, note: 'Historical conditional-create header representation loss; positive regression is provider-ehr-headers-contract.mjs.' },
  'tests/provider-agent-escape-review.mjs': { needsEnv: [], directOnly: true, note: 'Historical decoded-source provider guard reproducer; positive regression is provider-agent-decoded-contract.mjs.' },
  'tests/provider-frontline-escape-review.mjs': { needsEnv: [], directOnly: true, note: 'Historical Unicode contact provider guard reproducer; positive regression is provider-frontline-decoded-contract.mjs.' },
  'tests/offline-open-account-transition-review-browser.mjs': { needsEnv: [], directOnly: true, note: 'Historical wrong-account report reproducer; positive regression is offline-open-account-binding-browser.mjs.' },
  'tests/offline-open-link-capacity-review-browser.mjs': { needsEnv: [], directOnly: true, note: 'Historical abandoned unsent-link capacity reproducer; positive regression is offline-open-unsent-pruning-browser.mjs.' },
  'tests/clinical-source-adversarial-review.mjs': { needsEnv: [], directOnly: true, note: 'Historical deliberately corrupted acquired dependency activation reproducer; positive regression is clinical-source-dependency-http.mjs.' },
  'tests/work-burden-ledger-adversarial-review.mjs': { needsEnv: [], directOnly: true, note: 'Historical defect reproducer against 237497f6; deliberately asserts the pre-repair queue failure. Positive current regression is work-support-visibility-http.mjs.' },
  'tests/work-support-permission-race-review.mjs': { needsEnv: [], directOnly: true, note: 'Historical audit-window helper-choice defect reproducer; deliberately asserts stale helper guidance. Positive current regression is work-support-visibility-http.mjs.' },
  'tests/work-support-workflow-race-review.mjs': { needsEnv: [], directOnly: true, note: 'Historical former-helper disclosure reproducer; deliberately asserts the pre-repair stale workflow snapshot. Positive current regression is work-support-visibility-http.mjs.' },
  'tests/nfr/memory-profile.mjs': { needsEnv: [], note: 'bounded loopback inspector diagnostic; snapshots alter collection cadence and do not replace no-inspector memory-growth qualification' },
  'tests/nfr/memory-profile-ledger.mjs': { needsEnv: [], directOnly: true, note: 'read-only analysis of the completed memory profiler databases; run directly after memory-profile.mjs, never before it' },
  'tests/app-first-browser.mjs': { needsEnv: [], note: 'direct Chromium journey against an isolated synthetic Worker; equivalent CI journey is tests/ui/app-first-phone.spec.mjs' },
  'tests/a11y-audit.mjs': { needsEnv: ['SAHA_A11Y_MODULES', 'SAHA_A11Y_CHROMIUM', 'SAHA_A11Y_ORIGIN'], note: 'axe over 66 screens; needs Playwright and axe-core installed outside the project and a running synthetic Worker (docs/current/DEVELOPMENT-AND-CI.md)' },
  'tests/load-envelope.mjs': { needsEnv: [], note: 'local load probe toward the BRD planning envelope; builds its own large synthetic database and takes many minutes; needs dist/' },
  'tests/adapter-overhead-bench.mjs': { needsEnv: [], note: 'local benchmark of per-adapter overhead; in-process, no Worker' },
  // Pull request #126 (independent anaemia-provider demonstration). Run on purpose by someone who has what each needs.
  'tests/run-anaemia-http.mjs': { needsEnv: [], note: 'reruns only the anaemia HTTP module against the existing .wrangler/test-state; the same checks run inside tests/run-api-smoke.mjs; needs dist/' },
  'tests/anaemia-ui.cjs': { needsEnv: [], directOnly: true, note: 'jsdom and canvas component checks of the anaemia panel; jsdom and @napi-rs/canvas are not project dependencies, so run it directly: node tests/anaemia-ui.cjs <path to jsdom> <path to @napi-rs/canvas>' },
  'tests/anaemia-connected-worker.mjs': { needsEnv: [], directOnly: true, note: 'built local Worker against the separately hosted private anaemia provider; reads service credentials on hidden stdin and writes tracked evidence, so only the credential holder runs it directly, never CI' },
  'tests/anaemia-hosted-connection.mjs': { needsEnv: [], directOnly: true, note: 'diagnostic of the two separately hosted private demonstrations; reads service credentials on hidden stdin and writes tracked evidence, so only the credential holder runs it directly, never CI' },
};

/** Files under tests/ that look like code, as sorted repository-relative POSIX paths. */
export function listTestFiles(root = process.cwd()) {
  const out = [];
  const walk = rel => {
    for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
      const p = posix.join(rel, e.name);
      if (e.isDirectory()) { if (!SKIPPED_DIRS.has(e.name)) walk(p); }
      else if (SOURCE_EXT.test(e.name)) out.push(p);
    }
  };
  if (existsSync(join(root, 'tests'))) walk('tests');
  return out.sort();
}

const isSupport = p => /(^|\/)(lib|fixtures|helpers|support|utils|pages|data)\//.test(p) || posix.basename(p).startsWith('_') || p === 'tests/database-fixtures.mjs';
const idOf = (layer, file) => `${layer}/${posix.basename(file).replace(SOURCE_EXT, '')}`;

/**
 * Classify one file. Returns null when no rule matches (an error in checkCatalogue).
 * { layer, role: 'suite' | 'component' | 'support', tier: 'pr' | 'extended' | 'manual', runner: 'node' | 'playwright' }
 */
export function classify(file) {
  const base = posix.basename(file);
  if (file === 'tests/programme-raw-key-contract.mjs') return { layer: 'unit', role: 'suite', tier: 'pr', runner: 'node', reason: 'Raw programme map safety with supported authoritative parse/digest unchanged' };
  if (['tests/programme-raw-key-http.mjs','tests/programme-raw-key-original-probe.mjs','tests/raw-key-independent-authority-http.mjs'].includes(file)) return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'Actual raw-key refusal before clinical/receipt/audit writes, original before repair probe and distinct current authority controls' };
  if (/^tests\/raw-key-independent-/.test(file)) return { layer: 'manual', role: 'suite', tier: 'manual', runner: 'node', directOnly: true, reason: 'Immutable cold repetitions and preceding extended probe; current strongest primary authority gate retained separately' };

  const offlineAdapters = {
    'tests/integration-offline-guided-app-browser.mjs': 'integration/app-offline-browser',
    'tests/integration-offline-guided-review-browser.mjs': 'integration/app-offline-review-browser',
    'tests/integration-offline-guided-programme-browser.mjs': 'integration/offline-programme-browser',
  }[file];
  if (offlineAdapters) return { id: offlineAdapters, layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'Every original assertion/minimum retained with explicit Show full form navigation and exact newly fixed public asset allowlist; original evidence immutable' };
  if (['tests/app-offline-browser.mjs','tests/app-offline-review-browser.mjs','tests/offline-programme-browser.mjs'].includes(file)) return { layer: 'manual', role: 'suite', tier: 'manual', runner: 'node', directOnly: true, reason: 'Immutable pre-guidance fixtures; all original guarded assertions retained in current guided-shell adapters' };
  if (['tests/sync-receipt-projection.mjs','tests/sync-receipt-device-contract.mjs'].includes(file)) return { layer: 'unit', role: 'suite', tier: 'pr', runner: 'node', reason: 'Supported wire/parsed receipt comparison and encrypted proof custody; server digest unchanged' };
  if (['tests/offline-guided-author-browser.mjs','tests/offline-sync-hash-repair-browser.mjs','tests/offline-sync-hash-device-browser.mjs','tests/offline-sync-hash-cold-extra-browser.mjs','tests/sync-receipt-cold-scope-browser.mjs'].includes(file)) return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'Actual guided phone, exact-key uncertain sync recovery, proof-only purge and current actor/authority controls' };
  if (/^tests\/(?:offline-guided-|offline-sync-hash-|sync-receipt-cold-)/.test(file)) return { layer: 'manual', role: 'suite', tier: 'manual', runner: 'node', directOnly: true, reason: 'Immutable before witnesses or cold overlapping repetitions; distinct current primary contracts and phone recovery remain guarded' };

  if (/^tests\/programme-own-cold-/.test(file)) return { layer: 'manual', role: 'suite', tier: 'manual', runner: 'node', directOnly: true, reason: 'Immutable independent frontend own-read repetitions and historical malformed server-input witness; current original programme guards retained, transport repair is separately qualified' };
  if (/^tests\/offline-phone-independent-/.test(file)) return { layer: 'manual', role: 'suite', tier: 'manual', runner: 'node', directOnly: true, reason: 'Separately retained cold diagnosis adapters with unchanged primary13/32 phone assertions and observation-only checkpoints; original suites stay guarded' };
  if (file === 'tests/test-runner-current-fixture-contract.mjs') return { id: 'unit/test-runner-contract', layer: 'unit', role: 'suite', tier: 'pr', runner: 'node', reason: 'All27 original runner assertions and stable minimum; absent-smoke fixture excludes archived smoke driver stubs so the tested directory is actually absent' };
  if (file === 'tests/test-runner-contract.mjs') return { layer: 'manual', role: 'suite', tier: 'manual', runner: 'node', directOnly: true, reason: 'Immutable original runner fixture; current27-check stable guarded adapter retains all assertions with truly absent smoke directory' };
  if (file === 'tests/imported-media-independent-probe.mjs') return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'Actual imported attachment bytes, exact documentary lineage and44 added current authority/storage/audit-race assertions alongside40 original checks' };
  if (/^tests\/imported-media-(?:independent-repeat|repeat-)/.test(file)) return { layer: 'manual', role: 'suite', tier: 'manual', runner: 'node', directOnly: true, reason: 'Immutable cold repeat adapters; original primary gates and distinct independent probe remain guarded' };
  const adapted = {
    'tests/integration-composite-authority-time-http.mjs': 'integration/composite-authority-independent-extra-http',
    'tests/integration-household-completion-browser.mjs': 'integration/household-completion-browser',
    'tests/integration-report-portability-schema-http.mjs': 'integration/report-portability-http',
    'tests/smoke/app-back-guided-browser.mjs': 'smoke/app-back-browser',
  }[file];
  if (adapted) return { id: adapted, layer: adapted.startsWith('smoke/') ? 'smoke' : 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'Original guarded ID and all original assertions retained in named current-schema, portable-path, realistic release-margin or guided-stage adapter; historical driver and evidence remain intact' };
  if (['tests/composite-authority-independent-extra-http.mjs','tests/household-completion-browser.mjs','tests/report-portability-http.mjs','tests/smoke/app-back-browser.mjs','tests/media-imported-lineage-before.mjs','tests/media-imported-lineage-repair-http.mjs'].includes(file)) return { layer: 'manual', role: 'suite', tier: 'manual', runner: 'node', directOnly: true, reason: 'Preserved historical fixture or separately pinned imported-lineage diagnostic/repeat; current original assertion minima stay guarded by named adapters or original imported-evidence primary' };
  if (isSupport(file)) return { layer: null, role: 'support', tier: null, reason: 'shared helper, fixture or entry module; not a suite' };
  if (file === 'tests/api-smoke.mjs') return { layer: 'integration', role: 'support', tier: null, reason: 'entry module imported by tests/run-api-smoke.mjs; not run on its own' };
  if (file === 'tests/guided-home-capture-browser.mjs') return { id: 'integration/guided-home-browser', layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'Stable guarded Home ID and all original 33 assertions; stage-selection adapter for the current guided visit, original driver/evidence retained' };
  if (['tests/asha-guided-capture-browser.mjs','tests/asha-guided-capture-conditional.mjs','tests/asha-guided-capture-uncertainty.mjs','tests/asha-guided-capture-legacy-range.mjs','tests/guided-programme-reset-original-probe.mjs','tests/guided-programme-reset-variants.mjs','tests/guided-repair-independent-probe.mjs'].includes(file)) return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'Actual phone guided facts/programmes, explicit save/current-read recovery, three-way merge and original outcome conservation' };
  if (/^tests\/(?:asha-guided-capture-|guided-capture-independent-|guided-programme-reset-|guided-repair-independent-|guided-home-browser)/.test(file)) return { layer: 'manual', role: 'suite', tier: 'manual', runner: 'node', directOnly: true, reason: 'Retained historical before diagnostic, original Home stage dependency or duplicate independent repeat; current primary and distinct repair probes remain guarded' };
  if (file === 'tests/integration-media-report-portability-after-http.mjs') return { id: 'integration/report-portability-after-http', layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'Stable guarded portability suite ID and all original 87 assertions; separately retained current 0029 schema adapter, original driver/evidence preserved' };
  if (file === 'tests/object-media-legacy-regression.mjs') return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'Both unchanged 44-check legacy media mode runs with exact aggregated result count' };
  if (file === 'tests/object-media-legacy-http.mjs') return { layer: 'manual', role: 'suite', tier: 'manual', runner: 'node', directOnly: true, reason: 'Original two-mode driver imported by guarded object-media-legacy-regression; original assertions and array report retained' };
  if (file === 'tests/report-portability-after-http.mjs') return { layer: 'manual', role: 'suite', tier: 'manual', runner: 'node', directOnly: true, reason: 'Immutable original 0028 schema-bound driver retained; current same 87 assertions are guarded in integration-media-report-portability-after-http without altering the original evidence' };
  if (/^tests\/(?:integration-object-media-|integration-media-)/.test(file) || (/^tests\/figure-impact-independent-/.test(file) && file !== 'tests/figure-impact-independent-extra-http.mjs')) return { layer: 'manual', role: 'suite', tier: 'manual', runner: 'node', directOnly: true, reason: 'Retained independent or combined repeat adapter; original primary assertions and distinct extra outcomes remain guarded separately' };
  if (['tests/figure-impact-http.mjs','tests/figure-impact-browser.mjs','tests/figure-impact-independent-extra-http.mjs','tests/object-media-http.mjs','tests/object-media-browser.mjs','tests/object-media-budget-http.mjs','tests/object-media-native-boundary.mjs','tests/object-media-migration.mjs','tests/object-media-legacy-http.mjs','tests/object-media-independent-extra-http.mjs','tests/object-media-independent-storage-boundary.mjs'].includes(file)) return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'Actual synthetic private media custody/current authority and automatic frozen figure impact with independently retained audit-race outcomes' };
  if (['tests/inbound-retrieval-http.mjs', 'tests/inbound-retrieval-browser.mjs', 'tests/inbound-retrieval-service-repair-http.mjs', 'tests/inbound-retrieval-after-http.mjs', 'tests/inbound-retrieval-after-browser.mjs', 'tests/inbound-retrieval-original-race-after.mjs', 'tests/inbound-retrieval-service-independent-http.mjs'].includes(file)) return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'Actual retrieved source handoff with immutable first-document preservation, current service/purpose authority, receipt replay and phone tests' };
  if (['tests/composite-measures-http.mjs','tests/composite-measures-browser.mjs','tests/composite-authority-repair-http.mjs','tests/composite-authority-independent-extra-http.mjs'].includes(file)) return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'Actual owner-defined expression governance, live/frozen dependency protection, phone workflow and post-audit current report authority' };
  if (file === 'tests/guided-home-browser.mjs') return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'Actual guided ASHA Home, compact geometry, current audited navigation, language and unsaved save/review safeguards' };
  if (file === 'tests/run-api-smoke.mjs') return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'HTTP and D1 suite against the built Worker' };
  if (['tests/household-completion-http.mjs','tests/household-completion-browser.mjs','tests/household-completion-independent-http.mjs','tests/household-completion-authority-review.mjs','tests/report-portability-after-http.mjs','tests/indicator-figures-submission-independent.mjs','tests/report-portability-http.mjs'].includes(file)) return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'Actual household completion/outreach authority and phone journey, supported report cancellation and protected metadata-only operational export with verifier tamper checks' };
  if (['tests/inbound-conflicts-http.mjs','tests/inbound-conflicts-browser.mjs','tests/inbound-conflicts-pressure-repair.mjs','tests/inbound-conflicts-transport-http.mjs','tests/inbound-conflicts-independent-authority.mjs','tests/inbound-conflicts-independent-handoff.mjs'].includes(file)) return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'Reviewed inbound clinical-source queue, exact current authority/receipt recovery, coupled pressure provenance and normal no-retry refusal transport' };
  if (['tests/indicator-figures-http.mjs','tests/indicator-figures-edition-http.mjs','tests/indicator-figures-browser.mjs','tests/indicator-figures-submission-http.mjs','tests/indicator-figures-review-authority.mjs','tests/indicator-figures-review-submission.mjs'].includes(file)) return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'Actual frozen report editions, cross-edition disclosure limits, current authority, submission freshness and phone workflows; default review-submission mode is the positive repaired regression' };
  if (file === 'tests/work-burden-transport-http.mjs') return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'Actual bounded normal-fetch pooled and streamed refusal transport; unchanged zero clinical/metrics ledgers' };
  if (['tests/mapping-conformance-http.mjs','tests/mapping-conformance-browser.mjs','tests/mapping-conformance-independent-http.mjs','tests/imported-evidence-http.mjs','tests/imported-evidence-browser.mjs','tests/imported-evidence-independent-http.mjs','tests/imported-evidence-independent-browser.mjs'].includes(file)) return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'Actual independently reviewed mapping conformance and retained historical evidence authority and phone checks' };
  if (['tests/contact-import-http.mjs','tests/contact-import-independent-review.mjs'].includes(file)) return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'Actual scoped synthetic contacts import, reversal, current-authority receipt replay and phone workflow' };
  if (['tests/mapping-lifecycle-http.mjs','tests/mapping-lifecycle-review-http.mjs','tests/mapping-lifecycle-browser.mjs','tests/mapping-lifecycle-review-browser.mjs'].includes(file)) return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'Actual reviewed mapping impact, effective-date authority, preserved delivery and phone history checks' };
  if (['tests/indicator-governance-http.mjs','tests/indicator-governance-clock-http.mjs','tests/indicator-governance-browser.mjs','tests/indicator-governance-independent-http.mjs'].includes(file)) return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'Actual independently reviewed effective indicator definitions and historical-report clock boundary' };
  if (file === 'tests/offline-opens-transport-http.mjs') return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'actual normal-fetch and streamed oversized refusal transport regression without retries' };
  if (['tests/household-reschedule-http.mjs','tests/household-reschedule-independent-http.mjs'].includes(file)) return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'actual synthetic Worker/D1 atomic rescheduling, rollback, current authority and phone touch regressions' };
  if (['tests/offline-opens-auth-first-http.mjs','tests/offline-opens-http.mjs','tests/offline-opens-browser.mjs','tests/offline-open-account-binding-browser.mjs','tests/offline-open-unsent-pruning-browser.mjs','tests/work-burden-field-continuation-http.mjs','tests/work-burden-field-hooks-browser.mjs','tests/work-burden-field-identity-review.mjs','tests/work-burden-continuation-phone-review.mjs','tests/work-burden-continuation-adversarial-review.mjs','tests/clinical-source-http.mjs','tests/clinical-source-browser.mjs','tests/clinical-source-identity-http.mjs','tests/clinical-source-retrieval-http.mjs','tests/clinical-source-retrieval-browser.mjs','tests/clinical-source-dependency-http.mjs'].includes(file)) return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'actual synthetic Worker, database and browser lifecycle regressions' };
  if (['tests/app-offline-review-browser.mjs', 'tests/app-offline-scope-browser.mjs', 'tests/touch-units-browser.mjs', 'tests/app-offline-browser.mjs', 'tests/reconciliation-http.mjs', 'tests/reminder-optout-http.mjs', 'tests/service-identity-management.mjs', 'tests/auxiliary-read-http.mjs', 'tests/workspace-metadata-smoke.mjs', 'tests/range-protocol-browser.mjs', 'tests/import-unit-parity-browser.mjs', 'tests/range-first-tap-browser.mjs', 'tests/offline-programme-browser.mjs', 'tests/delta-read-audit-http.mjs', 'tests/command-authority-http.mjs', 'tests/device-work-browser.mjs', 'tests/device-work-purge-failure-browser.mjs', 'tests/work-burden-http.mjs', 'tests/work-burden-browser.mjs', 'tests/work-burden-field-http.mjs', 'tests/work-burden-field-browser.mjs', 'tests/registration-device-browser.mjs', 'tests/work-burden-account-transition-review-browser.mjs', 'tests/registration-wire-receipt-http.mjs', 'tests/work-burden-ledger-http.mjs', 'tests/work-burden-ledger-browser.mjs', 'tests/work-burden-auth-first-http.mjs', 'tests/work-support-visibility-http.mjs'].includes(file)) return { layer: 'integration', role: 'suite', tier: 'pr', runner: 'node', reason: 'isolated synthetic built-Worker and D1 route checks' };
  if (['tests/reconciliation-ui.mjs', 'tests/reminder-optout-refresh-browser.mjs'].includes(file)) return { layer: 'smoke', role: 'suite', tier: 'pr', runner: 'node', reason: 'Chromium regression for delayed organisation-scope responses' };
  if (file === 'tests/scheduled-local-check.mjs') return { layer: 'integration', role: 'suite', tier: 'extended', runner: 'node', reason: 'served-Worker check of the scheduled handler; needs dist/ and a port, so not a unit test' };
  if (file === 'tests/recovery-drill.mjs') return { layer: 'resilience', role: 'suite', tier: 'pr', runner: 'node', reason: 'encrypted backup and restore against the database the HTTP suite populated' };
  if (MANUAL[file]) return { layer: 'manual', role: 'suite', tier: 'manual', runner: 'node', reason: 'run on purpose, not by default' };
  const m = file.match(/^tests\/([^/]+)$/);
  if (m) {
    if (/-smoke\.mjs$/.test(base)) return { layer: 'integration', role: 'component', tier: null, via: 'tests/run-api-smoke.mjs', reason: 'module imported by tests/api-smoke.mjs; despite the name it is an HTTP/D1 integration test' };
    if (/-(contract|client)\.mjs$/.test(base) || UNIT_NAMED.has(file)) return { layer: 'unit', role: 'suite', tier: 'pr', runner: 'node', reason: 'transpiles lib/saha modules and checks them with node:assert' };
    return null;
  }
  const d = file.match(/^tests\/(smoke|nfr|uat|ui)\/(.+)$/);
  if (d) {
    const [, layer, rest] = d;
    if (layer === 'ui') {
      if (/^playwright\.config\.[mc]?[jt]s$/.test(rest)) return { layer, role: 'suite', tier: 'extended', runner: 'playwright', reason: 'Playwright configuration; the *.spec.* files are its components' };
      if (/\.(spec|test)\.[mc]?[jt]sx?$/.test(rest)) return { layer, role: 'component', tier: null, via: 'tests/ui/playwright.config', reason: 'Playwright spec run through the configuration' };
    }
    if (!rest.includes('/') && /\.mjs$/.test(rest)) return { layer, role: 'suite', tier: layer === 'smoke' ? 'pr' : 'extended', runner: 'node', reason: `${layer} suite` };
    return null;
  }
  return null;
}

/** Module paths imported by tests/api-smoke.mjs ('./x.mjs' strings, static or dynamic). */
export function importedModules(root = process.cwd()) {
  const p = join(root, 'tests/api-smoke.mjs');
  if (!existsSync(p)) return [];
  return [...new Set([...readFileSync(p, 'utf8').matchAll(/['"]\.\/([A-Za-z0-9_-]+\.mjs)['"]/g)].map(m => `tests/${m[1]}`))].sort();
}

/** requirement id -> evidence paths, as scripts/audit-requirements.mjs resolves them; returns Map<file, Set<requirement id>>. */
export function requirementsByFile(root = process.cwd()) {
  const map = new Map();
  const brd = join(root, 'requirements/brd-v1.1.json'), ev = join(root, 'requirements/evidence-map.json');
  if (!existsSync(brd) || !existsSync(ev)) return map;
  const ids = JSON.parse(readFileSync(brd, 'utf8')).requirements.map(r => r.id), evidence = JSON.parse(readFileSync(ev, 'utf8'));
  for (const id of ids) {
    const key = id.startsWith('NFR-') ? id : id.split('-').slice(0, 2).join('-');
    for (const path of evidence[id] ?? evidence[key] ?? []) { if (!map.has(path)) map.set(path, new Set()); map.get(path).add(id); }
  }
  return map;
}

/** Result-file names a suite is known to write, found in its own source (and its entry module). */
function resultHints(root, files) {
  const hints = new Set();
  for (const f of files) {
    if (!existsSync(join(root, f))) continue;
    // Only literal "tests/<name>-result.json" strings; the report library's tests/reports/ paths are found at run time.
    for (const m of readFileSync(join(root, f), 'utf8').matchAll(/['"`](tests\/[A-Za-z0-9_-]+-result\.json)['"`]/g)) hints.add(m[1]);
  }
  return [...hints];
}

/**
 * Scan tests/ and classify everything. Returns { entries, suites, components, support, errors, imported }:
 * entries: every classified file with { file, id, layer, role, tier, runner, results, requirements, ... }.
 * errors: strings; an empty list means the catalogue is complete and consistent.
 */
export function buildCatalogue(root = process.cwd()) {
  const files = listTestFiles(root), errors = [], entries = [];
  const reqs = requirementsByFile(root), imported = importedModules(root);
  const components = [];
  for (const file of files) {
    const c = classify(file);
    if (!c) { errors.push(`Unclassified test file: ${file}. Put it in tests/smoke, tests/ui, tests/nfr or tests/uat, name it *-contract.mjs / *-client.mjs, or add an explicit rule in scripts/test-catalogue.mjs.`); continue; }
    const entry = { file, id: c.role === 'suite' ? idOf(c.layer, file) : null, ...c };
    entries.push(entry);
    if (c.role === 'component') components.push(entry);
  }
  const byFile = new Map(entries.map(e => [e.file, e]));
  // The HTTP/D1 entry and its components must agree in both directions.
  const entry = byFile.get('tests/api-smoke.mjs'), runner = byFile.get('tests/run-api-smoke.mjs');
  if (!runner) errors.push('tests/run-api-smoke.mjs is missing: the HTTP/D1 suite has no entry point.');
  if (!entry) errors.push('tests/api-smoke.mjs is missing: the HTTP/D1 suite has no entry module.');
  if (entry) {
    for (const c of components.filter(c => c.layer === 'integration')) if (!imported.includes(c.file)) errors.push(`${c.file} is not imported by tests/api-smoke.mjs, so it never runs. Import it there, or rename it if it is not part of the HTTP/D1 suite.`);
    for (const m of imported) if (!existsSync(join(root, m))) errors.push(`tests/api-smoke.mjs imports ${m}, which does not exist.`);
  }
  for (const f of Object.keys(MANUAL)) if (!byFile.has(f)) errors.push(`${f} is a named manual suite but does not exist.`);
  for (const f of ['tests/recovery-drill.mjs']) if (!byFile.has(f)) errors.push(`${f} is a named suite but does not exist.`);
  const specs = entries.filter(e => e.layer === 'ui' && e.role === 'component'), configs = entries.filter(e => e.layer === 'ui' && e.runner === 'playwright');
  if (specs.length && !configs.length) errors.push(`tests/ui has ${specs.length} Playwright spec file(s) but no tests/ui/playwright.config.{mjs,js,ts}; add one so the runner can run them.`);
  if (configs.length > 1) errors.push(`More than one Playwright configuration: ${configs.map(c => c.file).join(', ')}.`);
  // Requirement ids: a suite cites what its own file cites; the HTTP/D1 suite also gets the entry module and every component.
  const cited = f => [...(reqs.get(f) ?? [])];
  for (const e of entries) {
    if (e.role === 'suite') {
      let from = [e.file];
      if (e.file === 'tests/run-api-smoke.mjs') from = [e.file, 'tests/api-smoke.mjs', ...components.map(c => c.file)];
      if (e.runner === 'playwright') from = [e.file, ...specs.map(c => c.file)];
      e.requirements = [...new Set(from.flatMap(cited))].sort();
      e.results = SUITE_RESULTS[e.file] ?? resultHints(root, e.file === 'tests/run-api-smoke.mjs' ? [e.file, 'tests/api-smoke.mjs'] : [e.file]);
      if (e.layer === 'manual') Object.assign(e, MANUAL[e.file]);
      // Suites that start the built Worker need dist/; unit suites, UAT generators, the in-process benchmark and the accessibility audit (which talks to a Worker you started) do not.
      e.needs = ['unit', 'uat'].includes(e.layer) || ['tests/adapter-overhead-bench.mjs', 'tests/a11y-audit.mjs'].includes(e.file) ? [] : ['build'];
    } else if (e.role === 'component') e.requirements = cited(e.file).sort();
  }
  const suites = entries.filter(e => e.role === 'suite');
  const ids = new Set();
  for (const s of suites) { if (ids.has(s.id)) errors.push(`Two suites share the id ${s.id}.`); ids.add(s.id); }
  return { entries, suites, components, support: entries.filter(e => e.role === 'support'), imported, errors };
}

/** Counts for the catalogue report: suites and components per layer, support files, requirement coverage. */
export function summariseCatalogue(cat) {
  const perLayer = Object.fromEntries(FILE_LAYERS.map(l => [l, { suites: 0, components: 0, citingNoRequirement: 0, requirementIds: new Set() }]));
  for (const e of cat.entries) {
    if (e.role === 'support' || !perLayer[e.layer]) continue;
    const l = perLayer[e.layer];
    if (e.role === 'suite') { l.suites++; if (!e.requirements.length) l.citingNoRequirement++; e.requirements.forEach(r => l.requirementIds.add(r)); }
    else l.components++;
  }
  const all = new Set(cat.suites.flatMap(s => s.requirements));
  return {
    layers: Object.fromEntries(Object.entries(perLayer).map(([k, v]) => [k, { suites: v.suites, components: v.components, suitesCitingNoRequirement: v.citingNoRequirement, requirementsCited: v.requirementIds.size }])),
    supportFiles: cat.support.length, suites: cat.suites.length, components: cat.components.length, requirementsCitedBySomeSuite: all.size,
    suitesCitingNoRequirement: cat.suites.filter(s => !s.requirements.length).length,
    componentsCitingNoRequirement: cat.components.filter(c => !c.requirements.length).length,
    requirementsCitedBySomeTest: new Set([...all, ...cat.components.flatMap(c => c.requirements)]).size,
  };
}
