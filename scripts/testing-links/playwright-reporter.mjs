import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export default class LinkedReporter {
  constructor(options = {}) { this.options = options; this.attempts = []; this.errors = []; }
  onBegin() {
    this.output = resolve(this.options.output ?? process.env.SAHA_LINKED_OUTPUT ?? 'tests/reports/linked-playwright.json');
    if (existsSync(this.output)) throw new Error('Use a new output path; previous run evidence is immutable');
    this.registry = JSON.parse(readFileSync(this.options.registry ?? new URL('./scenario-links.json', import.meta.url), 'utf8'));
    this.metadata = JSON.parse(readFileSync(this.options.metadata ?? process.env.SAHA_RUN_METADATA, 'utf8'));
    if (!this.metadata.runId || !/^[0-9a-f]{40}$/.test(this.metadata.codeSha ?? '') || !this.metadata.environment) throw new Error('Run identity, exact SHA and environment required');
    this.startedAt = new Date().toISOString();
  }
  onTestEnd(test, result) {
    const ids = [...new Set(test.annotations.filter(x => x.type === 'scenario').map(x => x.description))];
    const unknown = ids.filter(id => !this.registry.scenarios[id]);
    this.attempts.push({ testId: test.id, title: test.titlePath().join(' > '), retry: result.retry,
      startedAt: result.startTime.toISOString(), durationMs: result.duration, status: result.status,
      expectedStatus: test.expectedStatus, scenarioIds: ids, unmapped: ids.length === 0, unknownScenarioIds: unknown,
      owners: [...new Set(ids.flatMap(id => this.registry.scenarios[id]?.ownerIds ?? []))],
      taskLinks: ids.flatMap(id => this.registry.scenarios[id]?.taskLinks ?? []),
      errors: result.errors.map(x => ({ message: x.message, stack: x.stack })),
      attachments: result.attachments.map(x => ({ name: x.name, contentType: x.contentType, path: x.path ?? null })) });
  }
  onError(error) { this.errors.push({ message: error.message, stack: error.stack }); }
  onEnd(result) {
    if (!this.output || !this.metadata) throw new Error('Reporter did not initialize; no pass report');
    const invalid = this.attempts.some(x => x.unknownScenarioIds.length);
    const byTest = new Map();
    for (const attempt of this.attempts) byTest.set(attempt.testId, attempt);
    const final = [...byTest.values()];
    const report = { schemaVersion: '1.0', tool: 'playwright', metadata: this.metadata,
      startedAt: this.startedAt, finishedAt: new Date().toISOString(), runnerStatus: result.status,
      mappingStatus: invalid ? 'invalid' : 'valid', assertionsCount: null,
      counts: { testCases: final.length, attempts: this.attempts.length,
        passed: final.filter(x => x.status === 'passed').length,
        failed: final.filter(x => ['failed','timedOut','interrupted'].includes(x.status)).length,
        skipped: final.filter(x => x.status === 'skipped').length,
        unmapped: final.filter(x => x.unmapped).length,
        retried: final.filter(x => x.retry > 0).length },
      attempts: this.attempts, globalErrors: this.errors,
      formalAcceptanceGranted: false, storyDoneGranted: false, humanApprovalGranted: false };
    mkdirSync(dirname(this.output), { recursive: true });
    writeFileSync(this.output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    return { status: invalid || this.errors.length ? 'failed' : result.status };
  }
}
