import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { descendantPids, memorySource, processMemory, processTable } from './lib/process-memory.mjs';
import { suite } from './lib/report.mjs';

const report = suite('Process memory and ownership', 'tests/reports/process-memory-result.json', {
  layer: 'unit', environment: 'local operating-system process samples; no application records',
  limits: ['Resident memory only, not Cloudflare isolate heap.', 'Linux exposes the memory breakdown; macOS exposes RSS only.'],
});
if (!memorySource) {
  report.skip('process measurements', 'operating system unsupported'); await report.finish();
} else {
  const children = [];
  const launch = async () => {
    const child = spawn(process.execPath, ['-e', 'globalThis.sampleBuffer=Buffer.alloc(16*1024*1024,1); console.log("ready"); setInterval(()=>{},1000);'], { stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    await Promise.race([once(child.stdout, 'data'), once(child, 'error').then(([error]) => { throw error; }),
      new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('sample child readiness timed out')), 5000); timer.unref(); })]);
    return child;
  };
  try {
    const a = await launch(), b = await launch(), table = processTable();
    await report.check('only descendants of the selected root are included', () => {
      const own = descendantPids(process.pid, table);
      assert.ok(own.includes(a.pid)); assert.ok(own.includes(b.pid)); assert.ok(!own.includes(process.pid));
      assert.ok(!descendantPids(a.pid, table).includes(b.pid));
    });
    await report.check('a real allocated child has positive resident memory', () => assert.ok(processMemory(a.pid, table).rss >= 16 * 1024));
    await report.check('unsupported breakdown values remain unknown', () => {
      const memory = processMemory(a.pid, table);
      if (memorySource === 'ps') assert.deepEqual([memory.anon, memory.file, memory.shmem], [null, null, null]);
      else assert.ok(memory.anon > 0 && memory.file >= 0 && memory.shmem >= 0);
    });
    await report.check('invalid process IDs cannot become command arguments', () => {
      for (const pid of ['1; echo secret', 0, -1, NaN, 1.5]) assert.throws(() => processMemory(pid), /positive process ID/);
    });
    await report.check('an unrelated cyclic ancestry snapshot terminates', () => {
      assert.deepEqual(descendantPids(10, [{ pid: 11, ppid: 10 }, { pid: 10, ppid: 11 }, { pid: 12, ppid: 99 }]), [11]);
    });
    const exited = once(a, 'exit'); a.kill('SIGTERM'); await exited;
    await report.check('a disappeared process is an error rather than a zero sample', () => assert.throws(() => processMemory(a.pid)));
  } finally {
    await Promise.all(children.filter(child => child.exitCode === null && child.signalCode === null).map(async child => {
      const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited;
    }));
    await report.finish({ memorySource });
  }
}
