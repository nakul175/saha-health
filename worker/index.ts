// Slice 10a: the Worker entry. It delegates every HTTP request to the application exactly as `vinext/server/fetch-handler`
// does (the entry vite.config.ts used before) and adds the `scheduled` handler that a Cloudflare Cron Trigger calls.
// `triggers.crons` is set only in the hosted configuration (scripts/cloudflare-staging.mjs); where no trigger is
// configured this handler is never called and the Worker behaves as before.
import handler from 'vinext/server/fetch-handler';
import { runScheduled } from '../lib/saha/scheduled-job';

type ScheduledEnv = { DB?: D1Database } & Record<string, unknown>;

export default {
  fetch: (request: Request, env: unknown, ctx: ExecutionContext) => handler.fetch(request, env, ctx),
  async scheduled(controller: ScheduledController, env: ScheduledEnv, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      const started = Date.now();
      try {
        if (!env.DB) { console.error('Scheduled job not run: no database binding'); return; }
        const run = await runScheduled(env.DB, env as Record<string, string | undefined>);
        if (run.refused) { console.error('Scheduled job refused: environment is not configured correctly'); return; }
        const sum = (pick: (o: (typeof run.organisations)[number]) => number) => run.organisations.reduce((n, o) => n + pick(o), 0);
        console.log(JSON.stringify({ event: 'saha_scheduled', cron: controller.cron, organisations: run.organisations.length, notReached: run.notReached, stoppedBy: run.stoppedBy, transfers: sum(o => (o.transfers?.applied ?? 0) + (o.transfers?.held ?? 0)), reviews: sum(o => o.reviews?.marked ?? 0), problems: sum(o => o.problems.length), queries: run.queries, durationMs: Date.now() - started }));
      } catch (e) { console.error('Scheduled job failed', e instanceof Error ? e.name : 'unknown'); }
    })());
  },
};
