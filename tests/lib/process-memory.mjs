import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

export const memorySource = existsSync('/proc/self/status') ? 'proc' : process.platform === 'darwin' ? 'ps' : null;

/** One operating-system snapshot. Memory is RSS in KiB, not isolate heap size. */
export function processTable() {
  if (memorySource === 'ps') {
    const output = execFileSync('/bin/ps', ['-axo', 'pid=,ppid=,rss=,comm='], { encoding: 'utf8', maxBuffer: 8 << 20 });
    return output.split('\n').flatMap(line => {
      const row = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(line);
      return row ? [{ pid: +row[1], ppid: +row[2], rss: +row[3], command: row[4] }] : [];
    });
  }
  if (memorySource !== 'proc') throw new Error('Process memory measurement is unsupported on this platform.');
  return readdirSync('/proc').filter(name => /^\d+$/.test(name)).flatMap(name => {
    try {
      const stat = readFileSync(`/proc/${name}/stat`, 'utf8');
      return [{ pid: +name, ppid: +stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1], command: readFileSync(`/proc/${name}/cmdline`, 'utf8').replace(/\0/g, ' ') }];
    } catch { return []; } // A process may end while the snapshot is read.
  });
}

export function descendantPids(root = process.pid, table = processTable()) {
  const out = [], seen = new Set([root]);
  const walk = pid => {
    for (const row of table) if (row.ppid === pid && !seen.has(row.pid)) {
      seen.add(row.pid); out.push(row.pid); walk(row.pid);
    }
  };
  walk(root); return out;
}

export function processMemory(pid, table) {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('A positive process ID is required.');
  if (memorySource === 'ps') {
    const row = (table ?? processTable()).find(row => row.pid === pid);
    if (!row) throw new Error('The measured process ended before its memory could be sampled.');
    // ps does not provide the Linux anonymous/file/shared breakdown. Unknown is not zero.
    return { rss: row.rss, anon: null, file: null, shmem: null };
  }
  if (memorySource !== 'proc') throw new Error('Process memory measurement is unsupported on this platform.');
  const status = readFileSync(`/proc/${pid}/status`, 'utf8');
  const value = key => {
    const match = new RegExp(`^${key}:\\s+(\\d+)`, 'm').exec(status);
    return match ? +match[1] : null;
  };
  const rss = value('VmRSS');
  if (rss === null) throw new Error('The measured process has no resident memory sample.');
  return { rss, anon: value('RssAnon'), file: value('RssFile'), shmem: value('RssShmem') };
}
