// BR-ID-02 / APL-194: one counted native entry, preserving all eight locality groups.
import { runScopedLocality } from '../scripts/scoped-locality-runner.mjs';
await runScopedLocality();
